import mongoose, { Document, Schema } from 'mongoose';

export interface IItemFornecedor extends Document {
  codigoItem: string;
  fornecedorId: mongoose.Types.ObjectId;
  valorUnitario?: number;
  prazoEntrega?: number; // em dias
  observacoes?: string;
  principal: boolean; // fornecedor principal do item
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ItemFornecedorSchema = new Schema<IItemFornecedor>(
  {
    codigoItem: {
      type: String,
      required: true,
      trim: true,
    },
    fornecedorId: {
      type: Schema.Types.ObjectId,
      ref: 'Fornecedor',
      required: true,
    },
    valorUnitario: {
      type: Number,
      min: 0,
    },
    prazoEntrega: {
      type: Number,
      min: 0,
    },
    observacoes: {
      type: String,
    },
    principal: {
      type: Boolean,
      default: false,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices compostos para busca eficiente
ItemFornecedorSchema.index({ codigoItem: 1, fornecedorId: 1 }, { unique: true });
ItemFornecedorSchema.index({ codigoItem: 1, principal: 1 });
ItemFornecedorSchema.index({ fornecedorId: 1 });

export default mongoose.model<IItemFornecedor>('ItemFornecedor', ItemFornecedorSchema);
