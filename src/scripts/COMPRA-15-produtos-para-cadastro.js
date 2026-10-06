// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-15-produtos-para-cadastro.js
// Criado em: 30/09/2026
// Alterado em: 30/09/2026 - taxa arredondada em 2 casas (o Access guarda float)
// Alterado em: 01/10/2026 - O ACCESS PREVALECE: produto criado na plataforma
//              (origemPlataforma) com o mesmo codigo de um do Access e substituido
//              pelo do Access. --limpar-plataforma apaga TODOS os criados na
//              plataforma antes de importar (dia da ultima importacao). Backup EJSON.
// Alterado em: 03/10/2026 - localloja nasce LISTA VAZIA ([]); o texto vazio derrubava
//              /loja/cooperados (populate de departamento). Se o Access tiver local
//              escrito, ele vai para `localAccess` (texto) e nao se perde.
//              fornecedor sem cadastro nasce null (nao ''). O apagar do
//              --limpar-plataforma tambem filtra por loja_id (nunca sai da empresa).
//
// IMPORTACAO EM LOTE dos produtos para arquivo_docs, no lugar de passar um a
// um pela ficha (/compra/produto-cadastro).
//
// Fonte: _produto_origem (espelho do Access feito pelo COMPRA-5) + a coluna
// Taxa de PROD_Produto_Detalhes, que o COMPRA-5 nao traz.
//
// Entram so os produtos ATIVOS no Access e cuja descricao NAO comeca com "Z_".
// Os campos sao os mesmos que a ficha grava (produto-api.js /gravar):
// dinheiro em REAIS (a origem guarda centavos), fornecedor = marca do
// fornecedor, nrFornec e ncontabil = conta 2.01.001.xxx do fornecedor.
//
// Produto que JA ESTA em arquivo_docs (gravado pela ficha ou pelo cadastro
// antigo) NAO e tocado: $setOnInsert. Pode rodar de novo sem estragar nada.
//
// Uso (um comando por vez):
//   node src/scripts/COMPRA-15-produtos-para-cadastro.js
//   node src/scripts/COMPRA-15-produtos-para-cadastro.js --aplicar
//   node src/scripts/COMPRA-15-produtos-para-cadastro.js --limpar-plataforma --aplicar
// Opcoes: --mdb "C:\Armação\Dados\2026B\2026B.mdb"   --lojista <id>
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const tem = f => args.includes(f);
const opcao = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };

const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');
const Z = /^z_/i;

const reais = c => Math.round(Number(c || 0)) / 100;
const numero = v => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

