#!/bin/bash

# ==============================================================================
# OBSIDIAN PANEL - EIN-ZEILEN-INSTALLATIONSSKRIPT
# ==============================================================================
# Dieses Skript installiert Docker (falls nicht vorhanden), richtet die Non-Root-
# Umgebung ein und startet das Obsidian Panel.
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
  echo -e "Bitte führe es aus mit: ${YELLOW}sudo bash install.sh${NC} oder über den One-Liner."
  exit 1
fi

# 2. Docker & Docker Compose Prüfung/Installation
echo -e "\n${BLUE}[1/5] Prüfe Docker-Umgebung...${NC}"
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
  apt-get update && apt-get install -y docker-compose-plugin
  echo -e "${GREEN}[OK] Docker Compose wurde erfolgreich installiert.${NC}"
else
  echo -e "${GREEN}[OK] Docker Compose ist bereits installiert.${NC}"
fi

# 3. System-User & Verzeichnisse erstellen
echo -e "\n${BLUE}[2/5] Erstelle Dienstbenutzer und Verzeichnisse...${NC}"
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

# 4. Ersteinrichtung & .env Konfiguration
echo -e "\n${BLUE}[3/5] Konfiguration einrichten...${NC}"
cd /opt/obsidian-panel/panel

# Zufälliges JWT Secret generieren
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "obsidian_default_secret_key_12345")

# Frage nach Admin-Passwort
read -p "Gib ein initiales Admin-Passwort ein [Standard: obsidian123]: " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-obsidian123}

# Frage nach Panel-Port
read -p "Gib den Port für das Web-Interface an [Standard: 8080]: " PANEL_PORT
PANEL_PORT=${PANEL_PORT:-8080}

# Schreibe .env Datei
cat <<EOF > .env
PANEL_PORT=$PANEL_PORT
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET=$JWT_SECRET
EOF
chmod 600 .env
chown obsidian:docker .env
echo -e "${GREEN}[OK] .env-Konfiguration wurde erstellt.${NC}"

# 5. docker-compose.yml herunterladen (In diesem Prototyp kopieren wir sie)
echo -e "\n${BLUE}[4/5] Bereite Docker Compose-Dateien vor...${NC}"
# (Im echten One-Liner würde dies von GitHub geladen werden)
# Wir kopieren die Compose-Datei aus dem Repository-Verzeichnis
cp /C/Users/bross/Desktop/Claude/Gemini/Discord_Bot/docker-compose.yml /opt/obsidian-panel/panel/docker-compose.yml 2>/dev/null || \
cp C:\\Users\\bross\\Desktop\\Claude\\Gemini\\Discord_Bot\\docker-compose.yml /opt/obsidian-panel/panel/docker-compose.yml 2>/dev/null || \
cat <<EOF > /opt/obsidian-panel/panel/docker-compose.yml
version: '3.8'
services:
  socket-proxy:
    image: tecnativa/docker-socket-proxy:latest
    container_name: obsidian-socket-proxy
    privileged: false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - CONTAINERS=1
      - VOLUMES=1
      - IMAGES=1
      - NETWORKS=1
      - POST=1
      - DELETE=1
    ports:
      - "127.0.0.1:2375:2375"
    restart: always

  panel:
    image: obsidianpanel/panel:latest
    container_name: obsidian-panel
    ports:
      - "\${PANEL_PORT:-8080}:8080"
    environment:
      - NODE_ENV=production
      - DOCKER_HOST=tcp://socket-proxy:2375
      - JWT_SECRET=\${JWT_SECRET}
      - INITIAL_ADMIN_PASSWORD=\${ADMIN_PASSWORD}
      - DATABASE_URL=file:/app/data/obsidian.db
      - HOST_SERVERS_PATH=/opt/obsidian-panel/servers
    volumes:
      - ./data:/app/data
      - /opt/obsidian-panel/servers:/opt/obsidian-panel/servers
    depends_on:
      - socket-proxy
    restart: always
EOF

chown obsidian:docker /opt/obsidian-panel/panel/docker-compose.yml
echo -e "${GREEN}[OK] docker-compose.yml wurde platziert.${NC}"

# 6. Panel starten
echo -e "\n${BLUE}[5/5] Starte Obsidian Panel...${NC}"
# Führe Docker Compose als 'obsidian' aus oder über sudo mit Gruppe
# (Wir führen es im Kontext des Skripts aus, stellen aber sicher, dass die Volumes dem richtigen Benutzer gehören)
docker compose up -d

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}          INSTALLATION ERFOLGREICH BEENDET!          ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "Das Obsidian Panel wurde erfolgreich gestartet."
echo -e "Erreichbar unter: ${YELLOW}http://localhost:$PANEL_PORT${NC}"
echo -e "Initialer Admin-Benutzer: ${YELLOW}admin${NC}"
echo -e "Initiales Admin-Passwort: ${YELLOW}$ADMIN_PASSWORD${NC}"
echo -e "Minecraft Server Verzeichnis: ${YELLOW}/opt/obsidian-panel/servers/${NC}"
echo -e "${GREEN}=====================================================${NC}"
