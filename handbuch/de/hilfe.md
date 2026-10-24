# Hilfe & bekannte Probleme

[← Zurück zur Übersicht](README.md)

Wenn etwas nicht klappt, steht die Lösung meist hier. Hilft nichts davon: unter **System → Zustand → Vorfälle** öffnet „Fehlerbericht“ einen vorausgefüllten Bericht – ohne Pfade, Namen und Geheimnisse, du schickst ihn selbst ab.

## Windows blockiert Hostwerk (Smart App Control)

Unter Windows 11 kann **Smart App Control** Programme ohne bekannte Signatur sperren. Das betrifft das Setup (`Hostwerk-Setup-….exe`), nicht Hostwerk selbst.

- Nimm die **ZIP-Fassung**, entpacke sie z. B. nach `%LOCALAPPDATA%\Programs\Hostwerk` und starte `Hostwerk.exe`. Beim ersten Start legt Hostwerk Verknüpfungen und den Eintrag unter „Apps“ an.
- `Hostwerk.exe` ist die unveränderte, offizielle Electron-Laufzeit. Deshalb steht im Task-Manager „Electron“ – das ist kein Fehler.
- Einzelne Programme, die Hostwerk lädt (z. B. neue Apache- oder PHP-Fassungen), prüft Hostwerk nach dem Download. Blockiert Windows eins davon, zeigt Hostwerk das an und schlägt eine Alternative vor (nginx oder Caddy laufen bisher immer).

## Port belegt

Ein Dienst startet nicht, weil „Port 80“ (oder 3306, 25565 …) schon belegt ist.

- **System → Zustand → Ports & Dienste** zeigt, welches Programm den Port hält. Ist es ein alter Dienst von Hostwerk, gibt Hostwerk ihn mit einem Klick frei.
- Ist es ein anderes Programm (Skype, IIS, ein zweites XAMPP, eine eigene MariaDB …), stell beim Dienst einfach einen anderen Port ein – oder beende das andere Programm.
- Neue Datenbanken suchen sich selbst einen freien Port.

## Virenscanner

Virenscanner prüfen jede Datei, die ein Webserver oder eine Datenbank anfasst. Das macht Hostwerk langsam, und manchmal wird ein Programm (z. B. `php.exe` oder `mysqld.exe`) in Quarantäne verschoben.

- Nimm den Hostwerk-Ordner (Standard: `%USERPROFILE%\Hostwerk`) in die Ausnahmen deines Virenscanners auf.
- Fehlt ein Programm plötzlich, lädt Hostwerk es beim nächsten Start neu („Selbstheilung“).

## WSL und Docker

Docker-Apps und manche Spiele-Server laufen unter Windows in Hostwerks eigener WSL-Umgebung („hostwerk-docker“) – Docker Desktop brauchst du nicht.

- Voraussetzung: **Virtualisierung** im BIOS/UEFI an und das Windows-Feature **WSL**. Hostwerk richtet WSL bei Bedarf ein; Windows fragt dafür nach Administrator-Rechten und will danach meist einmal neu starten.
- „Zeitüberschreitung“ heißt nicht „aus“: Beim ersten Start einer WSL-Umgebung braucht Windows manchmal über eine Minute. Einfach noch einmal versuchen.
- Läuft schon Docker Desktop, kann Hostwerk dessen Engine mitbenutzen.

## Proxy

Hostwerk übernimmt bisher keine Proxy-Einstellungen. Hinter einem Firmen-Proxy, der direkte Verbindungen sperrt, scheitern Downloads (PHP, Datenbanken, Erweiterungen, Updates).

- Was ohne Internet geht, läuft weiter. Mit **Einstellungen → Datenschutz → Offline-Modus** fragt Hostwerk gar nicht erst nach draußen.
- Eine vorhandene XAMPP-Installation lässt sich übernehmen (**Webserver → Import**), ganz ohne Download.

## Update hängt oder startet nicht

- Downloads setzen nach einem Abbruch fort. Steht ein Update lange still, hilft **Einstellungen → App-Updates → Nach Updates suchen**.
- Startet eine neue Fassung nicht, nimmt Hostwerk beim nächsten Start von selbst die vorige und überspringt die kaputte.
- Gefällt dir eine neue Fassung nicht: **Einstellungen → App-Updates → Zurück zur vorherigen Version**.
- Läuft Hostwerk als Systemdienst, zeigt Livebetrieb → Dienst nach einem App-Update „Dienst aktualisieren“.

