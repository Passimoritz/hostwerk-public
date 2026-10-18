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

const SDK_VERSION = '2.0.0';
/** Permission scopes and what they allow (GET = read, POST = change after confirmation). */
const PERMISSIONS = {
  'read:services': { de: 'Dienste und ihren Zustand sehen', en: 'See services and their state', read: [/^\/overview$/] },
  'read:web': { de: 'Webserver lesen', en: 'Read web servers', read: [/^\/web(\/[\w-]+)?$/] },
  'read:databases': { de: 'Datenbankserver lesen', en: 'Read database servers', read: [/^\/dbs(\/[\w-]+)?$/] },
  'read:minecraft': { de: 'Minecraft-Server, Spieler und Statistiken lesen', en: 'Read Minecraft servers, players and stats', read: [/^\/mc\/servers(\/[\w-]+(\/(players|stats|worlds))?)?$/] },
  'read:apps': { de: 'Apps lesen', en: 'Read apps', read: [/^\/apps$/] },
  'read:tasks': { de: 'Aufgaben lesen', en: 'Read scheduled tasks', read: [/^\/tasks$/] },
  'read:mail': { de: 'Abgefangene E-Mails lesen', en: 'Read captured e-mails', read: [/^\/mail(\/messages)?$/] },
  'read:system': { de: 'Systemzustand, Auslastung und Ports lesen', en: 'Read system health, load and ports', read: [/^\/system\/(health|resources|ports)$/] },
  'read:network': { de: 'Router, Rechner und Sicherheitslage lesen', en: 'Read router, machines and security status', read: [/^\/(router|machines|live\/security)$/] },
  'control:services': { de: 'Dienste starten, stoppen, neu starten (mit Rückfrage)', en: 'Start, stop, restart services (asks first)', write: [/^\/(web|dbs|apps|mail|mc\/servers)\/[\w-]+\/(start|stop|restart)$/] },
  'command:minecraft': { de: 'Befehle an Minecraft-Server senden (mit Rückfrage)', en: 'Send commands to Minecraft servers (asks first)', write: [/^\/mc\/servers\/[\w-]+\/command$/] },
  'run:tasks': { de: 'Aufgaben ausführen (mit Rückfrage)', en: 'Run scheduled tasks (asks first)', write: [/^\/tasks\/[\w-]+\/run$/] },
  storage: { de: 'Eigene Daten speichern (max. 256 KB)', en: 'Store own data (max. 256 KB)' },
  network: { de: 'Mit den im Paket genannten Webadressen sprechen', en: 'Talk to the web addresses named in the package' },
};
// Version 1 packages: "read" = all read scopes, "write" = all control scopes
const LEGACY = { read: Object.keys(PERMISSIONS).filter((k) => k.startsWith('read:')), write: ['control:services', 'command:minecraft', 'run:tasks'] };
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** Line icons for the sidebar (same style as Hostwerk's own areas) – ui/src/extIcons.js */
const SIDEBAR_ICONS = ['puzzle', 'users', 'monitor', 'gauge', 'activity', 'chart', 'bar-chart', 'bell', 'book', 'bot', 'box', 'calendar', 'camera', 'clock', 'cloud', 'code', 'coffee', 'cpu', 'database', 'download', 'file', 'flag', 'gamepad', 'gift', 'globe', 'heart', 'home', 'image', 'inbox', 'key', 'dashboard', 'grid', 'leaf', 'line-chart', 'list', 'lock', 'mail', 'map', 'message', 'music', 'network', 'news', 'package', 'pie-chart', 'radio', 'rocket', 'server', 'settings', 'shield', 'cart', 'sparkles', 'star', 'sun', 'swords', 'table', 'tag', 'terminal', 'timer', 'trophy', 'tv', 'wand', 'wifi', 'wrench', 'zap'];
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
  const key = method === 'POST' ? 'write' : 'read';
  return scopes(list).some((s) => (PERMISSIONS[s][key] || []).some((re) => re.test(clean)));
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
  if (!m.page && !m.widget && !m.command) err('entry', 'The extension needs a page ("page"), a dashboard tile ("widget") or a service ("command").');
  for (const k of ['page', 'widget']) {
    const e = m[k];
    if (!e) continue;
    if (!e.file || /\.\.|^\/|\\/.test(e.file)) err(`${k}.file`, `"${k}.file" is missing or invalid.`);
    else if (!fs.existsSync(path.join(dir, e.file))) err(`${k}.file`, `"${k}.file" points to a missing file: ${e.file}`);
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
  for (const s of Array.isArray(m.settings) ? m.settings : []) {
    if (!/^[a-zA-Z][\w-]{0,39}$/.test(s.key || '')) err('settings', `Setting without a valid "key": ${JSON.stringify(s).slice(0, 80)}`);
    if (!['text', 'number', 'switch', 'select'].includes(s.type)) err('settings', `Setting "${s.key}": type must be text, number, switch or select.`);
  }

  // ---------- Translations (German + English) ----------
  const both = (v) => v && typeof v === 'object' && v.de && v.en;
  if (!both(m.name)) warn('i18n', '"name" should exist in German and English: { "de": "…", "en": "…" }.');
  if (!both(m.description)) warn('i18n', '"description" should exist in German and English.');
  for (const k of ['page', 'widget']) if (m[k] && m[k].title && !both(m[k].title)) warn('i18n', `"${k}.title" should exist in German and English.`);
  for (const s of Array.isArray(m.settings) ? m.settings : []) if (!both(s.label)) warn('i18n', `Setting "${s.key}": "label" should exist in German and English.`);
  const loc = (l) => { const f = path.join(dir, 'locales', `${l}.json`); if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err('i18n', `locales/${l}.json is not valid JSON: ${e.message}`); return {}; } };
  const de = loc('de'), en = loc('en');
  if (!de || !en) warn('i18n', 'Add locales/de.json and locales/en.json for all visible texts (Hostwerk.t("key"), data-i18n="key").');
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
  const pages = [m.page && m.page.file, m.widget && m.widget.file].filter(Boolean);
  let hardColors = 0; let fontHits = 0;
  for (const f of files.filter((x) => TEXT_EXT.test(x))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/\.(html?|js|mjs)$/i.test(f)) {
      for (const mm of src.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) if (/^(https?:)?\/\//i.test(mm[1])) err('remote-script', `${f}: loads a script from the internet (${mm[1]}) – bundle it into the package.`);
      if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) err('eval', `${f}: eval/new Function is not allowed.`);
      if (/document\.cookie/.test(src)) err('cookie', `${f}: document.cookie is not available – use Hostwerk.storage.`);
      if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(src)) warn('storage', `${f}: browser storage does not work in the sandbox – use Hostwerk.storage.`);
      if (/\.innerHTML\s*=\s*`[^`]*\$\{/.test(src) || /\.innerHTML\s*=\s*[^;`]*\+/.test(src)) warn('xss', `${f}: innerHTML with inserted values – use Hostwerk.render(el, Hostwerk.html\`…\`) so names and texts are escaped.`);
      if (/\bfetch\s*\(\s*['"`]https?:/.test(src) && !net.length) err('network', `${f}: talks to the internet without "network" in the manifest.`);
    }
    if (/\.(html?|css)$/i.test(f)) {
      // Colours outside var(--hw-…): fallbacks inside var() are fine
      const noVars = src.replace(/var\([^)]*\)/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
      const css = /\.css$/i.test(f) ? noVars : [...noVars.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"/gi)].map((x) => x[1] || x[2] || '').join('\n');
      hardColors += (css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) || []).length;
      fontHits += (css.match(/font-family\s*:\s*(?!inherit|var\()/gi) || []).length;
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

module.exports = { checkPackage, PERMISSIONS, LEGACY, scopes, allows, text, SDK_VERSION, ID_RE, SIDEBAR_ICONS };

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
