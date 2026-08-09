# ==========================================
# 1. Frontend Build-Stage
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ .
RUN npm run build

# ==========================================
# 2. Backend Build-Stage (Kompiliert TypeScript)
# ==========================================
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --no-audit --no-fund
COPY backend/ .
RUN npm run build

# ==========================================
# 3. Production Runner-Stage (Schlankes Laufzeit-Image)
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Erstelle Verzeichnisse für Daten und Minecraft Server-Dateien
RUN mkdir -p /app/data /opt/obsidian-panel/servers

# Nur Produktions-Abhängigkeiten für das Backend installieren (spart enorm viel Platz)
COPY backend/package*.json ./
RUN npm install --only=production --no-audit --no-fund

# Kopiere das kompilierte Backend-JS aus Stage 2
COPY --from=backend-builder /app/backend/dist ./dist

# Kopiere das kompilierte React-Frontend aus Stage 1
COPY --from=frontend-builder /app/frontend/dist ./public

# Setze Umgebungsvariablen
ENV PORT=8080
ENV NODE_ENV=production

# Port freigeben
EXPOSE 8080

# Starte das Backend
CMD ["node", "dist/index.js"]
