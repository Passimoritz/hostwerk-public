# Sicherheit

## Sicherheitslücke melden

Bitte **kein** öffentliches Issue für Sicherheitsprobleme öffnen. Melde sie vertraulich über GitHub:

1. Den Reiter **Security** dieses Repositorys öffnen.
2. **Report a vulnerability** anklicken (GitHub *Private vulnerability reporting*).
3. Beschreiben, was du gefunden hast, wie man es nachstellt und mit welcher Hostwerk-Version.

Die Meldung sieht nur der Betreuer. Wenn du GitHub dafür nicht nutzen kannst, schreib das in ein normales Issue **ohne
Details** – du wirst dann kontaktiert.

## Wie es weitergeht

- Eingangsbestätigung: innerhalb von **7 Tagen**.
- Erste Einschätzung (ist es eine Lücke, wie schwer): innerhalb von **14 Tagen**.
- Behebung: so schnell wie möglich – kritische Probleme haben Vorrang vor allem anderen. Du erfährst, wann die
  korrigierte Version erscheint, und wirst auf Wunsch in den Versionshinweisen genannt.

Hostwerk ist ein Ein-Personen-Hobbyprojekt – die Zeiten sind Ziele, keine Garantien.

## Unterstützte Versionen

Sicherheitskorrekturen gibt es nur für die **neueste Version**. Hostwerk aktualisiert sich selbst (Einstellungen →
Updates); bitte automatische Updates eingeschaltet lassen. Ältere Versionen bekommen keine Korrekturen.

Erweiterungen aus dem Katalog pflegen ihre Autoren. Probleme in offiziellen Erweiterungen (`Passimoritz/hostwerk-ext-*`)
bitte genauso melden; bei Community-Erweiterungen den Autor ansprechen – bleibt ein ernstes Problem offen, wird die
Erweiterung aus dem Katalog entfernt.

## Wie Releases geschützt sind

Die Update-Informationen (`hostwerk-update.json`) und die Erweiterungs-Kataloge sind mit einem Ed25519-Schlüssel
signiert, der nicht auf GitHub liegt; Hostwerk prüft die Signatur und die SHA-256-Prüfsumme jeder geladenen Datei. Jedes
Release enthält außerdem eine Stückliste der Bestandteile (`hostwerk-<version>.cdx.json`, CycloneDX) und
GitHub-Herkunftsnachweise (Build-Attestierung).

## Nicht kommerziell

Hostwerk ist kostenlose Software. Es ist **nicht kommerziell und wird nicht monetarisiert** – kein Verkauf, kein
bezahlter Support, keine Werbung, keine Erhebung personenbezogener Daten. (Hintergrund: Der Cyber Resilience Act der EU erfasst
Produkte, die im Rahmen einer Geschäftstätigkeit auf dem Markt bereitgestellt werden; Software, die ohne jede
Geschäftstätigkeit verschenkt wird, fällt in der Regel nicht darunter. Dieser Satz hält das fest – er ist keine
Rechtsberatung.)
