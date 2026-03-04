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
    <div className="py-6">
      <div className="flex items-center justify-between relative">
        {/* Linha de conexão */}
        <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 -z-10">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{
              width: currentStepIndex >= 0 
                ? `${(currentStepIndex / (steps.length - 1)) * 100}%` 
                : '0%'
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => (
          <div key={step.status} className="flex flex-col items-center flex-1">
            {/* Círculo do step */}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                isStepCompleted(index)
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {isStepCompleted(index) && (
                <svg
                  className="w-6 h-6"
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

            {/* Label do step */}
            <div className="mt-3 text-center">
              <p
                className={`text-sm font-medium ${
                  isStepCompleted(index) ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusStepper;
