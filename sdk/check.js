#!/usr/bin/env node
'use strict';
/*
 * Hostwerk extension checker – one set of rules for Hostwerk (install), the public catalog (GitHub Action)
 * and extension authors (CI of their own repository).
 *
 *   node check.js <folder>            human-readable report, exit 1 on errors
 *   node check.js <folder> --strict   catalog rules: warnings about design/translation count as errors
 *   node check.js <folder> --json     machine-readable result
 *
 * Checks: manifest (fields, version, permissions), files, security (no remote scripts, no eval, unsafe HTML),
 * design (SDK + design kit used, no hard-coded colours/fonts, no overlays) and translations (German + English).
 * No dependencies – runs with plain Node.js 18+.
 */
const fs = require('fs');
const path = require('path');

const SDK_VERSION = '2.7.0';
/** Categories of the extension page (SDK 2.7) – one per extension, shown as filter chips. */
const CATEGORIES = {
  games: { de: 'Spiele & Minecraft', en: 'Games & Minecraft' },
  network: { de: 'Netzwerk & Rechner', en: 'Network & machines' },
  security: { de: 'Sicherheit & Zugänge', en: 'Security & access' },
  monitoring: { de: 'Überwachung & Status', en: 'Monitoring & status' },
  developer: { de: 'Entwickeln', en: 'Developer tools' },
  ai: { de: 'KI & Medien', en: 'AI & media' },
  communication: { de: 'E-Mail & Kommunikation', en: 'Mail & communication' },
  other: { de: 'Sonstiges', en: 'Other' },
};
/** Version range of a dependency: ">=1.2.0", "^1.2.0", "1.2.0" or "*". */
const RANGE_RE = /^(\*|(>=|\^|~)?\s*\d+\.\d+\.\d+)$/;
const cmpVer = (a, b) => { const x = String(a).split(/[.-]/).map(Number), y = String(b).split(/[.-]/).map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
/** Does VERSION satisfy RANGE? >=: at least · ^: same major, at least · ~: same minor, at least · plain: exactly. */
function satisfies(version, range) {
  const r = String(range || '*').trim();
  if (r === '*' || !r) return true;
  const m = r.match(/^(>=|\^|~)?\s*(\d+\.\d+\.\d+)$/);
  if (!m) return false;
  const [op, want] = [m[1] || '=', m[2]];
  const v = String(version || '0.0.0').split(/[.-]/).map(Number), w = want.split('.').map(Number);
  if (cmpVer(version, want) < 0) return false;
  if (op === '^') return v[0] === w[0];
  if (op === '~') return v[0] === w[0] && v[1] === w[1];
  if (op === '=') return cmpVer(version, want) === 0;
  return true;
}
/** Permission scopes and what they allow (GET = read, POST = change after confirmation). */
const PERMISSIONS = {
  'read:services': { de: 'Dienste und ihren Zustand sehen', en: 'See services and their state', read: [/^\/overview$/] },
  'read:web': { de: 'Webserver lesen', en: 'Read web servers', read: [/^\/web(\/[\w-]+)?$/] },
  'read:databases': { de: 'Datenbankserver lesen', en: 'Read database servers', read: [/^\/dbs(\/[\w-]+)?$/] },
  'read:minecraft': { de: 'Minecraft-Server, Spieler und Statistiken lesen', en: 'Read Minecraft servers, players and stats', read: [/^\/mc\/servers(\/[\w-]+(\/(players|stats|worlds))?)?$/] },
  'read:apps': { de: 'Apps lesen', en: 'Read apps', read: [/^\/apps$/] },
  'read:tasks': { de: 'Aufgaben lesen', en: 'Read scheduled tasks', read: [/^\/tasks$/] },
  'read:mail': { de: 'Abgefangene E-Mails lesen', en: 'Read captured e-mails', read: [/^\/mail(\/messages)?$/] },
  'read:system': { de: 'Systemzustand, Auslastung, Ports und Speicher je Dienst lesen', en: 'Read system health, load, ports and storage per service', read: [/^\/system\/(health|resources|ports|disk-usage)$/] },
  // Seit SDK 2.4: Livebetrieb – Zertifikate (mit Restlaufzeit) und Erreichbarkeit, ohne Alarm-Ziele, Schlüssel oder Zugänge
  'read:live': { de: 'Zertifikate und Erreichbarkeit (Überwachung) lesen', en: 'Read certificates and uptime checks', read: [/^\/live\/(certs|uptime)$/] },
  'read:network': { de: 'Router, Rechner und Sicherheitslage lesen', en: 'Read router, machines and security status', read: [/^\/(router|machines|live\/security)$/] },
  'control:services': { de: 'Dienste starten, stoppen, neu starten (mit Rückfrage)', en: 'Start, stop, restart services (asks first)', write: [/^\/(web|dbs|apps|mail|mc\/servers)\/[\w-]+\/(start|stop|restart)$/, /^\/mail\/(start|stop)$/] },
  'command:minecraft': { de: 'Befehle an Minecraft-Server senden (mit Rückfrage)', en: 'Send commands to Minecraft servers (asks first)', write: [/^\/mc\/servers\/[\w-]+\/command$/] },
  'run:tasks': { de: 'Aufgaben ausführen (mit Rückfrage)', en: 'Run scheduled tasks (asks first)', write: [/^\/tasks\/[\w-]+\/run$/] },
  // Seit SDK 2.2: Hostwerk-Funktionen ändern – jede Änderung bestätigt der Nutzer einzeln
  'change:minecraft': { de: 'Minecraft-Einstellungen ändern: server.properties, Spielregeln, Symbol, Plugins an/aus, Sicherung anlegen (mit Rückfrage)', en: 'Change Minecraft settings: server.properties, game rules, icon, plugins on/off, create backups (asks first)', write: [/^\/mc\/servers\/[\w-]+\/(properties|gamerules|icon|backups|plugins\/toggle)$/] },
  'change:databases': { de: 'Datenbank-Sicherungen anlegen (mit Rückfrage)', en: 'Create database backups (asks first)', write: [/^\/dbs\/[\w-]+\/backups$/] },
  'change:mail': { de: 'Test-Mails in den Mail-Fänger schicken, Mails als gelesen markieren (mit Rückfrage)', en: 'Send test mails to the mail catcher, mark mails as read (asks first)', write: [/^\/mail\/(compose|read-all)$/] },
  // Seit SDK 2.3: Wissensgraph (Motor in Hostwerk, Oberfläche als Erweiterung). quiet = ohne Rückfrage je Aufruf (nur Daten
  // des Wissensgraphen selbst); alles, was Dateien in Projekten oder Claudes Anbindung ändert, fragt immer.
  'read:knowledge': { de: 'Wissensgraph lesen: Projekte, Graph, Bericht, Fragenverlauf, Gedächtnis, Claude-Status', en: 'Read the knowledge graph: projects, graph, report, question history, memory, Claude status', read: [/^\/knowledge$/, /^\/knowledge\/[\w.-]+\/(graph|report|questions|memory|claude)$/, /^\/claude\/(status|connect\/code)$/] },
  'change:knowledge': { de: 'Wissensgraph bauen und abfragen, Ordner aufnehmen, Gedächtnis pflegen, Obsidian-Export', en: 'Build and query the knowledge graph, add folders, edit memory, Obsidian export', quiet: true, write: [/^\/knowledge$/, /^\/knowledge\/folders(\/[\w.-]+)?$/, /^\/knowledge\/[\w.-]+\/(build|options|query|explain|path|memory(\/[\w-]+)?|obsidian\/(export|sync|notes|import))$/] },
  'connect:claude': { de: 'Claude einbinden und wieder vergessen (schreibt markierte Abschnitte in Projekte – mit Rückfrage)', en: 'Connect Claude and forget it again (writes marked sections into projects – asks first)', write: [/^\/knowledge\/[\w.-]+\/claude\/(connect|repair|forget)$/, /^\/knowledge\/forget-all$/, /^\/claude\/connect\/desktop$/] },
  // Seit SDK 2.5: Claude-Bereich als Erweiterung (Status, Anbindung, Spar-Werkzeuge, Projekte) und Terminal
  'read:claude': { de: 'KI-Anbindung lesen: Claude-Status, Projekte, Gedächtnis (auch was jede KI davon bekommt), Spar-Werkzeuge, Verbrauch', en: 'Read the AI connection: Claude status, projects, memory (incl. what each AI gets), token-saving tools, usage', read: [/^\/claude\/(status|connect\/code|tools|tools\/discover|tools\/usage|targets\/[\w.-]+)$/, /^\/mind(\/activity|\/context)?$/, /^\/projects(\/[\w-]+)?$/, /^\/ai\/memory-share$/] },
  'change:claude': { de: 'Claude einrichten: Kontext in Projekt-Dateien schreiben, Spar-Werkzeuge installieren/entfernen, Einstellungen (mit Rückfrage)', en: 'Set up Claude: write context into project files, install/remove token-saving tools, settings (asks first)', write: [/^\/claude\/write\/[\w.-]+$/, /^\/claude\/tools$/, /^\/claude\/tools\/[\w.-]+\/(install|update|remove)$/, /^\/claude\/connect\/desktop$/, /^\/ai\/memory-share(\/preview)?$/] },
  // Seit SDK 2.6: öffentliche Statusseite (nur Namen, Zustand, Verfügbarkeit – keine Adressen, Fehler oder Alarm-Ziele)
  'share:status': { de: 'Öffentliche Statusseite einrichten: an/aus, Titel, angezeigte Prüfungen, Link erneuern, in eine Website legen (mit Rückfrage)', en: 'Set up the public status page: on/off, title, shown checks, renew link, place it into a website (asks first)', read: [/^\/live\/statuspage$/], write: [/^\/live\/statuspage(\/(rotate|publish))?$/] },
  'run:terminal': { de: 'Befehle ins Hostwerk-Terminal tippen (du bestätigst mit Enter bzw. vorher im Dialog)', en: 'Type commands into the Hostwerk terminal (you confirm with Enter or in a dialog first)' },
  storage: { de: 'Eigene Daten speichern (max. 256 KB)', en: 'Store own data (max. 256 KB)' },
  network: { de: 'Mit den im Paket genannten Webadressen sprechen', en: 'Talk to the web addresses named in the package' },
  // Seit SDK 2.7: native Erweiterungen – eigener Server- und Oberflächen-Code in Hostwerk (Funktionen, die früher eingebaut waren).
  // Nur aus dem Hostwerk-Katalog (Prüfsumme) oder im Entwickler-Modus installierbar.
  native: { de: 'Läuft als Teil von Hostwerk (eigener Server- und Oberflächen-Code) – nur aus dem Hostwerk-Katalog', en: 'Runs as part of Hostwerk (own server and interface code) – only from the Hostwerk catalog' },
};
// Version 1 packages: "read" = all read scopes, "write" = all control scopes
const LEGACY = { read: Object.keys(PERMISSIONS).filter((k) => k.startsWith('read:')), write: ['control:services', 'command:minecraft', 'run:tasks'] };
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** Line icons for the sidebar (same style as Hostwerk's own areas) – ui/src/extIcons.js */
const SIDEBAR_ICONS = ['puzzle', 'users', 'monitor', 'gauge', 'activity', 'chart', 'bar-chart', 'bell', 'book', 'bot', 'box', 'calendar', 'camera', 'clock', 'cloud', 'code', 'coffee', 'cpu', 'database', 'download', 'file', 'flag', 'gamepad', 'gift', 'globe', 'heart', 'home', 'image', 'inbox', 'key', 'dashboard', 'grid', 'leaf', 'line-chart', 'list', 'lock', 'mail', 'map', 'message', 'music', 'network', 'news', 'package', 'pie-chart', 'radio', 'rocket', 'server', 'settings', 'shield', 'cart', 'sparkles', 'star', 'sun', 'swords', 'table', 'tag', 'terminal', 'timer', 'trophy', 'tv', 'wand', 'wifi', 'wrench', 'zap'];
/** Everything the SDK offers (window.Hostwerk) – calls to anything else fail at runtime. Kept in sync by scripts/ext-catalog-test.js. */
const SDK_MEMBERS = {
  sdk: null, ready: null, info: null, lang: null, theme: null, embed: null, t: null, esc: null, html: null, render: null, raw: null,
  fmt: ['bytes', 'duration', 'number', 'time'], get: null, post: null, put: null, del: null, pickFolder: null, services: null, service: null, tab: null, setTab: null, context: null,
  minecraft: ['servers', 'players', 'stats', 'command'], storage: ['get', 'set', 'remove', 'all'], settings: ['get', 'open'],
  on: null, toast: null, navigate: null, openUrl: null, copy: null, terminal: null,
};
const SEMVER = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const MAX_SIZE = 10 * 1048576;
const TEXT_EXT = /\.(html?|js|mjs|css|json|svg|md|txt)$/i;

/** Normalised permission list (legacy names expanded, unknown dropped). */
function scopes(list) {
  const out = new Set();
  for (const p of Array.isArray(list) ? list : []) {
    if (LEGACY[p]) LEGACY[p].forEach((x) => out.add(x));
    else if (PERMISSIONS[p]) out.add(p);
  }
  return [...out];
}
/** May an extension with these scopes call METHOD PATH? */
function allows(list, method, p) {
  const clean = String(p || '').split('?')[0];
  const key = method === 'GET' ? 'read' : 'write'; // POST, PUT und DELETE sind Änderungen
  return scopes(list).some((s) => (PERMISSIONS[s][key] || []).some((re) => re.test(clean)));
}
/** Änderung ohne Rückfrage je Aufruf? Nur wenn ausschließlich „quiet“-Rechte sie abdecken (z. B. Graph neu bauen). */
function quiet(list, method, p) {
  if (method === 'GET') return true;
  const clean = String(p || '').split('?')[0];
  const hits = scopes(list).filter((s) => (PERMISSIONS[s].write || []).some((re) => re.test(clean)));
  return hits.length > 0 && hits.every((s) => PERMISSIONS[s].quiet);
}
const text = (v, lang) => (v && typeof v === 'object' ? v[lang] || v.en || v.de || '' : String(v || ''));

function walk(dir, base = dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, base)); else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}

