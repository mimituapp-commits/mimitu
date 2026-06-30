'use strict';
/* ============================================================
   Mimitu API — Express + store JSON (dev) / Postgres (prod)
   ============================================================ */
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

const store = require('./src/store');
const { sign, authMiddleware, verifySocial } = require('./src/auth');
const { moderate, sendPush, saveBase64, UP_DIR } = require('./src/services');
const mp = require('./src/mercadopago');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' })); // permite fotos en base64
app.use('/uploads', express.static(UP_DIR));

const auth = authMiddleware(store);
const U = () => store.collection('users');
const C = () => store.collection('couples');
const A = () => store.collection('actions');
const L = () => store.collection('logs');
const R = () => store.collection('rewards');
const F = () => store.collection('feed');
const T = () => store.collection('tournaments');
const DT = () => store.collection('dates');
const PL = () => store.collection('plans');
const DA = () => store.collection('dailyAnswers');
const PT = () => store.collection('pushTokens');

const uid = (p) => (p || 'id_') + crypto.randomBytes(6).toString('hex');
const code6 = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[crypto.randomInt(a.length)]; return s; };
const now = () => Date.now();
const THRESHOLD_DEFAULT = 25;

const CATALOG = [
  { id: 'c1', name: 'Cocinar', emoji: '🍳', cat: 'Hogar', value: 30 },
  { id: 'c2', name: 'Lavar los platos', emoji: '🍽️', cat: 'Hogar', value: 15 },
  { id: 'c3', name: 'Ordenar la casa', emoji: '🧹', cat: 'Hogar', value: 20 },
  { id: 'c4', name: 'Sacar la basura', emoji: '🗑️', cat: 'Hogar', value: 10 },
  { id: 'c5', name: 'Hacer las compras', emoji: '🛒', cat: 'Hogar', value: 20 },
  { id: 'c6', name: 'Planear una cita', emoji: '💕', cat: 'Romance', value: 40 },
  { id: 'c7', name: 'Dar un masaje', emoji: '💆', cat: 'Romance', value: 35 },
  { id: 'c8', name: 'Mensaje cariñoso', emoji: '💌', cat: 'Romance', value: 10 },
  { id: 'c9', name: 'Sorpresa especial', emoji: '🎁', cat: 'Romance', value: 50 },
  { id: 'c10', name: 'Traer café', emoji: '☕', cat: 'Detalles', value: 10 },
  { id: 'c11', name: 'Abrazo largo', emoji: '🤗', cat: 'Detalles', value: 5 },
  { id: 'c12', name: 'Escuchar su día', emoji: '👂', cat: 'Detalles', value: 15 },
  { id: 'c13', name: 'Recordar una fecha', emoji: '📅', cat: 'Fechas', value: 50 }
];

/* ---------- helpers ---------- */
function publicUser(u) { return { id: u.id, email: u.email, name: u.name, emoji: u.emoji, balance: u.balance, earned: u.earned, coupleId: u.coupleId }; }
function coupleOf(user) { return user.coupleId ? C().findOne((c) => c.id === user.coupleId) : null; }
function membersOf(couple) { return couple ? U().find((u) => u.coupleId === couple.id) : []; }
function partnerTokens(couple, exceptUserId) {
  const ids = membersOf(couple).filter((u) => u.id !== exceptUserId).map((u) => u.id);
  return PT().find((t) => ids.indexOf(t.userId) !== -1).map((t) => t.token);
}
function pushFeed(couple, entry) { entry.id = uid('f_'); entry.coupleId = couple.id; entry.ts = now(); F().insert(entry); return entry; }
function isPremium(couple) { return !!(couple && couple.premium); }
function requireCouple(req, res) { const c = coupleOf(req.user); if (!c) { res.status(400).json({ error: 'no_couple' }); return null; } return c; }

/* ============================================================
   AUTH
   ============================================================ */
