// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-12-contas-fornecedor-pelo-access.js
// Criado em: 29/09/2026
// Alterado em: 29/09/2026 - nome da conta no Access: NmSubCtasTitulos
//
// FIM DO DE/PARA NOS FORNECEDORES. A regra passa a ser uma so:
//   conta do fornecedor = NrContabil do Access com "2.02." trocado por "2.01."
//   (Rinnai 2.02.001.074 -> 2.01.001.074)
//
// Tres passos, nesta ordem:
//
// 1. LIMPEZA dos lancamentos de teste. Corte pela DATA DE EMISSAO do
//    documento (padrao: hoje 00:00; --corte AAAA-MM-DD muda):
//      _boletas               data < corte            (todos os tipos)
//      _compra_pedidos        dataEmissao < corte     (sem dataEmissao: criadoEm)
//      _compra_notas_entrada  dataEmissao < corte     (sem dataEmissao: criadoEm)
//      _fluxo_projetado       as linhas geradas por esses pedidos e notas
//                             + pos 2 e 7 criadas antes do corte.
//                             Orcamento (pos 8), 3 e 5 NAO sao apagados; se
//                             estavam quitados por boleta apagada, voltam a ATIVO.
//
// 2. PLANO 2.01.001 refeito a partir de Contab_CtasTitulosSub (so 2.02.001.xxx):
//    os subtitulos 2.01.001 atuais DESTA EMPRESA saem e entram os do Access,
//    com lojistaId. Conta de fornecedor com Ativado <> 1 entra suspensa.
//
// 3. FORNECS: vinculos[].ncontabil desta empresa passa a ser a conta nova.
//    Casa pelo CNPJ (Access CGC x fornec.cnpj). Sem CNPJ no Access, usa o
//    _mapa_contas uma ultima vez (conta velha -> antiga -> troca de prefixo).
//
// Backup EJSON de tudo que for apagado ou alterado, antes de aplicar.
// NAO desfaz estoque da nota apagada: o COMPRA-5 sobrescreve o estoque.
//
// Uso (um comando por vez):
//   node src/scripts/COMPRA-12-contas-fornecedor-pelo-access.js --inspecionar
//   node src/scripts/COMPRA-12-contas-fornecedor-pelo-access.js          (simulacao)
//   node src/scripts/COMPRA-12-contas-fornecedor-pelo-access.js --aplicar
// Opcoes: --mdb "C:\...\2026B.mdb"  --lojista <id>  --corte AAAA-MM-DD
//         --col-codigo <coluna>  --col-nome <coluna>   (se a deteccao errar)
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const tem = f => args.includes(f);
const opcao = (f, padrao) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};

const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');
const TITULO_NOVO = '2.01.001';
const PREFIXO_ANTIGO = '2.02.001.';

const RX_CONTA = /^\d\.\d{2}\.\d{3}\.\d{3,4}$/;

// ---- utilitarios ------------------------------------------------------------
const semAcento = s => String(s).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase();
const acharColuna = (colunas, ...nomes) =>
  colunas.find(c => nomes.includes(semAcento(c))) || null;
const texto = v => {
  const s = String(v ?? '').trim();
  return (s === '0' || s === '0000') ? '' : s;
};
const digitos = s => String(s ?? '').replace(/\D/g, '');
const trocar = c => String(c).replace(/^2\.02\./, '2.01.');
const ehAtivo = v => v === true || v === 1 || String(v ?? '').trim() === '1';
const secao = t => console.log('\n' + '='.repeat(74) + '\n' + t + '\n' + '='.repeat(74));

