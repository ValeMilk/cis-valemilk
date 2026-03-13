import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { executeERPQuery, getAvariaQuery, ERPAvariaItem } from '../services/erp.service';
import { Avaria, IAvariaItem } from '../models/Avaria';
import { User } from '../models/User';

const router = Router();

const parseFormattedNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  return parseFloat(value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

// GET - Buscar avaria ativa
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const avaria = await Avaria.findOne({ status: 'em_andamento' }).sort({ data_snapshot: -1 });
    res.json(avaria || null);
  } catch (error) {
    console.error('❌ Erro ao buscar avaria:', error);
    res.status(500).json({ message: 'Erro ao buscar avaria' });
  }
});

// POST - Carregar dados do ERP
router.post('/sync-erp', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');
    const nomeUsuario = userDoc?.nome || user.email;

    const erpItems = await executeERPQuery<ERPAvariaItem>(getAvariaQuery());
    console.log(`✅ ${erpItems.length} itens de avaria carregados do ERP`);

    const itens: IAvariaItem[] = erpItems.map(erpItem => ({
      codigo_item: String(erpItem.Cod || '').trim(),
      descricao: erpItem.Descricao,
      tipo: erpItem.Tipo,
      unidade_medida: (erpItem.UM || '').trim(),
      tipo_volume: (erpItem.TipoVolume || '').trim(),
      unidades_por_volume: erpItem.UnidadesPorVolume || 0,
      deposito_5: parseFormattedNumber(erpItem['Depósito 5']),
      contagem: null,
      volumes_fechados: null,
      unitarios_avulsos: null,
      contagem_data: undefined,
      contagem_usuario: undefined
    }));

    const avariaExistente = await Avaria.findOne({ status: 'em_andamento' });

    if (avariaExistente) {
      const contagensMap = new Map<string, { contagem: number | null; vf: number | null; ua: number | null; data?: Date; usuario?: string; observacao?: string }>();
      for (const item of avariaExistente.itens) {
        const temContagem = (item as any).contagem !== null;
        const temObs = (item as any).observacao && (item as any).observacao.trim() !== '';
        if (temContagem || temObs) {
          contagensMap.set(item.codigo_item, {
            contagem: (item as any).contagem,
            vf: (item as any).volumes_fechados,
            ua: (item as any).unitarios_avulsos,
            data: item.contagem_data,
            usuario: item.contagem_usuario,
            observacao: (item as any).observacao
          });
        }
      }

      const itensAtualizados = itens.map(item => {
        const contagemExistente = contagensMap.get(item.codigo_item);
        if (contagemExistente) {
          return {
            ...item,
            contagem: contagemExistente.contagem,
            volumes_fechados: contagemExistente.vf,
            unitarios_avulsos: contagemExistente.ua,
            contagem_data: contagemExistente.data,
            contagem_usuario: contagemExistente.usuario,
            observacao: contagemExistente.observacao
          };
        }
        return item;
      });

      avariaExistente.itens = itensAtualizados as any;
      avariaExistente.data_snapshot = new Date();
      await avariaExistente.save();
      res.json(avariaExistente);
    } else {
      const novaAvaria = new Avaria({
        data_snapshot: new Date(),
        status: 'em_andamento',
        criado_por: user.id,
        criado_por_nome: nomeUsuario,
        itens
      });
      await novaAvaria.save();
      res.json(novaAvaria);
    }
  } catch (error) {
    console.error('❌ Erro ao sincronizar ERP para avaria:', error);
    res.status(500).json({ message: 'Erro ao carregar dados do ERP' });
  }
});

// PUT - Salvar contagem física de um item
router.put('/:avariaId/item/:codigoItem', authMiddleware, async (req, res) => {
  try {
    const { avariaId, codigoItem } = req.params;
    const { contagem_fisica, observacao, volumes_fechados, unitarios_avulsos } = req.body;
    const user = (req as any).user;

    const avaria = await Avaria.findById(avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });
    if (avaria.status !== 'em_andamento') return res.status(400).json({ message: 'Avaria já finalizada' });

    const item = avaria.itens.find(i => i.codigo_item === codigoItem);
    if (!item) return res.status(404).json({ message: 'Item não encontrado' });

    (item as any).contagem = contagem_fisica !== null && contagem_fisica !== undefined
      ? Number(contagem_fisica)
      : null;

    if (volumes_fechados !== undefined) (item as any).volumes_fechados = volumes_fechados !== null ? Number(volumes_fechados) : null;
    if (unitarios_avulsos !== undefined) (item as any).unitarios_avulsos = unitarios_avulsos !== null ? Number(unitarios_avulsos) : null;

    if (observacao !== undefined) {
      (item as any).observacao = observacao;
    }

    item.contagem_data = new Date();
    item.contagem_usuario = user.id;

    await avaria.save();
    res.json({ message: 'Contagem salva', item });
  } catch (error) {
    console.error('❌ Erro ao salvar contagem avaria:', error);
    res.status(500).json({ message: 'Erro ao salvar contagem' });
  }
});

