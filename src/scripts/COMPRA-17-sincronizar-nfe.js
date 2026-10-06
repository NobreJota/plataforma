// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-17-sincronizar-nfe.js
// Criado em:   30/09/2026
// Reescrito em: 01/10/2026 — parte do CABECALHO, como no Access:
//
//   1. NFE_Cabeçalho com Emissão no ano corrente
//   2. de cada nota: NrNota + NrFornec
//   3. busca os itens em NFE_Itens por NotaFiscal + Nr_Fornec
//
// A Chave nao e usada (o Access a reaproveita entre notas). O numero da nota
// e comparado sem zeros a esquerda ("007991" = "7991").
//
// Grava _nfe_item_origem (uma linha por item, refeita a cada --aplicar).
// Nota do ano que nao achou item vai para _nfe_item_duvida e aparece na
// Ajuda do modal do pedido (so nos produtos daquele fornecedor).
// Fornecedores fora da analise de compra (nao sao revenda) nao geram duvida.
//
// Uso (um comando por vez):
//   node src/scripts/COMPRA-17-sincronizar-nfe.js
//   node src/scripts/COMPRA-17-sincronizar-nfe.js --aplicar
// Opcoes: --mdb "C:\Armação\Dados\2026B\2026B.mdb"   --lojista <id>
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const args = process.argv.slice(2);
const opcao = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };
const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');
const CORTE   = new Date(Date.UTC(new Date().getFullYear(), 0, 1));   // 1o de janeiro do ano corrente
// Fornecedores que nao sao revenda: nota sem item e normal, nao gera duvida.
//   90  Fio & Ferro
//   226 (nao e material para revenda)
const SEM_DUVIDA = new Set([90, 226]);

const numero = v => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const centavos = v => Math.round(numero(v) * 100);
const texto = v => { const s = String(v ?? '').trim(); return (s === '0' || s === '0000') ? '' : s; };
const nota = v => String(v ?? '').trim().replace(/^0+(?=\d)/, '');
const dataValida = d => d instanceof Date && !isNaN(d) && d.getUTCFullYear() > 1950;
const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const dia = d => d.toISOString().slice(0, 10);

(async function () {
  const aplicar = args.includes('--aplicar');
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const reader = new MDBReader(fs.readFileSync(MDB));
  const todas = reader.getTableNames();
  const achar = n => todas.find(t => t === n) || todas.find(t => semAcento(t) === semAcento(n));

  // ---- 1. as notas do ano ----------------------------------------------------
  const notas = reader.getTable(achar('NFE_Cabeçalho')).getData()
    .filter(c => dataValida(c['Emissão']) && c['Emissão'] >= CORTE);

  // ---- itens por nota + fornecedor -------------------------------------------
  const itensPorNota = new Map();
  for (const it of reader.getTable(achar('NFE_Itens')).getData()) {
    const k = nota(it['NotaFiscal']) + '|' + (Number(it['Nr_Fornec']) || 0);
    if (!itensPorNota.has(k)) itensPorNota.set(k, []);
    itensPorNota.get(k).push(it);
  }

  // ---- 2 e 3. de cada nota, os itens dela -------------------------------------
  const docs = [];
  const duvidas = [];
  let repetidos = 0;

  for (const c of notas) {
    const nNota = nota(c['NrNota']);
    const nForn = Number(c['NrFornec']) || 0;
    const itens = itensPorNota.get(nNota + '|' + nForn) || [];

    if (!itens.length) {
      if (SEM_DUVIDA.has(nForn)) continue;
      duvidas.push({
        lojistaId, codigoProd: 0,
        chave: Number(c['Chave']) || 0, nrNota: nNota, nrFornec: nForn,
        emissao: c['Emissão'],
        referencia: '', quantidade: 0, valorTotal: centavos(c['VrNota']),
        motivo: 'Nota ' + nNota + ' (fornecedor ' + nForn + ', emissão ' + dia(c['Emissão'])
          + ') sem itens em NFE_Itens',
        candidatas: [], sincronizadoEm: new Date(),
      });
      continue;
    }

    const vistos = new Set();
    for (const it of itens) {
      const ordem = Number(it['Ordem']) || 0;
      if (vistos.has(ordem)) { repetidos++; continue; }   // mesma ordem duas vezes: fica a primeira
      vistos.add(ordem);

      docs.push({
        lojistaId,
        chave: Number(c['Chave']) || 0, ordem,
        codigoProd: Number(it['Código']) || 0,
        nrNota: texto(c['NrNota']),
        nrFornec: nForn,
        nrPedido: Number(c['NrPedido']) || null,
        emissao: c['Emissão'],
        dataEntrada: dataValida(c['DataEntr']) ? c['DataEntr'] : null,
        referencia: texto(it['Refer']),
        unidade: texto(it['Unid']),
        quantidade: numero(it['Qte']),
        custoUnitario: centavos(it['VrCusto']),
        desconto: centavos(it['Descont']),
        ipiPerc: numero(it['IPI']),
        valorIpi: centavos(it['VrIpi']),
        valorTotal: centavos(it['Vrtotal']),
        sincronizadoEm: new Date(),
      });
    }
  }

  // ---- relatorio ----------------------------------------------------------------
  console.log('Notas emitidas desde ' + dia(CORTE) + ':', notas.length);
  console.log('  com itens:      ', docs.length ? new Set(docs.map(d => d.nrNota + '|' + d.nrFornec)).size : 0);
  console.log('  SEM itens:      ', duvidas.length, duvidas.length ? '<- vao para a Ajuda do modal' : '');
  console.log('Itens de nota:    ', docs.length);
  console.log('  ordem repetida na mesma nota (descartada):', repetidos);
  if (duvidas.length) {
    console.log('\nNotas sem itens:');
    duvidas.forEach(d => console.log('   ', d.motivo));
  }

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // ---- gravar -------------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;

  const col = db.collection('_nfe_item_origem');
  try { await col.dropIndex('lojistaId_1_chave_1_ordem_1'); } catch (e) { /* ja nao existe */ }
  await col.deleteMany({ lojistaId });
  if (docs.length) await col.insertMany(docs, { ordered: false });
  await col.createIndex({ lojistaId: 1, codigoProd: 1, emissao: -1 });

  const colDuv = db.collection('_nfe_item_duvida');
  await colDuv.deleteMany({ lojistaId });
  if (duvidas.length) await colDuv.insertMany(duvidas, { ordered: false });
  await colDuv.createIndex({ lojistaId: 1, codigoProd: 1 });

  console.log('\nGravado:', docs.length, 'itens |', duvidas.length, 'nota(s) em duvida');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
