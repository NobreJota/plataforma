// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-3-bancos-que-recebem.js
// Criado em: 03/10/2026
// Alterado em: 05/10/2026 - so as contas da ARMACAO recebem: saem Augusta e Jorge
//
// Marca no cadastro de contas bancarias (_aux_contas_bancarias) quais RECEBEM
// VENDA por PIX/transferencia: campo recebeVenda = true. O select do
// fechamento da venda mostra so essas, pelo apelido; a conta contabil e a
// contaSubTitulo de cada uma.
//
// Recebem (informado em 05/10/2026): so as da Armacao
//   CB-0001 BBrasil · CB-0002 Banestes (Armacao) · CB-0003 Caixa Economica
// Nao recebem: CB-0004 Augusta · CB-0005 Jorge · CB-0006 Jorge Lessa (poupanca CEF)
//              · CB-0007 Rota ES
//
// So a Armacao. Grava so o campo recebeVenda.
//
// Uso (um comando por vez):
//   node src\scripts\VENDA-3-bancos-que-recebem.js              simulacao
//   node src\scripts\VENDA-3-bancos-que-recebem.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const RECEBEM = new Set(['CB-0001', 'CB-0002', 'CB-0003']);

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  const contas = await db.collection('_aux_contas_bancarias').find({ lojistaId: ARMACAO }).sort({ codigo: 1 }).toArray();
  const subIds = contas.map(c => c.contaSubTitulo).filter(Boolean);
  const subs = new Map((await db.collection('_contasubtitulos')
    .find({ _id: { $in: subIds } }).project({ codigo: 1, nome: 1 }).toArray())
    .map(s => [String(s._id), s]));

  const ops = [];
  console.log('\nconta     apelido            conta contábil                    recebe venda');
  for (const c of contas) {
    const quer = RECEBEM.has(c.codigo);
    const s = subs.get(String(c.contaSubTitulo));
    console.log('  ' + String(c.codigo).padEnd(8) + String(c.apelido || '').padEnd(19)
      + (s ? (s.codigo + ' ' + s.nome) : '(sem conta no plano!)').padEnd(34)
      + (quer ? 'SIM' : 'não') + (c.recebeVenda === quer ? '' : '   <- muda'));
    if (quer && !s) console.log('      ATENÇÃO: recebe venda mas não tem conta contábil ligada');
    if (c.recebeVenda !== quer) ops.push({ updateOne: { filter: { _id: c._id, lojistaId: ARMACAO }, update: { $set: { recebeVenda: quer } } } });
  }
  const faltam = [...RECEBEM].filter(cod => !contas.some(c => c.codigo === cod));
  if (faltam.length) console.log('\nATENÇÃO: não encontrei', faltam.join(', '));

  console.log('\nA mudar:', ops.length);
  if (!ops.length) { console.log('Nada a fazer.'); return; }
  if (!APLICAR) { console.log('SIMULAÇÃO — nada foi gravado. Para aplicar, repita com --aplicar'); return; }
  const r = await db.collection('_aux_contas_bancarias').bulkWrite(ops);
  console.log('Gravados:', r.modifiedCount);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
