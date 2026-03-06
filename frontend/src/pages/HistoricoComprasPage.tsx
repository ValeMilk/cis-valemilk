import { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart3, Filter, X, ChevronDown } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

interface HistoricoCompra {
  tipo: string;
  codigo: string;
  descricao: string;
  unidade: string;
  id_fornecedor: number | null;
  fornecedor: string;
  data_entrada: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface ProdutoOption {
  codigo: string;
  descricao: string;
  label: string;
}

const HistoricoComprasPage = () => {
  const [allData, setAllData] = useState<HistoricoCompra[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros selecionados
  const [selectedTipo, setSelectedTipo] = useState('');
  const [selectedFornecedor, setSelectedFornecedor] = useState('');
  const [selectedIdFornecedor, setSelectedIdFornecedor] = useState('');
  const [selectedProduto, setSelectedProduto] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Busca nos dropdowns
  const [buscaProduto, setBuscaProduto] = useState('');
  const [showProdutoDropdown, setShowProdutoDropdown] = useState(false);

  const produtoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (produtoRef.current && !produtoRef.current.contains(e.target as Node)) {
        setShowProdutoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      const response = await api.get('/items/historico-compras-all');
      setAllData(response.data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extrair opções únicas
  const uniqueTipos = useMemo(() => {
    return Array.from(new Set(allData.map(d => d.tipo))).sort();
  }, [allData]);

  const uniqueProdutos = useMemo(() => {
    let filtered = allData;
    if (selectedTipo) filtered = filtered.filter(d => d.tipo === selectedTipo);
    if (selectedFornecedor) filtered = filtered.filter(d => d.fornecedor === selectedFornecedor);

    const map = new Map<string, ProdutoOption>();
    for (const d of filtered) {
      if (!map.has(d.codigo)) {
        map.set(d.codigo, {
          codigo: d.codigo,
          descricao: d.descricao,
          label: `${d.codigo} - ${d.descricao}`
        });
      }
    }
    const list = Array.from(map.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));

    if (buscaProduto) {
      const search = buscaProduto.toLowerCase();
      return list.filter(p => p.label.toLowerCase().includes(search));
    }
    return list;
  }, [allData, selectedTipo, selectedFornecedor, buscaProduto]);

  const uniqueFornecedores = useMemo(() => {
    let filtered = allData;
    if (selectedTipo) filtered = filtered.filter(d => d.tipo === selectedTipo);
    if (selectedProduto) filtered = filtered.filter(d => d.codigo === selectedProduto);
    if (selectedIdFornecedor) filtered = filtered.filter(d => String(d.id_fornecedor) === selectedIdFornecedor);

    const list = Array.from(new Set(filtered.map(d => d.fornecedor))).sort();
    return list;
  }, [allData, selectedTipo, selectedProduto, selectedIdFornecedor]);

  const uniqueIdFornecedores = useMemo(() => {
    let filtered = allData;
    if (selectedTipo) filtered = filtered.filter(d => d.tipo === selectedTipo);
    if (selectedFornecedor) filtered = filtered.filter(d => d.fornecedor === selectedFornecedor);
    if (selectedProduto) filtered = filtered.filter(d => d.codigo === selectedProduto);

    const map = new Map<string, string>();
    for (const d of filtered) {
      const id = String(d.id_fornecedor ?? '');
      if (id && !map.has(id)) {
        map.set(id, `${id} - ${d.fornecedor}`);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allData, selectedTipo, selectedFornecedor, selectedProduto]);

  // Converte dd/mm/yyyy para Date para comparação
  const parseDataEntrada = (dateStr: string): Date | null => {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  };

  // Dados filtrados para os gráficos
  const filteredData = useMemo(() => {
    let data = allData;
    if (selectedTipo) data = data.filter(d => d.tipo === selectedTipo);
    if (selectedFornecedor) data = data.filter(d => d.fornecedor === selectedFornecedor);
    if (selectedIdFornecedor) data = data.filter(d => String(d.id_fornecedor) === selectedIdFornecedor);
    if (selectedProduto) data = data.filter(d => d.codigo === selectedProduto);
    if (dataInicio) {
      const inicio = new Date(dataInicio + 'T00:00:00');
      data = data.filter(d => {
        const dt = parseDataEntrada(d.data_entrada);
        return dt && dt >= inicio;
      });
    }
    if (dataFim) {
      const fim = new Date(dataFim + 'T23:59:59');
      data = data.filter(d => {
        const dt = parseDataEntrada(d.data_entrada);
        return dt && dt <= fim;
      });
    }
    return data;
  }, [allData, selectedTipo, selectedFornecedor, selectedIdFornecedor, selectedProduto, dataInicio, dataFim]);

  // Dados para gráficos de linha (por data)
  const chartDataTimeline = useMemo(() => {
    return filteredData.map(d => ({
      data: d.data_entrada,
      quantidade: d.quantidade,
      valor_unitario: d.valor_unitario,
      valor_total: d.valor_total,
      fornecedor: d.fornecedor,
      produto: `${d.codigo} - ${d.descricao}`
    }));
  }, [filteredData]);

  // Dados agrupados por fornecedor (para bar chart)
  const chartDataFornecedor = useMemo(() => {
    const map = new Map<string, { fornecedor: string; total_qtd: number; total_valor: number; compras: number }>();
    for (const d of filteredData) {
      const existing = map.get(d.fornecedor) || { fornecedor: d.fornecedor, total_qtd: 0, total_valor: 0, compras: 0 };
      existing.total_qtd += d.quantidade;
      existing.total_valor += d.valor_total;
      existing.compras += 1;
      map.set(d.fornecedor, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total_valor - a.total_valor).slice(0, 15);
  }, [filteredData]);

  // Dados agrupados por produto (para bar chart)
  const chartDataProduto = useMemo(() => {
    const map = new Map<string, { produto: string; total_qtd: number; total_valor: number; compras: number }>();
    for (const d of filteredData) {
      const key = d.codigo;
      const existing = map.get(key) || { produto: `${d.codigo} - ${d.descricao.substring(0, 25)}`, total_qtd: 0, total_valor: 0, compras: 0 };
      existing.total_qtd += d.quantidade;
      existing.total_valor += d.valor_total;
      existing.compras += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.total_valor - a.total_valor).slice(0, 15);
  }, [filteredData]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);

  const produtoSelecionadoLabel = useMemo(() => {
    if (!selectedProduto) return '';
    const item = allData.find(d => d.codigo === selectedProduto);
    return item ? `${item.codigo} - ${item.descricao}` : selectedProduto;
  }, [selectedProduto, allData]);

  const hasFilters = selectedTipo || selectedFornecedor || selectedIdFornecedor || selectedProduto || dataInicio || dataFim;

  const clearFilters = () => {
    setSelectedTipo('');
    setSelectedFornecedor('');
    setSelectedIdFornecedor('');
    setSelectedProduto('');
    setBuscaProduto('');
    setDataInicio('');
    setDataFim('');
  };

  // Totalizadores
  const totais = useMemo(() => {
    const qtdTotal = filteredData.reduce((s, d) => s + d.quantidade, 0);
    const valorTotal = filteredData.reduce((s, d) => s + d.valor_total, 0);
    const fornecedoresUnicos = new Set(filteredData.map(d => d.fornecedor)).size;
    const produtosUnicos = new Set(filteredData.map(d => d.codigo)).size;
    return { registros: filteredData.length, qtdTotal, valorTotal, fornecedoresUnicos, produtosUnicos };
  }, [filteredData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3">
          <BarChart3 className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-800">Histórico de Compras</h1>
        </div>
        <p className="text-gray-500 mt-1">
          Selecione os filtros para gerar os gráficos. {allData.length.toLocaleString('pt-BR')} registros desde set/2023
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-700">Filtros</h2>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-4 text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
              <X size={14} /> Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={selectedTipo}
              onChange={(e) => { setSelectedTipo(e.target.value); setSelectedProduto(''); setBuscaProduto(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos os Tipos</option>
              {uniqueTipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Id Fornecedor - dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Fornecedor</label>
            <select
              value={selectedIdFornecedor}
              onChange={(e) => { setSelectedIdFornecedor(e.target.value); setSelectedProduto(''); setBuscaProduto(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos os IDs</option>
              {uniqueIdFornecedores.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>

          {/* Fornecedor - dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
            <select
              value={selectedFornecedor}
              onChange={(e) => { setSelectedFornecedor(e.target.value); setSelectedProduto(''); setBuscaProduto(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos os Fornecedores</option>
              {uniqueFornecedores.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Produto - searchable */}
          <div ref={produtoRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
            <div className="relative">
              <input
                type="text"
                value={selectedProduto ? produtoSelecionadoLabel : buscaProduto}
                onChange={(e) => {
                  setBuscaProduto(e.target.value);
                  setSelectedProduto('');
                  setShowProdutoDropdown(true);
                }}
                onFocus={() => setShowProdutoDropdown(true)}
                placeholder="Buscar produto..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {selectedProduto ? (
                <button onClick={() => { setSelectedProduto(''); setBuscaProduto(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              ) : (
                <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              )}
            </div>
            {showProdutoDropdown && !selectedProduto && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSelectedProduto(''); setBuscaProduto(''); setShowProdutoDropdown(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm text-gray-500"
                >
                  Todos os Produtos
                </button>
                {uniqueProdutos.map(p => (
                  <button
                    key={p.codigo}
                    onClick={() => { setSelectedProduto(p.codigo); setBuscaProduto(''); setShowProdutoDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm truncate"
                  >
                    {p.label}
                  </button>
                ))}
                {uniqueProdutos.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">Nenhum produto encontrado</p>
                )}
              </div>
            )}
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Cards totalizadores */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Registros</p>
          <p className="text-2xl font-bold text-gray-800">{totais.registros.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Produtos</p>
          <p className="text-2xl font-bold text-blue-600">{totais.produtosUnicos}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Fornecedores</p>
          <p className="text-2xl font-bold text-green-600">{totais.fornecedoresUnicos}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Qtd. Total</p>
          <p className="text-2xl font-bold text-orange-600">{formatNumber(totais.qtdTotal)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 col-span-2 md:col-span-1">
          <p className="text-sm text-gray-500">Valor Total</p>
          <p className="text-xl font-bold text-purple-600">{formatCurrency(totais.valorTotal)}</p>
        </div>
      </div>

      {!hasFilters ? (
        /* Sem filtros: mostra gráficos por fornecedor e por produto */
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Top 15 Fornecedores por Valor Total</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartDataFornecedor} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="fornecedor" width={180} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Valor Total']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="total_valor" name="Valor Total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Top 15 Produtos por Valor Total</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartDataProduto} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="produto" width={220} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Valor Total']}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="total_valor" name="Valor Total" fill="#16a34a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* Com filtros: mostra timeline + barras comparativas */
        <div className="space-y-6">
          {filteredData.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <BarChart3 size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Nenhum registro encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <>
              {/* Gráfico de Quantidade no Tempo */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Quantidade por Compra ao Longo do Tempo
                  {selectedProduto && <span className="text-sm font-normal text-gray-500 ml-2">({produtoSelecionadoLabel})</span>}
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartDataTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold text-gray-800">{d.data}</p>
                            {!selectedProduto && <p className="text-gray-600">{d.produto}</p>}
                            <p className="text-gray-600">{d.fornecedor}</p>
                            <p className="text-blue-600 font-medium">Qtd: {formatNumber(d.quantidade)}</p>
                            <p className="text-green-600 font-medium">Unit: {formatCurrency(d.valor_unitario)}</p>
                            <p className="text-purple-600 font-medium">Total: {formatCurrency(d.valor_total)}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="quantidade" name="Quantidade" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico de Valor Unitário no Tempo */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Valor Unitário ao Longo do Tempo
                  {selectedProduto && <span className="text-sm font-normal text-gray-500 ml-2">({produtoSelecionadoLabel})</span>}
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartDataTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold text-gray-800">{d.data}</p>
                            {!selectedProduto && <p className="text-gray-600">{d.produto}</p>}
                            <p className="text-gray-600">{d.fornecedor}</p>
                            <p className="text-green-600 font-medium">Unit: {formatCurrency(d.valor_unitario)}</p>
                            <p className="text-blue-600 font-medium">Qtd: {formatNumber(d.quantidade)}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="valor_unitario" name="Valor Unitário" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico de Valor Total no Tempo */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Valor Total por Compra
                  {selectedProduto && <span className="text-sm font-normal text-gray-500 ml-2">({produtoSelecionadoLabel})</span>}
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={chartDataTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-semibold text-gray-800">{d.data}</p>
                            {!selectedProduto && <p className="text-gray-600">{d.produto}</p>}
                            <p className="text-gray-600">{d.fornecedor}</p>
                            <p className="text-purple-600 font-medium">Total: {formatCurrency(d.valor_total)}</p>
                            <p className="text-blue-600 font-medium">Qtd: {formatNumber(d.quantidade)}</p>
                            <p className="text-green-600 font-medium">Unit: {formatCurrency(d.valor_unitario)}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="valor_total" name="Valor Total" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Comparativo por fornecedor (quando não filtrou por fornecedor específico) */}
              {!selectedFornecedor && chartDataFornecedor.length > 1 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Comparativo por Fornecedor</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, chartDataFornecedor.length * 35)}>
                    <BarChart data={chartDataFornecedor} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="fornecedor" width={180} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'Valor Total') return [formatCurrency(value), name];
                          return [formatNumber(value), name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="total_valor" name="Valor Total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Comparativo por produto (quando não filtrou por produto específico) */}
              {!selectedProduto && chartDataProduto.length > 1 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">Comparativo por Produto</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, chartDataProduto.length * 35)}>
                    <BarChart data={chartDataProduto} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="produto" width={220} tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'Valor Total') return [formatCurrency(value), name];
                          return [formatNumber(value), name];
                        }}
                      />
                      <Legend />
                      <Bar dataKey="total_valor" name="Valor Total" fill="#16a34a" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoricoComprasPage;
