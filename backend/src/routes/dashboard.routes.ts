import { Router } from 'express';
import { Pedido } from '../models/Pedido';
import { authMiddleware } from '../middleware/auth';
import { StatusPedido } from '../types/enums';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    // Total de pedidos
    const totalPedidos = await Pedido.countDocuments();

    // Pedidos por status
    const pedidosPorStatus = await Pedido.aggregate([
      {
        $group: {
          _id: '$status_atual',
          count: { $sum: 1 },
          valor_total: { $sum: '$valor_total' }
        }
      }
    ]);

    // Pedidos em aberto (não concluídos/cancelados)
    const statusAberto = [
      StatusPedido.RASCUNHO,
      StatusPedido.AGUARDANDO_APROVACAO,
      StatusPedido.APROVADO,
      StatusPedido.ENVIADO,
      StatusPedido.CONFIRMADO,
      StatusPedido.RECEBIDO_PARCIAL
    ];

    const pedidosEmAberto = await Pedido.countDocuments({
      status_atual: { $in: statusAberto }
    });

    const valorTotalAberto = await Pedido.aggregate([
      { $match: { status_atual: { $in: statusAberto } } },
      { $group: { _id: null, total: { $sum: '$valor_total' } } }
    ]);

    // Pedidos aguardando aprovação
    const pedidosAguardandoAprovacao = await Pedido.countDocuments({
      status_atual: StatusPedido.AGUARDANDO_APROVACAO
    });

    // Top fornecedores
    const topFornecedores = await Pedido.aggregate([
      {
        $group: {
          _id: '$fornecedor',
          total_pedidos: { $sum: 1 },
          valor_total: { $sum: '$valor_total' }
        }
      },
      { $sort: { valor_total: -1 } },
      { $limit: 5 }
    ]);

    // Pedidos recentes
    const pedidosRecentes = await Pedido.find()
      .sort({ data_criacao: -1 })
      .limit(10)
      .select ('numero fornecedor status_atual valor_total data_criacao');

    res.json({
      total_pedidos: totalPedidos,
      pedidos_em_aberto: pedidosEmAberto,
      pedidos_aguardando_aprovacao: pedidosAguardandoAprovacao,
      valor_total_aberto: valorTotalAberto[0]?.total || 0,
      pedidos_por_status: pedidosPorStatus,
      top_fornecedores: topFornecedores,
      pedidos_recentes: pedidosRecentes
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do dashboard' });
  }
});

export default router;
