import sql from 'mssql';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const serverAddress = process.env.ERP_SERVER || 'localhost';
const hasInstanceName = serverAddress.includes('\\');

const config: sql.config = {
  server: serverAddress,
  database: process.env.ERP_DATABASE || 'ERP_DB',
  user: process.env.ERP_USER || 'sa',
  password: process.env.ERP_PASSWORD || '',
  // Don't specify port when using instance name (e.g., SERVER\INSTANCE)
  ...(hasInstanceName ? {} : { port: parseInt(process.env.ERP_PORT || '1433') }),
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

// Query completa do relatório 316 - Atualizada com Fornecedores
export const getItemsQuery = (): string => {
  return `
    WITH UltimoPorFornecedor AS (
        SELECT
            M00.M00_ENTSAI,
            M01.M01_ID_E02,
            E02.E02_DESC,
            M00.M00_ID_A00 AS Id_Fornecedor,
            RTRIM(UPPER(A00.A00_FANTASIA)) AS FORNECEDOR,
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
          AND M00.M00_STATUS = 'N'
          AND E02.E02_TIPO IN (1, 2, 7, 10)
          AND M01.M01_ID_E02 <> 1
          AND E02.E02_ATIVO = 1
          AND E01.E01_DESC <> 'Outros'
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
        GROUP BY P21.P21_ID_E02
    ),
    EstoqueSaldo AS (
        SELECT
            E03_ID_E02,
            SUM(CASE WHEN E03_ID_E00 = 1 THEN ISNULL(E03_SLDQTD, 0) ELSE 0 END) AS SALDO_DEP_1,
            SUM(CASE WHEN E03_ID_E00 = 7 THEN ISNULL(E03_SLDQTD, 0) ELSE 0 END) AS SALDO_DEP_7,
            SUM(CASE WHEN E03_ID_E00 = 8 THEN ISNULL(E03_SLDQTD, 0) ELSE 0 END) AS SALDO_DEP_8
        FROM E03
        WHERE E03_ID_E00 IN (1, 7, 8)
        GROUP BY E03_ID_E02
    )
    SELECT
        upf.TIPO_DESC AS Tipo,
        upf.Id_Fornecedor,
        ISNULL(upf.FORNECEDOR, 'SEM FORNECEDOR') AS Fornecedor,
        upf.M01_ID_E02 AS Cod,
        upf.E02_DESC AS Descricao,
        
        FORMAT(ISNULL(es.SALDO_DEP_1, 0), 'N3', 'pt-BR') AS [Dep. Aberto],
        FORMAT(ISNULL(es.SALDO_DEP_7, 0), 'N3', 'pt-BR') AS [Dep. Fechado (Interno)],
        FORMAT(ISNULL(es.SALDO_DEP_8, 0), 'N3', 'pt-BR') AS [Dep. Fechado (Externo)],
        FORMAT(ISNULL(es.SALDO_DEP_1 + es.SALDO_DEP_7 + es.SALDO_DEP_8, 0), 'N3', 'pt-BR') AS [Saldo Total],
        
        REPLACE(FORMAT(upf.M01_PRECOU, 'C', 'pt-BR'), 'R$', 'R$ ') AS [Valor Ult Entrada],
        CONVERT(VARCHAR, upf.M00_ENTSAI, 103) AS [Dt Ult Entrada],
        
        FORMAT(ISNULL(ge.GIRO_30_DIAS, 0), 'N3', 'pt-BR') AS [Giro Mensal],
        FORMAT(ISNULL(ge.MEDIA_GIRO_TRIMESTRE, 0), 'N3', 'pt-BR') AS [Média Giro Trimestre]
    
    FROM UltimoPorFornecedor upf
    LEFT JOIN GiroEstoque ge ON upf.M01_ID_E02 = ge.P21_ID_E02
    LEFT JOIN EstoqueSaldo es ON upf.M01_ID_E02 = es.E03_ID_E02
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
