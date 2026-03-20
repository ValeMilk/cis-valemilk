import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, Trash2, WifiOff, Wifi, Printer, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';

interface PendingContagem {
  inventarioId: string;
  codigoItem: string;
  quantidade_real?: number | null;
  avariado?: number | null;
  volumes_fechados_real?: number | null;
  unitarios_avulsos_real?: number | null;
  volumes_fechados_avariado?: number | null;
  unitarios_avulsos_avariado?: number | null;
  timestamp: number;
}

const PENDING_KEY = 'inventario_filial_pending_contagens';

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

interface InventarioFilialItem {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  tipo_volume: string;
  unidades_por_volume: number;
  deposito_2: number;
  quantidade_real: number | null;
  avariado: number | null;
  volumes_fechados_real: number | null;
  unitarios_avulsos_real: number | null;
  volumes_fechados_avariado: number | null;
  unitarios_avulsos_avariado: number | null;
  quantidade_real_data?: string;
  quantidade_real_usuario?: string;
  avariado_data?: string;
  avariado_usuario?: string;
  observacao?: string;
}

interface InventarioFilial {
  _id: string;
  data_snapshot: string;
  data_finalizacao?: string;
  status: 'em_andamento' | 'finalizado';
  criado_por_nome: string;
  itens: InventarioFilialItem[];
}

