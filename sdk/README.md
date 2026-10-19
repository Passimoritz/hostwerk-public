# Building Hostwerk extensions

**English** · [Deutsch](README.de.md)

An extension adds a **page** (in the sidebar), a **tile** (on the overview) and/or a **service** (a program Hostwerk
starts) to [Hostwerk](https://github.com/Passimoritz/hostwerk-public). It is a folder with a `manifest.json`, plain
HTML/JavaScript and two text files – no build step, no framework required.

| Player Ticker (dark) | Player Ticker (light) |
|---|---|
| ![Player Ticker in dark mode](img/player-ticker-dark.png) | ![Player Ticker in light mode](img/player-ticker-light.png) |

Extensions **cannot break Hostwerk's design**: the SDK brings Hostwerk's design kit and passes the current colours,
light/dark mode, font and language into the page at runtime. Use the `hw-*` classes and `var(--hw-…)` colours – the
check warns about hard-coded colours and fonts.

![How an extension runs](img/architecture.svg)

---

## Contents

1. [Quick start (5 minutes)](#1-quick-start-5-minutes)
2. [The package](#2-the-package)
3. [manifest.json](#3-manifestjson)
4. [The SDK – `Hostwerk.*`](#4-the-sdk--hostwerk)
5. [Design kit](#5-design-kit)
6. [Translations (German + English)](#6-translations-german--english)
7. [Permissions](#7-permissions)
8. [Settings, storage, events](#8-settings-storage-events)
9. [Dashboard tiles](#9-dashboard-tiles)
10. [Check your extension](#10-check-your-extension)
11. [Publish: repository, release, submit](#11-publish-repository-release-submit)
12. [Trust levels and getting verified](#12-trust-levels-and-getting-verified)
13. [Security model](#13-security-model)
14. [Examples](#14-examples)

![From idea to the marketplace](img/lifecycle.svg)

---

## 1. Quick start (5 minutes)

**Option A – in Hostwerk:** *Apps → Extensions → Build own*. Hostwerk creates `<Hostwerk>/extensions/<id>/` with a
working page, texts in German and English and an icon. The page appears in the sidebar immediately; edit the files and
press **Reload** in the page header.

**Option B – on GitHub:** open [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) →
**Use this template**. The repository already contains the check (GitHub Action) and automatic releases.

To try a repository in Hostwerk: *Apps → Extensions → File* (ZIP of the folder) or *From link* (link to a release ZIP).

## 2. The package

```
my-extension/
├─ manifest.json        name, version, permissions, page/tile/settings
├─ icon.svg             square, colourful – shown in the marketplace and the page header
├─ page/
│  ├─ index.html        the page (loads /ext-sdk.js first)
│  └─ app.js            your code (no scripts from the internet – bundle everything)
├─ widget/
│  └─ index.html        optional dashboard tile
└─ locales/
   ├─ de.json           all visible texts in German
   └─ en.json           … and in English
```

At most 10 MB. No programs (`.exe`, `.sh` …) in page-only packages.

## 3. manifest.json

```json
{
  "$schema": "https://raw.githubusercontent.com/Passimoritz/hostwerk-public/main/sdk/manifest.schema.json",
  "id": "player-ticker",
  "name": { "de": "Spieler-Ticker", "en": "Player Ticker" },
  "description": { "de": "Wer ist gerade online?", "en": "Who is online right now?" },
  "version": "1.0.0",
  "author": "Your name",
  "homepage": "https://github.com/you/hostwerk-ext-player-ticker",
  "icon": "icon.svg",
  "hostwerk": ">=2.9.0",
  "permissions": ["read:services", "read:minecraft", "storage"],
  "page":   { "title": { "de": "Spieler-Ticker", "en": "Player Ticker" }, "icon": "users", "file": "page/index.html" },
  "widget": { "title": { "de": "Spieler online", "en": "Players online" }, "file": "widget/index.html", "size": "third" },
  "settings": [
    { "key": "refresh", "type": "number", "label": { "de": "Aktualisieren (Sekunden)", "en": "Refresh (seconds)" }, "default": 10, "min": 3, "max": 120 }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | a–z, 0–9 and `-`, 2–40 characters. Stays the same forever. |
| `name`, `description`, `title`, `label` | Text or `{ "de": …, "en": … }` – the catalog requires both languages. |
| `version` | `1.2.3`. A higher version shows up as update in Hostwerk. |
| `icon` | Square SVG/PNG in the package – marketplace card and page header. |
| `page.icon` | **Sidebar icon** – a simple line icon like Hostwerk's own areas. One of: `puzzle users monitor gauge activity chart bell book bot box calendar camera clock cloud code coffee cpu database download file flag gamepad gift globe heart home image inbox key dashboard grid leaf line-chart list lock mail map message music network news package pie-chart radio rocket server settings shield cart sparkles star sun swords table tag terminal timer trophy tv wand wifi wrench zap`. |
| `hostwerk` | Minimum version, e.g. `>=2.9.0` – older Hostwerk refuses to install. |
| `permissions` | What the extension may see and do – see [Permissions](#7-permissions). |
| `network` | Web origins the page may `fetch` (needs the `network` permission), e.g. `["https://api.example.com"]`. |
| `settings` | Form drawn by Hostwerk: `text`, `number` (`min`/`max`), `switch`, `select` (`options`). |

The `$schema` line gives you auto-completion in VS Code.

## 4. The SDK – `Hostwerk.*`

Load it first: `<script src="/ext-sdk.js"></script>`. It also loads the design kit (see 5).

```js
const info = await Hostwerk.ready();           // colours, language, settings, tab, context, action have arrived
const list = await Hostwerk.services();       // [{ id, kind, name, state, port, cpu, memory, startedAt, extra }]
const mc = await Hostwerk.minecraft.servers(); // Minecraft only; extra.players, extra.tps
const stats = await Hostwerk.minecraft.stats(id);

Hostwerk.render('#list', Hostwerk.html`<b>${name}</b>`);   // every ${value} is escaped – safe for player names
Hostwerk.t('summary', { n: 3 });                            // text from locales/<lang>.json, {n} filled in
Hostwerk.fmt.bytes(123456); Hostwerk.fmt.duration(ms); Hostwerk.fmt.time(Date.now());

await Hostwerk.service('web', 'apache').restart();  // asks the user first (needs control:services)
await Hostwerk.minecraft.command(id, 'say Hi');     // asks first (needs command:minecraft)
await Hostwerk.put('/mc/servers/' + id + '/properties', { motd: '§aHi' }); // change a setting (change:minecraft, asks first) – SDK 2.2
await Hostwerk.del('/knowledge/' + id + '/memory/' + entry);               // delete (SDK 2.3)
const dir = await Hostwerk.pickFolder('Choose vault');                     // native folder dialog, path or null (SDK 2.3)
await Hostwerk.terminal('claude', { cwd: dir, title: 'Claude' });           // types into the Hostwerk terminal; the user presses Enter (SDK 2.5, run:terminal)

await Hostwerk.storage.set('pinned', 'srv1');       // kept by Hostwerk (needs storage)
const s = await Hostwerk.settings.get();            // values of manifest.settings
Hostwerk.settings.open();                           // opens the settings dialog

Hostwerk.tab;                         // current tab from page.tabs (SDK 2.2); Hostwerk.setTab('codes') switches it
Hostwerk.context;                     // { kind, id } when shown as a tab on a service page (contributes.tabs)
Hostwerk.on('tab', (id) => …);        // the user picked another tab
Hostwerk.on('action', (a) => …);      // { id, target } – your contributes.action was chosen
Hostwerk.on('service', (s) => …);     // a service changed state
Hostwerk.on('minecraft', (s) => …);   // players joined/left
Hostwerk.on('settings' | 'lang' | 'theme', …);

Hostwerk.toast('Done', { kind: 'success' });
Hostwerk.navigate('/mc/my-server');  // open a Hostwerk area
Hostwerk.openUrl('https://…');       // opens in the browser after asking (also obsidian:// since SDK 2.3)
Hostwerk.copy(text);                 // copies to the clipboard (SDK 2.1)
Hostwerk.get('/system/health');      // raw read access (checked against permissions)
```

`Hostwerk.lang` (`de`/`en`), `Hostwerk.theme` (`dark`/`light`) and `Hostwerk.embed` (`page`/`widget`) tell you where
you are.

## 5. Design kit – Hostwerk's own classes

**Basic requirement:** an extension looks exactly like Hostwerk's built-in areas. That's why `/ext-sdk.css` delivers
Hostwerk's **own** classes, generated from the current app stylesheet. Future design changes reach your extension
automatically. Hostwerk draws the page title, the description and the tabs (`page.tabs`) itself. Your page starts
directly with the content.

| Classes | |
|---|---|
| Layout | `row`, `row-tight`, `stack`, `grid grid-2` / `grid-3` / `grid-4`, `grow`, `right`, `muted`, `small`, `tiny`, `ellipsis`, `mono` |
| Cards | `card`, `card-pad`, `card-head` (with `h3`), `card-body`, `stat` with `k` / `v` / `s` |
| Controls | `btn` (+ `primary`, `ghost`, `danger`, `sm`, `xs`), `input`, `select`, `label`, `seg` (segment buttons), `switch` (`<label class="switch"><input type="checkbox"><span class="track"></span><span class="thumb"></span></label>`) |
| State | `badge` (+ `ok`, `warn`, `err`, `accent`), `callout` (+ `ok`/`warn`/`err`) with `callout-body`, `callout-title`, `progress` |
| Lists | `table`, `list-item`, `setting-row` (with `txt`) |
| Empty / loading | `empty` (+ `h3`, `p`, `empty-action`), `hw-skeleton`, `spinner` |

Colours: `--bg`, `--surface`, `--surface-2`, `--line`, `--line-2`, `--text`, `--text-2`, `--muted`, `--accent`,
`--accent-soft`, `--accent-text`, `--ok`, `--warn`, `--err`, `--mono`. The older `hw-…` classes and `--hw-…`
variables still work, so existing extensions don't break.

Rules the check enforces (warnings – errors in the catalog): no fixed colours, no own fonts (`var(--mono)` is fine),
nothing laid over Hostwerk (`position: fixed`, huge `z-index`). A deliberate exception per file, with a reason:
`/* hostwerk-allow: colors, fonts – preview like in the game */`.

## 6. Translations (German + English)

Every visible text lives in `locales/de.json` and `locales/en.json` with the **same keys**:

```html
<h1 data-i18n="title"></h1>                <!-- filled in by the SDK, updated when the language changes -->
<input data-i18n-placeholder="search">
```
```js
Hostwerk.t('playersOnline', { n: 5 })      // "{n} online"
Hostwerk.on('lang', render);               // re-render your own texts
```

The check reports missing keys and English texts that still look German. Manifest texts (`name`, `description`,
`title`, setting labels) need `{ "de": …, "en": … }` too.

## 7. Permissions

| Permission | Allows |
|---|---|
| `read:services` | See services and their state (`Hostwerk.services()`) |
| `read:web`, `read:databases`, `read:apps`, `read:tasks`, `read:mail` | Read these areas |
| `read:minecraft` | Minecraft servers, players, stats, worlds |
| `read:system` | Health, load, ports, storage per service |
| `read:network` | Router, machines, security status |
| `read:live` | Certificates with days left, uptime checks with history (SDK 2.4) |
| `share:status` | Public status page (`/live/statuspage`): switch on/off, title, which checks, renew the secret link, place it into a website folder – asks every time. Visitors only see names, state, availability and history (SDK 2.6) |
| `control:services` | Start, stop, restart – **Hostwerk asks every time** |
| `command:minecraft` | Send console commands – asks every time |
| `run:tasks` | Run scheduled tasks – asks every time |
| `change:minecraft` | server.properties, game rules, icon, plugins on/off, backups – asks every time (SDK 2.2) |
| `change:databases` | Create database backups – asks every time (SDK 2.2) |
| `change:mail` | Send test mails to the mail catcher, mark mails as read – asks every time (SDK 2.2) |
| `read:knowledge` | Knowledge graph: projects, graph, report, questions, memory, Claude status (SDK 2.3) |
| `change:knowledge` | Build and query the knowledge graph, folders, memory, Obsidian export – **no prompt per call**, because it only touches the graph's own data (SDK 2.3) |
| `connect:claude` | Write/remove the marked Claude section and skill in projects – asks every time (SDK 2.3) |
| `read:claude` | Claude status, projects, memory context, token-saving tools and usage (SDK 2.5) |
| `change:claude` | Write context files into projects, install/update/remove token-saving tools – asks every time (SDK 2.5) |
| `run:terminal` | `Hostwerk.terminal(cmd, { cwd, title, enter })`: types a command into the Hostwerk terminal. Without `enter` the user starts it with Enter; with `enter: true` Hostwerk asks first (SDK 2.5) |
| `storage` | `Hostwerk.storage` (256 KB) |
| `network` | `fetch` to the origins in `network` |

Never possible: Hostwerk settings, passwords, arbitrary files, shutdown, anything not listed. Ask only for what you
need – users see the list before they install. Every call is recorded in the extension's access log (also refusals).

## 8. Settings, storage, events

- **Settings**: describe them in `manifest.settings`; Hostwerk draws the form (so it always fits the design) and sends
  changes live (`Hostwerk.on('settings')`).
- **Storage**: `Hostwerk.storage.get/set/remove/all` – JSON values, 256 KB per extension, removed with the extension.
  Browser storage (`localStorage`, cookies) does not work in the sandbox.
- **Events** instead of polling: `service` (state changes), `minecraft` (players). Poll slowly (≥ 10 s) for the rest.

## 9. Dashboard tiles

`widget.file` is a small page without its own padding/background – Hostwerk draws the card. The height follows the
content automatically. Sizes: `third`, `half`, `full`. Installed tiles appear on the overview; users show, hide and arrange them with *Customize*.

## 10. Check your extension

The same rules run in Hostwerk (on install), in your repository (GitHub Action) and in the catalog:

```bash
curl -fsSLO https://raw.githubusercontent.com/Passimoritz/hostwerk-public/main/sdk/check.js
node check.js path/to/my-extension            # report
node check.js path/to/my-extension --strict   # catalog rules (warnings = errors)
```

In Hostwerk: *Apps → Extensions → installed package → Check* shows the same report.

## 11. Publish: repository, release, submit

1. Put the extension in its **own GitHub repository** (template: *Use this template*).
2. Raise `version` in `manifest.json`, add a line to `CHANGELOG.md`, push a tag `v1.2.3`.
   The Action checks the package and creates a release with `<id>-<version>.zip` and a `.sha256` file.
3. In Hostwerk: *Submit* on the installed extension – or open
   [Submit an extension](https://github.com/Passimoritz/hostwerk-public/issues/new?template=extension.yml) and paste
   the release link.
4. The action checks again (`--strict`), keeps a copy with checksum in `packages/` and adds it to
   `catalog/community.json`. Pages and tiles are added at once; services wait for a person (label *approved*).
5. Updates: submit again with a higher version (same id – an id belongs to whoever submitted it first).

Test without submitting: *Actions → Add extension → Run workflow* with a package link (dry run).

## 12. Trust levels and getting verified

![Trust levels](img/trust.svg)

| Badge | Meaning |
|---|---|
| **Official** | By Hostwerk – own repository, in `catalog/extensions.json` (built daily from the releases). |
| **Verified developer** | The project has verified the person (`catalog/verified.json`). |
| **Reviewed** | Additionally looked at by a person – required for services. |
| **Checked** | Passed the automatic check, runs sandboxed. |
| **External** | From a source the user added – checked on install only. |

**Getting verified:** have at least one extension in the community catalog, then open
[Get verified](https://github.com/Passimoritz/hostwerk-public/issues/new?template=verification.yml). The action
confirms the extensions are yours; the project decides by hand (label *verified*). The badge can be revoked if an
extension hides code or collects data without saying so.

## 13. Security model

- The page runs in a **sandboxed iframe with its own opaque origin** – no access to Hostwerk's login, cookies or API.
- Content-Security-Policy: scripts only from the package, network only to the origins in `network`, no frames,
  no forms posting elsewhere.
- Every request goes through the bridge and is checked against the permissions on the **server**; changes need the
  user's confirmation every time.
- Catalog packages are pinned by **SHA-256** – Hostwerk installs exactly the checked file.

## 14. Examples

| Repository | Shows |
|---|---|
| [hostwerk-ext-player-ticker](https://github.com/Passimoritz/hostwerk-ext-player-ticker) | Minecraft data, heads, ranking, storage (pin), settings, tile, live events |
| [hostwerk-ext-status-wall](https://github.com/Passimoritz/hostwerk-ext-status-wall) | All services, start/restart with confirmation, grouping, tile with ring |
| [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) | Minimal start: page, tile, settings, storage, translations, CI + releases |
| [hostwerk-ext-motd-studio](https://github.com/Passimoritz/hostwerk-ext-motd-studio) | Changes Hostwerk itself: own tab on every Minecraft page, right-click action, `change:minecraft` |
| [hostwerk-ext-service-notes](https://github.com/Passimoritz/hostwerk-ext-service-notes) | Tabs on all service pages, actions in the quick search, storage |
| [hostwerk-ext-knowledge-graph](https://github.com/Passimoritz/hostwerk-ext-knowledge-graph) | Large page with 6 tabs, canvas drawing with list alternative, quiet and confirmed permissions (SDK 2.3) |

![Status Wall inside Hostwerk](img/status-wall-in-hostwerk.png)

### Language packs

Hostwerk itself maintains German and English. More languages come from extensions: list them in `manifest.json` → `"languages": [{ "id": "fr", "name": "Français", "file": "lang/fr.json" }]`. The file has the same shape as Hostwerk's `ui/src/i18n/en.json` – `{ "texts": { "<German text>": "<translation>" }, "patterns": [["text with {}", "translation with {}"]] }`. Users pick the language under Settings → General; whatever is missing appears in English. The checker validates the file and the placeholders.
