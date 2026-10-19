// =============================================================================
// Destino: C:\plataformaRota\src\scripts\ENSAIO-0-copiar-base.js
// Criado em: 18/10/2026
//
// ENSAIO DO DIA "D" — passo 0: COPIA a base atual (a do MONGO_URI do .env) para uma base de
// ensaio no MESMO servidor. A base atual NAO e mexida (so lida). Na base de ensaio, cada
// colecao e apagada e copiada de novo (com os indices).
//
// Depois de copiar: trocar no .env o nome da base no MONGO_URI (o script mostra como fica) e
// reiniciar o servidor. Para voltar: o MONGO_URI antigo.
// Seguranca: o destino TEM que ter "ensaio" no nome e nao pode ser a base atual.
//
// Uso (um comando por vez):
//   node src\scripts\ENSAIO-0-copiar-base.js --destino rotaes_ensaio              simulacao
//   node src\scripts\ENSAIO-0-copiar-base.js --destino rotaes_ensaio --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const i = args.indexOf('--destino');
const DESTINO = i >= 0 ? String(args[i + 1] || '') : '';
const LOTE = 1000;

const mascarar = uri => String(uri).replace(/\/\/([^:@/]+):([^@/]+)@/, '//$1:****@');

(async () => {
  if (!/ensaio/i.test(DESTINO) || !/^[A-Za-z0-9_-]+$/.test(DESTINO)) throw new Error('informe --destino com "ensaio" no nome (ex.: --destino rotaes_ensaio)');
  await mongoose.connect(process.env.MONGO_URI);
  const cli = mongoose.connection.getClient();
  const origem = mongoose.connection.db;
  if (origem.databaseName === DESTINO) throw new Error('o destino é a própria base atual (' + DESTINO + ')');
  const dest = cli.db(DESTINO);

  console.log('Base atual (origem):', origem.databaseName, ' →  destino:', DESTINO);
  const cols = (await origem.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name).filter(n => !n.startsWith('system.')).sort();
  const jaTem = new Set((await dest.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  let total = 0;
  for (const n of cols) {
    const q = await origem.collection(n).estimatedDocumentCount();
    total += q;
    console.log('  ' + n.padEnd(40) + String(q).padStart(9) + (jaTem.has(n) ? '   (no destino: será substituída)' : ''));
  }
  console.log('Coleções:', cols.length, '· documentos:', total);

  // como fica o MONGO_URI da base de ensaio
  const uri = String(process.env.MONGO_URI);
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/);
  let novo = m ? m[1] + '/' + DESTINO + (m[3] || '') : uri;
  // a senha continua valendo na base de autenticacao de antes (admin, em geral)
  if (!/authSource=/i.test(novo)) novo += (novo.includes('?') ? '&' : '?') + 'authSource=' + ((m && m[2] && m[2].length > 1) ? m[2].slice(1) : 'admin');
  console.log('\nNo .env, para usar o ensaio:');
  console.log('  hoje:   MONGO_URI=' + mascarar(uri));
  console.log('  ensaio: MONGO_URI=' + mascarar(novo));
  console.log('  (guarde a linha de hoje para voltar)');

  if (!APLICAR) { console.log('\nSIMULAÇÃO: nada foi copiado. Para copiar: --aplicar'); await mongoose.disconnect(); return; }

  const ini = Date.now();
  for (const n of cols) {
    if (jaTem.has(n)) await dest.collection(n).drop();
    const o = origem.collection(n), d = dest.collection(n);
    let lote = [], q = 0;
    for await (const doc of o.find({})) {
      lote.push(doc);
      if (lote.length >= LOTE) { await d.insertMany(lote, { ordered: false }); q += lote.length; lote = []; }
    }
    if (lote.length) { await d.insertMany(lote, { ordered: false }); q += lote.length; }
    if (!q) await dest.createCollection(n).catch(() => {});
    for (const ix of await o.indexes()) {
      if (ix.name === '_id_') continue;
      const { key, name, v, ns, ...opc } = ix;
      await d.createIndex(key, { name, ...opc }).catch(e => console.log('   índice ' + name + ': ' + e.message));
    }
    console.log('✓ ' + n.padEnd(40) + String(q).padStart(9));
  }
  console.log('\nPronto em ' + Math.round((Date.now() - ini) / 1000) + ' s. Troque o MONGO_URI no .env e reinicie o servidor.');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
