// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-23-conferir-pedidos.js
// Alterado em: 19/10/2026 - parcelas do pedido: pos 3 (como no Access); aceita as antigas pos 7.
// Criado em: 19/10/2026 (ensaio do dia "D")
//
// SO LE (nao grava nada). Confere os PEDIDOS da plataforma (_compra_pedidos) com o Access
// (PED_PedidoFornecedor, coluna Pos: 0 pendente · 1 liquidado · 3 cancelado):
//   ✓ pendente nos dois
//   ! pendente na plataforma mas LIQUIDADO/CANCELADO no Access  -> tem que fechar (e a pos 7 do
//     fluxo sair; senao a previsao do pedido fica junto com a obrigacao da nota = repetido)
//   ! veio do Access, ainda pendente aqui, e NAO esta mais no Access (o Access apaga o liquidado)
//   ? so na plataforma (nao existe no Access): pedido de TESTE ou emitido na plataforma
// E mostra, de cada pedido, as linhas pos 7 ATIVAS no fluxo (quantas e o total).
//
// Uso:
//   node src\scripts\COMPRA-23-conferir-pedidos.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"
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
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const SIT = { P: 'pendente', L: 'liquidado', C: 'cancelado' };
const POS = { 0: 'pendente', 1: 'saldo pendente', 3: 'cancelado' };   // 19/10/2026: Pos 1 = saldo, ainda pendente

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nome = reader.getTableNames().find(n => limpo(n) === 'ped_pedidofornecedor');
  if (!nome) throw new Error('tabela PED_PedidoFornecedor não encontrada');
  const acc = new Map(reader.getTable(nome).getData().map(l => [Number(l.NrPedido), Number(l.Pos)]));

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Base:', db.databaseName, '· pedidos no Access:', acc.size);
  const peds = await db.collection('_compra_pedidos').find({ lojistaId: { $in: [ARMACAO, String(ARMACAO)] } }).sort({ numero: 1 }).toArray();
  const flx = await db.collection('_fluxo_projetado').find({ pos: { $in: [3, 7] }, status: 'ATIVO', lancamentoId: { $in: peds.map(p => p._id) } })
    .project({ lancamentoId: 1, valor: 1 }).toArray();
  const porPed = new Map();
  for (const f of flx) { const k = String(f.lancamentoId); const x = porPed.get(k) || { n: 0, v: 0 }; x.n++; x.v += Number(f.valor) || 0; porPed.set(k, x); }

  console.log('Pedidos na plataforma:', peds.length, '\n');
  const conta = { ok: 0, fechar: 0, teste: 0, outros: 0 };
  for (const p of peds) {
    const a = acc.get(Number(p.numero)), f = porPed.get(String(p._id));
    let marca;
    const doAccess = /importado do sistema antigo/i.test(String(p.observacao || ''));
    if (a === undefined && doAccess && p.situacao === 'P') { marca = '! FECHAR: veio do Access e não está mais lá (liquidado/apagado)'; conta.fechar++; }
    else if (a === undefined) { marca = '? só na plataforma' + (doAccess ? ' (veio do Access)' : ' (teste ou emitido aqui)'); conta.teste++; }
    else if (p.situacao === 'P' && a !== 0 && a !== 1) { marca = '! FECHAR: ' + (POS[a] || 'Pos ' + a) + ' no Access'; conta.fechar++; }
    else if (p.situacao === 'P' && (a === 0 || a === 1)) { marca = '✓ pendente nos dois' + (a === 1 ? ' (saldo)' : ''); conta.ok++; }
    else { marca = '· ' + (SIT[p.situacao] || p.situacao) + ' na plataforma / ' + (POS[a] || 'Pos ' + a) + ' no Access'; conta.outros++; }
    console.log('  nº ' + String(p.numero).padEnd(6) + String(p.fornecedorNome || '').padEnd(28).slice(0, 28) + ' ' + String(SIT[p.situacao] || p.situacao).padEnd(10)
      + (f ? ' fluxo: ' + f.n + ' parcela(s) R$ ' + brl(f.v) : ' fluxo: —').padEnd(36) + marca);
  }
  console.log('\nResumo: ✓ ' + conta.ok + ' · ! fechar ' + conta.fechar + ' · ? só na plataforma ' + conta.teste + ' · outros ' + conta.outros);
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
