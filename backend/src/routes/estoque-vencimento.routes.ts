import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { PerfilEnum } from '../types/enums';
import { executeERPQuery, getEstoqueVencimentoQuery, ERPEstoqueVencimentoItem } from '../services/erp.service';
import { EstoqueVencimento, IEstoqueVencimentoItem } from '../models/EstoqueVencimento';
import { User } from '../models/User';

const router = Router();

// GET - Buscar relatório ativo (em andamento)
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const report = await EstoqueVencimento.findOne({ status: 'em_andamento' }).sort({ data_snapshot: -1 });
    res.json(report || null);
  } catch (error) {
    console.error('❌ Erro ao buscar estoque-vencimento:', error);
    res.status(500).json({ message: 'Erro ao buscar relatório' });
  }
});

// POST - Carregar produtos do ERP (Produto Acabado)
router.post('/sync-erp', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;

    const { deposito = '' } = req.body;

    console.log('🔄 Carregando produtos acabados do ERP para Estoque e Vencimento...');
    const erpItems = await executeERPQuery<ERPEstoqueVencimentoItem>(getEstoqueVencimentoQuery());
    console.log(`✅ ${erpItems.length} produtos acabados carregados do ERP para Estoque e Vencimento`);

    const itens: IEstoqueVencimentoItem[] = erpItems.map(erpItem => ({
      codigo_item: String(erpItem.Cod || '').trim(),
      descricao: erpItem.Descricao,
      unidade_medida: (erpItem.UM || '').trim(),
      tipo_volume: (erpItem.TipoVolume || '').trim(),
      unidades_por_volume: erpItem.UnidadesPorVolume || 0,
      entradas: []
    }));

    const existente = await EstoqueVencimento.findOne({ status: 'em_andamento' });

    if (existente) {
      // Preservar entradas já registradas
      const entradasMap = new Map<string, any[]>();
      for (const item of existente.itens) {
        if ((item as any).entradas && (item as any).entradas.length > 0) {
          entradasMap.set(item.codigo_item, (item as any).entradas);
        }
      }

      const itensAtualizados = itens.map(item => {
        const entradasExistentes = entradasMap.get(item.codigo_item);
        if (entradasExistentes) {
          return { ...item, entradas: entradasExistentes };
        }
        return item;
      });

      const resultado = await EstoqueVencimento.findByIdAndUpdate(
        existente._id,
        { $set: { itens: itensAtualizados, data_snapshot: new Date() } },
        { new: true }
      );
      res.json(resultado);
    } else {
      const novo = new EstoqueVencimento({
        data_snapshot: new Date(),
        status: 'em_andamento',
        criado_por: user.id,
        criado_por_nome: nomeUsuario,
        deposito,
        itens
      });
      await novo.save();
      res.json(novo);
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar ERP para estoque-vencimento:', error);
    res.status(500).json({ message: 'Erro ao carregar dados do ERP' });
  }
});

// POST - Criar/sincronizar relatório ativo via inventário (sem ERP, preserva itens existentes)
// Usado quando o usuário adiciona lotes pelo InventarioPage sem ter aberto o Est.Vencimento antes
router.post('/sync-inventario', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;
    const { deposito = '' } = req.body;

    const existente = await EstoqueVencimento.findOne({ status: 'em_andamento' });
    if (existente) {
      return res.json(existente);
    }

    // Criar relatório vazio - sem buscar ERP, itens serão adicionados on-demand
    const novo = new EstoqueVencimento({
      data_snapshot: new Date(),
      status: 'em_andamento',
      criado_por: user.id,
      criado_por_nome: nomeUsuario,
      deposito,
      itens: []
    });
    await novo.save();
    res.json(novo);
  } catch (error) {
    console.error('❌ Erro ao criar relatório via inventário:', error);
    res.status(500).json({ message: 'Erro ao criar relatório' });
  }
});