app.get('/api/health', (req, res) => res.json({ ok: true, ts: now(), store: store.isPostgres ? 'postgres' : 'json' }));

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, ageConfirmed, termsAccepted } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email_password_required' });
  if (!ageConfirmed || !termsAccepted) return res.status(400).json({ error: 'age_terms_required' });
  if (U().findOne((u) => u.email === email)) return res.status(409).json({ error: 'email_in_use', hint: 'login_or_link' });
  const user = U().insert({ id: uid('u_'), email, name: name || '', emoji: '💜', passwordHash: bcrypt.hashSync(password, 10), provider: 'email', ageConfirmed: true, balance: 0, earned: 0, coupleId: null, createdAt: now() });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = U().findOne((u) => u.email === email);
  if (!user || !user.passwordHash || !bcrypt.compareSync(password || '', user.passwordHash)) {
    if (user && user.provider !== 'email') return res.status(409).json({ error: 'use_social', provider: user.provider });
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

app.post('/api/auth/social', async (req, res) => {
  const { provider, idToken, name, ageConfirmed } = req.body || {};
  if (['google', 'apple'].indexOf(provider) === -1) return res.status(400).json({ error: 'bad_provider' });
  let prof;
  try { prof = await verifySocial(provider, idToken); } catch (e) { return res.status(401).json({ error: 'social_verify_failed', detail: e.message }); }
  let user = U().findOne((u) => u.email === prof.email);
  if (user) {
    // vinculación de cuentas: mismo email, distinto método -> no duplicar
    if (user.provider !== provider) U().update((u) => u.id === user.id, { linkedProviders: Array.from(new Set([].concat(user.linkedProviders || [user.provider], provider))) });
    return res.json({ token: sign(user), user: publicUser(user), linked: true });
  }
  if (!ageConfirmed) return res.status(400).json({ error: 'age_required', hint: 'confirm_18_after_social' });
  user = U().insert({ id: uid('u_'), email: prof.email, name: name || prof.name || '', emoji: '💜', provider, ageConfirmed: true, balance: 0, earned: 0, coupleId: null, createdAt: now() });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), couple: summaryCouple(coupleOf(req.user)) }));

/* ============================================================
   COUPLES
   ============================================================ */
function summaryCouple(c) {
  if (!c) return null;
  return { id: c.id, code: c.code, status: c.status, premium: !!c.premium, threshold: c.threshold, members: membersOf(c).map(publicUser) };
}

app.post('/api/couples', auth, (req, res) => {
  if (req.user.coupleId) return res.status(409).json({ error: 'already_in_couple' });
  const c = C().insert({ id: uid('cp_'), code: code6(), status: 'pending', premium: false, threshold: THRESHOLD_DEFAULT, memberIds: [req.user.id], createdAt: now() });
  U().update((u) => u.id === req.user.id, { coupleId: c.id });
  res.json({ couple: summaryCouple(C().findOne((x) => x.id === c.id)) });
});

app.post('/api/couples/join', auth, (req, res) => {
  if (req.user.coupleId) return res.status(409).json({ error: 'already_in_couple' });
  const { code } = req.body || {};
  const c = C().findOne((x) => x.code === (code || '').toUpperCase());
  if (!c) return res.status(404).json({ error: 'code_not_found' });
  const max = c.premium ? 99 : 2;
  if (membersOf(c).length >= max) return res.status(409).json({ error: 'couple_full', hint: max === 2 ? 'premium_for_3plus' : null });
  U().update((u) => u.id === req.user.id, { coupleId: c.id });
  C().update((x) => x.id === c.id, { status: 'linked' });
  const tokens = partnerTokens(c, req.user.id);
  sendPush(tokens, 'Mimitu', (req.user.name || 'Tu pareja') + ' se unió 💞');
  pushFeed(c, { type: 'system', text: '¡Pareja vinculada! 💞', emoji: '🔗' });
  res.json({ couple: summaryCouple(C().findOne((x) => x.id === c.id)) });
});

app.get('/api/couples/me', auth, (req, res) => res.json({ couple: summaryCouple(coupleOf(req.user)) }));

/* ============================================================
   ACTIONS (catálogo + creación con moderación)
   ============================================================ */
