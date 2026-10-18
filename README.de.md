# Hostwerk – öffentliche Dateien

[English](README.md) · **Deutsch**

Dieses Repository liefert, was Hostwerk-Installationen **ohne Zugangsdaten** abrufen:

| Ordner | Inhalt |
|---|---|
| **Releases** | Updates und Installationsdateien (gespiegelt vom Hauptprojekt) und die Erklärvideos (Release `videos`). |
| [`catalog/`](catalog) | KI-Modellkatalog, Projektvorlagen, Berater-Regeln, Passwort-Manager-Katalog und die Erweiterungs-Kataloge: `extensions.json` (offiziell, täglich aus den Erweiterungs-Repositorys gebaut), `community.json`, `verified.json`. |
| [`sdk/`](sdk) | **Erweiterungs-SDK** – `hostwerk-sdk.js`, Design-Baukasten, Manifest-Schema, `check.js` und die [Anleitung für Entwickler](sdk/README.de.md). |
| [`packages/`](packages) | Geprüfte Kopien der Community-Erweiterungen (per SHA-256 festgelegt). |
| `katalog/` | Alte Dateinamen für Hostwerk vor 2.9 – werden automatisch aktuell gehalten. |

## Eine Erweiterung bauen

Alles – Paket, SDK, Design-Baukasten, Übersetzungen, Rechte, Prüfen, Veröffentlichen und Verifizierung – steht in der
**[Anleitung für Entwickler](sdk/README.de.md)** ([English](sdk/README.md)).

![So läuft eine Erweiterung](sdk/img/architecture.svg)

Schnellstart: [hostwerk-ext-template](https://github.com/Passimoritz/hostwerk-ext-template) → *Use this template*.
Beispiele: [Spieler-Ticker](https://github.com/Passimoritz/hostwerk-ext-player-ticker) ·
[Status-Wand](https://github.com/Passimoritz/hostwerk-ext-status-wall).

## Erweiterung einreichen

1. In ein eigenes Repository legen und ein Release erstellen (die Vorlage macht das bei jedem Tag).
2. In Hostwerk: **Apps → Erweiterungen → Einreichen** – oder [Erweiterung einreichen](../../issues/new?template=extension.yml) öffnen.
3. Eine GitHub-Action führt `sdk/check.js --strict` aus (Manifest, Sicherheit, Design, Deutsch + Englisch):
   - **Seiten und Kacheln** (abgeschottet, ändern nur nach Rückfrage) werden sofort aufgenommen.
   - **Dienste** (starten Programme auf dem PC) prüft ein Mensch; aufgenommen mit dem Label *approved*.
4. Hostwerk zeigt sie im Marktplatz unter **Community** – per Prüfsumme festgelegt, installiert wird genau die geprüfte Datei.

Updates: erneut einreichen mit höherer Version. Eine Kennung gehört dem, der sie zuerst eingereicht hat.
Paket testen ohne Einreichen: *Actions → Add extension → Run workflow* (Probelauf).

## Abzeichen im Marktplatz

![Vertrauensstufen](sdk/img/trust.svg)

| Abzeichen | Bedeutung |
|---|---|
| **Offiziell** | Von Hostwerk – eigenes Repository, in `catalog/extensions.json`. |
| **Verifizierter Entwickler** | Das Projekt hat die Person verifiziert (`catalog/verified.json`). Jedes Paket wird trotzdem geprüft und festgelegt. |
| **Von Hand geprüft** | Zusätzlich von einem Menschen angesehen – Pflicht für Dienste. |
| **Automatisch geprüft** | Automatische Prüfung bestanden, läuft abgeschottet. |
| **Fremde Quelle** | Aus einer selbst eingetragenen Quelle – nur beim Installieren geprüft. |

## Verifizierter Entwickler werden

1. Mindestens eine Erweiterung im Community-Katalog haben.
2. [Verifizierung beantragen](../../issues/new?template=verification.yml) – wer du bist und welche Erweiterungen von dir sind.
3. Eine Action bestätigt, dass die Erweiterungen von deinem Konto eingereicht wurden.
4. Das Projekt sieht sich den Antrag an und setzt das Label **verified** – damit stehst du in `catalog/verified.json`,
   und alle deine Erweiterungen tragen das Abzeichen. Wer gegen die Regeln verstößt (versteckter Code, Datensammeln
   ohne Hinweis), verliert es wieder.
