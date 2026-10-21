# SDK changelog

What changed in the Hostwerk extension SDK (`window.Hostwerk`, `manifest.json`, permissions, `contributes`, `check.js`).
Since 3.0 the SDK follows semantic versioning – see [section 19 of the guide](README.md#19-sdk-30-stability-and-deprecations).

**English** · Kurz auf Deutsch steht jeder Eintrag darunter.

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
