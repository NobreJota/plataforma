// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-14-fornecedores-para-cadastro.js
// Criado em: 30/09/2026
// Alterado em: 30/09/2026 - casa tambem pela CONTA: fornecedor do cadastro ja
//              ligado a mesma 2.01.001.xxx e o mesmo (Distak, Haenke... sem CNPJ
//              no Access). Pode rodar de novo: quem ja entrou so e remarcado.
//
// TRANSFERENCIA UNICA: fornecedores ATIVOS do Access (_fornec_access, gravado
// pelo COMPRA-10) entram no cadastro da plataforma (fornecs), cada um ligado
// a conta 2.01.001.xxx dele. Depois disso, fornecedor novo nasce na plataforma.
//
// Entra direto quem tem CNPJ valido e conta no plano. Os outros ficam em
// _fornec_access com `ajustar: [motivos]` e aparecem na lista de
// /aux/fornecedores com a etiqueta "ajustar", para completar na tela.
//
// CNPJ que ja existe em fornecs: so ganha o vinculo desta empresa (o cadastro
// compartilhado nao e sobrescrito). CNPJ ja ligado a esta empresa com OUTRA
// conta (Rinnai Equipamentos x Rinnai Assistencia): fica "ajustar".
//
// Endereco, IE e telefone vem de Compras_Fornecedores. Backup EJSON.
//
// Uso (um comando por vez):
//   node src/scripts/COMPRA-14-fornecedores-para-cadastro.js
//   node src/scripts/COMPRA-14-fornecedores-para-cadastro.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { validarDocumento } = require('../utils/validadorDocumento');

const MDB     = 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const LOJISTA = '6892706a86509313e632f717';

const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const acharColuna = (colunas, ...nomes) => colunas.find(c => nomes.includes(semAcento(c))) || null;
const texto = v => { const s = String(v ?? '').trim(); return (s === '0' || s === '0000') ? '' : s; };
const digitos = s => String(s ?? '').replace(/\D/g, '');
const normTexto = s => semAcento(String(s || '')).trim();

// No Access o estado vem por extenso ("São Paulo"); o cadastro guarda a sigla.
const UF = {
  'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE',
  'distrito federal':'DF','espirito santo':'ES','goias':'GO','maranhao':'MA',
  'mato grosso':'MT','mato grosso do sul':'MS','minas gerais':'MG','para':'PA',
  'paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI','rio de janeiro':'RJ',
  'rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO','roraima':'RR',
  'santa catarina':'SC','sao paulo':'SP','sergipe':'SE','tocantins':'TO',
};
const sigla = e => { const n = normTexto(e); return n.length === 2 ? n.toUpperCase() : (UF[n] || ''); };

