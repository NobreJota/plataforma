// =============================================================================
// Destino: C:\plataformaRota\src\scripts\FLUXO-4-cartoes-pos6.js
// Criado em: 23/10/2026 (Jorge)
//
// POS 6 = CARTOES A RECEBER DA OPERADORA. As parcelas de cartao (conta 1.01.005.xxx) que nasceram com
// pos 5 (fechamento da venda com debito/credito, antes de 23/10/2026) passam para pos 6. O pos 5 fica so
// para o titulo a receber do cliente.
//
// Mexe em _fluxo_projetado: pos 5 + codigoConta 1.01.005.xxx -> pos 6 (todas as situacoes: em aberto,
// recebidas e canceladas, para a historia ficar igual). Nada mais muda.
//
// Uso (na pasta C:\plataformaRota, um comando por vez):
//   node src\scripts\FLUXO-4-cartoes-pos6.js              simulacao: conta e lista, nao grava
//   node src\scripts\FLUXO-4-cartoes-pos6.js --aplicar    grava (backup EJSON antes, em src\scripts\backup\)
//
// Roda na base do MONGO_URI do .env. 24/10/2026: --base rotaes_ensaio escolhe a base sem mexer no .env:
//   node src\scripts\FLUXO-4-cartoes-pos6.js --base rotaes_ensaio
//   node src\scripts\FLUXO-4-cartoes-pos6.js --base rotaes_ensaio --aplicar
// Rodar de novo nao estraga: o que ja e pos 6 nao e encontrado.
// =============================================================================
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const iBase = process.argv.indexOf('--base');
const BASE = iBase > 0 ? String(process.argv[iBase + 1] || '').trim() : '';
const FILTRO = { pos: 5, codigoConta: /^1\.01\.005\./ };

(async () => {
  if (!process.env.MONGO_URI) { console.error('MONGO_URI não está no .env'); process.exit(1); }
  if (iBase > 0 && !/^[A-Za-z0-9_-]+$/.test(BASE)) { console.error('Use: --base rotaes_ensaio'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI, BASE ? { dbName: BASE } : {});
  const db = mongoose.connection.db;
  console.log('Base:', db.databaseName, APLICAR ? '— APLICAR' : '— simulação (nada é gravado)');
  const F = db.collection('_fluxo_projetado');

  const docs = await F.find(FILTRO).sort({ vencimento: 1 }).toArray();
  const porSit = {};
  for (const d of docs) porSit[d.status || '?'] = (porSit[d.status || '?'] || 0) + 1;
  console.log('\nParcelas de cartão com pos 5:', docs.length, porSit);
  const total = docs.filter(d => d.status === 'ATIVO').reduce((s, d) => s + Math.abs(d.valor || 0), 0);
  console.log('Em aberto: R$', total.toFixed(2).replace('.', ','));
  for (const d of docs.slice(0, 40)) {
    const v = d.vencimento ? new Date(d.vencimento).toISOString().slice(0, 10) : '          ';
    console.log(' ', v, String(d.codigoConta).padEnd(13), String(d.status).padEnd(9),
      String(Math.abs(d.valor || 0).toFixed(2)).padStart(10), ' ', String(d.historico || '').slice(0, 60));
  }
  if (docs.length > 40) console.log('  … e mais', docs.length - 40);

  if (!docs.length) { console.log('\nNada a fazer.'); await mongoose.disconnect(); return; }
  if (!APLICAR) { console.log('\nSimulação. Para gravar: node src\\scripts\\FLUXO-4-cartoes-pos6.js --aplicar'); await mongoose.disconnect(); return; }

  // backup EJSON (guarda ObjectId e datas)
  const EJSON = mongoose.mongo.BSON.EJSON;
  const pasta = path.join(__dirname, 'backup');
  fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, 'FLUXO-4-' + db.databaseName + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify(docs, null, 1, { relaxed: false }));
  console.log('\nBackup:', arq);

  const r = await F.updateMany({ _id: { $in: docs.map(d => d._id) }, pos: 5 }, { $set: { pos: 6, atualizadoEm: new Date() } });
  console.log('Passaram para pos 6:', r.modifiedCount, 'de', docs.length);
  const sobra = await F.countDocuments(FILTRO);
  console.log(sobra ? '⚠ ainda há ' + sobra + ' com pos 5' : '✓ nenhuma parcela de cartão com pos 5');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
