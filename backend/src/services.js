'use strict';
/* Servicios auxiliares: moderación de contenido (IA), push y storage de fotos. */

const BANNED = ['golpe', 'golpear', 'pegar', 'matar', 'insultar', 'gritar', 'amenaz', 'lastimar', 'violencia', 'odio', 'estúpid', 'idiota'];

/*
 * Filtro de contenido (sección 8.6 del PRD).
 * Producción: llamar a un servicio de IA (p.ej. OpenAI/Azure/Perspective).
 * Fallback definido por el PRD: si el servicio no responde, queda 'pending_review'
 * (no se bloquea ni se aprueba automáticamente).
 */
async function moderate(text) {
  const low = String(text || '').toLowerCase();
  if (process.env.MODERATION_PROVIDER) {
    // TODO: integrar proveedor real; ante error -> { status: 'pending_review' }
  }
  if (BANNED.some((w) => low.indexOf(w) !== -1)) return { status: 'rejected', reason: 'lenguaje_no_permitido' };
  return { status: 'approved' };
}

/*
 * Notificaciones push (sección 4.8 / 12.1).
 * Producción: FCM (Android) y APNs (iOS), o un agregador.
 * Aquí solo se registra el intento.
 */
async function sendPush(tokens, title, body, data) {
  if (!tokens || !tokens.length) return { sent: 0 };
  if (process.env.FCM_SERVER_KEY) {
    // TODO: POST a https://fcm.googleapis.com/fcm/send con los tokens.
  }
  console.log('[push]', title, '—', body, '→', tokens.length, 'tokens');
  return { sent: tokens.length };
}

/*
 * Storage de fotos de evidencia (sección 8.5).
 * Producción: bucket S3/MinIO; el cliente pide una URL firmada (PUT) y sube
 * directo; aquí guardamos en disco bajo /uploads y servimos por URL temporal.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const UP_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');

function saveBase64(dataUrl) {
  if (!fs.existsSync(UP_DIR)) fs.mkdirSync(UP_DIR, { recursive: true });
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const ext = m[1].split('/')[1].replace('jpeg', 'jpg');
  const id = crypto.randomBytes(8).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UP_DIR, id), Buffer.from(m[2], 'base64'));
  return '/uploads/' + id; // en prod: URL firmada y temporal del bucket
}

module.exports = { moderate, sendPush, saveBase64, UP_DIR };
