import { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, CheckCircle, XCircle, Phone, Mail } from 'lucide-react';
import api from '../services/api';
import { Fornecedor } from '../types';

const FornecedoresPage = () => {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [filteredFornecedores, setFilteredFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formData, setFormData] = useState<Partial<Fornecedor>>({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    email: '',
    telefone: '',
    endereco: {},
    contato: {},
    observacoes: '',
    ativo: true,
  });

  useEffect(() => {
    fetchFornecedores();
  }, []);

  useEffect(() => {
    filterFornecedores();
  }, [fornecedores, searchTerm, showOnlyActive]);

  const fetchFornecedores = async () => {
    try {
      setLoading(true);
      const response = await api.get('/fornecedores');
      setFornecedores(response.data);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
      alert('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const filterFornecedores = () => {
    let filtered = [...fornecedores];

    if (showOnlyActive) {
      filtered = filtered.filter((f) => f.ativo);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.razaoSocial.toLowerCase().includes(term) ||
          f.nomeFantasia?.toLowerCase().includes(term) ||
          f.cnpj.includes(term)
      );
    }

    setFilteredFornecedores(filtered);
  };

  const handleOpenModal = (fornecedor?: Fornecedor) => {
    if (fornecedor) {
      setEditingFornecedor(fornecedor);
      setFormData(fornecedor);
    } else {
      setEditingFornecedor(null);
      setFormData({
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        email: '',
        telefone: '',
        endereco: {},
        contato: {},
        observacoes: '',
        ativo: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingFornecedor(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.razaoSocial || !formData.cnpj) {
      alert('Razão Social e CNPJ são obrigatórios');
      return;
    }

    try {
      if (editingFornecedor) {
        await api.put(`/fornecedores/${editingFornecedor._id}`, formData);
        alert('Fornecedor atualizado com sucesso!');
      } else {
        await api.post('/fornecedores', formData);
        alert('Fornecedor cadastrado com sucesso!');
      }
      
      handleCloseModal();
      fetchFornecedores();
    } catch (error: any) {
      console.error('Erro ao salvar fornecedor:', error);
      alert(error.response?.data?.error || 'Erro ao salvar fornecedor');
    }
  };

  const handleToggleAtivo = async (fornecedor: Fornecedor) => {
    try {
      if (fornecedor.ativo) {
        await api.delete(`/fornecedores/${fornecedor._id}`);
        alert('Fornecedor inativado com sucesso!');
      } else {
        await api.post(`/fornecedores/${fornecedor._id}/ativar`);
        alert('Fornecedor ativado com sucesso!');
      }
      fetchFornecedores();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      alert('Erro ao alterar status do fornecedor');
    }
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando fornecedores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastro de Fornecedores</h1>
          <p className="text-gray-600 mt-1">Gerencie os fornecedores e vincule-os aos itens</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Fornecedor
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Fornecedor
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Razão social, nome fantasia ou CNPJ..."
                className="pl-10 w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyActive}
                onChange={(e) => setShowOnlyActive(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Mostrar apenas ativos</span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{filteredFornecedores.length}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Ativos</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredFornecedores.filter((f) => f.ativo).length}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Inativos</p>
            <p className="text-2xl font-bold text-red-600">
              {filteredFornecedores.filter((f) => !f.ativo).length}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Razão Social
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome Fantasia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CNPJ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFornecedores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Nenhum fornecedor encontrado</p>
                  </td>
                </tr>
              ) : (
                filteredFornecedores.map((fornecedor) => (
                  <tr key={fornecedor._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {fornecedor.razaoSocial}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {fornecedor.nomeFantasia || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {formatCNPJ(fornecedor.cnpj)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 space-y-1">
                        {fornecedor.telefone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {fornecedor.telefone}
                          </div>
                        )}
                        {fornecedor.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {fornecedor.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {fornecedor.ativo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800">
                          <XCircle className="w-3 h-3" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(fornecedor)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleAtivo(fornecedor)}
                          className={`${
                            fornecedor.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                          }`}
                          title={fornecedor.ativo ? 'Inativar' : 'Ativar'}
                        >
                          {fornecedor.ativo ? <Trash2 className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Dados Básicos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Razão Social *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.razaoSocial}
                      onChange={(e) => setFormData({ ...formData, razaoSocial: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={formData.nomeFantasia || ''}
                      onChange={(e) => setFormData({ ...formData, nomeFantasia: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CNPJ *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value.replace(/\D/g, '') })}
                      placeholder="00000000000000"
                      maxLength={14}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={formData.telefone || ''}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={3}
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingFornecedor ? 'Atualizar' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FornecedoresPage;
