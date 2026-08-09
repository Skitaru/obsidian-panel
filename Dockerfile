# ==========================================
# 1. Frontend Build-Stage
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
# Nutzt npm install da im Repository standardmäßig keine lockfiles erzwungen werden
RUN npm install --no-audit --no-fund
COPY frontend/ .
RUN npm run build

# ==========================================
# 2. Backend Build- & Runner-Stage
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Erstelle Verzeichnisse für Daten und Minecraft Server-Dateien
RUN mkdir -p /app/data /opt/obsidian-panel/servers

# Backend-Abhängigkeiten installieren
COPY backend/package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Kopiere Backend-Dateien
COPY backend/ .

# Kopiere das kompilierte React-Frontend in den statischen Ordner des Backends
COPY --from=frontend-builder /app/frontend/dist /app/public

# Setze Umgebungsvariablen
ENV PORT=8080
ENV NODE_ENV=production

# Port freigeben
EXPOSE 8080

# Starte das Backend
CMD ["node", "dist/index.js"]
