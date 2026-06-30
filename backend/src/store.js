'use strict';
/*
 * Capa de datos de Mimitu.
 *
 * Dos modos, misma interfaz síncrona (collection.find / insert / update / remove):
 *  - SIN DATABASE_URL  -> store JSON en disco (dev/demo). Carga al require.
 *  - CON  DATABASE_URL -> Postgres (Neon, etc.). Carga todo en memoria en init()
 *    y persiste los cambios como documentos JSONB (una fila por colección).
 *
 * Por qué este enfoque: el servidor usa predicados JS (find(pred)) y mutaciones
 * en memoria. Mantener todo en memoria y volcar a Postgres preserva esa interfaz
 * sin reescribir el resto, y alcanza de sobra para la escala del MVP (1 instancia).
 * Para escalar a varias instancias, migrar a tablas normalizadas (ver schema.sql).
 */
const fs = require('fs');
const path = require('path');

const EMPTY = {
  users: [], couples: [], actions: [], logs: [], rewards: [], redemptions: [],
  tournaments: [], dates: [], plans: [], dailyAnswers: [], feed: [],
  pushTokens: [], events: []
};
function clone(o) { return JSON.parse(JSON.stringify(o)); }

const DATABASE_URL = process.env.DATABASE_URL || '';
const PG = !!DATABASE_URL;

/* ---------- modo JSON (dev) ---------- */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
function fileEnsure() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY, null, 2)); }
function fileRead() { fileEnsure(); try { return Object.assign(clone(EMPTY), JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))); } catch (e) { return clone(EMPTY); } }
function fileWrite(db) { fileEnsure(); const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2)); fs.renameSync(tmp, DB_FILE); }

/* ---------- modo Postgres (prod) ---------- */
let pool = null;
let queryFn = null; // hook de test (inyecta pglite, etc.)
function setQueryFn(fn) { queryFn = fn; } // usado por tests
async function q(sql, params) {
  if (queryFn) return queryFn(sql, params);
  if (!pool) {
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1/.test(DATABASE_URL);
    pool = new Pool({ connectionString: DATABASE_URL, ssl: local ? false : { rejectUnauthorized: false } });
  }
  return pool.query(sql, params);
}

let cache = PG ? clone(EMPTY) : fileRead();
const dirty = new Set();
let timer = null;

function schedule() {
  if (timer) return;
  timer = setTimeout(function () { timer = null; flush().catch(function (e) { console.error('[store] flush error', e.message); }); }, 120);
}
async function flush() {
  if (!PG) return;
  if (queryFn === null && !pool) { /* lazy pool will be created by q() */ }
  var names = Array.from(dirty); dirty.clear();
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    await q('INSERT INTO kv(name,data) VALUES($1,$2::jsonb) ON CONFLICT(name) DO UPDATE SET data=excluded.data', [n, JSON.stringify(cache[n] || [])]);
  }
}
function touch(name) { if (PG) { dirty.add(name); schedule(); } else { fileWrite(cache); } }

/* ---------- API pública ---------- */
async function init() {
  if (!PG) return; // JSON ya cargado al require
  await q('CREATE TABLE IF NOT EXISTS kv (name text PRIMARY KEY, data jsonb NOT NULL)');
  var res = await q('SELECT name, data FROM kv');
  var loaded = clone(EMPTY);
  (res.rows || []).forEach(function (r) {
    var data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    if (loaded[r.name] !== undefined && Array.isArray(data)) loaded[r.name] = data;
  });
  cache = loaded;
}

function collection(name) {
  return {
    all: function () { return cache[name]; },
    find: function (pred) { return cache[name].filter(pred); },
    findOne: function (pred) { return cache[name].find(pred); },
    insert: function (row) { cache[name].push(row); touch(name); return row; },
    update: function (pred, patch) { var it = cache[name].find(pred); if (it) { Object.assign(it, patch); touch(name); } return it; },
    remove: function (pred) { cache[name] = cache[name].filter(function (x) { return !pred(x); }); touch(name); }
  };
}

function persist() { if (PG) { Object.keys(cache).forEach(function (n) { dirty.add(n); }); schedule(); } else { fileWrite(cache); } }

async function reset() {
  cache = clone(EMPTY);
  if (PG) { await q('DELETE FROM kv'); } else { fileWrite(cache); }
}

module.exports = { init, collection, persist, flush, reset, setQueryFn, _raw: function () { return cache; }, isPostgres: PG };
