import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { executeERPQuery, getInventarioQuery, ERPInventarioItem } from '../services/erp.service';
import { Inventario, IInventarioItem } from '../models/Inventario';
import { User } from '../models/User';

const router = Router();

// Função auxiliar para parsear valores formatados (de pt-BR para número)
const parseFormattedNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  return parseFloat(value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

// GET - Buscar inventário ativo (em andamento) ou o último
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const inventario = await Inventario.findOne({ status: 'em_andamento' }).sort({ data_snapshot: -1 });
    
    if (!inventario) {
      return res.json(null);
    }
    
    res.json(inventario);
  } catch (error) {
    console.error('❌ Erro ao buscar inventário:', error);
    res.status(500).json({ message: 'Erro ao buscar inventário' });
  }
});

// POST - Carregar dados do ERP e criar/atualizar snapshot do inventário
router.post('/sync-erp', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    
    // Buscar nome do usuário no banco
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;
    
    // Buscar dados do ERP
    const erpItems = await executeERPQuery<ERPInventarioItem>(getInventarioQuery());
    console.log(`✅ ${erpItems.length} itens de inventário carregados do ERP`);
    
    // Mapear para o formato do inventário
    const itens: IInventarioItem[] = erpItems.map(erpItem => {
      const depAbertoInterno = parseFormattedNumber(erpItem['Dep. Aberto (Interno)']);
      const producoesAberto = parseFormattedNumber(erpItem['Produções em Aberto']);
      const depAbertoReal = depAbertoInterno - producoesAberto;
      
      return {
        codigo_item: String(erpItem.Cod).padStart(6, '0'),
        descricao: erpItem.Descricao,
        tipo: erpItem.Tipo,
        unidade_medida: erpItem.UM || '',
        fornecedor: erpItem.Fornecedor,
        dep_aberto_interno: depAbertoInterno,
        dep_fechado_externo: parseFormattedNumber(erpItem['Dep. Fechado (Externo)']),
        dep_fechado_interno: parseFormattedNumber(erpItem['Dep. Fechado (Interno)']),
        producoes_aberto: producoesAberto,
        dep_aberto_real: depAbertoReal,
        contagem_aberto: null,
        contagem_fechado_ext: null,
        contagem_fechado_int: null,
        contagem_data: undefined,
        contagem_usuario: undefined
      };
    });
    
    // Verificar se já existe inventário em andamento
    const inventarioExistente = await Inventario.findOne({ status: 'em_andamento' });
    
    if (inventarioExistente) {
      // Preservar contagens já feitas
      const contagensMap = new Map<string, { aberto: number | null; fechado_ext: number | null; fechado_int: number | null; data?: Date; usuario?: string; observacao?: string }>();
      for (const item of inventarioExistente.itens) {
        const temContagem = (item as any).contagem_aberto !== null || (item as any).contagem_fechado_ext !== null || (item as any).contagem_fechado_int !== null;
        const temObs = (item as any).observacao && (item as any).observacao.trim() !== '';
        if (temContagem || temObs) {
          contagensMap.set(item.codigo_item, {
            aberto: (item as any).contagem_aberto,
            fechado_ext: (item as any).contagem_fechado_ext,
            fechado_int: (item as any).contagem_fechado_int,
            data: item.contagem_data,
            usuario: item.contagem_usuario,
            observacao: (item as any).observacao
          });
        }
      }
      
      // Atualizar itens mantendo contagens existentes
      const itensAtualizados = itens.map(item => {
        const contagemExistente = contagensMap.get(item.codigo_item);
        if (contagemExistente) {
          return {
            ...item,
            contagem_aberto: contagemExistente.aberto,
            contagem_fechado_ext: contagemExistente.fechado_ext,
            contagem_fechado_int: contagemExistente.fechado_int,
            contagem_data: contagemExistente.data,
            contagem_usuario: contagemExistente.usuario
          };
        }
        return item;
      });
      
      inventarioExistente.itens = itensAtualizados as any;
      inventarioExistente.data_snapshot = new Date();
      await inventarioExistente.save();
      
      res.json(inventarioExistente);
    } else {
      // Criar novo inventário
      const novoInventario = new Inventario({
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
    console.error('❌ Erro ao sincronizar ERP para inventário:', error);
    res.status(500).json({ message: 'Erro ao carregar dados do ERP' });
  }
});

// PUT - Salvar contagem física de um item
router.put('/:inventarioId/item/:codigoItem', authMiddleware, async (req, res) => {
  try {
    const { inventarioId, codigoItem } = req.params;
    const { contagem_fisica, deposito, observacao } = req.body;
    const user = (req as any).user;
    
    const inventario = await Inventario.findById(inventarioId);
    if (!inventario) {
      return res.status(404).json({ message: 'Inventário não encontrado' });
    }
    
    if (inventario.status !== 'em_andamento') {
      return res.status(400).json({ message: 'Inventário já finalizado' });
    }
    
    // Encontrar o item e atualizar contagem do depósito específico
    const item = inventario.itens.find(i => i.codigo_item === codigoItem);
    if (!item) {
      return res.status(404).json({ message: 'Item não encontrado no inventário' });
    }
    
    const valor = contagem_fisica !== null && contagem_fisica !== undefined 
      ? Number(contagem_fisica) 
      : null;
    
    if (deposito === 'aberto') {
      (item as any).contagem_aberto = valor;
    } else if (deposito === 'fechado_ext') {
      (item as any).contagem_fechado_ext = valor;
    } else if (deposito === 'fechado_int') {
      (item as any).contagem_fechado_int = valor;
    } else {
      return res.status(400).json({ message: 'Depósito inválido' });
    }
    
    if (observacao !== undefined) {
      (item as any).observacao = observacao;
    }
    
    item.contagem_data = new Date();
    item.contagem_usuario = user.id;
    
    await inventario.save();
    
    res.json({ message: 'Contagem salva', item });
  } catch (error) {
    console.error('❌ Erro ao salvar contagem:', error);
    res.status(500).json({ message: 'Erro ao salvar contagem' });
  }
});

// PUT - Salvar observação de um item
router.put('/:inventarioId/item/:codigoItem/observacao', authMiddleware, async (req, res) => {
  try {
    const { inventarioId, codigoItem } = req.params;
    const { observacao } = req.body;

    const inventario = await Inventario.findById(inventarioId);
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
    const { inventarioId } = req.params;
    
    const inventario = await Inventario.findById(inventarioId);
    if (!inventario) {
      return res.status(404).json({ message: 'Inventário não encontrado' });
    }
    
    inventario.status = 'finalizado';
    await inventario.save();
    
    res.json({ message: 'Inventário finalizado', inventario });
  } catch (error) {
    console.error('❌ Erro ao finalizar inventário:', error);
    res.status(500).json({ message: 'Erro ao finalizar inventário' });
  }
});

// GET - Listar inventários finalizados (Central de Inventário)
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

    const inventarios = await Inventario.find(filtro)
      .select('data_snapshot criado_por_nome itens')
      .sort({ data_snapshot: -1 });

    const resumo = inventarios.map(inv => ({
      _id: inv._id,
      data_snapshot: inv.data_snapshot,
      criado_por_nome: inv.criado_por_nome,
      total_itens: inv.itens.length,
      itens_contados: inv.itens.filter(i =>
        (i as any).contagem_aberto !== null ||
        (i as any).contagem_fechado_ext !== null ||
        (i as any).contagem_fechado_int !== null
      ).length
    }));

    res.json(resumo);
  } catch (error) {
    console.error('❌ Erro ao listar finalizados:', error);
    res.status(500).json({ message: 'Erro ao listar inventários finalizados' });
  }
});

