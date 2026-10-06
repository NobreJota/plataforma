// =============================================================================
// Destino: C:\plataformaRota\src\routes\compra\pedido-api.js
// Alterado em: 24/09/2026  (combo filtra por cadastro vigente, via mapa de contas)
// Alterado em: 30/09/2026  (sem de/para: a ponte NrFornec -> fornecedor e _fornec_access)
// Alterado em: 01/10/2026  (GET /fornecedores devolve a MARCA; o combo mostra so ela)
// Alterado em: 03/10/2026  (fornecedor pela MARCA tambem em /pendentes e no historico
//                           do fluxo: "Pedido 12 Westaflex"; textos sem "de/para")
// Alterado em: 03/10/2026  (GET /detalhe/:id — espelho do pedido para o modal da tela
//                           de pendentes: cabecalho, itens, parcelas do fluxo, nota)
// Alterado em: 03/10/2026  (POST /entrega/:id — nova previsao de entrega; as parcelas
//                           do pedido no fluxo andam a mesma diferenca de dias)
//
// APIs da tela de pedido de compra.
//
//   GET  /compra/api/pedido/fornecedores
//   GET  /compra/api/pedido/grade?nrFornec=67&janela=30
//   GET  /compra/api/pedido/cabecalho?nrFornec=67
//   POST /compra/api/pedido/gravar
//   GET  /compra/api/pedido/pendentes
//   GET  /compra/api/pedido/detalhe/:id
//   POST /compra/api/pedido/entrega/:id   { data: 'AAAA-MM-DD' }
//
// Sugestao = max(0, saida no periodo - estoque - a caminho)
//
// A CORRENTE que liga produto -> fornecedor vigente (desde 30/09/2026):
//   _produto_origem.nrFornec  (ex.: 67)
//     -> _fornec_access.nrFornec -> fornecId   (ou contaNova 2.01.001.xxx)
//       -> fornecs, com vinculos[].ncontabil desta empresa
//
// Atencao: fornecs.ncontabil na RAIZ e resto de migracao e pode vir
// "0.00.000.000". A conta valida e a do vinculo da empresa.
//
// A coluna NrFornec de Vendas_SaídaCupomItens esta corrompida em 59% das
// linhas. O fornecedor sai sempre de _produto_origem, nunca da venda.
//
// Ao gravar: pedido em _compra_pedidos (situacao P) + um lancamento por
// titulo em _fluxo_projetado com pos 7 e valor NEGATIVO.
//
// Dicionario do pos no fluxo:
//   3 = compra programada (sugerida, ainda nao pedida)
//   7 = pedido emitido, aguardando mercadoria   <-- este
//   8 = orcamento anual (despesa administrativa)
//   2 = obrigacao a pagar (nasce quando a nota entra)
//
// Protegido por ensureContab no server.js, que expoe req.lojistaId.
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Pedido = require('../../models/compra/pedido');
const FluxoProjetado = require('../../models/contab/financeiro/fluxoProjetado');

const JANELAS = [15, 30, 60, 90];
const DIA = 86400000;
const POS_PEDIDO = 7;

function col(nome) {
  return mongoose.connection.collection(nome);
}

