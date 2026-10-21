# An Hostwerk mitarbeiten

[English](CONTRIBUTING.md) · **Deutsch**

Danke, dass du helfen willst. Hostwerk ist ein Hobbyprojekt einer einzelnen Person und kostenlos nutzbar (siehe
[LICENSE.de.md](LICENSE.de.md)).

## Feature-Freeze: Der Kern ist fertig

Seit **3.0** wächst Hostwerk **nur noch über Erweiterungen**. Der Kern nimmt an:

| Der Kern nimmt an | Der Kern nimmt nicht an |
|---|---|
| Fehlerbehebungen | Neue Funktionen, neue Bereiche, neue Einstellungen |
| Sicherheitskorrekturen | Umbauten bestehender Seiten |
| Barrierefreiheit (Tastatur, Bildschirmleser, Kontrast) | Neue Abhängigkeiten ohne Fehlerbehebung dahinter |
| Übersetzungen und bessere Formulierungen | |
| Reparaturen an Download-Quellen und Katalogen | |

**Du hast eine Idee für etwas Neues?** Bau es als Erweiterung – die [Erweiterungs-Anleitung](sdk/README.de.md)
führt dich von der ersten Seite bis in den Katalog. Braucht deine Erweiterung etwas von Hostwerk, das das SDK noch nicht
bietet (ein neues Recht, eine neue Andockstelle), leg ein Issue an: welche Erweiterung, und was fehlt. Neue
Schnittstellen starten **experimentell** (Opt-in, dürfen sich ändern) und kommen erst ins stabile SDK, wenn sie sich
bewährt haben – siehe [SDK 3.0: Stabilität und Abkündigungen](sdk/README.de.md#19-sdk-30-stabilität-und-abkündigungen).

Warum so streng? Ohne Regel wird „fertig“ nie fertig – und jede neue Kern-Funktion muss jahrelang ohne Wartung laufen.

## Einen Fehler melden

- In Hostwerk: **System → Vorfälle → Absturzberichte → Melden** öffnet ein vorausgefülltes Issue. Pfade, Namen und
  Geheimnisse sind geschwärzt; du prüfst den Text, bevor du ihn abschickst.
- Sonst ein Issue in [hostwerk-public](https://github.com/Passimoritz/hostwerk-public/issues) mit Hostwerk-Version,
  System und den Schritten, mit denen der Fehler auftritt.
- **Sicherheitsprobleme:** nie als öffentliches Issue – siehe [SECURITY.de.md](SECURITY.de.md).

## Übersetzungen

Deutsch ist die Ausgangssprache. Die englischen Texte stehen in `ui/src/i18n/en.json` (`texts` für feste Texte,
`patterns` mit `{}` für Texte mit Werten). Jeder sichtbare deutsche Text braucht einen englischen Eintrag –
`node scripts/i18n-test.js` prüft das. Weitere Sprachen kommen als Sprachpakete (Erweiterungen, Abschnitt 6 der
Erweiterungs-Anleitung).

## Am Kern arbeiten (Fehlerbehebungen)

Das Kern-Repository ist derzeit nicht öffentlich – beschreib eine Korrektur in einem Issue (was, wo, wie man es
auslöst). Dieser Abschnitt ist für alle mit Zugang.

```bash
npm install
npm start                       # Oberfläche bauen und Electron starten
npm run server                  # nur der Server, Oberfläche im Browser
```

Bevor eine Änderung übernommen wird, müssen diese grün bleiben:

```bash
node scripts/imports-test.js && node scripts/hooks-test.js && node scripts/i18n-test.js
node scripts/css-orphans-test.js && node scripts/class-collision-test.js && node scripts/design-scale-test.js
node scripts/naming-test.js && node scripts/links-test.js && node scripts/ui-rules-test.js
```

dazu die Tests des Bereichs, den du änderst (`scripts/*-test.js`, aufgelistet in `scripts/test-all.js`). Jede
Fehlerbehebung braucht einen Test, der ohne sie fehlschlägt.

**Stil:** Kommentare deutsch, Bezeichner englisch; so viele Kommentare wie im umgebenden Code. In der Oberfläche:
Erklärungen als ⓘ-Tooltip (`InfoTip`), nicht als Absatz; Design-Skala `var(--fs-*)`, `var(--r-*)`, `var(--sp-*)`, keine
festen Farben; WCAG 2.2 AA (Zielgröße ≥ 24 px, Kontrast, jeder Knopf hat einen Namen, alles geht mit der Tastatur).

**Tests fassen nie echte Daten an:** Server in Tests laufen mit `HW_TEST=1` und einem Temp-Basisordner – nie gegen
`~/Hostwerk`.

## Support

Welche Versionen Korrekturen bekommen und was „Wartungsmodus“ heißt: [SUPPORT.de.md](SUPPORT.de.md).
