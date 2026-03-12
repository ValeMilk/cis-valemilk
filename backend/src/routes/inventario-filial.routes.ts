import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { executeERPQuery, getInventarioFilialQuery, ERPInventarioFilialItem } from '../services/erp.service';
import { InventarioFilial, IInventarioFilialItem } from '../models/InventarioFilial';
import { User } from '../models/User';

const router = Router();

const parseFormattedNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  return parseFloat(value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

// GET - Buscar inventário filial ativo
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const inventario = await InventarioFilial.findOne({ status: 'em_andamento' }).sort({ data_snapshot: -1 });
    res.json(inventario || null);
  } catch (error) {
    console.error('❌ Erro ao buscar inventário filial:', error);
    res.status(500).json({ message: 'Erro ao buscar inventário filial' });
  }
});

// POST - Carregar dados do ERP
router.post('/sync-erp', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;

    const erpItems = await executeERPQuery<ERPInventarioFilialItem>(getInventarioFilialQuery());
    console.log(`✅ ${erpItems.length} itens de inventário filial carregados do ERP`);

    const itens: IInventarioFilialItem[] = erpItems.map(erpItem => {
      const deposito2 = parseFormattedNumber(erpItem['Depósito 2']);
      return {
        codigo_item: String(erpItem.Cod || '').trim(),
        descricao: erpItem.Descricao,
        tipo: erpItem.Tipo,
        unidade_medida: erpItem.UN || '',
        deposito_2: deposito2,
        quantidade_real: null,
        avariado: null,
        quantidade_real_data: undefined,
        quantidade_real_usuario: undefined,
        avariado_data: undefined,
        avariado_usuario: undefined
      };
    });

    const inventarioExistente = await InventarioFilial.findOne({ status: 'em_andamento' });

    if (inventarioExistente) {
      const contagensMap = new Map<string, { quantidade_real: number | null; avariado: number | null; qr_data?: Date; qr_usuario?: string; av_data?: Date; av_usuario?: string; observacao?: string }>();
      for (const item of inventarioExistente.itens) {
        const temContagem = (item as any).quantidade_real !== null || (item as any).avariado !== null;
        const temObs = (item as any).observacao && (item as any).observacao.trim() !== '';
        if (temContagem || temObs) {
          contagensMap.set(item.codigo_item, {
            quantidade_real: (item as any).quantidade_real,
            avariado: (item as any).avariado,
            qr_data: (item as any).quantidade_real_data,
            qr_usuario: (item as any).quantidade_real_usuario,
            av_data: (item as any).avariado_data,
            av_usuario: (item as any).avariado_usuario,
            observacao: (item as any).observacao
          });
        }
      }

      const itensAtualizados = itens.map(item => {
        const contagemExistente = contagensMap.get(item.codigo_item);
        if (contagemExistente) {
          return {
            ...item,
            quantidade_real: contagemExistente.quantidade_real,
            avariado: contagemExistente.avariado,
            quantidade_real_data: contagemExistente.qr_data,
            quantidade_real_usuario: contagemExistente.qr_usuario,
            avariado_data: contagemExistente.av_data,
            avariado_usuario: contagemExistente.av_usuario,
            observacao: contagemExistente.observacao
          };
        }
        return item;
      });

      inventarioExistente.itens = itensAtualizados as any;
      inventarioExistente.data_snapshot = new Date();
      await inventarioExistente.save();
      res.json(inventarioExistente);
    } else {
      const novoInventario = new InventarioFilial({
        data_snapshot: new Date(),
        status: 'em_andamento',
        criado_por: user.id,
        criado_por_nome: nomeUsuario,
        itens
      });
      await novoInventario.save();
      res.json(novoInventario);
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar ERP para inventário filial:', error);
    res.status(500).json({ message: 'Erro ao carregar dados do ERP' });
  }
});

// PUT - Salvar contagem física de um item
router.put('/:inventarioId/item/:codigoItem', authMiddleware, async (req, res) => {
  try {
    const { inventarioId, codigoItem } = req.params;
    const { quantidade_real, avariado, observacao } = req.body;
    const user = (req as any).user;

    const inventario = await InventarioFilial.findById(inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });
    if (inventario.status !== 'em_andamento') return res.status(400).json({ message: 'Inventário já finalizado' });

    const item = inventario.itens.find(i => i.codigo_item === codigoItem);
    if (!item) return res.status(404).json({ message: 'Item não encontrado' });

    if (quantidade_real !== undefined) {
      (item as any).quantidade_real = quantidade_real !== null ? Number(quantidade_real) : null;
      (item as any).quantidade_real_data = new Date();
      (item as any).quantidade_real_usuario = user.id;
    }

    if (avariado !== undefined) {
      (item as any).avariado = avariado !== null ? Number(avariado) : null;
      (item as any).avariado_data = new Date();
      (item as any).avariado_usuario = user.id;
    }

    if (observacao !== undefined) {
      (item as any).observacao = observacao;
    }

    await inventario.save();
    res.json({ message: 'Contagem salva', item });
  } catch (error) {
    console.error('❌ Erro ao salvar contagem:', error);
    res.status(500).json({ message: 'Erro ao salvar contagem' });
  }
});