function soDigitos(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

// o Access usa "0" como vazio; a plataforma tem "0.00.000.000" como conta vazia
function limpo(v) {
  const s = String(v ?? '').trim();
  if (s === '0' || s === '0000') return '';
  if (/^0[.0]*$/.test(s.replace(/\./g, '0'))) return '';   // 0.00.000.000
  return s;
}

function contaValida(v) {
  const s = limpo(v);
  return /^\d+(\.\d+)+$/.test(s) ? s : '';
}

function primeiro(obj, ...nomes) {
  if (!obj) return '';
  for (const n of nomes) {
    const v = limpo(obj[n]);
    if (v) return v;
  }
  return '';
}

// a conta do fornecedor mora no vinculo da empresa, nao na raiz
function contaDoVinculo(fornec, lojistaId) {
  const vinculos = fornec?.vinculos || [];
  const v = vinculos.find(x =>
    String(x.lojistaId) === String(lojistaId) && x.ativo !== false);
  return contaValida(v?.ncontabil);
}

// =========================================================================
// O mapa: NrFornec do Access -> fornecedor vigente em fornecs
// Monta uma vez e serve as tres rotas.
//
// 30/09/2026: sem de/para. A ponte e _fornec_access (COMPRA-10/14):
//   nrFornec -> fornecId (quem ja entrou no cadastro)
//            -> ou, na falta, a conta 2.01.001.xxx do vinculo
// Fornecedor ainda "ajustar" (sem cadastro) fica fora ate ser completado.
// =========================================================================
async function montarMapaFornecedores(lojistaId) {
  const acesso = await col('_fornec_access').find({ lojistaId }).toArray();

  const fornecedores = await col('fornecs').find({ 'vinculos.lojistaId': lojistaId }).toArray();
  const porId = new Map();
  const porConta = new Map();
  for (const f of fornecedores) {
    const conta = contaDoVinculo(f, lojistaId);
    if (!conta) continue;                      // vinculo inativo ou sem conta
    porId.set(String(f._id), f);
    porConta.set(conta, f);
  }

  const mapa = new Map();             // nrFornec -> { fornec, razao, conta }
  for (const a of acesso) {
    const nr = Number(a.nrFornec);
    if (!nr) continue;
    const fornec = (a.fornecId && porId.get(String(a.fornecId)))
      || porConta.get(contaValida(a.contaNova));
    if (!fornec) continue;

    mapa.set(nr, {
      fornec,
      razao: limpo(fornec.razao) || limpo(a.razao) || ('Fornecedor ' + nr),
      marca: limpo(fornec.marca) || limpo(a.marca) || limpo(fornec.razao) || limpo(a.razao),
      conta: contaDoVinculo(fornec, lojistaId),
      contaAntiga: contaValida(a.ncontabilAntigo),
      razaoAntiga: limpo(a.razao),
    });
  }

  return mapa;
}

// ---------------------------------------------------------------------------
// GET /fornecedores
// So entram os que chegam a um cadastro vigente. Varios NrFornec podem
// cair no mesmo fornecedor (Asia Import e Komlog sao a mesma empresa):
// nesse caso viram UMA linha, somando os produtos.
// ---------------------------------------------------------------------------
router.get('/fornecedores', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const ano = new Date().getUTCFullYear();

    const mapa = await montarMapaFornecedores(lojistaId);

    const grupos = await col('_venda_item_origem').aggregate([
      { $match: { lojistaId, ano, devolucao: { $ne: true }, codigoProd: { $gt: 0 } } },
      { $group: { _id: '$codigoProd', unidades: { $sum: '$quantidade' },
                  linhas: { $sum: 1 }, ultimaVenda: { $max: '$data' } } },
      {
        $lookup: {
          from: '_produto_origem',
          let: { cod: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [
              { $eq: ['$lojistaId', lojistaId] },
              { $eq: ['$codigoProd', '$$cod'] },
            ] } } },
            { $project: { nrFornec: 1 } },
          ],
          as: 'prod',
        },
      },
      { $unwind: '$prod' },
      { $match: { 'prod.nrFornec': { $gt: 0 } } },
      {
        $group: {
          _id: '$prod.nrFornec',
          produtos: { $sum: 1 },
          linhas: { $sum: '$linhas' },
          unidades: { $sum: '$unidades' },
          ultimaVenda: { $max: '$ultimaVenda' },
        },
      },
    ]).toArray();

    // agrupa por fornecedor vigente
    const porFornec = new Map();
    let semCadastro = 0;

    for (const g of grupos) {
      const alvo = mapa.get(g._id);
      if (!alvo) { semCadastro++; continue; }

      const chave = String(alvo.fornec._id);
      if (!porFornec.has(chave)) {
        porFornec.set(chave, {
          fornecId: chave,
          razao: alvo.razao,
          marca: alvo.marca || alvo.razao,
          conta: alvo.conta,
          nrFornec: g._id,          // o primeiro serve de referencia
          nrFornecTodos: [],
          produtos: 0, linhas: 0, unidades: 0, ultimaVenda: null,
        });
      }

      const f = porFornec.get(chave);
      f.nrFornecTodos.push(g._id);
      f.produtos += g.produtos;
      f.linhas += g.linhas;
      f.unidades += g.unidades;
      if (!f.ultimaVenda || g.ultimaVenda > f.ultimaVenda) f.ultimaVenda = g.ultimaVenda;
    }

    const lista = [...porFornec.values()]
      .sort((a, b) => a.marca.localeCompare(b.marca, 'pt-BR'));

    res.json({
      ok: true, ano,
      total: lista.length,
      semCadastro,                 // quantos ficaram de fora por falta de de/para
      fornecedores: lista,
    });
  } catch (err) {
    console.error('[compra/fornecedores]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// Todos os NrFornec do Access que apontam para o mesmo fornecedor vigente.
// ---------------------------------------------------------------------------
async function nrFornecIrmaos(lojistaId, nrFornec) {
  const mapa = await montarMapaFornecedores(lojistaId);
  const alvo = mapa.get(Number(nrFornec));
  if (!alvo) return { alvo: null, numeros: [Number(nrFornec)] };

  const id = String(alvo.fornec._id);
  const numeros = [];
  for (const [nr, v] of mapa) {
    if (String(v.fornec._id) === id) numeros.push(nr);
  }
  return { alvo, numeros };
}

// ---------------------------------------------------------------------------
// GET /grade
// ---------------------------------------------------------------------------
router.get('/grade', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const nrFornec = Number(req.query.nrFornec);
    if (!Number.isFinite(nrFornec) || nrFornec <= 0) {
      return res.status(400).json({ ok: false, erro: 'nrFornec invalido' });
    }

    const janela = Number(req.query.janela) || 30;
    if (!JANELAS.includes(janela)) {
      return res.status(400).json({ ok: false, erro: 'janela deve ser 15, 30, 60 ou 90' });
    }

    const fim = new Date();
    const inicio = new Date(fim.getTime() - janela * DIA);

    // o fornecedor pode ter varios numeros no Access
    const { alvo, numeros } = await nrFornecIrmaos(lojistaId, nrFornec);

    // produto desativado nunca entra: obsoleto, fora de linha
    const produtos = await col('_produto_origem')
      .find({ lojistaId, nrFornec: { $in: numeros }, ativo: true }).toArray();

    if (!produtos.length) {
      return res.json({ ok: true, nrFornec, janela, inicio, fim,
        razao: alvo?.razao || '', total: 0, comSugestao: 0, valorTotal: 0, itens: [] });
    }

    const codigos = produtos.map(p => p.codigoProd);

    const saidas = await col('_venda_item_origem').aggregate([
      { $match: { lojistaId, codigoProd: { $in: codigos },
                  data: { $gte: inicio, $lte: fim }, devolucao: { $ne: true } } },
      { $group: { _id: '$codigoProd', saida: { $sum: '$quantidade' },
                  ultimaVenda: { $max: '$data' } } },
    ]).toArray();

    const porSaida = new Map(saidas.map(s => [s._id, s]));

    const pendentes = await Pedido.aggregate([
      { $match: { lojistaId, situacao: 'P' } },
      { $unwind: '$itens' },
      { $match: { 'itens.codigoOrigem': { $in: codigos } } },
      { $group: { _id: '$itens.codigoOrigem',
                  aCaminho: { $sum: { $subtract:
                    ['$itens.quantidade', '$itens.quantidadeAtendida'] } } } },
    ]);

    const porPendente = new Map(pendentes.map(p => [p._id, p.aCaminho]));

    let valorTotal = 0, comSugestao = 0;

    const itens = produtos.map(p => {
      const s = porSaida.get(p.codigoProd);
      const saida = s ? Math.round(s.saida) : 0;
      const estoque = p.estoque || 0;
      const aCaminho = porPendente.get(p.codigoProd) || 0;
      const sugestao = Math.max(0, saida - estoque - aCaminho);

      if (sugestao > 0) comSugestao++;

      const custo = p.precoCusto || 0;
      const total = sugestao * custo;
      valorTotal += total;

      return {
        codigo: p.codigoProd,
        referencia: p.referencia || '',
        descricao: p.descricao || '',
        marca: p.marca || '',
        unidade: p.unidade || '',
        grupo: p.grupoNome || '',
        saida, estoque, aCaminho, sugestao,
        custoUnitario: custo,
        valorTotal: total,
        eMin: p.eMin || 0,
        eMax: p.eMax || 0,
        ultimaVenda: s ? s.ultimaVenda : null,
      };
    });

    itens.sort((a, b) =>
      b.sugestao - a.sugestao ||
      b.saida - a.saida ||
      a.descricao.localeCompare(b.descricao, 'pt-BR'));

    res.json({ ok: true, nrFornec, janela, inicio, fim,
      razao: alvo?.razao || '',
      total: itens.length, comSugestao, valorTotal, itens });
  } catch (err) {
    console.error('[compra/grade]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /cabecalho
// ---------------------------------------------------------------------------
router.get('/cabecalho', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const nrFornec = Number(req.query.nrFornec);
    if (!Number.isFinite(nrFornec) || nrFornec <= 0) {
      return res.status(400).json({ ok: false, erro: 'nrFornec invalido' });
    }

    const { alvo } = await nrFornecIrmaos(lojistaId, nrFornec);
    const fornec = alvo?.fornec || null;

    // dados do cadastro antigo servem de reserva para campos em branco
    const origem = await col('_fornec_origem')
      .findOne({ lojistaId, chave: 'F' + nrFornec });
    const d = origem?.dados || {};

    const end = fornec?.address || {};
    const ct = fornec?.contato || {};

    const ficha = {
      nrFornec,
      fornecId: fornec?._id || null,
      razao:      limpo(fornec?.razao) || limpo(d.razao) || '',
      marca:      limpo(fornec?.marca) || limpo(d.marca) || '',
      cnpj:       limpo(fornec?.cnpj) || limpo(d.cnpj) || '',
      inscricao:  limpo(fornec?.inscricao) || limpo(d.inscricao) || '',
      contaAntiga: alvo?.contaAntiga || contaValida(d.conta_antiga) || '',
      contaNova:  alvo?.conta || '',
      logradouro: primeiro(end, 'logradouro', 'endereco', 'rua', 'end') || limpo(d.logradouro),
      bairro:     primeiro(end, 'bairro') || limpo(d.bairro),
      cidade:     primeiro(end, 'cidade', 'municipio') || limpo(d.cidade),
      uf:         primeiro(end, 'uf', 'estado') || limpo(d.uf),
      cep:        primeiro(end, 'cep') || limpo(d.cep),
      contatoVendas: primeiro(ct, 'nome', 'contato', 'vendedor') || limpo(d.contato_vendas),
      foneVendas:    primeiro(ct, 'fone', 'telefone', 'celular')
                     || limpo(fornec?.telefone) || limpo(d.fone_vendas),
      contatoCobranca: limpo(d.contato_cobranca),
      foneCobranca:    limpo(d.fone_cobranca),
      email:      limpo(fornec?.email) || '',
    };

    const obrigatorios = ['razao', 'cnpj', 'logradouro', 'cidade', 'uf', 'foneVendas'];
    ficha.camposFaltando = obrigatorios.filter(c => !ficha[c]);

    const transportadoras = await col('_transportadora_origem')
      .find({ lojistaId, ativo: true })
      .project({ nrTransp: 1, razao: 1, cidade: 1, estado: 1, fones: 1, contato: 1 })
      .sort({ notasNoPeriodo: -1 })
      .toArray();

    const usadas = fornec
      ? await Pedido.aggregate([
          { $match: { lojistaId, fornecedor: fornec._id } },
          { $group: { _id: '$condicaoPagamento.texto', vezes: { $sum: 1 } } },
          { $sort: { vezes: -1 } },
          { $limit: 5 },
        ]).catch(() => [])
      : [];

    res.json({
      ok: true,
      temCadastroVigente: !!fornec,
      ficha,
      transportadoras,
      condicoesUsadas: usadas.filter(u => u._id).map(u => u._id),
      sugestoesPagamento: [
        '28 dias', '30/60/90 dias', '28/56 dias',
        '56/70/84 dias', '84/112 dias', '60 dias',
      ],
    });
  } catch (err) {
    console.error('[compra/cabecalho]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// Proximo numero por empresa. Pedidos da plataforma comecam do 1;
// os importados do Access mantem o numero de la.
// ---------------------------------------------------------------------------
async function proximoNumero(lojistaId) {
  const ultimo = await Pedido.findOne({ lojistaId, numero: { $ne: null } })
    .sort({ numero: -1 }).select('numero').lean();
  return (ultimo?.numero || 0) + 1;
}

// ---------------------------------------------------------------------------
// POST /gravar
// ---------------------------------------------------------------------------
router.post('/gravar', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const b = req.body || {};

    const nrFornec = Number(b.nrFornec);
    if (!Number.isFinite(nrFornec) || nrFornec <= 0) {
      return res.status(400).json({ ok: false, erro: 'fornecedor invalido' });
    }

    if (!Array.isArray(b.itens) || !b.itens.length) {
      return res.status(400).json({ ok: false, erro: 'pedido sem itens' });
    }

    if (!b.dataEntregaPrevista) {
      return res.status(400).json({ ok: false, erro: 'informe a data de entrega prevista' });
    }

    const entrega = new Date(b.dataEntregaPrevista + 'T00:00:00Z');
    if (isNaN(entrega)) {
      return res.status(400).json({ ok: false, erro: 'data de entrega invalida' });
    }

    if (!Array.isArray(b.titulos) || !b.titulos.length) {
      return res.status(400).json({ ok: false, erro: 'pedido sem titulos' });
    }

    // ---- fornecedor: sem cadastro vigente, nao emite ------------------------
    const { alvo } = await nrFornecIrmaos(lojistaId, nrFornec);
    if (!alvo) {
      return res.status(400).json({
        ok: false,
        semCadastro: true,
        erro: 'Este fornecedor está com o cadastro incompleto. '
            + 'Complete o cadastro em Fornecedores antes de emitir pedido para ele.',
      });
    }

    // ---- itens: o valor vem do servidor, nunca do navegador -----------------
    const codigos = b.itens.map(i => Number(i.codigo)).filter(Boolean);
    const produtos = await col('_produto_origem')
      .find({ lojistaId, codigoProd: { $in: codigos } }).toArray();
    const porCodigo = new Map(produtos.map(p => [p.codigoProd, p]));

    const itens = [];
    let valorTotal = 0;

    for (const i of b.itens) {
      const cod = Number(i.codigo);
      const p = porCodigo.get(cod);
      if (!p) continue;

      const qtd = Math.max(0, Math.floor(Number(i.quantidade) || 0));
      if (!qtd) continue;

      const custo = p.precoCusto || 0;
      valorTotal += qtd * custo;

      itens.push({
        codigoOrigem: cod,
        referencia: p.referencia || '',
        descricao: p.descricao || '',
        quantidade: qtd,
        quantidadeAtendida: 0,
        custoUnitario: custo,
        baseCalculo: {
          janelaDias: Number(b.janela) || null,
          saidaNoPeriodo: Number(i.saida) || 0,
          estoqueNaData: p.estoque || 0,
          aCaminhoNaData: Number(i.aCaminho) || 0,
          ajustadoAMao: Number(i.sugestao) !== qtd,
        },
      });
    }

    if (!itens.length) {
      return res.status(400).json({ ok: false, erro: 'nenhum item valido' });
    }

    // ---- titulos: precisam fechar com o total -------------------------------
    const titulos = b.titulos.map(t => ({
      dias: Math.max(0, Number(t.dias) || 0),
      valor: Math.max(0, Math.round(Number(t.valor) || 0)),
      vencimento: t.vencimento ? new Date(t.vencimento + 'T00:00:00Z') : null,
    }));

    const somaTitulos = titulos.reduce((s, t) => s + t.valor, 0);
    if (somaTitulos !== valorTotal) {
      return res.status(400).json({
        ok: false,
        erro: 'a soma dos titulos nao fecha com o total do pedido',
        somaTitulos, valorTotal,
      });
    }

    // ---- gravar o pedido ----------------------------------------------------
    const numero = await proximoNumero(lojistaId);

    const pedido = await Pedido.create({
      lojistaId,
      numero,
      situacao: 'P',
      fornecedor: alvo.fornec._id,
      nrFornecOrigem: nrFornec,
      dataEmissao: new Date(),
      dataEntregaPrevista: entrega,
      condicaoPagamento: {
        texto: String(b.condicaoPagamento?.texto || '').trim(),
        dias: titulos.map(t => t.dias),
      },
      representante: String(b.representante || '').trim(),
      itens,
      valorTotal,
      observacao: b.frete === 'FOB' ? 'Frete FOB' : 'Frete CIF',
    });

    // ---- lancar no fluxo projetado (pos 7, valor negativo) ------------------
    const linhas = titulos.map((t, i) => {
      const venc = t.vencimento || new Date(entrega.getTime() + t.dias * DIA);
      return {
        lojistaId,
        ano: venc.getUTCFullYear(),
        mes: venc.getUTCMonth() + 1,
        pos: POS_PEDIDO,
        codigoConta: alvo.conta,
        nomeConta: alvo.razao,
        historico: 'Pedido ' + numero + ' ' + (alvo.marca || alvo.razao),   // pela MARCA
       // o fluxo guarda REAIS e POSITIVO; o sinal e a cor sao da tela
        valor: Math.round(t.valor) / 100,
        vencimento: venc,
        parcela: i + 1,
        totalParcelas: titulos.length,
        origem: 'PEDIDO_COMPRA',
        lancamentoId: pedido._id,
        status: 'ATIVO',
      };
    });

    const gravadas = await FluxoProjetado.insertMany(linhas);

    pedido.lancamentosFluxo = gravadas.map(l => l._id);
    await pedido.save();

    res.json({
      ok: true,
      pedidoId: pedido._id,
      numero,
      situacao: 'P',
      fornecedor: alvo.marca || alvo.razao,
      itens: itens.length,
      valorTotal,
      titulos: titulos.length,
      lancamentosFluxo: gravadas.length,
      primeiroVencimento: linhas[0].vencimento,
    });

  } catch (err) {
    console.error('[compra/gravar]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /pendentes
//
// Os pedidos emitidos e ainda nao entregues. Inclui os importados do
// Access cujo fornecedor esta com cadastro incompleto: vem com
// `semCadastro` marcado e o nome guardado no pedido, para a tela mostrar em
// vermelho. Esconder seria esconder compromisso a pagar.
// O fornecedor aparece sempre pela MARCA.
// ---------------------------------------------------------------------------
router.get('/pendentes', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const pedidos = await Pedido.find({ lojistaId, situacao: 'P' })
      .populate('fornecedor', 'marca razaoSocial razao nome')
      .sort({ dataEntregaPrevista: 1, numero: 1 })
      .lean();

    // as notas ja ligadas a esses pedidos
    const ids = pedidos.map(p => p._id);
    const notas = ids.length
      ? await mongoose.connection.collection('_compra_notas_entrada')
          .find({ lojistaId, pedido: { $in: ids } })
          .project({ pedido: 1, numero: 1, situacao: 1 }).toArray()
      : [];
    const notaPorPedido = new Map();
    for (const n of notas) notaPorPedido.set(String(n.pedido), n);

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    res.json({
      ok: true,
      pedidos: pedidos.map(p => {
        const f = p.fornecedor;
        const itens = p.itens || [];
        const atendidos = itens.filter(i =>
          (i.quantidadeAtendida || 0) >= i.quantidade).length;
        const entrega = p.dataEntregaPrevista ? new Date(p.dataEntregaPrevista) : null;
        const nota = notaPorPedido.get(String(p._id)) || null;

        return {
          _id: p._id,
          numero: p.numero,
          dataEmissao: p.dataEmissao,
          dataEntregaPrevista: p.dataEntregaPrevista,
          atrasado: !!(entrega && entrega < hoje),
          fornecedor: f
            ? (f.marca || f.razaoSocial || f.razao || f.nome || "")     // pela MARCA
            : (p.fornecedorNome || ("NrFornec " + (p.nrFornecOrigem || "?"))),
          semCadastro: !f,
          nrFornecOrigem: p.nrFornecOrigem || null,
          condicao: p.condicaoPagamento?.texto || "",
          itens: itens.length,
          atendidos,
          valorTotal: p.valorTotal || 0,
          importado: /Importado do sistema antigo/.test(p.observacao || ""),
          nota: nota ? { numero: nota.numero, situacao: nota.situacao } : null,
        };
      }),
    });
  } catch (err) {
    console.error('[compra/pedido/pendentes]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /detalhe/:id   o espelho do pedido (modal da tela de pendentes)
// Itens e totais em CENTAVOS (como o pedido guarda); parcelas em REAIS
// (como o fluxo guarda). Fornecedor pela MARCA, com a razao ao lado.
// ---------------------------------------------------------------------------
router.get('/detalhe/:id', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, erro: 'id invalido' });
    }
    const p = await Pedido.findOne({ _id: req.params.id, lojistaId })
      .populate('fornecedor', 'marca razao razaoSocial nome cnpj')
      .lean();
    if (!p) return res.status(404).json({ ok: false, erro: 'pedido nao encontrado' });

    const parcelas = await col('_fluxo_projetado')
      .find({ lojistaId, lancamentoId: p._id })
      .project({ parcela: 1, totalParcelas: 1, vencimento: 1, valor: 1, codigoConta: 1, pos: 1, status: 1 })
      .sort({ vencimento: 1 }).toArray();

    const nota = await col('_compra_notas_entrada')
      .findOne({ lojistaId, pedido: p._id }, { projection: { numero: 1, situacao: 1 } });

    const f = p.fornecedor;
    const itens = (p.itens || []).map(i => ({
      codigo: i.codigoOrigem || null,
      referencia: i.referencia || '',
      descricao: i.descricao || '',
      quantidade: i.quantidade || 0,
      atendida: i.quantidadeAtendida || 0,
      custoUnitario: i.custoUnitario || 0,
      total: (i.quantidade || 0) * (i.custoUnitario || 0),
    }));

    res.json({
      ok: true,
      pedido: {
        _id: p._id,
        numero: p.numero,
        situacao: p.situacao,
        dataEmissao: p.dataEmissao,
        dataEntregaPrevista: p.dataEntregaPrevista,
        fornecedor: f ? (f.marca || f.razaoSocial || f.razao || f.nome || '') : (p.fornecedorNome || ''),
        razao: f ? (f.razaoSocial || f.razao || f.nome || '') : '',
        cnpj: f?.cnpj || '',
        semCadastro: !f,
        nrFornecOrigem: p.nrFornecOrigem || null,
        condicao: p.condicaoPagamento?.texto || '',
        representante: p.representante || '',
        observacao: p.observacao || '',
        importado: /Importado do sistema antigo/.test(p.observacao || ''),
        itens,
        valorTotal: p.valorTotal || itens.reduce((s, i) => s + i.total, 0),
        parcelas,
        nota: nota ? { numero: nota.numero, situacao: nota.situacao } : null,
      },
    });
  } catch (err) {
    console.error('[compra/pedido/detalhe]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /entrega/:id   { data: 'AAAA-MM-DD' }
// Muda a previsao de entrega de um pedido PENDENTE. Os vencimentos nascem
// da entrega (entrega + dias da condicao), entao cada parcela do pedido no
// fluxo anda a MESMA diferenca de dias — o valor de cada parcela nao muda.
// A troca fica registrada em alteracoesEntrega (de, para, em).
// ---------------------------------------------------------------------------
router.post('/entrega/:id', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, erro: 'id invalido' });
    }
    const txt = String(req.body?.data || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
      return res.status(400).json({ ok: false, erro: 'informe a nova data de entrega' });
    }
    const nova = new Date(txt + 'T00:00:00Z');
    if (isNaN(nova)) return res.status(400).json({ ok: false, erro: 'data invalida' });

    const _id = new mongoose.Types.ObjectId(req.params.id);
    const p = await col('_compra_pedidos').findOne({ _id, lojistaId });
    if (!p) return res.status(404).json({ ok: false, erro: 'pedido nao encontrado' });
    if (p.situacao !== 'P') {
      return res.status(409).json({ ok: false, erro: 'so pedido pendente pode mudar a entrega' });
    }
    if (!p.dataEntregaPrevista) {
      return res.status(409).json({ ok: false, erro: 'o pedido nao tem entrega prevista para comparar' });
    }

    const antiga = new Date(p.dataEntregaPrevista);
    const diferenca = Math.round((nova - antiga) / DIA) * DIA;   // dias inteiros
    if (!diferenca) return res.json({ ok: true, semMudanca: true, parcelas: 0 });

    const linhas = await col('_fluxo_projetado').find({ lojistaId, lancamentoId: _id }).toArray();
    const ops = linhas.filter(l => l.vencimento).map(l => {
      const venc = new Date(new Date(l.vencimento).getTime() + diferenca);
      return { updateOne: {
        filter: { _id: l._id, lojistaId },
        update: { $set: { vencimento: venc, ano: venc.getUTCFullYear(), mes: venc.getUTCMonth() + 1 } },
      } };
    });
    if (ops.length) await col('_fluxo_projetado').bulkWrite(ops);

    await col('_compra_pedidos').updateOne({ _id, lojistaId }, {
      $set: { dataEntregaPrevista: nova },
      $push: { alteracoesEntrega: { de: antiga, para: nova, em: new Date() } },
    });

    res.json({ ok: true, dias: diferenca / DIA, parcelas: ops.length });
  } catch (err) {
    console.error('[compra/pedido/entrega]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;