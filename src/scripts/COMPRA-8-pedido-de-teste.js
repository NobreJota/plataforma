// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-8-pedido-de-teste.js
// Criado em:   26/09/2026
// Alterado em: 26/09/2026 — --zerar-contagem
//
// Monta pedidos para testar a entrada de nota fiscal ponta a ponta.
//
// O pedido no 2 foi montado pela sugestao de consumo, nao contra esta nota:
// produtos diferentes, quantidades diferentes. Casar os dois na mao e lutar
// contra o dado. Este script faz o caminho inverso — le a nota e monta o
// pedido que ela deveria ter atendido.
//
// TRES ACOES, uma por vez:
//
//   --da-nota <id|chave>   pedido espelhando a nota: mesmos produtos, mesmas
//                          quantidades, mesmo custo unitario, e a condicao de
//                          pagamento tirada dos vencimentos das duplicatas
//
//   --avulso <id|chave>    um segundo pedido do MESMO fornecedor, com outros
//                          produtos, so para o select da tela ter escolha
//
//   --cancelar <numero>    poe o pedido em C e tira as previsoes do fluxo
//
//   --zerar-contagem <id>  apaga a contagem fisica da nota: quantidades
//                          contadas, tentativas e o bloqueio. O vinculo com o
//                          produto e com o pedido fica. Serve para recomecar
//                          a contagem do zero.
//
//   --ligar <ref>=<codigo> liga um item da nota ao nosso produto pelo terminal,
//                          sem passar pela tela. Pode repetir. Precisa de
//                          --da-nota ou --nota para dizer qual e a nota.
//                          Grava tambem o EAN e a descricao do fabricante,
//                          igual a tela faz.
//
// SIMULACAO por padrao. So grava com --aplicar.
//
// Uso (na raiz C:\plataformaRota, um comando por vez):
//   node src\scripts\COMPRA-8-pedido-de-teste.js --da-nota 6ab661ad120d535da044544a
//   node src\scripts\COMPRA-8-pedido-de-teste.js --da-nota 6ab661ad120d535da044544a --aplicar
//   node src\scripts\COMPRA-8-pedido-de-teste.js --avulso 6ab661ad120d535da044544a --aplicar
//   node src\scripts\COMPRA-8-pedido-de-teste.js --cancelar 2 --aplicar
//   node src\scripts\COMPRA-8-pedido-de-teste.js --nota <id> --ligar REUM200CFHBNE=4978 --aplicar
// =============================================================================

'use strict';

const path = require('path');

// O .env antes do modulo `database`, que estoura sem MONGO_URI.
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

const NotaEntrada    = require('../models/compra/notaEntrada');
const Pedido         = require('../models/compra/pedido');
const FluxoProjetado = require('../models/contab/financeiro/fluxoProjetado');

const LOJISTA_PADRAO = '6892706a86509313e632f717';   // Armacao Comercial Ltda

// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const APLICAR = argv.includes('--aplicar');

