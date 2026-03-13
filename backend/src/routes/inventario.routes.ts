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
        codigo_item: erpItem.Tipo === 'Produto Acabado' && erpItem.CodLivre
          ? String(erpItem.CodLivre).trim()
          : String(erpItem.Cod).padStart(6, '0'),
        descricao: erpItem.Descricao,
        tipo: erpItem.Tipo,
        unidade_medida: erpItem.UM || '',
        fornecedor: '',
        dep_aberto_interno: depAbertoInterno,
        dep_fechado_externo: parseFormattedNumber(erpItem['Dep. Fechado (Externo)']),
        dep_fechado_interno: parseFormattedNumber(erpItem['Dep. Fechado (Interno)']),
        producoes_aberto: producoesAberto,
        dep_aberto_real: depAbertoReal,
        tipo_volume: erpItem.TipoVolume || '',
        unidades_por_volume: erpItem.UnidadesPorVolume || 0,
        contagem_aberto: null,
        contagem_fechado_ext: null,
        contagem_fechado_int: null,
        volumes_fechados_aberto: null,
        unitarios_avulsos_aberto: null,
        volumes_fechados_ext: null,
        unitarios_avulsos_ext: null,
        volumes_fechados_int: null,
        unitarios_avulsos_int: null,
        contagem_data: undefined,
        contagem_usuario: undefined
      };
    });
    
    // Verificar se já existe inventário em andamento
    const inventarioExistente = await Inventario.findOne({ status: 'em_andamento' });
    
    if (inventarioExistente) {
      // Preservar contagens já feitas
      const contagensMap = new Map<string, { aberto: number | null; fechado_ext: number | null; fechado_int: number | null; vf_aberto: number | null; ua_aberto: number | null; vf_ext: number | null; ua_ext: number | null; vf_int: number | null; ua_int: number | null; data?: Date; usuario?: string; observacao?: string }>();
      for (const item of inventarioExistente.itens) {
        const temContagem = (item as any).contagem_aberto !== null || (item as any).contagem_fechado_ext !== null || (item as any).contagem_fechado_int !== null;
        const temObs = (item as any).observacao && (item as any).observacao.trim() !== '';
        if (temContagem || temObs) {
          contagensMap.set(item.codigo_item, {
            aberto: (item as any).contagem_aberto,
            fechado_ext: (item as any).contagem_fechado_ext,
            fechado_int: (item as any).contagem_fechado_int,
            vf_aberto: (item as any).volumes_fechados_aberto,
            ua_aberto: (item as any).unitarios_avulsos_aberto,
            vf_ext: (item as any).volumes_fechados_ext,
            ua_ext: (item as any).unitarios_avulsos_ext,
            vf_int: (item as any).volumes_fechados_int,
            ua_int: (item as any).unitarios_avulsos_int,
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
            volumes_fechados_aberto: contagemExistente.vf_aberto,
            unitarios_avulsos_aberto: contagemExistente.ua_aberto,
            volumes_fechados_ext: contagemExistente.vf_ext,
            unitarios_avulsos_ext: contagemExistente.ua_ext,
            volumes_fechados_int: contagemExistente.vf_int,
            unitarios_avulsos_int: contagemExistente.ua_int,
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
    const { contagem_fisica, deposito, observacao, volumes_fechados, unitarios_avulsos } = req.body;
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
      if (volumes_fechados !== undefined) (item as any).volumes_fechados_aberto = volumes_fechados !== null ? Number(volumes_fechados) : null;
      if (unitarios_avulsos !== undefined) (item as any).unitarios_avulsos_aberto = unitarios_avulsos !== null ? Number(unitarios_avulsos) : null;
    } else if (deposito === 'fechado_ext') {
      (item as any).contagem_fechado_ext = valor;
      if (volumes_fechados !== undefined) (item as any).volumes_fechados_ext = volumes_fechados !== null ? Number(volumes_fechados) : null;
      if (unitarios_avulsos !== undefined) (item as any).unitarios_avulsos_ext = unitarios_avulsos !== null ? Number(unitarios_avulsos) : null;
    } else if (deposito === 'fechado_int') {
      (item as any).contagem_fechado_int = valor;
      if (volumes_fechados !== undefined) (item as any).volumes_fechados_int = volumes_fechados !== null ? Number(volumes_fechados) : null;
      if (unitarios_avulsos !== undefined) (item as any).unitarios_avulsos_int = unitarios_avulsos !== null ? Number(unitarios_avulsos) : null;
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
      .select('data_snapshot criado_por_nome itens visto_por_nome visto_data resolvido_por_nome resolvido_data resolvido_observacao')
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
      ).length,
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

// PUT - Marcar como visto
router.put('/:inventarioId/visto', authMiddleware, async (req, res) => {
  try {
    const inventario = await Inventario.findById(req.params.inventarioId);
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
    const inventario = await Inventario.findById(req.params.inventarioId);
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
