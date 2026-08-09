# 💎 Obsidian Panel

[![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
[![Docker Support](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)

**Obsidian Panel** ist ein modernes, sicheres und leichtgewichtiges Minecraft-Server-Management-Panel, das speziell für das **Self-Hosting** entwickelt wurde. Es richtet sich an Administratoren, die keine tiefen Linux-Kenntnisse besitzen, aber dennoch ein professionelles Panel mit Ressourcen-Management, Live-Konsole und Datei-Manager nutzen möchten.

Das gesamte System ist darauf ausgelegt, mit **einem einzigen Befehl installiert** zu werden und alle Minecraft-Server sicher in isolierten Docker-Containern **ohne Root-Rechte** (Non-Root) auszuführen.

---

## ✨ Features

*   **⚡ One-Liner Installer:** Vollautomatische Einrichtung inkl. Docker-Prüfung, Systembenutzer-Anlage und Start per Knopfdruck.
*   **🔒 Non-Root Security:** Minecraft-Server und das Panel selbst laufen unter eingeschränkten Benutzerkonten (UID/GID 1000). Es besteht kein Root-Zugriff auf das Host-System.
*   **🛡️ Docker Socket Proxy:** Eine vorgeschaltete Firewall (`tecnativa/docker-socket-proxy`) schützt den Docker-Socket vor schädlichen Befehlen aus Containern heraus.
*   **📊 Echtzeit-Metriken:** Live-Monitoring von CPU- und RAM-Auslastung des Host-Systems sowie der einzelnen Spielserver-Container.
*   **💻 Live-Konsole:** Interaktiver Echtzeit-Logstream über WebSockets mit Befehlseingabe direkt im Web-Interface.
*   **📂 Datei-Manager:** Webbasierte Dateiverwaltung (Editor, Downloads, Uploads) für Spieldateien im Browser.
*   **👥 Rollenbasiertes Rechtesystem:** Feingranulares Rechtesystem für Benutzer (`ADMIN`, `OPERATOR`, `VIEWER`), inkl. Passwortänderungen und Server-Zuweisungen.
*   **🎮 Minecraft-Vielfalt:** Direkte Unterstützung von **Paper**, **Vanilla** und **Fabric**-Servern bei der Erstellung.

---

## 🛠️ Tech-Stack

*   **Frontend:** React (TypeScript), modernste Web-UI mit responsivem Obsidian-Dunkel-Thema (Vanilla CSS für maximale Performance).
*   **Backend:** Node.js (TypeScript, Express) zur Systemsteuerung.
*   **Datenbank:** SQLite (better-sqlite3) für schlanke, dateibasierte Datenhaltung ohne zusätzlichen DB-Container.
*   **Schnittstellen:** WebSockets für Echtzeit-Verbindungen, Dockerode für die direkte Kommunikation mit der Docker-Engine.

---

## 🚀 Installation auf dem Linux VPS

Dieses Skript ist vollständig kompatibel mit **Debian 12, Debian 13 und allen aktuellen Ubuntu-Versionen**. 

Da frische Server-Installationen (insbesondere Minimal-Templates) oft ohne installierte Werkzeuge ausgeliefert werden, verwende diesen kombinierten Befehl. Er stellt sicher, dass `curl` installiert wird und startet dann die automatische Installation:

```bash
apt update && apt install -y curl && curl -sSL https://raw.githubusercontent.com/Skitaru/obsidian-panel/main/install.sh | bash
```

### Was der Installer automatisch erledigt:
1.  **Abhängigkeiten prüfen:** Installiert automatisch Docker und Docker Compose, falls diese fehlen.
2.  **Sicherheit einrichten:** Erstellt den Linux-Dienstuser `obsidian` und vergibt restriktive Berechtigungen auf `/opt/obsidian-panel/`.
3.  **Ersteinrichtung:** Fragt dich nach dem gewünschten Web-Port (Standard: `8080`) und deinem initialen Admin-Passwort.
4.  **Sicherheits-Keys:** Generiert zufällige, kryptografische Secrets für die API-Absicherung (JWT).
5.  **Start:** Lädt das Docker-Setup herunter und startet das Panel im Hintergrund.

---

## 💻 Lokales Testen (unter Windows / macOS / Linux)

Du kannst das Panel vorab hervorragend auf deinem PC mit installiertem **Docker Desktop** testen:

```bash
# Repository klonen
git clone https://github.com/Skitaru/obsidian-panel.git
cd obsidian-panel

# In Produktion bauen und starten
docker compose up --build
```

Öffne anschließend [http://localhost:8080](http://localhost:8080) in deinem Browser.
*   **Benutzername:** `admin`
*   **Passwort:** `admin123` *(oder dein konfiguriertes Passwort)*

---

## 📂 Projektstruktur

```text
obsidian-panel/
├── backend/            # Express API & Docker-Logik (TypeScript)
│   ├── src/
│   │   ├── db.ts       # SQLite-Datenbank & Schema
│   │   ├── index.ts    # Haupteinstiegspunkt & WebSockets
│   │   ├── middleware/ # Auth- & Rollen-Prüfungen
│   │   ├── routes/     # API-Schnittstellen (Auth, Users, Servers)
│   │   └── services/   # Dockerode-Anbindung & Container-Logik
│   └── package.json
├── frontend/           # React Web-Interface (TypeScript & Vite)
│   ├── src/
│   │   ├── App.tsx     # Obsidian Panel Dashboard & Interaktionen
│   │   ├── index.css   # Modernes Custom Dark Theme (Vanilla CSS)
│   │   └── main.tsx
│   └── package.json
├── docker-compose.yml  # Docker-Infrastruktur (Panel + Socket Proxy)
├── Dockerfile          # Multi-Stage Produktions-Dockerfile
├── install.sh          # One-Liner Shell-Installer für VPS
└── README.md           # Projektdokumentation
```

---

## 📜 Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** lizenziert. Siehe [LICENSE](LICENSE) für Details.

---

*Entwickelt mit 💜 für die Minecraft-Hosting Community.*
