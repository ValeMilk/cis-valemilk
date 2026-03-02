import mongoose, { Document, Schema } from 'mongoose';

export interface IFornecedor extends Document {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  endereco?: {
    rua?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
  contato?: {
    nome?: string;
    telefone?: string;
    email?: string;
  };
  ativo: boolean;
  observacoes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FornecedorSchema = new Schema<IFornecedor>(
  {
    razaoSocial: {
      type: String,
      required: true,
      trim: true,
    },
    nomeFantasia: {
      type: String,
      trim: true,
    },
    cnpj: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    telefone: {
      type: String,
      trim: true,
    },
    endereco: {
      rua: String,
      numero: String,
      complemento: String,
      bairro: String,
      cidade: String,
      estado: String,
      cep: String,
    },
    contato: {
      nome: String,
      telefone: String,
      email: String,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    observacoes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para otimizar buscas
FornecedorSchema.index({ razaoSocial: 1 });
FornecedorSchema.index({ cnpj: 1 });
FornecedorSchema.index({ ativo: 1 });

export default mongoose.model<IFornecedor>('Fornecedor', FornecedorSchema);