app.get('/api/actions', auth, (req, res) => {
  const c = coupleOf(req.user);
  const custom = c ? A().find((a) => a.coupleId === c.id && a.status === 'approved') : [];
  res.json({ catalog: CATALOG, custom });
});

app.post('/api/actions', auth, async (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const { name, emoji, cat, value } = req.body || {};
  if (!name || !value) return res.status(400).json({ error: 'name_value_required' });
  if (!isPremium(c) && A().find((a) => a.coupleId === c.id).length >= 3) return res.status(402).json({ error: 'free_limit', hint: 'premium_unlimited' });
  const mod = await moderate(name);
  const status = mod.status === 'approved' ? 'approved' : mod.status; // rejected | pending_review
  const action = A().insert({ id: uid('a_'), coupleId: c.id, name, emoji: emoji || '✨', cat: cat || 'Detalles', value: Number(value), custom: true, status, createdBy: req.user.id, createdAt: now() });
  if (status === 'rejected') return res.status(422).json({ error: 'content_rejected', reason: mod.reason, action });
  res.json({ action });
});

/* ============================================================
   LOGS (registro + validación mixta)
   ============================================================ */
function resolveAction(c, body) {
  if (body.actionId) {
    const cat = CATALOG.find((a) => a.id === body.actionId);
    if (cat) return cat;
    const cust = A().findOne((a) => a.id === body.actionId && a.coupleId === c.id && a.status === 'approved');
    if (cust) return cust;
  }
  if (body.name && body.value) return { name: body.name, emoji: body.emoji || '✨', value: Number(body.value) };
  return null;
}

app.post('/api/logs', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const x = resolveAction(c, req.body || {});
  if (!x) return res.status(400).json({ error: 'action_required' });
  const honor = x.value <= (c.threshold || THRESHOLD_DEFAULT);
  // Persistencia de fotos: guardamos la imagen (dataURL optimizada ~100KB) en la
  // base, así sobrevive a reinicios del backend (disco efímero en hosting free).
  // Para escalar, cambiar STORAGE_MODE a un bucket S3/R2 (ver src/services.js).
  let photoUrl = null;
  if (req.body.photo) {
    photoUrl = process.env.STORAGE_MODE === 's3' ? saveBase64(req.body.photo) : String(req.body.photo);
  }
  const log = L().insert({ id: uid('l_'), coupleId: c.id, actorId: req.user.id, actionName: x.name, emoji: x.emoji, value: x.value, note: req.body.note || '', photo: photoUrl, status: honor ? 'validated' : 'pending', ts: now() });
  if (honor) {
    U().update((u) => u.id === req.user.id, { balance: req.user.balance + x.value, earned: (req.user.earned || 0) + x.value });
    pushFeed(c, { type: 'action', actorId: req.user.id, text: (req.user.name || '') + ' registró ' + x.emoji + ' ' + x.name, emoji: x.emoji, value: x.value, sign: '+', photo: photoUrl });
    sendPush(partnerTokens(c, req.user.id), 'Mimitu', (req.user.name || 'Tu pareja') + ' sumó ' + x.value + ' mimitus');
  } else {
    pushFeed(c, { type: 'action', actorId: req.user.id, text: (req.user.name || '') + ' registró ' + x.emoji + ' ' + x.name + ' · pendiente', emoji: x.emoji, value: x.value, sign: '?', photo: photoUrl });
    sendPush(partnerTokens(c, req.user.id), 'Mimitu', 'Validá: ' + x.name + ' (+' + x.value + ')');
  }
  res.json({ log, status: log.status });
});

