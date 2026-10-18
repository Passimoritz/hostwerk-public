'use strict';
/*
 * Compatibility run (every 5 days, .github/workflows/extension-compat.yml): checks EVERY extension in the catalog –
 * official (catalog/extensions.json) and community (catalog/community.json) – against the CURRENT SDK:
 *   1. download the listed package, verify its SHA-256
 *   2. sdk/check.js --strict (manifest, permissions, design, translations, security)
 *   3. API use: every Hostwerk.<name> the extension calls must still exist in sdk/hostwerk-sdk.js
 *   4. minimum version: manifest "hostwerk" must not be newer than the SDK
 * Result per entry: compat = { ok, checked, sdk, problems }. Hostwerk shows entries with compat.ok === false as
 * "doesn't fit the current version" instead of installing something broken. A summary goes to compat-report.md,
 * failing entries open (or update) one issue labelled "compat".
 *   node scripts/check-extension-compat.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { checkPackage, SDK_VERSION } = require('../sdk/check');

const FILES = ['catalog/extensions.json', 'catalog/community.json'];
const SDK_SRC = fs.readFileSync(path.join(__dirname, '..', 'sdk', 'hostwerk-sdk.js'), 'utf8');
const apiBlock = SDK_SRC.slice(SDK_SRC.indexOf('const api = {'), SDK_SRC.indexOf('window.Hostwerk = api'));
const TOP = new Set([...apiBlock.matchAll(/^ {4}(\w+)\s*[:(,]/gm)].map((m) => m[1]).concat([...apiBlock.matchAll(/^ {4}(\w+), (\w+),?$/gm)].flatMap((m) => [m[1], m[2]])));
const has = (name) => new RegExp(`\\b${name}\\s*[:(,]`).test(apiBlock);
// Unterobjekte (fmt, storage, minecraft …) können außerhalb des api-Blocks definiert sein → ganze SDK-Datei
const inSdk = (name) => new RegExp(`\\b${name}\\s*[:(,]`).test(SDK_SRC);
const cmp = (a, b) => { const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

function apiProblems(dir) {
  const out = new Set();
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|html)$/.test(e.name) ? [path.join(d, e.name)] : []));
  for (const f of walk(dir)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bHostwerk\.(\w+)(?:\.(\w+))?/g)) {
      if (!TOP.has(m[1]) && !has(m[1])) out.add(`Hostwerk.${m[1]} no longer exists`);
      else if (m[2] && !inSdk(m[2])) out.add(`Hostwerk.${m[1]}.${m[2]} no longer exists`);
    }
  }
  return [...out];
}

(async () => {
  const report = [];
  let failing = 0;
  for (const file of FILES) {
    if (!fs.existsSync(file)) continue;
    const list = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const e of list) {
      const problems = [];
      try {
        const r = await fetch(e.download, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
        if (!r.ok) throw new Error(`download ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (e.sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== e.sha256) problems.push('checksum changed');
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-'));
        fs.writeFileSync(path.join(tmp, 'p.zip'), buf);
        execFileSync('unzip', ['-qq', path.join(tmp, 'p.zip'), '-d', path.join(tmp, 'x')]);
        const c = checkPackage(path.join(tmp, 'x'), { strict: true });
        for (const x of c.errors) problems.push(x.msg);
        problems.push(...apiProblems(path.join(tmp, 'x')));
        const min = c.manifest && c.manifest.hostwerk && String(c.manifest.hostwerk).replace(/^>=\s*/, '');
        if (min && /^\d/.test(min) && c.manifest.sdk && cmp(c.manifest.sdk, SDK_VERSION) > 0) problems.push(`needs SDK ${c.manifest.sdk}, catalog has ${SDK_VERSION}`);
      } catch (err) { problems.push(err.message); }
      e.compat = { ok: problems.length === 0, checked: new Date().toISOString().slice(0, 10), sdk: SDK_VERSION, problems: problems.slice(0, 10) };
      if (problems.length) failing++;
      report.push(`| ${e.id} | ${e.version || ''} | ${problems.length ? '❌ ' + problems.join('; ') : '✅'} |`);
    }
    fs.writeFileSync(file, JSON.stringify(list, null, 2) + '\n');
  }
  const md = [`# Extension compatibility – SDK ${SDK_VERSION}`, '', `Checked ${new Date().toISOString().slice(0, 10)}: ${report.length} extensions, ${failing} with problems.`, '', '| Extension | Version | Result |', '|---|---|---|', ...report, ''].join('\n');
  fs.writeFileSync('compat-report.md', md);
  console.log(md);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `failing=${failing}\n`);
})();
