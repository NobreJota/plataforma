// scripts/fix-duplicatas-fornecedores.js
// Remove fornecedores duplicados (mesmo CPF/CNPJ) e cria índice único.

require('dotenv').config();
const { connectToDatabase, mongoose } = require('../database');
const Fornecedor = require('../src/models/auxiliares/fornecedor');

async function main() {
  await connectToDatabase();
  console.log('🔍 Procurando fornecedores duplicados...');

  const duplicados = await Fornecedor.aggregate([
    { $group: {
        _id: '$cpfCnpj',
        ids: { $push: '$_id' },
        codigos: { $push: '$codigo' },
        nomes: { $push: '$nome' },
        total: { $sum: 1 }
    }},
    { $match: { total: { $gt: 1 } } }
  ]);

  if (duplicados.length === 0) {
    console.log('✅ Nenhuma duplicata encontrada.');
  } else {
    console.log(`⚠️  Encontradas ${duplicados.length} duplicatas:`);
    for (const dup of duplicados) {
      console.log(`\n   CPF/CNPJ: ${dup._id}`);
      dup.codigos.forEach((c, i) => {
        console.log(`     - ${c}: ${dup.nomes[i]} (id ${dup.ids[i]})`);
      });
      const idsParaApagar = dup.ids.slice(1);
      console.log(`   ➜ mantendo ${dup.codigos[0]}, apagando ${idsParaApagar.length} duplicata(s)`);
      await Fornecedor.deleteMany({ _id: { $in: idsParaApagar } });
    }
    console.log('\n✅ Duplicatas removidas.');
  }

  console.log('\n🔧 Criando índice único em cpfCnpj...');
  try {
    await Fornecedor.collection.createIndex(
      { cpfCnpj: 1 },
      { unique: true, name: 'cpfCnpj_unique' }
    );
    console.log('✅ Índice único criado/garantido.');
  } catch (err) {
    if (err.code === 85) {
      console.log('ℹ️  Índice já existe com outra config — recriando...');
      try { await Fornecedor.collection.dropIndex('cpfCnpj_1'); } catch (_) {}
      await Fornecedor.collection.createIndex(
        { cpfCnpj: 1 },
        { unique: true, name: 'cpfCnpj_unique' }
      );
      console.log('✅ Índice recriado.');
    } else {
      throw err;
    }
  }

  const indices = await Fornecedor.collection.indexes();
  console.log('\n📑 Índices atuais em _aux_fornecedores:');
  indices.forEach(idx => console.log('   -', idx.name, JSON.stringify(idx.key), idx.unique ? '[UNIQUE]' : ''));

  await mongoose.connection.close();
  console.log('\n🏁 Concluído.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
