import { useEffect, useState } from 'react';
import api from '../services/api';
import { SolicitacaoCompra, StatusSolicitacao, PerfilEnum, ItemSolicitacao } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, ChevronDown, ChevronUp, X, Search } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string }> = {
  [StatusSolicitacao.NOVA]: { label: 'Nova', color: 'bg-blue-100 text-blue-700' },
  [StatusSolicitacao.EM_COTACAO]: { label: 'Em Cotação', color: 'bg-yellow-100 text-yellow-700' },
  [StatusSolicitacao.PEDIDO_FECHADO]: { label: 'Pedido Fechado', color: 'bg-orange-100 text-orange-700' },
  [StatusSolicitacao.EM_TRANSITO]: { label: 'Em Trânsito', color: 'bg-purple-100 text-purple-700' },
  [StatusSolicitacao.RECEBIDO]: { label: 'Recebido', color: 'bg-green-100 text-green-700' },
};

const statusOrder = [
  StatusSolicitacao.NOVA,
  StatusSolicitacao.EM_COTACAO,
  StatusSolicitacao.PEDIDO_FECHADO,
  StatusSolicitacao.EM_TRANSITO,
  StatusSolicitacao.RECEBIDO,
];

export default function SolicitacoesCompraPage() {
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form state
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState<ItemSolicitacao[]>([{ descricao: '', quantidade: '' }]);
  const [saving, setSaving] = useState(false);

  // Status update
  const [statusModal, setStatusModal] = useState<{ id: string; currentStatus: StatusSolicitacao } | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusObs, setStatusObs] = useState('');

  const canCreate = user?.perfil === PerfilEnum.RECEBIMENTO || user?.perfil === PerfilEnum.ADMIN;
  const canManageStatus = [PerfilEnum.COMPRADOR, PerfilEnum.DIRETORIA, PerfilEnum.ADMIN].includes(user?.perfil as PerfilEnum);

  useEffect(() => {
    fetchSolicitacoes();
  }, []);

  const fetchSolicitacoes = async () => {
    try {
      const response = await api.get<SolicitacaoCompra[]>('/solicitacoes-compra');
      setSolicitacoes(response.data);
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItens([...itens, { descricao: '', quantidade: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (itens.length > 1) {
      setItens(itens.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof ItemSolicitacao, value: string) => {
    const updated = [...itens];
    updated[index] = { ...updated[index], [field]: value };
    setItens(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItens = itens.filter(i => i.descricao.trim());
    if (!assunto.trim() || validItens.length === 0) return;

    setSaving(true);
    try {
      await api.post('/solicitacoes-compra', { assunto, descricao, itens: validItens });
      setAssunto('');
      setDescricao('');
      setItens([{ descricao: '', quantidade: '' }]);
      setShowForm(false);
      fetchSolicitacoes();
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusModal || !newStatus) return;
    try {
      await api.put(`/solicitacoes-compra/${statusModal.id}/status`, {
        status: newStatus,
        observacao: statusObs || undefined
      });
      setStatusModal(null);
      setNewStatus('');
      setStatusObs('');
      fetchSolicitacoes();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação?')) return;
    try {
      await api.delete(`/solicitacoes-compra/${id}`);
      fetchSolicitacoes();
    } catch (error) {
      console.error('Erro ao excluir solicitação:', error);
    }
  };

  const filtered = solicitacoes.filter(s => {
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      if (!s.assunto.toLowerCase().includes(lower) &&
          !s.solicitante_nome.toLowerCase().includes(lower) &&
          !s.itens.some(i => i.descricao.toLowerCase().includes(lower))) return false;
    }
    if (filterStatus && s.status_atual !== filterStatus) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-12">Carregando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Solicitações de Compra</h1>
        {canCreate && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cancelar' : 'Nova Solicitação'}
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Nova Solicitação</h2>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assunto *</label>
              <input
                type="text"
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Ex: Material de limpeza"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Observações</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Detalhes adicionais..."
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Itens Solicitados *</label>
              <button type="button" onClick={handleAddItem} className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
                <Plus size={14} /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={item.descricao}
                    onChange={e => handleItemChange(idx, 'descricao', e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="Descrição do item"
                  />
                  <input
                    type="text"
                    value={item.quantidade}
                    onChange={e => handleItemChange(idx, 'quantidade', e.target.value)}
                    className="w-32 border rounded px-3 py-2"
                    placeholder="Qtd"
                  />
                  {itens.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !assunto.trim() || !itens.some(i => i.descricao.trim())}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Enviar Solicitação'}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full border rounded pl-9 pr-3 py-2"
            placeholder="Buscar por assunto, solicitante ou item..."
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">Todos os Status</option>
          {statusOrder.map(s => (
            <option key={s} value={s}>{statusConfig[s].label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Nenhuma solicitação encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sol => {
            const isExpanded = expandedId === sol._id;
            const canDelete = user?.perfil === PerfilEnum.ADMIN ||
              (sol.solicitante_id === user?.id && sol.status_atual === StatusSolicitacao.NOVA);

            return (
              <div key={sol._id} className="bg-white rounded-lg shadow">
                {/* Header row */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : sol._id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{sol.assunto}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[sol.status_atual]?.color || 'bg-gray-100 text-gray-700'}`}>
                        {statusConfig[sol.status_atual]?.label || sol.status_atual}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      <span>{sol.solicitante_nome}</span>
                      <span className="mx-2">•</span>
                      <span>{new Date(sol.createdAt).toLocaleDateString('pt-BR')} {new Date(sol.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="mx-2">•</span>
                      <span>{sol.itens.length} {sol.itens.length === 1 ? 'item' : 'itens'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {canManageStatus && (
                      <button
                        onClick={e => { e.stopPropagation(); setStatusModal({ id: sol._id, currentStatus: sol.status_atual }); setNewStatus(''); setStatusObs(''); }}
                        className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded hover:bg-blue-100"
                      >
                        Atualizar Status
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(sol._id); }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {sol.descricao && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Descrição</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{sol.descricao}</p>
                      </div>
                    )}

                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Itens Solicitados</h4>
                      <div className="bg-gray-50 rounded p-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500">
                              <th className="pb-1">#</th>
                              <th className="pb-1">Descrição</th>
                              <th className="pb-1">Quantidade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sol.itens.map((item, idx) => (
                              <tr key={idx} className="border-t border-gray-200">
                                <td className="py-1 text-gray-400">{idx + 1}</td>
                                <td className="py-1">{item.descricao}</td>
                                <td className="py-1">{item.quantidade || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Histórico de Status</h4>
                      <div className="space-y-2">
                        {sol.historico_status.map((h, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-sm">
                            <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${statusConfig[h.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                                {statusConfig[h.status]?.label || h.status}
                              </span>
                              <span className="text-gray-500">
                                por {h.usuario_nome} em {new Date(h.data).toLocaleDateString('pt-BR')} {new Date(h.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {h.observacao && <p className="text-gray-600 mt-0.5 ml-0">{h.observacao}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Atualizar Status</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Novo Status</label>
              <select
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Selecione...</option>
                {statusOrder
                  .filter(s => s !== statusModal.currentStatus)
                  .map(s => (
                    <option key={s} value={s}>{statusConfig[s].label}</option>
                  ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observação (opcional)</label>
              <textarea
                value={statusObs}
                onChange={e => setStatusObs(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setStatusModal(null); setNewStatus(''); setStatusObs(''); }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={!newStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
