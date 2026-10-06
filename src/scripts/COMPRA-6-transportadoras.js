// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-6-transportadoras.js
// Alterado em: 24/09/2026  (nomes reais das colunas: NTransp, RzTransp, Inscr, Fone1)
//
// Cadastra em _transportadora_origem as transportadoras que entregaram
// no ano corrente, cruzando NFE_Cabeçalho.NrTransp com Compras_Transportadoras.
//
// NAO toca em nenhuma colecao existente.
// SIMULACAO por padrao. So grava com --aplicar.
//
// Uso (na raiz C:\plataformaRota):
//   node src\scripts\COMPRA-6-transportadoras.js --mdb "C:\Armação\Dados\2026B\2026B.mdb"
//   node src\scripts\COMPRA-6-transportadoras.js --mdb "..." --aplicar
//   node src\scripts\COMPRA-6-transportadoras.js --mdb "..." --desde 2025 --aplicar
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

const COLECAO = '_transportadora_origem';
const LOJISTA_PADRAO = '6892706a86509313e632f717';

function lerArgs(argv) {
  const args = { desde: new Date().getUTCFullYear() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mdb') args.mdb = argv[++i];
    else if (a === '--lojista') args.lojista = argv[++i];
    else if (a === '--desde') args.desde = Number(argv[++i]);
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

// o Access usa "0" e "0000" como vazio em campos de texto
function texto(v) {
  const s = String(v ?? '').trim();
  return (s === '0' || s === '0000') ? '' : s;
}

// junta os fones nao vazios, sem repetir
function juntarFones(...valores) {
  const vistos = new Set();
  for (const v of valores) {
    const t = texto(v);
    if (t) vistos.add(t);
  }
  return [...vistos];
}

// ---------------------------------------------------------------------------
function levantar(args, ObjectId) {
  const reader = new MDBReader(fs.readFileSync(args.mdb));
  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  const nomeNota = acharTabela(todas, 'NFE_Cabeçalho');
  const nomeTransp = acharTabela(todas, 'Compras_Transportadoras');

  if (!nomeNota || !nomeTransp) {
    console.error('\n[erro] tabela nao encontrada');
    console.error('       notas:    ' + (nomeNota || 'FALTA'));
    console.error('       cadastro: ' + (nomeTransp || 'FALTA') + '\n');
    process.exit(1);
  }
  console.log('\nTabelas: ' + nomeNota + '  +  ' + nomeTransp);

  // ---- quem entregou no periodo -------------------------------------------
  const uso = new Map();
  let notas = 0, notasSemTransp = 0;

  for (const n of reader.getTable(nomeNota).getData()) {
    const dt = dataValida(n['DataEntr']) ? n['DataEntr']
             : (dataValida(n['Emissão']) ? n['Emissão'] : null);
    if (!dt || dt.getUTCFullYear() < args.desde) continue;

    notas++;
    const nr = Number(n['NrTransp']) || 0;
    if (!nr) { notasSemTransp++; continue; }

    if (!uso.has(nr)) uso.set(nr, { notas: 0, frete: 0, ultima: null });
    const u = uso.get(nr);
    u.notas++;
    u.frete += Number(n['VrFrete']) || 0;
    if (!u.ultima || dt > u.ultima) u.ultima = dt;
  }

  // ---- cadastro: a chave e NTransp ----------------------------------------
  const cadastro = new Map();
  for (const c of reader.getTable(nomeTransp).getData()) {
    const nr = Number(c['NTransp']);
    if (Number.isFinite(nr) && nr !== 0) cadastro.set(nr, c);
  }

  // ---- montar --------------------------------------------------------------
  const docs = [];
  for (const [nr, u] of uso) {
    const c = cadastro.get(nr) || {};
    docs.push({
      lojistaId: new ObjectId(args.lojistaId),
      nrTransp: nr,
      razao: texto(c['RzTransp']),
      marca: texto(c['Marca']),
      cnpj: texto(c['CGC']),
      inscricao: texto(c['Inscr']),
      endereco: texto(c['End']),
      bairro: texto(c['Bairro']),
      cidade: texto(c['Cidade']),
      estado: texto(c['Estado']),
      cep: texto(c['Cep']),
      fones: juntarFones(c['Fone1'], c['Fone2'], c['Fone3']),
      fax: texto(c['Fax']),
      contato: texto(c['Contato']),
      gerente: texto(c['Gerente']),
      contaAntiga: texto(c['NrContabil']),
      noCadastro: cadastro.has(nr),
      notasNoPeriodo: u.notas,
      freteTotal: Math.round(u.frete * 100),   // centavos
      ultimaNota: u.ultima,
      ativo: true,
      sincronizadoEm: new Date(),
    });
  }

  docs.sort((a, b) => b.notasNoPeriodo - a.notasNoPeriodo);

  return { docs, notas, notasSemTransp, totalCadastro: cadastro.size };
}

// ---------------------------------------------------------------------------
function relatar(r, args) {
  console.log('\nNotas desde ' + args.desde + ' ......... ' + r.notas);
  console.log('    sem transportadora ... ' + r.notasSemTransp
    + '   (frete CIF, pago pelo fabricante)');
  console.log('Cadastro completo ........ ' + r.totalCadastro + ' transportadoras');
  console.log('Entregaram no periodo .... ' + r.docs.length);

  const semNome = r.docs.filter(d => !d.razao).length;
  if (semNome) {
    console.log('\n[aviso] ' + semNome + ' sem nome no cadastro.');
  }

  console.log('');
  for (const d of r.docs) {
    console.log('    NTransp ' + String(d.nrTransp).padStart(4) + '  '
      + (d.razao || '(sem cadastro)'));
    console.log('        cidade ..... ' + (d.cidade || '-') + '/' + (d.estado || '-'));
    console.log('        fones ...... ' + (d.fones.join('  ') || '-'));
    console.log('        contato .... ' + (d.contato || '-')
      + (d.gerente ? '   gerente: ' + d.gerente : ''));
    console.log('        notas ...... ' + d.notasNoPeriodo
      + '   frete R$ ' + (d.freteTotal / 100).toFixed(2)
      + '   ultima ' + (d.ultimaNota ? d.ultimaNota.toISOString().slice(0, 10) : '-'));
    console.log('');
  }
}

// ---------------------------------------------------------------------------
async function gravar(docs, lojistaId, mongoose, connectToDatabase) {
  await connectToDatabase();

  const col = mongoose.connection.collection(COLECAO);
  await col.createIndex({ lojistaId: 1, nrTransp: 1 }, { unique: true });

  const filtro = { lojistaId: new mongoose.Types.ObjectId(lojistaId) };
  const antes = await col.countDocuments(filtro);

  let inseridos = 0, alterados = 0;
  if (docs.length) {
    const ops = docs.map(d => ({
      updateOne: {
        filter: { lojistaId: d.lojistaId, nrTransp: d.nrTransp },
        update: { $set: d },
        upsert: true,
      },
    }));
    const r = await col.bulkWrite(ops, { ordered: false });
    inseridos = r.upsertedCount || 0;
    alterados = r.modifiedCount || 0;
  }

  const depois = await col.countDocuments(filtro);

  console.log('[ok] concluido.');
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
  console.log('Transportadoras   ' + (args.aplicar ? '>>> APLICANDO <<<' : '(simulacao)'));
  console.log('MDB ......... ' + args.mdb);
  console.log('Desde ....... ' + args.desde);
  console.log('Colecao ..... ' + COLECAO + '   (nova)');
  console.log('='.repeat(74));

  if (!args.aplicar) {
    const { Types } = require('mongoose');
    relatar(levantar(args, Types.ObjectId), args);
    console.log('[simulacao] Nada foi gravado. Repita com --aplicar.\n');
    return;
  }

  const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));
  const r = levantar(args, mongoose.Types.ObjectId);
  relatar(r, args);
  await gravar(r.docs, args.lojistaId, mongoose, connectToDatabase);
}

main().catch(e => {
  console.error('\n[erro] ' + e.message);
  process.exit(1);
});