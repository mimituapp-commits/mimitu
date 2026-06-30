/* Cliente de la API de Mimitu. Expone window.MimituAPI.
 * Maneja el token JWT en localStorage y todas las rutas del backend.
 */
(function () {
  'use strict';
  var TKEY = 'mimitu_token';
  function base() { return (window.MIMITU && window.MIMITU.api) || ''; }
  function enabled() { return !!base(); }
  function getToken() { try { return localStorage.getItem(TKEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { t ? localStorage.setItem(TKEY, t) : localStorage.removeItem(TKEY); } catch (e) {} }

  async function req(method, path, body) {
    var headers = { 'Content-Type': 'application/json' };
    var tk = getToken();
    if (tk) headers.Authorization = 'Bearer ' + tk;
    var res = await fetch(base() + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    var data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) { var err = new Error((data && data.error) || ('http_' + res.status)); err.status = res.status; err.body = data; throw err; }
    return data;
  }

  var API = {
    enabled: enabled,
    base: base,
    getToken: getToken,
    setToken: setToken,
    logout: function () { setToken(''); },

    auth: {
      register: function (p) { return req('POST', '/auth/register', p).then(save); },
      login: function (p) { return req('POST', '/auth/login', p).then(save); },
      social: function (p) { return req('POST', '/auth/social', p).then(save); }
    },
    me: function () { return req('GET', '/me'); },

    couples: {
      create: function () { return req('POST', '/couples'); },
      join: function (code) { return req('POST', '/couples/join', { code: code }); },
      me: function () { return req('GET', '/couples/me'); }
    },
    actions: {
      list: function () { return req('GET', '/actions'); },
      create: function (p) { return req('POST', '/actions', p); }
    },
    logs: {
      list: function (status) { return req('GET', '/logs' + (status ? '?status=' + status : '')); },
      create: function (p) { return req('POST', '/logs', p); },
      approve: function (id) { return req('POST', '/logs/' + id + '/approve'); },
      reject: function (id) { return req('POST', '/logs/' + id + '/reject'); }
    },
    feed: function () { return req('GET', '/feed'); },
    rewards: {
      list: function () { return req('GET', '/rewards'); },
      create: function (p) { return req('POST', '/rewards', p); },
      accept: function (id) { return req('POST', '/rewards/' + id + '/accept'); },
      redeem: function (id) { return req('POST', '/rewards/' + id + '/redeem'); }
    },
    dq: {
      get: function () { return req('GET', '/daily-question'); },
      answer: function (text) { return req('POST', '/daily-question/answer', { text: text }); }
    },
    dates: {
      list: function () { return req('GET', '/dates'); },
      create: function (p) { return req('POST', '/dates', p); },
      fulfill: function (id) { return req('POST', '/dates/' + id + '/fulfill'); }
    },
    plans: {
      list: function () { return req('GET', '/plans'); },
      create: function (p) { return req('POST', '/plans', p); },
      complete: function (id) { return req('POST', '/plans/' + id + '/complete'); }
    },
    tournaments: {
      list: function () { return req('GET', '/tournaments'); },
      create: function (p) { return req('POST', '/tournaments', p); },
      join: function (code) { return req('POST', '/tournaments/join', { code: code }); }
    },
    pushToken: function (token, platform) { return req('POST', '/push/token', { token: token, platform: platform }); },
    push: {
      vapid: function () { return req('GET', '/push/vapid'); },
      subscribe: function (subscription) { return req('POST', '/push/subscribe', { subscription: subscription }); }
    },
    entitlements: function () { return req('GET', '/entitlements'); },
    devPremium: function (on) { return req('POST', '/dev/premium', { premium: on }); },
    checkout: function () { return req('POST', '/billing/checkout'); },
    deleteAccount: function () { return req('DELETE', '/me'); }
  };

  function save(r) { if (r && r.token) API.setToken(r.token); return r; }
  window.MimituAPI = API;
})();
