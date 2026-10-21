# Datenschutz bei Hostwerk

Hostwerk läuft auf deinem eigenen Rechner. Deine Projekte, Datenbanken, Server, Passwörter und Einstellungen bleiben dort –
es gibt kein Hostwerk-Konto und keinen Hostwerk-Server, an den etwas geht.

## Kurz gesagt

- **Keine Telemetrie.** Hostwerk sendet keine Nutzungsdaten, keine Statistiken und keine Kennungen.
- **Fehlerberichte nur von Hand.** „Melden“ öffnet eine vorausgefüllte Seite auf GitHub in deinem Browser – ob du sie
  absendest und was darin steht, entscheidest du.
- **Offline-Schalter.** Unter *Einstellungen → Datenschutz* hält „Keine Verbindungen nach außen“ alle Verbindungen ins
  Internet an. Der eigene Rechner und das Heimnetz bleiben erreichbar.
- **Zugangsdaten** (z. B. für Mail-Weiterleitung, Veröffentlichen, KI-Anbieter) liegen verschlüsselt in deinen
  Einstellungen; den Schlüssel dazu legt die Desktop-App in den Schlüsselbund des Systems (wo es einen gibt).

## Welche Funktion spricht wann mit wem

Jede Verbindung überträgt technisch deine IP-Adresse und die Hostwerk-Version (im User-Agent). Auch eine IP-Adresse gilt
als personenbezogenes Datum – für die Verarbeitung bei den Gegenstellen gelten deren Datenschutzerklärungen.

