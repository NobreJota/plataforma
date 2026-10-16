// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-10-conta-espera-mao-de-obra.js
// Criado em: 15/10/2026
//
// Decisao do Jorge (15/10/2026): a divisao da mao de obra (empresa x tecnico) NAO vem
// mais da ficha do tecnico; e feita na CONCLUSAO DA OS. Enquanto isso, a mao de obra
// cobrada na nota fiscal fica numa conta de ESPERA:
//
//   2.06            Serviços                          (subgrupo, ja existe)
//   2.06.002        Serviços a Apropriar              (titulo,    _contatitulos)   NOVO
//   2.06.002.001    Mão de Obra a Apropriar - OS      (subtitulo, _contasubtitulos) NOVO
//
// Na conclusao da OS sai daqui: parte do tecnico -> 2.06.001.NNN, parte da empresa ->
// 4.05.001.001.
//
// Como no PLANO-9: cada documento novo e COPIA do irmao (titulo 2.06.001 e o primeiro
// subtitulo 2.06.001.NNN): troca codigo, nome e datas; referencia ao pai antigo passa
// para o novo. O que ja existir fica como esta.
// Confere tambem a 3.06.006.004 (Serv. Mat Complementares), que a conclusao vai usar.
//
// Uso (um comando por vez):
//   node src\scripts\PLANO-10-conta-espera-mao-de-obra.js              simulacao
//   node src\scripts\PLANO-10-conta-espera-mao-de-obra.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

const NIVEIS = [
  { col: '_contatitulos',    modelo: '2.06.001',  codigo: '2.06.002',     nome: 'Serviços a Apropriar' },
  { col: '_contasubtitulos', modelo: /^2\.06\.001\.\d+$/, codigo: '2.06.002.001', nome: 'Mão de Obra a Apropriar - OS' },
];

const mostrar = d => JSON.stringify(d, (k, v) => (v && v._bsontype === 'ObjectId' ? 'ObjectId(' + v + ')' : v));

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  const achar = async (col, codigo) => {
    const ord = { sort: { codigo: 1 } };
    return (await db.collection(col).findOne({ codigo, lojistaId: ARMACAO }, ord)) || (await db.collection(col).findOne({ codigo }, ord));
  };

  const mat = await achar('_contasubtitulos', '3.06.006.004');
  console.log('\n3.06.006.004:', mat ? 'OK  ' + mat.nome + (mat.ativo === false ? '  [INATIVA]' : '') : 'NÃO ENCONTRADA');

  const novos = [];
  let paiAntigo = null, paiNovo = null;
  for (const n of NIVEIS) {
    const modelo = await achar(n.col, n.modelo);
    if (!modelo) throw new Error(n.col + ': modelo ' + n.modelo + ' não encontrado');
    const ja = await achar(n.col, n.codigo);
    console.log('\n' + n.col + ' · modelo ' + modelo.codigo + ':\n  ' + mostrar(modelo));
    if (ja) {
      console.log('  ' + n.codigo + ' JÁ EXISTE (' + ja.nome + '): fica como está');
      paiAntigo = await achar(n.col, typeof n.modelo === 'string' ? n.modelo : modelo.codigo); paiNovo = ja;
      continue;
    }
    const agora = new Date();
    const { _id, ...resto } = modelo;
    const doc = {};
    for (const [k, v] of Object.entries(resto)) {
      if (paiAntigo && v && v.equals && v.equals(paiAntigo._id)) doc[k] = paiNovo._id;
      else if (paiAntigo && typeof v === 'string' && v === paiAntigo.codigo) doc[k] = paiNovo.codigo;
      else doc[k] = v;
    }
    doc.codigo = n.codigo;
    doc.nome = n.nome;
    if ('descricao' in doc) doc.descricao = '';
    if ('ativo' in doc) doc.ativo = true;
    if ('saldoInicial' in doc) doc.saldoInicial = 0;
    if ('saldo' in doc) doc.saldo = 0;
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
