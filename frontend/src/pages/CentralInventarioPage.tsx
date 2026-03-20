import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Archive, Search, Eye, Printer, Calendar, ChevronLeft, ArrowUp, ArrowDown, ArrowUpDown, CheckCircle, ClipboardCheck, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PerfilEnum } from '../types';

interface InventarioResumo {
  _id: string;
  data_snapshot: string;
  criado_por_nome: string;
  total_itens: number;
  itens_contados: number;
  origem: 'Fábrica' | 'Filial';
  visto_por_nome?: string;
  visto_data?: string;
  resolvido_por_nome?: string;
  resolvido_data?: string;
  resolvido_observacao?: string;
}

interface InventarioItem {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  fornecedor: string;
  dep_aberto_interno: number;
  dep_fechado_externo: number;
  dep_fechado_interno: number;
  producoes_aberto: number;
  dep_aberto_real: number;
  contagem_aberto: number | null;
  contagem_fechado_ext: number | null;
  contagem_fechado_int: number | null;
  observacao?: string;
}

interface InventarioDetalhe {
  _id: string;
  data_snapshot: string;
  status: string;
  criado_por_nome: string;
  itens: InventarioItem[];
  origem?: 'Fábrica' | 'Filial';
  visto_por_nome?: string;
  visto_data?: string;
  resolvido_por_nome?: string;
  resolvido_data?: string;
  resolvido_observacao?: string;
}

interface InventarioFilialItemDetail {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  deposito_2: number;
  quantidade_real: number | null;
  avariado: number | null;
  observacao?: string;
}

