<p align="right"><b>English</b> · <a href="README.de.md">Deutsch</a></p>

<p align="center"><img src="img/banner-en.svg" alt="Hostwerk – the local server hub for Windows and Linux" width="100%"></p>

<p align="center">
  <b>The local server hub for Windows and Linux</b><br>
  Web servers, databases, mail, Minecraft and game servers and an AI assistant – in one app, from your first project to going live.
</p>

<p align="center"><img src="img/dashboard-en.png" alt="Hostwerk overview with web servers, databases, Minecraft and the mail catcher" width="100%"></p>

## What Hostwerk does

- **Everything local, in one interface** – install, start and watch Apache, nginx, Caddy, PHP 7.4–8.5, MariaDB, MySQL, PostgreSQL, MongoDB, Redis, a mail catcher, apps, Docker and Minecraft servers – without editing config files by hand.
- **Several versions side by side** – as many web and database servers as you like, every project with its own PHP version.
- **AI assistant with tools** – looks into services, logs and databases itself and only changes things after you confirm. Runs locally if you want.
- **Ready to go live** – a guide takes you to the internet step by step: real domains with HTTPS, system service, remote access with two-factor, alerts and off-site backup.
- **Extensions** – Hostwerk stays lean: features only some people need (password manager, game servers, mail server, router, several machines …) come as extensions from the official catalogue – with all your data.
- **Moving made easy** – takes over existing web servers, databases and Minecraft servers (e.g. from XAMPP), tested and with a way back.

| Minecraft servers | Database Studio |
|---|---|
| ![Minecraft servers](img/minecraft-en.png) | ![Database Studio](img/database-en.png) |

| AI assistant | Game servers |
|---|---|
| ![AI assistant with tool steps](img/ai-assistant-en.svg) | ![Game servers](img/games-en.png) |

<p align="center"><img src="img/going-live-en.svg" alt="Going live step by step" width="100%"></p>

## This repository

Hostwerk itself is developed in a private repository. This public one holds what every Hostwerk installation fetches
**without credentials**:

| Folder | Contents |
|---|---|
| **Releases** | Installers and app updates (mirrored from the main project) and the explainer videos (release `videos`). |
| [`catalog/`](catalog) | AI model catalogue, project templates, advisor rules, password-manager catalogue and the extension catalogues: `extensions.json` (official, built daily from the extension repositories), `community.json`, `verified.json`. |
| [`docs/`](docs) | **[Extensions explained](docs/extensions.md)** – what each permission allows, how Hostwerk sandboxes extensions, where they show up, synergies and templates (with pictures). |
| [`sdk/`](sdk) | **Extension SDK 2.8** – `hostwerk-sdk.js`, design kit, manifest schema, `check.js`, `build-native.js` and the [developer guide](sdk/README.md). |
| [`packages/`](packages) | Checked copies of community extensions (pinned by SHA-256). |
| `katalog/` | Old file names for Hostwerk versions before 2.9 – kept up to date automatically. |

## Extensions

> **New in 2.11:** extensions fit in like built-in features (sidebar, settings, tabs, “New” menu) and everything that is not from the Hostwerk catalog runs **sandboxed**. All details with pictures: **[docs/extensions.md](docs/extensions.md)** · [Deutsch](docs/erweiterungen.md)

Everything lives in one place: **Extensions** in the sidebar – your installed extensions by category, the catalogue
under *Discover*, and tools for developers. Extensions can depend on each other; Hostwerk installs what is needed and
warns before you remove something that is still in use.

| My extensions | Discover |
|---|---|
| ![My extensions](img/extensions-en.png) | ![Discover](img/discover-en.png) |

### Official extensions

