# CIS - Central de Inteligência de Suprimentos

Sistema completo de gestão de suprimentos com workflow de aprovação.

## 🛠️ Tecnologias

### Frontend
- **React 18** com TypeScript
- **Vite 5.4.19** (build tool)
- **TailwindCSS** (UI styling)
- **Recharts** (gráficos)
- **React Router** (navegação com proteção de rotas)

### Backend
- **Node.js 18** + **Express** + TypeScript
- **MongoDB Atlas** com Mongoose
- **JWT** (autenticação com roles)
- **bcryptjs** (hash de senhas)
- **CORS** configurado para produção

### Infraestrutura
- **VPS**: Ubuntu 24.04 (IP: 72.61.62.17)
- **Docker Compose** (orquestração)
- **Nginx** (frontend na porta 8888)
- **Node** (backend na porta 4000)

## 🚀 Desenvolvimento Local

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env com suas credenciais MongoDB Atlas
npm run seed    # Criar usuários iniciais
npm run dev     # Porta 4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev     # Porta 5173
```

## 📦 Deploy (Docker)

```bash
# Build e deploy completo
docker-compose up -d --build

# Logs
docker-compose logs -f

# Parar
docker-compose down
```

**Acessos após deploy:**
- Frontend: http://72.61.62.17:8888
- Backend API: http://72.61.62.17:4000/api
- Health Check: http://72.61.62.17:4000/health

## 🔐 Credenciais Default

| Perfil | Email | Senha |
|--------|-------|-------|
| Comprador | comprador@valemilk.com | comprador123 |
| Diretoria | diretoria@valemilk.com | diretoria123 |
| Recebimento | recebimento@valemilk.com | recebimento123 |
| Admin | admin@valemilk.com | admin123 |

## 📊 Fluxo de Pedidos

1. **RASCUNHO** → Comprador cria pedido
2. **AGUARDANDO_APROVACAO** → Comprador envia para diretoria
3. **APROVADO** → Diretoria aprova
4. **ENVIADO** → Comprador envia ao fornecedor
5. **CONFIRMADO** → Fornecedor confirma
6. **RECEBIDO_PARCIAL/COMPLETO** → Recebimento registra entrada
7. **CANCELADO** (opcional em qualquer etapa)

## 🗂️ Estrutura do Projeto

```
Suply_Node/
├── backend/
│   ├── src/
│   │   ├── config/         # Database config
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # Express routes
│   │   ├── middleware/     # Auth middleware
│   │   ├── types/          # TypeScript types
│   │   ├── scripts/        # Seed script
│   │   └── server.ts       # Entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # Auth context
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service
│   │   ├── types/          # TypeScript types
│   │   └── main.tsx        # Entry point
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
└── docker-compose.yml
```

## 📝 Variáveis de Ambiente

### Backend (.env)
```env
MONGODB_URI=mongodb+srv://...
DB_NAME=valemilk_cis
JWT_SECRET=sua-chave-secreta-min-32-chars
JWT_EXPIRES_IN=24h
PORT=4000
NODE_ENV=production
CORS_ORIGINS=http://localhost:5173,http://72.61.62.17:8888
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:4000/api
```

## 🔧 Comandos Úteis

```bash
# Backend
npm run dev      # Desenvolvimento
npm run build    # Build TypeScript
npm run start    # Produção
npm run seed     # Popular DB

# Frontend
npm run dev      # Desenvolvimento
npm run build    # Build para produção
npm run preview  # Preview do build

# Docker
docker-compose up -d --build    # Build e iniciar
docker-compose logs backend -f  # Logs backend
docker-compose logs frontend -f # Logs frontend
docker-compose restart          # Reiniciar
docker-compose down             # Parar tudo
```
