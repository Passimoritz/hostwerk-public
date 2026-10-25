#!/usr/bin/env node
'use strict';
/*
 * Explainer videos of an extension (SDK 3.5): upload <id>.mp4 (and <id>.vtt subtitles) to the release "videos" of the
 * extension's GitHub repository and write each video's version (first 12 characters of its SHA-256) into the list.
 * Installed Hostwerks then fetch new versions by themselves – no new extension version needed for a better video.
 *
 *   node publish-videos.js <extension folder>            files from <folder>/videos-release/ (keep that folder out of git)
 *   node publish-videos.js <extension folder> --dry-run  only show what would happen
 *
 * The list is the file named in manifest.json → "videos" (e.g. videos/index.json):
 *   [{ "id": "tour", "lang": "en", "title": "My extension – the tour", "seconds": 60 },
 *    { "id": "tour-de", "lang": "de", "title": "Meine Erweiterung – der Rundgang", "seconds": 60 },
 *    { "id": "tour-voice", "lang": "en", "title": "…", "seconds": 60, "voice": true, "of": "tour", "section": "stimme" }]
 * Repository: manifest "videosRepo", otherwise "homepage" (https://github.com/owner/repo). Needs the GitHub CLI (gh auth login).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const dir = path.resolve(process.argv[2] || '.');
const DRY = process.argv.includes('--dry-run');
const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
if (typeof m.videos !== 'string') { console.error('manifest.json has no "videos" list.'); process.exit(1); }
const repo = ((/github\.com\/([\w.-]+\/[\w.-]+)/.exec(m.videosRepo || m.homepage || '') || [])[1] || '').replace(/\.git$/, '');
if (!repo) { console.error('Set "videosRepo" or "homepage" to your GitHub repository.'); process.exit(1); }
const listFile = path.join(dir, m.videos);
const list = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const src = path.join(dir, 'videos-release');
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const files = [];
for (const v of list) {
  const f = path.join(src, `${v.id}.mp4`);
  if (!fs.existsSync(f)) { console.log(`– ${v.id}: no file in videos-release/, skipped`); continue; }
  v.version = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
  files.push(f);
  const vtt = path.join(src, `${v.id}.vtt`);
  if (fs.existsSync(vtt)) {
    if (!/^WEBVTT/.test(fs.readFileSync(vtt, 'utf8').replace(/^﻿/, ''))) throw new Error(`${v.id}.vtt is not a WebVTT file`);
    files.push(vtt);
  }
}
console.log(`${repo} · release "videos" · ${files.length} file(s)`);
if (DRY) { for (const f of files) console.log('  ' + path.basename(f)); process.exit(0); }
try { gh(['release', 'view', 'videos', '-R', repo]); } catch {
  gh(['release', 'create', 'videos', '-R', repo, '--title', 'Explainer videos', '--notes', 'Explainer videos of this extension – Hostwerk loads them by itself (SDK 3.5).', '--latest=false']);
}
// Liste ebenfalls ins Release (videos.json), damit die Fassungen ohne neues Paket bekannt sind
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hw-videos-')), 'videos.json');
fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
gh(['release', 'upload', 'videos', '-R', repo, '--clobber', tmp, ...files]);
fs.writeFileSync(listFile, JSON.stringify(list, null, 2) + '\n');
console.log(`✓ uploaded – versions written to ${m.videos}`);
