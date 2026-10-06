// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-7-reler-xml.js
// Criado em:   25/09/2026
// Alterado em: 25/09/2026 — dotenv carregado antes do modulo `database`
//                           (a variavel do .env chama-se MONGO_URI).
//
// Rele o `xmlBruto` das notas de entrada ja gravadas e completa os campos
// fiscais que o leitor antigo nao extraia (base de calculo, ICMS, CST por
// item, volumes, protocolo, natureza da operacao, destinatario...).
//
// POR QUE ISSO EXISTE
// A tela da nota passou a mostrar os quadros do DANFE. Notas importadas antes
// dessa mudanca nao tem esses campos no documento, entao os quadros aparecem
// vazios. O XML original esta guardado em `xmlBruto` por exigencia legal, e e
// dele que os campos saem — nao ha nada para pedir a ninguem.
//
// O QUE E PRESERVADO, SEMPRE
//   situacao, fornecedor, pedido, tipoEntrada, dataEntrada, origemXml,
//   observacao, lancamentosFluxo, estoqueAplicado, efetivada*, recusadaMotivo
//   e, em cada item: codigoProd, produto, vinculadoPor, quantidadeConferida,
//   conferidoEm, conferidoPor, itemPedidoId, quantidadePedida, custoPedido,
//   observacao.
// Ou seja: o trabalho de conferencia ja feito nao se perde.
//
// NOTA EFETIVADA NAO E TOCADA. Ela ja virou estoque e titulo no fluxo; mexer
// no documento depois disso seria reescrever historia. Use --incluir-efetivadas
// se um dia precisar, sabendo o que esta fazendo.
//
// COMO RODAR (PowerShell, um comando por vez, sempre simulando antes)
//   node src\scripts\COMPRA-7-reler-xml.js
//   node src\scripts\COMPRA-7-reler-xml.js --nota 6ab661ad120d535da044544a
//   node src\scripts\COMPRA-7-reler-xml.js --aplicar
//
// Sem --aplicar nada e gravado: o script so mostra o que mudaria.
// Com --aplicar, grava um backup EJSON em backup\ antes de tocar em qualquer
// documento (JSON comum perde ObjectId e datas).
// =============================================================================

'use strict';

const path = require('path');
const fs = require('fs');

// O .env TEM que ser lido antes do modulo `database`, que estoura na linha 5
// se MONGO_URI nao estiver em process.env. O 2C-0 faz o mesmo.
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

// EJSON: normalmente vem do pacote `bson`; se ele nao resolver sozinho,
// usa o que ja veio junto com o driver do Mongoose.
const EJSON = (() => {
  try { return require('bson').EJSON; }
  catch (e) { return mongoose.mongo.BSON.EJSON; }
})();

const NotaEntrada = require('../models/compra/notaEntrada');
const { lerNfe } = require('../utils/compra/lerNfe');

// ---------------------------------------------------------------------------
// argumentos
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const APLICAR = argv.includes('--aplicar');
const INCLUIR_EFETIVADAS = argv.includes('--incluir-efetivadas');
const VERBOSE = argv.includes('--detalhe');

