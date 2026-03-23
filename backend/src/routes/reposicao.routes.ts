import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { PerfilEnum } from '../types/enums';
import { executeERPQuery, getReposicaoQuery, ERPReposicaoItem } from '../services/erp.service';
import { Reposicao } from '../models/Reposicao';
import { User } from '../models/User';

const router = Router();

const parseFormattedNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  return parseFloat(value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

// GET - Buscar último carregamento em andamento
router.get('/latest', authMiddleware, async (_req, res) => {
  try {
    const reposicao = await Reposicao.findOne({ status: 'em_andamento' }).sort({ data_carregamento: -1 });
    if (!reposicao) {
      return res.json(null);
    }
    res.json(reposicao);
  } catch (error) {
    console.error('❌ Erro ao buscar reposição:', error);
    res.status(500).json({ message: 'Erro ao buscar reposição' });
  }
});

// GET - Listar reposições finalizadas (para Central)
router.get('/finalizados', authMiddleware, async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const filtro: any = { status: 'finalizado' };
    if (dataInicio || dataFim) {
      filtro.data_carregamento = {};
      if (dataInicio) filtro.data_carregamento.$gte = new Date(dataInicio as string);
      if (dataFim) {
        const fim = new Date(dataFim as string);
        fim.setHours(23, 59, 59, 999);
        filtro.data_carregamento.$lte = fim;
      }
    }
    const reposicoes = await Reposicao.find(filtro)
      .sort({ data_carregamento: -1 })
      .select('data_carregamento carregado_por_nome itens');

    const resumo = reposicoes.map(r => ({
      _id: r._id,
      data_carregamento: r.data_carregamento,
      carregado_por_nome: r.carregado_por_nome,
      total_itens: r.itens.length,
      precisam_repor: r.itens.filter(i => i.reposicao > 0).length,
      qtd_preenchida: r.itens.filter(i => i.quantidade !== null && i.quantidade !== undefined).length,
    }));

    res.json(resumo);
  } catch (error) {
    console.error('❌ Erro ao buscar finalizados:', error);
    res.status(500).json({ message: 'Erro ao buscar reposições finalizadas' });
  }
});

// GET - Buscar reposição por ID (detalhe)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const reposicao = await Reposicao.findById(req.params.id);
    if (!reposicao) return res.status(404).json({ message: 'Reposição não encontrada' });
    res.json(reposicao);
  } catch (error) {
    console.error('❌ Erro ao buscar reposição:', error);
    res.status(500).json({ message: 'Erro ao buscar reposição' });
  }
});

// POST - Carregar dados do ERP e salvar
router.post('/sync-erp', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;

    const query = getReposicaoQuery();
    const erpData = await executeERPQuery<ERPReposicaoItem>(query);

    const itens = erpData.map(item => ({
      codigo_item: item.Cod,
      descricao: item.Descricao,
      tipo: item.Tipo,
      unidade_medida: item.UN,
      minimo: parseFormattedNumber(item.Minimo),
      dep_aberto: parseFormattedNumber(item['Dep. Aberto (Interno)']),
      producoes_aberto: parseFormattedNumber(item['Produções em Aberto']),
      saldo_real: parseFormattedNumber(item['Saldo Real']),
      reposicao: parseFormattedNumber(item['Reposição']),
      giro_mensal: parseFormattedNumber(item['Giro Mensal']),
    }));

    // Salvar novo registro (remove apenas em_andamento anteriores)
    await Reposicao.deleteMany({ status: 'em_andamento' });
    const reposicao = await Reposicao.create({
      data_carregamento: new Date(),
      carregado_por: user.id,
      carregado_por_nome: nomeUsuario,
      itens
    });

    res.json(reposicao);
  } catch (error) {
    console.error('❌ Erro ao carregar reposição do ERP:', error);
    res.status(500).json({ message: 'Erro ao carregar dados do ERP' });
  }
});

// PUT - Salvar quantidade de um item
router.put('/:id/item/:codigoItem', authMiddleware, async (req, res) => {
  try {
    const { id, codigoItem } = req.params;
    const { quantidade } = req.body;

    const reposicao = await Reposicao.findById(id);
    if (!reposicao) return res.status(404).json({ message: 'Reposição não encontrada' });
    if (reposicao.status === 'finalizado') return res.status(400).json({ message: 'Reposição já finalizada' });

    const item = reposicao.itens.find((i: any) => i.codigo_item === Number(codigoItem));
    if (!item) return res.status(404).json({ message: 'Item não encontrado' });

    (item as any).quantidade = quantidade;
    await reposicao.save();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao salvar quantidade:', error);
    res.status(500).json({ message: 'Erro ao salvar quantidade' });
  }
});

// PUT - Finalizar reposição
router.put('/:id/finalizar', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const reposicao = await Reposicao.findById(id);
    if (!reposicao) return res.status(404).json({ message: 'Reposição não encontrada' });

    reposicao.status = 'finalizado';
    reposicao.data_finalizacao = new Date();
    await reposicao.save();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao finalizar reposição:', error);
    res.status(500).json({ message: 'Erro ao finalizar reposição' });
  }
});

// DELETE - Excluir reposição finalizada (Admin only)
router.delete('/:id/admin', authMiddleware, requireRole(PerfilEnum.ADMIN), async (req, res) => {
  try {
    const reposicao = await Reposicao.findById(req.params.id);
    if (!reposicao) return res.status(404).json({ message: 'Reposição não encontrada' });

    await Reposicao.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reposição excluída com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir reposição:', error);
    res.status(500).json({ message: 'Erro ao excluir reposição' });
  }
});

export default router;