(async function () {
  const aplicar = tem('--aplicar');

  // ---- Taxa, de PROD_Produto_Detalhes (mesma leitura do COMPRA-5) ------------
  const taxa = new Map();
  if (fs.existsSync(MDB)) {
    const mod = require('mdb-reader');
    const MDBReader = mod.default || mod;
    const reader = new MDBReader(fs.readFileSync(MDB));
    for (const d of reader.getTable('PROD_Produto_Detalhes').getData()) {
      const cod = Number(d['NrProdut']);
      if (Number.isFinite(cod) && cod) taxa.set(cod, numero(d['Taxa']));
    }
  } else {
    console.warn('Access nao encontrado (' + MDB + '): produtos entram sem taxa.');
  }

  // ---- banco -------------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const loja = await db.collection('lojistas').findOne({ _id: lojistaId });
  const dadosLoja = {
    marcaloja: loja?.marca || loja?.nomeFantasia || loja?.razaoSocial || '',
    cidade: loja?.cidade || loja?.endereco?.cidade || '',
    bairro: loja?.bairro || loja?.endereco?.bairro || '',
  };

  const fornec = new Map((await db.collection('_fornec_access').find({ lojistaId }).toArray())
    .map(f => [Number(f.nrFornec), f]));

  const origem = await db.collection('_produto_origem')
    .find({ lojistaId, ativo: true, descricao: { $not: Z } }).toArray();

  const existentes = await db.collection('arquivo_docs')
    .find({ loja_id: lojistaId }).project({ codigo: 1, origemPlataforma: 1, descricao: 1 }).toArray();
  const limpar = tem('--limpar-plataforma');
  const daPlataforma = existentes.filter(d => d.origemPlataforma === true);
  // ja cadastrados que ficam como estao: os vindos do Access (e os da plataforma,
  // se nao for para limpar e nao houver choque de codigo)
  const jaTem = new Set(existentes.filter(d => d.origemPlataforma !== true).map(d => d.codigo));
  const plataformaPorCodigo = new Map(limpar ? [] : daPlataforma.map(d => [d.codigo, d]));

  const agora = new Date();
  const docs = [];
  let semFornecAtivo = 0, semTaxa = 0;

  const substituir = [];   // codigo da plataforma que o Access tambem tem: o do Access vence
  for (const p of origem) {
    if (jaTem.has(p.codigoProd)) continue;
    if (plataformaPorCodigo.has(p.codigoProd)) substituir.push(plataformaPorCodigo.get(p.codigoProd));
    const f = fornec.get(Number(p.nrFornec));
    if (!f || f.ativo === false) semFornecAtivo++;
    if (!taxa.has(p.codigoProd)) semTaxa++;

    docs.push({
      loja_id: lojistaId,
      codigo: p.codigoProd,
      ...dadosLoja,
      marcaproduto: p.marca || '',
      descricao: p.descricao || '',
      descricaoNorm: '',
      complete: '',
      referencia: p.referencia || '',
      referencia2: p.referencia2 || '',
      codEcf: p.codCupom || '',
      fornecedor: f ? (f.marca || f.razao || null) : null,   // a MARCA; sem cadastro, null
      nrFornec: Number(p.nrFornec) || null,
      ncontabil: f?.contaNova || '',
      similares: '',
      artigo: '',
      localloja: [],                                          // lista (departamento/setor/secao da area da empresa)
      ...(String(p.localLoja || '').trim() ? { localAccess: String(p.localLoja).trim() } : {}),
      qte: Number(p.estoque) || 0,
      e_min: Number(p.eMin) || 0,
      e_max: Number(p.eMax) || 0,
      precocusto: reais(p.precoCusto),
      precovista: reais(p.precoVista),
      precoprazo: reais(p.precoPrazo),
      taxa: Math.round((taxa.get(p.codigoProd) || 0) * 100) / 100,
      ativo: true,
      pageok: false,
      origemAccess: true,
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }

  console.log('Ativos no Access (sem Z_):      ', origem.length);
  console.log('  ja em arquivo_docs (ficam):    ', origem.length - docs.length);
  console.log('  entram agora:                  ', docs.length);
  console.log('    de fornecedor inativo/sem:   ', semFornecAtivo, '(sem cadastro: fornecedor null)');
  console.log('    com local escrito no Access: ', docs.filter(d => d.localAccess).length, '(vai para localAccess)');
  console.log('    sem linha em Detalhes (taxa):', semTaxa);
  console.log('Criados na plataforma:            ', daPlataforma.length,
    limpar ? '-> TODOS serao apagados (--limpar-plataforma)' : '');
  if (!limpar && substituir.length) {
    console.log('  com o mesmo codigo do Access (o do Access substitui):', substituir.length);
    substituir.slice(0, 15).forEach(d => console.log('     ', d.codigo, '-', d.descricao || ''));
  }
  console.log('Loja:', JSON.stringify(dadosLoja));
  if (docs[0]) {
    console.log('\nExemplo:');
    for (const [k, v] of Object.entries(docs[0])) {
      if (!['loja_id', 'criadoEm', 'atualizadoEm'].includes(k)) console.log('   ', k.padEnd(14), '=', v);
    }
  }

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // backup e limpeza do que vai sair
  const sair = limpar ? daPlataforma : substituir;
  if (sair.length) {
    const path = require('path');
    const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
    const completos = await db.collection('arquivo_docs').find({ _id: { $in: sair.map(d => d._id) } }).toArray();
    const pasta = path.join(__dirname, 'backup');
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'COMPRA-15-plataforma-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(arq, EJSON.stringify(completos, null, 2, { relaxed: false }));
    console.log('\nBackup dos criados na plataforma que saem:', arq);
    const r = await db.collection('arquivo_docs').deleteMany({ loja_id: lojistaId, _id: { $in: sair.map(d => d._id) } });
    console.log('Apagados:', r.deletedCount);
  }

  let inseridos = 0;
  for (let i = 0; i < docs.length; i += 1000) {
    const r = await db.collection('arquivo_docs').bulkWrite(docs.slice(i, i + 1000).map(d => ({
      updateOne: {
        filter: { loja_id: lojistaId, codigo: d.codigo },
        update: { $setOnInsert: d },
        upsert: true,
      },
    })), { ordered: false });
    inseridos += r.upsertedCount || 0;
    process.stdout.write('\r    gravando ... ' + Math.min(i + 1000, docs.length) + '/' + docs.length);
  }
  console.log('\n\nInseridos em arquivo_docs:', inseridos);

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