(async function () {
  const aplicar = process.argv.includes('--aplicar');

  // ---- Access: dados de endereco e contato, por NrFornec --------------------
  const { default: MDBReader } = await import('mdb-reader');
  const t = new MDBReader(fs.readFileSync(MDB)).getTable('Compras_Fornecedores');
  const col = t.getColumnNames();
  const A = {
    nr: acharColuna(col, 'nrfornec'), end: acharColuna(col, 'end', 'endereco'),
    cep: acharColuna(col, 'cep'), bairro: acharColuna(col, 'bairro'),
    ins: acharColuna(col, 'ins', 'inscricao'), fone: acharColuna(col, 'fone', 'telefone'),
    email: acharColuna(col, 'email', 'e-mail'),
  };
  const doAccess = new Map(t.getData().map(l => [Number(l[A.nr]), l]));
  const campo = (l, k) => (A[k] && l ? texto(l[A[k]]) : '');

  // ---- banco ----------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const acc = await db.collection('_fornec_access')
    .find({ lojistaId, ativo: { $ne: false } }).sort({ razao: 1 }).toArray();
  const contas = new Map((await db.collection('_contasubtitulos')
    .find({ lojistaId, codigoContaTitulo: '2.01.001' }).toArray()).map(c => [c.codigo, c]));

  // conta -> fornecedor do cadastro que ja esta ligado a ela nesta empresa
  const porConta = new Map();
  for (const f of await db.collection('fornecs').find({ 'vinculos.lojistaId': lojistaId }).toArray()) {
    const v = (f.vinculos || []).find(x => String(x.lojistaId) === LOJISTA);
    if (v && v.ncontabil) porConta.set(v.ncontabil, f);
  }

  const criar = [], vincular = [], jaEsta = [], ajustar = [];

  for (const a of acc) {
    if (a.contaNova && porConta.has(a.contaNova)) { jaEsta.push({ a, f: porConta.get(a.contaNova) }); continue; }
    const motivos = [];
    const cnpj = digitos(a.cnpj);
    const tipo = cnpj.length === 11 ? 'PF' : 'PJ';
    if (!cnpj) motivos.push('sem CNPJ');
    else if (!validarDocumento(cnpj, tipo)) motivos.push('CNPJ inválido');
    if (!a.contaNova) motivos.push('sem conta no Access');
    else if (!contas.has(a.contaNova)) motivos.push('conta ' + a.contaNova + ' fora do plano');

    let existente = null;
    if (!motivos.length) {
      existente = await db.collection('fornecs').findOne({ cnpj });
      const v = existente && (existente.vinculos || []).find(x => String(x.lojistaId) === LOJISTA);
      if (v && v.ncontabil !== a.contaNova) motivos.push('mesmo CNPJ de ' + existente.razao + ' (' + v.ncontabil + ')');
      else if (v) { jaEsta.push({ a, f: existente }); continue; }
    }
    if (motivos.length) { ajustar.push({ a, motivos }); continue; }

    if (existente) vincular.push({ a, f: existente });
    else criar.push({ a, cnpj, tipo, l: doAccess.get(Number(a.nrFornec)) });
  }

  console.log('Ativos no Access:', acc.length);
  console.log('  ja no cadastro, mesma conta:', jaEsta.length);
  console.log('  entram (cadastro novo):     ', criar.length);
  console.log('  entram (so vinculo):        ', vincular.length);
  console.log('  ficam "ajustar":            ', ajustar.length);
  ajustar.forEach(x => console.log('     ', String(x.a.nrFornec).padStart(4), '|',
    (x.a.marca || x.a.razao).padEnd(18), '|', x.motivos.join('; ')));
  const semContato = criar.filter(c => !campo(c.l, 'fone') && !campo(c.l, 'email')).length;
  if (semContato) console.log('  (dos novos,', semContato, 'sem telefone nem e-mail: aparecem "ajustar" na tela)');

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // ---- aplicar --------------------------------------------------------------
  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup');
  fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, 'COMPRA-14-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify({ fornec_access: acc, fornecs: vincular.map(v => v.f) },
    null, 2, { relaxed: false }));
  console.log('\nBackup:', arq);

  const agora = new Date();
  const marcar = (a, fornecId, motivos) => db.collection('_fornec_access').updateOne(
    { _id: a._id }, { $set: { fornecId: fornecId || null, ajustar: motivos || [] } });

  for (const { a, f } of jaEsta) await marcar(a, f._id);

  for (const { a, f } of vincular) {
    await db.collection('fornecs').updateOne({ _id: f._id }, {
      $push: { vinculos: { lojistaId, ncontabil: a.contaNova, ativo: true } },
      $set: { updateAt: agora },
    });
    await marcar(a, f._id);
  }

  for (const { a, cnpj, tipo, l } of criar) {
    const razao = a.razao || a.marca;
    const r = await db.collection('fornecs').insertOne({
      tipo, razao, razaoNorm: normTexto(razao), cnpj,
      lojistas: [], vinculos: [{ lojistaId, ncontabil: a.contaNova, ativo: true }],
      vinculosAnteriores: [],
      inscricao: campo(l, 'ins'), inscricaoMunicipal: '', ncontabil: '',
      marca: a.marca || '', email: campo(l, 'email'), telefone: campo(l, 'fone'),
      address: {
        cep: digitos(campo(l, 'cep')), logradouro: campo(l, 'end'), numero: '', complemento: '',
        bairro: campo(l, 'bairro'), cidade: a.cidade || '', estado: sigla(a.estado),
      },
      contato: {
        representante: { nome: '', email: '', celular: '' },
        comercial: { nome: '', email: '', celular: '' },
        tecnica: { nome: '', email: '', celular: '' },
      },
      ativo: true, createAt: agora, updateAt: agora,
    });
    await marcar(a, r.insertedId);
  }

  for (const { a, motivos } of ajustar) await marcar(a, null, motivos);

  console.log('cadastrados:', criar.length, '| vinculados:', vincular.length,
    '| ja estavam:', jaEsta.length, '| ajustar:', ajustar.length);

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