// PUT - Salvar observação
router.put('/:avariaId/item/:codigoItem/observacao', authMiddleware, async (req, res) => {
  try {
    const { avariaId, codigoItem } = req.params;
    const { observacao } = req.body;

    const avaria = await Avaria.findById(avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });
    if (avaria.status !== 'em_andamento') return res.status(400).json({ message: 'Avaria já finalizada' });

    const item = avaria.itens.find(i => i.codigo_item === codigoItem);
    if (!item) return res.status(404).json({ message: 'Item não encontrado' });

    (item as any).observacao = observacao || '';
    await avaria.save();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao salvar observação avaria:', error);
    res.status(500).json({ message: 'Erro ao salvar observação' });
  }
});

// PUT - Finalizar avaria
router.put('/:avariaId/finalizar', authMiddleware, async (req, res) => {
  try {
    const avaria = await Avaria.findById(req.params.avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });

    avaria.status = 'finalizado';
    await avaria.save();
    res.json({ message: 'Avaria finalizada', avaria });
  } catch (error) {
    console.error('❌ Erro ao finalizar avaria:', error);
    res.status(500).json({ message: 'Erro ao finalizar avaria' });
  }
});

// GET - Listar finalizadas
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

    const avarias = await Avaria.find(filtro)
      .select('data_snapshot criado_por_nome itens visto_por_nome visto_data resolvido_por_nome resolvido_data resolvido_observacao')
      .sort({ data_snapshot: -1 });

    const resumo = avarias.map(av => ({
      _id: av._id,
      data_snapshot: av.data_snapshot,
      criado_por_nome: av.criado_por_nome,
      total_itens: av.itens.length,
      itens_contados: av.itens.filter(i => (i as any).contagem !== null).length,
      visto_por_nome: av.visto_por_nome,
      visto_data: av.visto_data,
      resolvido_por_nome: av.resolvido_por_nome,
      resolvido_data: av.resolvido_data,
      resolvido_observacao: av.resolvido_observacao
    }));

    res.json(resumo);
  } catch (error) {
    console.error('❌ Erro ao listar avarias finalizadas:', error);
    res.status(500).json({ message: 'Erro ao listar avarias finalizadas' });
  }
});

// GET - Detalhes de uma avaria
router.get('/:avariaId', authMiddleware, async (req, res) => {
  try {
    const avaria = await Avaria.findById(req.params.avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });
    res.json(avaria);
  } catch (error) {
    console.error('❌ Erro ao buscar avaria:', error);
    res.status(500).json({ message: 'Erro ao buscar avaria' });
  }
});

// DELETE - Descartar avaria em andamento
router.delete('/:avariaId', authMiddleware, async (req, res) => {
  try {
    const avaria = await Avaria.findById(req.params.avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });
    if (avaria.status !== 'em_andamento') return res.status(400).json({ message: 'Só é possível descartar avarias em andamento' });

    await Avaria.findByIdAndDelete(req.params.avariaId);
    res.json({ message: 'Avaria descartada' });
  } catch (error) {
    console.error('❌ Erro ao descartar avaria:', error);
    res.status(500).json({ message: 'Erro ao descartar avaria' });
  }
});

// PUT - Marcar como visto
router.put('/:avariaId/visto', authMiddleware, async (req, res) => {
  try {
    const avaria = await Avaria.findById(req.params.avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });

    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');

    avaria.visto_por = user.id;
    avaria.visto_por_nome = userDoc?.nome || user.email;
    avaria.visto_data = new Date();
    await avaria.save();

    res.json({ message: 'Avaria marcada como vista', avaria });
  } catch (error) {
    console.error('❌ Erro ao marcar visto:', error);
    res.status(500).json({ message: 'Erro ao marcar como visto' });
  }
});

// PUT - Marcar como resolvido (com observação)
router.put('/:avariaId/resolvido', authMiddleware, async (req, res) => {
  try {
    const { observacao } = req.body;
    const avaria = await Avaria.findById(req.params.avariaId);
    if (!avaria) return res.status(404).json({ message: 'Avaria não encontrada' });

    const user = (req as any).user;
    const userDoc = await User.findById(user.id).select('nome');

    avaria.resolvido_por = user.id;
    avaria.resolvido_por_nome = userDoc?.nome || user.email;
    avaria.resolvido_data = new Date();
    avaria.resolvido_observacao = observacao || '';
    await avaria.save();

    res.json({ message: 'Avaria marcada como resolvida', avaria });
  } catch (error) {
    console.error('❌ Erro ao marcar resolvido:', error);
    res.status(500).json({ message: 'Erro ao marcar como resolvido' });
  }
});

export default router;
