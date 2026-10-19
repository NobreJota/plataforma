// =============================================================================
// Destino: C:\plataformaRota\src\scripts\FLUXO-3-pedidos-para-pos3.js
// Criado em: 19/10/2026 (ensaio do dia "D")
//
// POS COMO NO ACCESS (Jorge, 19/10/2026): 3 = PEDIDO FEITO ao fabricante (aguardando mercadoria),
// 7 = COMPRA PROJETADA (previsao / programacao de compras). A plataforma usava o contrario para os
// pedidos (pos 7). Este script passa as parcelas dos PEDIDOS que ja estao no fluxo (origem
// PEDIDO_IMPORTADO do COMPRA-9 e PEDIDO_COMPRA da tela de pedidos) de pos 7 para pos 3.
// Os scripts e telas novos ja gravam pos 3; isto e so para o que foi gravado antes.
// Depois: rodar o FLUXO-1 de novo (tira a pos 3 do Access repetida e traz a pos 7 = previsoes).
//
// Uso (um comando por vez):
//   node src\scripts\FLUXO-3-pedidos-para-pos3.js              simulacao
//   node src\scripts\FLUXO-3-pedidos-para-pos3.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const FLX = db.collection('_fluxo_projetado');
  console.log('Base:', db.databaseName, APLICAR ? '· APLICAR' : '· simulação');
  const filtro = { pos: 7, origem: { $in: ['PEDIDO_IMPORTADO', 'PEDIDO_COMPRA'] } };
  const g = await FLX.aggregate([{ $match: filtro }, { $group: { _id: { o: '$origem', s: '$status' }, n: { $sum: 1 }, v: { $sum: '$valor' } } }, { $sort: { _id: 1 } }]).toArray();
  console.log('\nParcelas de pedido na pos 7 (vão para a pos 3):');
  if (!g.length) console.log('  nenhuma');
  g.forEach(x => console.log('  ' + (x._id.o + ' / ' + x._id.s).padEnd(30) + String(x.n).padStart(5) + '  R$ ' + brl(x.v)));
  const outras = await FLX.aggregate([{ $match: { pos: 7, origem: { $nin: ['PEDIDO_IMPORTADO', 'PEDIDO_COMPRA'] }, status: 'ATIVO' } },
    { $group: { _id: '$origem', n: { $sum: 1 }, v: { $sum: '$valor' } } }]).toArray();
  if (outras.length) { console.log('\nNa pos 7 ficam (compras projetadas):'); outras.forEach(x => console.log('  ' + String(x._id || '(sem origem)').padEnd(30) + String(x.n).padStart(5) + '  R$ ' + brl(x.v))); }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); await mongoose.disconnect(); return; }
  const r = await FLX.updateMany(filtro, { $set: { pos: 3, atualizadoEm: new Date() } });
  console.log('\n✓ passadas para a pos 3:', r.modifiedCount);
  console.log('Agora: FLUXO-1-importar-fluxo-access --com-orcamento --aplicar (troca as linhas do Access).');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
