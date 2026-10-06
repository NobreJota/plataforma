// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-4-sincronizar-vendas.js
// Criado em: 24/09/2026
//
// Copia as saidas de Vendas_SaídaCupomItens do Access para a colecao
// _venda_item_origem. E a base do calculo de consumo por janela.
//
// NAO toca em arquivo_docs, fornecs nem em qualquer colecao existente.
// Cria apenas _venda_item_origem.
//
// SIMULACAO por padrao. So grava com --aplicar.
// A simulacao nem conecta no banco.
//
// Uso (na raiz C:\plataformaRota, um comando por vez):
//   node src\scripts\COMPRA-4-sincronizar-vendas.js --mdb "C:\Armação\Dados\2026B\2026B.mdb"
//   node src\scripts\COMPRA-4-sincronizar-vendas.js --mdb "..." --aplicar
//   node src\scripts\COMPRA-4-sincronizar-vendas.js --mdb "..." --ano 2025 --aplicar
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

const COLECAO = '_venda_item_origem';
const LOJISTA_PADRAO = '6892706a86509313e632f717';   // Armacao Comercial Ltda

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
function lerArgs(argv) {
  const args = { ano: 'corrente' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mdb') args.mdb = argv[++i];
    else if (a === '--lojista') args.lojista = argv[++i];
    else if (a === '--ano') args.ano = argv[++i];
    else if (a === '--aplicar') args.aplicar = true;
  }
  return args;
}

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------
function acharTabela(todas, nome) {
  return todas.find(t => t === nome)
      || todas.find(t => t.replace(/[^\w]/g, '') === nome.replace(/[^\w]/g, ''))
      || null;
}

function dataValida(d) {
  return d instanceof Date && !isNaN(d) && d.getUTCFullYear() > 1950;
}

