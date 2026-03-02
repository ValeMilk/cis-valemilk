import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PerfilEnum } from '../types/enums';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    perfil: PerfilEnum;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido ou expirado' });
  }
};

export const requireRole = (...allowedRoles: PerfilEnum[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    if (!allowedRoles.includes(req.user.perfil)) {
      return res.status(403).json({ message: 'Permissão negada' });
    }

    next();
  };
};
