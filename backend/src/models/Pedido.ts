import { Schema, model, Document, Types } from 'mongoose';
import { StatusPedido } from '../types/enums';

export interface IPedidoItem {
  item_id: string;
  codigo_item: string;
  descricao: string;
  tipo: string;
  fornecedor: string;
  classe_abc: string;
  unidade_medida: string;
  quantidade_solicitada: number;
  quantidade_recebida: number;
  saldo_dep_aberto: number;
  saldo_dep_fechado_interno: number;
  saldo_dep_fechado_externo: number;
  estoque_atual: number;
  giro_mensal: number;
  media_giro_trimestre: number;
  data_ultima_entrada: string;
  previsao_fim_estoque: string;
  preco_unitario: number;
  valor_total: number;
}

export interface IHistoricoStatus {
  status: StatusPedido;
  usuario_id: Types.ObjectId;
  usuario_nome: string;
  data: Date;
  observacao?: string;
}

export interface IPedido extends Document {
  idCompra: string;
  numero: string;
  comprador_id: Types.ObjectId;
  comprador_nome: string;
  fornecedor: string;
  status_atual: StatusPedido;
  itens: IPedidoItem[];
  valor_total: number;
  data_criacao: Date;
  data_prevista_entrega?: Date;
  observacoes?: string;
  historico_status: IHistoricoStatus[];
}

const pedidoSchema = new Schema<IPedido>({
  idCompra: { type: String, required: true, unique: true },
  numero: { type: String, required: true, unique: true },
  comprador_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comprador_nome: { type: String, required: true },
  fornecedor: { type: String, required: true },
  status_atual: { 
    type: String, 
    enum: Object.values(StatusPedido), 
    default: StatusPedido.RASCUNHO 
  },
  itens: [{
    item_id: String,
    codigo_item: String,
    descricao: String,
    tipo: String,
    fornecedor: String,
    classe_abc: String,
    unidade_medida: String,
    quantidade_solicitada: Number,
    quantidade_recebida: { type: Number, default: 0 },
    saldo_dep_aberto: Number,
    saldo_dep_fechado_interno: Number,
    saldo_dep_fechado_externo: Number,
    estoque_atual: Number,
    giro_mensal: Number,
    media_giro_trimestre: Number,
    data_ultima_entrada: String,
    previsao_fim_estoque: String,
    preco_unitario: Number,
    valor_total: Number
  }],
  valor_total: { type: Number, required: true },
  data_criacao: { type: Date, default: Date.now },
  data_prevista_entrega: Date,
  observacoes: String,
  historico_status: [{
    status: { type: String, enum: Object.values(StatusPedido) },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'User' },
    usuario_nome: String,
    data: { type: Date, default: Date.now },
    observacao: String
  }]
});

export const Pedido = model<IPedido>('Pedido', pedidoSchema);
