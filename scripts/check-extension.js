'use strict';
/*
 * Checks a submitted Hostwerk extension and adds it to catalog/community.json.
 * Runs in .github/workflows/add-extension.yml – plain Node, no packages. Uses the same rules as Hostwerk and the
 * extension authors' CI: sdk/check.js in strict mode (manifest, security, design, German + English).
 *
 *   node scripts/check-extension.js <issue-body-file> <submitter>     (from the issue form)
 *   node scripts/check-extension.js --url <zip-url> --dry-run          (test a package, change nothing)
 *
 * Pages and tiles are added automatically (they run sandboxed in Hostwerk and change things only after asking).
 * Extensions with a service ("command" – starts programs on the PC) need a review by a person.
 * Result as JSON on stdout: { ok, auto, id, version, message, errors, warnings }.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { checkPackage, scopes, text } = require('../sdk/check');

const MAX = 10 * 1048576;
const BAD = /\.(exe|dll|bat|cmd|ps1|psm1|vbs|scr|msi|jar|sh|com|so|dylib|node)$/i;
// Official extensions (own repositories, catalog/extensions.json) and old built-in examples
const RESERVED = new Set(['player-ticker', 'status-wall', 'my-extension', 'status-wand', 'spieler-ticker']);
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');

const out = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const field = (body, ...labels) => {
  for (const label of labels) {
    const m = body.match(new RegExp(`### ${label}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`));
    const v = m ? m[1].trim() : '';
    if (v && v !== '_No response_') return v;
  }
  return '';
};

/**
 * Runtime check of one unpacked package (scripts/check-extension-runtime.js --dir). null = not possible here
 * (no browser driver installed – e.g. a local dry run); the workflow installs it, so submissions are always checked.
 */
function runtime(dir) {
  const { spawnSync } = require('child_process');
  const report = path.join(__dirname, '..', 'runtime-report.md');
  try { fs.rmSync(report, { force: true }); } catch { /* egal */ }
  const r = spawnSync(process.execPath, [path.join(__dirname, 'check-extension-runtime.js'), '--dir', dir], { encoding: 'utf8', timeout: 240000, env: { ...process.env, GITHUB_OUTPUT: '' } });
  if (r.status === 2) return null;
  const md = fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '';
  const problems = md.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2)).slice(0, 25);
  if (r.status !== 0 && !problems.length) problems.push(`Runtime check could not finish: ${String(r.stderr || r.error || '').split('\n')[0].slice(0, 200)}`);
  return { ok: r.status === 0, problems };
}

