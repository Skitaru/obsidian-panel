#!/bin/bash

# ==============================================================================
# OBSIDIAN PANEL - EIN-ZEILEN-INSTALLATIONSSKRIPT
# ==============================================================================
# Dieses Skript installiert Git, Curl, Docker (falls nicht vorhanden), richtet die 
# Non-Root-Umgebung ein und startet das Obsidian Panel.
# Kann direkt per One-Liner ausgeführt werden:
# curl -sSL https://raw.githubusercontent.com/Skitaru/obsidian-panel/main/install.sh | bash
# ==============================================================================

# Farben für ansprechende Konsolenausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0;m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}          OBSIDIAN PANEL - INSTALLATION              ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# 1. Sicherstellen, dass das Skript als root ausgeführt wird
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[FEHLER] Dieses Installationsskript muss als root ausgeführt werden!${NC}"
  echo -e "Bitte führe es aus mit: ${YELLOW}sudo bash -c \"\$(curl -sSL https://raw.githubusercontent.com/Skitaru/obsidian-panel/main/install.sh)\"${NC}"
  exit 1
fi

# 2. Paketmanager und Abhängigkeiten (Git, Curl) prüfen und installieren
echo -e "\n${BLUE}[1/6] Prüfe grundlegende System-Abhängigkeiten (Git, Curl)...${NC}"
if ! [ -x "$(command -v git)" ] || ! [ -x "$(command -v curl)" ]; then
  echo -e "${YELLOW}Abhängigkeiten fehlen. Starte Installation...${NC}"
  if [ -x "$(command -v apt-get)" ]; then
    apt-get update && apt-get install -y git curl
  elif [ -x "$(command -v yum)" ]; then
    yum install -y git curl
  else
    echo -e "${RED}[FEHLER] Kein unterstützter Paketmanager (apt/yum) gefunden. Bitte installiere Git & Curl manuell.${NC}"
    exit 1
  fi
  echo -e "${GREEN}[OK] Git und Curl wurden erfolgreich installiert.${NC}"
else
  echo -e "${GREEN}[OK] Git und Curl sind bereits installiert.${NC}"
fi

# 3. Repository klonen, falls das Skript per One-Liner (extern) aufgerufen wurde
INSTALL_DIR="/opt/obsidian-panel/panel"
echo -e "\n${BLUE}[2/6] Bereite Projektverzeichnis vor...${NC}"
if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo -e "${YELLOW}Klone das Obsidian Panel Repository nach $INSTALL_DIR...${NC}"
  mkdir -p "$INSTALL_DIR"
  git clone https://github.com/Skitaru/obsidian-panel.git "$INSTALL_DIR"
  echo -e "${GREEN}[OK] Repository erfolgreich geklont.${NC}"
else
  echo -e "${GREEN}[OK] Projektverzeichnis ist bereits vorbereitet.${NC}"
fi

# In das Verzeichnis wechseln für nachfolgende Aktionen
cd "$INSTALL_DIR" || exit 1

# 4. Docker & Docker Compose Prüfung/Installation
echo -e "\n${BLUE}[3/6] Prüfe Docker-Umgebung...${NC}"
if ! [ -x "$(command -v docker)" ]; then
  echo -e "${YELLOW}Docker ist nicht installiert. Starte automatische Installation...${NC}"
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
  echo -e "${GREEN}[OK] Docker wurde erfolgreich installiert.${NC}"
else
  echo -e "${GREEN}[OK] Docker ist bereits installiert.${NC}"
fi

if ! docker compose version &> /dev/null; then
  echo -e "${YELLOW}Docker Compose v2 ist nicht installiert. Installiere...${NC}"
  if [ -x "$(command -v apt-get)" ]; then
    apt-get update && apt-get install -y docker-compose-plugin
  else
    echo -e "${RED}[FEHLER] Bitte installiere Docker Compose v2 für dein System manuell.${NC}"
    exit 1
  fi
  echo -e "${GREEN}[OK] Docker Compose wurde erfolgreich installiert.${NC}"
else
  echo -e "${GREEN}[OK] Docker Compose ist bereits installiert.${NC}"
fi

# 5. System-User & Verzeichnisse erstellen
echo -e "\n${BLUE}[4/6] Erstelle Dienstbenutzer und Dateirechte...${NC}"
# Erstelle Benutzer 'obsidian' ohne Login-Shell, falls er nicht existiert
if ! id "obsidian" &>/dev/null; then
  useradd -r -s /bin/false obsidian
  echo -e "${GREEN}[OK] System-Benutzer 'obsidian' wurde erstellt.${NC}"
else
  echo -e "${GREEN}[OK] System-Benutzer 'obsidian' existiert bereits.${NC}"
fi

# Füge obsidian der docker-Gruppe hinzu
usermod -aG docker obsidian
echo -e "${GREEN}[OK] Benutzer 'obsidian' zur Docker-Gruppe hinzugefügt.${NC}"

# Erstelle Installations- und Minecraft-Verzeichnisse
mkdir -p /opt/obsidian-panel/servers
mkdir -p /opt/obsidian-panel/panel/data

# Berechtigungen setzen
chown -R obsidian:docker /opt/obsidian-panel
chmod -R 770 /opt/obsidian-panel
echo -e "${GREEN}[OK] Verzeichnisstruktur unter /opt/obsidian-panel eingerichtet.${NC}"

# 6. Ersteinrichtung & .env Konfiguration
echo -e "\n${BLUE}[5/6] Konfiguration einrichten...${NC}"

# Zufälliges JWT Secret generieren
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "obsidian_default_secret_key_12345")

# Frage nach Admin-Passwort (interaktiv, mit Fallback für automatisierte Setups)
if [ -t 0 ]; then
  read -p "Gib ein initiales Admin-Passwort ein [Standard: obsidian123]: " ADMIN_PASSWORD
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-obsidian123}
  read -p "Gib den Port für das Web-Interface an [Standard: 8080]: " PANEL_PORT
  PANEL_PORT=${PANEL_PORT:-8080}
else
  ADMIN_PASSWORD="obsidian123"
  PANEL_PORT="8080"
  echo -e "${YELLOW}Nicht-interaktive Konsole erkannt. Verwende Standardwerte.${NC}"
fi

# Schreibe .env Datei
cat <<EOF > .env
PANEL_PORT=$PANEL_PORT
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET=$JWT_SECRET
EOF
chmod 600 .env
chown obsidian:docker .env
echo -e "${GREEN}[OK] .env-Konfiguration wurde erstellt.${NC}"

# 7. Panel starten
echo -e "\n${BLUE}[6/6] Starte Obsidian Panel...${NC}"
docker compose up -d

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}          INSTALLATION ERFOLGREICH BEENDET!          ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "Das Obsidian Panel wurde erfolgreich im Hintergrund gestartet."
echo -e "Erreichbar unter: ${YELLOW}http://<DEINE-VPS-IP>:$PANEL_PORT${NC}"
echo -e "Initialer Admin-Benutzer: ${YELLOW}admin${NC}"
echo -e "Initiales Admin-Passwort: ${YELLOW}$ADMIN_PASSWORD${NC}"
echo -e "Minecraft Server Verzeichnis: ${YELLOW}/opt/obsidian-panel/servers/${NC}"
echo -e "${GREEN}=====================================================${NC}"
