'use strict';
/* Smoke test end-to-end del backend (store JSON en dir temporal). */
const os = require('os');
const path = require('path');
const fs = require('fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mimitu-'));
process.env.DATA_DIR = tmp;
process.env.JWT_SECRET = 'test';

const app = require('../server');
let server, base;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

async function call(method, p, body, token) {
  const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

(async () => {
  await new Promise((res) => { server = app.listen(0, () => { base = 'http://localhost:' + server.address().port; res(); }); });

  let r = await call('GET', '/api/health');
  ok(r.status === 200 && r.body.ok, 'health ok');

  // register A
  r = await call('POST', '/api/auth/register', { email: 'ale@test.com', password: 'x', name: 'Ale', ageConfirmed: true, termsAccepted: true });
  ok(r.status === 200 && r.body.token, 'register A');
  const tA = r.body.token;

  // age/terms required
  r = await call('POST', '/api/auth/register', { email: 'z@test.com', password: 'x', name: 'Z' });
  ok(r.status === 400, 'register requires age+terms');

  // create couple
  r = await call('POST', '/api/couples', null, tA);
  ok(r.status === 200 && r.body.couple.code, 'create couple');
  const code = r.body.couple.code, coupleId = r.body.couple.id;

  // register B + join
  r = await call('POST', '/api/auth/register', { email: 'sofi@test.com', password: 'x', name: 'Sofi', ageConfirmed: true, termsAccepted: true });
  const tB = r.body.token;
  r = await call('POST', '/api/couples/join', { code }, tB);
  ok(r.status === 200 && r.body.couple.members.length === 2, 'B joins couple');

  // social account linking (same email different method)
  r = await call('POST', '/api/auth/social', { provider: 'google', idToken: 'ale@test.com-ish', name: 'Ale', ageConfirmed: true });
  ok(r.status === 200, 'social login works');

  // honor action +15
  r = await call('POST', '/api/logs', { actionId: 'c2' }, tA);
  ok(r.status === 200 && r.body.status === 'validated', 'honor action validated');
  r = await call('GET', '/api/me', null, tA);
  ok(r.body.user.balance === 15, 'A balance 15 (got ' + r.body.user.balance + ')');

  // big action pending -> B approves
  r = await call('POST', '/api/logs', { actionId: 'c1' }, tA);
  ok(r.body.status === 'pending', 'big action pending');
  const logId = r.body.log.id;
  r = await call('POST', '/api/logs/' + logId + '/approve', null, tA);
  ok(r.status === 403, 'cannot self-approve');
  r = await call('POST', '/api/logs/' + logId + '/approve', null, tB);
  ok(r.status === 200, 'B approves');
  r = await call('GET', '/api/me', null, tA);
  ok(r.body.user.balance === 45, 'A balance 45 after approve (got ' + r.body.user.balance + ')');

  // photo upload on a log
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  r = await call('POST', '/api/logs', { actionId: 'c11', photo: px }, tA); // +5 honor
  ok(r.status === 200 && r.body.log.photo && r.body.log.photo.indexOf('data:image') === 0, 'photo evidence persisted in DB');

  // rewards: propose(A) accept(B) redeem(A)
  r = await call('POST', '/api/rewards', { name: 'Peli', cost: 40 }, tA);
  const rid = r.body.reward.id;
  r = await call('POST', '/api/rewards/' + rid + '/accept', null, tB);
  ok(r.status === 200, 'reward accepted');
  r = await call('POST', '/api/rewards/' + rid + '/redeem', null, tA);
  ok(r.status === 200 && r.body.balance === 10, 'redeem ok balance 10 (got ' + (r.body && r.body.balance) + ')');

  // daily question
  await call('POST', '/api/daily-question/answer', { text: 'el finde' }, tA);
  await call('POST', '/api/daily-question/answer', { text: 'viajar' }, tB);
  r = await call('GET', '/api/daily-question', null, tA);
  ok(r.body.revealed && r.body.answers.length === 2, 'daily question revealed both');

  // content moderation
  r = await call('POST', '/api/actions', { name: 'golpear la puerta', value: 10 }, tA);
  ok(r.status === 422 && r.body.error === 'content_rejected', 'banned custom action rejected');
  r = await call('POST', '/api/actions', { name: 'Regar plantas', value: 12 }, tA);
  ok(r.status === 200, 'valid custom action created');

  // free limits: 3 rewards max
  await call('POST', '/api/rewards', { name: 'r2', cost: 10 }, tA);
  await call('POST', '/api/rewards', { name: 'r3', cost: 10 }, tA);
  r = await call('POST', '/api/rewards', { name: 'r4', cost: 10 }, tA);
  ok(r.status === 402, 'free plan reward limit enforced');

  // tournaments: free cannot create, can join
  r = await call('POST', '/api/tournaments', { name: 'Liga' }, tA);
  ok(r.status === 402, 'free cannot create tournament');
  r = await call('POST', '/api/tournaments/join', { code: 'ABC123' }, tA);
  ok(r.status === 200, 'join tournament ok');

  // payments: revenuecat webhook turns premium on (per couple)
  r = await call('POST', '/api/webhooks/revenuecat', { event: { type: 'INITIAL_PURCHASE', app_user_id: coupleId, expiration_at_ms: Date.now() + 9e10 } });
  ok(r.status === 200, 'revenuecat webhook accepted');
  r = await call('GET', '/api/entitlements', null, tA);
  ok(r.body.premium === true, 'couple premium ON after purchase (shared)');
  r = await call('GET', '/api/entitlements', null, tB);
  ok(r.body.premium === true, 'partner also premium (shared per couple)');

  // now premium: can create tournament
  r = await call('POST', '/api/tournaments', { name: 'Liga' }, tA);
  ok(r.status === 200, 'premium can create tournament');

  // expiration turns it off
  await call('POST', '/api/webhooks/revenuecat', { event: { type: 'EXPIRATION', app_user_id: coupleId } });
  r = await call('GET', '/api/entitlements', null, tA);
  ok(r.body.premium === false, 'premium OFF after expiration');

  // Mercado Pago: checkout (mock) returns a url + webhook activates premium
  r = await call('POST', '/api/billing/checkout', null, tA);
  ok(r.status === 200 && r.body.url && r.body.mock === true, 'MP checkout (mock) returns url');
  r = await call('POST', '/api/webhooks/mercadopago', { mock: true, coupleId: coupleId, active: true });
  ok(r.status === 200, 'MP webhook accepted');
  r = await call('GET', '/api/entitlements', null, tB);
  ok(r.body.premium === true, 'premium ON via Mercado Pago (shared)');
  await call('POST', '/api/webhooks/mercadopago', { mock: true, coupleId: coupleId, active: false });
  r = await call('GET', '/api/entitlements', null, tA);
  ok(r.body.premium === false, 'premium OFF when MP subscription cancelled');

  // Account deletion: Sofi deletes her account; Ale's history stays, couple back to pending
  r = await call('DELETE', '/api/me', null, tB);
  ok(r.status === 200, 'account deletion ok');
  r = await call('GET', '/api/couples/me', null, tA);
  ok(r.body.couple.status === 'pending', 'couple back to pending after partner left');
  const feedAfter = (await call('GET', '/api/feed', null, tA)).body.feed;
  ok(Array.isArray(feedAfter) && feedAfter.length > 0, 'remaining partner keeps shared history');

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
