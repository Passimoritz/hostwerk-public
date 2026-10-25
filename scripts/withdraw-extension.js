'use strict';
/*
 * Withdraws an extension from the community catalog (issue form "Withdraw an extension",
 * .github/workflows/withdraw-extension.yml). Plain Node, no packages.
 *
 *   node scripts/withdraw-extension.js <issue-body-file> <who> [--approved] [--dry-run]
 *
 * Who may withdraw: the person who submitted the extension (field "submitter" in catalog/community.json) – at once.
 * Anyone else (e.g. the author lost the account) waits for a person: label "approved" → withdrawn.
 * Withdrawing removes the entry and the checked copy in packages/. The id stays reserved for its submitter in
 * catalog/withdrawn.json, so nobody else can later publish "updates" under that id to people who still have it.
 * Hostwerk keeps installed copies – they keep working, there are just no updates any more.
 * Result as JSON on stdout: { ok, id, review, message }.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const APPROVED = args.includes('--approved');
const DRY = args.includes('--dry-run');
const [bodyFile, whoArg] = args.filter((a) => !a.startsWith('--'));
const ID_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

const out = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const field = (body, ...labels) => {
  for (const label of labels) {
    const m = body.match(new RegExp(`### ${label}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`));
    const v = m ? m[1].trim() : '';
    if (v && v !== '_No response_') return v;
  }
  return '';
};
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const write = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n'); };

const body = fs.readFileSync(bodyFile, 'utf8');
const who = String(whoArg || '').trim();
const id = field(body, 'Extension ID', 'Erweiterungs-ID').replace(/`/g, '').trim().toLowerCase();
const reason = field(body, 'Reason', 'Grund').slice(0, 300);
if (!ID_RE.test(id)) out({ ok: false, id, message: `"${id}" is not a valid extension id (a–z, 0–9, -).` });

const catalogFile = path.join('catalog', 'community.json');
const list = readJson(catalogFile, []);
const entry = list.find((x) => x.id === id);
if (!entry) out({ ok: false, id, message: `"${id}" is not in the community catalog – nothing to withdraw. (Official extensions are not withdrawn this way.)` });

const own = !!entry.submitter && entry.submitter.toLowerCase() === who.toLowerCase();
if (!own && !APPROVED) out({ ok: true, id, review: true, message: `"${id}" was submitted by @${entry.submitter || 'unknown'}, not by @${who}. A person checks the request – with the label "approved" it is withdrawn.` });
if (DRY) out({ ok: true, id, review: false, dryRun: true, message: `Would withdraw "${id}" ${entry.version}.` });

const next = list.filter((x) => x.id !== id);
write(catalogFile, next);
// Older Hostwerk versions read katalog/community.json
write(path.join('katalog', 'community.json'), next);
// Checked copy and icon
if (fs.existsSync('packages')) for (const f of fs.readdirSync('packages')) if (f.startsWith(`${id}-`) || f === `${id}.svg` || f === `${id}.png`) fs.rmSync(path.join('packages', f));
// The id stays with its submitter (scripts/check-extension.js refuses it for anyone else)
const withdrawnFile = path.join('catalog', 'withdrawn.json');
const withdrawn = readJson(withdrawnFile, []).filter((x) => x.id !== id);
withdrawn.push({ id, submitter: entry.submitter || null, version: entry.version || null, at: new Date().toISOString().slice(0, 10), by: who, ...(reason ? { reason } : {}) });
write(withdrawnFile, withdrawn.sort((a, b) => a.id.localeCompare(b.id)));
out({ ok: true, id, review: false, message: `Withdrawn: "${id}" ${entry.version} is no longer in the catalog. People who installed it keep it, without updates. The id stays reserved for @${entry.submitter || who}.` });
