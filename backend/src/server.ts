import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database';
import authRoutes from './routes/auth.routes';
import pedidoRoutes from './routes/pedido.routes';
import itemRoutes from './routes/item.routes';
import dashboardRoutes from './routes/dashboard.routes';
import fornecedorRoutes from './routes/fornecedor.routes';
import inventarioRoutes from './routes/inventario.routes';
import inventarioFilialRoutes from './routes/inventario-filial.routes';
import avariaRoutes from './routes/avaria.routes';
import reposicaoRoutes from './routes/reposicao.routes';
import estoqueVencimentoRoutes from './routes/estoque-vencimento.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/fornecedores', fornecedorRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/inventario-filial', inventarioFilialRoutes);
app.use('/api/avaria', avariaRoutes);
app.use('/api/reposicao', reposicaoRoutes);
app.use('/api/estoque-vencimento', estoqueVencimentoRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CIS Backend Running',
    timestamp: new Date().toISOString()
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
};

startServer();

export default app;
