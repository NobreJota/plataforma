// =============================================================================
// Destino: C:\plataformaRota\src\routes\compra\nota-api.js
// Alterado em: 25/09/2026  (conferencia: ler, ligar produto, buscar, desfazer)
// Alterado em: 25/09/2026  (importar passa a gravar TUDO que o lerNfe extrai)
// Alterado em: 25/09/2026  (efetivar a entrada e recusar a nota)
// Alterado em: 27/09/2026  (painel por mes: resumo e lista filtram pela data
//                           de entrada, com aviso de aberta fora do periodo)
// Alterado em: 26/09/2026  (ligar NAO conta unidade; a contagem fisica e de
//                           outra pagina. Saem as rotas /ler e /desfazer)
// Alterado em: 26/09/2026  (recusa o mesmo produto em dois itens da nota)
// Alterado em: 26/09/2026  (linha do pedido ja usada sai da lista de candidatas)
// Alterado em: 26/09/2026  (adotar a referencia do fabricante como a nossa)
// Alterado em: 25/09/2026  (descricao do fabricante gravada no produto; a
//                           referencia casa por "contem", nao so por prefixo)
// Alterado em: 25/09/2026  (nao existe nota sem pedido: os candidatos de cada
//                           item sao as linhas do pedido, nao o cadastro inteiro)
//
// APIs da entrada de nota fiscal de mercadoria.
//
//   GET  /compra/api/nota/resumo
//   GET  /compra/api/nota/lista
//   POST /compra/api/nota/importar        { arquivos: [{ nome, xml }] }
//   GET  /compra/api/nota/produtos?q=     busca produto para ligar
//   POST /compra/api/nota/:id/ler         { codigo }            conferir 1
//   POST /compra/api/nota/:id/ligar       { item, codigoProd }  liga e grava EAN
//   POST /compra/api/nota/:id/desfazer    { item }              zera a contagem
//   GET  /compra/api/nota/:id
//
// Cada leitura grava na hora: o trabalho e interrompido o tempo todo e a
// nota tem que aguentar ser largada pela metade.
//
// O ESTOQUE SO SOBE NA EFETIVACAO.
//
// Protegido por ensureContab no server.js, que expoe req.lojistaId.
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const NotaEntrada = require('../../models/compra/notaEntrada');
const Pedido = require('../../models/compra/pedido');
const { lerNfe } = require('../../utils/compra/lerNfe');
const FluxoProjetado = require('../../models/contab/financeiro/fluxoProjetado');

const SITUACOES = ['RECEBIDA', 'VINCULADA', 'EM_CONFERENCIA', 'EFETIVADA', 'RECUSADA'];
const ABERTAS = ['RECEBIDA', 'VINCULADA', 'EM_CONFERENCIA'];

function col(nome) {
  return mongoose.connection.collection(nome);
}

function soDigitos(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

function escaparRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function chaveRef(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function semAcento(v) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// O periodo: mes e ano, pela DATA DE ENTRADA.
//
// "Efetivadas" so quer dizer alguma coisa dentro de um periodo — o numero
// cresce para sempre. Quem procura nota procura pelo mes em que ela entrou,
// nao pelo mes em que foi emitida.
//
// mes ausente ou "todos" = o ano inteiro. Ano ausente = o ano corrente.
// ---------------------------------------------------------------------------
function faixaDoPeriodo(query) {
  const ano = Number(query.ano) || new Date().getFullYear();
  const mes = Number(query.mes);

  if (Number.isInteger(mes) && mes >= 1 && mes <= 12) {
    return {
      ano, mes,
      de:  new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0)),
      ate: new Date(Date.UTC(ano, mes, 1, 0, 0, 0)),
    };
  }

  return {
    ano, mes: null,
    de:  new Date(Date.UTC(ano, 0, 1, 0, 0, 0)),
    ate: new Date(Date.UTC(ano + 1, 0, 1, 0, 0, 0)),
  };
}

