import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { executeERPQuery, getReposicaoQuery, ERPReposicaoItem } from '../services/erp.service';
import { Reposicao } from '../models/Reposicao';
import { User } from '../models/User';

const router = Router();

const parseFormattedNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  return parseFloat(value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

// GET - Buscar último carregamento salvo
router.get('/latest', authMiddleware, async (_req, res) => {
  try {
    const reposicao = await Reposicao.findOne().sort({ data_carregamento: -1 });
    if (!reposicao) {
      return res.json(null);
    }
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

    // Salvar novo registro (substitui o anterior)
    await Reposicao.deleteMany({});
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

export default router;
