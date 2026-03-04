import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { executeERPQuery, getItemsQuery, ERPItem } from '../services/erp.service';
import { Pedido } from '../models/Pedido';
import { StatusPedido } from '../types/enums';

const router = Router();

// Interface para os itens formatados
interface Item {
  id: string;
  codigo_item: string;
  descricao: string;
  tipo: string;
  id_fornecedor: number | null;
  fornecedor: string;
  unidade_medida: string;
  valorUltimaEntrada: number;
  estoque_atual: number;
  estoque_minimo: number;
  classe_abc: string;
  saldo_dep_aberto: number;
  saldo_dep_fechado_interno: number;
  saldo_dep_fechado_externo: number;
  giro_mensal: number;
  media_giro_trimestre: number;
  data_ultima_entrada: string;
  previsao_fim_estoque: string;
}

// Interface para item com status do pedido
interface ItemWithStatus extends Item {
  status_pedido?: StatusPedido;
  numero_pedido?: string;
}

// Função auxiliar para parsear valores formatados (de pt-BR para número)
const parseFormattedNumber = (value: string): number => {
  if (!value || value === '-') return 0;
  // Remove 'R$', espaços, pontos de milhar e substitui vírgula por ponto
  return parseFloat(value.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};

// Função para mapear ERPItem para Item
const mapERPItemToItem = (erpItem: ERPItem): Item => {
  // Parse dos valores formatados
  const totalSaldo = parseFormattedNumber(erpItem['Saldo Total']);
  const giroMensal = parseFormattedNumber(erpItem['Giro Mensal']);
  const valorUltEntrada = parseFormattedNumber(erpItem['Valor Ult Entrada']);
  const depAberto = parseFormattedNumber(erpItem['Dep. Aberto']);
  const depFechadoInterno = parseFormattedNumber(erpItem['Dep. Fechado (Interno)']);
  const depFechadoExterno = parseFormattedNumber(erpItem['Dep. Fechado (Externo)']);
  const mediaGiroTrimestre = parseFormattedNumber(erpItem['Média Giro Trimestre']);
  
  // Classificação ABC baseada no giro mensal
  let classe_abc = 'C';
  if (giroMensal > 100) {
    classe_abc = 'A';
  } else if (giroMensal > 30) {
    classe_abc = 'B';
  }
  
  return {
    id: erpItem.Cod.toString(),
    codigo_item: erpItem.Cod.toString().padStart(6, '0'),
    descricao: erpItem.Descricao,
    tipo: erpItem.Tipo || 'Não Definido',
    id_fornecedor: erpItem.Id_Fornecedor,
    fornecedor: erpItem.Fornecedor || 'SEM FORNECEDOR',
    unidade_medida: 'UN', // Padrão, pode ser melhorado com outra query
    valorUltimaEntrada: valorUltEntrada,
    estoque_atual: totalSaldo,
    estoque_minimo: Math.ceil(giroMensal / 2), // Metade do giro mensal
    classe_abc,
    saldo_dep_aberto: depAberto,
    saldo_dep_fechado_interno: depFechadoInterno,
    saldo_dep_fechado_externo: depFechadoExterno,
    giro_mensal: giroMensal,
    media_giro_trimestre: mediaGiroTrimestre,
    data_ultima_entrada: erpItem['Dt Ult Entrada'] || '',
    previsao_fim_estoque: erpItem['Prev. Fim Estoque'] || 'Sem Consumo'
  };
};

// Mock items data como fallback
const mockItems: Item[] = [
  {
    id: '1',
    codigo_item: '000001',
    descricao: 'Leite em Pó Integral - Saco 25kg',
    tipo: 'Matéria Prima',
    id_fornecedor: 100,
    fornecedor: 'FORNECEDOR TESTE A',
    unidade_medida: 'SC',
    valorUltimaEntrada: 285.50,
    estoque_atual: 150,
    estoque_minimo: 100,
    classe_abc: 'A',
    saldo_dep_aberto: 100,
    saldo_dep_fechado_interno: 30,
    saldo_dep_fechado_externo: 20,
    giro_mensal: 200,
    media_giro_trimestre: 180,
    data_ultima_entrada: '15/02/2026',
    previsao_fim_estoque: '20/03/2026'
  },
  {
    id: '2',
    codigo_item: '000002',
    descricao: 'Embalagem Tetra Pak 1L',
    tipo: 'Embalagem',
    id_fornecedor: 200,
    fornecedor: 'FORNECEDOR TESTE B',
    unidade_medida: 'UN',
    valorUltimaEntrada: 0.85,
    estoque_atual: 25000,
    estoque_minimo: 25000,
    classe_abc: 'A',
    saldo_dep_aberto: 15000,
    saldo_dep_fechado_interno: 5000,
    saldo_dep_fechado_externo: 5000,
    giro_mensal: 50000,
    media_giro_trimestre: 48000,
    data_ultima_entrada: '20/02/2026',
    previsao_fim_estoque: '10/03/2026'
  }
];

// Get all items
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, classe_abc } = req.query;
    
    let items: Item[];
    
    // Tentar buscar do ERP
    try {
      const erpItems = await executeERPQuery<ERPItem>(getItemsQuery());
      items = erpItems.map(mapERPItemToItem);
      console.log(`✅ ${items.length} itens carregados do ERP`);
    } catch (erpError) {
      console.warn('⚠️  ERP indisponível, usando dados mock:', erpError);
      items = mockItems;
    }
    
    // Aplicar filtros
    let filtered = [...items];
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(item => 
        item.descricao.toLowerCase().includes(searchLower) ||
        item.codigo_item.toLowerCase().includes(searchLower)
      );
    }
    
    if (classe_abc) {
      filtered = filtered.filter(item => item.classe_abc === classe_abc);
    }
    
    res.json(filtered);
  } catch (error) {
    console.error('❌ Erro ao buscar itens:', error);
    res.status(500).json({ message: 'Erro ao buscar itens' });
  }
});

