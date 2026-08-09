import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import jwt from 'jsonwebtoken';

import db, { initDb } from './db';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import serversRouter from './routes/servers';
import { streamContainerLogs } from './services/docker';

dotenv.config();

// SQLite Datenbank initialisieren und Tabellen erstellen/prüfen
initDb();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const JWT_SECRET = process.env.JWT_SECRET || 'obsidian_default_secret_key_12345';

app.use(cors());
app.use(express.json());

// API Routen einbinden
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/servers', serversRouter);

// Basis REST Endpunkt
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Obsidian Panel Backend is running', db: 'SQLite connected' });
});

// Statische Frontend-Dateien in Produktion ausliefern
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));
  
  // SPA-Routing-Fallback (leitet alle unbekannten URLs an index.html weiter)
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// WebSocket Server für Live-Konsole und Logs
wss.on('connection', (ws) => {
  console.log('Client connected via WebSocket');
  let logStream: any = null;

  ws.on('message', async (messageData) => {
    try {
      const data = JSON.parse(messageData.toString());

      if (data.type === 'subscribe') {
        const { serverId, token } = data;

        // 1. JWT verifizieren
        const decoded: any = jwt.verify(token, JWT_SECRET);
        
        // 2. Prüfen, ob der Server existiert
        const srv = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as any;
        if (!srv) {
          ws.send(JSON.stringify({ type: 'error', message: 'Server nicht gefunden.' }));
          return;
        }

        // 3. Rechte prüfen (Admins unbeschränkt, andere checken user_servers)
        if (decoded.role !== 'ADMIN') {
          const perm = db.prepare('SELECT permission FROM user_servers WHERE user_id = ? AND server_id = ?')
            .get(decoded.id, serverId);
          if (!perm) {
            ws.send(JSON.stringify({ type: 'error', message: 'Keine Berechtigung für diesen Server.' }));
            return;
          }
        }

        ws.send(JSON.stringify({ type: 'system', message: `[Obsidian] Erfolgreich verbunden mit '${srv.name}'...` }));

        if (!srv.container_id) {
          ws.send(JSON.stringify({ type: 'system', message: '[System] Container wurde noch nicht initialisiert.' }));
          return;
        }

        // 4. Logs streamen
        if (logStream) {
          logStream.destroy?.();
        }

        logStream = streamContainerLogs(srv.container_id, (logLine) => {
          ws.send(JSON.stringify({ type: 'log', message: logLine }));
        });
      }
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'error', message: `Authentifizierungsfehler: ${err.message}` }));
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
    if (logStream && logStream.destroy) {
      logStream.destroy();
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(` Obsidian Panel API läuft auf Port: ${PORT}`);
  console.log(` Modus: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=====================================================`);
});
