// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-22-atualizar-estoque-precos.js
// Criado em: 19/10/2026 (achado no ensaio do dia "D")
//
// O COMPRA-15 so INSERE produto novo; o que ja esta em arquivo_docs "fica como esta"
// ($setOnInsert). Mas no dia "D" o ESTOQUE e os PRECOS de todos tem que ser os do Access
// (a plataforma ainda baixou estoque com as vendas de teste). Este script acerta, para os
// produtos que existem no Access (_produto_origem, feito pelo COMPRA-5):
//   qte (estoque) · precocusto · precovista · precoprazo · e_min · e_max · ativo
//   PRECO pela regra da plataforma (VENDA-9, 10/10/2026): a prazo = o MAIOR entre o "a vista" e o
//   "a prazo" do Access; a vista = a prazo com 5% de desconto. (No Access o "a prazo" esta parado.)
//   (ativo = ativo no Access e descricao sem "Z_"; inativo no Access sai das listas)
// NAO mexe em: descricao, referencias, garantia, local, fornecedor, kits, fotos.
// Produto da plataforma que nao existe no Access: fica como esta (listado).
// Backup EJSON dos campos antes de mudar (src\scripts\backup).
//
// Rodar DEPOIS do COMPRA-5 (o espelho tem que estar em dia).
//
// Uso (um comando por vez):
//   node src\scripts\COMPRA-22-atualizar-estoque-precos.js              simulacao
//   node src\scripts\COMPRA-22-atualizar-estoque-precos.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const reais = c => Math.round(Number(c) || 0) / 100;
const DESCONTO_VISTA = 0.05;                                  // a vista = a prazo - 5% (VENDA-9)
const num = v => Number(v) || 0;
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Base:', db.databaseName);

  const origem = new Map((await db.collection('_produto_origem').find({ lojistaId: { $in: [ARMACAO, String(ARMACAO)] } }).toArray())
    .map(p => [Number(p.codigoProd), p]));
  const prods = await db.collection('arquivo_docs').find({ loja_id: { $in: [ARMACAO, String(ARMACAO)] } })
    .project({ codigo: 1, descricao: 1, qte: 1, precocusto: 1, precovista: 1, precoprazo: 1, e_min: 1, e_max: 1, ativo: 1, origemPlataforma: 1 }).toArray();
  console.log('Access (_produto_origem):', origem.size, '· cadastro (arquivo_docs):', prods.length);

  const mudar = [], semAccess = [];
  const cont = { qte: 0, precocusto: 0, precovista: 0, precoprazo: 0, e_min: 0, e_max: 0, ativo: 0 };
  for (const d of prods) {
    const p = origem.get(Number(d.codigo));
    if (!p) { semAccess.push(d); continue; }
    // 19/10/2026: preco pela REGRA DA PLATAFORMA (VENDA-9): a prazo = o maior dos dois precos do
    // Access; a vista = a prazo - 5%. Sem preco nenhum no Access: ficam os da plataforma.
    const pz = Math.max(Math.round(num(p.precoVista)), Math.round(num(p.precoPrazo)));
    const novo = {
      qte: num(p.estoque),
      precocusto: reais(p.precoCusto),
      precoprazo: pz ? pz / 100 : num(d.precoprazo),
      precovista: pz ? Math.round(pz * (1 - DESCONTO_VISTA)) / 100 : num(d.precovista),
      e_min: num(p.eMin), e_max: num(p.eMax),
      ativo: p.ativo === true && !/^z_/i.test(String(p.descricao || '').trim()),
    };
    const set = {};
    for (const k of Object.keys(novo)) {
      const antes = k === 'ativo' ? d.ativo !== false : num(d[k]);
      if (k === 'ativo' ? antes !== novo[k] : Math.abs(antes - novo[k]) > 0.004) { set[k] = novo[k]; cont[k]++; }
    }
    if (Object.keys(set).length) mudar.push({ d, set });
  }

  console.log('\nProdutos que mudam:', mudar.length);
  for (const [k, n] of Object.entries(cont)) console.log('  ' + k.padEnd(11) + n);
  const ex = mudar.filter(m => 'qte' in m.set).slice(0, 10);
  if (ex.length) {
    console.log('\nExemplos de estoque (plataforma -> Access):');
    for (const m of ex) console.log('  ' + String(m.d.codigo).padStart(6) + '  ' + String(num(m.d.qte)).padStart(5) + ' -> ' + String(m.set.qte).padEnd(6) + (m.d.descricao || ''));
  }
  const exp = mudar.filter(m => 'precovista' in m.set).slice(0, 6);
  if (exp.length) {
    console.log('\nExemplos de preço à vista (plataforma -> Access):');
    for (const m of exp) console.log('  ' + String(m.d.codigo).padStart(6) + '  R$ ' + brl(m.d.precovista).padStart(10) + ' -> R$ ' + brl(m.set.precovista).padEnd(10) + (m.d.descricao || ''));
  }
  const inat = mudar.filter(m => m.set.ativo === false).slice(0, 10);
  if (inat.length) { console.log('\nPassam a INATIVOS (inativos ou Z_ no Access):'); inat.forEach(m => console.log('  ' + String(m.d.codigo).padStart(6) + '  ' + (m.d.descricao || ''))); }
  console.log('\nNo cadastro e NÃO no Access (ficam como estão):', semAccess.length);
  semAccess.slice(0, 15).forEach(d => console.log('  ' + String(d.codigo).padStart(6) + '  ' + (d.descricao || '') + (d.origemPlataforma ? '  (criado na plataforma)' : '')));

  if (!APLICAR) { console.log('\nSIMULAÇÃO: nada foi gravado. Para gravar: --aplicar'); await mongoose.disconnect(); return; }

  if (mudar.length) {
    const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
    const pasta = path.join(__dirname, 'backup'); fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'COMPRA-22-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(arq, EJSON.stringify(mudar.map(m => m.d), null, 1, { relaxed: false }));
    console.log('\nBackup:', arq);
    const agora = new Date();
    for (let i = 0; i < mudar.length; i += 500) {
      await db.collection('arquivo_docs').bulkWrite(mudar.slice(i, i + 500).map(m => ({
        updateOne: { filter: { _id: m.d._id }, update: { $set: { ...m.set, atualizadoEm: agora } } } })), { ordered: false });
      process.stdout.write('\r  gravando ... ' + Math.min(i + 500, mudar.length) + '/' + mudar.length);
    }
    console.log('\n✓ atualizados:', mudar.length);
  }
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
