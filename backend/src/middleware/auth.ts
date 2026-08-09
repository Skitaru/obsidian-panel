import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'obsidian_default_secret_key_12345';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  };
}

// Authentifizierungsmiddleware zur Validierung des JWT-Tokens
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'Kein Token bereitgestellt. Zugriff verweigert.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Ungültiges oder abgelaufenes Token.' });
    }
    
    req.user = decoded as AuthRequest['user'];
    next();
  });
}

// Middleware zur Prüfung von Admin-Rechten
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administratorrechte erforderlich.' });
  }
  next();
}

// Middleware zur Prüfung von Operator- oder Admin-Rechten (z.B. für Server-Aktionen)
export function requireOperator(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'OPERATOR')) {
    return res.status(403).json({ error: 'Operator- oder Administratorrechte erforderlich.' });
  }
  next();
}
