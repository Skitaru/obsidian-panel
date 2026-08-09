import { Router, Response } from 'express';
import db from '../db';
import { authenticateToken, requireOperator, requireAdmin, AuthRequest } from '../middleware/auth';
import { 
  createMinecraftContainer, 
  startServer, 
  stopServer, 
  deleteServerContainer, 
  getContainerState,
  getContainerStats,
  sendServerCommand
} from '../services/docker';

const router = Router();

// Alle Server-Routen benötigen Authentifizierung
router.use(authenticateToken as any);

// Hilfsfunktion zur Prüfung des Server-Zugriffs für Nicht-Admins
function checkServerPermission(userId: number, role: string, serverId: number, requiredLevel: 'READ_ONLY' | 'READ_WRITE' | 'OWNER'): boolean {
  if (role === 'ADMIN') return true;

  const perm = db.prepare('SELECT permission FROM user_servers WHERE user_id = ? AND server_id = ?')
    .get(userId, serverId) as { permission: string } | undefined;

  if (!perm) return false;

  const levels = ['READ_ONLY', 'READ_WRITE', 'OWNER'];
  const userLevelIdx = levels.indexOf(perm.permission);
  const requiredLevelIdx = levels.indexOf(requiredLevel);

  return userLevelIdx >= requiredLevelIdx;
}

// GET /api/servers - Alle für den Benutzer sichtbaren Server auflisten
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    let servers: any[] = [];
    
    if (req.user!.role === 'ADMIN') {
      // Admins sehen alle Server
      servers = db.prepare('SELECT * FROM servers ORDER BY name ASC').all();
    } else {
      // Normale Nutzer sehen nur Server, für die sie Berechtigungen haben
      servers = db.prepare(`
        SELECT s.*, us.permission 
        FROM servers s 
        JOIN user_servers us ON s.id = us.server_id 
        WHERE us.user_id = ?
        ORDER BY s.name ASC
      `).all(req.user!.id);
    }

    // Aktualisiere dynamisch den Status direkt aus Docker für jeden Server
    const serversWithStatus = await Promise.all(servers.map(async (srv) => {
      if (srv.container_id) {
        const liveStatus = await getContainerState(srv.container_id);
        
        // Status in DB aktualisieren falls abweichend
        if (liveStatus !== srv.status) {
          db.prepare('UPDATE servers SET status = ? WHERE id = ?').run(liveStatus, srv.id);
          srv.status = liveStatus;
        }
      }
      return srv;
    }));

    res.json({ servers: serversWithStatus });
  } catch (error) {
    console.error('Fehler beim Abrufen der Server:', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Abrufen der Server.' });
  }
});

// GET /api/servers/:id - Einzelnen Server abrufen
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const serverId = Number(req.params.id);
  if (isNaN(serverId)) return res.status(400).json({ error: 'Ungültige Server-ID.' });

  if (!checkServerPermission(req.user!.id, req.user!.role, serverId, 'READ_ONLY')) {
    return res.status(403).json({ error: 'Keine Berechtigung für diesen Server.' });
  }

  try {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as any;
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    // Live-Status holen
    if (server.container_id) {
      server.status = await getContainerState(server.container_id);
    }

    res.json({ server });
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Abrufen des Servers.' });
  }
});

