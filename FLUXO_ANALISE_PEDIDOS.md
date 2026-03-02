# 🎯 Fluxo do Sistema CIS - Análise de Itens e Criação de Pedidos

## 📊 Visão Geral do Fluxo

```
┌────────────────────┐
│   Login Sistema    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│    Dashboard       │  ← KPIs, estatísticas, visão geral
└─────────┬──────────┘
          │
          ▼
┌────────────────────────────────────────────────────┐
│         ANÁLISE DE ITENS DO ERP                    │
│  (Nova tela principal - ItemsAnalysisPage)         │
│                                                     │
│  1. Visualizar todos os itens do ERP               │
│  2. Ver estoque por depósito (1, 7, 8)             │
│  3. Analisar giro mensal e trimestral              │
│  4. Verificar último preço de entrada              │
│  5. Filtrar por classe ABC e busca                 │
│  6. SELECIONAR itens para compra                   │
│  7. Informar quantidade desejada                   │
└─────────┬──────────────────────────────────────────┘
          │
          │ (Botão "Criar Pedido")
          ▼
┌────────────────────────────────────────────────────┐
│      CRIAR PEDIDO DE COMPRA                        │
│  (Nova tela - CreatePedidoPage)                    │
│                                                     │
│  1. Revisar itens selecionados                     │
│  2. Ajustar quantidades                            │
│  3. Editar valores unitários                       │
│  4. Informar fornecedor                            │
│  5. Adicionar observações                          │
│  6. Escolher ação:                                 │
│     - Salvar como RASCUNHO                         │
│     - Enviar para APROVAÇÃO direto                 │
└─────────┬──────────────────────────────────────────┘
          │
          ▼
┌────────────────────┐
│  LISTA DE PEDIDOS  │  ← Ver todos os pedidos criados
└────────────────────┘
```

---

## 🔍 Tela 1: Análise de Itens do ERP

**Rota**: `/items`  
**Componente**: `ItemsAnalysisPage.tsx`  
**Acesso**: Todos os usuários autenticados

### Funcionalidades:

#### 📋 Visualização Completa
- **Tabela com 13 colunas**:
  1. ☑️ Checkbox (seleção)
  2. 🔢 Código do item
  3. 📝 Descrição
  4. 🏷️ Classe ABC (badge colorido)
  5. 📦 Estoque Total
  6. 🏭 Saldo Depósito 1
  7. 🏭 Saldo Depósito 7
  8. 🏭 Saldo Depósito 8
  9. 📈 Giro Mensal (com ícone tendência)
  10. 📊 Giro Trimestre
  11. 💰 Último Valor Entrada
  12. 📅 Data Última Entrada
  13. 🔢 Quantidade para Pedido (input)

#### 🔎 Filtros Disponíveis
- **Busca por texto**: Código ou descrição
- **Filtro Classe ABC**: A, B, C ou Todas
- **Seleção múltipla**: Checkbox individual ou selecionar todos

#### 📊 Estatísticas em Tempo Real
- Total de itens mostrados
- Quantidade por classe (A, B, C)
- Itens selecionados

#### 🎨 Classificação ABC Automática
```javascript
Classe A: Giro Mensal > 100 unidades  (verde - alta rotatividade)
Classe B: Giro Mensal 30-100 unidades (amarelo - média rotatividade)
Classe C: Giro Mensal < 30 unidades   (cinza - baixa rotatividade)
```

#### ⚡ Interações
1. **Clicar checkbox** → Item selecionado (linha fica azul)
2. **Input quantidade** → Define qtd para o pedido (mínimo 1)
3. **Selecionar vários itens** → Contador atualiza
4. **Botão "Criar Pedido"** → Navega para tela de criação

### 📡 Integração com ERP
- Faz `GET /api/items` no backend
- Backend consulta SQL Server ERP (query complexa com 3 CTEs)
- Se ERP offline → Usa dados mock
- Dados atualizados em tempo real do estoque

---

## 📝 Tela 2: Criar Pedido de Compra

**Rota**: `/pedidos/novo`  
**Componente**: `CreatePedidoPage.tsx`  
**Acesso**: Usuários com perfil COMPRADOR ou ADMIN

### Funcionalidades:

#### 📋 Formulário do Pedido
- **Comprador**: Preenchido automaticamente (usuário logado)
- **Fornecedor**: Campo obrigatório (texto livre)
- **Observações**: Campo opcional (textarea)

#### 📦 Tabela de Itens
- **Colunas**:
  1. Código
  2. Descrição
  3. Unidade de Medida
  4. Quantidade (editável)
  5. Valor Unitário (editável)
  6. Total (calculado automaticamente)
  7. Ações (remover item)

#### 💰 Cálculo Automático
- **Valor total do pedido** atualizado em tempo real
- Fórmula: `Σ (quantidade × valor_unitário)`

#### 🎯 Ações Disponíveis

1. **Salvar Rascunho** 📄
   - Status: `RASCUNHO`
   - Pode editar depois
   - Não notifica ninguém
   - API: `POST /api/pedidos`

2. **Enviar para Aprovação** ✅
   - Cria pedido + muda status
   - Status: `AGUARDANDO_APROVACAO`
   - Não pode mais editar
   - API: `POST /api/pedidos` + `POST /api/pedidos/:id/enviar-aprovacao`

3. **Cancelar** ❌
   - Volta para tela de análise
   - Perde dados do formulário

#### 🔄 Fluxo de Dados
```
ItemsAnalysisPage → sessionStorage → CreatePedidoPage
  (seleciona itens)    (temporário)    (carrega itens)
```