app.post('/api/logs/:id/approve', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const log = L().findOne((l) => l.id === req.params.id && l.coupleId === c.id);
  if (!log || log.status !== 'pending') return res.status(404).json({ error: 'not_pending' });
  if (log.actorId === req.user.id) return res.status(403).json({ error: 'cannot_self_approve' });
  L().update((l) => l.id === log.id, { status: 'validated' });
  const actor = U().findOne((u) => u.id === log.actorId);
  U().update((u) => u.id === actor.id, { balance: actor.balance + log.value, earned: (actor.earned || 0) + log.value });
  pushFeed(c, { type: 'action', actorId: actor.id, text: (actor.name || '') + ' sumó ' + log.emoji + ' ' + log.actionName + ' (aprobada)', emoji: log.emoji, value: log.value, sign: '+' });
  sendPush(partnerTokens(c, req.user.id), 'Mimitu', 'Tu acción fue aprobada · +' + log.value);
  res.json({ ok: true });
});

app.post('/api/logs/:id/reject', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const log = L().findOne((l) => l.id === req.params.id && l.coupleId === c.id);
  if (!log || log.status !== 'pending') return res.status(404).json({ error: 'not_pending' });
  L().update((l) => l.id === log.id, { status: 'rejected' });
  pushFeed(c, { type: 'action', actorId: log.actorId, text: log.emoji + ' ' + log.actionName + ' fue rechazada', emoji: '🚫' });
  res.json({ ok: true });
});

app.get('/api/logs', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  let items = L().find((l) => l.coupleId === c.id);
  if (req.query.status) items = items.filter((l) => l.status === req.query.status);
  res.json({ logs: items.sort((a, b) => b.ts - a.ts) });
});

app.get('/api/feed', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  let items = F().find((f) => f.coupleId === c.id).sort((a, b) => b.ts - a.ts);
  if (!isPremium(c)) { const cut = now() - 30 * 86400000; items = items.filter((f) => f.ts >= cut); }
  res.json({ feed: items });
});

/* ============================================================
   REWARDS
   ============================================================ */
app.get('/api/rewards', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; res.json({ rewards: R().find((r) => r.coupleId === c.id) }); });

app.post('/api/rewards', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const { name, cost, emoji, desc } = req.body || {};
  if (!name || !cost) return res.status(400).json({ error: 'name_cost_required' });
  if (!isPremium(c) && R().find((r) => r.coupleId === c.id).length >= 3) return res.status(402).json({ error: 'free_limit' });
  const r = R().insert({ id: uid('r_'), coupleId: c.id, name, emoji: emoji || '🎁', cost: Number(cost), desc: desc || '', proposedBy: req.user.id, status: 'pending', ts: now() });
  pushFeed(c, { type: 'reward', actorId: req.user.id, text: (req.user.name || '') + ' propuso el premio ' + name, emoji: r.emoji });
  sendPush(partnerTokens(c, req.user.id), 'Mimitu', (req.user.name || 'Tu pareja') + ' propuso un premio');
  res.json({ reward: r });
});

app.post('/api/rewards/:id/accept', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const r = R().findOne((x) => x.id === req.params.id && x.coupleId === c.id);
  if (!r || r.status !== 'pending') return res.status(404).json({ error: 'not_pending' });
  R().update((x) => x.id === r.id, { status: 'ready' });
  pushFeed(c, { type: 'reward', text: 'Premio ' + r.emoji + ' ' + r.name + ' disponible 🎉', emoji: r.emoji });
  res.json({ ok: true });
});

app.post('/api/rewards/:id/redeem', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const r = R().findOne((x) => x.id === req.params.id && x.coupleId === c.id);
  if (!r || r.status !== 'ready') return res.status(404).json({ error: 'not_ready' });
  if (req.user.balance < r.cost) return res.status(402).json({ error: 'insufficient_balance' });
  const newBalance = req.user.balance - r.cost;
  U().update((u) => u.id === req.user.id, { balance: newBalance });
  store.collection('redemptions').insert({ id: uid('rd_'), coupleId: c.id, rewardId: r.id, userId: req.user.id, cost: r.cost, ts: now() });
  pushFeed(c, { type: 'redeem', actorId: req.user.id, text: (req.user.name || '') + ' canjeó ' + r.emoji + ' ' + r.name, emoji: r.emoji, value: r.cost, sign: '-' });
  res.json({ ok: true, balance: newBalance });
});

/* ============================================================
   DAILY QUESTION
   ============================================================ */
