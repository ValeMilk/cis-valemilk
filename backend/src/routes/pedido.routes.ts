import { Router } from 'express';
import { Pedido } from '../models/Pedido';
import { User } from '../models/User';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth';
import { StatusPedido, PerfilEnum } from '../types/enums';

const router = Router();

// Get all pedidos (with filters)
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { status, comprador_id, fornecedor } = req.query;
    const filter: any = {};

    if (status) filter.status_atual = status;
    if (comprador_id) filter.comprador_id = comprador_id;
    if (fornecedor) filter.fornecedor = new RegExp(fornecedor as string, 'i');

    const pedidos = await Pedido.find(filter)
      .sort({ data_criacao: -1 })
      .limit(100);

    res.json(pedidos);
  } catch (error) {
    console.error('Get pedidos error:', error);
    res.status(500).json({ message: 'Erro ao buscar pedidos' });
  }
});

// Get pedido by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar pedido' });
  }
});

// Create pedido
router.post('/', authMiddleware, requireRole(PerfilEnum.COMPRADOR, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Generate numero
    const count = await Pedido.countDocuments();
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const numero = `OC-${ano}-${mes}-${String(count + 1).padStart(3, '0')}`;

    const pedido = await Pedido.create({
      ...req.body,
      numero,
      comprador_id: user._id,
      comprador_nome: user.nome,
      status_atual: StatusPedido.RASCUNHO,
      historico_status: [{
        status: StatusPedido.RASCUNHO,
        usuario_id: user._id,
        usuario_nome: user.nome,
        data: new Date(),
        observacao: 'Pedido criado'
      }]
    });

    res.status(201).json(pedido);
  } catch (error) {
    console.error('Create pedido error:', error);
    res.status(500).json({ message: 'Erro ao criar pedido' });
  }
});

// Update pedido (only draft)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.RASCUNHO) {
      return res.status(400).json({ message: 'Somente rascunhos podem ser editados' });
    }

    Object.assign(pedido, req.body);
    await pedido.save();

    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar pedido' });
  }
});

// Enviar para aprovação
router.post('/:id/enviar-aprovacao', authMiddleware, requireRole(PerfilEnum.COMPRADOR, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.RASCUNHO) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.AGUARDANDO_APROVACAO;
    pedido.historico_status.push({
      status: StatusPedido.AGUARDANDO_APROVACAO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao enviar para aprovação' });
  }
});

// Aprovar pedido
router.post('/:id/aprovar', authMiddleware, requireRole(PerfilEnum.DIRETORIA, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.AGUARDANDO_APROVACAO) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.APROVADO;
    pedido.historico_status.push({
      status: StatusPedido.APROVADO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao aprovar pedido' });
  }
});

// Reprovar pedido
router.post('/:id/reprovar', authMiddleware, requireRole(PerfilEnum.DIRETORIA, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.AGUARDANDO_APROVACAO) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.REPROVADO;
    pedido.historico_status.push({
      status: StatusPedido.REPROVADO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao || 'Pedido reprovado'
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao reprovar pedido' });
  }
});

// Enviar ao fornecedor
router.post('/:id/enviar-fornecedor', authMiddleware, requireRole(PerfilEnum.COMPRADOR, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.APROVADO) {
      return res.status(400).json({ message: 'Apenas pedidos aprovados podem ser enviados' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.ENVIADO;
    pedido.historico_status.push({
      status: StatusPedido.ENVIADO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao enviar ao fornecedor' });
  }
});

// Confirmar recebimento fornecedor
router.post('/:id/confirmar', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.ENVIADO) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.CONFIRMADO;
    pedido.historico_status.push({
      status: StatusPedido.CONFIRMADO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao confirmar pedido' });
  }
});

// Receber itens
router.post('/:id/receber', authMiddleware, requireRole(PerfilEnum.RECEBIMENTO, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (![StatusPedido.CONFIRMADO, StatusPedido.RECEBIDO_PARCIAL].includes(pedido.status_atual)) {
      return res.status(400).json({ message: 'Status inválido para recebimento' });
    }

    const { itens_recebidos } = req.body;

    // Update quantities
    itens_recebidos.forEach((item: any) => {
      const pedidoItem = pedido.itens.find(i => i.item_id === item.item_id);
      if (pedidoItem) {
        pedidoItem.quantidade_recebida += item.quantidade;
      }
    });

    // Check if complete
    const allReceived = pedido.itens.every(
      item => item.quantidade_recebida >= item.quantidade_solicitada
    );

    const user = await User.findById(req.user!.id);
    pedido.status_atual = allReceived ? StatusPedido.RECEBIDO_COMPLETO : StatusPedido.RECEBIDO_PARCIAL;
    pedido.historico_status.push({
      status: pedido.status_atual,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao receber itens' });
  }
});

// Cancel pedido
router.post('/:id/cancelar', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if ([StatusPedido.RECEBIDO_COMPLETO, StatusPedido.CANCELADO].includes(pedido.status_atual)) {
      return res.status(400).json({ message: 'Pedido não pode ser cancelado' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.CANCELADO;
    pedido.historico_status.push({
      status: StatusPedido.CANCELADO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.motivo || 'Pedido cancelado'
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao cancelar pedido' });
  }
});

export default router;
