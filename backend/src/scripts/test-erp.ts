import * as dotenv from 'dotenv';
import { getERPConnection, executeERPQuery, getItemsQuery } from '../services/erp.service';

// Load environment variables
dotenv.config();

async function testERPConnection() {
  console.log('🔍 Testando conexão com ERP SQL Server...\n');
  console.log(`Server: ${process.env.ERP_SERVER}`);
  console.log(`Database: ${process.env.ERP_DATABASE}`);
  console.log(`User: ${process.env.ERP_USER}\n`);
  
  try {
    console.log('Tentando conectar...');
    const connection = await getERPConnection();
    console.log('✅ Conexão estabelecida com sucesso!\n');
    
    console.log('Executando query de itens...');
    const query = getItemsQuery();
    const items = await executeERPQuery(query);
    
    console.log(`✅ Query executada com sucesso!`);
    console.log(`📊 Total de itens retornados: ${items.length}\n`);
    
    if (items.length > 0) {
      console.log('📦 Primeiros 3 itens:');
      items.slice(0, 3).forEach((item: any, index: number) => {
        console.log(`\n${index + 1}. Item ${item.Cod}:`);
        console.log(`   Descrição: ${item.Descricao}`);
        console.log(`   Estoque Total: ${item['Total Saldo']}`);
        console.log(`   Valor Última Entrada: R$ ${item['Valor Ult Entrada']}`);
        console.log(`   Giro Mensal: ${item['Giro Mensal']}`);
      });
    }
    
    console.log('\n✅ Teste concluído com sucesso!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erro ao conectar/consultar ERP:');
    console.error(error);
    process.exit(1);
  }
}

testERPConnection();
