// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-24-fechar-pedidos.js
// Alterado em: 19/10/2026 - parcelas do pedido: pos 3 (como no Access); aceita as antigas pos 7.
// Criado em: 19/10/2026 (ensaio do dia "D")
//
// FECHA os pedidos que o COMPRA-23 aponta com "! FECHAR": pendentes na plataforma mas
// liquidados/cancelados no Access, ou que vieram do Access e nao estao mais la (o Access apaga
// o pedido liquidado). Sem isso a previsao do pedido (pos 7) fica no fluxo junto com a
// obrigacao da nota (pos 2) = valor repetido.
//   - pedido: situacao -> LIQUIDADO (o codigo vem do proprio modelo do pedido)
//   - fluxo: as linhas pos 7 ATIVAS do pedido -> CANCELADO (ficam na memoria, saem da tela)
// Opcional: --cancelar 7161[,7162]  pedidos SO DA PLATAFORMA (teste) -> CANCELADO, e as pos 7 saem.
// Backup EJSON (pedidos e linhas do fluxo) antes de gravar.
//
// Uso (um comando por vez):
//   node src\scripts\COMPRA-24-fechar-pedidos.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"
//   node src\scripts\COMPRA-24-fechar-pedidos.js --mdb "..." --cancelar 7161
//   node src\scripts\COMPRA-24-fechar-pedidos.js --mdb "..." --cancelar 7161 --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const op = k => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const MDB = op('--mdb') || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const CANCELAR = new Set(op('--cancelar').split(',').map(Number).filter(Boolean));
const APLICAR = args.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

(async () => {
  // os codigos de situacao do proprio modelo (nao inventar)
  const Pedido = require(path.join(__dirname, '..', 'models', 'compra', 'pedido'));
  const en = (Pedido.schema.path('situacao') && Pedido.schema.path('situacao').enumValues) || [];
  console.log('Situações do pedido (modelo):', en.length ? en.join(', ') : '(sem lista no modelo)');
  const LIQ = ['L', 'LIQUIDADO', 'F', 'FECHADO'].find(x => en.includes(x));
  const CAN = ['C', 'CANCELADO'].find(x => en.includes(x));
  if (!LIQ) throw new Error('não achei o código de "liquidado" no modelo do pedido (' + en.join(', ') + '): me mande esta linha');
  if (CANCELAR.size && !CAN) throw new Error('não achei o código de "cancelado" no modelo do pedido (' + en.join(', ') + ')');

  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nome = reader.getTableNames().find(n => limpo(n) === 'ped_pedidofornecedor');
  const acc = new Map(reader.getTable(nome).getData().map(l => [Number(l.NrPedido), Number(l.Pos)]));

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Base:', db.databaseName);
  const peds = await db.collection('_compra_pedidos').find({ lojistaId: { $in: [ARMACAO, String(ARMACAO)] }, situacao: 'P' }).sort({ numero: 1 }).toArray();

  const fechar = [], cancelar = [];
  for (const p of peds) {
    const a = acc.get(Number(p.numero)), doAccess = /importado do sistema antigo/i.test(String(p.observacao || ''));
    if ((a !== undefined && a !== 0 && a !== 1) || (a === undefined && doAccess)) fechar.push(p);   // 19/10/2026: Pos 1 = saldo pendente
    else if (a === undefined && CANCELAR.has(Number(p.numero))) cancelar.push(p);
  }
  for (const n of CANCELAR) if (!cancelar.some(p => Number(p.numero) === n)) console.log('  (--cancelar ' + n + ': não é pedido pendente só da plataforma; ignorado)');

  const todos = [...fechar, ...cancelar];
  const flx = await db.collection('_fluxo_projetado').find({ pos: { $in: [3, 7] }, status: 'ATIVO', lancamentoId: { $in: todos.map(p => p._id) } }).toArray();
  const soma = id => flx.filter(f => String(f.lancamentoId) === String(id)).reduce((s, f) => s + (Number(f.valor) || 0), 0);
  const qtd = id => flx.filter(f => String(f.lancamentoId) === String(id)).length;

  console.log('\nVão para LIQUIDADO (' + LIQ + '):', fechar.length);
  fechar.forEach(p => console.log('  nº ' + String(p.numero).padEnd(6) + String(p.fornecedorNome || '').padEnd(24).slice(0, 24) + '  fluxo pos 7: ' + qtd(p._id) + ' linha(s) R$ ' + brl(soma(p._id)) + ' saem'));
  if (CANCELAR.size) {
    console.log('\nVão para CANCELADO (' + CAN + '):', cancelar.length);
    cancelar.forEach(p => console.log('  nº ' + String(p.numero).padEnd(6) + String(p.fornecedorNome || '(sem fornecedor)').padEnd(24).slice(0, 24) + '  fluxo pos 7: ' + qtd(p._id) + ' linha(s) R$ ' + brl(soma(p._id)) + ' saem'));
  }
  console.log('\nLinhas do fluxo que saem:', flx.length, '· R$', brl(flx.reduce((s, f) => s + (Number(f.valor) || 0), 0)));

  if (!APLICAR) { console.log('\nSIMULAÇÃO: nada foi gravado. Para gravar: --aplicar'); await mongoose.disconnect(); return; }
  if (!todos.length) { console.log('Nada a fazer.'); await mongoose.disconnect(); return; }

  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup'); fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, 'COMPRA-24-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify({ pedidos: todos, fluxo: flx }, null, 1, { relaxed: false }));
  console.log('\nBackup:', arq);

  const agora = new Date();
  for (const p of fechar) {
    await db.collection('_compra_pedidos').updateOne({ _id: p._id, situacao: 'P' }, { $set: { situacao: LIQ, liquidadoEm: agora,
      observacao: String(p.observacao || '') + ' · liquidado no Access (fechado no dia D)', atualizadoEm: agora } });
  }
  for (const p of cancelar) {
    await db.collection('_compra_pedidos').updateOne({ _id: p._id, situacao: 'P' }, { $set: { situacao: CAN, canceladoEm: agora,
      observacao: String(p.observacao || '') + ' · cancelado: pedido de teste (dia D)', atualizadoEm: agora } });
  }
  const r = await db.collection('_fluxo_projetado').updateMany({ _id: { $in: flx.map(f => f._id) }, status: 'ATIVO' },
    { $set: { status: 'CANCELADO', canceladoEm: agora } });
  console.log('✓ pedidos fechados:', fechar.length, '· cancelados:', cancelar.length, '· linhas do fluxo canceladas:', r.modifiedCount);
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