const CentralInventarioPage = () => {
  const { user } = useAuth();
  const [inventarios, setInventarios] = useState<InventarioResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<InventarioDetalhe | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [depositoView, setDepositoView] = useState('aberto');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'contados' | 'com_divergencia' | 'sem_divergencia'>('todos');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [sortDiferenca, setSortDiferenca] = useState<'none' | 'asc' | 'desc'>('none');
  const [showResolvidoModal, setShowResolvidoModal] = useState(false);
  const [resolvidoObs, setResolvidoObs] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFinalizados();
  }, []);

  const fetchFinalizados = async (inicio?: string, fim?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      if (inicio) params.dataInicio = inicio;
      if (fim) params.dataFim = fim;
      const [resFabrica, resFilial] = await Promise.all([
        api.get('/inventario/finalizados', { params }),
        api.get('/inventario-filial/finalizados', { params })
      ]);
      const fabrica = resFabrica.data.map((inv: any) => ({ ...inv, origem: 'Fábrica' }));
      const filial = resFilial.data.map((inv: any) => ({ ...inv, origem: 'Filial' }));
      const todos = [...fabrica, ...filial].sort((a: any, b: any) => new Date(b.data_snapshot).getTime() - new Date(a.data_snapshot).getTime());
      setInventarios(todos);
    } catch (error) {
      console.error('Erro ao buscar inventários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFiltrarData = () => {
    fetchFinalizados(dataInicio, dataFim);
  };

  const abrirDetalhe = async (id: string) => {
    try {
      setLoading(true);
      const inv = inventarios.find(i => i._id === id);
      const endpoint = inv?.origem === 'Filial' ? `/inventario-filial/${id}` : `/inventario/${id}`;
      const response = await api.get(endpoint);
      setDetalhe({
        ...response.data,
        origem: inv?.origem || 'Fábrica',
        visto_por_nome: inv?.visto_por_nome || response.data.visto_por_nome,
        visto_data: inv?.visto_data || response.data.visto_data,
        resolvido_por_nome: inv?.resolvido_por_nome || response.data.resolvido_por_nome,
        resolvido_data: inv?.resolvido_data || response.data.resolvido_data,
        resolvido_observacao: inv?.resolvido_observacao || response.data.resolvido_observacao,
      });
    } catch (error) {
      console.error('Erro ao buscar detalhe:', error);
      alert('Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  const voltarLista = () => {
    setDetalhe(null);
    setSearchTerm('');
    setDepositoView('aberto');
    setStatusFilter('todos');
    setTipoFilter('');
    setSortDiferenca('none');
    setShowResolvidoModal(false);
    setResolvidoObs('');
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: detalhe ? `Inventario_${formatDateShort(detalhe.data_snapshot)}` : 'Inventario',
  });

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getContagem = (item: InventarioItem, deposito: string): number | null => {
    if (deposito === 'aberto') return item.contagem_aberto;
    if (deposito === 'fechado_ext') return item.contagem_fechado_ext;
    return item.contagem_fechado_int;
  };

  const getSaldo = (item: InventarioItem, deposito: string): number => {
    if (deposito === 'aberto') return item.dep_aberto_real;
    if (deposito === 'fechado_ext') return item.dep_fechado_externo;
    return item.dep_fechado_interno;
  };

  const getFilteredItems = (): InventarioItem[] => {
    if (!detalhe) return [];
    let items = [...detalhe.itens];

    // Filtrar por depósito com saldo
    if (depositoView === 'aberto') {
      items = items.filter(i => i.dep_aberto_interno > 0 || i.producoes_aberto > 0);
    } else if (depositoView === 'fechado_ext') {
      items = items.filter(i => i.dep_fechado_externo > 0);
    } else {
      items = items.filter(i => i.dep_fechado_interno > 0);
    }

    if (tipoFilter) {
      items = items.filter(i => i.tipo === tipoFilter);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.descricao.toLowerCase().includes(lower) ||
        i.codigo_item.toLowerCase().includes(lower) ||
        i.fornecedor.toLowerCase().includes(lower)
      );
    }

    // Filtro de status
    if (statusFilter === 'contados') {
      items = items.filter(i => getContagem(i, depositoView) !== null);
    } else if (statusFilter === 'com_divergencia') {
      items = items.filter(i => {
        const c = getContagem(i, depositoView);
        if (c === null) return false;
        return Math.abs(c - getSaldo(i, depositoView)) > 0.01;
      });
    } else if (statusFilter === 'sem_divergencia') {
      items = items.filter(i => {
        const c = getContagem(i, depositoView);
        if (c === null) return false;
        return Math.abs(c - getSaldo(i, depositoView)) <= 0.01;
      });
    }

    // Ordenação por diferença
    if (sortDiferenca !== 'none') {
      items.sort((a, b) => {
        const ca = getContagem(a, depositoView);
        const cb = getContagem(b, depositoView);
        const da = ca !== null ? ca - getSaldo(a, depositoView) : null;
        const db = cb !== null ? cb - getSaldo(b, depositoView) : null;
        // Itens sem contagem vão pro final
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return sortDiferenca === 'asc' ? da - db : db - da;
      });
    }

    return items;
  };

  const getStatusFilterLabel = (): string => {
    switch (statusFilter) {
      case 'contados': return 'Contados';
      case 'com_divergencia': return 'Com Divergência';
      case 'sem_divergencia': return 'Sem Divergência';
      default: return 'Todos';
    }
  };

  const toggleSortDiferenca = () => {
    setSortDiferenca(prev => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  };

  const calcularABC = (itens: InventarioItem[]): Record<string, 'A' | 'B' | 'C'> => {
    const comSaldo = itens.map(item => ({ codigo: item.codigo_item, saldo: Math.abs(getSaldo(item, depositoView)) }));
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

  const canDoActions = user && (user.perfil === PerfilEnum.DIRETORIA || user.perfil === PerfilEnum.COMPRADOR || user.perfil === PerfilEnum.ADMIN);

  const getApiPrefix = (): string => {
    return detalhe?.origem === 'Filial' ? '/inventario-filial' : '/inventario';
  };

  const handleVisto = async () => {
    if (!detalhe || actionLoading) return;
    try {
      setActionLoading(true);
      await api.put(`${getApiPrefix()}/${detalhe._id}/visto`);
      const response = await api.get(`${getApiPrefix()}/${detalhe._id}`);
      setDetalhe(prev => prev ? { ...prev, visto_por_nome: response.data.visto_por_nome, visto_data: response.data.visto_data } : null);
      fetchFinalizados(dataInicio || undefined, dataFim || undefined);
    } catch (error) {
      console.error('Erro ao marcar visto:', error);
      alert('Erro ao marcar como visto');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolvido = async () => {
    if (!detalhe || actionLoading) return;
    try {
      setActionLoading(true);
      await api.put(`${getApiPrefix()}/${detalhe._id}/resolvido`, { observacao: resolvidoObs });
      const response = await api.get(`${getApiPrefix()}/${detalhe._id}`);
      setDetalhe(prev => prev ? { ...prev, resolvido_por_nome: response.data.resolvido_por_nome, resolvido_data: response.data.resolvido_data, resolvido_observacao: response.data.resolvido_observacao } : null);
      setShowResolvidoModal(false);
      setResolvidoObs('');
      fetchFinalizados(dataInicio || undefined, dataFim || undefined);
    } catch (error) {
      console.error('Erro ao marcar resolvido:', error);
      alert('Erro ao marcar como resolvido');
    } finally {
      setActionLoading(false);
    }
  };

  // ==== LISTA DE INVENTÁRIOS ====
  if (!detalhe) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <Archive className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-800">Central de Inventário</h1>
        </div>

        {/* Filtro por data */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleFiltrarData}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Calendar size={18} />
              <span>Filtrar</span>
            </button>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Responsável</label>
              <select
                value={responsavelFilter}
                onChange={(e) => setResponsavelFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {[...new Set(inventarios.map(i => i.criado_por_nome))].sort().map(nome => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </select>
            </div>
            {(dataInicio || dataFim) && (
              <button
                onClick={() => { setDataInicio(''); setDataFim(''); setResponsavelFilter(''); fetchFinalizados(); }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 underline text-sm"
              >
                Limpar filtro
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : inventarios.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Archive size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhum inventário finalizado</h2>
            <p className="text-gray-500">Inventários finalizados aparecerão aqui.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Origem</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Itens</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Contados</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Cobertura</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventarios.filter(inv => !responsavelFilter || inv.criado_por_nome === responsavelFilter).map((inv) => {
                  const cobertura = inv.total_itens > 0 ? Math.round((inv.itens_contados / inv.total_itens) * 100) : 0;
                  return (
                    <tr key={inv._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{formatDate(inv.data_snapshot)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{inv.criado_por_nome}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          inv.origem === 'Fábrica' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {inv.origem}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center font-medium">{inv.total_itens}</td>
                      <td className="px-4 py-3 text-sm text-center text-green-600 font-medium">{inv.itens_contados}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          cobertura >= 90 ? 'bg-green-100 text-green-700' :
                          cobertura >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {cobertura}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {inv.resolvido_por_nome ? (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">Resolvido</span>
                        ) : inv.visto_por_nome ? (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">Visto</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Pendente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => abrirDetalhe(inv._id)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          <Eye size={14} />
                          <span>Ver Relatório</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ==== DETALHE DO INVENTÁRIO FILIAL ====
  if (detalhe.origem === 'Filial') {
    const filialItens = (detalhe as any).itens as InventarioFilialItemDetail[];
    const filialFiltered = filialItens.filter(i => {
      if (i.deposito_2 === 0) return false;
      if (tipoFilter && i.tipo !== tipoFilter) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        if (!i.descricao.toLowerCase().includes(lower) && !i.codigo_item.toLowerCase().includes(lower)) return false;
      }
      if (statusFilter === 'contados') return i.quantidade_real !== null || i.avariado !== null;
      if (statusFilter === 'com_divergencia') {
        const temC = i.quantidade_real !== null || i.avariado !== null;
        if (!temC) return false;
        const cr = (i.quantidade_real ?? 0) + (i.avariado ?? 0);
        return Math.abs(Math.round((i.deposito_2 - cr) * 100) / 100) > 0;
      }
      if (statusFilter === 'sem_divergencia') {
        const temC = i.quantidade_real !== null || i.avariado !== null;
        if (!temC) return false;
        const cr = (i.quantidade_real ?? 0) + (i.avariado ?? 0);
        return Math.round((i.deposito_2 - cr) * 100) / 100 === 0;
      }
      return true;
    });

    const filialAbcMap = (() => {
      const comSaldo = filialFiltered.map(item => ({ codigo: item.codigo_item, saldo: Math.abs(item.deposito_2) }));
      comSaldo.sort((a, b) => b.saldo - a.saldo);
      const total = comSaldo.reduce((sum, i) => sum + i.saldo, 0);
      if (total === 0) return {} as Record<string, 'A' | 'B' | 'C'>;
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
    })();

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <button onClick={voltarLista} className="p-2 hover:bg-gray-200 rounded-lg"><ChevronLeft size={24} /></button>
            <Archive className="text-purple-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Relatório de Inventário <span className="text-purple-600">(Filial)</span></h1>
              <p className="text-sm text-gray-500">{formatDate(detalhe.data_snapshot)} • Por: {detalhe.criado_por_nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canDoActions && (
              <>
                <button
                  onClick={handleVisto}
                  disabled={!!detalhe.visto_por_nome || actionLoading}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                    detalhe.visto_por_nome ? 'bg-blue-100 text-blue-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <CheckCircle size={18} />
                  <span>{detalhe.visto_por_nome ? `Visto por ${detalhe.visto_por_nome}` : 'Visto'}</span>
                </button>
                <button
                  onClick={() => setShowResolvidoModal(true)}
                  disabled={!!detalhe.resolvido_por_nome || actionLoading}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                    detalhe.resolvido_por_nome ? 'bg-green-100 text-green-700 cursor-default' : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <ClipboardCheck size={18} />
                  <span>{detalhe.resolvido_por_nome ? `Resolvido por ${detalhe.resolvido_por_nome}` : 'Resolvido'}</span>
                </button>
              </>
            )}
            <button onClick={() => handlePrint()} className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
              <Printer size={18} /><span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Status info */}
        {(detalhe.visto_por_nome || detalhe.resolvido_por_nome) && (
          <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 text-sm">
            {detalhe.visto_por_nome && (
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-blue-600" />
                <span className="text-gray-600">Visto por <strong>{detalhe.visto_por_nome}</strong> em {formatDate(detalhe.visto_data!)}</span>
              </div>
            )}
            {detalhe.resolvido_por_nome && (
              <div className="flex items-center gap-2">
                <ClipboardCheck size={16} className="text-green-600" />
                <span className="text-gray-600">Resolvido por <strong>{detalhe.resolvido_por_nome}</strong> em {formatDate(detalhe.resolvido_data!)}</span>
                {detalhe.resolvido_observacao && <span className="text-gray-500 italic">— "{detalhe.resolvido_observacao}"</span>}
              </div>
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Buscar código ou descrição..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500" />
            </div>
            <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500">
              <option value="">Todos os Tipos</option>
              {Array.from(new Set(filialItens.map(i => i.tipo))).sort().map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500">
              <option value="todos">Todos os Itens</option>
              <option value="contados">Somente Contados</option>
              <option value="com_divergencia">Com Divergência</option>
              <option value="sem_divergencia">Sem Divergência</option>
            </select>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-500">Total Itens</p>
            <p className="text-2xl font-bold text-purple-600">{filialFiltered.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-500">Contados</p>
            <p className="text-2xl font-bold text-green-600">{filialFiltered.filter(i => i.quantidade_real !== null || i.avariado !== null).length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-500">Com Divergência</p>
            <p className="text-2xl font-bold text-orange-600">{filialFiltered.filter(i => {
              const temC = i.quantidade_real !== null || i.avariado !== null;
              if (!temC) return false;
              const cr = (i.quantidade_real ?? 0) + (i.avariado ?? 0);
              return Math.abs(Math.round((i.deposito_2 - cr) * 100) / 100) > 0;
            }).length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-500">Sem Divergência</p>
            <p className="text-2xl font-bold text-gray-600">{filialFiltered.filter(i => {
              const temC = i.quantidade_real !== null || i.avariado !== null;
              if (!temC) return false;
              const cr = (i.quantidade_real ?? 0) + (i.avariado ?? 0);
              return Math.round((i.deposito_2 - cr) * 100) / 100 === 0;
            }).length}</p>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">ABC</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">UM</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Depósito 2</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd. Real</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avariado</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contagem Real</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Diferença</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filialFiltered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Nenhum item encontrado</td></tr>
              ) : filialFiltered.map((item) => {
                const qtdR = item.quantidade_real ?? 0;
                const avar = item.avariado ?? 0;
                const temC = item.quantidade_real !== null || item.avariado !== null;
                const contagemReal = temC ? qtdR + avar : null;
                const dif = contagemReal !== null ? Math.round((item.deposito_2 - contagemReal) * 100) / 100 : null;
                return (
                  <tr key={item.codigo_item} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-mono">{item.codigo_item}</td>
                    <td className="px-3 py-2 text-sm max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                    <td className="px-3 py-2 text-sm text-center">
                      {filialAbcMap[item.codigo_item] && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          filialAbcMap[item.codigo_item] === 'A' ? 'bg-red-100 text-red-700' :
                          filialAbcMap[item.codigo_item] === 'B' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>{filialAbcMap[item.codigo_item]}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">{item.unidade_medida}</td>
                    <td className="px-3 py-2 text-sm text-right">{formatNumber(item.deposito_2)}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.quantidade_real !== null ? formatNumber(item.quantidade_real) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2 text-sm text-right">{item.avariado !== null ? formatNumber(item.avariado) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold text-blue-700">{contagemReal !== null ? formatNumber(contagemReal) : <span className="text-gray-300">-</span>}</td>
                    <td className="px-3 py-2 text-sm text-right font-semibold">
                      {dif !== null ? (
                        dif === 0 ? <span className="text-green-600 font-bold">Ok</span> :
                        <span className={dif > 0 ? 'text-green-600' : 'text-red-600'}>{dif > 0 ? '+' : ''}{formatNumber(dif)}</span>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate" title={item.observacao || ''}>{item.observacao || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500">Exibindo {filialFiltered.length} itens</div>
        </div>

        {/* PRINT VIEW Filial */}
        <div style={{ display: 'none' }}>
          <div ref={printRef} className="p-8 bg-white">
            <div className="border-b-4 border-purple-600 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <img src="/assets/valemilk-logo.png" alt="Vale Milk" className="h-16 w-auto" />
                  <p className="text-sm text-gray-600">Relatório de Inventário Filial</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">Inventário Filial - Depósito 2</div>
                  <div className="text-sm text-gray-600 mt-1">Data: {formatDate(detalhe.data_snapshot)}</div>
                  <div className="text-sm text-gray-600">Responsável: {detalhe.criado_por_nome}</div>
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
                <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-600">
                  <p className="font-semibold text-purple-900">Depósito 2 (Filial)</p>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 mt-4">Resumo</h3>
                <div className="bg-gray-50 p-4 rounded text-sm">
                  <p>Total de Itens: <strong>{filialFiltered.length}</strong></p>
                  <p>Contados: <strong>{filialFiltered.filter(i => i.quantidade_real !== null || i.avariado !== null).length}</strong></p>
                  <p>Filtro: <strong>{getStatusFilterLabel()}</strong></p>
                </div>
              </div>
            </div>
            {(detalhe.visto_por_nome || detalhe.resolvido_por_nome) && (
              <div className="mb-4 border rounded p-3 bg-gray-50 text-sm">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Status do Relatório</h3>
                {detalhe.visto_por_nome && (
                  <p>✔ Visto por: <strong>{detalhe.visto_por_nome}</strong> em {formatDate(detalhe.visto_data!)}</p>
                )}
                {detalhe.resolvido_por_nome && (
                  <>
                    <p>✔ Resolvido por: <strong>{detalhe.resolvido_por_nome}</strong> em {formatDate(detalhe.resolvido_data!)}</p>
                    {detalhe.resolvido_observacao && <p>Observação: <em>{detalhe.resolvido_observacao}</em></p>}
                  </>
                )}
              </div>
            )}
            <table className="w-full border-collapse border border-gray-300 text-xs">
              <thead>
                <tr className="bg-purple-600 text-white">
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
                {filialFiltered.map((item, index) => {
                  const qtdR = item.quantidade_real ?? 0;
                  const avar = item.avariado ?? 0;
                  const temC = item.quantidade_real !== null || item.avariado !== null;
                  const contagemReal = temC ? qtdR + avar : null;
                  const dif = contagemReal !== null ? Math.round((item.deposito_2 - contagemReal) * 100) / 100 : null;
                  return (
                    <tr key={item.codigo_item} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-2 py-1">{item.codigo_item}</td>
                      <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center font-bold">{filialAbcMap[item.codigo_item] || '-'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{item.unidade_medida}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.deposito_2)}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{item.quantidade_real !== null ? formatNumber(item.quantidade_real) : '-'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right">{item.avariado !== null ? formatNumber(item.avariado) : '-'}</td>
                      <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{contagemReal !== null ? formatNumber(contagemReal) : '-'}</td>
                      <td className={`border border-gray-300 px-2 py-1 text-right font-semibold ${
                        dif !== null && dif > 0 ? 'text-green-600' : dif !== null && dif < 0 ? 'text-red-600' : ''
                      }`}>{dif !== null ? (dif === 0 ? 'Ok' : `${dif > 0 ? '+' : ''}${formatNumber(dif)}`) : '-'}</td>
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

        {/* Modal Resolvido */}
        {showResolvidoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Marcar como Resolvido</h3>
                <button onClick={() => { setShowResolvidoModal(false); setResolvidoObs(''); }} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-600 mb-3">Adicione uma observação sobre a resolução deste inventário:</p>
              <textarea
                value={resolvidoObs}
                onChange={(e) => setResolvidoObs(e.target.value)}
                placeholder="Ex: Diferenças ajustadas no sistema, itens recontados..."
                className="w-full border rounded-lg px-3 py-2 h-28 resize-none focus:ring-2 focus:ring-green-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowResolvidoModal(false); setResolvidoObs(''); }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button onClick={handleResolvido} disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {actionLoading ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==== DETALHE DO INVENTÁRIO FÁBRICA (Relatório) ====
  const filteredItems = getFilteredItems();
  const abcMap = calcularABC(filteredItems);

  return (
    <div className="space-y-4">
      {/* Header do detalhe */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button onClick={voltarLista} className="p-2 hover:bg-gray-200 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <Archive className="text-blue-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Relatório de Inventário <span className="text-blue-600">(Fábrica)</span></h1>
            <p className="text-sm text-gray-500">
              {formatDate(detalhe.data_snapshot)} • Por: {detalhe.criado_por_nome}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canDoActions && (
            <>
              <button
                onClick={handleVisto}
                disabled={!!detalhe.visto_por_nome || actionLoading}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  detalhe.visto_por_nome ? 'bg-blue-100 text-blue-700 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <CheckCircle size={18} />
                <span>{detalhe.visto_por_nome ? `Visto por ${detalhe.visto_por_nome}` : 'Visto'}</span>
              </button>
              <button
                onClick={() => setShowResolvidoModal(true)}
                disabled={!!detalhe.resolvido_por_nome || actionLoading}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  detalhe.resolvido_por_nome ? 'bg-green-100 text-green-700 cursor-default' : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <ClipboardCheck size={18} />
                <span>{detalhe.resolvido_por_nome ? `Resolvido por ${detalhe.resolvido_por_nome}` : 'Resolvido'}</span>
              </button>
            </>
          )}
          <button
            onClick={() => handlePrint()}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Printer size={18} />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Status info */}
      {(detalhe.visto_por_nome || detalhe.resolvido_por_nome) && (
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4 text-sm">
          {detalhe.visto_por_nome && (
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-blue-600" />
              <span className="text-gray-600">Visto por <strong>{detalhe.visto_por_nome}</strong> em {formatDate(detalhe.visto_data!)}</span>
            </div>
          )}
          {detalhe.resolvido_por_nome && (
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-green-600" />
              <span className="text-gray-600">Resolvido por <strong>{detalhe.resolvido_por_nome}</strong> em {formatDate(detalhe.resolvido_data!)}</span>
              {detalhe.resolvido_observacao && <span className="text-gray-500 italic">— "{detalhe.resolvido_observacao}"</span>}
            </div>
          )}
        </div>
      )}

      {/* Filtros do detalhe */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar código, descrição ou fornecedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={depositoView}
            onChange={(e) => setDepositoView(e.target.value)}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="aberto">Dep. Aberto (Interno)</option>
            <option value="fechado_ext">Dep. Fechado (Externo)</option>
            <option value="fechado_int">Dep. Fechado (Interno)</option>
          </select>
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Tipos</option>
            {detalhe && Array.from(new Set(detalhe.itens.map(i => i.tipo))).sort().map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="todos">Todos os Itens</option>
            <option value="contados">Somente Contados</option>
            <option value="com_divergencia">Com Divergência</option>
            <option value="sem_divergencia">Sem Divergência</option>
          </select>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Total Itens</p>
          <p className="text-2xl font-bold text-blue-600">{filteredItems.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Contados</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredItems.filter(i => getContagem(i, depositoView) !== null).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Com Divergência</p>
          <p className="text-2xl font-bold text-orange-600">
            {filteredItems.filter(i => {
              const c = getContagem(i, depositoView);
              if (c === null) return false;
              return Math.abs(c - getSaldo(i, depositoView)) > 0.01;
            }).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Sem Divergência</p>
          <p className="text-2xl font-bold text-gray-600">
            {filteredItems.filter(i => {
              const c = getContagem(i, depositoView);
              if (c === null) return false;
              return Math.abs(c - getSaldo(i, depositoView)) <= 0.01;
            }).length}
          </p>
        </div>
      </div>

      {/* Tabela na tela */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">ABC</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">UM</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                {depositoView === 'aberto' ? 'Dep. Aberto' : depositoView === 'fechado_ext' ? 'Dep. Fechado (Ext)' : 'Dep. Fechado (Int)'}
              </th>
              {depositoView === 'aberto' && (
                <>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Prod. Aberto</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Dep. Real</th>
                </>
              )}
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Contagem</th>
              <th
                className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                onClick={toggleSortDiferenca}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Diferença</span>
                  {sortDiferenca === 'none' && <ArrowUpDown size={14} className="text-gray-400" />}
                  {sortDiferenca === 'asc' && <ArrowUp size={14} className="text-blue-600" />}
                  {sortDiferenca === 'desc' && <ArrowDown size={14} className="text-blue-600" />}
                </div>
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Observações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={depositoView === 'aberto' ? 10 : 8} className="px-4 py-8 text-center text-gray-500">
                  Nenhum item encontrado
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const contagem = getContagem(item, depositoView);
                const saldo = getSaldo(item, depositoView);
                const diferenca = contagem !== null ? contagem - saldo : null;
                return (
                  <tr key={item.codigo_item} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-mono">{item.codigo_item}</td>
                    <td className="px-3 py-2 text-sm max-w-xs truncate" title={item.descricao}>{item.descricao}</td>
                    <td className="px-3 py-2 text-sm text-center hidden sm:table-cell">
                      {abcMap[item.codigo_item] && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          abcMap[item.codigo_item] === 'A' ? 'bg-red-100 text-red-700' :
                          abcMap[item.codigo_item] === 'B' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {abcMap[item.codigo_item]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 hidden sm:table-cell">{item.unidade_medida}</td>
                    <td className="px-3 py-2 text-sm text-right">
                      {depositoView === 'aberto' ? formatNumber(item.dep_aberto_interno) :
                       depositoView === 'fechado_ext' ? formatNumber(item.dep_fechado_externo) :
                       formatNumber(item.dep_fechado_interno)}
                    </td>
                    {depositoView === 'aberto' && (
                      <>
                        <td className="px-3 py-2 text-sm text-right hidden md:table-cell">{formatNumber(item.producoes_aberto)}</td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-blue-700">{formatNumber(item.dep_aberto_real)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 text-sm text-right font-semibold">
                      {contagem !== null ? formatNumber(contagem) : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-semibold">
                        {diferenca !== null ? (
                          <span className={diferenca > 0 ? 'text-green-600' : diferenca < 0 ? 'text-red-600' : 'text-gray-500'}>
                            {diferenca > 0 ? '+' : ''}{formatNumber(diferenca)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 max-w-xs truncate" title={item.observacao || ''}>{item.observacao || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500">
          Exibindo {filteredItems.length} itens
        </div>
      </div>

      {/* ===== PRINT VIEW (oculto) ===== */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} className="p-8 bg-white">
          {/* Cabeçalho do PDF */}
          <div className="border-b-4 border-blue-600 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-4">
                <img src="/assets/valemilk-logo.png" alt="Vale Milk" className="h-16 w-auto" />
                <p className="text-sm text-gray-600">Relatório de Inventário</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-800">Inventário Físico</div>
                <div className="text-sm text-gray-600 mt-1">
                  Data: {formatDate(detalhe.data_snapshot)}
                </div>
                <div className="text-sm text-gray-600">
                  Responsável: {detalhe.criado_por_nome}
                </div>
                {(statusFilter !== 'todos' || sortDiferenca !== 'none') && (
                  <div className="text-sm text-blue-700 font-semibold mt-1">
                    Filtro: {getStatusFilterLabel()}
                    {sortDiferenca !== 'none' && ` | Ordenado por Diferença ${sortDiferenca === 'asc' ? '↑ (menor→maior)' : '↓ (maior→menor)'}`}
                  </div>
                )}
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Depósito</h3>
              <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-600">
                <p className="font-semibold text-blue-900">
                  {depositoView === 'aberto' ? 'Depósito Aberto (Interno)' :
                   depositoView === 'fechado_ext' ? 'Depósito Fechado (Externo)' :
                   'Depósito Fechado (Interno)'}
                </p>
              </div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 mt-4">Resumo</h3>
              <div className="bg-gray-50 p-4 rounded text-sm">
                <p>Total de Itens: <strong>{filteredItems.length}</strong></p>
                <p>Contados: <strong>{filteredItems.filter(i => getContagem(i, depositoView) !== null).length}</strong></p>
                <p>Com Divergência: <strong>{filteredItems.filter(i => {
                  const c = getContagem(i, depositoView);
                  if (c === null) return false;
                  return Math.abs(c - getSaldo(i, depositoView)) > 0.01;
                }).length}</strong></p>
                <p>Filtro Aplicado: <strong>{getStatusFilterLabel()}</strong></p>
                {sortDiferenca !== 'none' && (
                  <p>Ordenação: <strong>Diferença {sortDiferenca === 'asc' ? '↑ (menor→maior)' : '↓ (maior→menor)'}</strong></p>
                )}
              </div>
            </div>
          </div>
          {(detalhe.visto_por_nome || detalhe.resolvido_por_nome) && (
            <div className="mb-4 border rounded p-3 bg-gray-50 text-sm">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Status do Relatório</h3>
              {detalhe.visto_por_nome && (
                <p>✔ Visto por: <strong>{detalhe.visto_por_nome}</strong> em {formatDate(detalhe.visto_data!)}</p>
              )}
              {detalhe.resolvido_por_nome && (
                <>
                  <p>✔ Resolvido por: <strong>{detalhe.resolvido_por_nome}</strong> em {formatDate(detalhe.resolvido_data!)}</p>
                  {detalhe.resolvido_observacao && <p>Observação: <em>{detalhe.resolvido_observacao}</em></p>}
                </>
              )}
            </div>
          )}

          {/* Tabela para impressão */}
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="border border-gray-300 px-2 py-2 text-left">CÓDIGO</th>
                <th className="border border-gray-300 px-2 py-2 text-left">DESCRIÇÃO</th>
                <th className="border border-gray-300 px-2 py-2 text-center">ABC</th>
                <th className="border border-gray-300 px-2 py-2 text-center">UM</th>
                <th className="border border-gray-300 px-2 py-2 text-right">
                  {depositoView === 'aberto' ? 'DEP. ABERTO' : depositoView === 'fechado_ext' ? 'DEP. FECH. (EXT)' : 'DEP. FECH. (INT)'}
                </th>
                {depositoView === 'aberto' && (
                  <>
                    <th className="border border-gray-300 px-2 py-2 text-right">PROD. ABERTO</th>
                    <th className="border border-gray-300 px-2 py-2 text-right">DEP. REAL</th>
                  </>
                )}
                <th className="border border-gray-300 px-2 py-2 text-right">CONTAGEM</th>
                <th className="border border-gray-300 px-2 py-2 text-right">DIFERENÇA</th>
                <th className="border border-gray-300 px-2 py-2 text-left">OBSERVAÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => {
                const contagem = getContagem(item, depositoView);
                const saldo = getSaldo(item, depositoView);
                const diferenca = contagem !== null ? contagem - saldo : null;
                return (
                  <tr key={item.codigo_item} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-1">{item.codigo_item}</td>
                    <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-bold">
                      {abcMap[item.codigo_item] || '-'}
                    </td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{item.unidade_medida}</td>
                    <td className="border border-gray-300 px-2 py-1 text-right">
                      {depositoView === 'aberto' ? formatNumber(item.dep_aberto_interno) :
                       depositoView === 'fechado_ext' ? formatNumber(item.dep_fechado_externo) :
                       formatNumber(item.dep_fechado_interno)}
                    </td>
                    {depositoView === 'aberto' && (
                      <>
                        <td className="border border-gray-300 px-2 py-1 text-right">{formatNumber(item.producoes_aberto)}</td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-semibold">{formatNumber(item.dep_aberto_real)}</td>
                      </>
                    )}
                    <td className="border border-gray-300 px-2 py-1 text-right font-semibold">
                      {contagem !== null ? formatNumber(contagem) : '-'}
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

          {/* Rodapé do PDF */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p className="mt-1">Para mais informações, entre em contato: compras@valemilk.com.br</p>
          </div>
        </div>
      </div>

      {/* Modal Resolvido */}
      {showResolvidoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Marcar como Resolvido</h3>
              <button onClick={() => { setShowResolvidoModal(false); setResolvidoObs(''); }} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Adicione uma observação sobre a resolução deste inventário:</p>
            <textarea
              value={resolvidoObs}
              onChange={(e) => setResolvidoObs(e.target.value)}
              placeholder="Ex: Diferenças ajustadas no sistema, itens recontados..."
              className="w-full border rounded-lg px-3 py-2 h-28 resize-none focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowResolvidoModal(false); setResolvidoObs(''); }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleResolvido} disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {actionLoading ? 'Salvando...' : 'Confirmar'}
              </button>
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

export default CentralInventarioPage;
