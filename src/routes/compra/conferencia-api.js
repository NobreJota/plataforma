// =============================================================================
// Destino: C:\plataformaRota\src\routes\compra\conferencia-api.js
// Criado em: 26/09/2026
//
// CONFERENCIA FISICA da mercadoria.
//
// Outra pagina, outro operador, outras regras. O conferente ve UM item por
// vez: descricao e codigo de barras, nada mais. Passa o leitor, e so entao
// a tela pede quantas unidades ele contou.
//
// A quantidade da nota NUNCA e enviada para o navegador antes da contagem.
// Nao e capricho: quem ve o numero esperado digita o numero esperado, e a
// conferencia deixa de conferir — vira assinatura.
//
// Tres contagens erradas no mesmo item travam a NOTA INTEIRA. Destravar e do
// gerente, em Compra -> Entrada de mercadoria -> Desbloqueio da nota.
//
// Montado em /compra/api/conferencia  (ver pages.js)
//
// A contagem grava no servidor a cada item, de proposito:
//   - guardar no navegador quebraria a trava das tres tentativas (F5 zeraria)
//   - e a conferencia cega (a quantidade teria que ir junto para comparar la)
//   - e perderia o trabalho: conferente atende telefone e some vinte minutos
//
// DUAS rotas, nao tres. A conferencia do codigo de barras e feita na tela,
// que ja tem o codigo do item da vez — o servidor confere de novo junto com
// a quantidade. Com o banco na nuvem, cada ida custa uns 300 ms.
//
// A lista devolve os itens TODOS, na ordem da nota — mas a quantidade so
// acompanha o que ja foi contado. Do que falta vai o nome e mais nada.
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');

const NotaEntrada = require('../../models/compra/notaEntrada');
const Pedido      = require('../../models/compra/pedido');

const router = express.Router();

const MAX_TENTATIVAS = 3;

function col(nome) {
  return mongoose.connection.collection(nome);
}

