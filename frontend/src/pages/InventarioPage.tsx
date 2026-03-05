import { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Search, RefreshCw, CheckCircle, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import api from '../services/api';

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
  contagem_data?: string;
  contagem_usuario?: string;
}

interface Inventario {
  _id: string;
  data_snapshot: string;
  status: 'em_andamento' | 'finalizado';
  criado_por_nome: string;
  itens: InventarioItem[];
}

const InventarioPage = () => {
  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [filteredItems, setFilteredItems] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [depositoFilter, setDepositoFilter] = useState('aberto');
  const [contagemFilter, setContagemFilter] = useState<'todos' | 'pendentes' | 'contados'>('todos');
  const [abcFilter, setAbcFilter] = useState<'' | 'A' | 'B' | 'C'>('');
  const [abcMap, setAbcMap] = useState<Record<string, 'A' | 'B' | 'C'>>({});
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetchInventario();
  }, []);

  useEffect(() => {
    if (!inventario) {
      setFilteredItems([]);
      return;
    }
    filterItems();
  }, [inventario, searchTerm, tipoFilter, depositoFilter, contagemFilter, abcFilter]);

  const fetchInventario = async () => {
    try {
      setLoading(true);
      const response = await api.get('/inventario/active');
      setInventario(response.data);
    } catch (error) {
      console.error('Erro ao buscar inventário:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncERP = async () => {
    try {
      setSyncing(true);
      const response = await api.post('/inventario/sync-erp');
      setInventario(response.data);
    } catch (error) {
      console.error('Erro ao sincronizar ERP:', error);
      alert('Erro ao carregar dados do ERP');
    } finally {
      setSyncing(false);
    }
  };

  const getContagem = (item: InventarioItem): number | null => {
    if (depositoFilter === 'aberto') return item.contagem_aberto;
    if (depositoFilter === 'fechado_ext') return item.contagem_fechado_ext;
    return item.contagem_fechado_int;
  };

  const getContagemField = (): string => {
    if (depositoFilter === 'aberto') return 'contagem_aberto';
    if (depositoFilter === 'fechado_ext') return 'contagem_fechado_ext';
    return 'contagem_fechado_int';
  };

  const getSaldo = (item: InventarioItem): number => {
    if (depositoFilter === 'aberto') return item.dep_aberto_real;
    if (depositoFilter === 'fechado_ext') return item.dep_fechado_externo;
    return item.dep_fechado_interno;
  };

  const calcularABC = (itens: InventarioItem[]): Record<string, 'A' | 'B' | 'C'> => {
    const comSaldo = itens.map(item => ({ codigo: item.codigo_item, saldo: Math.abs(getSaldo(item)) }));
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
    if (!inventario) return;
    let filtered = [...inventario.itens];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.descricao.toLowerCase().includes(lower) ||
        item.codigo_item.toLowerCase().includes(lower) ||
        item.fornecedor.toLowerCase().includes(lower)
      );
    }

    if (tipoFilter) {
      filtered = filtered.filter(item => item.tipo === tipoFilter);
    }

    // Filtrar itens com saldo > 0 no depósito selecionado
    if (depositoFilter === 'aberto') {
      filtered = filtered.filter(item => item.dep_aberto_interno > 0 || item.producoes_aberto > 0);
    } else if (depositoFilter === 'fechado_ext') {
      filtered = filtered.filter(item => item.dep_fechado_externo > 0);
    } else if (depositoFilter === 'fechado_int') {
      filtered = filtered.filter(item => item.dep_fechado_interno > 0);
    }

    // Calcular ABC antes de aplicar filtro ABC
    const novoAbcMap = calcularABC(filtered);
    setAbcMap(novoAbcMap);

    if (abcFilter) {
      filtered = filtered.filter(item => novoAbcMap[item.codigo_item] === abcFilter);
    }

    if (contagemFilter === 'pendentes') {
      filtered = filtered.filter(item => getContagem(item) === null || getContagem(item) === undefined);
    } else if (contagemFilter === 'contados') {
      filtered = filtered.filter(item => getContagem(item) !== null && getContagem(item) !== undefined);
    }

    setFilteredItems(filtered);
  };

  const saveContagem = useCallback(async (codigoItem: string, value: number | null) => {
    if (!inventario) return;
    
    setSavingItem(codigoItem);
    try {
      await api.put(`/inventario/${inventario._id}/item/${codigoItem}`, {
        contagem_fisica: value,
        deposito: depositoFilter
      });
      
      // Atualizar localmente
      const field = getContagemField();
      setInventario(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map(item =>
            item.codigo_item === codigoItem
              ? { ...item, [field]: value, contagem_data: new Date().toISOString() }
              : item
          )
        };
      });
    } catch (error) {
      console.error('Erro ao salvar contagem:', error);
      alert('Erro ao salvar contagem');
    } finally {
      setSavingItem(null);
    }
  }, [inventario, depositoFilter]);

  const handleContagemChange = (codigoItem: string, rawValue: string) => {
    const value = rawValue === '' ? null : parseFloat(rawValue);
    const field = getContagemField();
    
    // Atualizar UI imediatamente
    setInventario(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map(item =>
          item.codigo_item === codigoItem
            ? { ...item, [field]: value }
            : item
        )
      };
    });

    // Debounce o save (800ms)
    if (debounceTimers.current[codigoItem]) {
      clearTimeout(debounceTimers.current[codigoItem]);
    }
    debounceTimers.current[codigoItem] = setTimeout(() => {
      saveContagem(codigoItem, value);
    }, 800);
  };

  const finalizarInventario = async () => {
    if (!inventario) return;
    
    const pendentes = inventario.itens.filter(i => {
      const c_ab = i.contagem_aberto; const c_fe = i.contagem_fechado_ext; const c_fi = i.contagem_fechado_int;
      return (c_ab === null || c_ab === undefined) && (c_fe === null || c_fe === undefined) && (c_fi === null || c_fi === undefined);
    }).length;
    const msg = pendentes > 0
      ? `Ainda existem ${pendentes} itens sem contagem. Deseja finalizar mesmo assim?`
      : 'Deseja finalizar o inventário?';
    
    if (!confirm(msg)) return;

    try {
      await api.put(`/inventario/${inventario._id}/finalizar`);
      setInventario(prev => prev ? { ...prev, status: 'finalizado' } : prev);
      alert('Inventário finalizado com sucesso!');
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      alert('Erro ao finalizar inventário');
    }
  };

  const descartarInventario = async () => {
    if (!inventario) return;
    if (!confirm('Tem certeza que deseja descartar este inventário? Todas as contagens serão perdidas.')) return;

    try {
      await api.delete(`/inventario/${inventario._id}`);
      setInventario(null);
    } catch (error) {
      console.error('Erro ao descartar:', error);
      alert('Erro ao descartar inventário');
    }
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  // Stats
  const totalItens = inventario?.itens.length || 0;
  const contados = inventario?.itens.filter(i => {
    const c = depositoFilter === 'aberto' ? i.contagem_aberto : depositoFilter === 'fechado_ext' ? i.contagem_fechado_ext : i.contagem_fechado_int;
    return c !== null && c !== undefined;
  }).length || 0;
  const pendentes = totalItens - contados;
  const progresso = totalItens > 0 ? Math.round((contados / totalItens) * 100) : 0;

  // Tipos únicos
  const tipos = inventario ? [...new Set(inventario.itens.map(i => i.tipo))].sort() : [];

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
          <Package className="text-blue-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Inventário</h1>
            {inventario && (
              <p className="text-sm text-gray-500">
                Snapshot: {formatDate(inventario.data_snapshot)} • Por: {inventario.criado_por_nome}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={syncERP}
            disabled={syncing || inventario?.status === 'finalizado'}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Carregando...' : inventario ? 'Atualizar ERP' : 'Carregar ERP'}</span>
          </button>
          {inventario && inventario.status === 'em_andamento' && (
            <>
              <button
                onClick={finalizarInventario}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircle size={18} />
                <span>Finalizar</span>
              </button>
              <button
                onClick={descartarInventario}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 size={18} />
                <span>Descartar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sem inventário */}
      {!inventario && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Package size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhum inventário em andamento</h2>
          <p className="text-gray-500 mb-4">Clique em "Carregar ERP" para iniciar um novo inventário com os dados atuais do sistema.</p>
        </div>
      )}

      {inventario && (
        <>
          {/* Progresso */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-blue-600 mb-1">
                <Package size={18} />
                <span className="text-sm font-medium">Total Itens</span>
              </div>
              <p className="text-2xl font-bold">{totalItens}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-green-600 mb-1">
                <CheckCircle size={18} />
                <span className="text-sm font-medium">Contados</span>
              </div>
              <p className="text-2xl font-bold">{contados}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-orange-600 mb-1">
                <Clock size={18} />
                <span className="text-sm font-medium">Pendentes</span>
              </div>
              <p className="text-2xl font-bold">{pendentes}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center space-x-2 text-purple-600 mb-1">
                <AlertTriangle size={18} />
                <span className="text-sm font-medium">Progresso</span>
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold">{progresso}%</p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </div>
          </div>

          {/* Status Finalizado */}
          {inventario.status === 'finalizado' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
              <CheckCircle className="text-green-600" size={24} />
              <span className="text-green-800 font-medium">Inventário finalizado. Os dados são somente leitura.</span>
            </div>
          )}

          {/* Filtros */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar código, descrição ou fornecedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={tipoFilter}
                onChange={(e) => setTipoFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Tipos</option>
                {tipos.map(tipo => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
              <select
                value={depositoFilter}
                onChange={(e) => setDepositoFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="aberto">Dep. Aberto (Interno)</option>
                <option value="fechado_ext">Dep. Fechado (Externo)</option>
                <option value="fechado_int">Dep. Fechado (Interno)</option>
              </select>
              <select
                value={contagemFilter}
                onChange={(e) => setContagemFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos</option>
                <option value="pendentes">Pendentes</option>
                <option value="contados">Contados</option>
              </select>
              <select
                value={abcFilter}
                onChange={(e) => setAbcFilter(e.target.value as any)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
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
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">ABC</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">UM</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Tipo</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {depositoFilter === 'aberto' ? 'Dep. Aberto' : depositoFilter === 'fechado_ext' ? 'Dep. Fechado (Ext)' : 'Dep. Fechado (Int)'}
                  </th>
                  {depositoFilter === 'aberto' && (
                    <>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Prod. Aberto</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Dep. Real</th>
                    </>
                  )}
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Contagem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={depositoFilter === 'aberto' ? 9 : 7} className="px-4 py-8 text-center text-gray-500">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const contagemAtual = getContagem(item);
                    const saldoDeposito = depositoFilter === 'aberto'
                      ? item.dep_aberto_real
                      : depositoFilter === 'fechado_ext'
                        ? item.dep_fechado_externo
                        : item.dep_fechado_interno;
                    const diferenca = contagemAtual !== null && contagemAtual !== undefined
                      ? contagemAtual - saldoDeposito
                      : null;
                    
                    return (
                      <tr key={item.codigo_item} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-mono text-gray-900">
                          {item.codigo_item}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title={item.descricao}>
                          {item.descricao}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-center hidden sm:table-cell">
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
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                          {item.unidade_medida}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">
                            {item.tipo}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                          {depositoFilter === 'aberto'
                            ? formatNumber(item.dep_aberto_interno)
                            : depositoFilter === 'fechado_ext'
                              ? formatNumber(item.dep_fechado_externo)
                              : formatNumber(item.dep_fechado_interno)}
                        </td>
                        {depositoFilter === 'aberto' && (
                          <>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900 hidden md:table-cell">
                              {formatNumber(item.producoes_aberto)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-semibold text-blue-700">
                              {formatNumber(item.dep_aberto_real)}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center space-x-1">
                            <input
                              type="number"
                              step="any"
                              value={contagemAtual !== null && contagemAtual !== undefined ? contagemAtual : ''}
                              onChange={(e) => handleContagemChange(item.codigo_item, e.target.value)}
                              disabled={inventario.status === 'finalizado'}
                              className={`w-24 px-2 py-1 border rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                inventario.status === 'finalizado' ? 'bg-gray-100 cursor-not-allowed' : ''
                              } ${
                                diferenca !== null && diferenca !== 0 ? 'border-orange-400 bg-orange-50' : ''
                              }`}
                              placeholder="-"
                            />
                            {savingItem === item.codigo_item && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                            )}
                            {contagemAtual !== null && contagemAtual !== undefined && savingItem !== item.codigo_item && (
                              <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                            )}
                          </div>
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
    </div>
  );
};

export default InventarioPage;
