import mongoose, { Schema, Document } from 'mongoose';

export interface IEstoqueVencimentoItem {
  codigo_item: string;
  descricao: string;
  unidade_medida: string;
  tipo_volume: string;
  unidades_por_volume: number;
  // Múltiplas entradas de contagem/validade por produto
  entradas: IEntradaVencimento[];
}

export interface IEntradaVencimento {
  quantidade: number;
  data_validade: Date;
  registro_data: Date;
  registro_usuario: string;
}

export interface IEstoqueVencimento extends Document {
  data_snapshot: Date;
  status: 'em_andamento' | 'finalizado';
  criado_por: string;
  criado_por_nome: string;
  itens: IEstoqueVencimentoItem[];
  visto_por?: string;
  visto_por_nome?: string;
  visto_data?: Date;
  resolvido_por?: string;
  resolvido_por_nome?: string;
  resolvido_data?: Date;
  resolvido_observacao?: string;
  data_finalizacao?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EntradaVencimentoSchema = new Schema({
  quantidade: { type: Number, required: true, default: 0 },
  data_validade: { type: Date, required: true },
  registro_data: { type: Date, default: Date.now },
  registro_usuario: { type: String, default: '' }
});

const EstoqueVencimentoItemSchema = new Schema({
  codigo_item: { type: String, required: true },
  descricao: { type: String, required: true },
  unidade_medida: { type: String, default: '' },
  tipo_volume: { type: String, default: '' },
  unidades_por_volume: { type: Number, default: 0 },
  entradas: [EntradaVencimentoSchema]
});

const EstoqueVencimentoSchema = new Schema({
  data_snapshot: { type: Date, required: true },
  status: { type: String, enum: ['em_andamento', 'finalizado'], default: 'em_andamento' },
  criado_por: { type: String, required: true },
  criado_por_nome: { type: String, required: true },
  itens: [EstoqueVencimentoItemSchema],
  visto_por: { type: String },
  visto_por_nome: { type: String },
  visto_data: { type: Date },
  resolvido_por: { type: String },
  resolvido_por_nome: { type: String },
  resolvido_data: { type: Date },
  resolvido_observacao: { type: String },
  data_finalizacao: { type: Date }
}, {
  timestamps: true
});

export const EstoqueVencimento = mongoose.model<IEstoqueVencimento>('EstoqueVencimento', EstoqueVencimentoSchema);