### 🔒 Validações
- ✅ Fornecedor não pode estar vazio
- ✅ Deve ter pelo menos 1 item
- ✅ Quantidade mínima: 1
- ✅ Valor unitário mínimo: 0

---

## 🚀 Fluxo Completo de Uso (Exemplo Real)

### Cenário: Comprador precisa repor estoque de matérias-primas

#### **Passo 1**: Login
```
Usuário: comprador@valemilk.com
Senha: comprador123
```

#### **Passo 2**: Navegar para Análise
- Clicar no menu: **"Análise de Itens"**
- Sistema carrega 26 itens do ERP SQL Server

#### **Passo 3**: Filtrar e Analisar
- Filtrar por **Classe A** (itens de alta rotatividade)
- Ver que "LEITE IN NATURA" tem:
  - Estoque Total: 52,011 kg
  - Giro Mensal: 556,012 kg
  - **Estoque baixo para o giro!**

#### **Passo 4**: Selecionar Itens
- ☑️ Selecionar "LEITE IN NATURA" → Qtd: 100 sacos
- ☑️ Selecionar "CITRATO DE SODIO" → Qtd: 50 unidades
- ☑️ Selecionar "ACIDO LATICO" → Qtd: 30 unidades

#### **Passo 5**: Criar Pedido
- Clicar botão: **"Criar Pedido (3 itens)"**
- Sistema redireciona para `/pedidos/novo`

#### **Passo 6**: Preencher Dados
- Fornecedor: **"Laticínios São João Ltda"**
- Observações: **"Urgente - estoque crítico para produção da semana"**
- Revisar valores unitários (já vem com último preço)
- Ajustar quantidade se necessário

#### **Passo 7**: Enviar
- Clicar: **"Enviar para Aprovação"**
- Sistema cria pedido e envia para diretoria
- Redireciona para página do pedido criado

#### **Passo 8**: Acompanhar
- Pedido aparece na lista com status: **AGUARDANDO_APROVACAO**
- Diretoria recebe notificação (futuro)
- Comprador acompanha pelo dashboard

---

## 🎨 Destaques Visuais

### Cores da Classe ABC
```css
Classe A: bg-green-100 text-green-800   (Verde)
Classe B: bg-yellow-100 text-yellow-800 (Amarelo)
Classe C: bg-gray-100 text-gray-800     (Cinza)
```

### Ícones de Giro
```
Giro > 100:  🔼 TrendingUp (verde)
Giro ≤ 100:  🔽 TrendingDown (cinza)
```

### Estados de Linha
```
Normal:       bg-white
Hover:        bg-gray-50
Selecionada:  bg-blue-50
```

---

## 📊 Dados Mostrados do ERP

### Dados da Query SQL Server:
```sql
- Cod                 → ID do item
- Descricao           → Nome do produto
- Saldo Dep. 1/7/8    → Estoque por armazém
- Total Saldo         → Estoque total
- Giro Mensal         → Consumo últimos 30 dias
- Giro Trimestre      → Consumo últimos 90 dias
- Valor Ult Entrada   → Preço última compra
- Dt Ult Entrada      → Data última compra
```

### Dados Calculados no Backend:
```javascript
- classe_abc          → Baseado no giro mensal
- estoque_minimo      → 50% do giro mensal
- unidade_medida      → Padrão "UN" (pode melhorar)
```

---

## 🔧 Melhorias Futuras Sugeridas

### Tela de Análise:
1. ⭐ **Sugestão automática de compra**
   - Comparar: `estoque_atual < (giro_mensal * 1.5)`
   - Badge: "🔴 Abaixo do Mínimo"

2. 📊 **Gráfico de tendência**
   - Mostrar histórico de giro
   - Prever necessidade futura

3. 🔔 **Alertas visuais**
   - Estoque crítico (vermelho)
   - Estoque baixo (amarelo)
   - Estoque ok (verde)

4. 💾 **Salvar seleções**
   - "Templates" de pedido
   - Pedidos recorrentes

### Tela de Criação:
1. 📧 **Buscar fornecedores**
   - Cadastro de fornecedores
   - Histórico de compras

2. 📎 **Anexos**
   - Upload de cotações
   - Documentos do fornecedor

3. 🔄 **Copiar pedido anterior**
   - Duplicar pedido
   - Ajustar quantidades

4. 💬 **Chat/comentários**
   - Comunicação com diretoria
   - Histórico de negociação

---

## 🎯 Resumo do Fluxo

```
1. ANÁLISE     → Ver estoque real do ERP
2. SELEÇÃO     → Escolher itens que precisam reposição
3. QUANTIDADE  → Definir quanto comprar
4. CRIAÇÃO     → Montar pedido formal
5. APROVAÇÃO   → Enviar para diretoria
6. WORKFLOW    → Seguir fluxo até recebimento
```

**Diferencial**: Análise baseada em **dados reais** (estoque, giro, preços) antes de criar pedido, evitando compras desnecessárias ou insuficientes! 🎉

---

## 📱 Navegação do Sistema

```
┌─────────────────────────────────────────┐
│  MENU PRINCIPAL (Layout)                │
├─────────────────────────────────────────┤
│  🏠 Dashboard       → Visão geral       │
│  📦 Análise Itens   → Nova funcionalidade
│  🛒 Pedidos         → Lista de pedidos  │
│  🚪 Logout          → Sair              │
└─────────────────────────────────────────┘
```

**Fluxo recomendado**:  
Dashboard → Análise Itens → Criar Pedido → Pedidos
