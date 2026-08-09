import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'obsidian_default_secret_key_12345';

// POST /api/auth/login - Benutzer-Anmeldung
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort sind erforderlich.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user) {
      return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Ungültiger Benutzername oder Passwort.' });
    }

    // JWT signieren (Gültig für 7 Tage)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Fehler bei Login:', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Login.' });
  }
});

// GET /api/auth/me - Aktuellen Benutzer abrufen
router.get('/me', authenticateToken as any, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert.' });
  }
  res.json({ user: req.user });
});

// POST /api/auth/change-password - Passwort ändern (für den aktuell angemeldeten User)
router.post('/change-password', authenticateToken as any, (req: AuthRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Altes und neues Passwort sind erforderlich.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein.' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;

    const passwordMatch = bcrypt.compareSync(oldPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'Das alte Passwort ist nicht korrekt.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newHash, req.user!.id);

    res.json({ success: true, message: 'Passwort erfolgreich geändert.' });
  } catch (error) {
    console.error('Fehler beim Passwort ändern:', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Ändern des Passworts.' });
  }
});

export default router;
