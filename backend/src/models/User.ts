import { Schema, model, Document } from 'mongoose';
import { PerfilEnum } from '../types/enums';

export interface IUser extends Document {
  nome: string;
  email: string;
  hashed_password: string;
  perfil: PerfilEnum;
  ativo: boolean;
  created_at: Date;
}

const userSchema = new Schema<IUser>({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  hashed_password: { type: String, required: true },
  perfil: { 
    type: String, 
    enum: Object.values(PerfilEnum), 
    required: true 
  },
  ativo: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now }
});

export const User = model<IUser>('User', userSchema);
