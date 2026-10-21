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
15. [SDK 2.7: look, dependencies and native extensions](#15-sdk-27-look-dependencies-and-native-extensions)
16. [SDK 2.8: built in like Hostwerk itself – and sandboxed](#16-sdk-28-built-in-like-hostwerk-itself--and-sandboxed)
17. [SDK 2.9: themes, overrides and extending other extensions](#17-sdk-29-themes-overrides-and-extending-other-extensions)
18. [SDK 2.10: events, notifications, controlling services and public views](#18-sdk-210-events-notifications-controlling-services-and-public-views)
19. [SDK 3.0: stability and deprecations](#19-sdk-30-stability-and-deprecations)

![From idea to the marketplace](img/lifecycle.svg)

---

## 1. Quick start (5 minutes)

**Easiest – the Extension Studio:** *Extensions → For developers → New extension*. A graphical editor guides you
through basics, place in Hostwerk, permissions, content (blocks such as stats, lists, buttons, forms – or your own
code), texts, live preview, check and publishing (GitHub repository with release, submitting to the catalog).

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

| Field | Meaning |
|---|---|
| `id` | a–z, 0–9 and `-`, 2–40 characters. Stays the same forever. |
| `name`, `description`, `title`, `label` | Text or `{ "de": …, "en": … }` – the catalog requires both languages. |
| `version` | `1.2.3`. A higher version shows up as update in Hostwerk. |
| `icon` | Square SVG/PNG in the package – marketplace card and page header. |
| `page.icon` | **Sidebar icon** – a simple line icon like Hostwerk's own areas. One of: `puzzle users monitor gauge activity chart bell book bot box calendar camera clock cloud code coffee cpu database download file flag gamepad gift globe heart home image inbox key dashboard grid leaf line-chart list lock mail map message music network news package pie-chart radio rocket server settings shield cart sparkles star sun swords table tag terminal timer trophy tv wand wifi wrench zap`. |
| `sdkVersion` | The SDK the extension was written for, e.g. `"3.0"` – see [section 19](#19-sdk-30-stability-and-deprecations). |
| `hostwerk` | Minimum version, e.g. `>=3.0.0` – older Hostwerk refuses to install. Or `{ "min": "3.0.0", "max": "3.x" }` with a highest version. |
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

**Design scale (Hostwerk 2.11 and newer):** font sizes, radii, spacing and heights only exist as steps – exactly like in
Hostwerk itself. Always pick a step instead of an own number, then your extension keeps fitting after future design changes:

| What | Variables |
|---|---|
| Font | `--fs-2xs` 11 · `--fs-xs` 12 · `--fs-sm` 13 · `--fs-md` 14 · `--fs-lg` 16 · `--fs-xl` 20 · `--fs-2xl` 24 · `--fs-3xl` 28 px |
| Radius | `--r-xs` 4 · `--r-sm` 6 · `--r-md` 8 · `--r-lg` 10 · `--r-xl` 14 · `--r-2xl` 20 · `--r-pill` |
| Spacing | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 px |
| Height of buttons/fields | `--control-h` 34 · `--control-h-sm` 28 · `--control-h-xs` 24 px |
| Readable status colours for text | `--ok-text`, `--warn-text`, `--err-text` (the base colours `--ok` etc. are for areas and dots) |
| Main button, fields | `--accent-btn`, `--input-bg` |

All of them also exist with the `--hw-` prefix (e.g. `--hw-fs-sm`). The most important action of a page is a `btn primary`;
only Hostwerk's own "+ New" button carries the gradient.

**Accent colour (Hostwerk 2.12 and newer):** the user picks ONE accent colour (Settings → General) – or a profile
brings its own. Hostwerk derives a complete, readable palette from it, separately for light and dark (OKLCH, contrast
checked with the WCAG formula), and sends it to your extension live, also while the user is still choosing:

| Variable | Use | Guarantee |
|---|---|---|
| `--accent` | the chosen colour itself: borders, switches, selection dots | exactly what the user picked |
| `--accent-btn` | background of `btn primary` | white text on it ≥ 4.5:1 |
| `--accent-text` | links, icons and text in accent colour | ≥ 4.5:1 on every surface, also on `--accent-soft` |
| `--accent-soft` | subtle background (selected row, chip) | transparent tint |
| `--accent-contrast` | text placed directly on `--accent` | white or near-black, ≥ 4.5:1 |
| `--accent-ring` | focus outline | ≥ 3:1 on every surface |
| `--accent-2` | harmonious second colour (charts, prompts) | ≥ 3:1 on every surface |
| `--grad` | gradient for highlights | follows the accent |

**Never hard-code your brand colour for UI chrome** (buttons, links, focus, selection, tabs) – use `--accent*`. Then
your extension follows the user's colour and stays readable in both themes, even for yellow, cyan or grey. Your brand
colour belongs in your logo or icon only.

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
| `override:ui` | Replace or extend named places of Hostwerk’s interface – **high risk**: special review in the catalog, active only after the user agrees (official packages: right away), one click off (SDK 2.9, see section 17) |
| `extend:extensions` | Add tabs, actions, settings, texts or a page to other extensions – only as far as their author allows in `allowExtensions` (SDK 2.9) |
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
- Own server code (`backend`) from outside the Hostwerk catalogue runs in a **separate, sandboxed process**; certain areas (settings, passwords, keys, other extensions …) are never available, and secrets in answers are blacked out. Details: [Extensions explained](../docs/extensions.md).

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

## 15. SDK 2.7: look, dependencies and native extensions

**Look on the extension page.** Hostwerk shows every extension with its icon, a banner and its category.

| Field | Meaning |
|---|---|
| `category` | One of `games`, `network`, `security`, `monitoring`, `developer`, `ai`, `communication`, `other` – the chips on the extension page. |
| `color` | Accent colour `#rrggbb` for card and banner. |
| `banner` | Wide picture (SVG/PNG, about 1280×400) for the detail view and featured cards. |
| `screenshots` | Up to 6 pictures (`docs/screenshot.png` …) for the detail view. |

Animated icons and banners are welcome – but every animation has to stop under `@media (prefers-reduced-motion: reduce)`
(the check fails otherwise).

**Dependencies.** `"requires": { "game-servers": ">=1.0.0" }` – Hostwerk installs what is missing first (from the
catalogue), refuses circles and does not remove an extension others still need (unless the user forces it).
Ranges: `*`, `1.2.3`, `>=1.2.0`, `^1.2.0`, `~1.2.0`.

**Native extensions** run as part of Hostwerk – this is how features that used to be built in (password manager, game
servers, mail server, router …) became extensions. They need the permission `native` and bring:

- `backend`: `server/index.js` with `activate(host)` – own API routes (`host.router`, same sign-in as Hostwerk;
  `host.publicRouter` without), `host.provide(name, service)` for Hostwerk and other extensions, hooks
  `host.on('autostart' | 'shutdown' | 'upgrade')`, Hostwerk's building blocks `host.core(name)`, `host.service(name)`,
  `host.lib(name)`, texts `host.t(text, vars)`, `host.error(status, text)`, `host.broadcast(msg)`.
- `ui`: `ui/index.js`, built with `node sdk/build-native.js .` from `ui/src/index.jsx` (React, `@hostwerk/api`,
  `@hostwerk/ui`, `@hostwerk/kit`, `@hostwerk/i18n` …). Export `{ pages: { main }, slots: { … } }` – slots place
  tabs and buttons inside Hostwerk (`project.tabs`, `live.tabs`, `mc.connect`, `files.preview`, `mail.tabs`,
  `titlebar`, `machines.board`).
- Texts in the code are English; `locales/de.json` maps the English text to German (`$patterns` for texts with parts).
- Data stays where Hostwerk always kept it – removing the extension deletes nothing.

**Security updates for your own programs** (Hostwerk 2.11+, used since 2.13 by the mail server and game servers). If a
native extension brings a program with contact to the internet, it registers it with Hostwerk's security updates – then
patches arrive by themselves like for PHP and the databases, with a trial run and fallback (`keeper.attempt`), and show up
under *Settings → Updates* with their own switch:

```js
// server/index.js
exports.activate = (host) => {
  const pu = host.ctx.patchUpdates;               // missing before Hostwerk 2.11 – so check
  if (pu && typeof pu.register === 'function') {
    const off = pu.register('my-service', {      // id: a–z, 0–9, - (2–40 characters)
      labels: { de: 'Mein Dienst', en: 'My service' },
      items: () => [{ key: 'my-service', label: 'My service', version: '1.4.2' }],            // what is installed
      updates: async () => [{ key: 'my-service', label: 'My service', current: '1.4.2', latest: '1.4.3', target: rel }],
      plan: (u) => ({
        install: async () => { /* put the new version NEXT TO the old one */ },
        probe: async () => { /* check, throw on failure – e.g. trial run, restart running services */ },
        activate: async () => { /* only now remove the old version */ },
        discard: async () => { /* remove the new version, start services on the old one again */ },
      }),
    });
    host.on('shutdown', () => off());             // unregister on removal/update
  }
};
```

Hostwerk checks every 6 hours, installs only what the person did not exclude, remembers failed versions (self-maintenance
`patch-<key>`) and skips them until a newer one appears. Only offer patch versions of the same series – larger jumps are
the person's decision.

**Reading web server logs** (Hostwerk 2.12 and newer). `host.ctx.web.logFiles(inst)` names a web server's logs without
creating anything: `{ access, error, php, rotated: { access: [...], error: [...], php: [...] } }` – `rotated` are the
packed versions (`.log.gz`, newest first). The access log uses the **vcombined** format (Apache `%v:%p` first, nginx
`$server_name:$server_port`) with the duration at the end (Apache µs, nginx seconds); Caddy writes JSON with
`request.host`. That allows statistics per domain:

```js
const web = host.ctx.web;
for (const inst of web.list()) {
  const f = typeof web.logFiles === 'function' ? web.logFiles(inst) : null; // missing before 2.12
  if (f) count(f.access, f.rotated.access);
}
```

Since SDK 2.8, server code from outside the official catalogue runs **sandboxed** (see section 16); only official
packages (pinned by SHA-256) run as part of Hostwerk and may bring their own interface module.

## 16. SDK 2.8: built in like Hostwerk itself – and sandboxed

Everything in detail, with pictures: **[Extensions explained](../docs/extensions.md)**.

| Field | Effect |
|---|---|
| `page.nav` | `{ "group": "server" \| "develop" \| "system" \| "<own-area>", "groupTitle": { "de", "en" }, "after": "mc", "order": 0–100 }` – the page sits in that sidebar area like a built-in one. Hostwerk 2.11+: `system` = at the bottom next to AI and System; an own area with `groupTitle` (only shown while a page is in it – extensions with the same id share it); `after` = right after that entry. People can drag everything elsewhere or hide it. The old `extensions` is placed by category. |
| `settingsTab` | `general`, `start`, `notifications`, `advanced` or `extensions` – where the form from `settings` appears in Hostwerk's settings. |
| `contributes.tabs[].on` | also main areas: `area:system`, `area:backups`, `area:ai`, `area:dbs`, `area:minecraft`, `area:web`, `area:projects`, `area:mail`, `area:live`. |
| `contributes.new` | tiles in the “New” menu – they open the page with that action (`Hostwerk.on('action')`). |
| `synergies` | other extensions this one works well with (shown under *Ideas & synergies*). |
| `provides` / `uses` | services offered (`host.provide`) and used (`host.use`) – matching pairs are suggested automatically. |

**Own server code from any source.** A `backend` no longer needs the Hostwerk catalogue: everything else runs in a
**separate, sandboxed process** (Node permission model) – own package folder readable, own data folder writable, no
programs, no local network, no access to Hostwerk's settings or keys. Routes live under `/api/x/<id>/…`
(public: `/api/x/<id>/pub/…`); the page reaches them with `Hostwerk.backend(method, path, body)`. `host.api()`
asks Hostwerk with the extension's permissions; answers arrive with secrets blacked out. Own interface modules (`ui`)
stay reserved for official packages – others show their page in the frame.

### Keyboard shortcuts

Extensions can bring their own shortcuts. People see them in the shortcut overview (F1) and can change, switch off or
reset them under **Settings → General → Shortcuts**, together with Hostwerk's own.

```json
"contributes": {
  "shortcuts": [
    { "id": "open-logs", "title": { "en": "Open logs", "de": "Protokolle öffnen" }, "keys": "ctrl+alt+l", "action": "logs" }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | a–z, 0–9, `-`. Hostwerk registers it as `ext:<extension id>:<id>` – that is also the key in the user's settings. |
| `title` | Text in the overview and the settings (`{ "en", "de" }` or one string). |
| `keys` | One combination: modifiers `ctrl`, `alt`, `shift`, `meta` + one key (`a`–`z`, `0`–`9`, `f1`–`f24`, `enter`, `arrowup`, `,` …), e.g. `ctrl+alt+p`. Ctrl and ⌘ count as the same. Needs `ctrl` or `alt` – only F keys may stand alone. |
| `action` | What it does: the id of a page tab (opens it), of `contributes.actions` (runs it like from the search) or of `contributes.new`. Without `action` the shortcut opens the extension page. |

Rules: up to 20 shortcuts. Copy, paste, cut, select all, undo/redo, Alt+F4, Ctrl+W/Q/Tab and the like are reserved – the
check fails. An extension **never takes a shortcut away from Hostwerk**: if `keys` is one of Hostwerk's own (Ctrl+K,
Ctrl+N, Ctrl+1…9, F1 …), the check warns and the shortcut stays off until the user assigns it (settings show the
conflict with a “Use anyway” button). Two extensions with the same keys: the first one installed wins, the other is
shown as a conflict.

Native extensions (official packages with an interface module) can export shortcuts with code instead:
`export default { pages, slots, shortcuts: [{ id: 'quick-open', title: 'Open quickly', keys: 'ctrl+alt+o', run: () => … }] }`
– the title is English, German comes from `locales/de.json`.

### Language packs

Hostwerk itself maintains German and English. More languages come from extensions: list them in `manifest.json` → `"languages": [{ "id": "fr", "name": "Français", "file": "lang/fr.json" }]`. The file has the same shape as Hostwerk's `ui/src/i18n/en.json` – `{ "texts": { "<German text>": "<translation>" }, "patterns": [["text with {}", "translation with {}"]] }`. Users pick the language under Settings → General; whatever is missing appears in English. The checker validates the file and the placeholders.

## 17. SDK 2.9: themes, overrides and extending other extensions

Hostwerk 2.11 and newer. Three new ways to change Hostwerk – each with its own safety net – plus templates for all of
them. Start one in the **Extension Studio** (*New extension → Theme / Change Hostwerk / Extend another extension /
Tab in Hostwerk / With server part*) or from the template repositories:

| Template | Shows |
|---|---|
| `hostwerk-ext-template-theme` | Colours for light and dark, accent suggestions, rounding, density |
| `hostwerk-ext-template-override` | Replaces the overview greeting, adds a tip to the empty web server list |
| `hostwerk-ext-template-extend` | A tab, a header action and settings on another extension – with its author's consent |
| `hostwerk-ext-template-service-tab` | Tabs on service pages, right-click and quick search entries, a shortcut |
| `hostwerk-ext-template-backend` | Own server code, sandboxed in its own process, with a tested logic module |

### Themes (`contributes.themes`)

A theme is **not CSS**. It sets values for a fixed list of design variables; Hostwerk builds the stylesheet itself, so
nothing can be injected and nothing loads from the internet.

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

| Field | Rule |
|---|---|
| `tokens.dark` / `tokens.light` | Only `--bg`, `--bg-2`, `--surface`, `--surface-2`, `--surface-3`, `--line`, `--line-2`, `--text`, `--text-2`, `--muted`, `--ok`, `--ok-text`, `--warn`, `--warn-text`, `--err`, `--err-text`, `--info`, `--console-bg`, `--input-bg` (as `#rrggbb`), `--ok-soft` … `--info-soft` (also `rgba()`), `--shadow`, `--shadow-lg`. Missing ones keep Hostwerk's values. |
| `accent`, `accents` | Suggested accent (used while the user has none of their own) and up to 8 more suggestions. Hostwerk derives `--accent-text`, `--accent-btn`, `--accent-ring` … for **the theme's surfaces**, so they stay readable. |
| `radius` | 0 (square) … 1 (Hostwerk) … 2 (very round) – scales `--r-*`. |
| `density` | `compact`, `normal`, `comfortable` – scales `--sp-*` and control heights. |
| `fonts`, `font` | Font files in the package (`.woff2` preferred, max. 1.5 MB together). |

**Contrast check (WCAG 2.2 AA)** – in `check.js` *and* again right before Hostwerk applies a theme: every pair the theme
touches is calculated – `--text`, `--text-2`, `--muted`, `--ok-text`, `--warn-text`, `--err-text` ≥ 4.5:1 on all five
surfaces (and `--text` on `--input-bg`), `--ok`, `--warn`, `--err`, `--info` ≥ 3:1, the accent ≥ 3:1. Dark stays dark,
light stays light. A failing theme is listed (with the reason) but never applied.

People pick it under *Settings → General → Appearance → Theme*. Switching is instant (one style element, no re-render,
remembered for the next start), the accent picker shows the theme's suggestions, and removing the extension brings back
Hostwerk's own look.

### Overrides of Hostwerk's own interface (`contributes.overrides`)

Overrides replace or extend **named places** (slots) of Hostwerk's interface. A slot is a whole region – never a button
in every card – so an override runs once per page.

| Slot | Where | Modes |
|---|---|---|
| `dashboard.hero` | Greeting at the top of the overview | `replace`, `before`, `after` |
| `web.empty` | Empty web server list | `replace`, `after` |
| `dbs.empty` | Empty database server list | `replace`, `after` |
| `minecraft.empty` | Empty Minecraft server list | `replace`, `after` |

```json
"permissions": ["override:ui"],
"contributes": {
  "overrides": [
    { "id": "hero", "slot": "dashboard.hero", "mode": "replace", "title": { "de": "…", "en": "…" },
      "file": "overrides/hero.html", "preview": "docs/hero-preview.svg", "height": 160 }
  ]
}
```

The page runs sandboxed like every extension page (`Hostwerk.context = { kind: "override", slot, id }`, `Hostwerk.embed`
is `override`, transparent background, the frame grows up to `height`, max. 480 px). Official packages with an interface
module may export a component instead: `export default { overrides: { hero: ({ slot, props, Original }) => … } }`.

**Safety net**

- Permission **`override:ui`** (high risk) – listed before installing; without it Hostwerk delivers no override.
- **Consent with preview:** outside official packages nothing is active until the user agrees in the extension's detail
  view (*Look and allow …*). The dialog lists every place, how it changes it and the `preview` picture. *Look first*
  switches it on for this session only, with *Allow* / *Discard* right above the override. Consent is bound to the
  places: a new place or mode in an update asks again.
- **One click off:** every override carries “Changed by …” with *Switch override off*; the detail view can switch it back on.
- **Fallback to the original:** a crashing component or a page that does not report within 4 seconds is replaced by
  Hostwerk's original, with a note. Of several `replace` overrides only the first (official first, then `order`) is used.

**Special review (catalog).** `check.js` returns `review: ["override:ui"]` and runs extra checks on every override page
(errors): **performance** – page plus own scripts/styles ≤ 100 KB, no `setInterval` faster than one second;
**accessibility** – `<html lang>`, a name for every button, `alt` for every image, no `tabindex` above 0, no removed focus
outline; **translations** – every `data-i18n` key and `Hostwerk.t('key')` in both `locales`; **network** – no `fetch`,
`XMLHttpRequest`, `WebSocket`, `EventSource` or `sendBeacon` without the `network` permission. After that a person checks:

1. Does it serve the user (requirement clear, no advertising, no dark patterns, no hidden data collection)?
2. Does the original stay reachable (nothing important hidden, *Switch override off* not covered)?
3. Same look as Hostwerk: design kit classes, `var(--…)` colours, light and dark, phone width?
4. Keyboard and screen reader: order, focus visible, names, `prefers-reduced-motion`?
5. German and English complete and natural?
6. Only the permissions it needs; does the `preview` picture match what it does?
7. Does it still work when the slot is empty, the user is offline or the language changes?

### Extending other extensions (`contributes.extends`)

An extension may add to **another extension** – but only as far as that extension's author allows.

| Point | The add-on (`contributes.extends[]`) | The author of the target (`allowExtensions`) |
|---|---|---|
| `tabs` | `"tabs": [{ "id", "title", "file", "icon" }]` – tabs on its page | `"tabs"` |
| `actions` | `"actions": [{ "id", "title", "icon" }]` – buttons in its header that open the add-on's page | `"actions"` |
| `settings` | `"settings": true` – the add-on's settings inside its settings dialog | `"settings"` |
| `locales` | `"locales": { "de": "…json", "en": "…json" }` – rewords **existing** texts | `"locales"` (only by id) |
| `page` | `"page": { "file": "…html" }` – replaces its page (with *Show original*) | `"page"` (only by id) |

```json
// add-on
"permissions": ["extend:extensions"],
"contributes": { "extends": [{ "id": "my-extension", "version": ">=1.0.0", "tabs": [ … ], "actions": [ … ], "settings": true }] }
// target – written by ITS author
"allowExtensions": { "my-addon": ["tabs", "actions", "settings"], "*": ["tabs"] }
```

- **The original author has the rights.** Without an entry nothing appears; `"*"` can never grant `page` or `locales`.
  Removing an entry in a new version takes the permission back – the addition disappears by itself.
- **No permission escalation:** tabs, pages and actions of the add-on run with the **add-on's** permissions, not the target's.
- **Precedence:** own tabs and actions first, then those of add-ons (install order). If two add-ons may replace the page,
  the one the author names first in `allowExtensions` wins; the other is shown as a conflict. Text overlays only change
  keys the target already has. `version` keeps an addition off for versions the add-on was not made for.
- **Transparency:** the add-on's detail view shows “Extends *X* – with consent from *author*” (or “Waiting for permission
  from …”), the target's shows “Extended by …”; users can switch additions off.
- Native targets (official packages with an interface module) get `page`, `settings`, `locales` and since SDK 2.10 `tabs` (as a bar above
  their page); actions need a page frame.

## 18. SDK 2.10: events, notifications, controlling services and public views

Hostwerk 2.12 and newer. What the work on the official extensions missed in the core – now for everyone.

**For pages in a frame (`Hostwerk.*`)**

- `Hostwerk.services()` now knows all kinds: `web`, `db`, `minecraft`, `app`, **`docker`** (Docker apps) and **`game`**
  (game servers, `extra.game`, `extra.docker`) plus `mail`. `Hostwerk.service('game' | 'docker', id).restart()`.
- New permissions: `read:games` (game servers and players, no console/passwords), `change:ports` (move a stopped service
  to a free port, asks first), `read:system` also reads `GET /system/ports/free?port=8080` (`{ free, by, hostwerk }`),
  `control:services` also controls game servers.
- Filter the mail catcher: `GET /mail/messages?from=shop&to=…&subject=…&since=<ms>&until=<ms>&unread=1&limit=50`.
- Tabs per project: `contributes.tabs[].on: "project"` – `Hostwerk.context` is then `{ kind: 'project', id }`.

**Public view** (`publicView`, permission `share:view`) – e.g. an overlay for OBS:

```json
"permissions": ["share:view"], "backend": "server/index.js",
"publicView": { "file": "obs/index.html", "title": { "de": "Spieler-Overlay", "en": "Player overlay" } }
```

Reachable without login at `/v/<id>/`. Sandboxed (own origin), may run scripts and only fetches data from the public part
of its own server module (`fetch('/api/x/<id>/pub/…')` – answers come with CORS). The detail view shows the address to copy.

**For server modules (`host.*`)** – native and sandboxed unless noted:

| New | What for |
|---|---|
| `host.on('job' \| 'audit' \| 'service' \| 'git-pull' \| 'deploy-done' \| 'static-publish' \| 'mc-player-join' \| 'mc-player-leave' \| 'task-failed' \| 'backup-failed' \| 'incident', fn)` | Core events. Sandboxed only with `read:services` (players: `read:minecraft`), contents redacted. Returns an unsubscribe function. |
| `host.notifications.register('deploy-failed', { de, en }, { on: true })` · `host.notifications.notify('deploy-failed', { title, text, kind, url })` | Own occasion with its own switch under Settings → Notifications (desktop) and Live → Phone (push). |
| `host.storage.of('other-id')` | Read another extension's storage – only if its author shares it with `"shareStorage": ["your-id"]` (or `"*"`). Read only, secrets redacted. |
| `host.setNewEntries([{ id, title: { de, en }, description, icon }])` | Entries in the “New” menu at runtime (e.g. one per template) – open the page with `?action=<id>` like `contributes.new`. |
| `host.services.list()` · `host.services.control(kind, id, 'start' \| 'stop' \| 'restart', { via, device })` | *native:* services like `Hostwerk.services()` – control goes through Hostwerk's API and lands in the activity log. |
| `host.audit.registerVia('discord', { de: 'Discord', en: 'Discord' })` · `host.audit.as(via, device, fn)` | *native:* own way in the activity log (with its own alert switch, off by default) – e.g. “via Discord”. |
| `host.backups.register({ label, list(), restore(id), remove(id), offsite({ dir, job }) })` | *native:* own states in the backup center (restore, delete) and in the external backup (“Data from extensions”). |
| `host.core('platform').elevatedBatch([{ cmd, args }])` · `elevatedRead(cmd, args)` | *native:* several commands with ONE administrator prompt, output comes back. |
| `import { pl } from '@hostwerk/i18n'` | *native interface:* `pl(n, '{n} server', '{n} servers')` – German from `locales/de.json`. |
| `ctx.dns.acme = { create({ domain, name, value }), remove(…) }` | *native, service “dns”:* Hostwerk answers Let's Encrypt checks with a TXT record (dns-01) – wildcard certificates and no port 80 needed. |
| `users.login()` may return a promise | *native, service “users”:* password check asynchronous (scrypt doesn't block Hostwerk). |

**Pages in frames of official packages:** `Hostwerk.backend()` (`/api/x/<id>/…`) now also reaches official packages
running inside Hostwerk – at their `host.router` (used to be error 503). **Tabs of other extensions** also show on native
pages (bar “Added by …” above the page).

**Tiles of native extensions** (slot `dashboard.tiles`, since SDK 2.8):

```js
export default { slots: { 'dashboard.tiles': [{ id: 'disk', title: { de: 'Speicher', en: 'Storage' }, icon: 'gauge', size: 'third', Component: DiskTile }] } };
```

`size`: `third` · `half` · `full`. The tile shows up under “Dashboard → Customize” like a built-in one and can be shown
or hidden.

**Sandboxed extensions at a glance:** the detail view shows CPU, memory and restarts of the process; the memory limit
(default 256 MB) is adjustable (64–2048 MB). After three crashes in five minutes the extension stays off – the detail
view says why and offers “Restart”.

---

## 19. SDK 3.0: stability and deprecations

From Hostwerk 3.0 on, the core only gets fixes, security, accessibility and translations – new things come as
extensions. That only works if extensions keep running. So SDK 3.0 makes a promise:

- **Semantic versioning.** Everything SDK 3.0 documents (`window.Hostwerk`, manifest fields, permissions, `contributes`)
  works with **every Hostwerk 3.x**. Minor versions only add, patch versions only fix.
- **Nothing disappears within 3.x.** Something is removed only with a new major version (SDK 4.0) – and only after it was
  deprecated for **at least two minor versions and 12 months**. The check warns about everything deprecated, with the date
  and the replacement:
  `Old permissions "read"/"write" – … Deprecated since SDK 3.0.0 (2026-10-21); removed no earlier than SDK 4.0.0 and not before 2027-10-21.`
- **Experimental APIs are not part of the promise.** They can change in any version, you have to opt in, and they are
  not allowed in the catalog (like the “Proposed API” in VS Code):

  ```json
  "experimental": ["name-of-the-api"]
  ```

  At the moment there are no experimental APIs – the list is in `EXPERIMENTAL` in `check.js`.

### `sdkVersion` and `hostwerk.max`

```json
"sdkVersion": "3.0",
"hostwerk": { "min": "3.0.0", "max": "3.x" }
```

| Field | Meaning |
|---|---|
| `sdkVersion` | The SDK you wrote and tested the extension for (`major.minor`). Hostwerk with SDK 3.4 runs everything written for 3.0–3.4; an extension written for a newer SDK says “please update Hostwerk”. Written for 2.x: still runs (3.0 keeps everything from 2.x), the check gives a hint. |
| `hostwerk` | As before `">=3.0.0"` (minimum only) – or `{ "min": "3.0.0", "max": "3.x" }`. `max` is inclusive: `"3.x"` (every 3.x), `"3.4.x"` or an exact version. Use it only when you know a later version breaks your extension. |

New extensions from the studio, the AI draft and the templates get `sdkVersion` automatically. Without `sdkVersion` the
check only shows a hint – no points are deducted.

### SDK changelog

What changed in which SDK version, and what is deprecated: [SDK-CHANGELOG.md](SDK-CHANGELOG.md).