(async () => {
  let link; let submitter = ''; let body = '';
  if (args[0] === '--url') { link = args[1]; submitter = 'dry-run'; } else {
    body = fs.readFileSync(args[0], 'utf8');
    submitter = String(args[1] || '').trim();
    link = field(body, 'Package link', 'Link zum Paket');
  }
  if (!/^https:\/\//.test(link || '')) out({ ok: false, message: 'Please give an https link to the package (ZIP) – e.g. a GitHub release. / Bitte einen https-Link zum Paket (ZIP) angeben.' });
  const res = await fetch(link, { headers: { 'User-Agent': 'Hostwerk-Catalog' }, redirect: 'follow', signal: AbortSignal.timeout(60000) }).catch((e) => out({ ok: false, message: `Link not reachable: ${e.message}` }));
  if (!res.ok) out({ ok: false, message: `Link answers with ${res.status}.` });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) out({ ok: false, message: 'The package is larger than 10 MB.' });
  if (buf.readUInt32LE(0) !== 0x04034b50) out({ ok: false, message: 'This is not a ZIP package.' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-'));
  fs.writeFileSync(path.join(tmp, 'p.zip'), buf);
  try { execFileSync('unzip', ['-qq', path.join(tmp, 'p.zip'), '-d', path.join(tmp, 'x')]); } catch { out({ ok: false, message: 'The ZIP cannot be unpacked.' }); }
  let root = path.join(tmp, 'x');
  if (!fs.existsSync(path.join(root, 'manifest.json'))) {
    const sub = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (sub.length === 1 && fs.existsSync(path.join(root, sub[0].name, 'manifest.json'))) root = path.join(root, sub[0].name);
    else out({ ok: false, message: 'manifest.json is missing in the package.' });
  }
  // Same rules as everywhere – strict: design and translations must be right for the public catalog
  const r = checkPackage(root, { strict: true });
  const m = r.manifest || {};
  if (!r.ok) out({ ok: false, id: m.id, message: `The check found ${r.errors.length} problem(s):\n${r.errors.map((e) => `- [${e.code}] ${e.msg}`).join('\n')}`, errors: r.errors });
  // Runtime: open every page, tile and tab in a real browser (German/dark + English/light) – catches script errors,
  // empty pages, missing files and requests without permission before the package reaches anyone.
  const rt = runtime(root);
  if (rt && !rt.ok) out({ ok: false, id: m.id, message: `The package passes the static check (${r.score}/100) but breaks when opened:\n${rt.problems.map((p) => `- ${p}`).join('\n')}\n\nTry it locally: node scripts/check-extension-runtime.js --dir <your folder>`, runtime: rt.problems });
  const reserved = RESERVED.has(m.id);
  if (reserved && !DRY) out({ ok: false, message: `The id "${m.id}" is reserved for an official extension.` });
  const catalogFile = path.join('catalog', 'community.json');
  const list = fs.existsSync(catalogFile) ? JSON.parse(fs.readFileSync(catalogFile, 'utf8')) : [];
  const prev = list.find((x) => x.id === m.id);
  if (prev && prev.submitter && prev.submitter !== submitter && !DRY) out({ ok: false, message: `The id "${m.id}" already belongs to an extension by @${prev.submitter}. Please choose another id.` });
  const version = m.version;
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(path.relative(root, f)); } };
  walk(root);
  const bad = files.filter((f) => BAD.test(f));
  const base = { id: m.id, version, score: r.score, warnings: r.warnings, runtime: rt ? 'passed' : 'skipped' };
  if (m.command || bad.length) out({ ok: true, auto: false, ...base, message: `Needs a review by a person: ${m.command ? 'the extension starts a service (a program on the PC)' : ''}${m.command && bad.length ? ' and ' : ''}${bad.length ? `contains executable files (${bad.slice(0, 5).join(', ')})` : ''}.` });
  if (DRY) out({ ok: true, auto: true, dryRun: true, ...base, message: `Check passed (${r.score}/100) – would be added as "${text(m.name, 'en')}" ${version}.${reserved ? ` Note: the id "${m.id}" is reserved – choose your own id before submitting.` : ''}` });

  // Add: keep a checked copy in this repository (the original link need not stay online)
  fs.mkdirSync('packages', { recursive: true });
  const file = `packages/${m.id}-${version}.zip`;
  fs.writeFileSync(file, buf);
  for (const old of fs.readdirSync('packages')) if (old.startsWith(`${m.id}-`) && `packages/${old}` !== file) fs.rmSync(path.join('packages', old));
  let icon = null;
  if (m.icon && /\.(svg|png)$/i.test(m.icon) && fs.existsSync(path.join(root, m.icon))) { icon = `packages/${m.id}${path.extname(m.icon).toLowerCase()}`; fs.copyFileSync(path.join(root, m.icon), icon); }
  const repo = process.env.GITHUB_REPOSITORY || 'Passimoritz/hostwerk-public';
  const raw = (f) => `https://raw.githubusercontent.com/${repo}/main/${f}`;
  const entry = {
    id: m.id, name: m.name, description: m.description || field(body, 'Description', 'Beschreibung'), author: String(m.author || submitter).slice(0, 60),
    version, page: !!m.page, widget: !!m.widget, service: false, permissions: scopes(m.permissions), hostwerk: m.hostwerk || null,
    homepage: m.homepage || m.repository || null, icon: icon ? raw(icon) : null, download: raw(file),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'), submitter, score: r.score, updated: new Date().toISOString().slice(0, 10),
  };
  const next = [...list.filter((x) => x.id !== m.id), entry].sort((a, b) => text(a.name, 'en').localeCompare(text(b.name, 'en')));
  fs.mkdirSync('catalog', { recursive: true });
  fs.writeFileSync(catalogFile, JSON.stringify(next, null, 2) + '\n');
  // Older Hostwerk versions read katalog/community.json
  fs.mkdirSync('katalog', { recursive: true });
  fs.writeFileSync(path.join('katalog', 'community.json'), JSON.stringify(next, null, 2) + '\n');
  out({ ok: true, auto: true, ...base, message: `${prev ? 'Updated' : 'Added'}: "${text(m.name, 'en')}" ${version} (check ${r.score}/100) – shows up in Hostwerk under Apps → Extensions → Marketplace (source "Community").` });
})().catch((e) => out({ ok: false, message: `Check failed: ${e.message}` }));
