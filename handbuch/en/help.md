# Help & known issues

[← Back to the overview](README.md)

If something doesn't work, the fix is usually here. If nothing helps: under **System → Health → Incidents**, “Bug report” opens a prefilled report – without paths, names or secrets, you send it yourself.

## Windows blocks Hostwerk (Smart App Control)

On Windows 11, **Smart App Control** can block programs without a known signature. This affects the installer (`Hostwerk-Setup-….exe`), not Hostwerk itself.

- Use the **ZIP version**, extract it e.g. to `%LOCALAPPDATA%\Programs\Hostwerk` and start `Hostwerk.exe`. On first start Hostwerk creates the shortcuts and the entry under “Apps”.
- `Hostwerk.exe` is the unmodified, official Electron runtime. That's why Task Manager shows “Electron” – this is not an error.
- Programs Hostwerk downloads (e.g. new Apache or PHP builds) are checked after the download. If Windows blocks one, Hostwerk tells you and suggests an alternative (nginx and Caddy have always worked so far).

## Port in use

A service doesn't start because “port 80” (or 3306, 25565 …) is already in use.

- **System → Health → Ports & services** shows which program holds the port. If it's an old Hostwerk service, Hostwerk frees it with one click.
- If it's another program (Skype, IIS, a second XAMPP, your own MariaDB …), simply set a different port for the service – or quit the other program.
- New databases pick a free port on their own.

## Virus scanners

Virus scanners check every file a web server or database touches. That slows Hostwerk down, and sometimes a program (e.g. `php.exe` or `mysqld.exe`) is moved to quarantine.

- Add the Hostwerk folder (default: `%USERPROFILE%\Hostwerk`) to your scanner's exclusions.
- If a program suddenly goes missing, Hostwerk downloads it again on the next start (“self-healing”).

## WSL and Docker

On Windows, Docker apps and some game servers run in Hostwerk's own WSL environment (“hostwerk-docker”) – you don't need Docker Desktop.

- Requirement: **virtualization** enabled in BIOS/UEFI and the Windows feature **WSL**. Hostwerk sets up WSL when needed; Windows asks for administrator rights and usually wants one restart.
- “Timeout” doesn't mean “off”: the first start of a WSL environment sometimes takes Windows more than a minute. Just try again.
- If Docker Desktop is already running, Hostwerk can use its engine.

## Proxy

Hostwerk doesn't use proxy settings yet. Behind a company proxy that blocks direct connections, downloads (PHP, databases, extensions, updates) fail.

- Everything that works without the internet keeps running. With **Settings → Privacy → Offline mode** Hostwerk doesn't even try to connect.
- An existing XAMPP installation can be taken over (**Web servers → Import**) without any download.

## Update stuck or doesn't start

- Downloads resume after an interruption. If an update stands still for long, use **Settings → App updates → Check for updates**.
- If a new version doesn't start, Hostwerk uses the previous one on the next start and skips the broken one.
- Don't like a new version: **Settings → App updates → Back to the previous version**.
- If Hostwerk runs as a system service, Live → Service shows “Update service” after an app update.

## System requirements

| | |
|---|---|
| **Windows** | Windows 10 (22H2 or later) or Windows 11, 64-bit (x64). ARM devices are not supported. |
| **Linux** | x64, glibc-based: Ubuntu 22.04/24.04, Debian 12, Fedora 40 or newer (AppImage or .deb). |
| **Memory** | 4 GB is enough for a web server and a database, 8 GB or more for Minecraft, Docker or the local AI helper. |
| **Disk space** | about 500 MB for Hostwerk, plus each service (PHP ~100 MB, a database ~300 MB, a Minecraft server 0.5–5 GB). |
| **Administrator rights** | Not needed to install or use Hostwerk. Windows only asks for: system service, firewall rules, setting up WSL/Docker. On Linux also for ports below 1024 and trusting the local certificate authority. |

## Known issues in 2.x

- Task Manager shows Hostwerk as “Electron” (see Smart App Control) – on purpose, so Windows doesn't block Hostwerk.
- No downloads behind a proxy (see Proxy).
- On Linux without a tray (plain GNOME), closing the window minimizes Hostwerk instead of hiding it.
- Apache/PHP builds can occasionally be blocked by Smart App Control – nginx and Caddy are the fallback.

## Hostwerk does not start (maintenance)

**Maintenance** is a separate window that loads no extension – so none can interfere. Open it from **Start menu → “Hostwerk – Maintenance”**, with **F8** in the start window, via **Settings → Advanced → Maintenance & installation** or with `Hostwerk.exe --maintenance` (Linux: `hostwerk --maintenance`, without a window: `hostwerk-headless maintenance`). If Hostwerk fails to start cleanly twice in a row, it offers to start **without extensions** or to open maintenance.

- **Extensions:** Every installed extension is listed – straight from the extensions folder, including broken ones and ones that tried to hide. Turn them off, run them sandboxed, roll back to the previous version or remove them (keep data or not). “Start hung here” shows where the last start got stuck.
- **Safe start:** Hostwerk starts once (or until you turn it off) without any extension. Services, projects and data are there as usual.
- **Update, roll back, repair:** choose the channel, install an update, go back to the previous version, or check every program file and fetch the verified package of this version again.
- **Install:** from the unpacked ZIP with `Hostwerk.exe --setup` – target folder (default `%LOCALAPPDATA%\Programs\Hostwerk`), shortcuts, entry under “Apps”, autostart, language. No administrator rights.

## Removing Hostwerk

**Settings → Advanced → Remove Hostwerk** cleans up everything Hostwerk registered in the system and asks whether your data should stay. If you uninstall through Windows (“Apps”), maintenance opens on **Remove** – this works even when Hostwerk no longer starts. Choose **Keep data**, **Keep services** (selected Minecraft servers and databases are saved to “Hostwerk-Behalten-<date>”) or **Remove everything**. A new installation finds kept data again.