## Systemvoraussetzungen

| | |
|---|---|
| **Windows** | Windows 10 (ab 22H2) oder Windows 11, 64 Bit (x64). ARM-Geräte werden nicht unterstützt. |
| **Linux** | x64, glibc-basiert: Ubuntu 22.04/24.04, Debian 12, Fedora 40 oder neuer (AppImage oder .deb). |
| **Arbeitsspeicher** | 4 GB reichen für Webserver und Datenbank, 8 GB oder mehr für Minecraft, Docker oder den lokalen KI-Helfer. |
| **Speicherplatz** | rund 500 MB für Hostwerk, dazu je Dienst (PHP ~100 MB, eine Datenbank ~300 MB, ein Minecraft-Server 0,5–5 GB). |
| **Administrator-Rechte** | Für Installation und normalen Betrieb nicht nötig. Windows fragt nur bei: Systemdienst, Firewall-Regeln, WSL/Docker einrichten. Unter Linux zusätzlich bei Ports unter 1024 und beim Vertrauen der lokalen Zertifizierungsstelle. |

## Bekannte Probleme in 2.x

- Der Task-Manager zeigt Hostwerk als „Electron“ (siehe Smart App Control) – gewollt, damit Windows Hostwerk nicht blockiert.
- Hinter einem Proxy gehen keine Downloads (siehe Proxy).
- Unter Linux ohne Infobereich (reines GNOME) wird Hostwerk beim Schließen minimiert statt ausgeblendet.
- Apache/PHP-Builds können unter Smart App Control vereinzelt blockiert werden – nginx und Caddy sind die Ausweichlösung.

## Hostwerk startet nicht (Wartung)

Die **Wartung** ist ein eigenes Fenster, das keine Erweiterung lädt – so kann keine sie stören. Du erreichst sie über **Startmenü → „Hostwerk – Wartung“**, mit **F8** im Startfenster, über **Einstellungen → Erweitert → Wartung & Installation** oder mit `Hostwerk.exe --maintenance` (Linux: `hostwerk --maintenance`, ohne Fenster: `hostwerk-headless maintenance`). Startet Hostwerk zweimal hintereinander nicht sauber, bietet es selbst an, **ohne Erweiterungen** zu starten oder die Wartung zu öffnen.

- **Erweiterungen:** Alle installierten Erweiterungen stehen dort – direkt aus dem Erweiterungs-Ordner, auch kaputte und solche, die sich verstecken wollten. Du kannst sie ausschalten, abgeschottet laufen lassen, auf die vorige Version zurücksetzen oder entfernen (Daten behalten oder mit). „Start hing hier“ zeigt, bei welcher Erweiterung der letzte Start stecken blieb.
- **Abgesicherter Start:** Hostwerk startet einmal (oder bis du es ausschaltest) ganz ohne Erweiterungen. Dienste, Projekte und Daten sind normal da.
- **Aktualisieren, zurück, reparieren:** Kanal wählen, Update einspielen, zur vorigen Version zurück oder alle Programmdateien prüfen und das geprüfte Paket dieser Version neu holen.
- **Installieren:** Aus der entpackten ZIP mit `Hostwerk.exe --setup` – Zielordner (Standard `%LOCALAPPDATA%\Programs\Hostwerk`), Verknüpfungen, Eintrag unter „Apps“, Autostart, Sprache. Ohne Administrator-Rechte.

## Hostwerk entfernen

**Einstellungen → Erweitert → Hostwerk entfernen** räumt alles auf, was Hostwerk im System eingetragen hat, und fragt, ob deine Daten bleiben sollen. Deinstallierst du über Windows („Apps“), öffnet sich die Wartung mit **Entfernen** – das klappt auch, wenn Hostwerk nicht mehr startet. Du wählst **Daten behalten**, **Dienste behalten** (ausgewählte Minecraft-Server und Datenbanken werden nach „Hostwerk-Behalten-<Datum>“ gesichert) oder **Alles entfernen**. Eine neue Installation findet behaltene Daten wieder.
