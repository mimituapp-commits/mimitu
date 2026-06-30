'use strict';
/*
 * Mercado Pago — suscripción Premium por web (suscripciones = "preapproval").
 * - Producción: definí MP_ACCESS_TOKEN (y opcional MP_WEBHOOK_SECRET).
 * - Dev/demo: sin token, funciona en modo MOCK (devuelve una URL local y el
 *   webhook acepta un cuerpo simple para simular el pago).
 * Docs: https://www.mercadopago.com.ar/developers (Suscripciones / preapproval)
 */
const API = 'https://api.mercadopago.com';

function enabled() { return !!process.env.MP_ACCESS_TOKEN; }

async function mp(path, method, body) {
  const res = await fetch(API + path, {
    method: method || 'GET',
    headers: { 'Authorization': 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error('mp_' + res.status); e.body = data; throw e; }
  return data;
}

/* Crea la suscripción y devuelve { url, id }. external_reference = couple.id */
async function createSubscription(couple, payerEmail) {
  const price = Number(process.env.PREMIUM_PRICE_ARS || 1990);
  const frontend = process.env.FRONTEND_URL || 'https://app.mimitu.app';
  if (!enabled()) {
    // MODO MOCK: no hay pasarela real; el webhook simula la confirmación.
    return { url: frontend + '/?premium=mock&couple=' + couple.id, id: 'mock_' + couple.id, mock: true };
  }
  const pre = await mp('/preapproval', 'POST', {
    reason: 'Mimitu Premium (pareja)',
    external_reference: couple.id,
    payer_email: payerEmail,
    back_url: frontend + '/?premium=ok',
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: price, currency_id: 'ARS' },
    status: 'pending'
  });
  return { url: pre.init_point || pre.sandbox_init_point, id: pre.id };
}

/* Consulta el estado real de una preapproval (authorized | paused | cancelled) */
async function getSubscription(id) {
  if (!enabled()) return null;
  return mp('/preapproval/' + id, 'GET');
}

/*
 * Interpreta una notificación de webhook y devuelve { coupleId, active } o null.
 * MP manda { type, data: { id } } (o query ?topic=&id=). Confirmamos contra la API.
 */
async function handleWebhook(body, query) {
  const type = (body && (body.type || body.topic)) || (query && query.topic) || (query && query.type);
  const id = (body && body.data && body.data.id) || (query && query.id);
  if (type && type.indexOf('preapproval') !== -1 && id) {
    if (!enabled()) return null;
    const sub = await getSubscription(id);
    if (!sub) return null;
    return { coupleId: sub.external_reference, active: sub.status === 'authorized', until: null };
  }
  return null;
}

module.exports = { enabled, createSubscription, getSubscription, handleWebhook };
