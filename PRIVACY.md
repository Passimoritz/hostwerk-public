# Privacy in Hostwerk

Hostwerk runs on your own computer. Your projects, databases, servers, passwords and settings stay there – there is no
Hostwerk account and no Hostwerk server that anything is sent to.

## In short

- **No telemetry.** Hostwerk sends no usage data, no statistics and no identifiers.
- **Error reports only by hand.** “Report” opens a pre-filled page on GitHub in your browser – you decide whether to
  submit it and what it contains.
- **Offline switch.** Under *Settings → Privacy*, “No outgoing connections” stops all connections to the internet. This
  computer and your home network stay reachable.
- **Credentials** (e.g. for mail forwarding, publishing, AI providers) are stored encrypted in your settings; in the
  desktop app the key is kept in the system keychain (where available).

## Which feature talks to whom, and when

Every connection technically transmits your IP address and the Hostwerk version (in the user agent). An IP address also
counts as personal data – processing on the other side is governed by the respective privacy policies.

| Feature | With whom | When | What is transmitted | Kind |
|---|---|---|---|---|
| App updates | api.github.com, github.com, objects.githubusercontent.com | 20 seconds after start, then every 4 hours; download only with “Update automatically” | Query for the latest release; with a stored GitHub token also the token | automatic |
| Runtime update (Electron) | releases.electronjs.org, github.com | daily, only with “Update automatically” | Query for the version list | automatic |
| Catalogs (extensions, templates, AI models, advisor, password managers, game servers) | raw.githubusercontent.com, api.github.com | at start, daily and when opening those areas | Download of public files from Passimoritz/hostwerk-public | automatic |
| Component updates and version lists (PHP, Apache, databases, runtimes …) | windows.php.net, www.apachelounge.com, mariadb.org, www.postgresql.org, nodejs.org, www.python.org, api.adoptium.net, nginx.org, downloads.mongodb.org, api.github.com | 10 minutes after start, then every 6 hours; also when opened | Query of the vendors’ version lists | automatic |
| Downloading programs, models and packages | Hersteller-Seiten / vendor sites, github.com, huggingface.co | when you install or update something | Download of the file | on click |
| End-of-life hints for runtimes | endoflife.date | when opening runtimes | Query until when a version is maintained | on click |
| AI model catalog | ollama.com, registry.ollama.ai, huggingface.co | daily | Download of the model list | automatic |
| Cloud AI providers | api.openai.com, api.anthropic.com, generativelanguage.googleapis.com, api.mistral.ai, api.groq.com, api.deepseek.com, openrouter.ai, api.replicate.com, queue.fal.run | only if you set up and use a cloud provider (also the AI watch, if it uses one) | your prompts and attached content plus your API key | if set up |
| Docker catalog | hub.docker.com, api.linuxserver.io | daily | Query of popular containers | automatic |
| Images and logos | cdn.jsdelivr.net, raw.githubusercontent.com, Webseiten deiner Projekte / your projects’ websites | on first display, then 14 days from the cache | Download of the image | automatic |
| Alerts (Discord, ntfy, e-mail, Telegram, Gotify, Pushover, Matrix) | discord.com, ntfy.sh, api.telegram.org, api.pushover.net, dein Gotify-/Matrix-Server / your Gotify/Matrix server, dein Mail-Server / your mail server | on crashes, certificates, backups, outages – only if set up | Message text and computer name | if set up |
| Uptime check | deine Seiten / your sites | every 30 seconds for added addresses | Request of the page | if set up |
| HTTPS certificates (Let’s Encrypt) | acme-v02.api.letsencrypt.org | when requesting and automatically before expiry | Domain name and account key | if set up |
| Finding your public IP address | api.ipify.org, ipv4.icanhazip.com | in the go-live assistant | Query for your own address | on click |
| Check from outside (open ports) | ifconfig.co | only when you click “Check from outside” | the port numbers checked; the service tries to reach your public IP address on these ports | on click |
| Sharing pages via tunnel | Cloudflare (trycloudflare.com) | while you share a page | the shared page’s traffic runs through Cloudflare | on click |
| Help videos | api.github.com, github.com | on first playback | Download of the video | on click |
| Error report | github.com | manual only: “Report” opens a pre-filled page in your browser, you decide whether to submit it | only what you submit yourself | on click |
| Extensions | laut Manifest der Erweiterung / as listed in the extension’s manifest | only extensions with the “network” permission, only to the addresses listed there | depends on the extension | if set up |

*Kind:* **automatic** = Hostwerk connects by itself (schedule, start) · **if set up** = only if you set the feature up ·
**on click** = only when you click something.

Services you start yourself (web servers, game servers, tunnels, apps, containers) are your own servers – what they send
depends on them and on your setup.

## Extensions

Extensions may only access the internet with the “network” permission and only the addresses listed in their manifest;
you see this before installing. What an extension has read or changed is shown in its access log.

## Your name

Under Settings → General you can tell Hostwerk what to call you. The name stays in the settings on this computer – not in
profiles, settings exports or logs, and error reports replace it with `<name>`. It is only used where you switch it on:
for the greeting (local), in the AI helper (with a cloud provider it then goes to that provider) and for extensions with
the “read:profile” permission (otherwise they never get it).

---
This list is generated from `server/core/connections.js` (`node scripts/privacy-docs.js`) – Hostwerk shows the same
list under *Settings → Privacy*. Deutsch: [DATENSCHUTZ.md](DATENSCHUTZ.md)
