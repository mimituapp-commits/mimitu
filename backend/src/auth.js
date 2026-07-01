'use strict';
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

function sign(user) {
  return jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
}
function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch (e) { return null; }
}
function authMiddleware(store) {
  return function (req, res, next) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    const payload = token && verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'no_auth' });
    const user = store.collection('users').findOne((u) => u.id === payload.uid);
    if (!user) return res.status(401).json({ error: 'no_user' });
    req.user = user;
    next();
  };
}

/*
 * Verificación de proveedores sociales.
 * En producción:
 *  - Google: verificar el id_token contra https://oauth2.googleapis.com/tokeninfo
 *    o con google-auth-library (verifyIdToken con tu GOOGLE_CLIENT_ID).
 *  - Apple: validar el identity token (JWS) contra las claves públicas de
 *    https://appleid.apple.com/auth/keys y chequear `aud`/`iss`.
 * Aquí se devuelve un perfil simulado para poder correr el flujo end-to-end.
 */
async function verifySocial(provider, idToken) {
  if (process.env.SOCIAL_VERIFY === 'real') {
    if (provider === 'google') {
      // Verifica el id_token de Google contra el endpoint tokeninfo y valida el aud.
      const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken || ''));
      if (!res.ok) throw new Error('google_token_invalid');
      const info = await res.json();
      if (!process.env.GOOGLE_CLIENT_ID || info.aud !== process.env.GOOGLE_CLIENT_ID) throw new Error('google_aud_mismatch');
      if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('google_email_unverified');
      return { email: info.email, name: info.name || '', emailVerified: true };
    }
    throw new Error('provider_not_supported');
  }
  // modo dev: deriva un email estable a partir del token
  const hash = crypto.createHash('sha256').update(String(idToken || '')).digest('hex').slice(0, 10);
  return { email: provider + '_' + hash + '@example.com', name: '', emailVerified: true };
}

module.exports = { sign, verifyToken, authMiddleware, verifySocial };
