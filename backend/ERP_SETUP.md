# Configuração do ERP SQL Server

## Variáveis de Ambiente Necessárias

Para conectar ao banco de dados ERP SQL Server, configure as seguintes variáveis no arquivo `.env`:

```env
# ERP SQL Server
ERP_SERVER=seu-servidor-aqui      # Ex: 192.168.1.100 ou servidor.dominio.com
ERP_DATABASE=nome-do-banco         # Nome do banco de dados ERP
ERP_USER=usuario-sql               # Usuário do SQL Server
ERP_PASSWORD=senha-sql             # Senha do usuário
ERP_PORT=1433                      # Porta padrão do SQL Server
```

## Exemplo de Configuração

```env
# Exemplo para SQL Server local
ERP_SERVER=localhost
ERP_DATABASE=ERP_VALEMILK
ERP_USER=sa
ERP_PASSWORD=SuaSenhaAqui
ERP_PORT=1433

# Exemplo para SQL Server na rede
ERP_SERVER=192.168.1.50
ERP_DATABASE=ERP_PRODUCAO
ERP_USER=erp_reader
ERP_PASSWORD=Password123!
ERP_PORT=1433
```

## Permissões Necessárias

O usuário SQL Server precisa ter permissão de **leitura (SELECT)** nas seguintes tabelas:

- `M00` - Cabeçalho de documentos
- `M01` - Itens de documentos
- `E02` - Cadastro de itens
- `E03` - Saldo de estoque
- `P20` - Ordens de produção (cabeçalho)
- `P21` - Itens de ordens de produção

### Script para criar usuário somente leitura:

```sql
-- Criar login
CREATE LOGIN erp_cis_reader WITH PASSWORD = 'SenhaSegura123!';

-- Criar usuário no banco
USE ERP_PRODUCAO;
CREATE USER erp_cis_reader FOR LOGIN erp_cis_reader;

-- Conceder permissão de leitura
ALTER ROLE db_datareader ADD MEMBER erp_cis_reader;
```

## Testando a Conexão

Após configurar as variáveis, reinicie o backend:

```bash
npm run dev
```

No console, você verá:
- ✅ `Connected to ERP SQL Server` - se conectou com sucesso
- ❌ `ERP Connection Error` - se houve erro na conexão

## Comportamento em Caso de Erro

Se o ERP estiver **indisponível**, o sistema:
1. Exibe warning no console: `⚠️ ERP indisponível, usando dados mock`
2. Retorna dados de exemplo (mock) para não interromper o fluxo
3. Continua funcionando normalmente

Quando o ERP voltar a ficar disponível, a próxima requisição tentará conectar automaticamente.

## Query Utilizada

A query do ERP retorna as seguintes informações para cada item:

- **Cod** - Código do item
- **Descricao** - Descrição do item
- **Saldo Dep. 1, 7, 8** - Estoque em cada depósito
- **Total Saldo** - Estoque total
- **Giro Mensal** - Quantidade consumida nos últimos 30 dias
- **Giro Trimestre** - Quantidade consumida nos últimos 90 dias
- **Valor Ult Entrada** - Preço da última entrada
- **Dt Ult Entrada** - Data da última entrada

## Segurança

⚠️ **IMPORTANTE**: 
- Nunca commite o arquivo `.env` com senhas reais
- Use usuário com permissão **somente de leitura**
- Em produção, use senhas fortes e diferentes das de desenvolvimento
- Configure firewall do SQL Server para aceitar apenas IPs autorizados
