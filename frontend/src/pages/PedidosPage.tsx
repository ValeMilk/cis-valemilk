import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Pedido } from '../types';
import { Plus, Eye, Search } from 'lucide-react';

export default function PedidosPage() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchIdCompra, setSearchIdCompra] = useState('');

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

  const filteredPedidos = pedidos.filter(pedido =>
    searchIdCompra === '' || 
    pedido.idCompra?.toLowerCase().includes(searchIdCompra.toLowerCase()) ||
    pedido.numero.toLowerCase().includes(searchIdCompra.toLowerCase()) ||
    pedido.fornecedor.toLowerCase().includes(searchIdCompra.toLowerCase())
  );

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pedidos</h1>
        <button
          onClick={() => navigate('/items')}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus size={20} />
          <span>Novo Pedido</span>
        </button>
      </div>

      {/* Filtro de Busca */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por ID de Compra, número ou fornecedor..."
            value={searchIdCompra}
            onChange={(e) => setSearchIdCompra(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-4">ID Compra</th>
                <th className="text-left p-4">Número</th>
                <th className="text-left p-4">Fornecedor</th>
                <th className="text-left p-4">Data</th>
                <th className="text-left p-4">Itens</th>
                <th className="text-center p-4">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-gray-500">
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido) => (
                  <tr key={pedido._id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-bold text-blue-600">{pedido.idCompra}</td>
                    <td className="p-4 font-medium">{pedido.numero}</td>
                    <td className="p-4">{pedido.fornecedor}</td>
                    <td className="p-4">
                      {new Date(pedido.data_criacao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">{pedido.itens.length}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => navigate(`/pedidos/${pedido._id}`)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Ver detalhes"
                      >
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
