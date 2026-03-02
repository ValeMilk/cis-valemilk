import sql from 'mssql';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const serverAddress = process.env.ERP_SERVER || 'localhost';
const hasInstanceName = serverAddress.includes('\\');
const erpPort = process.env.ERP_PORT ? parseInt(process.env.ERP_PORT) : undefined;

const config: sql.config = {
  server: serverAddress,
  database: process.env.ERP_DATABASE || 'ERP_DB',
  user: process.env.ERP_USER || 'sa',
  password: process.env.ERP_PASSWORD || '',
  // Use port if specified, even with instance name for VPN scenarios
  ...(erpPort ? { port: erpPort } : {}),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
    instanceName: hasInstanceName ? serverAddress.split('\\')[1] : undefined
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Update server to just the hostname/IP when using instance name
if (hasInstanceName) {
  config.server = serverAddress.split('\\')[0];
}

let pool: sql.ConnectionPool | null = null;

export const getERPConnection = async (): Promise<sql.ConnectionPool> => {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    console.log('🔌 Attempting connection with config:', {
      server: config.server,
      database: config.database,
      user: config.user,
      instanceName: config.options?.instanceName,
      hasPort: 'port' in config
    });
    
    pool = await sql.connect(config);
    console.log('✅ Connected to ERP SQL Server');
    return pool;
  } catch (error) {
    console.error('❌ ERP Connection Error:', error);
    throw error;
  }
};

export const executeERPQuery = async <T = any>(query: string): Promise<T[]> => {
  try {
    const connection = await getERPConnection();
    const result = await connection.request().query(query);
    return result.recordset as T[];
  } catch (error) {
    console.error('❌ ERP Query Error:', error);
    throw error;
  }
};

export const closeERPConnection = async (): Promise<void> => {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('✅ ERP Connection closed');
  }
};

