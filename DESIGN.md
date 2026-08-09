# Obsidian Panel - System- & UI-Design

Dieses Dokument beschreibt das System- und UI-Design des **Obsidian Panels**, um ein sicheres, performantes und benutzerfreundliches Server-Management für Minecraft-Server zu gewährleisten.

---

## 1. System-Architektur

Das Obsidian Panel ist als **All-in-One-Lösung** konzipiert. Alle Dienste laufen in einem Docker-Verbund, um die Abhängigkeiten auf dem Host-System minimal zu halten.

```
       +-----------------------------------------------------------+
       |                        Host System                        |
       |                                                           |
       |   +------------------+             +------------------+   |
       |   |  Obsidian Panel  |             |  Docker Socket   |   |
       |   |    Container     |             |      Proxy       |   |
       |   |  (Non-Root)      |             |  (tecnativa/dsp) |   |
       |   |                  |             |                  |   |
       |   |  +------------+  |             |  - Nur Lese/     |   |
       |   |  | React App  |  |             |    Schreibrechte |   |
       |   |  +------------+  |             |    für Container |   |
       |   |  | Node API   |================>                  |   |
       |   |  +------------+  |             +---------+--------+   |
       |   |  | SQLite DB  |  |                       |            |
       |   |  +------------+  |                       | Steuert    |
       |   +------------------+                       v            |
       |                                    +------------------+   |
       |                                    | Minecraft Server |   |
       |                                    |    Container     |   |
       |                                    | (itzg/minecraft) |   |
       |                                    +------------------+   |
       +-----------------------------------------------------------+
```

### 1.1 Docker Socket Sicherheit (Non-Root)
Um zu verhindern, dass das Panel vollen Root-Zugriff auf das Host-System erlangt, nutzen wir einen **Docker Socket Proxy** (`tecnativa/docker-socket-proxy`).
- Das Panel kommuniziert nur mit dem Proxy.
- Der Proxy blockiert riskante Docker-API-Aufrufe (z.B. Host-Mounts, Privilegierte Container, Löschen des Docker-Daemons).
- Alle Container laufen unter einem dedizierten Linux-Benutzer (z.B. GID/UID `1000`), nicht als Root.

---

## 2. Datenbank-Design (SQLite)

Da SQLite dateibasiert ist, benötigt es keinen separaten Datenbankserver. Die Datenbankdatei `obsidian.db` wird in einem Docker-Volume persistent gespeichert.

### 2.1 Tabellenstruktur

#### Tabelle: `users`
Verwaltet die Konten der Panel-Nutzer.
| Spalte | Typ | Beschreibung |
| :--- | :--- | :--- |
| `id` | INTEGER (PK) | Eindeutige ID |
| `username` | TEXT (Unique) | Benutzername |
| `password_hash` | TEXT | Gehashtes Passwort (mittels bcrypt oder argon2) |
| `role` | TEXT | Rolle im System (`ADMIN`, `OPERATOR`, `VIEWER`) |
| `created_at` | DATETIME | Erstellungszeitpunkt |
| `updated_at` | DATETIME | Letztes Update |

#### Tabelle: `servers`
Verwaltet die Minecraft-Server, die über das Panel erstellt wurden.
| Spalte | Typ | Beschreibung |
| :--- | :--- | :--- |
| `id` | INTEGER (PK) | Eindeutige ID |
| `name` | TEXT | Anzeigename des Minecraft-Servers |
| `container_id` | TEXT (Unique) | Die ID des Docker-Containers auf dem Host |
| `type` | TEXT | Typ des Servers (`VANILLA`, `PAPER`, `FABRIC`) |
| `version` | TEXT | Minecraft-Version (z.B. `1.20.4`) |
| `status` | TEXT | Aktueller Zustand (`RUNNING`, `STOPPED`, `STARTING`, `OFFLINE`) |
| `max_ram` | INTEGER | Zugewiesener RAM in MB |
| `max_cpu` | INTEGER | CPU-Limitierung in % (z.B. 100 für 1 Core) |
| `port` | INTEGER | Exponierter Minecraft-Port auf dem Host (Standard: `25565`) |
| `created_at` | DATETIME | Erstellungszeitpunkt |

#### Tabelle: `user_servers` (Rollen/Berechtigungen pro Server)
Ermöglicht es Admins, anderen Benutzern Zugriff auf bestimmte Server zu geben.
| Spalte | Typ | Beschreibung |
| :--- | :--- | :--- |
| `id` | INTEGER (PK) | Eindeutige ID |
| `user_id` | INTEGER (FK) | Verweist auf `users.id` |
| `server_id` | INTEGER (FK) | Verweist auf `servers.id` |
| `permission` | TEXT | Zugriffslevel (`OWNER`, `READ_WRITE`, `READ_ONLY`) |

---

## 3. UI/UX Design & Layouts

Das Frontend wird mit **React** und **TailwindCSS** gebaut. Es wird ein dunkles, modernes Design (passend zum Namen "Obsidian") verwendet.

### 3.1 Globale Navigation (Sidebar)
- **Obsidian Panel Logo** (Dunkelviolett / Obsidian-Thema)
- **Dashboard** (Server-Übersicht)
- **Benutzerverwaltung** (Nur für Admins sichtbar)
- **System-Status** (Ressourcen-Auslastung des Host-Systems)
- **Logout** & Profil-Einstellungen

