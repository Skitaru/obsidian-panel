import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { initDb } from './db';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import serversRouter from './routes/servers';

dotenv.config();

// SQLite Datenbank initialisieren und Tabellen erstellen/prüfen
initDb();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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
  
  ws.send(JSON.stringify({ type: 'info', message: 'Connected to Obsidian Panel WebSocket' }));

  ws.on('message', (message) => {
    console.log(`Received message: ${message}`);
    // Hier wird später der Konsolenbefehl an den Minecraft Container weitergeleitet
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(` Obsidian Panel API läuft auf Port: ${PORT}`);
  console.log(` Modus: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=====================================================`);
});
