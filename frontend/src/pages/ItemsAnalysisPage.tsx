import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, Filter, ShoppingCart, Calendar, DollarSign } from 'lucide-react';
import api from '../services/api';
import { Item } from '../types';

const ItemsAnalysisPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classeFilter, setClasseFilter] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchTerm, classeFilter]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/items');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      alert('Erro ao carregar itens do ERP');
    } finally {
      setLoading(false);
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

    if (classeFilter) {
      filtered = filtered.filter((item) => item.classe_abc === classeFilter);
    }

    setFilteredItems(filtered);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Item
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

          {/* Classe ABC Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Classe ABC
            </label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={classeFilter}
                onChange={(e) => setClasseFilter(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="">Todas as Classes</option>
                <option value="A">Classe A</option>
                <option value="B">Classe B</option>
                <option value="C">Classe C</option>
              </select>
            </div>
          </div>
        </div>

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
                <th className="px-0.5 py-1 text-left font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Cód
                </th>
                <th className="px-0.5 py-1 text-left font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Tipo
                </th>
                <th className="px-1 py-1 text-left font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Descrição
                </th>
                <th className="px-0.5 py-1 text-left font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Fornecedor
                </th>
                <th className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Cl
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Abt
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Int
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Ext
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Tot
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  G.M
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  M.T
                </th>
                <th className="px-0.5 py-1 text-right font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  R$
                </th>
                <th className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Data
                </th>
                <th className="px-0.5 py-1 text-center font-semibold text-gray-700 uppercase" style={{ fontSize: '0.6rem' }}>
                  Qtd
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum item encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
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
                    <td className="px-0.5 py-0.5 text-gray-600" style={{ fontSize: '0.6rem' }} title={item.fornecedor}>
                      <div className="truncate max-w-[120px]">{item.fornecedor}</div>
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
                      {formatNumber(item.saldo_dep_fechado_interno)}
                    </td>
                    <td className="px-0.5 py-0.5 text-right text-gray-600">
                      {formatNumber(item.saldo_dep_fechado_externo)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
          💡 Dica: Role horizontalmente para ver todas as colunas (Tipo, Fornecedor, Depósitos, Giros, Valor, Data, etc.)
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
