# So sieht eine Hostwerk-Seite aus

Verbindliches Regelwerk für Hostwerks Oberfläche **und für alle Erweiterungen**. Ziel: Wer eine Seite kennt, kennt alle –
gleiche Bausteine, gleiche Wörter, gleiche Reihenfolge. Die Bausteine kommen aus `ui/src/components/ui.jsx`
(in nativen Erweiterungen `@hostwerk/ui`, in Seiten im Rahmen die Klassen aus `/ext-sdk.css`, siehe
[Erweiterungs-Anleitung, Abschnitt 5](README.de.md#5-design-baukasten--hostwerks-eigene-klassen)).

Geprüft wird maschinell: `node scripts/ui-consistency-audit.js` (Kern + alle Erweiterungen, läuft in `test-all` mit
einer Baseline, die nicht wachsen darf) und der Erweiterungs-Prüfer `check.js` (gleiche Regeln als Hinweise, ohne
Punktabzug). Daneben gelten weiter: Design-Skala (`design-scale-test.js`), Barrierefreiheit
(Checkliste), Übersetzung (`i18n-test.js`).

---

## 1. Seitenaufbau

```
┌ Seitenkopf: Symbol + Titel · ein Satz Beschreibung ············ Nebenaktionen · Hauptaktion ┐
├ Reiter (falls nötig)                                                                         ┤
├ Hinweise (Callout), nur wenn etwas zu tun ist                                                ┤
└ Inhalt: Kennzahlen oben, darunter Karten/Listen                                              ┘
```

**Seitenkopf** – immer derselbe Aufbau, der Erklärvideo-Knopf kommt von Hostwerk selbst:

```jsx
<div className="page-head">
  <div>
    <h1><HardDrive size={22} /> Laufwerke</h1>
    <p>Ein Satz, wofür die Seite da ist.</p>
  </div>
  <div className="actions">
    <Btn className="ghost" icon={RefreshCw}>Neu prüfen</Btn>
    <Btn className="primary" icon={Plus}>Laufwerk hinzufügen …</Btn>
  </div>
</div>
```

- Titel = Name im Menü, Symbol = Symbol im Menü (22 px). Beschreibung genau **ein** Satz als `<p>`; alles Weitere als ⓘ
  (`<InfoTip>`), nie als Absatz unter dem Titel.
- Detailseiten (ein Server, ein Projekt): Logo/Symbol 30 px, Name, Zustand als `<StatusPill>` im Titel, die Eckdaten
  (Version · Port · Spieler) als Beschreibung.
- Seiten im Rahmen einer Erweiterung (`page/index.html`) haben **keinen** eigenen Kopf – Titel, Beschreibung, Reiter
  und Einstellungen-Knopf zeichnet Hostwerk. Native Erweiterungen (`ui/`) bauen den Kopf selbst, genau wie oben.

**Reiter**: `<Tabs>` direkt unter dem Kopf (in Seiten im Rahmen: `page.tabs` im Manifest). Höchstens eine Ebene
Reiter; was darunter noch geteilt werden muss, wird `<Seg>` (Segmente) oder eine Liste links. Keine zweite Reiterleiste.

**Dichte**: Übersichten luftig (Kacheln, `grid grid-2/3/4`), Arbeitsseiten (Tabellen, Editor, Konsole) kompakt
(`btn sm`, `table`). Innerhalb einer Seite eine Dichte.

## 2. Karten und Kennzahlen

```jsx
<div className="card">
  <div className="card-head"><Database size={16} /><h3>Sicherungen</h3><span className="badge">12</span>
    <div className="right"><Btn className="sm" icon={Plus}>Sicherung erstellen</Btn></div></div>
  <div className="card-body">…</div>
</div>
```

- Kopf einer Karte: Symbol 16 px, `h3`, Zähler als `badge`, Aktionen in `.right` (Größe `sm`).
- Kennzahlen: `<div className="card stat"><div className="k"><Cpu />Name</div><div className="v">42<span className="of"> / 50</span></div><div className="s">Zusatz</div></div>`.
  Text statt Zahl (Version, Laufzeit, Größe): `className="v text"`. **Nie** `style={{ fontSize }}`.
- Keine eigenen Karten-/Kachel-Klassen mit Rand + Fläche + Rundung, wenn `card` passt.

## 3. Zustände (Status, leer, laden, Fehler)

| Zustand | Baustein | Wörter |
|---|---|---|
| Dienst-Zustand | `<StatusPill state="running" />` | Läuft · Startet … · Stoppt … · Gestoppt · Fehler · Installiert … · Nicht installiert |
| Bewertung | `badge ok / warn / err` | In Ordnung · Achtung · Gefährdet (bzw. was konkret los ist) |
| Seite/Bereich leer | `<Empty icon title text action>` | „Noch keine Projekte“ + ein Satz + **eine** Aktion |
| Karte leer | `<TileEmpty icon text action>` | „Noch keine Sicherungen.“ |
| Suche ohne Treffer | `<TileEmpty icon={Search} text="Nichts gefunden." />` | |
| Seite lädt | `<PageSkeleton>` | |
| Bereich/Karte lädt | `<Loading>` (in einer Karte: `<div className="card-body"><Loading /></div>`) | |
| Kurz in Liste/Menü | `small muted` | „Lädt …“, „Lädt Versionen …“ – nie „Lade …“/„Wird geladen …“ |
| Fehler beim Laden | `<Callout kind="err">` mit „Erneut versuchen“, oder `<Empty icon={CloudOff} …>` | sagen, was nicht ging, und was man tun kann |
| Hinweis/Tipp | `<Callout kind="info" title>` (wegklickbar) · `warn` · `err` (bleiben) | |

Keine grauen Sätze als Leer- oder Ladezustand einer ganzen Karte, keine eigenen Kreisel (`@keyframes spin`): `<Btn>`
zeigt beim Klick selbst einen Ladezustand, sonst `<Loading>`/`<Spinner>`.

## 4. Knöpfe

- Varianten: `primary` (Hauptaktion, **eine** je Bereich) · ohne Zusatz (normal) · `ghost` (Nebenaktion, Werkzeugleiste) ·
  `danger` (Löschen in Listen, als Rahmen) · `danger-solid` (nur der Bestätigen-Knopf in einem Gefahr-Dialog) ·
  `grad` (nur Hostwerks „+ Neu“).
- Größen: normal im Seitenkopf und in Dialogen, `sm` in Karten-Köpfen und Werkzeugleisten, `xs` in Tabellenzeilen.
- Symbol links (`<Btn icon={Plus}>`), Knopf nur mit Symbol braucht `title`/`aria-label`.
- **Reihenfolge**: Nebenaktionen links, Hauptaktion ganz rechts – im Seitenkopf, in Karten und im Dialog-Fuß
  („Abbrechen“ links, „Speichern“ rechts). Gefährliches nie direkt neben die Hauptaktion.
- Beschriftung: Verb (+ Objekt): „Speichern“, „Server starten“, „Sicherung erstellen“. Öffnet der Knopf erst einen Dialog
  oder eine weitere Auswahl, endet er mit „ …“ („Umziehen …“). Keine Ausrufezeichen.

## 5. Dialoge und Meldungen

- Bestätigen: `confirmDialog({ title: 'Sicherung löschen?', text, confirm: 'Löschen', danger: true })` – Titel als
  Frage, Knopf wiederholt das Verb (nicht „OK“/„Ja“). Nicht Umkehrbares mit `typeToConfirm`.
- Eingabe: `promptDialog(...)`. Nie `window.confirm/alert/prompt`, keine eigenen Bestätigungs-Fenster.
- Eigene Fenster: `<Modal title subtitle footer>`; Fuß wie oben (Abbrechen links, Hauptaktion rechts).
- Toasts: `toast.success('Gespeichert')`, `toast.warn(...)`, `toast.error(e.message)` – kurz, Vergangenheit, sagt was
  passiert ist („Server gestartet“). Nicht „erfolgreich …“, keine Ausrufezeichen. `toast(text, art, dauer, { action })`
  nur, wenn eine Aktion (Rückgängig, Öffnen) dazukommt.

## 6. Formulare und Tabellen

- `<Field label hint>`: Beschriftung **über** dem Feld, ohne Doppelpunkt, ohne Sternchen – Pflichtfelder erkennt man am
  gesperrten Speichern-Knopf und einer Meldung am Feld. Hilfe kurz als `hint`, Erklärungen als ⓘ.
- Einstellungen: `<SettingRow title text>` + Schalter/Feld rechts.
- Pfade auf diesem PC: `<PathInput>` (mit Explorer-Knopf).
- Tabellen: `<table className="table">`, Kopfzeile kurz, Zahlen rechtsbündig (`td.num`), Aktionen in der letzten Spalte
  (`btn xs ghost`), Rechtsklick-Menü für dieselben Aktionen.

## 7. Symbole, Skala, Farben

- Symbole aus `lucide-react` (Seiten im Rahmen: SVG inline). Größe wie die Schrift daneben: 12–16 im Text, 16 in
  Karten-Köpfen, 22 im Seitenkopf, ab 24 nur auf Bühnen (Leerzustand, Logos).
- Schrift, Rundung, Abstand nur als Stufe: `var(--fs-*)`, `var(--r-*)`, `var(--sp-*)`.
- Farben nur als Token (`--text`, `--muted`, `--surface`, `--accent*`, `--ok/--warn/--err` + `-text`/`-soft`). Weiß auf
  einer farbigen Kachel ist erlaubt. Bewusste Ausnahme je Datei: `/* hostwerk-allow: colors – Grund */`.
- CSS-Klassen englisch; keine Bauteil-Klasse heißt wie ein Zustand (`empty`, `ok`, `error` …).

## 8. Wörter

Ein Begriff je Sache, so wie man ihn sagt. Der Prüfer kennt die linke Spalte.

| So | Nicht | Anmerkung |
|---|---|---|
| Sicherung, sichern | Backup | Ordnernamen wie `Backups/rechner` bleiben |
| Vorab-Sicherung | Sicherheits-Backup | die automatische Sicherung vor Eingriffen |
| zurückspielen | | eine Sicherung zurückholen; „wiederherstellen“ für Papierkorb/Einstellungen |
| Dienst | Service | Fachname bleibt („Service-Account“ bei 1Password) |
| Erweiterung | Extension | „Add-ons“ nur, wo es der Fachbegriff ist (Bedrock, Firefox) |
| Einstellungen | Optionen, Konfig | |
| Passwort | Kennwort | |
| Ordner | Verzeichnis | |
| Anmeldung, anmelden | Login, einloggen | Namen bleiben („Game Server Login Token“) |
| E-Mail (kurz: Mail) | Email | |
| aktualisieren | updaten | „Update“ als Nomen ist in Ordnung |
| starten · stoppen · neu starten | beenden, neustarten | „beenden“ nur für Hostwerk selbst und Programme |
| entfernen | | aus einer Liste/aus Hostwerk nehmen (Daten bleiben) |
| löschen | | Daten sind danach weg – immer mit Bestätigung |
| Lädt … | Lade …, Wird geladen … | Fortschritt |

**Schreibweise**: Auslassungspunkte „…“ (nie „...“), mit Leerzeichen davor („Speichern …“). Gedankenstrich „–“ mit
Leerzeichen. Deutsche Anführungszeichen „…“. Titel und Knöpfe ohne Punkt am Ende; ganze Sätze in Hinweisen mit Punkt.
Du-Form, freundlich, ohne Ausrufezeichen. Erweiterungen schreiben ihre Texte englisch und liefern `locales/de.json` –
dort gilt dieselbe Liste.

## 9. Tastatur und Fokus

- Alles mit der Tastatur erreichbar, Reihenfolge = Lesereihenfolge (kein `tabindex` > 0). `<Tabs>` und `<Seg>` gehen mit
  Pfeiltasten, `<Modal>` hält den Fokus und schließt mit Esc.
- Zielgrößen ≥ 24 px, sichtbarer Fokusrahmen (`--accent-ring`), jeder Knopf hat einen Namen.

## 10. Platz – Seiten ohne Scrollen

Eine Seite soll bei 1366×768 auf einen Bildschirm passen; was lang ist, scrollt **in seiner eigenen Fläche**, nicht die
Seite. Budgets (Bildschirme bei 1366×768, gemessen mit `node scripts/ui-scroll-budget.js`):

| Ansicht | Budget | |
|---|---|---|
| Übersicht eines Bereichs | ≤ 1,0 | Kennzahlen oben, Liste darunter |
| Detailseite, Reiter | ≤ 1,2 | Zustand, Hauptaktion, die 3–4 wichtigsten Karten |
| Einstellungs-Gruppe | ≤ 1,5 | je Gruppe, Navigation links, Speichern immer sichtbar |
| Arbeitsseite, Liste, Tabelle, Protokoll | = 1,0 | füllt die Höhe, scrollt nur innen |
| Assistent / Einrichtung | ≤ 1,0 je Schritt | offen ist nur der aktuelle Schritt |
| Katalog (Erweiterungen, Ideen) | ≤ 2,5 | Scrollen ist in Ordnung, Suche und Filter kleben oben |

Bausteine (`ui.jsx` bzw. `@hostwerk/ui`; dieselben Klassen gibt es in `/ext-sdk.css` für Seiten im Rahmen):

| Muster | Komponente | Klassen | Wann |
|---|---|---|---|
| Kompakter Seitenkopf | – (zentral) | `page-head` | Titel und **ein** Satz in einer Zeile; zu lang → gekürzt mit Tooltip |
| Raster, das mit der Breite wächst | `<Cols size="" \| "sm" \| "lg">` | `cols`, `cols-sm`, `cols-lg` | statt `grid grid-2` für Karten: 1366 px → 2, 1920 px → 3 Spalten |
| Einstellungen mit linker Navigation | `<SettingsLayout groups value onChange>` | `settings-layout`, `settings-nav`, `settings-nav-item`, `settings-pane` | mehr als zwei Karten Einstellungen |
| Feste Aktionsleiste | `<SaveBar dirty onSave onReset>` | `save-bar` | Formular über mehrere Karten/Gruppen: **ein** Speichern |
| Seitenblatt („Mehr …“) | `<SideSheet title onClose>` | `side-sheet-back`, `side-sheet`, `side-sheet-head/-body/-foot` | Seltenes und Details, die Seite bleibt sichtbar (Suche, Prüfregeln, Einrichten) |
| Master-Detail | `<MasterDetail list detail listLabel>` | `master-detail`, `md-list`, `md-item`, `md-detail` | eine Liste, rechts die Einzelheiten des gewählten Eintrags |
| Füllhöhe | `useFillHeight({ max: true })` | `fill-scroll` | Tabellen, Listen, Protokolle: scrollen innen, Kopfzeile klebt |
| Kennzahl-Leiste | `<StatBar items>` | `stat-bar`, `stat-bar-item` | statt hoher Kennzahl-Kacheln; Werte mit `onClick` werden Filter |
| Akkordeon mit Gedächtnis | `<Accordion id title badge>` | `accordion`, `accordion-head`, `accordion-body` | Gruppen, die man selten braucht; offen/zu wird gemerkt |
| Hinweise bündeln | `<HintBar id>` | `hint-bar` | mehr als ein Hinweis übereinander → einer sichtbar, Rest aufklappbar |
| Erledigtes als Zeile | – | `summary-row` | fertige Schritte, Zeitpläne: „Täglich um 9:00 · Ändern …“ |
| Kompakte Liste | – | `list-rows`, `list-row-item` | Kataloge: Zeile ≈ 48 px statt hoher Karten |
| Klebende Werkzeugleiste | – | `toolbar-sticky` | Suche/Filter über langen Listen |
| Zustand merken | `useRemembered(key, start)` | – | gewählte Gruppe, Ansicht Liste/Kacheln |

Regeln: Leere Karten weglassen (eine Zeile oder ein Link reicht). Formulare, die man selten ausfüllt („Neue Regel“,
„Welt hochladen“), öffnen als Dialog. Gefährliches (Entfernen) steht in einer zugeklappten Gefahrenzone. **Dichte**: Unter
Einstellungen → Allgemein → Darstellung wählt man „Normal“ oder „Kompakt“ (`.app.compact` senkt `--sp-*` und
Bedienhöhen) – eigene feste Abstände unterlaufen das, darum nur die Stufen benutzen.

## 11. Prüfen

```
node scripts/ui-consistency-audit.js                 # Bericht: Hinweise je Regel, Kern + Erweiterungen
node scripts/ui-consistency-audit.js --rule term     # alle Fundstellen einer Regel
node scripts/ui-consistency-audit.js --inventory     # welche Bausteine jede Seite nutzt
node scripts/ui-consistency-audit.js --check         # gegen die Baseline (test-all)
node server/extensions/sdk/check.js <erweiterung>    # Erweiterung: dieselben Regeln als Hinweise (ui-…)
node scripts/ui-scroll-budget.js                     # Bildschirme je Ansicht (1366×768 und 1920×1080), Budget-Hinweise
node scripts/ui-scroll-budget.js --quick --check     # gegen die Baseline (test-all) – keine Ansicht darf länger werden
```

Regeln: `dots`, `native-dialog`, `footer-order`, `exclaim`, `success-word`, `toast-kind`, `raw-pill`, `text-loading`,
`text-empty`, `page-head`, `label-colon`, `table-class`, `inline-font`, `icon-size`, `own-spinner`, `css-scale`,
`css-color`, `term` (Quelle: `UI_HINTS` in `server/extensions/sdk/check.js`). Wer etwas aufräumt, senkt die Baseline mit
`--update-baseline`; neue Abweichungen lassen den Test rot werden.