// PUT - Salvar observação
router.put('/:inventarioId/item/:codigoItem/observacao', authMiddleware, async (req, res) => {
  try {
    const { inventarioId, codigoItem } = req.params;
    const { observacao } = req.body;

    const inventario = await InventarioFilial.findById(inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });
    if (inventario.status !== 'em_andamento') return res.status(400).json({ message: 'Inventário já finalizado' });

    const item = inventario.itens.find(i => i.codigo_item === codigoItem);
    if (!item) return res.status(404).json({ message: 'Item não encontrado' });

    (item as any).observacao = observacao || '';
    await inventario.save();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao salvar observação:', error);
    res.status(500).json({ message: 'Erro ao salvar observação' });
  }
});

// PUT - Finalizar inventário
router.put('/:inventarioId/finalizar', authMiddleware, async (req, res) => {
  try {
    const inventario = await InventarioFilial.findById(req.params.inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });

    inventario.status = 'finalizado';
    await inventario.save();
    res.json({ message: 'Inventário finalizado', inventario });
  } catch (error) {
    console.error('❌ Erro ao finalizar inventário filial:', error);
    res.status(500).json({ message: 'Erro ao finalizar inventário' });
  }
});

// GET - Listar finalizados
router.get('/finalizados', authMiddleware, async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const filtro: any = { status: 'finalizado' };

    if (dataInicio || dataFim) {
      filtro.data_snapshot = {};
      if (dataInicio) filtro.data_snapshot.$gte = new Date(dataInicio as string);
      if (dataFim) {
        const fim = new Date(dataFim as string);
        fim.setHours(23, 59, 59, 999);
        filtro.data_snapshot.$lte = fim;
      }
    }

    const inventarios = await InventarioFilial.find(filtro)
      .select('data_snapshot criado_por_nome itens visto_por_nome visto_data resolvido_por_nome resolvido_data resolvido_observacao')
      .sort({ data_snapshot: -1 });

    const resumo = inventarios.map(inv => ({
      _id: inv._id,
      data_snapshot: inv.data_snapshot,
      criado_por_nome: inv.criado_por_nome,
      total_itens: inv.itens.length,
      itens_contados: inv.itens.filter(i => (i as any).quantidade_real !== null || (i as any).avariado !== null).length,
      visto_por_nome: inv.visto_por_nome,
      visto_data: inv.visto_data,
      resolvido_por_nome: inv.resolvido_por_nome,
      resolvido_data: inv.resolvido_data,
      resolvido_observacao: inv.resolvido_observacao
    }));

    res.json(resumo);
  } catch (error) {
    console.error('❌ Erro ao listar finalizados:', error);
    res.status(500).json({ message: 'Erro ao listar inventários finalizados' });
  }
});

// GET - Detalhes de um inventário
router.get('/:inventarioId', authMiddleware, async (req, res) => {
  try {
    const inventario = await InventarioFilial.findById(req.params.inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });
    res.json(inventario);
  } catch (error) {
    console.error('❌ Erro ao buscar inventário filial:', error);
    res.status(500).json({ message: 'Erro ao buscar inventário' });
  }
});

// DELETE - Descartar inventário em andamento
router.delete('/:inventarioId', authMiddleware, async (req, res) => {
  try {
    const inventario = await InventarioFilial.findById(req.params.inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });
    if (inventario.status !== 'em_andamento') return res.status(400).json({ message: 'Só é possível descartar inventários em andamento' });

    await InventarioFilial.findByIdAndDelete(req.params.inventarioId);
    res.json({ message: 'Inventário descartado' });
  } catch (error) {
    console.error('❌ Erro ao descartar inventário filial:', error);
    res.status(500).json({ message: 'Erro ao descartar inventário' });
  }
});

// PUT - Marcar como visto
router.put('/:inventarioId/visto', authMiddleware, async (req, res) => {
  try {
    const inventario = await InventarioFilial.findById(req.params.inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });

    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');

    inventario.visto_por = user.id;
    inventario.visto_por_nome = userDoc?.nome || user.email;
    inventario.visto_data = new Date();
    await inventario.save();

    res.json({ message: 'Inventário marcado como visto', inventario });
  } catch (error) {
    console.error('❌ Erro ao marcar visto:', error);
    res.status(500).json({ message: 'Erro ao marcar como visto' });
  }
});

// PUT - Marcar como resolvido (com observação)
router.put('/:inventarioId/resolvido', authMiddleware, async (req, res) => {
  try {
    const { observacao } = req.body;
    const inventario = await InventarioFilial.findById(req.params.inventarioId);
    if (!inventario) return res.status(404).json({ message: 'Inventário não encontrado' });

    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');

    inventario.resolvido_por = user.id;
    inventario.resolvido_por_nome = userDoc?.nome || user.email;
    inventario.resolvido_data = new Date();
    inventario.resolvido_observacao = observacao || '';
    await inventario.save();

    res.json({ message: 'Inventário marcado como resolvido', inventario });
  } catch (error) {
    console.error('❌ Erro ao marcar resolvido:', error);
    res.status(500).json({ message: 'Erro ao marcar como resolvido' });
  }
});

export default router;
