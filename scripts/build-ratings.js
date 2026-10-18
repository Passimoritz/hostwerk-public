'use strict';
/*
 * Ratings for the extension catalog – without a server: every extension gets one GitHub issue
 * ("Rating: <id>", label "rating"). People rate by reacting to it:
 *   👍 ❤️ 🎉 🚀 = good · 👎 😕 = bad
 * This script (daily via .github/workflows/extension-ratings.yml) creates missing issues, counts the reactions and
 * writes catalog/ratings.json → { "<id>": { "stars": 4.4, "votes": 12, "url": "https://github.com/…/issues/7" } }.
 * Stars use a small prior (two neutral votes), so one single vote cannot make 1 or 5 stars.
 *   node scripts/build-ratings.js            (needs GH_TOKEN with issues: write and GITHUB_REPOSITORY)
 *   node scripts/build-ratings.js --dry-run  (only reads, creates nothing)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO = process.env.GITHUB_REPOSITORY || 'Passimoritz/hostwerk-public';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const DRY = process.argv.includes('--dry-run');
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const H = { 'User-Agent': 'hostwerk-ratings', Accept: 'application/vnd.github+json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

const GOOD = ['+1', 'heart', 'hooray', 'rocket'];
const BAD = ['-1', 'confused'];

async function gh(p, opts = {}) {
  const r = await fetch(`${API}${p}`, { ...opts, headers: { ...H, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) throw new Error(`GitHub ${r.status} for ${p}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function ids() {
  const out = new Map();
  for (const f of ['extensions.json', 'community.json', 'verified.json']) {
    let j = null; try { j = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', f), 'utf8')); } catch { continue; }
    for (const x of (Array.isArray(j) ? j : j.items || j.extensions || [])) if (x && x.id && !out.has(x.id)) out.set(x.id, typeof x.name === 'object' ? x.name.en || x.name.de : x.name || x.id);
  }
  return out;
}

function stars(good, bad) {
  const votes = good + bad;
  // Prior: zwei neutrale Stimmen (3 Sterne) – eine einzelne Stimme kippt nichts
  const score = (good * 5 + bad * 1 + 2 * 3) / (votes + 2);
  return { stars: Math.round(score * 10) / 10, votes };
}

(async () => {
  const list = ids();
  // Vorhandene Bewertungs-Issues (offen und geschlossen)
  const issues = [];
  for (let page = 1; page < 20; page++) {
    const batch = await gh(`/repos/${REPO}/issues?labels=rating&state=all&per_page=100&page=${page}`);
    issues.push(...batch.filter((i) => !i.pull_request));
    if (batch.length < 100) break;
  }
  const byId = new Map(issues.map((i) => [String(i.title).replace(/^Rating:\s*/i, '').trim(), i]));
  const out = {};
  for (const [id, name] of list) {
    let issue = byId.get(id);
    if (!issue && !DRY && TOKEN) {
      issue = await gh(`/repos/${REPO}/issues`, { method: 'POST', body: JSON.stringify({ title: `Rating: ${id}`, labels: ['rating'], body: `**${name}** (\`${id}\`)\n\nRate this extension by reacting to this post:\n\n- 👍 ❤️ 🎉 🚀 – good\n- 👎 😕 – not good\n\nHostwerk shows the result as stars in the extension marketplace (updated daily). Comments with ideas or problems are welcome.\n\n---\nBewerte diese Erweiterung mit einer Reaktion auf diesen Beitrag – Hostwerk zeigt das Ergebnis als Sterne im Marktplatz.` }) });
      console.log(`+ issue for ${id}: ${issue.html_url}`);
    }
    if (!issue) { console.log(`- ${id}: no rating issue yet`); continue; }
    const r = issue.reactions || {};
    const good = GOOD.reduce((n, k) => n + (r[k] || 0), 0);
    const bad = BAD.reduce((n, k) => n + (r[k] || 0), 0);
    out[id] = { ...stars(good, bad), url: issue.html_url };
    console.log(`✓ ${id}: ${out[id].stars} ★ (${out[id].votes})`);
  }
  const file = path.join(ROOT, 'catalog', 'ratings.json');
  if (DRY) { console.log(JSON.stringify(out, null, 1)); return; }
  fs.writeFileSync(file, JSON.stringify({ updated: new Date().toISOString(), ratings: out }, null, 1) + '\n');
  console.log(`→ ${path.relative(ROOT, file)}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
