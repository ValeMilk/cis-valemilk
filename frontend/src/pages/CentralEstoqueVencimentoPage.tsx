import { useState, useEffect, useRef } from 'react';
import { Search, Eye, ArrowLeft, Trash2, CheckCircle, MessageSquare, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../contexts/AuthContext';
import { PerfilEnum } from '../types';
import api from '../services/api';

interface ResumoReport {
  _id: string;
  data_snapshot: string;
  criado_por_nome: string;
  total_itens: number;
  itens_com_entrada: number;
  itens_ruptura: number;
  total_entradas: number;
  visto_por_nome?: string;
  visto_data?: string;
  resolvido_por_nome?: string;
  resolvido_data?: string;
  resolvido_observacao?: string;
}

interface EntradaVencimento {
  quantidade: number;
  data_validade: string;
  registro_data: string;
  registro_usuario: string;
}

interface ItemDetail {
  codigo_item: string;
  descricao: string;
  unidade_medida: string;
  tipo_volume: string;
  unidades_por_volume: number;
  entradas: EntradaVencimento[];
}

interface ReportDetail {
  _id: string;
  data_snapshot: string;
  status: string;
  criado_por_nome: string;
  data_finalizacao?: string;
  itens: ItemDetail[];
  visto_por_nome?: string;
  visto_data?: string;
  resolvido_por_nome?: string;
  resolvido_data?: string;
  resolvido_observacao?: string;
}

const CentralEstoqueVencimentoPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<ResumoReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');

  // Detail view
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showResolvidoModal, setShowResolvidoModal] = useState(false);
  const [resolvidoObs, setResolvidoObs] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    fetchReports();
  }, [dataInicio, dataFim]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;
      const res = await api.get('/estoque-vencimento/finalizados', { params });
      setReports(res.data);
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/estoque-vencimento/${id}`);
      setSelectedReport(res.data);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVisto = async () => {
    if (!selectedReport) return;
    try {
      await api.put(`/estoque-vencimento/${selectedReport._id}/visto`);
      await openDetail(selectedReport._id);
      fetchReports();
    } catch (error) {
      console.error('Erro ao marcar visto:', error);
    }
  };

  const handleResolvido = async () => {
    if (!selectedReport) return;
    try {
      await api.put(`/estoque-vencimento/${selectedReport._id}/resolvido`, { observacao: resolvidoObs });
      setShowResolvidoModal(false);
      setResolvidoObs('');
      await openDetail(selectedReport._id);
      fetchReports();
    } catch (error) {
      console.error('Erro ao marcar resolvido:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/estoque-vencimento/${id}/admin`);
      setDeleteConfirm(null);
      if (selectedReport?._id === id) setSelectedReport(null);
      fetchReports();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir relatório');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  const canTakeAction = user?.perfil === PerfilEnum.DIRETORIA || user?.perfil === PerfilEnum.COMPRADOR || user?.perfil === PerfilEnum.ADMIN;
  const isAdmin = user?.perfil === PerfilEnum.ADMIN;

  const filteredReports = reports.filter(r =>
    !filtroResponsavel || r.criado_por_nome.toLowerCase().includes(filtroResponsavel.toLowerCase())
  );

  const getItemStatus = (item: ItemDetail): 'ruptura' | 'contado' | 'pendente' => {
    if (item.entradas.length === 0) return 'pendente';
    const totalQtd = item.entradas.reduce((sum, e) => sum + e.quantidade, 0);
    if (totalQtd === 0) return 'ruptura';
    return 'contado';
  };

  // Detail filtered items
  const detailFilteredItems = selectedReport?.itens.filter(item => {
    const matchesSearch = !searchTerm ||
      item.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.codigo_item.toLowerCase().includes(searchTerm.toLowerCase());

    const status = getItemStatus(item);
    const matchesFilter = !filterStatus || filterStatus === status;

    return matchesSearch && matchesFilter;
  }) || [];

  // DETAIL VIEW
  if (selectedReport) {
    const stats = {
      total: selectedReport.itens.length,
      contados: selectedReport.itens.filter(i => getItemStatus(i) === 'contado').length,
      ruptura: selectedReport.itens.filter(i => getItemStatus(i) === 'ruptura').length,
      pendentes: selectedReport.itens.filter(i => getItemStatus(i) === 'pendente').length,
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2">
              <ArrowLeft className="w-4 h-4" /> Voltar à lista
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Relatório - Estoque e Vencimento</h1>
            <p className="text-gray-600 mt-1">
              Responsável: <span className="font-medium">{selectedReport.criado_por_nome}</span> | 
              Data: {formatDateTime(selectedReport.data_snapshot)}
              {selectedReport.data_finalizacao && ` | Finalizado: ${formatDateTime(selectedReport.data_finalizacao)}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handlePrint()} className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              <Printer className="w-4 h-4" /> PDF
            </button>
            {canTakeAction && !selectedReport.visto_por_nome && (
              <button onClick={handleVisto} className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <CheckCircle className="w-4 h-4" /> Marcar Visto
              </button>
            )}
            {canTakeAction && selectedReport.visto_por_nome && !selectedReport.resolvido_por_nome && (
              <button onClick={() => setShowResolvidoModal(true)} className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                <MessageSquare className="w-4 h-4" /> Marcar Resolvido
              </button>
            )}
          </div>
        </div>

        {/* Workflow Status */}
        {(selectedReport.visto_por_nome || selectedReport.resolvido_por_nome) && (
          <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-6 text-sm">
            {selectedReport.visto_por_nome && (
              <div>
                <span className="text-gray-500">Visto por:</span>{' '}
                <span className="font-medium">{selectedReport.visto_por_nome}</span>{' '}
                <span className="text-gray-400">em {formatDateTime(selectedReport.visto_data || '')}</span>
              </div>
            )}
            {selectedReport.resolvido_por_nome && (
              <div>
                <span className="text-gray-500">Resolvido por:</span>{' '}
                <span className="font-medium">{selectedReport.resolvido_por_nome}</span>{' '}
                <span className="text-gray-400">em {formatDateTime(selectedReport.resolvido_data || '')}</span>
                {selectedReport.resolvido_observacao && (
                  <p className="text-gray-600 mt-1 italic">"{selectedReport.resolvido_observacao}"</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats + Filters */}
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
                  className="pl-10 w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-4 py-2">
              <option value="">Todos</option>
              <option value="contado">Contados</option>
              <option value="ruptura">Ruptura</option>
              <option value="pendente">Pendentes</option>
            </select>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Código</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Descrição</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Qtd Total</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Validades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {detailFilteredItems.map(item => {
                const status = getItemStatus(item);
                const totalQtd = item.entradas.reduce((sum, e) => sum + e.quantidade, 0);
                return (
                  <tr key={item.codigo_item} className={status === 'ruptura' ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 font-mono text-gray-500">{item.codigo_item}</td>
                    <td className="px-4 py-3">{item.descricao}</td>
                    <td className="px-4 py-3 text-center font-medium">{totalQtd} {item.unidade_medida}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        status === 'ruptura' ? 'bg-red-100 text-red-700' :
                        status === 'contado' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {status === 'ruptura' ? 'RUPTURA' : status === 'contado' ? 'OK' : 'PENDENTE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {item.entradas.map((e, i) => (
                        <span key={i}>
                          {e.quantidade} un - {formatDate(e.data_validade)}
                          {i < item.entradas.length - 1 ? ' | ' : ''}
                        </span>
                      ))}
                      {item.entradas.length === 0 && '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Print */}
        <div style={{ display: 'none' }}>
          <div ref={printRef} style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>VALE MILK - Estoque e Vencimento</h1>
              <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
                Responsável: {selectedReport.criado_por_nome} | Data: {formatDateTime(selectedReport.data_snapshot)}
                {selectedReport.data_finalizacao && ` | Finalizado: ${formatDateTime(selectedReport.data_finalizacao)}`}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '12px' }}>
              <span><strong>Total Produtos:</strong> {stats.total}</span>
              <span><strong>Contados:</strong> {stats.contados}</span>
              <span style={{ color: '#dc2626' }}><strong>Ruptura:</strong> {stats.ruptura}</span>
              <span><strong>Pendentes:</strong> {stats.pendentes}</span>
            </div>

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
                {selectedReport.itens.filter(i => i.entradas.length > 0 || getItemStatus(i) === 'ruptura').map(item => {
                  const status = getItemStatus(item);
                  const totalQtd = item.entradas.reduce((sum, e) => sum + e.quantidade, 0);
                  return (
                    <tr key={item.codigo_item}>
                      <td style={{ border: '1px solid #d1d5db', padding: '4px', fontFamily: 'monospace' }}>{item.codigo_item}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '4px' }}>{item.descricao}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'center' }}>{totalQtd} {item.unidade_medida}</td>
                      <td style={{ border: '1px solid #d1d5db', padding: '4px', textAlign: 'center', color: status === 'ruptura' ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                        {status === 'ruptura' ? 'RUPTURA' : 'OK'}
                      </td>
                      <td style={{ border: '1px solid #d1d5db', padding: '4px' }}>
                        {item.entradas.map((e, i) => (
                          <span key={i}>{e.quantidade} un - {formatDate(e.data_validade)}{i < item.entradas.length - 1 ? ' | ' : ''}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {selectedReport.visto_por_nome && (
              <p style={{ fontSize: '10px', marginTop: '15px' }}>
                <strong>Visto por:</strong> {selectedReport.visto_por_nome} em {formatDateTime(selectedReport.visto_data || '')}
              </p>
            )}
            {selectedReport.resolvido_por_nome && (
              <p style={{ fontSize: '10px' }}>
                <strong>Resolvido por:</strong> {selectedReport.resolvido_por_nome} em {formatDateTime(selectedReport.resolvido_data || '')}
                {selectedReport.resolvido_observacao && ` — "${selectedReport.resolvido_observacao}"`}
              </p>
            )}

            <div style={{ marginTop: '30px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
              Gerado em {new Date().toLocaleString('pt-BR')} — Sistema CIS Vale Milk
            </div>
          </div>
        </div>

        {/* Resolvido Modal */}
        {showResolvidoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-4">Marcar como Resolvido</h3>
              <textarea
                value={resolvidoObs}
                onChange={(e) => setResolvidoObs(e.target.value)}
                placeholder="Observação (opcional)..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => { setShowResolvidoModal(false); setResolvidoObs(''); }} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleResolvido} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Central - Estoque e Vencimento</h1>
        <p className="text-gray-600 mt-1">Relatórios finalizados de contagem de estoque e validade</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Início</label>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Fim</label>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
            <input
              type="text"
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              placeholder="Filtrar responsável..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum relatório finalizado encontrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Data</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Responsável</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Produtos</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Contados</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Ruptura</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReports.map(r => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{formatDateTime(r.data_snapshot)}</td>
                  <td className="px-4 py-3">{r.criado_por_nome}</td>
                  <td className="px-4 py-3 text-center">{r.total_itens}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-medium">{r.itens_com_entrada}</td>
                  <td className="px-4 py-3 text-center">
                    {r.itens_ruptura > 0 ? (
                      <span className="text-red-600 font-medium">{r.itens_ruptura}</span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.resolvido_por_nome ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Resolvido</span>
                    ) : r.visto_por_nome ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">Visto</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openDetail(r._id)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        <Eye className="w-4 h-4" /> Ver
                      </button>
                      {isAdmin && (
                        deleteConfirm === r._id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(r._id)} className="text-xs text-red-600 font-medium hover:underline">Confirmar</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 hover:underline">Cancelar</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(r._id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CentralEstoqueVencimentoPage;
