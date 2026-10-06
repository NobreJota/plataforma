// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-9-importar-pedidos.js
// Criado em:   27/09/2026
// Alterado em: 27/09/2026 — nomes reais das colunas do Access:
//              cabecalho DataEmisPedido / itens NossoCódigo, Qte, VCusto, Saldo
// Alterado em: 03/10/2026 — FIM DO DE/PARA: fornecedor direto por _fornec_access
//              (nrFornec -> fornecId, marca, contaNova). PENDENTE = Pos 0 no
//              cabecalho (1 liquidado, 3 cancelado); a data de Entrega nao serve
//              (7063, 7109 e 7113 tem 01/01/1933 e Pos 1).
//
// Importa os PEDIDOS PENDENTES do Access para _compra_pedidos.
//
// Sao os compromissos vivos: mercadoria comprada e ainda nao entregue. Sem
// eles, toda nota que chegar vai bater numa lista vazia de pedidos, e a
// entrada nao fecha.
//
// A NUMERACAO DO ACCESS E MANTIDA. Pedido 7146 continua 7146 — o pessoal
// conhece a nota pelo numero do pedido, e renumerar quebraria essa memoria.
// Os pedidos emitidos na plataforma continuam contando do 1.
//
// O QUE E PENDENTE
// Coluna Pos do cabecalho: 0 pendente · 1 liquidado · 3 cancelado. So entra o 0.
// A data de Entrega NAO e criterio (ha liquidados com 01/01/1933).
//
// FORNECEDOR
// Direto, sem de/para: NrFornec do pedido -> _fornec_access.nrFornec (da
// empresa). De la saem fornecId (o cadastro em fornecs), a marca (o nome que
// aparece) e contaNova (a conta 2.01.001.xxx do fluxo).
//
// Pedido de fornecedor sem fornecId entra assim mesmo, sem vinculo, e a tela
// de pendentes mostra o nome em vermelho. E compromisso a pagar: esconder
// seria esconder divida. Sem conta contabil o fluxo nao recebe a previsao.
//
// PRODUTO
// CodigoProd do item -> _produto_origem.codigoProd. Produto que nao existe
// na colecao entra no pedido assim mesmo, com a descricao do Access: o
// pedido e historico, nao pode ser censurado por falta de cadastro.
//
// SIMULACAO por padrao. So grava com --aplicar.
//
// Uso (na raiz C:\plataformaRota, um comando por vez):
//   node src\scripts\COMPRA-9-importar-pedidos.js --mdb "C:\Armação\Dados\2026B\2026B.mdb" --inspecionar
//   node src\scripts\COMPRA-9-importar-pedidos.js --mdb "..."
//   node src\scripts\COMPRA-9-importar-pedidos.js --mdb "..." --aplicar
//   node src\scripts\COMPRA-9-importar-pedidos.js --mdb "..." --aplicar --com-fluxo
//
// --com-fluxo gera as previsoes pos 7. Sem ele o fluxo nao e tocado — bom
// para conferir os pedidos antes de mexer no caixa.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env') });

let MDBReader;
try {
  const mod = require('mdb-reader');
  MDBReader = mod.default || mod;
} catch (e) {
  console.error('\n[erro] mdb-reader nao encontrado. Rode: npm install mdb-reader\n');
  process.exit(1);
}

const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

const Pedido         = require('../models/compra/pedido');
const FluxoProjetado = require('../models/contab/financeiro/fluxoProjetado');

const LOJISTA_PADRAO = '6892706a86509313e632f717';   // Armacao Comercial Ltda
const NULO_ACCESS = 1933;                            // 01/01/1933 = data vazia

// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const APLICAR    = argv.includes('--aplicar');
const COM_FLUXO  = argv.includes('--com-fluxo');
const INSPECIONAR = argv.includes('--inspecionar');

