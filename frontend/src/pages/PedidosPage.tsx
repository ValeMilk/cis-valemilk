import { useEffect, useState } from 'react';
import api from '../services/api';
import { Pedido, StatusPedido } from '../types';
import { Plus, Eye } from 'lucide-react';

const statusLabels: Record<StatusPedido, string> = {
  [StatusPedido.RASCUNHO]: 'Rascunho',
  [StatusPedido.AGUARDANDO_APROVACAO]: 'Aguardando Aprovação',
  [StatusPedido.APROVADO]: 'Aprovado',
  [StatusPedido.REPROVADO]: 'Reprovado',
  [StatusPedido.ENVIADO]: 'Enviado',
  [StatusPedido.CONFIRMADO]: 'Confirmado',
  [StatusPedido.RECEBIDO_PARCIAL]: 'Recebido Parcial',
  [StatusPedido.RECEBIDO_COMPLETO]: 'Recebido Completo',
  [StatusPedido.CANCELADO]: 'Cancelado',
};

const statusColors: Record<StatusPedido, string> = {
  [StatusPedido.RASCUNHO]: 'bg-gray-100 text-gray-800',
  [StatusPedido.AGUARDANDO_APROVACAO]: 'bg-yellow-100 text-yellow-800',
  [StatusPedido.APROVADO]: 'bg-green-100 text-green-800',
  [StatusPedido.REPROVADO]: 'bg-red-100 text-red-800',
  [StatusPedido.ENVIADO]: 'bg-blue-100 text-blue-800',
  [StatusPedido.CONFIRMADO]: 'bg-green-100 text-green-800',
  [StatusPedido.RECEBIDO_PARCIAL]: 'bg-orange-100 text-orange-800',
  [StatusPedido.RECEBIDO_COMPLETO]: 'bg-green-100 text-green-800',
  [StatusPedido.CANCELADO]: 'bg-gray-100 text-gray-800',
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center space-x-2">
          <Plus size={20} />
          <span>Novo Pedido</span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-4">Número</th>
                <th className="text-left p-4">Fornecedor</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Data</th>
                <th className="text-right p-4">Valor Total</th>
                <th className="text-center p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-gray-500">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                pedidos.map((pedido) => (
                  <tr key={pedido._id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{pedido.numero}</td>
                    <td className="p-4">{pedido.fornecedor}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded text-xs font-medium ${statusColors[pedido.status_atual]}`}>
                        {statusLabels[pedido.status_atual]}
                      </span>
                    </td>
                    <td className="p-4">
                      {new Date(pedido.data_criacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-right font-medium">
                      R$ {pedido.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">
                      <button className="text-blue-600 hover:text-blue-800">
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
