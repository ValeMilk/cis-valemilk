import { Schema, model, Document, Types } from 'mongoose';

export enum StatusSolicitacao {
  NOVA = 'NOVA',
  EM_COTACAO = 'EM_COTACAO',
  PEDIDO_FECHADO = 'PEDIDO_FECHADO',
  EM_TRANSITO = 'EM_TRANSITO',
  RECEBIDO = 'RECEBIDO'
}

export interface IItemSolicitacao {
  descricao: string;
  quantidade: string;
}

export interface IHistoricoStatusSolicitacao {
  status: StatusSolicitacao;
  usuario_id: Types.ObjectId;
  usuario_nome: string;
  data: Date;
  observacao?: string;
}

export interface ISolicitacaoCompra extends Document {
  assunto: string;
  descricao?: string;
  itens: IItemSolicitacao[];
  status_atual: StatusSolicitacao;
  solicitante_id: Types.ObjectId;
  solicitante_nome: string;
  historico_status: IHistoricoStatusSolicitacao[];
  createdAt: Date;
  updatedAt: Date;
}

const solicitacaoCompraSchema = new Schema<ISolicitacaoCompra>({
  assunto: { type: String, required: true },
  descricao: { type: String },
  itens: [{
    descricao: { type: String, required: true },
    quantidade: { type: String, default: '' }
  }],
  status_atual: {
    type: String,
    enum: Object.values(StatusSolicitacao),
    default: StatusSolicitacao.NOVA
  },
  solicitante_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  solicitante_nome: { type: String, required: true },
  historico_status: [{
    status: { type: String, enum: Object.values(StatusSolicitacao), required: true },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usuario_nome: { type: String, required: true },
    data: { type: Date, default: Date.now },
    observacao: { type: String }
  }]
}, { timestamps: true });

export default model<ISolicitacaoCompra>('SolicitacaoCompra', solicitacaoCompraSchema);
