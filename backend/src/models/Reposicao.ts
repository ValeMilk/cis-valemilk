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
}

export interface IReposicao extends Document {
  data_carregamento: Date;
  carregado_por: string;
  carregado_por_nome: string;
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
});

const ReposicaoSchema = new Schema({
  data_carregamento: { type: Date, required: true },
  carregado_por: { type: String, required: true },
  carregado_por_nome: { type: String, required: true },
  itens: [ReposicaoItemSchema]
}, {
  timestamps: true
});

export const Reposicao = mongoose.model<IReposicao>('Reposicao', ReposicaoSchema);