// PUT - Upsert de lotes por item (substitui se mesma data, adiciona se data nova)
// Recebe: { lotes: [{ quantidade, data_validade }], item_info: { descricao, unidade_medida, ... } }
router.put('/:reportId/item/:codigoItem/lotes', authMiddleware, async (req, res) => {
  try {
    const { reportId, codigoItem } = req.params;
    const { lotes, item_info } = req.body;
    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;

    const report = await EstoqueVencimento.findById(reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
    if (report.status !== 'em_andamento') return res.status(400).json({ message: 'Relatório já finalizado' });

    let itemIndex = report.itens.findIndex((i: any) => i.codigo_item === codigoItem);

    // Criar item no relatório se ainda não existe
    if (itemIndex === -1) {
      report.itens.push({
        codigo_item: codigoItem,
        descricao: item_info?.descricao || '',
        unidade_medida: item_info?.unidade_medida || '',
        tipo_volume: item_info?.tipo_volume || '',
        unidades_por_volume: item_info?.unidades_por_volume || 0,
        entradas: []
      } as any);
      itemIndex = report.itens.length - 1;
    }

    const item = report.itens[itemIndex] as any;
    const entradas: any[] = item.entradas || [];

    for (const lote of lotes) {
      const dataValidade = new Date(lote.data_validade);
      // Normalizar para comparar apenas a data (sem hora)
      const dataStr = dataValidade.toISOString().split('T')[0];

      const existIdx = entradas.findIndex((e: any) => {
        const eStr = new Date(e.data_validade).toISOString().split('T')[0];
        return eStr === dataStr;
      });

      if (existIdx >= 0) {
        // Substitui - mesma data de validade
        entradas[existIdx].quantidade = Number(lote.quantidade);
        entradas[existIdx].registro_data = new Date();
        entradas[existIdx].registro_usuario = nomeUsuario;
      } else {
        // Nova data - adiciona
        entradas.push({
          quantidade: Number(lote.quantidade),
          data_validade: dataValidade,
          registro_data: new Date(),
          registro_usuario: nomeUsuario
        });
      }
    }

    item.entradas = entradas;
    report.markModified('itens');
    await report.save();

    res.json({ message: 'Lotes atualizados', item });
  } catch (error) {
    console.error('❌ Erro ao atualizar lotes:', error);
    res.status(500).json({ message: 'Erro ao atualizar lotes' });
  }
});

// POST - Adicionar entrada de vencimento a um item
router.post('/:reportId/item/:codigoItem/entrada', authMiddleware, async (req, res) => {
  try {
    const { reportId, codigoItem } = req.params;
    const { quantidade, data_validade } = req.body;
    const user = (req as any).user;

    const report = await EstoqueVencimento.findById(reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
    if (report.status !== 'em_andamento') return res.status(400).json({ message: 'Relatório já finalizado' });

    const result = await EstoqueVencimento.updateOne(
      { _id: reportId, 'itens.codigo_item': codigoItem },
      {
        $push: {
          'itens.$.entradas': {
            quantidade: Number(quantidade),
            data_validade: new Date(data_validade),
            registro_data: new Date(),
            registro_usuario: user.id
          }
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Item não encontrado' });
    }

    res.json({ message: 'Entrada adicionada' });
  } catch (error) {
    console.error('❌ Erro ao adicionar entrada:', error);
    res.status(500).json({ message: 'Erro ao adicionar entrada' });
  }
});

// DELETE - Remover entrada de vencimento de um item
router.delete('/:reportId/item/:codigoItem/entrada/:entradaIndex', authMiddleware, async (req, res) => {
  try {
    const { reportId, codigoItem, entradaIndex } = req.params;
    const idx = parseInt(entradaIndex);

    const report = await EstoqueVencimento.findById(reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
    if (report.status !== 'em_andamento') return res.status(400).json({ message: 'Relatório já finalizado' });

    const item = report.itens.find(i => i.codigo_item === codigoItem);
    if (!item) return res.status(404).json({ message: 'Item não encontrado' });

    if (idx < 0 || idx >= (item as any).entradas.length) {
      return res.status(400).json({ message: 'Índice de entrada inválido' });
    }

    (item as any).entradas.splice(idx, 1);
    await report.save();

    res.json({ message: 'Entrada removida' });
  } catch (error) {
    console.error('❌ Erro ao remover entrada:', error);
    res.status(500).json({ message: 'Erro ao remover entrada' });
  }
});

// PUT - Finalizar relatório
router.put('/:reportId/finalizar', authMiddleware, async (req, res) => {
  try {
    const report = await EstoqueVencimento.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });

    report.status = 'finalizado';
    report.data_finalizacao = new Date();
    await report.save();
    res.json({ message: 'Relatório finalizado', report });
  } catch (error) {
    console.error('❌ Erro ao finalizar:', error);
    res.status(500).json({ message: 'Erro ao finalizar relatório' });
  }
});

// GET - Listar finalizados (Central)
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

    const reports = await EstoqueVencimento.find(filtro)
      .select('data_snapshot criado_por_nome deposito itens visto_por_nome visto_data resolvido_por_nome resolvido_data resolvido_observacao')
      .sort({ data_snapshot: -1 });

    const resumo = reports.map(r => {
      let totalEntradas = 0;
      let itensComEntrada = 0;
      let itensRuptura = 0;
      for (const item of r.itens) {
        const entradas = (item as any).entradas || [];
        if (entradas.length > 0) {
          itensComEntrada++;
          const totalQtd = entradas.reduce((sum: number, e: any) => sum + (e.quantidade || 0), 0);
          if (totalQtd === 0) itensRuptura++;
        }
        totalEntradas += entradas.length;
      }

      return {
        _id: r._id,
        data_snapshot: r.data_snapshot,
        criado_por_nome: r.criado_por_nome,
        deposito: r.deposito || '',
        total_itens: r.itens.length,
        itens_com_entrada: itensComEntrada,
        itens_ruptura: itensRuptura,
        total_entradas: totalEntradas,
        visto_por_nome: r.visto_por_nome,
        visto_data: r.visto_data,
        resolvido_por_nome: r.resolvido_por_nome,
        resolvido_data: r.resolvido_data,
        resolvido_observacao: r.resolvido_observacao
      };
    });

    res.json(resumo);
  } catch (error) {
    console.error('❌ Erro ao listar finalizados:', error);
    res.status(500).json({ message: 'Erro ao listar relatórios finalizados' });
  }
});