// Get all items with pedido status (status do pedido mais antigo em andamento)
router.get('/with-status/all', authMiddleware, async (req, res) => {
  try {
    const { search, classe_abc } = req.query;
    
    let items: Item[];
    
    // Tentar buscar do ERP
    try {
      const erpItems = await executeERPQuery<ERPItem>(getItemsQuery());
      items = erpItems.map(mapERPItemToItem);
      console.log(`✅ ${items.length} itens carregados do ERP`);
    } catch (erpError) {
      console.warn('⚠️  ERP indisponível, usando dados mock:', erpError);
      items = mockItems;
    }
    
    // Aplicar filtros
    let filtered = [...items];
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(item => 
        item.descricao.toLowerCase().includes(searchLower) ||
        item.codigo_item.toLowerCase().includes(searchLower)
      );
    }
    
    if (classe_abc) {
      filtered = filtered.filter(item => item.classe_abc === classe_abc);
    }
    
    // Enriquecer itens com status do pedido mais antigo em andamento
    const statusEmAndamento = [
      StatusPedido.ANALISE_COTACAO,
      StatusPedido.ENVIADO_FORNECEDOR,
      StatusPedido.AGUARDANDO_FATURAMENTO,
      StatusPedido.FATURADO,
      StatusPedido.EM_ROTA,
      StatusPedido.RECEBIMENTO_NOTA
    ];
    
    const itemsWithStatus: ItemWithStatus[] = await Promise.all(
      filtered.map(async (item) => {
        try {
          // Buscar pedidos em andamento que contenham este item (pelo codigo_item)
          const pedidosComItem = await Pedido.find({
            status_atual: { $in: statusEmAndamento },
            'itens.codigo_item': item.codigo_item
          })
            .sort({ data_criacao: 1 }) // Ordenar por data_criacao ASC (mais antigo primeiro)
            .limit(1) // Pegar apenas o mais antigo
            .select('status_atual numero');
          
          if (pedidosComItem.length > 0) {
            const pedidoMaisAntigo = pedidosComItem[0];
            return {
              ...item,
              status_pedido: pedidoMaisAntigo.status_atual,
              numero_pedido: pedidoMaisAntigo.numero
            };
          }
          
          return item;
        } catch (error) {
          console.error(`Erro ao buscar pedido para item ${item.codigo_item}:`, error);
          return item;
        }
      })
    );
    
    res.json(itemsWithStatus);
  } catch (error) {
    console.error('❌ Erro ao buscar itens com status:', error);
    res.status(500).json({ message: 'Erro ao buscar itens' });
  }
});

// Get item by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    let items: Item[];
    
    // Tentar buscar do ERP
    try {
      const erpItems = await executeERPQuery<ERPItem>(getItemsQuery());
      items = erpItems.map(mapERPItemToItem);
    } catch (erpError) {
      console.warn('⚠️  ERP indisponível, usando dados mock');
      items = mockItems;
    }
    
    const item = items.find(i => i.id === req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item não encontrado' });
    }
    res.json(item);
  } catch (error) {
    console.error('❌ Erro ao buscar item:', error);
    res.status(500).json({ message: 'Erro ao buscar item' });
  }
});

export default router;