**Games & Minecraft**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-bedrock-bridge/main/icon.svg" width="28" height="28" alt=""> | [Bedrock bridge](https://github.com/Passimoritz/hostwerk-ext-bedrock-bridge) · *part of Hostwerk* | Friends on phones, consoles and the Windows edition play on your Java servers |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-game-network/main/icon.svg" width="28" height="28" alt=""> | [Game server network](https://github.com/Passimoritz/hostwerk-ext-game-network) · *part of Hostwerk* | Game and Minecraft servers as one network |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-game-servers/main/icon.svg" width="28" height="28" alt=""> | [Game servers](https://github.com/Passimoritz/hostwerk-ext-game-servers) · *part of Hostwerk* | Valheim, Palworld, Rust, Terraria, Satisfactory and more than 100 other games through LinuxGSM – natively on Linux, as Docker containers on Windows |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-motd-studio/main/icon.svg" width="28" height="28" alt=""> | [MOTD studio](https://github.com/Passimoritz/hostwerk-ext-motd-studio) | Design your Minecraft server's description in the server list with colours and formats |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-player-leaderboard/main/icon.svg" width="28" height="28" alt=""> | [Player leaderboard](https://github.com/Passimoritz/hostwerk-ext-player-leaderboard) | Who plays, mines or dies the most |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-player-ticker/main/icon.svg" width="28" height="28" alt=""> | [Player Ticker](https://github.com/Passimoritz/hostwerk-ext-player-ticker) | Who is on your Minecraft servers right now? Live list with heads, TPS and a playtime ranking |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-schematics-3d/main/icon.svg" width="28" height="28" alt=""> | [Schematics in 3D](https://github.com/Passimoritz/hostwerk-ext-schematics-3d) · *part of Hostwerk* | Look at Minecraft builds in 3D before you place them |

**Network & machines**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-hostwerk-network/main/icon.svg" width="28" height="28" alt=""> | [Hostwerk network](https://github.com/Passimoritz/hostwerk-ext-hostwerk-network) · *part of Hostwerk* | Several machines as one network |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-port-map/main/icon.svg" width="28" height="28" alt=""> | [Port map](https://github.com/Passimoritz/hostwerk-ext-port-map) | All ports of your services in one list |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-router/main/icon.svg" width="28" height="28" alt=""> | [Router & port forwarding](https://github.com/Passimoritz/hostwerk-ext-router) · *part of Hostwerk* | Makes your servers reachable from the internet |

**Security & access**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-cert-watch/main/icon.svg" width="28" height="28" alt=""> | [Certificate watch](https://github.com/Passimoritz/hostwerk-ext-cert-watch) | All certificates at a glance |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-passwords/main/icon.svg" width="28" height="28" alt=""> | [Password manager](https://github.com/Passimoritz/hostwerk-ext-passwords) · *part of Hostwerk* | Own encrypted vault or Bitwarden/Vaultwarden, 1Password, KeePass, pass and LastPass |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-team/main/icon.svg" width="28" height="28" alt=""> | [Team & roles](https://github.com/Passimoritz/hostwerk-ext-team) · *part of Hostwerk* | Friends and colleagues with their own sign-in for remote access |

**Monitoring & status**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-backup-calendar/main/icon.svg" width="28" height="28" alt=""> | [Backup calendar](https://github.com/Passimoritz/hostwerk-ext-backup-calendar) | All scheduled backups of the coming days as a calendar |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-server-card/main/icon.svg" width="28" height="28" alt=""> | [Server profile](https://github.com/Passimoritz/hostwerk-ext-server-card) | Everything important about this PC and its services on one page |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-status-wall/main/icon.svg" width="28" height="28" alt=""> | [Status Wall](https://github.com/Passimoritz/hostwerk-ext-status-wall) | All services big and colourful at a glance |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-disk-usage/main/icon.svg" width="28" height="28" alt=""> | [Storage per service](https://github.com/Passimoritz/hostwerk-ext-disk-usage) | How much space each service takes |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-uptime-wall/main/icon.svg" width="28" height="28" alt=""> | [Uptime wall](https://github.com/Passimoritz/hostwerk-ext-uptime-wall) | All uptime checks big and colourful |

**Developer tools**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-profiler/main/icon.svg" width="28" height="28" alt=""> | [Profiler](https://github.com/Passimoritz/hostwerk-ext-profiler) · *part of Hostwerk* | Finds out why a page or app is slow |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-quick-tasks/main/icon.svg" width="28" height="28" alt=""> | [Quick tasks](https://github.com/Passimoritz/hostwerk-ext-quick-tasks) | Your tasks as big buttons |

**AI & media**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-claude/main/icon.svg" width="28" height="28" alt=""> | [AI Connect](https://github.com/Passimoritz/hostwerk-ext-claude) | Connect your AIs with Hostwerk |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-ai-media/main/icon.svg" width="28" height="28" alt=""> | [Image & video studio](https://github.com/Passimoritz/hostwerk-ext-ai-media) · *part of Hostwerk* | Create pictures and short videos from a description |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-knowledge-graph/main/icon.svg" width="28" height="28" alt=""> | [Knowledge graph](https://github.com/Passimoritz/hostwerk-ext-knowledge-graph) | Turns your projects (code, docs, Obsidian notes) into a searchable knowledge graph |

**Mail & communication**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-discord-status/main/icon.svg" width="28" height="28" alt=""> | [Discord status](https://github.com/Passimoritz/hostwerk-ext-discord-status) · *part of Hostwerk* | Shows “Playing Hostwerk” in your Discord profile |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-mail-server/main/icon.svg" width="28" height="28" alt=""> | [Mail server](https://github.com/Passimoritz/hostwerk-ext-mail-server) · *part of Hostwerk* | Real mailboxes with your own domain |
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-mail-stats/main/icon.svg" width="28" height="28" alt=""> | [Mail statistics](https://github.com/Passimoritz/hostwerk-ext-mail-stats) | How many e-mails your projects send |

**Other**

| &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Extension | What it does |
|---|---|---|
| <img src="https://raw.githubusercontent.com/Passimoritz/hostwerk-ext-service-notes/main/icon.svg" width="28" height="28" alt=""> | [Service notes](https://github.com/Passimoritz/hostwerk-ext-service-notes) | Notes and checklists for every service |

*Part of Hostwerk* = native extension: used to be built in, runs as part of Hostwerk and therefore only comes from this
catalogue (pinned by checksum). If you used the feature before, the update installs it for you – with all data.

## Build an extension

Everything – package, SDK, design kit, translations, permissions, dependencies, native extensions, checking, releasing
and getting verified – is in the **[developer guide](sdk/README.md)** ([Deutsch](sdk/README.de.md)).

![How an extension runs](sdk/img/architecture.svg)

Quick start: [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) → *Use this template*.

## Submit an extension

1. Put it in its own repository and create a release (the template does this on every tag).
2. In Hostwerk: **Extensions → For developers → Submit** – or open [Submit an extension](../../issues/new?template=extension.yml).
3. A GitHub Action runs `sdk/check.js --strict` (manifest, security, design, German + English):
   - **Pages and tiles** (sandboxed, change things only after asking) are added at once.
   - **Services** (start programs on the PC) are reviewed by a person and added with the label *approved*.
4. Hostwerk shows it under **Discover** – pinned by checksum, so exactly the checked file is installed.

Updates: submit again with a higher version. An id belongs to whoever submitted it first.
Test a package without submitting: *Actions → Add extension → Run workflow* (dry run).

## Badges

![Trust levels](sdk/img/trust.svg)

| Badge | Meaning |
|---|---|
| **Official** | By Hostwerk – own repository, in `catalog/extensions.json`. |
| **Part of Hostwerk** | Official extension with its own server and interface code (used to be built in) – only from this catalogue. |
| **Verified developer** | The project has verified the person (`catalog/verified.json`). Every package is still checked and pinned. |
| **Reviewed** | Additionally looked at by a person – required for services. |
| **Checked** | Passed the automatic check, runs sandboxed. |
| **External** | From a source the user added – checked on install only. |

## Get verified as a developer

1. Have at least one extension in the community catalogue.
2. Open [Get verified](../../issues/new?template=verification.yml) – who you are and which extensions are yours.
3. An action confirms the extensions were submitted by your account.
4. The project looks at the request and sets the label **verified** – you are added to `catalog/verified.json`, and
   all your extensions carry the badge. Breaking the rules (hidden code, collecting data without saying so) revokes it.
