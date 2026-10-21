# Support

**English** · [Deutsch](SUPPORT.de.md)

Hostwerk is a one-person hobby project. The times below are goals, not guarantees – but the rules are fixed.

## Which version gets fixes?

| Version | Status |
|---|---|
| **3.x – latest minor** | Fixes, security, accessibility, translations, repaired download sources |
| Older 3.x | No separate fixes – Hostwerk updates itself to the latest 3.x (Settings → App updates) |
| 2.x and older | No more fixes. The updater keeps working, so you get 3.x with one click |

Within 3.x every update is safe to install: extensions written for SDK 3.0 keep running
([stability promise](sdk/README.md#19-sdk-30-stability-and-deprecations)), and every update can be undone
under *Settings → App updates → Back to the previous version*.

**Update channels:** “Stable” gets finished versions, rolled out step by step (first to a few installations, then to
all). “Preview” gets test versions right away. Fixes for the latest version are released on both channels.

## What “maintenance mode” means

3.x is in maintenance mode: no new features in the core (see [CONTRIBUTING.md](CONTRIBUTING.md)), only

- **security** fixes – these always come first,
- **source repairs** – when a download address, a catalog or an interface of another project changes,
- bug fixes, accessibility and translations.

Most of the “keeping it running” happens without a new Hostwerk version: Hostwerk repairs its sources, rotates logs,
renews certificates, updates extensions with a test run and reports end-of-life of PHP, databases and runtimes by itself
(System → Self-maintenance). A monthly test run simulates up to ten years without maintenance.

## If the project ends

Nobody can promise forever. If Hostwerk is ever no longer maintained:

- **The last release stays downloadable** on GitHub ([hostwerk-public releases](https://github.com/Passimoritz/hostwerk-public/releases)) – with checksums and signature.
- **The updater says so:** the last release is marked as final; Hostwerk then shows “This is the last version – no
  further updates will come” instead of searching silently.
- **Your data stays yours:** everything lives in your Hostwerk folder in normal formats (databases, web projects,
  Minecraft worlds, backups as ZIP). Nothing depends on a server of the project.
- Extensions keep working with the version you have; their source code is in their own repositories.

## Where to get help

- **In the app:** every error message has “Why?” with steps to fix it; the AI assistant can look into logs and services.
- **Manual:** [handbuch/en](https://github.com/Passimoritz/hostwerk-public/blob/main/handbuch/en/README.md)
- **Bugs:** issues in [hostwerk-public](https://github.com/Passimoritz/hostwerk-public/issues) – or *System → Incidents → Report*.
- **Security:** [SECURITY.md](SECURITY.md) (privately, never as a public issue).
- **Extensions:** problems with a community extension go to its author; official extensions (`hostwerk-ext-*`) like
  Hostwerk itself.
