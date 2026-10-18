# Hostwerk – public files

**English** · [Deutsch](README.de.md)

This repository holds what Hostwerk installations fetch **without credentials**:

| Folder | Contents |
|---|---|
| **Releases** | App updates and installers (mirrored from the main project) and the explainer videos (release `videos`). |
| [`catalog/`](catalog) | AI model catalog, project templates, advisor rules, password-manager catalog and the extension catalogs: `extensions.json` (official, built daily from the extension repositories), `community.json`, `verified.json`. |
| [`sdk/`](sdk) | **Extension SDK** – `hostwerk-sdk.js`, design kit, manifest schema, `check.js` and the [developer guide](sdk/README.md). |
| [`packages/`](packages) | Checked copies of community extensions (pinned by SHA-256). |
| `katalog/` | Old file names for Hostwerk versions before 2.9 – kept up to date automatically. |

## Build an extension

Everything – package, SDK, design kit, translations, permissions, checking, releasing and getting verified – is in
the **[developer guide](sdk/README.md)** ([Deutsch](sdk/README.de.md)).

![How an extension runs](sdk/img/architecture.svg)

Quick start: [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) → *Use this template*.
Examples: [Player Ticker](https://github.com/Passimoritz/hostwerk-ext-player-ticker) ·
[Status Wall](https://github.com/Passimoritz/hostwerk-ext-status-wall).

## Submit an extension

1. Put it in its own repository and create a release (the template does this on every tag).
2. In Hostwerk: **Apps → Extensions → Submit** – or open [Submit an extension](../../issues/new?template=extension.yml).
3. A GitHub Action runs `sdk/check.js --strict` (manifest, security, design, German + English):
   - **Pages and tiles** (sandboxed, change things only after asking) are added at once.
   - **Services** (start programs on the PC) are reviewed by a person and added with the label *approved*.
4. Hostwerk shows it in the marketplace under **Community** – pinned by checksum, so exactly the checked file is installed.

Updates: submit again with a higher version. An id belongs to whoever submitted it first.
Test a package without submitting: *Actions → Add extension → Run workflow* (dry run).

## Badges in the marketplace

![Trust levels](sdk/img/trust.svg)

| Badge | Meaning |
|---|---|
| **Official** | By Hostwerk – own repository, in `catalog/extensions.json`. |
| **Verified developer** | The project has verified the person (`catalog/verified.json`). Every package is still checked and pinned. |
| **Reviewed** | Additionally looked at by a person – required for services. |
| **Checked** | Passed the automatic check, runs sandboxed. |
| **External** | From a source the user added – checked on install only. |

## Get verified as a developer

1. Have at least one extension in the community catalog.
2. Open [Get verified](../../issues/new?template=verification.yml) – who you are and which extensions are yours.
3. An action confirms the extensions were submitted by your account.
4. The project looks at the request and sets the label **verified** – you are added to `catalog/verified.json`, and
   all your extensions carry the badge. Breaking the rules (hidden code, collecting data without saying so) revokes it.
