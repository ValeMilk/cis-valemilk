import mongoose, { Schema, Document } from 'mongoose';

export interface IInventarioFilialItem {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  deposito_2: number;
  producoes_aberto: number;
  dep_real: number;
  contagem: number | null;
  contagem_data?: Date;
  contagem_usuario?: string;
  observacao?: string;
}

export interface IInventarioFilial extends Document {
  data_snapshot: Date;
  status: 'em_andamento' | 'finalizado';
  criado_por: string;
  criado_por_nome: string;
  itens: IInventarioFilialItem[];
  createdAt: Date;
  updatedAt: Date;
}

const InventarioFilialItemSchema = new Schema({
  codigo_item: { type: String, required: true },
  descricao: { type: String, required: true },
  tipo: { type: String, required: true },
  unidade_medida: { type: String, default: '' },
  deposito_2: { type: Number, default: 0 },
  producoes_aberto: { type: Number, default: 0 },
  dep_real: { type: Number, default: 0 },
  contagem: { type: Number, default: null },
  contagem_data: { type: Date },
  contagem_usuario: { type: String },
  observacao: { type: String, default: '' }
});

const InventarioFilialSchema = new Schema({
  data_snapshot: { type: Date, required: true },
  status: { type: String, enum: ['em_andamento', 'finalizado'], default: 'em_andamento' },
  criado_por: { type: String, required: true },
  criado_por_nome: { type: String, required: true },
  itens: [InventarioFilialItemSchema]
}, {
  timestamps: true
});

export const InventarioFilial = mongoose.model<IInventarioFilial>('InventarioFilial', InventarioFilialSchema);
