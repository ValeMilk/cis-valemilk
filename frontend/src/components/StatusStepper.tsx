import React from 'react';
import { StatusPedido } from '../types';

interface StatusStepperProps {
  currentStatus: StatusPedido;
  dataPrevisaoFaturamento?: string;
  numeroNotaFiscal?: string;
  dataFaturamento?: string;
  dataEntregaPrevista?: string;
}

const StatusStepper: React.FC<StatusStepperProps> = ({ 
  currentStatus, 
  dataPrevisaoFaturamento,
  numeroNotaFiscal,
  dataFaturamento,
  dataEntregaPrevista 
}) => {
  const steps = [
    { status: StatusPedido.ANALISE_COTACAO, label: 'Análise de Cotação' },
    { status: StatusPedido.ENVIADO_FORNECEDOR, label: 'Enviado ao Fornecedor' },
    { status: StatusPedido.AGUARDANDO_FATURAMENTO, label: 'Aguardando Faturamento' },
    { status: StatusPedido.FATURADO, label: 'Faturado' },
    { status: StatusPedido.EM_ROTA, label: 'Em Rota' },
    { status: StatusPedido.RECEBIMENTO_NOTA, label: 'Recebimento de Nota' },
    { status: StatusPedido.APROVADO_DIRETORIA, label: 'Aprovado pela Diretoria' }
  ];

  const getStepIndex = (status: StatusPedido): number => {
    const index = steps.findIndex(step => step.status === status);
    return index >= 0 ? index : -1;
  };

  const currentStepIndex = getStepIndex(currentStatus);

  const isStepCompleted = (index: number): boolean => {
    return currentStepIndex >= index;
  };

  // Calcular dias restantes para uma data
  const calcularDiasRestantes = (dataString?: string) => {
    if (!dataString) return null;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const safeDate = dataString.length === 10 ? dataString + 'T12:00:00' : dataString;
    const data = new Date(safeDate);
    data.setHours(0, 0, 0, 0);
    const diffTime = data.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dataFormatada = data.toLocaleDateString('pt-BR');
    
    return { diasRestantes, dataFormatada };
  };

  const infoPrevisaoFaturamento = calcularDiasRestantes(dataPrevisaoFaturamento);
  const infoFaturamento = dataFaturamento ? { dataFormatada: new Date(dataFaturamento.length === 10 ? dataFaturamento + 'T12:00:00' : dataFaturamento).toLocaleDateString('pt-BR') } : null;
  const infoEntrega = calcularDiasRestantes(dataEntregaPrevista);

  return (
    <div className="py-8">
      {/* Labels no topo */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => (
          <div key={step.status} className="flex flex-col items-center flex-1">
            <p
              className={`text-sm font-medium text-center ${
                isStepCompleted(index) ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {step.label}
            </p>
            
            {/* Mostrar data de previsão no passo "Aguardando Faturamento" */}
            {step.status === StatusPedido.AGUARDANDO_FATURAMENTO && dataPrevisaoFaturamento && infoPrevisaoFaturamento && (
              <div className="mt-2 text-center">
                <p className="text-xs text-blue-700 font-semibold">
                  📅 {infoPrevisaoFaturamento.dataFormatada}
                </p>
                <p className={`text-xs font-bold mt-0.5 ${
                  infoPrevisaoFaturamento.diasRestantes < 0 
                    ? 'text-red-600' 
                    : infoPrevisaoFaturamento.diasRestantes <= 3 
                    ? 'text-orange-600' 
                    : 'text-blue-600'
                }`}>
                  {infoPrevisaoFaturamento.diasRestantes < 0 
                    ? `Atrasado ${Math.abs(infoPrevisaoFaturamento.diasRestantes)} dia${Math.abs(infoPrevisaoFaturamento.diasRestantes) !== 1 ? 's' : ''}` 
                    : infoPrevisaoFaturamento.diasRestantes === 0 
                    ? 'Fatura hoje!' 
                    : `Faltam ${infoPrevisaoFaturamento.diasRestantes} dia${infoPrevisaoFaturamento.diasRestantes !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            )}
            
            {/* Mostrar dados de faturamento no passo "Faturado" */}
            {step.status === StatusPedido.FATURADO && numeroNotaFiscal && infoFaturamento && (
              <div className="mt-2 text-center">
                <p className="text-xs text-purple-700 font-semibold">
                  📄 NF: {numeroNotaFiscal}
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {infoFaturamento.dataFormatada}
                </p>
              </div>
            )}
            
            {/* Mostrar data de entrega no passo "Em Rota" */}
            {step.status === StatusPedido.EM_ROTA && dataEntregaPrevista && infoEntrega && (
              <div className="mt-2 text-center">
                <p className="text-xs text-green-700 font-semibold">
                  📅 {infoEntrega.dataFormatada}
                </p>
                <p className={`text-xs font-bold mt-0.5 ${
                  infoEntrega.diasRestantes < 0 
                    ? 'text-red-600' 
                    : infoEntrega.diasRestantes <= 3 
                    ? 'text-orange-600' 
                    : 'text-green-600'
                }`}>
                  {infoEntrega.diasRestantes < 0 
                    ? `Atrasado ${Math.abs(infoEntrega.diasRestantes)} dia${Math.abs(infoEntrega.diasRestantes) !== 1 ? 's' : ''}` 
                    : infoEntrega.diasRestantes === 0 
                    ? 'Entrega hoje!' 
                    : `Faltam ${infoEntrega.diasRestantes} dia${infoEntrega.diasRestantes !== 1 ? 's' : ''}`
                  }
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Linha e círculos */}
      <div className="flex items-center justify-between relative px-8">
        {/* Linha de fundo (cinza) - completa */}
        <div className="absolute top-1/2 left-0 right-0 h-2 bg-gray-300 -translate-y-1/2 rounded-full" />
        
        {/* Linha de progresso (azul) */}
        <div 
          className="absolute top-1/2 left-0 h-2 bg-blue-500 -translate-y-1/2 rounded-full transition-all duration-500"
          style={{
            width: currentStepIndex >= 0 
              ? `${(currentStepIndex / (steps.length - 1)) * 100}%` 
              : '0%'
          }}
        />

        {/* Círculos dos steps */}
        {steps.map((step, index) => (
          <div
            key={step.status}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10 ${
              isStepCompleted(index)
                ? 'bg-blue-500 border-blue-500 text-white shadow-lg'
                : 'bg-white border-gray-300 text-gray-400'
            }`}
          >
            {isStepCompleted(index) && (
              <svg
                className="w-7 h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusStepper;