function opcao(nome) {
  const i = argv.indexOf(nome);
  return (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[i + 1] : null;
}

const SO_NOTA = opcao('--nota');
const SO_CHAVE = opcao('--chave');

// ---------------------------------------------------------------------------
// o que nao pode ser sobrescrito pelo XML
// ---------------------------------------------------------------------------
const ITEM_PRESERVADO = [
  'produto', 'codigoProd', 'vinculadoPor',
  'quantidadeConferida', 'conferidoEm', 'conferidoPor',
  'itemPedidoId', 'quantidadePedida', 'custoPedido',
  'observacao',
];

// campos do documento que o XML pode escrever. Tudo que nao estiver aqui
// fica como esta.
const NOTA_DO_XML = [
  'chaveAcesso', 'numero', 'serie', 'modelo', 'naturezaOperacao',
  'dataEmissao', 'dataSaida',
  'emitente', 'destinatario',
  'valorBcIcms', 'valorIcms', 'valorBcIcmsSt', 'valorIcmsSt',
  'valorProdutos', 'valorFrete', 'valorSeguro', 'valorDesconto',
  'valorOutras', 'valorIpi', 'valorTotal',
  'frete', 'modFrete', 'transportadoraXml', 'volumes',
  'duplicatas', 'protocolo', 'informacoesComplementares',
];

const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

// ---------------------------------------------------------------------------
function casarItens(itensAntigos, itensNovos) {
  // casa pelo nItem do XML; se faltar, cai para a ordem.
  const porNumero = new Map();
  itensAntigos.forEach((it, idx) => {
    const k = it.numeroItem != null ? String(it.numeroItem) : ('#' + idx);
    if (!porNumero.has(k)) porNumero.set(k, it);
  });

  return itensNovos.map((novo, idx) => {
    const k = novo.numeroItem != null ? String(novo.numeroItem) : ('#' + idx);
    const antigo = porNumero.get(k) || itensAntigos[idx] || null;

    const juntado = { ...novo };
    if (antigo) {
      for (const campo of ITEM_PRESERVADO) {
        const v = antigo[campo];
        if (v !== undefined && v !== null) juntado[campo] = v;
      }
    }
    return { juntado, casou: !!antigo };
  });
}

// ---------------------------------------------------------------------------
async function principal() {
  await connectToDatabase();
  console.log('conectado ao banco\n');

  const filtro = { xmlBruto: { $exists: true, $ne: '' } };

  if (!INCLUIR_EFETIVADAS) filtro.situacao = { $ne: 'EFETIVADA' };
  if (SO_NOTA) {
    if (!mongoose.Types.ObjectId.isValid(SO_NOTA)) {
      throw new Error('--nota não é um ObjectId válido: ' + SO_NOTA);
    }
    filtro._id = new mongoose.Types.ObjectId(SO_NOTA);
  }
  if (SO_CHAVE) filtro.chaveAcesso = String(SO_CHAVE).replace(/\D/g, '');

  const notas = await NotaEntrada.find(filtro).sort({ dataEmissao: 1 });

  const semXml = await NotaEntrada.countDocuments({
    $or: [{ xmlBruto: { $exists: false } }, { xmlBruto: '' }],
  });

  console.log(APLICAR ? '>>> MODO APLICAR <<<' : '--- simulação (nada é gravado) ---');
  console.log(notas.length + ' nota(s) com XML guardado para reler');
  if (semXml) console.log(semXml + ' nota(s) sem xmlBruto — essas o script não alcança');
  console.log('');

  if (!notas.length) {
    console.log('nada a fazer.');
    return;
  }

  // ---- backup antes de qualquer gravacao ----------------------------------
  if (APLICAR) {
    const pasta = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

    const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const arquivo = path.join(pasta, 'notas-antes-reler-' + carimbo + '.json');

    const cru = await mongoose.connection
      .collection('_compra_notas_entrada')
      .find({ _id: { $in: notas.map(n => n._id) } })
      .toArray();

    fs.writeFileSync(arquivo, EJSON.stringify(cru, null, 2), 'utf8');

    const tamanho = fs.statSync(arquivo).size;
    console.log('backup EJSON: ' + arquivo);
    console.log('              ' + cru.length + ' documento(s), '
                + tamanho.toLocaleString('pt-BR') + ' bytes');
    if (!tamanho) throw new Error('backup saiu com 0 byte — abortado');
    console.log('');
  }

  // ---- uma nota por vez ----------------------------------------------------
  const resumo = { relidas: 0, semMudanca: 0, falharam: 0, itensSemPar: 0 };

  for (const nota of notas) {
    const etiqueta = 'nota ' + (nota.numero || '?')
                   + '/' + (nota.serie || '?')
                   + '  ' + (nota.emitente?.razao || '').slice(0, 34);

    let dados;
    try {
      dados = lerNfe(nota.xmlBruto);
    } catch (e) {
      resumo.falharam++;
      console.log('✕ ' + etiqueta);
      console.log('    XML não pôde ser lido: ' + e.message);
      continue;
    }

    // confere que o XML guardado e mesmo o desta nota
    if (nota.chaveAcesso && dados.chaveAcesso
        && nota.chaveAcesso !== dados.chaveAcesso) {
      resumo.falharam++;
      console.log('✕ ' + etiqueta);
      console.log('    a chave do xmlBruto não bate com a do documento — pulada');
      continue;
    }

    const antes = {
      valorBcIcms: nota.valorBcIcms || 0,
      valorIcms: nota.valorIcms || 0,
      valorOutras: nota.valorOutras || 0,
      volumes: (nota.volumes || []).length,
      protocolo: nota.protocolo?.numero || '',
      natureza: nota.naturezaOperacao || '',
      comCst: (nota.itens || []).filter(i => i.cst).length,
      custos: (nota.itens || []).map(i => i.custoUnitarioReal || 0),
    };

    // ---- campos do documento ----------------------------------------------
    for (const campo of NOTA_DO_XML) {
      if (dados[campo] !== undefined) nota[campo] = dados[campo];
    }

    // ---- itens, preservando a conferencia ---------------------------------
    const casados = casarItens(nota.itens || [], dados.itens);
    const semPar = casados.filter(c => !c.casou).length;
    resumo.itensSemPar += semPar;

    nota.itens = casados.map(c => c.juntado);

    // o pre('save') do model recalcula o rateio e o custo real
    const depois = {
      valorBcIcms: nota.valorBcIcms || 0,
      valorIcms: nota.valorIcms || 0,
      valorOutras: nota.valorOutras || 0,
      volumes: (nota.volumes || []).length,
      protocolo: nota.protocolo?.numero || '',
      natureza: nota.naturezaOperacao || '',
      comCst: (nota.itens || []).filter(i => i.cst).length,
    };

    const mudou = nota.isModified();

    console.log((mudou ? '→ ' : '· ') + etiqueta);
    console.log('    BC ICMS   ' + moeda(antes.valorBcIcms) + '  ->  ' + moeda(depois.valorBcIcms));
    console.log('    V. ICMS   ' + moeda(antes.valorIcms) + '  ->  ' + moeda(depois.valorIcms));
    console.log('    volumes   ' + antes.volumes + '  ->  ' + depois.volumes);
    console.log('    CST nos itens  ' + antes.comCst + '  ->  ' + depois.comCst
                + '  de ' + nota.itens.length);
    if (!antes.protocolo && depois.protocolo) {
      console.log('    protocolo ' + depois.protocolo);
    }
    if (!antes.natureza && depois.natureza) {
      console.log('    natureza  ' + depois.natureza);
    }
    if (semPar) {
      console.log('    ⚠ ' + semPar + ' item(ns) do XML sem par no documento '
                  + '— conferência desses itens volta a zero');
    }

    const conferidos = nota.itens.filter(i =>
      (i.quantidadeConferida || 0) > 0).length;
    if (conferidos) {
      console.log('    conferência preservada em ' + conferidos + ' item(ns)');
    }

    if (VERBOSE) {
      nota.itens.forEach((i, idx) => {
        const de = antes.custos[idx];
        const para = i.custoUnitarioReal || 0;
        console.log('      ' + String(idx + 1).padStart(2)
          + '  ' + (i.descricaoXml || '').slice(0, 38).padEnd(38)
          + '  custo ' + moeda(de).padStart(10) + ' -> ' + moeda(para).padStart(10));
      });
    }

    if (!mudou) { resumo.semMudanca++; console.log(''); continue; }

    if (APLICAR) {
      await nota.save();
      console.log('    gravada.');
    }
    resumo.relidas++;
    console.log('');
  }

  // ---- fecho ---------------------------------------------------------------
  console.log('-'.repeat(60));
  console.log('relidas      ' + resumo.relidas);
  console.log('sem mudança  ' + resumo.semMudanca);
  console.log('falharam     ' + resumo.falharam);
  if (resumo.itensSemPar) console.log('itens sem par ' + resumo.itensSemPar);

  if (!APLICAR && resumo.relidas) {
    console.log('');
    console.log('nada foi gravado. Para gravar, repita com --aplicar');
  }
}

principal()
  .catch(err => {
    console.error('\nERRO:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
    console.log('\nconexão fechada.');
  });