function dataCorte() {
  const s = opcao('--corte', '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}

// ---- principal --------------------------------------------------------------
(async function () {

  const corte = dataCorte();
  const aplicar = tem('--aplicar');

  // ============================================================== ACCESS ====
  if (!fs.existsSync(MDB)) { console.error('Access nao encontrado:', MDB); process.exitCode = 1; return; }
  const { default: MDBReader } = await import('mdb-reader');
  const reader = new MDBReader(fs.readFileSync(MDB));
  const tabelas = reader.getTableNames();

  for (const t of ['Contab_CtasTitulosSub', 'Compras_Fornecedores']) {
    if (!tabelas.includes(t)) {
      console.error('Tabela', t, 'nao encontrada. Parecidas:',
        tabelas.filter(n => /ctas|titul|fornec/i.test(n)).join(', '));
      process.exitCode = 1; return;
    }
  }

  // --- Contab_CtasTitulosSub
  const tSub = reader.getTable('Contab_CtasTitulosSub');
  const colSub = tSub.getColumnNames();
  const linhasSub = tSub.getData();

  let cCod = opcao('--col-codigo', '');
  if (!cCod) {   // a coluna com mais valores no formato 2.02.001.074
    let melhor = 0;
    for (const c of colSub) {
      const n = linhasSub.filter(l => RX_CONTA.test(String(l[c] ?? '').trim())).length;
      if (n > melhor) { melhor = n; cCod = c; }
    }
  }
  const cNome = opcao('--col-nome', '')
    || acharColuna(colSub, 'nmsubctastitulos', 'nome', 'nomeconta', 'descricao', 'conta', 'titulo', 'denominacao', 'subtitulo');

  // --- Compras_Fornecedores
  const tF = reader.getTable('Compras_Fornecedores');
  const colF = tF.getColumnNames();
  const CF = {
    nr:    acharColuna(colF, 'nrcontabil', 'ncontabil'),
    at:    acharColuna(colF, 'ativado'),
    cgc:   acharColuna(colF, 'cgc', 'cnpj'),
    razao: acharColuna(colF, 'razao'),
    marca: acharColuna(colF, 'marca'),
  };
  const linhasF = tF.getData();

  secao('Access');
  console.log('Contab_CtasTitulosSub:', linhasSub.length, 'linhas');
  console.log('  colunas:', colSub.join(', '));
  console.log('  codigo =', cCod || '*** NAO ACHADA ***', '| nome =', cNome || '*** NAO ACHADA ***');
  console.log('Compras_Fornecedores: NrContabil =', CF.nr, '| Ativado =', CF.at, '| CGC =', CF.cgc);

  if (tem('--inspecionar')) {
    console.log('\nCinco linhas de 2.02.001 como vieram:');
    linhasSub.filter(l => String(l[cCod] ?? '').trim().startsWith(PREFIXO_ANTIGO))
      .slice(0, 5).forEach(l => console.log(' ', JSON.stringify(l)));
    return;
  }
  if (!cCod || !cNome || !CF.nr || !CF.at) {
    console.error('\nFalta coluna. Rode --inspecionar e me mande a saida'
      + ' (ou informe --col-codigo / --col-nome).');
    process.exitCode = 1; return;
  }

  // fornecedor do Access por NrContabil (pode haver mais de um por conta)
  const fornPorConta = new Map();
  const contaPorCnpj = new Map();
  for (const f of linhasF) {
    const nr = texto(f[CF.nr]);
    if (!nr.startsWith(PREFIXO_ANTIGO)) continue;
    fornPorConta.set(nr, (fornPorConta.get(nr) || []).concat(f));
    const cnpj = CF.cgc ? digitos(f[CF.cgc]) : '';
    if (cnpj.length >= 11) contaPorCnpj.set(cnpj, trocar(nr));
  }

  // subtitulos novos
  const novos = new Map();   // codigo novo -> { nome, ativo }
  for (const l of linhasSub) {
    const cod = String(l[cCod] ?? '').trim();
    if (!cod.startsWith(PREFIXO_ANTIGO) || !RX_CONTA.test(cod)) continue;
    const fs_ = fornPorConta.get(cod) || [];
    const nome = texto(l[cNome]) || (fs_[0] && texto(fs_[0][CF.razao])) || cod;
    // sem fornecedor ligado: ativa. Com fornecedor: ativa se algum esta Ativado = 1.
    const ativo = !fs_.length || fs_.some(f => ehAtivo(f[CF.at]));
    novos.set(trocar(cod), { nome, ativo });
  }

  // ================================================================ BANCO ===
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);
  const C = n => db.collection(n);

  // --------------------------------------------------------- 1. LIMPEZA ---
  secao('1. Limpeza — emissao antes de ' + corte.toLocaleDateString('pt-BR'));

  const antes = (campo) => ({ $or: [
    { [campo]: { $lt: corte } },
    { [campo]: null, criadoEm: { $lt: corte } },
  ] });

  const boletas = await C('_boletas').find({ lojistaId, data: { $lt: corte } }).toArray();
  const pedidos = await C('_compra_pedidos').find({ lojistaId, ...antes('dataEmissao') }).toArray();
  const notas   = await C('_compra_notas_entrada').find({ lojistaId, ...antes('dataEmissao') }).toArray();

  const idsBoleta = new Set(boletas.map(b => String(b._id)));
  const idsFluxoLigados = new Set(
    [...pedidos, ...notas].flatMap(d => (d.lancamentosFluxo || []).map(String)));

  const fluxoTodo = await C('_fluxo_projetado').find({ lojistaId }).toArray();
  const fluxoApagar = fluxoTodo.filter(f =>
    idsFluxoLigados.has(String(f._id))
    || ([2, 7].includes(f.pos) && f.criadoEm && f.criadoEm < corte));
  const idsFluxoApagar = new Set(fluxoApagar.map(f => String(f._id)));
  const fluxoDesquitar = fluxoTodo.filter(f =>
    !idsFluxoApagar.has(String(f._id)) && f.boletaId && idsBoleta.has(String(f.boletaId)));

  const porTipo = {};
  boletas.forEach(b => { porTipo[b.tipo] = (porTipo[b.tipo] || 0) + 1; });
  const porPos = {};
  fluxoApagar.forEach(f => { porPos[f.pos] = (porPos[f.pos] || 0) + 1; });

  console.log('_boletas              a apagar:', boletas.length, JSON.stringify(porTipo));
  console.log('_compra_pedidos       a apagar:', pedidos.length,
    pedidos.length ? '(numeros ' + pedidos.map(p => p.numero ?? 'PP').join(', ') + ')' : '');
  console.log('_compra_notas_entrada a apagar:', notas.length,
    notas.length ? '(notas ' + notas.map(n => n.numero || '?').join(', ') + ')' : '');
  console.log('_fluxo_projetado      a apagar:', fluxoApagar.length, 'por pos', JSON.stringify(porPos));
  console.log('_fluxo_projetado      voltam a ATIVO (quitados por boleta apagada):', fluxoDesquitar.length);
  console.log('Ficam no fluxo (orcamento e outros):', fluxoTodo.length - fluxoApagar.length);

  // ------------------------------------------------------------ 2. PLANO ---
  secao('2. Plano ' + TITULO_NOVO + ' — refeito pelo Access');

  const subsAtuais = await C('_contasubtitulos')
    .find({ lojistaId, codigoContaTitulo: TITULO_NOVO }).toArray();
  const modelo = subsAtuais[0];

  console.log('Subtitulos atuais (saem):', subsAtuais.length);
  console.log('Subtitulos do Access (entram):', novos.size,
    '| ativos:', [...novos.values()].filter(n => n.ativo).length,
    '| suspensos:', [...novos.values()].filter(n => !n.ativo).length);
  console.log('Exemplos:');
  [...novos].slice(0, 6).forEach(([c, n]) =>
    console.log('  ', c, '-', n.nome, n.ativo ? '' : '(suspensa)'));

  if (!modelo) {
    console.error('\nNao ha nenhum subtitulo', TITULO_NOVO, 'desta empresa para copiar'
      + ' contaTituloId e natureza. Parando.');
    process.exitCode = 1; return;
  }
  const outrosTitulos = new Set();
  for (const l of linhasSub) {
    const cod = String(l[cCod] ?? '').trim();
    if (cod.startsWith('2.02.') && !cod.startsWith(PREFIXO_ANTIGO) && RX_CONTA.test(cod)) {
      outrosTitulos.add(cod.split('.').slice(0, 3).join('.'));
    }
  }
  if (outrosTitulos.size) {
    console.log('Fora deste script (outros titulos do 2.02):', [...outrosTitulos].sort().join(', '));
  }

  // ----------------------------------------------------------- 3. FORNECS --
  secao('3. Fornecedores cadastrados — vinculos[].ncontabil');

  const mapa = await C('_mapa_contas').find({}).toArray();
  const antigasDaNova = new Map();
  for (const m of mapa) {
    if (m.lojistaId && String(m.lojistaId) !== LOJISTA) continue;
    const n = String(m.codigoNovo ?? '').trim();
    const a = String(m.codigoAntigo ?? '').trim();
    if (n && a) antigasDaNova.set(n, (antigasDaNova.get(n) || []).concat(a));
  }

  const fornecs = await C('fornecs').find({ 'vinculos.lojistaId': lojistaId }).toArray();
  const trocasForn = [];
  const semSolucao = [];
  for (const f of fornecs) {
    const v = (f.vinculos || []).find(x => String(x.lojistaId) === LOJISTA);
    const velho = v?.ncontabil || '';
    let novo = contaPorCnpj.get(digitos(f.cnpj)) || '';
    let como = 'cnpj';
    if (!novo) {
      const antigas = antigasDaNova.get(velho) || [];
      if (antigas.length === 1) { novo = trocar(antigas[0]); como = 'mapa'; }
      else como = antigas.length > 1 ? 'mapa com ' + antigas.length + ' antigas' : 'sem cnpj nem mapa';
    }
    if (novo && !novos.has(novo)) { como += ', conta ' + novo + ' nao existe no Access'; novo = ''; }

    if (novo) trocasForn.push({ _id: f._id, razao: f.razao, velho, novo, como });
    else semSolucao.push({ razao: f.razao, velho, como });
  }
  trocasForn.forEach(t => console.log('  ', (t.razao || '').slice(0, 40).padEnd(40),
    t.velho.padEnd(14), '->', t.novo, '(' + t.como + ')'));
  if (semSolucao.length) {
    console.log('\nSEM SOLUCAO (ficam como estao — decidir a mao):');
    semSolucao.forEach(s => console.log('  ', (s.razao || '').slice(0, 40).padEnd(40), s.velho, '|', s.como));
  }

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // ============================================================ APLICAR ====
  secao('Aplicando');

  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup',
    'COMPRA-12-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(pasta, { recursive: true });
  const guardar = (nome, docs) => fs.writeFileSync(path.join(pasta, nome + '.json'),
    EJSON.stringify(docs, null, 2, { relaxed: false }));

  guardar('_boletas', boletas);
  guardar('_compra_pedidos', pedidos);
  guardar('_compra_notas_entrada', notas);
  guardar('_fluxo_projetado-apagados', fluxoApagar);
  guardar('_fluxo_projetado-desquitados', fluxoDesquitar);
  guardar('_contasubtitulos', subsAtuais);
  guardar('fornecs', fornecs);
  console.log('Backup:', pasta);

  const ids = arr => arr.map(d => d._id);

  if (boletas.length) console.log('_boletas apagadas:',
    (await C('_boletas').deleteMany({ _id: { $in: ids(boletas) } })).deletedCount);
  if (fluxoDesquitar.length) console.log('fluxo voltou a ATIVO:',
    (await C('_fluxo_projetado').updateMany(
      { _id: { $in: ids(fluxoDesquitar) } },
      { $set: { boletaId: null, quitadoEm: null, status: 'ATIVO', atualizadoEm: new Date() } },
    )).modifiedCount);
  if (fluxoApagar.length) console.log('fluxo apagado:',
    (await C('_fluxo_projetado').deleteMany({ _id: { $in: ids(fluxoApagar) } })).deletedCount);
  if (pedidos.length) console.log('pedidos apagados:',
    (await C('_compra_pedidos').deleteMany({ _id: { $in: ids(pedidos) } })).deletedCount);
  if (notas.length) console.log('notas apagadas:',
    (await C('_compra_notas_entrada').deleteMany({ _id: { $in: ids(notas) } })).deletedCount);

  console.log('subtitulos antigos apagados:',
    (await C('_contasubtitulos').deleteMany({ _id: { $in: ids(subsAtuais) } })).deletedCount);

  const agora = new Date();
  const inserir = [...novos].map(([codigo, n]) => ({
    contaTituloId: modelo.contaTituloId,
    codigoContaTitulo: TITULO_NOVO,
    codigo,
    nome: n.nome,
    descricao: '',
    saldoInicial: 0,
    natureza: modelo.natureza,
    ativo: n.ativo,
    lojistaId,
    criadoEm: agora,
    atualizadoEm: agora,
  }));
  if (inserir.length) console.log('subtitulos criados:',
    (await C('_contasubtitulos').insertMany(inserir)).insertedCount);

  let nForn = 0;
  for (const t of trocasForn) {
    const r = await C('fornecs').updateOne(
      { _id: t._id },
      { $set: { 'vinculos.$[v].ncontabil': t.novo, updateAt: agora } },
      { arrayFilters: [{ 'v.lojistaId': lojistaId }] },
    );
    nForn += r.modifiedCount;
  }
  console.log('fornecedores religados:', nForn);

  console.log('\nPronto. A etapa fornecedores do de/para nao e mais usada.');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
