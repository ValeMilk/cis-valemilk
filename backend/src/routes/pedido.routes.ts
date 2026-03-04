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

    // Generate numero and idCompra
    const ano = new Date().getFullYear();
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Get last pedido of current month to generate next number
    const lastPedido = await Pedido.findOne({
      numero: new RegExp(`^OC-${ano}-${mes}-`)
    }).sort({ numero: -1 });

    let proximoNumero = 1;
    if (lastPedido && lastPedido.numero) {
      const match = lastPedido.numero.match(/OC-\d{4}-\d{2}-(\d{3})$/);
      if (match) {
        proximoNumero = parseInt(match[1]) + 1;
      }
    }

    const numero = `OC-${ano}-${mes}-${String(proximoNumero).padStart(3, '0')}`;
    
    // Get total count for idCompra
    const count = await Pedido.countDocuments();
    const idCompra = `PC${ano}${String(count + 1).padStart(4, '0')}`;

    const pedido = await Pedido.create({
      ...req.body,
      idCompra,
      numero,
      comprador_id: user._id,
      comprador_nome: user.nome,
      status_atual: StatusPedido.ENVIADO_FORNECEDOR,
      historico_status: [{
        status: StatusPedido.ENVIADO_FORNECEDOR,
        usuario_id: user._id,
        usuario_nome: user.nome,
        data: new Date(),
        observacao: 'Pedido criado e enviado ao fornecedor'
      }]
    });

    res.status(201).json(pedido);
  } catch (error) {
    console.error('Create pedido error:', error);
    res.status(500).json({ message: 'Erro ao criar pedido' });
  }
});

// Update pedido (only draft/awaiting approval, only comprador/diretoria)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Verificar permissões: apenas Comprador ou Diretoria
    if (user.perfil !== PerfilEnum.COMPRADOR && user.perfil !== PerfilEnum.DIRETORIA && user.perfil !== PerfilEnum.ADMIN) {
      return res.status(403).json({ message: 'Sem permissão para editar pedidos' });
    }

    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    // Verificar status: apenas ENVIADO_FORNECEDOR
    if (pedido.status_atual !== StatusPedido.ENVIADO_FORNECEDOR) {
      return res.status(400).json({ message: 'Pedido não pode ser editado neste status' });
    }

    // Identificar campos alterados
    const camposAlterados: string[] = [];
    const camposParaVerificar = [
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'local_entrega', label: 'Local de Entrega' },
      { key: 'observacoes', label: 'Observações' },
      { key: 'itens', label: 'Itens do Pedido' }
    ];

    camposParaVerificar.forEach(campo => {
      if (JSON.stringify((pedido as any)[campo.key]) !== JSON.stringify(req.body[campo.key])) {
        camposAlterados.push(campo.label);
      }
    });

    // Atualizar pedido
    Object.assign(pedido, req.body);

    // Adicionar ao histórico de edições
    if (camposAlterados.length > 0) {
      if (!pedido.historico_edicoes) {
        pedido.historico_edicoes = [];
      }
      pedido.historico_edicoes.push({
        usuario_id: user._id,
        usuario_nome: user.nome,
        data: new Date(),
        campos_alterados: camposAlterados,
        observacao: req.body.observacao_edicao || undefined
      });
    }

    await pedido.save();

    res.json(pedido);
  } catch (error) {
    console.error('Update pedido error:', error);
    res.status(500).json({ message: 'Erro ao atualizar pedido' });
  }
});

// Aguardando faturamento
router.post('/:id/aguardando-faturamento', authMiddleware, requireRole(PerfilEnum.COMPRADOR, PerfilEnum.DIRETORIA, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.ENVIADO_FORNECEDOR) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.AGUARDANDO_FATURAMENTO;
    pedido.historico_status.push({
      status: StatusPedido.AGUARDANDO_FATURAMENTO,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

// Em rota
router.post('/:id/em-rota', authMiddleware, requireRole(PerfilEnum.COMPRADOR, PerfilEnum.DIRETORIA, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.AGUARDANDO_FATURAMENTO) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.EM_ROTA;
    pedido.historico_status.push({
      status: StatusPedido.EM_ROTA,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar status' });
  }
});

// Recebimento de nota
router.post('/:id/recebimento-nota', authMiddleware, requireRole(PerfilEnum.COMPRADOR, PerfilEnum.DIRETORIA, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.EM_ROTA) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.RECEBIMENTO_NOTA;
    pedido.historico_status.push({
      status: StatusPedido.RECEBIMENTO_NOTA,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao registrar recebimento' });
  }
});

// Aprovar pela diretoria (final)
router.post('/:id/aprovar-diretoria', authMiddleware, requireRole(PerfilEnum.DIRETORIA, PerfilEnum.ADMIN), async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if (pedido.status_atual !== StatusPedido.RECEBIMENTO_NOTA) {
      return res.status(400).json({ message: 'Status inválido para esta ação' });
    }

    const user = await User.findById(req.user!.id);
    pedido.status_atual = StatusPedido.APROVADO_DIRETORIA;
    pedido.historico_status.push({
      status: StatusPedido.APROVADO_DIRETORIA,
      usuario_id: user!._id,
      usuario_nome: user!.nome,
      data: new Date(),
      observacao: req.body.observacao || 'Pedido aprovado pela diretoria'
    });

    await pedido.save();
    res.json(pedido);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao aprovar pedido' });
  }
});

// Cancel pedido
router.post('/:id/cancelar', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) {
      return res.status(404).json({ message: 'Pedido não encontrado' });
    }

    if ([StatusPedido.APROVADO_DIRETORIA, StatusPedido.CANCELADO].includes(pedido.status_atual)) {
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
