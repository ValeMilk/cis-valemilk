import { useState, useEffect } from 'react';
import { RefreshCw, Search, PackageCheck, Clock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../services/api';

interface ReposicaoItem {
  codigo_item: number;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  minimo: number;
  dep_aberto: number;
  producoes_aberto: number;
  saldo_real: number;
  reposicao: number;
  giro_mensal: number;
}

interface Reposicao {
  _id: string;
  data_carregamento: string;
  carregado_por_nome: string;
  itens: ReposicaoItem[];
}

type SortField = 'codigo_item' | 'minimo' | 'dep_aberto' | 'producoes_aberto' | 'saldo_real' | 'reposicao' | 'giro_mensal';
type SortDir = 'none' | 'asc' | 'desc';

const ReposicaoPage = () => {
  const [data, setData] = useState<Reposicao | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [reposicaoFilter, setReposicaoFilter] = useState<'todos' | 'precisa_repor' | 'ok'>('todos');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('none');

  useEffect(() => {
    fetchLatest();
  }, []);

  const fetchLatest = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reposicao/latest');
      setData(response.data);
    } catch (error) {
      console.error('Erro ao buscar reposição:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncERP = async () => {
    try {
      setSyncing(true);
      const response = await api.post('/reposicao/sync-erp');
      setData(response.data);
    } catch (error) {
      console.error('Erro ao carregar ERP:', error);
      alert('Erro ao carregar dados do ERP');
    } finally {
      setSyncing(false);
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'none') setSortDir('asc');
      else if (sortDir === 'asc') setSortDir('desc');
      else { setSortDir('none'); setSortField(null); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field || sortDir === 'none') return <ArrowUpDown size={12} className="text-gray-400 ml-1 inline" />;
    if (sortDir === 'asc') return <ArrowUp size={12} className="text-blue-600 ml-1 inline" />;
    return <ArrowDown size={12} className="text-blue-600 ml-1 inline" />;
  };

  const getFilteredItems = (): ReposicaoItem[] => {
    if (!data) return [];
    let items = [...data.itens];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.descricao.toLowerCase().includes(lower) ||
        String(i.codigo_item).includes(lower)
      );
    }

    if (tipoFilter) {
      items = items.filter(i => i.tipo === tipoFilter);
    }

    if (reposicaoFilter === 'precisa_repor') {
      items = items.filter(i => i.reposicao > 0);
    } else if (reposicaoFilter === 'ok') {
      items = items.filter(i => i.reposicao <= 0);
    }

    if (sortField && sortDir !== 'none') {
      items.sort((a, b) => {
        const va = a[sortField] as number;
        const vb = b[sortField] as number;
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    return items;
  };

  const filteredItems = getFilteredItems();
  const tipos = data ? [...new Set(data.itens.map(i => i.tipo))].sort() : [];
  const precisamRepor = data ? data.itens.filter(i => i.reposicao > 0).length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <PackageCheck className="text-blue-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Reposição</h1>
            {data && (
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Clock size={14} />
                <span>Última atualização: {formatDate(data.data_carregamento)} • Por: {data.carregado_por_nome}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={syncERP}
          disabled={syncing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
          <span>{syncing ? 'Carregando...' : 'Carregar ERP'}</span>
        </button>
      </div>

      {!data ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <PackageCheck size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhum dado carregado</h2>
          <p className="text-gray-500 mb-4">Clique em "Carregar ERP" para buscar os dados de reposição do sistema.</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-sm text-gray-500">Total Itens</p>
              <p className="text-2xl font-bold text-blue-600">{data.itens.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-sm text-gray-500">Precisam Repor</p>
              <p className="text-2xl font-bold text-red-600">{precisamRepor}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-sm text-gray-500">Estoque OK</p>
              <p className="text-2xl font-bold text-green-600">{data.itens.length - precisamRepor}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar código ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Tipos</option>
                {tipos.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={reposicaoFilter}
                onChange={(e) => setReposicaoFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                <option value="precisa_repor">Precisa Repor</option>
                <option value="ok">Estoque OK</option>
              </select>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('codigo_item')}
                  >
                    Código <SortIcon field="codigo_item" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Tipo</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">UM</th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('minimo')}
                  >
                    Mínimo <SortIcon field="minimo" />
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('dep_aberto')}
                  >
                    Dep. Aberto <SortIcon field="dep_aberto" />
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell"
                    onClick={() => toggleSort('producoes_aberto')}
                  >
                    Prod. Aberto <SortIcon field="producoes_aberto" />
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('saldo_real')}
                  >
                    Saldo Real <SortIcon field="saldo_real" />
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('reposicao')}
                  >
                    Reposição <SortIcon field="reposicao" />
                  </th>
                  <th
                    className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell"
                    onClick={() => toggleSort('giro_mensal')}
                  >
                    Giro Mensal <SortIcon field="giro_mensal" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.codigo_item} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-mono whitespace-nowrap">{String(item.codigo_item).padStart(6, '0')}</td>
                      <td className="px-3 py-2 text-sm max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 hidden lg:table-cell">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{item.tipo}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600 hidden sm:table-cell">{item.unidade_medida}</td>
                      <td className="px-3 py-2 text-sm text-right">{formatNumber(item.minimo)}</td>
                      <td className="px-3 py-2 text-sm text-right">{formatNumber(item.dep_aberto)}</td>
                      <td className="px-3 py-2 text-sm text-right hidden md:table-cell">{formatNumber(item.producoes_aberto)}</td>
                      <td className="px-3 py-2 text-sm text-right font-semibold text-blue-700">{formatNumber(item.saldo_real)}</td>
                      <td className={`px-3 py-2 text-sm text-right font-bold ${
                        item.reposicao > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {item.reposicao > 0 ? '+' : ''}{formatNumber(item.reposicao)}
                      </td>
                      <td className="px-3 py-2 text-sm text-right hidden md:table-cell">{formatNumber(item.giro_mensal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500">
              Exibindo {filteredItems.length} de {data.itens.length} itens
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ReposicaoPage;
