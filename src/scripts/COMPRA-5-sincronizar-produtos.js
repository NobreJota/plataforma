// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-5-sincronizar-produtos.js
// Criado em:   24/09/2026
// Alterado em: 26/09/2026 — nao sobrescreve a referencia que ja foi ajustada
//                           pela plataforma (entrada de nota fiscal).
//
// Espelha PROD_Produto + PROD_Produto_Detalhes do Access na colecao
// _produto_origem. E a fonte da relacao produto->fornecedor e do estoque.
//
// Motivo: a coluna NrFornec de Vendas_SaídaCupomItens esta corrompida em
// 59% das linhas (guarda o codigo do produto). O dono da relacao e o
// cadastro do produto, nao a linha de venda.
//
// NAO toca em arquivo_docs, fornecs nem em qualquer colecao existente.
// Cria apenas _produto_origem.
//
// O QUE A PLATAFORMA ESCREVE E ESTE SCRIPT NAO ENCOSTA
//   custoMedio, custoUltimo, custoUltimaNota, custoAtualizadoEm,
//   ean, eanAprendidoEm, descricaoFab, refFab, fabAtualizadoEm,
//   referenciaAntes, referenciaAtualizadaEm
// Sao campos que o Access nao conhece, entao o $set daqui nem os menciona.
//
// A REFERENCIA E CASO A PARTE. Ela existe nos dois lados: `Refer 1` no Access
// e `referencia` aqui. Quando a entrada de nota adota a referencia do
// fabricante, o produto ganha `referenciaAtualizadaEm` — e a partir dai este
// script deixa a referencia em paz. Sem isso, a correcao feita a mao voltaria
// a ser a referencia truncada na sincronizacao seguinte.
//
// SIMULACAO por padrao. So grava com --aplicar.
//
// Uso (na raiz C:\plataformaRota, um comando por vez):
//   node src\scripts\COMPRA-5-sincronizar-produtos.js --mdb "C:\Armação\Dados\2026B\2026B.mdb"
//   node src\scripts\COMPRA-5-sincronizar-produtos.js --mdb "..." --aplicar
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

let MDBReader;
try {
  const mod = require('mdb-reader');
  MDBReader = mod.default || mod;
} catch (e) {
  console.error('\n[erro] mdb-reader nao encontrado. Rode: npm install mdb-reader\n');
  process.exit(1);
}

const COLECAO = '_produto_origem';
const LOJISTA_PADRAO = '6892706a86509313e632f717';   // Armacao Comercial Ltda

// ---------------------------------------------------------------------------
function lerArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mdb') args.mdb = argv[++i];
    else if (a === '--lojista') args.lojista = argv[++i];
    else if (a === '--aplicar') args.aplicar = true;
  }
  return args;
}

function acharTabela(todas, nome) {
  return todas.find(t => t === nome)
      || todas.find(t => t.replace(/[^\w]/g, '') === nome.replace(/[^\w]/g, ''))
      || null;
}

function dataValida(d) {
  return d instanceof Date && !isNaN(d) && d.getUTCFullYear() > 1950;
}