// GET - Detalhes de um inventário finalizado
router.get('/:inventarioId', authMiddleware, async (req, res) => {
  try {
    const { inventarioId } = req.params;
    const inventario = await Inventario.findById(inventarioId);
    if (!inventario) {
      return res.status(404).json({ message: 'Inventário não encontrado' });
    }
    res.json(inventario);
  } catch (error) {
    console.error('❌ Erro ao buscar inventário:', error);
    res.status(500).json({ message: 'Erro ao buscar inventário' });
  }
});

// DELETE - Descartar inventário em andamento (reiniciar)
router.delete('/:inventarioId', authMiddleware, async (req, res) => {
  try {
    const { inventarioId } = req.params;
    
    const inventario = await Inventario.findById(inventarioId);
    if (!inventario) {
      return res.status(404).json({ message: 'Inventário não encontrado' });
    }
    
    if (inventario.status !== 'em_andamento') {
      return res.status(400).json({ message: 'Não é possível excluir inventário finalizado' });
    }
    
    await Inventario.findByIdAndDelete(inventarioId);
    res.json({ message: 'Inventário descartado' });
  } catch (error) {
    console.error('❌ Erro ao descartar inventário:', error);
    res.status(500).json({ message: 'Erro ao descartar inventário' });
  }
});

export default router;
