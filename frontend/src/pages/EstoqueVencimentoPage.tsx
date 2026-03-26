import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, RefreshCw, Trash2, Plus, Calendar, PackageX, Printer, X } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';

interface EntradaVencimento {
  quantidade: number;
  data_validade: string;
  registro_data: string;
  registro_usuario: string;
}

interface ItemEstoqueVencimento {
  codigo_item: string;
  descricao: string;
  unidade_medida: string;
  tipo_volume: string;
  unidades_por_volume: number;
  entradas: EntradaVencimento[];
}

interface Report {
  _id: string;
  data_snapshot: string;
  status: string;
  criado_por_nome: string;
  itens: ItemEstoqueVencimento[];
}

const EstoqueVencimentoPage = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  // Estado para controlar qual item está com o formulário de entrada aberto
  const [addingEntryFor, setAddingEntryFor] = useState<string | null>(null);
  const [newQuantidade, setNewQuantidade] = useState<string>('');
  const [newValidade, setNewValidade] = useState<string>('');

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    fetchActive();
  }, []);

  const fetchActive = async () => {
    try {
      setLoading(true);
      const res = await api.get('/estoque-vencimento/active');
      setReport(res.data);
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncERP = async () => {
    try {
      setSyncing(true);
      const res = await api.post('/estoque-vencimento/sync-erp');
      setReport(res.data);
    } catch (error) {
      console.error('Erro ao sincronizar ERP:', error);
      alert('Erro ao carregar produtos do ERP');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddEntry = async (codigoItem: string) => {
    if (!report || !newQuantidade || !newValidade) {
      alert('Preencha quantidade e data de validade');
      return;
    }

    try {
      await api.post(`/estoque-vencimento/${report._id}/item/${codigoItem}/entrada`, {
        quantidade: Number(newQuantidade),
        data_validade: newValidade
      });

      // Recarregar
      const res = await api.get('/estoque-vencimento/active');
      setReport(res.data);
      setAddingEntryFor(null);
      setNewQuantidade('');
      setNewValidade('');
    } catch (error) {
      console.error('Erro ao adicionar entrada:', error);
      alert('Erro ao adicionar entrada');
    }
  };

  const handleRemoveEntry = async (codigoItem: string, entradaIndex: number) => {
    if (!report) return;
    if (!window.confirm('Remover esta entrada?')) return;

    try {
      await api.delete(`/estoque-vencimento/${report._id}/item/${codigoItem}/entrada/${entradaIndex}`);
      const res = await api.get('/estoque-vencimento/active');
      setReport(res.data);
    } catch (error) {
      console.error('Erro ao remover entrada:', error);
      alert('Erro ao remover entrada');
    }
  };

  const handleFinalizar = async () => {
    if (!report) return;
    if (!window.confirm('Finalizar o relatório de Estoque e Vencimento? Após finalizar não será possível editar.')) return;

    try {
      await api.put(`/estoque-vencimento/${report._id}/finalizar`);
      alert('Relatório finalizado com sucesso!');
      setReport(null);
    } catch (error) {
      console.error('Erro ao finalizar:', error);
      alert('Erro ao finalizar relatório');
    }
  };

  const handleDescartar = async () => {
    if (!report) return;
    if (!window.confirm('Descartar o relatório em andamento? Todas as contagens serão perdidas.')) return;

    try {
      await api.delete(`/estoque-vencimento/${report._id}`);
      setReport(null);
    } catch (error) {
      console.error('Erro ao descartar:', error);
    }
  };

  const getStatus = useCallback((item: ItemEstoqueVencimento): 'ruptura' | 'contado' | 'pendente' => {
    if (item.entradas.length === 0) return 'pendente';
    const totalQtd = item.entradas.reduce((sum, e) => sum + e.quantidade, 0);
    if (totalQtd === 0) return 'ruptura';
    return 'contado';
  }, []);

  const filteredItems = report?.itens.filter(item => {
    const matchesSearch = !searchTerm ||
      item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo_item.toLowerCase().includes(searchTerm.toLowerCase());

    const status = getStatus(item);
    const matchesFilter = !filterStatus || filterStatus === status;

    return matchesSearch && matchesFilter;
  }) || [];

  const stats = report ? {
    total: report.itens.length,
    contados: report.itens.filter(i => getStatus(i) === 'contado').length,
    ruptura: report.itens.filter(i => getStatus(i) === 'ruptura').length,
    pendentes: report.itens.filter(i => getStatus(i) === 'pendente').length,
  } : null;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Tela inicial sem relatório
  if (!report) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque e Vencimento</h1>
          <p className="text-gray-600 mt-1">Contagem de produtos acabados com data de validade</p>
        </div>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <PackageX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-700 mb-2">Nenhum relatório em andamento</h2>
          <p className="text-gray-500 mb-6">Clique no botão abaixo para carregar os produtos acabados do ERP e iniciar a contagem.</p>
          <button
            onClick={handleSyncERP}
            disabled={syncing}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Carregando...' : 'Carregar Produtos do ERP'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque e Vencimento</h1>
          <p className="text-gray-600 mt-1">
            Responsável: <span className="font-medium">{report.criado_por_nome}</span> | 
            Iniciado em: {formatDateTime(report.data_snapshot)}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSyncERP} disabled={syncing} className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Atualizar ERP
          </button>
          <button onClick={() => handlePrint()} className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Printer className="w-4 h-4" />
            PDF
          </button>
          <button onClick={handleDescartar} className="flex items-center gap-1 px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
            Descartar
          </button>
          <button onClick={handleFinalizar} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
            Finalizar
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Total Produtos</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Contados</p>
            <p className="text-2xl font-bold text-green-600">{stats.contados}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Ruptura</p>
            <p className="text-2xl font-bold text-red-600">{stats.ruptura}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-sm text-gray-600">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código ou descrição..."
                className="pl-10 w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2"
          >
            <option value="">Todos os Status</option>
            <option value="contado">Contados</option>
            <option value="ruptura">Ruptura</option>
            <option value="pendente">Pendentes</option>
          </select>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.map(item => {
          const status = getStatus(item);
          const totalQtd = item.entradas.reduce((sum, e) => sum + e.quantidade, 0);
          const isAddingEntry = addingEntryFor === item.codigo_item;

          return (
            <div key={item.codigo_item} className={`bg-white rounded-lg shadow overflow-hidden border-l-4 ${
              status === 'ruptura' ? 'border-l-red-500' :
              status === 'contado' ? 'border-l-green-500' :
              'border-l-gray-300'
            }`}>
              {/* Item Header */}
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-500">{item.codigo_item}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        status === 'ruptura' ? 'bg-red-100 text-red-700' :
                        status === 'contado' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {status === 'ruptura' ? 'RUPTURA' : status === 'contado' ? 'CONTADO' : 'PENDENTE'}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1">{item.descricao}</h3>
                    <p className="text-xs text-gray-500">
                      {item.unidade_medida}
                      {item.tipo_volume ? ` | ${item.tipo_volume} (${item.unidades_por_volume} un/vol)` : ''}
                      {item.entradas.length > 0 && ` | Total: ${totalQtd} ${item.unidade_medida}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAddingEntryFor(isAddingEntry ? null : item.codigo_item);
                      setNewQuantidade('');
                      setNewValidade('');
                    }}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                  >
                    {isAddingEntry ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isAddingEntry ? 'Cancelar' : 'Adicionar'}
                  </button>
                </div>

                {/* Add Entry Form */}
                {isAddingEntry && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade</label>
                        <input
                          type="number"
                          min="0"
                          value={newQuantidade}
                          onChange={(e) => setNewQuantidade(e.target.value)}
                          placeholder="0"
                          className="w-32 border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Data de Validade</label>
                        <input
                          type="date"
                          value={newValidade}
                          onChange={(e) => setNewValidade(e.target.value)}
                          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <button
                        onClick={() => handleAddEntry(item.codigo_item)}
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {/* Entries Table */}
                {item.entradas.length > 0 && (
                  <div className="mt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b">
                          <th className="pb-1 pr-4">Quantidade</th>
                          <th className="pb-1 pr-4">Data de Validade</th>
                          <th className="pb-1 pr-4">Registrado em</th>
                          <th className="pb-1 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.entradas.map((entrada, idx) => {
                          const valDate = new Date(entrada.data_validade);
                          const hoje = new Date();
                          hoje.setHours(0, 0, 0, 0);
                          const vencido = valDate < hoje;
                          const perto = !vencido && (valDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24) <= 30;

                          return (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="py-1.5 pr-4 font-medium">
                                {entrada.quantidade} {item.unidade_medida}
                              </td>
                              <td className={`py-1.5 pr-4 flex items-center gap-1 ${
                                vencido ? 'text-red-600 font-medium' :
                                perto ? 'text-orange-600' : 'text-gray-700'
                              }`}>
                                <Calendar className="w-3 h-3" />
                                {formatDate(entrada.data_validade)}
                                {vencido && <span className="text-xs bg-red-100 text-red-700 px-1 rounded">VENCIDO</span>}
                                {perto && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded">PRÓXIMO</span>}
                              </td>
                              <td className="py-1.5 pr-4 text-gray-500 text-xs">
                                {formatDateTime(entrada.registro_data)}
                              </td>
                              <td className="py-1.5">
                                <button
                                  onClick={() => handleRemoveEntry(item.codigo_item, idx)}
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Nenhum produto encontrado
          </div>
        )}
      </div>

      {/* Print View (hidden) */}
      <div style={{ display: 'none' }}>
        <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>VALE MILK - Estoque e Vencimento</h1>
            <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
              Responsável: {report.criado_por_nome} | Data: {formatDateTime(report.data_snapshot)}
            </p>
          </div>

          {/* Resumo */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '12px' }}>
            <span><strong>Total Produtos:</strong> {stats?.total}</span>
            <span><strong>Contados:</strong> {stats?.contados}</span>
            <span style={{ color: '#dc2626' }}><strong>Ruptura:</strong> {stats?.ruptura}</span>
            <span><strong>Pendentes:</strong> {stats?.pendentes}</span>
          </div>

          {/* Tabela */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'left' }}>Código</th>
                <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'left' }}>Descrição</th>
                <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'center' }}>Qtd Total</th>
                <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'center' }}>Status</th>
                <th style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'left' }}>Validades</th>
              </tr>
            </thead>
            <tbody>
              {report.itens.filter(i => i.entradas.length > 0 || getStatus(i) === 'ruptura').map(item => {
                const status = getStatus(item);
                const totalQtd = item.entradas.reduce((sum, e) => sum + e.quantidade, 0);
                return (
                  <tr key={item.codigo_item}>
                    <td style={{ border: '1px solid #d1d5db', padding: '4px', fontFamily: 'monospace' }}>{item.codigo_item}</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '4px' }}>{item.descricao}</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'center' }}>
                      {totalQtd} {item.unidade_medida}
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'center', color: status === 'ruptura' ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                      {status === 'ruptura' ? 'RUPTURA' : 'OK'}
                    </td>
                    <td style={{ border: '1px solid #d1d5db', padding: '4px' }}>
                      {item.entradas.map((e, i) => (
                        <span key={i}>
                          {e.quantidade} un - {formatDate(e.data_validade)}
                          {i < item.entradas.length - 1 ? ' | ' : ''}
                        </span>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '30px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
            Gerado em {new Date().toLocaleString('pt-BR')} — Sistema CIS Vale Milk
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstoqueVencimentoPage;
