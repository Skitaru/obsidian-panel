#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║           Obsidian Panel — One-Line Installer                ║
# ║   curl -fsSL ... | bash   — or —   wget -qO- ... | bash     ║
# ╚══════════════════════════════════════════════════════════════╝
set -euo pipefail

PANEL_DIR="${PANEL_DIR:-/opt/obsidian-panel}"
PANEL_PORT="${PANEL_PORT:-8080}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
REPO_URL="https://github.com/Skitaru/obsidian-panel.git"
TOTAL_STEPS=6

G='\033[0;32m'; B='\033[1;34m'; Y='\033[0;33m'
R='\033[0;31m'; W='\033[1;37m'; D='\033[0;90m'; N='\033[0m'
BOLD='\033[1m'; DIM='\033[2m'

step() {
  local n="$1" total="$2" label="$3"
  local pct=$(( n * 100 / total ))
  local filled=$(( n * 30 / total ))
  local bar=""
  for i in $(seq 1 $filled); do bar="${bar}█"; done
  for i in $(seq $((filled+1)) 30); do bar="${bar}░"; done
  clear 2>/dev/null || true
  echo
  echo -e "  ${G}▓▒░${N} ${BOLD}${W}OBSIDIAN PANEL${N} ${DIM}·  Installer${N}"
  echo -e "  ${G}────────────────────────────────${N}"
  echo
  echo -e "  ${G}[${bar}]${N} ${DIM}${pct}%${N}  ${W}${n}/${total}${N}  ${BOLD}${label}${N}"
  echo
  echo -e "  ${D}────────────────────────────────────────────────${N}"
  echo
}

ok()   { echo -e "  ${G}✔${N}  $1"; }
fail() { echo -e "  ${R}✖  $1${N}"; exit 1; }
warn() { echo -e "  ${Y}⚠${N}  $1"; }
info() { echo -e "  ${D}→${N}  ${DIM}$1${N}"; }
run() {
  local label="$1"; shift
  info "$label"
  if "$@" >> /tmp/obsidian-install.log 2>&1; then ok "$label"
  else fail "$label (Details in /tmp/obsidian-install.log)"; fi
}

# Root-Rechte prüfen
[ "$EUID" -ne 0 ] && { echo -e "${R}Please run as root (sudo).${N}"; exit 1; }

# OS prüfen
. /etc/os-release 2>/dev/null || true
case "${ID:-}" in debian|ubuntu) ;; *) fail "Debian or Ubuntu required." ;; esac

