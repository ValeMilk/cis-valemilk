import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Edit2, Save, X, Trash2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import { Pedido, Fornecedor, StatusPedido, PerfilEnum } from '../types';
import { useAuth } from '../contexts/AuthContext';
import PedidoPrintView from '../components/PedidoPrintView';
import StatusStepper from '../components/StatusStepper';

const PedidoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  // Estados para modal de data de entrega
  const [showDateModal, setShowDateModal] = useState(false);
  const [dataEntregaPrevista, setDataEntregaPrevista] = useState('');
  
  // Estados para edição
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [localEntrega, setLocalEntrega] = useState<'Matriz' | 'Filial'>('Matriz');
  const [observacoes, setObservacoes] = useState('');
  const [itensEditaveis, setItensEditaveis] = useState<any[]>([]);

  const locaisEntrega = {
    Matriz: {
      endereco: 'AV. JUSCELINO KUBITSCHEK, S/N - OMBREIRA, PENTECOSTE - CEARÁ',
      linkMaps: 'https://share.google/fmCACVXDiH1pxZFoz'
    },
    Filial: {
      endereco: 'R. Euríco Medina, 410 - Henrique Jorge, Fortaleza - CE, 60526-165',
      linkMaps: 'https://share.google/CQeSVcYZh1JGMkbSJ'
    }
  };

  useEffect(() => {
    fetchPedido();
    fetchFornecedores();
  }, [id]);

  useEffect(() => {
    if (pedido && editMode) {
      // Inicializar estados de edição com valores do pedido
      setObservacoes(pedido.observacoes || '');
      setLocalEntrega(pedido.local_entrega.tipo);
      setItensEditaveis(JSON.parse(JSON.stringify(pedido.itens)));
    }
  }, [editMode, pedido]);

  const fetchFornecedores = async () => {
    try {
      const mongoResponse = await api.get('/fornecedores?ativo=true');
      const mongoFornecedores = mongoResponse.data;
      
      const itemsResponse = await api.get('/items');
      const erpItems = itemsResponse.data;
      
      const erpFornecedoresSet = new Set<string>();
      erpItems.forEach((item: any) => {
        if (item.fornecedor && item.fornecedor.trim()) {
          erpFornecedoresSet.add(item.fornecedor.trim());
        }
      });

      const erpFornecedores = Array.from(erpFornecedoresSet).map(nome => ({
        _id: `erp-${nome}`,
        nomeFantasia: nome,
        razaoSocial: nome,
        isFromERP: true
      }));

      const todosFornecedores = [...mongoFornecedores, ...erpFornecedores]
        .sort((a, b) => {
          const nomeA = a.nomeFantasia || a.razaoSocial || '';
          const nomeB = b.nomeFantasia || b.razaoSocial || '';
          return nomeA.localeCompare(nomeB);
        });

      setFornecedores(todosFornecedores);
    } catch (error) {
      console.error('Erro ao buscar fornecedores:', error);
    }
  };

  const fetchPedido = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/pedidos/${id}`);
      setPedido(response.data);
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      alert('Erro ao carregar pedido');
      navigate('/pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: pedido ? `Pedido_${pedido.idCompra}` : 'Pedido',
  });

  const canEdit = () => {
    if (!pedido || !user) return false;
    
    // Apenas Comprador, Diretoria ou Admin podem editar
    const canEditByRole = user.perfil === PerfilEnum.COMPRADOR || 
                         user.perfil === PerfilEnum.DIRETORIA || 
                         user.perfil === PerfilEnum.ADMIN;
    
    // Apenas status ENVIADO_FORNECEDOR pode ser editado
    const canEditByStatus = pedido.status_atual === StatusPedido.ENVIADO_FORNECEDOR;
    
    return canEditByRole && canEditByStatus;
  };

  const handleEnableEdit = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!fornecedorId && !pedido) {
      alert('Selecione um fornecedor');
      return;
    }

    try {
      setSaving(true);
      
      const fornecedorSelecionado = fornecedores.find(f => f._id === fornecedorId);
      const fornecedorNome = fornecedorSelecionado?.nomeFantasia || fornecedorSelecionado?.razaoSocial || pedido!.fornecedor;
      
      const localEntregaData = locaisEntrega[localEntrega];

      const pedidoData = {
        fornecedor: fornecedorNome,
        local_entrega: {
          tipo: localEntrega,
          endereco: localEntregaData.endereco,
          linkMaps: localEntregaData.linkMaps
        },
        observacoes: observacoes.trim(),
        itens: itensEditaveis,
        valor_total: 0
      };

      await api.put(`/pedidos/${id}`, pedidoData);
      alert('Pedido atualizado com sucesso!');
      setEditMode(false);
      fetchPedido(); // Recarregar dados
    } catch (error: any) {
      console.error('Erro ao atualizar pedido:', error);
      alert(error.response?.data?.message || 'Erro ao atualizar pedido');
    } finally {
      setSaving(false);
    }
  };

  const updateQuantidadeItem = (index: number, quantidade: number) => {
    const newItens = [...itensEditaveis];
    newItens[index].quantidade_solicitada = Math.max(1, quantidade);
    setItensEditaveis(newItens);
  };

  const removeItem = (index: number) => {
    setItensEditaveis(itensEditaveis.filter((_, i) => i !== index));
  };

  const handleAvancarStatus = async () => {
    if (!pedido) return;

    // Se está em AGUARDANDO_FATURAMENTO, precisa capturar a data de entrega
    if (pedido.status_atual === StatusPedido.AGUARDANDO_FATURAMENTO) {
      setShowDateModal(true);
      return;
    }

    // Mapeamento de status atual para próxima ação
    const statusActions: Record<StatusPedido, { endpoint: string; message: string }> = {
      [StatusPedido.RASCUNHO]: { endpoint: '', message: '' },
      [StatusPedido.ANALISE_COTACAO]: { 
        endpoint: 'enviar-fornecedor', 
        message: 'Pedido enviado ao fornecedor!' 
      },
      [StatusPedido.ENVIADO_FORNECEDOR]: { 
        endpoint: 'aguardando-faturamento', 
        message: 'Status atualizado para Aguardando Faturamento!' 
      },
      [StatusPedido.AGUARDANDO_FATURAMENTO]: { 
        endpoint: 'em-rota', 
        message: 'Status atualizado para Em Rota!' 
      },
      [StatusPedido.EM_ROTA]: { 
        endpoint: 'recebimento-nota', 
        message: 'Recebimento de nota registrado!' 
      },
      [StatusPedido.RECEBIMENTO_NOTA]: { 
        endpoint: 'aprovar-diretoria', 
        message: 'Pedido aprovado pela diretoria!' 
      },
      [StatusPedido.APROVADO_DIRETORIA]: { endpoint: '', message: '' },
      [StatusPedido.CANCELADO]: { endpoint: '', message: '' }
    };

    const action = statusActions[pedido.status_atual];
    if (!action.endpoint) return;

    try {
      await api.post(`/pedidos/${id}/${action.endpoint}`);
      alert(action.message);
      fetchPedido();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      alert(error.response?.data?.message || 'Erro ao atualizar status');
    }
  };

  const handleConfirmarDataEntrega = async () => {
    if (!dataEntregaPrevista) {
      alert('Por favor, informe a data de entrega prevista');
      return;
    }

    try {
      await api.post(`/pedidos/${id}/em-rota`, {
        data_prevista_entrega: dataEntregaPrevista
      });
      alert('Status atualizado para Em Rota!');
      setShowDateModal(false);
      setDataEntregaPrevista('');
      fetchPedido();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      alert(error.response?.data?.message || 'Erro ao atualizar status');
    }
  };

  const canAdvanceStatus = () => {
    if (!pedido || !user) return false;
    
    // Não pode avançar se já está aprovado ou cancelado
    if (pedido.status_atual === StatusPedido.APROVADO_DIRETORIA || 
        pedido.status_atual === StatusPedido.CANCELADO ||
        pedido.status_atual === StatusPedido.RASCUNHO) {
      return false;
    }

    // Apenas Admin, Comprador e Diretoria podem avançar status
    return user.perfil === PerfilEnum.COMPRADOR || 
           user.perfil === PerfilEnum.DIRETORIA || 
           user.perfil === PerfilEnum.ADMIN;
  };

  const getNextStatusLabel = () => {
    if (!pedido) return '';
    
    const labels: Record<StatusPedido, string> = {
      [StatusPedido.RASCUNHO]: '',
      [StatusPedido.ANALISE_COTACAO]: 'Enviar ao Fornecedor',
      [StatusPedido.ENVIADO_FORNECEDOR]: 'Aguardando Faturamento',
      [StatusPedido.AGUARDANDO_FATURAMENTO]: 'Marcar Em Rota',
      [StatusPedido.EM_ROTA]: 'Registrar Recebimento',
      [StatusPedido.RECEBIMENTO_NOTA]: 'Aprovar pela Diretoria',
      [StatusPedido.APROVADO_DIRETORIA]: '',
      [StatusPedido.CANCELADO]: ''
    };
    
    return labels[pedido.status_atual] || '';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dataFormatada = date.toLocaleDateString('pt-BR');
    const horaFormatada = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${dataFormatada} às ${horaFormatada}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Carregando...</div>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Pedido não encontrado</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pedidos')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {editMode ? 'Editar Pedido' : 'Detalhes do Pedido'}
          </h1>
        </div>

        <div className="flex gap-3">
          {editMode ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="flex items-center gap-2 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-300"
              >
                <X className="w-5 h-5" />
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-300"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </>
          ) : (
            <>
              {canEdit() && (
                <button
                  onClick={handleEnableEdit}
                  className="flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                  Editar Pedido
                </button>
              )}
              {canAdvanceStatus() && (
                <button
                  onClick={handleAvancarStatus}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                >
                  {getNextStatusLabel()}
                </button>
              )}
              <button
                onClick={() => handlePrint()}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-5 h-5" />
                Gerar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modo de Edição */}
      {editMode ? (
        <>
          {/* Formulário de Edição */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Pedido</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fornecedor <span className="text-red-500">*</span>
                </label>
                <select
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{pedido.fornecedor}</option>
                  {fornecedores.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.nomeFantasia || f.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Local de Entrega <span className="text-red-500">*</span>
                </label>
                <select
                  value={localEntrega}
                  onChange={(e) => setLocalEntrega(e.target.value as 'Matriz' | 'Filial')}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Matriz">Matriz - Pentecoste/CE</option>
                  <option value="Filial">Filial - Fortaleza/CE</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Itens Editáveis */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Itens do Pedido</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Código</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Descrição</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Quantidade</th>
                    <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {itensEditaveis.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{item.codigo_item}</td>
                      <td className="px-4 py-3 text-sm">{item.descricao}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantidade_solicitada}
                          onChange={(e) => updateQuantidadeItem(index, parseInt(e.target.value))}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-center"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Status Stepper */}
          {pedido.status_atual !== StatusPedido.CANCELADO && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Acompanhamento do Pedido
              </h2>
              <StatusStepper currentStatus={pedido.status_atual} />
            </div>
          )}

          {/* Visualização para Impressão */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <PedidoPrintView ref={printRef} pedido={pedido} />
          </div>

          {/* Análise dos Itens no Momento da Criação */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Análise dos Itens no Momento da Criação do Pedido
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Estes dados representam a situação dos itens no momento em que o pedido foi criado ({formatDateTime(pedido.data_criacao)})
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Código</th>
                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Descrição</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700">CL</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Dep.Aberto</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Dep.Interno</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Dep.Externo</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Saldo Total</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Giro Mensal</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Méd Trimestre</th>
                    <th className="px-2 py-2 text-right font-semibold text-gray-700">Vlr Última</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700">Dt Última</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700">Prev Fim</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700">Dias Cobertura</th>
                    <th className="px-2 py-2 text-center font-semibold text-gray-700 bg-blue-50">Qtd Pedida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pedido.itens.map((item, index) => {
                    const saldoTotal = (item.saldo_dep_aberto || 0) + (item.saldo_dep_fechado_interno || 0) + (item.saldo_dep_fechado_externo || 0);
                    
                    // Calcular dias de cobertura no momento da criação
                    let diasCobertura = '-';
                    let corDias = 'text-gray-600';
                    
                    if (item.previsao_fim_estoque === 'Sem Estoque') {
                      diasCobertura = '0';
                      corDias = 'text-red-600 font-bold';
                    } else if (item.previsao_fim_estoque && item.previsao_fim_estoque !== 'Sem Consumo' && item.previsao_fim_estoque !== '-') {
                      try {
                        const [dia, mes, ano] = item.previsao_fim_estoque.split('/').map(Number);
                        const dataPrevFim = new Date(ano, mes - 1, dia);
                        const dataCriacao = new Date(pedido.data_criacao);
                        dataCriacao.setHours(0, 0, 0, 0);
                        const diffTime = dataPrevFim.getTime() - dataCriacao.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        diasCobertura = `${diffDays}`;
                        
                        if (diffDays <= 30) corDias = 'text-red-600 font-bold';
                        else if (diffDays <= 60) corDias = 'text-orange-600 font-semibold';
                      } catch (error) {
                        // Mantém '-'
                      }
                    }
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-2 py-2 font-mono">{item.codigo_item}</td>
                        <td className="px-2 py-2">{item.descricao}</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            item.classe_abc === 'A' ? 'bg-green-100 text-green-800' :
                            item.classe_abc === 'B' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.classe_abc}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">{item.saldo_dep_aberto?.toFixed(2) || '0.00'}</td>
                        <td className="px-2 py-2 text-right">{item.saldo_dep_fechado_interno?.toFixed(2) || '0.00'}</td>
                        <td className="px-2 py-2 text-right">{item.saldo_dep_fechado_externo?.toFixed(2) || '0.00'}</td>
                        <td className="px-2 py-2 text-right font-semibold">{saldoTotal.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">{item.giro_mensal?.toFixed(2) || '0.00'}</td>
                        <td className="px-2 py-2 text-right">{item.media_giro_trimestre?.toFixed(2) || '0.00'}</td>
                        <td className="px-2 py-2 text-right">
                          {item.valor_ultima_entrada 
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_ultima_entrada)
                            : 'R$ 0,00'}
                        </td>
                        <td className="px-2 py-2 text-center">{item.data_ultima_entrada || '-'}</td>
                        <td className="px-2 py-2 text-center">{item.previsao_fim_estoque || '-'}</td>
                        <td className={`px-2 py-2 text-center font-semibold ${corDias}`}>
                          {diasCobertura}
                        </td>
                        <td className="px-2 py-2 text-center bg-blue-50 font-bold text-blue-700">
                          {item.quantidade_solicitada}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>

          {/* Informações Adicionais na Tela */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Informações do Sistema
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">ID do Sistema:</span>
                <span className="ml-2 font-medium text-gray-900">{pedido._id}</span>
              </div>
              <div>
                <span className="text-gray-600">Número OC:</span>
                <span className="ml-2 font-medium text-gray-900">{pedido.numero}</span>
              </div>
              <div>
                <span className="text-gray-600">Data de Criação:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {formatDate(pedido.data_criacao)}
                </span>
              </div>
              {pedido.data_prevista_entrega && (
                <div>
                  <span className="text-gray-600">Data de Entrega Prevista:</span>
                  <span className="ml-2 font-medium text-green-700">
                    {formatDate(pedido.data_prevista_entrega)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-600">Total de Itens:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {pedido.itens.length}
                </span>
              </div>
            </div>
          </div>

          {/* Histórico de Edições */}
          {pedido.historico_edicoes && pedido.historico_edicoes.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Histórico de Edições
              </h2>
              <div className="space-y-3">
                {pedido.historico_edicoes.map((edicao, index) => (
                  <div key={index} className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-gray-900">{edicao.usuario_nome}</span>
                      <span className="text-sm text-gray-600">{formatDate(edicao.data)}</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Campos alterados:</span> {edicao.campos_alterados.join(', ')}
                    </div>
                    {edicao.observacao && (
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Observação:</span> {edicao.observacao}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal para capturar data de entrega */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informar Data de Entrega
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Digite a data de entrega prevista informada pelo fornecedor:
            </p>
            <input
              type="date"
              value={dataEntregaPrevista}
              onChange={(e) => setDataEntregaPrevista(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              min={new Date().toISOString().split('T')[0]}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDateModal(false);
                  setDataEntregaPrevista('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarDataEntrega}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidoDetailPage;