const QUESTIONS = ['¿Cuál fue tu momento favorito juntos esta semana?', 'Si pudiéramos viajar mañana, ¿a dónde irías conmigo?', '¿Qué admirás de mí últimamente?', '¿Qué plan te gustaría que hagamos pronto?', '¿Qué gesto mío te hace sentir querido/a?'];
function dayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function qOfDay() { return QUESTIONS[Math.floor(Date.now() / 86400000) % QUESTIONS.length]; }

app.get('/api/daily-question', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const dk = dayKey();
  const ans = DA().find((a) => a.coupleId === c.id && a.dayKey === dk);
  const both = membersOf(c).every((m) => ans.find((a) => a.userId === m.id));
  res.json({ question: qOfDay(), answeredByMe: !!ans.find((a) => a.userId === req.user.id), revealed: both, answers: both ? ans.map((a) => ({ userId: a.userId, text: a.text })) : [] });
});

app.post('/api/daily-question/answer', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const dk = dayKey();
  if (DA().findOne((a) => a.coupleId === c.id && a.dayKey === dk && a.userId === req.user.id)) return res.status(409).json({ error: 'already_answered' });
  DA().insert({ id: uid('da_'), coupleId: c.id, dayKey: dk, userId: req.user.id, text: (req.body || {}).text || '', ts: now() });
  U().update((u) => u.id === req.user.id, { balance: req.user.balance + 5, earned: (req.user.earned || 0) + 5 });
  pushFeed(c, { type: 'dq', actorId: req.user.id, text: (req.user.name || '') + ' respondió la pregunta del día', emoji: '💬', value: 5, sign: '+' });
  res.json({ ok: true });
});

/* ============================================================
   CALENDAR (fechas + planes)
   ============================================================ */
app.get('/api/dates', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; res.json({ dates: DT().find((d) => d.coupleId === c.id) }); });
app.post('/api/dates', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; const { title, emoji, date, remind, bonus } = req.body || {}; if (!title || !date) return res.status(400).json({ error: 'title_date_required' }); res.json({ date: DT().insert({ id: uid('d_'), coupleId: c.id, title, emoji: emoji || '💞', date, remind: Number(remind) || 3, bonus: Number(bonus) || 50 }) }); });
app.post('/api/dates/:id/fulfill', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; const d = DT().findOne((x) => x.id === req.params.id && x.coupleId === c.id); if (!d) return res.status(404).json({ error: 'not_found' }); U().update((u) => u.id === req.user.id, { balance: req.user.balance + d.bonus, earned: (req.user.earned || 0) + d.bonus }); pushFeed(c, { type: 'date', actorId: req.user.id, text: (req.user.name || '') + ' cumplió ' + d.title, emoji: d.emoji, value: d.bonus, sign: '+' }); res.json({ ok: true }); });
app.get('/api/plans', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; res.json({ plans: PL().find((p) => p.coupleId === c.id) }); });
app.post('/api/plans', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; const { title, emoji, date, desc, value } = req.body || {}; if (!title) return res.status(400).json({ error: 'title_required' }); res.json({ plan: PL().insert({ id: uid('p_'), coupleId: c.id, title, emoji: emoji || '🗺️', date: date || '', desc: desc || '', value: Number(value) || 0, done: false }) }); });
app.post('/api/plans/:id/complete', auth, (req, res) => { const c = requireCouple(req, res); if (!c) return; const p = PL().findOne((x) => x.id === req.params.id && x.coupleId === c.id); if (!p || p.done) return res.status(404).json({ error: 'not_found' }); PL().update((x) => x.id === p.id, { done: true }); if (p.value > 0) U().update((u) => u.id === req.user.id, { balance: req.user.balance + p.value, earned: (req.user.earned || 0) + p.value }); pushFeed(c, { type: 'plan', actorId: req.user.id, text: (req.user.name || '') + ' completó el plan ' + p.emoji + ' ' + p.title, emoji: p.emoji, value: p.value || null, sign: p.value ? '+' : '' }); res.json({ ok: true }); });

