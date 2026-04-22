import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import { Pedido } from '../types';

interface HistoricoCompra {
  codigo: string;
  descricao: string;
  fornecedor: string;
  data_entrada: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface Props {
  pedido: Pedido;
}

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea',
  '#0891b2', '#ca8a04', '#db2777', '#475569', '#65a30d',
  '#7c3aed', '#0d9488', '#b91c1c', '#c2410c', '#4f46e5',
];

function parseDate(s: string): Date | null {
  if (!s) return null;
  // ISO format
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function PedidoPriceAnalysisChart({ pedido }: Props) {
  const [historicos, setHistoricos] = useState<Record<string, HistoricoCompra[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCodigos, setSelectedCodigos] = useState<Set<string>>(
    new Set(pedido.itens.map((i) => i.codigo_item))
  );

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      setLoading(true);
      const result: Record<string, HistoricoCompra[]> = {};
      await Promise.all(
        pedido.itens.map(async (item) => {
          const codigoNum = parseInt(item.codigo_item, 10);
          if (isNaN(codigoNum)) return;
          try {
            const res = await api.get<HistoricoCompra[]>(`/items/historico-compras/${codigoNum}`);
            result[item.codigo_item] = res.data || [];
          } catch {
            result[item.codigo_item] = [];
          }
        })
      );
      if (!cancelled) {
        setHistoricos(result);
        setLoading(false);
      }
    };
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [pedido._id]);

  // Monta dados do gráfico: 4 pontos (Compra -3, -2, -1, Atual) com chave por codigo_item
  const chartData = useMemo(() => {
    const rows: Array<Record<string, number | string>> = [
      { label: 'Compra -3' },
      { label: 'Compra -2' },
      { label: 'Compra -1' },
      { label: 'Atual' },
    ];

    const dataCriacaoPedido = parseDate(pedido.data_criacao);

    pedido.itens.forEach((item) => {
      if (!selectedCodigos.has(item.codigo_item)) return;

      const historico = historicos[item.codigo_item] || [];
      // Excluir entradas posteriores à criação do pedido (evita duplicar o pedido atual)
      const filtrados = historico.filter((h) => {
        const d = parseDate(h.data_entrada);
        if (!d || !dataCriacaoPedido) return true;
        return d.getTime() <= dataCriacaoPedido.getTime();
      });

      // Ordenar por data desc, pegar os 3 mais recentes, depois inverter para asc
      const ordenados = [...filtrados].sort((a, b) => {
        const da = parseDate(a.data_entrada)?.getTime() || 0;
        const db = parseDate(b.data_entrada)?.getTime() || 0;
        return db - da;
      });
      const ultimas3 = ordenados.slice(0, 3).reverse();

      // Preencher pontos: posições 0,1,2 são as 3 últimas compras; posição 3 é o pedido atual
      const offset = 3 - ultimas3.length; // se tiver só 1 ou 2 compras, deixa buracos à esquerda
      ultimas3.forEach((h, i) => {
        rows[offset + i][item.codigo_item] = Number(h.valor_unitario) || 0;
        rows[offset + i][`${item.codigo_item}__data`] = formatDate(parseDate(h.data_entrada));
        rows[offset + i][`${item.codigo_item}__fornecedor`] = h.fornecedor || '';
      });
      rows[3][item.codigo_item] = Number(item.preco_unitario) || 0;
      rows[3][`${item.codigo_item}__data`] = formatDate(dataCriacaoPedido);
      rows[3][`${item.codigo_item}__fornecedor`] = pedido.fornecedor || '';
    });

    return rows;
  }, [historicos, selectedCodigos, pedido]);

  const toggleCodigo = (codigo: string) => {
    const next = new Set(selectedCodigos);
    if (next.has(codigo)) next.delete(codigo);
    else next.add(codigo);
    setSelectedCodigos(next);
  };

  const selectAll = () => setSelectedCodigos(new Set(pedido.itens.map((i) => i.codigo_item)));
  const selectNone = () => setSelectedCodigos(new Set());

  // Map código -> descrição (para legenda)
  const descricaoByCodigo = useMemo(() => {
    const m: Record<string, string> = {};
    pedido.itens.forEach((i) => {
      m[i.codigo_item] = i.descricao;
    });
    return m;
  }, [pedido]);

  const itensSelecionados = pedido.itens.filter((i) => selectedCodigos.has(i.codigo_item));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">
        📈 Análise de Preço — Comparativo com as 3 Últimas Compras
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Preço unitário pago nas 3 compras anteriores de cada item vs. preço deste pedido.
        Cada linha representa um produto.
      </p>

      {/* Filtro de produtos */}
      <div className="mb-4 border border-gray-200 rounded-lg p-3 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
            Produtos exibidos ({selectedCodigos.size}/{pedido.itens.length})
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Selecionar todos
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Limpar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 max-h-40 overflow-y-auto">
          {pedido.itens.map((item, idx) => {
            const cor = COLORS[idx % COLORS.length];
            const checked = selectedCodigos.has(item.codigo_item);
            return (
              <label
                key={item.codigo_item}
                className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white rounded px-1 py-0.5"
                title={item.descricao}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCodigo(item.codigo_item)}
                  className="rounded"
                />
                <span
                  className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: checked ? cor : '#d1d5db' }}
                />
                <span className="truncate">
                  <span className="font-mono text-gray-500">{item.codigo_item}</span>{' '}
                  {item.descricao}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Gráfico */}
      {loading ? (
        <div className="h-80 flex items-center justify-center text-gray-500">
          Carregando histórico de compras...
        </div>
      ) : itensSelecionados.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-gray-500">
          Selecione ao menos um produto para exibir o gráfico.
        </div>
      ) : (
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis
                tickFormatter={(v) =>
                  `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                }
              />
              <Tooltip
                formatter={(value: number, name: string, entry: any) => {
                  const descricao = descricaoByCodigo[name] || name;
                  const payload = entry?.payload || {};
                  const data = payload[`${name}__data`];
                  const fornecedor = payload[`${name}__fornecedor`];
                  const preco = `R$ ${Number(value).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`;
                  const extras = [data, fornecedor].filter(Boolean).join(' · ');
                  return [extras ? `${preco}  (${extras})` : preco, `${name} — ${descricao}`];
                }}
              />
              <Legend
                formatter={(value: string) =>
                  `${value} — ${(descricaoByCodigo[value] || '').slice(0, 30)}`
                }
                wrapperStyle={{ fontSize: '11px', maxHeight: '80px', overflowY: 'auto' }}
              />
              {itensSelecionados.map((item) => {
                const idx = pedido.itens.findIndex((i) => i.codigo_item === item.codigo_item);
                const cor = COLORS[idx % COLORS.length];
                return (
                  <Line
                    key={item.codigo_item}
                    type="monotone"
                    dataKey={item.codigo_item}
                    stroke={cor}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
