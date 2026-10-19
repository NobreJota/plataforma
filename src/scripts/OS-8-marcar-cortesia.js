// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-8-marcar-cortesia.js
// Criado em: 18/10/2026
//
// Marca como CORTESIA (instalacao sem mao de obra, com o motivo) OS que ja foram gravadas com
// mao de obra R$ 0,00 — as vendas 35 e 36 (OS 13768 e 13769), de antes do aviso
// "Instalação sem mão de obra?". Grava o motivo na OS (cortesia) e na venda (instalacao.cortesia).
// Nao mexe em valor nem em lancamento. So OS com mao de obra zero.
// (Se o cliente for pagar o servico, nao use este script: lance na ficha de fechamento da OS como
//  "mão de obra adicional" paga pelo CLIENTE.)
//
// Uso (um comando por vez):
//   node src\scripts\OS-8-marcar-cortesia.js --os 13768 --motivo "Orientar o cliente no uso"
//   node src\scripts\OS-8-marcar-cortesia.js --os 13768 --motivo "Orientar o cliente no uso" --aplicar
//   (varias: --os 13768,13769)
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
const NUMS = String(val('--os') || '').split(',').map(Number).filter(Boolean);
const MOTIVO = String(val('--motivo') || '').trim().slice(0, 120);
const r$ = c => 'R$ ' + ((Number(c) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

(async () => {
  if (!NUMS.length || !MOTIVO) throw new Error('use: --os 13768[,13769] --motivo "texto do motivo"');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const oss = await db.collection('_ordens_servico').find({ lojistaId: ARMACAO, numero: { $in: NUMS } }).toArray();
  const vale = [];
  for (const n of NUMS) {
    const o = oss.find(x => x.numero === n);
    if (!o) { console.log('OS ' + n + ': não encontrada'); continue; }
    const mo = o.maoDeObraVenda || o.valorServico || 0;
    console.log('OS ' + n + ' · ' + (o.cliente?.nome || '') + ' · venda ' + (o.venda?.numero || '-') + ' · status ' + o.status
      + ' · mão de obra ' + r$(mo) + (o.cortesia ? ' · já é cortesia: ' + o.cortesia : ''));
    if (mo > 0) { console.log('   tem mão de obra: fica como está'); continue; }
    vale.push(o);
  }
  console.log('\nVão ficar como CORTESIA (' + vale.length + '): motivo "' + MOTIVO + '"');
  if (!APLICAR) { console.log('SIMULAÇÃO: nada foi gravado. Para gravar: --aplicar'); await mongoose.disconnect(); return; }
  for (const o of vale) {
    await db.collection('_ordens_servico').updateOne({ _id: o._id }, { $set: { cortesia: MOTIVO, atualizadoEm: new Date() } });
    if (o.venda?.id) await db.collection('_vendas').updateOne({ _id: o.venda.id, instalacao: { $ne: null } }, { $set: { 'instalacao.cortesia': MOTIVO } });
    console.log('✓ OS ' + o.numero + ' cortesia');
  }
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
