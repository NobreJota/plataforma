// scripts/diag-despesas.js
// Diagnóstico: mostra ContaTítulos e SubTítulos de despesa (código 3.x)
// USO: node scripts/diag-despesas.js

require('dotenv').config();
const { connectToDatabase, mongoose } = require('../database');
const ContaTitulo = require('../src/models/contaTitulo');
const ContaSubTitulo = require('../src/models/contaSubTitulo');

async function main() {
  await connectToDatabase();
  console.log('\n📊 DIAGNÓSTICO DAS DESPESAS (grupo 3)\n');

  // ContaTítulos de despesa
  const titulos = await ContaTitulo.find({ codigo: /^3\./ }).sort({ codigo: 1 }).lean();
  console.log(`=== ContaTítulos com código 3.x: ${titulos.length} ===`);
  titulos.forEach(t => {
    console.log(`   ${t.codigo}  ${t.nome}  (ativo: ${t.ativo})`);
  });

  // SubTítulos de despesa
  const subs = await ContaSubTitulo.find({ codigo: /^3\./ }).sort({ codigo: 1 }).lean();
  console.log(`\n=== SubTítulos com código 3.x: ${subs.length} ===`);
  subs.forEach(s => {
    console.log(`   ${s.codigo}  ${s.nome}  (título: ${s.codigoContaTitulo}, ativo: ${s.ativo})`);
  });

  // Agrupa subtítulos por título para ver quais títulos têm subs
  console.log('\n=== AGRUPAMENTO (qual título tem quais subs) ===');
  const porTitulo = {};
  subs.forEach(s => {
    const k = s.codigoContaTitulo || '(sem título)';
    if (!porTitulo[k]) porTitulo[k] = [];
    porTitulo[k].push(s.nome);
  });
  Object.keys(porTitulo).sort().forEach(k => {
    const tit = titulos.find(t => t.codigo === k);
    console.log(`   ${k} (${tit?.nome || '???'}): ${porTitulo[k].length} subtítulo(s)`);
  });

  // Títulos SEM subtítulos
  console.log('\n=== Títulos SEM subtítulos (não aparecem no dropdown) ===');
  const semSub = titulos.filter(t => !porTitulo[t.codigo]);
  if (semSub.length === 0) console.log('   (nenhum — todos têm subtítulos)');
  semSub.forEach(t => console.log(`   ${t.codigo}  ${t.nome}`));

  await mongoose.connection.close();
  console.log('\n🏁 Concluído.\n');
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
