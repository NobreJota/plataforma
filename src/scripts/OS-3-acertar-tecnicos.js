// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-3-acertar-tecnicos.js
// Criado em: 13/10/2026
//
// Acertos pedidos pelo Jorge depois do OS-2 (so a Armacao):
//   1) "Outros" (2.06.001.004) sai do cadastro de tecnicos (_tecnicos). Nao tem conta
//      no plano (nem 2.06.001.004 nem 4.03.002.004). Backup EJSON do documento antes.
//      Se alguma OS ou venda da plataforma usar 2.06.001.004, o script PARA e lista.
//   2) Cria a conta 2.06.001.010 "Cristiane" no titulo 2.06.001 (a receita
//      4.03.002.010 ja existe). Se ja existir, nao faz nada.
//
// Uso (um comando por vez):
//   node src\scripts\OS-3-acertar-tecnicos.js              simulacao
//   node src\scripts\OS-3-acertar-tecnicos.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const CONTA_OUTROS = '2.06.001.004';
const CONTA_CRISTIANE = '2.06.001.010', NOME_CRISTIANE = 'Cristiane';

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  // ---- 1) Outros ----
  const outros = await db.collection('_tecnicos').find({ lojistaId: ARMACAO, contaTecnico: CONTA_OUTROS }).toArray();
  const usoOS = await db.collection('_ordens_servico').countDocuments({ lojistaId: ARMACAO, tecnicoConta: CONTA_OUTROS });
  const usoVenda = await db.collection('_vendas').countDocuments({ lojistaId: ARMACAO, 'instalacao.tecnicoConta': CONTA_OUTROS });
  console.log('\n1) Outros (' + CONTA_OUTROS + '): no cadastro', outros.length, '· OS usando', usoOS, '· vendas usando', usoVenda);
  outros.forEach(x => console.log('   ' + x.numero + ' · ' + x.nome + ' · origem ' + (x.origem || '-')));
  if (usoOS || usoVenda) throw new Error('há OS/venda com ' + CONTA_OUTROS + ': troque o técnico nelas antes de tirar o "Outros"');

  // ---- 2) Cristiane ----
  const titulo = await db.collection('_contatitulos').findOne({ lojistaId: ARMACAO, codigo: '2.06.001' });
  if (!titulo) throw new Error('título 2.06.001 não encontrado');
  const jaTem = await db.collection('_contasubtitulos').findOne({ lojistaId: ARMACAO, codigo: CONTA_CRISTIANE });
  const receita = await db.collection('_contasubtitulos').findOne({ lojistaId: ARMACAO, codigo: '4.03.002.010' });
  console.log('\n2) ' + CONTA_CRISTIANE + ':', jaTem ? 'já existe (' + jaTem.nome + ')' : 'CRIAR "' + NOME_CRISTIANE + '" em 2.06.001 ' + (titulo.nome || ''));
  console.log('   receita 4.03.002.010:', receita ? receita.nome : 'NÃO existe');

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); return; }

  if (outros.length) {
    const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
    const pasta = path.join(__dirname, 'backup');
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'OS-3-tecnico-outros-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
    fs.writeFileSync(arq, EJSON.stringify(outros, null, 1, { relaxed: false }));
    const r = await db.collection('_tecnicos').deleteMany({ lojistaId: ARMACAO, contaTecnico: CONTA_OUTROS });
    console.log('\nBackup:', arq, '\n"Outros" tirado do cadastro:', r.deletedCount);
  }
  if (!jaTem) {
    const agora = new Date();
    await db.collection('_contasubtitulos').insertOne({
      contaTituloId: titulo._id, codigoContaTitulo: '2.06.001', codigo: CONTA_CRISTIANE, nome: NOME_CRISTIANE, descricao: 'técnico',
      saldoInicial: 0, natureza: 'credora', ativo: true, criadoEm: agora, atualizadoEm: agora, __v: 0, lojistaId: ARMACAO,
    });
    console.log('Conta criada:', CONTA_CRISTIANE, NOME_CRISTIANE);
  }
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
