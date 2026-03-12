import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Save, Package } from 'lucide-react';
import api from '../services/api';
import { Item, Fornecedor } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface PedidoItem {
  item: Item;
  quantidade: number;
}

const CreatePedidoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [localEntrega, setLocalEntrega] = useState<'Matriz' | 'Filial' | ''>('');
  const [observacao, setObservacao] = useState('');
  const [items, setItems] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(false);

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
    // Carregar fornecedores ativos
    fetchFornecedores();
    
    // Carregar itens selecionados do sessionStorage
    const selectedItemsStr = sessionStorage.getItem('selectedItems');
    if (selectedItemsStr) {
      const selectedItems = JSON.parse(selectedItemsStr);
      const pedidoItems: PedidoItem[] = selectedItems.map((si: any) => ({
        item: si.item,
        quantidade: si.quantidade,
      }));
      setItems(pedidoItems);
      sessionStorage.removeItem('selectedItems');
    }
  }, []);

  const fetchFornecedores = async () => {
    try {
      // Buscar fornecedores do MongoDB
      const mongoResponse = await api.get('/fornecedores?ativo=true');
      const mongoFornecedores = mongoResponse.data;

      // Buscar itens do ERP para extrair fornecedores únicos
      const itemsResponse = await api.get('/items');
      const erpItems = itemsResponse.data;
      
      // Extrair fornecedores únicos do ERP
      const erpFornecedoresSet = new Set<string>();
      erpItems.forEach((item: any) => {
        if (item.fornecedor && item.fornecedor.trim()) {
          erpFornecedoresSet.add(item.fornecedor.trim());
        }
      });

      // Converter fornecedores do ERP para o formato esperado
      const erpFornecedores = Array.from(erpFornecedoresSet).map(nome => ({
        _id: `erp-${nome}`,
        nomeFantasia: nome,
        razaoSocial: nome,
        isFromERP: true
      }));

      // Combinar e ordenar alfabeticamente
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

  const updateQuantidade = (index: number, value: number) => {
    const newItems = [...items];
    newItems[index].quantidade = Math.max(0.01, value);
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreatePedido = async () => {
    if (!fornecedorId) {
      alert('Por favor, selecione um fornecedor');
      return;
    }

    if (!localEntrega) {
      alert('Por favor, selecione o local de entrega');
      return;
    }

    if (items.length === 0) {
      alert('Adicione pelo menos um item ao pedido');
      return;
    }

    try {
      setLoading(true);

      const fornecedorSelecionado = fornecedores.find(f => f._id === fornecedorId);
      const fornecedorNome = fornecedorSelecionado?.nomeFantasia || fornecedorSelecionado?.razaoSocial || '';

      const localEntregaData = locaisEntrega[localEntrega as 'Matriz' | 'Filial'];

      const pedidoData = {
        fornecedor: fornecedorNome,
        local_entrega: {
          tipo: localEntrega,
          endereco: localEntregaData.endereco,
          linkMaps: localEntregaData.linkMaps
        },
        observacoes: observacao.trim(),
        valor_total: 0,
        itens: items.map((pi) => ({
          item_id: pi.item.id,
          codigo_item: pi.item.codigo_item,
          descricao: pi.item.descricao,
          tipo: pi.item.tipo,
          fornecedor: pi.item.fornecedor,
          classe_abc: pi.item.classe_abc,
          unidade_medida: pi.item.unidade_medida,
          quantidade_solicitada: pi.quantidade,
          saldo_dep_aberto: pi.item.saldo_dep_aberto,
          saldo_dep_fechado_interno: pi.item.saldo_dep_fechado_interno,
          saldo_dep_fechado_externo: pi.item.saldo_dep_fechado_externo,
          estoque_atual: pi.item.estoque_atual,
          giro_mensal: pi.item.giro_mensal,
          media_giro_trimestre: pi.item.media_giro_trimestre,
          valor_ultima_entrada: pi.item.valorUltimaEntrada,
          data_ultima_entrada: pi.item.data_ultima_entrada,
          previsao_fim_estoque: pi.item.previsao_fim_estoque,
          preco_unitario: 0,
          valor_total: 0,
        })),
      };

      const response = await api.post('/pedidos', pedidoData);
      sessionStorage.removeItem('pedidoItems');
      alert('Pedido criado com sucesso!');
      navigate(`/pedidos/${response.data._id}`);
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      alert(error.response?.data?.message || 'Erro ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/items')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Novo Pedido de Compra</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Nenhum item selecionado
          </h2>
          <p className="text-gray-600 mb-6">
            Para criar um pedido, primeiro selecione os itens na tela de análise
          </p>
          <button
            onClick={() => navigate('/items')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ir para Análise de Itens
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/items')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Novo Pedido de Compra</h1>
      </div>

      {/* Informações do Pedido */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações do Pedido</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comprador
            </label>
            <input
              type="text"
              value={user?.nome || user?.email || ''}
              disabled
              className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fornecedor <span className="text-red-500">*</span>
            </label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione um fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.nomeFantasia || f.razaoSocial}
                </option>
              ))}
            </select>
            {fornecedores.length === 0 && (
              <p className="text-sm text-amber-600 mt-1">
                Nenhum fornecedor cadastrado. <button onClick={() => navigate('/fornecedores')} className="underline hover:text-amber-700">Cadastrar agora</button>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Local de Entrega <span className="text-red-500">*</span>
            </label>
            <select
              value={localEntrega}
              onChange={(e) => setLocalEntrega(e.target.value as 'Matriz' | 'Filial' | '')}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione o local de entrega</option>
              <option value="Matriz">Matriz - Pentecoste/CE</option>
              <option value="Filial">Filial - Fortaleza/CE</option>
            </select>
            {localEntrega && (
              <p className="text-xs text-gray-500 mt-1">
                {locaisEntrega[localEntrega as 'Matriz' | 'Filial'].endereco}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Observações adicionais sobre o pedido..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Itens do Pedido */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Itens do Pedido ({items.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Descrição
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  UN
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Quantidade
                </th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((pedidoItem, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {pedidoItem.item.codigo_item}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {pedidoItem.item.descricao}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                    {pedidoItem.item.unidade_medida}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={pedidoItem.quantidade}
                      onChange={(e) => updateQuantidade(index, parseFloat(e.target.value))}
                      className="w-24 border border-gray-300 rounded px-3 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800"
                      title="Remover item"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <button
          onClick={() => navigate('/items')}
          disabled={loading}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleCreatePedido}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Criando...' : 'Criar Pedido'}
        </button>
      </div>
    </div>
  );
};

export default CreatePedidoPage;
