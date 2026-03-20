import mongoose, { Schema, Document } from 'mongoose';

export interface IReposicaoItem {
  codigo_item: number;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  minimo: number;
  dep_aberto: number;
  producoes_aberto: number;
  saldo_real: number;
  reposicao: number;
  giro_mensal: number;
  quantidade: number | null;
}

export interface IReposicao extends Document {
  data_carregamento: Date;
  status: 'em_andamento' | 'finalizado';
  carregado_por: string;
  carregado_por_nome: string;
  data_finalizacao?: Date;
  itens: IReposicaoItem[];
  createdAt: Date;
  updatedAt: Date;
}

const ReposicaoItemSchema = new Schema({
  codigo_item: { type: Number, required: true },
  descricao: { type: String, required: true },
  tipo: { type: String, required: true },
  unidade_medida: { type: String, default: '' },
  minimo: { type: Number, default: 0 },
  dep_aberto: { type: Number, default: 0 },
  producoes_aberto: { type: Number, default: 0 },
  saldo_real: { type: Number, default: 0 },
  reposicao: { type: Number, default: 0 },
  giro_mensal: { type: Number, default: 0 },
  quantidade: { type: Number, default: null },
});

const ReposicaoSchema = new Schema({
  data_carregamento: { type: Date, required: true },
  status: { type: String, enum: ['em_andamento', 'finalizado'], default: 'em_andamento' },
  carregado_por: { type: String, required: true },
  carregado_por_nome: { type: String, required: true },
  data_finalizacao: { type: Date },
  itens: [ReposicaoItemSchema]
}, {
  timestamps: true
});

export const Reposicao = mongoose.model<IReposicao>('Reposicao', ReposicaoSchema);
