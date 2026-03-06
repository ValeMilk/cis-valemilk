import { useState, useEffect } from 'react';
import { Package, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import api from '../services/api';
import { Item } from '../types';

const HistoricalAnalysisPage = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [classeFilter, setClasseFilter] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchTerm, tipoFilter, classeFilter, sortColumn, sortDirection]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/items/historical');
      setItems(response.data);
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
      alert('Erro ao carregar análise histórica do ERP');
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.descricao.toLowerCase().includes(lowerSearch) ||
        item.codigo_item.toLowerCase().includes(lowerSearch) ||
        item.fornecedor.toLowerCase().includes(lowerSearch)
      );
    }

    if (tipoFilter) {
      filtered = filtered.filter(item => item.tipo === tipoFilter);
    }

    if (classeFilter) {
      filtered = filtered.filter(item => item.classe_abc === classeFilter);
    }

    // Sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        // Caso especial para dias_cobertura (calculado dinamicamente)
        if (sortColumn === 'dias_cobertura') {
          const aDias = calcularDiasCobertura(a.previsao_fim_estoque);
          const bDias = calcularDiasCobertura(b.previsao_fim_estoque);
          
          // Converter para número, tratando '-' como infinito
          const aNum = aDias === '-' ? Infinity : parseInt(aDias);
          const bNum = bDias === '-' ? Infinity : parseInt(bDias);
          
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        let aVal: any = a[sortColumn as keyof Item];
        let bVal: any = b[sortColumn as keyof Item];

        // Handle numeric sorting
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        // Handle string sorting
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    setFilteredItems(filtered);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="inline w-3 h-3 ml-1" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="inline w-3 h-3 ml-1" />
      : <ArrowDown className="inline w-3 h-3 ml-1" />;
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

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return '-';
    return dateStr;
  };

  const calcularDiasCobertura = (prevFimEstoque: string): string => {
    if (!prevFimEstoque || prevFimEstoque === '-') {
      return '-';
    }
    
    if (prevFimEstoque === 'Sem Estoque') {
      return '0';
    }
    
    if (prevFimEstoque === 'Sem Consumo') {
      return '-';
    }
    
    const parts = prevFimEstoque.split('/');
    if (parts.length !== 3) return '-';
    
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parseInt(parts[2]);
    
    const targetDate = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays.toString();
  };

  // Get unique valores for filters
  const uniqueTipos = Array.from(new Set(items.map(item => item.tipo))).sort();
  const uniqueClasses = Array.from(new Set(items.map(item => item.classe_abc))).filter(Boolean).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando análise histórica do ERP...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Análise Histórica de Itens
          </h1>
          <p className="text-gray-600 mt-1">
            Análise detalhada com histórico de fornecedores desde set/2023
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar Item (Descrição/Código/Fornecedor)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os Tipos</option>
              {uniqueTipos.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>

          {/* Classe ABC Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Classe ABC
            </label>
            <select
              value={classeFilter}
              onChange={(e) => setClasseFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas as Classes</option>
              {uniqueClasses.map(classe => (
                <option key={classe} value={classe}>{classe}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total de Itens</p>
          <p className="text-2xl font-bold text-gray-900">{filteredItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Classe A</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredItems.filter(i => i.classe_abc === 'A').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Classe B</p>
          <p className="text-2xl font-bold text-orange-600">
            {filteredItems.filter(i => i.classe_abc === 'B').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Classe C</p>
          <p className="text-2xl font-bold text-gray-600">
            {filteredItems.filter(i => i.classe_abc === 'C').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '600px' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-2 py-2 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('codigo_item')}
                >
                  Código{renderSortIcon('codigo_item')}
                </th>
                <th 
                  className="px-2 py-2 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('tipo')}
                >
                  Tipo{renderSortIcon('tipo')}
                </th>
                <th 
                  className="px-2 py-2 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('descricao')}
                >
                  Descrição{renderSortIcon('descricao')}
                </th>
                <th 
                  className="px-2 py-2 text-left font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('fornecedor')}
                >
                  Fornecedor{renderSortIcon('fornecedor')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('classe_abc')}
                >
                  Classe{renderSortIcon('classe_abc')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('estoque_atual')}
                >
                  Saldo Total{renderSortIcon('estoque_atual')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('giro_mensal')}
                >
                  Giro Mensal{renderSortIcon('giro_mensal')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('media_giro_trimestre')}
                >
                  Média Giro Trim.{renderSortIcon('media_giro_trimestre')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('valorUltimaEntrada')}
                >
                  Valor Últ. Entrada{renderSortIcon('valorUltimaEntrada')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('data_ultima_entrada')}
                >
                  Dt Últ. Entrada{renderSortIcon('data_ultima_entrada')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('previsao_fim_estoque')}
                >
                  Prev. Fim Estoque{renderSortIcon('previsao_fim_estoque')}
                </th>
                <th 
                  className="px-2 py-2 text-center font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100" 
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => handleSort('dias_cobertura')}
                >
                  Dias Cobertura{renderSortIcon('dias_cobertura')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum item encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-sm text-gray-600">{item.codigo_item}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">{item.tipo}</td>
                    <td className="px-2 py-2 text-sm text-gray-900">{item.descricao}</td>
                    <td className="px-2 py-2 text-xs text-gray-600">{item.fornecedor}</td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        item.classe_abc === 'A' ? 'bg-green-100 text-green-800' :
                        item.classe_abc === 'B' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.classe_abc}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center text-sm font-medium text-gray-900">
                      {formatNumber(item.estoque_atual)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm text-gray-600">
                      {formatNumber(item.giro_mensal)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm text-gray-600">
                      {formatNumber(item.media_giro_trimestre)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm text-gray-600">
                      {formatCurrency(item.valorUltimaEntrada)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm text-gray-600">
                      {formatDate(item.data_ultima_entrada)}
                    </td>
                    <td className="px-2 py-2 text-center text-sm font-medium text-gray-700">
                      {item.previsao_fim_estoque || '-'}
                    </td>
                    <td className="px-2 py-2 text-center text-sm font-semibold">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Histórico de Compras */}
    </div>
  );
};

export default HistoricalAnalysisPage;
