import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Pedido, StatusPedido } from '../types';
import { Plus, Eye, Search, Calendar, X, ChevronDown, Check } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string }> = {
  [StatusPedido.RASCUNHO]: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  [StatusPedido.ANALISE_COTACAO]: { label: 'Análise Cotação', color: 'bg-yellow-100 text-yellow-700' },
  [StatusPedido.ENVIADO_FORNECEDOR]: { label: 'Enviado Fornecedor', color: 'bg-blue-100 text-blue-700' },
  [StatusPedido.AGUARDANDO_FATURAMENTO]: { label: 'Aguard. Faturamento', color: 'bg-orange-100 text-orange-700' },
  [StatusPedido.FATURADO]: { label: 'Faturado', color: 'bg-indigo-100 text-indigo-700' },
  [StatusPedido.EM_ROTA]: { label: 'Em Rota', color: 'bg-purple-100 text-purple-700' },
  [StatusPedido.RECEBIMENTO_NOTA]: { label: 'Recebimento', color: 'bg-teal-100 text-teal-700' },
  [StatusPedido.APROVADO_DIRETORIA]: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  [StatusPedido.CANCELADO]: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
};

function MultiSelectDropdown({ label, options, selected, onChange, renderOption }: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  renderOption?: (option: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val); else next.add(val);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(filtered));
  const clearAll = () => {
    const next = new Set(selected);
    filtered.forEach(f => next.delete(f));
    onChange(next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 min-w-[160px]"
      >
        <span className="truncate">
          {selected.size === 0 ? label : `${label} (${selected.size})`}
        </span>
        <ChevronDown size={14} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg w-72 max-h-80 flex flex-col">
          {options.length > 5 && (
            <div className="p-2 border-b">
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs">
            <button onClick={selectAll} className="text-blue-600 hover:underline">Selecionar todos</button>
            <span className="text-gray-300">|</span>
            <button onClick={clearAll} className="text-red-600 hover:underline">Limpar</button>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  selected.has(option) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                }`}>
                  {selected.has(option) && <Check size={12} className="text-white" />}
                </div>
                <span className="truncate">{renderOption ? renderOption(option) : option}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PedidosPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchIdCompra, setSearchIdCompra] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedFornecedores, setSelectedFornecedores] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    try {
      const response = await api.get<Pedido[]>('/pedidos');
      setPedidos(response.data);
    } catch (error) {
      console.error('Error fetching pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fornecedores = [...new Set(pedidos.map(p => p.fornecedor))].sort();
  const statusOptions = Object.keys(statusConfig);

  const filteredPedidos = pedidos.filter(pedido => {
    if (searchIdCompra) {
      const lower = searchIdCompra.toLowerCase();
      if (!pedido.idCompra?.toLowerCase().includes(lower) &&
          !pedido.numero.toLowerCase().includes(lower) &&
          !pedido.fornecedor.toLowerCase().includes(lower)) return false;
    }
    if (selectedStatuses.size > 0 && !selectedStatuses.has(pedido.status_atual)) return false;
    if (selectedFornecedores.size > 0 && !selectedFornecedores.has(pedido.fornecedor)) return false;
    if (dataInicio) {
      const d = new Date(pedido.data_criacao);
      if (d < new Date(dataInicio)) return false;
    }
    if (dataFim) {
      const d = new Date(pedido.data_criacao);
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      if (d > fim) return false;
    }
    return true;
  });

  const hasActiveFilters = selectedStatuses.size > 0 || dataInicio || dataFim || selectedFornecedores.size > 0;
  const clearFilters = () => { setSelectedStatuses(new Set()); setDataInicio(''); setDataFim(''); setSelectedFornecedores(new Set()); };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <button
          onClick={() => navigate('/items')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Novo Pedido</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por ID de Compra, número ou fornecedor..."
            value={searchIdCompra}
            onChange={(e) => setSearchIdCompra(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelectDropdown
            label="Status"
            options={statusOptions}
            selected={selectedStatuses}
            onChange={setSelectedStatuses}
            renderOption={(opt) => {
              const cfg = statusConfig[opt];
              return cfg ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${cfg.color}`}>
                  {cfg.label}
                </span>
              ) : opt;
            }}
          />
          <MultiSelectDropdown
            label="Fornecedor"
            options={fornecedores}
            selected={selectedFornecedores}
            onChange={setSelectedFornecedores}
          />
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-400 text-sm">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <X size={14} />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-4">ID Compra</th>
                <th className="text-left p-4">Número</th>
                <th className="text-left p-4">Fornecedor</th>
                <th className="text-left p-4">Data</th>
                <th className="text-center p-4">Itens</th>
                <th className="text-center p-4">Status</th>
                <th className="text-center p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-500">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido) => (
                  <tr key={pedido._id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-bold text-blue-600">{pedido.idCompra}</td>
                    <td className="p-4 font-medium">{pedido.numero}</td>
                    <td className="p-4">{pedido.fornecedor}</td>
                    <td className="p-4">
                      {new Date(pedido.data_criacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-center">{pedido.itens.length}</td>
                    <td className="p-4 text-center">
                      {(() => {
                        const cfg = statusConfig[pedido.status_atual] || { label: pedido.status_atual, color: 'bg-gray-100 text-gray-700' };
                        return (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => navigate(`/pedidos/${pedido._id}`)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Ver detalhes"
                      >
                        <Eye size={20} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