### 3.2 Layout 1: Dashboard (Server-Übersicht)
Eine Kachel-Ansicht aller Minecraft-Server.
```
+--------------------------------------------------------------------------+
|  OBSIDIAN PANEL                                            Admin [Profil] |
+--------------------------------------------------------------------------+
|  Host-Status: CPU [||||      ] 34%  |  RAM [||||||||  ] 60%               |
+--------------------------------------------------------------------------+
|  MEINE SERVER                                      [ + Server Erstellen ] |
|                                                                          |
|  +---------------------------+    +---------------------------+          |
|  | Survival Server (Paper)   |    | Vanilla 1.21 (Fabric)     |          |
|  | Port: 25565               |    | Port: 25566               |          |
|  | Status: [ Online ]        |    | Status: [ Offline ]       |          |
|  | RAM: 1.8 GB / 4.0 GB      |    | RAM: 0 GB / 2.0 GB        |          |
|  |                           |    |                           |          |
|  | [ Konsole ] [ Stop ]      |    | [ Konsole ] [ Start ]     |          |
|  +---------------------------+    +---------------------------+          |
+--------------------------------------------------------------------------+
```

### 3.3 Layout 2: Server-Details (Live-Konsole & Steuerung)
Die Hauptansicht für einen einzelnen Server.
```
+--------------------------------------------------------------------------+
|  < Zurück zum Dashboard              Survival Server | Status: [ Online ] |
+--------------------------------------------------------------------------+
|  [ KONSOLE ]   [ DATEI-MANAGER ]   [ EINSTELLUNGEN ]   [ BACKUPS ]       |
+--------------------------------------------------------------------------+
|  LOG-AUSGABE (Live-Stream über WebSockets)                               |
|  +--------------------------------------------------------------------+  |
|  | [14:32:10] [Server thread/INFO]: Starting minecraft server version...|  |
|  | [14:32:15] [Server thread/INFO]: Loading properties                  |  |
|  | [14:32:20] [Server thread/INFO]: Preparing level "world"             |  |
|  | [14:32:31] [Server thread/INFO]: Done (11.2s)! For help, type "help" |  |
|  +--------------------------------------------------------------------+  |
|  | Befehl eingeben... (z.B. /op, /say)                       [Senden] |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  Ressourcen-Auslastung dieses Containers:                                 |
|  CPU: 12.4%  |  RAM: 1.82 GB / 4.00 GB                                   |
+--------------------------------------------------------------------------+
```

### 3.4 Layout 3: Datei-Manager
Ermöglicht die Verwaltung der Spieldateien direkt im Browser.
```
+--------------------------------------------------------------------------+
|  < Zurück zum Dashboard              Survival Server | Status: [ Online ] |
+--------------------------------------------------------------------------+
|  [ KONSOLE ]   [ DATEI-MANAGER ]   [ EINSTELLUNGEN ]   [ BACKUPS ]       |
+--------------------------------------------------------------------------+
|  Pfad: /plugins/Essentials/                                              |
|  [ Ordner Erstellen ]   [ Datei Erstellen ]              [ Datei Hochladen ]|
|  +--------------------------------------------------------------------+  |
|  | Name                       | Größe      | Letzte Änderung          |  |
|  | .. (Zurück)                | -          | -                        |  |
|  | config.yml                 | 45 KB      | Vor 2 Stunden  [Edit] [x]|  |
|  | userdata/                  | <DIR>      | Gestern        [Öffnen][x]|  |
|  | worth.yml                  | 12 KB      | 15.02.2026     [Edit] [x]|  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

---

## 4. One-Liner Installer Ablauf (`install.sh`)

Der Installer macht die Installation zum Kinderspiel. Er wird per curl ausgeführt:
`curl -sL https://get.obsidianpanel.com | bash`

**Schritte des Skripts:**
1. **Prüfung der Umgebung:**
   - Ist das OS Linux (Ubuntu, Debian, CentOS)?
   - Läuft das Skript als `root`? (Der Installer benötigt Root-Rechte, um Docker zu installieren, das Panel läuft danach jedoch im Non-Root-Modus).
2. **Docker Installation:**
   - Prüfen, ob Docker und Docker Compose v2 installiert sind. Wenn nicht, werden diese automatisch installiert.
3. **Nutzer & Rechte einrichten:**
   - Erstellt einen System-User `obsidian` ohne Shell-Zugriff und fügt ihn der Gruppe `docker` hinzu.
   - Erstellt das Verzeichnis `/opt/obsidian-panel/` und setzt die Rechte auf den `obsidian`-User.
4. **Download der Konfiguration:**
   - Lädt das offizielle `docker-compose.yml` für das Obsidian Panel herunter.
5. **Ersteinrichtung:**
   - Fragt nach dem gewünschten Admin-Passwort und Port für das Panel (Standard: `8080`).
   - Schreibt diese in eine `.env` Datei.
6. **Starten des Panels:**
   - Führt `docker compose up -d` aus.
   - Gibt die IP-Adresse und den Port aus, unter dem das Panel erreichbar ist.
