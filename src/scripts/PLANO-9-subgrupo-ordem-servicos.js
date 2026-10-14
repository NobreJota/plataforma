// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-9-subgrupo-ordem-servicos.js
// Criado em: 13/10/2026
//
// Decisao do Jorge (13/10/2026): UMA conta so para a receita de servico da loja,
// num subgrupo novo, para nao conflitar com as 4.03.002.NNN antigas (uma por tecnico):
//
//   4.05            Ordem de Serviços                 (subgrupo, colecao subgrupos)
//   4.05.001        Receita de Serviços               (titulo,   _contatitulos)
//   4.05.001.001    Receita de Serviços - OS          (subtitulo, _contasubtitulos)
//
// O historico do lancamento leva "OS nº ... / tecnico ...". A conta do tecnico
// (2.06.001.NNN) continua uma por tecnico (e o que a loja deve a ele).
//
// Como os campos de cada colecao nao sao os mesmos, cada documento novo e COPIA do
// irmao do 4.04 (subgrupo 4.04, titulo 4.04.001, subtitulo 4.04.001.001): troca
// codigo, nome e datas, e toda referencia ao pai antigo (o _id ou o codigo dele)
// passa para o pai novo. A simulacao mostra os documentos-modelo e os novos.
// O que ja existir (mesmo codigo) fica como esta.
//
// Uso (um comando por vez):
//   node src\scripts\PLANO-9-subgrupo-ordem-servicos.js              simulacao
//   node src\scripts\PLANO-9-subgrupo-ordem-servicos.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

const NIVEIS = [
  { col: 'subgrupos',        modelo: '4.04',         codigo: '4.05',         nome: 'Ordem de Serviços' },
  { col: '_contatitulos',    modelo: '4.04.001',     codigo: '4.05.001',     nome: 'Receita de Serviços' },
  { col: '_contasubtitulos', modelo: '4.04.001.001', codigo: '4.05.001.001', nome: 'Receita de Serviços - OS' },
];

const mostrar = d => JSON.stringify(d, (k, v) => (v && v._bsontype === 'ObjectId' ? 'ObjectId(' + v + ')' : v));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  // o subgrupo pode nao ter lojistaId (plano comum): procura com e sem
  const achar = async (col, codigo) =>
    (await db.collection(col).findOne({ codigo, lojistaId: ARMACAO })) || (await db.collection(col).findOne({ codigo }));

  const novos = [];
  let paiAntigo = null, paiNovo = null;      // { _id, codigo } do nivel de cima
  for (const n of NIVEIS) {
    const modelo = await achar(n.col, n.modelo);
    if (!modelo) throw new Error(n.col + ': modelo ' + n.modelo + ' não encontrado');
    const ja = await achar(n.col, n.codigo);
    console.log('\n' + n.col + ' · modelo ' + n.modelo + ':\n  ' + mostrar(modelo));
    if (ja) {
      console.log('  ' + n.codigo + ' JÁ EXISTE (' + ja.nome + '): fica como está');
      paiAntigo = modelo; paiNovo = ja;
      continue;
    }
    const agora = new Date();
    const { _id, ...resto } = modelo;
    const doc = {};
    for (const [k, v] of Object.entries(resto)) {
      if (paiAntigo && v && v.equals && v.equals(paiAntigo._id)) doc[k] = paiNovo._id;           // ref. ao pai por _id
      else if (paiAntigo && typeof v === 'string' && v === paiAntigo.codigo) doc[k] = paiNovo.codigo; // ref. ao pai por codigo
      else doc[k] = v;
    }
    doc.codigo = n.codigo;
    doc.nome = n.nome;
    if ('descricao' in doc) doc.descricao = '';
    if ('ativo' in doc) doc.ativo = true;
    if ('saldoInicial' in doc) doc.saldoInicial = 0;
    if ('natureza' in doc) doc.natureza = 'credora';
    for (const k of ['criadoEm', 'atualizadoEm', 'createdAt', 'updatedAt']) if (k in doc) doc[k] = agora;
    doc._id = new mongoose.Types.ObjectId();
    console.log('  NOVO ' + n.codigo + ':\n  ' + mostrar(doc));
    novos.push({ col: n.col, doc });
    paiAntigo = modelo; paiNovo = doc;
  }

  if (!novos.length) { console.log('\nNada a fazer.'); return; }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Confira os campos acima. Para gravar: --aplicar'); return; }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const n of novos) await db.collection(n.col).insertOne(n.doc, { session });
    });
  } finally { session.endSession(); }
  novos.forEach(n => console.log('Criado:', n.col, n.doc.codigo, n.doc.nome));
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
