import { useState, useEffect, useCallback, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { RefreshCw, Search, PackageCheck, Clock, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle, Printer, WifiOff, Wifi, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface PendingContagem {
  reposicaoId: string;
  codigoItem: number;
  quantidade: number | null;
  timestamp: number;
}

const PENDING_KEY = 'reposicao_pending_contagens';

const getPendingQueue = (): PendingContagem[] => {
  try {
    const data = localStorage.getItem(PENDING_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const savePendingQueue = (queue: PendingContagem[]) => {
  localStorage.setItem(PENDING_KEY, JSON.stringify(queue));
};

const addToPendingQueue = (item: PendingContagem) => {
  const queue = getPendingQueue();
  const idx = queue.findIndex(q => q.codigoItem === item.codigoItem);
  if (idx >= 0) {
    queue[idx] = item;
  } else {
    queue.push(item);
  }
  savePendingQueue(queue);
};

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
  quantidade: number | null;
}

interface Reposicao {
  _id: string;
  data_carregamento: string;
  status: 'em_andamento' | 'finalizado';
  carregado_por_nome: string;
  itens: ReposicaoItem[];
}

type SortField = 'codigo_item' | 'minimo' | 'dep_aberto' | 'producoes_aberto' | 'saldo_real' | 'reposicao' | 'giro_mensal' | 'quantidade';
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
  const [savingItem, setSavingItem] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingQueue().length);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) syncPendingQueue();
  }, [isOnline]);

  const syncPendingQueue = async () => {
    const queue = getPendingQueue();
    if (queue.length === 0) return;

    setIsSyncingOffline(true);
    const failed: PendingContagem[] = [];

    for (const item of queue) {
      try {
        await api.put(`/reposicao/${item.reposicaoId}/item/${item.codigoItem}`, {
          quantidade: item.quantidade
        });
      } catch {
        failed.push(item);
      }
    }

    savePendingQueue(failed);
    setPendingCount(failed.length);
    setIsSyncingOffline(false);

    if (failed.length === 0 && queue.length > 0) fetchLatest();
  };

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

  const saveQuantidade = useCallback(async (codigoItem: number, value: number | null) => {
    if (!data) return;
    setSavingItem(codigoItem);
    try {
      await api.put(`/reposicao/${data._id}/item/${codigoItem}`, { quantidade: value });
    } catch (error) {
      console.error('Erro ao salvar quantidade (offline):', error);
      addToPendingQueue({
        reposicaoId: data._id,
        codigoItem,
        quantidade: value,
        timestamp: Date.now()
      });
      setPendingCount(getPendingQueue().length);
    } finally {
      setSavingItem(null);
    }
  }, [data]);

  const handleQuantidadeChange = (codigoItem: number, rawValue: string) => {
    const value = rawValue === '' ? null : parseFloat(rawValue);
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, quantidade: value } : item
        )
      };
    });
    if (debounceTimers.current[codigoItem]) {
      clearTimeout(debounceTimers.current[codigoItem]);
    }
    debounceTimers.current[codigoItem] = setTimeout(() => {
      saveQuantidade(codigoItem, value);
    }, 800);
  };

  const finalizarReposicao = async () => {
    if (!data) return;
    const semQtd = data.itens.filter(i => i.quantidade === null || i.quantidade === undefined).length;
    const msg = semQtd > 0
      ? `Existem ${semQtd} itens sem quantidade preenchida. Deseja finalizar mesmo assim?`
      : 'Deseja finalizar a reposição?';
    if (!confirm(msg)) return;
    try {
      await api.put(`/reposicao/${data._id}/finalizar`);
      setData(prev => prev ? { ...prev, status: 'finalizado' } : prev);
      alert('Reposição finalizada com sucesso!');
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      alert('Erro ao finalizar reposição');
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: data ? `Reposicao_${formatDateShort(data.data_carregamento)}` : 'Reposicao',
  });

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
        const va = (a[sortField] as number) ?? -Infinity;
        const vb = (b[sortField] as number) ?? -Infinity;
        return sortDir === 'asc' ? va - vb : vb - va;
      });
    }

    return items;
  };

  const filteredItems = getFilteredItems();
  const tipos = data ? [...new Set(data.itens.map(i => i.tipo))].sort() : [];
  const precisamRepor = data ? data.itens.filter(i => i.reposicao > 0).length : 0;
  const preenchidos = data ? data.itens.filter(i => i.quantidade !== null && i.quantidade !== undefined).length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isOnline && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-center space-x-3">
          <WifiOff className="text-orange-600 flex-shrink-0" size={22} />
          <div>
            <p className="text-orange-800 font-medium text-sm">Sem conexão com a internet</p>
            <p className="text-orange-600 text-xs">As quantidades serão salvas localmente e enviadas quando a conexão for restaurada.</p>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className={`border rounded-lg p-3 flex items-center space-x-3 ${isSyncingOffline ? 'bg-blue-50 border-blue-300' : 'bg-yellow-50 border-yellow-300'}`}>
          {isSyncingOffline ? (
            <>
              <RefreshCw className="text-blue-600 animate-spin flex-shrink-0" size={22} />
              <p className="text-blue-800 font-medium text-sm">Sincronizando {pendingCount} quantidade(s) pendente(s)...</p>
            </>
          ) : (
            <>
              <AlertTriangle className="text-yellow-600 flex-shrink-0" size={22} />
              <div className="flex items-center space-x-3">
                <p className="text-yellow-800 font-medium text-sm">{pendingCount} quantidade(s) pendente(s)</p>
                <button onClick={syncPendingQueue} className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700">Sincronizar agora</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <PackageCheck className="text-blue-600" size={28} />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-800">Reposição</h1>
              {isOnline ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-orange-500" />}
            </div>
            {data && (
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <Clock size={14} />
                <span>Última atualização: {formatDate(data.data_carregamento)} • Por: {data.carregado_por_nome}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={syncERP}
            disabled={syncing || data?.status === 'finalizado'}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Carregando...' : 'Carregar ERP'}</span>
          </button>
          {data && (
            <button
              onClick={() => handlePrint()}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Printer size={18} />
              <span>Exportar PDF</span>
            </button>
          )}
          {data && data.status === 'em_andamento' && (
            <button
              onClick={finalizarReposicao}
              className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              <CheckCircle size={18} />
              <span>Finalizar</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Finalizado */}
      {data?.status === 'finalizado' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
          <CheckCircle className="text-green-600" size={24} />
          <span className="text-green-800 font-medium">Reposição finalizada. Os dados são somente leitura.</span>
        </div>
      )}

      {!data ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <PackageCheck size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhum dado carregado</h2>
          <p className="text-gray-500 mb-4">Clique em "Carregar ERP" para buscar os dados de reposição do sistema.</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-sm text-gray-500">Qtd Preenchida</p>
              <p className="text-2xl font-bold text-purple-600">{preenchidos}/{data.itens.length}</p>
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
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort('codigo_item')}>
                    Código <SortIcon field="codigo_item" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Tipo</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">UM</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort('minimo')}>
                    Mínimo <SortIcon field="minimo" />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort('dep_aberto')}>
                    Dep. Aberto <SortIcon field="dep_aberto" />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell" onClick={() => toggleSort('producoes_aberto')}>
                    Prod. Aberto <SortIcon field="producoes_aberto" />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort('saldo_real')}>
                    Saldo Real <SortIcon field="saldo_real" />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort('reposicao')}>
                    Reposição <SortIcon field="reposicao" />
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none hidden md:table-cell" onClick={() => toggleSort('giro_mensal')}>
                    Giro Mensal <SortIcon field="giro_mensal" />
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-36">
                    Quantidade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-500">Nenhum item encontrado</td>
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
                      <td className={`px-3 py-2 text-sm text-right font-bold ${item.reposicao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.reposicao > 0 ? '+' : ''}{formatNumber(item.reposicao)}
                      </td>
                      <td className="px-3 py-2 text-sm text-right hidden md:table-cell">{formatNumber(item.giro_mensal)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            step="any"
                            value={item.quantidade !== null && item.quantidade !== undefined ? item.quantidade : ''}
                            onChange={(e) => handleQuantidadeChange(item.codigo_item, e.target.value)}
                            disabled={data.status === 'finalizado'}
                            className={`w-24 px-2 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              data.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                            placeholder="-"
                          />
                          {savingItem === item.codigo_item && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                          )}
                          {item.quantidade !== null && item.quantidade !== undefined && savingItem !== item.codigo_item && (
                            <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 flex justify-between">
              <span>Exibindo {filteredItems.length} de {data.itens.length} itens</span>
              <span>{preenchidos} com quantidade</span>
            </div>
          </div>
        </>
      )}

      {/* ===== PRINT VIEW (oculto) ===== */}
      {data && (
        <div style={{ display: 'none' }}>
          <div ref={printRef} className="p-8 bg-white">
            {/* Cabeçalho do PDF */}
            <div className="border-b-4 border-blue-600 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <img src="/assets/valemilk-logo.png" alt="Vale Milk" className="h-16 w-auto" />
                  <p className="text-sm text-gray-600">Relatório de Reposição</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">Reposição de Estoque</div>
                  <div className="text-sm text-gray-600 mt-1">
                    Data: {formatDate(data.data_carregamento)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Responsável: {data.carregado_por_nome}
                  </div>
                  <div className="text-sm text-gray-600">
                    Status: {data.status === 'finalizado' ? 'Finalizado' : 'Em Andamento'}
                  </div>
                </div>
              </div>
            </div>

            {/* Info empresa no PDF */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Empresa</h3>
                <div className="bg-gray-50 p-4 rounded">
                  <p className="font-semibold text-gray-800">KM CACAU INDÚSTRIA E COMERCIO DE LATICINIOS LTDA</p>
                  <p className="text-sm text-gray-600 mt-1">CNPJ: 02.518.353/0001-03</p>
                  <p className="text-sm text-gray-600">AV. JUSCELINO KUBITSCHEK, S/N - OMBREIRA</p>
                  <p className="text-sm text-gray-600">PENTECOSTE - CEARÁ</p>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Resumo</h3>
                <div className="bg-gray-50 p-4 rounded text-sm">
                  <p>Total de Itens: <strong>{filteredItems.length}</strong></p>
                  <p>Precisam Repor: <strong className="text-red-600">{filteredItems.filter(i => i.reposicao > 0).length}</strong></p>
                  <p>Qtd Preenchida: <strong>{filteredItems.filter(i => i.quantidade !== null && i.quantidade !== undefined).length}</strong></p>
                  {reposicaoFilter !== 'todos' && (
                    <p>Filtro: <strong>{reposicaoFilter === 'precisa_repor' ? 'Precisa Repor' : 'Estoque OK'}</strong></p>
                  )}
                  {tipoFilter && <p>Tipo: <strong>{tipoFilter}</strong></p>}
                </div>
              </div>
            </div>

            {/* Tabela para impressão */}
            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border border-gray-300 px-2 py-2 text-left">CÓDIGO</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">DESCRIÇÃO</th>
                  <th className="border border-gray-300 px-2 py-2 text-center">UM</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">MÍNIMO</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">DEP. ABERTO</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">PROD. ABERTO</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">SALDO REAL</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">REPOSIÇÃO</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">GIRO MENSAL</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">QUANTIDADE</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.codigo_item} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-1">{String(item.codigo_item).padStart(6, '0')}</td>
                    <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{item.unidade_medida}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.minimo)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.dep_aberto)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.producoes_aberto)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{formatNumber(item.saldo_real)}</td>
                    <td className={`border border-gray-300 px-2 py-1 text-right font-semibold ${
                      item.reposicao > 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {item.reposicao > 0 ? '+' : ''}{formatNumber(item.reposicao)}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.giro_mensal)}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right font-bold">
                      {item.quantidade !== null && item.quantidade !== undefined ? formatNumber(item.quantidade) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Rodapé do PDF */}
            <div className="mt-6 text-center text-xs text-gray-500">
              <p className="mt-1">Para mais informações, entre em contato: compras@valemilk.com.br</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

export default ReposicaoPage;
