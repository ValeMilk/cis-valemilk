import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, Trash2, WifiOff, Wifi, Printer, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';

interface PendingContagem {
  avariaId: string;
  codigoItem: string;
  contagem_fisica: number | null;
  timestamp: number;
}

const PENDING_KEY = 'avaria_pending_contagens';

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

interface AvariaItem {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  deposito_5: number;
  contagem: number | null;
  contagem_data?: string;
  contagem_usuario?: string;
  observacao?: string;
}

interface AvariaData {
  _id: string;
  data_snapshot: string;
  status: 'em_andamento' | 'finalizado';
  criado_por_nome: string;
  itens: AvariaItem[];
}

const AvariaPage = () => {
  const [avaria, setAvaria] = useState<AvariaData | null>(null);
  const [filteredItems, setFilteredItems] = useState<AvariaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [contagemFilter, setContagemFilter] = useState<'todos' | 'pendentes' | 'contados'>('todos');
  const [abcFilter, setAbcFilter] = useState<'' | 'A' | 'B' | 'C'>('');
  const [abcMap, setAbcMap] = useState<Record<string, 'A' | 'B' | 'C'>>({});
  const [sortColumn, setSortColumn] = useState<'codigo' | 'descricao' | 'abc' | 'saldo' | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingQueue().length);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debounceObsTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: avaria ? `Avaria_${new Date(avaria.data_snapshot).toLocaleDateString('pt-BR').replace(/\//g, '-')}` : 'Avaria',
  });

  const getActiveFiltersLabel = () => {
    const filtros: string[] = ['Depósito 5 (Avaria)'];
    if (searchTerm) filtros.push(`Busca: "${searchTerm}"`);
    if (abcFilter) filtros.push(`Curva: ${abcFilter}`);
    if (contagemFilter !== 'todos') filtros.push(`Status: ${contagemFilter === 'pendentes' ? 'Pendentes' : 'Contados'}`);
    return filtros.join(' | ');
  };

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
        await api.put(`/avaria/${item.avariaId}/item/${item.codigoItem}`, {
          contagem_fisica: item.contagem_fisica
        });
      } catch {
        failed.push(item);
      }
    }

    savePendingQueue(failed);
    setPendingCount(failed.length);
    setIsSyncingOffline(false);

    if (failed.length === 0 && queue.length > 0) fetchAvaria();
  };

  useEffect(() => { fetchAvaria(); }, []);

  useEffect(() => {
    if (!avaria) { setFilteredItems([]); return; }
    filterItems();
  }, [avaria, searchTerm, contagemFilter, abcFilter, sortColumn, sortDirection]);

  const fetchAvaria = async () => {
    try {
      setLoading(true);
      const response = await api.get('/avaria/active');
      setAvaria(response.data);
    } catch (error) {
      console.error('Erro ao buscar avaria:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncERP = async () => {
    try {
      setSyncing(true);
      const response = await api.post('/avaria/sync-erp');
      setAvaria(response.data);
    } catch (error) {
      console.error('Erro ao sincronizar ERP:', error);
      alert('Erro ao carregar dados do ERP');
    } finally {
      setSyncing(false);
    }
  };

  const calcularABC = (itens: AvariaItem[]): Record<string, 'A' | 'B' | 'C'> => {
    const comSaldo = itens.map(item => ({ codigo: item.codigo_item, saldo: Math.abs(item.deposito_5) }));
    comSaldo.sort((a, b) => b.saldo - a.saldo);
    const total = comSaldo.reduce((sum, i) => sum + i.saldo, 0);
    if (total === 0) return {};
    let acumulado = 0;
    const mapa: Record<string, 'A' | 'B' | 'C'> = {};
    for (const item of comSaldo) {
      acumulado += item.saldo;
      const pct = (acumulado / total) * 100;
      if (pct <= 80) mapa[item.codigo] = 'A';
      else if (pct <= 95) mapa[item.codigo] = 'B';
      else mapa[item.codigo] = 'C';
    }
    return mapa;
  };

  const filterItems = () => {
    if (!avaria) return;
    let filtered = [...avaria.itens];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.descricao.toLowerCase().includes(lower) ||
        item.codigo_item.toLowerCase().includes(lower)
      );
    }

    // Filtrar itens com saldo != 0
    filtered = filtered.filter(item => item.deposito_5 !== 0);

    const novoAbcMap = calcularABC(filtered);
    setAbcMap(novoAbcMap);

    if (abcFilter) {
      filtered = filtered.filter(item => novoAbcMap[item.codigo_item] === abcFilter);
    }

    if (contagemFilter === 'pendentes') {
      filtered = filtered.filter(item => item.contagem === null || item.contagem === undefined);
    } else if (contagemFilter === 'contados') {
      filtered = filtered.filter(item => item.contagem !== null && item.contagem !== undefined);
    }

    if (sortColumn) {
      const dir = sortDirection === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        if (sortColumn === 'codigo') return a.codigo_item.localeCompare(b.codigo_item) * dir;
        if (sortColumn === 'descricao') return a.descricao.localeCompare(b.descricao) * dir;
        if (sortColumn === 'abc') {
          const order = { A: 1, B: 2, C: 3 };
          return ((order[novoAbcMap[a.codigo_item]] || 4) - (order[novoAbcMap[b.codigo_item]] || 4)) * dir;
        }
        if (sortColumn === 'saldo') return (a.deposito_5 - b.deposito_5) * dir;
        return 0;
      });
    }

    setFilteredItems(filtered);
  };

  const saveContagem = useCallback(async (codigoItem: string, value: number | null) => {
    if (!avaria) return;
    setSavingItem(codigoItem);
    try {
      await api.put(`/avaria/${avaria._id}/item/${codigoItem}`, {
        contagem_fisica: value
      });
      setAvaria(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map(item =>
            item.codigo_item === codigoItem
              ? { ...item, contagem: value, contagem_data: new Date().toISOString() }
              : item
          )
        };
      });
    } catch (error) {
      console.error('Erro ao salvar contagem (offline):', error);
      addToPendingQueue({
        avariaId: avaria._id,
        codigoItem,
        contagem_fisica: value,
        timestamp: Date.now()
      });
      setPendingCount(getPendingQueue().length);
    } finally {
      setSavingItem(null);
    }
  }, [avaria]);

  const handleContagemChange = (codigoItem: string, rawValue: string) => {
    const value = rawValue === '' ? null : parseFloat(rawValue);
    setAvaria(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, contagem: value } : item
        )
      };
    });
    if (debounceTimers.current[codigoItem]) clearTimeout(debounceTimers.current[codigoItem]);
    debounceTimers.current[codigoItem] = setTimeout(() => saveContagem(codigoItem, value), 800);
  };

  const handleObservacaoChange = (codigoItem: string, value: string) => {
    setAvaria(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, observacao: value } : item
        )
      };
    });
    if (debounceObsTimers.current[codigoItem]) clearTimeout(debounceObsTimers.current[codigoItem]);
    debounceObsTimers.current[codigoItem] = setTimeout(async () => {
      if (!avaria) return;
      try {
        await api.put(`/avaria/${avaria._id}/item/${codigoItem}/observacao`, { observacao: value });
      } catch (error) {
        console.error('Erro ao salvar observação:', error);
      }
    }, 800);
  };

  const finalizarAvaria = async () => {
    if (!avaria) return;
    const pendentesCount = avaria.itens.filter(i => i.contagem === null || i.contagem === undefined).length;
    const msg = pendentesCount > 0
      ? `Ainda existem ${pendentesCount} itens sem contagem. Deseja finalizar mesmo assim?`
      : 'Deseja finalizar a avaria?';
    if (!confirm(msg)) return;
    try {
      await api.put(`/avaria/${avaria._id}/finalizar`);
      setAvaria(prev => prev ? { ...prev, status: 'finalizado' } : prev);
      alert('Avaria finalizada com sucesso!');
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      alert('Erro ao finalizar avaria');
    }
  };

  const descartarAvaria = async () => {
    if (!avaria) return;
    if (!confirm('Tem certeza que deseja descartar esta avaria? Todas as contagens serão perdidas.')) return;
    try {
      await api.delete(`/avaria/${avaria._id}`);
      setAvaria(null);
    } catch (error) {
      console.error('Erro ao descartar:', error);
      alert('Erro ao descartar avaria');
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSort = (column: 'codigo' | 'descricao' | 'abc' | 'saldo') => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else { setSortColumn(''); setSortDirection('asc'); }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown size={12} className="text-gray-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={12} className="text-blue-600" />
      : <ArrowDown size={12} className="text-blue-600" />;
  };

  const formatDate = (dateStr: string): string => new Date(dateStr).toLocaleString('pt-BR');

  const totalItens = avaria?.itens.length || 0;
  const contados = avaria?.itens.filter(i => i.contagem !== null && i.contagem !== undefined).length || 0;
  const pendentesCount = totalItens - contados;
  const progresso = totalItens > 0 ? Math.round((contados / totalItens) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
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
            <p className="text-orange-600 text-xs">As contagens serão salvas localmente e enviadas quando a conexão for restaurada.</p>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className={`border rounded-lg p-3 flex items-center space-x-3 ${isSyncingOffline ? 'bg-blue-50 border-blue-300' : 'bg-yellow-50 border-yellow-300'}`}>
          {isSyncingOffline ? (
            <>
              <RefreshCw className="text-blue-600 animate-spin flex-shrink-0" size={22} />
              <p className="text-blue-800 font-medium text-sm">Sincronizando {pendingCount} contagem(ns) pendente(s)...</p>
            </>
          ) : (
            <>
              <AlertTriangle className="text-yellow-600 flex-shrink-0" size={22} />
              <div className="flex items-center space-x-3">
                <p className="text-yellow-800 font-medium text-sm">{pendingCount} contagem(ns) pendente(s)</p>
                <button onClick={syncPendingQueue} className="text-xs bg-yellow-600 text-white px-3 py-1 rounded hover:bg-yellow-700">Sincronizar agora</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="text-red-600" size={28} />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-800">Avaria</h1>
              {isOnline ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-orange-500" />}
            </div>
            {avaria && (
              <p className="text-sm text-gray-500">
                Snapshot: {formatDate(avaria.data_snapshot)} • Por: {avaria.criado_por_nome}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={syncERP} disabled={syncing || avaria?.status === 'finalizado'}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Carregando...' : avaria ? 'Atualizar ERP' : 'Carregar ERP'}</span>
          </button>
          {avaria && avaria.status === 'em_andamento' && (
            <>
              <button onClick={finalizarAvaria} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle size={18} /><span>Finalizar</span>
              </button>
              <button onClick={descartarAvaria} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                <Trash2 size={18} /><span>Descartar</span>
              </button>
            </>
          )}
          {avaria && (
            <button onClick={() => handlePrint()} className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <Printer size={18} /><span>Exportar PDF</span>
            </button>
          )}
        </div>
      </div>

      {!avaria && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhuma avaria em andamento</h2>
          <p className="text-gray-500 mb-4">Clique em "Carregar ERP" para iniciar uma nova avaria com os dados atuais do sistema.</p>
        </div>
      )}

      {avaria && (
        <>
          {/* Progresso */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-red-600 mb-1">
                <Package size={18} /><span className="text-sm font-medium">Total Itens</span>
              </div>
              <p className="text-2xl font-bold">{totalItens}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-green-600 mb-1">
                <CheckCircle size={18} /><span className="text-sm font-medium">Contados</span>
              </div>
              <p className="text-2xl font-bold">{contados}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-orange-600 mb-1">
                <Clock size={18} /><span className="text-sm font-medium">Pendentes</span>
              </div>
              <p className="text-2xl font-bold">{pendentesCount}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-purple-600 mb-1">
                <AlertTriangle size={18} /><span className="text-sm font-medium">Progresso</span>
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold">{progresso}%</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-red-600 h-2 rounded-full transition-all" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          </div>

          {avaria.status === 'finalizado' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <CheckCircle className="text-green-600" size={24} />
              <span className="text-green-800 font-medium">Avaria finalizada. Os dados são somente leitura.</span>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar código ou descrição..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
              </div>
              <select value={contagemFilter} onChange={(e) => setContagemFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500">
                <option value="todos">Todos</option>
                <option value="pendentes">Pendentes</option>
                <option value="contados">Contados</option>
              </select>
              <select value={abcFilter} onChange={(e) => setAbcFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500">
                <option value="">Curva ABC</option>
                <option value="A">A (80%)</option>
                <option value="B">B (15%)</option>
                <option value="C">C (5%)</option>
              </select>
            </div>
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100" onClick={() => handleSort('codigo')}>
                    <div className="flex items-center gap-1">Código {renderSortIcon('codigo')}</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100" onClick={() => handleSort('descricao')}>
                    <div className="flex items-center gap-1">Descrição {renderSortIcon('descricao')}</div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell cursor-pointer select-none hover:bg-gray-100" onClick={() => handleSort('abc')}>
                    <div className="flex items-center justify-center gap-1">ABC {renderSortIcon('abc')}</div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">UM</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100" onClick={() => handleSort('saldo')}>
                    <div className="flex items-center justify-end gap-1">Depósito 5 {renderSortIcon('saldo')}</div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Contagem</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obs.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Nenhum item encontrado</td></tr>
                ) : (
                  filteredItems.map((item) => {
                    const diferenca = item.contagem !== null && item.contagem !== undefined
                      ? item.contagem - item.deposito_5
                      : null;
                    return (
                      <tr key={item.codigo_item} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">{item.codigo_item}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center hidden sm:table-cell">
                          {abcMap[item.codigo_item] && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              abcMap[item.codigo_item] === 'A' ? 'bg-red-100 text-red-700' :
                              abcMap[item.codigo_item] === 'B' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>{abcMap[item.codigo_item]}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">{item.unidade_medida}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatNumber(item.deposito_5)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            <input type="number" step="any"
                              value={item.contagem !== null && item.contagem !== undefined ? item.contagem : ''}
                              onChange={(e) => handleContagemChange(item.codigo_item, e.target.value)}
                              disabled={avaria.status === 'finalizado'}
                              className={`w-24 px-2 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                                avaria.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
                              } ${diferenca !== null && diferenca !== 0 ? 'border-orange-400 bg-orange-50' : ''}`}
                              placeholder="-" />
                            {savingItem === item.codigo_item && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600" />
                            )}
                            {item.contagem !== null && item.contagem !== undefined && savingItem !== item.codigo_item && (
                              <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-semibold">
                          {diferenca !== null ? (
                            <span className={diferenca > 0 ? 'text-green-600' : diferenca < 0 ? 'text-red-600' : 'text-gray-500'}>
                              {diferenca > 0 ? '+' : ''}{formatNumber(diferenca)}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" value={item.observacao || ''}
                            onChange={(e) => handleObservacaoChange(item.codigo_item, e.target.value)}
                            disabled={avaria.status === 'finalizado'}
                            className={`w-24 px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 ${
                              avaria.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`} placeholder="Obs..." />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 flex justify-between">
              <span>Exibindo {filteredItems.length} de {totalItens} itens</span>
              <span>{contados} contados</span>
            </div>
          </div>
        </>
      )}

      {/* PRINT VIEW */}
      {avaria && (
        <div style={{ display: 'none' }}>
          <div ref={printRef} className="p-8 bg-white">
            <div className="border-b-4 border-red-600 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <img src="/assets/valemilk-logo.png" alt="Vale Milk" className="h-16 w-auto" />
                  <p className="text-sm text-gray-600">Relatório de Avaria</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">Avaria - Depósito 5</div>
                  <div className="text-sm text-gray-600 mt-1">Data: {formatDate(avaria.data_snapshot)}</div>
                  <div className="text-sm text-gray-600">Responsável: {avaria.criado_por_nome}</div>
                  <div className="text-sm text-gray-600">Status: {avaria.status === 'em_andamento' ? 'Em Andamento' : 'Finalizado'}</div>
                </div>
              </div>
            </div>

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
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Depósito</h3>
                <div className="bg-red-50 p-4 rounded border-l-4 border-red-600">
                  <p className="font-semibold text-red-900">Depósito 5 (Avaria)</p>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 mt-4">Resumo</h3>
                <div className="bg-gray-50 p-4 rounded text-sm">
                  <p>Total de Itens: <strong>{filteredItems.length}</strong></p>
                  <p>Contados: <strong>{filteredItems.filter(i => i.contagem !== null && i.contagem !== undefined).length}</strong></p>
                  <p>Pendentes: <strong>{filteredItems.filter(i => i.contagem === null || i.contagem === undefined).length}</strong></p>
                  <p className="mt-1">Filtros: <strong>{getActiveFiltersLabel()}</strong></p>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="border border-gray-300 px-2 py-2 text-left">CÓDIGO</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">DESCRIÇÃO</th>
                  <th className="border border-gray-300 px-2 py-2 text-center">ABC</th>
                  <th className="border border-gray-300 px-2 py-2 text-center">UM</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">DEPÓSITO 5</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">CONTAGEM</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">DIFERENÇA</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">OBSERVAÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const diferenca = item.contagem !== null && item.contagem !== undefined ? item.contagem - item.deposito_5 : null;
                  return (
                    <tr key={item.codigo_item} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-1">{item.codigo_item}</td>
                      <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center font-bold">{abcMap[item.codigo_item] || '-'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{item.unidade_medida}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.deposito_5)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-semibold">
                        {item.contagem !== null && item.contagem !== undefined ? formatNumber(item.contagem) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-2 py-1 text-right font-semibold ${
                        diferenca !== null && diferenca > 0 ? 'text-green-600' :
                        diferenca !== null && diferenca < 0 ? 'text-red-600' : ''
                      }`}>
                        {diferenca !== null ? `${diferenca > 0 ? '+' : ''}${formatNumber(diferenca)}` : '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1">{item.observacao || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-6 text-center text-xs text-gray-500">
              <p className="mt-1">Para mais informações, entre em contato: compras@valemilk.com.br</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvariaPage;
