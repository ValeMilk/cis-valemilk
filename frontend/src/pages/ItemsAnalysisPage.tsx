import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Filter, ShoppingCart, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../services/api';
import { Item, StatusPedido } from '../types';
import MultiSelectDropdown from '../components/MultiSelectDropdown';

const ItemsAnalysisPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTipos, setSelectedTipos] = useState<Set<string>>(new Set());
  const [selectedFornecedores, setSelectedFornecedores] = useState<Set<string>>(new Set());
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());
  const [prevFimFilter, setPrevFimFilter] = useState<string>('');
  const [prevFimDate, setPrevFimDate] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [fornecedorItensMap, setFornecedorItensMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchItems();
    fetchFornecedorItensMap();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchTerm, selectedTipos, selectedFornecedores, selectedClasses, prevFimFilter, prevFimDate, sortColumn, sortDirection]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/items/with-status/all');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      alert('Erro ao carregar itens do ERP');
    } finally {
      setLoading(false);
    }
  };

  const fetchFornecedorItensMap = async () => {
    try {
      const response = await api.get('/items/fornecedor-itens-map');
      setFornecedorItensMap(response.data);
    } catch (error) {
      console.error('Erro ao buscar mapa fornecedor-itens:', error);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.descricao.toLowerCase().includes(term) ||
          item.codigo_item.toLowerCase().includes(term)
      );
    }

    if (selectedTipos.size > 0) {
      filtered = filtered.filter((item) => selectedTipos.has(item.tipo));
    }

    if (selectedFornecedores.size > 0) {
      // Build a set of all item codes that belong to any selected fornecedor
      const allCodigosSet = new Set<string>();
      const fornecedoresSemMapa = new Set<string>();
      selectedFornecedores.forEach(f => {
        const codigos = fornecedorItensMap[f];
        if (codigos && codigos.length > 0) {
          codigos.forEach(c => allCodigosSet.add(c));
        } else {
          fornecedoresSemMapa.add(f);
        }
      });
      filtered = filtered.filter((item) =>
        allCodigosSet.has(item.codigo_item) || fornecedoresSemMapa.has(item.fornecedor)
      );
    }

    if (selectedClasses.size > 0) {
      filtered = filtered.filter((item) => selectedClasses.has(item.classe_abc));
    }

    if (prevFimFilter) {
      filtered = filtered.filter((item) => {
        const prevFim = item.previsao_fim_estoque || '';
        
        if (prevFimFilter === 'Sem Estoque') return prevFim === 'Sem Estoque';
        if (prevFimFilter === 'Sem Consumo') return prevFim === 'Sem Consumo';
        
        // Filtros por período de dias
        if (prevFimFilter === '30dias' || prevFimFilter === '60dias' || prevFimFilter === '90dias') {
          // Verifica se tem uma data válida (não é "Sem Estoque", "Sem Consumo" ou "-")
          if (prevFim === 'Sem Estoque' || prevFim === 'Sem Consumo' || prevFim === '-' || !prevFim) {
            return false;
          }
          
          // Converte a data de dd/MM/yyyy para Date
          const [dia, mes, ano] = prevFim.split('/').map(Number);
          const dataPrevFim = new Date(ano, mes - 1, dia);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          
          // Calcula diferença em dias
          const diffTime = dataPrevFim.getTime() - hoje.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (prevFimFilter === '30dias') return diffDays <= 30 && diffDays >= 0;
          if (prevFimFilter === '60dias') return diffDays <= 60 && diffDays >= 0;
          if (prevFimFilter === '90dias') return diffDays <= 90 && diffDays >= 0;
        }
        
        if (prevFimFilter === 'Com Data') {
          return prevFim !== 'Sem Estoque' && prevFim !== 'Sem Consumo' && prevFim !== '-' && prevFim;
        }
        
        if (prevFimFilter === 'Vencido') {
          if (prevFim === 'Sem Estoque' || prevFim === 'Sem Consumo' || prevFim === '-' || !prevFim) {
            return false;
          }
          const [dia, mes, ano] = prevFim.split('/').map(Number);
          const dataPrevFim = new Date(ano, mes - 1, dia);
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          return dataPrevFim < hoje;
        }
        
        return true;
      });
    }

    // Filtro por data específica
    if (prevFimDate) {
      filtered = filtered.filter((item) => {
        const prevFim = item.previsao_fim_estoque || '';
        
        // Ignora itens sem data válida
        if (prevFim === 'Sem Estoque' || prevFim === 'Sem Consumo' || prevFim === '-' || !prevFim) {
          return false;
        }
        
        // Converte a data de dd/MM/yyyy para Date
        const [dia, mes, ano] = prevFim.split('/').map(Number);
        const dataPrevFim = new Date(ano, mes - 1, dia);
        dataPrevFim.setHours(0, 0, 0, 0);
        
        // Data selecionada pelo usuário (formato yyyy-MM-dd do input type="date")
        const dataSelecionada = new Date(prevFimDate);
        dataSelecionada.setHours(0, 0, 0, 0);
        
        // Retorna itens com data de fim <= data selecionada
        return dataPrevFim <= dataSelecionada;
      });
    }

    // Aplicar ordenação se houver coluna selecionada
    if (sortColumn) {
      filtered = sortItems(filtered, sortColumn, sortDirection);
    }
    
    setFilteredItems(filtered);
  };

  const sortItems = (itemsToSort: Item[], column: string, direction: 'asc' | 'desc'): Item[] => {
    const sorted = [...itemsToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Mapear coluna para propriedade do item
      switch (column) {
        case 'codigo':
          aValue = a.codigo_item;
          bValue = b.codigo_item;
          break;
        case 'tipo':
          aValue = a.tipo;
          bValue = b.tipo;
          break;
        case 'descricao':
          aValue = a.descricao;
          bValue = b.descricao;
          break;
        case 'classe':
          aValue = a.classe_abc;
          bValue = b.classe_abc;
          break;
        case 'dep_aberto':
          aValue = a.saldo_dep_aberto || 0;
          bValue = b.saldo_dep_aberto || 0;
          break;
        case 'dep_interno':
          aValue = a.saldo_dep_fechado_interno || 0;
          bValue = b.saldo_dep_fechado_interno || 0;
          break;
        case 'dep_externo':
          aValue = a.saldo_dep_fechado_externo || 0;
          bValue = b.saldo_dep_fechado_externo || 0;
          break;
        case 'saldo_total':
          aValue = (a.saldo_dep_aberto || 0) + (a.saldo_dep_fechado_interno || 0) + (a.saldo_dep_fechado_externo || 0);
          bValue = (b.saldo_dep_aberto || 0) + (b.saldo_dep_fechado_interno || 0) + (b.saldo_dep_fechado_externo || 0);
          break;
        case 'giro_mensal':
          aValue = a.giro_mensal || 0;
          bValue = b.giro_mensal || 0;
          break;
        case 'med_giro_trimestre':
          aValue = a.media_giro_trimestre || 0;
          bValue = b.media_giro_trimestre || 0;
          break;
        case 'vlr_ultima_entrada':
          aValue = a.valorUltimaEntrada || 0;
          bValue = b.valorUltimaEntrada || 0;
          break;
        case 'dt_ultima_entrada':
          // Converter data dd/MM/yyyy para timestamp para ordenação
          aValue = parseDateToTimestamp(a.data_ultima_entrada);
          bValue = parseDateToTimestamp(b.data_ultima_entrada);
          break;
        case 'previsao_fim':
          // Converter data dd/MM/yyyy para timestamp para ordenação
          aValue = parseDateToTimestamp(a.previsao_fim_estoque);
          bValue = parseDateToTimestamp(b.previsao_fim_estoque);
          break;
        case 'dias_cobertura':
          // Calcular dias de cobertura numericamente
          aValue = calcularDiasCoberturaNumerico(a.previsao_fim_estoque);
          bValue = calcularDiasCoberturaNumerico(b.previsao_fim_estoque);
          break;
        default:
          return 0;
      }

      // Comparação
      if (aValue === null || aValue === undefined || aValue === '' || aValue === -Infinity) return 1;
      if (bValue === null || bValue === undefined || bValue === '' || bValue === -Infinity) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue, 'pt-BR')
          : bValue.localeCompare(aValue, 'pt-BR');
      }
      
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return sorted;
  };

  const parseDateToTimestamp = (dateStr?: string): number => {
    if (!dateStr || dateStr === '-' || dateStr === 'Sem Estoque' || dateStr === 'Sem Consumo') {
      return -Infinity; // Coloca no final
    }
    try {
      const [dia, mes, ano] = dateStr.split('/').map(Number);
      return new Date(ano, mes - 1, dia).getTime();
    } catch {
      return -Infinity;
    }
  };

  const calcularDiasCoberturaNumerico = (previsaoFim: string): number => {
    if (!previsaoFim || previsaoFim === 'Sem Consumo' || previsaoFim === '-') {
      return -Infinity; // Coloca no final
    }
    
    // Se está sem estoque, retorna 0
    if (previsaoFim === 'Sem Estoque') {
      return 0;
    }
    try {
      const [dia, mes, ano] = previsaoFim.split('/').map(Number);
      const dataPrevFim = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diffTime = dataPrevFim.getTime() - hoje.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return -Infinity;
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Se já está ordenando por essa coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nova coluna, começa com ascendente
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown size={12} className="inline ml-1 opacity-30" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp size={12} className="inline ml-1 text-blue-600" />
      : <ArrowDown size={12} className="inline ml-1 text-blue-600" />;
  };

  // Get unique tipos and fornecedores for filters
  const uniqueTipos = Array.from(new Set(items.map(item => item.tipo))).sort();
  const uniqueFornecedores = Array.from(new Set([
    ...items.map(item => item.fornecedor),
    ...Object.keys(fornecedorItensMap)
  ])).sort();

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      const newQuantities = { ...quantities };
      delete newQuantities[itemId];
      setQuantities(newQuantities);
    } else {
      newSelected.add(itemId);
      setQuantities({ ...quantities, [itemId]: 1 });
    }
    setSelectedItems(newSelected);
  };

  const updateQuantity = (itemId: string, value: number) => {
    setQuantities({ ...quantities, [itemId]: Math.max(1, value) });
  };

  const handleCreatePedido = () => {
    const selectedItemsData = Array.from(selectedItems).map((id) => {
      const item = items.find((i) => i.id === id);
      return {
        item: item!,
        quantidade: quantities[id] || 1,
      };
    });

    // Salvar no sessionStorage para usar na próxima página
    sessionStorage.setItem('selectedItems', JSON.stringify(selectedItemsData));
    navigate('/pedidos/novo');
  };

  const getClasseBadgeColor = (classe: string) => {
    switch (classe) {
      case 'A':
        return 'bg-green-100 text-green-800';
      case 'B':
        return 'bg-yellow-100 text-yellow-800';
      case 'C':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const calcularDiasCobertura = (previsaoFim: string): string => {
    // Se não tem previsão válida, retorna traço
    if (!previsaoFim || previsaoFim === 'Sem Consumo' || previsaoFim === '-') {
      return '-';
    }
    
    // Se está sem estoque, retorna 0
    if (previsaoFim === 'Sem Estoque') {
      return '0';
    }

    try {
      // Converte a data de dd/MM/yyyy para Date
      const [dia, mes, ano] = previsaoFim.split('/').map(Number);
      const dataPrevFim = new Date(ano, mes - 1, dia);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      // Calcula diferença em dias
      const diffTime = dataPrevFim.getTime() - hoje.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return `${diffDays}`;
    } catch (error) {
      return '-';
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    // A data já vem formatada do backend (formato dd/MM/yyyy)
    return dateStr;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadgeColor = (status: StatusPedido) => {
    switch (status) {
      case StatusPedido.ANALISE_COTACAO:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case StatusPedido.ENVIADO_FORNECEDOR:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case StatusPedido.AGUARDANDO_FATURAMENTO:
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case StatusPedido.FATURADO:
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case StatusPedido.EM_ROTA:
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case StatusPedido.RECEBIMENTO_NOTA:
        return 'bg-teal-100 text-teal-800 border-teal-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: StatusPedido) => {
    switch (status) {
      case StatusPedido.ANALISE_COTACAO:
        return 'Análise';
      case StatusPedido.ENVIADO_FORNECEDOR:
        return 'Enviado';
      case StatusPedido.AGUARDANDO_FATURAMENTO:
        return 'Aguard. Fat.';
      case StatusPedido.FATURADO:
        return 'Faturado';
      case StatusPedido.EM_ROTA:
        return 'Em Rota';
      case StatusPedido.RECEBIMENTO_NOTA:
        return 'Recebimento';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando itens do ERP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise de Itens - ERP</h1>
          <p className="text-gray-600 mt-1">
            Analise estoque, giro e preços antes de criar pedidos de compra
          </p>
        </div>
        {selectedItems.size > 0 && (
          <button
            onClick={handleCreatePedido}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            Criar Pedido ({selectedItems.size} itens)
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search - Descrição/Código */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Item (Descrição/Código)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Código ou descrição..."
                className="pl-10 w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Tipo Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <MultiSelectDropdown
              label="Todos os Tipos"
              options={uniqueTipos}
              selected={selectedTipos}
              onChange={setSelectedTipos}
            />
          </div>

          {/* Fornecedor Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fornecedor
            </label>
            <MultiSelectDropdown
              label="Todos os Fornecedores"
              options={uniqueFornecedores}
              selected={selectedFornecedores}
              onChange={setSelectedFornecedores}
            />
          </div>

          {/* Classe ABC Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classe ABC
            </label>
            <MultiSelectDropdown
              label="Todas as Classes"
              options={['A', 'B', 'C']}
              selected={selectedClasses}
              onChange={setSelectedClasses}
            />
          </div>

          {/* Previsão Fim Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prev. Fim Estoque
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={prevFimFilter}
                onChange={(e) => setPrevFimFilter(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="">Todos</option>
                <option value="Vencido">Já Vencido</option>
                <option value="30dias">Vence em até 30 dias</option>
                <option value="60dias">Vence em até 60 dias</option>
                <option value="90dias">Vence em até 90 dias</option>
                <option value="Com Data">Com Data Prevista</option>
                <option value="Sem Estoque">Sem Estoque</option>
                <option value="Sem Consumo">Sem Consumo</option>
              </select>
            </div>
          </div>

          {/* Data Específica Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vence até a data
            </label>
            <input
              type="date"
              value={prevFimDate}
              onChange={(e) => setPrevFimDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {prevFimDate && (
              <p className="text-xs text-gray-500 mt-1">
                Mostrando itens que acabam até {new Date(prevFimDate + 'T00:00:00').toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || selectedTipos.size > 0 || selectedFornecedores.size > 0 || selectedClasses.size > 0 || prevFimFilter || prevFimDate) && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedTipos(new Set());
                setSelectedFornecedores(new Set());
                setSelectedClasses(new Set());
                setPrevFimFilter('');
                setPrevFimDate('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Limpar Filtros
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total de Itens</p>
            <p className="text-2xl font-bold text-gray-900">{filteredItems.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Classe A</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredItems.filter((i) => i.classe_abc === 'A').length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Classe B</p>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredItems.filter((i) => i.classe_abc === 'B').length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Selecionados</p>
            <p className="text-2xl font-bold text-blue-600">{selectedItems.size}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full divide-y divide-gray-200" style={{ fontSize: '0.65rem', tableLayout: 'auto' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-0.5 py-1 text-left sticky left-0 bg-gray-50 z-10" style={{ width: '25px' }}>
                  <input
                    type="checkbox"
                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allIds = new Set(filteredItems.map((i) => i.id));
                        setSelectedItems(allIds);
                        const newQuantities: { [key: string]: number } = {};
                        filteredItems.forEach((i) => {
                          newQuantities[i.id] = quantities[i.id] || 1;
                        });
                        setQuantities(newQuantities);
                      } else {
                        setSelectedItems(new Set());
                        setQuantities({});
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </th>
                <th 
                  className="px-0.5 py-1 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('codigo')}
                >
                  Cód{renderSortIcon('codigo')}
                </th>
                <th 
                  className="px-0.5 py-1 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('tipo')}
                >
                  Tipo{renderSortIcon('tipo')}
                </th>
                <th 
                  className="px-1 py-1 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('descricao')}
                >
                  Descrição{renderSortIcon('descricao')}
                </th>
                <th 
                  className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('classe')}
                >
                  Cl{renderSortIcon('classe')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('dep_aberto')}
                >
                  Dep.Aberto{renderSortIcon('dep_aberto')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('dep_externo')}
                >
                  Dep.Externo{renderSortIcon('dep_externo')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('dep_interno')}
                >
                  Dep.Interno{renderSortIcon('dep_interno')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('saldo_total')}
                >
                  Saldo Total{renderSortIcon('saldo_total')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('giro_mensal')}
                >
                  Giro Mensal{renderSortIcon('giro_mensal')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('med_giro_trimestre')}
                >
                  Méd Giro Trimestre{renderSortIcon('med_giro_trimestre')}
                </th>
                <th 
                  className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('vlr_ultima_entrada')}
                >
                  Vlr Ultima Entrada{renderSortIcon('vlr_ultima_entrada')}
                </th>
                <th 
                  className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('dt_ultima_entrada')}
                >
                  Dt Ultima Entrada{renderSortIcon('dt_ultima_entrada')}
                </th>
                <th 
                  className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('previsao_fim')}
                >
                  Previsão Fim{renderSortIcon('previsao_fim')}
                </th>
                <th 
                  className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase" 
                  style={{ fontSize: '0.6rem' }}
                >
                  Status Pedido
                </th>
                <th 
                  className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.6rem' }}
                  onClick={() => handleSort('dias_cobertura')}
                >
                  Dias Cobertura{renderSortIcon('dias_cobertura')}
                </th>
                <th className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Quantidade
                </th>
              </tr>
            </thead>
            <tbody 
              key={`tbody-${filteredItems.length}-${searchTerm}-${selectedTipos.size}-${selectedFornecedores.size}-${selectedClasses.size}-${prevFimFilter}`}
              className="bg-white divide-y divide-gray-200"
            >
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum item encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  return (
                  <tr
                    key={`${item.id}-${index}-filtered`}
                    className={`hover:bg-gray-50 ${
                      selectedItems.has(item.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className={`px-0.5 py-0.5 sticky left-0 z-10 ${selectedItems.has(item.id) ? 'bg-blue-50' : 'bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-0.5 py-0.5 font-medium text-gray-900">
                      {item.codigo_item}
                    </td>
                    <td className="px-0.5 py-0.5 text-gray-600" style={{ fontSize: '0.6rem' }}>
                      {item.tipo
                        .replace('Matéria Prima', 'MP')
                        .replace('Material de Uso e Consumo', 'U/C')
                        .replace('Embalagem', 'Emb')
                        .replace('Outros Insumos', 'OI')
                      }
                    </td>
                    <td className="px-0.5 py-0.5 text-gray-900" title={item.descricao}>
                      <div className="truncate max-w-xs">{item.descricao}</div>
                    </td>
                    <td className="px-0.5 py-0.5 text-center">
                      <span
                        className={`px-0.5 py-0 font-semibold rounded ${getClasseBadgeColor(
                          item.classe_abc
                        )}`}
                        style={{ fontSize: '0.6rem' }}
                      >
                        {item.classe_abc}
                      </span>
                    </td>
                    <td className="px-0.5 py-0.5 text-right text-gray-600">
                      {formatNumber(item.saldo_dep_aberto)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right text-gray-600">
                      {formatNumber(item.saldo_dep_fechado_externo)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right text-gray-600">
                      {formatNumber(item.saldo_dep_fechado_interno)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">
                      {formatNumber(item.estoque_atual)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right font-medium">
                      {formatNumber(item.giro_mensal)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right text-gray-600">
                      {formatNumber(item.media_giro_trimestre)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right font-medium text-gray-900" style={{ fontSize: '0.6rem' }}>
                      {formatCurrency(item.valorUltimaEntrada)}
                    </td>
                    <td className="px-0.5 py-0.5 text-center text-gray-600" style={{ fontSize: '0.6rem' }}>
                      {formatDate(item.data_ultima_entrada)}
                    </td>
                    <td className="px-0.5 py-0.5 text-center text-gray-700 font-medium" style={{ fontSize: '0.6rem' }}>
                      {item.previsao_fim_estoque || '-'}
                    </td>
                    <td className="px-0.5 py-0.5 text-center" style={{ fontSize: '0.55rem' }}>
                      {item.status_pedido ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span 
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(item.status_pedido)}`}
                            title={`Pedido ${item.numero_pedido}`}
                          >
                            {getStatusLabel(item.status_pedido)}
                          </span>
                          {item.numero_pedido && (
                            <span className="text-gray-500 text-xs">
                              #{item.numero_pedido}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-0.5 py-0.5 text-center font-semibold" style={{ fontSize: '0.6rem' }}>
                      <span className={`${
                        calcularDiasCobertura(item.previsao_fim_estoque) !== '-' && parseInt(calcularDiasCobertura(item.previsao_fim_estoque)) <= 30
                          ? 'text-red-600'
                          : calcularDiasCobertura(item.previsao_fim_estoque) !== '-' && parseInt(calcularDiasCobertura(item.previsao_fim_estoque)) <= 60
                          ? 'text-orange-600'
                          : 'text-gray-700'
                      }`}>
                        {calcularDiasCobertura(item.previsao_fim_estoque)}
                      </span>
                    </td>
                    <td className="px-0.5 py-0.5 text-center">
                      {selectedItems.has(item.id) ? (
                        <input
                          type="number"
                          min="1"
                          value={quantities[item.id] || 1}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                          className="w-10 border border-gray-300 rounded px-0.5 py-0 text-center focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                          style={{ fontSize: '0.6rem' }}
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
          💡 Dica: Role horizontalmente para ver todas as colunas (Tipo, Depósitos, Giros, Valor, Data, etc.)
        </div>
      </div>

      {/* Footer Info */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-blue-600 mt-0.5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">
                {selectedItems.size} {selectedItems.size === 1 ? 'item selecionado' : 'itens selecionados'}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Clique no botão "Criar Pedido" para gerar um pedido de compra com os itens selecionados.
              </p>
            </div>
            <button
              onClick={handleCreatePedido}
              className="flex-shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Criar Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsAnalysisPage;
