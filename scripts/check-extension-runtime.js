'use strict';
/*
 * Runtime run for extensions (.github/workflows/extension-runtime.yml): opens EVERY page, tile and tab of every catalog
 * extension in a real browser – inside a host page that speaks Hostwerk's bridge protocol exactly (init with theme,
 * language and texts, data requests, storage, tabs, contexts) and answers with realistic sample data.
 * Catches what the static check (sdk/check.js) cannot see: script errors, pages that stay empty, missing files,
 * requests to areas the extension has no permission for.
 *
 *   node scripts/check-extension-runtime.js                     → all catalog entries (download + SHA-256 check)
 *   node scripts/check-extension-runtime.js --dir <folder> …    → local extension folders (development)
 *   CHROME_PATH=/path/to/chrome                                → browser (default: Chrome on the runner / Edge on Windows)
 * Each entry is opened twice: German + dark and English + light. Result: runtime-report.md, exit 1 if an official
 * extension fails; GitHub Actions output "failing".
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SDK = path.join(ROOT, 'sdk');
const args = process.argv.slice(2);
const dirs = []; for (let i = 0; i < args.length; i++) if (args[i] === '--dir') dirs.push(path.resolve(args[++i]));

/* ---------------- Sample data (what a typical Hostwerk shows) ---------------- */
const now = Date.now();
const proc = (state, extra = {}) => ({ state, pid: state === 'running' ? 4242 : null, startedAt: state === 'running' ? now - 3 * 3600e3 : null, stats: { cpu: 3.2, memory: 312e6 }, extra });
const MC = [
  { id: 'survival', name: 'Survival', type: 'paper', typeLabel: 'Paper', version: '1.21.4', port: 25565, motd: '§aWelcome §lhome', maxPlayers: 20, proc: proc('running', { ready: true, players: ['Alex', 'Steve', 'Notch'], playerCount: 3, tps: 19.9 }) },
  { id: 'creative', name: 'Creative', type: 'vanilla', typeLabel: 'Vanilla', version: '1.21.4', port: 25566, motd: 'Build!', maxPlayers: 10, proc: proc('stopped') },
];
const OVERVIEW = {
  app: { version: '2.9.0', platform: 'linux' },
  web: [{ id: 'apache', name: 'Apache', type: 'apache', typeLabel: 'Apache', version: '2.4.62', httpPort: 80, port: 80, urls: [{ label: 'localhost', url: 'http://localhost' }], proc: proc('running') }, { id: 'nginx', name: 'Nginx', type: 'nginx', typeLabel: 'Nginx', version: '1.27', httpPort: 8080, port: 8080, proc: proc('stopped') }],
  db: [{ id: 'mariadb', name: 'MariaDB', type: 'mariadb', typeLabel: 'MariaDB', version: '11.4', port: 3306, proc: proc('running') }],
  minecraft: MC,
  apps: [{ id: 'blog', name: 'Blog', kind: 'node', kindLabel: 'Node.js', port: 3000, proc: proc('running') }],
  mail: { name: 'Mail catcher', proc: proc('running'), unread: 2 },
  tunnels: [], games: [], jobs: [],
};
const mock = [
  [/^\/overview$/, () => OVERVIEW],
  [/^\/web$/, () => OVERVIEW.web], [/^\/web\/[\w-]+$/, () => OVERVIEW.web[0]],
  [/^\/dbs$/, () => OVERVIEW.db], [/^\/dbs\/[\w-]+$/, () => OVERVIEW.db[0]], [/^\/dbs\/[\w-]+\/backups$/, () => [{ file: 'mariadb-2026-10-18.sql.gz', size: 1.2e6, at: now - 864e5 }]],
  [/^\/apps$/, () => OVERVIEW.apps],
  [/^\/mc\/servers$/, () => MC], [/^\/mc\/servers\/[\w-]+$/, (p) => MC.find((s) => p.endsWith(s.id)) || MC[0]],
  [/^\/mc\/servers\/[\w-]+\/players$/, () => ({ online: [{ name: 'Alex', uuid: '853c80ef3c3749fdaa49938b674adae6', since: now - 1800e3 }, { name: 'Steve', uuid: '8667ba71b85a4004af54457a9734eed7', since: now - 600e3 }], known: [{ name: 'Alex', uuid: '853c80ef3c3749fdaa49938b674adae6', lastSeen: now, playtime: 36e6, joins: 12 }, { name: 'Notch', uuid: '069a79f444e94726a5befca90e38aaf5', lastSeen: now - 864e5, playtime: 9e6, joins: 4 }] })],
  [/^\/mc\/servers\/[\w-]+\/stats$/, () => ({ players: [{ name: 'Alex', uuid: '853c80ef3c3749fdaa49938b674adae6', playtime: 36e6, joins: 12, deaths: 3, kills: 40, lastSeen: now }, { name: 'Steve', uuid: '8667ba71b85a4004af54457a9734eed7', playtime: 12e6, joins: 5, deaths: 7, kills: 9, lastSeen: now - 3600e3 }], days: [{ day: '2026-10-17', players: 3, peak: 2 }, { day: '2026-10-18', players: 4, peak: 3 }] })],
  [/^\/mc\/servers\/[\w-]+\/worlds$/, () => [{ name: 'world', kind: 'overworld', size: 210e6, main: true }]],
  [/^\/mc\/servers\/[\w-]+\/(properties|gamerules)$/, () => ({ motd: '§aWelcome', 'max-players': '20', difficulty: 'normal' })],
  [/^\/tasks$/, () => ({ list: [{ id: 'backup', name: 'Nightly backup', kind: 'backup', schedule: '0 3 * * *', enabled: true, lastRun: { at: now - 6 * 3600e3, ok: true }, nextRun: now + 18 * 3600e3 }, { id: 'restart', name: 'Restart Survival', kind: 'mc-restart', schedule: '0 5 * * *', enabled: false }] })],
  [/^\/mail$/, () => OVERVIEW.mail], [/^\/mail\/messages$/, () => [{ id: 'm1', subject: 'Welcome', from: 'shop@example.test', to: 'you@example.test', at: now - 600e3, read: false, size: 4200 }, { id: 'm2', subject: 'Invoice', from: 'billing@example.test', to: 'you@example.test', at: now - 7200e3, read: true, size: 9100 }]],
  [/^\/system\/health$/, () => ({ ok: true, checks: [{ id: 'disk', ok: true, text: '61 % free' }] })],
  [/^\/system\/resources$/, () => ({ system: { totalMem: 16e9, freeMem: 6e9, cpus: 8, history: [{ t: now - 2000, cpu: 12, mem: 9e9 }, { t: now, cpu: 18, mem: 10e9 }] }, procs: [{ id: 'apache', name: 'Apache', state: 'running', cpu: 1.2, memory: 80e6 }], hostwerk: { memory: 150e6 } })],
  // wie GET /system/ports in Hostwerk (status: ours | free | blocked | duplicate)
  [/^\/system\/ports$/, () => [{ kind: 'web', id: 'apache', name: 'Apache', field: 'httpPort', port: 80, running: true, status: 'ours', usedBy: null }, { kind: 'db', id: 'mariadb', name: 'MariaDB', field: 'port', port: 3306, running: true, status: 'ours', usedBy: null }, { kind: 'minecraft', id: 'creative', name: 'Creative', field: 'port', port: 25566, running: false, status: 'free', usedBy: null }, { kind: 'web', id: 'nginx', name: 'Nginx', field: 'httpPort', port: 8080, running: false, status: 'blocked', usedBy: 'java.exe' }, { kind: 'hostwerk', id: 'ui', name: 'Hostwerk', field: null, port: 7777, running: true, status: 'ours', usedBy: null }]],
  [/^\/(router|machines|live\/security)$/, () => ({ ok: true, list: [] })],
  [/^\/knowledge$/, () => ({ enabled: true, paused: false, sources: [{ id: 'demo', name: 'Demo', path: '/home/demo/project', kind: 'project', built: true, builtAt: now - 600e3, options: {}, claude: false }], mcp: { connected: false } })],
  [/^\/knowledge\/[\w.-]+\/graph$/, () => ({ built: true, builtAt: now, total: { nodes: 3, edges: 2 }, kinds: { class: 1, function: 2 }, modularity: 0.4, stats: { ambiguous: 0 }, communities: [{ id: 0, label: 'src · Store', size: 3, files: 1, top: ['a'] }], gods: ['a'], hubs: [], nodes: [{ id: 'a', label: 'Store', kind: 'class', file: 'src/store.js', line: 1, c: 0, d: 2 }, { id: 'b', label: 'load', kind: 'function', file: 'src/store.js', line: 4, c: 0, d: 1 }, { id: 'c', label: 'save', kind: 'function', file: 'src/store.js', line: 9, c: 0, d: 1 }], edges: [['a', 'b', 'contains', 0], ['a', 'c', 'contains', 0]] })],
  [/^\/knowledge\/[\w.-]+\/report$/, () => ({ md: '# Report\n- **Store** (class)' })],
  [/^\/knowledge\/[\w.-]+\/questions$/, () => ({ questions: [], unanswered: [] })],
  [/^\/knowledge\/[\w.-]+\/memory$/, () => []],
  [/^\/knowledge\/[\w.-]+\/claude$/, () => ({ connected: false, items: [], issues: [], ok: true })],
];
const POSTS = [[/./, () => ({ ok: true })]];