function numero(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function centavos(v) {
  return Math.round(numero(v) * 100);
}

function texto(v) {
  const s = String(v ?? '').trim();
  return s === '0' ? '' : s;        // o Access usa "0" como vazio em texto
}

// ---------------------------------------------------------------------------
function lerProdutos(args, ObjectId) {
  const reader = new MDBReader(fs.readFileSync(args.mdb));
  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  const nomeProd = acharTabela(todas, 'PROD_Produto');
  const nomeDet  = acharTabela(todas, 'PROD_Produto_Detalhes');

  if (!nomeProd || !nomeDet) {
    console.error('\n[erro] tabelas nao encontradas');
    console.error('       produto:  ' + (nomeProd || 'FALTA'));
    console.error('       detalhes: ' + (nomeDet || 'FALTA') + '\n');
    process.exit(1);
  }
  console.log('\nTabelas: ' + nomeProd + '  +  ' + nomeDet);

  // ---- detalhes por codigo ------------------------------------------------
  const detalhes = new Map();
  let detDuplicados = 0;
  for (const d of reader.getTable(nomeDet).getData()) {
    const cod = Number(d['NrProdut']);
    if (!Number.isFinite(cod) || cod === 0) continue;
    if (detalhes.has(cod)) detDuplicados++;
    detalhes.set(cod, d);            // fica o ultimo
  }

  // ---- produtos -----------------------------------------------------------
  const docs = [];
  const porFornec = new Map();
  let semDetalhe = 0, ativos = 0, inativos = 0, semFornec = 0;

  for (const p of reader.getTable(nomeProd).getData()) {
    const cod = Number(p['CódigoProd']);
    if (!Number.isFinite(cod) || cod === 0) continue;

    const d = detalhes.get(cod);
    if (!d) semDetalhe++;

    const nrFornec = Number(p['NrFornec']) || 0;
    if (!nrFornec) semFornec++;
    else porFornec.set(nrFornec, (porFornec.get(nrFornec) || 0) + 1);

    const ativo = Number(p['Ativado']) === 1;
    if (ativo) ativos++; else inativos++;

    docs.push({
      lojistaId: new ObjectId(args.lojistaId),
      codigoProd: cod,
      nrFornec,

      descricao: texto(p['Descrição']),
      marca: texto(p['Marca']),
      referencia: texto(p['Refer 1']),
      referencia2: texto(p['Refer 2']),
      unidade: texto(p['Unid']),
      localLoja: texto(p['LocLoja']),
      localDeposito: texto(p['LocDep']),
      codCupom: texto(p['Cod_Cupom']),

      grupoNumero: Number(p['Nr_Grupo']) || 0,
      grupoNome: texto(p['Nm_Grupo']),

      eMin: Number(p['EMin']) || 0,
      eMax: Number(p['EMax']) || 0,
      ativo,

      dataRegistro: dataValida(p['DataReg']) ? p['DataReg'] : null,
      ultimaAlteracao: dataValida(p['UltAlteração']) ? p['UltAlteração'] : null,

      // de PROD_Produto_Detalhes — valores em centavos
      estoque: d ? (Number(d['Qte']) || 0) : 0,
      temDetalhe: !!d,
      precoCusto: d ? centavos(d['PCusto']) : 0,
      precoMedio: d ? centavos(d['PMédio']) : 0,
      precoLiquido: d ? centavos(d['PLiquid']) : 0,
      precoVista: d ? centavos(d['PreçoVista']) : 0,
      precoPrazo: d ? centavos(d['PreçoPrazo']) : 0,

      sincronizadoEm: new Date(),
    });
  }

  return { docs, detDuplicados, semDetalhe, ativos, inativos, semFornec, porFornec,
           totalDetalhes: detalhes.size };
}

// ---------------------------------------------------------------------------
function relatar(r) {
  console.log('\nProdutos lidos ........... ' + r.docs.length);
  console.log('    ativos ............... ' + r.ativos);
  console.log('    inativos ............. ' + r.inativos);
  console.log('    sem fornecedor ....... ' + r.semFornec);
  console.log('    sem linha de detalhe . ' + r.semDetalhe);
  console.log('\nDetalhes distintos ....... ' + r.totalDetalhes);
  console.log('Detalhes duplicados ...... ' + r.detDuplicados);

  const orfaos = r.totalDetalhes - (r.docs.length - r.semDetalhe);
  console.log('Detalhes sem produto ..... ' + orfaos);

  console.log('\nFornecedores distintos ... ' + r.porFornec.size);
  const top = [...r.porFornec].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\n    Top 10 por quantidade de produtos:');
  for (const [f, n] of top) {
    console.log('        NrFornec ' + String(f).padStart(4) + '  ->  ' + n + ' produtos');
  }

  const comEstoque = r.docs.filter(d => d.estoque > 0).length;
  const comCusto = r.docs.filter(d => d.precoCusto > 0).length;
  console.log('\nProdutos com estoque > 0 . ' + comEstoque);
  console.log('Produtos com custo > 0 ... ' + comCusto);

  if (r.docs.length) {
    console.log('\nExemplo do que sera gravado:');
    for (const [k, v] of Object.entries(r.docs[0])) {
      const mostra = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
      console.log('    ' + k.padEnd(20) + ' = ' + mostra);
    }
  }
}

// ---------------------------------------------------------------------------
async function gravar(docs, lojistaId, mongoose, connectToDatabase) {
  await connectToDatabase();

  const col = mongoose.connection.collection(COLECAO);

  await col.createIndex({ lojistaId: 1, codigoProd: 1 }, { unique: true });
  await col.createIndex({ lojistaId: 1, nrFornec: 1, ativo: 1 });

  const filtro = { lojistaId: new mongoose.Types.ObjectId(lojistaId) };
  const antes = await col.countDocuments(filtro);

  // ---- referencias ja ajustadas pela plataforma ---------------------------
  // A entrada de nota fiscal pode adotar a referencia do fabricante no lugar
  // da nossa, que veio truncada do Access. Esses produtos ficam de fora do
  // $set da referencia — senao a correcao se perde aqui.
  const ajustados = new Set(
    (await col
      .find({ ...filtro, referenciaAtualizadaEm: { $exists: true } })
      .project({ codigoProd: 1 })
      .toArray()
    ).map(d => d.codigoProd)
  );

  if (ajustados.size) {
    console.log('\n    referencias ajustadas na plataforma: ' + ajustados.size
                + ' (serao preservadas)');
  }

  let inseridos = 0, alterados = 0, preservados = 0;
  const LOTE = 1000;

  for (let i = 0; i < docs.length; i += LOTE) {
    const ops = docs.slice(i, i + LOTE).map(d => {
      let campos = d;

      if (ajustados.has(d.codigoProd)) {
        campos = { ...d };
        delete campos.referencia;     // a nossa e a do fabricante, adotada
        preservados++;
      }

      return {
        updateOne: {
          filter: { lojistaId: d.lojistaId, codigoProd: d.codigoProd },
          update: { $set: campos },
          upsert: true,
        },
      };
    });

    const r = await col.bulkWrite(ops, { ordered: false });
    inseridos += r.upsertedCount || 0;
    alterados += r.modifiedCount || 0;

    process.stdout.write('\r    gravando ... '
      + Math.min(i + LOTE, docs.length) + '/' + docs.length);
  }

  const depois = await col.countDocuments(filtro);

  console.log('\n\n[ok] concluido.');
  console.log('    documentos antes .. ' + antes);
  console.log('    documentos depois . ' + depois);
  console.log('    inseridos ......... ' + inseridos);
  console.log('    atualizados ....... ' + alterados);
  if (preservados) {
    console.log('    referencias mantidas da plataforma . ' + preservados);
  }

  await mongoose.disconnect();
}

// ---------------------------------------------------------------------------
async function main() {
  const args = lerArgs(process.argv);

  if (!args.mdb || !fs.existsSync(args.mdb)) {
    console.error('\n[erro] informe --mdb com um caminho valido\n');
    process.exit(1);
  }

  args.lojistaId = args.lojista || LOJISTA_PADRAO;

  console.log('='.repeat(74));
  console.log('Sincronizar produtos   ' + (args.aplicar ? '>>> APLICANDO <<<' : '(simulacao)'));
  console.log('MDB ......... ' + args.mdb);
  console.log('Lojista ..... ' + args.lojistaId);
  console.log('Colecao ..... ' + COLECAO + '   (nova, nao mexe em arquivo_docs)');
  console.log('='.repeat(74));

  if (!args.aplicar) {
    const { Types } = require('mongoose');
    relatar(lerProdutos(args, Types.ObjectId));
    console.log('\n[simulacao] Nada foi gravado. Repita com --aplicar.\n');
    return;
  }

  const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

  if (!mongoose.Types.ObjectId.isValid(args.lojistaId)) {
    console.error('\n[erro] lojistaId invalido: ' + args.lojistaId + '\n');
    process.exit(1);
  }

  const r = lerProdutos(args, mongoose.Types.ObjectId);
  relatar(r);
  await gravar(r.docs, args.lojistaId, mongoose, connectToDatabase);
}

main().catch(e => {
  console.error('\n[erro] ' + e.message);
  process.exit(1);
});
