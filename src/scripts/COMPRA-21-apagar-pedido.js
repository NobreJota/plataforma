// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-21-apagar-pedido.js
// Criado em: 03/10/2026
//
// Apaga UM pedido da Armacao em _compra_pedidos e as linhas dele no fluxo
// (_fluxo_projetado, ligadas por lancamentoId = _id do pedido ou listadas em
// pedido.lancamentosFluxo). Feito para o 6866 (Komeco, 20/06/2025), importado
// do Access pelo COMPRA-9 mas que nao devia ter entrado.
//
// Recusa pedido que ja tem nota de entrada ligada.
//
// Uso (um comando por vez):
//   node src\scripts\COMPRA-21-apagar-pedido.js --numero 6866              simulacao
//   node src\scripts\COMPRA-21-apagar-pedido.js --numero 6866 --aplicar    backup EJSON + apaga
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let EJSON;
try { EJSON = mongoose.mongo.BSON.EJSON; } catch (e) { /* tenta o pacote */ }
if (!EJSON) EJSON = require('bson').EJSON;

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const i = args.indexOf('--numero');
const NUMERO = i >= 0 ? Number(args[i + 1]) : NaN;
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');   // fixa

const reais = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = d => d ? new Date(d).toISOString().slice(0, 10) : '—';

async function main() {
  if (!Number.isFinite(NUMERO) || NUMERO <= 0) throw new Error('informe --numero <nº do pedido>');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI não está no .env');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  const pedidos = await db.collection('_compra_pedidos').find({ lojistaId: ARMACAO, numero: NUMERO }).toArray();
  if (!pedidos.length) { console.log('\nPedido ' + NUMERO + ' não encontrado na Armação. Nada a fazer.'); return; }
  if (pedidos.length > 1) throw new Error(pedidos.length + ' pedidos com o número ' + NUMERO + '; nada foi apagado');
  const p = pedidos[0];

  const nota = await db.collection('_compra_notas_entrada').findOne({ lojistaId: ARMACAO, pedido: p._id });
  if (nota) throw new Error('o pedido tem a nota ' + nota.numero + ' ligada; nada foi apagado');

  const idsFluxo = (p.lancamentosFluxo || []).filter(Boolean);
  const fluxo = await db.collection('_fluxo_projetado').find({
    lojistaId: ARMACAO,
    $or: [{ lancamentoId: p._id }, ...(idsFluxo.length ? [{ _id: { $in: idsFluxo } }] : [])],
  }).toArray();

  console.log('\nPedido nº ' + p.numero + '  emissão ' + dia(p.dataEmissao)
    + '  ' + (p.fornecedorNome || '') + '  situação ' + p.situacao
    + '  itens ' + (p.itens || []).length + '  ' + (p.observacao || ''));
  console.log('Linhas no fluxo:', fluxo.length);
  for (const l of fluxo) {
    console.log('    pos ' + l.pos + '  ' + dia(l.vencimento) + '  ' + String(l.codigoConta || '').padEnd(14)
      + reais(l.valor).padStart(12) + '   ' + (l.historico || ''));
  }

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi apagado. Para aplicar, repita com --aplicar'); return; }

  const pasta = path.join(__dirname, 'backup');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const arq = path.join(pasta, 'COMPRA-21-pedido-' + NUMERO + '_' + carimbo + '.json');
  fs.writeFileSync(arq, EJSON.stringify({ pedido: p, fluxo }, null, 1, { relaxed: false }));
  const lido = EJSON.parse(fs.readFileSync(arq, 'utf8'));
  if (!lido.pedido || lido.fluxo.length !== fluxo.length) throw new Error('backup não conferiu; nada foi apagado');
  console.log('\nBackup:', arq);

  const rf = await db.collection('_fluxo_projetado').deleteMany({ lojistaId: ARMACAO, _id: { $in: fluxo.map(l => l._id) } });
  const rp = await db.collection('_compra_pedidos').deleteOne({ lojistaId: ARMACAO, _id: p._id });
  console.log('Apagados: pedido', rp.deletedCount, '· linhas do fluxo', rf.deletedCount);
}

main()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
