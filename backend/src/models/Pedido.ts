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
  valor_ultima_entrada: number;
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

export interface IHistoricoEdicao {
  usuario_id: Types.ObjectId;
  usuario_nome: string;
  data: Date;
  campos_alterados: string[];
  observacao?: string;
}

export interface ILocalEntrega {
  tipo: 'Matriz' | 'Filial';
  endereco: string;
  linkMaps: string;
}

export interface IPedido extends Document {
  idCompra: string;
  numero: string;
  comprador_id: Types.ObjectId;
  comprador_nome: string;
  fornecedor: string;
  local_entrega: ILocalEntrega;
  status_atual: StatusPedido;
  itens: IPedidoItem[];
  valor_total: number;
  data_criacao: Date;
  data_previsao_faturamento?: Date;
  numero_nota_fiscal?: string;
  data_faturamento?: Date;
  valor_nota_fiscal?: number;
  data_prevista_entrega?: Date;
  data_recebimento?: Date;
  observacoes?: string;
  historico_status: IHistoricoStatus[];
  historico_edicoes: IHistoricoEdicao[];
}

const pedidoSchema = new Schema<IPedido>({
  idCompra: { type: String, required: true, unique: true },
  numero: { type: String, required: true, unique: true },
  comprador_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comprador_nome: { type: String, required: true },
  fornecedor: { type: String, required: true },
  local_entrega: {
    tipo: { type: String, enum: ['Matriz', 'Filial'], required: true },
    endereco: { type: String, required: true },
    linkMaps: { type: String, required: true }
  },
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
    valor_ultima_entrada: Number,
    data_ultima_entrada: String,
    previsao_fim_estoque: String,
    preco_unitario: Number,
    valor_total: Number
  }],
  valor_total: { type: Number, required: true },
  data_criacao: { type: Date, default: Date.now },
  data_previsao_faturamento: Date,
  numero_nota_fiscal: String,
  data_faturamento: Date,
  valor_nota_fiscal: Number,
  data_prevista_entrega: Date,
  data_recebimento: Date,
  observacoes: String,
  historico_status: [{
    status: { type: String, enum: Object.values(StatusPedido) },
    usuario_id: { type: Schema.Types.ObjectId, ref: 'User' },
    usuario_nome: String,
    data: { type: Date, default: Date.now },
    observacao: String
  }],
  historico_edicoes: [{
    usuario_id: { type: Schema.Types.ObjectId, ref: 'User' },
    usuario_nome: String,
    data: { type: Date, default: Date.now },
    campos_alterados: [String],
    observacao: String
  }]
});

export const Pedido = model<IPedido>('Pedido', pedidoSchema);
