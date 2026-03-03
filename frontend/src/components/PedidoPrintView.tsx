import { forwardRef } from 'react';
import { Pedido } from '../types';

interface PedidoPrintViewProps {
  pedido: Pedido;
}

const PedidoPrintView = forwardRef<HTMLDivElement, PedidoPrintViewProps>(
  ({ pedido }, ref) => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('pt-BR');
    };

    return (
      <div ref={ref} className="p-8 bg-white">
        {/* Cabeçalho */}
        <div className="border-b-4 border-blue-600 pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <img 
                src="/assets/valemilk-logo.png" 
                alt="Vale Milk" 
                className="h-16 w-auto"
              />
              <p className="text-sm text-gray-600">Pedido de Compra</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">{pedido.idCompra}</div>
              <div className="text-sm text-gray-600 mt-1">
                Data: {formatDate(pedido.data_criacao)}
              </div>
            </div>
          </div>
        </div>

        {/* Informações do Pedido */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
              Informações da Empresa
            </h3>
            <div className="bg-gray-50 p-4 rounded">
              <p className="font-semibold text-gray-800">KM CACAU INDÚSTRIA E COMERCIO DE LATICINIOS LTDA</p>
              <p className="text-sm text-gray-600 mt-1">CNPJ: 02.518.353/0001-03</p>
              <p className="text-sm text-gray-600">CGF: 06.266540-5</p>
              <p className="text-sm text-gray-600">AV. JUSCELINO KUBITSCHEK, S/N - OMBREIRA</p>
              <p className="text-sm text-gray-600">PENTECOSTE - CEARÁ</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
              Fornecedor
            </h3>
            <div className="bg-gray-50 p-4 rounded">
              <p className="font-semibold text-gray-800">{pedido.fornecedor}</p>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 mt-4">
              Comprador
            </h3>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-gray-800">{pedido.comprador_nome}</p>
            </div>

            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 mt-4">
              Local de Entrega
            </h3>
            <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-600">
              <p className="font-semibold text-blue-900">{pedido.local_entrega.tipo}</p>
              <p className="text-sm text-gray-700 mt-1">{pedido.local_entrega.endereco}</p>
            </div>
          </div>
        </div>

        {/* Observações */}
        {pedido.observacoes && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
              Observações
            </h3>
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-700">{pedido.observacoes}</p>
            </div>
          </div>
        )}

        {/* Tabela de Itens */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Itens do Pedido
          </h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="border border-gray-300 px-4 py-2 text-left">CÓDIGO</th>
                <th className="border border-gray-300 px-4 py-2 text-left">TIPO</th>
                <th className="border border-gray-300 px-4 py-2 text-left">DESCRIÇÃO</th>
                <th className="border border-gray-300 px-4 py-2 text-center">QUANTIDADE</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-4 py-2">{item.codigo_item}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.tipo}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.descricao}</td>
                  <td className="border border-gray-300 px-4 py-2 text-center font-semibold">{item.quantidade_solicitada}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Informações de Rodapé */}
        <div className="mt-6 text-center text-xs text-gray-500">
                    <p className="mt-1">Para mais informações, entre em contato: compras@valemilk.com.br</p>
        </div>
      </div>
    );
  }
);

PedidoPrintView.displayName = 'PedidoPrintView';

export default PedidoPrintView;
