import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Sicherstellen, dass das Daten-Verzeichnis existiert
const dbDir = path.dirname(process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('file:', '') : path.join(__dirname, '../data'));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('file:', '') 
  : path.join(__dirname, '../data/obsidian.db');

console.log(`Verbinde mit SQLite Datenbank unter: ${dbPath}`);
const db = new Database(dbPath);

// Tabellen initialisieren & Schema-Updates durchführen
export function initDb() {
  // 1. Tabelle für Benutzer
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('ADMIN', 'OPERATOR', 'VIEWER')) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Tabelle für Server (mit allen neuen UI-Features aus dem Screenshot!)
  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      container_id TEXT UNIQUE,
      type TEXT CHECK(type IN ('VANILLA', 'PAPER', 'FABRIC')) NOT NULL,
      version TEXT NOT NULL,
      status TEXT CHECK(status IN ('ONLINE', 'OFFLINE', 'STARTING', 'STOPPING')) DEFAULT 'OFFLINE',
      max_ram INTEGER NOT NULL,            -- in MB (z.B. 4096)
      max_cpu INTEGER NOT NULL,            -- CPU in % (Standard: 100)
      port INTEGER UNIQUE NOT NULL,        -- Minecraft Port (Standard: 25565)
      max_players INTEGER DEFAULT 20,       -- Max Players Limit
      voice_port INTEGER DEFAULT NULL,     -- Voice Port (SimpleVoiceChat UDP)
      difficulty TEXT CHECK(difficulty IN ('peaceful', 'easy', 'normal', 'hard')) DEFAULT 'normal',
      hardcore BOOLEAN DEFAULT 0,          -- Hardcore-Modus (0 oder 1)
      jvm_args TEXT DEFAULT NULL,          -- Benutzerdefinierte JVM-Startargumente
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Schema Migration: Spalten hinzufügen, falls sie in einer älteren DB fehlen
  const columns = db.prepare("PRAGMA table_info(servers)").all() as any[];
  const colNames = columns.map(c => c.name);

  if (!colNames.includes('max_players')) {
    db.exec("ALTER TABLE servers ADD COLUMN max_players INTEGER DEFAULT 20");
  }
  if (!colNames.includes('voice_port')) {
    db.exec("ALTER TABLE servers ADD COLUMN voice_port INTEGER DEFAULT NULL");
  }
  if (!colNames.includes('difficulty')) {
    db.exec("ALTER TABLE servers ADD COLUMN difficulty TEXT CHECK(difficulty IN ('peaceful', 'easy', 'normal', 'hard')) DEFAULT 'normal'");
  }
  if (!colNames.includes('hardcore')) {
    db.exec("ALTER TABLE servers ADD COLUMN hardcore BOOLEAN DEFAULT 0");
  }
  if (!colNames.includes('jvm_args')) {
    db.exec("ALTER TABLE servers ADD COLUMN jvm_args TEXT DEFAULT NULL");
  }

  // 3. Tabelle für Benutzer-Server Berechtigungen
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      server_id INTEGER NOT NULL,
      permission TEXT CHECK(permission IN ('OWNER', 'READ_WRITE', 'READ_ONLY')) NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      UNIQUE(user_id, server_id)
    )
  `);

  // Standard-Admin anlegen, falls noch keine Benutzer existieren
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'obsidian123';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(adminPassword, salt);
    
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run('admin', hash, 'ADMIN');
      
    console.log('=====================================================');
    console.log('INITIALER ADMIN-NUTZER WURDE ERSTELLT!');
    console.log('Benutzername: admin');
    console.log(`Passwort: ${adminPassword}`);
    console.log('=====================================================');
  }
}

export default db;
