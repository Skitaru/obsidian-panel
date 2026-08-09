import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Alle Routen hier benötigen Authentifizierung und Admin-Rechte
router.use(authenticateToken as any);
router.use(requireAdmin as any);

// GET /api/users - Alle Benutzer auflisten
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const users = db.prepare('SELECT id, username, role, created_at, updated_at FROM users ORDER BY username ASC').all();
    res.json({ users });
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzer:', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Abrufen der Benutzerliste.' });
  }
});

// POST /api/users - Neuen Benutzer erstellen
router.post('/', (req: AuthRequest, res: Response) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Benutzername, Passwort und Rolle sind erforderlich.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
  }

  if (!['ADMIN', 'OPERATOR', 'VIEWER'].includes(role)) {
    return res.status(400).json({ error: 'Ungültige Rolle. Erlaubt sind: ADMIN, OPERATOR, VIEWER.' });
  }

  try {
    // Prüfen, ob der Benutzer bereits existiert
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Dieser Benutzername ist bereits vergeben.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run(username, hash, role);

    res.status(201).json({
      success: true,
      message: 'Benutzer erfolgreich erstellt.',
      user: {
        id: result.lastInsertRowid,
        username,
        role
      }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Benutzers:', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Erstellen des Benutzers.' });
  }
});

// DELETE /api/users/:id - Einen Benutzer löschen
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.id);

  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Ungültige Benutzer-ID.' });
  }

  // Verhindern, dass sich der Admin selbst löscht
  if (userId === req.user!.id) {
    return res.status(400).json({ error: 'Du kannst dein eigenes Administratorkonto nicht löschen.' });
  }

  try {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    }

    res.json({ success: true, message: 'Benutzer erfolgreich gelöscht.' });
  } catch (error) {
    console.error('Fehler beim Löschen des Benutzers:', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Löschen des Benutzers.' });
  }
});

export default router;
