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

const SDK_VERSION = '3.7.0';
/*
 * Stabilitätsversprechen (SDK 3.0, Anleitung Abschnitt 18 „Stabilität und Abkündigungen“):
 *  - SemVer: Alles, was SDK 3.0 dokumentiert (window.Hostwerk, Manifest-Felder, Rechte, contributes), läuft mit jeder
 *    Hostwerk-Version 3.x. Minor-Versionen fügen nur hinzu, Patch-Versionen korrigieren nur.
 *  - Entfernt wird nur mit einer neuen Hauptversion – und erst, wenn es mindestens zwei Minor-Versionen UND 12 Monate
 *    lang abgekündigt war (DEPRECATIONS unten, der Prüfer warnt davor mit Datum und Ersatz).
 *  - Experimentelle Schnittstellen (EXPERIMENTAL) gelten nicht als versprochen: nur mit Opt-in im Manifest
 *    ("experimental": ["name"]), nicht im Katalog (--strict), und sie dürfen sich in jeder Version ändern.
 *  - "sdkVersion" im Manifest sagt, für welches SDK die Erweiterung geschrieben ist ("3.0"); "hostwerk" kann neben der
 *    Mindestversion eine Höchstversion haben ({ "min": "3.0.0", "max": "3.x" }).
 */
const SDK_MAJOR = Number(SDK_VERSION.split('.')[0]);
const SDK_MINOR = Number(SDK_VERSION.split('.')[1]);
/**
 * Abkündigungen. Jeder Eintrag: seit welcher SDK-Version, wann angekündigt, frühestens entfernt in (Hauptversion) und
 * nicht vor (Datum), Ersatz und eine Prüfung am Manifest. scripts/ext-platform-test.js hält die Regeln ein (≥ 2 Minor-
 * Versionen und ≥ 12 Monate, Entfernen nur mit neuer Hauptversion).
 */
const DEPRECATIONS = [
  { id: 'permissions-read-write', since: '3.0.0', announced: '2026-10-21', removeIn: '4.0.0', notBefore: '2027-10-21', code: 'permissions',
    test: (m) => (Array.isArray(m.permissions) ? m.permissions : []).some((p) => p === 'read' || p === 'write'),
    msg: 'Old permissions "read"/"write" – please name exact scopes (e.g. "read:minecraft").' },
  { id: 'nav-group-extensions', since: '3.0.0', announced: '2026-10-21', removeIn: '4.0.0', notBefore: '2027-10-21', code: 'page.nav',
    test: (m) => !!(m.page && m.page.nav && m.page.nav.group === 'extensions'),
    msg: '"extensions" is no longer an area (Hostwerk 2.11) – choose "server", "develop", "system" or an own area. Until then Hostwerk places the page by its category.' },
];
/**
 * Kern-Interna, die native Erweiterungen bis SDK 3.2 benutzen mussten – seit SDK 3.3 gibt es stabile Dienste dafür
 * (services/extapi.js). Die Interna bleiben vorerst als Rückfall; der Prüfer weist auf den Ersatz hin (Hinweis, kein
 * Abzug), solange der Code nicht zuerst den stabilen Dienst fragt (host.supports / host.ai …).
 */
