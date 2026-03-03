import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PerfilEnum } from '../types/enums';

const router = Router();

// Middleware to check if user is admin
const adminMiddleware = async (req: AuthRequest, res: any, next: any) => {
  if (req.user?.perfil !== PerfilEnum.ADMIN) {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Get active users for login (public endpoint)
router.get('/active-users', async (req, res) => {
  try {
    const users = await User.find({ ativo: true })
      .select('nome email')
      .sort({ nome: 1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ message: 'Erro ao buscar usuários' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email ou senha inválidos' });
    }

    // Check if active
    if (!user.ativo) {
      return res.status(403).json({ message: 'Usuário inativo' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.hashed_password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Email ou senha inválidos' });
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

// ========== ADMIN ROUTES ==========

// List all users (admin only)
router.get('/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const users = await User.find().select('-hashed_password').sort({ nome: 1 });
    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: 'Erro ao listar usuários' });
  }
});

// Create user (admin only)
router.post('/users', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { nome, email, perfil, password } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Create user with hashed password
    const user = new User({
      nome,
      email,
      perfil,
      hashed_password: await bcrypt.hash(password, 10),
      ativo: true
    });

    await user.save();

    res.status(201).json({
      id: user._id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      ativo: user.ativo
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Erro ao criar usuário' });
  }
});

// Update user (admin only)
router.put('/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const { nome, email, perfil, ativo, password } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Check if email is being changed and if it already exists
    if (email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email já cadastrado' });
      }
    }

    // Update password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Senha deve ter no mínimo 6 caracteres' });
      }
      user.hashed_password = await bcrypt.hash(password, 10);
    }

    user.nome = nome;
    user.email = email;
    user.perfil = perfil;
    user.ativo = ativo;

    await user.save();

    res.json({
      id: user._id,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      ativo: user.ativo
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Erro ao atualizar usuário' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ message: 'Você não pode excluir sua própria conta' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Erro ao excluir usuário' });
  }
});

export default router;