// Query completa do relatório 316 - Atualizada com Fornecedores e Previsão de Fim de Estoque
export const getItemsQuery = (): string => {
  return `
    WITH UltimoPorFornecedor AS (
        SELECT
            M00.M00_ENTSAI,
            M01.M01_ID_E02,
            E02.E02_DESC,
            E02.E02_TIPO,
            M00.M00_ID_A00 AS Id_Fornecedor, 
            
            -- Regra para forçar o nome do fornecedor para os itens de tipo 7, nulos ou em branco
            CASE 
                WHEN E02.E02_TIPO = 7 THEN 'MATERIAL DE USO E CONSUMO'
                WHEN A00.A00_FANTASIA IS NULL OR LTRIM(RTRIM(A00.A00_FANTASIA)) = '' THEN 'SEM FORNECEDOR'
                ELSE RTRIM(UPPER(A00.A00_FANTASIA)) 
            END AS FORNECEDOR,
            
            CASE E02.E02_TIPO
                WHEN 0 THEN 'Mercadoria para Revenda'
                WHEN 1 THEN 'Matéria Prima'
                WHEN 2 THEN 'Embalagem'
                WHEN 3 THEN 'Produto em Processo'
                WHEN 4 THEN 'Produto Acabado'
                WHEN 5 THEN 'Subproduto'
                WHEN 6 THEN 'Produto Intermediário'
                WHEN 7 THEN 'Material de Uso e Consumo'
                WHEN 8 THEN 'Ativo Imobilizado'
                WHEN 9 THEN 'Serviços'
                WHEN 10 THEN 'Outros Insumos'
                WHEN 99 THEN 'Outros'
                ELSE 'Não Definido'
            END AS TIPO_DESC,
            M01.M01_PRECOU,
            
            ROW_NUMBER() OVER (
                PARTITION BY M01.M01_ID_E02, M00.M00_ID_A00 
                ORDER BY M00.M00_ENTSAI DESC, M00.M00_ID DESC
            ) AS rn
        FROM M00
        INNER JOIN M01 ON M00.M00_ID = M01.M01_ID_M00
        INNER JOIN E02 ON E02.E02_ID = M01.M01_ID_E02
        INNER JOIN E01 ON E01.E01_ID = E02.E02_ID_E01
        LEFT JOIN A00 ON M00.M00_ID_A00 = A00.A00_ID
        WHERE M00.M00_DTLANC >= '2023-09-01'
          AND M00.M00_ID_EMP IN (80, 81, 82)
          AND (
              M00.M00_STATUS = 'N' 
              OR (M00.M00_STATUS = 'I' AND E02.E02_TIPO = 7)
          )
          AND E02.E02_TIPO IN (1, 2, 7, 10)
          AND E02.E02_ATIVO = 1
          AND E01.E01_DESC <> 'Outros'
          AND M01.M01_ID_E02 <> 1 
    ),
    GiroEstoque AS (
        SELECT 
            P21.P21_ID_E02,
            ROUND(SUM(CASE WHEN DATEDIFF(DAY, P20.P20_DT_HR_FIM, GETDATE()) BETWEEN 0 AND 90 THEN P21.P21_REAL_QTD ELSE 0 END) / 3.0, 0) AS MEDIA_GIRO_TRIMESTRE,
            SUM(CASE WHEN DATEDIFF(DAY, P20.P20_DT_HR_FIM, GETDATE()) BETWEEN 0 AND 30 THEN P21.P21_REAL_QTD ELSE 0 END) AS GIRO_30_DIAS
        FROM P21
        INNER JOIN P20 ON P21.P21_ID_P20 = P20.P20_ID
        WHERE DATEDIFF(DAY, P20.P20_DT_HR_FIM, GETDATE()) BETWEEN 0 AND 90
          AND P20.P20_STATUS = 'F'
          AND P21.P21_ID_E02 <> 1 
        GROUP BY P21.P21_ID_E02
    ),
    GiroUsoConsumo AS (
        SELECT
            M01.M01_ID_E02,
            ROUND(SUM(CASE WHEN DATEDIFF(DAY, M00.M00_DTLANC, GETDATE()) BETWEEN 0 AND 90 THEN M01.M01_QTD ELSE 0 END) / 3.0, 0) AS MEDIA_GIRO_TRIMESTRE,
            SUM(CASE WHEN DATEDIFF(DAY, M00.M00_DTLANC, GETDATE()) BETWEEN 0 AND 30 THEN M01.M01_QTD ELSE 0 END) AS GIRO_30_DIAS
        FROM M00
        INNER JOIN M01 ON M00.M00_ID = M01.M01_ID_M00
        INNER JOIN E02 ON E02.E02_ID = M01.M01_ID_E02
        WHERE DATEDIFF(DAY, M00.M00_DTLANC, GETDATE()) BETWEEN 0 AND 90
          AND M00.M00_ID_A76 = 67
          AND E02.E02_TIPO = 7
          AND M01.M01_ID_E02 <> 1
        GROUP BY M01.M01_ID_E02
    ),
    EstoqueSaldo AS (
        SELECT
            E03_ID_E02,
            SUM(CASE WHEN E03_ID_E00 = 1 THEN ISNULL(E03_SLDQTD, 0) ELSE 0 END) AS SALDO_DEP_1,
            SUM(CASE WHEN E03_ID_E00 = 7 THEN ISNULL(E03_SLDQTD, 0) ELSE 0 END) AS SALDO_DEP_7,
            SUM(CASE WHEN E03_ID_E00 = 8 THEN ISNULL(E03_SLDQTD, 0) ELSE 0 END) AS SALDO_DEP_8
        FROM E03
        WHERE E03_ID_E00 IN (1, 7, 8)
          AND E03_ID_E02 <> 1 
        GROUP BY E03_ID_E02
    )
    SELECT
        upf.TIPO_DESC AS Tipo,
        upf.Id_Fornecedor, 
        upf.FORNECEDOR AS Fornecedor,
        upf.M01_ID_E02 AS Cod,
        upf.E02_DESC AS Descricao,
        
        FORMAT(ISNULL(es.SALDO_DEP_1, 0), 'N3', 'pt-BR') AS [Dep. Aberto],
        FORMAT(ISNULL(es.SALDO_DEP_7, 0), 'N3', 'pt-BR') AS [Dep. Fechado (Interno)],
        FORMAT(ISNULL(es.SALDO_DEP_8, 0), 'N3', 'pt-BR') AS [Dep. Fechado (Externo)],
        FORMAT(Calc1.SaldoTotal, 'N3', 'pt-BR') AS [Saldo Total],
            
  'Prev. Fim Estoque': string;
        REPLACE(FORMAT(upf.M01_PRECOU, 'C', 'pt-BR'), 'R$', 'R$ ') AS [Valor Ult Entrada],
        CONVERT(VARCHAR, upf.M00_ENTSAI, 103) AS [Dt Ult Entrada],
        
        FORMAT(Calc1.GiroMensal, 'N3', 'pt-BR') AS [Giro Mensal],
        FORMAT(Calc1.GiroTrimestral, 'N3', 'pt-BR') AS [Média Giro Trimestre],
        
        -- Lógica da Previsão de Fim de Estoque
        CASE 
            WHEN Calc1.SaldoTotal <= 0 THEN 'Sem Estoque'
            WHEN Calc2.MaiorGiro <= 0 THEN 'Sem Consumo'
            ELSE CONVERT(VARCHAR, DATEADD(DAY, CAST(CEILING((Calc1.SaldoTotal * 30.0) / Calc2.MaiorGiro) AS INT), GETDATE()), 103)
        END AS [Prev. Fim Estoque]
    
    FROM UltimoPorFornecedor upf
    LEFT JOIN GiroEstoque ge ON upf.M01_ID_E02 = ge.P21_ID_E02
    LEFT JOIN GiroUsoConsumo guc ON upf.M01_ID_E02 = guc.M01_ID_E02
    LEFT JOIN EstoqueSaldo es ON upf.M01_ID_E02 = es.E03_ID_E02
    
    -- CROSS APPLY 1: Unifica as regras de Saldo e Giro para facilitar o cálculo final
    CROSS APPLY (
        SELECT 
            ISNULL(es.SALDO_DEP_1, 0) + ISNULL(es.SALDO_DEP_7, 0) + ISNULL(es.SALDO_DEP_8, 0) AS SaldoTotal,
            ISNULL(CASE WHEN upf.E02_TIPO = 7 THEN guc.GIRO_30_DIAS ELSE ge.GIRO_30_DIAS END, 0) AS GiroMensal,
            ISNULL(CASE WHEN upf.E02_TIPO = 7 THEN guc.MEDIA_GIRO_TRIMESTRE ELSE ge.MEDIA_GIRO_TRIMESTRE END, 0) AS GiroTrimestral
    ) Calc1
    
    -- CROSS APPLY 2: Define qual é o maior giro entre o Mensal e o Trimestral
    CROSS APPLY (
        SELECT 
            CASE WHEN Calc1.GiroMensal > Calc1.GiroTrimestral THEN Calc1.GiroMensal ELSE Calc1.GiroTrimestral END AS MaiorGiro
    ) Calc2
    
    WHERE upf.rn = 1 
    ORDER BY Cod ASC, [Dt Ult Entrada] DESC;
  `;
};

export interface ERPItem {
  Tipo: string;
  Id_Fornecedor: number | null;
  Fornecedor: string;
  Cod: number;
  Descricao: string;
  'Dep. Aberto': string;
  'Dep. Fechado (Interno)': string;
  'Dep. Fechado (Externo)': string;
  'Saldo Total': string;
  'Valor Ult Entrada': string;
  'Dt Ult Entrada': string;
  'Giro Mensal': string;
  'Média Giro Trimestre': string;
}
