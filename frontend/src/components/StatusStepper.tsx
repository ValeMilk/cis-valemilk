import React from 'react';
import { StatusPedido } from '../types';

interface StatusStepperProps {
  currentStatus: StatusPedido;
}

const StatusStepper: React.FC<StatusStepperProps> = ({ currentStatus }) => {
  const steps = [
    { status: StatusPedido.ENVIADO_FORNECEDOR, label: 'Enviado ao Fornecedor' },
    { status: StatusPedido.AGUARDANDO_FATURAMENTO, label: 'Aguardando Faturamento' },
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
