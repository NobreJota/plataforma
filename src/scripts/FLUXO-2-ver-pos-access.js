// =============================================================================
// Destino: C:\plataformaRota\src\scripts\FLUXO-2-ver-pos-access.js
// Criado em: 19/10/2026 (ensaio do dia "D") — SO LE, nao grava nada.
//
// O QUE E CADA "POS" NO FLUXO DO ACCESS (Contab_Caixa_Fluxo)? No ensaio apareceu o pedido 7119 Eplax
// DUAS vezes no fluxo da plataforma: pos 7 (do COMPRA-9, ligado ao pedido) e pos 3 ("Pedido/Eplax ·
// 7119/0", que veio do Access pelo FLUXO-1). Este script mostra, para cada Pos do Access: quantas
// linhas, o total e exemplos de historico; e, para cada pedido PENDENTE da plataforma, as linhas do
// Access que citam o numero dele (e em que Pos estao). Com isso decidimos o que o FLUXO-1 traz.
//
// Uso: node src\scripts\FLUXO-2-ver-pos-access.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = d => (d instanceof Date ? d.toISOString().slice(0, 10) : '-');

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nome = reader.getTableNames().find(n => limpo(n) === 'contab_caixa_fluxo');
  if (!nome) throw new Error('tabela Contab_Caixa_Fluxo não encontrada');
  const linhas = reader.getTable(nome).getData();
  const col = k => Object.keys(linhas[0] || {}).find(c => limpo(c) === limpo(k));
  const C = { pos: col('Pos'), hist: col('Hist'), vect: col('Vect'), deb: col('Deb'), cre: col('Cre'), cta: col('NrCta'), tit: col('NrTítulo') };
  const valor = l => Math.abs(Number(l[C.deb]) || Number(l[C.cre]) || 0);

  console.log('Access: ' + nome + ' · ' + linhas.length + ' linhas\n');
  const porPos = new Map();
  for (const l of linhas) { const p = Number(l[C.pos]) || 0; if (!porPos.has(p)) porPos.set(p, []); porPos.get(p).push(l); }
  for (const [p, ls] of [...porPos].sort((a, b) => a[0] - b[0])) {
    console.log('POS ' + p + ' · ' + ls.length + ' linhas · R$ ' + brl(ls.reduce((s, l) => s + valor(l), 0)));
    const vistos = new Set();
    for (const l of ls) {
      const h = String(l[C.hist] || '').trim(), k = h.replace(/\d+/g, '#');
      if (vistos.has(k)) continue;                       // um exemplo de cada tipo de historico
      if (vistos.size >= 12) break;
      vistos.add(k);
      console.log('    ' + dia(l[C.vect]) + '  ' + String(l[C.cta] || '').padEnd(14) + brl(valor(l)).padStart(12) + '  ' + h.slice(0, 60));
    }
    console.log('');
  }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const peds = await db.collection('_compra_pedidos').find({ lojistaId: { $in: [ARMACAO, String(ARMACAO)] }, situacao: 'P' }).sort({ numero: 1 }).toArray();
  console.log('Base: ' + db.databaseName + ' · pedidos PENDENTES na plataforma: ' + peds.length);
  for (const p of peds) {
    const n = String(p.numero);
    const noAcc = linhas.filter(l => new RegExp('\\b' + n + '\\b').test(String(l[C.hist] || '')));
    const pl = await db.collection('_fluxo_projetado').find({ status: 'ATIVO', $or: [{ lancamentoId: p._id }, { historico: new RegExp('\\b' + n + '\\b') }] }).toArray();
    console.log('\n  pedido ' + n + ' ' + (p.fornecedorNome || '') + ' · R$ ' + brl(p.valorTotal || p.total || 0));
    noAcc.forEach(l => console.log('     Access  pos ' + l[C.pos] + '  ' + dia(l[C.vect]) + '  ' + brl(valor(l)).padStart(10) + '  ' + String(l[C.hist] || '').slice(0, 55)));
    pl.forEach(f => console.log('     plat.   pos ' + f.pos + '  ' + dia(f.vencimento) + '  ' + brl(f.valor).padStart(10) + '  ' + String(f.historico || '').slice(0, 45) + '  (' + f.origem + ')'));
  }
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