/* ---------------- Host page (speaks Hostwerk's bridge protocol) ---------------- */
const THEMES = {
  dark: { mode: 'dark', vars: { '--bg': '#0b0d12', '--surface': '#12151c', '--surface-2': '#181c25', '--line': '#262b36', '--line-2': '#323846', '--text': '#e7e9ef', '--text-2': '#b4bacb', '--muted': '#7d859b', '--accent': '#8b5cf6', '--accent-soft': 'rgba(139,92,246,.14)', '--accent-text': '#c4b5fd', '--ok': '#34d399', '--warn': '#fbbf24', '--err': '#f87171' }, font: 'system-ui, sans-serif', mono: 'monospace' },
  light: { mode: 'light', vars: { '--bg': '#f6f7fb', '--surface': '#ffffff', '--surface-2': '#f1f3f8', '--line': '#e3e6ee', '--line-2': '#cfd4df', '--text': '#141821', '--text-2': '#3d4454', '--muted': '#5d6578', '--accent': '#7c3aed', '--accent-soft': 'rgba(124,58,237,.1)', '--accent-text': '#5b21b6', '--ok': '#059669', '--warn': '#b45309', '--err': '#dc2626' }, font: 'system-ui, sans-serif', mono: 'monospace' },
};
function hostPage({ id, file, embed, lang, theme, tab, context, permissions, name }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body>
<iframe id="f" sandbox="allow-scripts allow-forms allow-popups allow-modals" src="/ext/${id}/${file}"></iframe>
<script>
const MOCK = ${JSON.stringify(mock.map(([re]) => re.source))};
const ID = ${JSON.stringify(id)}; const store = {}; window.__calls = []; window.__denied = [];
const f = document.getElementById('f');
const push = (m) => f.contentWindow.postMessage({ hostwerk: true, ...m }, '*');
addEventListener('message', async (e) => {
  if (e.source !== f.contentWindow) return;
  const m = e.data || {}; if (!m.hostwerkExt) return;
  const reply = (x) => m.id && push({ id: m.id, ...x });
  window.__calls.push(m.method + ' ' + (m.path || ''));
  if (m.method === 'HELLO') { const l = await (await fetch('/locales/' + ID)).json(); push({ type: 'init', theme: ${JSON.stringify(THEMES[theme])}, lang: ${JSON.stringify(lang)}, messages: { ...l.de, ...l[${JSON.stringify(lang)}] }, settings: l.settings || {}, embed: ${JSON.stringify(embed)}, tab: ${JSON.stringify(tab)}, context: ${JSON.stringify(context)}, action: null, ext: { id: ID, name: ${JSON.stringify(name)}, version: '0', permissions: ${JSON.stringify(permissions)} }, app: { version: '2.9.0' } }); return; }
  if (['RESIZE', 'SUBSCRIBE'].includes(m.method)) return;
  if (['TOAST', 'NAVIGATE', 'OPEN_URL', 'COPY', 'OPEN_SETTINGS', 'SET_TAB'].includes(m.method)) return reply({ data: true });
  if (m.method === 'PICK_FOLDER') return reply({ data: null });
  if (m.method === 'STORAGE_GET') { const k = (m.body || {}).key; return reply({ data: k ? store[k] : store }); }
  if (m.method === 'STORAGE_SET') { const b = m.body || {}; if (b.remove) delete store[b.key]; else store[b.key] = b.value; return reply({ data: true }); }
  if (['GET', 'POST', 'PUT', 'DELETE'].includes(m.method)) {
    const r = await (await fetch('/api?method=' + m.method + '&path=' + encodeURIComponent(m.path || '') + '&id=' + ID, { method: 'POST', body: JSON.stringify(m.body || null) })).json();
    if (r.denied) window.__denied.push(m.method + ' ' + m.path);
    return reply(r.error ? { error: r.error } : { data: r.data });
  }
  reply({ error: 'Unknown call ' + m.method });
});
</script></body></html>`;
}

/* ---------------- Permission check (same rules as Hostwerk) ---------------- */
const { allows } = require(path.join(SDK, 'check.js'));

/* ---------------- Server ---------------- */
function serve(exts) {
  const byId = new Map(exts.map((e) => [e.id, e]));
  const kit = [path.join(SDK, 'hostwerk-sdk.css'), path.join(SDK, 'hostwerk-kit.css')].filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
  const type = (f) => ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' })[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, body, t = 'text/plain') => { res.writeHead(code, { 'content-type': t, 'cache-control': 'no-store' }); res.end(body); };
    if (u.pathname === '/ext-sdk.js') return send(200, fs.readFileSync(path.join(SDK, 'hostwerk-sdk.js')), 'text/javascript');
    if (u.pathname === '/ext-sdk.css') return send(200, kit, 'text/css');
    if (u.pathname === '/host') return send(200, hostPage(JSON.parse(u.searchParams.get('o'))), 'text/html');
    if (u.pathname.startsWith('/locales/')) {
      const e = byId.get(u.pathname.split('/')[2]);
      const rd = (l) => { try { return JSON.parse(fs.readFileSync(path.join(e.dir, 'locales', `${l}.json`), 'utf8')); } catch { return {}; } };
      const settings = Object.fromEntries((e.manifest.settings || []).map((s) => [s.key, s.default]));
      return send(200, JSON.stringify({ de: rd('de'), en: rd('en'), settings }), 'application/json');
    }
    if (u.pathname === '/api') {
      let body = ''; req.on('data', (d) => { body += d; }); req.on('end', () => {
        const e = byId.get(u.searchParams.get('id')); const method = u.searchParams.get('method'); const p = u.searchParams.get('path');
        if (!allows(e.manifest.permissions, method, p)) return send(200, JSON.stringify({ denied: true, error: 'Missing permission' }), 'application/json');
        const hit = (method === 'GET' ? mock : POSTS).find(([re]) => re.test(p.split('?')[0]));
        send(200, JSON.stringify(hit ? { data: hit[1](p.split('?')[0]) } : { error: `No sample data for ${p}` }), 'application/json');
      });
      return undefined;
    }
    const m = u.pathname.match(/^\/ext\/([\w-]+)\/(.+)$/);
    if (m && byId.has(m[1])) {
      const file = path.join(byId.get(m[1]).dir, decodeURIComponent(m[2]));
      if (!file.startsWith(byId.get(m[1]).dir) || !fs.existsSync(file)) return send(404, 'not found');
      return send(200, fs.readFileSync(file), type(file));
    }
    return send(404, 'not found');
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}

/* ---------------- Packages ---------------- */
async function fromCatalog() {
  const out = [];
  for (const [file, official] of [['catalog/extensions.json', true], ['catalog/community.json', false]]) {
    let items = [];
    try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); items = j.items || j; } catch { continue; }
    for (const it of items) {
      if (!it.download && !it.url) continue;
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-rt-'));
      try {
        const r = await fetch(it.download || it.url); if (!r.ok) throw new Error(`download ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (it.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== it.sha256) throw new Error('SHA-256 mismatch');
        fs.writeFileSync(path.join(tmp, 'p.zip'), buf);
        execFileSync(process.platform === 'win32' ? 'tar' : 'unzip', process.platform === 'win32' ? ['-xf', 'p.zip'] : ['-q', 'p.zip'], { cwd: tmp });
        out.push({ dir: tmp, official, manifest: JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8')) });
      } catch (e) { out.push({ dir: tmp, official, manifest: { id: it.id, name: it.name }, loadError: e.message }); }
    }
  }
  return out;
}

