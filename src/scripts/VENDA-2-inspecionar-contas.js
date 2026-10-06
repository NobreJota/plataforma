// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-2-inspecionar-contas.js
// Criado em: 03/10/2026
//
// SO LE. Nao grava nada.
//
// Para desenhar o FECHAMENTO DA VENDA (Parte 2) sem inventar: mostra como
// estao no banco
//   - os titulos e subtitulos do grupo 1.01 (caixa, bancos, cartoes) da Armacao
//   - o cadastro de contas bancarias (_aux_contas_bancarias)
// O nome do campo do codigo nao e presumido: o script procura o campo cujo
// valor tem cara de conta (1.01.001.001) e diz qual achou.
//
// Uso:
//   node src\scripts\VENDA-2-inspecionar-contas.js
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const CONTA = /^\d+\.\d+(\.\d+)*$/;

// acha o campo de codigo e o de nome olhando os documentos
function campos(docs) {
  const contaCod = {}, contaNome = {};
  for (const d of docs.slice(0, 200)) {
    for (const [k, v] of Object.entries(d)) {
      if (typeof v !== 'string') continue;
      if (CONTA.test(v.trim())) contaCod[k] = (contaCod[k] || 0) + 1;
      else if (/nome|descr|titulo|nm/i.test(k) && v.trim()) contaNome[k] = (contaNome[k] || 0) + 1;
    }
  }
  const melhor = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { cod: melhor(contaCod), nome: melhor(contaNome), candidatosCod: contaCod };
}

async function plano(db, nomeCol) {
  const col = db.collection(nomeCol);
  const total = await col.countDocuments({});
  const daLoja = await col.countDocuments({ lojistaId: ARMACAO });
  const amostra = await col.find(daLoja ? { lojistaId: ARMACAO } : {}).limit(300).toArray();
  const c = campos(amostra);
  console.log('\n=== ' + nomeCol + ' ===  total ' + total + ' · da Armação (lojistaId) ' + daLoja);
  console.log('campo do código:', c.cod, '· campo do nome:', c.nome, '· candidatos:', JSON.stringify(c.candidatosCod));
  if (amostra[0]) console.log('campos de um documento:', Object.keys(amostra[0]).join(', '));
  if (!c.cod) return;

  const filtro = { [c.cod]: /^1\.01\./ };
  if (daLoja) filtro.lojistaId = ARMACAO;
  const docs = await col.find(filtro).sort({ [c.cod]: 1 }).limit(200).toArray();
  console.log('contas 1.01.* (' + docs.length + '):');
  for (const d of docs) {
    const extra = Object.entries(d)
      .filter(([k]) => !['_id', c.cod, c.nome, 'lojistaId', '__v', 'createdAt', 'updatedAt'].includes(k))
      .map(([k, v]) => k + '=' + (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 24)))
      .join('  ');
    console.log('   ' + String(d[c.cod]).padEnd(16) + String(d[c.nome] ?? '').slice(0, 34).padEnd(36) + extra);
  }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  await plano(db, '_contatitulos');
  await plano(db, '_contasubtitulos');

  const cb = db.collection('_aux_contas_bancarias');
  const docs = await cb.find({}).limit(40).toArray();
  console.log('\n=== _aux_contas_bancarias ===  ' + await cb.countDocuments({}) + ' documentos');
  for (const d of docs) {
    console.log('   ' + Object.entries(d)
      .filter(([k]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(k))
      .map(([k, v]) => k + '=' + (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 28)))
      .join('  '));
  }
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