/**
 * Symbol prüfen – dieselbe Idee wie beim Plugin-Symbol in Minecraft-JARs: Format, Größe, quadratisch, sicher,
 * und auf hellem wie dunklem Hintergrund sichtbar (Marktplatz und Seitenleiste gibt es in beiden Designs).
 */
function checkIcon(file, rel, err, warn) {
  const ext = path.extname(file).toLowerCase();
  if (!['.svg', '.png', '.webp'].includes(ext)) { err('icon', `"icon" must be .svg, .png or .webp – got ${rel}.`); return; }
  const buf = fs.readFileSync(file);
  if (buf.length > 256 * 1024) warn('icon', `${rel} is ${Math.round(buf.length / 1024)} KB – keep icons under 256 KB.`);
  if (ext === '.png') {
    if (buf.readUInt32BE(0) !== 0x89504e47) { err('icon', `${rel} is not a PNG file.`); return; }
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== h) warn('icon', `${rel} is ${w}×${h} – icons should be square.`);
    if (w < 64) warn('icon', `${rel} is only ${w} px – use at least 128 px (or SVG).`);
    return;
  }
  if (ext !== '.svg') return;
  const svg = buf.toString('utf8');
  if (/<script|\son[a-z]+\s*=|javascript:/i.test(svg)) err('icon', `${rel} contains scripts or event handlers – not allowed in icons.`);
  if (/(?:xlink:)?href\s*=\s*["']\s*https?:/i.test(svg)) err('icon', `${rel} loads external files – embed everything in the SVG.`);
  const vb = (svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i) || []).slice(1).map(Number);
  if (vb.length === 2 && Math.abs(vb[0] - vb[1]) > Math.max(vb[0], vb[1]) * 0.05) warn('icon', `${rel} is not square (viewBox ${vb[0]}×${vb[1]}).`);
  // Animated icons (SDK 2.7): gentle motion is welcome, but it must stop for people who turned motion off
  if (/<animate|@keyframes/.test(svg) && !/prefers-reduced-motion/.test(svg)) warn('icon', `${rel} is animated – stop the motion under @media (prefers-reduced-motion: reduce).`);
  // Sichtbarkeit: Farben einsammeln; nur sehr dunkle bzw. nur sehr helle Farben ohne Hintergrundfläche fallen in einem Design weg
  const cols = [...svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}|white|black|currentColor)/gi)].map((x) => x[1].toLowerCase());
  if (!cols.length || cols.includes('currentcolor')) return; // currentColor passt sich an
  const lum = (c) => { if (c === 'white') return 1; if (c === 'black') return 0; let h = c.slice(1); if (h.length <= 4) h = h.split('').map((x) => x + x).join(''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ls = cols.map(lum);
  const hasBackdrop = /<(rect|circle)\b[^>]*(width\s*=\s*["'](100%|\d{2,})|r\s*=\s*["']\d{2,})/i.test(svg);
  if (!hasBackdrop && ls.every((l) => l < 0.04)) warn('icon', `${rel} only uses very dark colors – nearly invisible in the dark design. Add a light tile or use currentColor.`);
  if (!hasBackdrop && ls.every((l) => l > 0.85)) warn('icon', `${rel} only uses very light colors – nearly invisible in the light design. Add a colored tile or use currentColor.`);
}

/** Banner: wide picture on top of the detail view and the catalog card (about 16:5, readable in light and dark). */
function checkBanner(file, rel, err, warn) {
  const ext = path.extname(file).toLowerCase();
  if (!['.svg', '.png', '.webp', '.jpg', '.jpeg'].includes(ext)) { err('banner', `"banner" must be .svg, .png, .webp or .jpg – got ${rel}.`); return; }
  const buf = fs.readFileSync(file);
  if (buf.length > 1024 * 1024) warn('banner', `${rel} is ${Math.round(buf.length / 1024)} KB – keep banners under 1 MB.`);
  if (ext !== '.svg') return;
  const svg = buf.toString('utf8');
  if (/<script|\son[a-z]+\s*=|javascript:/i.test(svg)) err('banner', `${rel} contains scripts or event handlers – not allowed.`);
  if (/(?:xlink:)?href\s*=\s*["']\s*https?:/i.test(svg) || /@import|url\(\s*["']?https?:/i.test(svg)) err('banner', `${rel} loads external files – embed everything in the SVG.`);
  const vb = (svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i) || []).slice(1).map(Number);
  if (vb.length === 2 && (vb[0] / vb[1] < 2.4 || vb[0] / vb[1] > 4.2)) warn('banner', `${rel} is ${vb[0]}×${vb[1]} – banners should be wide (about 16:5, e.g. 1280×400).`);
  if (/<animate|@keyframes/.test(svg) && !/prefers-reduced-motion/.test(svg)) warn('banner', `${rel} is animated – stop the motion under @media (prefers-reduced-motion: reduce).`);
}

function checkPackage(dir, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const info = [];
  const err = (code, msg) => errors.push({ code, msg });
  const warn = (code, msg) => (strict ? errors : warnings).push({ code, msg });
  let m = null;
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) { err('manifest', 'manifest.json is missing.'); return { ok: false, errors, warnings, info, manifest: null, score: 0 }; }
  try { m = JSON.parse(fs.readFileSync(mf, 'utf8')); } catch (e) { err('manifest', `manifest.json is not valid JSON: ${e.message}`); return { ok: false, errors, warnings, info, manifest: null, score: 0 }; }

  // ---------- Manifest ----------
  if (!ID_RE.test(m.id || '')) err('id', '"id" is missing or invalid (a–z, 0–9 and -, 2–40 characters).');
  if (!m.name) err('name', '"name" is missing.');
  if (!SEMVER.test(m.version || '')) err('version', '"version" must look like 1.2.3.');
  if (!m.page && !m.widget && !m.command && !m.backend && !m.ui) err('entry', 'The extension needs a page ("page"), a dashboard tile ("widget"), a service ("command") or native code ("backend"/"ui").');
  // ---------- SDK 2.7: category, banner, screenshots, dependencies, native code ----------
  if (m.category === undefined) info.push({ code: 'category', msg: `Add "category" – one of: ${Object.keys(CATEGORIES).join(', ')}. The extension page groups by it.` });
  else if (!CATEGORIES[m.category]) err('category', `"category" must be one of: ${Object.keys(CATEGORIES).join(', ')}.`);
  if (m.banner !== undefined) {
    if (typeof m.banner !== 'string' || /\.\.|^\/|\\/.test(m.banner) || !fs.existsSync(path.join(dir, m.banner))) err('banner', `"banner" points to a missing file: ${m.banner}`);
    else checkBanner(path.join(dir, m.banner), m.banner, err, warn);
  } else info.push({ code: 'banner', msg: 'Add "banner": "banner.svg" (wide, about 16:5) – it heads the extension’s detail view and the catalog card.' });
  if (m.screenshots !== undefined) {
    if (!Array.isArray(m.screenshots) || m.screenshots.length > 6) err('screenshots', '"screenshots" must be a list of up to 6 image files.');
    else for (const s of m.screenshots) if (typeof s !== 'string' || !/\.(png|webp|jpe?g|svg)$/i.test(s) || /\.\.|^\/|\\/.test(s) || !fs.existsSync(path.join(dir, s))) err('screenshots', `Screenshot missing or not an image: ${s}`);
  }
  if (m.requires !== undefined) {
    if (!m.requires || typeof m.requires !== 'object' || Array.isArray(m.requires)) err('requires', '"requires" must be an object: { "other-extension": ">=1.0.0" }.');
    else for (const [dep, range] of Object.entries(m.requires)) {
      if (!ID_RE.test(dep)) err('requires', `"requires": "${dep}" is not a valid extension id.`);
      else if (dep === m.id) err('requires', 'An extension cannot require itself.');
      if (!RANGE_RE.test(String(range).trim())) err('requires', `"requires.${dep}": "${range}" must look like ">=1.2.0", "^1.2.0", "1.2.0" or "*".`);
    }
  }
  const native = !!(m.backend || m.ui);
  const permsRaw = Array.isArray(m.permissions) ? m.permissions : [];
  if (native && !permsRaw.includes('native')) err('native', '"backend"/"ui" run inside Hostwerk – add the "native" permission so people see it before installing.');
  if (!native && permsRaw.includes('native')) err('native', '"native" permission without "backend" or "ui".');
  for (const k of ['backend', 'ui']) {
    if (m[k] === undefined) continue;
    const f = m[k] && typeof m[k] === 'object' ? m[k].file : m[k];
    if (typeof f !== 'string' || /\.\.|^\/|\\/.test(f) || !/\.(c?js|mjs)$/.test(f)) { err(k, `"${k}" must name a .js file inside the package, e.g. "${k === 'backend' ? 'server/index.js' : 'ui/index.js'}".`); continue; }
    if (!fs.existsSync(path.join(dir, f))) { err(k, `"${k}" points to a missing file: ${f}`); continue; }
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (k === 'backend' && !/\bactivate\b/.test(src)) err('backend', `${f} must export activate(host) – see the guide, section “Native extensions”.`);
    if (k === 'ui' && !/\bregister\b|export\s+default|as\s+default\b/.test(src)) err('ui', `${f} must export default { pages, slots } – see the guide, section “Native extensions”.`);
  }
  for (const k of ['page', 'widget']) {
    const e = m[k];
    if (!e) continue;
    if (k === 'page' && m.ui && !e.file) continue; // native page: drawn by the ui module, page only names title/icon/description
    if (!e.file || /\.\.|^\/|\\/.test(e.file)) err(`${k}.file`, `"${k}.file" is missing or invalid.`);
    else if (!fs.existsSync(path.join(dir, e.file))) err(`${k}.file`, `"${k}.file" points to a missing file: ${e.file}`);
  }
  // Sprachpakete (manifest.languages): Datei vorhanden, Form wie en.json, Platzhalter passen
  if (m.languages !== undefined) {
    if (!Array.isArray(m.languages) || m.languages.length > 10) err('languages', '"languages" must be a list of up to 10 entries: [{ "id": "fr", "name": "Français", "file": "lang/fr.json" }].');
    else for (const l of m.languages) {
      if (!l || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(l.id || '') || ['de', 'en'].includes(l.id)) { err('languages', `Language id "${l && l.id}" is invalid (e.g. "fr", "pt-BR"; German and English are built in).`); continue; }
      if (!l.name) err('languages', `Language "${l.id}" needs a "name".`);
      const lf = l.file && !/\.\.|^[\\/]/.test(l.file) ? path.join(dir, l.file) : null;
      if (!lf || !fs.existsSync(lf)) { err('languages', `Language file for "${l.id}" is missing.`); continue; }
      let j = null; try { j = JSON.parse(fs.readFileSync(lf, 'utf8')); } catch { err('languages', `Language file for "${l.id}" is not valid JSON.`); continue; }
      if (!j || typeof j.texts !== 'object' || Array.isArray(j.texts)) err('languages', `Language file for "${l.id}" needs { "texts": { … } }.`);
      for (const p of Array.isArray(j && j.patterns) ? j.patterns : []) if (!Array.isArray(p) || (String(p[0]).match(/\{\}/g) || []).length !== (String(p[1]).match(/\{\}/g) || []).length) { warn('languages', `Pattern in "${l.id}" has a different number of {} placeholders – it is ignored.`); break; }
    }
  }
  // Seit SDK 2.2: Hostwerk zeichnet Kopf und Reiter selbst (page.description, page.tabs)
  if (m.page && m.page.tabs !== undefined) {
    if (!Array.isArray(m.page.tabs) || m.page.tabs.length > 8) err('page.tabs', '"page.tabs" must be a list of up to 8 tabs: [{ "id": "overview", "title": { "en": "Overview", "de": "Übersicht" }, "icon": "gauge" }].');
    else for (const tb of m.page.tabs) { if (!tb || !/^[a-z0-9-]{1,30}$/.test(tb.id || '')) err('page.tabs', 'Every tab needs an "id" (a–z, 0–9, -).'); else if (!tb.title) err('page.tabs', `Tab "${tb.id}" needs a "title".`); if (tb && tb.icon && !SIDEBAR_ICONS.includes(tb.icon)) warn('page.tabs', `Tab icon "${tb.icon}" is not a sidebar icon.`); }
  }
  if (m.page && !m.page.description && !m.description) warn('page.description', 'Add "page.description" – Hostwerk shows it under the page title like on its own pages.');
  // Beiträge zu Hostwerk-Bereichen: eigener Reiter auf Detailseiten, Aktionen in Schnellsuche und Rechtsklick-Menüs
  const PLACES = ['minecraft', 'web', 'db', 'app', 'game'];
  const co = m.contributes || {};
  for (const tb of Array.isArray(co.tabs) ? co.tabs : []) {
    if (!tb || !/^[a-z0-9-]{1,30}$/.test(tb.id || '') || !tb.title) err('contributes.tabs', 'Every contributed tab needs "id" and "title".');
    else if (!PLACES.includes(tb.on)) err('contributes.tabs', `Tab "${tb.id}": "on" must be one of ${PLACES.join(', ')}.`);
    else if (!tb.file || /\.\.|^\/|\\/.test(tb.file) || !fs.existsSync(path.join(dir, tb.file))) err('contributes.tabs', `Tab "${tb.id}": "file" is missing or points to a missing file.`);
  }
  for (const a of Array.isArray(co.actions) ? co.actions : []) {
    if (!a || !/^[a-z0-9-]{1,30}$/.test(a.id || '') || !a.title) err('contributes.actions', 'Every action needs "id" and "title".');
    else if (!(Array.isArray(a.on) && a.on.length && a.on.every((x) => x === 'palette' || PLACES.includes(x)))) err('contributes.actions', `Action "${a.id}": "on" must list "palette" and/or ${PLACES.join(', ')}.`);
    else if (!m.page) err('contributes.actions', `Action "${a.id}" opens the extension page – the extension needs a "page".`);
  }
  if (m.page && m.page.icon && !SIDEBAR_ICONS.includes(m.page.icon)) warn('icon', `"page.icon" "${m.page.icon}" is not a sidebar icon – choose one of: ${SIDEBAR_ICONS.join(', ')}.`);
  if (m.widget && m.widget.size && !['third', 'half', 'full'].includes(m.widget.size)) warn('widget.size', '"widget.size" should be third, half or full.');
  const perms = Array.isArray(m.permissions) ? m.permissions : [];
  for (const p of perms) if (!PERMISSIONS[p] && !LEGACY[p]) err('permissions', `Unknown permission "${p}". Allowed: ${Object.keys(PERMISSIONS).join(', ')}.`);
  if (perms.some((p) => LEGACY[p])) warn('permissions', 'Old permissions "read"/"write" – please name exact scopes (e.g. "read:minecraft").');
  const net = Array.isArray(m.network) ? m.network : [];
  if (net.length && !perms.includes('network')) err('network', '"network" lists addresses, but the "network" permission is missing.');
  for (const h of net) if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(h)) err('network', `"network" entries must be https origins without path, e.g. https://api.example.com – got "${h}".`);
  if (m.hostwerk && !/^>=\s*\d+\.\d+\.\d+$/.test(m.hostwerk)) warn('hostwerk', '"hostwerk" should be a minimum version like ">=2.9.0".');
  if (m.icon && !/^[\w-]+$/.test(m.icon) && !fs.existsSync(path.join(dir, m.icon))) err('icon', `"icon" points to a missing file: ${m.icon}`);
  if (!m.icon) warn('icon', 'No icon – add icon.svg (square, works on light and dark) and "icon": "icon.svg".');
  else if (!/^[\w-]+$/.test(m.icon) && fs.existsSync(path.join(dir, m.icon))) checkIcon(path.join(dir, m.icon), m.icon, err, warn);
  for (const s of Array.isArray(m.settings) ? m.settings : []) {
    if (!/^[a-zA-Z][\w-]{0,39}$/.test(s.key || '')) err('settings', `Setting without a valid "key": ${JSON.stringify(s).slice(0, 80)}`);
    if (!['text', 'number', 'switch', 'select'].includes(s.type)) err('settings', `Setting "${s.key}": type must be text, number, switch or select.`);
  }

  // ---------- Least privilege: permissions that nothing in the page code uses ----------
  // Only for sandboxed pages (native code is reviewed by hand). Always a warning, also with --strict: a path can be built at runtime.
  if (!m.backend && !m.ui && perms.length) {
    const src = walk(dir).filter((f) => /\.(html?|js|mjs)$/i.test(f) && !/^(tests|scripts|docs)\//.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const paths = [...src.matchAll(/["'`](\/[^"'`\s]*)/g)].map((x) => x[1].replace(/\$\{[^}]*\}/g, 'x').replace(/\?.*$/, ''));
    // SDK helpers that use a permission without a literal path
    const HELPERS = {
      'read:services': /Hostwerk\.services\s*\(|Hostwerk\.on\(\s*['"]services|Hostwerk\.minecraft\.servers/, 'control:services': /Hostwerk\.service\s*\(/,
      'read:minecraft': /Hostwerk\.minecraft\.(servers|players|stats)/, 'command:minecraft': /Hostwerk\.minecraft\.command/,
      'run:terminal': /Hostwerk\.terminal\s*\(/, storage: /Hostwerk\.storage\./, network: /\bfetch\s*\(/,
    };
    const used = (p) => {
      if (HELPERS[p] && HELPERS[p].test(src)) return true;
      const res = [...(PERMISSIONS[p].read || []), ...(PERMISSIONS[p].write || [])];
      if (!res.length) return true; // nothing to compare against
      return paths.some((x) => res.some((re) => re.test(x)));
    };
    const unused = perms.filter((p) => PERMISSIONS[p] && p !== 'native' && !used(p));
    if (unused.length) warnings.push({ code: 'permissions-unused', msg: `Requested but apparently not used: ${unused.join(', ')} – ask only for what the code needs (people see every permission before installing).` });
  }

  // ---------- Translations (German + English) ----------
  const both = (v) => v && typeof v === 'object' && v.de && v.en;
  if (!both(m.name)) warn('i18n', '"name" should exist in German and English: { "de": "…", "en": "…" }.');
  if (!both(m.description)) warn('i18n', '"description" should exist in German and English.');
  for (const k of ['page', 'widget']) if (m[k] && m[k].title && !both(m[k].title)) warn('i18n', `"${k}.title" should exist in German and English.`);
  for (const s of Array.isArray(m.settings) ? m.settings : []) if (!both(s.label)) warn('i18n', `Setting "${s.key}": "label" should exist in German and English.`);
  const loc = (l) => { const f = path.join(dir, 'locales', `${l}.json`); if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err('i18n', `locales/${l}.json is not valid JSON: ${e.message}`); return {}; } };
  const de = loc('de'), en = loc('en');
  if (m.ui || m.backend) {
    // Native extensions: English is the source text, locales/de.json maps it to German ({ "English": "Deutsch", "$patterns": [[…]] }).
    // locales/en.json is optional (only for wording overrides).
    if (!de) warn('i18n', 'Add locales/de.json – English texts are the keys, German the values (node tools/i18n-scan.js lists missing ones).');
    else {
      const empty = Object.entries(de).filter(([k, v]) => k !== '$patterns' && (typeof v !== 'string' || !v.trim())).map(([k]) => k);
      if (empty.length) warn('i18n', `locales/de.json has ${empty.length} empty translation(s), e.g. "${empty[0].slice(0, 50)}".`);
      if (de.$patterns !== undefined && (!Array.isArray(de.$patterns) || de.$patterns.some((p) => !Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || typeof p[1] !== 'string' || !p[1].trim()))) warn('i18n', 'locales/de.json "$patterns" must be a list of ["English {}", "Deutsch {}"] pairs.');
    }
  } else if (!de || !en) warn('i18n', 'Add locales/de.json and locales/en.json for all visible texts (Hostwerk.t("key"), data-i18n="key").');
  else {
    for (const k of Object.keys(de)) if (!(k in en)) warn('i18n', `locales/en.json is missing "${k}".`);
    for (const k of Object.keys(en)) if (!(k in de)) warn('i18n', `locales/de.json is missing "${k}".`);
    // Englischer Text, der noch deutsch aussieht (Umlaute oder typische deutsche Wörter)
    const GERMAN = /[äöüß]|\b(und|der|die|das|nicht|ist|mit|für|oder|kein|keine|noch|alle|wird|werden|bitte|läuft|gestoppt)\b/i;
    for (const [k, v] of Object.entries(en)) if (typeof v === 'string' && GERMAN.test(v)) warn('i18n', `locales/en.json "${k}" still looks German: "${v.slice(0, 40)}".`);
  }

  // ---------- Files: size, security, design ----------
  const files = walk(dir);
  const size = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  if (size > MAX_SIZE) err('size', `The package is ${(size / 1048576).toFixed(1)} MB – at most 10 MB.`);
  if (files.some((f) => /\.(exe|dll|bat|cmd|ps1|sh|scr|msi)$/i.test(f)) && !m.command) err('binary', 'Programs/scripts in a page-only package are not allowed.');
  const pages = [m.page && m.page.file, m.widget && m.widget.file, ...((m.contributes && Array.isArray(m.contributes.tabs)) ? m.contributes.tabs.map((x) => x && x.file) : [])].filter(Boolean);
  let hardColors = 0; let fontHits = 0;
  // Native code (backend/ui) is reviewed by hand before it reaches the catalog; the sandbox rules below are for pages.
  const nativeDirs = ['backend', 'ui'].map((k) => (m[k] ? `${path.posix.dirname(String(typeof m[k] === 'object' ? m[k].file : m[k]))}/` : null)).filter((d) => d && d !== './');
  // browser-extension/ of a native package is a separate browser add-on that Hostwerk only hands out (it never runs here)
  const isNative = (f) => nativeDirs.some((d) => f.startsWith(d)) || /^(tests|scripts)\//.test(f) || (!!m.backend && /^browser-extension\//.test(f));
  for (const f of files.filter((x) => TEXT_EXT.test(x))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/\.(html?|js|mjs)$/i.test(f) && isNative(f)) {
      if (/\beval\s*\(/.test(src)) err('eval', `${f}: eval is not allowed.`);
    } else if (/\.(html?|js|mjs)$/i.test(f)) {
      for (const mm of src.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) if (/^(https?:)?\/\//i.test(mm[1])) err('remote-script', `${f}: loads a script from the internet (${mm[1]}) – bundle it into the package.`);
      if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) err('eval', `${f}: eval/new Function is not allowed.`);
      // Unknown SDK functions (typos, invented APIs) – found before the page breaks at runtime
      for (const mm of src.matchAll(/\bHostwerk\.([A-Za-z_$]+)(?:\.([A-Za-z_$]+))?/g)) {
        const [, top, sub] = mm;
        if (!Object.prototype.hasOwnProperty.call(SDK_MEMBERS, top)) { err('sdk-api', `${f}: Hostwerk.${top} does not exist – see the SDK guide (e.g. Hostwerk.get(path), Hostwerk.services()).`); continue; }
        if (sub && Array.isArray(SDK_MEMBERS[top]) && !SDK_MEMBERS[top].includes(sub)) err('sdk-api', `${f}: Hostwerk.${top}.${sub} does not exist – available: ${SDK_MEMBERS[top].join(', ')}.`);
      }
      if (/document\.cookie/.test(src)) err('cookie', `${f}: document.cookie is not available – use Hostwerk.storage.`);
      if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(src)) warn('storage', `${f}: browser storage does not work in the sandbox – use Hostwerk.storage.`);
      if (/\.innerHTML\s*=\s*`[^`]*\$\{/.test(src) || /\.innerHTML\s*=\s*[^;`]*\+/.test(src)) warn('xss', `${f}: innerHTML with inserted values – use Hostwerk.render(el, Hostwerk.html\`…\`) so names and texts are escaped.`);
      if (/\bfetch\s*\(\s*['"`]https?:/.test(src) && !net.length) err('network', `${f}: talks to the internet without "network" in the manifest.`);
    }
    if (/\.(html?|css)$/i.test(f) && !isNative(f)) {
      // Colours outside var(--hw-…): fallbacks inside var() are fine
      const noVars = src.replace(/var\([^)]*\)/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
      const css = /\.css$/i.test(f) ? noVars : [...noVars.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"/gi)].map((x) => x[1] || x[2] || '').join('\n');
      // Bewusste Ausnahme je Datei, mit Begründung: /* hostwerk-allow: colors, fonts – Vorschau wie im Spiel */
      // (z. B. eine Nachbildung der Minecraft-Serverliste, die in Hell und Dunkel gleich aussehen muss)
      const allow = (src.match(/hostwerk-allow:\s*([a-z, ]+)[–-]\s*(.{10,})/i) || [])[1] || '';
      if (allow) info.push({ code: 'allow', msg: `${f}: intentional exception (${allow.trim()}) – ${(src.match(/hostwerk-allow:[^*\n]*/i) || [''])[0].trim()}` });
      if (!/colors/.test(allow)) hardColors += (css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) || []).length;
      // Schriften auf dem Text MIT var() prüfen (font-family: var(--mono) ist Hostwerks eigene Schrift und erlaubt)
      const rawCss = /\.css$/i.test(f) ? src : [...src.replace(/<script[\s\S]*?<\/script>/gi, '').matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"/gi)].map((x) => x[1] || x[2] || '').join('\n');
      if (!/fonts/.test(allow)) fontHits += (rawCss.match(/font-family\s*:(?!\s*(inherit|var\())/gi) || []).length;
      if (/position\s*:\s*fixed/i.test(css)) warn('overlay', `${f}: position: fixed – extensions should not lay anything over Hostwerk.`);
      if (/z-index\s*:\s*\d{4,}/i.test(css)) warn('overlay', `${f}: very high z-index.`);
    }
  }
  if (hardColors) warn('colors', `${hardColors} fixed colour(s) – use var(--hw-text), var(--hw-surface), var(--hw-accent) … so light and dark mode work.`);
  if (fontHits) warn('fonts', `${fontHits} own font(s) – leave the font to Hostwerk (var(--hw-font)).`);
  for (const p of pages) {
    if (!fs.existsSync(path.join(dir, p))) continue;
    const src = fs.readFileSync(path.join(dir, p), 'utf8');
    if (!/<script[^>]+src=["']\/ext-sdk\.js["']/.test(src)) warn('sdk', `${p}: does not load /ext-sdk.js – without it the page cannot talk to Hostwerk and does not get the design kit.`);
    if (!/<meta[^>]+viewport/i.test(src)) info.push({ code: 'viewport', msg: `${p}: add <meta name="viewport" content="width=device-width, initial-scale=1"> for phones.` });
  }
  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);
  return { ok: errors.length === 0, errors, warnings, info, manifest: m, score, size, sdk: SDK_VERSION };
}

module.exports = { checkPackage, PERMISSIONS, LEGACY, scopes, allows, quiet, text, SDK_VERSION, ID_RE, SIDEBAR_ICONS, SDK_MEMBERS, CATEGORIES, satisfies, cmpVer, RANGE_RE };

if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) { console.log('Usage: node check.js <extension folder> [--strict] [--json]'); process.exit(2); }
  const r = checkPackage(path.resolve(dir), { strict: process.argv.includes('--strict') });
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); }
  const name = r.manifest ? `${text(r.manifest.name, 'en')} ${r.manifest.version || ''}` : dir;
  console.log(`Hostwerk extension check – ${name}`);
  for (const e of r.errors) console.log(`  ✗ [${e.code}] ${e.msg}`);
  for (const w of r.warnings) console.log(`  ! [${w.code}] ${w.msg}`);
  for (const i of r.info) console.log(`  · [${i.code}] ${i.msg}`);
  console.log(r.ok ? `✓ passed (score ${r.score}/100)` : `✗ ${r.errors.length} error(s)`);
  process.exit(r.ok ? 0 : 1);
}
