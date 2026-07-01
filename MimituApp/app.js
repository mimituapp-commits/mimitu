/* ============================================================
   Mimitu — PWA (versión completa MVP, datos locales)
   Cubre el PRD: registro/vinculación, catálogo + acciones propias
   con filtro de contenido, registro con validación mixta, marcador,
   premios propuesta-aceptación y canje, calendario de fechas + planes,
   feed/historial, agradecimientos, pregunta diaria, notificaciones,
   Torneos de Amigos, freemium/Premium y gestión de la relación.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'mimitu_state_v2';
  var THRESHOLD_DEFAULT = 25;

  var CATALOG = [
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

  var AVATARS = ['💜', '💛', '🌸', '🦊', '🐻', '🌟', '🍓', '🐧', '🦋', '🐙'];
  var QUESTIONS = [
    '¿Cuál fue tu momento favorito juntos esta semana?',
    'Si pudiéramos viajar mañana, ¿a dónde irías conmigo?',
    '¿Qué es algo que admirás de mí últimamente?',
    '¿Qué plan te gustaría que hagamos pronto?',
    '¿Qué pequeño gesto mío te hace sentir querido/a?',
    '¿Cuál es tu recuerdo más lindo de cuando nos conocimos?',
    '¿Qué canción te recuerda a nosotros?',
    '¿Qué te gustaría que repitamos más seguido?'
  ];
  var THANK_EMOJIS = ['❤️', '🙏', '😍', '🥹', '👏', '🔥'];
  var BANNED = ['golpe', 'golpear', 'pegar', 'pegá', 'matar', 'insultar', 'gritar', 'amenaz', 'lastimar', 'violencia', 'odio', 'estúpid', 'idiota'];

  /* ---------- Estado ---------- */
  var DEFAULT = {
    onboarded: false,
    ob: { step: 0, age: false, terms: false, path: null },
    members: [
      { id: 'a', name: '', emoji: '💜', balance: 0, earned: 0 },
      { id: 'b', name: '', emoji: '💛', balance: 0, earned: 0 }
    ],
    active: 'a',
    code: '',
    premium: false,
    threshold: THRESHOLD_DEFAULT,
    customActions: [],
    logs: [],
    rewards: [],
    feed: [],
    dates: [],
    plans: [],
    tournaments: [],
    dq: { date: '', qi: 0, answers: {} },
    notifications: [],
    notifPerm: 'default',
    view: 'home'
  };

  var S = load();
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) {}
    return clone(DEFAULT);
  }
  function migrate(s) {
    var d = clone(DEFAULT);
    for (var k in d) if (!(k in s)) s[k] = d[k];
    s.members.forEach(function (m) { if (m.earned == null) m.earned = 0; });
    return s;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- Utils ---------- */
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function now() { return Date.now(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]); }); }
  /* Isotipo de marca: corazón + chispa (hereda color via currentColor) */
  function heartSVG() {
    return '<svg class="iso" viewBox="0 0 36 34" aria-hidden="true">' +
      '<path d="M18 30S3.5 22 3.5 12.8C3.5 8.2 7.1 4.8 11.3 4.8c2.5 0 4.8 1.2 6.7 3.5 1.9-2.3 4.2-3.5 6.7-3.5 4.2 0 7.8 3.4 7.8 8 0 9.2-14.5 17.2-14.5 17.2Z"/>' +
      '<path d="M30.5 1.5l1.25 3.4 3.4 1.25-3.4 1.25L30.5 10.75 29.25 7.4 25.85 6.15 29.25 4.9Z"/></svg>';
  }
  function brandLockup() { return '<span class="lockup">' + heartSVG() + '<span class="word">mimitu</span></span>'; }
  function code6() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function idx(id) { for (var i = 0; i < S.members.length; i++) if (S.members[i].id === id) return i; return 0; }
  function byId(id) { return S.members[idx(id)]; }
  function me() { return byId(S.active); }
  function others() { return S.members.filter(function (m) { return m.id !== S.active; }); }
  function partner() { return others()[0] || me(); }
  function allActions() { return CATALOG.concat(S.customActions); }
  function coupleEarned() { return S.members.reduce(function (a, m) { return a + (m.earned || 0); }, 0); }
  function coupleName() { return S.members.map(function (m) { return m.name || '—'; }).join(' & '); }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayIndex() { return Math.floor(Date.now() / 86400000); }
  function timeAgo(ts) {
    var d = Math.floor((now() - ts) / 1000);
    if (d < 60) return 'recién';
    if (d < 3600) return Math.floor(d / 60) + ' min';
    if (d < 86400) return Math.floor(d / 3600) + ' h';
    return Math.floor(d / 86400) + ' d';
  }
  function daysUntil(iso) {
    if (!iso) return null;
    var p = iso.split('-'); var m = parseInt(p[1], 10) - 1, day = parseInt(p[2], 10);
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var next = new Date(t.getFullYear(), m, day);
    if (next < t) next = new Date(t.getFullYear() + 1, m, day);
    return Math.round((next - t) / 86400000);
  }

  var $app = document.getElementById('app');
  var $toast = document.getElementById('toast');
  var toastT;
  function toast(msg) { $toast.textContent = msg; $toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { $toast.classList.remove('show'); }, 2300); }

  function feedPush(o) { o.id = uid(); o.ts = now(); S.feed.unshift(o); }
  function notify(text, emoji) {
    S.notifications.unshift({ id: uid(), text: text, emoji: emoji || '🔔', ts: now(), read: false });
    if (S.notifications.length > 40) S.notifications.length = 40;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Mimitu', { body: text.replace(/<[^>]+>/g, ''), icon: 'icons/icon-192.png' });
      }
    } catch (e) {}
  }
  function unread() { return S.notifications.filter(function (n) { return !n.read; }).length; }

  /* gana mimitus (acredita + cuenta para torneo) */
  function gain(member, value) { member.balance += value; member.earned = (member.earned || 0) + value; }

  /* ============================================================
     MODO ONLINE (backend real). Si window.MIMITU.api está seteado,
     la app usa la API: auth real y sincronización entre teléfonos.
     ============================================================ */
  var API = window.MimituAPI;
  var ONLINE = !!(API && API.enabled());
  var MYID = null;
  var busy = false;

  async function pull() {
    var meR = await API.me();
    MYID = meR.user.id;
    var couple = meR.couple;
    if (!couple) { S.onboarded = false; return; }
    S.onboarded = true; S.active = MYID; S.code = couple.code; S.threshold = couple.threshold;
    S.members = couple.members.map(function (m) { return { id: m.id, name: m.name, emoji: m.emoji, balance: m.balance, earned: m.earned || 0 }; });
    try { S.premium = !!(await API.entitlements()).premium; } catch (e) {}
    try { S.customActions = (await API.actions.list()).custom || []; } catch (e) {}
    try { S.logs = (await API.logs.list()).logs || []; } catch (e) {}
    try { S.feed = (await API.feed()).feed || []; } catch (e) {}
    try { S.rewards = (await API.rewards.list()).rewards || []; } catch (e) {}
    try { S.dates = (await API.dates.list()).dates || []; } catch (e) {}
    try { S.plans = (await API.plans.list()).plans || []; } catch (e) {}
    try { var dq = await API.dq.get(); S.dqText = dq.question; S.dqRevealed = dq.revealed; S.dqAnsweredByMe = dq.answeredByMe; S.dqAnswers = dq.answers || []; } catch (e) {}
    try { S.tournaments = ((await API.tournaments.list()).tournaments || []).map(function (t) { t._server = true; return t; }); } catch (e) {}
  }
  /* envuelve una acción de red: muestra estado, sincroniza y re-renderiza */
  function net(promise, okMsg) {
    if (busy) return; busy = true;
    Promise.resolve(promise)
      .then(function () { return pull(); })
      .then(function () { busy = false; render(); if (okMsg) toast(okMsg); })
      .catch(function (e) { busy = false; render(); toast(apiError(e)); });
  }
  function net2(promise) {
    if (busy) return; busy = true;
    Promise.resolve(promise).then(function () { busy = false; }).catch(function (e) { busy = false; toast(apiError(e)); });
  }
  /* Web Push: suscribe el navegador y manda la suscripción al backend */
  function urlB64ToUint8Array(b64) {
    var pad = '='.repeat((4 - (b64.length % 4)) % 4);
    var s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(s); var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }
  function subscribePush() {
    if (!ONLINE || !('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) {
      return API.push.vapid().then(function (r) {
        if (!r || !r.publicKey) return;
        return reg.pushManager.getSubscription().then(function (existing) {
          if (existing) return existing;
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(r.publicKey) });
        }).then(function (sub) { if (sub) return API.push.subscribe(sub.toJSON ? sub.toJSON() : sub); });
      });
    }).catch(function () {});
  }
  function apiError(e) {
    var m = (e && e.message) || 'error';
    var map = { insufficient_balance: 'Saldo insuficiente', free_limit: 'Límite del plan gratuito', premium_required_to_create: 'Crear torneos es Premium', cannot_self_approve: 'No podés validar tu propia acción', content_rejected: '🚫 No pasó el filtro de contenido', code_not_found: 'Código no encontrado', couple_full: 'La pareja ya está completa', invalid_credentials: 'Email o contraseña incorrectos', email_in_use: 'Ese email ya existe, iniciá sesión', social_verify_failed: 'No se pudo validar con Google', google_aud_mismatch: 'Config de Google incorrecta', google_token_invalid: 'Token de Google inválido' };
    return map[m] || ('Error: ' + m);
  }

  /* ============================================================ */
  function render() {
    if (!ONLINE) save();
    if (!S.onboarded) { renderOnboarding(); return; }
    if (!ONLINE) ensureDQ();
    renderMain();
  }

  /* ---------------- ONBOARDING ---------------- */
  function renderOnboarding() {
    var step = S.ob.step, html = '';
    if (step === 0) {
      html = '<div class="ob"><div class="spacer"></div>' +
        '<div class="brand">' + brandLockup() + '</div>' +
        '<div class="tag">El juego de quererse bien</div>' +
        '<div class="hero">💞</div>' +
        '<div class="pts-list">' +
        pt('🏆', 'Ganá <b>mimitus</b> con gestos cotidianos: cocinar, planear una cita, un abrazo.') +
        pt('🎁', 'Canjealas por premios que definen entre los dos.') +
        pt('👫', 'Competí con otras parejas en <b>Torneos de Amigos</b>.') +
        '</div><div class="spacer"></div>' +
        '<button class="cta gold" data-act="ob-next">Empezar</button>' +
        '<p class="tiny" style="text-align:center;margin-top:14px">Solo para mayores de edad</p></div>';
    } else if (step === 1) {
      html = '<div class="ob"><div class="back-link" data-act="ob-back">‹ Atrás</div><div class="spacer"></div>' +
        '<h2>Antes de empezar</h2><p class="sub">Mimitu es para mayores de edad. Confirmá para continuar.</p>' +
        '<label class="checkrow"><input type="checkbox" id="ck-age"' + (S.ob.age ? ' checked' : '') + ' data-act="ob-age"> Declaro ser mayor de edad según mi país.</label>' +
        '<label class="checkrow"><input type="checkbox" id="ck-terms"' + (S.ob.terms ? ' checked' : '') + ' data-act="ob-terms"> Acepto los <a class="linklike" href="legal/terminos.html" target="_blank">Términos</a> y la <a class="linklike" href="legal/privacidad.html" target="_blank">Política de privacidad</a>.</label>' +
        '<div class="spacer"></div><button class="cta gold" data-act="ob-toauth"' + (S.ob.age && S.ob.terms ? '' : ' disabled') + '>Continuar</button></div>';
    } else if (step === 2) {
      var googleOn = ONLINE && window.MIMITU && window.MIMITU.googleClientId;
      html = '<div class="ob"><div class="back-link" data-act="ob-back">‹ Atrás</div><div class="spacer"></div>' +
        '<div class="brand" style="font-size:30px">' + brandLockup() + '</div>' +
        '<h2 style="text-align:center;margin-top:18px">Creá tu cuenta</h2>' +
        (googleOn
          ? '<div id="gbtn" style="display:flex;justify-content:center;margin-top:14px;min-height:44px"></div>'
          : '<button class="sso" data-act="ob-sso"><span class="g">G</span> Continuar con Google</button><button class="sso apple" data-act="ob-sso"> Continuar con Apple</button>') +
        '<div class="divider">o con tu email</div>' +
        '<div class="field"><input class="input" id="ob-email" type="email" placeholder="tu@email.com"></div>' +
        '<div class="field"><input class="input" id="ob-pass" type="password" placeholder="Contraseña"></div>' +
        '<button class="cta gold" data-act="ob-email-go">Registrarme</button>' +
        '<p class="tiny" style="margin-top:14px">El proveedor social no informa tu edad; por eso ya la confirmaste.</p></div>';
    } else if (step === 3) {
      html = '<div class="ob"><div class="spacer"></div><h2>Tu perfil</h2><p class="sub">¿Cómo querés que te vea tu pareja?</p>' +
        '<div class="field"><label>Tu nombre</label><input class="input" id="ob-name" placeholder="Ej: Ale" value="' + esc(S.members[0].name) + '"></div>' +
        '<div class="field"><label>Tu avatar</label>' + avatarRow('a') + '</div>' +
        '<div class="spacer"></div><button class="cta gold" data-act="ob-profile-go">Continuar</button></div>';
    } else if (step === 4) {
      html = '<div class="ob"><div class="spacer"></div><div class="hero" style="font-size:64px">🔗</div>' +
        '<h2 style="text-align:center">Vinculá a tu pareja</h2>' +
        '<p class="sub" style="text-align:center">Invitá a tu pareja o uní tu cuenta con un código.</p><div class="spacer"></div>' +
        '<button class="cta gold" data-act="ob-invite">Invitar a mi pareja</button>' +
        '<button class="cta" data-act="ob-join" style="background:rgba(255,255,255,.16);color:#fff;border:1.5px solid rgba(255,255,255,.4)">Tengo un código</button></div>';
    } else if (step === 5) {
      html = '<div class="ob"><div class="back-link" data-act="ob-tolink">‹ Atrás</div><div class="spacer"></div>' +
        '<h2>Tu código de invitación</h2><p class="sub">Compartilo con tu pareja. La cuenta queda “pendiente” hasta vincularse (deep link: abre la app o lleva a la tienda).</p>' +
        '<div class="code-box">' + esc(S.code) + '</div>' +
        '<button class="cta" data-act="ob-share" style="background:rgba(255,255,255,.18);color:#fff;margin-top:14px">Compartir invitación</button>' +
        '<div class="spacer"></div>' +
        (ONLINE
          ? '<p class="sub" style="text-align:center">Cuando tu pareja se una con este código, aparecerá en el marcador.</p><button class="cta gold" data-act="ob-finish">Entrar a Mimitu</button>'
          : '<p class="sub" style="text-align:center">Para la demo, ponele nombre a tu pareja:</p><div class="field"><input class="input" id="ob-pname" placeholder="Nombre de tu pareja" value="' + esc(S.members[1].name) + '"></div><div class="field">' + avatarRow('b') + '</div><button class="cta gold" data-act="ob-finish">Vincular y entrar</button>') +
        '</div>';
    } else if (step === 6) {
      html = '<div class="ob"><div class="back-link" data-act="ob-tolink">‹ Atrás</div><div class="spacer"></div>' +
        '<h2>Unite a tu pareja</h2><p class="sub">Ingresá el código que te compartieron.</p>' +
        '<div class="field"><input class="input" id="ob-code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase;letter-spacing:4px;text-align:center;font-size:22px;font-weight:800"></div>' +
        (ONLINE
          ? ''
          : '<p class="sub" style="text-align:center;margin-top:18px">¿Cómo se llama tu pareja?</p><div class="field"><input class="input" id="ob-pname" placeholder="Nombre de tu pareja" value="' + esc(S.members[1].name) + '"></div><div class="field">' + avatarRow('b') + '</div>') +
        '<div class="spacer"></div><button class="cta gold" data-act="ob-finish">Vincular y entrar</button></div>';
    }
    $app.innerHTML = html;
    if (S.ob.step === 2) mountGoogleButton();
  }

  /* Login con Google (GIS): renderiza el botón oficial y maneja el credential */
  function mountGoogleButton() {
    var cid = window.MIMITU && window.MIMITU.googleClientId;
    if (!ONLINE || !cid) return;
    (function go(tries) {
      var el = document.getElementById('gbtn');
      if (!el) return;
      if (!(window.google && google.accounts && google.accounts.id)) { if (tries < 20) setTimeout(function () { go(tries + 1); }, 300); return; }
      try {
        google.accounts.id.initialize({ client_id: cid, callback: onGoogleCredential });
        google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', width: 300, locale: 'es' });
      } catch (e) {}
    })(0);
  }
  function onGoogleCredential(resp) {
    if (!resp || !resp.credential || busy) return;
    busy = true; toast('Ingresando con Google…');
    API.auth.social({ provider: 'google', idToken: resp.credential, ageConfirmed: !!(S.ob && S.ob.age), name: (S.ob && S.ob.name) || '' })
      .then(function () { return pull(); })
      .then(function () { busy = false; if (S.onboarded) { S.view = 'home'; render(); } else { S.ob.step = 4; render(); } })
      .catch(function (e) { busy = false; toast(apiError(e)); });
  }
  function pt(e, t) { return '<div class="pt"><span class="e">' + e + '</span><span>' + t + '</span></div>'; }
  function avatarRow(mid) {
    var sel = byId(mid).emoji;
    return '<div style="display:flex;gap:8px;flex-wrap:wrap">' + AVATARS.map(function (a) {
      var on = a === sel;
      return '<button data-act="ob-avatar" data-mid="' + mid + '" data-em="' + a + '" style="width:46px;height:46px;border-radius:50%;font-size:22px;background:' + (on ? 'var(--gold)' : 'rgba(255,255,255,.16)') + ';border:2px solid ' + (on ? '#fff' : 'rgba(255,255,255,.3)') + '">' + a + '</button>';
    }).join('') + '</div>';
  }

  /* ---------------- MAIN SHELL ---------------- */
  function renderMain() {
    var m = me();
    var u = unread();
    var html = '<div class="appbar"><div class="logo">' + brandLockup() + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center">' +
      (ONLINE
        ? '<span class="who">' + esc(m.emoji + ' ' + (m.name || 'Yo')) + '</span>'
        : '<button class="who" data-act="swap" title="Cambiar de miembro (demo)">' + esc(m.emoji + ' ' + (m.name || 'Yo')) + ' <span class="swap">⇄</span></button>') +
      '<button class="gear" data-act="notifs">🔔' + (u ? '<span class="bdg">' + u + '</span>' : '') + '</button>' +
      '</div></div>' +
      '<div class="screen">' + screenBody() + '</div>' + navBar();
    $app.innerHTML = html;
    var sc = $app.querySelector('.screen'); if (sc) sc.scrollTop = 0;
  }
  function screenBody() {
    switch (S.view) {
      case 'home': return homeBody();
      case 'rewards': return rewardsBody();
      case 'tournaments': return tournamentsBody();
      case 'more': return moreBody();
      case 'calendar': return calendarBody();
      case 'feed': return feedBody();
      case 'settings': return settingsBody();
      case 'plan': return planBody();
      default: return homeBody();
    }
  }
  function navBar() {
    function it(v, ico, lbl) { return '<button class="navitem ' + (S.view === v ? 'active' : '') + '" data-act="view" data-v="' + v + '"><span class="ico">' + ico + '</span>' + lbl + '</button>'; }
    return '<div class="nav">' + it('home', '🏠', 'Inicio') + it('rewards', '🎁', 'Premios') +
      '<button class="fab" data-act="register">+</button>' + it('tournaments', '🏆', 'Torneos') + it('more', '☰', 'Más') + '</div>';
  }
  function topbar(title, backView) {
    return '<div style="display:flex;align-items:center;gap:10px;margin:6px 0 4px">' +
      (backView ? '<button data-act="view" data-v="' + backView + '" style="font-size:22px;color:var(--magenta)">‹</button>' : '') +
      '<div style="font-size:18px;font-weight:900">' + title + '</div></div>';
  }

  /* ---------------- HOME ---------------- */
  function homeBody() {
    var html = scoreboard();
    html += '<button class="cta" data-act="register">+ Registrar una acción</button>';
    // quick actions
    var quick = allActions().filter(function (x) { return x.value <= S.threshold; }).slice(0, 3);
    html += '<div class="quick">' + quick.map(function (x) {
      return '<button class="qbtn" data-act="quick" data-id="' + x.id + '"><div class="em">' + x.emoji + '</div><div class="lbl">' + esc(x.name) + '</div><div class="pts">+' + x.value + '</div></button>';
    }).join('') + '</div>';
    // daily question
    html += dailyQuestionCard();
    // pending validations
    var pend = S.logs.filter(function (l) { return l.status === 'pending' && l.actorId !== S.active; });
    if (pend.length) {
      html += '<div class="section-title">Pendiente de tu validación</div>';
      html += pend.map(function (l) {
        return '<div class="pending"><div class="ptxt"><b>' + esc(byId(l.actorId).name || 'Tu pareja') + '</b> registró <b>' + esc(l.emoji + ' ' + l.actionName) + '</b> (+' + l.value + ')</div>' +
          '<div class="pmeta">Supera ' + S.threshold + ' mimitus · necesita tu aprobación' + (l.note ? ' · “' + esc(l.note) + '”' : '') + '</div>' +
          (l.photo ? '<img class="ev-thumb" src="' + l.photo + '" data-act="view-photo" data-src="' + l.photo + '" alt="evidencia">' : '') +
          '<div class="pbtns"><button class="btn-confirm" data-act="approve" data-id="' + l.id + '">Confirmar</button><button class="btn-reject" data-act="reject" data-id="' + l.id + '">Rechazar</button></div></div>';
      }).join('');
    }
    // upcoming date
    var up = upcomingDate();
    if (up) html += '<div class="datecard" data-act="view" data-v="calendar"><div class="cal">' + up.emoji + '</div><div><div class="dt">' + esc(up.title) + '</div><div class="ds">Cumplirla suma +' + up.bonus + ' mimitus</div></div><div class="dd">en<br>' + up.d + ' días</div></div>';
    // feed preview
    html += '<div class="section-title">Actividad reciente</div>';
    var fp = S.feed.slice(0, 5);
    html += fp.length ? '<div class="feed">' + fp.map(feedItem).join('') + '</div>' : '<div class="empty">Todavía no hay gestos por aquí.<br>¿Quién rompe el hielo? 💜</div>';
    if (!S.premium) html += '<div class="ad"><span class="adtag">AD</span> Espacio publicitario no intrusivo (zona fría). Premium lo elimina.</div>';
    return html;
  }

  function scoreboard() {
    var ms = S.members.slice().sort(function (a, b) { return b.balance - a.balance; });
    if (S.members.length === 1) {
      var me1 = S.members[0];
      return '<div class="scoreboard"><div class="sb-title">Marcador de la pareja</div><div class="sb-row">' +
        playerCol(me1, true) +
        '<div class="vs">vs</div>' +
        '<div class="player"><div class="avatar" style="border-style:dashed">＋</div><div class="pname">Tu pareja</div><div class="pscore">—</div><div class="punit">PENDIENTE</div></div>' +
        '</div><div class="difftxt">Compartí el código <b>' + esc(S.code || '') + '</b> para que se una 💌</div></div>';
    }
    if (S.members.length <= 2) {
      var a = S.members[0], b = S.members[1];
      var lead = a.balance === b.balance ? null : (a.balance > b.balance ? a : b);
      var max = Math.max(a.balance, b.balance, 1);
      var diff = Math.abs(a.balance - b.balance);
      return '<div class="scoreboard"><div class="sb-title">Marcador de la pareja</div><div class="sb-row">' +
        playerCol(a, lead === a) + '<div class="vs">vs</div>' + playerCol(b, lead === b) + '</div>' +
        '<div class="diffbar"><div class="difffill" style="width:' + (50 + (a.balance - b.balance) / max * 50) + '%"></div></div>' +
        '<div class="difftxt">' + (diff === 0 ? '¡Empate! 🤝' : esc(lead.name || 'Alguien') + ' lidera por ' + diff + ' mimitus') + '</div></div>';
    }
    // 3+ members (premium)
    var rows = ms.map(function (m, i) {
      return '<div class="sb-li"><div class="sb-rk">' + (i === 0 ? '👑' : (i + 1)) + '</div><div class="sb-em">' + m.emoji + '</div><div class="sb-nm">' + esc(m.name || '—') + '</div><div class="sb-sc">' + m.balance + '</div></div>';
    }).join('');
    return '<div class="scoreboard"><div class="sb-title">Marcador del grupo</div><div class="sb-list">' + rows + '</div></div>';
  }
  function playerCol(m, lead) {
    return '<div class="player"><div class="avatar ' + (lead ? 'lead' : '') + '">' + m.emoji + '</div>' +
      '<div class="pname">' + esc(m.name || (m.id === 'a' ? 'Vos' : 'Pareja')) + '</div>' +
      '<div class="pscore">' + m.balance + '</div><div class="punit">MIMITUS</div>' +
      (lead ? '<div class="badge">👑 Lidera</div>' : '') + '</div>';
  }
  function feedItem(f) {
    var sign = f.sign || '';
    var cls = sign === '+' ? 'pos' : (sign === '-' ? 'neg' : (sign === '?' ? 'pend' : ''));
    var val = f.value != null ? (sign === '?' ? 'pend.' : (sign + f.value)) : '';
    var thanks = '';
    if (f.thank) thanks = '<div class="thankrow">' + f.thank.emoji + ' ' + esc(byId(f.thank.by).name || '') + (f.thank.note ? ': “' + esc(f.thank.note) + '”' : ' agradeció') + '</div>';
    var canThank = f.type === 'action' && f.sign === '+' && f.actorId && f.actorId !== S.active && !f.thank;
    var thankBtn = canThank ? '<button class="thankbtn" data-act="thank" data-id="' + f.id + '">🙏 Agradecer</button>' : '';
    var photo = f.photo ? '<img class="ev-thumb sm" src="' + f.photo + '" data-act="view-photo" data-src="' + f.photo + '" alt="evidencia">' : '';
    return '<div class="fitem"><div class="fav">' + (f.emoji || '✨') + '</div>' +
      '<div class="ftxt"><div class="ft1">' + f.text + '</div><div class="fmeta">' + timeAgo(f.ts) + '</div>' + thanks + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">' + (val ? '<div class="fval ' + cls + '">' + val + '</div>' : '') + photo + thankBtn + '</div></div>';
  }

  /* ---------------- DAILY QUESTION ---------------- */
  function ensureDQ() {
    var tk = todayKey();
    if (S.dq.date !== tk) { S.dq = { date: tk, qi: dayIndex() % QUESTIONS.length, answers: {} }; }
  }
  function dailyQuestionCard() {
    if (ONLINE) {
      var head0 = '<div class="dq-card"><div class="dq-h">💬 Pregunta del día</div><div class="dq-q">' + esc(S.dqText || '') + '</div>';
      if (S.dqRevealed) return head0 + '<div class="dq-reveal">' + (S.dqAnswers || []).map(function (a) { var m = byId(a.userId); return '<div class="dq-a"><b>' + esc((m && m.name) || '—') + ':</b> ' + esc(a.text) + '</div>'; }).join('') + '</div></div>';
      if (S.dqAnsweredByMe) return head0 + '<div class="dq-wait">Tu respuesta quedó guardada 🔒 · esperando a ' + esc(partner().name || 'tu pareja') + '</div></div>';
      return head0 + '<button class="mini solid" data-act="answer-dq" style="margin-top:10px">Responder (+5 mimitus)</button></div>';
    }
    var q = QUESTIONS[S.dq.qi];
    var ansMe = S.dq.answers[S.active];
    var bothDone = S.members.every(function (m) { return S.dq.answers[m.id]; });
    var head = '<div class="dq-card"><div class="dq-h">💬 Pregunta del día</div><div class="dq-q">' + esc(q) + '</div>';
    if (bothDone) {
      var revealed = S.members.map(function (m) { return '<div class="dq-a"><b>' + esc(m.name || '—') + ':</b> ' + esc(S.dq.answers[m.id]) + '</div>'; }).join('');
      return head + '<div class="dq-reveal">' + revealed + '</div></div>';
    }
    if (ansMe) return head + '<div class="dq-wait">Tu respuesta quedó guardada 🔒 · esperando a ' + esc(partner().name || 'tu pareja') + '</div></div>';
    return head + '<button class="mini solid" data-act="answer-dq" style="margin-top:10px">Responder (+5 mimitus)</button></div>';
  }

  /* ---------------- REWARDS ---------------- */
  function rewardsBody() {
    var m = me();
    var ready = S.rewards.filter(function (r) { return r.status === 'ready'; });
    var pending = S.rewards.filter(function (r) { return r.status === 'pending'; });
    var html = '<div class="section-title">Premios de la pareja</div>' +
      '<p class="tiny muted" style="margin:0 4px">Cualquiera propone; el otro acepta. Canjear es la única forma en que baja tu saldo.</p>';
    if (ready.length) html += ready.map(function (r) {
      var afford = m.balance >= r.cost;
      return '<div class="reward"><div class="rem">' + r.emoji + '</div><div class="rinfo"><div class="rn">' + esc(r.name) + '</div>' + (r.desc ? '<div class="rd">' + esc(r.desc) + '</div>' : '') + '<div class="rcost">' + r.cost + ' mimitus</div></div>' +
        '<button class="mini ' + (afford ? 'solid' : 'ghost') + '" data-act="redeem" data-id="' + r.id + '"' + (afford ? '' : ' disabled') + '>Canjear</button></div>';
    }).join('');
    if (pending.length) {
      html += '<div class="section-title">Por aceptar</div>';
      html += pending.map(function (r) {
        var mine = r.proposedBy === S.active;
        return '<div class="reward"><div class="rem">' + r.emoji + '</div><div class="rinfo"><div class="rn">' + esc(r.name) + '</div><div class="rd">Propuesto por ' + esc(byId(r.proposedBy).name || (mine ? 'vos' : 'tu pareja')) + ' · ' + r.cost + ' mimitus</div></div>' +
          (mine ? '<span class="tag-state tag-pending">Esperando</span>' : '<button class="mini ok" data-act="accept-reward" data-id="' + r.id + '">Aceptar</button>') + '</div>';
      }).join('');
    }
    if (!ready.length && !pending.length) html += '<div class="empty">Sin premios todavía.<br>Proponé el primero 🎁</div>';
    html += '<button class="cta" data-act="propose-reward" style="margin-top:18px">+ Proponer un premio</button>';
    html += '<p class="tiny muted" style="text-align:center;margin-top:10px">' + (S.premium ? 'Premium: premios ilimitados.' : 'Plan gratuito: hasta 3 premios (' + S.rewards.length + '/3).') + '</p>';
    return html;
  }

  /* ---------------- CALENDAR (fechas + planes) ---------------- */
  function calendarBody() {
    var html = topbar('📅 Calendario', 'more');
    html += '<div class="segment"><button class="' + (calTab === 'dates' ? 'on' : '') + '" data-act="cal-tab" data-t="dates">Fechas</button><button class="' + (calTab === 'plans' ? 'on' : '') + '" data-act="cal-tab" data-t="plans">Planes</button></div>';
    if (calTab === 'dates') {
      var ds = S.dates.slice().sort(function (a, b) { return (daysUntil(a.date) || 999) - (daysUntil(b.date) || 999); });
      html += ds.length ? ds.map(function (d) {
        var du = daysUntil(d.date);
        return '<div class="reward"><div class="rem">' + d.emoji + '</div><div class="rinfo"><div class="rn">' + esc(d.title) + '</div><div class="rd">' + (du === 0 ? '¡Hoy!' : 'en ' + du + ' días') + ' · recordatorio ' + d.remind + 'd antes · +' + d.bonus + '</div></div>' +
          '<button class="mini ok" data-act="fulfill-date" data-id="' + d.id + '">Cumplir</button></div>';
      }).join('') : '<div class="empty">Cargá tus fechas importantes 💞<br>Olvidarlas no penaliza.</div>';
      html += '<button class="cta" data-act="add-date" style="margin-top:16px">+ Agregar fecha</button>';
    } else {
      var ps = S.plans.slice().sort(function (a, b) { return (daysUntil(a.date) || 999) - (daysUntil(b.date) || 999); });
      html += ps.length ? ps.map(function (p) {
        var du = daysUntil(p.date);
        return '<div class="reward"><div class="rem">' + p.emoji + '</div><div class="rinfo"><div class="rn">' + esc(p.title) + (p.done ? ' ✅' : '') + '</div><div class="rd">' + (du == null ? 'sin fecha' : (du === 0 ? '¡Hoy!' : 'en ' + du + ' días')) + (p.desc ? ' · ' + esc(p.desc) : '') + (p.value ? ' · +' + p.value : '') + '</div></div>' +
          (p.done ? '<span class="tag-state tag-ready">Hecho</span>' : '<button class="mini ok" data-act="complete-plan" data-id="' + p.id + '">Completar</button>') + '</div>';
      }).join('') : '<div class="empty">Planeá salidas y viajes juntos 🗺️</div>';
      html += '<button class="cta" data-act="add-plan" style="margin-top:16px">+ Agregar plan</button>';
    }
    return html;
  }
  var calTab = 'dates';
  function upcomingDate() {
    var ds = S.dates.map(function (d) { return { title: d.title, emoji: d.emoji, bonus: d.bonus, d: daysUntil(d.date) }; }).filter(function (d) { return d.d != null; }).sort(function (a, b) { return a.d - b.d; });
    return ds[0] || null;
  }

  /* ---------------- TOURNAMENTS ---------------- */
  function tournamentsBody() {
    var html = '<div class="section-title">🏆 Torneos de Amigos</div>' +
      '<p class="tiny muted" style="margin:0 4px">Competí con otras parejas. Solo se comparte el total; nunca el detalle de tus acciones.</p>';
    if (!S.tournaments.length) html += '<div class="empty">Todavía no estás en ningún torneo.</div>';
    else html += S.tournaments.map(function (t) {
      var couples = t._server ? (t.couples || []).slice().sort(function (a, b) { return b.score - a.score; }) : tournamentScores(t).couples;
      var leader = couples[0] || { name: '—', score: 0 };
      var mineC = couples.filter(function (c) { return c.mine; })[0];
      var status = t.finished ? '<span class="tag-state tag-pending">Finalizado</span>' : '<span class="tag-state tag-ready">En curso</span>';
      return '<div class="card" data-act="open-tournament" data-id="' + t.id + '" style="margin-top:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:900;font-size:15px">' + esc(t.name) + '</div>' + status + '</div>' +
        '<div class="tiny muted" style="margin-top:4px">' + couples.length + ' parejas · termina ' + esc(t.end || '—') + '</div>' +
        '<div class="tiny" style="margin-top:8px">🥇 Lidera <b>' + esc(leader.name) + '</b> con ' + leader.score + ' · vos: ' + (mineC ? mineC.score : 0) + '</div></div>';
    }).join('');
    html += '<button class="cta" data-act="join-tournament" style="margin-top:18px">Unirme con un código</button>';
    html += '<button class="cta ghost" data-act="create-tournament" style="margin-top:8px">+ Crear torneo' + (S.premium ? '' : ' (Premium)') + '</button>';
    return html;
  }
  function mineScoreText(sc) { var m = sc.couples.filter(function (c) { return c.mine; })[0]; return m ? m.score + '' : '0'; }

  function tournamentScores(t) {
    var couples = t.couples.map(function (c) {
      if (c.mine) {
        var total = Math.max(0, coupleEarned() - t.baseline);
        var members = S.members.map(function (m) { return { name: m.name, emoji: m.emoji, score: Math.max(0, (m.earned || 0) - (t.mbaseline[m.id] || 0)), mine: true }; });
        return { name: coupleName(), score: total, mine: true, members: members };
      }
      return { name: c.name, score: c.members.reduce(function (s, m) { return s + m.score; }, 0), mine: false, members: c.members.map(function (m) { return { name: m.name, emoji: m.emoji, score: m.score, mine: false }; }) };
    });
    couples.sort(function (a, b) { return b.score - a.score; });
    var inds = [];
    couples.forEach(function (c) { c.members.forEach(function (m) { inds.push(m); }); });
    inds.sort(function (a, b) { return b.score - a.score; });
    return { couples: couples, individuals: inds };
  }

  function seedCouples() {
    return [
      { name: 'Caro & Nico', mine: false, members: [{ name: 'Caro', emoji: '🌸', score: 70 + Math.floor(Math.random() * 60) }, { name: 'Nico', emoji: '🦊', score: 60 + Math.floor(Math.random() * 60) }] },
      { name: 'Meli & Juan', mine: false, members: [{ name: 'Meli', emoji: '🌟', score: 80 + Math.floor(Math.random() * 60) }, { name: 'Juan', emoji: '🐻', score: 75 + Math.floor(Math.random() * 60) }] }
    ];
  }
  function newTournament(name, end) {
    var mb = {}; S.members.forEach(function (m) { mb[m.id] = m.earned || 0; });
    var t = { id: uid(), name: name, code: code6(), start: todayKey(), end: end || '', finished: false, baseline: coupleEarned(), mbaseline: mb, couples: [{ id: 'mine', mine: true }].concat(seedCouples()) };
    return t;
  }

  /* ---------------- MORE / FEED / SETTINGS / PLAN ---------------- */
  function moreBody() {
    function item(v, ico, t, d) { return '<button class="menu-item" data-act="view" data-v="' + v + '"><span class="mi-ico">' + ico + '</span><span class="mi-t">' + t + '<span class="mi-d">' + d + '</span></span><span class="mi-go">›</span></button>'; }
    var html = '<div class="section-title">Más</div>';
    html += item('calendar', '📅', 'Calendario', 'Fechas significativas y planes');
    html += item('feed', '📜', 'Historial', 'Toda la actividad de la pareja');
    html += item('plan', '⭐', 'Plan ' + (S.premium ? 'Premium' : 'Gratuito'), 'Comparar y gestionar suscripción');
    html += item('settings', '⚙️', 'Ajustes y relación', 'Perfil, validación, integrantes');
    html += '<div class="card" style="margin-top:16px"><div style="font-weight:800;font-size:14px">📲 Instalar Mimitu</div><div class="tiny muted" style="margin-top:6px">Android (Chrome): ⋮ → Instalar app. iPhone (Safari): Compartir → Agregar a pantalla de inicio.</div></div>';
    return html;
  }
  function feedBody() {
    var html = topbar('📜 Historial', 'more');
    if (!S.feed.length) return html + '<div class="empty">Todavía no hay gestos por aquí.</div>';
    html += '<div class="feed">' + S.feed.map(feedItem).join('') + '</div>';
    if (!S.premium) html += '<p class="tiny muted" style="text-align:center;margin-top:14px">Plan gratuito: últimos 30 días. Premium accede al histórico completo.</p>';
    return html;
  }
  function planBody() {
    var html = topbar('⭐ Plan', 'more');
    function row(f, free, prem) { return '<tr><td>' + f + '</td><td>' + free + '</td><td class="pcol">' + prem + '</td></tr>'; }
    html += '<table class="plan-table"><thead><tr><th></th><th>Gratis</th><th class="pcol">Premium</th></tr></thead><tbody>' +
      row('Marcador, registro y validación', '✓', '✓') +
      row('Acciones propias', '3', '∞') +
      row('Premios activos', '3', '∞') +
      row('Historial', '30 días', 'Completo') +
      row('Torneos', 'Unirse', 'Crear + unirse') +
      row('Umbral de validación', 'Fijo (25)', 'Configurable') +
      row('Integrantes', '2', '3 o más') +
      row('Publicidad', 'Sí (zona fría)', 'Sin ads') +
      '</tbody></table>';
    html += '<div class="install-tip" style="margin-top:16px">Precio de lanzamiento sujeto a validación. El Plan Premium cubre a <b>ambos miembros</b> con una sola suscripción (como un plan familiar).</div>';
    html += '<button class="cta ' + (S.premium ? 'ghost' : 'gold') + '" data-act="toggle-premium" style="margin-top:16px">' + (S.premium ? 'Volver al plan gratuito' : 'Probar Premium ⭐') + '</button>';
    return html;
  }
  function settingsBody() {
    var html = topbar('⚙️ Ajustes', 'more');
    html += '<div class="card"><div style="font-weight:800;font-size:14px">Relación vinculada</div><div class="tiny muted" style="margin-top:6px">' +
      S.members.map(function (m) { return esc(m.emoji + ' ' + (m.name || '—')); }).join(' &nbsp;•&nbsp; ') + '</div><div class="tiny muted" style="margin-top:6px">Código: <b>' + esc(S.code || '—') + '</b></div></div>';

    if (S.premium && S.members.length < 4) html += '<button class="cta ghost" data-act="add-member" style="margin-top:12px">+ Agregar integrante (Premium · 3+)</button>';

    if (S.premium) html += '<div class="card" style="margin-top:12px"><div style="font-weight:800;font-size:14px">Umbral de validación</div><div class="tiny muted" style="margin-top:4px">Acciones por encima de este valor requieren aprobación. Cualquiera propone; impacta al aceptar ambos.</div><div style="display:flex;align-items:center;gap:10px;margin-top:10px"><b style="font-size:20px;color:var(--magenta)">' + S.threshold + '</b><input type="range" min="10" max="60" step="5" value="' + S.threshold + '" data-act="threshold" style="flex:1;accent-color:var(--magenta)"></div></div>';

    html += '<div class="card" style="margin-top:12px"><div style="font-weight:800;font-size:14px">Notificaciones</div><div class="tiny muted" style="margin-top:4px">Validaciones, mimitus de tu pareja, fechas y pregunta diaria.</div><button class="mini solid" data-act="ask-notif" style="margin-top:10px">' + (S.notifPerm === 'granted' ? 'Activadas ✓' : 'Activar notificaciones') + '</button></div>';

    html += '<div class="card" style="margin-top:12px"><div style="font-weight:800;font-size:14px">Cambiar de miembro (demo)</div><div class="tiny muted" style="margin-top:4px">En la app real cada persona usa su teléfono. Acá alternás para ver la validación de la pareja.</div><button class="mini solid" data-act="swap" style="margin-top:10px">Usando: ' + esc(me().emoji + ' ' + (me().name || 'Yo')) + ' ⇄</button></div>';

    html += '<div class="card" style="margin-top:12px;border-color:#f3c9d6"><div style="font-weight:800;font-size:14px;color:var(--red)">Disolver relación</div><div class="tiny muted" style="margin-top:4px">El historial común se conserva para quien permanece; las contribuciones de quien se va se anonimizan. (En la demo reinicia todo.)</div><button class="mini ghost" data-act="dissolve" style="margin-top:10px;color:var(--red);border-color:#f3c9d6">Disolver</button></div>';

    html += '<div class="card" style="margin-top:12px"><div style="font-weight:800;font-size:14px">Legales</div>' +
      '<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">' +
      '<button class="mini ghost" data-act="open-legal" data-u="legal/privacidad.html">Privacidad</button>' +
      '<button class="mini ghost" data-act="open-legal" data-u="legal/terminos.html">Términos</button>' +
      '<button class="mini ghost" data-act="open-legal" data-u="legal/eliminar-cuenta.html">Eliminar cuenta</button>' +
      '</div></div>';

    if (ONLINE) {
      html += '<div class="card" style="margin-top:12px;border-color:#f3c9d6"><div style="font-weight:800;font-size:14px;color:var(--red)">Eliminar mi cuenta</div><div class="tiny muted" style="margin-top:4px">Borra tus datos personales. El historial común se conserva anonimizado para tu pareja.</div><button class="mini ghost" data-act="delete-account" style="margin-top:10px;color:var(--red);border-color:#f3c9d6">Eliminar cuenta</button></div>';
    } else {
      html += '<button class="cta ghost" data-act="reset" style="margin-top:18px">Reiniciar datos de demo</button>';
    }
    html += '<p class="tiny muted" style="text-align:center;margin-top:12px">Mimitu · Cada gesto suma 💜</p>';
    return html;
  }

  /* ============================================================
     SHEETS
     ============================================================ */
  var sheetState = null;
  function openSheet(html) { closeSheet(); var s = document.createElement('div'); s.className = 'scrim'; s.id = 'scrim'; s.innerHTML = '<div class="sheet"><div class="grab"></div>' + html + '</div>'; document.body.appendChild(s); s.addEventListener('click', function (e) { if (e.target === s) closeSheet(); }); }
  function closeSheet() { var s = document.getElementById('scrim'); if (s) s.remove(); }

  function openRegister() { sheetState = { step: 1, actionId: null, note: '', photo: null }; renderRegister(); }
  function renderRegister() {
    var st = sheetState;
    if (st.step === 1) {
      var cats = {}; allActions().forEach(function (x) { (cats[x.cat] = cats[x.cat] || []).push(x); });
      var grid = '';
      Object.keys(cats).forEach(function (c) {
        grid += '<div class="cat-title">' + esc(c) + '</div><div class="grid2">' + cats[c].map(function (x) {
          var honor = x.value <= S.threshold;
          return '<button class="acard" data-act="pick-action" data-id="' + x.id + '"><div class="em">' + x.emoji + '</div><div class="nm">' + esc(x.name) + '</div><div class="pv">+' + x.value + '</div><div class="lock">' + (honor ? 'por honor' : 'requiere aprobación') + '</div></button>';
        }).join('') + '</div>';
      });
      var canCustom = S.premium || S.customActions.length < 3;
      openSheet('<h3>Registrar una acción</h3><p class="tiny muted">Elegí qué hiciste. Menos de 15 segundos 💨</p>' + grid +
        '<button class="cta ghost" data-act="custom-action" style="margin-top:16px"' + (canCustom ? '' : ' disabled') + '>+ Crear acción propia' + (canCustom ? '' : ' (límite 3)') + '</button>');
    } else if (st.step === 2) {
      var x = allActions().filter(function (a) { return a.id === st.actionId; })[0];
      var honor = x.value <= S.threshold;
      openSheet('<h3>Confirmar acción</h3><div class="selbox"><div class="e">' + x.emoji + '</div><div class="n">' + esc(x.name) + '</div><div class="v">+' + x.value + ' mimitus</div></div>' +
        '<div class="field-l"><label>Nota para tu pareja (opcional)</label><textarea class="tinput" id="reg-note" placeholder="Ej: ¡con postre incluido!">' + esc(st.note) + '</textarea></div>' +
        '<div class="field-l"><label>Foto de evidencia (opcional)</label>' +
        (st.photo ? '<div class="photo-prev"><img src="' + st.photo + '" alt="evidencia"><button class="photo-x" data-act="reg-photo-clear">✕</button></div>'
          : '<label class="photo-add"><input type="file" accept="image/*" capture="environment" id="reg-photo" data-act="reg-photo" hidden>📷 Agregar foto</label>') +
        '<div class="tiny muted" style="margin-top:6px">Útil para que tu pareja valide acciones de alto valor. Se guarda cifrada (en producción).</div></div>' +
        '<div class="pill" style="display:block;text-align:center">' + (honor ? '✅ Se acredita al instante (≤ ' + S.threshold + ', por honor)' : '⏳ Supera ' + S.threshold + ': tu pareja deberá aprobarla') + '</div>' +
        '<button class="cta green" data-act="confirm-action">' + (honor ? 'Sumar mimitus' : 'Enviar para aprobación') + '</button>' +
        '<button class="cta ghost" data-act="reg-back" style="margin-top:8px">Cambiar acción</button>');
    } else if (st.step === 3) {
      var x2 = st.result.action, h2 = st.result.honor;
      openSheet('<div class="celebrate"><div class="checkwrap ' + (h2 ? '' : 'amber') + '">' + (h2 ? '✓' : '⏳') + '</div>' +
        (h2 ? '<div class="bignum">+' + x2.value + '</div>' : '<div style="font-size:20px;font-weight:900;margin-top:16px;color:#8a6d1f">¡Enviada!</div>') +
        '<p class="sub muted" style="margin-top:10px">' + (h2 ? '¡' + esc(x2.name) + ' registrada!' : esc(partner().name || 'Tu pareja') + ' recibirá una notificación para aprobar <b>' + esc(x2.name) + '</b>.') + '</p>' +
        (h2 ? '' : '<div class="pill">Cambiá de miembro (⇄) para validarla en la demo</div>') + '</div><button class="cta" data-act="close-sheet" style="margin-top:18px">Listo</button>');
    }
  }

  function openProposeReward() {
    if (!S.premium && S.rewards.length >= 3) { toast('Plan gratuito: máximo 3 premios.'); return; }
    openSheet('<h3>Proponer un premio</h3><p class="tiny muted">Tu pareja deberá aceptarlo para activarlo.</p>' +
      '<div class="field-l"><label>Emoji</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      ['🎬', '🍕', '💆', '🛁', '🎮', '🌮', '🍦', '🚗', '☕', '👑'].map(function (e, i) { return pickBtn('reward-emoji', e, i === 0); }).join('') + '</div></div>' +
      '<div class="field-l"><label>Nombre del premio</label><input class="tinput" id="rw-name" placeholder="Ej: Elegir la película del finde"></div>' +
      '<div class="field-l"><label>Costo en mimitus</label><input class="tinput" id="rw-cost" type="number" inputmode="numeric" value="200"></div>' +
      '<div class="field-l"><label>Descripción (opcional)</label><input class="tinput" id="rw-desc" placeholder="Detalle breve"></div>' +
      '<button class="cta" data-act="save-reward" style="margin-top:16px">Proponer premio</button>');
    sheetState = { rewardEmoji: '🎬' };
  }
  function openCustomAction() {
    openSheet('<h3>Crear acción propia</h3><p class="tiny muted">Pasa por un filtro de contenido (IA): nada de violencia ni reproche.</p>' +
      '<div class="field-l"><label>Emoji</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      ['✨', '🎶', '🧺', '🐕', '🌱', '📞', '🎨', '🏃', '🧁', '💐'].map(function (e, i) { return pickBtn('ca-emoji', e, i === 0); }).join('') + '</div></div>' +
      '<div class="field-l"><label>Nombre</label><input class="tinput" id="ca-name" placeholder="Ej: Pasear al perro"></div>' +
      '<div class="field-l"><label>Categoría</label><input class="tinput" id="ca-cat" value="Detalles"></div>' +
      '<div class="field-l"><label>Valor en mimitus</label><input class="tinput" id="ca-val" type="number" inputmode="numeric" value="15"></div>' +
      '<button class="cta" data-act="save-custom" style="margin-top:16px">Verificar y crear</button>');
    sheetState = { caEmoji: '✨' };
  }
  function openAnswerDQ() {
    openSheet('<h3>Pregunta del día</h3><div class="dq-q" style="margin-top:6px">' + esc(QUESTIONS[S.dq.qi]) + '</div>' +
      '<p class="tiny muted" style="margin-top:8px">Tu respuesta queda oculta hasta que ambos respondan 🔒</p>' +
      '<div class="field-l"><textarea class="tinput" id="dq-ans" placeholder="Escribí tu respuesta..."></textarea></div>' +
      '<button class="cta" data-act="save-dq" style="margin-top:8px">Responder (+5 mimitus)</button>');
  }
  function openThank(fid) {
    openSheet('<h3>Agradecer 🙏</h3><p class="tiny muted">Un gesto opcional; no cambia las mimitus.</p>' +
      '<div class="field-l"><label>Reacción</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      THANK_EMOJIS.map(function (e, i) { return pickBtn('thank-emoji', e, i === 0); }).join('') + '</div></div>' +
      '<div class="field-l"><label>Nota (opcional)</label><input class="tinput" id="th-note" placeholder="¡Gracias, me encantó!"></div>' +
      '<button class="cta" data-act="save-thank" data-id="' + fid + '" style="margin-top:12px">Enviar agradecimiento</button>');
    sheetState = { thankEmoji: THANK_EMOJIS[0] };
  }
  function openAddDate() {
    openSheet('<h3>Agregar fecha significativa</h3>' +
      '<div class="field-l"><label>Emoji</label><div style="display:flex;gap:8px;flex-wrap:wrap">' + ['💞', '🎂', '💍', '🌹', '🎉', '✈️'].map(function (e, i) { return pickBtn('date-emoji', e, i === 0); }).join('') + '</div></div>' +
      '<div class="field-l"><label>Título</label><input class="tinput" id="dt-title" placeholder="Aniversario"></div>' +
      '<div class="field-l"><label>Fecha</label><input class="tinput" id="dt-date" type="date"></div>' +
      '<div class="field-l"><label>Recordar (días antes)</label><input class="tinput" id="dt-remind" type="number" inputmode="numeric" value="3"></div>' +
      '<div class="field-l"><label>Bonificación al cumplir</label><input class="tinput" id="dt-bonus" type="number" inputmode="numeric" value="100"></div>' +
      '<button class="cta" data-act="save-date" style="margin-top:14px">Guardar fecha</button>');
    sheetState = { dateEmoji: '💞' };
  }
  function openAddPlan() {
    openSheet('<h3>Agregar plan</h3>' +
      '<div class="field-l"><label>Emoji</label><div style="display:flex;gap:8px;flex-wrap:wrap">' + ['🗺️', '🍽️', '🏖️', '🎬', '🎡', '⛰️'].map(function (e, i) { return pickBtn('plan-emoji', e, i === 0); }).join('') + '</div></div>' +
      '<div class="field-l"><label>Título</label><input class="tinput" id="pl-title" placeholder="Escapada de finde"></div>' +
      '<div class="field-l"><label>Fecha</label><input class="tinput" id="pl-date" type="date"></div>' +
      '<div class="field-l"><label>Descripción (opcional)</label><input class="tinput" id="pl-desc" placeholder="Detalle"></div>' +
      '<div class="field-l"><label>Mimitus al completar (opcional)</label><input class="tinput" id="pl-val" type="number" inputmode="numeric" value="0"></div>' +
      '<button class="cta" data-act="save-plan" style="margin-top:14px">Guardar plan</button>');
    sheetState = { planEmoji: '🗺️' };
  }
  function openCreateTournament() {
    if (!S.premium) { toast('Crear torneos es una función Premium.'); return; }
    openSheet('<h3>Crear torneo</h3><p class="tiny muted">Invitás a otras parejas con un código. Todos parten de cero.</p>' +
      '<div class="field-l"><label>Nombre del torneo</label><input class="tinput" id="t-name" placeholder="Liga de los amigos"></div>' +
      '<div class="field-l"><label>Fecha de fin</label><input class="tinput" id="t-end" type="date"></div>' +
      '<button class="cta" data-act="save-tournament" style="margin-top:14px">Crear e invitar</button>');
  }
  function openJoinTournament() {
    openSheet('<h3>Unirme a un torneo</h3><p class="tiny muted">Ingresá el código que te compartieron.</p>' +
      '<div class="field-l"><input class="tinput" id="t-code" placeholder="ABC123" style="text-transform:uppercase;letter-spacing:3px;text-align:center;font-weight:800"></div>' +
      '<button class="cta" data-act="save-join" style="margin-top:8px">Unirme</button>');
  }
  function openAddMember() {
    openSheet('<h3>Agregar integrante</h3><p class="tiny muted">Premium habilita relaciones de 3 o más. Comunicalo según tu público.</p>' +
      '<div class="field-l"><label>Emoji</label><div style="display:flex;gap:8px;flex-wrap:wrap">' + AVATARS.map(function (e, i) { return pickBtn('mem-emoji', e, i === 0); }).join('') + '</div></div>' +
      '<div class="field-l"><label>Nombre</label><input class="tinput" id="mem-name" placeholder="Nombre"></div>' +
      '<button class="cta" data-act="save-member" style="margin-top:12px">Agregar</button>');
    sheetState = { memEmoji: AVATARS[0] };
  }
  function openTournament(id) {
    var t = S.tournaments.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    if (t._server) {
      var rows = (t.couples || []).slice().sort(function (a, b) { return b.score - a.score; }).map(function (r, i) {
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        return '<div class="tour-row ' + (r.mine ? 'mine' : '') + '"><div class="tr-rk">' + medal + '</div><div class="tr-nm">' + esc(r.name) + (r.mine ? ' <span class="tr-you">vos</span>' : '') + '</div><div class="tr-sc">' + r.score + '</div></div>';
      }).join('');
      openSheet('<h3>' + esc(t.name) + '</h3><p class="tiny muted">Código <b>' + esc(t.code) + '</b> · termina ' + esc(t.end || '—') + '</p>' +
        '<p class="tiny muted" style="margin-top:6px">Solo se comparte el total de cada pareja, nunca el detalle de las acciones.</p>' +
        '<div class="tour-list" style="margin-top:10px">' + rows + '</div>' +
        '<button class="cta" data-act="close-sheet" style="margin-top:12px">Cerrar</button>');
      return;
    }
    var sc = tournamentScores(t);
    var tab = t._view || 'couple';
    var list = (tab === 'couple' ? sc.couples : sc.individuals).map(function (r, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      return '<div class="tour-row ' + (r.mine ? 'mine' : '') + '"><div class="tr-rk">' + medal + '</div>' + (r.emoji ? '<div class="tr-em">' + r.emoji + '</div>' : '') + '<div class="tr-nm">' + esc(r.name) + (r.mine ? ' <span class="tr-you">vos</span>' : '') + '</div><div class="tr-sc">' + r.score + '</div></div>';
    }).join('');
    var winner = t.finished ? '<div class="winner">🏆 Ganó <b>' + esc(sc.couples[0].name) + '</b> con ' + sc.couples[0].score + ' mimitus</div>' : '';
    openSheet('<h3>' + esc(t.name) + '</h3><p class="tiny muted">Código <b>' + esc(t.code) + '</b> · termina ' + esc(t.end || '—') + (t.finished ? ' · finalizado' : '') + '</p>' +
      winner +
      '<div class="segment" style="margin-top:10px"><button class="' + (tab === 'couple' ? 'on' : '') + '" data-act="t-view" data-id="' + t.id + '" data-v="couple">Por pareja</button><button class="' + (tab === 'individual' ? 'on' : '') + '" data-act="t-view" data-id="' + t.id + '" data-v="individual">Individual</button></div>' +
      '<div class="tour-list">' + list + '</div>' +
      (t.finished ? '' : '<button class="cta ghost" data-act="finish-tournament" data-id="' + t.id + '" style="margin-top:14px">Finalizar (admin)</button>') +
      '<button class="cta" data-act="close-sheet" style="margin-top:8px">Cerrar</button>');
  }
  function openNotifs() {
    S.notifications.forEach(function (n) { n.read = true; });
    var list = S.notifications.length ? S.notifications.map(function (n) { return '<div class="notif"><div class="nf-em">' + n.emoji + '</div><div class="nf-t">' + n.text + '<div class="fmeta">' + timeAgo(n.ts) + '</div></div></div>'; }).join('') : '<div class="empty">Sin notificaciones.</div>';
    openSheet('<h3>🔔 Notificaciones</h3>' + list + '<button class="cta" data-act="close-render" style="margin-top:14px">Cerrar</button>');
    save();
  }
  function pickBtn(act, e, on) { return '<button data-act="' + act + '" data-em="' + e + '" style="width:44px;height:44px;border-radius:12px;font-size:22px;background:' + (on ? '#FCEEF5' : '#fff') + ';border:1.5px solid ' + (on ? 'var(--magenta)' : 'var(--line)') + '">' + e + '</button>'; }
  function highlightPick(el) { var s = el.parentNode.children; for (var i = 0; i < s.length; i++) { s[i].style.background = '#fff'; s[i].style.borderColor = 'var(--line)'; } el.style.background = '#FCEEF5'; el.style.borderColor = 'var(--magenta)'; }

  /* ============================================================
     HANDLERS
     ============================================================ */
  var handlers = {
    /* onboarding */
    'ob-next': function () { S.ob.step = 1; render(); },
    'ob-back': function () { S.ob.step = Math.max(0, S.ob.step - 1); render(); },
    'ob-age': function (el) { S.ob.age = el.checked; render(); },
    'ob-terms': function (el) { S.ob.terms = el.checked; render(); },
    'ob-toauth': function () { if (S.ob.age && S.ob.terms) { S.ob.step = 2; render(); } },
    'ob-sso': function () { S.ob.method = 'google'; S.ob.step = 3; render(); },
    'ob-email-go': function () { var em = val('ob-email'), pw = val('ob-pass'); if (!em || !pw) { toast('Completá email y contraseña'); return; } S.ob.email = em; S.ob.pass = pw; S.ob.method = 'email'; S.ob.step = 3; render(); },
    'ob-profile-go': function () {
      var n = val('ob-name').trim(); if (!n) { toast('Escribí tu nombre'); return; }
      S.members[0].name = n;
      if (ONLINE) {
        var p;
        if (S.ob.method === 'email') p = API.auth.register({ email: S.ob.email, password: S.ob.pass, name: n, ageConfirmed: true, termsAccepted: true });
        else p = API.auth.social({ provider: S.ob.method || 'google', idToken: 'dev_' + n + '_' + Date.now(), name: n, ageConfirmed: true });
        if (busy) return; busy = true;
        Promise.resolve(p).then(function () { busy = false; S.ob.step = 4; render(); }).catch(function (e) { busy = false; if (e && e.message === 'email_in_use' && S.ob.method === 'email') { return API.auth.login({ email: S.ob.email, password: S.ob.pass }).then(function () { S.ob.step = 4; render(); }); } toast(apiError(e)); });
        return;
      }
      S.ob.step = 4; render();
    },
    'ob-avatar': function (el) { byId(el.dataset.mid).emoji = el.dataset.em; render(); },
    'ob-invite': function () {
      S.ob.path = 'invite';
      if (ONLINE) { net2(API.couples.create().then(function (r) { S.code = r.couple.code; S.ob.step = 5; render(); })); return; }
      S.code = code6(); S.ob.step = 5; render();
    },
    'ob-join': function () { S.ob.path = 'join'; S.ob.step = 6; render(); },
    'ob-tolink': function () { S.ob.step = 4; render(); },
    'ob-share': function () { var t = '¡Unite a mi pareja en Mimitu! Código: ' + S.code; if (navigator.share) navigator.share({ title: 'Mimitu', text: t }).catch(function () {}); else { try { navigator.clipboard.writeText(S.code); } catch (e) {} toast('Código copiado: ' + S.code); } },
    'ob-finish': function () {
      if (ONLINE) {
        if (S.ob.path === 'join') { var cc = val('ob-code').trim().toUpperCase(); if (cc.length < 4) { toast('Ingresá el código'); return; } net(API.couples.join(cc), '¡Pareja vinculada! 💞'); }
        else { net(Promise.resolve(), null); }
        return;
      }
      var pn = val('ob-pname').trim(); if (!pn) { toast('Ponele nombre a tu pareja'); return; }
      if (S.ob.path === 'join') { var c = val('ob-code').trim().toUpperCase(); if (c.length < 4) { toast('Ingresá el código'); return; } S.code = c; }
      S.members[1].name = pn; S.onboarded = true; S.view = 'home';
      feedPush({ type: 'system', text: '¡Pareja vinculada! 💞 Empieza el juego', emoji: '🔗' });
      render(); toast('¡Bienvenidos a Mimitu! 💞');
    },

    /* nav */
    'view': function (el) { S.view = el.dataset.v; if (ONLINE) { net(Promise.resolve()); } else render(); },
    'notifs': function () { openNotifs(); },
    'close-render': function () { closeSheet(); render(); },
    'close-sheet': function () { closeSheet(); if (S.view !== 'home' && (sheetState && sheetState.step === 3)) { S.view = 'home'; } render(); },
    'swap': function () { var i = idx(S.active); S.active = S.members[(i + 1) % S.members.length].id; render(); toast('Ahora usás Mimitu como ' + (me().name || 'otro integrante')); },

    /* registro */
    'register': function () { openRegister(); },
    'quick': function (el) { doRegister(el.dataset.id, '', true); },
    'pick-action': function (el) { sheetState.actionId = el.dataset.id; sheetState.step = 2; renderRegister(); },
    'reg-back': function () { sheetState.step = 1; renderRegister(); },
    'confirm-action': function () { sheetState.note = (val('reg-note') || '').trim(); doRegister(sheetState.actionId, sheetState.note, false, sheetState.photo); },
    'reg-photo': function (el) { var f = el.files && el.files[0]; if (!f) return; sheetState.note = (val('reg-note') || '').trim(); resizeImage(f, function (d) { sheetState.photo = d; renderRegister(); }); },
    'reg-photo-clear': function () { sheetState.note = (val('reg-note') || '').trim(); sheetState.photo = null; renderRegister(); },
    'view-photo': function (el) { openSheet('<h3>Foto de evidencia</h3><img src="' + el.dataset.src + '" style="width:100%;border-radius:14px;margin-top:8px" alt="evidencia"><button class="cta" data-act="close-sheet" style="margin-top:14px">Cerrar</button>'); },
    'custom-action': function () { openCustomAction(); },
    'ca-emoji': function (el) { sheetState.caEmoji = el.dataset.em; highlightPick(el); },
    'save-custom': function () {
      var n = val('ca-name').trim(), cat = val('ca-cat').trim() || 'Detalles', v = parseInt(val('ca-val'), 10);
      if (!n || !v || v < 1) { toast('Completá nombre y valor'); return; }
      if (ONLINE) {
        if (busy) return; busy = true;
        API.actions.create({ name: n, emoji: sheetState.caEmoji || '✨', cat: cat, value: v })
          .then(function (r) { return API.logs.create({ actionId: r.action.id }); })
          .then(function () { return pull(); })
          .then(function () { busy = false; closeSheet(); S.view = 'home'; render(); toast('Verificada por el filtro ✓'); })
          .catch(function (e) { busy = false; toast(apiError(e)); });
        return;
      }
      var low = n.toLowerCase();
      if (BANNED.some(function (w) { return low.indexOf(w) !== -1; })) { toast('🚫 No pasó el filtro de contenido (lenguaje no permitido)'); return; }
      var act = { id: uid(), name: n, emoji: sheetState.caEmoji || '✨', cat: cat, value: v, custom: true };
      S.customActions.push(act); toast('Verificada por el filtro ✓'); doRegister(act.id, '');
    },

    /* validación */
    'approve': function (el) {
      if (ONLINE) { net(API.logs.approve(el.dataset.id), 'Aprobada 🎉'); return; }
      var l = findLog(el.dataset.id); if (!l) return; l.status = 'validated'; gain(byId(l.actorId), l.value);
      feedPush({ type: 'action', actorId: l.actorId, text: '<b>' + esc(byId(l.actorId).name) + '</b> sumó ' + esc(l.emoji + ' ' + l.actionName) + ' (aprobada)', emoji: l.emoji, value: l.value, sign: '+' });
      render(); toast('Aprobada · +' + l.value + ' 🎉');
    },
    'reject': function (el) {
      if (ONLINE) { net(API.logs.reject(el.dataset.id), 'Rechazada (sin penalización)'); return; }
      var l = findLog(el.dataset.id); if (!l) return; l.status = 'rejected'; feedPush({ type: 'action', actorId: l.actorId, text: esc(l.emoji + ' ' + l.actionName) + ' fue rechazada', emoji: '🚫', value: null }); render(); toast('Rechazada (sin penalización)');
    },

    /* premios */
    'propose-reward': function () { openProposeReward(); },
    'reward-emoji': function (el) { sheetState.rewardEmoji = el.dataset.em; highlightPick(el); },
    'save-reward': function () {
      var n = val('rw-name').trim(), c = parseInt(val('rw-cost'), 10), d = val('rw-desc').trim();
      if (!n || !c || c < 1) { toast('Completá nombre y costo'); return; }
      if (ONLINE) { closeSheet(); S.view = 'rewards'; net(API.rewards.create({ name: n, emoji: sheetState.rewardEmoji || '🎁', cost: c, desc: d }), 'Premio propuesto'); return; }
      S.rewards.push({ id: uid(), name: n, emoji: sheetState.rewardEmoji || '🎁', cost: c, desc: d, proposedBy: S.active, status: 'pending', ts: now() });
      feedPush({ type: 'reward', actorId: S.active, text: '<b>' + esc(me().name) + '</b> propuso el premio ' + esc(n), emoji: sheetState.rewardEmoji || '🎁' });
      notify(esc(me().name) + ' propuso un premio: ' + esc(n), '🎁');
      closeSheet(); S.view = 'rewards'; render(); toast('Premio propuesto');
    },
    'accept-reward': function (el) {
      if (ONLINE) { net(API.rewards.accept(el.dataset.id), '¡Premio disponible!'); return; }
      var r = findReward(el.dataset.id); if (!r) return; r.status = 'ready'; feedPush({ type: 'reward', text: 'Premio ' + esc(r.emoji + ' ' + r.name) + ' ya está disponible 🎉', emoji: r.emoji }); render(); toast('¡Premio disponible!');
    },
    'redeem': function (el) {
      if (ONLINE) { net(API.rewards.redeem(el.dataset.id), '¡Canjeado! 🎁'); return; }
      var r = findReward(el.dataset.id); if (!r) return; var m = me(); if (m.balance < r.cost) { toast('Saldo insuficiente'); return; } m.balance -= r.cost; feedPush({ type: 'redeem', actorId: S.active, text: '<b>' + esc(m.name) + '</b> canjeó ' + esc(r.emoji + ' ' + r.name), emoji: r.emoji, value: r.cost, sign: '-' }); notify(esc(m.name) + ' canjeó ' + esc(r.name), '🎁'); render(); celebrateRedeem(r);
    },

    /* daily question */
    'answer-dq': function () { openAnswerDQ(); },
    'save-dq': function () {
      var a = val('dq-ans').trim(); if (!a) { toast('Escribí algo 🙂'); return; }
      if (ONLINE) { closeSheet(); S.view = 'home'; net(API.dq.answer(a), '+5 mimitus · guardada 🔒'); return; }
      S.dq.answers[S.active] = a; gain(me(), 5);
      feedPush({ type: 'dq', actorId: S.active, text: '<b>' + esc(me().name) + '</b> respondió la pregunta del día', emoji: '💬', value: 5, sign: '+' });
      if (S.members.every(function (m) { return S.dq.answers[m.id]; })) notify('¡Ambos respondieron la pregunta del día! Ya podés ver las respuestas 💬', '💬');
      closeSheet(); S.view = 'home'; render(); toast('+5 mimitus · respuesta guardada 🔒');
    },

    /* agradecimientos */
    'thank': function (el) { openThank(el.dataset.id); },
    'thank-emoji': function (el) { sheetState.thankEmoji = el.dataset.em; highlightPick(el); },
    'save-thank': function (el) {
      var f = S.feed.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!f) return;
      f.thank = { by: S.active, emoji: sheetState.thankEmoji || '❤️', note: val('th-note').trim() };
      notify(esc(me().name) + ' agradeció tu acción ' + f.thank.emoji, '🙏');
      closeSheet(); render(); toast('Agradecimiento enviado 🙏');
    },

    /* calendario */
    'cal-tab': function (el) { calTab = el.dataset.t; render(); },
    'add-date': function () { openAddDate(); },
    'date-emoji': function (el) { sheetState.dateEmoji = el.dataset.em; highlightPick(el); },
    'save-date': function () {
      var t = val('dt-title').trim(), d = val('dt-date'), r = parseInt(val('dt-remind'), 10) || 3, b = parseInt(val('dt-bonus'), 10) || 50;
      if (!t || !d) { toast('Completá título y fecha'); return; }
      if (ONLINE) { closeSheet(); calTab = 'dates'; net(API.dates.create({ title: t, emoji: sheetState.dateEmoji || '💞', date: d, remind: r, bonus: b }), 'Fecha guardada 📅'); return; }
      S.dates.push({ id: uid(), title: t, emoji: sheetState.dateEmoji || '💞', date: d, remind: r, bonus: b });
      closeSheet(); calTab = 'dates'; render(); toast('Fecha guardada 📅');
    },
    'fulfill-date': function (el) {
      if (ONLINE) { net(API.dates.fulfill(el.dataset.id), 'Bonificación sumada 🎉'); return; }
      var d = S.dates.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!d) return; gain(me(), d.bonus); feedPush({ type: 'date', actorId: S.active, text: '<b>' + esc(me().name) + '</b> cumplió <b>' + esc(d.title) + '</b>', emoji: d.emoji, value: d.bonus, sign: '+' }); render(); toast('+' + d.bonus + ' por la fecha 🎉');
    },
    'add-plan': function () { openAddPlan(); },
    'plan-emoji': function (el) { sheetState.planEmoji = el.dataset.em; highlightPick(el); },
    'save-plan': function () {
      var t = val('pl-title').trim(), d = val('pl-date'), desc = val('pl-desc').trim(), v = parseInt(val('pl-val'), 10) || 0;
      if (!t) { toast('Completá el título'); return; }
      if (ONLINE) { closeSheet(); calTab = 'plans'; net(API.plans.create({ title: t, emoji: sheetState.planEmoji || '🗺️', date: d, desc: desc, value: v }), 'Plan guardado 🗺️'); return; }
      S.plans.push({ id: uid(), title: t, emoji: sheetState.planEmoji || '🗺️', date: d, desc: desc, value: v, done: false });
      closeSheet(); calTab = 'plans'; render(); toast('Plan guardado 🗺️');
    },
    'complete-plan': function (el) {
      if (ONLINE) { net(API.plans.complete(el.dataset.id), 'Plan completado ✅'); return; }
      var p = S.plans.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!p || p.done) return; p.done = true; if (p.value > 0) gain(me(), p.value); feedPush({ type: 'plan', actorId: S.active, text: '<b>' + esc(me().name) + '</b> completó el plan ' + esc(p.emoji + ' ' + p.title), emoji: p.emoji, value: p.value || null, sign: p.value ? '+' : '' }); render(); toast(p.value ? '+' + p.value + ' por el plan 🎉' : 'Plan completado ✅');
    },

    /* torneos */
    'create-tournament': function () { openCreateTournament(); },
    'save-tournament': function () {
      var n = val('t-name').trim(), e = val('t-end'); if (!n) { toast('Poné un nombre'); return; }
      if (ONLINE) { closeSheet(); net(API.tournaments.create({ name: n, end: e }), 'Torneo creado'); return; }
      var t = newTournament(n, e); S.tournaments.unshift(t); closeSheet(); render(); openTournament(t.id); toast('Torneo creado · código ' + t.code);
    },
    'join-tournament': function () { openJoinTournament(); },
    'save-join': function () {
      var c = val('t-code').trim().toUpperCase(); if (c.length < 4) { toast('Ingresá el código'); return; }
      if (ONLINE) { closeSheet(); net(API.tournaments.join(c), '¡Te uniste al torneo!'); return; }
      var t = newTournament('Torneo de amigos', ''); t.code = c; S.tournaments.unshift(t); closeSheet(); render(); openTournament(t.id); toast('¡Te uniste al torneo!');
    },
    'open-tournament': function (el) { openTournament(el.dataset.id); },
    't-view': function (el) { var t = S.tournaments.filter(function (x) { return x.id === el.dataset.id; })[0]; if (t) { t._view = el.dataset.v; openTournament(t.id); } },
    'finish-tournament': function (el) { var t = S.tournaments.filter(function (x) { return x.id === el.dataset.id; })[0]; if (!t) return; t.finished = true; var sc = tournamentScores(t); notify('Torneo "' + esc(t.name) + '" finalizado. Ganó ' + esc(sc.couples[0].name) + ' 🏆', '🏆'); openTournament(t.id); render(); },

    /* plan / settings */
    'toggle-premium': function () {
      if (ONLINE) {
        if (S.premium) { toast('Gestioná o cancelá tu suscripción desde Mercado Pago'); return; }
        if (busy) return; busy = true;
        API.checkout().then(function (r) {
          if (r.mock) { return API.devPremium(true).then(pull).then(function () { busy = false; render(); toast('Premium activado ⭐ (demo)'); }); }
          busy = false; toast('Redirigiendo a Mercado Pago…'); location.href = r.url;
        }).catch(function (e) { busy = false; toast(apiError(e)); });
        return;
      }
      S.premium = !S.premium; render(); toast(S.premium ? 'Premium activado ⭐' : 'Volviste al plan gratuito');
    },
    'delete-account': function () {
      if (!confirm('¿Eliminar tu cuenta? Se borran tus datos personales. El historial común se conserva para tu pareja de forma anonimizada. Esta acción no se puede deshacer.')) return;
      if (ONLINE) { net2(API.deleteAccount().then(function () { API.logout(); location.reload(); })); return; }
      localStorage.removeItem(KEY); S = clone(DEFAULT); render();
    },
    'open-legal': function (el) { var u = el.dataset.u; try { window.open(u, '_blank'); } catch (e) { location.href = u; } },
    'threshold': function (el) { S.threshold = parseInt(el.value, 10); save(); var b = el.parentNode.querySelector('b'); if (b) b.textContent = S.threshold; },
    'ask-notif': function () {
      if (typeof Notification === 'undefined') { S.notifPerm = 'unsupported'; toast('Este navegador no soporta notificaciones'); render(); return; }
      Notification.requestPermission().then(function (p) {
        S.notifPerm = p; save();
        if (p === 'granted' && ONLINE) { subscribePush().then(function () { render(); toast('Notificaciones activadas ✓'); }); }
        else { render(); toast(p === 'granted' ? 'Notificaciones activadas ✓' : 'Permiso no concedido'); }
      }).catch(function () {});
    },
    'add-member': function () { if (ONLINE) { toast('Tu 3er integrante se une con el código de la pareja (Premium)'); return; } openAddMember(); },
    'mem-emoji': function (el) { sheetState.memEmoji = el.dataset.em; highlightPick(el); },
    'save-member': function () { var n = val('mem-name').trim(); if (!n) { toast('Poné un nombre'); return; } S.members.push({ id: uid(), name: n, emoji: sheetState.memEmoji || '🌟', balance: 0, earned: 0 }); closeSheet(); render(); toast('Integrante agregado 👥'); },
    'dissolve': function () { if (confirm('¿Disolver la relación? En la demo reinicia todo.')) { if (ONLINE) { API.logout(); location.reload(); return; } localStorage.removeItem(KEY); S = clone(DEFAULT); render(); } },
    'reset': function () { if (confirm('¿Reiniciar todos los datos de demo?')) { if (ONLINE) { API.logout(); location.reload(); return; } localStorage.removeItem(KEY); S = clone(DEFAULT); render(); } }
  };

  function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function findLog(id) { return S.logs.filter(function (x) { return x.id === id; })[0]; }
  function findReward(id) { return S.rewards.filter(function (x) { return x.id === id; })[0]; }

  function doRegister(actionId, note, quiet, photo) {
    var x = allActions().filter(function (a) { return a.id === actionId; })[0]; if (!x) return;
    if (ONLINE) {
      if (!quiet) closeSheet();
      if (busy) return; busy = true;
      API.logs.create({ actionId: actionId, note: note || '', photo: photo || null })
        .then(function (r) { return pull().then(function () { busy = false; S.view = 'home'; render(); toast(r.status === 'validated' ? '+' + x.value + ' mimitus 🎉' : 'Enviada para aprobación ⏳'); }); })
        .catch(function (e) { busy = false; render(); toast(apiError(e)); });
      return;
    }
    var honor = x.value <= S.threshold;
    var log = { id: uid(), actorId: S.active, actionName: x.name, emoji: x.emoji, value: x.value, status: honor ? 'validated' : 'pending', note: note || '', photo: photo || null, ts: now() };
    S.logs.unshift(log);
    if (honor) { gain(me(), x.value); feedPush({ type: 'action', actorId: S.active, text: '<b>' + esc(me().name) + '</b> registró ' + esc(x.emoji + ' ' + x.name), emoji: x.emoji, value: x.value, sign: '+', photo: photo || null }); notify(esc(me().name) + ' sumó ' + x.value + ' con ' + esc(x.name), x.emoji); }
    else { feedPush({ type: 'action', actorId: S.active, text: '<b>' + esc(me().name) + '</b> registró ' + esc(x.emoji + ' ' + x.name) + ' · pendiente', emoji: x.emoji, value: x.value, sign: '?', photo: photo || null }); notify(esc(me().name) + ' registró ' + esc(x.name) + ' (+' + x.value + ') · necesita tu aprobación', '⏳'); }
    if (quiet) { render(); toast(honor ? '+' + x.value + ' mimitus 🎉' : 'Enviada para aprobación ⏳'); }
    else { sheetState = { step: 3, result: { action: x, honor: honor } }; renderRegister(); save(); }
  }
  /* redimensiona una imagen a dataURL liviano (max 900px, JPEG) */
  function resizeImage(file, cb) {
    try {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          try {
            var max = 900, w = img.width, h = img.height;
            if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
            else if (h > max) { w = Math.round(w * max / h); h = max; }
            var c = document.createElement('canvas'); c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            cb(c.toDataURL('image/jpeg', 0.7));
          } catch (err) { cb(e.target.result); }
        };
        img.onerror = function () { cb(e.target.result); };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) { cb(null); }
  }
  function celebrateRedeem(r) {
    openSheet('<div class="celebrate"><div class="checkwrap gold">🎁</div><div style="font-size:20px;font-weight:900;margin-top:16px;color:var(--magenta)">¡Canjeado!</div>' +
      '<p class="sub muted" style="margin-top:10px">Disfrutá <b>' + esc(r.name) + '</b>. Se descontaron ' + r.cost + ' mimitus.</p><div class="pill">Quedó en el historial</div></div>' +
      '<button class="cta" data-act="close-sheet" style="margin-top:18px">Listo</button>');
  }

  document.addEventListener('click', function (e) { var el = e.target.closest('[data-act]'); if (!el) return; var a = el.dataset.act; if (handlers[a]) { e.preventDefault(); handlers[a](el); } });
  document.addEventListener('change', function (e) { var el = e.target.closest('[data-act]'); if (!el) return; var a = el.dataset.act; if ((a === 'ob-age' || a === 'ob-terms' || a === 'threshold' || a === 'reg-photo') && handlers[a]) handlers[a](el); });

  if (ONLINE && API.getToken()) {
    $app.innerHTML = '<div class="ob"><div class="spacer"></div><div class="brand" style="text-align:center">' + brandLockup() + '</div><p class="tag" style="text-align:center">Cargando…</p><div class="spacer"></div></div>';
    pull().then(render).catch(function () { S.onboarded = false; render(); });
  } else {
    render();
  }
})();
