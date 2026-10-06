// =============================================================================
// Destino: C:\plataformaRota\src\scripts\CLIENTE-2-importar.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - rua, edificio e tipo de logradouro pelas colunas
//              certas (CLIENTE-3): rua = Ruas_Avenidas.Codigo -> Nmlogradouro + Tipo;
//              tipo = TipoLogradouro.NrTipo -> NomeTipo; edificio = Codigo -> nome
//              titulo do plano so em _contatitulos (a colecao do model; a antiga
//              'contatitulos' nao e usada)
//
// Importa os clientes do Access para _aux_clientes e as contas deles para o plano.
//
// CLIENTES
//   Cliente_PFis -> tipo PF, codigo "F" + NCliente   (F17281)
//   Cliente_PJur -> tipo PJ, codigo "J" + NCliente   (J1705)
//   nrAccess = NCliente (numero puro: liga com as vendas do Access)
//   Entra como esta: sem CPF/CNPJ fica vazio. ncontabil = NContabil.
//   Endereco do PF vem em codigos: rua, edificio, tipo de logradouro, bairro,
//   cidade e estado sao traduzidos pelas tabelas UsoGeral_*. No PJ pode vir
//   texto ou codigo; os dois casos sao tratados.
//   Rodar de novo ATUALIZA (chave: lojistaId + codigo). Backup EJSON antes.
//
// CONTAS
//   Os subtitulos de Contab_CtasTitulosSub dos titulos usados pelos clientes
//   (1.03.xxx e 1.04.xxx) entram em _contasubtitulos, com lojistaId. Conta que
//   o cliente tem e a tabela nao tem nasce com o nome do cliente. Conta que ja
//   existe no plano nao e tocada. Titulo que nao existe no plano e listado.
//
// Uso (um comando por vez):
//   node src/scripts/CLIENTE-2-importar.js
//   node src/scripts/CLIENTE-2-importar.js --aplicar
// Opcoes: --mdb "C:\Armação\Dados\2026B\2026B.mdb"   --lojista <id>
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const args = process.argv.slice(2);
const opcao = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };
const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');

// ---- utilitarios -------------------------------------------------------------
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = s => semAcento(s).toLowerCase().trim();
const texto = v => {
  const s = String(v ?? '').trim();
  return (s === '' || s === '0' || s === '0000' || /^[0.\-/ ]+$/.test(s)) ? '' : s;
};
const digitos = v => String(v ?? '').replace(/\D/g, '');
const ehCodigo = v => /^\d+$/.test(String(v ?? '').trim());
const dataValida = d => d instanceof Date && !isNaN(d) && d.getUTCFullYear() > 1950;
const RX_CONTA = /^\d\.\d{2}\.\d{3}\.\d{3,4}$/;
const tituloDe = c => c.split('.').slice(0, 3).join('.');

const UF = {
  'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE',
  'distrito federal':'DF','espirito santo':'ES','goias':'GO','maranhao':'MA',
  'mato grosso':'MT','mato grosso do sul':'MS','minas gerais':'MG','para':'PA',
  'paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI','rio de janeiro':'RJ',
  'rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO','roraima':'RR',
  'santa catarina':'SC','sao paulo':'SP','sergipe':'SE','tocantins':'TO',
};
const sigla = e => { const n = norm(e); return n.length === 2 ? n.toUpperCase() : (UF[n] || ''); };

