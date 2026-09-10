// src/scripts/2C-0-sincronizar-indices.js
//
// Roda DEPOIS de aplicar o PATCH-01 nos models.
//
// Por que existe: quando você troca `unique: true` de um campo por um
// índice composto no schema, o Mongoose cria o índice novo mas NÃO apaga
// o antigo. O `codigo_1` unique global continua no banco, ativo, e segue
// barrando a segunda empresa. syncIndexes() apaga os que não estão mais
// no schema e cria os que faltam.
//
// Uso:  node src/scripts/2C-0-sincronizar-indices.js
//
// Seguro de rodar mais de uma vez.

require('dotenv').config();
const path = require('path');
const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

const MODELS = [
  '../models/contab/auxiliares/cliente',
  '../models/contab/auxiliares/contaBancaria',
  '../models/contab/auxiliares/banco',
  '../models/contab/financeiro/boleta',
  '../models/contab/financeiro/compraAnual',
  '../models/contab/financeiro/compraFornecedor',
  '../models/contab/financeiro/contaSubTitulo',
  '../models/contab/financeiro/contaTitulo',
  '../models/contab/financeiro/fluxoCaixa',
  '../models/contab/financeiro/fluxoProjetado',
  '../models/contab/financeiro/historicoConta',
  '../models/contab/financeiro/orcamentoAnual',
  '../models/contab/financeiro/orcamentoConta',
  '../models/contab/financeiro/registroContabil'
];

async function listarIndices(Model) {
  try {
    return (await Model.collection.indexes()).map(i => i.name);
  } catch (err) {
    if (/ns does not exist/i.test(err.message)) return [];   // coleção ainda vazia
    throw err;
  }
}

(async () => {
  try {
    await connectToDatabase();
    console.log('');
    console.log('=== SINCRONIZANDO ÍNDICES DO CONTAB ===');
    console.log('');

    for (const caminho of MODELS) {
      const Model = require(path.join(__dirname, caminho));
      const nome  = Model.modelName;
      const col   = Model.collection.collectionName;

      // Coleção que ainda não recebeu nenhum documento não existe no Mongo,
      // e pedir os índices dela lança "ns does not exist". Isso não é erro:
      // é só uma coleção vazia. Tratamos como lista vazia.
      const antes = await listarIndices(Model);

      const removidos = await Model.syncIndexes();
      const depois = await listarIndices(Model);
      const criados = depois.filter(n => !antes.includes(n));

      const novaColecao = antes.length === 0;

      console.log(`${nome}  (${col})${novaColecao ? '   [coleção criada agora]' : ''}`);
      if (removidos.length) console.log(`   apagados: ${removidos.join(', ')}`);
      if (criados.length)   console.log(`   criados:  ${criados.join(', ')}`);
      if (!removidos.length && !criados.length) console.log('   sem mudanças');
      console.log('');
    }

    console.log('=== FIM ===');
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('');
    console.error('❌ FALHOU:', err.message);
    if (err.code === 11000) {
      console.error('');
      console.error('Índice único falhou ao ser criado: já existem documentos duplicados');
      console.error('para a chave. Rode antes o diagnóstico do PATCH-01 (seção 4) para');
      console.error('achar quais são, resolva, e rode este script de novo.');
    }
    process.exit(1);
  }
})();
