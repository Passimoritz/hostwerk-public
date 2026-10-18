/*!
 * Hostwerk Extension SDK 2 – runs inside an extension page or dashboard tile.
 * Served by Hostwerk at /ext-sdk.js. Docs: https://github.com/Passimoritz/hostwerk-public/tree/main/sdk
 *
 * The page runs in a sandbox (own opaque origin, no access to Hostwerk's login). Everything goes through
 * postMessage to Hostwerk, which checks the extension's permissions and asks the user before anything changes.
 * The SDK also loads the Hostwerk design kit (/ext-sdk.css) and keeps colours, light/dark mode and language in sync –
 * so an extension looks like a part of Hostwerk without copying any colours.
 */
(() => {
  'use strict';
  if (window.Hostwerk && window.Hostwerk.sdk) return;
  const VERSION = '2.0.0';
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  let messages = {};
  const state = { lang: document.documentElement.lang || 'en', theme: 'dark', ext: null, app: null, settings: {}, embed: 'page' };

  // Design kit first, so the page never flashes unstyled
  if (!document.querySelector('link[data-hostwerk-kit]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/ext-sdk.css'; l.setAttribute('data-hostwerk-kit', '');
    (document.head || document.documentElement).prepend(l);
  }

  const emit = (type, payload) => { for (const cb of listeners.get(type) || []) { try { cb(payload); } catch (e) { console.error(e); } } };
  const send = (msg) => parent.postMessage({ hostwerkExt: true, v: 2, ...msg }, '*');
  const call = (method, path = '', body) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    send({ id, method, path, body });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Hostwerk did not answer')); } }, 120000);
  });

  function applyTheme(t) {
    if (!t) return;
    state.theme = t.mode === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.style.colorScheme = state.theme;
    for (const [k, v] of Object.entries(t.vars || {})) if (/^--[\w-]+$/.test(k)) root.style.setProperty(`--hw-${k.slice(2)}`, String(v));
    if (t.font) root.style.setProperty('--hw-font', t.font);
    if (t.mono) root.style.setProperty('--hw-mono', t.mono);
  }
  /** data-i18n="key" → textContent, data-i18n-title / -placeholder → attributes (within root). */
  function translate(root = document) {
    const all = (sel) => [...(root.matches && root.matches(sel) ? [root] : []), ...root.querySelectorAll(sel)];
    for (const el of all('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of all('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    for (const el of all('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  function applyLang(lang, msgs) {
    state.lang = lang === 'de' ? 'de' : 'en';
    document.documentElement.lang = state.lang;
    if (msgs) messages = msgs;
    translate(document);
  }

  addEventListener('message', (e) => {
    if (e.source !== parent) return;
    const m = e.data || {};
    if (!m.hostwerk) return;
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); return m.error ? p.reject(new Error(m.error)) : p.resolve(m.data); }
    if (m.type === 'init') {
      Object.assign(state, { ext: m.ext, app: m.app, settings: m.settings || {}, embed: m.embed || 'page' });
      applyTheme(m.theme); applyLang(m.lang, m.messages);
      document.documentElement.dataset.embed = state.embed;
      readyResolve(api.info());
    } else if (m.type === 'theme') { applyTheme(m.theme); emit('theme', state.theme); }
    else if (m.type === 'lang') { applyLang(m.lang, m.messages); emit('lang', state.lang); }
    else if (m.type === 'settings') { state.settings = m.settings || {}; emit('settings', state.settings); }
    else if (m.type === 'event') emit(m.event, m.data);
  });

  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });

  /** Text in the current language: locales/<lang>.json of the extension; {name} placeholders. */
  function t(key, vars) {
    let s = messages[key];
    if (s == null) s = key;
    if (vars) s = String(s).replace(/\{(\w+)\}/g, (m0, k) => (vars[k] != null ? String(vars[k]) : m0));
    return String(s);
  }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  /** Safe HTML: every ${value} is escaped. Nest with Hostwerk.raw(…) or another Hostwerk.html`…`. */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  function html(strings, ...values) {
    let out = strings[0];
    values.forEach((v, i) => {
      const part = Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.s : esc(x))).join('') : v instanceof Raw ? v.s : esc(v);
      out += part + strings[i + 1];
    });
    return new Raw(out);
  }
  /** Replace the content of an element with safe HTML (from Hostwerk.html). */
  function render(el, content) {
    const node = typeof el === 'string' ? document.querySelector(el) : el;
    if (!node) return;
    node.innerHTML = content instanceof Raw ? content.s : esc(content);
    translate(node);
  }

  const fmt = {
    bytes(n) { if (n == null || isNaN(n)) return '–'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let x = Number(n); while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; } return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${u[i]}`; },
    duration(ms) { const s = Math.floor(Number(ms || 0) / 1000); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); const de = state.lang === 'de'; if (d) return de ? `${d} T ${h} Std` : `${d}d ${h}h`; if (h) return de ? `${h} Std ${m} Min` : `${h}h ${m}m`; return de ? `${m} Min` : `${m}m`; },
    number(n) { return new Intl.NumberFormat(state.lang === 'de' ? 'de-DE' : 'en-US').format(Number(n || 0)); },
    time(ts) { return new Date(ts).toLocaleTimeString(state.lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' }); },
  };

  /** Flat list of all services from /overview: { id, kind, name, state, port, url } */
  async function services() {
    const o = await call('GET', '/overview');
    const pick = (kind, xs, url) => (xs || []).map((s) => ({ id: s.id, kind, name: s.name, state: (s.proc && s.proc.state) || 'stopped', port: s.port || null, url: url ? url(s) : null, cpu: s.proc && s.proc.stats ? s.proc.stats.cpu : null, memory: s.proc && s.proc.stats ? s.proc.stats.memory : null, startedAt: s.proc ? s.proc.startedAt : null, extra: (s.proc && s.proc.extra) || {} }));
    return [
      ...pick('web', o.web, (s) => (s.port ? `http://localhost:${s.port}` : null)),
      ...pick('db', o.db), ...pick('minecraft', o.minecraft), ...pick('app', o.apps), ...pick('mail', o.mail ? [].concat(o.mail) : []),
    ];
  }
  const KIND_BASE = { web: '/web', db: '/dbs', minecraft: '/mc/servers', app: '/apps', mail: '/mail' };
  const service = (kind, id) => {
    const base = `${KIND_BASE[kind] || '/' + kind}/${encodeURIComponent(id)}`;
    return { start: () => call('POST', `${base}/start`), stop: () => call('POST', `${base}/stop`), restart: () => call('POST', `${base}/restart`) };
  };

  const api = {
    sdk: VERSION,
    /** Resolves once Hostwerk has sent theme, language and settings. */
    ready: () => ready,
    info: () => ({ lang: state.lang, theme: state.theme, ext: state.ext, app: state.app, settings: state.settings, embed: state.embed }),
    get lang() { return state.lang; },
    get theme() { return state.theme; },
    get embed() { return state.embed; },
    t, esc, html, render, raw: (s) => new Raw(String(s)), fmt,
    /** Read (GET) – only areas covered by the extension's read permissions. */
    get: (path) => call('GET', path),
    /** Change (POST) – needs a control/command permission and the user's confirmation. */
    post: (path, body) => call('POST', path, body),
    services, service,
    minecraft: {
      servers: async () => (await services()).filter((s) => s.kind === 'minecraft'),
      players: (id) => call('GET', `/mc/servers/${encodeURIComponent(id)}/players`),
      stats: (id) => call('GET', `/mc/servers/${encodeURIComponent(id)}/stats`),
      command: (id, command) => call('POST', `/mc/servers/${encodeURIComponent(id)}/command`, { command }),
    },
    /** Small key/value store per extension (kept by Hostwerk, max. 256 KB). Needs the "storage" permission. */
    storage: {
      get: (key) => call('STORAGE_GET', '', { key }),
      set: (key, value) => call('STORAGE_SET', '', { key, value }),
      remove: (key) => call('STORAGE_SET', '', { key, value: undefined, remove: true }),
      all: () => call('STORAGE_GET', '', {}),
    },
    /** Values of the settings declared in manifest.settings (the form is drawn by Hostwerk). */
    settings: { get: () => Promise.resolve(state.settings), open: () => call('OPEN_SETTINGS') },
    /** Events: 'service' (state change), 'minecraft' (players), 'theme', 'lang', 'settings'. Returns an unsubscribe function. */
    on(type, cb) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(cb);
      if (!['theme', 'lang', 'settings'].includes(type)) send({ method: 'SUBSCRIBE', body: { event: type } });
      return () => listeners.get(type).delete(cb);
    },
    toast: (text, opts = {}) => call('TOAST', '', { text: String(text), kind: opts.kind || 'info' }),
    /** Open a Hostwerk area, e.g. Hostwerk.navigate('/mc/my-server'). */
    navigate: (route) => call('NAVIGATE', '', { route: String(route) }),
    /** Open a web page in the browser (Hostwerk asks first). */
    openUrl: (url) => call('OPEN_URL', '', { url: String(url) }),
  };
  window.Hostwerk = api;

  // Tiles grow with their content
  const report = () => send({ method: 'RESIZE', body: { height: Math.ceil(document.documentElement.scrollHeight) } });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(report).observe(document.documentElement);
  addEventListener('load', report);
  // Ask for theme/language/settings (Hostwerk also sends them on its own when the frame loads)
  send({ method: 'HELLO', body: { sdk: VERSION } });
})();
