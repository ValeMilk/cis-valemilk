// Script de inicialização do MongoDB para CIS
// Executado automaticamente quando o container inicia pela primeira vez

// Conectar ao banco de dados
db = db.getSiblingDB('valemilk_cis');

// Senhas pré-hashadas com bcrypt (10 rounds)
// comprador123 -> hash abaixo
// diretoria123 -> hash abaixo
// recebimento123 -> hash abaixo
// admin123 -> hash abaixo

const bcryptHashes = {
  comprador123: '$2a$10$J3X7SIEYjXZK61ro/vsE9e.8njautKvxuRBVnI4tOGRs4NcuhU5aO',
  diretoria123: '$2a$10$BVi7TYIm38k3QsmHGfHpxeUzoV9TSV1hB3.Rc2vmy2H7YgojaD0aK',
  recebimento123: '$2a$10$X54SovlgBqgVkVrrC.o8pOMwD5D4FkBkgDNEr7y4F6fm2E1wZdnwm',
  admin123: '$2a$10$vr19Mib/2JJj3YNNFOe1x.MvAgUnokYzdL/sXBmJ1dTMgQnj972Ve'
};

// Criar coleção de usuários se não existir
db.createCollection('users');

// Inserir usuários iniciais
const users = [
  {
    nome: 'Comprador Teste',
    email: 'comprador@valemilk.com',
    hashed_password: bcryptHashes.comprador123,
    perfil: 'comprador',
    ativo: true,
    created_at: new Date()
  },
  {
    nome: 'Diretoria Teste',
    email: 'diretoria@valemilk.com',
    hashed_password: bcryptHashes.diretoria123,
    perfil: 'diretoria',
    ativo: true,
    created_at: new Date()
  },
  {
    nome: 'Recebimento Teste',
    email: 'recebimento@valemilk.com',
    hashed_password: bcryptHashes.recebimento123,
    perfil: 'recebimento',
    ativo: true,
    created_at: new Date()
  },
  {
    nome: 'Administrador',
    email: 'admin@valemilk.com',
    hashed_password: bcryptHashes.admin123,
    perfil: 'admin',
    ativo: true,
    created_at: new Date()
  }
];

// Inserir cada usuário se não existir
users.forEach(user => {
  const exists = db.users.findOne({ email: user.email });
  if (!exists) {
    db.users.insertOne(user);
    print(`✅ Usuário criado: ${user.email}`);
  } else {
    print(`⚠️  Usuário já existe: ${user.email}`);
  }
});

// Criar índices
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ perfil: 1 });

// Criar coleção de pedidos
db.createCollection('pedidos');
db.pedidos.createIndex({ numero: 1 }, { unique: true });
db.pedidos.createIndex({ status_atual: 1 });
db.pedidos.createIndex({ data_criacao: -1 });
db.pedidos.createIndex({ comprador_id: 1 });

// Criar coleção de fornecedores
db.createCollection('fornecedores');
db.fornecedores.createIndex({ cnpj: 1 }, { unique: true });
db.fornecedores.createIndex({ razao_social: 1 });

// Criar coleção de itens_fornecedor
db.createCollection('itensfornecedors');
db.itensfornecedors.createIndex({ fornecedor_id: 1 });
db.itensfornecedors.createIndex({ codigo_item: 1 });

print('');
print('🎉 Banco de dados CIS inicializado com sucesso!');
print('📧 Usuários disponíveis para login:');
print('   - comprador@valemilk.com / comprador123');
print('   - diretoria@valemilk.com / diretoria123');
print('   - recebimento@valemilk.com / recebimento123');
print('   - admin@valemilk.com / admin123');
