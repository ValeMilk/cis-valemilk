import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User';
import Fornecedor from '../models/Fornecedor';
import { PerfilEnum } from '../types/enums';

dotenv.config();

const users = [
  {
    nome: 'João Comprador',
    email: 'comprador@valemilk.com',
    password: 'comprador123',
    perfil: PerfilEnum.COMPRADOR
  },
  {
    nome: 'Maria Diretora',
    email: 'diretoria@valemilk.com',
    password: 'diretoria123',
    perfil: PerfilEnum.DIRETORIA
  },
  {
    nome: 'Carlos Recebedor',
    email: 'recebimento@valemilk.com',
    password: 'recebimento123',
    perfil: PerfilEnum.RECEBIMENTO
  },
  {
    nome: 'Admin Sistema',
    email: 'admin@valemilk.com',
    password: 'admin123',
    perfil: PerfilEnum.ADMIN
  }
];

const fornecedores = [
  {
    razaoSocial: 'Laticínios São João Ltda',
    nomeFantasia: 'Laticínios São João',
    cnpj: '12345678000190',
    email: 'vendas@laticiniossaojoao.com.br',
    telefone: '(11) 98765-4321',
    endereco: {
      rua: 'Av. das Indústrias',
      numero: '1500',
      bairro: 'Distrito Industrial',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '01000-000'
    },
    contato: {
      nome: 'José Silva',
      telefone: '(11) 98765-4321',
      email: 'jose@laticiniossaojoao.com.br'
    },
    ativo: true
  },
  {
    razaoSocial: 'Distribuidora Química Brasil S.A.',
    nomeFantasia: 'Química Brasil',
    cnpj: '98765432000111',
    email: 'comercial@quimicabrasil.com.br',
    telefone: '(11) 3456-7890',
    endereco: {
      rua: 'Rua dos Químicos',
      numero: '250',
      bairro: 'Centro',
      cidade: 'Guarulhos',
      estado: 'SP',
      cep: '07000-000'
    },
    contato: {
      nome: 'Ana Paula',
      telefone: '(11) 98888-7777',
      email: 'ana.paula@quimicabrasil.com.br'
    },
    ativo: true,
    observacoes: 'Fornecedor de produtos químicos para indústria alimentícia'
  },
  {
    razaoSocial: 'Cooperativa Agrícola Vale Verde',
    nomeFantasia: 'Vale Verde',
    cnpj: '11222333000144',
    email: 'vendas@valeverde.coop.br',
    telefone: '(19) 3344-5566',
    endereco: {
      rua: 'Estrada Rural',
      numero: 'KM 15',
      bairro: 'Zona Rural',
      cidade: 'Piracicaba',
      estado: 'SP',
      cep: '13400-000'
    },
    contato: {
      nome: 'Pedro Oliveira',
      telefone: '(19) 99999-8888',
      email: 'pedro@valeverde.coop.br'
    },
    ativo: true,
    observacoes: 'Cooperativa de produtores rurais - Leite e derivados'
  },
  {
    razaoSocial: 'Embalagens Premium Ind. e Com. Ltda',
    nomeFantasia: 'Embalagens Premium',
    cnpj: '55666777000188',
    email: 'contato@embalagempremium.com.br',
    telefone: '(11) 2233-4455',
    endereco: {
      rua: 'Av. das Embalagens',
      numero: '800',
      bairro: 'Jardim Industrial',
      cidade: 'São Bernardo do Campo',
      estado: 'SP',
      cep: '09700-000'
    },
    contato: {
      nome: 'Carla Santos',
      telefone: '(11) 97777-6666',
      email: 'carla.santos@embalagempremium.com.br'
    },
    ativo: true
  },
  {
    razaoSocial: 'Essências & Aromas Indústria Ltda',
    nomeFantasia: 'E&A Aromas',
    cnpj: '44555666000177',
    email: 'vendas@earomas.com.br',
    telefone: '(11) 4455-6677',
    endereco: {
      rua: 'Rua dos Aromas',
      numero: '450',
      bairro: 'Vila Industrial',
      cidade: 'Campinas',
      estado: 'SP',
      cep: '13000-000'
    },
    contato: {
      nome: 'Roberto Lima',
      telefone: '(11) 96666-5555',
      email: 'roberto@earomas.com.br'
    },
    ativo: true,
    observacoes: 'Fornecedor de essências e aromas para alimentos'
  }
];

async function seed() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    const dbName = process.env.DB_NAME || 'valemilk_cis';

    if (!mongoURI) {
      throw new Error('MONGODB_URI not defined');
    }

    await mongoose.connect(mongoURI, { dbName });
    console.log('✅ Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('🗑️  Cleared existing users');

    // Create users with hashed passwords
    for (const userData of users) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await User.create({
        nome: userData.nome,
        email: userData.email,
        hashed_password: hashedPassword,
        perfil: userData.perfil,
        ativo: true
      });
      console.log(`✅ Created user: ${userData.email}`);
    }

    // Clear existing fornecedores
    await Fornecedor.deleteMany({});
    console.log('🗑️  Cleared existing fornecedores');

    // Create fornecedores
    for (const fornecedorData of fornecedores) {
      await Fornecedor.create(fornecedorData);
      console.log(`✅ Created fornecedor: ${fornecedorData.nomeFantasia || fornecedorData.razaoSocial}`);
    }

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('📝 User Credentials:');
    users.forEach(u => {
      console.log(`   ${u.perfil}: ${u.email} / ${u.password}`);
    });
    
    console.log('\n🏢 Fornecedores Created:');
    fornecedores.forEach(f => {
      console.log(`   ${f.nomeFantasia || f.razaoSocial} - CNPJ: ${f.cnpj}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seed();
