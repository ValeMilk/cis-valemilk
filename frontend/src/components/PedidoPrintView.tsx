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
            <div>
              <h1 className="text-3xl font-bold text-blue-600">VALE MILK</h1>
              <p className="text-sm text-gray-600 mt-1">Pedido de Compra</p>
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
          <table className="w-full border-collapse border border-gray-300 text-xs">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="border border-gray-300 px-2 py-1 text-left">COD</th>
                <th className="border border-gray-300 px-2 py-1 text-left">TIPO</th>
                <th className="border border-gray-300 px-2 py-1 text-left">DESCRIÇÃO</th>
                <th className="border border-gray-300 px-2 py-1 text-left">FORNECEDOR</th>
                <th className="border border-gray-300 px-2 py-1 text-center">CLASSE</th>
                <th className="border border-gray-300 px-2 py-1 text-center">DEP. ABERTO</th>
                <th className="border border-gray-300 px-2 py-1 text-center">DEP. INTERNO</th>
                <th className="border border-gray-300 px-2 py-1 text-center">DEP. EXTERNO</th>
                <th className="border border-gray-300 px-2 py-1 text-center">SALDO TOTAL</th>
                <th className="border border-gray-300 px-2 py-1 text-center">GIRO MENSAL</th>
                <th className="border border-gray-300 px-2 py-1 text-center">MÉD TRIMESTRAL</th>
                <th className="border border-gray-300 px-2 py-1 text-center">DATA ÚLT. COMPRA</th>
                <th className="border border-gray-300 px-2 py-1 text-center">PREV FIM</th>
                <th className="border border-gray-300 px-2 py-1 text-center">QTD</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-2 py-1">{item.codigo_item}</td>
                  <td className="border border-gray-300 px-2 py-1">{item.tipo}</td>
                  <td className="border border-gray-300 px-2 py-1">{item.descricao}</td>
                  <td className="border border-gray-300 px-2 py-1">{item.fornecedor}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.classe_abc}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.saldo_dep_aberto}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.saldo_dep_fechado_interno}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.saldo_dep_fechado_externo}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.estoque_atual}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.giro_mensal}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.media_giro_trimestre}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.data_ultima_entrada}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center">{item.previsao_fim_estoque}</td>
                  <td className="border border-gray-300 px-2 py-1 text-center font-semibold">{item.quantidade_solicitada}</td>
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