// POST /api/servers - Neuen Minecraft-Server erstellen (Nur Operator & Admin)
router.post('/', requireOperator as any, async (req: AuthRequest, res: Response) => {
  const { name, type, version, maxRam, port } = req.body;

  if (!name || !type || !version || !maxRam || !port) {
    return res.status(400).json({ error: 'Name, Typ (VANILLA/PAPER/FABRIC), Version, RAM und Port sind erforderlich.' });
  }

  if (!['VANILLA', 'PAPER', 'FABRIC'].includes(type)) {
    return res.status(400).json({ error: 'Ungültiger Typ. Erlaubt sind: VANILLA, PAPER, FABRIC.' });
  }

  try {
    // Prüfen, ob der Port bereits vergeben ist
    const portInUse = db.prepare('SELECT id FROM servers WHERE port = ?').get(port);
    if (portInUse) {
      return res.status(400).json({ error: `Der Port ${port} wird bereits von einem anderen Server verwendet.` });
    }

    // 1. Server-Datensatz in DB anlegen (vorübergehend ohne Container ID)
    const result = db.prepare(`
      INSERT INTO servers (name, type, version, max_ram, max_cpu, port, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, version, maxRam, 100, port, 'OFFLINE');

    const serverId = Number(result.lastInsertRowid);

    // 2. Docker-Container erstellen
    console.log(`Erstelle Docker Container für Server '${name}' (ID: ${serverId})...`);
    const containerId = await createMinecraftContainer(serverId, name, type, version, maxRam, port);

    // 3. DB-Eintrag mit der echten Container-ID aktualisieren
    db.prepare('UPDATE servers SET container_id = ? WHERE id = ?').run(containerId, serverId);

    // 4. Wenn der Ersteller kein Admin ist, ihm volle Rechte (OWNER) für diesen Server geben
    if (req.user!.role !== 'ADMIN') {
      db.prepare('INSERT INTO user_servers (user_id, server_id, permission) VALUES (?, ?, ?)')
        .run(req.user!.id, serverId, 'OWNER');
    }

    res.status(201).json({
      success: true,
      message: 'Minecraft Server erfolgreich erstellt und registriert.',
      server: {
        id: serverId,
        name,
        type,
        version,
        port,
        container_id: containerId,
        status: 'OFFLINE'
      }
    });

  } catch (error: any) {
    console.error('Fehler bei der Servererstellung:', error);
    res.status(500).json({ error: `Fehler beim Erstellen des Minecraft-Servers: ${error.message || error}` });
  }
});

// POST /api/servers/:id/start - Server starten
router.post('/:id/start', async (req: AuthRequest, res: Response) => {
  const serverId = Number(req.params.id);
  if (!checkServerPermission(req.user!.id, req.user!.role, serverId, 'READ_WRITE')) {
    return res.status(403).json({ error: 'Keine Berechtigung zum Starten dieses Servers.' });
  }

  try {
    const server = db.prepare('SELECT container_id, name FROM servers WHERE id = ?').get(serverId) as any;
    if (!server || !server.container_id) return res.status(404).json({ error: 'Server nicht gefunden.' });

    await startServer(server.container_id);
    db.prepare('UPDATE servers SET status = ? WHERE id = ?').run('ONLINE', serverId);

    res.json({ success: true, message: `Server '${server.name}' wird gestartet.` });
  } catch (error: any) {
    res.status(500).json({ error: `Start fehlgeschlagen: ${error.message || error}` });
  }
});

// POST /api/servers/:id/stop - Server stoppen (sicherer Shutdown)
router.post('/:id/stop', async (req: AuthRequest, res: Response) => {
  const serverId = Number(req.params.id);
  if (!checkServerPermission(req.user!.id, req.user!.role, serverId, 'READ_WRITE')) {
    return res.status(403).json({ error: 'Keine Berechtigung zum Stoppen dieses Servers.' });
  }

  try {
    const server = db.prepare('SELECT container_id, name FROM servers WHERE id = ?').get(serverId) as any;
    if (!server || !server.container_id) return res.status(404).json({ error: 'Server nicht gefunden.' });

    // Status sofort auf 'STOPPING' setzen für visuelles Feedback
    db.prepare('UPDATE servers SET status = ? WHERE id = ?').run('STOPPING', serverId);
    
    // Asynchron stoppen, um HTTP-Antwort nicht zu blockieren
    stopServer(server.container_id).then(() => {
      db.prepare('UPDATE servers SET status = ? WHERE id = ?').run('OFFLINE', serverId);
    }).catch(err => {
      console.error(`Fehler beim Stoppen von Server ${serverId}:`, err);
    });

    res.json({ success: true, message: `Server '${server.name}' wird heruntergefahren.` });
  } catch (error: any) {
    res.status(500).json({ error: `Stop fehlgeschlagen: ${error.message || error}` });
  }
});

// POST /api/servers/:id/command - Konsolenbefehl senden (z.B. /op, /list)
router.post('/:id/command', async (req: AuthRequest, res: Response) => {
  const serverId = Number(req.params.id);
  const { command } = req.body;

  if (!command) return res.status(400).json({ error: 'Befehl fehlt.' });

  if (!checkServerPermission(req.user!.id, req.user!.role, serverId, 'READ_WRITE')) {
    return res.status(403).json({ error: 'Keine Berechtigung zum Senden von Befehlen an diesen Server.' });
  }

  try {
    const server = db.prepare('SELECT container_id FROM servers WHERE id = ?').get(serverId) as any;
    if (!server || !server.container_id) return res.status(404).json({ error: 'Server nicht gefunden.' });

    await sendServerCommand(server.container_id, command);
    res.json({ success: true, message: 'Befehl erfolgreich gesendet.' });
  } catch (error: any) {
    res.status(500).json({ error: `Befehl konnte nicht gesendet werden: ${error.message || error}` });
  }
});

// GET /api/servers/:id/stats - CPU & RAM Auslastung abfragen
router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  const serverId = Number(req.params.id);

  if (!checkServerPermission(req.user!.id, req.user!.role, serverId, 'READ_ONLY')) {
    return res.status(403).json({ error: 'Keine Berechtigung zum Abrufen der Server-Statistiken.' });
  }

  try {
    const server = db.prepare('SELECT container_id, status FROM servers WHERE id = ?').get(serverId) as any;
    if (!server || !server.container_id) return res.status(404).json({ error: 'Server nicht gefunden.' });

    if (server.status !== 'ONLINE') {
      return res.json({ cpuPercent: 0, ramUsedMB: 0 });
    }

    const stats = await getContainerStats(server.container_id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Fehler beim Abrufen der Container-Statistiken.' });
  }
});

// DELETE /api/servers/:id - Server löschen (Nur Admin)
router.delete('/:id', requireAdmin as any, async (req: AuthRequest, res: Response) => {
  const serverId = Number(req.params.id);

  try {
    const server = db.prepare('SELECT container_id, name FROM servers WHERE id = ?').get(serverId) as any;
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden.' });

    // 1. Docker Container stoppen & löschen
    if (server.container_id) {
      console.log(`Lösche Docker Container für Server '${server.name}'...`);
      await deleteServerContainer(server.container_id);
    }

    // 2. Aus SQLite löschen (Benutzerberechtigungen werden durch ON DELETE CASCADE automatisch gelöscht)
    db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);

    // Bemerkung: Minecraft Spieldaten unter /opt/obsidian-panel/servers/srv-<id> werden absichtlich
    // nicht automatisch gelöscht, um Datenverlust zu verhindern. Admins können das Verzeichnis manuell entfernen.

    res.json({ success: true, message: `Server '${server.name}' wurde erfolgreich gelöscht. Spieldaten auf dem Host blieben unberührt.` });
  } catch (error: any) {
    console.error('Fehler beim Löschen des Servers:', error);
    res.status(500).json({ error: `Serverlöschung fehlgeschlagen: ${error.message || error}` });
  }
});

export default router;