const InventarioFilialPage = () => {
  const [inventario, setInventario] = useState<InventarioFilial | null>(null);
  const [filteredItems, setFilteredItems] = useState<InventarioFilialItem[]>([]);
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
    documentTitle: inventario ? `Inventario_Filial_${new Date(inventario.data_snapshot).toLocaleDateString('pt-BR').replace(/\//g, '-')}` : 'Inventario_Filial',
  });

  const getActiveFiltersLabel = () => {
    const filtros: string[] = ['Depósito 2'];
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
        await api.put(`/inventario-filial/${item.inventarioId}/item/${item.codigoItem}`, {
          quantidade_real: item.quantidade_real,
          avariado: item.avariado,
          volumes_fechados_real: item.volumes_fechados_real,
          unitarios_avulsos_real: item.unitarios_avulsos_real,
          volumes_fechados_avariado: item.volumes_fechados_avariado,
          unitarios_avulsos_avariado: item.unitarios_avulsos_avariado
        });
      } catch {
        failed.push(item);
      }
    }

    savePendingQueue(failed);
    setPendingCount(failed.length);
    setIsSyncingOffline(false);

    if (failed.length === 0 && queue.length > 0) fetchInventario();
  };

  useEffect(() => { fetchInventario(); }, []);

  useEffect(() => {
    if (!inventario) { setFilteredItems([]); return; }
    filterItems();
  }, [inventario, searchTerm, contagemFilter, abcFilter, sortColumn, sortDirection]);

  const fetchInventario = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventario-filial/active');
      setInventario(response.data);
    } catch (error) {
      console.error('Erro ao buscar inventário filial:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncERP = async () => {
    try {
      setSyncing(true);
      const response = await api.post('/inventario-filial/sync-erp');
      setInventario(response.data);
    } catch (error) {
      console.error('Erro ao sincronizar ERP:', error);
      alert('Erro ao carregar dados do ERP');
    } finally {
      setSyncing(false);
    }
  };

  const calcularABC = (itens: InventarioFilialItem[]): Record<string, 'A' | 'B' | 'C'> => {
    const comSaldo = itens.map(item => ({ codigo: item.codigo_item, saldo: Math.abs(item.deposito_2) }));
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

  const usaVolume = (item: InventarioFilialItem): boolean => {
    return item.tipo === 'Produto Acabado' &&
      item.unidade_medida?.trim().toUpperCase() !== 'KG' &&
      !!item.tipo_volume?.trim() &&
      item.unidades_por_volume > 0;
  };

  const filterItems = () => {
    if (!inventario) return;
    let filtered = [...inventario.itens];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.descricao.toLowerCase().includes(lower) ||
        item.codigo_item.toLowerCase().includes(lower)
      );
    }

    // Filtrar itens com saldo != 0
    filtered = filtered.filter(item => item.deposito_2 !== 0);

    const novoAbcMap = calcularABC(filtered);
    setAbcMap(novoAbcMap);

    if (abcFilter) {
      filtered = filtered.filter(item => novoAbcMap[item.codigo_item] === abcFilter);
    }

    if (contagemFilter === 'pendentes') {
      filtered = filtered.filter(item => item.quantidade_real === null && item.avariado === null);
    } else if (contagemFilter === 'contados') {
      filtered = filtered.filter(item => item.quantidade_real !== null || item.avariado !== null);
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
        if (sortColumn === 'saldo') return (a.deposito_2 - b.deposito_2) * dir;
        return 0;
      });
    }

    setFilteredItems(filtered);
  };

  const saveContagem = useCallback(async (codigoItem: string, field: 'quantidade_real' | 'avariado', value: number | null, vf?: number | null, ua?: number | null) => {
    if (!inventario) return;
    setSavingItem(codigoItem);
    try {
      const payload: any = { [field]: value };
      if (field === 'quantidade_real') {
        if (vf !== undefined) payload.volumes_fechados_real = vf;
        if (ua !== undefined) payload.unitarios_avulsos_real = ua;
      } else {
        if (vf !== undefined) payload.volumes_fechados_avariado = vf;
        if (ua !== undefined) payload.unitarios_avulsos_avariado = ua;
      }
      await api.put(`/inventario-filial/${inventario._id}/item/${codigoItem}`, payload);
    } catch (error) {
      console.error('Erro ao salvar contagem (offline):', error);
      const existing = getPendingQueue().find(q => q.codigoItem === codigoItem);
      addToPendingQueue({
        inventarioId: inventario._id,
        codigoItem,
        quantidade_real: field === 'quantidade_real' ? value : (existing?.quantidade_real ?? null),
        avariado: field === 'avariado' ? value : (existing?.avariado ?? null),
        volumes_fechados_real: field === 'quantidade_real' ? (vf ?? null) : (existing?.volumes_fechados_real ?? null),
        unitarios_avulsos_real: field === 'quantidade_real' ? (ua ?? null) : (existing?.unitarios_avulsos_real ?? null),
        volumes_fechados_avariado: field === 'avariado' ? (vf ?? null) : (existing?.volumes_fechados_avariado ?? null),
        unitarios_avulsos_avariado: field === 'avariado' ? (ua ?? null) : (existing?.unitarios_avulsos_avariado ?? null),
        timestamp: Date.now()
      });
      setPendingCount(getPendingQueue().length);
    } finally {
      setSavingItem(null);
    }
  }, [inventario]);

  const handleQuantidadeRealChange = (codigoItem: string, rawValue: string) => {
    const value = rawValue === '' ? null : parseFloat(rawValue);
    setInventario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, quantidade_real: value } : item
        )
      };
    });
    if (debounceTimers.current[codigoItem + '_qr']) clearTimeout(debounceTimers.current[codigoItem + '_qr']);
    debounceTimers.current[codigoItem + '_qr'] = setTimeout(() => saveContagem(codigoItem, 'quantidade_real', value), 800);
  };

  const handleVolumeRealChange = (codigoItem: string, rawVolumes: string, rawAvulsos: string, unidadesPorVolume: number) => {
    const volumes = rawVolumes === '' ? null : parseInt(rawVolumes);
    const avulsos = rawAvulsos === '' ? null : parseInt(rawAvulsos);
    const total = (volumes !== null ? volumes * unidadesPorVolume : 0) + (avulsos ?? 0);
    const value = (volumes !== null || avulsos !== null) ? total : null;
    setInventario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, quantidade_real: value, volumes_fechados_real: volumes, unitarios_avulsos_real: avulsos } : item
        )
      };
    });
    if (debounceTimers.current[codigoItem + '_qr']) clearTimeout(debounceTimers.current[codigoItem + '_qr']);
    debounceTimers.current[codigoItem + '_qr'] = setTimeout(() => saveContagem(codigoItem, 'quantidade_real', value, volumes, avulsos), 800);
  };

  const handleAvariadoChange = (codigoItem: string, rawValue: string) => {
    const value = rawValue === '' ? null : parseFloat(rawValue);
    setInventario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, avariado: value } : item
        )
      };
    });
    if (debounceTimers.current[codigoItem + '_av']) clearTimeout(debounceTimers.current[codigoItem + '_av']);
    debounceTimers.current[codigoItem + '_av'] = setTimeout(() => saveContagem(codigoItem, 'avariado', value), 800);
  };

  const handleVolumeAvariadoChange = (codigoItem: string, rawVolumes: string, rawAvulsos: string, unidadesPorVolume: number) => {
    const volumes = rawVolumes === '' ? null : parseInt(rawVolumes);
    const avulsos = rawAvulsos === '' ? null : parseInt(rawAvulsos);
    const total = (volumes !== null ? volumes * unidadesPorVolume : 0) + (avulsos ?? 0);
    const value = (volumes !== null || avulsos !== null) ? total : null;
    setInventario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem ? { ...item, avariado: value, volumes_fechados_avariado: volumes, unitarios_avulsos_avariado: avulsos } : item
        )
      };
    });
    if (debounceTimers.current[codigoItem + '_av']) clearTimeout(debounceTimers.current[codigoItem + '_av']);
    debounceTimers.current[codigoItem + '_av'] = setTimeout(() => saveContagem(codigoItem, 'avariado', value, volumes, avulsos), 800);
  };

  const handleObservacaoChange = (codigoItem: string, value: string) => {
    setInventario(prev => {
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
      if (!inventario) return;
      try {
        await api.put(`/inventario-filial/${inventario._id}/item/${codigoItem}/observacao`, { observacao: value });
      } catch (error) {
        console.error('Erro ao salvar observação:', error);
      }
    }, 800);
  };

  const finalizarInventario = async () => {
    if (!inventario) return;
    const pendentesCountFinal = inventario.itens.filter(i => i.quantidade_real === null && i.avariado === null).length;
    const msg = pendentesCountFinal > 0
      ? `Ainda existem ${pendentesCountFinal} itens sem contagem. Deseja finalizar mesmo assim?`
      : 'Deseja finalizar o inventário?';
    if (!confirm(msg)) return;
    try {
      await api.put(`/inventario-filial/${inventario._id}/finalizar`);
      setInventario(prev => prev ? { ...prev, status: 'finalizado' } : prev);
      alert('Inventário Filial finalizado com sucesso!');
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      alert('Erro ao finalizar inventário');
    }
  };

  const descartarInventario = async () => {
    if (!inventario) return;
    if (!confirm('Tem certeza que deseja descartar este inventário? Todas as contagens serão perdidas.')) return;
    try {
      await api.delete(`/inventario-filial/${inventario._id}`);
      setInventario(null);
    } catch (error) {
      console.error('Erro ao descartar:', error);
      alert('Erro ao descartar inventário');
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

  const totalItens = inventario?.itens.length || 0;
  const contados = inventario?.itens.filter(i => i.quantidade_real !== null || i.avariado !== null).length || 0;
  const pendentesCount = totalItens - contados;
  const progresso = totalItens > 0 ? Math.round((contados / totalItens) * 100) : 0;

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
          <Package className="text-blue-600" size={28} />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-800">Inventário Filial</h1>
              {isOnline ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-orange-500" />}
            </div>
            {inventario && (
              <p className="text-sm text-gray-500">
                Atualização ERP: {formatDate(inventario.data_snapshot)} • Por: {inventario.criado_por_nome}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={syncERP} disabled={syncing || inventario?.status === 'finalizado'}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Carregando...' : inventario ? 'Atualizar ERP' : 'Carregar ERP'}</span>
          </button>
          {inventario && inventario.status === 'em_andamento' && (
            <>
              <button onClick={finalizarInventario} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle size={18} /><span>Finalizar</span>
              </button>
              <button onClick={descartarInventario} className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Trash2 size={18} /><span>Descartar</span>
              </button>
            </>
          )}
          {inventario && (
            <button onClick={() => handlePrint()} className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <Printer size={18} /><span>Exportar PDF</span>
            </button>
          )}
        </div>
      </div>

      {!inventario && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhum inventário filial em andamento</h2>
          <p className="text-gray-500 mb-4">Clique em "Carregar ERP" para iniciar um novo inventário com os dados atuais do sistema.</p>
        </div>
      )}

      {inventario && (
        <>
          {/* Progresso */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-blue-600 mb-1">
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
                <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          </div>

          {inventario.status === 'finalizado' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <CheckCircle className="text-green-600" size={24} />
              <span className="text-green-800 font-medium">Inventário finalizado. Os dados são somente leitura.</span>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input type="text" placeholder="Buscar código ou descrição..."
                  value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <select value={contagemFilter} onChange={(e) => setContagemFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="todos">Todos</option>
                <option value="pendentes">Pendentes</option>
                <option value="contados">Contados</option>
              </select>
              <select value={abcFilter} onChange={(e) => setAbcFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500">
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
                    <div className="flex items-center justify-end gap-1">Depósito 2 {renderSortIcon('saldo')}</div>
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Qtd. Real</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Avariado</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contagem Real</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Diferença</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obs.</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Nenhum item encontrado</td></tr>
                ) : (
                  filteredItems.map((item) => {
                    const qtdReal = item.quantidade_real ?? 0;
                    const avariado = item.avariado ?? 0;
                    const temContagem = item.quantidade_real !== null || item.avariado !== null;
                    const contagemReal = temContagem ? qtdReal + avariado : null;
                    const diferenca = contagemReal !== null ? Math.round((item.deposito_2 - contagemReal) * 100) / 100 : null;
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
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatNumber(item.deposito_2)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {usaVolume(item) ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <input type="number" step="1" min="0"
                                  value={item.volumes_fechados_real !== null && item.volumes_fechados_real !== undefined ? item.volumes_fechados_real : ''}
                                  onChange={(e) => handleVolumeRealChange(item.codigo_item, e.target.value, String(item.unitarios_avulsos_real ?? ''), item.unidades_por_volume)}
                                  disabled={inventario.status === 'finalizado'}
                                  className={`w-14 px-1 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-blue-500 ${inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                  placeholder="Vol" title={`${item.tipo_volume}s (×${item.unidades_por_volume})`} />
                                <span className="text-xs text-gray-500">{item.tipo_volume?.charAt(0) || 'V'}</span>
                                <input type="number" step="1" min="0"
                                  value={item.unitarios_avulsos_real !== null && item.unitarios_avulsos_real !== undefined ? item.unitarios_avulsos_real : ''}
                                  onChange={(e) => handleVolumeRealChange(item.codigo_item, String(item.volumes_fechados_real ?? ''), e.target.value, item.unidades_por_volume)}
                                  disabled={inventario.status === 'finalizado'}
                                  className={`w-14 px-1 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-blue-500 ${inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                  placeholder="Avul" title="Unidades avulsas" />
                                <span className="text-xs text-gray-500">un</span>
                              </div>
                              {item.quantidade_real !== null && <span className="text-xs text-blue-600 font-medium">= {formatNumber(item.quantidade_real)} un</span>}
                            </div>
                          ) : (
                          <div className="flex items-center space-x-1">
                            <input type="number" step="any"
                              value={item.quantidade_real !== null && item.quantidade_real !== undefined ? item.quantidade_real : ''}
                              onChange={(e) => handleQuantidadeRealChange(item.codigo_item, e.target.value)}
                              disabled={inventario.status === 'finalizado'}
                              className={`w-24 px-2 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
                              }`}
                              placeholder="-" />
                          </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {usaVolume(item) ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <input type="number" step="1" min="0"
                                  value={item.volumes_fechados_avariado !== null && item.volumes_fechados_avariado !== undefined ? item.volumes_fechados_avariado : ''}
                                  onChange={(e) => handleVolumeAvariadoChange(item.codigo_item, e.target.value, String(item.unitarios_avulsos_avariado ?? ''), item.unidades_por_volume)}
                                  disabled={inventario.status === 'finalizado'}
                                  className={`w-14 px-1 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-orange-500 ${inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                  placeholder="Vol" title={`${item.tipo_volume}s (×${item.unidades_por_volume})`} />
                                <span className="text-xs text-gray-500">{item.tipo_volume?.charAt(0) || 'V'}</span>
                                <input type="number" step="1" min="0"
                                  value={item.unitarios_avulsos_avariado !== null && item.unitarios_avulsos_avariado !== undefined ? item.unitarios_avulsos_avariado : ''}
                                  onChange={(e) => handleVolumeAvariadoChange(item.codigo_item, String(item.volumes_fechados_avariado ?? ''), e.target.value, item.unidades_por_volume)}
                                  disabled={inventario.status === 'finalizado'}
                                  className={`w-14 px-1 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-orange-500 ${inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                  placeholder="Avul" title="Unidades avulsas" />
                                <span className="text-xs text-gray-500">un</span>
                              </div>
                              {item.avariado !== null && <span className="text-xs text-orange-600 font-medium">= {formatNumber(item.avariado)} un</span>}
                            </div>
                          ) : (
                          <div className="flex items-center space-x-1">
                            <input type="number" step="any"
                              value={item.avariado !== null && item.avariado !== undefined ? item.avariado : ''}
                              onChange={(e) => handleAvariadoChange(item.codigo_item, e.target.value)}
                              disabled={inventario.status === 'finalizado'}
                              className={`w-24 px-2 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
                                inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
                              }`}
                              placeholder="-" />
                          </div>
                          )}
                            {savingItem === item.codigo_item && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                            )}
                            {temContagem && savingItem !== item.codigo_item && (
                              <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-semibold text-blue-700">
                          {contagemReal !== null ? formatNumber(contagemReal) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-semibold">
                          {diferenca !== null ? (
                            diferenca === 0 ? (
                              <span className="text-green-600 font-bold">Ok</span>
                            ) : (
                              <span className={diferenca > 0 ? 'text-green-600' : 'text-red-600'}>
                                {diferenca > 0 ? '+' : ''}{formatNumber(diferenca)}
                              </span>
                            )
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <input type="text" value={item.observacao || ''}
                            onChange={(e) => handleObservacaoChange(item.codigo_item, e.target.value)}
                            disabled={inventario.status === 'finalizado'}
                            className={`w-24 px-1 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
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
      {inventario && (
        <div style={{ display: 'none' }}>
          <div ref={printRef} className="p-8 bg-white">
            <div className="border-b-4 border-blue-600 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <img src="/assets/valemilk-logo.png" alt="Vale Milk" className="h-16 w-auto" />
                  <p className="text-sm text-gray-600">Relatório de Inventário Filial</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">Inventário Filial - Depósito 2</div>
                  <div className="text-sm text-gray-600 mt-1">Atualização ERP: {formatDate(inventario.data_snapshot)}</div>
                  <div className="text-sm text-gray-600">Responsável: {inventario.criado_por_nome}</div>
                  {inventario.data_finalizacao && (
                    <div className="text-sm text-gray-600">Finalizado em: {formatDate(inventario.data_finalizacao)}</div>
                  )}
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
                <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-600">
                  <p className="font-semibold text-blue-900">Depósito 2</p>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 mt-4">Resumo</h3>
                <div className="bg-gray-50 p-4 rounded text-sm">
                  <p>Total de Itens: <strong>{filteredItems.length}</strong></p>
                  <p>Contados: <strong>{filteredItems.filter(i => i.quantidade_real !== null || i.avariado !== null).length}</strong></p>
                  <p>Pendentes: <strong>{filteredItems.filter(i => i.quantidade_real === null && i.avariado === null).length}</strong></p>
                  <p className="mt-1">Filtros: <strong>{getActiveFiltersLabel()}</strong></p>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border border-gray-300 px-2 py-2 text-left">CÓDIGO</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">DESCRIÇÃO</th>
                  <th className="border border-gray-300 px-2 py-2 text-center">ABC</th>
                  <th className="border border-gray-300 px-2 py-2 text-center">UM</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">DEPÓSITO 2</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">QTD. REAL</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">AVARIADO</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">CONTAGEM REAL</th>
                  <th className="border border-gray-300 px-2 py-2 text-right">DIFERENÇA</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">OBSERVAÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const qtdReal = item.quantidade_real ?? 0;
                  const avar = item.avariado ?? 0;
                  const temContagem = item.quantidade_real !== null || item.avariado !== null;
                  const contagemReal = temContagem ? qtdReal + avar : null;
                  const diferenca = contagemReal !== null ? Math.round((item.deposito_2 - contagemReal) * 100) / 100 : null;
                  return (
                    <tr key={item.codigo_item} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-1">{item.codigo_item}</td>
                      <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center font-bold">{abcMap[item.codigo_item] || '-'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{item.unidade_medida}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.deposito_2)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {item.quantidade_real !== null ? formatNumber(item.quantidade_real) : '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right">
                        {item.avariado !== null ? formatNumber(item.avariado) : '-'}
                      </td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-semibold">
                        {contagemReal !== null ? formatNumber(contagemReal) : '-'}
                      </td>
                      <td className={`border border-gray-300 px-2 py-1 text-right font-semibold ${
                        diferenca !== null && diferenca > 0 ? 'text-green-600' :
                        diferenca !== null && diferenca < 0 ? 'text-red-600' : ''
                      }`}>
                        {diferenca !== null ? (diferenca === 0 ? 'Ok' : `${diferenca > 0 ? '+' : ''}${formatNumber(diferenca)}`) : '-'}
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

export default InventarioFilialPage;
