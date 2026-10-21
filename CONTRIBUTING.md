# Contributing to Hostwerk

**English** · [Deutsch](CONTRIBUTING.de.md)

Thanks for wanting to help. Hostwerk is a one-person hobby project, free to use (see [LICENSE.md](LICENSE.md)).

## Feature freeze: the core is finished

Since **3.0**, Hostwerk grows **only through extensions**. The core takes:

| The core accepts | The core does not accept |
|---|---|
| Bug fixes | New features, new areas, new settings |
| Security fixes | Redesigns of existing pages |
| Accessibility (keyboard, screen readers, contrast) | New dependencies without a fix behind them |
| Translations and better wording | |
| Repairs of download sources and catalogs | |

**You have an idea for something new?** Build it as an extension – the [extension guide](sdk/README.md)
takes you from the first page to the catalog. If your extension needs something from Hostwerk that the SDK does not
offer yet (a new permission, an extension point), open an issue describing the extension and what is missing. New
interfaces start as **experimental** (opt-in, may change) and only become part of the stable SDK once they have proven
themselves – see [SDK 3.0: stability and deprecations](sdk/README.md#19-sdk-30-stability-and-deprecations).

Why so strict? Without a rule, “finished” never gets finished – and every new core feature is something that has to be
kept running for years without maintenance.

## Reporting a bug

- In Hostwerk: **System → Incidents → Crash reports → Report** opens a pre-filled issue. Paths, names and secrets are
  blacked out; you check the text before sending it.
- Otherwise open an issue in [hostwerk-public](https://github.com/Passimoritz/hostwerk-public/issues) with the
  Hostwerk version, your system and the steps to reproduce.
- **Security problems:** never as a public issue – see [SECURITY.md](SECURITY.md).

## Translations

German is the source language. English texts live in `ui/src/i18n/en.json` (`texts` for fixed texts, `patterns` with
`{}` for texts with values). Every visible German text needs an English entry – `node scripts/i18n-test.js` checks it.
Other languages come as language packs (extensions, see section 6 of the extension guide).

## Working on the core (bug fixes)

The core repository is not public at the moment – describe a fix in an issue (what, where, how to reproduce). This
section is for everyone with access.

```bash
npm install
npm start                       # build the interface and start Electron
npm run server                  # backend only, interface in the browser
```

Before a change is merged, these must stay green:

```bash
node scripts/imports-test.js && node scripts/hooks-test.js && node scripts/i18n-test.js
node scripts/css-orphans-test.js && node scripts/class-collision-test.js && node scripts/design-scale-test.js
node scripts/naming-test.js && node scripts/links-test.js && node scripts/ui-rules-test.js
```

plus the tests of the area you touched (`scripts/*-test.js`, listed in `scripts/test-all.js`). Every fix needs a test that
fails without it.

**Style:** comments in German, identifiers in English; same comment density as the surrounding code. In the interface:
explanations as ⓘ tooltip (`InfoTip`), not as paragraphs; design scale `var(--fs-*)`, `var(--r-*)`, `var(--sp-*)`, no
fixed colours; WCAG 2.2 AA (target size ≥ 24 px, contrast, every button has a name, everything works with the keyboard).

**Tests never touch real data:** servers in tests run with `HW_TEST=1` and a temporary base folder – never against
`~/Hostwerk`.

## Support

Which versions get fixes and what “maintenance mode” means: [SUPPORT.md](SUPPORT.md).
