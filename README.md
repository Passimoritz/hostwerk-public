# Hostwerk – öffentliche Dateien

Dieses Repository liefert, was Hostwerk-Installationen **ohne Zugangsdaten** abrufen:

- **Releases** – Updates der App und die Installationsdateien (gespiegelt vom Hauptprojekt). Fürs Handy gibt es die Web-App direkt aus Hostwerk.
- **`katalog/`** – KI-Modellkatalog, Hostwerk-Erweiterungen und der **Community-Katalog** (`community.json`).
- **`pakete/`** – geprüfte Kopien der Community-Erweiterungen.

## Eigene Erweiterung einreichen

1. In Hostwerk unter **Apps → Erweiterungen → Marktplatz** eine Erweiterung bauen (oder „Eigene bauen“).
2. Bei der Erweiterung **„Einreichen“** tippen – das öffnet hier ein vorausgefülltes Formular.
3. Eine GitHub-Action prüft das Paket: Aufbau, Größe (bis 10 MB), keine ausführbaren Dateien.
   - **Reine Seiten** (laufen in Hostwerk abgeschottet, ändern nur nach Rückfrage) werden sofort aufgenommen.
   - **Dienste** (starten Programme auf dem PC) werden von Hand geprüft und mit dem Label „freigegeben“ aufgenommen.
4. Hostwerk zeigt die Erweiterung danach im Marktplatz unter der Quelle „Community“ – mit Prüfsumme, sodass genau das geprüfte Paket installiert wird.

Updates: einfach erneut einreichen (gleiche Kennung, höhere Version). Eine Kennung gehört dem, der sie zuerst eingereicht hat.

## Abzeichen im Marktplatz

| Abzeichen | Bedeutung |
|---|---|
| **Offiziell** | Von Hostwerk selbst – mitgeliefert oder aus `katalog/erweiterungen.json`. |
| **Verifizierter Entwickler** | Von jemandem, den das Projekt persönlich verifiziert hat (`katalog/verifiziert.json`). Jedes Paket wird trotzdem automatisch geprüft und per Prüfsumme festgelegt. |
| **Von Hand geprüft** | Automatisch geprüft und zusätzlich von einem Menschen angesehen – Pflicht für Erweiterungen mit Dienst. |
| **Automatisch geprüft** | Aufbau, Größe und Inhalt automatisch geprüft (reine Seiten, laufen abgeschottet). |
| **Fremde Quelle** | Aus einer eigenen Quelle, die jemand in Hostwerk eingetragen hat – nicht geprüft. |

## Verifizierter Entwickler werden

1. Mindestens eine Erweiterung muss schon im Community-Katalog stehen (Abschnitt oben).
2. Ein Issue mit dem Formular **„Als Entwickler verifizieren lassen“** öffnen – kurz, wer du bist, und welche Erweiterungen von dir sind.
3. Eine Action prüft, ob die genannten Erweiterungen wirklich von deinem Konto eingereicht wurden.
4. Das Projekt schaut sich den Antrag an und setzt das Label **„verifiziert“** – damit stehst du in `katalog/verifiziert.json`, und alle deine Erweiterungen tragen das Abzeichen.

Verstößt eine Erweiterung gegen die Regeln (versteckter Code, Datensammeln ohne Hinweis), wird das Abzeichen entzogen.
