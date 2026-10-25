'use strict';
/*
 * Source check (weekly, .github/workflows/extension-sources.yml): is the author's repository of each community
 * extension still there? The catalog installs the checked copy in packages/, so a deleted repository breaks nothing –
 * but it means: no more updates, nobody to report problems to. Hostwerk shows such entries as "source deleted".
 *
 * Per entry: origin = { state, url, checked, since }
 *   ok        – repository / homepage answers
 *   archived  – GitHub repository archived (read-only, the author stopped)
 *   gone      – GitHub answers 404, or the homepage 404/410
 * Anything else (rate limit, timeout, server error) keeps the last state – a hiccup marks nothing.
 * Entries without homepage get no origin. A summary goes to sources-report.md; newly gone/archived entries are
 * counted in the step output "changed".
 *   node scripts/check-extension-sources.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join('catalog', 'community.json');
const GH = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?].*)?$/i;

/** State of one source – null = could not tell (keep the old state). */
async function sourceState(url, { fetch = globalThis.fetch, token = '' } = {}) {
  if (!/^https?:\/\//i.test(url || '')) return null;
  const gh = url.match(GH);
  try {
    if (gh) {
      const r = await fetch(`https://api.github.com/repos/${gh[1]}/${gh[2]}`, { headers: { 'User-Agent': 'hostwerk-catalog', Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.status === 404 || r.status === 451) return 'gone';
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.archived ? 'archived' : 'ok';
    }
    let r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'hostwerk-catalog' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { headers: { 'User-Agent': 'hostwerk-catalog' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (r.status === 404 || r.status === 410) return 'gone';
    return r.ok ? 'ok' : null;
  } catch { return null; }
}

/** Checks every entry, returns { list, changed: [{ id, from, to }] }. */
async function checkAll(list, opts = {}) {
  const today = opts.today || new Date().toISOString().slice(0, 10);
  const changed = [];
  const next = [];
  for (const e of list) {
    const url = e.homepage || null;
    const prev = e.origin || null;
    const state = url ? await sourceState(url, opts) : null;
    if (!url) { const { origin: _o, ...rest } = e; next.push(rest); continue; } // eslint-disable-line no-unused-vars
    if (!state) { next.push(e); continue; }
    const since = prev && prev.state === state && prev.url === url ? prev.since : today;
    if (state !== 'ok' && (!prev || prev.state !== state)) changed.push({ id: e.id, from: prev ? prev.state : null, to: state, url });
    next.push({ ...e, origin: { state, url, checked: today, since } });
  }
  return { list: next, changed };
}

function report(list, changed) {
  const bad = list.filter((e) => e.origin && e.origin.state !== 'ok');
  const lines = ['# Extension sources', '', `${list.length - bad.length} of ${list.length} community extensions have their source online (${new Date().toISOString().slice(0, 10)}).`, ''];
  if (changed.length) lines.push('## New since the last run', '', ...changed.map((c) => `- \`${c.id}\` → **${c.to}** (${c.url})`), '');
  if (bad.length) lines.push('## Marked in Hostwerk', '', ...bad.map((e) => `- \`${e.id}\` (@${e.submitter || '?'}) – ${e.origin.state} since ${e.origin.since}: ${e.origin.url}`), '', 'The checked copy stays installable. The author can withdraw the entry with the issue form "Withdraw an extension".');
  return lines.join('\n') + '\n';
}

module.exports = { sourceState, checkAll, report };

if (require.main === module) {
  (async () => {
    const list = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
    const { list: next, changed } = await checkAll(list, { token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '' });
    fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');
    // Older Hostwerk versions read katalog/community.json
    if (fs.existsSync('katalog')) fs.writeFileSync(path.join('katalog', 'community.json'), JSON.stringify(next, null, 2) + '\n');
    fs.writeFileSync('sources-report.md', report(next, changed));
    console.log(report(next, changed));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed.length}\n`);
  })().catch((e) => { console.error(e); process.exit(1); });
}
