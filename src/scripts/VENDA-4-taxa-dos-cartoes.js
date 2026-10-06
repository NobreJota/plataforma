// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-4-taxa-dos-cartoes.js
// Criado em: 03/10/2026
//
// Liga cada cartao (subtitulo 1.01.005.xxx) a conta de DESPESA da taxa que a
// operadora desconta: campo contaTaxa no subtitulo do cartao. O recebimento de
// cartao no Fluxo usa essa conta para lancar a diferenca entre o total das
// parcelas e o valor liquido que caiu no banco.
//
//   1.01.005.003 MasterCard -> 3.03.001.017 Mastercard/Juros
//   1.01.005.004 Visanet    -> 3.03.001.018 Visa / Juros
//
// Bandeira nova: acrescentar uma linha em LIGACOES e rodar de novo.
// So a Armacao. Grava so o campo contaTaxa.
//
// Uso (um comando por vez):
//   node src\scripts\VENDA-4-taxa-dos-cartoes.js              simulacao
//   node src\scripts\VENDA-4-taxa-dos-cartoes.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const LIGACOES = [
  ['1.01.005.003', '3.03.001.017'],   // MasterCard
  ['1.01.005.004', '3.03.001.018'],   // Visanet
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('_contasubtitulos');
  console.log('Banco:', mongoose.connection.db.databaseName);

  const ops = [];
  for (const [cartao, despesa] of LIGACOES) {
    const c = await col.findOne({ lojistaId: ARMACAO, codigo: cartao });
    const d = await col.findOne({ lojistaId: ARMACAO, codigo: despesa });
    console.log('\n' + cartao + ' ' + (c ? c.nome : '(NÃO ENCONTRADO)') + '  ->  ' + despesa + ' ' + (d ? d.nome : '(NÃO ENCONTRADO)'));
    if (!c || !d) { console.log('   pulado'); continue; }
    if (d.ativo === false) console.log('   ATENÇÃO: a conta de despesa está suspensa');
    if (c.contaTaxa === despesa) { console.log('   já ligado'); continue; }
    console.log('   ' + (c.contaTaxa ? 'troca ' + c.contaTaxa + ' por ' + despesa : 'liga'));
    ops.push({ updateOne: { filter: { _id: c._id, lojistaId: ARMACAO }, update: { $set: { contaTaxa: despesa } } } });
  }

  const sem = await col.find({ lojistaId: ARMACAO, codigo: /^1\.01\.005\./, ativo: { $ne: false },
                               contaTaxa: { $exists: false } }).toArray();
  const ficam = sem.filter(c => !LIGACOES.some(([k]) => k === c.codigo));
  if (ficam.length) console.log('\nCartões sem conta de taxa (recebimento com taxa recusado):', ficam.map(c => c.codigo + ' ' + c.nome).join(', '));

  console.log('\nA mudar:', ops.length);
  if (!ops.length) { console.log('Nada a fazer.'); return; }
  if (!APLICAR) { console.log('SIMULAÇÃO — nada foi gravado. Para aplicar, repita com --aplicar'); return; }
  const r = await col.bulkWrite(ops);
  console.log('Gravados:', r.modifiedCount);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