const INTERNALS = [
  { re: /ctx\.ai\.quick|ctx\.ai && [\w.]*ai\.quick/, use: 'host.ai.quick', stable: /host\.ai\b|\.ai\.quick\.run|supports\(\s*['"]ai\.quick/ },
  { re: /minecraft\.readMeta|minecraft\.addonDir/, use: 'host.minecraft.addons()', stable: /\.minecraft\.addons\s*\(|supports\(\s*['"]minecraft\.addons/ },
  { re: /ctx\.patchUpdates\.(pending|apply)|patchUpdates\.pending|patchUpdates\.apply/, use: 'host.updates.pending() / apply()', stable: /\.updates\.(pending|apply)\s*\(|supports\(\s*['"]updates\./ },
  { re: /core\(\s*['"]download['"]\s*\)\.isOffline/, use: 'host.net.offline()', stable: /\.net\.offline\s*\(/ },
  { re: /ctx\.sshKeys\.dir/, use: 'host.sshKeys.import()', stable: /\.sshKeys\.import\s*\(/ },
];
/** Spuren außerhalb des eigenen Ordners, die der Prüfer im Server-Code erkennt (SDK 3.3, host.traces.add) */
const TRACE_PATTERNS = [
  { kind: 'task', re: /Register-ScheduledTask|schtasks(\.exe)?['"]?\s*,\s*\[\s*['"]\/Create|schtasks(\.exe)?\s+\/Create/i },
  { kind: 'registry', re: /reg(\.exe)?['"]\s*,\s*\[\s*['"]add['"]|New-ItemProperty|Set-ItemProperty\s+-Path\s+['"]?(HK|Registry::)/i },
  { kind: 'service', re: /New-Service\b|sc(\.exe)?['"]\s*,\s*\[\s*['"]create['"]|systemctl['"]\s*,\s*\[[^\]]*['"]enable['"]/i },
  { kind: 'dir', re: /ProgramData[\s\S]{0,300}(mkdirSync|writeFileSync|New-Item|Set-Content|Out-File|WriteAllText)|(mkdirSync|writeFileSync|New-Item|Set-Content|Out-File|WriteAllText)[\s\S]{0,300}ProgramData/ },
];
/** Experimentelle Schnittstellen (Name → Beschreibung und Mitglieder von window.Hostwerk). Derzeit keine. */
const EXPERIMENTAL = {};
/** Text zu einer Abkündigung für Prüfer und Anleitung. */
const deprecationText = (d) => `${d.msg} Deprecated since SDK ${d.since} (${d.announced}); removed no earlier than SDK ${d.removeIn} and not before ${d.notBefore}.`;
/** "sdkVersion" → { major, minor } oder null. */
function parseSdk(v) { const mm = /^(\d+)\.(\d+)(\.\d+)?$/.exec(String(v || '')); return mm ? { major: Number(mm[1]), minor: Number(mm[2]) } : null; }
/** Läuft eine für SDK v geschriebene Erweiterung mit diesem SDK? Gleiche Hauptversion bis zur eigenen Minor; ältere Hauptversion (2.x): ja. */
function sdkFits(v, sdk = SDK_VERSION) {
  if (v == null || v === '') return true;
  const x = parseSdk(v); const s = parseSdk(sdk);
  if (!x || !s) return false;
  return x.major < s.major || (x.major === s.major && x.minor <= s.minor);
}
/** "hostwerk" im Manifest: ">=3.0.0" (nur Mindestversion) oder { "min": "3.0.0", "max": "3.x" } → { min, max } (null = egal). */
function hostwerkRange(h) {
  if (!h) return null;
  if (typeof h === 'string') { const mm = /^>=\s*(\d+\.\d+\.\d+)$/.exec(h.trim()); return mm ? { min: mm[1], max: null } : { min: h.replace(/^>=\s*/, '').trim(), max: null }; }
  if (typeof h === 'object') return { min: h.min ? String(h.min) : null, max: h.max ? String(h.max) : null };
  return null;
}
/** Passt diese Hostwerk-Version? max: "3.x", "3.4.x" oder eine genaue Version (einschließlich). */
function hostwerkFits(version, h) {
  const r = hostwerkRange(h);
  if (!r) return true;
  if (r.min && cmpVer(version, r.min) < 0) return false;
  if (r.max) {
    const want = r.max.split('.'); const have = String(version || '0.0.0').split(/[.-]/).map(Number);
    for (let i = 0; i < 3; i++) {
      if (want[i] === undefined || /^[x*]$/i.test(want[i])) return true;
      const w = Number(want[i]);
      if ((have[i] || 0) < w) return true;
      if ((have[i] || 0) > w) return false;
    }
  }
  return true;
}
const MAX_RE = /^\d+(\.(\d+|x))?(\.(\d+|x))?$/i;
/** Zum Anzeigen: "3.0.0" oder "3.0.0 – 3.x" (null = keine Angabe). */
function hostwerkLabel(h) { const r = hostwerkRange(h); return r ? (r.max ? `${r.min || '0.0.0'} – ${r.max}` : r.min) : null; }
/** Categories of the extension page (SDK 2.7) – one per extension, shown as filter chips. */
const CATEGORIES = {
  games: { de: 'Spiele & Minecraft', en: 'Games & Minecraft' },
  network: { de: 'Netzwerk & Rechner', en: 'Network & machines' },
  security: { de: 'Sicherheit & Zugänge', en: 'Security & access' },
  monitoring: { de: 'Überwachung & Status', en: 'Monitoring & status' },
  developer: { de: 'Entwickeln', en: 'Developer tools' },
  ai: { de: 'KI & Medien', en: 'AI & media' },
  communication: { de: 'E-Mail & Kommunikation', en: 'Mail & communication' },
  data: { de: 'Sicherung & Dateien', en: 'Backup & files' },
  productivity: { de: 'Notizen & Werkzeuge', en: 'Notes & tools' },
  language: { de: 'Sprachen', en: 'Languages' },
  other: { de: 'Sonstiges', en: 'Other' },
};
/** Version range of a dependency: ">=1.2.0", "^1.2.0", "1.2.0" or "*". */
const RANGE_RE = /^(\*|(>=|\^|~)?\s*\d+\.\d+\.\d+)$/;
const cmpVer = (a, b) => { const x = String(a).split(/[.-]/).map(Number), y = String(b).split(/[.-]/).map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
/** Does VERSION satisfy RANGE? >=: at least · ^: same major, at least · ~: same minor, at least · plain: exactly. */
function satisfies(version, range) {
  const r = String(range || '*').trim();
  if (r === '*' || !r) return true;
  const m = r.match(/^(>=|\^|~)?\s*(\d+\.\d+\.\d+)$/);
  if (!m) return false;
  const [op, want] = [m[1] || '=', m[2]];
  const v = String(version || '0.0.0').split(/[.-]/).map(Number), w = want.split('.').map(Number);
  if (cmpVer(version, want) < 0) return false;
  if (op === '^') return v[0] === w[0];
  if (op === '~') return v[0] === w[0] && v[1] === w[1];
  if (op === '=') return cmpVer(version, want) === 0;
  return true;
}
/** Permission scopes and what they allow (GET = read, POST = change after confirmation). */
const PERMISSIONS = {
  'read:services': { de: 'Dienste und ihren Zustand sehen', en: 'See services and their state', read: [/^\/overview$/] },
  'read:web': { de: 'Webserver lesen', en: 'Read web servers', read: [/^\/web(\/[\w-]+)?$/] },
  'read:databases': { de: 'Datenbankserver lesen', en: 'Read database servers', read: [/^\/dbs(\/[\w-]+)?$/] },
  'read:minecraft': { de: 'Minecraft-Server, Spieler und Statistiken lesen', en: 'Read Minecraft servers, players and stats', read: [/^\/mc\/servers(\/[\w-]+(\/(players|stats|worlds))?)?$/] },
  'read:apps': { de: 'Apps lesen', en: 'Read apps', read: [/^\/apps$/] },
  'read:tasks': { de: 'Aufgaben lesen', en: 'Read scheduled tasks', read: [/^\/tasks$/] },
  'read:mail': { de: 'Abgefangene E-Mails lesen', en: 'Read captured e-mails', read: [/^\/mail(\/messages)?$/] },
  'read:system': { de: 'Systemzustand, Auslastung, Ports und Speicher je Dienst lesen', en: 'Read system health, load, ports and storage per service', read: [/^\/system\/(health|info|resources|ports|disk-usage|ports\/free)$/] }, // info seit SDK 3.2
  // Seit SDK 2.10: Spiele-Server (Erweiterung „Spiele-Server“) – Liste, Zustand, Spieler (A2S), ohne Passwörter/Konsole
  'read:games': { de: 'Spiele-Server und ihre Spieler lesen', en: 'Read game servers and their players', read: [/^\/games$/, /^\/games\/[\w-]+(\/players)?$/, /^\/games-players$/] },
  // Seit SDK 2.10: belegten Port eines gestoppten Hostwerk-Dienstes auf einen freien umstellen (wie System → Ports)
  'change:ports': { de: 'Port eines gestoppten Dienstes auf einen freien umstellen (mit Rückfrage)', en: 'Move a stopped service to a free port (asks first)', write: [/^\/system\/ports\/fix$/] },
  // Seit SDK 2.4: Livebetrieb – Zertifikate (mit Restlaufzeit) und Erreichbarkeit, ohne Alarm-Ziele, Schlüssel oder Zugänge
  'read:live': { de: 'Zertifikate und Erreichbarkeit (Überwachung) lesen', en: 'Read certificates and uptime checks', read: [/^\/live\/(certs|uptime)$/] },
  'read:network': { de: 'Router, Rechner und Sicherheitslage lesen', en: 'Read router, machines and security status', read: [/^\/(router|machines|live\/security)$/] },
  'control:services': { de: 'Dienste starten, stoppen, neu starten (mit Rückfrage)', en: 'Start, stop, restart services (asks first)', write: [/^\/(web|dbs|apps|mail|mc\/servers|games)\/[\w-]+\/(start|stop|restart)$/, /^\/mail\/(start|stop)$/] },
  'command:minecraft': { de: 'Befehle an Minecraft-Server senden (mit Rückfrage)', en: 'Send commands to Minecraft servers (asks first)', write: [/^\/mc\/servers\/[\w-]+\/command$/] },
  'run:tasks': { de: 'Aufgaben ausführen (mit Rückfrage)', en: 'Run scheduled tasks (asks first)', write: [/^\/tasks\/[\w-]+\/run$/] },
  // Seit SDK 2.2: Hostwerk-Funktionen ändern – jede Änderung bestätigt der Nutzer einzeln
  'change:minecraft': { de: 'Minecraft-Einstellungen ändern: server.properties, Spielregeln, Symbol, Plugins an/aus, Sicherung anlegen (mit Rückfrage)', en: 'Change Minecraft settings: server.properties, game rules, icon, plugins on/off, create backups (asks first)', write: [/^\/mc\/servers\/[\w-]+\/(properties|gamerules|icon|backups|plugins\/toggle)$/] },
  'change:databases': { de: 'Datenbank-Sicherungen anlegen (mit Rückfrage)', en: 'Create database backups (asks first)', write: [/^\/dbs\/[\w-]+\/backups$/] },
  'change:mail': { de: 'Test-Mails in den Mail-Fänger schicken, Mails als gelesen markieren (mit Rückfrage)', en: 'Send test mails to the mail catcher, mark mails as read (asks first)', write: [/^\/mail\/(compose|read-all)$/] },
  // Seit SDK 2.3: Wissensgraph (Motor in Hostwerk, Oberfläche als Erweiterung). quiet = ohne Rückfrage je Aufruf (nur Daten
  // des Wissensgraphen selbst); alles, was Dateien in Projekten oder Claudes Anbindung ändert, fragt immer.
  'read:knowledge': { de: 'Wissensgraph lesen: Projekte, Graph, Bericht, Fragenverlauf, Gedächtnis, Claude-Status', en: 'Read the knowledge graph: projects, graph, report, question history, memory, Claude status', read: [/^\/knowledge$/, /^\/knowledge\/notes$/, /^\/knowledge\/[\w.-]+\/(graph|report|questions|memory|claude)$/, /^\/claude\/(status|connect\/code)$/] },
  'change:knowledge': { de: 'Wissensgraph bauen und abfragen, Ordner aufnehmen, Gedächtnis pflegen, eigene Notizen als Knoten eintragen, Obsidian-Export', en: 'Build and query the knowledge graph, add folders, edit memory, add own notes as nodes, Obsidian export', quiet: true, write: [/^\/knowledge$/, /^\/knowledge\/notes$/, /^\/knowledge\/folders(\/[\w.-]+)?$/, /^\/knowledge\/[\w.-]+\/(build|options|query|explain|path|memory(\/[\w-]+)?|obsidian\/(export|sync|notes|import))$/] },
  'connect:claude': { de: 'KI einbinden und wieder vergessen (Claude, Codex, Gemini …: schreibt markierte Abschnitte in Projekte – mit Rückfrage)', en: 'Connect an AI and forget it again (Claude, Codex, Gemini …: writes marked sections into projects – asks first)', write: [/^\/knowledge\/[\w.-]+\/claude\/(connect|repair|forget)$/, /^\/knowledge\/forget-all$/, /^\/claude\/connect\/desktop$/] },
  // Seit SDK 2.5: Claude-Bereich als Erweiterung (Status, Anbindung, Spar-Werkzeuge, Projekte) und Terminal
  'read:claude': { de: 'KI-Anbindung lesen: welche KI-Werkzeuge installiert und verbunden sind, Projekte, Gedächtnis (auch was jede KI davon bekommt), Spar-Werkzeuge, Verbrauch', en: 'Read the AI connection: which AI tools are installed and connected, projects, memory (incl. what each AI gets), token-saving tools, usage', read: [/^\/claude\/(status|connect\/code|tools|tools\/discover|tools\/usage|targets\/[\w.-]+)$/, /^\/mind(\/activity|\/context)?$/, /^\/projects(\/[\w-]+)?$/, /^\/ai\/memory-share$/] },
  'change:claude': { de: 'KI-Anbindung einrichten: Kontext in Projekt-Dateien schreiben (CLAUDE.md, AGENTS.md, GEMINI.md …), Spar-Werkzeuge installieren/entfernen, Einstellungen (mit Rückfrage)', en: 'Set up the AI connection: write context into project files (CLAUDE.md, AGENTS.md, GEMINI.md …), install/remove token-saving tools, settings (asks first)', write: [/^\/claude\/write\/[\w.-]+$/, /^\/claude\/tools$/, /^\/claude\/tools\/[\w.-]+\/(install|update|remove)$/, /^\/claude\/connect\/desktop$/, /^\/ai\/memory-share(\/preview)?$/] },
  // Seit SDK 2.6: öffentliche Statusseite (nur Namen, Zustand, Verfügbarkeit – keine Adressen, Fehler oder Alarm-Ziele)
  'share:status': { de: 'Öffentliche Statusseite einrichten: an/aus, Titel, angezeigte Prüfungen, Link erneuern, in eine Website legen (mit Rückfrage)', en: 'Set up the public status page: on/off, title, shown checks, renew link, place it into a website (asks first)', read: [/^\/live\/statuspage$/], write: [/^\/live\/statuspage(\/(rotate|publish))?$/] },
  // Seit SDK 2.10: öffentliche Ansicht ohne Anmeldung (manifest.publicView, /v/<id>/) – z. B. Overlay für OBS
  'share:view': { de: 'Eine öffentliche Ansicht anbieten (ohne Anmeldung erreichbar, z. B. Overlay für OBS) – zeigt nur, was ihr eigener öffentlicher Server-Teil liefert', en: 'Offer a public view (reachable without login, e.g. an OBS overlay) – shows only what its own public server part returns' },
  // Seit SDK 3.1: dein Name (Einstellungen → Allgemein) – liefert ihn nur, wenn du ihn für Erweiterungen freigegeben hast, sonst null
  'read:profile': { de: 'Deinen Namen lesen – nur wenn du ihn für Erweiterungen freigibst', en: 'Read your name – only if you share it with extensions', read: [/^\/you$/] },
  'run:terminal': { de: 'Befehle ins Hostwerk-Terminal tippen (du bestätigst mit Enter bzw. vorher im Dialog)', en: 'Type commands into the Hostwerk terminal (you confirm with Enter or in a dialog first)', asks: true /* Bestätigung in der Seiten-Brücke (ui/src/extBridge.js TERMINAL) */ },
  // Seit SDK 3.3: stabile Dienste für eigenen Server-Code statt Kern-Interna (services/extapi.js)
  'use:ai': { de: 'Kurze Texte vom KI-Helfer übersetzen, erklären oder zusammenfassen lassen', en: 'Let the AI assistant translate, explain or summarise short texts' },
  'read:updates': { de: 'Anstehende Sicherheits-Updates lesen', en: 'Read pending security updates' },
  'change:updates': { de: 'Ein anstehendes Sicherheits-Update einspielen (mit Probelauf und Rückfall)', en: 'Install a pending security update (with trial run and fallback)' },
  'fetch:icons': { de: 'Symbole öffentlicher Webseiten über Hostwerk laden', en: 'Load icons of public websites through Hostwerk' },
  'write:ssh-keys': { de: 'SSH-Schlüssel in deinen SSH-Ordner legen (nie überschreiben)', en: 'Put SSH keys into your SSH folder (never overwrites)' },
  // Seit SDK 3.3: Mail-Programme – Mail-Server sind frei wählbar (Gmail, web.de, eigene Domain …), eine Adressliste ginge nicht
  'connect:mail': { de: 'Mit Mail-Servern deiner Wahl verbinden (IMAP und SMTP) und deren Einstellungen suchen', en: 'Connect to mail servers of your choice (IMAP and SMTP) and look up their settings' },
  storage: { de: 'Eigene Daten speichern (max. 256 KB)', en: 'Store own data (max. 256 KB)' },
  network: { de: 'Mit den im Paket genannten Webadressen sprechen', en: 'Talk to the web addresses named in the package' },
  // Seit SDK 2.7: native Erweiterungen – eigener Server- und Oberflächen-Code in Hostwerk (Funktionen, die früher eingebaut waren).
  // Nur aus dem Hostwerk-Katalog (Prüfsumme) oder im Entwickler-Modus installierbar.
  // Seit SDK 2.8: eigener Server-Code läuft abgeschottet (eigener Prozess) – nur offizielle Pakete aus dem Hostwerk-Katalog als Teil von Hostwerk
  // Seit SDK 2.9: Hostwerks eigene Oberfläche an benannten Stellen anpassen (contributes.overrides) – hohes Risiko: besondere
  // Prüfung im Katalog; außer bei offiziellen Paketen erst nach ausdrücklicher Zustimmung mit Vorschau aktiv, jederzeit abschaltbar
  'override:ui': { de: 'Teile von Hostwerks Oberfläche ersetzen oder ergänzen (erst nach deiner Zustimmung, jederzeit abschaltbar)', en: 'Replace or extend parts of Hostwerk’s interface (only after your consent, can be switched off any time)', risk: 'high' },
  // Seit SDK 2.9: andere Erweiterungen erweitern (contributes.extends) – nur so weit, wie deren Autor es erlaubt (allowExtensions)
  'extend:extensions': { de: 'Andere Erweiterungen ergänzen – nur so weit, wie deren Autor es erlaubt', en: 'Extend other extensions – only as far as their author allows' },
  native: { de: 'Eigener Server-Code – läuft abgeschottet (offizielle Pakete aus dem Hostwerk-Katalog als Teil von Hostwerk)', en: 'Own server code – runs sandboxed (official packages from the Hostwerk catalog as part of Hostwerk)' },
};
/*
 * Was jedes Recht genau erlaubt (can) und was NICHT (not) – für Installations-Dialog, Details und Doku.
 * Jede Aussage folgt aus den Mustern oben (read/write) und der Durchsetzung in services/extpolicy.js (Sperrliste,
 * Rückfrage, Schwärzen), services/extsandbox.js + extensions/sandbox/runner.js (abgeschotteter Prozess), der Seiten-Brücke
 * ui/src/extBridge.js und extmarket.js (CSP der Seiten). Was nur Absicht, aber nicht erzwungen ist, steht hier nicht.
 * scripts/ext-perm-texts-test.js prüft, dass jedes Recht beide Listen in beiden Sprachen hat.
 */
const L = (canDe, canEn, notDe, notEn) => ({ can: { de: canDe, en: canEn }, not: { de: notDe, en: notEn } });
const SECRETS_DE = 'Felder, die nach Geheimnis aussehen (Passwort, Token, Schlüssel …) – kommen geschwärzt an';
const SECRETS_EN = 'Fields that look like secrets (password, token, key …) – arrive blacked out';
const LIMITS = {
  'read:services': L(['Übersicht: welche Dienste es gibt und ob sie laufen'], ['Overview: which services exist and whether they run'],
    ['Dienste starten oder stoppen', 'Protokolle und Konfiguration der Dienste', SECRETS_DE], ['Start or stop services', 'Service logs and configuration', SECRETS_EN]),
  'read:web': L(['Liste der Webserver und Angaben zu einem Webserver (Typ, Version, Ports, Zustand)'], ['List of web servers and details of one (type, version, ports, state)'],
    ['Konfigurationsdateien, Zugriffs- und Fehlerprotokolle', 'Virtuelle Hosts oder Einstellungen ändern', 'Webserver starten oder stoppen', SECRETS_DE], ['Config files, access and error logs', 'Change virtual hosts or settings', 'Start or stop web servers', SECRETS_EN]),
  'read:databases': L(['Namen, Typ, Version, Port und Zustand der Datenbankserver', 'Ob ein Passwort gesetzt ist (ja/nein)'], ['Name, type, version, port and state of database servers', 'Whether a password is set (yes/no)'],
    ['Inhalte der Datenbanken (Tabellen, Zeilen)', 'Das Passwort selbst', 'Sicherungen auflisten, herunterladen oder wiederherstellen', 'Datenbanken starten, stoppen oder ändern'], ['Database contents (tables, rows)', 'The password itself', 'List, download or restore backups', 'Start, stop or change databases']),
  'read:minecraft': L(['Minecraft-Server, Spieler, Statistiken und Welten-Liste'], ['Minecraft servers, players, stats and the list of worlds'],
    ['Konsole, Protokolle und Absturzberichte', 'server.properties, Plugins und Sicherungen', 'Befehle senden oder etwas ändern'], ['Console, logs and crash reports', 'server.properties, plugins and backups', 'Send commands or change anything']),
  'read:apps': L(['Liste der Apps mit Zustand'], ['List of apps with their state'],
    ['Apps starten, stoppen oder ändern', 'Abhängigkeiten installieren', SECRETS_DE], ['Start, stop or change apps', 'Install dependencies', SECRETS_EN]),
  'read:tasks': L(['Liste der Aufgaben mit Zeitplan und Erfolgsquote'], ['List of tasks with schedule and success rate'],
    ['Verlauf und Ausgaben der Läufe', 'Aufgaben ausführen, ändern oder pausieren', SECRETS_DE], ['Run history and output', 'Run, change or pause tasks', SECRETS_EN]),
  'read:mail': L(['Zustand des Mail-Fängers', 'Liste der abgefangenen Mails (Absender, Empfänger, Betreff, Vorschau)'], ['State of the mail catcher', 'List of captured mails (sender, recipient, subject, preview)'],
    ['Eine Mail vollständig öffnen oder Anhänge laden', 'Mails weiterleiten, löschen oder die Weiterleitung einrichten'], ['Open a full mail or load attachments', 'Forward or delete mails, set up the relay']),
  'read:system': L(['Systemzustand, Auslastung, belegte und freie Ports, Speicher je Dienst', 'Steckbrief des Rechners: Betriebssystem, Hardware, Laufwerke, Laufzeiten, installierte Erweiterungen'], ['System health, load, used and free ports, storage per service', 'Machine profile: operating system, hardware, drives, runtimes, installed extensions'],
    ['Prozesse beenden', 'Ports umstellen (eigenes Recht „change:ports“)', 'Verlaufswerte (Messreihen) exportieren'], ['End processes', 'Move ports (separate permission "change:ports")', 'Export metrics history']),
  'read:games': L(['Spiele-Server, ihr Zustand und ihre Spieler'], ['Game servers, their state and players'],
    ['Konsole und Dateien der Server', 'Server starten oder stoppen', SECRETS_DE], ['Server console and files', 'Start or stop servers', SECRETS_EN]),
  'change:ports': L(['Einen Dienst auf einen freien Port umstellen – nach deiner Rückfrage'], ['Move a service to a free port – after you confirm'],
    ['Ohne deine Rückfrage', 'Andere Einstellungen der Dienste ändern', 'Dienste starten oder stoppen'], ['Without asking you', 'Change other service settings', 'Start or stop services']),
  'read:live': L(['Zertifikate mit Restlaufzeit', 'Erreichbarkeits-Prüfungen und ihr Verlauf'], ['Certificates with time left', 'Uptime checks and their history'],
    ['Private Schlüssel der Zertifikate', 'Alarm-Ziele, Firewall, Fernzugriff, Domains', 'Etwas anlegen, ändern oder löschen'], ['Private keys of certificates', 'Alert targets, firewall, remote access, domains', 'Create, change or delete anything']),
  'read:network': L(['Router, Rechner im Verbund und Sicherheitslage'], ['Router, machines and security status'],
    ['Router-Anmeldung', 'Rechner koppeln oder ihre Schlüssel', 'Firewall oder Fernzugriff ändern', SECRETS_DE], ['Router login', 'Pair machines or their keys', 'Change firewall or remote access', SECRETS_EN]),
  'control:services': L(['Webserver, Datenbanken, Apps, Mail, Minecraft- und Spiele-Server starten, stoppen, neu starten – jedes Mal nach deiner Rückfrage'], ['Start, stop, restart web servers, databases, apps, mail, Minecraft and game servers – each time after you confirm'],
    ['Ohne deine Rückfrage', 'Dienste anlegen, löschen oder umkonfigurieren', 'Prozesse hart beenden'], ['Without asking you', 'Create, delete or reconfigure services', 'Kill processes']),
  'command:minecraft': L(['Einen Befehl an einen Minecraft-Server senden – nach deiner Rückfrage'], ['Send a command to a Minecraft server – after you confirm'],
    ['Ohne deine Rückfrage', 'Konsole oder Protokolle lesen', 'Dateien des Servers ändern'], ['Without asking you', 'Read the console or logs', 'Change server files']),
  'run:tasks': L(['Eine vorhandene Aufgabe sofort ausführen – nach deiner Rückfrage'], ['Run an existing task right away – after you confirm'],
    ['Ohne deine Rückfrage', 'Aufgaben anlegen, ändern, löschen oder abbrechen'], ['Without asking you', 'Create, change, delete or cancel tasks']),
  'change:minecraft': L(['server.properties, Spielregeln und Server-Symbol ändern, Plugins an- und ausschalten, Sicherung anlegen – jedes Mal nach deiner Rückfrage'], ['Change server.properties, game rules and server icon, turn plugins on and off, create a backup – each time after you confirm'],
    ['Ohne deine Rückfrage', 'Plugins installieren oder löschen', 'Sicherungen herunterladen, wiederherstellen oder löschen', 'Server löschen'], ['Without asking you', 'Install or delete plugins', 'Download, restore or delete backups', 'Delete servers']),
  'change:databases': L(['Eine Datenbank-Sicherung anlegen – nach deiner Rückfrage'], ['Create a database backup – after you confirm'],
    ['Ohne deine Rückfrage', 'Sicherungen herunterladen, wiederherstellen oder löschen', 'Inhalte der Datenbanken lesen', 'Passwort ändern'], ['Without asking you', 'Download, restore or delete backups', 'Read database contents', 'Change the password']),
  'change:mail': L(['Test-Mails in den Mail-Fänger schicken, alle als gelesen markieren – nach deiner Rückfrage'], ['Send test mails to the mail catcher, mark all as read – after you confirm'],
    ['Ohne deine Rückfrage', 'Mails nach draußen weiterleiten oder löschen'], ['Without asking you', 'Forward mails outside or delete them']),
  'read:knowledge': L(['Wissensgraph lesen: Projekte, Graph, Bericht, Fragenverlauf, Gedächtnis, Claude-Status'], ['Read the knowledge graph: projects, graph, report, question history, memory, Claude status'],
    ['Etwas ändern', 'Schlüssel und Konten der KI-Anbieter'], ['Change anything', 'AI provider keys and accounts']),
  'change:knowledge': L(['Wissensgraph bauen und abfragen, Ordner aufnehmen, Gedächtnis pflegen, eigene Notizen eintragen, Obsidian-Export – ohne Rückfrage je Aufruf'], ['Build and query the knowledge graph, add folders, edit memory, add own notes, Obsidian export – without asking each time'],
    ['Claude in Projekten einbinden (eigenes Recht „connect:claude“)', 'Andere Bereiche von Hostwerk ändern'], ['Connect Claude in projects (separate permission "connect:claude")', 'Change other parts of Hostwerk']),
  'connect:claude': L(['Claude in Projekten einbinden, reparieren und wieder vergessen – nach deiner Rückfrage'], ['Connect, repair and forget Claude in projects – after you confirm'],
    ['Ohne deine Rückfrage', 'Schlüssel der KI-Anbieter lesen'], ['Without asking you', 'Read AI provider keys']),
  'read:claude': L(['Claude-Status, Projekte, Gedächtnis-Kontext, Spar-Werkzeuge und Verbrauch'], ['Claude status, projects, memory context, token-saving tools and usage'],
    ['Schlüssel und Konten der KI-Anbieter', 'Tresor, Umgebungsdateien (.env) und Git der Projekte', 'Etwas ändern'], ['AI provider keys and accounts', 'Vault, environment files (.env) and Git of projects', 'Change anything']),
  'change:claude': L(['Kontext in Projekt-Dateien schreiben, Spar-Werkzeuge installieren oder entfernen, Claude Desktop anbinden – jedes Mal nach deiner Rückfrage'], ['Write context into project files, install or remove token-saving tools, connect Claude Desktop – each time after you confirm'],
    ['Ohne deine Rückfrage', 'Schlüssel und Konten der KI-Anbieter'], ['Without asking you', 'AI provider keys and accounts']),
  'share:status': L(['Öffentliche Statusseite lesen und einrichten – Änderungen nach deiner Rückfrage'], ['Read and set up the public status page – changes after you confirm'],
    ['Änderungen ohne deine Rückfrage', 'Überwachung, Alarm-Ziele oder Domains ändern'], ['Changes without asking you', 'Change monitoring, alert targets or domains']),
  'share:view': L(['Eine Seite ohne Anmeldung anbieten (z. B. Overlay für OBS) – nur Dateien aus ihrem eigenen Ordner'], ['Offer a page without login (e.g. an OBS overlay) – only files from its own folder'],
    ['Von dort Hostwerks API abfragen (nur der eigene öffentliche Server-Teil)', 'Deine Anmeldung oder Cookies nutzen'], ['Call Hostwerk’s API from there (only its own public server part)', 'Use your login or cookies']),
  'read:profile': L(['Deinen Namen aus Einstellungen → Allgemein – nur, wenn du ihn dort für Erweiterungen freigegeben hast (sonst kommt nichts an)'], ['Your name from Settings → General – only if you shared it with extensions there (otherwise nothing arrives)'],
    ['Deinen Namen ohne deine Freigabe', 'Andere Einstellungen, Konten oder Anmeldedaten'], ['Your name without your consent', 'Other settings, accounts or login data']),
  'run:terminal': L(['Einen Befehl ins Hostwerk-Terminal tippen – du drückst Enter oder bestätigst vorher im Dialog'], ['Type a command into the Hostwerk terminal – you press Enter or confirm in a dialog first'],
    ['Einen Befehl ohne dich abschicken', 'Die Ausgabe des Terminals lesen'], ['Send a command without you', 'Read the terminal output']),
  'use:ai': L(['Kurze Texte übersetzen, erklären, zusammenfassen oder beschreiben lassen – mit der KI, die du in Hostwerk eingerichtet hast (nur wenn sie an ist)'], ['Translate, explain, summarise or describe short texts – with the AI you set up in Hostwerk (only when it is on)'],
    ['Schlüssel und Konten der KI-Anbieter', 'KI-Chat, Gedächtnis oder Einstellungen der KI', 'Längere Texte als 6000 Zeichen'], ['AI provider keys and accounts', 'AI chat, memory or AI settings', 'Texts longer than 6000 characters']),
  'read:updates': L(['Welche Sicherheits-Updates anstehen: Dienst, Version jetzt und neu'], ['Which security updates are pending: service, current and new version'],
    ['Updates einspielen (eigenes Recht „change:updates“)', 'Automatische Updates ein- oder ausschalten'], ['Install updates (separate permission "change:updates")', 'Switch automatic updates on or off']),
  'change:updates': L(['Ein anstehendes Sicherheits-Update einspielen – mit Probelauf und Rückfall wie unter Einstellungen → Updates, im Aktivitätsprotokoll vermerkt'], ['Install a pending security update – with trial run and fallback like Settings → Updates, noted in the activity log'],
    ['Abgeschottet: gar nicht – nur offizielle Pakete aus dem Hostwerk-Katalog', 'Andere Versionen einspielen oder den Probelauf überspringen', 'Automatische Updates ein- oder ausschalten'], ['Sandboxed: not at all – only official packages from the Hostwerk catalog', 'Install other versions or skip the trial run', 'Switch automatic updates on or off']),
  'fetch:icons': L(['Das Symbol einer öffentlichen Webseite laden – Hostwerk holt es selbst und hebt es 30 Tage auf'], ['Load the icon of a public website – Hostwerk fetches it itself and keeps it for 30 days'],
    ['Adressen im Heimnetz oder auf diesem Rechner – auch nicht über Weiterleitungen', 'Andere Inhalte als Bilder, mehr als 512 KB', 'Abgeschottet: gar nicht'], ['Addresses in the home network or on this PC – not via redirects either', 'Anything but images, more than 512 KB', 'Sandboxed: not at all']),
  'write:ssh-keys': L(['Einen SSH-Schlüssel (privat und öffentlich) unter neuem Namen in ~/.ssh ablegen'], ['Put an SSH key (private and public) under a new name into ~/.ssh'],
    ['Vorhandene Schlüssel überschreiben oder lesen', 'authorized_keys, known_hosts oder config ändern', 'Abgeschottet: gar nicht'], ['Overwrite or read existing keys', 'Change authorized_keys, known_hosts or config', 'Sandboxed: not at all']),
  'connect:mail': L(['Mit den Mail-Servern sprechen, die du beim Einrichten eines Kontos angibst (IMAP, SMTP, POP3 – Ports 25, 110, 143, 465, 587, 993, 995, 2525)', 'Die Einstellungen zu deiner Mail-Adresse suchen (Autoconfig und Autodiscover deiner Domain, Mozillas Anbieter-Verzeichnis, DNS) – abgeschottet nur über die unter „network“ genannten Adressen'], ['Talk to the mail servers you enter when setting up an account (IMAP, SMTP, POP3 – ports 25, 110, 143, 465, 587, 993, 995, 2525)', 'Look up the settings for your mail address (autoconfig and autodiscover of your domain, Mozilla’s provider directory, DNS) – sandboxed only via the addresses listed under "network"'],
    ['Andere Ports oder Webseiten (dafür gibt es „network“)', 'Abgeschottet: Mail-Server im Heimnetz oder auf diesem Rechner', 'Deine Hostwerk-Anmeldung, Einstellungen oder Geheimnisse anderer Bereiche'], ['Other ports or websites (that is what "network" is for)', 'Sandboxed: mail servers in the home network or on this PC', 'Your Hostwerk login, settings or secrets of other areas']),
  storage: L(['Eigene Daten speichern, höchstens 256 KB'], ['Store own data, at most 256 KB'],
    ['Daten anderer Erweiterungen lesen – außer deren Autor gibt sie frei', 'Mehr als 256 KB'], ['Read other extensions’ data – unless their author shares it', 'More than 256 KB']),
  network: L(['Abfragen an die im Paket genannten https-Adressen'], ['Requests to the https addresses named in the package'],
    ['Abfragen an andere Adressen', 'Server-Code: ins eigene Netz, Heimnetz oder 127.0.0.1 – auch wenn genannt'], ['Requests to other addresses', 'Server code: into the local or home network or 127.0.0.1 – even if listed']),
  'override:ui': L(['Benannte Teile von Hostwerks Oberfläche ersetzen oder ergänzen – erst nach deiner Zustimmung mit Vorschau (offizielle Pakete sofort), jederzeit abschaltbar'], ['Replace or extend named parts of Hostwerk’s interface – only after your consent with a preview (official packages right away), can be switched off any time'],
    ['Teile ersetzen, die nicht als Anpassungs-Stelle benannt sind', 'Sich gegen das Abschalten wehren'], ['Replace parts that are not named override points', 'Prevent being switched off']),
  'extend:extensions': L(['Andere Erweiterungen ergänzen (Reiter, Seiten, Texte) – nur so weit, wie deren Autor es erlaubt'], ['Extend other extensions (tabs, pages, texts) – only as far as their author allows'],
    ['Andere Erweiterungen installieren, ändern oder abschalten', 'Mehr als deren Autor freigibt'], ['Install, change or switch off other extensions', 'More than their author allows']),
  native: L(['Eigenen Server-Code ausführen: eigene Routen, Hintergrund-Arbeit, Dienste für andere Erweiterungen'], ['Run own server code: own routes, background work, services for other extensions'],
    ['Abgeschottet: Dateien außerhalb des eigenen Ordners, Programme starten, eigenes Netz, eigene Ports, Hostwerks Umgebung', 'Offizielle Pakete aus dem Hostwerk-Katalog laufen als Teil von Hostwerk – geprüft und signiert, aber nicht abgeschottet'], ['Sandboxed: files outside its own folder, starting programs, local network, own ports, Hostwerk’s environment', 'Official packages from the Hostwerk catalog run as part of Hostwerk – reviewed and signed, but not sandboxed']),
};
for (const [k, v] of Object.entries(LIMITS)) if (PERMISSIONS[k]) Object.assign(PERMISSIONS[k], v);

/*
 * Darf keine Erweiterung – Grenzen, die Hostwerk für JEDE abgeschottete Erweiterung erzwingt (alle aus anderen Quellen,
 * Seiten im Rahmen, eigener Server-Code im eigenen Prozess). Ausnahme, offen gesagt: offizielle Pakete aus dem
 * Hostwerk-Katalog mit eigenem Code laufen im Hostwerk-Prozess (geprüft und signiert, aber technisch nicht abgeschottet),
 * ebenso eigener Code, dessen Abschottung du im Entwickler-Modus abschaltest.
 * where = Fundstelle der Durchsetzung · probes = Prüfungen in scripts/ext-security-test.js (müssen alle scheitern).
 */
const NEVER = [
  { id: 'secrets', de: 'Passwörter, Tresore und Geheimnisse lesen', en: 'Read passwords, vaults and secrets',
    tip: { de: 'Passwort-Manager, Tresore und Schlüssel sind gesperrt; Felder, die nach Geheimnis aussehen, kommen in jeder erlaubten Antwort geschwärzt an.', en: 'Password manager, vaults and keys are blocked; fields that look like secrets arrive blacked out in every allowed answer.' },
    where: 'server/services/extpolicy.js: DENY_FIRST (pw, passwords, vault, secrets), DENY_RE, redact()', probes: ['apiPw', 'apiVault', 'apiAiKeys', 'pageNoSecret'] },
  { id: 'settings', de: 'Hostwerks Einstellungen, Schlüssel und Anmelde-Token lesen', en: 'Read Hostwerk’s settings, keys and login tokens',
    tip: { de: 'Die Einstellungen sind gesperrt, Hostwerks Umgebungsvariablen erbt der Prozess nicht, Cookies und Token gehen nie an die Erweiterung.', en: 'Settings are blocked, the process does not inherit Hostwerk’s environment, cookies and tokens never reach the extension.' },
    where: 'extpolicy.js DENY_FIRST (settings, auth, tokens, keys); extsandbox.js start() env + STRIP_HEADERS', probes: ['apiSettings', 'readSettings', 'envHasHostwerk', 'cookieForwarded'] },
  { id: 'own-rights', de: 'Sich selbst mehr Rechte geben', en: 'Give itself more permissions',
    tip: { de: 'Rechte stehen im Paket und gelten erst nach deiner Zustimmung. Die eigene manifest.json ist schreibgeschützt, Hostwerks Erweiterungs-Verwaltung gesperrt, „_“-Felder setzt nur Hostwerk.', en: 'Permissions are in the package and only apply after your consent. Its own manifest.json is read-only, Hostwerk’s extension management is blocked, "_" fields are set by Hostwerk only.' },
    where: 'extpolicy.js DENY_FIRST (extmarket, extstudio, ext); extsandbox.js --allow-fs-write nur Datenordner; extmarket.js installFromDir (ohne „_“-Felder)', probes: ['writeOwnManifest', 'apiGrant'] },
  { id: 'other-extensions', de: 'Andere Erweiterungen installieren, ändern, abschalten oder ansprechen', en: 'Install, change, switch off or call other extensions',
    tip: { de: 'Ausnahmen nur, wenn der andere Autor es erlaubt: Ergänzungen („extend:extensions“), angebotene Dienste und freigegebener Speicher.', en: 'Only where the other author allows it: extensions ("extend:extensions"), offered services and shared storage.' },
    where: 'extpolicy.js DENY_FIRST (extmarket, x); extmarket.js /call (nur eigenes /x/<id>); extmarket.js sharedStorage', probes: ['apiInstall', 'apiRemoveOther', 'apiOtherModule', 'storageOfOther'] },
  { id: 'maintenance', de: 'Wartung, abgesicherten Start oder Updates von Hostwerk beeinflussen', en: 'Affect Hostwerk’s maintenance, safe start or updates',
    tip: { de: 'Wartung, Selbstwartung und Updates sind gesperrt; Pakete, die Wartungsdateien oder -schalter erwähnen, lassen sich gar nicht installieren.', en: 'Maintenance, self-care and updates are blocked; packages that mention maintenance files or switches cannot be installed at all.' },
    where: 'extpolicy.js DENY_FIRST (maintenance, keeper, update, app); check.js TAMPER_RE', probes: ['apiMaintenance', 'apiSafeStart', 'installTamper'] },
  { id: 'hide', de: 'Sich verstecken oder unentfernbar machen', en: 'Hide itself or make itself impossible to remove',
    tip: { de: 'Jede Erweiterung steht in der Liste und in der Wartung und lässt sich dort abschalten und entfernen. Ihr Zugriffsprotokoll kann sie nicht löschen, Meldungen tragen immer ihren Namen.', en: 'Every extension is listed here and in maintenance and can be switched off and removed there. It cannot clear its access log, messages always carry its name.' },
    where: 'check.js HIDING_KEYS (Installation abgelehnt); extpolicy.js DENY_FIRST (extmarket); extsandbox.js op toast (Name davor)', probes: ['installHiding', 'apiClearLog'] },
  { id: 'files', de: 'Dateien außerhalb des eigenen Ordners lesen oder schreiben', en: 'Read or write files outside its own folder',
    tip: { de: 'Der Server-Code liest nur sein Paket und schreibt nur in seinen Datenordner; Hostwerks Datei-Bereich ist gesperrt.', en: 'The server code only reads its package and writes only into its data folder; Hostwerk’s file area is blocked.' },
    where: 'extsandbox.js start(): node --permission --allow-fs-read/--allow-fs-write; extpolicy.js DENY_FIRST (files, fs)', probes: ['readHome', 'readAppData', 'writeOutside', 'apiFiles'] },
  { id: 'network', de: 'Abfragen an Adressen schicken, die nicht im Paket stehen', en: 'Send requests to addresses not named in the package',
    tip: { de: 'Ohne das Recht „network“ gar keine. Server-Code kommt nie ins eigene Netz, ins Heimnetz oder an 127.0.0.1. Seiten dürfen Bilder und Medien von https-Adressen anzeigen.', en: 'None without the "network" permission. Server code never reaches the local or home network or 127.0.0.1. Pages may show images and media from https addresses.' },
    where: 'extensions/sandbox/runner.js (net.Socket.connect, dgram); extmarket.js mountPages (CSP connect-src)', probes: ['internetNotListed', 'lanIp', 'loopbackApi', 'localhostName', 'udp', 'pageCsp'] },
  { id: 'programs', de: 'Programme oder Befehle ohne deine Zustimmung starten', en: 'Start programs or commands without your consent',
    tip: { de: 'Server-Code kann keine Programme, Worker oder fremden Code starten. Pakete mit eigenem Programm installiert Hostwerk nur nach deiner ausdrücklichen Zustimmung; Terminal-Befehle bestätigst du selbst.', en: 'Server code cannot start programs, workers or foreign code. Packages with their own program are only installed after your explicit consent; you confirm terminal commands yourself.' },
    where: 'extsandbox.js (--permission, --disallow-code-generation-from-strings); extpolicy.js DENY_FIRST (terminal, pty, shell, exec); extmarket.js installFromDir PROGRAM_CONSENT; ui/src/extBridge.js TERMINAL', probes: ['spawn', 'worker', 'evalCode', 'fnCode', 'apiTerminal', 'installProgram'] },
  { id: 'confirm', de: 'Etwas ohne deine Rückfrage ändern', en: 'Change anything without asking you',
    tip: { de: 'Jede Änderung über Hostwerk fragt dich vorher. Einzige Ausnahme: Rechte, die ausdrücklich ohne Rückfrage sind (Wissensgraph bauen).', en: 'Every change through Hostwerk asks you first. Only exception: permissions that explicitly need no confirmation (building the knowledge graph).' },
    where: 'extpolicy.js decide() confirm; extmarket.js /call (428 EXT_CONFIRM); extsandbox.js op api', probes: ['apiWriteNeedsConfirm', 'pageWriteNeedsConfirm'] },
  { id: 'login', de: 'Mit deiner Anmeldung handeln oder Cookies setzen', en: 'Act with your login or set cookies',
    tip: { de: 'Seiten laufen in einem eigenen, leeren Ursprung; Antworten des Server-Codes verlieren Set-Cookie und laufen nie als Hostwerk-Seite.', en: 'Pages run in their own empty origin; answers from the server code lose Set-Cookie and never run as a Hostwerk page.' },
    where: 'extmarket.js mountPages (CSP sandbox); extsandbox.js proxy (set-cookie entfernt, CSP sandbox)', probes: ['setCookie', 'moduleCsp'] },
  { id: 'core', de: 'Hostwerks eigene Bereiche oder Dienste ersetzen', en: 'Replace Hostwerk’s own areas or services',
    tip: { de: 'Eigene Routen gibt es nur unter /api/x/<id>/, Dienstnamen von Hostwerk sind vergeben. Oberflächen-Anpassungen nur mit „override:ui“ und deiner Zustimmung.', en: 'Own routes only exist under /api/x/<id>/, Hostwerk’s service names are taken. Interface changes only with "override:ui" and your consent.' },
    where: 'extsandbox.js proxy (nur /x/<id>), op provide', probes: ['provideCore', 'coreRoute'] },
  { id: 'ports', de: 'Eigene Ports öffnen', en: 'Open its own ports',
    tip: { de: 'Erreichbar ist eine Erweiterung nur über Hostwerk (/api/x/<id>/), nie direkt.', en: 'An extension is only reachable through Hostwerk (/api/x/<id>/), never directly.' },
    where: 'extensions/sandbox/runner.js (net.Server.listen, dgram)', probes: ['listenPort', 'udp'] },
];
// Version 1 packages: "read" = all read scopes, "write" = all control scopes
const LEGACY = { read: Object.keys(PERMISSIONS).filter((k) => k.startsWith('read:') && !['read:profile' /* Name nie stillschweigend */, 'read:updates' /* erst ab SDK 3.3 */].includes(k)), write: ['control:services', 'command:minecraft', 'run:tasks'] };
const ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
/** Line icons for the sidebar (same style as Hostwerk's own areas) – ui/src/extIcons.js */
const SIDEBAR_ICONS = ['smartphone', 'cloud-upload', 'folder-up', 'file-search', 'router', 'puzzle', 'users', 'monitor', 'gauge', 'activity', 'chart', 'bar-chart', 'bell', 'book', 'bot', 'box', 'calendar', 'camera', 'clock', 'cloud', 'code', 'coffee', 'cpu', 'database', 'download', 'file', 'flag', 'gamepad', 'gift', 'globe', 'heart', 'home', 'image', 'inbox', 'key', 'dashboard', 'grid', 'leaf', 'line-chart', 'list', 'lock', 'mail', 'map', 'message', 'music', 'network', 'news', 'package', 'pie-chart', 'radio', 'rocket', 'server', 'settings', 'shield', 'cart', 'sparkles', 'star', 'sun', 'swords', 'table', 'tag', 'terminal', 'timer', 'trophy', 'tv', 'wand', 'wifi', 'wrench', 'zap'];
/** Everything the SDK offers (window.Hostwerk) – calls to anything else fail at runtime. Kept in sync by scripts/ext-catalog-test.js. */
const SDK_MEMBERS = {
  sdk: null, ready: null, info: null, lang: null, theme: null, embed: null, t: null, esc: null, html: null, render: null, raw: null,
  fmt: ['bytes', 'duration', 'number', 'time'], get: null, post: null, put: null, del: null, pickFolder: null, services: null, service: null, tab: null, setTab: null, context: null,
  minecraft: ['servers', 'players', 'stats', 'command'], storage: ['get', 'set', 'remove', 'all'], settings: ['get', 'open'],
  on: null, toast: null, navigate: null, openUrl: null, copy: null, saveFile: null /* SDK 3.2 */, terminal: null, backend: null,
  loaded: null, holdLoaded: null, ui: ['loading', 'error', 'load', 'skeleton', 'loader', 'spinner', 'dots', 'check', 'empty', 'animate', 'countUp', 'motionOk'], // SDK 3.2: Laden; 3.6: Animationen
};
/** Tastenkürzel wie in der Oberfläche (ui/src/shortcutKeys.mjs): "Strg+Shift+K" → "ctrl+shift+k", sonst null. */
const SHORTCUT_MODS = ['ctrl', 'alt', 'shift', 'meta'];
const SHORTCUT_ALIAS = { control: 'ctrl', strg: 'ctrl', cmd: 'ctrl', command: 'ctrl', mod: 'ctrl', option: 'alt', opt: 'alt', umschalt: 'shift', win: 'meta', super: 'meta', esc: 'escape', del: 'delete', entf: 'delete', return: 'enter', up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', pgup: 'pageup', pgdn: 'pagedown', comma: ',', period: '.', minus: '-', slash: '/' };
const SHORTCUT_NAMED = /^(enter|escape|tab|space|delete|backspace|insert|home|end|pageup|pagedown|arrowup|arrowdown|arrowleft|arrowright|plus|f([1-9]|1\d|2[0-4]))$/;
function shortcutCombo(str) {
  if (!/^[a-z0-9+,.;\-/[\]'`=]{1,40}$/i.test(str)) return null;
  const parts = str.toLowerCase().split('+').filter(Boolean).map((p) => SHORTCUT_ALIAS[p] || p);
  const mods = new Set(); let key = null;
  for (const p of parts) { if (SHORTCUT_MODS.includes(p)) mods.add(p); else if (key || !(SHORTCUT_NAMED.test(p) || /^[a-z0-9,.;\-/[\]'`=]$/.test(p))) return null; else key = p; }
  return key ? [...SHORTCUT_MODS.filter((x) => mods.has(x)), key].join('+') : null;
}
/** Vom System/Texteingaben belegt (wie RESERVED in shortcutKeys.mjs) und Hostwerks eigene Standard-Kürzel. */
const SHORTCUT_RESERVED = ['ctrl+c', 'ctrl+v', 'ctrl+x', 'ctrl+a', 'ctrl+z', 'ctrl+y', 'ctrl+shift+z', 'alt+f4', 'ctrl+w', 'ctrl+q', 'ctrl+tab', 'ctrl+shift+tab', 'alt+tab', 'ctrl+shift+i', 'f12', 'ctrl+shift+escape', 'ctrl+alt+delete', 'ctrl+arrowleft', 'ctrl+arrowright', 'ctrl+backspace', 'ctrl+delete', 'ctrl+home', 'ctrl+end', 'shift+arrowleft', 'shift+arrowright', 'shift+arrowup', 'shift+arrowdown'];
const SHORTCUT_HOSTWERK = ['ctrl+k', 'ctrl+n', 'ctrl+shift+s', 'ctrl+shift+x', 'ctrl+,', 'ctrl+r', 'ctrl+shift+r', 'f1', 'shift+f10', 'ctrl+enter', 'ctrl+s', 'ctrl+f', 'ctrl+shift+t', 'ctrl+shift+w', 'ctrl+shift+f', 'f11', ...'123456789'.split('').map((n) => `ctrl+${n}`)];

/** SDK 2.8: Hauptbereiche, in die eine Erweiterung einen Reiter einhängen kann (contributes.tabs[].on) */
const AREAS = ['area:web', 'area:dbs', 'area:minecraft', 'area:projects', 'area:mail', 'area:system', 'area:live', 'area:ai', 'area:backups', 'area:tasks']; // area:tasks seit SDK 3.2
/** Gruppen der Seitenleiste (page.nav.group): Server, Entwickeln oder unter „Erweiterungen“ */
const NAV_GROUPS = ['server', 'develop', 'system', 'extensions']; // „extensions“ = alt (≤ 2.10) → Hostwerk ordnet nach Kategorie ein
const NAV_GROUP_RE = /^[a-z][a-z0-9-]{1,30}$/; // eigener Bereich (mit page.nav.groupTitle)
/** Reiter der Einstellungen, in denen die Einstellungen der Erweiterung erscheinen (settingsTab) */
const SETTINGS_TABS = ['general', 'start', 'notifications', 'advanced', 'extensions'];
const SEMVER = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
const MAX_SIZE = 10 * 1048576;

/* ---------------- SDK 2.9: Farbschemata, Oberflächen-Anpassungen, Erweiterungen erweitern ---------------- */
/**
 * Farbschema (contributes.themes): nur diese Variablen, nur Farbwerte – kein eigenes CSS. Akzent-Variablen (--accent*,
 * --grad) leitet Hostwerk aus "accent" ab (immer lesbar), Schrift kommt aus "fonts"/"font", Rundung und Dichte als Faktor.
 * Gleiche Liste in ui/src/themeTokens.mjs (scripts/ext-templates-test.js vergleicht beide).
 */
const THEME_COLOR_TOKENS = ['--bg', '--bg-2', '--surface', '--surface-2', '--surface-3', '--line', '--line-2', '--text', '--text-2', '--muted', '--ok', '--ok-text', '--warn', '--warn-text', '--err', '--err-text', '--info', '--console-bg', '--input-bg'];
const THEME_SOFT_TOKENS = ['--ok-soft', '--warn-soft', '--err-soft', '--info-soft'];
const THEME_SHADOW_TOKENS = ['--shadow', '--shadow-lg'];
const THEME_TOKENS = [...THEME_COLOR_TOKENS, ...THEME_SOFT_TOKENS, ...THEME_SHADOW_TOKENS];
/** Hostwerks eigene Werte (ui/src/styles.css) – fehlende Variablen eines Schemas behalten sie; Kontraste werden damit gerechnet. */
const THEME_DEFAULTS = {
  dark: { '--bg': '#0a0c11', '--bg-2': '#0e1118', '--surface': '#12151d', '--surface-2': '#171b25', '--surface-3': '#1e2330', '--line': '#232838', '--line-2': '#2d3446', '--text': '#e7e9f0', '--text-2': '#b4bacb', '--muted': '#8a92a8', '--ok': '#2fd39a', '--ok-text': '#2fd39a', '--warn': '#f5b84a', '--warn-text': '#f5b84a', '--err': '#ff5d6c', '--err-text': '#ff5d6c', '--info': '#4ea8ff', '--console-bg': '#07080c', '--input-bg': '#0e1118' },
  light: { '--bg': '#f4f5f9', '--bg-2': '#eef0f6', '--surface': '#ffffff', '--surface-2': '#f7f8fb', '--surface-3': '#eef0f5', '--line': '#e3e6ee', '--line-2': '#d4d8e3', '--text': '#151925', '--text-2': '#3e4558', '--muted': '#5f677c', '--ok': '#10a874', '--ok-text': '#0b7c57', '--warn': '#c98100', '--warn-text': '#946000', '--err': '#e5364a', '--err-text': '#c42a3c', '--info': '#1f7ae0', '--console-bg': '#0d1017', '--input-bg': '#ffffff' },
};
const THEME_SURFACES = ['--bg', '--bg-2', '--surface', '--surface-2', '--surface-3'];
/** Text (WCAG 1.4.3: ≥ 4,5:1) und Zustandsfarben/Bedienelemente (WCAG 1.4.11: ≥ 3:1) auf jeder Fläche. */
const THEME_TEXT = ['--text', '--text-2', '--muted', '--ok-text', '--warn-text', '--err-text'];
const THEME_UI = ['--ok', '--warn', '--err', '--info'];
const THEME_DENSITY = { compact: 0.85, normal: 1, comfortable: 1.15 };
const FONT_FILE_RE = /\.(woff2|woff|ttf|otf)$/i;
const FONT_FAMILY_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,39}$/;
const FONT_BUDGET = 1536 * 1024;
const HEX6 = /^#[0-9a-f]{6}$/i;
const SOFT_RE = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d{1,3})\s*\)$/i;
const SHADOW_PART_RE = /^(inset\s+)?(-?\d{1,3}(\.\d+)?(px)?\s+){2,4}(#[0-9a-f]{6}|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d{1,3})\s*\))$/i;
/** Ist der Wert für diese Variable erlaubt? (Farben nur als #rrggbb, zarte Töne auch rgba(), Schatten in einfacher Form) */
function themeValueOk(token, v) {
  if (typeof v !== 'string' || v.length > 200) return false;
  if (THEME_COLOR_TOKENS.includes(token)) return HEX6.test(v);
  if (THEME_SOFT_TOKENS.includes(token)) { const m = v.match(SOFT_RE); return HEX6.test(v) || (!!m && [m[1], m[2], m[3]].every((x) => Number(x) <= 255)); }
  if (THEME_SHADOW_TOKENS.includes(token)) return v === 'none' || v.split(/,(?![^(]*\))/).every((x) => SHADOW_PART_RE.test(x.trim()));
  return false;
}
const lumHex = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => x / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
/** WCAG-Kontrast zweier #rrggbb-Farben. */
const contrastHex = (a, b) => { const x = lumHex(a); const y = lumHex(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const floor2 = (x) => Math.floor(x * 100) / 100;

/**
 * Ein Farbschema prüfen (ohne Dateizugriff – Schriftdateien prüft checkPackage). Ergebnis:
 *   { errors: [...], warnings: [...], tokens: { dark, light } (nur erlaubte Werte), contrast: [{ mode, fg, bg, ratio, min }] }
 * Kontrast-Regel: geprüft wird jedes Paar, an dem das Schema etwas ändert (Hostwerks eigene Paare sind Hostwerks Sache).
 */
function themeReport(th) {
  const errors = []; const warnings = []; const contrast = [];
  const tokens = { dark: {}, light: {} };
  if (!th || typeof th !== 'object') return { errors: ['Theme entry must be an object.'], warnings, tokens, contrast };
  const label = th.id ? `Theme "${th.id}"` : 'Theme';
  if (!/^[a-z0-9-]{1,30}$/.test(th.id || '')) errors.push('Every theme needs an "id" (a–z, 0–9, -).');
  if (!th.title) errors.push(`${label} needs a "title".`);
  const raw = th.tokens && typeof th.tokens === 'object' ? th.tokens : {};
  for (const mode of ['dark', 'light']) {
    const set = raw[mode] && typeof raw[mode] === 'object' ? raw[mode] : {};
    for (const [k, v] of Object.entries(set)) {
      if (!THEME_TOKENS.includes(k)) { errors.push(`${label} (${mode}): "${k}" cannot be changed by a theme. Allowed: ${THEME_TOKENS.join(', ')}. Accent colours come from "accent", the font from "font", radius/spacing from "radius"/"density".`); continue; }
      if (!themeValueOk(k, v)) { errors.push(`${label} (${mode}): "${k}" has an invalid value "${String(v).slice(0, 40)}" – colours as #rrggbb${THEME_SOFT_TOKENS.includes(k) ? ' or rgba(r, g, b, a)' : ''}${THEME_SHADOW_TOKENS.includes(k) ? ', shadows like "0 8px 24px rgba(0, 0, 0, 0.4)"' : ''}.`); continue; }
      tokens[mode][k] = v;
    }
    const merged = { ...THEME_DEFAULTS[mode], ...tokens[mode] };
    const own = (k) => Object.prototype.hasOwnProperty.call(tokens[mode], k);
    // Dunkel bleibt dunkel, Hell bleibt hell – Hostwerk hat Feinheiten je Modus (z. B. Hervorhebungen im Code)
    for (const k of ['--bg', '--surface']) {
      if (!own(k)) continue;
      const l = lumHex(merged[k]);
      if (mode === 'dark' && l > 0.2) errors.push(`${label}: "${k}" ${merged[k]} is too light for the dark mode.`);
      if (mode === 'light' && l < 0.5) errors.push(`${label}: "${k}" ${merged[k]} is too dark for the light mode.`);
    }
    const pairs = [...THEME_TEXT.flatMap((fg) => THEME_SURFACES.map((bg) => [fg, bg, 4.5])), ['--text', '--input-bg', 4.5], ...THEME_UI.flatMap((fg) => THEME_SURFACES.map((bg) => [fg, bg, 3]))];
    for (const [fg, bg, min] of pairs) {
      if (!own(fg) && !own(bg)) continue;
      const ratio = contrastHex(merged[fg], merged[bg]);
      contrast.push({ mode, fg, bg, ratio: floor2(ratio), min });
      if (ratio < min) errors.push(`${label} (${mode}): ${fg} ${merged[fg]} on ${bg} ${merged[bg]} has a contrast of ${floor2(ratio)}:1 – at least ${min}:1 is needed (WCAG 2.2 AA${min === 3 ? ', non-text' : ''}).`);
    }
  }
  // Akzent: Vorschlag des Schemas (+ weitere Vorschläge im Farbwähler) – als Rahmen/Markierung überall sichtbar (≥ 3:1)
  if (th.accents !== undefined && (!Array.isArray(th.accents) || th.accents.length > 8)) errors.push(`${label}: "accents" is a list of up to 8 colours.`);
  const accents = [th.accent, ...(Array.isArray(th.accents) ? th.accents : [])].filter((x) => x !== undefined);
  for (const a of accents) {
    if (!HEX6.test(String(a))) { errors.push(`${label}: accent "${a}" must be #rrggbb.`); continue; }
    for (const mode of ['dark', 'light']) {
      const merged = { ...THEME_DEFAULTS[mode], ...tokens[mode] };
      const worst = Math.min(...THEME_SURFACES.map((bg) => contrastHex(a, merged[bg])));
      if (worst < 3) errors.push(`${label}: accent ${a} has only ${floor2(worst)}:1 on the ${mode} surfaces – at least 3:1 (borders, switches and selection must stay visible). Hostwerk derives readable text and button colours from it automatically.`);
    }
  }
  if (th.radius !== undefined && !(Number.isFinite(th.radius) && th.radius >= 0 && th.radius <= 2)) errors.push(`${label}: "radius" is a factor from 0 (square) to 2 (very round) – 1 is Hostwerk's own.`);
  if (th.density !== undefined && !THEME_DENSITY[th.density]) errors.push(`${label}: "density" is ${Object.keys(THEME_DENSITY).join(', ')}.`);
  const fonts = th.fonts === undefined ? [] : th.fonts;
  if (!Array.isArray(fonts) || fonts.length > 4) errors.push(`${label}: "fonts" is a list of up to 4 font files: [{ "family": "Inter", "file": "fonts/inter.woff2", "weight": "100 900" }].`);
  else for (const f of fonts) {
    if (!f || !FONT_FAMILY_RE.test(f.family || '')) { errors.push(`${label}: every font needs a "family" (letters, digits, space, - and _).`); continue; }
    if (typeof f.file !== 'string' || !FONT_FILE_RE.test(f.file) || /\.\.|^\/|\\/.test(f.file)) errors.push(`${label}: font "${f.family}" needs a "file" inside the package (.woff2, .woff, .ttf or .otf).`);
    if (f.weight !== undefined && !/^\d{3}( \d{3})?$/.test(String(f.weight))) errors.push(`${label}: font weight "${f.weight}" must look like "400" or "100 900".`);
    if (f.style !== undefined && !['normal', 'italic'].includes(f.style)) errors.push(`${label}: font style is "normal" or "italic".`);
  }
  if (th.font !== undefined && !(Array.isArray(fonts) && fonts.some((f) => f && f.family === th.font))) errors.push(`${label}: "font" must name one of its own "fonts" (bundled in the package – nothing is loaded from the internet).`);
  if (!Object.keys(tokens.dark).length && !Object.keys(tokens.light).length && th.accent === undefined && th.font === undefined && th.radius === undefined && th.density === undefined) warnings.push(`${label} changes nothing yet.`);
  return { errors, warnings, tokens, contrast };
}

/**
 * Benannte Stellen in Hostwerks Oberfläche, die Erweiterungen ersetzen oder ergänzen dürfen (contributes.overrides).
 * Gleiche Liste in ui/src/overrideSlots.js. modes: replace = statt des Originals · before/after = davor/danach.
 */
const OVERRIDE_SLOTS = {
  'dashboard.hero': { de: 'Begrüßung oben auf der Übersicht', en: 'Greeting at the top of the overview', route: '/', modes: ['replace', 'before', 'after'] },
  'web.empty': { de: 'Leere Webserver-Liste', en: 'Empty web server list', route: '/web', modes: ['replace', 'after'] },
  'dbs.empty': { de: 'Leere Datenbankserver-Liste', en: 'Empty database server list', route: '/dbs', modes: ['replace', 'after'] },
  'minecraft.empty': { de: 'Leere Minecraft-Server-Liste', en: 'Empty Minecraft server list', route: '/mc', modes: ['replace', 'after'] },
};
const OVERRIDE_MAX_HEIGHT = 480;
/**
 * SDK 3.2: Einbaustellen für Abschnitte in Detailansichten (contributes.sections, native: Modul-Feld „sections“) – statt
 * eigener Reiter. Gleiche Liste in ui/src/extSections.js (scripts/ext-sections-test.js vergleicht beide).
 */
const SECTION_PLACES = {
  'mc.overview': { de: 'Minecraft-Server · Übersicht', en: 'Minecraft server · overview', ctx: '{ kind: "minecraft", id }' },
  'mc.players': { de: 'Minecraft-Server · Spieler', en: 'Minecraft server · players', ctx: '{ kind: "minecraft", id }' },
  'files.folder': { de: 'Dateien · geöffneter Ordner', en: 'Files · open folder', ctx: '{ kind: "folder", root, path }' },
  'web.site': { de: 'Webserver · Detailseite', en: 'Web server · detail page', ctx: '{ kind: "web", id }' },
};
const SECTION_MAX_HEIGHT = 900;
/**
 * SDK 3.2: Rolle eines Abschnitts ("role") – er übernimmt eine Karte, die Hostwerk an dieser Stelle selbst zeigt.
 * mc.overview + "motd": der Abschnitt zeigt und bearbeitet, wie Spieler den Server in der Serverliste sehen (MOTD + Symbol) –
 * Hostwerks Karte „So sehen Spieler deinen Server“ tritt dann zurück (keine doppelte Vorschau). Gleiche Liste in ui/src/extSections.js.
 */
const SECTION_ROLES = { 'mc.overview': ['motd'] };
/** Leistungsbudget: was in Hostwerks Oberfläche mitläuft (Seite + eigene Skripte/Stile einer Anpassung), bleibt klein. */
const OVERRIDE_BUDGET = 100 * 1024;
/** Was eine Erweiterung an einer anderen ergänzen darf (contributes.extends) – deren Autor erlaubt es in "allowExtensions". */
const EXTEND_POINTS = {
  tabs: { de: 'eigene Reiter auf ihrer Seite', en: 'own tabs on its page' },
  actions: { de: 'Aktionen in ihrem Seitenkopf', en: 'actions in its page header' },
  settings: { de: 'Einstellungen in ihrem Einstellungen-Dialog', en: 'settings inside its settings dialog' },
  locales: { de: 'ihre Texte umformulieren', en: 'reword its texts' },
  page: { de: 'ihre ganze Seite ersetzen', en: 'replace its whole page' },
};
/** Punkte, die ein Autor nur einer bestimmten Erweiterung erlauben kann (nicht mit "*" allen). */
const EXTEND_EXPLICIT = ['page', 'locales'];
/** Effektive Freigabe: was "target" (Manifest der erweiterten Erweiterung) der Erweiterung "id" erlaubt. */
function extendGrant(target, id) {
  const allow = target && target.allowExtensions && typeof target.allowExtensions === 'object' && !Array.isArray(target.allowExtensions) ? target.allowExtensions : {};
  const own = Array.isArray(allow[id]) ? allow[id] : [];
  const open = Array.isArray(allow['*']) ? allow['*'].filter((p) => !EXTEND_EXPLICIT.includes(p)) : [];
  return [...new Set([...own, ...open])].filter((p) => EXTEND_POINTS[p]);
}
/** Reicht ein Beitrag allein als Erweiterung? (Farbschema, Anpassung, Ergänzung einer anderen Erweiterung) */
function hasContribEntry(m) {
  const co = (m && m.contributes) || {};
  return ['themes', 'overrides', 'extends'].some((k) => Array.isArray(co[k]) && co[k].length > 0);
}
/** HTML-Seiten aus SDK-2.9-Beiträgen (Anpassungen, Reiter und Seiten für andere Erweiterungen). */
function contribPages(m) {
  const co = (m && m.contributes) || {};
  const ov = (Array.isArray(co.overrides) ? co.overrides : []).map((o) => o && o.file);
  const ex = (Array.isArray(co.extends) ? co.extends : []).flatMap((x) => (x ? [...(Array.isArray(x.tabs) ? x.tabs.map((t) => t && t.file) : []), x.page && x.page.file] : []));
  return [...ov, ...ex].filter((f) => typeof f === 'string' && /\.html?$/i.test(f));
}
/** Welche Punkte ein Eintrag in contributes.extends anfragt. */
function extendRequested(x) {
  if (!x || typeof x !== 'object') return [];
  return Object.keys(EXTEND_POINTS).filter((p) => (p === 'settings' ? x.settings === true : p === 'page' ? !!(x.page && x.page.file) : p === 'locales' ? !!(x.locales && typeof x.locales === 'object') : Array.isArray(x[p]) && x[p].length > 0));
}
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
  const key = method === 'GET' ? 'read' : 'write'; // POST, PUT und DELETE sind Änderungen
  return scopes(list).some((s) => (PERMISSIONS[s][key] || []).some((re) => re.test(clean)));
}
/** Änderung ohne Rückfrage je Aufruf? Nur wenn ausschließlich „quiet“-Rechte sie abdecken (z. B. Graph neu bauen). */
function quiet(list, method, p) {
  if (method === 'GET') return true;
  const clean = String(p || '').split('?')[0];
  const hits = scopes(list).filter((s) => (PERMISSIONS[s].write || []).some((re) => re.test(clean)));
  return hits.length > 0 && hits.every((s) => PERMISSIONS[s].quiet);
}
const text = (v, lang) => (v && typeof v === 'object' ? v[lang] || v.en || v.de || '' : String(v || ''));

function walk(dir, base = dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.github', 'videos-release'].includes(e.name)) continue;
    if (e.isSymbolicLink()) continue; // Verknüpfungen nie folgen (meldet checkPackage als Fehler „links“)
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, base)); else out.push(path.relative(base, p).replace(/\\/g, '/'));
  }
  return out;
}
/** Verknüpfungen (Symlinks, unter Windows auch Junctions) im Paket – zeigen sie nach außen, gehört das Paket nicht mehr sich selbst. */
function linksIn(dir, base = dir, out = []) {
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of list) {
    if (['node_modules', '.git', 'videos-release'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) out.push(path.relative(base, p).replace(/\\/g, '/'));
    else if (e.isDirectory() && out.length < 50) linksIn(p, base, out);
  }
  return out;
}

/*
 * Nicht umgehbar (Wartung, Hostwerk 2.12): Eine Erweiterung darf sich nicht verstecken, nicht unentfernbar machen und nicht
 * an Hostwerks Wartung (Schalter, Registrierung, Startprotokoll, Startschutz) heran. Manifest-Felder dafür gibt es nicht –
 * wer sie trotzdem setzt, wird abgelehnt; Code, der diese Dateien oder Schalter erwähnt, ebenso.
 */
const HIDING_KEYS = ['hidden', 'hide', 'invisible', 'unlisted', 'listed', 'visible', 'system', 'protected', 'locked', 'removable', 'uninstallable', 'noUninstall',
  'noDisable', 'disableable', 'essential', 'builtin', 'maintenance', 'safeMode', 'preload', 'bootstrap', 'loadOrder', 'autoload', 'persistent'];
const TAMPER_RE = /maintenance\.json|_installed\.json|_boot\.json|boot-guard\.json|hostwerk-files\.json|--maintenance|--hw-signal|erweiterungen-vorher|selbstwartung\.json/;

/**
 * Symbol prüfen – dieselbe Idee wie beim Plugin-Symbol in Minecraft-JARs: Format, Größe, quadratisch, sicher,
 * und auf hellem wie dunklem Hintergrund sichtbar (Marktplatz und Seitenleiste gibt es in beiden Designs).
 */
function checkIcon(file, rel, err, warn) {
  const ext = path.extname(file).toLowerCase();
  if (!['.svg', '.png', '.webp'].includes(ext)) { err('icon', `"icon" must be .svg, .png or .webp – got ${rel}.`); return; }
  const buf = fs.readFileSync(file);
  if (buf.length > 256 * 1024) warn('icon', `${rel} is ${Math.round(buf.length / 1024)} KB – keep icons under 256 KB.`);
  if (ext === '.png') {
    if (buf.readUInt32BE(0) !== 0x89504e47) { err('icon', `${rel} is not a PNG file.`); return; }
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== h) warn('icon', `${rel} is ${w}×${h} – icons should be square.`);
    if (w < 64) warn('icon', `${rel} is only ${w} px – use at least 128 px (or SVG).`);
    return;
  }
  if (ext !== '.svg') return;
  const svg = buf.toString('utf8');
  if (/<script|\son[a-z]+\s*=|javascript:/i.test(svg)) err('icon', `${rel} contains scripts or event handlers – not allowed in icons.`);
  if (/(?:xlink:)?href\s*=\s*["']\s*https?:/i.test(svg)) err('icon', `${rel} loads external files – embed everything in the SVG.`);
  const vb = (svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i) || []).slice(1).map(Number);
  if (vb.length === 2 && Math.abs(vb[0] - vb[1]) > Math.max(vb[0], vb[1]) * 0.05) warn('icon', `${rel} is not square (viewBox ${vb[0]}×${vb[1]}).`);
  // Animated icons (SDK 2.7): gentle motion is welcome, but it must stop for people who turned motion off
  if (/<animate|@keyframes/.test(svg) && !/prefers-reduced-motion/.test(svg)) warn('icon', `${rel} is animated – stop the motion under @media (prefers-reduced-motion: reduce).`);
  // Sichtbarkeit: Farben einsammeln; nur sehr dunkle bzw. nur sehr helle Farben ohne Hintergrundfläche fallen in einem Design weg
  const cols = [...svg.matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-f]{3,8}|white|black|currentColor)/gi)].map((x) => x[1].toLowerCase());
  if (!cols.length || cols.includes('currentcolor')) return; // currentColor passt sich an
  const lum = (c) => { if (c === 'white') return 1; if (c === 'black') return 0; let h = c.slice(1); if (h.length <= 4) h = h.split('').map((x) => x + x).join(''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ls = cols.map(lum);
  const hasBackdrop = /<(rect|circle)\b[^>]*(width\s*=\s*["'](100%|\d{2,})|r\s*=\s*["']\d{2,})/i.test(svg);
  if (!hasBackdrop && ls.every((l) => l < 0.04)) warn('icon', `${rel} only uses very dark colors – nearly invisible in the dark design. Add a light tile or use currentColor.`);
  if (!hasBackdrop && ls.every((l) => l > 0.85)) warn('icon', `${rel} only uses very light colors – nearly invisible in the light design. Add a colored tile or use currentColor.`);
}

/*
 * Gestaltungs-Hinweise (Regelwerk docs/ui-guidelines.md, „So sieht eine Hostwerk-Seite aus“): Stellen, an denen eine Seite
 * etwas selbst baut, wofür es einen Kern-Baustein gibt, oder anders schreibt als der Rest von Hostwerk. Nur Hinweise, kein
 * Punktabzug – und nur, was sich sicher erkennen lässt. Dieselben Regeln prüft scripts/ui-consistency-audit.js am Kern.
 *   kind: 'code' (JSX/JS/HTML), 'css', 'de' (deutsche Texte: locales/de.json bzw. deutsche Quelltexte im Kern)
 * find(src) liefert Fundstellen [{ i: Index, s: Ausschnitt }].
 */
const all = (re, src, pick = (m) => m[0]) => [...src.matchAll(re)].map((m) => ({ i: m.index, s: String(pick(m)).trim().slice(0, 70) }));
// Kleine Symbole folgen der Schriftstufe daneben (10–16 im Text, 18 in Köpfen); ab 20 (Seitenkopf, Bühnen, Logos) frei
const ICON_SIZES = new Set([10, 11, 12, 13, 14, 15, 16, 18]);
// Begriffe: EIN Wort je Sache (deutsch), in Klammern, wann das andere Wort richtig bleibt
const GLOSSARY = [
  { re: /\bKennw(ort|örter)/g, use: 'Passwort' },
  { re: /\bExtensions?\b/g, use: 'Erweiterung' }, // „Add-ons“ bleibt, wo es der Fachbegriff ist (Bedrock, Firefox)
  { re: /\bneustarten\b/g, use: 'neu starten (als Verb getrennt; „das Neustarten“ als Nomen ist richtig)' },
  { re: /(?<![-\w])Verzeichnis(se)?\b/g, use: 'Ordner' }, // „Anbieter-Verzeichnis“ (ein Katalog) bleibt
  { re: /\bLogin\b(?![\s-]?Token)/g, use: 'Anmeldung' }, // „Game Server Login Token“ ist ein Name
  { re: /(?<!\{)\b[Ee]-?mails?\b(?<![Ee]-mails?)(?<!E-Mails?)(?!\})/g, use: 'E-Mail (oder kurz Mail)' },
  { re: /\b(upgedatet|updaten|geupdated)\b/gi, use: 'aktualisieren' },
  { re: /\b(Backups?)\b(?![-.]?(Ordner|Befehl|Token|Codes?)\b|\/)/g, use: 'Sicherung' }, // Ordnernamen (Backups/…) bleiben
  { re: /(?<!→ )\bServices?\b(?!-Account)/g, use: 'Dienst' }, // Menünamen fremder Geräte („IP → Services“) bleiben
  { re: /\bPlug-?ins? \b(?=installieren)/g, use: 'Plugin' },
  { re: /\bKonfig\b/g, use: 'Einstellungen' },
  { re: /"(Lade\b[^"]{0,40}…|Wird geladen …)"/g, use: 'Lädt … (Fortschritt immer gleich: „Lädt …“, „Lädt Versionen …“)' },
];
const UI_HINTS = [
  { id: 'dots', kind: ['code', 'de'], msg: 'three dots "..." in a text – use the ellipsis "…" (with a space before it: "Speichern …").',
    find: (s) => all(/[A-Za-zÄÖÜäöüß)]\.\.\.(?=\s*(['"`<]|$))/gm, s) },
  { id: 'native-dialog', kind: ['code'], msg: 'browser dialog (alert/confirm/prompt) – use confirmDialog/promptDialog from @hostwerk/ui (pages: Hostwerk.ui).',
    find: (s) => all(/(?:^|[^\w.$])(?:window\.)?(alert|confirm|prompt)\(\s*['"`]/g, s) },
  { id: 'footer-order', kind: ['code'], msg: 'dialog footer: the main action stands before "Cancel" – cancel left, main action right (as in every Hostwerk dialog).',
    find: (s) => [...s.matchAll(/footer=\{<>([\s\S]{0,900}?)<\/>\}/g)].filter((m) => {
      const c = m[1].search(/>\s*(Abbrechen|Cancel)\s*</); const p = m[1].search(/className=["'`{][^>]*\b(primary|danger-solid)\b/);
      return c > 0 && p >= 0 && p < c;
    }).map((m) => ({ i: m.index, s: 'footer' })) },
  { id: 'exclaim', kind: ['code', 'de'], msg: 'exclamation mark in a button, title or message – Hostwerk talks calmly: "Gespeichert", not "Gespeichert!".',
    find: (s) => all(/(?:toast(?:\.\w+)?\(\s*['"`]([^'"`\n]{2,80}[a-zäöüß]!)['"`])|(?:>\s*([^<>{}\n]{2,40}[a-zäöüß]!)\s*<\/(?:Btn|button|h[1-4])>)|(?:: "([^"\n]{2,60}[a-zäöüß]!)",?$)/gm, s, (m) => m[1] || m[2] || m[3]) },
  { id: 'success-word', kind: ['code', 'de'], msg: '"erfolgreich"/"successfully" in a message – say what happened: "Gespeichert", "Server gestartet".',
    // nur Meldungen („erfolgreich gespeichert“, „Import erfolgreich.“) – Erfolgsquoten und „wenn erfolgreich“ sind Fakten
    find: (s) => all(/\b[Ee]rfolgreich\s+(ge\w+t|\w+iert|ausgeführt|abgeschlossen|beendet|erstellt|entfernt|verbunden)\b|\b(?!wenn\b|falls\b)[A-Za-zÄÖÜäöüß]\w+ erfolgreich[.!]?(?=["'`<])|\bsuccessfully\b/g, s) },
  { id: 'toast-kind', kind: ['code'], msg: 'toast(text, "success"/"error"/"warn") – use toast.success / toast.error / toast.warn.',
    find: (s) => all(/\btoast\((['"`])(?:(?!\1)[^\n])*\1\s*,\s*['"](success|error|warn)['"]\s*\)/g, s) }, // mit Dauer/Aktion ist toast(…) richtig
  { id: 'raw-pill', kind: ['code'], msg: 'hand-made status pill (class "pill …") – use <StatusPill state="running|stopped|error|…">, same words everywhere.',
    find: (s) => all(/className=\{?["'`]pill (running|stopped|error|starting|stopping)\b/g, s) },
  { id: 'text-loading', kind: ['code'], msg: 'card or area that only says "Loading …" – use <Loading> (area/card) or <PageSkeleton> (page). A short "Lädt …" inside a list or menu is fine.',
    find: (s) => all(/<(div|p)\s+className=["'][^"']*\b(card-body|card|card-pad|center-fill)\b[^"']*["'][^>]*>\s*(\{t\(['"])?(Lädt|Lade|Wird geladen|Laden|Loading)\b[^<]{0,24}<\/\1>/g, s) },
  { id: 'text-empty', kind: ['code'], msg: 'empty card as a grey sentence – use <TileEmpty icon={…} text="…" /> (card) or <Empty> (page/area): symbol, one sentence, at most one action.',
    find: (s) => all(/<(p|div)\s+className=["'](?=[^"']*\bcard-body\b)(?=[^"']*\bmuted\b)[^"']*["'][^>]*>\s*(\{t\(['"])?(Noch kein|Noch nichts|Keine |Kein |Nichts |No [a-z]+|Nothing )[^<]{0,80}<\/\1>/g, s) },
  { id: 'page-head', kind: ['code'], msg: 'page head without a one-line description – <div className="page-head"><div><h1><Icon size={22} /> Title</h1><p>One sentence.</p></div><div className="actions">…</div></div>; longer explanations go into an ⓘ (InfoTip).',
    find: (s) => [...s.matchAll(/className=["']page-head\b[^"']*["'][^>]*>([\s\S]{0,700}?)<\/h1>([\s\S]{0,200})/g)].filter((m) => !/^\s*(\{\s*\}\s*)?(\{[^}]*(&&|\?)\s*)?<p\b/.test(m[2]) && !/<p\b/.test(m[1])).map((m) => ({ i: m.index, s: 'page-head' })) },
  { id: 'label-colon', kind: ['code'], msg: 'label ending with ":" – Hostwerk labels stand above the field without a colon.',
    find: (s) => all(/<Field\s+label=["']([^"']*):["']|<label\b[^>]*>([^<{]{2,40}):\s*<\/label>/g, s) },
  { id: 'table-class', kind: ['code'], msg: '<table> without class "table" – the kit class gives header, row lines, hover and numbers right-aligned (td.num).',
    find: (s) => all(/<table(?![^>]*\bclass(Name)?=\{?["'`][^"'`]*\btable\b)[^>]*>/g, s) },
  { id: 'inline-font', kind: ['code'], msg: 'font size as a number in style={…} – use a class (small, tiny) or var(--fs-…).',
    find: (s) => all(/fontSize:\s*['"]?\d+(px)?['"]?/g, s) },
  { id: 'icon-size', kind: ['code'], msg: 'small icon off the scale – 12/13/14/16 next to text (like the font size), 18 in card heads, 22 in the page head.',
    find: (s) => (/lucide-react/.test(s) ? all(/\bsize=\{(\d+)\}/g, s).filter((x) => { const n = Number(/\d+/.exec(x.s)[0]); return n < 20 && !ICON_SIZES.has(n); }) : []) },
  { id: 'own-spinner', kind: ['code', 'css'], msg: 'own spinner – use <Loading>, <Spinner> or the busy state of <Btn> (spins by itself while the click runs).',
    // hw-spin ist Hostwerks eigene Dreh-Animation (ui/src/styles/motion.css, SDK 3.6) – kein eigener Kreisel
    find: (s) => all(/@keyframes\s+(?!hw-spin\b)[\w-]*spin\b|className=["'][^"']*\bspinner\b(?![^"']*\bsm\b)/g, s) },
  { id: 'css-scale', kind: ['css'], msg: 'font size/rounding in px – use a step of the scale: var(--fs-…), var(--r-…).',
    find: (s) => all(/^(?!\s*--)[^\n]*?\b(font-size|border-radius):\s*[0-9.]+px\s*[;}!]/gm, s, (m) => `${m[1]}: …px`) },
  // Weiß auf einer farbigen Kachel (wie .svc-icon) bleibt in beiden Designs richtig – das ist kein Fund
  { id: 'css-color', kind: ['css'], msg: 'fixed colour – use the tokens (var(--text), var(--surface), var(--accent), var(--ok) …) so light and dark mode work.',
    find: (s) => (/hostwerk-allow:\s*[a-z, ]*colors/.test(s) ? [] : all(/^(?!\s*--)[^\n]*?(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/gm, s.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, (x) => x.replace(/#|rgb|hsl/g, '_')).replace(/#fff(fff)?\b/gi, '_').replace(/hsla?\((?=\s*(var|calc)\()/g, '_'), (m) => m[1])) },
  { id: 'term', kind: ['de'], msg: 'different word for the same thing – Hostwerk glossary (docs/ui-guidelines.md, section "Wörter").',
    find: (s) => GLOSSARY.flatMap((g) => all(g.re, s).map((x) => ({ ...x, s: `${x.s} → ${g.use}` }))) },
];
/**
 * Gestaltungs-Hinweise für eine Datei. kinds: z. B. ['code', 'ext-code'] für eine Erweiterungs-Oberfläche.
 * Liefert [{ id, line, s }]. Kommentare im Code (Zeilen- und Blockkommentare) werden vorher ausgeblendet, damit sie nichts melden.
 */
function uiHintsFor(src, kinds) {
  let s = String(src);
  if (kinds.includes('code') || kinds.includes('css')) s = s.replace(/\/\*[\s\S]*?\*\//g, (c) => (/hostwerk-allow:/.test(c) ? c : c.replace(/[^\n]/g, ' '))).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (c, a) => a + ' '.repeat(c.length - a.length));
  const out = [];
  for (const r of UI_HINTS) {
    if (!r.kind.some((k) => kinds.includes(k))) continue;
    for (const x of r.find(s)) out.push({ id: r.id, line: s.slice(0, x.i).split('\n').length, s: x.s });
  }
  return out;
}
/** Deutsche Texte aus locales/de.json als eine Zeile je Eintrag („key": "Wert"), damit Zeilennummern stimmen. */
function deValues(json) {
  try { const o = JSON.parse(json); return '\n' + Object.values(o).filter((v) => typeof v === 'string').map((v) => `: ${JSON.stringify(v)},`).join('\n'); } catch { return ''; }
}

/** Banner: wide picture on top of the detail view and the catalog card (about 16:5, readable in light and dark). */
function checkBanner(file, rel, err, warn) {
  const ext = path.extname(file).toLowerCase();
  if (!['.svg', '.png', '.webp', '.jpg', '.jpeg'].includes(ext)) { err('banner', `"banner" must be .svg, .png, .webp or .jpg – got ${rel}.`); return; }
  const buf = fs.readFileSync(file);
  if (buf.length > 1024 * 1024) warn('banner', `${rel} is ${Math.round(buf.length / 1024)} KB – keep banners under 1 MB.`);
  if (ext !== '.svg') return;
  const svg = buf.toString('utf8');
  if (/<script|\son[a-z]+\s*=|javascript:/i.test(svg)) err('banner', `${rel} contains scripts or event handlers – not allowed.`);
  if (/(?:xlink:)?href\s*=\s*["']\s*https?:/i.test(svg) || /@import|url\(\s*["']?https?:/i.test(svg)) err('banner', `${rel} loads external files – embed everything in the SVG.`);
  const vb = (svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i) || []).slice(1).map(Number);
  if (vb.length === 2 && (vb[0] / vb[1] < 2.4 || vb[0] / vb[1] > 4.2)) warn('banner', `${rel} is ${vb[0]}×${vb[1]} – banners should be wide (about 16:5, e.g. 1280×400).`);
  if (/<animate|@keyframes/.test(svg) && !/prefers-reduced-motion/.test(svg)) warn('banner', `${rel} is animated – stop the motion under @media (prefers-reduced-motion: reduce).`);
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
  if (!m || typeof m !== 'object' || Array.isArray(m)) { err('manifest', 'manifest.json must be a JSON object.'); return { ok: false, errors, warnings, info, manifest: null, score: 0 }; }
  if (!ID_RE.test(m.id || '')) err('id', '"id" is missing or invalid (a–z, 0–9 and -, 2–40 characters).');
  // Nicht umgehbar: keine Felder zum Verstecken/Schützen, „_“-Felder setzt nur Hostwerk, keine Verknüpfungen nach außen
  const hiding = HIDING_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(m, k));
  if (hiding.length) err('hiding', `${hiding.map((k) => `"${k}"`).join(', ')}: extensions cannot hide, protect or prioritise themselves – every installed extension is listed in Hostwerk's maintenance and can be turned off or removed there. Remove ${hiding.length > 1 ? 'these fields' : 'this field'}.`);
  const reserved = Object.keys(m).filter((k) => k.startsWith('_'));
  // Nur ein Hinweis: installierte Pakete tragen Hostwerks eigene „_“-Felder; aus dem Paket mitgebrachte fallen beim Installieren weg
  if (reserved.length) info.push({ code: 'reserved', msg: `${reserved.map((k) => `"${k}"`).join(', ')}: fields starting with "_" are set by Hostwerk itself – they are dropped when installing.` });
  const links = linksIn(dir);
  if (links.length) err('links', `Links (symlinks/junctions) are not allowed – everything must be inside the package folder: ${links.slice(0, 5).join(', ')}.`);
  if (!m.name) err('name', '"name" is missing.');
  if (!SEMVER.test(m.version || '')) err('version', '"version" must look like 1.2.3.');
  // A pure language pack (only "languages") is an extension too
  // SDK 2.9: reine Farbschemata, Oberflächen-Anpassungen und Ergänzungen anderer Erweiterungen auch
  if (!m.page && !m.widget && !m.command && !m.backend && !m.ui && !(Array.isArray(m.languages) && m.languages.length) && !hasContribEntry(m)) err('entry', 'The extension needs a page ("page"), a dashboard tile ("widget"), a service ("command"), native code ("backend"/"ui"), language packs ("languages"), a theme, interface overrides or extensions of other extensions ("contributes.themes" / "overrides" / "extends").');
  // ---------- SDK 2.7: category, banner, screenshots, dependencies, native code ----------
  if (m.category === undefined) info.push({ code: 'category', msg: `Add "category" – one of: ${Object.keys(CATEGORIES).join(', ')}. The extension page groups by it.` });
  else if (!CATEGORIES[m.category]) err('category', `"category" must be one of: ${Object.keys(CATEGORIES).join(', ')}.`);
  if (m.banner !== undefined) {
    if (typeof m.banner !== 'string' || /\.\.|^\/|\\/.test(m.banner) || !fs.existsSync(path.join(dir, m.banner))) err('banner', `"banner" points to a missing file: ${m.banner}`);
    else checkBanner(path.join(dir, m.banner), m.banner, err, warn);
  } else info.push({ code: 'banner', msg: 'Add "banner": "banner.svg" (wide, about 16:5) – it heads the extension’s detail view and the catalog card.' });
  if (m.screenshots !== undefined) {
    if (!Array.isArray(m.screenshots) || m.screenshots.length > 6) err('screenshots', '"screenshots" must be a list of up to 6 image files.');
    else for (const s of m.screenshots) if (typeof s !== 'string' || !/\.(png|webp|jpe?g|svg)$/i.test(s) || /\.\.|^\/|\\/.test(s) || !fs.existsSync(path.join(dir, s))) err('screenshots', `Screenshot missing or not an image: ${s}`);
  }
  // ---------- SDK 3.5: explainer videos (list in the package, files in the release "videos" or next to the list) ----------
  if (m.videos !== undefined) {
    let list = null;
    if (typeof m.videos !== 'string' || !/\.json$/i.test(m.videos) || /\.\.|^\/|\\/.test(m.videos) || !fs.existsSync(path.join(dir, m.videos))) err('videos', `"videos" points to a missing list: ${m.videos} (e.g. "videos/index.json").`);
    else { try { list = JSON.parse(fs.readFileSync(path.join(dir, m.videos), 'utf8')); } catch { err('videos', `${m.videos} is not valid JSON.`); } }
    if (list && !Array.isArray(list)) err('videos', `${m.videos} must be a list: [{ "id", "lang", "title", "seconds" }].`);
    else if (list) {
      for (const v of list) {
        if (!v || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(v.id || '')) { err('videos', `Video id "${v && v.id}" – only a–z, 0–9 and -, 2–41 characters.`); continue; }
        if (typeof v.title !== 'string' || !v.title.trim()) err('videos', `Video "${v.id}" needs a "title".`);
        if (v.lang !== undefined && !['de', 'en'].includes(v.lang)) err('videos', `Video "${v.id}": "lang" is "de" or "en".`);
        if (v.seconds !== undefined && !(Number(v.seconds) > 0)) err('videos', `Video "${v.id}": "seconds" must be a positive number.`);
        if (v.of !== undefined && !list.some((x) => x && x.id === v.of)) err('videos', `Video "${v.id}": "of" names a video that is not in the list.`);
      }
      const repo = m.videosRepo || m.homepage || '';
      if (!/github\.com\/[\w.-]+\/[\w.-]+/.test(repo) && !list.every((v) => v && fs.existsSync(path.join(dir, path.dirname(m.videos), `${v.id}.mp4`)))) warn('videos', 'Videos are loaded from the release "videos" of your GitHub repository ("videosRepo" or "homepage") – neither is set and not every video is in the package.');
    }
  }
  // Daten für „Restlos entfernen“ (SDK 3.5): nur eigene Bereiche, nie Hostwerks
  if (m.data !== undefined) {
    const CORE_DIRS = ['bin', 'config', 'data', 'logs', 'run', 'cache', 'backups', 'htdocs', 'extensions', 'updates', 'webordner', 'projekte'];
    const INTERNAL = ['bin', 'config', 'extensions', 'run', 'updates'];
    const CORE_KEYS = ['general', 'live', 'ai', 'mail', 'php', 'deploy', 'databases', 'web', 'docker', 'db', 'apps', 'transfer', 'tasks', 'backups', 'apache', 'mariadb', 'extSettings', 'extOverrides', 'extRemoved', 'inventory'];
    if (!m.data || typeof m.data !== 'object' || Array.isArray(m.data)) err('data', '"data" must be an object: { "settings": [...], "folders": [...] }.');
    else {
      for (const k of m.data.settings || []) if (typeof k !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{1,40}$/.test(k) || CORE_KEYS.includes(k)) err('data', `data.settings: "${k}" is not allowed – only your own settings section (Hostwerk's own are never deleted).`);
      for (const f of m.data.folders || []) {
        const p = String(f).replace(/\\/g, '/');
        const parts = p.split('/');
        if (!/^[\w.-]+(\/[\w.-]+)*$/.test(p) || p.includes('..') || INTERNAL.includes(parts[0]) || (parts.length === 1 && CORE_DIRS.includes(parts[0]))) err('data', `data.folders: "${f}" is not allowed – a folder of your own below Hostwerk's folder, e.g. "minecraft" or "backups/minecraft".`);
      }
    }
  }
  // SDK 3.5: Dienste beim Entfernen von Hostwerk behalten, auch ohne laufendes Hostwerk (core/installer.js)
  if (m.keep !== undefined) {
    const k = m.keep || {};
    if (typeof k !== 'object' || Array.isArray(k)) err('keep', '"keep" must be an object: { kind, label, settings, list, dir, folder?, external?, detail? }.');
    else {
      if (!/^[a-z][a-z0-9-]{0,15}$/.test(k.kind || '')) err('keep', 'keep.kind: the id of your service kind (a–z, 0–9, -).');
      if (!/^[\w-]{1,40}$/.test(k.settings || '') || !/^[\w-]{1,40}$/.test(k.list || '')) err('keep', 'keep.settings / keep.list: your settings section and the array with the entries (e.g. "minecraft" / "servers").');
      const d = String(k.dir || '');
      if (!/^[\w./{}-]{1,120}$/.test(d) || d.includes('..') || d.startsWith('/') || !d.includes('{id}')) err('keep', 'keep.dir: folder of an entry relative to Hostwerk\'s folder with {id}, e.g. "minecraft/{id}".');
    }
  }
  if (m.videosRepo !== undefined && !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(String(m.videosRepo))) err('videosRepo', '"videosRepo" must be a GitHub repository address (https://github.com/owner/repo).');
  if (m.requires !== undefined) {
    if (!m.requires || typeof m.requires !== 'object' || Array.isArray(m.requires)) err('requires', '"requires" must be an object: { "other-extension": ">=1.0.0" }.');
    else for (const [dep, range] of Object.entries(m.requires)) {
      if (!ID_RE.test(dep)) err('requires', `"requires": "${dep}" is not a valid extension id.`);
      else if (dep === m.id) err('requires', 'An extension cannot require itself.');
      if (!RANGE_RE.test(String(range).trim())) err('requires', `"requires.${dep}": "${range}" must look like ">=1.2.0", "^1.2.0", "1.2.0" or "*".`);
    }
  }
  const native = !!(m.backend || m.ui);
  const permsRaw = Array.isArray(m.permissions) ? m.permissions : [];
  if (native && !permsRaw.includes('native')) err('native', 'Own server/interface code ("backend"/"ui") – add the "native" permission so people see it before installing (it runs sandboxed unless the package comes from the Hostwerk catalog).');
  if (!native && permsRaw.includes('native')) err('native', '"native" permission without "backend" or "ui".');
  for (const k of ['backend', 'ui']) {
    if (m[k] === undefined) continue;
    const f = m[k] && typeof m[k] === 'object' ? m[k].file : m[k];
    if (typeof f !== 'string' || /\.\.|^\/|\\/.test(f) || !/\.(c?js|mjs)$/.test(f)) { err(k, `"${k}" must name a .js file inside the package, e.g. "${k === 'backend' ? 'server/index.js' : 'ui/index.js'}".`); continue; }
    if (!fs.existsSync(path.join(dir, f))) { err(k, `"${k}" points to a missing file: ${f}`); continue; }
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (k === 'backend' && !/\bactivate\b/.test(src)) err('backend', `${f} must export activate(host) – see the guide, section “Native extensions”.`);
    if (k === 'ui' && !/\bregister\b|export\s+default|as\s+default\b/.test(src)) err('ui', `${f} must export default { pages, slots } – see the guide, section “Native extensions”.`);
  }
  for (const k of ['page', 'widget']) {
    const e = m[k];
    if (!e) continue;
    if (k === 'page' && m.ui && !e.file) continue; // native page: drawn by the ui module, page only names title/icon/description
    if (!e.file || /\.\.|^\/|\\/.test(e.file)) err(`${k}.file`, `"${k}.file" is missing or invalid.`);
    else if (!fs.existsSync(path.join(dir, e.file))) err(`${k}.file`, `"${k}.file" points to a missing file: ${e.file}`);
  }
  // Sprachpakete (manifest.languages): Datei vorhanden, Form wie en.json, Platzhalter passen
  if (m.languages !== undefined) {
    if (!Array.isArray(m.languages) || m.languages.length > 10) err('languages', '"languages" must be a list of up to 10 entries: [{ "id": "fr", "name": "Français", "file": "lang/fr.json" }].');
    else for (const l of m.languages) {
      if (!l || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(l.id || '') || ['de', 'en'].includes(l.id)) { err('languages', `Language id "${l && l.id}" is invalid (e.g. "fr", "pt-BR"; German and English are built in).`); continue; }
      if (!l.name) err('languages', `Language "${l.id}" needs a "name".`);
      const lf = l.file && !/\.\.|^[\\/]/.test(l.file) ? path.join(dir, l.file) : null;
      if (!lf || !fs.existsSync(lf)) { err('languages', `Language file for "${l.id}" is missing.`); continue; }
      let j = null; try { j = JSON.parse(fs.readFileSync(lf, 'utf8')); } catch { err('languages', `Language file for "${l.id}" is not valid JSON.`); continue; }
      if (!j || typeof j.texts !== 'object' || Array.isArray(j.texts)) err('languages', `Language file for "${l.id}" needs { "texts": { … } }.`);
      for (const p of Array.isArray(j && j.patterns) ? j.patterns : []) if (!Array.isArray(p) || (String(p[0]).match(/\{\}/g) || []).length !== (String(p[1]).match(/\{\}/g) || []).length) { warn('languages', `Pattern in "${l.id}" has a different number of {} placeholders – it is ignored.`); break; }
    }
  }
  // Seit SDK 2.2: Hostwerk zeichnet Kopf und Reiter selbst (page.description, page.tabs)
  if (m.page && m.page.tabs !== undefined) {
    if (!Array.isArray(m.page.tabs) || m.page.tabs.length > 8) err('page.tabs', '"page.tabs" must be a list of up to 8 tabs: [{ "id": "overview", "title": { "en": "Overview", "de": "Übersicht" }, "icon": "gauge" }].');
    else for (const tb of m.page.tabs) { if (!tb || !/^[a-z0-9-]{1,30}$/.test(tb.id || '')) err('page.tabs', 'Every tab needs an "id" (a–z, 0–9, -).'); else if (!tb.title) err('page.tabs', `Tab "${tb.id}" needs a "title".`); if (tb && tb.icon && !SIDEBAR_ICONS.includes(tb.icon)) warn('page.tabs', `Tab icon "${tb.icon}" is not a sidebar icon.`); }
  }
  if (m.page && !m.page.description && !m.description) warn('page.description', 'Add "page.description" – Hostwerk shows it under the page title like on its own pages.');
  // Beiträge zu Hostwerk-Bereichen: eigener Reiter auf Detailseiten, Aktionen in Schnellsuche und Rechtsklick-Menüs
  const PLACES = ['minecraft', 'web', 'db', 'app', 'game', 'project']; // 'project' seit SDK 2.10
  const FILE_PLACES = ['file', 'folder']; // SDK 3.2: Rechtsklick im Datei-Browser (nur Aktionen)
  const co = m.contributes || {};
  const sectionIds = new Set();
  if (co.sections !== undefined && !Array.isArray(co.sections)) err('contributes.sections', '"contributes.sections" is a list: [{ "id": "preview", "title": { … }, "on": "mc.overview", "file": "page/section.html" }].');
  if (Array.isArray(co.sections) && co.sections.length > 8) err('contributes.sections', 'At most 8 sections – Hostwerk shows two per extension and place.');
  for (const sc of Array.isArray(co.sections) ? co.sections : []) {
    if (!sc || !/^[a-z0-9-]{1,30}$/.test(sc.id || '') || !sc.title) { err('contributes.sections', 'Every section needs "id" (a–z, 0–9, -) and "title".'); continue; }
    if (sectionIds.has(sc.id)) err('contributes.sections', `Two sections are called "${sc.id}".`);
    sectionIds.add(sc.id);
    if (!SECTION_PLACES[sc.on]) err('contributes.sections', `Section "${sc.id}": "on" must be one of ${Object.keys(SECTION_PLACES).join(', ')}.`);
    else if (!sc.file || /\.\.|^\/|\\/.test(sc.file) || !/\.html?$/i.test(sc.file) || !fs.existsSync(path.join(dir, sc.file))) err('contributes.sections', `Section "${sc.id}": "file" is missing or not an .html file inside the package.`);
    if (sc.height !== undefined && !(Number.isFinite(sc.height) && sc.height >= 48 && sc.height <= SECTION_MAX_HEIGHT)) err('contributes.sections', `Section "${sc.id}": "height" is 48–${SECTION_MAX_HEIGHT} px (the frame grows with its content up to that).`);
    if (sc.icon !== undefined && !SIDEBAR_ICONS.includes(sc.icon)) warn('contributes.sections', `Icon "${sc.icon}" is not a sidebar icon.`);
    if (sc.role !== undefined && !(SECTION_ROLES[sc.on] || []).includes(sc.role)) err('contributes.sections', `Section "${sc.id}": "role" ${SECTION_ROLES[sc.on] ? `on ${sc.on} is ${SECTION_ROLES[sc.on].map((r) => `"${r}"`).join(' or ')}` : `is not available on ${sc.on}`}.`);
  }
  for (const tb of Array.isArray(co.tabs) ? co.tabs : []) {
    if (!tb || !/^[a-z0-9-]{1,30}$/.test(tb.id || '') || !tb.title) err('contributes.tabs', 'Every contributed tab needs "id" and "title".');
    else if (!PLACES.includes(tb.on) && !AREAS.includes(tb.on)) err('contributes.tabs', `Tab "${tb.id}": "on" must be one of ${PLACES.join(', ')} (detail pages) or ${AREAS.join(', ')} (main areas).`);
    else if (!tb.file || /\.\.|^\/|\\/.test(tb.file) || !fs.existsSync(path.join(dir, tb.file))) err('contributes.tabs', `Tab "${tb.id}": "file" is missing or points to a missing file.`);
    // SDK 3.2: "fallback": true = Reiter nur für ältere Hostwerk-Versionen ohne Abschnitte (ab 3.2 erscheint der Abschnitt)
    if (tb && tb.fallback !== undefined && typeof tb.fallback !== 'boolean') err('contributes.tabs', `Tab "${tb.id}": "fallback" is true or false.`);
    if (tb && tb.fallback === true && !(Array.isArray(co.sections) && co.sections.length)) warn('contributes.tabs', `Tab "${tb.id}" is a fallback, but no section replaces it ("contributes.sections").`);
    // "page": true = die ganze Seite (mit page.tabs als Unter-Navigation) erscheint als Reiter im Hauptbereich – Hostwerk
    // leitet #/ext/<id> dorthin um; ältere Hostwerk-Versionen zeigen file als normalen Reiter
    if (tb && tb.page !== undefined) {
      if (typeof tb.page !== 'boolean') err('contributes.tabs', `Tab "${tb.id}": "page" is true or false.`);
      else if (tb.page && !AREAS.includes(tb.on)) err('contributes.tabs', `Tab "${tb.id}": "page": true only works in a main area (${AREAS.join(', ')}).`);
      else if (tb.page && !(m.page && m.page.file === tb.file)) err('contributes.tabs', `Tab "${tb.id}": with "page": true, "file" is the page file ("${(m.page && m.page.file) || 'page.file'}") – older Hostwerk versions show it as a plain tab.`);
      else if (tb.page && co.tabs.filter((x) => x && x.page).length > 1) warn('contributes.tabs', 'Only the first tab with "page": true is used – the page lives in one area.');
    }
  }
  for (const a of Array.isArray(co.actions) ? co.actions : []) {
    if (!a || !/^[a-z0-9-]{1,30}$/.test(a.id || '') || !a.title) err('contributes.actions', 'Every action needs "id" and "title".');
    else if (!(Array.isArray(a.on) && a.on.length && a.on.every((x) => x === 'palette' || FILE_PLACES.includes(x) || (PLACES.includes(x) && x !== 'project')))) err('contributes.actions', `Action "${a.id}": "on" must list "palette" and/or ${[...PLACES.filter((x) => x !== 'project'), ...FILE_PLACES].join(', ')}.`);
    else if (!m.page) err('contributes.actions', `Action "${a.id}" opens the extension page – the extension needs a "page".`);
  }
  // SDK 2.8: einbauen wie eingebaute Funktionen – Platz in der Seitenleiste, Kachel im „Neu“-Menü, Ort der Einstellungen,
  // Synergien mit anderen Erweiterungen
  // SDK 3.2: "nav": false = kein eigener Eintrag – die Seite bleibt über Erweiterungen → Öffnen erreichbar, die Erweiterung
  // steckt als Reiter/Abschnitt/Kachel in Hostwerks Bereichen (ältere Hostwerk ignorieren false und zeigen den Eintrag weiter)
  const navOther = !!(m.ui || m.widget || (Array.isArray(co.tabs) && co.tabs.length) || (Array.isArray(co.sections) && co.sections.length) || (Array.isArray(co.actions) && co.actions.length));
  if (m.page && m.page.nav !== undefined && m.page.nav !== false && (m.page.nav === null || typeof m.page.nav !== 'object' || Array.isArray(m.page.nav))) err('page.nav', '"page.nav" is an object ({ "group": … }) or false (no own sidebar entry).');
  else if (m.page && m.page.nav === false && !navOther) warn('page.nav', '"page.nav": false hides the sidebar entry, but the extension has no other place (contributes.tabs/sections/actions, a native "ui" with slots or a dashboard tile) – people only find it under Extensions.');
  else if (m.page && m.page.nav !== undefined && m.page.nav !== false) {
    const nv = m.page.nav || {};
    const customGroup = typeof nv.group === 'string' && !NAV_GROUPS.includes(nv.group);
    if (nv.group !== undefined && !NAV_GROUPS.includes(nv.group) && !NAV_GROUP_RE.test(String(nv.group))) err('page.nav', `"page.nav.group" is ${NAV_GROUPS.slice(0, 3).join(', ')} or an own area id (a–z, 0–9, -).`);
    else if (customGroup && !(nv.groupTitle && nv.groupTitle.de && nv.groupTitle.en)) err('page.nav', 'An own area ("page.nav.group": "' + nv.group + '") needs "page.nav.groupTitle": { "de": …, "en": … }. It only shows while a page is in it – an empty area never appears.');
    if (nv.after !== undefined && !/^(ext:)?[a-z0-9][a-z0-9-]{1,39}$/.test(String(nv.after))) err('page.nav', '"page.nav.after" is the id of a sidebar entry (e.g. "mc", "terminal" or "ext:api-tester").');
    if (nv.order !== undefined && !(Number.isFinite(nv.order) && nv.order >= 0 && nv.order <= 100)) err('page.nav', '"page.nav.order" is a number from 0 to 100.');
  }
  for (const x of Array.isArray(co.new) ? co.new : []) {
    if (!x || !/^[a-z0-9-]{1,30}$/.test(x.id || '') || !x.title) err('contributes.new', 'Every "New" entry needs "id" and "title".');
    else if (!m.page) err('contributes.new', `"New" entry "${x.id}" opens the extension page – the extension needs a "page".`);
    else if (x.icon && !SIDEBAR_ICONS.includes(x.icon)) warn('contributes.new', `Icon "${x.icon}" is not a sidebar icon.`);
  }
  // Tastenkürzel (contributes.shortcuts): Kennung in Hostwerk ext:<id>:<kürzel>; nie eins, das Hostwerk oder der Rechner braucht
  if (co.shortcuts !== undefined && (!Array.isArray(co.shortcuts) || co.shortcuts.length > 20)) err('contributes.shortcuts', '"contributes.shortcuts" is a list of up to 20 shortcuts: [{ "id": "open", "title": { "en": …, "de": … }, "keys": "ctrl+alt+p", "action": "<page tab or action id>" }].');
  else for (const sc of co.shortcuts || []) {
    const keys = sc && typeof sc.keys === 'string' ? shortcutCombo(sc.keys) : null;
    if (!sc || !/^[a-z0-9-]{1,30}$/.test(sc.id || '') || !sc.title) err('contributes.shortcuts', 'Every shortcut needs "id" (a–z, 0–9, -) and "title".');
    else if (!keys) err('contributes.shortcuts', `Shortcut "${sc.id}": "keys" is one combination like "ctrl+alt+p" (ctrl, alt, shift, meta + one key).`);
    else if (!/(^|\+)(ctrl|alt|meta)\+/.test(keys) && !/(^|\+)f\d{1,2}$/.test(keys)) err('contributes.shortcuts', `Shortcut "${sc.id}": "${keys}" needs ctrl or alt (only F keys may stand alone) – otherwise it fires while typing.`);
    else if (SHORTCUT_RESERVED.includes(keys)) err('contributes.shortcuts', `Shortcut "${sc.id}": "${keys}" belongs to the system or text fields (copy, paste, undo …) and cannot be used.`);
    else if (!m.page && !m.ui) err('contributes.shortcuts', `Shortcut "${sc.id}" opens the extension page – the extension needs a "page".`);
    else {
      if (SHORTCUT_HOSTWERK.includes(keys)) warn('contributes.shortcuts', `Shortcut "${sc.id}": "${keys}" is one of Hostwerk's own shortcuts – it stays off until the user assigns it in Settings → General → Shortcuts.`);
      const targets = [...((m.page && Array.isArray(m.page.tabs)) ? m.page.tabs : []), ...(Array.isArray(co.actions) ? co.actions : []), ...(Array.isArray(co.new) ? co.new : [])].map((x) => x && x.id);
      if (sc.action !== undefined && !targets.includes(sc.action)) warn('contributes.shortcuts', `Shortcut "${sc.id}": "action" "${sc.action}" is neither a page tab nor an id from contributes.actions / contributes.new – it just opens the page.`);
    }
  }
  const scKeys = (Array.isArray(co.shortcuts) ? co.shortcuts : []).map((x) => x && typeof x.keys === 'string' && shortcutCombo(x.keys)).filter(Boolean);
  if (new Set(scKeys).size !== scKeys.length) warn('contributes.shortcuts', 'Two shortcuts use the same keys – only the first one works.');
  if (m.settingsTab !== undefined && !SETTINGS_TABS.includes(m.settingsTab)) err('settingsTab', `"settingsTab" must be one of ${SETTINGS_TABS.join(', ')}.`);
  for (const sy of Array.isArray(m.synergies) ? m.synergies : []) {
    if (!sy || !ID_RE.test(sy.with || '') || !sy.title) err('synergies', 'Every synergy needs "with" (extension id) and "title".');
    else if (sy.with === m.id) err('synergies', 'A synergy needs another extension.');
  }
  for (const k of ['provides', 'uses']) if (m[k] !== undefined && !(Array.isArray(m[k]) && m[k].every((n) => /^[a-z][\w-]{1,40}$/i.test(n)))) err(k, `"${k}" is a list of service names (letters, digits, - and _).`);
  if (m.page && m.page.icon && !SIDEBAR_ICONS.includes(m.page.icon)) warn('icon', `"page.icon" "${m.page.icon}" is not a sidebar icon – choose one of: ${SIDEBAR_ICONS.join(', ')}.`);
  // Same symbol in the sidebar and in the page header (native pages draw their own header) – otherwise people look for
  // a star in the sidebar and find a magnifier on the page.
  if (m.ui && m.page && m.page.icon && fs.existsSync(path.join(dir, 'ui', 'src'))) {
    const SPECIAL = { chart: 'BarChart3', 'bar-chart': 'BarChart3', book: 'BookOpen', code: 'Code2', file: 'FileText', gamepad: 'Gamepad2', dashboard: 'LayoutDashboard', grid: 'LayoutGrid', message: 'MessageSquare', news: 'Newspaper', cart: 'ShoppingCart', table: 'Table2', wand: 'Wand2', 'line-chart': 'LineChart', 'pie-chart': 'PieChart' };
    const want = SPECIAL[m.page.icon] || m.page.icon.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
    const ui = walk(path.join(dir, 'ui', 'src')).filter((f) => /\.jsx?$/.test(f)).map((f) => fs.readFileSync(path.join(dir, 'ui', 'src', f), 'utf8')).join('\n');
    const h = /<h1[^>]*>\s*<([A-Z]\w*)/.exec(ui);
    const fromLucide = h && new RegExp(`import\\s*\\{[^}]*\\b${h[1]}\\b[^}]*\\}\\s*from\\s*['"]lucide-react['"]`).test(ui);
    if (h && fromLucide) {
      const alias = new RegExp(`(\\w+)\\s+as\\s+${h[1]}\\b`).exec(ui);
      const used = alias ? alias[1] : h[1].replace(/Icon$/, '');
      const norm = (x) => x.replace(/\d+$/, '').replace(/Round$|Icon$/, '').toLowerCase();
      if (norm(used) !== norm(want)) warn('icon', `The sidebar shows "${m.page.icon}" (${want}) but the page header uses ${used} – use the same symbol in both places (page.icon or the <h1> icon).`);
    }
  }
  if (m.widget && m.widget.size && !['third', 'half', 'full'].includes(m.widget.size)) warn('widget.size', '"widget.size" should be third, half or full.');
  const perms = Array.isArray(m.permissions) ? m.permissions : [];
  for (const p of perms) if (!PERMISSIONS[p] && !LEGACY[p]) err('permissions', `Unknown permission "${p}". Allowed: ${Object.keys(PERMISSIONS).join(', ')}.`);
  // SDK 3.0: Abgekündigtes (mit Datum und Ersatz) – bis zur Entfernung nur eine Warnung
  for (const d of DEPRECATIONS) if (d.test(m)) warn(d.code, deprecationText(d));
  // SDK 3.0: für welches SDK geschrieben, experimentelle Schnittstellen nur mit Opt-in
  if (m.sdkVersion === undefined) info.push({ code: 'sdkVersion', msg: `No "sdkVersion" – add "sdkVersion": "${SDK_MAJOR}.${SDK_MINOR}" so Hostwerk knows which SDK this extension was written for.` });
  else if (!parseSdk(m.sdkVersion)) err('sdkVersion', '"sdkVersion" must look like "3.0".');
  else if (!sdkFits(m.sdkVersion)) err('sdkVersion', `Written for SDK ${m.sdkVersion}, but this is SDK ${SDK_VERSION} – needs a newer Hostwerk.`);
  else if (parseSdk(m.sdkVersion).major < SDK_MAJOR) info.push({ code: 'sdkVersion', msg: `Written for SDK ${m.sdkVersion} – still runs (SDK ${SDK_MAJOR} keeps everything from ${parseSdk(m.sdkVersion).major}.x). Set "sdkVersion": "${SDK_MAJOR}.${SDK_MINOR}" once you have checked it.` });
  if (m.experimental !== undefined) {
    if (!Array.isArray(m.experimental)) err('experimental', '"experimental" is a list of experimental API names.');
    else {
      for (const x of m.experimental) if (!EXPERIMENTAL[x]) err('experimental', `Unknown experimental API "${x}"${Object.keys(EXPERIMENTAL).length ? ` – available: ${Object.keys(EXPERIMENTAL).join(', ')}` : ' – there are none at the moment'}.`);
      if (m.experimental.length && strict) err('experimental', 'Experimental APIs are not allowed in the catalog – they may change in any version.');
      else if (m.experimental.length) info.push({ code: 'experimental', msg: `Uses experimental APIs (${m.experimental.join(', ')}) – they may change in any Hostwerk version.` });
    }
  }
  const net = Array.isArray(m.network) ? m.network : [];
  if (net.length && !perms.includes('network')) err('network', '"network" lists addresses, but the "network" permission is missing.');
  for (const h of net) if (!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(h)) err('network', `"network" entries must be https origins without path, e.g. https://api.example.com – got "${h}".`);
  if (m.hostwerk && typeof m.hostwerk === 'object' && !Array.isArray(m.hostwerk)) {
    // SDK 3.0: { "min": "3.0.0", "max": "3.x" }
    if (m.hostwerk.min !== undefined && !/^\d+\.\d+\.\d+$/.test(String(m.hostwerk.min))) err('hostwerk', '"hostwerk.min" must be a version like "3.0.0".');
    if (m.hostwerk.max !== undefined && !MAX_RE.test(String(m.hostwerk.max))) err('hostwerk', '"hostwerk.max" must be a version like "3.x", "3.4.x" or "3.4.2".');
    if (m.hostwerk.min && m.hostwerk.max && !hostwerkFits(m.hostwerk.min, m.hostwerk)) err('hostwerk', '"hostwerk.max" is lower than "hostwerk.min".');
  } else if (m.hostwerk && !/^>=\s*\d+\.\d+\.\d+$/.test(m.hostwerk)) warn('hostwerk', '"hostwerk" should be a minimum version like ">=3.0.0" or { "min": "3.0.0", "max": "3.x" }.');
  if (m.icon && !/^[\w-]+$/.test(m.icon) && !fs.existsSync(path.join(dir, m.icon))) err('icon', `"icon" points to a missing file: ${m.icon}`);
  if (!m.icon) warn('icon', 'No icon – add icon.svg (square, works on light and dark) and "icon": "icon.svg".');
  else if (!/^[\w-]+$/.test(m.icon) && fs.existsSync(path.join(dir, m.icon))) checkIcon(path.join(dir, m.icon), m.icon, err, warn);
  for (const s of Array.isArray(m.settings) ? m.settings : []) {
    if (!/^[a-zA-Z][\w-]{0,39}$/.test(s.key || '')) err('settings', `Setting without a valid "key": ${JSON.stringify(s).slice(0, 80)}`);
    if (!['text', 'number', 'switch', 'select'].includes(s.type)) err('settings', `Setting "${s.key}": type must be text, number, switch or select.`);
  }

  // ---------- SDK 2.9: Farbschemata, Oberflächen-Anpassungen, andere Erweiterungen erweitern ----------
  const review = []; // was eine Person im Katalog zusätzlich ansehen muss (besondere Prüfung)
  const fileIn = (f, re) => typeof f === 'string' && re.test(f) && !/\.\.|^\/|\\/.test(f) && fs.existsSync(path.join(dir, f));
  if (co.themes !== undefined) {
    if (!Array.isArray(co.themes) || co.themes.length > 6) err('contributes.themes', '"contributes.themes" is a list of up to 6 themes: [{ "id": "nord", "title": { "de", "en" }, "tokens": { "dark": { … }, "light": { … } } }].');
    else {
      const seen = new Set(); let fontBytes = 0;
      for (const th of co.themes) {
        const r = themeReport(th);
        r.errors.forEach((x) => err('contributes.themes', x));
        r.warnings.forEach((x) => warn('contributes.themes', x));
        if (th && th.id) { if (seen.has(th.id)) err('contributes.themes', `Two themes are called "${th.id}".`); seen.add(th.id); }
        if (th && th.title && !(th.title.de && th.title.en)) warn('i18n', `Theme "${th.id}": "title" should exist in German and English.`);
        for (const f of Array.isArray(th && th.fonts) ? th.fonts : []) {
          if (!f || typeof f.file !== 'string' || !FONT_FILE_RE.test(f.file) || /\.\.|^\/|\\/.test(f.file)) continue;
          if (!fs.existsSync(path.join(dir, f.file))) { err('contributes.themes', `Theme "${th.id}": font file is missing: ${f.file}`); continue; }
          fontBytes += fs.statSync(path.join(dir, f.file)).size;
        }
      }
      if (fontBytes > FONT_BUDGET) err('contributes.themes', `Font files are ${Math.round(fontBytes / 1024)} KB – at most ${FONT_BUDGET / 1024} KB (they load with every start). Use .woff2 and only the weights you need.`);
      else if (fontBytes > 600 * 1024) warn('contributes.themes', `Font files are ${Math.round(fontBytes / 1024)} KB – .woff2 with fewer weights loads faster.`);
    }
  }
  if (co.overrides !== undefined) {
    if (!Array.isArray(co.overrides) || co.overrides.length > 10) err('contributes.overrides', '"contributes.overrides" is a list of up to 10 overrides: [{ "id": "hero", "slot": "dashboard.hero", "mode": "replace", "title": { … }, "file": "overrides/hero.html" }].');
    else {
      if (co.overrides.length && !perms.includes('override:ui')) err('contributes.overrides', 'Overrides change Hostwerk’s own interface – add the permission "override:ui" so people see it before installing.');
      const seen = new Set();
      for (const o of co.overrides) {
        if (!o || !/^[a-z0-9-]{1,30}$/.test(o.id || '') || !o.title) { err('contributes.overrides', 'Every override needs "id" (a–z, 0–9, -) and "title".'); continue; }
        if (seen.has(o.id)) err('contributes.overrides', `Two overrides are called "${o.id}".`); seen.add(o.id);
        const slot = OVERRIDE_SLOTS[o.slot];
        if (!slot) { err('contributes.overrides', `Override "${o.id}": "slot" must be one of ${Object.keys(OVERRIDE_SLOTS).join(', ')}.`); continue; }
        if (!slot.modes.includes(o.mode)) err('contributes.overrides', `Override "${o.id}": "mode" for ${o.slot} is ${slot.modes.join(' or ')}.`);
        if (o.file === undefined && !m.ui) err('contributes.overrides', `Override "${o.id}" needs "file" (an HTML page in the package) – only official packages with an interface module may override with a component.`);
        else if (o.file !== undefined && !fileIn(o.file, /\.html?$/i)) err('contributes.overrides', `Override "${o.id}": "file" is missing or not an .html file inside the package.`);
        if (o.preview !== undefined && !fileIn(o.preview, /\.(png|webp|jpe?g|svg)$/i)) err('contributes.overrides', `Override "${o.id}": "preview" must be a picture in the package (shown before people agree).`);
        if (o.preview === undefined) info.push({ code: 'contributes.overrides', msg: `Override "${o.id}": add "preview" (a picture of the result) – people see it before they agree.` });
        if (o.height !== undefined && !(Number.isFinite(o.height) && o.height >= 32 && o.height <= OVERRIDE_MAX_HEIGHT)) err('contributes.overrides', `Override "${o.id}": "height" is 32–${OVERRIDE_MAX_HEIGHT} px (the frame grows with its content up to that).`);
        if (o.title && !(o.title.de && o.title.en)) warn('i18n', `Override "${o.id}": "title" should exist in German and English.`);
      }
      if (co.overrides.length) {
        review.push('override:ui');
        info.push({ code: 'review', msg: 'Changes Hostwerk’s own interface – the catalog reviews it by hand (technical and requirements). Outside official packages it only becomes active after the user agrees, and it can be switched off with one click.' });
      }
    }
  }
  if (co.extends !== undefined) {
    if (!Array.isArray(co.extends) || co.extends.length > 10) err('contributes.extends', '"contributes.extends" is a list of up to 10 entries: [{ "id": "other-extension", "tabs": [ … ], "actions": [ … ] }].');
    else {
      if (co.extends.length && !perms.includes('extend:extensions')) err('contributes.extends', 'Add the permission "extend:extensions" – people see which extensions this one changes before installing.');
      const seen = new Set();
      for (const x of co.extends) {
        if (!x || !ID_RE.test(x.id || '')) { err('contributes.extends', 'Every entry needs the "id" of the extension it extends.'); continue; }
        if (x.id === m.id) { err('contributes.extends', 'An extension cannot extend itself – use its own page, tabs and settings.'); continue; }
        if (seen.has(x.id)) err('contributes.extends', `"${x.id}" is listed twice – put everything for it into one entry.`); seen.add(x.id);
        if (x.version !== undefined && !RANGE_RE.test(String(x.version).trim())) err('contributes.extends', `"${x.id}": "version" must look like ">=1.2.0", "^1.2.0", "1.2.0" or "*".`);
        const req = extendRequested(x);
        if (!req.length) err('contributes.extends', `"${x.id}": name what you add – ${Object.keys(EXTEND_POINTS).join(', ')}.`);
        for (const tb of Array.isArray(x.tabs) ? x.tabs : []) {
          if (!tb || !/^[a-z0-9-]{1,30}$/.test(tb.id || '') || !tb.title) err('contributes.extends', `"${x.id}": every tab needs "id" and "title".`);
          else if (!fileIn(tb.file, /\.html?$/i)) err('contributes.extends', `"${x.id}": tab "${tb.id}" needs "file" (an HTML page in the package).`);
          else if (tb.icon && !SIDEBAR_ICONS.includes(tb.icon)) warn('contributes.extends', `"${x.id}": tab icon "${tb.icon}" is not a sidebar icon.`);
        }
        for (const a of Array.isArray(x.actions) ? x.actions : []) {
          if (!a || !/^[a-z0-9-]{1,30}$/.test(a.id || '') || !a.title) err('contributes.extends', `"${x.id}": every action needs "id" and "title".`);
          else if (!m.page) err('contributes.extends', `"${x.id}": action "${a.id}" opens this extension’s page – add a "page".`);
        }
        if (x.settings !== undefined && x.settings !== true) err('contributes.extends', `"${x.id}": "settings" is true (your own settings appear inside its settings dialog).`);
        if (x.settings === true && !(Array.isArray(m.settings) && m.settings.length)) err('contributes.extends', `"${x.id}": "settings": true – but this extension has no "settings".`);
        if (x.locales !== undefined) {
          const lc = x.locales && typeof x.locales === 'object' ? x.locales : {};
          if (!Object.keys(lc).length || Object.keys(lc).some((l) => !['de', 'en'].includes(l))) err('contributes.extends', `"${x.id}": "locales" is { "de": "extends/de.json", "en": "extends/en.json" }.`);
          for (const [l, f] of Object.entries(lc)) {
            if (!fileIn(f, /\.json$/i)) { err('contributes.extends', `"${x.id}": locales "${l}" points to a missing .json file.`); continue; }
            try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (!j || typeof j !== 'object' || Array.isArray(j) || Object.values(j).some((v) => typeof v !== 'string')) err('contributes.extends', `"${x.id}": ${f} must map keys to texts.`); } catch { err('contributes.extends', `"${x.id}": ${f} is not valid JSON.`); }
          }
        }
        if (x.page !== undefined && !(x.page && fileIn(x.page.file, /\.html?$/i))) err('contributes.extends', `"${x.id}": "page" is { "file": "extends/page.html" } – an HTML page in the package.`);
        if (req.some((p) => EXTEND_EXPLICIT.includes(p)) && !review.includes('extends')) review.push('extends');
        if (req.length) info.push({ code: 'contributes.extends', msg: `Extends "${x.id}" (${req.join(', ')}) – only works if "${x.id}" allows it in its own manifest: "allowExtensions": { "${m.id || 'this-id'}": ${JSON.stringify(req)} }. Its author can take it back in any new version.` });
      }
    }
  }
  if (m.publicView !== undefined) {
    const pv = m.publicView;
    if (!pv || typeof pv.file !== 'string' || /\.\.|^\/|\\/.test(pv.file) || !fs.existsSync(path.join(dir, pv.file))) err('publicView', '"publicView.file" must point to an HTML file in the package (e.g. "obs/index.html").');
    else if (!(m.permissions || []).includes('share:view')) err('publicView', '"publicView" needs the permission "share:view".');
    else if (!m.backend) warn('publicView', '"publicView" can only show data from the own public server part (/api/x/<id>/pub/…) – this extension has no "backend".');
    else info.push({ code: 'publicView', msg: `Public view without login: /v/${m.id || 'id'}/ – reads only /api/x/${m.id || 'id'}/pub/…` });
  }
  if (m.shareStorage !== undefined) {
    if (!Array.isArray(m.shareStorage) || m.shareStorage.some((x) => x !== '*' && !ID_RE.test(String(x)))) err('shareStorage', '"shareStorage" is a list of extension ids (or "*") that may read this extension\'s storage.');
    else if (!(m.permissions || []).includes('storage')) warn('shareStorage', '"shareStorage" shares the storage – but this extension has no "storage" permission.');
    else if (m.shareStorage.length) info.push({ code: 'shareStorage', msg: `Shares its storage (read only) with: ${m.shareStorage.join(', ')}.` });
  }
  if (m.allowExtensions !== undefined) {
    const ax = m.allowExtensions;
    if (!ax || typeof ax !== 'object' || Array.isArray(ax)) err('allowExtensions', '"allowExtensions" is an object: { "other-extension": ["tabs", "actions"], "*": ["tabs"] }.');
    else for (const [who, points] of Object.entries(ax)) {
      if (who !== '*' && !ID_RE.test(who)) err('allowExtensions', `"allowExtensions": "${who}" is neither an extension id nor "*".`);
      if (who === m.id) err('allowExtensions', 'An extension does not need to allow itself.');
      if (!Array.isArray(points) || !points.length || points.some((p) => !EXTEND_POINTS[p])) { err('allowExtensions', `"allowExtensions.${who}" is a list of: ${Object.keys(EXTEND_POINTS).join(', ')}.`); continue; }
      if (who === '*' && points.some((p) => EXTEND_EXPLICIT.includes(p))) err('allowExtensions', `"*" (everyone) cannot get ${EXTEND_EXPLICIT.join(' or ')} – allow that only to an extension you know by its id.`);
      if (points.some((p) => ['actions', 'page'].includes(p)) && !m.page && !m.ui) warn('allowExtensions', `"allowExtensions.${who}" allows actions/page – but this extension has no "page".`);
      if (points.includes('tabs') && !m.page && !m.ui) warn('allowExtensions', `"allowExtensions.${who}" allows tabs – but this extension has no page ("page" or native "ui", SDK 2.10).`);
      if (points.includes('settings') && !(Array.isArray(m.settings) && m.settings.length) && !m.page) warn('allowExtensions', `"allowExtensions.${who}" allows settings – but this extension has no settings dialog.`);
    }
  }

  // ---------- Least privilege: permissions that nothing in the page code uses ----------
  // Only for sandboxed pages (native code is reviewed by hand). Always a warning, also with --strict: a path can be built at runtime.
  if (!m.backend && !m.ui && perms.length) {
    const src = walk(dir).filter((f) => /\.(html?|js|mjs)$/i.test(f) && !/^(tests|scripts|docs)\//.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const paths = [...src.matchAll(/["'`](\/[^"'`\s]*)/g)].map((x) => x[1].replace(/\$\{[^}]*\}/g, 'x').replace(/\?.*$/, ''));
    // SDK helpers that use a permission without a literal path
    const HELPERS = {
      'read:services': /Hostwerk\.services\s*\(|Hostwerk\.on\(\s*['"]services|Hostwerk\.minecraft\.servers/, 'control:services': /Hostwerk\.service\s*\(/,
      'read:minecraft': /Hostwerk\.minecraft\.(servers|players|stats)/, 'command:minecraft': /Hostwerk\.minecraft\.command/,
      'run:terminal': /Hostwerk\.terminal\s*\(/, storage: /Hostwerk\.storage\./, network: /\bfetch\s*\(/,
    };
    const used = (p) => {
      if (HELPERS[p] && HELPERS[p].test(src)) return true;
      const res = [...(PERMISSIONS[p].read || []), ...(PERMISSIONS[p].write || [])];
      if (!res.length) return true; // nothing to compare against
      return paths.some((x) => res.some((re) => re.test(x)));
    };
    const unused = perms.filter((p) => PERMISSIONS[p] && p !== 'native' && !used(p));
    if (unused.length) warnings.push({ code: 'permissions-unused', msg: `Requested but apparently not used: ${unused.join(', ')} – ask only for what the code needs (people see every permission before installing).` });
  }
  // ---------- The other direction: SDK helpers used WITHOUT the permission → Hostwerk declines at runtime ----------
  // (People then see a warning "… wanted to access … and was declined" – e.g. Hostwerk.storage without "storage".)
  if (!m.backend) {
    const src = walk(dir).filter((f) => /\.(html?|js|mjs|jsx)$/i.test(f) && !/^(tests|scripts|docs|node_modules)\//.test(f) && !/(^|\/)ui\/index\.js$/.test(f)).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
    const NEEDS = { storage: /Hostwerk\.storage\.(get|set|remove|all)\s*\(/, 'run:terminal': /Hostwerk\.terminal\s*\(/, 'command:minecraft': /Hostwerk\.minecraft\.command\s*\(/, 'control:services': /Hostwerk\.service\s*\(/, 'use:ai': /Hostwerk\.ai\.explain\s*\(/ };
    const have = new Set(scopes(perms)); // alte Sammelrechte (z. B. „write“) zählen mit
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); // Beispiele in Kommentaren zählen nicht
    const missing = Object.entries(NEEDS).filter(([p, re]) => !have.has(p) && re.test(code)).map(([p]) => p);
    if (missing.length) warn('permissions', `The code uses ${missing.map((p) => `"${p}"`).join(', ')} but the manifest does not ask for it – Hostwerk will decline these calls. Add ${missing.length > 1 ? 'them' : 'it'} to "permissions".`);
  }

  // ---------- Eigener Server-Code (SDK 3.3): Kern-Interna und Spuren außerhalb des eigenen Ordners ----------
  if (m.backend) {
    const code = walk(dir).filter((f) => /\.(c|m)?js$/i.test(f) && !/^(tests|test|scripts|docs|node_modules|ui|browser-extension)\//.test(f))
      .map((f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch { return ''; } }).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    for (const x of INTERNALS) if (x.re.test(code) && !x.stable.test(code)) info.push({ code: 'internals', msg: `Uses a Hostwerk internal that has a stable replacement since SDK 3.3: ${x.use} (the internal stays as a fallback – deprecated since SDK 3.3.0 (2026-10-22), removed no earlier than SDK 4.0.0 and not before 2027-10-22; ask the stable service first, e.g. with host.supports()).` });
    const kinds = TRACE_PATTERNS.filter((x) => x.re.test(code)).map((x) => x.kind);
    // Immer Warnung (auch --strict): die Erkennung ist eine Vermutung aus dem Code
    if (kinds.length && !/\btraces\.add\s*\(/.test(code)) warnings.push({ code: 'traces', msg: `The server code seems to create things outside its own folder (${[...new Set(kinds)].join(', ')}) but never reports them with host.traces.add() – people could not see or remove them when uninstalling (SDK 3.3).` });
  }

  // ---------- Translations (German + English) ----------
  const both = (v) => v && typeof v === 'object' && v.de && v.en;
  if (!both(m.name)) warn('i18n', '"name" should exist in German and English: { "de": "…", "en": "…" }.');
  if (!both(m.description)) warn('i18n', '"description" should exist in German and English.');
  for (const k of ['page', 'widget']) if (m[k] && m[k].title && !both(m[k].title)) warn('i18n', `"${k}.title" should exist in German and English.`);
  for (const s of Array.isArray(m.settings) ? m.settings : []) if (!both(s.label)) warn('i18n', `Setting "${s.key}": "label" should exist in German and English.`);
  const loc = (l) => { const f = path.join(dir, 'locales', `${l}.json`); if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err('i18n', `locales/${l}.json is not valid JSON: ${e.message}`); return {}; } };
  const de = loc('de'), en = loc('en');
  if (m.ui || m.backend) {
    // Native extensions: English is the source text, locales/de.json maps it to German ({ "English": "Deutsch", "$patterns": [[…]] }).
    // locales/en.json is optional (only for wording overrides).
    if (!de) warn('i18n', 'Add locales/de.json – English texts are the keys, German the values (node tools/i18n-scan.js lists missing ones).');
    else {
      const empty = Object.entries(de).filter(([k, v]) => k !== '$patterns' && (typeof v !== 'string' || !v.trim())).map(([k]) => k);
      if (empty.length) warn('i18n', `locales/de.json has ${empty.length} empty translation(s), e.g. "${empty[0].slice(0, 50)}".`);
      if (de.$patterns !== undefined && (!Array.isArray(de.$patterns) || de.$patterns.some((p) => !Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || typeof p[1] !== 'string' || !p[1].trim()))) warn('i18n', 'locales/de.json "$patterns" must be a list of ["English {}", "Deutsch {}"] pairs.');
    }
  } else if ((!de || !en) && (m.page || m.widget || m.command || contribPages(m).length)) warn('i18n', 'Add locales/de.json and locales/en.json for all visible texts (Hostwerk.t("key"), data-i18n="key").');
  else if (de && en) {
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
  const pages = [m.page && m.page.file, m.widget && m.widget.file, ...((m.contributes && Array.isArray(m.contributes.tabs)) ? m.contributes.tabs.map((x) => x && x.file) : []), ...((m.contributes && Array.isArray(m.contributes.sections)) ? m.contributes.sections.map((x) => x && x.file) : []), ...contribPages(m)].filter(Boolean);
  let hardColors = 0; let fontHits = 0;
  // Native code (backend/ui) is reviewed by hand before it reaches the catalog; the sandbox rules below are for pages.
  const nativeDirs = ['backend', 'ui'].map((k) => (m[k] ? `${path.posix.dirname(String(typeof m[k] === 'object' ? m[k].file : m[k]))}/` : null)).filter((d) => d && d !== './');
  // browser-extension/ of a native package is a separate browser add-on that Hostwerk only hands out (it never runs here)
  const isNative = (f) => nativeDirs.some((d) => f.startsWith(d)) || /^(tests|scripts)\//.test(f) || (!!m.backend && /^browser-extension\//.test(f));
  for (const f of files.filter((x) => TEXT_EXT.test(x))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // Hostwerks Wartung gehört nur Hostwerk – gilt für Seiten UND nativen Code
    if (f !== 'manifest.json' && /\.(html?|c?js|mjs|jsx|ts|json)$/i.test(f) && TAMPER_RE.test(src)) err('tamper', `${f}: mentions Hostwerk's maintenance files or switches (${(src.match(TAMPER_RE) || [''])[0]}) – extensions must not touch them.`);
    if (/\.(html?|js|mjs)$/i.test(f) && isNative(f)) {
      if (/\beval\s*\(/.test(src)) err('eval', `${f}: eval is not allowed.`);
    } else if (/\.(html?|js|mjs)$/i.test(f)) {
      for (const mm of src.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) if (/^(https?:)?\/\//i.test(mm[1])) err('remote-script', `${f}: loads a script from the internet (${mm[1]}) – bundle it into the package.`);
      if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) err('eval', `${f}: eval/new Function is not allowed.`);
      // Unknown SDK functions (typos, invented APIs) – found before the page breaks at runtime
      const expMembers = new Map(Object.entries(EXPERIMENTAL).flatMap(([name, x]) => (x.members || []).map((mem) => [mem, name])));
      for (const mm of src.matchAll(/\bHostwerk\.([A-Za-z_$]+)(?:\.([A-Za-z_$]+))?/g)) {
        const [, top, sub] = mm;
        // Experimentelle Schnittstelle: nur mit Opt-in im Manifest
        const exp = expMembers.get(`${top}.${sub}`) || expMembers.get(top);
        if (exp) { if (!(Array.isArray(m.experimental) && m.experimental.includes(exp))) err('experimental', `${f}: Hostwerk.${top}${sub ? `.${sub}` : ''} is experimental – add "experimental": ["${exp}"] to the manifest (not allowed in the catalog).`); continue; }
        if (!Object.prototype.hasOwnProperty.call(SDK_MEMBERS, top)) { err('sdk-api', `${f}: Hostwerk.${top} does not exist – see the SDK guide (e.g. Hostwerk.get(path), Hostwerk.services()).`); continue; }
        if (sub && Array.isArray(SDK_MEMBERS[top]) && !SDK_MEMBERS[top].includes(sub)) err('sdk-api', `${f}: Hostwerk.${top}.${sub} does not exist – available: ${SDK_MEMBERS[top].join(', ')}.`);
      }
      if (/document\.cookie/.test(src)) err('cookie', `${f}: document.cookie is not available – use Hostwerk.storage.`);
      if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(src)) warn('storage', `${f}: browser storage does not work in the sandbox – use Hostwerk.storage.`);
      if (/\.innerHTML\s*=\s*`[^`]*\$\{/.test(src) || /\.innerHTML\s*=\s*[^;`]*\+/.test(src)) warn('xss', `${f}: innerHTML with inserted values – use Hostwerk.render(el, Hostwerk.html\`…\`) so names and texts are escaped.`);
      if (/\bfetch\s*\(\s*['"`]https?:/.test(src) && !net.length) err('network', `${f}: talks to the internet without "network" in the manifest.`);
    }
    if (/\.(html?|css)$/i.test(f) && !isNative(f)) {
      // Colours outside var(--hw-…): fallbacks inside var() are fine
      const noVars = src.replace(/var\([^)]*\)/g, '').replace(/<script[\s\S]*?<\/script>/gi, '');
      const css = /\.css$/i.test(f) ? noVars : [...noVars.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"/gi)].map((x) => x[1] || x[2] || '').join('\n');
      // Bewusste Ausnahme je Datei, mit Begründung: /* hostwerk-allow: colors, fonts – Vorschau wie im Spiel */
      // (z. B. eine Nachbildung der Minecraft-Serverliste, die in Hell und Dunkel gleich aussehen muss)
      const allow = (src.match(/hostwerk-allow:\s*([a-z, ]+)[–-]\s*(.{10,})/i) || [])[1] || '';
      if (allow) info.push({ code: 'allow', msg: `${f}: intentional exception (${allow.trim()}) – ${(src.match(/hostwerk-allow:[^*\n]*/i) || [''])[0].trim()}` });
      if (!/colors/.test(allow)) hardColors += (css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/gi) || []).length;
      // Schriften auf dem Text MIT var() prüfen (font-family: var(--mono) ist Hostwerks eigene Schrift und erlaubt)
      const rawCss = /\.css$/i.test(f) ? src : [...src.replace(/<script[\s\S]*?<\/script>/gi, '').matchAll(/<style[^>]*>([\s\S]*?)<\/style>|style="([^"]*)"/gi)].map((x) => x[1] || x[2] || '').join('\n');
      if (!/fonts/.test(allow)) fontHits += (rawCss.match(/font-family\s*:(?!\s*(inherit|var\())/gi) || []).length;
      if (/position\s*:\s*fixed/i.test(css)) warn('overlay', `${f}: position: fixed – extensions should not lay anything over Hostwerk.`);
      if (/z-index\s*:\s*\d{4,}/i.test(css)) warn('overlay', `${f}: very high z-index.`);
    }
  }
  // Gestaltungs-Hinweise (ohne Punktabzug): Eigenbau statt Kern-Baustein, andere Wörter als im Rest von Hostwerk
  const hintCount = new Map();
  for (const f of files) {
    // gebaute Oberfläche (ui/index.js) nicht doppelt, Tests/Server-Code sind keine Oberfläche
    const ui = !/^(tests|scripts|backend|server|browser-extension|node_modules)\//.test(f) && f !== 'ui/index.js' && f !== 'ui/index.css' && !/\.min\.js$/.test(f);
    const kinds = !ui ? null : /\.(jsx?|mjs|html?)$/i.test(f) ? ['code', 'ext-code'] : /\.css$/i.test(f) ? ['css'] : f === 'locales/de.json' ? ['de'] : null;
    if (!kinds) continue;
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const h of uiHintsFor(kinds[0] === 'de' ? deValues(raw) : raw, kinds)) {
      const c = hintCount.get(h.id) || { n: 0, at: [] };
      c.n++; if (c.at.length < 3) c.at.push(kinds[0] === 'de' ? `${f} („${h.s}“)` : `${f}:${h.line}`);
      hintCount.set(h.id, c);
    }
  }
  for (const [id, c] of hintCount) info.push({ code: `ui-${id}`, msg: `${UI_HINTS.find((r) => r.id === id).msg} ${c.n}× – ${c.at.join(', ')}${c.n > c.at.length ? ' …' : ''}` });
  if (hardColors) warn('colors', `${hardColors} fixed colour(s) – use var(--hw-text), var(--hw-surface), var(--hw-accent) … so light and dark mode work.`);
  if (fontHits) warn('fonts', `${fontHits} own font(s) – leave the font to Hostwerk (var(--hw-font)).`);
  for (const p of pages) {
    if (!fs.existsSync(path.join(dir, p))) continue;
    const src = fs.readFileSync(path.join(dir, p), 'utf8');
    if (!/<script[^>]+src=["']\/ext-sdk\.js["']/.test(src)) warn('sdk', `${p}: does not load /ext-sdk.js – without it the page cannot talk to Hostwerk and does not get the design kit.`);
    if (!/<meta[^>]+viewport/i.test(src)) info.push({ code: 'viewport', msg: `${p}: add <meta name="viewport" content="width=device-width, initial-scale=1"> for phones.` });
  }
  // ---------- Besondere Prüfung (SDK 2.9): alles, was in Hostwerks Oberfläche oder in fremden Erweiterungen mitläuft ----------
  // Leistung (Budget), Barrierefreiheit, Übersetzungen vollständig, kein Netz ohne Recht. Verstöße sind Fehler – der Katalog
  // nimmt solche Pakete nicht auf; eine Person sieht sich danach Anforderungen und Code an (review).
  if (review.length) {
    for (const p of [...new Set(contribPages(m))]) {
      if (!fs.existsSync(path.join(dir, p))) continue;
      const html = fs.readFileSync(path.join(dir, p), 'utf8');
      const local = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"':]+)["']/gi)].map((x) => x[1]).filter((x) => !x.startsWith('/'))
        .map((x) => path.posix.normalize(path.posix.join(path.posix.dirname(p), x))).filter((x) => !x.startsWith('..') && fs.existsSync(path.join(dir, x)));
      const bytes = Buffer.byteLength(html) + local.reduce((n, x) => n + fs.statSync(path.join(dir, x)).size, 0);
      if (bytes > OVERRIDE_BUDGET) err('review-performance', `${p}: ${Math.round(bytes / 1024)} KB with its scripts and styles – at most ${OVERRIDE_BUDGET / 1024} KB for anything that runs inside Hostwerk’s own pages.`);
      const code = [html, ...local.filter((x) => /\.m?js$/i.test(x)).map((x) => fs.readFileSync(path.join(dir, x), 'utf8'))].join('\n');
      if (/setInterval\s*\(\s*[^,]+,\s*([0-9]{1,3})\s*\)/.test(code)) err('review-performance', `${p}: setInterval faster than once a second – use Hostwerk.on(…) events or poll slowly (≥ 10 s).`);
      // Barrierefreiheit (WCAG 2.2 AA): Sprache, Namen für Knöpfe und Bilder, Tab-Reihenfolge, sichtbarer Fokus
      if (!/<html[^>]*\blang=/i.test(html)) err('review-a11y', `${p}: <html lang="…"> is missing – screen readers need the language (the SDK updates it when the language changes).`);
      for (const b of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
        const inner = b[2].replace(/<[^>]+>/g, '').trim();
        if (!inner && !/aria-label|data-i18n-aria-label|title=/.test(b[1]) && !/data-i18n=/.test(b[1])) err('review-a11y', `${p}: a <button> without text or aria-label – screen readers cannot name it.`);
      }
      if ([...html.matchAll(/<img\b([^>]*)>/gi)].some((x) => !/\balt=/.test(x[1]))) err('review-a11y', `${p}: <img> without alt – use alt="" for decoration.`);
      if (/tabindex=["']?[1-9]/.test(html)) err('review-a11y', `${p}: tabindex above 0 breaks the keyboard order.`);
      if (/outline\s*:\s*(none|0)\b/i.test(html) && !/:focus-visible/.test(html)) err('review-a11y', `${p}: removes the focus outline without a :focus-visible replacement.`);
      // Übersetzungen: jeder benutzte Schlüssel in beiden Sprachen
      const keys = [...html.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?=["']([\w.-]+)["']/g), ...code.matchAll(/Hostwerk\.t\(\s*['"]([\w.-]+)['"]/g)].map((x) => x[1]);
      const missing = [...new Set(keys)].filter((k) => !(de && k in de) || !(en && k in en));
      if (missing.length) err('review-i18n', `${p}: texts missing in locales/de.json or locales/en.json: ${missing.slice(0, 8).join(', ')}.`);
      // Netz: nur mit dem Recht „network“ (und nur zu den genannten Adressen – das erzwingt die CSP zusätzlich)
      if (!perms.includes('network') && /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon)/.test(code)) err('review-network', `${p}: talks to the network without the "network" permission.`);
    }
  }
  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);
  return { ok: errors.length === 0, errors, warnings, info, manifest: m, score, size, sdk: SDK_VERSION, review };
}

module.exports = { checkPackage, HIDING_KEYS, TAMPER_RE, PERMISSIONS, NEVER, LEGACY, scopes, allows, quiet, text, SDK_VERSION, ID_RE, SIDEBAR_ICONS, SDK_MEMBERS, CATEGORIES, satisfies, cmpVer, RANGE_RE, AREAS, NAV_GROUPS, NAV_GROUP_RE, SETTINGS_TABS, shortcutCombo, SHORTCUT_RESERVED, SHORTCUT_HOSTWERK,
  // SDK 3.3
  INTERNALS, TRACE_PATTERNS, UI_HINTS, GLOSSARY, ICON_SIZES, uiHintsFor, deValues,
  // SDK 3.0
  SDK_MAJOR, SDK_MINOR, DEPRECATIONS, EXPERIMENTAL, deprecationText, parseSdk, sdkFits, hostwerkRange, hostwerkFits, hostwerkLabel,
  // SDK 2.9
  themeReport, THEME_TOKENS, THEME_COLOR_TOKENS, THEME_SOFT_TOKENS, THEME_SHADOW_TOKENS, THEME_DEFAULTS, THEME_DENSITY, contrastHex, OVERRIDE_SLOTS, OVERRIDE_MAX_HEIGHT, SECTION_PLACES, SECTION_ROLES, SECTION_MAX_HEIGHT, OVERRIDE_BUDGET, EXTEND_POINTS, EXTEND_EXPLICIT, extendGrant, extendRequested, contribPages };

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
  if (r.review && r.review.length) console.log(`  ⚑ special review in the catalog: ${r.review.join(', ')} (see the SDK guide, section 17)`);
  console.log(r.ok ? `✓ passed (score ${r.score}/100)` : `✗ ${r.errors.length} error(s)`);
  process.exit(r.ok ? 0 : 1);
}
