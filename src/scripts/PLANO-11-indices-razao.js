// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-11-indices-razao.js
// Criado em: 18/10/2026
//
// RAZAO MAIS RAPIDO. O razao de uma conta procura as boletas em que ela aparece como banco
// (perna) ou como contrapartida. Sem indice o MongoDB le a colecao inteira a cada consulta.
// Este script cria os indices em _boletas (nao muda nenhum dado):
//   { bancoCodigo: 1, data: 1 }
//   { 'contrapartidas.codigoConta': 1, data: 1 }
//   { status: 1, data: 1 }
// Rodar de novo nao faz mal (indice que ja existe fica como esta).
//
// Uso (um comando por vez):
//   node src\scripts\PLANO-11-indices-razao.js              simulacao (mostra os indices de hoje)
//   node src\scripts\PLANO-11-indices-razao.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const APLICAR = process.argv.includes('--aplicar');

const INDICES = [
  { chave: { bancoCodigo: 1, data: 1 }, nome: 'razao_banco_data' },
  { chave: { 'contrapartidas.codigoConta': 1, data: 1 }, nome: 'razao_contrapartida_data' },
  { chave: { status: 1, data: 1 }, nome: 'razao_status_data' },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const c = mongoose.connection.db.collection('_boletas');
  console.log('_boletas:', await c.estimatedDocumentCount(), 'boletas');
  const tem = await c.indexes();
  console.log('\nÍndices hoje:');
  for (const i of tem) console.log('  ' + i.name.padEnd(28) + JSON.stringify(i.key));
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const faltam = INDICES.filter(x => !tem.some(i => igual(i.key, x.chave)));
  console.log('\nVão ser criados:', faltam.length ? '' : 'nenhum (já existem)');
  for (const x of faltam) console.log('  ' + x.nome.padEnd(28) + JSON.stringify(x.chave));
  if (!APLICAR) { console.log('\nSIMULAÇÃO: nada foi criado. Para criar: --aplicar'); await mongoose.disconnect(); return; }
  for (const x of faltam) { await c.createIndex(x.chave, { name: x.nome }); console.log('✓ criado', x.nome); }
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
