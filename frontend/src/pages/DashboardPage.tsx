import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { DashboardData, StatusPedido } from '../types';
import { TrendingUp, Package, Clock, DollarSign, Eye } from 'lucide-react';
import StatusStepper from '../components/StatusStepper';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get<DashboardData>('/dashboard');
        setData(response.data);
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Pedidos</p>
              <p className="text-2xl font-bold">{data?.total_pedidos || 0}</p>
            </div>
            <Package className="text-blue-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Em Aberto</p>
              <p className="text-2xl font-bold">{data?.pedidos_em_aberto || 0}</p>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Em Progresso</p>
              <p className="text-2xl font-bold">{data?.pedidos_em_progresso || 0}</p>
            </div>
            <Clock className="text-yellow-500" size={32} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Valor em Aberto</p>
              <p className="text-2xl font-bold">
                R$ {((data?.valor_total_aberto || 0) / 1000).toFixed(0)}k
              </p>
            </div>
            <DollarSign className="text-purple-500" size={32} />
          </div>
        </div>
      </div>

      {/* Pedidos em Progresso com Acompanhamento */}
      {data?.pedidos_recentes && data.pedidos_recentes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-6">Acompanhamento de Pedidos</h2>
          <div className="space-y-8">
            {data.pedidos_recentes
              .filter(pedido => pedido.status_atual !== StatusPedido.APROVADO_DIRETORIA && pedido.status_atual !== StatusPedido.CANCELADO)
              .slice(0, 5)
              .map((pedido) => (
                <div key={pedido._id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{pedido.numero}</h3>
                      <p className="text-sm text-gray-600">{pedido.fornecedor}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/pedidos/${pedido._id}`)}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      Ver Detalhes
                    </button>
                  </div>
                  <StatusStepper currentStatus={pedido.status_atual} />
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Pedidos Recentes</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                <th className="text-left p-2">Número</th>
                <th className="text-left p-2">Fornecedor</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data?.pedidos_recentes.map((pedido) => (
                <tr key={pedido._id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{pedido.numero}</td>
                  <td className="p-2">{pedido.fornecedor}</td>
                  <td className="p-2">
                    <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                      {pedido.status_atual}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    R$ {pedido.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
