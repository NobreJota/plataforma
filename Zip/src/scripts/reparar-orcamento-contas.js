// scripts/reparar-orcamento-contas.js
// Reativa as contas do orçamento que foram desativadas por engano (bug do filtro).
// Mostra o estado antes e reativa TODAS para você re-vincular corretamente.
// USO: node scripts/reparar-orcamento-contas.js

require('dotenv').config();
const { connectToDatabase, mongoose } = require('../database');
const OrcamentoConta = require('../src/models/financeiro/orcamentoConta');

async function main() {
  await connectToDatabase();
  console.log('\n🔧 REPARO DAS CONTAS DO ORÇAMENTO\n');

  const todas = await OrcamentoConta.find({}).sort({ codigo: 1 }).lean();
  console.log(`Total de contas vinculadas: ${todas.length}\n`);

  console.log('Estado atual:');
  todas.forEach(c => {
    const flag = c.ativo ? '✅ ativo' : '❌ inativo';
    console.log(`   ${flag}  ${c.codigo}  ${c.nome}`);
  });

  const inativas = todas.filter(c => !c.ativo);
  if (inativas.length === 0) {
    console.log('\n✅ Nenhuma conta inativa. Nada a reparar.');
  } else {
    console.log(`\n🔧 Reativando ${inativas.length} conta(s) que estavam inativas...`);
    const r = await OrcamentoConta.updateMany(
      { ativo: false },
      { $set: { ativo: true } }
    );
    console.log(`✅ ${r.modifiedCount} conta(s) reativada(s).`);
    console.log('\nAgora todas estão ativas. Se quiser desativar alguma de propósito,');
    console.log('use o modal de vincular (desmarcando) com o código corrigido.');
  }

  await mongoose.connection.close();
  console.log('\n🏁 Concluído.\n');
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