function opcao(nome) {
  const i = argv.indexOf(nome);
  return (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : null;
}

const MDB     = opcao('--mdb');
const LOJISTA = opcao('--lojista') || LOJISTA_PADRAO;

const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const dia = d => (d instanceof Date && !isNaN(d))
  ? String(d.getUTCDate()).padStart(2, '0') + '/'
    + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
    + String(d.getUTCFullYear()).slice(2)
  : '—';

function col(nome) {
  return mongoose.connection.collection(nome);
}

function numero(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const centavos = v => Math.round(numero(v) * 100);

function texto(v) {
  const s = String(v ?? '').trim();
  return (s === '0' || s === '0000') ? '' : s;
}

function dataValida(d) {
  return d instanceof Date && !isNaN(d) && d.getUTCFullYear() > NULO_ACCESS;
}

// ---------------------------------------------------------------------------
// Os nomes das colunas do Access variam com acento e abreviacao. Em vez de
// chutar um, procura entre os candidatos e avisa quando nao acha.
// ---------------------------------------------------------------------------
function acharColuna(colunas, candidatos) {
  const limpo = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapa = new Map(colunas.map(c => [limpo(c), c]));
  for (const c of candidatos) {
    const achou = mapa.get(limpo(c));
    if (achou) return achou;
  }
  return null;
}

function acharTabela(todas, candidatos) {
  const limpo = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapa = new Map(todas.map(t => [limpo(t), t]));
  for (const c of candidatos) {
    const achou = mapa.get(limpo(c));
    if (achou) return achou;
  }
  return null;
}

// "84/112 dias" -> { texto, dias: [84, 112] }
function lerCondicao(txt) {
  const s = texto(txt);
  const dias = (s.match(/\d+/g) || []).map(Number).filter(n => n > 0 && n < 400);
  if (!dias.length) return { texto: s || '30 dias', dias: [30] };
  return { texto: s, dias: dias.sort((a, b) => a - b) };
}

// ---------------------------------------------------------------------------
// Fornecedores da empresa, pelo numero do Access (_fornec_access).
// _fornec_origem so entra para dar NOME a quem nao esta em _fornec_access.
// ---------------------------------------------------------------------------
async function mapaDeFornecedores(lojistaId) {
  const porNrFornec = new Map();
  for (const f of await col('_fornec_access').find({ lojistaId }).toArray()) {
    const nr = Number(f.nrFornec);
    if (nr) porNrFornec.set(nr, f);
  }
  const nomeAntigo = new Map();
  for (const o of await col('_fornec_origem').find({}).toArray()) {
    const casa = /^F?0*(\d+)$/i.exec(String(o.chave || ''));
    const nr = casa ? Number(casa[1]) : Number(o.nrFornec);
    if (nr) nomeAntigo.set(nr, o.razao || o.nome || '');
  }
  return { porNrFornec, nomeAntigo };
}

// ---------------------------------------------------------------------------
function lerDoAccess() {
  const reader = new MDBReader(fs.readFileSync(MDB));
  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  const nomeCab = acharTabela(todas, ['PED_PedidoFornecedor']);
  const nomeIte = acharTabela(todas, [
    'PED_PedidoFornecedorItens', 'PED_PedidoFornecedor_Itens',
    'PED_PedidoFornecedorItem',
  ]);

  if (!nomeCab || !nomeIte) {
    console.error('\n[erro] tabelas nao encontradas');
    console.error('   cabecalho: ' + (nomeCab || 'FALTA'));
    console.error('   itens ...: ' + (nomeIte || 'FALTA'));
    console.error('\nTabelas PED_ no arquivo:');
    for (const t of todas.filter(t => /^PED_/i.test(t))) console.error('   ' + t);
    process.exit(1);
  }

  const cab = reader.getTable(nomeCab);
  const ite = reader.getTable(nomeIte);

  return {
    nomeCab, nomeIte,
    colunasCab: cab.getColumnNames(),
    colunasIte: ite.getColumnNames(),
    linhasCab: cab.getData(),
    linhasIte: ite.getData(),
  };
}

function inspecionar(a) {
  console.log('\nTabela do cabecalho: ' + a.nomeCab + '   (' + a.linhasCab.length + ' linhas)');
  console.log('  colunas: ' + a.colunasCab.join(', '));
  if (a.linhasCab[0]) {
    console.log('\n  primeira linha:');
    for (const [k, v] of Object.entries(a.linhasCab[0])) {
      console.log('      ' + String(k).padEnd(22) + ' = '
        + (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));
    }
  }

  console.log('\nTabela dos itens: ' + a.nomeIte + '   (' + a.linhasIte.length + ' linhas)');
  console.log('  colunas: ' + a.colunasIte.join(', '));
  if (a.linhasIte[0]) {
    console.log('\n  primeira linha:');
    for (const [k, v] of Object.entries(a.linhasIte[0])) {
      console.log('      ' + String(k).padEnd(22) + ' = '
        + (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
function montar(a) {
  const C = {
    numero:   acharColuna(a.colunasCab, ['NrPedido', 'NrPedid', 'Nr_Pedido']),
    emissao:  acharColuna(a.colunasCab, ['DataEmisPedido', 'DataEn', 'DataEmissao']),
    fornec:   acharColuna(a.colunasCab, ['NrFornec', 'NrFornecedor']),
    condPag:  acharColuna(a.colunasCab, ['CondPag', 'CondicaoPag', 'Condição']),
    previsao: acharColuna(a.colunasCab, ['Previsão', 'Previsao', 'DataPrevisao']),
    total:    acharColuna(a.colunasCab, ['VTotal', 'ValorTotal', 'Total']),
    entrega:  acharColuna(a.colunasCab, ['Entrega', 'DataEntrega']),
    pos:      acharColuna(a.colunasCab, ['Pos', 'Posicao', 'Posição']),
  };

  const I = {
    numero:   acharColuna(a.colunasIte, ['NrPedido', 'NrPedid', 'Nr_Pedido']),
    produto:  acharColuna(a.colunasIte, ['NossoCódigo', 'NossoCodigo', 'CódigoProd', 'CodigoProd']),
    qtd:      acharColuna(a.colunasIte, ['Qte', 'Qtde', 'Quant', 'Quantidade']),
    custo:    acharColuna(a.colunasIte, ['VCusto', 'PCusto', 'VUnit', 'ValorUnit']),
    desc:     acharColuna(a.colunasIte, ['Descrição', 'Descricao', 'Produto']),
    saldo:    acharColuna(a.colunasIte, ['Saldo']),
  };

  const faltando = [];
  for (const [k, v] of Object.entries(C)) if (!v && !['previsao', 'entrega'].includes(k)) faltando.push('cabecalho.' + k);
  for (const [k, v] of Object.entries(I)) if (!v && !['desc', 'saldo'].includes(k)) faltando.push('itens.' + k);

  if (faltando.length) {
    console.error('\n[erro] nao achei estas colunas: ' + faltando.join(', '));
    console.error('\ncabecalho tem: ' + a.colunasCab.join(', '));
    console.error('itens tem ...: ' + a.colunasIte.join(', '));
    console.error('\nRode com --inspecionar para ver os dados.\n');
    process.exit(1);
  }

  // itens por pedido
  const itensPorPedido = new Map();
  for (const l of a.linhasIte) {
    const n = Number(l[I.numero]);
    if (!Number.isFinite(n) || !n) continue;
    if (!itensPorPedido.has(n)) itensPorPedido.set(n, []);
    itensPorPedido.get(n).push(l);
  }

  const pendentes = [];
  let entregues = 0, cancelados = 0, outraPos = 0, semItens = 0;

  for (const l of a.linhasCab) {
    const n = Number(l[C.numero]);
    if (!Number.isFinite(n) || !n) continue;

    // Pos: 0 pendente · 1 liquidado · 3 cancelado. So o 0 entra.
    const pos = Number(l[C.pos]);
    if (pos === 1) { entregues++; continue; }
    if (pos === 3) { cancelados++; continue; }
    if (pos !== 0) { outraPos++; continue; }

    const itens = itensPorPedido.get(n) || [];
    if (!itens.length) { semItens++; continue; }

    pendentes.push({
      numero: n,
      nrFornec: Number(l[C.fornec]) || 0,
      dataEmissao: dataValida(l[C.emissao]) ? l[C.emissao] : null,
      previsao: (C.previsao && dataValida(l[C.previsao])) ? l[C.previsao] : null,
      condicao: lerCondicao(l[C.condPag]),
      totalAccess: centavos(l[C.total]),
      itens: itens.map(i => ({
        codigoProd: Number(i[I.produto]) || 0,
        quantidade: numero(i[I.qtd]),
        saldo: I.saldo ? numero(i[I.saldo]) : null,
        // atendida fica em zero ate sabermos o que Saldo guarda — ver o
        // aviso no relatorio. Chutar aqui produziria pedido nascendo
        // meio entregue, e isso o fluxo sente.
        atendida: 0,
        custoUnitario: centavos(i[I.custo]),
        descricao: I.desc ? texto(i[I.desc]) : '',
      })).filter(i => i.codigoProd && i.quantidade > 0),
    });
  }

  return { pendentes, entregues, cancelados, outraPos, semItens, C, I };
}

// ---------------------------------------------------------------------------
async function principal() {
  if (!MDB || !fs.existsSync(MDB)) {
    console.error('\n[erro] informe --mdb com um caminho valido\n');
    process.exit(1);
  }

  console.log('='.repeat(74));
  console.log('Importar pedidos pendentes   '
    + (APLICAR ? '>>> APLICANDO <<<' : '(simulacao)'));
  console.log('MDB ......... ' + MDB);
  console.log('Fluxo ....... ' + (COM_FLUXO ? 'gera previsoes pos 7' : 'NAO toca no fluxo'));
  console.log('='.repeat(74));

  const doAccess = lerDoAccess();

  if (INSPECIONAR) { inspecionar(doAccess); return; }

  const m = montar(doAccess);
  console.log('\nPedidos no Access .......... ' + doAccess.linhasCab.length);
  console.log('    liquidados (Pos 1) ..... ' + m.entregues);
  console.log('    cancelados (Pos 3) ..... ' + m.cancelados);
  if (m.outraPos) console.log('    Pos desconhecida ....... ' + m.outraPos + '   (nao entram; me avise)');
  console.log('    sem itens .............. ' + m.semItens);
  console.log('    PENDENTES .............. ' + m.pendentes.length);

  await connectToDatabase();
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const { porNrFornec, nomeAntigo } = await mapaDeFornecedores(lojistaId);
  console.log('\nFornecedores em _fornec_access: ' + porNrFornec.size);

  // produtos, para completar referencia e descricao
  const produtos = await col('_produto_origem')
    .find({ lojistaId }).project({ codigoProd: 1, descricao: 1, referencia: 1 })
    .toArray();
  const porCodigo = new Map(produtos.map(p => [p.codigoProd, p]));

  // o que ja existe, para nao importar duas vezes
  const jaTem = new Set(
    (await Pedido.find({ lojistaId }).select('numero').lean())
      .map(p => p.numero).filter(Boolean)
  );

  // Pedido de fornecedor ainda nao transferido TAMBEM entra, sem vinculo e
  // com o nome do sistema antigo. E compromisso a pagar: esconder ate o
  // de/para fechar seria esconder divida. A tela mostra o nome em vermelho.
  const prontos = [];
  const semFornecedor = [];
  const repetidos = [];

  for (const p of m.pendentes) {
    if (jaTem.has(p.numero)) { repetidos.push(p); continue; }

    const fa = porNrFornec.get(p.nrFornec) || null;          // linha de _fornec_access
    if (!fa || !fa.fornecId) semFornecedor.push(p);

    prontos.push({
      ...p,
      fornecedorId: fa?.fornecId || null,                     // cadastro em fornecs
      conta: fa?.contaNova || '',
      razao: fa?.razao || nomeAntigo.get(p.nrFornec) || '',
      fornecedorNome: fa?.marca || fa?.razao || nomeAntigo.get(p.nrFornec) || ('NrFornec ' + p.nrFornec),
      motivo: !fa ? 'nao esta em _fornec_access' : (!fa.fornecId ? 'sem cadastro (ajustar)' : ''),
    });
  }

  console.log('\nProntos para importar ...... ' + prontos.length);
  console.log('    com cadastro ........... ' + (prontos.length - semFornecedor.length));
  console.log('    SEM cadastro ........... ' + semFornecedor.length
    + '   (entram assim mesmo, marcados)');
  console.log('    com conta (geram pos 7)  ' + prontos.filter(p => p.conta).length);
  console.log('Ja existem na plataforma ... ' + repetidos.length);

  if (semFornecedor.length) {
    const porNr = new Map();
    for (const p of prontos.filter(x => x.motivo)) {
      const o = porNr.get(p.nrFornec) || { q: 0, nome: p.fornecedorNome, motivo: p.motivo };
      o.q++; porNr.set(p.nrFornec, o);
    }
    console.log('\n    NrFornec sem cadastro:');
    for (const [nr, o] of [...porNr].sort((a, b) => b[1].q - a[1].q)) {
      console.log('        ' + String(nr).padStart(4) + '  ' + String(o.nome).slice(0, 24).padEnd(25)
        + o.q + ' pedido(s)   ' + o.motivo);
    }
  }

  // O que a coluna Saldo guarda? Se for o que FALTA entregar, ela deveria
  // valer o mesmo que Qte num pedido que nao foi atendido; se for o que JA
  // veio, deveria ser zero. Os numeros abaixo respondem.
  const comSaldo = [];
  for (const p of prontos) {
    for (const i of p.itens) {
      if (i.saldo != null) comSaldo.push({ q: i.quantidade, s: i.saldo });
    }
  }
  if (comSaldo.length) {
    const iguais = comSaldo.filter(x => x.s === x.q).length;
    const zeros  = comSaldo.filter(x => x.s === 0).length;
    console.log('\nColuna Saldo, nos ' + comSaldo.length + ' itens pendentes:');
    console.log('    igual a Qte ... ' + iguais + '   (seria o que FALTA entregar)');
    console.log('    zero .......... ' + zeros + '   (seria o que JA foi entregue)');
    console.log('    outro valor ... ' + (comSaldo.length - iguais - zeros)
      + '   (entrega parcial)');
    console.log('    -> por ora todos entram com 0 atendido. Se a coluna for'
      + ' entrega parcial, me avise.');
  }

  if (prontos.length) {
    console.log('\n' + '-'.repeat(74));
    for (const p of prontos) {
      const razao = (p.fornecedorId ? '' : '! ') + p.fornecedorNome;
      const total = p.itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);
      const semCadastro = p.itens.filter(i => !porCodigo.has(i.codigoProd)).length;

      console.log('  nº ' + String(p.numero).padEnd(6)
        + dia(p.dataEmissao).padEnd(10)
        + (razao || '').slice(0, 30).padEnd(32)
        + String(p.itens.length).padStart(3) + ' itens  '
        + moeda(total).padStart(12)
        + '   ' + p.condicao.texto
        + (semCadastro ? '   (' + semCadastro + ' sem cadastro)' : ''));
    }
    console.log('-'.repeat(74));
  }

  if (!APLICAR) {
    console.log('\nnada foi gravado. Para gravar, repita com --aplicar');
    return;
  }

  // ---- gravar --------------------------------------------------------------
  let gravados = 0, linhasFluxo = 0;

  for (const p of prontos) {
    const conta = p.conta;
    const razao = p.razao || p.fornecedorNome;

    // A entrega prevista e a base dos vencimentos. Sem previsao no Access,
    // usa a emissao — e melhor um vencimento aproximado do que nenhum.
    const entrega = p.previsao || p.dataEmissao || new Date();

    const itens = p.itens.map(i => {
      const prod = porCodigo.get(i.codigoProd);
      return {
        produto: null,
        codigoOrigem: i.codigoProd,
        referencia: prod?.referencia || '',
        descricao: prod?.descricao || i.descricao || '',
        quantidade: i.quantidade,
        quantidadeAtendida: Math.min(i.atendida || 0, i.quantidade),
        custoUnitario: i.custoUnitario,
        baseCalculo: { ajustadoAMao: false },
      };
    });

    const pedido = await Pedido.create({
      lojistaId,
      numero: p.numero,
      situacao: 'P',
      fornecedor: p.fornecedorId || null,
      fornecedorNome: p.fornecedorNome,
      nrFornecOrigem: p.nrFornec,
      dataEmissao: p.dataEmissao,
      dataEntregaPrevista: entrega,
      condicaoPagamento: p.condicao,
      itens,
      observacao: 'Importado do sistema antigo (pedido ' + p.numero + ')',
    });

    // Sem conta contabil nao ha onde lancar.
    if (COM_FLUXO && conta) {
      const parcelas = pedido.calcularVencimentos();
      if (parcelas.length) {
        const linhas = parcelas.map((x, n) => ({
          lojistaId,
          ano: x.vencimento.getFullYear(),
          mes: x.vencimento.getMonth() + 1,
          pos: 7,
          codigoConta: conta,
          nomeConta: razao,
          historico: 'Pedido ' + pedido.numero + ' ' + p.fornecedorNome,
          valor: Math.round(x.valor) / 100,      // centavos -> reais
          vencimento: x.vencimento,
          parcela: n + 1,
          totalParcelas: parcelas.length,
          origem: 'PEDIDO_IMPORTADO',
          lancamentoId: pedido._id,
          status: 'ATIVO',
        }));

        const gravadas = await FluxoProjetado.insertMany(linhas);
        pedido.lancamentosFluxo = gravadas.map(l => l._id);
        await pedido.save();
        linhasFluxo += gravadas.length;
      }
    }

    gravados++;
    process.stdout.write('\r    gravando ... ' + gravados + '/' + prontos.length);
  }

  console.log('\n\n[ok] ' + gravados + ' pedido(s) importado(s).');
  if (COM_FLUXO) console.log('     ' + linhasFluxo + ' linha(s) no fluxo.');
  else console.log('     fluxo NAO tocado. Repita com --com-fluxo quando quiser.');
}

principal()
  .catch(err => {
    console.error('\nERRO: ' + err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.connection.close();
  });
