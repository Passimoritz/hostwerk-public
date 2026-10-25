'use strict';
/*
 * Builds the official extension catalog (catalog/extensions.json) from the latest GitHub release of every repository
 * in catalog/extension-repos.json – runs daily in .github/workflows/extension-catalog.yml, so a new release of an
 * official extension reaches every Hostwerk without any manual step.
 *
 * Per repository: latest release → <id>-<version>.zip + .sha256 → checksum must match → sdk/check.js --strict →
 * entry with names/descriptions (German + English), permissions, icon, download link and SHA-256.
 * A repository whose newest release fails the check keeps its previous catalog entry (nothing breaks).
 *
 *   node scripts/build-extension-catalog.js          (GH_TOKEN optional – raises the API limit)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { checkPackage, scopes, text } = require('../sdk/check');

const REPOS = path.join('catalog', 'extension-repos.json');
const OUT = path.join('catalog', 'extensions.json');
const headers = { 'User-Agent': 'Hostwerk-Catalog', Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) };
const get = async (url, raw = false) => { const r = await fetch(url, { headers: raw ? { 'User-Agent': 'Hostwerk-Catalog' } : headers, redirect: 'follow', signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${url} → ${r.status}`); return raw ? Buffer.from(await r.arrayBuffer()) : r.json(); };

(async () => {
  const repos = JSON.parse(fs.readFileSync(REPOS, 'utf8'));
  const before = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const next = [];
  const log = [];
  for (const repo of repos) {
    const name = typeof repo === 'string' ? repo : repo.repo;
    try {
      const rel = await get(`https://api.github.com/repos/${name}/releases/latest`);
      const zip = rel.assets.find((a) => /\.zip$/.test(a.name));
      const shaAsset = rel.assets.find((a) => a.name === `${zip && zip.name}.sha256`);
      if (!zip) throw new Error('release without .zip');
      const buf = await get(zip.browser_download_url, true);
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      if (shaAsset) { const want = String(await get(shaAsset.browser_download_url, true)).trim().split(/\s/)[0]; if (want !== sha) throw new Error('checksum does not match the .sha256 file'); }
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-'));
      fs.writeFileSync(path.join(tmp, 'p.zip'), buf);
      execFileSync('unzip', ['-qq', path.join(tmp, 'p.zip'), '-d', path.join(tmp, 'x')]);
      const r = checkPackage(path.join(tmp, 'x'), { strict: true });
      if (!r.ok) throw new Error(`check failed: ${r.errors.map((e) => e.msg).join(' · ')}`);
      const m = r.manifest;
      const raw = (f) => `https://raw.githubusercontent.com/${name}/${rel.tag_name}/${f}`;
      next.push({
        id: m.id, name: m.name, description: m.description, author: m.author || name.split('/')[0], version: m.version,
        page: !!m.page, widget: !!m.widget, service: !!m.command, permissions: scopes(m.permissions), hostwerk: m.hostwerk || null, sdkVersion: m.sdkVersion || null,
        homepage: `https://github.com/${name}`, icon: m.icon ? raw(m.icon) : null,
        download: zip.browser_download_url, sha256: sha, score: r.score, released: (rel.published_at || '').slice(0, 10),
        // SDK 2.7: category, colour, banner, screenshots, dependencies on other extensions, native code, changelog
        category: m.category || 'other', color: m.color || null, banner: m.banner ? raw(m.banner) : null,
        screenshots: (Array.isArray(m.screenshots) ? m.screenshots : []).slice(0, 6).map(raw),
        requires: m.requires && typeof m.requires === 'object' ? m.requires : {},
        // SDK 3.8: abgelöste Erweiterungen – wer eine davon hat, bekommt diese als Nachfolger
        replaces: Array.isArray(m.replaces) ? m.replaces : [],
        native: (m.permissions || []).includes('native') && !!(m.backend || m.ui),
        changelog: fs.existsSync(path.join(tmp, 'x', 'CHANGELOG.md')) ? raw('CHANGELOG.md') : null,
      });
      log.push(`✓ ${name} ${m.version} (${r.score}/100)`);
    } catch (e) {
      const old = before.find((x) => x.homepage === `https://github.com/${name}`);
      if (old) next.push(old);
      log.push(`✗ ${name}: ${e.message}${old ? ' – kept previous entry' : ''}`);
    }
  }
  next.sort((a, b) => text(a.name, 'en').localeCompare(text(b.name, 'en')));
  fs.writeFileSync(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log(log.join('\n'));
  console.log(`${next.length} extension(s) in ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
