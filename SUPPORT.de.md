# Support

[English](SUPPORT.md) · **Deutsch**

Hostwerk ist ein Hobbyprojekt einer einzelnen Person. Die Zeiten unten sind Ziele, keine Zusagen – die Regeln aber stehen fest.

## Welche Version bekommt Korrekturen?

| Version | Stand |
|---|---|
| **3.x – neueste Minor-Version** | Fehlerbehebungen, Sicherheit, Barrierefreiheit, Übersetzungen, reparierte Download-Quellen |
| Ältere 3.x | Keine eigenen Korrekturen – Hostwerk aktualisiert sich selbst auf die neueste 3.x (Einstellungen → App-Updates) |
| 2.x und älter | Keine Korrekturen mehr. Der Updater funktioniert weiter, 3.x kommt also mit einem Klick |

Innerhalb von 3.x ist jedes Update gefahrlos: Erweiterungen für SDK 3.0 laufen weiter
([Stabilitätsversprechen](sdk/README.de.md#19-sdk-30-stabilität-und-abkündigungen)), und jedes Update lässt
sich unter *Einstellungen → App-Updates → Zurück zur vorherigen Version* rückgängig machen.

**Update-Kanäle:** „Stabil“ bekommt fertige Versionen, schrittweise verteilt (erst an wenige Installationen, dann an
alle). „Vorab“ bekommt Testversionen sofort. Korrekturen für die neueste Version erscheinen in beiden Kanälen.

## Was „Wartungsmodus“ heißt

3.x ist im Wartungsmodus: keine neuen Funktionen im Kern (siehe [CONTRIBUTING.de.md](CONTRIBUTING.de.md)), nur

- **Sicherheit** – geht immer vor,
- **Quellen-Reparatur** – wenn sich eine Download-Adresse, ein Katalog oder eine Schnittstelle eines anderen Projekts ändert,
- Fehlerbehebungen, Barrierefreiheit und Übersetzungen.

Das meiste „am Laufen halten“ passiert ohne neue Hostwerk-Version: Hostwerk repariert seine Quellen, rotiert Protokolle,
erneuert Zertifikate, aktualisiert Erweiterungen mit Probelauf und meldet das Lebensende von PHP, Datenbanken und
Laufzeiten selbst (System → Selbstwartung). Ein monatlicher Testlauf spielt bis zu zehn Jahre ohne Wartung durch.

## Falls das Projekt endet

Niemand kann „für immer“ versprechen. Wird Hostwerk eines Tages nicht mehr gepflegt:

- **Das letzte Release bleibt herunterladbar** auf GitHub ([Releases von hostwerk-public](https://github.com/Passimoritz/hostwerk-public/releases)) – mit Prüfsummen und Signatur.
- **Der Updater sagt es dir:** Das letzte Release ist als endgültig markiert; Hostwerk zeigt dann „Das ist die letzte
  Version – es kommen keine weiteren Updates“, statt still weiterzusuchen.
- **Deine Daten bleiben deine:** Alles liegt in deinem Hostwerk-Ordner in gewöhnlichen Formaten (Datenbanken,
  Webprojekte, Minecraft-Welten, Sicherungen als ZIP). Nichts hängt an einem Server des Projekts.
- Erweiterungen laufen mit deiner Version weiter; ihr Quellcode liegt in eigenen Repositorys.

## Wo es Hilfe gibt

- **In der App:** Jede Fehlermeldung hat „Warum?“ mit Schritten zur Lösung; der KI-Helfer kann selbst in Protokolle und Dienste schauen.
- **Handbuch:** [handbuch/de](https://github.com/Passimoritz/hostwerk-public/blob/main/handbuch/de/README.md)
- **Fehler:** Issues in [hostwerk-public](https://github.com/Passimoritz/hostwerk-public/issues) – oder *System → Vorfälle → Melden*.
- **Sicherheit:** [SECURITY.de.md](SECURITY.de.md) (vertraulich, nie als öffentliches Issue).
- **Erweiterungen:** Probleme mit einer Community-Erweiterung gehen an ihren Autor; offizielle Erweiterungen (`hostwerk-ext-*`) wie Hostwerk selbst.
