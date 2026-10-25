/*!
 * Hostwerk Extension SDK 2 – runs inside an extension page or dashboard tile.
 * Served by Hostwerk at /ext-sdk.js. Docs: https://github.com/Passimoritz/hostwerk-public/tree/main/sdk
 *
 * The page runs in a sandbox (own opaque origin, no access to Hostwerk's login). Everything goes through
 * postMessage to Hostwerk, which checks the extension's permissions and asks the user before anything changes.
 * The SDK also loads the Hostwerk design kit (/ext-sdk.css) and keeps colours, light/dark mode and language in sync.
 * Since 2.2 the kit is generated from Hostwerk's own stylesheet: use the same classes as Hostwerk (card, card-head,
 * btn primary, tabs/tab, seg, callout, setting-row, switch, badge, list-item, empty, grid-2 …) and the page looks
 * exactly like a built-in area. Hostwerk draws the page header and the tabs (manifest page.tabs) itself.
 *
 * Loading (SDK 3.2): until the page reports "loaded", Hostwerk shows its own loading animation over the frame. The SDK
 * reports it by itself after the first Hostwerk.render() or once the page shows content; pages that load longer can hold
 * it (<meta name="hostwerk-loading" content="manual"> or Hostwerk.holdLoaded()) and call Hostwerk.loaded() themselves.
 * Hostwerk.ui.loading()/.error()/.load() draw the same states for content that loads later inside the page.
 */
