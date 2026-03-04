export enum PerfilEnum {
  COMPRADOR = 'Comprador',
  DIRETORIA = 'Diretoria',
  RECEBIMENTO = 'Recebimento',
  ADMIN = 'Admin'
}

export enum StatusPedido {
  RASCUNHO = 'RASCUNHO',
  ANALISE_COTACAO = 'ANALISE_COTACAO',
  ENVIADO_FORNECEDOR = 'ENVIADO_FORNECEDOR',
  AGUARDANDO_FATURAMENTO = 'AGUARDANDO_FATURAMENTO',
  FATURADO = 'FATURADO',
  EM_ROTA = 'EM_ROTA',
  RECEBIMENTO_NOTA = 'RECEBIMENTO_NOTA',
  APROVADO_DIRETORIA = 'APROVADO_DIRETORIA',
  CANCELADO = 'CANCELADO'
}

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilEnum;
  ativo: boolean;
}

export interface PedidoItem {
  item_id: string;
  codigo_item: string;
  descricao: string;
  tipo: string;
  fornecedor: string;
  classe_abc: string;
  unidade_medida: string;
  quantidade_solicitada: number;
  quantidade_recebida: number;
  saldo_dep_aberto: number;
  saldo_dep_fechado_interno: number;
  saldo_dep_fechado_externo: number;
  estoque_atual: number;
  giro_mensal: number;
  media_giro_trimestre: number;
  valor_ultima_entrada: number;
  data_ultima_entrada: string;
  previsao_fim_estoque: string;
  preco_unitario: number;
  valor_total: number;
}

export interface HistoricoStatus {
  status: StatusPedido;
  usuario_id: string;
  usuario_nome: string;
  data: string;
  observacao?: string;
}

export interface HistoricoEdicao {
  usuario_id: string;
  usuario_nome: string;
  data: string;
  campos_alterados: string[];
  observacao?: string;
}

export interface LocalEntrega {
  tipo: 'Matriz' | 'Filial';
  endereco: string;
  linkMaps: string;
}

export interface Pedido {
  _id: string;
  idCompra: string;
  numero: string;
  comprador_id: string;
  comprador_nome: string;
  fornecedor: string;
  local_entrega: LocalEntrega;
  status_atual: StatusPedido;
  itens: PedidoItem[];
  valor_total: number;
  data_criacao: string;
  data_previsao_faturamento?: string;
  numero_nota_fiscal?: string;
  data_faturamento?: string;
  valor_nota_fiscal?: number;
  data_prevista_entrega?: string;
  observacoes?: string;
  historico_status: HistoricoStatus[];
  historico_edicoes: HistoricoEdicao[];
}

export interface Item {
  id: string;
  codigo_item: string;
  descricao: string;
  tipo: string;
  id_fornecedor: number | null;
  fornecedor: string;
  unidade_medida: string;
  valorUltimaEntrada: number;
  estoque_atual: number;
  estoque_minimo: number;
  classe_abc: string;
  saldo_dep_aberto: number;
  saldo_dep_fechado_interno: number;
  saldo_dep_fechado_externo: number;
  giro_mensal: number;
  media_giro_trimestre: number;
  data_ultima_entrada: string;
  previsao_fim_estoque: string;
}

export interface Fornecedor {
  _id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ItemFornecedor {
  _id: string;
  codigoItem: string;
  fornecedorId: string | Fornecedor;
  valorUnitario?: number;
  prazoEntrega?: number;
  observacoes?: string;
  principal: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  total_pedidos: number;
  pedidos_em_aberto: number;
  pedidos_em_progresso: number;
  valor_total_aberto: number;
  pedidos_por_status: Array<{
    _id: StatusPedido;
    count: number;
    valor_total: number;
  }>;
  top_fornecedores: Array<{
    _id: string;
    total_pedidos: number;
    valor_total: number;
  }>;
  pedidos_recentes: Array<{
    _id: string;
    numero: string;
    fornecedor: string;
    status_atual: StatusPedido;
    valor_total: number;
    data_criacao: string;
    data_prevista_entrega?: string;
  }>;
}