// Qte vem como texto em algumas tabelas do Access.
function numero(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Reais -> centavos, inteiro. A plataforma guarda dinheiro em centavos.
function centavos(v) {
  return Math.round(numero(v) * 100);
}

// ---------------------------------------------------------------------------
// Leitura do Access
// ---------------------------------------------------------------------------
function lerVendas(args, ObjectId) {
  const sufixo = args.ano === 'corrente' ? '' : '_' + args.ano;

  const reader = new MDBReader(fs.readFileSync(args.mdb));
  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  const nomeCupom = acharTabela(todas, 'Vendas_SaídaCupom' + sufixo);
  const nomeItens = acharTabela(todas, 'Vendas_SaídaCupomItens' + sufixo);

  if (!nomeCupom || !nomeItens) {
    console.error('\n[erro] tabelas nao encontradas para o ano "' + args.ano + '"');
    console.error('       cupom: ' + (nomeCupom || 'FALTA'));
    console.error('       itens: ' + (nomeItens || 'FALTA') + '\n');
    process.exit(1);
  }
  console.log('\nTabelas: ' + nomeCupom + '  +  ' + nomeItens);

  // data de cada cupom
  const dataCupom = new Map();
  for (const c of reader.getTable(nomeCupom).getData()) {
    if (dataValida(c['Data'])) dataCupom.set(Number(c['NrCupom']), c['Data']);
  }

  const docs = [];
  const porAno = new Map();
  let semCupom = 0, semChave = 0, menor = null, maior = null;

  for (const it of reader.getTable(nomeItens).getData()) {
    const nrCupom = Number(it['NrCupom']);
    const data = dataCupom.get(nrCupom);
    if (!data) { semCupom++; continue; }

    const chave = Number(it['Código']);
    if (!Number.isFinite(chave) || chave === 0) { semChave++; continue; }

    const ano = data.getUTCFullYear();
    porAno.set(ano, (porAno.get(ano) || 0) + 1);
    if (!menor || data < menor) menor = data;
    if (!maior || data > maior) maior = data;

    docs.push({
      lojistaId: new ObjectId(args.lojistaId),
      chaveOrigem: chave,                     // Vendas_SaídaCupomItens.Código
      nrCupom,
      data,
      ano,
      mes: data.getUTCMonth() + 1,
      codigoProd: Number(it['CódigoProd']) || 0,
      descricao: String(it['Descrição'] ?? '').trim(),
      nrFornec: Number(it['NrFornec']) || 0,
      quantidade: numero(it['Qte']),
      custoUnitario: centavos(it['VrCusto']),
      vendaUnitaria: centavos(it['VrVenda']),
      vendaTotalLiquida: centavos(it['VrTotalLiq']),
      devolucao: Number(it['NrDevolução']) !== 0,
      sincronizadoEm: new Date(),
    });
  }

  return { docs, semCupom, semChave, porAno, menor, maior };
}

// ---------------------------------------------------------------------------
// Relatorio da leitura
// ---------------------------------------------------------------------------
function relatar(r) {
  console.log('\nLinhas lidas ............. ' + r.docs.length);
  console.log('Sem cupom correspondente . ' + r.semCupom);
  console.log('Sem chave da linha ....... ' + r.semChave);

  if (r.menor) {
    console.log('Periodo .................. ' + r.menor.toISOString().slice(0, 10)
      + '  ate  ' + r.maior.toISOString().slice(0, 10));
  }

  console.log('\nPor ano:');
  for (const a of [...r.porAno.keys()].sort()) {
    console.log('    ' + a + '   ' + String(r.porAno.get(a)).padStart(7));
  }

  console.log('\nLinhas sem CódigoProd .... ' + r.docs.filter(d => !d.codigoProd).length);
  console.log('Linhas de devolucao ...... ' + r.docs.filter(d => d.devolucao).length);

  if (r.docs.length) {
    console.log('\nExemplo do que sera gravado:');
    for (const [k, v] of Object.entries(r.docs[0])) {
      const mostra = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
      console.log('    ' + k.padEnd(20) + ' = ' + mostra);
    }
  }
}

// ---------------------------------------------------------------------------
// Gravacao
// ---------------------------------------------------------------------------
async function gravar(docs, lojistaId, mongoose, connectToDatabase) {
  await connectToDatabase();

  const col = mongoose.connection.collection(COLECAO);

  await col.createIndex({ lojistaId: 1, chaveOrigem: 1, ano: 1 }, { unique: true });
  await col.createIndex({ lojistaId: 1, codigoProd: 1, data: -1 });
  await col.createIndex({ lojistaId: 1, nrFornec: 1, data: -1 });

  const filtroLojista = { lojistaId: new mongoose.Types.ObjectId(lojistaId) };
  const antes = await col.countDocuments(filtroLojista);

  let inseridos = 0, alterados = 0;
  const LOTE = 1000;

  for (let i = 0; i < docs.length; i += LOTE) {
    const ops = docs.slice(i, i + LOTE).map(d => ({
      updateOne: {
        filter: { lojistaId: d.lojistaId, chaveOrigem: d.chaveOrigem, ano: d.ano },
        update: { $set: d },
        upsert: true,
      },
    }));

    const r = await col.bulkWrite(ops, { ordered: false });
    inseridos += r.upsertedCount || 0;
    alterados += r.modifiedCount || 0;

    process.stdout.write('\r    gravando ... '
      + Math.min(i + LOTE, docs.length) + '/' + docs.length);
  }

  const depois = await col.countDocuments(filtroLojista);

  console.log('\n\n[ok] concluido.');
  console.log('    documentos antes .. ' + antes);
  console.log('    documentos depois . ' + depois);
  console.log('    inseridos ......... ' + inseridos);
  console.log('    atualizados ....... ' + alterados);

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
  console.log('Sincronizar vendas   ' + (args.aplicar ? '>>> APLICANDO <<<' : '(simulacao)'));
  console.log('MDB ......... ' + args.mdb);
  console.log('Ano ......... ' + args.ano);
  console.log('Lojista ..... ' + args.lojistaId);
  console.log('='.repeat(74));

  // A simulacao nao precisa de banco. So carrega mongoose se for aplicar.
  if (!args.aplicar) {
    const { Types } = require('mongoose');
    const r = lerVendas(args, Types.ObjectId);
    relatar(r);
    console.log('\n[simulacao] Nada foi gravado. Repita com --aplicar.\n');
    return;
  }

  const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

  if (!mongoose.Types.ObjectId.isValid(args.lojistaId)) {
    console.error('\n[erro] lojistaId invalido: ' + args.lojistaId + '\n');
    process.exit(1);
  }

  const r = lerVendas(args, mongoose.Types.ObjectId);
  relatar(r);

  await gravar(r.docs, args.lojistaId, mongoose, connectToDatabase);
}

main().catch(e => {
  console.error('\n[erro] ' + e.message);
  process.exit(1);
});