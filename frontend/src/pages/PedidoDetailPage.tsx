import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import api from '../services/api';
import { Pedido } from '../types';
import PedidoPrintView from '../components/PedidoPrintView';

const PedidoDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPedido();
  }, [id]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
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
            Detalhes do Pedido
          </h1>
        </div>

        <button
          onClick={() => handlePrint()}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Printer className="w-5 h-5" />
          Gerar PDF
        </button>
      </div>

      {/* Visualização para Impressão */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <PedidoPrintView ref={printRef} pedido={pedido} />
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
          <div>
            <span className="text-gray-600">Total de Itens:</span>
            <span className="ml-2 font-medium text-gray-900">
              {pedido.itens.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidoDetailPage;