| Funktion | Mit wem | Wann | Was wird übertragen | Art |
|---|---|---|---|---|
| App-Updates | api.github.com, github.com, objects.githubusercontent.com | 20 Sekunden nach dem Start, dann alle 4 Stunden; Laden nur mit „Automatisch aktualisieren“ | Abfrage des neuesten Releases; mit hinterlegtem GitHub-Token auch das Token | automatisch |
| Laufzeit-Update (Electron) | releases.electronjs.org, github.com | täglich, nur mit „Automatisch aktualisieren“ | Abfrage der Versionsliste | automatisch |
| Kataloge (Erweiterungen, Vorlagen, KI-Modelle, Berater, Passwort-Manager, Spiele-Server) | raw.githubusercontent.com, api.github.com | beim Start, täglich und beim Öffnen der Bereiche | Abruf öffentlicher Dateien aus Passimoritz/hostwerk-public | automatisch |
| Komponenten-Updates und Versionslisten (PHP, Apache, Datenbanken, Laufzeiten …) | windows.php.net, www.apachelounge.com, mariadb.org, www.postgresql.org, nodejs.org, www.python.org, api.adoptium.net, nginx.org, downloads.mongodb.org, api.github.com | 10 Minuten nach dem Start, dann alle 6 Stunden; außerdem beim Öffnen | Abfrage der Versionslisten der Hersteller | automatisch |
| Programme, Modelle und Pakete herunterladen | Hersteller-Seiten / vendor sites, github.com, huggingface.co | wenn du etwas installierst oder aktualisierst | Download der Datei | auf Klick |
| Lebensende-Hinweise für Laufzeiten | endoflife.date | beim Öffnen der Laufzeiten | Abfrage, bis wann eine Version gepflegt wird | auf Klick |
| Minecraft: Server-Versionen, Plugins und Mods | api.papermc.io, fill.papermc.io, api.purpurmc.org, api.modrinth.com, hangar.papermc.io, api.spiget.org, piston-meta.mojang.com, meta.fabricmc.net | alle 6 Stunden für angelegte Server (abschaltbar), sonst beim Öffnen des Marktplatzes | Abfrage von Versionen und Suchbegriffen | automatisch |
| KI-Modellkatalog | ollama.com, registry.ollama.ai, huggingface.co | täglich | Abruf der Modellliste | automatisch |
| KI-Anbieter in der Cloud | api.openai.com, api.anthropic.com, generativelanguage.googleapis.com, api.mistral.ai, api.groq.com, api.deepseek.com, openrouter.ai, api.replicate.com, queue.fal.run | nur wenn du einen Cloud-Anbieter einrichtest und nutzt (auch die KI-Wache, falls sie ihn nutzt) | deine Eingaben und mitgeschickte Inhalte sowie dein API-Schlüssel | wenn eingerichtet |
| Docker-Katalog | hub.docker.com, api.linuxserver.io | täglich | Abfrage beliebter Container | automatisch |
| Bilder und Logos | cdn.jsdelivr.net, raw.githubusercontent.com, Webseiten deiner Projekte / your projects’ websites | beim ersten Anzeigen, danach 14 Tage aus dem Zwischenspeicher | Abruf des Bildes | automatisch |
| Push-Benachrichtigungen aufs Handy | fcm.googleapis.com, updates.push.services.mozilla.com, web.push.apple.com | bei Ereignissen, nur wenn du Push auf einem Gerät eingeschaltet hast | verschlüsselte Nachricht an den Push-Dienst deines Browsers | wenn eingerichtet |
| Alarme (Discord, ntfy, E-Mail, Telegram, Gotify, Pushover, Matrix) | discord.com, ntfy.sh, api.telegram.org, api.pushover.net, dein Gotify-/Matrix-Server / your Gotify/Matrix server, dein Mail-Server / your mail server | bei Abstürzen, Zertifikaten, Sicherungen, Ausfällen – nur wenn eingerichtet | Text der Meldung und Rechnername | wenn eingerichtet |
| Erreichbarkeits-Prüfung | deine Seiten / your sites | alle 30 Sekunden für eingetragene Adressen | Abruf der Seite | wenn eingerichtet |
| HTTPS-Zertifikate (Let’s Encrypt) | acme-v02.api.letsencrypt.org | beim Anfordern und automatisch vor Ablauf | Domainname und Konto-Schlüssel | wenn eingerichtet |
| Öffentliche IP-Adresse ermitteln | api.ipify.org, ipv4.icanhazip.com | im Livebetrieb-Assistenten | Abfrage der eigenen Adresse | auf Klick |
| Prüfung von außen (offene Ports) | ifconfig.co | nur wenn du „Von außen prüfen“ anklickst | die geprüften Portnummern; der Dienst versucht, deine öffentliche IP-Adresse auf diesen Ports zu erreichen | auf Klick |
| Seiten teilen per Tunnel | Cloudflare (trycloudflare.com) | solange du eine Seite teilst | der Verkehr der geteilten Seite läuft über Cloudflare | auf Klick |
| Erklärvideos | api.github.com, github.com | beim ersten Abspielen | Download des Videos | auf Klick |
| Fehlerbericht | github.com | nur von Hand: „Melden“ öffnet eine vorausgefüllte Seite im Browser, du entscheidest, ob du sie absendest | nur was du selbst absendest | auf Klick |
| Erweiterungen | laut Manifest der Erweiterung / as listed in the extension’s manifest | nur Erweiterungen mit dem Recht „Netzwerk“, nur zu den dort genannten Adressen | je nach Erweiterung | wenn eingerichtet |

*Art:* **automatisch** = Hostwerk verbindet sich von selbst (Zeitplan, Start) · **wenn eingerichtet** = nur, wenn du die
Funktion eingerichtet hast · **auf Klick** = nur, wenn du etwas anklickst.

Dienste, die du selbst startest (Webserver, Spiele-Server, Tunnel, Apps, Container), sind deine eigenen Server – was sie
ins Netz senden, hängt von ihnen und deiner Einrichtung ab.

## Erweiterungen

Erweiterungen dürfen nur mit dem Recht „Netzwerk“ ins Internet und nur zu den Adressen, die in ihrem Manifest stehen; das
siehst du vor der Installation. Was eine Erweiterung gelesen oder geändert hat, steht in ihrem Zugriffsprotokoll.

---
Diese Liste wird aus `server/core/connections.js` erzeugt (`node scripts/privacy-docs.js`) – dieselbe Liste zeigt
Hostwerk unter *Einstellungen → Datenschutz*. English: [PRIVACY.md](PRIVACY.md)