function opcao(nome) {
  const i = argv.indexOf(nome);
  return (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : null;
}

const DA_NOTA  = opcao('--da-nota');
const SO_NOTA  = opcao('--nota');

// --ligar pode aparecer varias vezes
const LIGAR = [];
argv.forEach((a, i) => {
  if (a === '--ligar' && argv[i + 1] && !argv[i + 1].startsWith('--')) {
    LIGAR.push(argv[i + 1]);
  }
});
const AVULSO   = opcao('--avulso');
const CANCELAR = opcao('--cancelar');
const ZERAR    = opcao('--zerar-contagem');
const LOJISTA  = opcao('--lojista') || LOJISTA_PADRAO;

const chaveRef = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const dia = d => d
  ? String(d.getUTCDate()).padStart(2, '0') + '/'
    + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
    + String(d.getUTCFullYear()).slice(2)
  : '—';

function col(nome) {
  return mongoose.connection.collection(nome);
}

// ---------------------------------------------------------------------------
async function acharNota(lojistaId, ref) {
  const filtro = { lojistaId };
  if (mongoose.Types.ObjectId.isValid(ref)) {
    filtro._id = new mongoose.Types.ObjectId(ref);
  } else {
    filtro.chaveAcesso = String(ref).replace(/\D/g, '');
  }
  const nota = await NotaEntrada.findOne(filtro);
  if (!nota) throw new Error('nota nao encontrada: ' + ref);
  return nota;
}

async function proximoNumero(lojistaId) {
  const ultimo = await Pedido
    .findOne({ lojistaId, numero: { $type: 'number' } })
    .sort({ numero: -1 })
    .select('numero');
  return (ultimo?.numero || 0) + 1;
}

// A conta contabil mora NO VINCULO da empresa, nunca em fornecs.ncontabil
// da raiz, que e resto de migracao e vem "0.00.000.000".
async function contaDoFornecedor(lojistaId, fornecedorId) {
  if (!fornecedorId) return { conta: '', razao: '' };
  const f = await col('fornecs').findOne({ _id: fornecedorId });
  if (!f) return { conta: '', razao: '' };
  const v = (f.vinculos || []).find(x =>
    String(x.lojistaId) === String(lojistaId) && x.ativo !== false);
  return {
    conta: v?.ncontabil || '',
    razao: f.razaoSocial || f.razao || f.nome || '',
  };
}

// Vencimentos das duplicatas viram a condicao de pagamento, contada da
// entrega prevista — que e a regra do modulo.
function condicaoDasDuplicatas(nota, entrega) {
  const dups = (nota.duplicatas || []).filter(d => d.vencimento);
  if (!dups.length) return { texto: '30 dias', dias: [30] };

  const dias = dups
    .map(d => Math.max(0, Math.round((d.vencimento - entrega) / 86400000)))
    .sort((a, b) => a - b);

  return { texto: dias.join('/') + ' dias', dias };
}

// As previsoes pos 7, que a entrada da nota vai baixar depois.
// ATENCAO: o fluxo guarda REAIS e POSITIVO. O sinal e a cor sao da tela.
async function gerarFluxo(pedido, conta, razao, sessao) {
  const parcelas = pedido.calcularVencimentos();
  if (!parcelas.length) return [];

  const linhas = parcelas.map((p, i) => ({
    lojistaId: pedido.lojistaId,
    ano: p.vencimento.getFullYear(),
    mes: p.vencimento.getMonth() + 1,
    pos: 7,                                    // pedido emitido
    codigoConta: conta,
    nomeConta: razao,
    historico: 'Pedido ' + pedido.numero + ' ' + razao,
    valor: Math.round(p.valor) / 100,          // centavos -> reais
    vencimento: p.vencimento,
    parcela: i + 1,
    totalParcelas: parcelas.length,
    origem: 'PEDIDO_COMPRA',
    lancamentoId: pedido._id,
    status: 'ATIVO',
  }));

  const gravadas = await FluxoProjetado.insertMany(linhas, { session: sessao });
  return gravadas.map(l => l._id);
}

// ---------------------------------------------------------------------------
// Candidatos para um item sem codigo: produtos do mesmo fornecedor, pelos
// mais proximos no custo. O custo do cadastro e SEM IPI, entao a comparacao
// e contra o unitario da nota, nao contra o custo real.
// ---------------------------------------------------------------------------
async function candidatosPara(lojistaId, nota, item) {
  const jaLigados = nota.itens.map(i => i.codigoProd).filter(Boolean);
  if (!jaLigados.length) return [];

  const ps = await col('_produto_origem')
    .find({ lojistaId, codigoProd: { $in: jaLigados } })
    .project({ nrFornec: 1 }).toArray();

  const nrs = [...new Set(ps.map(p => p.nrFornec).filter(Boolean))];
  if (!nrs.length) return [];

  const todos = await col('_produto_origem')
    .find({ lojistaId, ativo: true, nrFornec: { $in: nrs },
            codigoProd: { $nin: jaLigados } })
    .toArray();

  const alvo = item.valorUnitario || 0;

  return todos
    .map(p => {
      const custo = p.custoUltimo != null ? p.custoUltimo : (p.precoCusto || 0);
      return {
        codigoProd: p.codigoProd,
        descricao: p.descricao || '',
        referencia: p.referencia || '',
        custo,
        distancia: (custo && alvo) ? Math.abs(custo - alvo) / alvo : 99,
      };
    })
    .filter(c => c.custo > 0)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// --ligar <ref>=<codigo>
//
// O mesmo que a tela faz ao gravar o codigo: liga o item, conta a primeira
// unidade, e guarda no produto o EAN, a descricao e a referencia do
// fabricante. Existe porque nem sempre da para chegar la pela tela — com a
// nota sem pedido vinculado, por exemplo.
// ---------------------------------------------------------------------------
async function ligarItens(lojistaId) {
  const ref = DA_NOTA || SO_NOTA;
  if (!ref) throw new Error('informe a nota com --nota <id> ou --da-nota <id>');

  const nota = await acharNota(lojistaId, ref);
  console.log('Nota ' + nota.numero + '/' + nota.serie + '\n');

  const paraGravar = [];

  for (const par of LIGAR) {
    const [alvo, cod] = String(par).split('=');
    const codigoProd = Number(cod);

    if (!alvo || !Number.isInteger(codigoProd) || codigoProd <= 0) {
      throw new Error('formato esperado: --ligar <ref>=<codigo>   (veio "' + par + '")');
    }

    // acha o item pela referencia do fabricante ou pelo numero do item
    const chave = chaveRef(alvo);
    let idx = nota.itens.findIndex(i => chaveRef(i.codigoFornec) === chave);
    if (idx < 0 && /^\d+$/.test(alvo)) {
      idx = nota.itens.findIndex(i => i.numeroItem === Number(alvo));
    }
    if (idx < 0) throw new Error('nao achei o item "' + alvo + '" na nota');

    const item = nota.itens[idx];

    const produto = await col('_produto_origem')
      .findOne({ lojistaId, codigoProd });
    if (!produto) throw new Error('produto ' + codigoProd + ' nao existe');

    const custo = produto.custoUltimo != null
      ? produto.custoUltimo : (produto.precoCusto || 0);
    const dif = (custo && item.valorUnitario)
      ? Math.round(((item.valorUnitario - custo) / custo) * 1000) / 10 : null;

    console.log('  ' + (item.codigoFornec || '').padEnd(16)
      + (item.descricaoXml || '').slice(0, 30).padEnd(32)
      + '->  ' + codigoProd + '  ' + (produto.descricao || '').slice(0, 30));
    console.log('     unit. da nota ' + moeda(item.valorUnitario)
      + '   ·   custo do cadastro ' + moeda(custo)
      + (dif != null ? '   ·   ' + (dif > 0 ? '+' : '') + dif + '%' : ''));

    if (item.codigoProd && item.codigoProd !== codigoProd) {
      console.log('     ATENCAO: ja estava ligado ao ' + item.codigoProd);
    }

    paraGravar.push({ idx, codigoProd, item, produto });
  }

  if (!APLICAR) return;

  for (const g of paraGravar) {
    const item = nota.itens[g.idx];
    item.codigoProd = g.codigoProd;
    item.vinculadoPor = 'manual';
    if (!item.quantidadeConferida) {
      item.quantidadeConferida = 0;   // a contagem fisica e de outra pagina
    }

    const aprendido = {
      descricaoFab: item.descricaoXml || '',
      refFab: item.codigoFornec || '',
      fabAtualizadoEm: new Date(),
    };
    if (item.ean) {
      aprendido.ean = item.ean;
      aprendido.eanAprendidoEm = new Date();
    }

    await col('_produto_origem').updateOne(
      { lojistaId, codigoProd: g.codigoProd },
      { $set: aprendido },
    );
  }

  await nota.save();
  console.log('\n[ok] ' + paraGravar.length + ' item(ns) ligado(s).');
}

// ---------------------------------------------------------------------------
async function pedidoDaNota(lojistaId) {
  const nota = await acharNota(lojistaId, DA_NOTA);

  console.log('Nota ' + nota.numero + '/' + nota.serie
    + '  ' + (nota.emitente?.razao || ''));
  console.log('  ' + nota.itens.length + ' itens  ·  ' + moeda(nota.valorTotal) + '\n');

  const semCodigo = nota.itens.filter(i => !i.codigoProd);
  if (semCodigo.length) {
    console.log('Estes itens ainda nao tem o nosso codigo:\n');

    for (const i of semCodigo) {
      console.log('    ' + (i.codigoFornec || '').padEnd(16)
        + (i.descricaoXml || '').slice(0, 40)
        + '   unit. ' + moeda(i.valorUnitario));

      const cands = await candidatosPara(lojistaId, nota, i);
      for (const c of cands) {
        const d = Math.round(c.distancia * 1000) / 10;
        console.log('        ' + String(c.codigoProd).padStart(6)
          + '  ' + (c.descricao || '').slice(0, 34).padEnd(36)
          + moeda(c.custo).padStart(10)
          + '   ' + (d < 100 ? d + '% de diferenca' : ''));
      }
      if (cands.length) {
        console.log('        -> --ligar ' + i.codigoFornec + '=' 
          + cands[0].codigoProd);
      }
      console.log('');
    }

    throw new Error(semCodigo.length + ' item(ns) sem codigo. '
      + 'Use --ligar <ref>=<codigo> ou identifique na tela.');
  }

  // os produtos, para referencia e descricao
  const codigos = nota.itens.map(i => i.codigoProd);
  const produtos = await col('_produto_origem')
    .find({ lojistaId, codigoProd: { $in: codigos } })
    .toArray();
  const porCodigo = new Map(produtos.map(p => [p.codigoProd, p]));

  const entrega = nota.dataEntrada || new Date();
  const condicao = condicaoDasDuplicatas(nota, entrega);
  const numero = await proximoNumero(lojistaId);
  const { conta, razao } = await contaDoFornecedor(lojistaId, nota.fornecedor);

  const itens = nota.itens.map(i => {
    const p = porCodigo.get(i.codigoProd) || {};
    return {
      produto: null,
      codigoOrigem: i.codigoProd,
      referencia: p.referencia || i.codigoFornec || '',
      descricao: p.descricao || i.descricaoXml || '',
      quantidade: i.quantidade,
      quantidadeAtendida: 0,
      // o custo do pedido e o unitario da nota, SEM IPI: e assim que o
      // cadastro guarda custo, e e contra ele que a tela compara
      custoUnitario: i.valorUnitario,
      baseCalculo: { ajustadoAMao: true },
    };
  });

  const total = itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);

  // Dois itens da nota ligados ao MESMO produto e quase sempre erro de
  // identificacao — e quebra o casamento depois, porque compararComPedido
  // indexa por codigoOrigem e a segunda linha engole a primeira.
  const vezes = new Map();
  for (const i of itens) {
    vezes.set(i.codigoOrigem, (vezes.get(i.codigoOrigem) || 0) + 1);
  }
  const repetidos = [...vezes].filter(([, n]) => n > 1);

  if (repetidos.length) {
    console.log('PRODUTO REPETIDO NO PEDIDO:\n');
    for (const [cod] of repetidos) {
      const quais = nota.itens.filter(i => i.codigoProd === cod);
      console.log('    codigo ' + cod + '  ligado a ' + quais.length
        + ' itens da nota:');
      for (const q of quais) {
        console.log('        ' + (q.codigoFornec || '').padEnd(16)
          + (q.descricaoXml || '').slice(0, 40));
      }
      console.log('');
    }
    throw new Error('dois itens da nota apontam para o mesmo produto. '
      + 'Corrija com --ligar <ref>=<codigo> antes de montar o pedido.');
  }

  console.log('Pedido a criar:  no ' + numero);
  console.log('  fornecedor ..... ' + (razao || '(sem cadastro)')
    + (conta ? '  ·  conta ' + conta : ''));
  console.log('  entrega ........ ' + dia(entrega));
  console.log('  pagamento ...... ' + condicao.texto);
  console.log('  total .......... ' + moeda(total) + '\n');

  for (const i of itens) {
    console.log('    ' + String(i.codigoOrigem).padStart(6)
      + '  ' + (i.descricao || '').slice(0, 36).padEnd(36)
      + '  ' + String(i.quantidade).padStart(3)
      + ' x ' + moeda(i.custoUnitario).padStart(10)
      + '  =  ' + moeda(i.quantidade * i.custoUnitario).padStart(11));
  }

  const parcelasPrevistas = condicao.dias.length;
  console.log('\n  ' + parcelasPrevistas + ' previsao(oes) pos 7 no fluxo');

  if (!APLICAR) return;

  const sessao = await mongoose.startSession();
  try {
    let criado;
    await sessao.withTransaction(async () => {
      const novo = await Pedido.create([{
        lojistaId,
        numero,
        situacao: 'P',
        fornecedor: nota.fornecedor,
        dataEmissao: new Date(),
        dataEntregaPrevista: entrega,
        condicaoPagamento: condicao,
        itens,
        observacao: 'Pedido de teste montado a partir da nota ' + nota.numero,
      }], { session: sessao });

      criado = novo[0];
      criado.lancamentosFluxo = await gerarFluxo(criado, conta, razao, sessao);
      await criado.save({ session: sessao });

      // a nota passa a apontar para este pedido
      nota.pedido = criado._id;
      if (nota.situacao === 'RECEBIDA') nota.situacao = 'VINCULADA';
      await nota.save({ session: sessao });
    });

    console.log('\n[ok] pedido no ' + criado.numero + ' criado e vinculado a nota.');
    console.log('     ' + criado.lancamentosFluxo.length + ' linha(s) no fluxo.');
  } finally {
    await sessao.endSession();
  }
}

// ---------------------------------------------------------------------------
async function pedidoAvulso(lojistaId) {
  const nota = await acharNota(lojistaId, AVULSO);

  // produtos do mesmo fornecedor que NAO estao na nota, para o pedido sair
  // diferente e o select ter escolha de verdade
  const naNota = new Set(nota.itens.map(i => i.codigoProd).filter(Boolean));
  if (!naNota.size) throw new Error('a nota nao tem nenhum item identificado');

  const doFornecedor = await col('_produto_origem')
    .find({ lojistaId, codigoProd: { $in: [...naNota] } })
    .project({ nrFornec: 1 }).toArray();

  const nrs = [...new Set(doFornecedor.map(p => p.nrFornec).filter(Boolean))];
  if (!nrs.length) throw new Error('nao consegui descobrir o NrFornec');

  const candidatos = await col('_produto_origem')
    .find({ lojistaId, ativo: true, nrFornec: { $in: nrs },
            codigoProd: { $nin: [...naNota] } })
    .limit(4).toArray();

  if (!candidatos.length) {
    throw new Error('nao ha outro produto deste fornecedor fora da nota');
  }

  const numero = await proximoNumero(lojistaId);
  const { conta, razao } = await contaDoFornecedor(lojistaId, nota.fornecedor);

  const entrega = new Date(Date.now() + 15 * 86400000);
  const condicao = { texto: '30/60 dias', dias: [30, 60] };

  const itens = candidatos.map((p, n) => ({
    produto: null,
    codigoOrigem: p.codigoProd,
    referencia: p.referencia || '',
    descricao: p.descricao || '',
    quantidade: n + 1,
    quantidadeAtendida: 0,
    custoUnitario: p.custoUltimo != null ? p.custoUltimo : (p.precoCusto || 0),
    baseCalculo: { ajustadoAMao: true },
  })).filter(i => i.custoUnitario > 0);

  if (!itens.length) throw new Error('os candidatos estao sem custo');

  const total = itens.reduce((s, i) => s + i.quantidade * i.custoUnitario, 0);

  console.log('Pedido avulso a criar:  no ' + numero);
  console.log('  fornecedor ..... ' + (razao || '(sem cadastro)'));
  console.log('  entrega ........ ' + dia(entrega));
  console.log('  total .......... ' + moeda(total) + '\n');

  for (const i of itens) {
    console.log('    ' + String(i.codigoOrigem).padStart(6)
      + '  ' + (i.descricao || '').slice(0, 36).padEnd(36)
      + '  ' + String(i.quantidade).padStart(3)
      + ' x ' + moeda(i.custoUnitario).padStart(10));
  }

  if (!APLICAR) return;

  const sessao = await mongoose.startSession();
  try {
    let criado;
    await sessao.withTransaction(async () => {
      const novo = await Pedido.create([{
        lojistaId,
        numero,
        situacao: 'P',
        fornecedor: nota.fornecedor,
        dataEmissao: new Date(),
        dataEntregaPrevista: entrega,
        condicaoPagamento: condicao,
        itens,
        observacao: 'Pedido avulso de teste',
      }], { session: sessao });

      criado = novo[0];
      criado.lancamentosFluxo = await gerarFluxo(criado, conta, razao, sessao);
      await criado.save({ session: sessao });
    });

    console.log('\n[ok] pedido avulso no ' + criado.numero + ' criado.');
  } finally {
    await sessao.endSession();
  }
}

// ---------------------------------------------------------------------------
async function cancelarPedido(lojistaId) {
  const numero = Number(CANCELAR);
  const pedido = await Pedido.findOne({ lojistaId, numero });
  if (!pedido) throw new Error('pedido no ' + numero + ' nao encontrado');

  const notas = await NotaEntrada.find({ lojistaId, pedido: pedido._id })
    .select('numero situacao');

  const presas = notas.filter(n => n.situacao === 'EFETIVADA');
  if (presas.length) {
    throw new Error('o pedido ja foi encerrado pela nota '
      + presas[0].numero + '; nao da para cancelar');
  }

  const fluxo = await FluxoProjetado.find({
    _id: { $in: pedido.lancamentosFluxo || [] },
    status: 'ATIVO',
  });

  console.log('Pedido no ' + numero + '  ·  situacao ' + pedido.situacao);
  console.log('  itens ......... ' + (pedido.itens || []).length);
  console.log('  total ......... ' + moeda(pedido.valorTotal));
  console.log('  fluxo ativo ... ' + fluxo.length + ' linha(s)');
  console.log('  notas ligadas . ' + notas.length
    + (notas.length ? '  (' + notas.map(n => n.numero).join(', ') + ')' : ''));
  console.log('\n  -> situacao vira C, as linhas do fluxo saem, '
    + 'as notas ficam sem pedido');

  if (!APLICAR) return;

  const sessao = await mongoose.startSession();
  try {
    await sessao.withTransaction(async () => {
      for (const l of fluxo) {
        l.status = 'CANCELADO';
        await l.save({ session: sessao });
      }

      pedido.situacao = 'C';
      pedido.canceladoEm = new Date();
      pedido.motivoCancelamento = 'Cancelado pelo COMPRA-8 (pedido de teste)';
      await pedido.save({ session: sessao });

      for (const n of notas) {
        const nota = await NotaEntrada.findById(n._id).session(sessao);
        nota.pedido = null;
        nota.tipoEntrada = '';
        await nota.save({ session: sessao });
      }
    });

    console.log('\n[ok] pedido no ' + numero + ' cancelado.');
  } finally {
    await sessao.endSession();
  }
}

// ---------------------------------------------------------------------------
// --zerar-contagem
//
// A contagem fisica e da pagina de conferencia, e so dela. Notas antigas
// ficaram com quantidadeConferida escrita pela tela de nota x pedido, que
// contava uma unidade ao ligar o produto — dado de outro assunto no mesmo
// campo. Isto limpa.
// ---------------------------------------------------------------------------
async function zerarContagem(lojistaId) {
  const nota = await acharNota(lojistaId, ZERAR);

  if (nota.situacao === 'EFETIVADA') {
    throw new Error('nota ja efetivada; a contagem faz parte do historico');
  }

  const comContagem = nota.itens.filter(i => (i.quantidadeConferida || 0) > 0);
  const comTentativa = nota.itens.filter(i => (i.tentativas || []).length);

  console.log('Nota ' + nota.numero + '/' + nota.serie
    + '  ·  situacao ' + nota.situacao);
  console.log('  itens ................. ' + nota.itens.length);
  console.log('  com contagem .......... ' + comContagem.length);
  console.log('  com tentativa ......... ' + comTentativa.length);
  console.log('  bloqueada ............. ' + (nota.bloqueada ? 'sim' : 'nao'));

  if (comContagem.length) {
    console.log('');
    for (const i of comContagem) {
      console.log('    ' + (i.codigoFornec || '').padEnd(16)
        + (i.descricaoXml || '').slice(0, 34).padEnd(36)
        + i.quantidadeConferida + ' de ' + i.quantidade);
    }
  }

  console.log('\n  -> contagens, tentativas e bloqueio zerados.');
  console.log('     o nosso codigo e o vinculo com o pedido NAO sao tocados.');

  if (!APLICAR) return;

  for (const i of nota.itens) {
    i.quantidadeConferida = 0;
    i.conferidoEm = null;
    i.conferidoPor = null;
    i.tentativas = [];
  }

  nota.bloqueada = false;
  nota.bloqueadaEm = null;
  nota.bloqueadaItem = null;
  nota.bloqueadaMotivo = '';

  if (nota.situacao === 'EM_CONFERENCIA') {
    nota.situacao = nota.pedido ? 'VINCULADA' : 'RECEBIDA';
  }

  await nota.save();
  console.log('\n[ok] contagem zerada.');
}

// ---------------------------------------------------------------------------
async function principal() {
  const quantas = [DA_NOTA, AVULSO, CANCELAR, ZERAR].filter(Boolean).length;

  if (LIGAR.length) {
    if (AVULSO || CANCELAR || ZERAR) {
      console.log('\n--ligar nao se combina com --avulso nem com --cancelar\n');
      return;
    }
  } else if (quantas !== 1) {
    console.log('\nInforme UMA acao: --da-nota <id>, --avulso <id>, '
      + '--cancelar <numero>, --zerar-contagem <id>, '
      + 'ou --nota <id> --ligar <ref>=<codigo>\n');
    return;
  }

  await connectToDatabase();
  console.log('conectado ao banco\n');
  console.log(APLICAR ? '>>> MODO APLICAR <<<\n'
                      : '--- simulação (nada é gravado) ---\n');

  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  if (LIGAR.length) await ligarItens(lojistaId);

  if (DA_NOTA)  await pedidoDaNota(lojistaId);
  if (AVULSO)   await pedidoAvulso(lojistaId);
  if (CANCELAR) await cancelarPedido(lojistaId);
  if (ZERAR)    await zerarContagem(lojistaId);

  if (!APLICAR) {
    console.log('\nnada foi gravado. Para gravar, repita com --aplicar');
  }
}

principal()
  .catch(err => {
    console.error('\nERRO: ' + err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
    console.log('\nconexão fechada.');
  });