/* ============================================================
   TOURNAMENTS (privacidad: solo totales)
   ============================================================ */
function coupleTotalEarned(c) { return membersOf(c).reduce((s, m) => s + (m.earned || 0), 0); }

app.get('/api/tournaments', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const list = T().find((t) => (t.coupleIds || []).indexOf(c.id) !== -1).map((t) => ({ id: t.id, name: t.name, code: t.code, end: t.end, finished: t.finished, couples: leaderboard(t) }));
  res.json({ tournaments: list });
});
function leaderboard(t) {
  return (t.entries || []).map((e) => {
    if (e.coupleId) { const c = C().findOne((x) => x.id === e.coupleId); const total = Math.max(0, coupleTotalEarned(c) - (e.baseline || 0)); return { name: membersOf(c).map((m) => m.name).join(' & '), score: total, mine: true }; }
    return { name: e.name, score: e.score, mine: false };
  }).sort((a, b) => b.score - a.score);
}
app.post('/api/tournaments', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  if (!isPremium(c)) return res.status(402).json({ error: 'premium_required_to_create' });
  const { name, end } = req.body || {};
  const t = T().insert({ id: uid('t_'), name: name || 'Torneo', code: code6(), end: end || '', finished: false, coupleIds: [c.id], entries: [{ coupleId: c.id, baseline: coupleTotalEarned(c) }, { name: 'Caro & Nico', score: 120 }, { name: 'Meli & Juan', score: 95 }] });
  res.json({ tournament: { id: t.id, name: t.name, code: t.code } });
});
app.post('/api/tournaments/join', auth, (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  const { code } = req.body || {};
  let t = T().findOne((x) => x.code === (code || '').toUpperCase());
  if (!t) { t = T().insert({ id: uid('t_'), name: 'Torneo de amigos', code: (code || code6()).toUpperCase(), end: '', finished: false, coupleIds: [], entries: [{ name: 'Caro & Nico', score: 120 }, { name: 'Meli & Juan', score: 95 }] }); }
  if ((t.coupleIds || []).indexOf(c.id) === -1) { t.coupleIds.push(c.id); t.entries.push({ coupleId: c.id, baseline: coupleTotalEarned(c) }); store.persist(); }
  res.json({ tournament: { id: t.id, name: t.name } });
});

/* ============================================================
   PUSH
   ============================================================ */
app.post('/api/push/token', auth, (req, res) => {
  const { token, platform } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token_required' });
  if (!PT().findOne((t) => t.token === token)) PT().insert({ id: uid('pt_'), userId: req.user.id, token, platform: platform || 'unknown', ts: now() });
  res.json({ ok: true });
});

/* ============================================================
   PAGOS — RevenueCat (StoreKit + Google Play Billing)
   El entitlement Premium se comparte por PAREJA (no por usuario).
   ============================================================ */
app.get('/api/entitlements', auth, (req, res) => { const c = coupleOf(req.user); res.json({ premium: isPremium(c), since: c ? c.premiumSince || null : null, until: c ? c.premiumUntil || null : null }); });

app.post('/api/webhooks/revenuecat', express.json({ type: '*/*' }), (req, res) => {
  // Seguridad: verificar el header de autorización configurado en RevenueCat
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (expected && req.headers.authorization !== expected) return res.status(401).json({ error: 'bad_signature' });
  const ev = (req.body && req.body.event) || {};
  // app_user_id se setea desde la app = id de la pareja (couple.id)
  const coupleId = ev.app_user_id;
  const couple = C().findOne((c) => c.id === coupleId);
  if (!couple) return res.json({ ok: true, note: 'couple_not_found' });
  const active = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'];
  const inactive = ['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'];
  let patch = null;
  if (active.indexOf(ev.type) !== -1) patch = { premium: true, premiumSince: couple.premiumSince || now(), premiumUntil: ev.expiration_at_ms || null };
  else if (inactive.indexOf(ev.type) !== -1) patch = { premium: false, premiumUntil: ev.expiration_at_ms || now() };
  if (patch) {
    C().update((c) => c.id === couple.id, patch);
    sendPush(membersOf(couple).flatMap((m) => PT().find((t) => t.userId === m.id).map((t) => t.token)), 'Mimitu', patch.premium ? 'Premium activado ⭐ (para ambos)' : 'Tu Premium finalizó');
  }
  res.json({ ok: true });
});

