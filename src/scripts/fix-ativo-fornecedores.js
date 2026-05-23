// scripts/fix-ativo-fornecedores.js
// Adiciona ativo:true nos fornecedores que não têm o campo (registros antigos do site).
// SEGURO: só preenche onde o campo não existe. Não altera nada que já tem.
// USO: node scripts/fix-ativo-fornecedores.js

require('dotenv').config();
const { connectToDatabase, mongoose } = require('../database');
const Fornecedor = require('../src/models/fornec');   // ⚠ ajuste se o caminho for outro

async function main() {
  await connectToDatabase();
  console.log('🔍 Procurando fornecedores sem o campo "ativo"...\n');

  // Conta total e quantos não têm o campo
  const total = await Fornecedor.countDocuments({});
  const semCampo = await Fornecedor.countDocuments({ ativo: { $exists: false } });

  console.log(`   Total de fornecedores : ${total}`);
  console.log(`   Sem o campo "ativo"   : ${semCampo}`);

  if (semCampo === 0) {
    console.log('\n✅ Todos os fornecedores já têm o campo "ativo". Nada a fazer.');
  } else {
    // Adiciona ativo:true SOMENTE onde o campo não existe
    const resultado = await Fornecedor.updateMany(
      { ativo: { $exists: false } },
      { $set: { ativo: true } }
    );
    console.log(`\n✅ Atualizados ${resultado.modifiedCount} fornecedor(es) para ativo:true.`);
  }

  // Confirma o resultado final
  const ativos = await Fornecedor.countDocuments({ ativo: true });
  const inativos = await Fornecedor.countDocuments({ ativo: false });
  console.log('\n📊 Situação final:');
  console.log(`   Ativos   : ${ativos}`);
  console.log(`   Inativos : ${inativos}`);

  await mongoose.connection.close();
  console.log('\n🏁 Concluído.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
