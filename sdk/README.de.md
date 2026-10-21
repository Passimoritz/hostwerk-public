# Hostwerk-Erweiterungen bauen

[English](README.md) · **Deutsch**

Eine Erweiterung bringt eine **Seite** (in der Seitenleiste), eine **Kachel** (in der Übersicht) und/oder einen
**Dienst** (ein Programm, das Hostwerk startet) nach [Hostwerk](https://github.com/Passimoritz/hostwerk-public). Sie ist
ein Ordner mit `manifest.json`, normalem HTML/JavaScript und zwei Textdateien – ohne Build-Schritt, ohne Framework.

| Spieler-Ticker (dunkel) | Spieler-Ticker (hell) |
|---|---|
| ![Spieler-Ticker im dunklen Design](img/player-ticker-dark.png) | ![Spieler-Ticker im hellen Design](img/player-ticker-light.png) |

Erweiterungen **können Hostwerks Design nicht brechen**: Das SDK bringt den Design-Baukasten mit und gibt Farben,
Hell/Dunkel, Schrift und Sprache zur Laufzeit an die Seite weiter. Nutze die `hw-*`-Klassen und `var(--hw-…)`-Farben –
die Prüfung warnt bei festen Farben und eigenen Schriften.

![So läuft eine Erweiterung](img/architecture.svg)

---

## Inhalt

1. [Schnellstart (5 Minuten)](#1-schnellstart-5-minuten)
2. [Das Paket](#2-das-paket)
3. [manifest.json](#3-manifestjson)
4. [Das SDK – `Hostwerk.*`](#4-das-sdk--hostwerk)
5. [Design-Baukasten](#5-design-baukasten)
6. [Übersetzungen (Deutsch + Englisch)](#6-übersetzungen-deutsch--englisch)
7. [Rechte](#7-rechte)
8. [Einstellungen, Speicher, Ereignisse](#8-einstellungen-speicher-ereignisse)
9. [Kacheln für die Übersicht](#9-kacheln-für-die-übersicht)
10. [Erweiterung prüfen](#10-erweiterung-prüfen)
11. [Veröffentlichen: Repository, Release, Einreichen](#11-veröffentlichen-repository-release-einreichen)
12. [Vertrauensstufen und Verifizierung](#12-vertrauensstufen-und-verifizierung)
13. [Sicherheit](#13-sicherheit)
14. [Beispiele](#14-beispiele)
15. [SDK 2.7: Aussehen, Abhängigkeiten und native Erweiterungen](#15-sdk-27-aussehen-abhängigkeiten-und-native-erweiterungen)
16. [SDK 2.8: eingebaut wie Hostwerk selbst – und abgeschottet](#16-sdk-28-eingebaut-wie-hostwerk-selbst--und-abgeschottet)
17. [SDK 2.9: Farbschemata, Anpassungen und andere Erweiterungen erweitern](#17-sdk-29-farbschemata-anpassungen-und-andere-erweiterungen-erweitern)
18. [SDK 2.10: Ereignisse, Benachrichtigungen, Dienste steuern und öffentliche Ansichten](#18-sdk-210-ereignisse-benachrichtigungen-dienste-steuern-und-öffentliche-ansichten)
19. [SDK 3.0: Stabilität und Abkündigungen](#19-sdk-30-stabilität-und-abkündigungen)
20. [SDK 3.1: geteilter Seiten-Check und Notizen im Wissensgraph](#20-sdk-31-geteilter-seiten-check-und-notizen-im-wissensgraph)

![Von der Idee in den Marktplatz](img/lifecycle.svg)

---

## 1. Schnellstart (5 Minuten)

**Am einfachsten – das Erweiterungs-Studio:** *Erweiterungen → Für Entwickler → Neue Erweiterung*. Ein grafischer Editor
führt durch Grunddaten, Platz in Hostwerk, Rechte, Inhalt (Bausteine wie Kennzahlen, Listen, Knöpfe, Formulare – oder
eigener Code), Texte, Live-Vorschau, Prüfung und Veröffentlichung (GitHub-Repository mit Release, Einreichen im Katalog).

**Weg A – in Hostwerk:** *Apps → Erweiterungen → Eigene bauen*. Hostwerk legt `<Hostwerk>/extensions/<id>/` an – mit
lauffähiger Seite, Texten auf Deutsch und Englisch und einem Symbol. Die Seite erscheint sofort in der Seitenleiste;
Dateien bearbeiten und oben auf **Neu laden** tippen.

**Weg B – auf GitHub:** [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) öffnen →
**Use this template**. Das Repository bringt die Prüfung (GitHub-Action) und automatische Releases schon mit.

Ausprobieren in Hostwerk: *Apps → Erweiterungen → Datei* (ZIP des Ordners) oder *Von Link* (Link zu einem Release-ZIP).

## 2. Das Paket

```
meine-erweiterung/
├─ manifest.json        Name, Version, Rechte, Seite/Kachel/Einstellungen
├─ icon.svg             quadratisch, farbig – im Marktplatz und im Kopf der Seite
├─ page/
│  ├─ index.html        die Seite (lädt zuerst /ext-sdk.js)
│  └─ app.js            dein Code (keine Skripte aus dem Internet – alles ins Paket)
├─ widget/
│  └─ index.html        optionale Kachel für die Übersicht
└─ locales/
   ├─ de.json           alle sichtbaren Texte auf Deutsch
   └─ en.json           … und auf Englisch
```

Höchstens 10 MB. Keine Programme (`.exe`, `.sh` …) in Paketen, die nur Seiten haben.

## 3. manifest.json

```json
{
  "$schema": "https://raw.githubusercontent.com/Passimoritz/hostwerk-public/main/sdk/manifest.schema.json",
  "id": "player-ticker",
  "name": { "de": "Spieler-Ticker", "en": "Player Ticker" },
  "description": { "de": "Wer ist gerade online?", "en": "Who is online right now?" },
  "version": "1.0.0",
  "author": "Dein Name",
  "homepage": "https://github.com/du/hostwerk-ext-player-ticker",
  "icon": "icon.svg",
  "hostwerk": ">=3.0.0",
  "sdkVersion": "3.0",
  "permissions": ["read:services", "read:minecraft", "storage"],
  "page":   { "title": { "de": "Spieler-Ticker", "en": "Player Ticker" }, "icon": "users", "file": "page/index.html" },
  "widget": { "title": { "de": "Spieler online", "en": "Players online" }, "file": "widget/index.html", "size": "third" },
  "settings": [
    { "key": "refresh", "type": "number", "label": { "de": "Aktualisieren (Sekunden)", "en": "Refresh (seconds)" }, "default": 10, "min": 3, "max": 120 }
  ]
}
```

| Feld | Bedeutung |
|---|---|
| `id` | a–z, 0–9 und `-`, 2–40 Zeichen. Bleibt für immer gleich. |
| `name`, `description`, `title`, `label` | Text oder `{ "de": …, "en": … }` – im Katalog sind beide Sprachen Pflicht. |
| `version` | `1.2.3`. Eine höhere Version erscheint in Hostwerk als Update. |
| `icon` | Quadratisches SVG/PNG im Paket – Marktplatz-Karte und Kopf der Seite. |
| `page.icon` | **Symbol in der Seitenleiste** – ein schlichtes Linien-Symbol wie bei Hostwerks eigenen Bereichen. Einer von: `puzzle users monitor gauge activity chart bell book bot box calendar camera clock cloud code coffee cpu database download file flag gamepad gift globe heart home image inbox key dashboard grid leaf line-chart list lock mail map message music network news package pie-chart radio rocket server settings shield cart sparkles star sun swords table tag terminal timer trophy tv wand wifi wrench zap`. |
| `sdkVersion` | Das SDK, für das die Erweiterung geschrieben ist, z. B. `"3.0"` – siehe [Abschnitt 19](#19-sdk-30-stabilität-und-abkündigungen). |
| `hostwerk` | Mindestversion, z. B. `>=3.0.0` – ältere Hostwerk-Versionen installieren nicht. Oder `{ "min": "3.0.0", "max": "3.x" }` mit Höchstversion. |
| `permissions` | Was die Erweiterung sehen und tun darf – siehe [Rechte](#7-rechte). |
| `network` | Webadressen, die die Seite per `fetch` erreichen darf (braucht das Recht `network`), z. B. `["https://api.example.com"]`. |
| `settings` | Formular, das Hostwerk zeichnet: `text`, `number` (`min`/`max`), `switch`, `select` (`options`). |

Mit der `$schema`-Zeile gibt es in VS Code Vorschläge beim Tippen.

## 4. Das SDK – `Hostwerk.*`

Zuerst laden: `<script src="/ext-sdk.js"></script>`. Das lädt auch den Design-Baukasten (siehe 5).

```js
const info = await Hostwerk.ready();           // Farben, Sprache, Einstellungen, Reiter, Kontext, Aktion sind da
const list = await Hostwerk.services();       // [{ id, kind, name, state, port, cpu, memory, startedAt, extra }]
const mc = await Hostwerk.minecraft.servers(); // nur Minecraft; extra.players, extra.tps
const stats = await Hostwerk.minecraft.stats(id);

Hostwerk.render('#list', Hostwerk.html`<b>${name}</b>`);   // jeder ${wert} wird maskiert – sicher für Spielernamen
Hostwerk.t('summary', { n: 3 });                            // Text aus locales/<sprache>.json, {n} eingesetzt
Hostwerk.fmt.bytes(123456); Hostwerk.fmt.duration(ms); Hostwerk.fmt.time(Date.now());

await Hostwerk.service('web', 'apache').restart();  // fragt vorher (braucht control:services)
await Hostwerk.minecraft.command(id, 'say Hi');     // fragt vorher (braucht command:minecraft)
await Hostwerk.put('/mc/servers/' + id + '/properties', { motd: '§aHi' }); // Einstellung ändern (change:minecraft, fragt vorher) – SDK 2.2
await Hostwerk.del('/knowledge/' + id + '/memory/' + eintrag);             // löschen (SDK 2.3)
const ordner = await Hostwerk.pickFolder('Tresor wählen');                 // Ordner-Dialog, Pfad oder null (SDK 2.3)
await Hostwerk.terminal('claude', { cwd: ordner, title: 'Claude' });       // tippt ins Hostwerk-Terminal, der Nutzer drückt Enter (SDK 2.5, run:terminal)

await Hostwerk.storage.set('pinned', 'srv1');       // von Hostwerk gespeichert (braucht storage)
const s = await Hostwerk.settings.get();            // Werte aus manifest.settings
Hostwerk.settings.open();                           // öffnet den Einstellungsdialog

Hostwerk.tab;                         // aktueller Reiter aus page.tabs (SDK 2.2); Hostwerk.setTab('codes') wechselt
Hostwerk.context;                     // { kind, id }, wenn als Reiter auf einer Dienstseite gezeigt (contributes.tabs)
Hostwerk.on('tab', (id) => …);        // anderer Reiter gewählt
Hostwerk.on('action', (a) => …);      // { id, target } – deine contributes.action wurde gewählt
Hostwerk.on('service', (s) => …);     // ein Dienst hat seinen Zustand geändert
Hostwerk.on('minecraft', (s) => …);   // Spieler kamen/gingen
Hostwerk.on('settings' | 'lang' | 'theme', …);

Hostwerk.toast('Fertig', { kind: 'success' });
Hostwerk.navigate('/mc/mein-server'); // einen Hostwerk-Bereich öffnen
Hostwerk.openUrl('https://…');        // öffnet nach Rückfrage im Browser (seit SDK 2.3 auch obsidian://)
Hostwerk.copy(text);                  // in die Zwischenablage (SDK 2.1)
Hostwerk.get('/system/health');       // direkter Lesezugriff (gegen die Rechte geprüft)
```

`Hostwerk.lang` (`de`/`en`), `Hostwerk.theme` (`dark`/`light`) und `Hostwerk.embed` (`page`/`widget`) sagen dir, wo du
gerade bist.

## 5. Design-Baukasten – Hostwerks eigene Klassen

**Grundanforderung:** Eine Erweiterung sieht genauso aus wie Hostwerks eingebaute Bereiche. Deshalb liefert
`/ext-sdk.css` Hostwerks **eigene** Klassen, erzeugt aus dem aktuellen Stylesheet der App. Künftige Design-Änderungen
kommen von selbst in deiner Erweiterung an. Seitentitel, Beschreibung und Reiter (`page.tabs`) zeichnet Hostwerk selbst.
Deine Seite beginnt direkt mit dem Inhalt.

| Klassen | |
|---|---|
| Aufbau | `row`, `row-tight`, `stack`, `grid grid-2` / `grid-3` / `grid-4`, `grow`, `right`, `muted`, `small`, `tiny`, `ellipsis`, `mono` |
| Karten | `card`, `card-pad`, `card-head` (mit `h3`), `card-body`, `stat` mit `k` / `v` / `s` |
| Bedienung | `btn` (+ `primary`, `ghost`, `danger`, `sm`, `xs`), `input`, `select`, `label`, `seg` (Segment-Knöpfe), `switch` (`<label class="switch"><input type="checkbox"><span class="track"></span><span class="thumb"></span></label>`) |
| Zustand | `badge` (+ `ok`, `warn`, `err`, `accent`), `callout` (+ `ok`/`warn`/`err`) mit `callout-body`, `callout-title`, `progress` |
| Listen | `table`, `list-item`, `setting-row` (mit `txt`) |
| Leer / Laden | `empty` (+ `h3`, `p`, `empty-action`), `hw-skeleton`, `spinner` |

Farben: `--bg`, `--surface`, `--surface-2`, `--line`, `--line-2`, `--text`, `--text-2`, `--muted`, `--accent`,
`--accent-soft`, `--accent-text`, `--ok`, `--warn`, `--err`, `--mono`. Die älteren `hw-…`-Klassen und `--hw-…`-Variablen
funktionieren weiter – bestehende Erweiterungen gehen nicht kaputt.

**Design-Skala (ab Hostwerk 2.11):** Schriftgrößen, Rundungen, Abstände und Höhen gibt es nur als Stufen – genau wie in
Hostwerk selbst. Nimm immer eine Stufe statt einer eigenen Zahl, dann passt deine Erweiterung auch nach künftigen
Design-Änderungen:

| Was | Variablen |
|---|---|
| Schrift | `--fs-2xs` 11 · `--fs-xs` 12 · `--fs-sm` 13 · `--fs-md` 14 · `--fs-lg` 16 · `--fs-xl` 20 · `--fs-2xl` 24 · `--fs-3xl` 28 px |
| Rundung | `--r-xs` 4 · `--r-sm` 6 · `--r-md` 8 · `--r-lg` 10 · `--r-xl` 14 · `--r-2xl` 20 · `--r-pill` |
| Abstand | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 px |
| Höhe von Knöpfen/Feldern | `--control-h` 34 · `--control-h-sm` 28 · `--control-h-xs` 24 px |
| Lesbare Statusfarben für Text | `--ok-text`, `--warn-text`, `--err-text` (die Grundfarben `--ok` usw. sind für Flächen und Punkte) |
| Hauptknopf, Felder | `--accent-btn`, `--input-bg` |

Alle gibt es auch mit `--hw-`-Vorsatz (z. B. `--hw-fs-sm`). Die wichtigste Aktion einer Seite ist ein `btn primary`;
den Farbverlauf trägt nur Hostwerks eigener „+ Neu“-Knopf.

**Akzentfarbe (Hostwerk 2.12 und neuer):** Der Nutzer wählt EINE Akzentfarbe (Einstellungen → Allgemein) – oder ein
Profil bringt seine eigene mit. Hostwerk leitet daraus eine vollständige, gut lesbare Palette ab, getrennt für Hell und
Dunkel (OKLCH, Kontraste nach der WCAG-Formel geprüft), und schickt sie live an deine Erweiterung – auch schon, während
der Nutzer noch wählt:

| Variable | Wofür | Zusage |
|---|---|---|
| `--accent` | die gewählte Farbe selbst: Rahmen, Schalter, Markierungspunkte | genau die Wahl des Nutzers |
| `--accent-btn` | Hintergrund von `btn primary` | weiße Schrift darauf ≥ 4,5:1 |
| `--accent-text` | Links, Symbole und Text in Akzentfarbe | ≥ 4,5:1 auf jeder Fläche, auch auf `--accent-soft` |
| `--accent-soft` | zarter Hintergrund (gewählte Zeile, Chip) | durchscheinende Tönung |
| `--accent-contrast` | Schrift direkt auf `--accent` | Weiß oder fast Schwarz, ≥ 4,5:1 |
| `--accent-ring` | Fokusrahmen | ≥ 3:1 auf jeder Fläche |
| `--accent-2` | harmonische Zweitfarbe (Diagramme, Eingabezeichen) | ≥ 3:1 auf jeder Fläche |
| `--grad` | Verlauf für Hervorhebungen | folgt dem Akzent |

**Deine Markenfarbe nie fest für Bedienelemente einsetzen** (Knöpfe, Links, Fokus, Auswahl, Reiter) – nimm `--accent*`.
Dann folgt deine Erweiterung der Farbe des Nutzers und bleibt in beiden Themes lesbar, auch bei Gelb, Cyan oder Grau.
Deine Markenfarbe gehört nur ins Logo oder Symbol.

Regeln der Prüfung (Hinweise – im Katalog Fehler): keine festen Farben, keine eigenen Schriften (`var(--mono)` ist in
Ordnung), nichts über Hostwerk legen (`position: fixed`, riesiger `z-index`). Eine bewusste Ausnahme je Datei, mit
Begründung: `/* hostwerk-allow: colors, fonts – Vorschau wie im Spiel */`.

## 6. Übersetzungen (Deutsch + Englisch)

Jeder sichtbare Text steht in `locales/de.json` und `locales/en.json` mit **denselben Schlüsseln**:

```html
<h1 data-i18n="title"></h1>                <!-- füllt das SDK, wechselt mit der Sprache -->
<input data-i18n-placeholder="search">
```
```js
Hostwerk.t('playersOnline', { n: 5 })      // "{n} online"
Hostwerk.on('lang', render);               // eigene Texte neu zeichnen
```

Die Prüfung meldet fehlende Schlüssel und englische Texte, die noch deutsch aussehen. Texte im Manifest (`name`,
`description`, `title`, Bezeichnungen der Einstellungen) brauchen ebenfalls `{ "de": …, "en": … }`.

## 7. Rechte

| Recht | Erlaubt |
|---|---|
| `read:services` | Dienste und ihren Zustand sehen (`Hostwerk.services()`) |
| `read:web`, `read:databases`, `read:apps`, `read:tasks`, `read:mail` | Diese Bereiche lesen |
| `read:minecraft` | Minecraft-Server, Spieler, Statistiken, Welten |
| `read:system` | Gesundheit, Auslastung, Ports, Speicher je Dienst |
| `read:network` | Router, Rechner, Sicherheitslage |
| `read:live` | Zertifikate mit Restlaufzeit, Erreichbarkeit mit Verlauf (SDK 2.4) |
| `share:status` | Öffentliche Statusseite (`/live/statuspage`): an/aus, Titel, welche Prüfungen, geheimen Link erneuern, in einen Website-Ordner legen – fragt jedes Mal. Besucher sehen nur Namen, Zustand, Verfügbarkeit und Verlauf (SDK 2.6) |
| `control:services` | Starten, stoppen, neu starten – **Hostwerk fragt jedes Mal** |
| `command:minecraft` | Konsolenbefehle senden – fragt jedes Mal |
| `run:tasks` | Aufgaben ausführen – fragt jedes Mal |
| `change:minecraft` | server.properties, Spielregeln, Symbol, Plugins an/aus, Sicherungen – fragt jedes Mal (SDK 2.2) |
| `change:databases` | Datenbank-Sicherungen anlegen – fragt jedes Mal (SDK 2.2) |
| `change:mail` | Test-Mails in den Mail-Fänger, Mails als gelesen markieren – fragt jedes Mal (SDK 2.2) |
| `read:knowledge` | Wissensgraph: Projekte, Graph, Bericht, Fragen, Gedächtnis, Claude-Status (SDK 2.3) |
| `change:knowledge` | Wissensgraph bauen und abfragen, Ordner, Gedächtnis, Obsidian-Export, eigene Notizen als Knoten (`PUT /knowledge/notes`, SDK 3.1) – **ohne Rückfrage je Aufruf**, weil nur die eigenen Daten des Graphen betroffen sind (SDK 2.3) |
| `connect:claude` | Markierten Claude-Abschnitt und Skill in Projekte schreiben/entfernen – fragt jedes Mal (SDK 2.3) |
| `read:claude` | Claude-Status, Projekte, Gedächtnis-Kontext, Spar-Werkzeuge und Verbrauch (SDK 2.5) |
| `change:claude` | Kontext-Dateien in Projekte schreiben, Spar-Werkzeuge installieren/aktualisieren/entfernen – fragt jedes Mal (SDK 2.5) |
| `run:terminal` | `Hostwerk.terminal(befehl, { cwd, title, enter })`: tippt einen Befehl ins Hostwerk-Terminal. Ohne `enter` startet ihn der Nutzer mit Enter, mit `enter: true` fragt Hostwerk vorher (SDK 2.5) |
| `storage` | `Hostwerk.storage` (256 KB) |
| `override:ui` | Benannte Stellen von Hostwerks Oberfläche ersetzen oder ergänzen – **hohes Risiko**: besondere Prüfung im Katalog, aktiv erst nach Zustimmung des Nutzers (offizielle Pakete: sofort), mit einem Klick abschaltbar (SDK 2.9, siehe Abschnitt 17) |
| `extend:extensions` | Anderen Erweiterungen Reiter, Aktionen, Einstellungen, Texte oder eine Seite geben – nur so weit, wie deren Autor es in `allowExtensions` erlaubt (SDK 2.9) |
| `network` | `fetch` zu den Adressen in `network` |

Nie möglich: Hostwerk-Einstellungen, Passwörter, beliebige Dateien, Herunterfahren und alles, was nicht in der Liste
steht. Nur anfordern, was du brauchst – Nutzer sehen die Liste vor der Installation. Jeder Aufruf landet im
Zugriffsprotokoll der Erweiterung (auch Ablehnungen).

## 8. Einstellungen, Speicher, Ereignisse

- **Einstellungen**: in `manifest.settings` beschreiben; Hostwerk zeichnet das Formular (passt so immer ins Design)
  und schickt Änderungen sofort (`Hostwerk.on('settings')`).
- **Speicher**: `Hostwerk.storage.get/set/remove/all` – JSON-Werte, 256 KB je Erweiterung, wird mit ihr entfernt.
  Browser-Speicher (`localStorage`, Cookies) geht im abgeschotteten Rahmen nicht.
- **Ereignisse** statt ständig abfragen: `service` (Zustand), `minecraft` (Spieler). Für alles andere langsam abfragen
  (≥ 10 s). Server-Module (`backend`) hören auf Hostwerks Ereignisbus: `host.core('events').bus.on('broadcast', fn)` – z. B.
  `{ type: 'mc-player-join', id, server, player }` und `{ type: 'mc-player-leave', id, server, player, ms }` (`ms` = Dauer der Sitzung).

## 9. Kacheln für die Übersicht

`widget.file` ist eine kleine Seite ohne eigenen Rand/Hintergrund – den Rahmen zeichnet Hostwerk. Die Höhe folgt dem
Inhalt automatisch. Größen: `third`, `half`, `full`. Installierte Kacheln erscheinen in der Übersicht unter
*Anpassen* (ein-/ausblenden, anordnen).

## 10. Erweiterung prüfen

Dieselben Regeln laufen in Hostwerk (beim Installieren), in deinem Repository (GitHub-Action) und im Katalog:

```bash
curl -fsSLO https://raw.githubusercontent.com/Passimoritz/hostwerk-public/main/sdk/check.js
node check.js pfad/zu/meiner-erweiterung            # Bericht
node check.js pfad/zu/meiner-erweiterung --strict   # Katalog-Regeln (Hinweise = Fehler)
```

In Hostwerk: *Apps → Erweiterungen → installiertes Paket → Prüfen* zeigt denselben Bericht.

## 11. Veröffentlichen: Repository, Release, Einreichen

1. Die Erweiterung in ein **eigenes GitHub-Repository** legen (Vorlage: *Use this template*).
2. `version` in `manifest.json` erhöhen, eine Zeile in `CHANGELOG.md`, Tag `v1.2.3` pushen.
   Die Action prüft das Paket und erstellt ein Release mit `<id>-<version>.zip` und einer `.sha256`-Datei.
3. In Hostwerk bei der installierten Erweiterung auf *Einreichen* tippen – oder
   [Erweiterung einreichen](https://github.com/Passimoritz/hostwerk-public/issues/new?template=extension.yml) öffnen
   und den Release-Link eintragen.
4. Die Action prüft erneut (`--strict`), legt eine Kopie mit Prüfsumme in `packages/` ab und nimmt sie in
   `catalog/community.json` auf. Seiten und Kacheln sofort; Dienste warten auf einen Menschen (Label *approved*).
5. Updates: erneut einreichen mit höherer Version (gleiche Kennung – sie gehört dem, der sie zuerst eingereicht hat).

Testen ohne Einreichen: *Actions → Add extension → Run workflow* mit einem Paket-Link (Probelauf).

## 12. Vertrauensstufen und Verifizierung

![Vertrauensstufen](img/trust.svg)

| Abzeichen | Bedeutung |
|---|---|
| **Offiziell** | Von Hostwerk – eigenes Repository, in `catalog/extensions.json` (täglich aus den Releases gebaut). |
| **Verifizierter Entwickler** | Das Projekt hat die Person verifiziert (`catalog/verified.json`). |
| **Von Hand geprüft** | Zusätzlich von einem Menschen angesehen – Pflicht für Dienste. |
| **Automatisch geprüft** | Hat die automatische Prüfung bestanden, läuft abgeschottet. |
| **Fremde Quelle** | Aus einer selbst eingetragenen Quelle – nur beim Installieren geprüft. |

**Verifiziert werden:** Mindestens eine Erweiterung im Community-Katalog haben, dann
[Verifizierung beantragen](https://github.com/Passimoritz/hostwerk-public/issues/new?template=verification.yml).
Die Action bestätigt, dass die Erweiterungen von dir sind; das Projekt entscheidet von Hand (Label *verified*). Das
Abzeichen kann entzogen werden, wenn eine Erweiterung Code versteckt oder ohne Hinweis Daten sammelt.

## 13. Sicherheit

- Die Seite läuft in einem **abgeschotteten Rahmen mit eigenem, undurchsichtigem Ursprung** – kein Zugriff auf
  Hostwerks Anmeldung, Cookies oder API.
- Content-Security-Policy: Skripte nur aus dem Paket, Netz nur zu den Adressen in `network`, keine Rahmen, keine
  Formulare an fremde Adressen.
- Jede Anfrage läuft über die Brücke und wird auf dem **Server** gegen die Rechte geprüft; Änderungen bestätigt der
  Nutzer jedes Mal.
- Katalog-Pakete sind per **SHA-256** festgelegt – Hostwerk installiert genau die geprüfte Datei.
- Eigener Server-Code (`backend`) von außerhalb des Hostwerk-Katalogs läuft in einem **eigenen, abgeschotteten Prozess**; manche Bereiche (Einstellungen, Passwörter, Schlüssel, andere Erweiterungen …) gibt es nie, Geheimnisse in Antworten werden geschwärzt. Details: [Erweiterungen erklärt](../docs/erweiterungen.md).

## 14. Beispiele

| Repository | Zeigt |
|---|---|
| [hostwerk-ext-player-ticker](https://github.com/Passimoritz/hostwerk-ext-player-ticker) | Minecraft-Daten, Köpfe, Rangliste, Speicher (Anheften), Einstellungen, Kachel, Live-Ereignisse |
| [hostwerk-ext-status-wall](https://github.com/Passimoritz/hostwerk-ext-status-wall) | Alle Dienste, Starten/Neustart mit Rückfrage, Gruppen, Kachel mit Ring |
| [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) | Minimaler Start: Seite, Kachel, Einstellungen, Speicher, Übersetzungen, CI + Releases |
| [hostwerk-ext-motd-studio](https://github.com/Passimoritz/hostwerk-ext-motd-studio) | Ändert Hostwerk selbst: eigener Reiter auf jeder Minecraft-Seite, Rechtsklick-Aktion, `change:minecraft` |
| [hostwerk-ext-service-notes](https://github.com/Passimoritz/hostwerk-ext-service-notes) | Reiter auf allen Dienstseiten, Aktionen in der Schnellsuche, Speicher |
| [hostwerk-ext-knowledge-graph](https://github.com/Passimoritz/hostwerk-ext-knowledge-graph) | Große Seite mit 6 Reitern, Zeichenfläche mit Listen-Alternative, Rechte mit und ohne Rückfrage (SDK 2.3) |

![Status-Wand in Hostwerk](img/status-wall-in-hostwerk.png)

## 15. SDK 2.7: Aussehen, Abhängigkeiten und native Erweiterungen

**Aussehen auf der Erweiterungsseite.** Hostwerk zeigt jede Erweiterung mit Symbol, Banner und Kategorie.

| Feld | Bedeutung |
|---|---|
| `category` | Eins von `games`, `network`, `security`, `monitoring`, `developer`, `ai`, `communication`, `other` – die Filter auf der Erweiterungsseite. |
| `color` | Akzentfarbe `#rrggbb` für Karte und Banner. |
| `banner` | Breites Bild (SVG/PNG, etwa 1280×400) für die Detailansicht und hervorgehobene Karten. |
| `screenshots` | Bis zu 6 Bilder (`docs/screenshot.png` …) für die Detailansicht. |

Bewegte Symbole und Banner sind willkommen – jede Animation muss aber unter `@media (prefers-reduced-motion: reduce)`
stehen bleiben (sonst schlägt die Prüfung fehl).

**Abhängigkeiten.** `"requires": { "game-servers": ">=1.0.0" }` – Hostwerk installiert Fehlendes zuerst (aus dem
Katalog), lehnt Kreise ab und entfernt keine Erweiterung, die andere noch brauchen (außer der Nutzer erzwingt es).
Bereiche: `*`, `1.2.3`, `>=1.2.0`, `^1.2.0`, `~1.2.0`.

**Native Erweiterungen** laufen als Teil von Hostwerk – so wurden früher eingebaute Funktionen (Passwort-Manager,
Spiele-Server, Mailserver, Router …) zu Erweiterungen. Sie brauchen die Berechtigung `native` und bringen mit:

- `backend`: `server/index.js` mit `activate(host)` – eigene API-Routen (`host.router`, gleiche Anmeldung wie Hostwerk;
  `host.publicRouter` ohne), `host.provide(name, dienst)` für Hostwerk und andere Erweiterungen, Haken
  `host.on('autostart' | 'shutdown' | 'upgrade')`, Hostwerks Bausteine `host.core(name)`, `host.service(name)`,
  `host.lib(name)`, Texte `host.t(text, werte)`, `host.error(status, text)`, `host.broadcast(msg)`.
- `ui`: `ui/index.js`, gebaut mit `node sdk/build-native.js .` aus `ui/src/index.jsx` (React, `@hostwerk/api`,
  `@hostwerk/ui`, `@hostwerk/kit`, `@hostwerk/i18n` …). Export `{ pages: { main }, slots: { … } }` – Steckplätze setzen
  Reiter und Knöpfe in Hostwerk (`project.tabs`, `live.tabs`, `mc.connect`, `files.preview`, `mail.tabs`,
  `titlebar`, `machines.board`).
- Texte im Code sind Englisch; `locales/de.json` ordnet dem englischen Text das Deutsche zu (`$patterns` für Texte mit Teilen).
- Daten bleiben, wo Hostwerk sie schon immer abgelegt hat – Entfernen der Erweiterung löscht nichts.

**Sicherheits-Updates für eigene Programme** (ab Hostwerk 2.11, genutzt seit 2.13 von Mailserver und Spiele-Servern).
Bringt eine native Erweiterung ein Programm mit Kontakt zum Internet mit, meldet sie es bei Hostwerks Sicherheits-Updates
an – dann kommen Patches wie bei PHP und den Datenbanken von selbst, mit Probe und Rücksprung (`keeper.attempt`), und
stehen unter *Einstellungen → Updates* mit eigenem Schalter:

```js
// server/index.js
exports.activate = (host) => {
  const pu = host.ctx.patchUpdates;               // fehlt in Hostwerk vor 2.11 – deshalb prüfen
  if (pu && typeof pu.register === 'function') {
    const off = pu.register('mein-dienst', {      // id: a–z, 0–9, - (2–40 Zeichen)
      labels: { de: 'Mein Dienst', en: 'My service' },
      items: () => [{ key: 'mein-dienst', label: 'Mein Dienst', version: '1.4.2' }],          // was installiert ist
      updates: async () => [{ key: 'mein-dienst', label: 'Mein Dienst', current: '1.4.2', latest: '1.4.3', target: rel }],
      plan: (u) => ({
        install: async () => { /* neue Fassung NEBEN die alte legen */ },
        probe: async () => { /* prüfen, wirft bei Fehler – z. B. Testlauf, laufende Dienste neu starten */ },
        activate: async () => { /* erst jetzt die alte Fassung wegräumen */ },
        discard: async () => { /* neue Fassung weg, Dienste wieder auf der alten starten */ },
      }),
    });
    host.on('shutdown', () => off());             // beim Entfernen/Aktualisieren wieder abmelden
  }
};
```

Hostwerk prüft alle 6 Stunden, spielt nur ein, was der Nutzer nicht ausgenommen hat, merkt sich gescheiterte Versionen
(Selbstwartung `patch-<key>`) und überspringt sie, bis eine neuere erscheint. Nur Patch-Versionen derselben Reihe
vorschlagen – größere Sprünge entscheidet der Mensch.

**Webserver-Protokolle lesen** (ab Hostwerk 2.12). `host.ctx.web.logFiles(inst)` nennt die Protokolle eines Webservers,
ohne etwas anzulegen: `{ access, error, php, rotated: { access: [...], error: [...], php: [...] } }` – `rotated` sind die
gepackten Fassungen (`.log.gz`, neueste zuerst). Das Zugriffsprotokoll steht im Format **vcombined** (Apache `%v:%p` vorne,
nginx `$server_name:$server_port`) mit der Dauer am Ende (Apache µs, nginx Sekunden); Caddy schreibt JSON mit
`request.host`. So lässt sich je Domain auswerten:

```js
const web = host.ctx.web;
for (const inst of web.list()) {
  const f = typeof web.logFiles === 'function' ? web.logFiles(inst) : null; // fehlt vor 2.12
  if (f) zaehle(f.access, f.rotated.access);
}
```

Seit SDK 2.8 läuft Server-Code von außerhalb des offiziellen Katalogs **abgeschottet** (siehe Abschnitt 16); nur offizielle
Pakete (per SHA-256 festgelegt) laufen als Teil von Hostwerk und dürfen ein eigenes Oberflächen-Modul mitbringen.

## 16. SDK 2.8: eingebaut wie Hostwerk selbst – und abgeschottet

Alles im Detail, mit Bildern: **[Erweiterungen erklärt](../docs/erweiterungen.md)**.

| Feld | Wirkung |
|---|---|
| `page.nav` | `{ "group": "server" \| "develop" \| "system" \| "<eigener-bereich>", "groupTitle": { "de", "en" }, "after": "mc", "order": 0–100 }` – die Seite steht in diesem Bereich der Seitenleiste wie ein eingebauter. Ab Hostwerk 2.11: `system` = unten bei KI und System; eigener Bereich mit `groupTitle` (erscheint nur, solange eine Seite darin steht – mehrere Erweiterungen mit derselben id teilen ihn); `after` = direkt hinter diesem Eintrag. Nutzer können alles per Ziehen umsortieren oder ausblenden. Das alte `extensions` ordnet Hostwerk nach Kategorie ein. |
| `settingsTab` | `general`, `start`, `notifications`, `advanced` oder `extensions` – wo das Formular aus `settings` in Hostwerks Einstellungen erscheint. |
| `contributes.tabs[].on` | auch Hauptbereiche: `area:system`, `area:backups`, `area:ai`, `area:dbs`, `area:minecraft`, `area:web`, `area:projects`, `area:mail`, `area:live`. |
| `contributes.new` | Kacheln im „Neu“-Menü – sie öffnen die Seite mit dieser Aktion (`Hostwerk.on('action')`). |
| `synergies` | andere Erweiterungen, mit denen diese gut zusammenspielt (unter *Ideen & Synergien*). |
| `provides` / `uses` | angebotene (`host.provide`) und genutzte (`host.use`) Dienste – passende Paare schlägt Hostwerk von selbst vor. |

**Eigener Server-Code aus jeder Quelle.** Ein `backend` braucht nicht mehr den Hostwerk-Katalog: Alles andere läuft
in einem **eigenen, abgeschotteten Prozess** (Nodes Rechte-Modus) – eigener Paket-Ordner lesbar, eigener Datenordner
beschreibbar, keine Programme, kein eigenes Netz, kein Zugriff auf Hostwerks Einstellungen oder Schlüssel. Routen liegen
unter `/api/x/<id>/…` (öffentlich: `/api/x/<id>/pub/…`); die Seite erreicht sie mit `Hostwerk.backend(method, path, body)`.
`host.api()` fragt Hostwerk mit den Rechten der Erweiterung; Antworten kommen mit geschwärzten Geheimnissen an. Eigene
Oberflächen-Module (`ui`) bleiben offiziellen Paketen vorbehalten – andere zeigen ihre Seite im Rahmen.

### Tastenkürzel

Erweiterungen können eigene Tastenkürzel mitbringen. Sie stehen in der Kürzel-Übersicht (F1) und lassen sich unter
**Einstellungen → Allgemein → Tastenkürzel** ändern, ausschalten oder zurücksetzen – genau wie Hostwerks eigene.

```json
"contributes": {
  "shortcuts": [
    { "id": "open-logs", "title": { "en": "Open logs", "de": "Protokolle öffnen" }, "keys": "ctrl+alt+l", "action": "logs" }
  ]
}
```

| Feld | Bedeutung |
|---|---|
| `id` | a–z, 0–9, `-`. Hostwerk führt es als `ext:<Erweiterungs-id>:<id>` – so heißt es auch in den Einstellungen des Nutzers. |
| `title` | Text in der Übersicht und den Einstellungen (`{ "en", "de" }` oder ein Text). |
| `keys` | Eine Kombination: Umschalter `ctrl`, `alt`, `shift`, `meta` + eine Taste (`a`–`z`, `0`–`9`, `f1`–`f24`, `enter`, `arrowup`, `,` …), z. B. `ctrl+alt+p`. Strg und ⌘ gelten als dasselbe. Braucht `ctrl` oder `alt` – nur F-Tasten dürfen allein stehen. |
| `action` | Was passiert: Kennung eines Seiten-Reiters (öffnet ihn), aus `contributes.actions` (löst sie aus wie in der Suche) oder aus `contributes.new`. Ohne `action` öffnet das Kürzel die Seite der Erweiterung. |

Regeln: höchstens 20 Kürzel. Kopieren, Einfügen, Ausschneiden, Alles markieren, Rückgängig/Wiederholen, Alt+F4,
Strg+W/Q/Tab und Ähnliches sind reserviert – die Prüfung schlägt fehl. Eine Erweiterung **nimmt Hostwerk nie ein Kürzel
weg**: Ist `keys` eins von Hostwerks eigenen (Strg+K, Strg+N, Strg+1…9, F1 …), warnt die Prüfung, und das Kürzel bleibt
aus, bis der Nutzer es selbst zuweist (die Einstellungen zeigen den Konflikt mit „Trotzdem verwenden“). Zwei
Erweiterungen mit denselben Tasten: Die zuerst installierte gewinnt, die andere erscheint als Konflikt.

Native Erweiterungen (offizielle Pakete mit Oberflächen-Modul) können Kürzel stattdessen im Code exportieren:
`export default { pages, slots, shortcuts: [{ id: 'quick-open', title: 'Open quickly', keys: 'ctrl+alt+o', run: () => … }] }`
– der Titel ist Englisch, Deutsch kommt aus `locales/de.json`.

### Sprachpakete

Hostwerk selbst pflegt Deutsch und Englisch. Weitere Sprachen kommen aus Erweiterungen: in `manifest.json` → `"languages": [{ "id": "fr", "name": "Français", "file": "lang/fr.json" }]`. Die Datei hat dieselbe Form wie Hostwerks `ui/src/i18n/en.json` – `{ "texts": { "<deutscher Text>": "<Übersetzung>" }, "patterns": [["Text mit {}", "Übersetzung mit {}"]] }`. Nutzer wählen die Sprache unter Einstellungen → Allgemein; was fehlt, erscheint auf Englisch. Der Prüfer kontrolliert Datei und Platzhalter.

## 17. SDK 2.9: Farbschemata, Anpassungen und andere Erweiterungen erweitern

Hostwerk 2.11 und neuer. Drei neue Wege, Hostwerk zu verändern – jeder mit eigenem Sicherheitsnetz – und Vorlagen für
alle. Anfangen im **Erweiterungs-Studio** (*Neue Erweiterung → Farbschema / Hostwerk anpassen / Andere Erweiterung
ergänzen / Reiter in Hostwerk / Mit Server-Teil*) oder mit den Vorlagen-Repositorys:

| Vorlage | Zeigt |
|---|---|
| `hostwerk-ext-template-theme` | Farben für Hell und Dunkel, Akzent-Vorschläge, Rundung, Dichte |
| `hostwerk-ext-template-override` | Ersetzt die Begrüßung der Übersicht, ergänzt einen Tipp bei leerer Webserver-Liste |
| `hostwerk-ext-template-extend` | Reiter, Aktion im Seitenkopf und Einstellungen bei einer anderen Erweiterung – mit Zustimmung ihres Autors |
| `hostwerk-ext-template-service-tab` | Reiter auf Dienst-Seiten, Einträge in Rechtsklick und Schnellsuche, ein Tastenkürzel |
| `hostwerk-ext-template-backend` | Eigener Server-Code, abgeschottet im eigenen Prozess, mit getesteter Logik |

### Farbschemata (`contributes.themes`)

Ein Farbschema ist **kein CSS**. Es setzt Werte für eine feste Liste von Design-Variablen; das Stylesheet baut Hostwerk
selbst – nichts lässt sich einschleusen, nichts lädt aus dem Internet.

```json
"contributes": {
  "themes": [{
    "id": "northern-light",
    "title": { "de": "Nordlicht", "en": "Northern light" },
    "tokens": {
      "dark":  { "--bg": "#0b1416", "--surface": "#132126", "--text": "#e6f1f2", "--muted": "#91aab0" },
      "light": { "--bg": "#f2f7f7", "--surface": "#ffffff", "--text": "#102226", "--muted": "#4f656b" }
    },
    "accent": "#0d9488", "accents": ["#0d9488", "#3b82f6"],
    "radius": 1.3, "density": "normal",
    "fonts": [{ "family": "Inter", "file": "fonts/inter.woff2", "weight": "100 900" }], "font": "Inter"
  }]
}
```

| Feld | Regel |
|---|---|
| `tokens.dark` / `tokens.light` | Nur `--bg`, `--bg-2`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-2`, `--text`, `--text-2`, `--muted`, `--ok`, `--ok-text`, `--warn`, `--warn-text`, `--err`, `--err-text`, `--info`, `--console-bg`, `--input-bg` (als `#rrggbb`), `--ok-soft` … `--info-soft` (auch `rgba()`), `--shadow`, `--shadow-lg`. Fehlende behalten Hostwerks Werte. |
| `accent`, `accents` | Vorgeschlagener Akzent (gilt, solange der Nutzer keinen eigenen gewählt hat) und bis zu 8 weitere Vorschläge. Hostwerk leitet `--accent-text`, `--accent-btn`, `--accent-ring` … **für die Flächen des Schemas** ab – sie bleiben lesbar. |
| `radius` | 0 (eckig) … 1 (Hostwerk) … 2 (sehr rund) – skaliert `--r-*`. |
| `density` | `compact`, `normal`, `comfortable` – skaliert `--sp-*` und die Höhe der Bedienelemente. |
| `fonts`, `font` | Schriftdateien im Paket (am besten `.woff2`, zusammen höchstens 1,5 MB). |

**Kontrastprüfung (WCAG 2.2 AA)** – in `check.js` *und* noch einmal, bevor Hostwerk ein Schema anwendet: Jedes Paar, an dem
das Schema etwas ändert, wird nachgerechnet – `--text`, `--text-2`, `--muted`, `--ok-text`, `--warn-text`, `--err-text`
≥ 4,5:1 auf allen fünf Flächen (und `--text` auf `--input-bg`), `--ok`, `--warn`, `--err`, `--info` ≥ 3:1, der Akzent
≥ 3:1. Dunkel bleibt dunkel, Hell bleibt hell. Ein Schema, das durchfällt, steht mit Grund in der Liste, wird aber nie angewendet.

Auswahl unter *Einstellungen → Allgemein → Darstellung → Farbschema*. Der Wechsel ist sofort sichtbar (ein Stil-Element,
nichts rendert neu, für den nächsten Start gemerkt), der Farbwähler zeigt die Vorschläge des Schemas, und wird die
Erweiterung entfernt, gilt sofort wieder Hostwerks eigenes Aussehen.

### Anpassungen an Hostwerks Oberfläche (`contributes.overrides`)

Anpassungen ersetzen oder ergänzen **benannte Stellen** (Slots) von Hostwerks Oberfläche. Eine Stelle ist immer ein ganzer
Bereich – nie ein Knopf in jeder Karte –, eine Anpassung läuft also einmal je Seite.

| Stelle | Wo | Arten |
|---|---|---|
| `dashboard.hero` | Begrüßung oben auf der Übersicht | `replace`, `before`, `after` |
| `web.empty` | Leere Webserver-Liste | `replace`, `after` |
| `dbs.empty` | Leere Datenbankserver-Liste | `replace`, `after` |
| `minecraft.empty` | Leere Minecraft-Server-Liste | `replace`, `after` |

```json
"permissions": ["override:ui"],
"contributes": {
  "overrides": [
    { "id": "hero", "slot": "dashboard.hero", "mode": "replace", "title": { "de": "…", "en": "…" },
      "file": "overrides/hero.html", "preview": "docs/hero-preview.svg", "height": 160 }
  ]
}
```

Die Seite läuft abgeschottet wie jede Erweiterungsseite (`Hostwerk.context = { kind: "override", slot, id }`,
`Hostwerk.embed` ist `override`, durchsichtiger Hintergrund, der Rahmen wächst bis `height`, höchstens 480 px).
Offizielle Pakete mit Oberflächen-Modul dürfen stattdessen eine Komponente liefern:
`export default { overrides: { hero: ({ slot, props, Original }) => … } }`.

**Sicherheitsnetz**

- Recht **`override:ui`** (hohes Risiko) – steht vor dem Installieren in der Liste; ohne das Recht liefert Hostwerk keine Anpassung aus.
- **Zustimmung mit Vorschau:** Außer bei offiziellen Paketen ist nichts aktiv, bevor der Nutzer in der Detailansicht
  zustimmt (*Ansehen und zulassen …*). Der Dialog zeigt jede Stelle, wie sie sich ändert, und das Bild aus `preview`.
  *Erst ansehen* schaltet die Anpassung nur für diese Sitzung ein – mit *Zulassen* / *Verwerfen* direkt darüber. Die
  Zustimmung gilt für die Stellen: Eine neue Stelle oder Art in einem Update fragt erneut.
- **Ein Klick zum Abschalten:** Über jeder Anpassung steht „Angepasst von …“ mit *Anpassung abschalten*; in der Detailansicht lässt sie sich wieder einschalten.
- **Rückfall aufs Original:** Stürzt eine Komponente ab oder meldet sich eine Seite nicht binnen 4 Sekunden, zeigt Hostwerk
  das Original – mit Hinweis. Von mehreren `replace`-Anpassungen gilt nur die erste (offizielle zuerst, dann `order`).

**Besondere Prüfung (Katalog).** `check.js` liefert `review: ["override:ui"]` und prüft jede Anpassungs-Seite zusätzlich
(Fehler): **Leistung** – Seite plus eigene Skripte/Stile ≤ 100 KB, kein `setInterval` schneller als einmal pro Sekunde;
**Barrierefreiheit** – `<html lang>`, ein Name für jeden Knopf, `alt` für jedes Bild, kein `tabindex` über 0, kein
entfernter Fokusrahmen; **Übersetzungen** – jeder `data-i18n`-Schlüssel und jedes `Hostwerk.t('key')` in beiden `locales`;
**Netz** – kein `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` oder `sendBeacon` ohne das Recht `network`. Danach
prüft ein Mensch:

1. Nützt es dem Nutzer (Zweck klar, keine Werbung, keine Tricks, kein heimliches Datensammeln)?
2. Bleibt das Original erreichbar (nichts Wichtiges verdeckt, *Anpassung abschalten* frei)?
3. Sieht es aus wie Hostwerk: Baukasten-Klassen, `var(--…)`-Farben, Hell und Dunkel, Handybreite?
4. Tastatur und Bildschirmleser: Reihenfolge, sichtbarer Fokus, Namen, `prefers-reduced-motion`?
5. Deutsch und Englisch vollständig und natürlich formuliert?
6. Nur die nötigen Rechte; passt das `preview`-Bild zu dem, was die Anpassung tut?
7. Funktioniert es, wenn die Stelle leer ist, der Rechner offline ist oder die Sprache wechselt?

### Andere Erweiterungen erweitern (`contributes.extends`)

Eine Erweiterung darf **eine andere** ergänzen – aber nur so weit, wie deren Autor es erlaubt.

| Punkt | Der Zusatz (`contributes.extends[]`) | Der Autor des Ziels (`allowExtensions`) |
|---|---|---|
| `tabs` | `"tabs": [{ "id", "title", "file", "icon" }]` – Reiter auf ihrer Seite | `"tabs"` |
| `actions` | `"actions": [{ "id", "title", "icon" }]` – Knöpfe im Seitenkopf, die die Seite des Zusatzes öffnen | `"actions"` |
| `settings` | `"settings": true` – Einstellungen des Zusatzes in ihrem Einstellungen-Dialog | `"settings"` |
| `locales` | `"locales": { "de": "…json", "en": "…json" }` – formuliert **vorhandene** Texte um | `"locales"` (nur namentlich) |
| `page` | `"page": { "file": "…html" }` – ersetzt ihre Seite (mit *Original zeigen*) | `"page"` (nur namentlich) |

```json
// Zusatz
"permissions": ["extend:extensions"],
"contributes": { "extends": [{ "id": "my-extension", "version": ">=1.0.0", "tabs": [ … ], "actions": [ … ], "settings": true }] }
// Ziel – geschrieben von SEINEM Autor
"allowExtensions": { "my-addon": ["tabs", "actions", "settings"], "*": ["tabs"] }
```

- **Der ursprüngliche Autor hat die Rechte.** Ohne Eintrag erscheint nichts; `"*"` kann nie `page` oder `locales` erlauben.
  Fehlt der Eintrag in einer neuen Version, ist die Erlaubnis zurückgenommen – die Ergänzung verschwindet von selbst.
- **Keine Rechte-Ausweitung:** Reiter, Seiten und Aktionen des Zusatzes laufen mit den Rechten des **Zusatzes**, nicht des Ziels.
- **Reihenfolge:** erst die eigenen Reiter und Aktionen, dann die der Zusätze (Installations-Reihenfolge). Dürfen zwei Zusätze
  die Seite ersetzen, gewinnt der, den der Autor in `allowExtensions` zuerst nennt; der andere erscheint als Konflikt.
  Umformulierte Texte ändern nur Schlüssel, die das Ziel schon hat. `version` lässt eine Ergänzung bei Versionen aus,
  für die der Zusatz nicht gemacht ist.
- **Durchschaubar:** Die Detailansicht des Zusatzes zeigt „Erweitert *X* – mit Zustimmung von *Autor*“ (oder „Wartet auf
  die Erlaubnis von …“), die des Ziels „Wird ergänzt von …“; Nutzer können Ergänzungen abschalten.
- Native Ziele (offizielle Pakete mit Oberflächen-Modul) bekommen `page`, `settings`, `locales` und seit SDK 2.10 `tabs` (als Leiste über ihrer Seite); Aktionen brauchen eine Seite im Rahmen.

## 18. SDK 2.10: Ereignisse, Benachrichtigungen, Dienste steuern und öffentliche Ansichten

Hostwerk 2.12 und neuer. Was die Arbeit an den offiziellen Erweiterungen im Kern vermisst hat – jetzt für alle.

**Für Seiten im Rahmen (`Hostwerk.*`)**

- `Hostwerk.services()` kennt jetzt alle Arten: `web`, `db`, `minecraft`, `app`, **`docker`** (Docker-Apps) und
  **`game`** (Spiele-Server, `extra.game`, `extra.docker`) sowie `mail`. `Hostwerk.service('game' | 'docker', id).restart()`.
- Neue Rechte: `read:games` (Spiele-Server und Spieler, ohne Konsole/Passwörter), `change:ports` (gestoppten Dienst
  auf einen freien Port umstellen, mit Rückfrage), `read:system` liest zusätzlich `GET /system/ports/free?port=8080`
  (`{ free, by, hostwerk }`), `control:services` steuert auch Spiele-Server.
- Mail-Fänger filtern: `GET /mail/messages?from=shop&to=…&subject=…&since=<ms>&until=<ms>&unread=1&limit=50`.
- Reiter je Projekt: `contributes.tabs[].on: "project"` – `Hostwerk.context` ist dann `{ kind: 'project', id }`.

**Öffentliche Ansicht** (`publicView`, Recht `share:view`) – z. B. ein Overlay für OBS:

```json
"permissions": ["share:view"], "backend": "server/index.js",
"publicView": { "file": "obs/index.html", "title": { "de": "Spieler-Overlay", "en": "Player overlay" } }
```

Erreichbar ohne Anmeldung unter `/v/<id>/`. Läuft abgeschottet (eigener Ursprung), darf Skripte ausführen und holt Daten
nur vom öffentlichen Teil des eigenen Server-Moduls (`fetch('/api/x/<id>/pub/…')` – die Antworten kommen mit CORS).
Die Detailansicht zeigt die Adresse zum Kopieren.

**Für Server-Module (`host.*`)** – nativ und abgeschottet, wo nicht anders vermerkt:

| Neu | Wofür |
|---|---|
| `host.on('job' \| 'audit' \| 'service' \| 'git-pull' \| 'deploy-done' \| 'static-publish' \| 'mc-player-join' \| 'mc-player-leave' \| 'task-failed' \| 'backup-failed' \| 'incident', fn)` | Kern-Ereignisse. Abgeschottet nur mit `read:services` (Spieler: `read:minecraft`), Inhalte geschwärzt. Liefert eine Abmelde-Funktion. |
| `host.notifications.register('deploy-failed', { de, en }, { on: true })` · `host.notifications.notify('deploy-failed', { title, text, kind, url })` | Eigener Anlass mit eigenem Schalter unter Einstellungen → Benachrichtigungen (Desktop) und Livebetrieb → Handy (Push). |
| `host.storage.of('andere-id')` | Speicher einer anderen Erweiterung lesen – nur wenn deren Autor ihn mit `"shareStorage": ["deine-id"]` (oder `"*"`) freigibt. Nur lesen, Geheimnisse geschwärzt. |
| `host.setNewEntries([{ id, title: { de, en }, description, icon }])` | Einträge im Menü „Neu“ zur Laufzeit (z. B. je Vorlage) – öffnen die Seite mit `?action=<id>` wie `contributes.new`. |
| `host.services.list()` · `host.services.control(kind, id, 'start' \| 'stop' \| 'restart', { via, device })` | *nativ:* Dienste wie `Hostwerk.services()` – Steuern läuft über Hostwerks API und landet im Aktivitätsprotokoll. |
| `host.audit.registerVia('discord', { de: 'Discord', en: 'Discord' })` · `host.audit.as(via, device, fn)` | *nativ:* eigener Weg im Aktivitätsprotokoll (mit eigenem Alarm-Schalter, ab Werk aus) – z. B. „über Discord“. |
| `host.backups.register({ label, list(), restore(id), remove(id), offsite({ dir, job }) })` | *nativ:* eigene Stände in der Sicherungs-Zentrale (Zurückspielen, Löschen) und in der externen Sicherung („Daten aus Erweiterungen“). |
| `host.core('platform').elevatedBatch([{ cmd, args }])` · `elevatedRead(cmd, args)` | *nativ:* mehrere Befehle mit EINER Administrator-Rückfrage, Ausgabe kommt zurück. |
| `import { pl } from '@hostwerk/i18n'` | *native Oberfläche:* `pl(n, '{n} server', '{n} servers')` – Deutsch aus `locales/de.json`. |
| `ctx.dns.acme = { create({ domain, name, value }), remove(…) }` | *nativ, Dienst „dns“:* Hostwerk beantwortet Let's-Encrypt-Prüfungen per TXT-Eintrag (dns-01) – Wildcard-Zertifikate und ohne Port 80. |
| `users.login()` darf ein Promise liefern | *nativ, Dienst „users“:* Passwort-Prüfung asynchron (scrypt blockiert Hostwerk nicht). |

**Seiten im Rahmen offizieller Pakete:** `Hostwerk.backend()` (`/api/x/<id>/…`) erreicht jetzt auch offizielle Pakete,
die im Hostwerk-Prozess laufen – an ihren `host.router` (vorher Fehler 503). **Reiter anderer Erweiterungen** erscheinen
auch auf nativen Seiten (Leiste „Ergänzt von …“ über der Seite).

**Kacheln nativer Erweiterungen** (Steckplatz `dashboard.tiles`, seit SDK 2.8):

```js
export default { slots: { 'dashboard.tiles': [{ id: 'disk', title: { de: 'Speicher', en: 'Storage' }, icon: 'gauge', size: 'third', Component: DiskTile }] } };
```

`size`: `third` · `half` · `full`. Die Kachel erscheint unter „Übersicht → Anpassen“ wie eine eingebaute und lässt sich
ein- und ausblenden.

**Abgeschottete Erweiterungen im Blick:** Die Detailansicht zeigt CPU, Speicher und Neustarts des Prozesses; die
Speichergrenze (Standard 256 MB) ist einstellbar (64–2048 MB). Nach drei Abstürzen in fünf Minuten bleibt die
Erweiterung aus – das steht dort mit Grund und „Neu starten“.

---

## 19. SDK 3.0: Stabilität und Abkündigungen

Ab Hostwerk 3.0 bekommt der Kern nur noch Fehlerbehebungen, Sicherheit, Barrierefreiheit und Übersetzungen – Neues kommt
als Erweiterung. Das geht nur, wenn Erweiterungen weiterlaufen. Deshalb gibt SDK 3.0 ein Versprechen:

- **Semantische Versionen.** Alles, was SDK 3.0 beschreibt (`window.Hostwerk`, Manifest-Felder, Rechte, `contributes`),
  läuft mit **jeder Hostwerk-Version 3.x**. Minor-Versionen fügen nur hinzu, Patch-Versionen korrigieren nur.
- **Innerhalb von 3.x verschwindet nichts.** Entfernt wird nur mit einer neuen Hauptversion (SDK 4.0) – und erst, wenn es
  **mindestens zwei Minor-Versionen und 12 Monate** lang abgekündigt war. Die Prüfung warnt vor allem Abgekündigten, mit
  Datum und Ersatz:
  `Old permissions "read"/"write" – … Deprecated since SDK 3.0.0 (2026-10-21); removed no earlier than SDK 4.0.0 and not before 2027-10-21.`
- **Experimentelle Schnittstellen gehören nicht zum Versprechen.** Sie dürfen sich in jeder Version ändern, du musst sie
  ausdrücklich einschalten, und im Katalog sind sie nicht erlaubt (wie „Proposed API“ bei VS Code):

  ```json
  "experimental": ["name-der-schnittstelle"]
  ```

  Derzeit gibt es keine experimentellen Schnittstellen – die Liste steht in `EXPERIMENTAL` in `check.js`.

### `sdkVersion` und `hostwerk.max`

```json
"sdkVersion": "3.0",
"hostwerk": { "min": "3.0.0", "max": "3.x" }
```

| Feld | Bedeutung |
|---|---|
| `sdkVersion` | Das SDK, für das du die Erweiterung geschrieben und geprüft hast (`Haupt.Minor`). Hostwerk mit SDK 3.4 führt alles aus, was für 3.0–3.4 geschrieben ist; eine Erweiterung für ein neueres SDK sagt „bitte Hostwerk aktualisieren“. Für 2.x geschrieben: läuft weiter (3.0 behält alles aus 2.x), die Prüfung gibt einen Hinweis. |
| `hostwerk` | Wie bisher `">=3.0.0"` (nur Mindestversion) – oder `{ "min": "3.0.0", "max": "3.x" }`. `max` gilt einschließlich: `"3.x"` (jede 3.x), `"3.4.x"` oder eine genaue Version. Nur setzen, wenn du weißt, dass eine spätere Version deine Erweiterung bricht. |

Neue Erweiterungen aus dem Studio, dem KI-Entwurf und den Vorlagen bekommen `sdkVersion` automatisch. Ohne `sdkVersion`
zeigt die Prüfung nur einen Hinweis – Punkte werden dafür nicht abgezogen.

### SDK-Changelog

Was sich in welcher SDK-Version geändert hat und was abgekündigt ist: [SDK-CHANGELOG.md](SDK-CHANGELOG.md).

---

## 20. SDK 3.1: geteilter Seiten-Check und Notizen im Wissensgraph

Hostwerk 3.0 und neuer. Minor-Version – nur Neues, alles aus 3.0 läuft weiter.

**Seiten-Check als Dienst** (*nativ*): `host.service('sitecheck')` ist Hostwerks eigener Seiten-Check – derselbe wie unter
*Projekte → Seiten-Check*. Zwei Funktionen:

```js
const sc = host.service('sitecheck');                 // wirft auf Hostwerk vor 3.0 – prüfen, eigenen Rückfall behalten
const r = await sc.checkDir('/pfad/zu/dist', { base: '/mein-repo/', max: 60 });   // gebauter Ordner, nichts wird hochgeladen
const s = await sc.crawl('http://localhost:8080/', { max: 60 });                  // laufende Seite
// → { pages: [{ url, status, ms, title, issues: [{ level: 'err'|'warn'|'info', text }] }], broken: [{ url, kind, status, foundOn }], summary }
```

`checkDir` liefert den Ordner kurz über `127.0.0.1` unter `base` aus (GitHub-Projektseiten liegen unter `/<repo>/`) – Links
mit `/` am Anfang, die an `base` vorbeizeigen, stehen so als kaputt im Ergebnis, genau wie nach dem Veröffentlichen. Die
Texte sind deutsch wie in Hostwerks eigenem Check. *Seiten veröffentlichen* nutzt ihn vor jedem Hochladen.

**Notizen als Knoten im Wissensgraph** (Recht `change:knowledge`, ohne Rückfrage; nativ: `ctx.knowledge.setNotes(id, notes)`):

```js
await Hostwerk.put('/knowledge/notes', { notes: [
  { id: 'web:apache', title: 'Webserver „Apache“', text: '- [ ] Zertifikat erneuern\nNutzt `UserController`', service: { kind: 'web', id: 'apache' } },
] });
```

Der Aufruf ersetzt alle Notizen der Erweiterung (`[]` entfernt sie). Den Absender setzt Hostwerk selbst – eine Erweiterung
ändert nur ihre eigenen Notizen. Jede Notiz wird ein Doku-Knoten (Überschrift, `#tags`, `[[Links]]`, genannte Klassen als
Kanten) in der Quelle „Notizen aus Hostwerk“ und in jedem Projekt, zu dem der Dienst gehört (Webserver oder App des
Projekts) oder das die Notiz in `projects: [projektId]` nennt. `GET /knowledge/notes` (Recht `read:knowledge`) zeigt, was
im Graph steht. *Dienst-Notizen* nutzt das.

**Daten von Erweiterungen beim Umziehen** (*nativ*): `host.transfer.register({ label, export({ dir, job }), import({ dir, job, test }) })`
– `export` legt Dateien in `dir` ab, `import` liest sie auf dem Zielrechner (dort muss dieselbe Erweiterung laufen). Die
Daten stehen als eigene Zeile unter *Umziehen* (auch beim Umzug mehrerer Dinge auf einmal). Entfällt beim Entfernen.

```js
host.transfer.register({ label: { de: 'Postfächer', en: 'Mailboxes' },
  export: async ({ dir, job }) => { job.progress(30, 'Packing mailboxes …'); /* Dateien nach dir kopieren */ },
  import: async ({ dir, job, test }) => { /* Dateien aus dir übernehmen */ return { boxes: 3 }; } });
```

**Hostwerks Adresse für Seiten im Rahmen:** `Hostwerk.info().app.origin` (z. B. `http://192.168.1.5:7800`) und
`Hostwerk.info().app.publicView` – die volle Adresse der eigenen öffentlichen Ansicht `/v/<id>/` (oder `null`), z. B. zum
Anzeigen für OBS.

**Port auf einen Wunschport umstellen:** `POST /system/ports/fix` (Recht `change:ports`) nimmt neben `{ kind, id, field }`
auch `to` – Hostwerk nimmt diesen Port, wenn er frei ist und kein anderer Hostwerk-Dienst ihn hat, sonst **409** mit dem,
der ihn belegt. Ohne `to` wie bisher der nächste freie Port.

**Dienste offizieller Erweiterungen** (über `host.use(name)` / `ctx[name]`, vorher mit `typeof … === 'function'` prüfen):

| Dienst | Neu | Wofür |
|---|---|---|
| `router` (Router & Portfreigaben 1.2) | `router.forwards.list()` · `add({ port, protocol, label }, besitzer)` · `remove({ port, protocol }, besitzer)` · `owned(besitzer)` | Portfreigaben anderer Pakete mit Besitzer – der Automatikmodus behält sie, die Router-Seite zeigt ihre Herkunft. Statt selbst in `router.cfg.extra` zu schreiben. |
| `users` (Team & Rollen 1.2) | `users.can(mitgliedId, dienstId, bereich)` · `users.byDiscord(discordId)` · `users.serviceKey(art, id)` | „Darf dieses Mitglied das?“ mit denselben Regeln wie beim Fernzugriff – z. B. für den Discord-Bot. Dienst-IDs wie `mc:<id>`, `game:<id>`, `web:<id>`, `dbs:<id>`, `apps:<id>`; Bereiche `start-stop`, `console`, `players`, `backups`, `files`, `logs`. |