(async function () {
  const aplicar = args.includes('--aplicar');
  const reader = new MDBReader(fs.readFileSync(MDB));
  const todas = reader.getTableNames();
  const achar = n => todas.find(t => t === n) || todas.find(t => norm(t) === norm(n));
  const tabela = n => { const t = achar(n); return t ? reader.getTable(t) : null; };

  // ---- tabelas de codigo (UsoGeral_*) -------------------------------------------
  // Chave = as colunas Nr* da tabela, na ordem. NrEstado/NrCidade/NrBairro pegam
  // o valor do cliente; a ultima Nr* e o proprio codigo do campo.
  const GEO = { nrestado: 'estado', nrcidade: 'cidade', nrbairro: 'bairro' };
  function montarLookup(nome) {
    const t = tabela(nome);
    if (!t) return { nome, ok: false, buscar: () => '' };
    const cols = t.getColumnNames();
    const nr = cols.filter(c => /^nr/i.test(c));
    const nomeCol = cols.find(c => !/^nr/i.test(c) && !/^status$/i.test(c));
    const mapa = new Map();
    for (const l of t.getData()) mapa.set(nr.map(c => String(l[c] ?? '').trim()).join('|'), String(l[nomeCol] ?? '').trim());
    const buscar = (codigo, geo) => {
      if (!ehCodigo(codigo)) return '';
      const chave = nr.map((c, i) => {
        const g = GEO[norm(c)];
        if (g && i < nr.length - 1) return String(geo[g] ?? '').trim();
        return String(codigo).trim();
      }).join('|');
      return mapa.get(chave) || '';
    };
    return { nome, ok: true, cols, nr, nomeCol, linhas: mapa.size, buscar };
  }
  const L = {
    estado: montarLookup('UsoGeral_Estado'),
    cidade: montarLookup('UsoGeral_Cidades'),
    bairro: montarLookup('UsoGeral_Bairros'),
  };

  // ---- rua, tipo de logradouro e edificio: colunas conhecidas (CLIENTE-3) ----------
  const tipoNome = new Map();   // NrTipo -> "Av."
  const tTipo = tabela('UsoGeral_TipoLogradouro');
  if (tTipo) for (const l of tTipo.getData()) tipoNome.set(String(l['NrTipo'] ?? '').trim(), texto(l['NomeTipo']));

  const ruas = new Map();       // Codigo -> { nome, tipo }
  const tRua = tabela('UsoGeral_Ruas_Avenidas');
  if (tRua) for (const l of tRua.getData()) {
    ruas.set(String(l['Código'] ?? '').trim(), { nome: texto(l['Nmlogradouro']), tipo: String(l['Tipo'] ?? '').trim() });
  }

  const edificios = new Map();  // Codigo -> nome
  const tEdif = tabela('UsoGeral_Edifício');
  let edifCols = { chave: null, nome: null };
  if (tEdif) {
    const cols = tEdif.getColumnNames();
    const so = c => norm(c).replace(/[^a-z]/g, '');
    edifCols.chave = cols.find(c => so(c) === 'codigo') || cols.find(c => /^(nr|cod)/i.test(c));
    edifCols.nome = cols.find(c => ['nmedificio', 'nomedoedificio', 'nomeedificio', 'edificio', 'nmedif', 'nome'].includes(so(c)))
      || cols.find(c => c !== edifCols.chave && !/numero|codigo|^nr|cep|postal/i.test(so(c)));
    for (const l of tEdif.getData()) edificios.set(String(l[edifCols.chave] ?? '').trim(), texto(l[edifCols.nome]));
    edifCols.todas = cols;
  }

  const nomeRua = v => {
    if (!ehCodigo(v)) return texto(v);                    // PJ: as vezes vem o texto
    const r = ruas.get(String(v).trim());
    if (!r) return '';
    return [tipoNome.get(r.tipo) || '', r.nome].filter(Boolean).join(' ');
  };
  const nomeEdif = v => ehCodigo(v) ? (edificios.get(String(v).trim()) || '') : texto(v);

  // valor que pode ser texto ou codigo
  const traduz = (lk, v, geo) => ehCodigo(v) ? lk.buscar(v, geo) : texto(v);

  function endereco(geoCod, ruaV, numero, complemento, cep) {
    const geo = { estado: geoCod.estado, cidade: geoCod.cidade, bairro: geoCod.bairro };
    const estado = traduz(L.estado, geoCod.estado, geo);
    return {
      cep: digitos(cep).slice(0, 8).length === 8 ? digitos(cep).slice(0, 8) : '',
      logradouro: nomeRua(ruaV),
      numero: texto(numero),
      complemento: complemento.filter(Boolean).join(' ').trim(),
      bairro: traduz(L.bairro, geoCod.bairro, geo),
      cidade: traduz(L.cidade, geoCod.cidade, geo),
      uf: sigla(estado),
    };
  }

  // ---- clientes ------------------------------------------------------------------
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);
  const clientes = [];

  for (const l of tabela('Cliente_PFis').getData()) {
    const nr = Number(l['NCliente']);
    if (!nr) continue;
    const geo = { estado: l['Estado'], cidade: l['Cidade'], bairro: l['Bairro'] };
    const edif = nomeEdif(l['Edifício']);
    const apto = texto(l['Apto']);
    const end = endereco(geo, l['End'], l['Nr_End'],
      [edif ? 'Ed. ' + edif : '', apto ? 'apto ' + apto : ''], l['Cep']);
    clientes.push({
      codigo: 'F' + nr, nrAccess: nr, tipo: 'PF',
      nome: texto(l['Nome']) || ('Cliente F' + nr),
      cpfCnpj: digitos(l['Cpf']).length >= 11 ? digitos(l['Cpf']) : '',
      telefone: texto(l['Celular']) || texto(l['FoneRes']) || texto(l['FoneComal']),
      email: '',
      ncontabil: RX_CONTA.test(texto(l['NContabil'])) ? texto(l['NContabil']) : '',
      enderecoCobranca: end, enderecoEntrega: { ...end }, entregaIgualCobranca: true,
      criadoEm: dataValida(l['Data']) ? l['Data'] : new Date(),
    });
  }

  for (const l of tabela('Cliente_PJur').getData()) {
    const nr = Number(l['NCliente']);
    if (!nr) continue;
    const geo = { estado: l['Estado'], cidade: l['Cidade'], bairro: l['Bairro'] };
    const edif = nomeEdif(l['Edifício']);
    const sala = texto(l['Sala']);
    const end = endereco(geo, l['End'], l['NrRua'],
      [edif ? 'Ed. ' + edif : '', sala ? 'sala ' + sala : ''], l['Cep']);
    const email = texto(l['Email']);
    clientes.push({
      codigo: 'J' + nr, nrAccess: nr, tipo: 'PJ',
      nome: texto(l['Razão']) || ('Cliente J' + nr),
      cpfCnpj: digitos(l['CGC']).length >= 11 ? digitos(l['CGC']) : '',
      inscricaoEstadual: texto(l['Inscr']),
      telefone: texto(l['Fone']) || texto(l['Cel']),
      email: email.includes('@') ? email.toLowerCase() : '',
      observacoes: texto(l['Comprador']) ? 'Comprador: ' + texto(l['Comprador']) : '',
      ncontabil: RX_CONTA.test(texto(l['NContabil'])) ? texto(l['NContabil']) : '',
      enderecoCobranca: end, enderecoEntrega: { ...end }, entregaIgualCobranca: true,
      criadoEm: dataValida(l['Data']) ? l['Data'] : new Date(),
    });
  }

  // ---- contas ----------------------------------------------------------------------
  const titulosUsados = new Set(clientes.filter(c => c.ncontabil).map(c => tituloDe(c.ncontabil)));
  const contas = new Map();   // codigo -> nome
  for (const l of tabela('Contab_CtasTitulosSub').getData()) {
    const cod = String(l['NrSubCtasTitulos'] ?? '').trim();
    if (RX_CONTA.test(cod) && titulosUsados.has(tituloDe(cod))) contas.set(cod, texto(l['NmSubCtasTitulos']) || cod);
  }
  let contasPeloCliente = 0;
  for (const c of clientes) {
    if (c.ncontabil && !contas.has(c.ncontabil)) { contas.set(c.ncontabil, c.nome); contasPeloCliente++; }
  }

  // ---- relatorio ---------------------------------------------------------------------
  const pf = clientes.filter(c => c.tipo === 'PF'), pj = clientes.filter(c => c.tipo === 'PJ');
  console.log('Tabelas de codigo:');
  for (const lk of Object.values(L)) {
    console.log('  ' + lk.nome.padEnd(26) + (lk.ok ? 'chave ' + lk.nr.join('+') + ' -> ' + lk.nomeCol + ' (' + lk.linhas + ')' : 'NAO ENCONTRADA'));
  }
  console.log('  UsoGeral_Ruas_Avenidas    chave Código -> Tipo + Nmlogradouro (' + ruas.size + ')');
  console.log('  UsoGeral_TipoLogradouro   chave NrTipo -> NomeTipo (' + tipoNome.size + ')');
  console.log('  UsoGeral_Edifício         chave ' + edifCols.chave + ' -> ' + edifCols.nome + ' (' + edificios.size + ')'
    + '   <- CONFIRA: colunas ' + (edifCols.todas || []).join(', '));
  console.log('\nClientes PF:', pf.length, '| sem CPF:', pf.filter(c => !c.cpfCnpj).length,
    '| sem conta:', pf.filter(c => !c.ncontabil).length, '| sem cidade:', pf.filter(c => !c.enderecoCobranca.cidade).length);
  console.log('Clientes PJ:', pj.length, '| sem CNPJ:', pj.filter(c => !c.cpfCnpj).length,
    '| sem conta:', pj.filter(c => !c.ncontabil).length, '| sem cidade:', pj.filter(c => !c.enderecoCobranca.cidade).length);
  console.log('\nExemplos (confira o endereco traduzido):');
  [...pf.slice(-3), ...pj.slice(-3)].forEach(c => {
    const e = c.enderecoCobranca;
    console.log('  ' + c.codigo.padEnd(7) + c.nome.slice(0, 28).padEnd(29) + '| ' + [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ')
      + ' | ' + e.bairro + ' | ' + e.cidade + '/' + e.uf + ' | ' + (c.ncontabil || '-'));
  });
  console.log('\nTitulos de conta usados pelos clientes:', [...titulosUsados].sort().join(', '));
  console.log('Contas a garantir no plano:', contas.size, '(das quais', contasPeloCliente, 'so existem no cliente)');

  // ---- banco ---------------------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  // o titulo (contaTituloId) de cada 1.03.xxx / 1.04.xxx
  const colTitulos = ['_contatitulos'];   // a do model ContaTitulo; a antiga 'contatitulos' fica de fora
  const tituloInfo = new Map();
  for (const t of titulosUsados) {
    let doc = null;
    for (const n of colTitulos) {
      doc = await db.collection(n).findOne({ codigo: t, lojistaId });
      if (doc) break;
    }
    if (doc) { tituloInfo.set(t, { contaTituloId: doc._id }); continue; }
    const irma = await db.collection('_contasubtitulos').findOne({ codigoContaTitulo: t, lojistaId });
    if (irma) tituloInfo.set(t, { contaTituloId: irma.contaTituloId });
  }
  const semTitulo = [...titulosUsados].filter(t => !tituloInfo.has(t)).sort();

  const jaNoPlano = new Set((await db.collection('_contasubtitulos')
    .find({ lojistaId, codigo: { $in: [...contas.keys()] } }).project({ codigo: 1 }).toArray()).map(d => d.codigo));
  const novas = [...contas].filter(([cod]) => !jaNoPlano.has(cod) && tituloInfo.has(tituloDe(cod)));

  console.log('\nColecao de titulos achada:', colTitulos.join(', ') || '(nenhuma; usei subtitulos irmaos)');
  console.log('Contas ja no plano:', jaNoPlano.size, '| a criar:', novas.length);
  if (semTitulo.length) console.log('TITULOS QUE NAO EXISTEM NO PLANO (contas deles nao serao criadas):', semTitulo.join(', '));

  const existentes = await db.collection('_aux_clientes').countDocuments({ lojistaId, codigo: { $in: clientes.map(c => c.codigo) } });
  console.log('\nClientes ja na plataforma com esses codigos (serao atualizados):', existentes);

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // ---- aplicar ---------------------------------------------------------------------------
  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup');
  fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, 'CLIENTE-2-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify(await db.collection('_aux_clientes').find({ lojistaId }).toArray(), null, 2, { relaxed: false }));
  console.log('\nBackup dos clientes atuais:', arq);

  // CPF/CNPJ deixa de ser unico (cliente importado pode vir sem ou repetido)
  try { await db.collection('_aux_clientes').dropIndex('lojistaId_1_cpfCnpj_1'); console.log('Indice unico de CPF/CNPJ removido.'); }
  catch (e) { /* ja nao existia */ }
  await db.collection('_aux_clientes').createIndex({ lojistaId: 1, cpfCnpj: 1 });
  await db.collection('_aux_clientes').createIndex({ lojistaId: 1, tipo: 1, nome: 1 });
  await db.collection('_aux_clientes').createIndex({ lojistaId: 1, nrAccess: 1 });

  const agora = new Date();
  let ins = 0, alt = 0;
  for (let i = 0; i < clientes.length; i += 1000) {
    const r = await db.collection('_aux_clientes').bulkWrite(clientes.slice(i, i + 1000).map(c => {
      const { criadoEm, ...dados } = c;
      return {
        updateOne: {
          filter: { lojistaId, codigo: c.codigo },
          update: {
            $set: { ...dados, lojistaId, origemAccess: true, atualizadoEm: agora },
            $setOnInsert: { ativo: true, criadoEm, inscricaoMunicipal: '' },
          },
          upsert: true,
        },
      };
    }), { ordered: false });
    ins += r.upsertedCount || 0; alt += r.modifiedCount || 0;
    process.stdout.write('\r    clientes ... ' + Math.min(i + 1000, clientes.length) + '/' + clientes.length);
  }
  console.log('\nClientes inseridos:', ins, '| atualizados:', alt);

  if (novas.length) {
    const docs = novas.map(([codigo, nome]) => ({
      contaTituloId: tituloInfo.get(tituloDe(codigo)).contaTituloId,
      codigoContaTitulo: tituloDe(codigo), codigo, nome, descricao: '',
      saldoInicial: 0, natureza: 'devedora', ativo: true, lojistaId,
      criadoEm: agora, atualizadoEm: agora,
    }));
    for (let i = 0; i < docs.length; i += 1000) {
      await db.collection('_contasubtitulos').insertMany(docs.slice(i, i + 1000), { ordered: false });
    }
  }
  console.log('Contas criadas no plano:', novas.length);

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