/* ---------------- Run ---------------- */
(async () => {
  const exts = dirs.length ? dirs.map((d) => ({ dir: d, official: true, manifest: JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')) })) : await fromCatalog();
  for (const e of exts) e.id = e.manifest.id;
  let puppeteer; try { puppeteer = require('puppeteer-core'); } catch { console.error('puppeteer-core missing (npm i puppeteer-core)'); process.exit(2); }
  const chrome = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : '/usr/bin/google-chrome');
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const srv = await serve(exts.filter((e) => !e.loadError));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const results = [];
  for (const e of exts) {
    const problems = [];
    if (e.loadError) { results.push({ e, problems: [`package: ${e.loadError}`] }); continue; }
    const m = e.manifest;
    const name = typeof m.name === 'object' ? m.name.en || m.name.de : m.name;
    const views = [];
    if (m.page) for (const t of [null, ...((m.page.tabs || []).map((x) => x.id))]) views.push({ file: m.page.file, embed: 'page', tab: t || (m.page.tabs ? m.page.tabs[0].id : null) });
    if (m.widget) views.push({ file: m.widget.file, embed: 'widget', tab: null });
    for (const c of (m.contributes && m.contributes.tabs) || []) views.push({ file: c.file, embed: 'tab', tab: null, context: { kind: c.on, id: c.on === 'minecraft' ? 'survival' : c.on === 'web' ? 'apache' : c.on === 'db' ? 'mariadb' : c.on === 'app' ? 'blog' : 'x' } });
    const uniq = [...new Map(views.map((v) => [`${v.file}|${v.embed}|${v.tab}`, v])).values()];
    for (const v of uniq) for (const [lang, theme] of [['de', 'dark'], ['en', 'light']]) {
      const label = `${v.embed}${v.tab ? `#${v.tab}` : ''} (${lang}/${theme})`;
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (er) => errors.push(`script error: ${er.message}`));
      page.on('console', (msg) => { if (msg.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 404 \(Not Found\)$/.test(msg.text())) errors.push(`console: ${msg.text().slice(0, 200)}`); });
      page.on('requestfailed', (rq) => errors.push(`request failed: ${rq.url()}`));
      page.on('response', (rs) => { if (rs.status() === 404 && !/favicon/.test(rs.url())) errors.push(`missing file: ${rs.url().replace(base, '')}`); });
      await page.setViewport({ width: v.embed === 'widget' ? 420 : 1200, height: 800 });
      const o = { id: e.id, file: v.file, embed: v.embed, lang, theme, tab: v.tab, context: v.context || null, permissions: m.permissions || [], name };
      try {
        await page.goto(`${base}/host?o=${encodeURIComponent(JSON.stringify(o))}`, { waitUntil: 'load', timeout: 20000 });
        await new Promise((r) => setTimeout(r, 2500));
        const frame = page.frames().find((fr) => fr.url().includes(`/ext/${e.id}/`));
        if (!frame) errors.push('frame did not load');
        else {
          const st = await frame.evaluate(() => {
            const visible = [...document.body.querySelectorAll('*')].filter((el) => { if (el.closest('[hidden]')) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
            const text = [...visible].map((el) => (el.children.length ? '' : el.textContent)).join(' ').replace(/\s+/g, ' ').trim();
            return { visible: visible.length, text: text.length, keys: (text.match(/\b[a-z]+\.[a-z][\w.]+\b/g) || []).filter((k) => !/\.(js|json|md|java|php|sql|jar|com|org|net|de|io|test|html|css)$/.test(k)).slice(0, 5), sdk: typeof window.Hostwerk === 'object' };
          });
          if (!st.sdk) errors.push('Hostwerk SDK not loaded');
          if (st.visible < 3 || st.text < 10) errors.push(`page stays (almost) empty: ${st.visible} visible elements, ${st.text} characters`);
          if (st.keys.length) errors.push(`untranslated text keys visible: ${st.keys.join(', ')}`);
        }
        const denied = await page.evaluate(() => window.__denied);
        for (const d of denied) errors.push(`asks for an area without permission: ${d}`);
      } catch (er) { errors.push(`could not open: ${er.message}`); }
      await page.close();
      for (const er of [...new Set(errors)]) problems.push(`${label}: ${er}`);
    }
    results.push({ e, problems, views: uniq.length });
    console.log(`${problems.length ? '✗' : '✓'} ${e.id}${problems.length ? `\n    ${problems.join('\n    ')}` : ` (${uniq.length} view(s) × 2)`}`);
  }
  await browser.close(); srv.close();
  const failing = results.filter((r) => r.problems.length);
  const md = [`# Extension runtime check`, '', `${results.length - failing.length} of ${results.length} extensions open without problems (${new Date().toISOString().slice(0, 10)}).`, ''];
  for (const r of failing) md.push(`## ${r.e.id}${r.e.official ? ' (official)' : ''}`, ...r.problems.map((p) => `- ${p}`), '');
  fs.writeFileSync(path.join(ROOT, 'runtime-report.md'), `${md.join('\n')}\n`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `failing=${failing.length}\n`);
  if (!dirs.length) for (const r of results) try { fs.rmSync(r.e.dir, { recursive: true, force: true }); } catch { /* egal */ }
  process.exit(failing.some((r) => r.e.official) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
