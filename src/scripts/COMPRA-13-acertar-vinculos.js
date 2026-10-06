// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-13-acertar-vinculos.js
// Criado em: 30/09/2026
//
// Acerto pontual de vinculos[].ncontabil depois do COMPRA-12 (versao antiga,
// que decidiu a Rinnai pelo CNPJ e deixou o Komgroup sem conta):
//
//   Rinnai   47.173.950/0001-81   -> 2.01.001.074  (compra; .159 e assistencia)
//   Komgroup 06.114.935/0015-80   -> 2.01.001.160  (provisorio; mesma empresa
//                                                    da Asia .056 — decidir depois)
//
// Confere se a conta existe no plano desta empresa e se outro fornecedor ja
// usa a mesma conta. Backup EJSON antes de aplicar.
//
// Uso (um comando por vez):
//   node src/scripts/COMPRA-13-acertar-vinculos.js
//   node src/scripts/COMPRA-13-acertar-vinculos.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const LOJISTA = '6892706a86509313e632f717';

const ACERTOS = [
  { cnpj: '47173950000181', conta: '2.01.001.074', nome: 'Rinnai' },
  { cnpj: '06114935001580', conta: '2.01.001.160', nome: 'Komgroup' },
];

(async function () {
  const aplicar = process.argv.includes('--aplicar');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const planos = [];
  let problema = false;

  for (const a of ACERTOS) {
    const f = await db.collection('fornecs').findOne({ cnpj: a.cnpj });
    if (!f) { console.log(a.nome.padEnd(10), 'CNPJ', a.cnpj, 'NAO encontrado em fornecs'); problema = true; continue; }

    const v = (f.vinculos || []).find(x => String(x.lojistaId) === LOJISTA);
    if (!v) { console.log(a.nome.padEnd(10), 'sem vinculo com esta empresa'); problema = true; continue; }

    const conta = await db.collection('_contasubtitulos').findOne({ lojistaId, codigo: a.conta });
    const outro = await db.collection('fornecs').findOne({
      _id: { $ne: f._id },
      vinculos: { $elemMatch: { lojistaId, ncontabil: a.conta } },
    });

    console.log(a.nome.padEnd(10), v.ncontabil, '->', a.conta,
      conta ? '| ' + conta.nome + (conta.ativo === false ? ' (SUSPENSA)' : '') : '| *** CONTA NAO EXISTE ***',
      outro ? '| *** JA USADA POR ' + outro.razao + ' ***' : '');

    if (!conta || outro) { problema = true; continue; }
    if (v.ncontabil !== a.conta) planos.push({ f, conta: a.conta, contaDoc: conta });
  }

  if (problema) { console.log('\nHa problema acima. Nada sera gravado.'); return; }
  if (!planos.length) { console.log('\nJa esta tudo certo.'); return; }
  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup');
  fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, 'COMPRA-13-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify(planos.map(p => p.f), null, 2, { relaxed: false }));
  console.log('\nBackup:', arq);

  for (const p of planos) {
    await db.collection('fornecs').updateOne(
      { _id: p.f._id },
      { $set: { 'vinculos.$[v].ncontabil': p.conta, updateAt: new Date() } },
      { arrayFilters: [{ 'v.lojistaId': lojistaId }] },
    );
    // conta suspensa (Ativado <> 1 no Access) volta a ativa: tem fornecedor ligado
    if (p.contaDoc.ativo === false) {
      await db.collection('_contasubtitulos').updateOne(
        { _id: p.contaDoc._id }, { $set: { ativo: true, atualizadoEm: new Date() } });
      console.log('conta', p.conta, 'reativada');
    }
    console.log('religado:', p.f.razao, '->', p.conta);
  }

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
