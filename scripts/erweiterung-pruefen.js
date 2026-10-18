'use strict';
/*
 * Prüft eine eingereichte Hostwerk-Erweiterung (aus einem GitHub-Issue) und nimmt sie in katalog/community.json auf.
 * Läuft in der GitHub-Action .github/workflows/erweiterung-aufnehmen.yml – nur Node, keine Pakete.
 *
 *   node scripts/erweiterung-pruefen.js <issue-body-datei> <einreicher>
 *
 * Automatisch aufgenommen werden nur reine Seiten (laufen in Hostwerk abgeschottet, ändern nur nach Rückfrage).
 * Erweiterungen mit Dienst („command“ – startet Programme auf dem PC) brauchen eine Prüfung von Hand.
 * Ergebnis als JSON auf stdout: { ok, auto, id, version, message }.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const MAX = 10 * 1048576;
const BAD = /\.(exe|dll|bat|cmd|ps1|psm1|vbs|scr|msi|jar|sh|com|so|dylib|node)$/i;
const RESERVED = new Set(['status-wand', 'spieler-ticker']); // eingebaute Beispiele

const out = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
const field = (body, label) => { const m = body.match(new RegExp(`### ${label}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`)); const v = m ? m[1].trim() : ''; return v === '_No response_' ? '' : v; };

(async () => {
  const body = fs.readFileSync(process.argv[2], 'utf8');
  const submitter = String(process.argv[3] || '').trim();
  const link = field(body, 'Link zum Paket');
  if (!/^https:\/\//.test(link)) out({ ok: false, message: 'Bitte einen https-Link zum Paket (ZIP) angeben – z. B. den Teilen-Link aus Hostwerk oder einen GitHub-Release.' });
  const res = await fetch(link, { headers: { 'User-Agent': 'Hostwerk-Katalog' }, redirect: 'follow', signal: AbortSignal.timeout(60000) }).catch((e) => out({ ok: false, message: `Link nicht erreichbar: ${e.message}` }));
  if (!res.ok) out({ ok: false, message: `Link antwortet mit ${res.status}.` });
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX) out({ ok: false, message: 'Das Paket ist größer als 10 MB.' });
  if (buf.readUInt32LE(0) !== 0x04034b50) out({ ok: false, message: 'Das ist kein ZIP-Paket.' });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'erw-'));
  fs.writeFileSync(path.join(tmp, 'p.zip'), buf);
  try { execFileSync('unzip', ['-qq', path.join(tmp, 'p.zip'), '-d', path.join(tmp, 'x')]); } catch { out({ ok: false, message: 'Das ZIP lässt sich nicht entpacken.' }); }
  let root = path.join(tmp, 'x');
  if (!fs.existsSync(path.join(root, 'manifest.json'))) {
    const sub = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
    if (sub.length === 1 && fs.existsSync(path.join(root, sub[0].name, 'manifest.json'))) root = path.join(root, sub[0].name);
    else out({ ok: false, message: 'Im Paket fehlt „manifest.json“.' });
  }
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')); } catch (e) { out({ ok: false, message: `manifest.json ist kein gültiges JSON: ${e.message}` }); }
  if (!ID_RE.test(m.id || '')) out({ ok: false, message: '„id“ fehlt oder ist ungültig (nur a–z, 0–9 und -, 2–40 Zeichen).' });
  if (RESERVED.has(m.id)) out({ ok: false, message: `Die Kennung „${m.id}“ ist für ein eingebautes Beispiel reserviert.` });
  if (!m.name) out({ ok: false, message: '„name“ fehlt.' });
  if (!m.page && !m.command) out({ ok: false, message: 'Die Erweiterung braucht eine Seite („page“) oder einen Dienst („command“).' });
  if (m.page && (!m.page.file || /\.\./.test(m.page.file) || !fs.existsSync(path.join(root, m.page.file)))) out({ ok: false, message: '„page.file“ fehlt oder zeigt auf keine Datei im Paket.' });
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(path.relative(root, f)); } };
  walk(root);
  const bad = files.filter((f) => BAD.test(f));
  const katalog = path.join('katalog', 'community.json');
  const list = fs.existsSync(katalog) ? JSON.parse(fs.readFileSync(katalog, 'utf8')) : [];
  const prev = list.find((x) => x.id === m.id);
  if (prev && prev.submitter && prev.submitter !== submitter) out({ ok: false, message: `Die Kennung „${m.id}“ gehört schon zu einer Erweiterung von @${prev.submitter}. Bitte eine andere Kennung wählen.` });
  const version = String(m.version || '1.0.0').replace(/[^\w.-]/g, '').slice(0, 20) || '1.0.0';
  // Dienste und ausführbare Dateien: nicht automatisch
  if (m.command || bad.length) out({ ok: true, auto: false, id: m.id, version, message: `Braucht eine Prüfung von Hand: ${m.command ? 'die Erweiterung startet einen Dienst (Programm auf dem PC)' : ''}${m.command && bad.length ? ' und ' : ''}${bad.length ? `enthält ausführbare Dateien (${bad.slice(0, 5).join(', ')})` : ''}.` });
  // Aufnehmen: geprüfte Kopie im Repository (der ursprüngliche Link muss danach nicht mehr erreichbar sein)
  fs.mkdirSync('pakete', { recursive: true });
  const file = `pakete/${m.id}-${version}.zip`;
  fs.writeFileSync(file, buf);
  for (const old of fs.readdirSync('pakete')) if (old.startsWith(`${m.id}-`) && `pakete/${old}` !== file) fs.rmSync(path.join('pakete', old));
  const repo = process.env.GITHUB_REPOSITORY || 'Passimoritz/hostwerk-public';
  const entry = {
    id: m.id, name: String(m.name).slice(0, 60), description: String(m.description || field(body, 'Beschreibung') || '').slice(0, 300), author: String(m.author || submitter).slice(0, 60),
    version, page: true, service: false, homepage: m.homepage || null, download: `https://raw.githubusercontent.com/${repo}/main/${file}`,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'), submitter, updated: new Date().toISOString().slice(0, 10),
  };
  const next = [...list.filter((x) => x.id !== m.id), entry].sort((a, b) => a.name.localeCompare(b.name));
  fs.mkdirSync('katalog', { recursive: true });
  fs.writeFileSync(katalog, JSON.stringify(next, null, 2) + '\n');
  out({ ok: true, auto: true, id: m.id, version, message: `${prev ? 'Aktualisiert' : 'Aufgenommen'}: „${entry.name}“ ${version} – erscheint in Hostwerk unter Apps → Erweiterungen → Marktplatz (Quelle „Community“).` });
})().catch((e) => out({ ok: false, message: `Prüfung fehlgeschlagen: ${e.message}` }));
