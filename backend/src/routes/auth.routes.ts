import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email não encontrado' });
    }

    // Check if active
    if (!user.ativo) {
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    // Generate token
    const signOptions: SignOptions = { 
      expiresIn: '24h' 
    };
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        perfil: user.perfil 
      },
      process.env.JWT_SECRET as string,
      signOptions
    );

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id).select('-hashed_password');
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({
      id: user._id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      ativo: user.ativo
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

export default router;