(() => {
  'use strict';
  if (window.Hostwerk && window.Hostwerk.sdk) return;
  const VERSION = '3.7.0';
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  let messages = {};
  const state = { lang: document.documentElement.lang || 'en', theme: 'dark', ext: null, app: null, settings: {}, embed: 'page', tab: null, context: null, action: null };

  // Design kit first, so the page never flashes unstyled
  if (!document.querySelector('link[data-hostwerk-kit]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/ext-sdk.css'; l.setAttribute('data-hostwerk-kit', '');
    (document.head || document.documentElement).prepend(l);
  }

  const emit = (type, payload) => { for (const cb of listeners.get(type) || []) { try { cb(payload); } catch (e) { console.error(e); } } };
  /*
   * Verbindung zu Hostwerk (SDK 3.2): Die Brücke hört evtl. noch nicht zu, wenn dieses Skript läuft (Rahmen schneller
   * als Hostwerks Oberfläche). Deshalb: HELLO wiederholen, bis „init“ kommt; alles andere bis dahin puffern und danach
   * in Reihenfolge senden. DOC kennzeichnet genau dieses Laden des Rahmens – Hostwerk ordnet Antworten danach zu.
   */
  const DOC = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let inited = false;
  const outbox = [];
  const post = (msg) => parent.postMessage({ hostwerkExt: true, v: 2, doc: DOC, ...msg }, '*');
  const send = (msg) => {
    if (inited || msg.method === 'HELLO') return post(msg);
    // Größe: nur die letzte zählt
    if (msg.method === 'RESIZE') for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i].method === 'RESIZE') outbox.splice(i, 1);
    outbox.push(msg);
    return undefined;
  };
  const HELLO_GAPS = [150, 250, 500, 900, 1500]; // danach alle 3 s, insgesamt höchstens 25 Versuche (gut 60 s)
  let helloN = 0;
  let helloTimer = null;
  const hello = () => {
    if (inited) return;
    post({ method: 'HELLO', body: { sdk: VERSION } });
    const gap = HELLO_GAPS[helloN] || 3000;
    helloN++;
    if (helloN < 25) helloTimer = setTimeout(hello, gap);
  };
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
    // Hostwerks „Animationen reduzieren“ (SDK 3.6): die hw-*-Animationen ruhen dann auch hier
    if (t.reduceMotion) root.dataset.motion = 'reduce'; else delete root.dataset.motion;
    // Same variables as Hostwerk (for the generated kit) and the older --hw-* names (SDK 2.0/2.1 pages)
    for (const [k, v] of Object.entries(t.vars || {})) if (/^--[\w-]+$/.test(k)) { root.style.setProperty(k, String(v)); root.style.setProperty(`--hw-${k.slice(2)}`, String(v)); }
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
    // code: z. B. „EXT_PERMISSION“ (fehlendes Recht) – unterscheidet das von „gibt es nicht“ (SDK 3.5)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); return m.error ? p.reject(Object.assign(new Error(m.error), m.code ? { code: m.code } : {})) : p.resolve(m.data); }
    if (m.type === 'init') {
      // Kommt bei wiederholtem HELLO evtl. zweimal – dann nur neu anwenden
      const first = !inited;
      inited = true; clearTimeout(helloTimer);
      Object.assign(state, { ext: m.ext, app: m.app, settings: m.settings || {}, embed: m.embed || 'page', tab: m.tab || null, context: m.context || null, action: m.action || null });
      applyTheme(m.theme); applyLang(m.lang, m.messages);
      document.documentElement.dataset.embed = state.embed;
      if (state.tab) document.documentElement.dataset.tab = state.tab;
      if (first) {
        for (const x of outbox.splice(0)) post(x);
        readyResolve(api.info());
        if (document.readyState === 'loading') addEventListener('DOMContentLoaded', autoLoaded, { once: true }); else autoLoaded();
        if (loadedWanted) loaded();
      }
    } else if (m.type === 'theme') { applyTheme(m.theme); emit('theme', state.theme); }
    else if (m.type === 'lang') { applyLang(m.lang, m.messages); emit('lang', state.lang); }
    else if (m.type === 'settings') { state.settings = m.settings || {}; emit('settings', state.settings); }
    else if (m.type === 'event') emit(m.event, m.data);
    else if (m.type === 'tab') { state.tab = m.tab || null; document.documentElement.dataset.tab = state.tab || ''; emit('tab', state.tab); }
    else if (m.type === 'action') { state.action = m.action || null; emit('action', state.action); }
  });

  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });

  /*
   * „Geladen“ melden (SDK 3.2): Hostwerk zeigt bis dahin seine Ladeanimation über dem Rahmen. Von selbst nach dem ersten
   * Hostwerk.render() oder sobald die Seite Inhalt zeigt und kurz Ruhe ist (spätestens 8 s nach init – bis dahin sichtbar leer: lieber Hostwerks Animation). Mit
   * <meta name="hostwerk-loading" content="manual"> bzw. Hostwerk.holdLoaded() nur per Hostwerk.loaded().
   */
  let loadedSent = false;
  let loadedWanted = false;
  let holding = false;
  const manual = () => holding || !!document.querySelector('meta[name="hostwerk-loading"][content="manual"]');
  const later = (fn) => { let done = false; const go = () => { if (!done) { done = true; fn(); } }; if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 120); };
  function loaded() {
    if (loadedSent) return;
    if (!inited) { loadedWanted = true; return; }
    loadedSent = true;
    later(() => post({ method: 'LOADED' })); // erst nach dem Zeichnen – sonst blitzt die leere Seite kurz auf
  }
  const autoSignal = () => { if (!manual()) loaded(); };
  function autoLoaded() {
    if (loadedSent) return;
    const body = document.body;
    const hasContent = () => !!body && ((body.innerText || '').trim().length > 0 || !!body.querySelector('img, svg, canvas, video, input, select, textarea, .hw-skeleton, .skeleton'));
    let quiet = null;
    let mo = null;
    let cap = null;
    const finish = () => { clearTimeout(quiet); clearTimeout(cap); if (mo) mo.disconnect(); autoSignal(); };
    const arm = () => { clearTimeout(quiet); quiet = setTimeout(() => { if (hasContent()) finish(); }, 250); };
    cap = setTimeout(finish, 8000);
    if (body && typeof MutationObserver !== 'undefined') { mo = new MutationObserver(arm); mo.observe(body, { childList: true, subtree: true, characterData: true }); }
    arm();
  }

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
    // erster echter, SICHTBARER Inhalt → Hostwerk blendet die Ladeanimation aus (nicht: Vorbereiten versteckter Reiter)
    if (!quietRender && inited && visible(node)) autoSignal();
  }
  const visible = (n) => !(n.closest && n.closest('[hidden]')) && !(typeof n.getClientRects === 'function' && n.getClientRects().length === 0);
  let quietRender = false;
  const renderQuiet = (el, content) => { quietRender = true; try { render(el, content); } finally { quietRender = false; } };

  /*
   * Lade-, Fehler- und Platzhalter-Bausteine wie in Hostwerk (SDK 3.2) – für Inhalte, die innerhalb der Seite nachladen.
   * Texte eingebaut (de/en); eigene Texte über die Schlüssel hw.loading, hw.loadError, hw.retry in locales/*.json.
   */
  const UI_TEXT = {
    de: { loading: 'Lädt …', loadError: 'Konnte nicht geladen werden', retry: 'Erneut versuchen' },
    en: { loading: 'Loading …', loadError: 'Could not load', retry: 'Try again' },
  };
  const uiText = (k) => (messages[`hw.${k}`] != null ? String(messages[`hw.${k}`]) : UI_TEXT[state.lang === 'de' ? 'de' : 'en'][k]);
  const nodeOf = (el) => (typeof el === 'string' ? document.querySelector(el) : el);
  const ui = {
    /** Platzhalter-Zeilen (Baustein für Hostwerk.html): rows Zeilen, height je Zeile in px. */
    skeleton(rows = 3, { height = 16 } = {}) {
      const n = Math.max(1, Math.min(Number(rows) || 3, 20));
      const h = Math.max(8, Math.min(Number(height) || 16, 200));
      return new Raw(`<div class="hw-load-skel" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div class="hw-skeleton" style="height:${h}px;width:${100 - (i % 3) * 12}%"></div>`).join('')}</div>`);
    },
    /** Ladezustand in target: Platzhalter + Ansage für Screenreader (aria-busy, role=status). */
    loading(target, { text, rows = 3, height } = {}) {
      const node = nodeOf(target);
      if (!node) return;
      node.setAttribute('aria-busy', 'true');
      renderQuiet(node, html`<div class="hw-load-box" role="status"><span class="hw-sr">${text || uiText('loading')}</span>${ui.skeleton(rows, { height })}</div>`);
    },
    /** Fehlerzustand mit „Erneut versuchen“ (retry = Funktion) statt leerer Fläche. compact = für Kacheln. */
    error(target, err, retry, { compact = false, title } = {}) {
      const node = nodeOf(target);
      if (!node) return;
      node.removeAttribute('aria-busy');
      const msg = String((err && err.message) || err || '');
      const btn = typeof retry === 'function' ? html`<button type="button" class="btn ${compact ? 'xs' : 'primary'}" data-hw-retry>${uiText('retry')}</button>` : '';
      render(node, compact
        ? html`<div class="hw-load-alert hw-compact small" role="alert"><span class="hw-err-text">${title || uiText('loadError')}</span> ${btn}</div>`
        : html`<div class="hw-load-alert" role="alert"><b>${title || uiText('loadError')}</b>${msg ? html`<p class="muted small">${msg}</p>` : ''}${btn}</div>`);
      const b = node.querySelector('[data-hw-retry]');
      if (b) b.addEventListener('click', () => { b.disabled = true; Promise.resolve().then(retry).catch(() => {}); });
    },
    /** Ablauf in einem: loading → fn() (zeichnet selbst) bzw. error mit „Erneut versuchen“. Gibt das Ergebnis von fn zurück. */
    async load(target, fn, opts = {}) {
      ui.loading(target, opts);
      try { const r = await fn(); const node = nodeOf(target); if (node) node.removeAttribute('aria-busy'); return r; } catch (e) { ui.error(target, e, () => ui.load(target, fn, opts), opts); return undefined; }
    },

    /*
     * Animationen wie in Hostwerk (SDK 3.6) – Bausteine für Hostwerk.html bzw. render(); die Klassen (hw-rise, hw-pulse …)
     * stehen auch direkt zur Verfügung (/ext-sdk.css). Alles ruht bei „Bewegung reduzieren“ (System oder Hostwerk).
     */
    /** Hostwerks Lade-Animation (Herzschlag-Linie) mit Text – für größere Bereiche statt Platzhalter-Zeilen. */
    loader({ text } = {}) {
      const d = 'M2 20 H34 L46 20 L56 4 L66 36 L76 20 H118';
      const gid = `hwLoadGrad${++loaderSeq}`;
      return html`<div class="hw-loading-inline" role="status"><div class="hw-loading"><svg viewBox="0 0 120 40" aria-hidden="true">${new Raw(`<defs><linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="var(--accent)" stop-opacity=".15"/><stop offset=".5" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-2, var(--accent))" stop-opacity=".15"/></linearGradient></defs><path class="hw-load-base" d="${d}"/><path class="hw-load-line" d="${d}" style="stroke:url(#${gid})"/><circle class="hw-load-dot" r="3.2"><animateMotion dur="1.6s" repeatCount="indefinite" path="${d}"/></circle>`)}</svg><span class="small muted hw-load-text">${text || uiText('loading')}</span></div></div>`;
    },
    /** Kreisel: size 'sm' | 'md' | 'lg'. */
    spinner(size = 'md') { return new Raw(`<span class="hw-spinner${size === 'sm' ? ' hw-sm' : size === 'lg' ? ' hw-lg' : ''}" role="status" aria-label="${escAttr(uiText('loading'))}"></span>`); },
    /** Drei hüpfende Punkte („tippt“, „denkt nach“). */
    dots() { return new Raw(`<span class="hw-dots" role="status" aria-label="${escAttr(uiText('loading'))}"><i></i><i></i><i></i></span>`); },
    /** Gezeichneter Haken für „erledigt“; size 'md' | 'lg'. */
    check(size = 'md') { return new Raw(`<svg class="hw-check hw-pop${size === 'lg' ? ' hw-lg' : ''}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>`); },
    /** Leerer Zustand wie in Hostwerk: Symbol, Satz, Aktion (icon = SVG-Markup über Hostwerk.raw, sonst eine Ablage),
     *  action = Knopf o. Ä. (Hostwerk.html) darunter. */
    empty({ title, text, icon, action } = {}) {
      const ico = icon || new Raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>');
      return html`<div class="empty-state"><div class="empty-art" aria-hidden="true">${new Raw('<svg viewBox="0 0 120 120"><circle class="o1" cx="60" cy="60" r="44"/><circle class="o2" cx="60" cy="60" r="56"/><g class="p1"><circle cx="60" cy="16" r="3.2"/></g><g class="p2"><circle cx="116" cy="60" r="2.4"/></g></svg>')}<div class="ico">${ico}</div></div>${title ? html`<h3>${title}</h3>` : ''}${text ? html`<p>${text}</p>` : ''}${action ? html`<div class="empty-action">${action}</div>` : ''}</div>`;
    },
    /** Element (oder Selektor) animieren: 'rise' | 'fade' | 'pop' | 'slide' | 'stagger' (Kinder nacheinander) | 'shake' | 'flash'. Spielt auch erneut ab. */
    animate(target, kind = 'rise') {
      const node = nodeOf(target);
      if (!node || !/^(rise|fade|pop|slide|stagger|shake|flash)$/.test(kind)) return node;
      const cls = `hw-${kind}`;
      node.classList.remove(cls);
      void node.offsetWidth; // neu starten
      node.classList.add(cls);
      if (kind === 'shake' || kind === 'flash') node.addEventListener('animationend', () => node.classList.remove(cls), { once: true });
      return node;
    },
    /** Zahl hochzählen (z. B. Kachelwerte): vom zuletzt gezeigten Wert bis to; format(n) für die Anzeige (Standard: fmt.number). */
    countUp(target, to, { duration = 700, format } = {}) {
      const node = nodeOf(target);
      if (!node) return;
      const show = typeof format === 'function' ? format : (n) => fmt.number(Math.round(n));
      const end = Number(to) || 0;
      const from = Number(node.dataset.hwCount || 0) || 0;
      node.dataset.hwCount = String(end);
      if (!motionOk() || from === end) { node.textContent = show(end); return; }
      const t0 = performance.now();
      const step = (t) => { const p = Math.min(1, (t - t0) / duration); node.textContent = show(from + (end - from) * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    },
    /** Ist Bewegung erwünscht? false bei „Bewegung reduzieren“ im System oder in Hostwerk. */
    motionOk: () => motionOk(),
  };
  let loaderSeq = 0;
  function motionOk() {
    if (document.documentElement.dataset.motion === 'reduce') return false;
    try { return !matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
  }
  function escAttr(s) { return String(s).replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c])); }

  const fmt = {
    bytes(n) { if (n == null || isNaN(n)) return '–'; const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let x = Number(n); while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; } return `${x.toFixed(x >= 10 || i === 0 ? 0 : 1)} ${u[i]}`; },
    duration(ms) { const s = Math.floor(Number(ms || 0) / 1000); const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); const de = state.lang === 'de'; if (d) return de ? `${d} T ${h} Std` : `${d}d ${h}h`; if (h) return de ? `${h} Std ${m} Min` : `${h}h ${m}m`; return de ? `${m} Min` : `${m}m`; },
    number(n) { return new Intl.NumberFormat(state.lang === 'de' ? 'de-DE' : 'en-US').format(Number(n || 0)); },
    time(ts) { return new Date(ts).toLocaleTimeString(state.lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' }); },
  };

  /**
   * Flat list of all services from /overview: { id, kind, name, state, port, url, cpu, memory, startedAt, extra }.
   * kind: web · db · minecraft · app · docker (Docker app, since 2.10) · game (game server, since 2.10) · mail – and since 3.5 every
   * service kind of an extension (overview.kinds, name as the SDK always used it: kind.sdk.kind).
   * Same logic as server/extensions/sdk/services.js (host.services.list() for native extensions).
   */
  async function services() {
    const o = await call('GET', '/overview');
    const pick = (kind, xs, url) => (xs || []).map((s) => ({ id: s.id, kind: typeof kind === 'function' ? kind(s) : kind, name: s.name, state: (s.proc && s.proc.state) || 'stopped', port: s.port || null, url: url ? url(s) : null, cpu: s.proc && s.proc.stats ? s.proc.stats.cpu : null, memory: s.proc && s.proc.stats ? s.proc.stats.memory : null, startedAt: s.proc ? s.proc.startedAt : null, extra: (s.proc && s.proc.extra) || {} }));
    const kindItems = Object.values(o.kinds || {}).flatMap((k) => { const name = (k.sdk && k.sdk.kind) || k.kind; kindBases[name] = (k.sdk && k.sdk.base) || k.api || kindBases[name]; return pick(name, k.items); });
    return [
      ...pick('web', o.web, (s) => (s.port ? `http://localhost:${s.port}` : null)),
      ...pick('db', o.db),
      ...pick((s) => (s.kind === 'docker' ? 'docker' : 'app'), o.apps, (s) => s.url || null),
      ...pick('mail', o.mail ? [].concat(o.mail) : []),
      ...kindItems,
    ];
  }
  const KIND_BASE = { web: '/web', db: '/dbs', app: '/apps', docker: '/apps', mail: '/mail' };
  // Arten aus Erweiterungen: Pfad aus overview.kinds (services() merkt ihn sich); bis dahin die bekannten Namen von früher
  const kindBases = { minecraft: '/mc/servers', game: '/games' };
  const service = (kind, id) => {
    // Der Mail-Fänger ist ein einzelner Dienst ohne ID und ohne eigenes „restart“
    if (kind === 'mail') return { start: () => call('POST', '/mail/start'), stop: () => call('POST', '/mail/stop'), restart: async () => { await call('POST', '/mail/stop'); return call('POST', '/mail/start'); } };
    const base = `${KIND_BASE[kind] || kindBases[kind] || '/' + kind}/${encodeURIComponent(id)}`;
    return { start: () => call('POST', `${base}/start`), stop: () => call('POST', `${base}/stop`), restart: () => call('POST', `${base}/restart`) };
  };

  const api = {
    sdk: VERSION,
    /** Resolves once Hostwerk has sent theme, language and settings. */
    ready: () => ready,
    /** The page shows its content – Hostwerk hides its loading animation. Usually automatic; see holdLoaded(). Since SDK 3.2. */
    loaded,
    /** Keep Hostwerk's loading animation until Hostwerk.loaded() (call it right away in the page script). Since SDK 3.2. */
    holdLoaded: () => { holding = true; },
    /** Loading, error and placeholder states like Hostwerk: ui.loading(el), ui.error(el, err, retry), ui.load(el, fn), ui.skeleton(rows) (SDK 3.2).
     *  Animations like Hostwerk (SDK 3.6): ui.loader(), ui.spinner(), ui.dots(), ui.check(), ui.empty(), ui.animate(el, kind), ui.countUp(el, n), ui.motionOk(). */
    ui,
    /** Stand der Seite. app: { version, origin, publicView } – origin = Hostwerks Adresse, publicView = volle Adresse der
     *  öffentlichen Ansicht /v/<id>/ (null ohne). origin/publicView seit SDK 3.1. */
    info: () => ({ lang: state.lang, theme: state.theme, ext: state.ext, app: state.app, settings: state.settings, embed: state.embed, tab: state.tab, context: state.context, action: state.action }),
    get lang() { return state.lang; },
    get theme() { return state.theme; },
    get embed() { return state.embed; },
    /** Active tab (manifest page.tabs – Hostwerk draws the tab bar). Since SDK 2.2. */
    get tab() { return state.tab; },
    /** Switch the tab from inside the page. Since SDK 2.2. */
    setTab: (id) => call('SET_TAB', '', { tab: String(id) }),
    /** Where a contributed tab is shown: { kind: 'minecraft' | 'web' | 'db' | 'app' | 'game' | 'project', id }. Since SDK 2.2 ('project' since 2.10). */
    get context() { return state.context; },
    t, esc, html, render, raw: (s) => new Raw(String(s)), fmt,
    /** Read (GET) – only areas covered by the extension's read permissions. */
    get: (path) => call('GET', path),
    /** Change (POST) – needs a control/command/change permission and the user's confirmation. */
    post: (path, body) => call('POST', path, body),
    /** Change settings (PUT), e.g. server.properties – needs a change:… permission and the user's confirmation. Since SDK 2.2. */
    put: (path, body) => call('PUT', path, body),
    /** Delete (DELETE) – like post/put. Since SDK 2.3. */
    del: (path) => call('DELETE', path),
    /**
     * Talk to the extension's own server module (manifest "backend", runs sandboxed): Hostwerk.backend('GET', '/items').
     * Routes are the ones the module registers on host.router. No extra permission needed. Since SDK 2.8.
     */
    backend: (method, path = '/', body) => call('BACKEND', '', { method: String(method || 'GET').toUpperCase(), path: String(path), body }),
    /** Let the user choose a folder (native dialog in the desktop app). Resolves to the path or null. Since SDK 2.3. */
    /**
     * Command into the Hostwerk terminal (permission run:terminal). enter: false (default) only types it – the user
     * presses Enter; enter: true asks the user first. Since SDK 2.5.
     */
    terminal: (command, opts = {}) => call('TERMINAL', '', { command: String(command), cwd: opts.cwd ? String(opts.cwd) : '', title: opts.title ? String(opts.title) : '', enter: !!opts.enter, shell: opts.shell ? String(opts.shell) : '' }),
    pickFolder: (title) => call('PICK_FOLDER', '', { title: title ? String(title) : '' }),
    services, service,
    minecraft: {
      // Erst die Minecraft-Liste („read:minecraft“), nur ohne dieses Recht die Gesamtübersicht („read:services“) – sonst
      // meldet Hostwerk bei Erweiterungen mit „read:minecraft“ allein einen abgelehnten Zugriff. Ohne Minecraft-Erweiterung
      // gibt es die Liste nicht: dann keine Server. Gleiche Felder wie services().
      servers: async () => {
        let list;
        try { list = await call('GET', '/mc/servers'); } catch (e) {
          if (e.code === 'EXT_PERMISSION') return (await services()).filter((s) => s.kind === 'minecraft');
          return [];
        }
        return (list || []).map((s) => { const p = s.proc || {}; return { id: s.id, kind: 'minecraft', name: s.name, state: p.state || 'stopped', port: s.port || null, url: null, cpu: p.stats ? p.stats.cpu : null, memory: p.stats ? p.stats.memory : null, startedAt: p.startedAt || null, extra: { ...(p.extra || {}), version: s.version, type: s.type } }; });
      },
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
    /** Events: 'service' (state change), 'minecraft' (players), 'backend' (host.emit from the own server module, SDK 2.8), 'ai' (AI ready or off, SDK 3.7), 'theme', 'lang', 'settings', 'tab', 'action'. Returns an unsubscribe function. */
    on(type, cb) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(cb);
      if (!['theme', 'lang', 'settings', 'tab', 'action'].includes(type)) send({ method: 'SUBSCRIBE', body: { event: type } });
      return () => listeners.get(type).delete(cb);
    },
    toast: (text, opts = {}) => call('TOAST', '', { text: String(text), kind: opts.kind || 'info' }),
    /**
     * Hostwerk's "Ask AI" window (since SDK 3.7) – the same one the Explain buttons in Hostwerk open. Needs the "use:ai" permission.
     * Hostwerk.ai.ready() → true/false (AI on and ready). Hostwerk.on('ai', ({ ready }) => …) tells you when that changes –
     * show your AI button only while ready is true.
     * Hostwerk.ai.explain(text, { task: 'explain' | 'summarize' | 'describe' | 'translate', context, label }) opens the window:
     * Hostwerk shows the text, the AI's short answer, Copy and "Continue in the AI chat". Text at most 6000 characters.
     */
    ai: {
      ready: () => call('AI_READY'),
      explain: (text, opts = {}) => call('AI_EXPLAIN', '', { text: String(text == null ? '' : text), task: opts.task || 'explain', context: opts.context ? String(opts.context) : '', label: opts.label ? String(opts.label) : '' }),
    },
    /** Open a Hostwerk area, e.g. Hostwerk.navigate('/mc/my-server'). */
    navigate: (route) => call('NAVIGATE', '', { route: String(route) }),
    /** Open a web page in the browser (Hostwerk asks first). */
    openUrl: (url) => call('OPEN_URL', '', { url: String(url) }),
    /** Copy text to the clipboard (through Hostwerk – the sandboxed frame cannot do it itself). Since SDK 2.1. */
    copy: (text) => call('COPY', '', { text: String(text) }),
    /**
     * Save text as a file (CSV, Markdown, JSON …) through Hostwerk – the sandboxed frame cannot download itself. Since SDK 3.2.
     * Hostwerk.saveFile('players.csv', csv, 'text/csv') → { name }. Text only, at most 5 MB, no executable extensions.
     */
    saveFile: (name, text, type) => call('SAVE_FILE', '', { name: String(name || ''), text: String(text == null ? '' : text), type: type ? String(type) : 'text/plain' }),
  };
  window.Hostwerk = api;

  // Tiles grow with their content
  const report = () => send({ method: 'RESIZE', body: { height: Math.ceil(document.documentElement.scrollHeight) } });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(report).observe(document.documentElement);
  addEventListener('load', report);
  // Ask for theme/language/settings – repeated until Hostwerk answers (Hostwerk also sends them on its own when the frame loads)
  hello();
})();