{
# --------------------------------------------------
# STEP 1: Dependencies
# --------------------------------------------------
step 1 $TOTAL_STEPS "Install Dependencies"
info "${PRETTY_NAME:-Debian/Ubuntu}"
run "apt update" apt-get update -qq
run "git, curl & utilities" apt-get install -y -qq curl wget git gnupg ca-certificates lsb-release tar unzip openssl

# --------------------------------------------------
# STEP 2: Deploy Panel Files
# --------------------------------------------------
step 2 $TOTAL_STEPS "Deploy Panel Files"
run "Configure git safe directory" git config --global --add safe.directory "$PANEL_DIR/panel"

if [ ! -d "$PANEL_DIR/panel/.git" ]; then
  run "Create dir" mkdir -p "$PANEL_DIR/panel"
  run "Clone repository" git clone "$REPO_URL" "$PANEL_DIR/panel"
else
  warn "Directory already initialized"
  info "Updating repository..."
  run "git pull" bash -c "cd $PANEL_DIR/panel && git fetch --all && git reset --hard origin/main"
fi

# In das Panel-Verzeichnis wechseln
cd "$PANEL_DIR/panel"

# --------------------------------------------------
# STEP 3: Install Docker & Docker Compose
# --------------------------------------------------
step 3 $TOTAL_STEPS "Install Docker Engine"
if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  warn "Docker & Compose already installed"
else
  run "Fetch Docker install script" curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  run "Install Docker" sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  run "Enable Docker" systemctl enable --now docker
fi

# --------------------------------------------------
# STEP 4: Setup Security & Non-Root
# --------------------------------------------------
step 4 $TOTAL_STEPS "Configure Security & Non-Root"
if ! id "obsidian" &>/dev/null; then
  run "Create obsidian system user" useradd -r -s /bin/false obsidian
else
  warn "User 'obsidian' already exists"
fi

run "Add to Docker group" usermod -aG docker obsidian
run "Create servers directory" mkdir -p /opt/obsidian-panel/servers
run "Create panel database directory" mkdir -p "$PANEL_DIR/panel/data"
run "Set directory owner" chown -R obsidian:docker /opt/obsidian-panel
run "Set permissions" chmod -R 770 /opt/obsidian-panel

# --------------------------------------------------
# STEP 5: Configuration (.env)
# --------------------------------------------------
step 5 $TOTAL_STEPS "Setup Configuration"

# Bestehende Konfiguration laden falls existent, um Werte zu erhalten
if [ -f .env ]; then
  # .env Variablen exportieren, um sie in diesem Skript zu nutzen
  set -a
  source .env
  set +a
  warn "Bestehende Konfiguration geladen (Passwort & Port bleiben unverändert)."
else
  # Zufälliges JWT Secret generieren
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "obsidian_default_secret_key_12345")

  # Nur abfragen, wenn interaktiv und Variablen nicht übergeben wurden
  if [ -c /dev/tty ]; then
    clear
    echo
    echo -e "  ${G}▓▒░${N} ${BOLD}${W}OBSIDIAN PANEL${N} ${DIM}·  Configuration${N}"
    echo -e "  ${G}────────────────────────────────${N}"
    echo
    
    if [ -z "$ADMIN_PASSWORD" ]; then
      printf "  ${BOLD}${W}Initiales Admin-Passwort${N} [Standard: obsidian123]: "
      read -r ans < /dev/tty
      ADMIN_PASSWORD="${ans:-obsidian123}"
    fi
    
    printf "  ${BOLD}${W}Web-Interface Port${N} [Standard: 8080]: "
    read -r ans < /dev/tty
    PANEL_PORT="${ans:-8080}"
  else
    # Nicht interaktives Fallback
    ADMIN_PASSWORD="${ADMIN_PASSWORD:-obsidian123}"
  fi
fi

cat > .env << EOF
PANEL_PORT=$PANEL_PORT
ADMIN_PASSWORD=$ADMIN_PASSWORD
JWT_SECRET=$JWT_SECRET
EOF
chmod 600 .env
chown obsidian:docker .env
ok "Configuration saved"

# --------------------------------------------------
# STEP 6: Launch Panel
# --------------------------------------------------
step 6 $TOTAL_STEPS "Start Obsidian Panel"
run "Launch docker-compose" docker compose up -d --build

} 2>&1 | tee /tmp/obsidian-install.log

IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
clear 2>/dev/null || true
echo
echo -e "  ${G}▓▒░${N} ${BOLD}${W}OBSIDIAN PANEL${N} ${DIM}·  Installation Complete${N}"
echo -e "  ${G}────────────────────────────────────────────────${N}"
echo
echo -e "  ${G}✔${N}  ${BOLD}Das Obsidian Panel wurde erfolgreich gestartet!${N}"
echo
echo -e "  ${D}Web-Interface:${N}  ${W}http://${IP}:${PANEL_PORT}${N}"
echo -e "  ${D}Login:${N}          ${W}admin${N}"
echo -e "  ${D}Passwort:${N}       ${W}${ADMIN_PASSWORD}${N}"
echo
echo -e "  ${D}Minecraft-Ordner:${N} ${W}/opt/obsidian-panel/servers/${N}"
echo -e "  ${D}Installations-Log:${N} ${W}/tmp/obsidian-install.log${N}"
echo
echo -e "  ${D}Befehle zur Container-Verwaltung:${N}"
echo -e "  cd $PANEL_DIR/panel"
echo -e "  docker compose ps"
echo -e "  docker compose logs -f"
echo -e "  docker compose restart"
echo
