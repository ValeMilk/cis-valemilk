import { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { PackageCheck, Search, Eye, Printer, Calendar, ChevronLeft, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import api from '../services/api';

interface ReposicaoResumo {
  _id: string;
  data_carregamento: string;
  carregado_por_nome: string;
  total_itens: number;
  precisam_repor: number;
  qtd_preenchida: number;
}

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

interface ReposicaoDetalhe {
  _id: string;
  data_carregamento: string;
  data_finalizacao?: string;
  status: string;
  carregado_por_nome: string;
  itens: ReposicaoItem[];
}

type SortField = 'codigo_item' | 'minimo' | 'dep_aberto' | 'producoes_aberto' | 'saldo_real' | 'reposicao' | 'giro_mensal' | 'quantidade';
type SortDir = 'none' | 'asc' | 'desc';

const CentralReposicaoPage = () => {
  const [reposicoes, setReposicoes] = useState<ReposicaoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<ReposicaoDetalhe | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [reposicaoFilter, setReposicaoFilter] = useState<'todos' | 'precisa_repor' | 'ok' | 'com_quantidade'>('todos');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('none');
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
      const response = await api.get('/reposicao/finalizados', { params });
      setReposicoes(response.data);
    } catch (error) {
      console.error('Erro ao buscar reposições:', error);
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
      const response = await api.get(`/reposicao/${id}`);
      setDetalhe(response.data);
    } catch (error) {
      console.error('Erro ao buscar detalhe:', error);
      alert('Erro ao carregar reposição');
    } finally {
      setLoading(false);
    }
  };

  const voltarLista = () => {
    setDetalhe(null);
    setSearchTerm('');
    setTipoFilter('');
    setReposicaoFilter('todos');
    setSortField(null);
    setSortDir('none');
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: detalhe ? `Reposicao_${formatDateShort(detalhe.data_carregamento)}` : 'Reposicao',
  });

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    if (!detalhe) return [];
    let items = [...detalhe.itens];

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
    } else if (reposicaoFilter === 'com_quantidade') {
      items = items.filter(i => i.quantidade !== null && i.quantidade !== undefined);
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

  // ==== LISTA DE REPOSIÇÕES ====
  if (!detalhe) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <PackageCheck className="text-blue-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-800">Central de Reposição</h1>
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
                {[...new Set(reposicoes.map(r => r.carregado_por_nome))].sort().map(nome => (
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
        ) : reposicoes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <PackageCheck size={48} className="mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Nenhuma reposição finalizada</h2>
            <p className="text-gray-500">Reposições finalizadas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsável</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Itens</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Precisam Repor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qtd Preenchida</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reposicoes.filter(rep => !responsavelFilter || rep.carregado_por_nome === responsavelFilter).map((rep) => (
                  <tr key={rep._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDate(rep.data_carregamento)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{rep.carregado_por_nome}</td>
                    <td className="px-4 py-3 text-sm text-center font-medium">{rep.total_itens}</td>
                    <td className="px-4 py-3 text-sm text-center text-red-600 font-medium">{rep.precisam_repor}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        rep.qtd_preenchida === rep.total_itens ? 'bg-green-100 text-green-700' :
                        rep.qtd_preenchida > 0 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {rep.qtd_preenchida}/{rep.total_itens}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => abrirDetalhe(rep._id)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        <Eye size={14} />
                        <span>Ver Relatório</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ==== DETALHE DA REPOSIÇÃO (Relatório) ====
  const filteredItems = getFilteredItems();
  const tipos = [...new Set(detalhe.itens.map(i => i.tipo))].sort();
  const precisamRepor = filteredItems.filter(i => i.reposicao > 0).length;
  const preenchidos = filteredItems.filter(i => i.quantidade !== null && i.quantidade !== undefined).length;

  return (
    <div className="space-y-4">
      {/* Header do detalhe */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button onClick={voltarLista} className="p-2 hover:bg-gray-200 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <PackageCheck className="text-blue-600" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Relatório de Reposição</h1>
            <p className="text-sm text-gray-500">
              {formatDate(detalhe.data_carregamento)} • Por: {detalhe.carregado_por_nome}
            </p>
          </div>
        </div>
        <button
          onClick={() => handlePrint()}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Printer size={18} />
          <span>Exportar PDF</span>
        </button>
      </div>

      {/* Filtros do detalhe */}
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
            <option value="com_quantidade">Com Quantidade</option>
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
          <p className="text-sm text-gray-500">Precisam Repor</p>
          <p className="text-2xl font-bold text-red-600">{precisamRepor}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Estoque OK</p>
          <p className="text-2xl font-bold text-green-600">{filteredItems.length - precisamRepor}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <p className="text-sm text-gray-500">Qtd Preenchida</p>
          <p className="text-2xl font-bold text-purple-600">{preenchidos}/{filteredItems.length}</p>
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
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => toggleSort('quantidade')}>
                Quantidade <SortIcon field="quantidade" />
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
                  <td className="px-3 py-2 text-sm text-right font-bold">
                    {item.quantidade !== null && item.quantidade !== undefined
                      ? formatNumber(item.quantidade)
                      : <span className="text-gray-300">-</span>
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 flex justify-between">
          <span>Exibindo {filteredItems.length} de {detalhe.itens.length} itens</span>
          <span>{preenchidos} com quantidade</span>
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
                <p className="text-sm text-gray-600">Relatório de Reposição</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-800">Reposição de Estoque</div>
                <div className="text-sm text-gray-600 mt-1">
                  Atualização ERP: {formatDate(detalhe.data_carregamento)}
                </div>
                <div className="text-sm text-gray-600">
                  Responsável: {detalhe.carregado_por_nome}
                </div>
                {detalhe.data_finalizacao && (
                  <div className="text-sm text-gray-600">
                    Finalizado em: {formatDate(detalhe.data_finalizacao)}
                  </div>
                )}
                {(tipoFilter || reposicaoFilter !== 'todos') && (
                  <div className="text-sm text-blue-700 font-semibold mt-1">
                    {tipoFilter && `Tipo: ${tipoFilter}`}
                    {tipoFilter && reposicaoFilter !== 'todos' && ' | '}
                    {reposicaoFilter === 'precisa_repor' && 'Filtro: Precisa Repor'}
                    {reposicaoFilter === 'ok' && 'Filtro: Estoque OK'}
                    {reposicaoFilter === 'com_quantidade' && 'Filtro: Com Quantidade'}
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
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Resumo</h3>
              <div className="bg-gray-50 p-4 rounded text-sm">
                <p>Total de Itens: <strong>{filteredItems.length}</strong></p>
                <p>Precisam Repor: <strong className="text-red-600">{precisamRepor}</strong></p>
                <p>Estoque OK: <strong className="text-green-600">{filteredItems.length - precisamRepor}</strong></p>
                <p>Qtd Preenchida: <strong>{preenchidos}/{filteredItems.length}</strong></p>
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
    </div>
  );
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
}

export default CentralReposicaoPage;
