# SDK changelog

What changed in the Hostwerk extension SDK (`window.Hostwerk`, `manifest.json`, permissions, `contributes`, `check.js`).
Since 3.0 the SDK follows semantic versioning – see [section 19 of the guide](README.md#19-sdk-30-stability-and-deprecations).

**English** · Kurz auf Deutsch steht jeder Eintrag darunter.

## 3.7.0 – 2026-10-25

“Ask AI” – the Explain button like Hostwerk ([section 29 of the guide](README.md#29-sdk-37-ask-ai--the-explain-button-like-hostwerk)). Only additions.

- `@hostwerk/kit`: `AiQuickButton` (`task`, `text`, `context`, `label`, `size`), `openAiExplain({ task, text, context, label })`,
  `useAiReady()`, `aiReadyNow()`. The button is hidden and the window does not open while the AI is off or not ready.
- Pages in the frame: `Hostwerk.ai.ready()`, `Hostwerk.ai.explain(text, { task, context, label })` (permission `use:ai`) and the
  event `Hostwerk.on('ai', ({ ready }) => …)`.
- New design-kit class `btn-ai` (sparkle pill in the accent colour) in `/ext-sdk.css`.
- The Explain button no longer unfolds the answer in the row: it opens the Ask AI window (answer, copy, follow-up question,
  continue in the AI chat) – also in the `Console` from `@hostwerk/kit`.
- `check.js` warns about `Hostwerk.ai.explain` without `use:ai`.

> DE: „KI fragen“ wie in Hostwerk – `AiQuickButton`, `openAiExplain`, `useAiReady` in `@hostwerk/kit`, `Hostwerk.ai.ready()`/
> `.explain()` und das Ereignis `ai` im Rahmen (Recht `use:ai`), Klasse `btn-ai`. Der Erklären-Knopf öffnet jetzt ein Fenster
> statt die Antwort in der Zeile aufzuklappen.

## 3.6.0 – 2026-10-25

Animations like Hostwerk ([section 28 of the guide](README.md#28-sdk-36-animations-like-hostwerk)). Only additions.

- New classes in `/ext-sdk.css` and for native extensions: `hw-spinner` (`hw-sm`/`hw-lg`), `hw-dots`, `hw-fade`, `hw-rise`,
  `hw-pop`, `hw-slide`, `hw-stagger`, `hw-pulse`, `hw-breathe`, `hw-float`, `hw-spin`, `hw-shake`, `hw-glow`, `hw-check`,
  `hw-flash`; Hostwerk's loading line (`hw-loading`) and empty state now work in the frame too.
- `Hostwerk.ui.loader()`, `.spinner()`, `.dots()`, `.check()`, `.empty()`, `.animate(el, kind)`, `.countUp(el, n)`, `.motionOk()`.
- `@hostwerk/ui`: `Dots`, `CheckMark`, `Reveal`, `CountUp`, `animate`; `Spinner` takes `size`, `Loading` takes `inline`.
- Hostwerk's *Reduce animations* setting reaches pages in the frame (`theme.reduceMotion` → `data-motion="reduce"`) – every
  animation above stops there, like with the system setting.

> DE: Hostwerks Animationen für Erweiterungen – Kreisel, hüpfende Punkte, Einblenden (auch nacheinander), Puls, gezeichneter
> Haken, Lade-Linie und leerer Zustand als Klassen, `Hostwerk.ui.*` im Rahmen und Bausteine in `@hostwerk/ui`.
> „Animationen reduzieren“ in Hostwerk hält sie auch im Rahmen an.

## 3.5.0 – 2026-10-25

Service kinds, contributions and a core without special cases ([section 27 of the guide](README.md#27-sdk-35-service-kinds-contributions-and-a-core-without-special-cases)). Only additions.

- New: `host.serviceKind(def)` – your own kind of services (overview, search, start/stop, files, tasks, backups, moving,
  mirror, time machine, ports, alert thresholds, AI). The overview has `overview.kinds`; `@hostwerk/kit` exports `kindItems`,
  `allKindItems`, `kindDef`, `kindDefs`, `kindText`, `kindState` and `removeKindItem`.
- New: `host.contribute(type, def)` for `keeper`, `health`, `search`, `guide`, `audit`, `icons`, `connections`, `emergency`,
  `releaseNotes`, `terminal`, `advisor` and `clickguard`; `host.aiExtend({ tools, groups, modes, assists, about, vocab, speak, context })`.
- Manifest: `page.route`, `page.nav.area`, `data { settings, folders }` (“Remove completely”), `keep` (keep services when
  Hostwerk is removed), `liveEvents`, `videos`/`videosRepo`; project templates in `templates/projects/<id>/`.
- Native: `host.dataDir`, `host.get(path)`; error texts are translated with every installed extension's `locales/de.json`;
  default imports of `@hostwerk/files` and `@hostwerk/editor`; slot `files.preview` (`title`, `match`, `Component`).
- Core: no extension-specific code any more – Minecraft, game servers, passwords, router, mail server and the others bring
  their parts themselves. The `ctx.minecraft` placeholder and the core-first list are gone.

> DE: Eigene Dienst-Arten (`host.serviceKind`), Beiträge zu Hostwerks Bereichen (`host.contribute`: Selbstwartung, Gesundheit,
> Suche, Livegang, Änderungsprotokoll, Bilder, Verbindungen, Notfall, Versionshinweise, Terminal, Berater, Klick-Test) und KI
> (`host.aiExtend`). Manifest: `page.route`, `data` (restlos entfernen), `keep` (beim Entfernen von Hostwerk behalten),
> `liveEvents`, eigene Erklärvideos. Der Kern kennt keine bestimmte Erweiterung mehr.

## 3.4.0 – 2026-10-24

Screens of their own and device sign-in ([section 26 of the guide](README.md#26-sdk-34-screens-of-their-own-and-device-sign-in)). Only additions.

- New in the interface module: `screens: { <route>: { Component, mobileHome } }` – a whole screen without Hostwerk's sidebar
  under `#/<route>` (e.g. the Hostwerk app under `#/handy`). `mobileHome: true` = small screens (< 700 px) start there. Routes
  Hostwerk uses itself cannot be taken.
- New slot `live.remote.actions`: buttons in the head of the remote access card (gets `remote`, the remote access status).
- New in `@hostwerk/kit`: `stopAllGuarded`, `confirmStopOne`, `runGate`, `setStopGate` (Hostwerk's stop guard with an own extra
  confirmation, e.g. a passkey), `askAi`, `EmergencyButton`, `EmergencyBanner`, `AiQuotaWidget`, `HwLogo`.
- New: a native extension can provide the service `devices` (`host.provide('devices', …)`) – Hostwerk's sign-in asks
  `devices.verify(req)` for requests without a session (same session shape: `{ user, userId, role, device }`), `/logout` calls
  `devices.logout(req)`, “Sign out everyone” calls `devices.removeAll()`. Feature detection: `host.supports('devices')`.
- Core: lockout per account in addition to per address (10 failed sign-ins within an hour, also from different addresses);
  `remote.dropSessions(pred)` ends sessions selectively.
- Moved out of the core: phone view, web app manifest, service worker and `/app-laden` are the extension “Hostwerk app” (`pwa`).

> DE: Eigene Vollbild-Ansichten (`screens`, `mobileHome`), Steckplatz `live.remote.actions`, neue Bausteine in `@hostwerk/kit`
> (Stopp-Schutz mit eigener Zusatz-Bestätigung, KI fragen, Notaus, KI-Kontingente, Logo) und der Dienst `devices`: gekoppelte
> Geräte zählen bei Hostwerks Anmeldung mit (gleiche Rechte, Sperren, „Alle abmelden“). Kern: Sperre je Konto. Die Handy-App ist
> jetzt die Erweiterung „Hostwerk-App“ (`pwa`).

Also building blocks for features that used to be part of Hostwerk (first user: Minecraft servers as the extension `minecraft`):

- `@hostwerk/kit` also exports `Console`, `ErrorHelp`, `ErrorBoundary`, `ExtSections`/`useSectionRole`, `SourceLink`,
  `OverrideSlot`, `useSelection`/`SelectBox`/`SelectAll`/`BulkBar`, `TaskList`, `TaskEditor`, `Adopt`, `Advisor`/`Choices`/`Step`/`Summary`,
  `useImportState`/`ImportIntro`, `PickInfo`, `removeMc`, `useSlot` and Hostwerk's own `tr`/`pl`/`locale`/`getLang`.
- Translation: when a native extension has no entry of its own, the English interface falls back to Hostwerk's `en.json`
  (for extensions with German source text that were moved out of the core).
- `host.provide(name)` may replace a core placeholder (`ctx.minecraft`); removing the extension brings the placeholder back.
  Extensions listed as core-first (`minecraft`) start before all others.

Kurz: Neue Bausteine im Kit für ausgelagerte Funktionen (Konsole, Abschnitte, Mehrfachauswahl, Aufgaben, Anlegen/Übernehmen,
Kern-Übersetzung), englische Texte fallen auf Hostwerks en.json zurück, `host.provide` ersetzt Kern-Platzhalter.

## 3.3.0 – 2026-10-22

Stable services instead of core internals, traces and an uninstall hook ([section 25 of the guide](README.md#25-sdk-33-stable-services-instead-of-core-internals-traces-and-an-uninstall-hook)). Only additions.

- New stable services for own server code, each with a permission: `host.ai.quick` (`use:ai`), `host.minecraft.addons()`
  (`read:minecraft`), `host.updates.pending()` (`read:updates`) / `.apply(key)` (`change:updates`), `host.net.offline()`,
  `host.icons.favicon(url)` (`fetch:icons`, public addresses only, cached), `host.sshKeys.import()` (`write:ssh-keys`, never
  overwrites), `host.images.list()` (`read:apps`, Docker images with tag from apps, Compose stacks and game servers).
  Sandboxed modules get the reading ones.
- New: `host.sdkVersion` and `host.supports(name)` for feature detection (available and allowed).
- New permissions: `use:ai`, `read:updates`, `change:updates`, `fetch:icons`, `write:ssh-keys` (with can/cannot texts).
- New permission `connect:mail` for mail programs: IMAP/SMTP/POP3 to mail servers the person chooses (mail ports only; sandboxed
  never into the home network or 127.0.0.1).
- New: traces outside the own folder – `host.traces.add({ kind, id, label, admin, remove })`, `.remove(id)`, `.list()`
  (`task`, `file`, `dir`, `registry`, `service`, `firewall`, `port-forward`). Shown in the extension pop-up, offered with ticks
  when uninstalling, in maintenance and in *Remove Hostwerk*; admin steps with one prompt.
- New: `exports.uninstall(host, { traces })` – runs only when an extension is removed (not when switched off or updated).
- Checker: warning `traces` when server code creates tasks, registry entries, services or `ProgramData` files without
  `host.traces.add()`; hint `internals` for core internals that now have a stable replacement.
- Deprecated (fallback stays): `ctx.ai.quick`, `ctx.minecraft.readMeta`/`addonDir` for reading versions,
  `ctx.patchUpdates.pending/apply`, `host.core('download').isOffline()`, writing into `ctx.sshKeys.dir` – removed no earlier
  than SDK 4.0.0 and not before 2027-10-22.
- Checker: design hints `ui-…` (no points deducted) where a page builds its own instead of a core building block or uses
  other words than Hostwerk – rule book `ui-guidelines.md` ([“Design”](README.md#design-what-a-hostwerk-page-looks-like)).
  Kit: `card stat` value as text (`v text`) and a quiet “/ total” (`of`).

> DE: Gestaltungs-Hinweise `ui-…` im Prüfer (ohne Abzug, Regelwerk `ui-guidelines.md`), Kennzahl-Klassen `v text` und `of`.
> Stabile Dienste mit Rechten statt Kern-Interna (`host.ai.quick`, `host.minecraft.addons`, `host.updates`, `host.net.offline`,
> `host.icons.favicon`, `host.sshKeys.import`, `host.images.list`), Feature-Erkennung (`host.supports`), Spuren außerhalb des
> eigenen Ordners (`host.traces`) mit Liste im Pop-up und Häkchen beim Deinstallieren, Entfernen-Haken `uninstall()`; der
> Prüfer warnt bei Spuren ohne Meldung. Die alten Interna bleiben als Rückfall (abgekündigt, frühestens 4.0.0 / 22.10.2027).

## 3.2.0 – 2026-10-21

Sections instead of tabs, file browser hooks and pages in a web server ([section 21 of the guide](README.md#21-sdk-32-sections-instead-of-tabs-file-browser-and-pages-in-a-web-server)). Only additions.

- New: `contributes.sections` (`on`: `mc.overview`, `mc.players`, `files.folder`, `web.site`) and the native module field
  `sections` – a card right inside Hostwerk's detail view, with error protection. Two per extension and place.
- New: `"fallback": true` for `contributes.tabs` – the tab only shows on Hostwerk versions without sections.
- New: `contributes.actions` with `"on": ["file"]` / `["folder"]` (right-click in the file browser); native slots
  `files.actions` and `files.marks`.
- New: `host.sites` for native extensions – provide a page (HTML + JSON) in a web server folder, renewed at an interval.
- `.nbt` structures go through `files.preview` as well (before: only the NBT tree).
- `Hostwerk.navigate()` takes a simple query (`/ext/<id>?action=edit&target=…`) – e.g. from a section to the own page with an action.
- New (later 3.2 build): `"page": true` for `contributes.tabs` in a main area – the whole page with its `page.tabs` as
  sub-navigation inside that area; `#/ext/<id>` leads there. Older versions show `file` as a plain tab.

> DE: Abschnitte in Detailansichten statt eigener Reiter (`contributes.sections`, nativ `sections`), Reiter-Rückfall
> `"fallback": true`, Rechtsklick und Kennzeichen im Datei-Browser (`on: file/folder`, `files.actions`, `files.marks`),
> Seiten in einen Webserver legen (`host.sites`). Nur Neues.

Also in 3.2: Minecraft networks ([section 22 of the guide](README.md#22-sdk-32-minecraft-server-types-and-networks)). Only additions.

- New: `ctx.minecraft.registerType(id, def, owner)` for native extensions – an own Minecraft server type (e.g. BungeeCord
  from "Minecraft server network"): `label`, `versions()`, `download()`, optional `latestBuild()`, `java()`, `proxy`,
  `hidden` (not in the create dialog), start hooks `launchArgs(s, jar)`, `beforeStart(s, dir)` and `readyRe`. Built-in
  types cannot be replaced. Returns an unregister function.
- New: `ctx.minecraft.network.apply(proxyId, { members, forcedHosts })` writes forced hosts (`{ "host": ["key"] }`) into
  velocity.toml; without `forcedHosts` the section stays empty as before. Only for Velocity proxies.
- Changed (security): servers behind a proxy (`network.proxy`) are no longer listed in `security.publicPorts()` – firewall
  and router automation never open them.
- The move of "Bedrock bridge" goes to "Minecraft server network" (`mc-network`, extMigrate).

> DE: Eigene Minecraft-Servertypen für native Erweiterungen (`minecraft.registerType`, z. B. BungeeCord), forced hosts in
> `network.apply`, Server hinter einem Proxy nie mehr in den öffentlichen Ports; Umzug der Bedrock-Brücke nach „Minecraft-
> Servernetzwerk“. Nur Neues.

Also in 3.2: loading like a built-in page ([section 23 of the guide](README.md#23-sdk-32-loading-like-a-built-in-page)). Only additions.

- Hostwerk shows its own loading animation over every extension frame (page, tab, tile) until the page reports *loaded*;
  a page that does not answer gets “not responding” with *Try again* instead of an empty area.
- New: `Hostwerk.loaded()`, `Hostwerk.holdLoaded()` and `<meta name="hostwerk-loading" content="manual">` – usually
  automatic after the first `Hostwerk.render()`.
- New: `Hostwerk.ui.loading()`, `.error()`, `.load()`, `.skeleton()` – loading/error states inside the page (aria-busy,
  role=alert), texts de/en or own via `hw.loading`, `hw.loadError`, `hw.retry`.
- Fix: the SDK repeats its hello until Hostwerk answers and buffers calls made before – pages no longer stay empty when
  the frame was faster than Hostwerk (often only after reloading several times). Messages carry the document id.

> DE: Hostwerk zeigt seine Ladeanimation über jedem Erweiterungs-Rahmen, bis die Seite „geladen“ meldet (`Hostwerk.loaded()`,
> sonst automatisch); Fehlerzustand mit „Erneut versuchen“ statt leerer Fläche; `Hostwerk.ui.loading/error/load/skeleton`
> für Zustände in der Seite. Behoben: Seiten blieben manchmal leer (Gruß ging verloren) – jetzt Wiederholung + Puffer.

Also in 3.2: without an own sidebar entry ([section 24 of the guide](README.md#24-sdk-32-without-an-own-sidebar-entry)). Only additions.

- New: `"page": { "nav": false }` – no own sidebar entry; the extension lives in Hostwerk's areas, the page stays reachable
  from Extensions → Open, and people can pin it in the sidebar editor. Older Hostwerk versions ignore it.
- New: `area:tasks` for `contributes.tabs` (native `tasks.tabs`), native `games.tabs` (shown by "Game servers" through
  `useAreaTabs` from `@hostwerk/kit`), `live.tabs` with the same id from several extensions share one tab.
- New: `"role": "motd"` for sections on `mc.overview` – Hostwerk's own MOTD card steps back (one preview).
- New: `Hostwerk.saveFile(name, text, type)`, `GET /system/info` and `GET /system/health` (`read:system`),
  `titles: { de, en }` in `GET /live/security`.

> DE: `"nav": false` (kein eigener Seitenleisten-Eintrag, anheftbar), Reiter im Bereich Aufgaben (`area:tasks`), `games.tabs`,
> gemeinsame Livebetrieb-Reiter mit gleicher id, Abschnitts-Rolle `motd`, `Hostwerk.saveFile`, `/system/info`, `/system/health`,
> englische Titel in `/live/security`. Nur Neues.

## 3.1.0 – 2026-10-21

Shared site check and notes in the knowledge graph ([section 20 of the guide](README.md#20-sdk-31-shared-site-check-and-notes-in-the-knowledge-graph)). Only additions.

- New: `host.service('sitecheck')` for native extensions – `crawl(url)` for a running site and `checkDir(folder, { base })`
  for a built folder before publishing (served for a moment on 127.0.0.1).
- New: `PUT /knowledge/notes` (permission `change:knowledge`) / `ctx.knowledge.setNotes(id, notes)` – own notes as document
  nodes in the knowledge graph, linked to the projects of their service; `GET /knowledge/notes` with `read:knowledge`.
- Calls of extensions carry `x-hostwerk-ext-id` (set by Hostwerk, not by the page) – so the core knows the sender.
- New: `host.transfer.register({ label, export, import })` – data of native extensions moves along between machines.
- New: `Hostwerk.info().app.origin` and `.publicView` (full address of `/v/<id>/`) for pages in a frame.
- New: `POST /system/ports/fix` takes a wanted port `to` (409 if it is taken).

> DE: Seiten-Check als Dienst (`host.service('sitecheck')`: `crawl`, `checkDir`), eigene Notizen als Knoten im
> Wissensgraph (`PUT /knowledge/notes`, Recht `change:knowledge`), Erweiterungsdaten im Umzug (`host.transfer.register`),
> Hostwerks Adresse für Seiten (`Hostwerk.info().app.origin`/`publicView`), Wunschport bei `/system/ports/fix`. Nur Neues.

## 3.0.0 – 2026-10-21

**Stability promise.** Everything documented in SDK 3.0 runs with every Hostwerk 3.x. Removals only in a new major version,
after at least two minor versions and 12 months of deprecation.

- New: `sdkVersion` in the manifest (`"3.0"`) – which SDK the extension was written for. Missing: only a hint.
- New: `hostwerk` can be `{ "min": "3.0.0", "max": "3.x" }` – a highest Hostwerk version besides the lowest.
- New: `experimental` – opt-in for experimental APIs (none yet). Not allowed in the catalog.
- New: the check warns about deprecated features with date and replacement (`DEPRECATIONS` in `check.js`).
- Nothing removed – every 2.x extension keeps running.

Deprecated (warning since 3.0.0, removed no earlier than SDK 4.0.0 and not before 2027-10-21):

| Id | What | Instead |
|---|---|---|
| `permissions-read-write` | Permissions `"read"` / `"write"` | exact scopes such as `"read:minecraft"`, `"control:services"` |
| `nav-group-extensions` | `page.nav.group: "extensions"` | `"server"`, `"develop"`, `"system"` or an own area |

> DE: Stabilitätsversprechen; neu `sdkVersion`, `hostwerk` mit `min`/`max`, `experimental` (Opt-in, nicht im Katalog);
> die Prüfung warnt vor Abgekündigtem mit Datum. Nichts entfernt. Abgekündigt: Rechte „read“/„write“ und die
> Seitenleisten-Gruppe „extensions“ – frühestens mit SDK 4.0, nicht vor dem 21.10.2027.

## 2.10.0

Events, notifications, controlling services and public views ([section 18 of the guide](README.md#18-sdk-210-events-notifications-controlling-services-and-public-views)).

- `Hostwerk.services()` also lists `game` (game servers) and `docker` (Docker apps).
- New permissions `read:games`, `change:ports` (with `/system/ports/free`) and `share:view` (public view under `/v/<id>/`, e.g. an OBS overlay).
- Own notification occasions with their own switch for desktop and push.
- `host.on` for core events (including `git-pull`, `deploy-done` and `mc-player-leave`); `host.services.list/control` (logged in the activity log, own route label with alert switch).
- `ctx.dns.acme` for dns-01 (wildcard certificates), `elevatedBatch`/`elevatedRead`, `pl()` in `@hostwerk/i18n`, `ctx.web.logFiles(inst)` without side effects.
- Native pages show add-on tabs; tabs per project (`on: project`); backup sources for extensions (also in the external backup); shared storage (`shareStorage`, `host.storage.of`); `contributes.new` entries at runtime; mail catcher filters; asynchronous `users.login`.
- Official packages with a page frame reach their own backend via `/x/<id>/`.

> DE: Spiele-Server und Docker in services(), neue Rechte (read:games, change:ports, share:view), eigene
> Benachrichtigungs-Anlässe, Kern-Ereignisse über host.on, Dienste steuern, dns-01, Zusatz-Reiter auf nativen Seiten,
> Reiter je Projekt, Sicherungs-Quellen und geteilter Speicher für Erweiterungen.

## 2.9.0

Themes (`contributes.themes`), overrides of named places in Hostwerk's interface (`contributes.overrides`, permission
`override:ui`), extending other extensions (`contributes.extends`, `allowExtensions`, permission `extend:extensions`).

> DE: Farbschemata, Oberflächen-Anpassungen, andere Erweiterungen erweitern.

## 2.8.0

Native extensions built in like Hostwerk itself (`backend`, `ui`), sandbox for community packages, tabs in Hostwerk's main
areas (`contributes.tabs[].on: "area:…"`), own sidebar groups.

> DE: Native Erweiterungen, Abschottung, Reiter in Hauptbereichen, eigene Gruppen in der Seitenleiste.

## 2.7.0

Categories, colour, banner, screenshots, dependencies on other extensions (`requires`), native code (`native`), changelog.

> DE: Kategorien, Aussehen, Abhängigkeiten, nativer Code.

## Earlier

2.2 design kit and `contributes` (tabs, actions); 2.4 `read:live`. Details are in Hostwerk's release notes.
