import mongoose, { Schema, Document } from 'mongoose';

export interface IAvariaItem {
  codigo_item: string;
  descricao: string;
  tipo: string;
  unidade_medida: string;
  deposito_5: number;
  contagem: number | null;
  contagem_data?: Date;
  contagem_usuario?: string;
  observacao?: string;
}

export interface IAvaria extends Document {
  data_snapshot: Date;
  status: 'em_andamento' | 'finalizado';
  criado_por: string;
  criado_por_nome: string;
  itens: IAvariaItem[];
  visto_por?: string;
  visto_por_nome?: string;
  visto_data?: Date;
  resolvido_por?: string;
  resolvido_por_nome?: string;
  resolvido_data?: Date;
  resolvido_observacao?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AvariaItemSchema = new Schema({
  codigo_item: { type: String, required: true },
  descricao: { type: String, required: true },
  tipo: { type: String, required: true },
  unidade_medida: { type: String, default: '' },
  deposito_5: { type: Number, default: 0 },
  contagem: { type: Number, default: null },
  contagem_data: { type: Date },
  contagem_usuario: { type: String },
  observacao: { type: String, default: '' }
});

const AvariaSchema = new Schema({
  data_snapshot: { type: Date, required: true },
  status: { type: String, enum: ['em_andamento', 'finalizado'], default: 'em_andamento' },
  criado_por: { type: String, required: true },
  criado_por_nome: { type: String, required: true },
  itens: [AvariaItemSchema],
  visto_por: { type: String },
  visto_por_nome: { type: String },
  visto_data: { type: Date },
  resolvido_por: { type: String },
  resolvido_por_nome: { type: String },
  resolvido_data: { type: Date },
  resolvido_observacao: { type: String }
}, {
  timestamps: true
});

export const Avaria = mongoose.model<IAvaria>('Avaria', AvariaSchema);