// GET - Detalhes de um relatório
router.get('/:reportId', authMiddleware, async (req, res) => {
  try {
    const report = await EstoqueVencimento.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
    res.json(report);
  } catch (error) {
    console.error('❌ Erro ao buscar relatório:', error);
    res.status(500).json({ message: 'Erro ao buscar relatório' });
  }
});

// DELETE - Descartar em andamento
router.delete('/:reportId', authMiddleware, async (req, res) => {
  try {
    const report = await EstoqueVencimento.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });
    if (report.status !== 'em_andamento') return res.status(400).json({ message: 'Só é possível descartar relatórios em andamento' });

    await EstoqueVencimento.findByIdAndDelete(req.params.reportId);
    res.json({ message: 'Relatório descartado' });
  } catch (error) {
    console.error('❌ Erro ao descartar:', error);
    res.status(500).json({ message: 'Erro ao descartar relatório' });
  }
});

// PUT - Marcar como visto
router.put('/:reportId/visto', authMiddleware, async (req, res) => {
  try {
    const report = await EstoqueVencimento.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });

    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');

    report.visto_por = user.id;
    report.visto_por_nome = userDoc?.nome || user.email;
    report.visto_data = new Date();
    await report.save();

    res.json({ message: 'Relatório marcado como visto', report });
  } catch (error) {
    console.error('❌ Erro ao marcar visto:', error);
    res.status(500).json({ message: 'Erro ao marcar como visto' });
  }
});

// PUT - Marcar como resolvido (com observação)
router.put('/:reportId/resolvido', authMiddleware, async (req, res) => {
  try {
    const { observacao } = req.body;
    const report = await EstoqueVencimento.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });

    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');

    report.resolvido_por = user.id;
    report.resolvido_por_nome = userDoc?.nome || user.email;
    report.resolvido_data = new Date();
    report.resolvido_observacao = observacao || '';
    await report.save();

    res.json({ message: 'Relatório marcado como resolvido', report });
  } catch (error) {
    console.error('❌ Erro ao marcar resolvido:', error);
    res.status(500).json({ message: 'Erro ao marcar como resolvido' });
  }
});

// DELETE - Excluir finalizado (Admin only)
router.delete('/:reportId/admin', authMiddleware, requireRole(PerfilEnum.ADMIN), async (req, res) => {
  try {
    const report = await EstoqueVencimento.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'Relatório não encontrado' });

    await EstoqueVencimento.findByIdAndDelete(req.params.reportId);
    res.json({ message: 'Relatório excluído com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir:', error);
    res.status(500).json({ message: 'Erro ao excluir relatório' });
  }
});

export default router;