function soDigitos(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

function chaveRef(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// A nota, com as portas de entrada fechadas.
// ---------------------------------------------------------------------------
async function acharParaContar(lojistaId, id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const e = new Error('nota invalida'); e.status = 400; throw e;
  }

  // -xmlBruto: o XML da NF-e pesa dezenas de kB e nao serve para nada aqui.
  // Trazer ele a cada contagem era o grosso do tempo de cada ida ao banco.
  const nota = await NotaEntrada.findOne({ _id: id, lojistaId }).select('-xmlBruto');
  if (!nota) { const e = new Error('nota nao encontrada'); e.status = 404; throw e; }

  if (nota.situacao === 'EFETIVADA' || nota.situacao === 'RECUSADA') {
    const e = new Error('nota ' + nota.situacao.toLowerCase()); e.status = 409; throw e;
  }
  if (!nota.pedido) {
    const e = new Error('nota sem pedido vinculado'); e.status = 409; throw e;
  }
  if (nota.itens.some(i => !i.codigoProd)) {
    const e = new Error('ha item sem o nosso codigo'); e.status = 409; throw e;
  }

  return nota;
}

// o item da vez: o primeiro que ainda nao fechou, na ordem da nota
function itemDaVez(nota) {
  const idx = nota.itens.findIndex(i =>
    (i.quantidadeConferida || 0) < i.quantidade);
  return idx < 0 ? null : idx;
}

// O que o conferente pode ver do item: o que ajuda a ACHAR a caixa.
// A quantidade fica de fora, sempre.
function itemVisivel(nota, idx, produto) {
  const i = nota.itens[idx];
  return {
    indice: idx,
    numeroItem: i.numeroItem,
    descricaoXml: i.descricaoXml,
    descricaoNossa: produto ? produto.descricao : '',
    referencia: produto ? produto.referencia : '',
    codigoFornec: i.codigoFornec,
    codigoProd: i.codigoProd,
    ean: i.ean,
    unidade: i.unidade,
    tentativas: (i.tentativas || []).length,
    maxTentativas: MAX_TENTATIVAS,
    jaContado: i.quantidadeConferida || 0,
  };
}

async function produtoDe(lojistaId, codigoProd) {
  if (!codigoProd) return null;
  return col('_produto_origem').findOne({ lojistaId, codigoProd });
}

// ---------------------------------------------------------------------------
// O estado inteiro da contagem, numa funcao so.
//
// O GET usa e o POST /contar tambem devolve: assim a tela nao precisa de uma
// segunda viagem ao banco depois de cada item. Com o banco na nuvem, cada
// ida custa uns 300 ms — tres por caixa era quase um segundo de espera.
// ---------------------------------------------------------------------------
async function estadoDaNota(lojistaId, nota) {
  const pedido = await Pedido.findOne({ _id: nota.pedido, lojistaId })
    .select('numero dataEmissao').lean();

  const codigos = nota.itens.map(i => i.codigoProd).filter(Boolean);
  const produtos = codigos.length
    ? await col('_produto_origem')
        .find({ lojistaId, codigoProd: { $in: codigos } })
        .project({ codigoProd: 1, descricao: 1, referencia: 1 }).toArray()
    : [];
  const porCodigo = new Map(produtos.map(p => [p.codigoProd, p]));

  const idx = itemDaVez(nota);
  const feitos = nota.itens.filter(i =>
    (i.quantidadeConferida || 0) >= i.quantidade).length;

  // Os itens TODOS, na ordem da nota. Do que ainda nao fechou vai o nome, o
  // codigo de barras e mais nada: a quantidade da nota fica do lado de ca.
  const lista = nota.itens.map((i, n) => {
    const fechou = (i.quantidadeConferida || 0) >= i.quantidade;
    return {
      indice: n,
      numeroItem: i.numeroItem,
      codigoProd: i.codigoProd,
      descricao: porCodigo.get(i.codigoProd)?.descricao || i.descricaoXml,
      descricaoXml: i.descricaoXml,
      ean: i.ean,
      codigoFornec: i.codigoFornec,
      conferido: fechou,
      atual: n === idx,
      quantidade: fechou ? i.quantidadeConferida : null,
      tentativas: (i.tentativas || []).length,
    };
  });

  return {
    bloqueada: !!nota.bloqueada,
    bloqueadaMotivo: nota.bloqueadaMotivo || '',
    nota: {
      numero: nota.numero,
      serie: nota.serie,
      fornecedor: nota.emitente?.razao || '',
      cnpj: nota.emitente?.cnpj || '',
      dataEntrada: nota.dataEntrada,
    },
    pedido: pedido ? { numero: pedido.numero, dataEmissao: pedido.dataEmissao } : null,
    total: nota.itens.length,
    feitos,
    atual: idx == null ? null
      : itemVisivel(nota, idx, porCodigo.get(nota.itens[idx].codigoProd)),
    itens: lista,
    terminou: idx == null,
  };
}

// ---------------------------------------------------------------------------
// GET /:id      o estado da contagem
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharParaContar(lojistaId, req.params.id);
    res.json({ ok: true, ...await estadoDaNota(lojistaId, nota) });
  } catch (err) {
    console.error('[compra/conferencia]', err.message);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/contar   { quantidade }
//
// Aqui mora a regra. A quantidade contada e comparada com a da nota, que o
// navegador nunca viu. Acertou, o item fecha e o proximo aparece. Errou, e
// so na terceira vez que a nota trava.
// ---------------------------------------------------------------------------
router.post('/:id/contar', express.json(), async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const nota = await acharParaContar(lojistaId, req.params.id);

    if (nota.bloqueada) {
      return res.status(423).json({ ok: false, bloqueada: true,
        erro: 'nota travada; chame o gerente' });
    }

    const idx = itemDaVez(nota);
    if (idx == null) return res.json({ ok: true, terminou: true });

    const item = nota.itens[idx];
    const contada = Number(req.body?.quantidade);

    if (!Number.isFinite(contada) || contada < 0) {
      return res.status(400).json({ ok: false, erro: 'quantidade inválida' });
    }

    // A tela compara o codigo lido com o item da vez, para nao gastar uma ida
    // ao banco so para isso. Mas quem decide continua sendo o servidor: se o
    // codigo veio, ele tem que bater com o item da vez.
    const lido = String(req.body?.codigo || '').trim();
    if (lido) {
      const digitos = soDigitos(lido);
      const chave = chaveRef(lido);
      const bate = (item.ean && soDigitos(item.ean) === digitos)
                || (item.eanTributavel && soDigitos(item.eanTributavel) === digitos)
                || (item.codigoFornec && chaveRef(item.codigoFornec) === chave)
                || (item.codigoProd && String(item.codigoProd) === digitos);

      if (!bate) {
        return res.status(409).json({
          ok: false,
          erro: 'o código lido não é o do item da vez',
        });
      }
    }

    item.tentativas = item.tentativas || [];
    item.tentativas.push({ quantidade: contada, em: new Date() });

    // ---- acertou ------------------------------------------------------------
    if (contada === item.quantidade) {
      item.quantidadeConferida = contada;
      item.conferidoEm = new Date();
      if (nota.situacao === 'VINCULADA' || nota.situacao === 'RECEBIDA') {
        nota.situacao = 'EM_CONFERENCIA';
      }
      await nota.save();

      const produto = await produtoDe(lojistaId, item.codigoProd);

      // o estado inteiro vai junto: a tela nao precisa pedir de novo
      return res.json({
        ok: true,
        confere: true,
        confirmado: {
          codigoProd: item.codigoProd,
          descricao: produto ? produto.descricao : item.descricaoXml,
          quantidade: contada,
        },
        ...await estadoDaNota(lojistaId, nota),
      });
    }

    // ---- errou --------------------------------------------------------------
    const usadas = item.tentativas.length;
    const restam = MAX_TENTATIVAS - usadas;

    if (restam <= 0) {
      nota.bloqueada = true;
      nota.bloqueadaEm = new Date();
      nota.bloqueadaItem = idx;
      nota.bloqueadaMotivo = 'Três contagens divergentes em "'
        + (item.descricaoXml || '') + '": '
        + item.tentativas.map(t => t.quantidade).join(', ');
      await nota.save();

      return res.status(423).json({
        ok: false,
        bloqueada: true,
        erro: 'Contagem divergente três vezes. A nota foi travada.',
        contagens: item.tentativas.map(t => t.quantidade),
      });
    }

    await nota.save();

    res.json({
      ok: true,
      confere: false,
      tentativas: usadas,
      restam,
      ultima: restam === 1,
    });
  } catch (err) {
    console.error('[compra/conferencia/contar]', err.message);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