// ---------------------------------------------------------------------------
// GET /resumo
// ---------------------------------------------------------------------------
router.get('/resumo', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    // Com um fornecedor escolhido, os cartoes falam dele. Cartao contando a
    // empresa inteira e lista mostrando um fornecedor so sao duas verdades
    // na mesma tela.
    // o recorte comum: empresa, fornecedor e situacao. O periodo entra depois,
    // porque os meses e os anos precisam olhar para fora dele.
    const base = { lojistaId };
    if (req.query.fornecedor && mongoose.Types.ObjectId.isValid(req.query.fornecedor)) {
      base.fornecedor = new mongoose.Types.ObjectId(req.query.fornecedor);
    }
    if (SITUACOES.includes(String(req.query.situacao || ''))) {
      base.situacao = req.query.situacao;
    }

    const casar = { ...base };

    // Sem `ano` na consulta nao ha periodo: e o painel de trabalho, que
    // mostra o que esta em andamento venha de quando vier.
    const comPeriodo = !!req.query.ano;
    const periodo = faixaDoPeriodo(req.query);
    if (comPeriodo) casar.dataEntrada = { $gte: periodo.de, $lt: periodo.ate };

    const grupos = await NotaEntrada.aggregate([
      { $match: casar },
      { $group: { _id: '$situacao', quantidade: { $sum: 1 }, valor: { $sum: '$valorTotal' } } },
    ]);

    const porSituacao = {};
    for (const s of SITUACOES) porSituacao[s] = { quantidade: 0, valor: 0 };
    for (const g of grupos) {
      if (porSituacao[g._id]) porSituacao[g._id] = { quantidade: g.quantidade, valor: g.valor };
    }

    const abertas = ABERTAS.reduce((s, k) => s + porSituacao[k].quantidade, 0);

    // Nota em aberto de mes passado nao pode sumir da vista so porque o
    // periodo mudou: a tela avisa e oferece o caminho.
    const forasEmAberto = comPeriodo
      ? await NotaEntrada.countDocuments({
          lojistaId,
          situacao: { $in: ABERTAS },
          $or: [
            { dataEntrada: { $lt: periodo.de } },
            { dataEntrada: { $gte: periodo.ate } },
          ],
        })
      : 0;

    // os meses que tem nota, para a barra saber onde ha o que ver
    const porMes = await NotaEntrada.aggregate([
      { $match: {
          ...base,
          dataEntrada: {
            $gte: new Date(Date.UTC(periodo.ano, 0, 1)),
            $lt:  new Date(Date.UTC(periodo.ano + 1, 0, 1)),
          },
      } },
      { $group: { _id: { $month: '$dataEntrada' }, quantidade: { $sum: 1 } } },
    ]);

    // os anos que tem nota, para o select
    const anos = await NotaEntrada.aggregate([
      { $match: base },
      { $group: { _id: { $year: '$dataEntrada' } } },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      ok: true,
      porSituacao,
      abertas,
      forasEmAberto,
      periodo: { ano: periodo.ano, mes: periodo.mes },
      mesesComNota: porMes.filter(m => m._id).map(m => m._id),
      anos: anos.map(a => a._id).filter(Boolean),
    });
  } catch (err) {
    console.error('[compra/nota/resumo]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /fornecedores
//
// Os fornecedores que tem nota nesta empresa, para o select da tela. Sai do
// proprio emitente das notas, nao do cadastro inteiro: so interessa quem ja
// mandou mercadoria.
// ---------------------------------------------------------------------------
router.get('/fornecedores', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const linhas = await NotaEntrada.aggregate([
      { $match: { lojistaId } },
      { $group: {
          _id: '$fornecedor',
          razao: { $first: '$emitente.razao' },
          cnpj:  { $first: '$emitente.cnpj' },
          notas: { $sum: 1 },
          valor: { $sum: '$valorTotal' },
          ultima: { $max: '$dataEntrada' },
      } },
      { $sort: { razao: 1 } },
    ]);

    res.json({
      ok: true,
      fornecedores: linhas
        .filter(l => l._id)
        .map(l => ({
          _id: l._id,
          razao: l.razao || '(sem emitente)',
          cnpj: l.cnpj || '',
          notas: l.notas,
          valor: l.valor,
          ultima: l.ultima,
        })),
      semCadastro: linhas.filter(l => !l._id).reduce((s, l) => s + l.notas, 0),
    });
  } catch (err) {
    console.error('[compra/nota/fornecedores]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /lista
// ---------------------------------------------------------------------------
router.get('/lista', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const filtro = { lojistaId };

    const situacao = String(req.query.situacao || 'abertas');
    if (situacao === 'abertas') filtro.situacao = { $in: ABERTAS };
    else if (situacao !== 'todas' && SITUACOES.includes(situacao)) filtro.situacao = situacao;

    if (req.query.fornecedor && mongoose.Types.ObjectId.isValid(req.query.fornecedor)) {
      filtro.fornecedor = new mongoose.Types.ObjectId(req.query.fornecedor);
    }

    // A busca por texto ignora o periodo: quem digita o numero da nota quer
    // aquela nota, nao aquela nota naquele mes.
    const busca = String(req.query.busca || '').trim();
    if (!busca && req.query.ano) {
      const periodo = faixaDoPeriodo(req.query);
      filtro.dataEntrada = { $gte: periodo.de, $lt: periodo.ate };
    }

    if (busca) {
      const rx = new RegExp(escaparRegex(busca), 'i');
      filtro.$or = [{ numero: rx }, { 'emitente.razao': rx }, { chaveAcesso: rx }];
    }

    const notas = await NotaEntrada.find(filtro)
      .select('numero serie chaveAcesso dataEmissao dataEntrada situacao '
            + 'emitente.razao emitente.cnpj valorTotal pedido tipoEntrada '
            + 'itens.quantidade itens.quantidadeConferida itens.produto '
            + 'itens.codigoProd criadoEm')
      .sort({ dataEntrada: -1, criadoEm: -1 })
      .limit(200)
      .lean();

    const idsPedido = notas.map(n => n.pedido).filter(Boolean);
    const pedidos = idsPedido.length
      ? await Pedido.find({ _id: { $in: idsPedido } }).select('numero').lean()
      : [];
    const numeroPedido = new Map(pedidos.map(p => [String(p._id), p.numero]));

    const lista = notas.map(n => {
      const itens = n.itens || [];
      const total = itens.length;
      const identificados = itens.filter(i => i.produto || i.codigoProd).length;
      const conferidos = itens.filter(i =>
        (i.quantidadeConferida || 0) >= (i.quantidade || 0)).length;

      return {
        _id: n._id,
        numero: n.numero || '',
        serie: n.serie || '',
        chaveAcesso: n.chaveAcesso || '',
        dataEmissao: n.dataEmissao,
        dataEntrada: n.dataEntrada,
        situacao: n.situacao,
        razao: n.emitente?.razao || '',
        cnpj: n.emitente?.cnpj || '',
        valorTotal: n.valorTotal || 0,
        pedidoNumero: n.pedido ? (numeroPedido.get(String(n.pedido)) || null) : null,
        tipoEntrada: n.tipoEntrada || '',
        itens: total,
        identificados,
        conferidos,
        progresso: total ? Math.round((conferidos / total) * 100) : 0,
      };
    });

    res.json({ ok: true, total: lista.length, notas: lista });
  } catch (err) {
    console.error('[compra/nota/lista]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /importar
// ---------------------------------------------------------------------------
router.post('/importar', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const arquivos = Array.isArray(req.body?.arquivos) ? req.body.arquivos : [];

    if (!arquivos.length) {
      return res.status(400).json({ ok: false, erro: 'nenhum arquivo recebido' });
    }

    const fornecedores = await col('fornecs').find({}).toArray();
    const porCnpj = new Map();
    for (const f of fornecedores) {
      const c = soDigitos(f.cnpj);
      if (c) porCnpj.set(c, f);
    }

    const resultado = { importadas: 0, repetidas: 0, falharam: 0, detalhes: [] };

    for (const arq of arquivos) {
      const nome = String(arq?.nome || 'arquivo.xml');

      try {
        const dados = lerNfe(String(arq?.xml || ''));

        if (dados.chaveAcesso) {
          const jaTem = await NotaEntrada.findOne({
            lojistaId, chaveAcesso: dados.chaveAcesso,
          }).select('_id numero').lean();

          if (jaTem) {
            resultado.repetidas++;
            resultado.detalhes.push({
              nome, situacao: 'repetida',
              mensagem: 'nota ' + (jaTem.numero || '') + ' já importada',
              notaId: jaTem._id,
            });
            continue;
          }
        }

        const fornec = porCnpj.get(soDigitos(dados.emitente.cnpj)) || null;
        const identificados = await identificarItens(lojistaId, dados.itens);

        let pedidoUnico = null;
        if (fornec) {
          const pendentes = await Pedido.find({
            lojistaId, fornecedor: fornec._id, situacao: 'P',
          }).select('_id').lean();
          if (pendentes.length === 1) pedidoUnico = pendentes[0]._id;
        }

        // Tudo que o lerNfe extraiu do XML entra de uma vez. Antes era campo a
        // campo, e cada campo novo do leitor era silenciosamente descartado
        // aqui — foi assim que os quadros fiscais da tela nasceram vazios.
        // O schema e strict: o que nao estiver declarado no model e ignorado.
        const { _aviso, itens: itensXml, ...doXml } = dados;

        const nota = new NotaEntrada({
          lojistaId,
          situacao: 'RECEBIDA',

          ...doXml,

          // o que NAO vem do XML
          dataEntrada: new Date(),
          fornecedor: fornec ? fornec._id : null,
          itens: identificados,
          origemXml: 'upload',
          xmlBruto: String(arq?.xml || ''),
        });

        if (pedidoUnico) {
          nota.pedido = pedidoUnico;
          nota.situacao = 'VINCULADA';
        }

        await nota.save();

        resultado.importadas++;
        resultado.detalhes.push({
          nome, situacao: 'importada', notaId: nota._id, numero: dados.numero,
          fornecedor: fornec ? fornec.razao : dados.emitente.razao,
          semCadastro: !fornec,
          itens: identificados.length,
          identificados: identificados.filter(i => i.produto || i.codigoProd).length,
          vinculouPedido: !!pedidoUnico,
          avisos: dados._aviso,
        });

      } catch (e) {
        resultado.falharam++;
        resultado.detalhes.push({ nome, situacao: 'erro', mensagem: e.message });
        console.error('[importar]', nome, e.message);
      }
    }

    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('[compra/nota/importar]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
async function identificarItens(lojistaId, itens) {
  const eans = itens.map(i => i.ean).filter(Boolean);
  const refs = itens.map(i => i.codigoFornec).filter(Boolean);

  const porEan = new Map();
  if (eans.length) {
    const achados = await col('_produto_origem')
      .find({ lojistaId, ean: { $in: eans } })
      .project({ codigoProd: 1, ean: 1, descricao: 1 })
      .toArray();
    for (const p of achados) porEan.set(p.ean, p);
  }

  const porRef = new Map();
  if (refs.length) {
    const chaves = refs.map(chaveRef);
    const achados = await col('_produto_origem')
      .find({ lojistaId, ativo: true })
      .project({ codigoProd: 1, referencia: 1, referencia2: 1 })
      .toArray();

    for (const p of achados) {
      for (const r of [p.referencia, p.referencia2]) {
        const k = chaveRef(r);
        if (k && chaves.includes(k) && !porRef.has(k)) porRef.set(k, p);
      }
    }
  }

  return itens.map(i => {
    const pe = i.ean ? porEan.get(i.ean) : null;
    if (pe) return { ...i, codigoProd: pe.codigoProd, vinculadoPor: 'ean' };

    const pr = porRef.get(chaveRef(i.codigoFornec));
    if (pr) return { ...i, codigoProd: pr.codigoProd, vinculadoPor: 'codigoFornec' };

    return i;
  });
}

// ---------------------------------------------------------------------------
// GET /produtos?q=
//
// SAIDA DE EMERGENCIA. O caminho normal e escolher uma linha do PEDIDO:
// nao existe nota sem pedido. Esta busca varre o cadastro inteiro e so serve
// para o caso do fornecedor ter mandado item que nao estava no pedido.
// ---------------------------------------------------------------------------
router.get('/produtos', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const q = String(req.query.q || '').trim();

    if (q.length < 2) return res.json({ ok: true, produtos: [] });

    const projecao = { codigoProd: 1, descricao: 1, referencia: 1, marca: 1,
                       estoque: 1, precoCusto: 1, custoUltimo: 1, ean: 1 };

    let produtos = [];
    const comoNumero = Number(q);
    if (Number.isInteger(comoNumero) && comoNumero > 0) {
      produtos = await col('_produto_origem')
        .find({ lojistaId, ativo: true, codigoProd: comoNumero })
        .project(projecao).limit(5).toArray();
    }

    const rx = new RegExp(escaparRegex(q), 'i');
    const mais = await col('_produto_origem')
      .find({ lojistaId, ativo: true, $or: [
        { descricao: rx }, { referencia: rx }, { referencia2: rx }, { marca: rx },
      ] })
      .project(projecao).limit(30).toArray();

    const vistos = new Set(produtos.map(p => p.codigoProd));
    for (const p of mais) {
      if (!vistos.has(p.codigoProd)) { produtos.push(p); vistos.add(p.codigoProd); }
    }

    res.json({
      ok: true,
      produtos: produtos.slice(0, 30).map(p => ({
        ...p,
        custo: p.custoUltimo != null ? p.custoUltimo : (p.precoCusto || 0),
      })),
    });
  } catch (err) {
    console.error('[compra/nota/produtos]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// Acha a nota e protege contra mexer no que ja foi efetivado.
// ---------------------------------------------------------------------------
async function acharAberta(lojistaId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const e = new Error('id invalido'); e.status = 400; throw e;
  }
  const nota = await NotaEntrada.findOne({ _id: id, lojistaId });
  if (!nota) { const e = new Error('nota nao encontrada'); e.status = 404; throw e; }
  if (nota.situacao === 'EFETIVADA') {
    const e = new Error('nota ja efetivada'); e.status = 400; throw e;
  }
  if (nota.situacao === 'RECUSADA') {
    const e = new Error('nota recusada'); e.status = 400; throw e;
  }
  return nota;
}

// ---------------------------------------------------------------------------
// POST /:id/ligar    { item, codigoProd }
//
// Liga a linha da nota ao nosso produto e GRAVA O EAN nele. Da proxima nota
// desse fornecedor, a leitura resolve sozinha.
// Conta a primeira unidade junto, porque o produto esta na mao.
// ---------------------------------------------------------------------------
router.post('/:id/ligar', express.json(), async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharAberta(lojistaId, req.params.id);

    const idx = Number(req.body?.item);
    const codigoProd = Number(req.body?.codigoProd);
    // adotar a referencia do fabricante como a nossa
    const atualizarReferencia = req.body?.atualizarReferencia === true;

    if (!Number.isInteger(idx) || idx < 0 || idx >= nota.itens.length) {
      return res.status(400).json({ ok: false, erro: 'item inválido' });
    }
    if (!Number.isInteger(codigoProd) || codigoProd <= 0) {
      return res.status(400).json({ ok: false, erro: 'produto inválido' });
    }

    const produto = await col('_produto_origem')
      .findOne({ lojistaId, codigoProd });
    if (!produto) {
      return res.status(404).json({ ok: false, erro: 'produto não encontrado' });
    }

    // Dois itens da nota no MESMO produto e sempre erro. A nota de teste
    // teve o M 200 GN e o M 200 GLP no mesmo codigo 4858, e so apareceu la
    // na frente, quando o pedido saiu com a linha repetida.
    const jaUsado = nota.itens.findIndex((it, n) =>
      n !== idx && it.codigoProd === codigoProd);

    if (jaUsado >= 0) {
      const outro = nota.itens[jaUsado];
      return res.status(409).json({
        ok: false,
        codigoRepetido: true,
        itemQueUsa: jaUsado,
        erro: 'o código ' + codigoProd + ' já é do item ' + (jaUsado + 1)
          + ' (' + (outro.codigoFornec || outro.descricaoXml || '') + '). '
          + 'Dois itens da nota não podem apontar para o mesmo produto.',
      });
    }

    const item = nota.itens[idx];
    item.produto = null;
    item.codigoProd = codigoProd;
    item.vinculadoPor = 'manual';

    // ---- o aprendizado --------------------------------------------------
    // Fica tudo no produto, em campos da PLATAFORMA: o COMPRA-5 nao os
    // sobrescreve, porque nao os conhece.
    //
    // A descricao do fabricante e guardada de proposito. "AQUECEDOR DE AGUA A
    // GAS BI-VOLT" nao diz litragem nem tipo de gas — a Rinnai nomeia de
    // dentro da fabrica para fora. Quem vende precisa da nossa descricao;
    // quem confere a nota precisa da deles. Guardando as duas, a proxima nota
    // deste fornecedor chega legivel dos dois lados.
    const aprendido = {
      descricaoFab: item.descricaoXml || '',
      refFab: item.codigoFornec || '',
      fabAtualizadoEm: new Date(),
    };
    if (item.ean) {
      aprendido.ean = item.ean;
      aprendido.eanAprendidoEm = new Date();
    }

    // Adotar a referencia do fabricante como a nossa, quando o usuario manda.
    // Guarda a anterior uma unica vez: e a unica forma de voltar atras, e
    // tambem o rastro de que a troca foi nossa e nao do Access.
    if (atualizarReferencia && item.codigoFornec) {
      aprendido.referencia = item.codigoFornec;
      aprendido.referenciaAtualizadaEm = new Date();
      if (produto.referenciaAntes == null) {
        aprendido.referenciaAntes = produto.referencia || '';
      }
    }

    await col('_produto_origem').updateOne(
      { lojistaId, codigoProd },
      { $set: aprendido },
    );

    // NAO conta unidade nenhuma. Ligar um item ao nosso produto e comparar a
    // nota com o pedido; contar mercadoria e outra coisa, em outra pagina,
    // com outro operador. Enquanto as duas escreviam no mesmo campo, a
    // contagem fisica nascia com itens ja "conferidos" sem ninguem ter
    // contado nada.
    await nota.save();

    res.json({
      ok: true,
      indice: idx,
      codigoProd,
      descricaoProduto: produto.descricao,
      descricaoFabGravada: aprendido.descricaoFab,
      referenciaAtualizada: atualizarReferencia ? item.codigoFornec : null,
      eanGravado: !!item.ean,
      situacao: nota.situacao,
      prontaParaEfetivar: nota.prontaParaEfetivar,
    });
  } catch (err) {
    console.error('[compra/nota/ligar]', err);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id/sugestoes/:indice
//
// Os candidatos para um item da nota sao as LINHAS DO PEDIDO, nao o cadastro
// inteiro. Nao existe nota fiscal sem pedido: o que chegou foi comprado, e o
// que foi comprado esta escrito ali, com codigo, referencia, quantidade e
// custo. Sao poucas linhas — devolve TODAS, ordenadas pela probabilidade.
//
// A referencia do fornecedor quase nunca e igual a nossa, mas costuma ser
// parente: a Rinnai manda REUE211FEHBL3 e o nosso cadastro tem REU-E211FEHB.
// Sem hifen e em maiusculas, uma e PREFIXO da outra. Custo e quantidade
// confirmam.
// ---------------------------------------------------------------------------
function prefixoComum(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function palavrasDe(s) {
  return semAcento(s).split(/[^a-z0-9]+/).filter(w => w.length > 2);
}

router.get('/:id/sugestoes/:indice', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharAberta(lojistaId, req.params.id);

    const idx = Number(req.params.indice);
    if (!Number.isInteger(idx) || idx < 0 || idx >= nota.itens.length) {
      return res.status(400).json({ ok: false, erro: 'item invalido' });
    }
    const item = nota.itens[idx];

    // ---- sem pedido nao ha o que sugerir -----------------------------------
    if (!nota.pedido) {
      return res.json({
        ok: true, indice: idx, semPedido: true, linhas: [],
        item: {
          descricaoXml: item.descricaoXml,
          codigoFornec: item.codigoFornec,
          ean: item.ean,
          quantidade: item.quantidade,
          custoUnitarioReal: item.custoUnitarioReal,
        },
      });
    }

    const pedido = await Pedido.findOne({ _id: nota.pedido, lojistaId });
    if (!pedido) {
      return res.status(404).json({ ok: false, erro: 'pedido nao encontrado' });
    }

    // linhas do pedido que outros itens desta nota ja tomaram
    const tomados = new Map();
    nota.itens.forEach((it, n) => {
      if (n !== idx && it.codigoProd) tomados.set(it.codigoProd, n + 1);
    });

    const alvoRef = chaveRef(item.codigoFornec);
    const alvoPalavras = new Set(palavrasDe(item.descricaoXml));

    // O custo do pedido veio do cadastro do produto, SEM IPI. O par dele e o
    // valor unitario da nota, nao o custo real: comparar 2.151,55 com 2.203,40
    // (que ja tem IPI dentro) empurra tudo para cima e escolhe a linha errada.
    const alvoCusto = item.valorUnitario || 0;

    const linhas = (pedido.itens || []).map(ip => {
      let pontos = 0;
      const porque = [];

      // ---- referencia ------------------------------------------------------
      // A referencia do Access e um PEDACO da referencia do fabricante, e nem
      // sempre o comeco: E211FEH mora dentro de REUE211FEHBL3, 200CFHB dentro
      // de REUM200CFHBLE. Por isso "contem" pontua quase tanto quanto "igual".
      const k = chaveRef(ip.referencia);
      if (alvoRef && k && k.length >= 4) {
        if (k === alvoRef) {
          pontos += 100; porque.push('referência igual');
        } else if (k.length >= 5 && alvoRef.includes(k)) {
          pontos += 70 + Math.min(20, k.length);
          porque.push('a nossa referência está dentro da do fabricante');
        } else if (alvoRef.length >= 5 && k.includes(alvoRef)) {
          pontos += 70 + Math.min(20, alvoRef.length);
          porque.push('referência do fabricante contida na nossa');
        } else if (prefixoComum(k, alvoRef) >= 6) {
          pontos += 45 + prefixoComum(k, alvoRef);
          porque.push('mesma família de referência');
        }
      }

      // ---- custo -----------------------------------------------------------
      if (alvoCusto && ip.custoUnitario) {
        const dif = Math.abs(alvoCusto - ip.custoUnitario) / ip.custoUnitario;
        if (dif <= 0.02)      { pontos += 30; porque.push('mesmo custo'); }
        else if (dif <= 0.12) { pontos += 15; porque.push('custo próximo'); }
      }

      // ---- quantidade ------------------------------------------------------
      // A quantidade pontua, mas NAO vira motivo visivel nem e devolvida:
      // dizer "mesma quantidade" na hora de identificar entrega o numero que
      // a conferencia cega esconde na grade.
      const saldo = Math.max(0, (ip.quantidade || 0) - (ip.quantidadeAtendida || 0));
      if (item.quantidade && item.quantidade === saldo) pontos += 12;

      // ---- descricao -------------------------------------------------------
      let iguais = 0;
      for (const w of palavrasDe(ip.descricao)) if (alvoPalavras.has(w)) iguais++;
      if (iguais >= 2) { pontos += 6 * iguais; porque.push('descrição parecida'); }

      // ---- ja tomada por outro item da nota --------------------------------
      const tomadaPor = tomados.get(ip.codigoOrigem) || null;

      return {
        codigoProd: ip.codigoOrigem,
        descricao: ip.descricao,
        referencia: ip.referencia,
        // quantidade e saldo ficam de fora de proposito: conferencia cega
        custoUnitario: ip.custoUnitario,
        pontos,
        motivo: porque[0] || 'linha do pedido',
        tomadaPor,
      };
    });

    // Linha ja tomada por outro item da nota NAO e candidata: sai da lista.
    // Mostrar as nove linhas do pedido para escolher entre as duas que
    // sobraram e so ruido. Para desfazer uma ligacao errada, o caminho e o
    // lapis na coluna NOSSO CÓD. da outra linha.
    const ocultadas = linhas.filter(l => l.tomadaPor).length;
    const livres = linhas.filter(l => !l.tomadaPor);

    livres.sort((a, b) => b.pontos - a.pontos);

    res.json({
      ok: true,
      indice: idx,
      pedido: { numero: pedido.numero, itens: linhas.length },
      unitDaNota: item.valorUnitario || 0,
      custoRealDaNota: item.custoUnitarioReal || 0,
      ocultadas,
      linhas: livres,
      item: {
        descricaoXml: item.descricaoXml,
        codigoFornec: item.codigoFornec,
        ean: item.ean,
        quantidade: item.quantidade,
        custoUnitarioReal: item.custoUnitarioReal,
      },
    });
  } catch (err) {
    console.error('[compra/nota/sugestoes]', err);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/vincular-pedido   { pedidoId }
//
// Captura o pedido. Sem isto a conferencia nao comeca: nao existe nota fiscal
// sem pedido. pedidoId nulo desfaz o vinculo.
// ---------------------------------------------------------------------------
router.post('/:id/vincular-pedido', express.json(), async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharAberta(lojistaId, req.params.id);

    const pedidoId = req.body?.pedidoId || null;

    // ---- desfazer o vinculo -------------------------------------------------
    if (!pedidoId) {
      const jaContou = nota.itens.some(i => (i.quantidadeConferida || 0) > 0);
      if (jaContou) {
        return res.status(400).json({
          ok: false,
          erro: 'a contagem física já começou; não dá para trocar o pedido agora',
        });
      }
      nota.pedido = null;
      nota.tipoEntrada = '';
      nota.situacao = 'RECEBIDA';
      await nota.save();
      return res.json({ ok: true, pedido: null, situacao: nota.situacao });
    }

    if (!mongoose.Types.ObjectId.isValid(pedidoId)) {
      return res.status(400).json({ ok: false, erro: 'pedido invalido' });
    }

    const filtro = { _id: pedidoId, lojistaId };
    if (nota.fornecedor) filtro.fornecedor = nota.fornecedor;

    const pedido = await Pedido.findOne(filtro);
    if (!pedido) {
      return res.status(404).json({
        ok: false,
        erro: 'pedido não encontrado para este fornecedor',
      });
    }

    nota.pedido = pedido._id;
    if (nota.situacao === 'RECEBIDA') nota.situacao = 'VINCULADA';
    await nota.save();

    res.json({
      ok: true,
      situacao: nota.situacao,
      pedido: {
        _id: pedido._id,
        numero: pedido.numero,
        itens: (pedido.itens || []).length,
        valorTotal: pedido.valorTotal,
      },
    });
  } catch (err) {
    console.error('[compra/nota/vincular-pedido]', err);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// A conta do fornecedor, para o titulo no fluxo.
//
// A conta mora NO VINCULO da empresa, nunca em fornecs.ncontabil da raiz,
// que e resto de migracao e vem "0.00.000.000".
// ---------------------------------------------------------------------------
async function contaDoFornecedor(lojistaId, fornecedorId) {
  if (!fornecedorId) return { conta: '', razao: '' };

  const f = await col('fornecs').findOne({ _id: fornecedorId });
  if (!f) return { conta: '', razao: '' };

  const vinculo = (f.vinculos || []).find(v =>
    String(v.lojistaId) === String(lojistaId) && v.ativo !== false);

  return {
    conta: vinculo?.ncontabil || '',
    razao: f.razaoSocial || f.razao || f.nome || '',
  };
}

// ---------------------------------------------------------------------------
// GET /:id/conferir-efetivacao
//
// O que vai acontecer se efetivar. Nao grava nada: alimenta o modal.
// ---------------------------------------------------------------------------
router.get('/:id/conferir-efetivacao', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharAberta(lojistaId, req.params.id);

    const semProduto = [];
    const divergentes = [];
    let unidades = 0;

    for (const i of nota.itens) {
      if (!i.codigoProd) semProduto.push(i.descricaoXml);
      const conf = i.quantidadeConferida || 0;
      unidades += conf;
      if (conf !== i.quantidade) {
        divergentes.push({
          descricao: i.descricaoXml,
          naNota: i.quantidade,
          conferido: conf,
          diferenca: conf - i.quantidade,
        });
      }
    }

    // o que muda no custo de cada produto
    const custos = [];
    for (const i of nota.itens) {
      if (!i.codigoProd || !i.quantidadeConferida) continue;
      const p = await col('_produto_origem')
        .findOne({ lojistaId, codigoProd: i.codigoProd });
      if (!p) continue;

      const medioAntes = p.custoMedio != null ? p.custoMedio : (p.precoCusto || 0);
      const estoqueAntes = p.estoque || 0;

      custos.push({
        codigoProd: i.codigoProd,
        descricao: p.descricao,
        estoqueAntes,
        entra: i.quantidadeConferida,
        medioAntes,
        custoNota: i.custoUnitarioReal,
        medioDepois: novoMedio(estoqueAntes, medioAntes,
                               i.quantidadeConferida, i.custoUnitarioReal),
        variacao: medioAntes
          ? Math.round(((i.custoUnitarioReal - medioAntes) / medioAntes) * 1000) / 10
          : null,
      });
    }

    // o pedido
    let pedido = null;
    if (nota.pedido) {
      const p = await Pedido.findOne({ _id: nota.pedido, lojistaId });
      if (p) {
        const c = nota.compararComPedido(p);
        pedido = {
          numero: p.numero,
          tipo: c.tipo,
          temSaldo: c.temSaldo,
          linhasComFalta: c.linhas.filter(l => l.falta > 0).length,
        };
      }
    }

    res.json({
      ok: true,
      semPedido: !nota.pedido,
      numero: nota.numero,
      fornecedor: nota.emitente?.razao || '',
      unidades,
      itens: nota.itens.length,
      semProduto,
      divergentes,
      custos,
      pedido,
      duplicatas: (nota.duplicatas || []).map(d => ({
        numero: d.numero, vencimento: d.vencimento, valor: d.valor,
      })),
      conta: await contaDoFornecedor(lojistaId, nota.fornecedor),
      podeEfetivar: semProduto.length === 0 && !!nota.pedido,
    });
  } catch (err) {
    console.error('[compra/nota/conferir-efetivacao]', err);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

// media ponderada movel. Estoque zerado ou negativo: o medio vira o da nota,
// senao a conta produz numero sem sentido.
function novoMedio(estoqueAntes, medioAntes, entra, custoNota) {
  if (!entra) return medioAntes;
  if (estoqueAntes <= 0) return custoNota;
  return Math.round(
    ((estoqueAntes * medioAntes) + (entra * custoNota)) / (estoqueAntes + entra)
  );
}

// ---------------------------------------------------------------------------
// POST /:id/efetivar
//   { saldo: 'saldo' | 'prepedido' | 'nenhum', motivoDivergencia }
//
// O passo que mexe em tudo. Numa transacao so:
//   1. estoque sobe em _produto_origem (pela quantidade CONFERIDA)
//   2. custo medio movel e ultimo custo, em campos da PLATAFORMA
//   3. cada duplicata vira um titulo pos 2 no fluxo
//   4. a previsao pos 7 do pedido e baixada na proporcao entregue
//   5. o pedido vai para L ou S, e o saldo vira pedido novo ou pre-pedido
//   6. a nota vira EFETIVADA
//
// Divergencia com a nota (contou menos do que ela diz) exige motivo escrito.
// ---------------------------------------------------------------------------
router.post('/:id/efetivar', express.json(), async (req, res) => {
  const sessao = await mongoose.startSession();

  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharAberta(lojistaId, req.params.id);

    const escolhaSaldo = ['saldo', 'prepedido', 'nenhum']
      .includes(req.body?.saldo) ? req.body.saldo : 'saldo';
    const motivoDivergencia = String(req.body?.motivoDivergencia || '').trim();

    // ---- portas ------------------------------------------------------------
    // Nao existe nota fiscal sem pedido: o que chegou foi comprado.
    if (!nota.pedido) {
      return res.status(400).json({
        ok: false,
        semPedido: true,
        erro: 'vincule o pedido antes de efetivar a entrada',
      });
    }

    const semProduto = nota.itens.filter(i => !i.codigoProd);
    if (semProduto.length) {
      return res.status(400).json({
        ok: false,
        erro: semProduto.length + ' item(ns) sem produto identificado',
      });
    }

    const divergentes = nota.itens.filter(i =>
      (i.quantidadeConferida || 0) !== i.quantidade);

    if (divergentes.length && !motivoDivergencia) {
      return res.status(400).json({
        ok: false,
        precisaMotivo: true,
        erro: 'a conferência não fecha com a nota',
        divergentes: divergentes.map(i => ({
          descricao: i.descricaoXml,
          naNota: i.quantidade,
          conferido: i.quantidadeConferida || 0,
        })),
      });
    }

    if (!nota.itens.some(i => (i.quantidadeConferida || 0) > 0)) {
      return res.status(400).json({ ok: false, erro: 'nenhuma unidade conferida' });
    }

    const resultado = {};

    await sessao.withTransaction(async () => {

      // ---- 1 e 2: estoque e custo -----------------------------------------
      const produtos = [];

      for (const item of nota.itens) {
        const entra = item.quantidadeConferida || 0;
        if (!entra) continue;

        const p = await col('_produto_origem').findOne(
          { lojistaId, codigoProd: item.codigoProd }, { session: sessao });
        if (!p) continue;

        const estoqueAntes = p.estoque || 0;
        const medioAntes = p.custoMedio != null ? p.custoMedio : (p.precoCusto || 0);
        const medio = novoMedio(estoqueAntes, medioAntes, entra, item.custoUnitarioReal);

        await col('_produto_origem').updateOne(
          { lojistaId, codigoProd: item.codigoProd },
          {
            $inc: { estoque: entra },
            // campos da PLATAFORMA: o COMPRA-5 nao os sobrescreve, ao
            // contrario de precoCusto e precoMedio, que sao espelho do Access
            $set: {
              custoMedio: medio,
              custoUltimo: item.custoUnitarioReal,
              custoUltimaNota: nota.numero || '',
              custoAtualizadoEm: new Date(),
            },
          },
          { session: sessao },
        );

        produtos.push({
          codigoProd: item.codigoProd,
          descricao: p.descricao,
          entrou: entra,
          estoqueDepois: estoqueAntes + entra,
          medioAntes, medioDepois: medio,
          custoNota: item.custoUnitarioReal,
        });
      }

      resultado.produtos = produtos;

      // ---- 3: duplicatas viram titulos pos 2 -------------------------------
      const { conta, razao } = await contaDoFornecedor(lojistaId, nota.fornecedor);
      const dups = nota.duplicatas || [];
      const historico = 'NF ' + (nota.numero || '') + ' ' + (razao || nota.emitente?.razao || '');

      const linhas = dups.map((d, i) => {
        const venc = d.vencimento || new Date();
        return {
          lojistaId,
          ano: venc.getUTCFullYear(),
          mes: venc.getUTCMonth() + 1,
          pos: 2,                                  // obrigacao a pagar
          codigoConta: conta,
          nomeConta: razao || nota.emitente?.razao || '',
          historico: historico.trim(),
          // o fluxo guarda REAIS e POSITIVO; o sinal e a cor sao da tela
          valor: Math.round(d.valor || 0) / 100,
          vencimento: venc,
          parcela: i + 1,
          totalParcelas: dups.length,
          origem: 'ENTRADA_NOTA',
          documento: String(nota.numero || ''),
          lancamentoId: nota._id,
          status: 'ATIVO',
        };
      });

      const gravadas = linhas.length
        ? await FluxoProjetado.insertMany(linhas, { session: sessao })
        : [];

      resultado.titulos = gravadas.length;
      resultado.valorTitulos = linhas.reduce((s, l) => s + l.valor, 0);

      // ---- 4 e 5: o pedido --------------------------------------------------
      resultado.pedido = null;

      if (nota.pedido) {
        const pedido = await Pedido.findOne({ _id: nota.pedido, lojistaId })
          .session(sessao);

        if (pedido) {
          // o que chegou, por codigo do produto
          const chegou = new Map();
          for (const i of nota.itens) {
            if (!i.codigoProd) continue;
            chegou.set(i.codigoProd,
              (chegou.get(i.codigoProd) || 0) + (i.quantidadeConferida || 0));
          }

          for (const ip of pedido.itens) {
            const q = chegou.get(ip.codigoOrigem) || 0;
            if (q) {
              ip.quantidadeAtendida = Math.min(
                ip.quantidade, (ip.quantidadeAtendida || 0) + q);
            }
          }

          pedido.dataEntregaReal = new Date();
          const fracao = pedido.percentualAtendido;   // 0 a 1, por valor
          const temSaldo = pedido.temSaldo;

          // a previsao pos 7 que ainda esta de pe
          const pos7 = await FluxoProjetado.find({
            _id: { $in: pedido.lancamentosFluxo || [] },
            pos: 7,
            status: 'ATIVO',
          }).session(sessao);

          if (!temSaldo || escolhaSaldo !== 'saldo') {
            // nada mais vem por este pedido: a previsao sai do fluxo
            for (const l of pos7) {
              l.status = temSaldo ? 'CANCELADO' : 'REALIZADA';
              l.realizadaEm = new Date();
              await l.save({ session: sessao });
            }
          } else {
            // parcial com saldo em aberto: a previsao encolhe na proporcao
            // entregue e continua de pe pelo que falta
            const resto = Math.max(0, 1 - fracao);
            for (const l of pos7) {
              const novo = Math.round(l.valor * resto * 100) / 100;
              if (novo <= 0) {
                l.status = 'REALIZADA';
                l.realizadaEm = new Date();
              } else {
                l.valor = novo;
                l.historico = (l.historico || '') + ' (saldo)';
              }
              await l.save({ session: sessao });
            }
          }

          // a situacao e o destino do que faltou
          if (!temSaldo) {
            pedido.situacao = 'L';
          } else if (escolhaSaldo === 'saldo') {
            const molde = pedido.montarPedidoSaldo();
            if (molde) {
              const novo = await Pedido.create([molde], { session: sessao });
              pedido.pedidoSaldo = novo[0]._id;
              pedido.situacao = 'S';
              nota.pedidoSaldoGerado = novo[0]._id;
              resultado.pedidoSaldo = { id: novo[0]._id, itens: molde.itens.length };
            } else {
              pedido.situacao = 'L';
            }
          } else if (escolhaSaldo === 'prepedido') {
            const molde = pedido.montarPedidoSaldo();
            if (molde) {
              molde.situacao = 'PP';
              molde.numero = undefined;           // pre-pedido nasce sem numero
              const novo = await Pedido.create([molde], { session: sessao });
              pedido.pedidoSaldo = novo[0]._id;
              nota.pedidoSaldoGerado = novo[0]._id;
              resultado.prePedido = { id: novo[0]._id, itens: molde.itens.length };
            }
            pedido.situacao = 'L';
          } else {
            pedido.situacao = 'L';
          }

          await pedido.save({ session: sessao });

          nota.tipoEntrada = temSaldo ? 'PARCIAL' : 'TOTAL';
          resultado.pedido = {
            numero: pedido.numero,
            situacao: pedido.situacao,
            percentualAtendido: Math.round(fracao * 1000) / 10,
          };
        }
      } else {
        nota.tipoEntrada = 'SEM_PEDIDO';
      }

      // ---- 6: a nota --------------------------------------------------------
      nota.situacao = 'EFETIVADA';
      nota.estoqueAplicado = true;
      nota.efetivadaEm = new Date();
      nota.lancamentosFluxo = gravadas.map(l => l._id);

      if (divergentes.length) {
        nota.observacao = (nota.observacao ? nota.observacao + ' | ' : '')
          + 'Divergência na conferência: ' + motivoDivergencia;
      }

      await nota.save({ session: sessao });
    });

    res.json({ ok: true, situacao: 'EFETIVADA', ...resultado });

  } catch (err) {
    console.error('[compra/nota/efetivar]', err);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  } finally {
    await sessao.endSession();
  }
});

// ---------------------------------------------------------------------------
// POST /:id/recusar   { motivo }
//
// Nota que nao e nossa, ou veio errada. Nada de estoque, nada de fluxo:
// so fecha o documento com o motivo escrito.
// ---------------------------------------------------------------------------
router.post('/:id/recusar', express.json(), async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharAberta(lojistaId, req.params.id);

    const motivo = String(req.body?.motivo || '').trim();
    if (motivo.length < 3) {
      return res.status(400).json({ ok: false, erro: 'escreva o motivo da recusa' });
    }

    nota.situacao = 'RECUSADA';
    nota.recusadaMotivo = motivo;
    await nota.save();

    res.json({ ok: true, situacao: 'RECUSADA', motivo });
  } catch (err) {
    console.error('[compra/nota/recusar]', err);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /:id   (por ultimo: nao pode capturar /resumo, /lista, /importar, /produtos)
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, erro: 'id invalido' });
    }

    const nota = await NotaEntrada.findOne({ _id: req.params.id, lojistaId });
    if (!nota) return res.status(404).json({ ok: false, erro: 'nota nao encontrada' });

    // o nosso produto, com o custo que ele tem HOJE: e contra esse numero
    // que o custo da nota e julgado
    const codigos = nota.itens.map(i => i.codigoProd).filter(Boolean);
    const produtos = codigos.length
      ? await col('_produto_origem')
          .find({ lojistaId, codigoProd: { $in: codigos } })
          .project({ codigoProd: 1, descricao: 1, referencia: 1, estoque: 1,
                     custoUltimo: 1, custoMedio: 1, precoCusto: 1,
                     descricaoFab: 1, refFab: 1 })
          .toArray()
      : [];
    const porCodigo = {};
    for (const p of produtos) {
      porCodigo[p.codigoProd] = {
        ...p,
        // o custo de referencia: o ultimo que a plataforma gravou; se ainda
        // nao houver, o medio; se nem esse, o PCusto que veio do Access
        custoAnterior: p.custoUltimo != null ? p.custoUltimo
                     : (p.custoMedio != null ? p.custoMedio : (p.precoCusto || 0)),
      };
    }

    const pendentes = nota.fornecedor
      ? await Pedido.find({ lojistaId, fornecedor: nota.fornecedor, situacao: 'P' })
          .select('numero dataEmissao dataEntregaPrevista valorTotal itens')
          .sort({ dataEmissao: -1 })
          .lean()
      : [];

    let comparacao = null;
    let pedidoItens = {};
    if (nota.pedido) {
      const pedido = await Pedido.findOne({ _id: nota.pedido, lojistaId });
      if (pedido) {
        comparacao = nota.compararComPedido(pedido);
        // o que foi pedido de cada produto, para a coluna PEDIDO da grade
        for (const ip of pedido.itens || []) {
          if (ip.codigoOrigem == null) continue;
          pedidoItens[ip.codigoOrigem] = {
            quantidade: ip.quantidade,
            atendida: ip.quantidadeAtendida || 0,
            custoUnitario: ip.custoUnitario,
          };
        }
      }
    }

    res.json({
      ok: true,
      nota: nota.toJSON(),
      produtos: porCodigo,
      pedidoItens,
      pedidosPendentes: pendentes.map(p => ({
        _id: p._id,
        numero: p.numero,
        dataEmissao: p.dataEmissao,
        dataEntregaPrevista: p.dataEntregaPrevista,
        valorTotal: p.valorTotal,
        itens: (p.itens || []).length,
      })),
      comparacao,
    });
  } catch (err) {
    console.error('[compra/nota/:id]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;