import mongoose, { Schema, Document } from 'mongoose';

export interface IInventarioItem {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  fornecedor: string;
  dep_aberto_interno: number;
  dep_fechado_externo: number;
  dep_fechado_interno: number;
  producoes_aberto: number;
  dep_aberto_real: number;
  contagem_aberto: number | null;
  contagem_fechado_ext: number | null;
  contagem_fechado_int: number | null;
  contagem_data?: Date;
  contagem_usuario?: string;
  observacao?: string;
}

export interface IInventario extends Document {
  data_snapshot: Date;
  status: 'em_andamento' | 'finalizado';
  criado_por: string;
  criado_por_nome: string;
  itens: IInventarioItem[];
  createdAt: Date;
  updatedAt: Date;
}

const InventarioItemSchema = new Schema({
  codigo_item: { type: String, required: true },
  descricao: { type: String, required: true },
  tipo: { type: String, required: true },
  unidade_medida: { type: String, default: '' },
  fornecedor: { type: String, default: '' },
  dep_aberto_interno: { type: Number, default: 0 },
  dep_fechado_externo: { type: Number, default: 0 },
  dep_fechado_interno: { type: Number, default: 0 },
  producoes_aberto: { type: Number, default: 0 },
  dep_aberto_real: { type: Number, default: 0 },
  contagem_aberto: { type: Number, default: null },
  contagem_fechado_ext: { type: Number, default: null },
  contagem_fechado_int: { type: Number, default: null },
  contagem_data: { type: Date },
  contagem_usuario: { type: String },
  observacao: { type: String, default: '' }
});

const InventarioSchema = new Schema({
  data_snapshot: { type: Date, required: true },
  status: { type: String, enum: ['em_andamento', 'finalizado'], default: 'em_andamento' },
  criado_por: { type: String, required: true },
  criado_por_nome: { type: String, required: true },
  itens: [InventarioItemSchema]
}, {
  timestamps: true
});

export const Inventario = mongoose.model<IInventario>('Inventario', InventarioSchema);