/* ============================================================
   PAGOS WEB — Mercado Pago (suscripción Premium por pareja)
   ============================================================ */
function setCouplePremium(couple, on, until) {
  C().update((c) => c.id === couple.id, { premium: !!on, premiumSince: on ? (couple.premiumSince || now()) : couple.premiumSince, premiumUntil: until || (on ? null : now()) });
  sendPush(membersOf(couple).flatMap((m) => PT().find((t) => t.userId === m.id).map((t) => t.token)), 'Mimitu', on ? 'Premium activado ⭐ (para ambos)' : 'Tu Premium finalizó');
}

app.post('/api/billing/checkout', auth, async (req, res) => {
  const c = requireCouple(req, res); if (!c) return;
  try {
    const sub = await mp.createSubscription(c, req.user.email);
    res.json({ url: sub.url, mock: !!sub.mock });
  } catch (e) { res.status(502).json({ error: 'mp_error', detail: e.message }); }
});

app.post('/api/webhooks/mercadopago', async (req, res) => {
  try {
    if (process.env.MP_WEBHOOK_SECRET && req.headers['x-mimitu-secret'] !== process.env.MP_WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'bad_secret' });
    }
    // MODO MOCK (dev): { mock:true, coupleId, active }
    if (req.body && req.body.mock) {
      const couple = C().findOne((c) => c.id === req.body.coupleId);
      if (couple) setCouplePremium(couple, req.body.active !== false);
      return res.json({ ok: true, mock: true });
    }
    const result = await mp.handleWebhook(req.body, req.query);
    if (result && result.coupleId) {
      const couple = C().findOne((c) => c.id === result.coupleId);
      if (couple) setCouplePremium(couple, result.active, result.until);
    }
    res.json({ ok: true });
  } catch (e) { res.json({ ok: true, note: e.message }); }
});

/* ============================================================
   BORRADO DE CUENTA (GDPR / Ley 25.326 + PRD 8.4)
   Anonimiza las contribuciones del que se va; borra sus datos personales.
   ============================================================ */
app.delete('/api/me', auth, (req, res) => {
  const u = req.user;
  const couple = coupleOf(u);
  // datos personales fuera
  PT().remove((t) => t.userId === u.id);
  store.collection('dailyAnswers').remove((a) => a.userId === u.id);
  // anonimizar identidad pero preservar coherencia del historial del que permanece
  U().update((x) => x.id === u.id, { name: 'Excompañere', email: 'deleted_' + u.id + '@mimitu.invalid', passwordHash: null, provider: 'deleted', deleted: true, coupleId: null, balance: 0, earned: 0 });
  if (couple) {
    const remaining = membersOf(couple).filter((m) => !m.deleted);
    if (remaining.length < 2) C().update((c) => c.id === couple.id, { status: 'pending' });
  }
  res.json({ ok: true });
});

/* DEV ONLY: alternar premium sin pasar por las tiendas (para pruebas) */
app.post('/api/dev/premium', auth, (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'disabled_in_prod' });
  const c = requireCouple(req, res); if (!c) return;
  C().update((x) => x.id === c.id, { premium: !!(req.body || {}).premium });
  res.json({ premium: !!(req.body || {}).premium });
});

/* ---------- arranque ---------- */
const PORT = process.env.PORT || 4000;
if (require.main === module) {
  store.init()
    .then(() => app.listen(PORT, () => console.log('Mimitu API escuchando en http://localhost:' + PORT + (store.isPostgres ? ' (Postgres)' : ' (store JSON)'))))
    .catch((err) => { console.error('No se pudo inicializar la base:', err.message); process.exit(1); });
}
module.exports = app;
