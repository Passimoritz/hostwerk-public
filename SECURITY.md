# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Report them privately via GitHub:

1. Open the **Security** tab of this repository.
2. Click **Report a vulnerability** (GitHub *Private vulnerability reporting*).
3. Describe what you found, how to reproduce it and which Hostwerk version you used.

Only the maintainer sees the report. If you cannot use GitHub, mention that in a regular issue **without details** and
you will be contacted.

## What happens next

- Confirmation of receipt: within **7 days**.
- First assessment (is it a vulnerability, how severe): within **14 days**.
- Fix: as soon as possible – critical problems take priority over everything else. You will be told when the fixed
  version is out and, if you want, credited in the release notes.

This is a one-person hobby project, so the times are goals, not guarantees.

## Supported versions

Security fixes are released for the **latest version** only. Hostwerk updates itself (Settings → Updates); please keep
automatic updates switched on. Older versions do not receive fixes.

Extensions from the catalog are maintained by their authors. Report problems in an official extension
(`Passimoritz/hostwerk-ext-*`) the same way; for community extensions, contact their author – the extension will be
removed from the catalog if a serious problem remains unfixed.

## How releases are protected

Update information (`hostwerk-update.json`) and the extension catalogs are signed with an Ed25519 key that is not stored
on GitHub; Hostwerk checks the signature and the SHA-256 checksum of every downloaded file. Each release also contains a
software bill of materials (`hostwerk-<version>.cdx.json`, CycloneDX) and GitHub build provenance attestations.

## Non-commercial

Hostwerk is free software provided without charge. It is **non-commercial and not monetized** – no sales, no paid
support, no advertising, no collection of personal data. (Background: the EU Cyber Resilience Act covers products made
available on the market in the course of a commercial activity; software given away without any commercial activity is
generally outside its scope. This statement documents that – it is not a legal opinion.)
