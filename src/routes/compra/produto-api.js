// =============================================================================
// Destino: C:\plataformaRota\src\routes\compra\produto-api.js
// Criado em: 27/09/2026
// Alterado em: 29/09/2026
//   - nome do fornecedor = MARCA de Compras_Fornecedores, lida de
//     _fornec_access (script COMPRA-10), sem o numero; o seletor so traz
//     fornecedor ativo; o mesmo mapa serve a lista e a ficha
//   - produtos com descricao iniciada por "Z_" (desativados no Access) nao vem
//   - grava nrFornec no arquivo_docs, alem do nome em `fornecedor`
//   - /origem devolve fornecedorConta (conta nova do fornecedor, de/para);
//     a ficha grava em `ncontabil`
//   - /origem: produtos ja transferidos (em arquivo_docs) vao para o fim
// Alterado em: 30/09/2026
//   - GET /relacao-fornecedores e GET /relacao: a Relacao de produtos
//     (le arquivo_docs, nao o espelho do Access)
//   - GET /item/:codigo: a pagina do produto (ficha + consumo por mes +
//     a caminho + custo medio/ultimo)
//   - GET /resumo/:codigo: o modal do pedido (resumo + notas de entrada,
//     _nfe_item_origem do COMPRA-17); o resumo virou funcao comum
// Alterado em: 01/10/2026 - notas de entrada: o periodo e o do COMPRA-17 (ano corrente)
// Alterado em: 01/10/2026 - /resumo devolve as notas em duvida DO FORNECEDOR do produto
// Alterado em: 01/10/2026 - GET /novo (proximo codigo + fornecedores) e /gravar com
//              ficha.novo: recusa codigo ja usado; grava fornecId; marca origemPlataforma
// Alterado em: 02/10/2026 - grava descricaoTecnica (descricao do fornecedor)
// Alterado em: 01/10/2026 - grava taxaprazo (taxa do preco a prazo; `taxa` e a do a vista)
//
// CADASTRO DE PRODUTOS, pela area de Compra.
//
// Nao mexe na importacao que existe em Empresa. Aqui o caminho e outro: o
// produto ja foi importado do Access para _produto_origem; esta tela pega a
// linha de la e completa o que falta para nascer em arquivo_docs.
//
// Montado em /compra/api/produto  (ver pages.js)
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

function col(nome) {
  return mongoose.connection.collection(nome);
}

// Produto com descricao iniciada por "Z_" esta desativado no Access.
const SEM_Z = { $not: /^z_/i };

// ---------------------------------------------------------------------------
// Mapa NrFornec -> { marca, razao }, a partir de _fornec_access: a copia dos
// fornecedores ATIVOS de Compras_Fornecedores (script COMPRA-10).
// ---------------------------------------------------------------------------
async function mapaFornecedores(lojistaId) {
  const lista = await col('_fornec_access')
    .find({ lojistaId, ativo: { $ne: false } })
    .project({ nrFornec: 1, marca: 1, razao: 1, contaNova: 1 }).toArray();

  if (!lista.length) {
    console.warn('[compra/produto] _fornec_access vazia: rode o COMPRA-10.');
  }

  const mapa = new Map();
  for (const f of lista) {
    mapa.set(Number(f.nrFornec), { marca: f.marca, razao: f.razao, contaNova: f.contaNova || '' });
  }
  return mapa;
}

// Nome para mostrar: marca; na falta, razao. O numero nunca aparece.
function nomeFornecedor(mapa, nr) {
  if (!nr) return '';
  const f = mapa.get(Number(nr));
  if (!f) return '(fornecedor inativo)';
  return f.marca || f.razao || '(sem nome)';
}

// ---------------------------------------------------------------------------
// GET /loja      os dados da empresa, que ja entram preenchidos na ficha
// ---------------------------------------------------------------------------
router.get('/loja', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const l = await col('lojistas').findOne({ _id: lojistaId });

    res.json({
      ok: true,
      loja: {
        loja_id: String(lojistaId),
        marcaloja: l?.marca || l?.nomeFantasia || l?.razaoSocial || '',
        cidade: l?.cidade || l?.endereco?.cidade || '',
        bairro: l?.bairro || l?.endereco?.bairro || '',
      },
    });
  } catch (err) {
    console.error('[compra/produto/loja]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /fornecedores
//
// Os fornecedores ATIVOS no Access que tem produto em _produto_origem (sem
// contar os "Z_"). O nome e a Marca; o numero vai so no value do <option>.
// ---------------------------------------------------------------------------
router.get('/fornecedores', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const grupos = await col('_produto_origem').aggregate([
      { $match: { lojistaId, descricao: SEM_Z } },
      { $group: {
          _id: '$nrFornec',
          produtos: { $sum: 1 },
          ativos: { $sum: { $cond: ['$ativo', 1, 0] } },
      } },
    ]).toArray();

    const mapa = await mapaFornecedores(lojistaId);

    const lista = grupos
      .filter(g => g._id && mapa.has(Number(g._id)))
      .map(g => ({
        nrFornec: g._id,
        nome: nomeFornecedor(mapa, g._id),
        produtos: g.produtos,
        ativos: g.ativos,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    res.json({ ok: true, fornecedores: lista, semFornecedor: grupos.find(g => !g._id)?.produtos || 0 });
  } catch (err) {
    console.error('[compra/produto/fornecedores]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /origem?nrFornec=67&busca=
//
// As linhas do produto importado do Access. `cadastrado` diz se aquele
// codigo ja existe em arquivo_docs desta loja.
// ---------------------------------------------------------------------------
router.get('/origem', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const filtro = { lojistaId, descricao: SEM_Z };
    const nr = Number(req.query.nrFornec);
    if (Number.isFinite(nr) && nr) filtro.nrFornec = nr;

    const busca = String(req.query.busca || '').trim();
    if (busca) {
      const rx = new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ descricao: rx }, { referencia: rx }, { marca: rx }];
      const n = Number(busca);
      if (Number.isInteger(n) && n > 0) filtro.$or.push({ codigoProd: n });
    }

    const produtos = await col('_produto_origem')
      .find(filtro).sort({ descricao: 1 }).limit(400).toArray();

    // quais desses ja estao em arquivo_docs
    const codigos = produtos.map(p => p.codigoProd);
    const jaTem = codigos.length
      ? await col('arquivo_docs')
          .find({ loja_id: lojistaId, codigo: { $in: codigos } })
          .project({ codigo: 1 }).toArray()
      : [];
    const cadastrados = new Set(jaTem.map(d => d.codigo));

    // o nome do fornecedor vai em cada produto: na busca sem fornecedor
    // escolhido, a lista mistura varios
    const mapa = await mapaFornecedores(lojistaId);

    res.json({
      ok: true,
      produtos: produtos.map(p => ({
        codigoProd: p.codigoProd,
        descricao: p.descricao || '',
        marca: p.marca || '',
        referencia: p.referencia || '',
        referencia2: p.referencia2 || '',
        unidade: p.unidade || '',
        localLoja: p.localLoja || '',
        codCupom: p.codCupom || '',
        estoque: p.estoque || 0,
        eMin: p.eMin || 0,
        eMax: p.eMax || 0,
        precoCusto: p.precoCusto || 0,
        precoVista: p.precoVista || 0,
        precoPrazo: p.precoPrazo || 0,
        ean: p.ean || '',
        ativo: !!p.ativo,
        nrFornec: p.nrFornec || null,
        fornecedorNome: nomeFornecedor(mapa, p.nrFornec),
        fornecedorConta: mapa.get(Number(p.nrFornec))?.contaNova || '',
        cadastrado: cadastrados.has(p.codigoProd),
      }))
        // os ja transferidos vao para o fim (sort estavel: mantem a ordem)
        .sort((a, b) => a.cadastrado - b.cadastrado),
      total: produtos.length,
    });
  } catch (err) {
    console.error('[compra/produto/origem]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /gravar    { ficha }
//
// Grava em arquivo_docs. A chave e (loja_id, codigo): gravar de novo o mesmo
// codigo atualiza, nao duplica.
// ---------------------------------------------------------------------------
const CAMPOS_TEXTO = [
  'marcaloja', 'cidade', 'bairro', 'marcaproduto', 'descricao', 'descricaoTecnica', 'descricaoNorm',
  'complete', 'referencia', 'referencia2', 'codEcf', 'fornecedor', 'ncontabil', 'similares',
  'localloja', 'artigo', 'pageposicao', 'pageurls', 'figure_mini',
  'figure_media', 'csosn', 'ncm', 'cfop_ecf', 'cfop_nfe',
];

const CAMPOS_NUMERO = [
  'qte', 'qte_negativa', 'qte_reservada', 'e_max', 'e_min',
  'precocusto', 'precovista', 'precoprazo', 'taxa', 'taxaprazo',
];

router.post('/gravar', express.json(), async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const ficha = req.body?.ficha || {};

    const codigo = Number(ficha.codigo);
    if (!Number.isInteger(codigo) || codigo <= 0) {
      return res.status(400).json({ ok: false, erro: 'código do produto inválido' });
    }
    if (!String(ficha.descricao || '').trim()) {
      return res.status(400).json({ ok: false, erro: 'descrição em branco' });
    }

    const doc = { loja_id: lojistaId, codigo };

    for (const c of CAMPOS_TEXTO) {
      if (ficha[c] !== undefined) doc[c] = String(ficha[c] ?? '').trim();
    }
    for (const c of CAMPOS_NUMERO) {
      if (ficha[c] !== undefined && ficha[c] !== '') {
        const n = parseFloat(String(ficha[c]).replace(',', '.'));
        doc[c] = Number.isFinite(n) ? n : 0;
      }
    }

    // o vinculo de verdade com o fornecedor; `fornecedor` guarda so o nome
    const nrFornec = Number(ficha.nrFornec);
    if (Number.isInteger(nrFornec) && nrFornec > 0) doc.nrFornec = nrFornec;

    // fornecedor cadastrado na plataforma (o de produto novo pode nao ter NrFornec do Access)
    if (ficha.fornecId && mongoose.Types.ObjectId.isValid(ficha.fornecId)) {
      doc.fornecId = new mongoose.Types.ObjectId(ficha.fornecId);
    }

    // criado na plataforma: na importacao do Access, o do Access prevalece (COMPRA-15)
    if (ficha.novo === true) doc.origemPlataforma = true;

    doc.ativo = ficha.ativo === false ? false : true;
    doc.pageok = ficha.pageok === true;
    doc.atualizadoEm = new Date();

    const antes = await col('arquivo_docs').findOne({ loja_id: lojistaId, codigo });
    if (antes && ficha.novo === true) {
      return res.status(409).json({ ok: false, erro: 'o código ' + codigo + ' já está em uso; recarregue a página para pegar o próximo' });
    }
    if (!antes) doc.criadoEm = new Date();

    await col('arquivo_docs').updateOne(
      { loja_id: lojistaId, codigo },
      { $set: doc },
      { upsert: true },
    );

    res.json({
      ok: true,
      criado: !antes,
      codigo,
      descricao: doc.descricao || '',
    });
  } catch (err) {
    console.error('[compra/produto/gravar]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /novo     o que a tela de produto novo precisa
//   proximoCodigo  o maior codigo ja usado (cadastro e espelho do Access) + 1
//   fornecedores   os do cadastro com vinculo ativo nesta empresa, pela marca,
//                  com a conta e o NrFornec do Access quando houver
// ---------------------------------------------------------------------------
router.get('/novo', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const maior = async (colecao, filtro, campo) => {
      const d = await col(colecao).find({ ...filtro, [campo]: { $type: 'number' } })
        .sort({ [campo]: -1 }).limit(1).project({ [campo]: 1 }).next();
      return d ? Number(d[campo]) || 0 : 0;
    };
    const proximoCodigo = Math.max(
      await maior('arquivo_docs', { loja_id: lojistaId }, 'codigo'),
      await maior('_produto_origem', { lojistaId }, 'codigoProd'),
    ) + 1;

    const nrPorFornec = new Map((await col('_fornec_access')
      .find({ lojistaId, fornecId: { $ne: null } }).project({ fornecId: 1, nrFornec: 1 }).toArray())
      .map(a => [String(a.fornecId), a.nrFornec]));

    const lista = await col('fornecs').find({
      vinculos: { $elemMatch: { lojistaId, ativo: { $ne: false } } },
    }).project({ razao: 1, marca: 1, vinculos: 1 }).toArray();

    const fornecedores = lista.map(f => {
      const v = (f.vinculos || []).find(x => String(x.lojistaId) === String(lojistaId));
      return {
        fornecId: String(f._id),
        marca: (f.marca || f.razao || '').trim(),
        ncontabil: v?.ncontabil || '',
        nrFornec: nrPorFornec.get(String(f._id)) || null,
      };
    }).filter(f => f.marca)
      .sort((a, b) => a.marca.localeCompare(b.marca, 'pt-BR'));

    res.json({ ok: true, proximoCodigo, fornecedores });
  } catch (err) {
    console.error('[compra/produto/novo]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /relacao-fornecedores
//
// Os fornecedores que tem produto em arquivo_docs desta loja. Inclui os
// inativos no Access (os produtos deles tambem foram importados), marcados.
// ---------------------------------------------------------------------------
router.get('/relacao-fornecedores', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);

    const grupos = await col('arquivo_docs').aggregate([
      { $match: { loja_id: lojistaId } },
      { $group: { _id: '$nrFornec', produtos: { $sum: 1 } } },
    ]).toArray();

    const acc = new Map((await col('_fornec_access').find({ lojistaId })
      .project({ nrFornec: 1, marca: 1, razao: 1, ativo: 1 }).toArray())
      .map(f => [Number(f.nrFornec), f]));

    const lista = grupos.map(g => {
      const f = acc.get(Number(g._id));
      return {
        nrFornec: g._id || null,
        nome: g._id ? (f?.marca || f?.razao || '(sem nome)') : '(sem fornecedor)',
        inativo: !!g._id && (!f || f.ativo === false),
        produtos: g.produtos,
      };
    }).sort((a, b) => (a.inativo - b.inativo) || a.nome.localeCompare(b.nome, 'pt-BR'));

    res.json({ ok: true, fornecedores: lista });
  } catch (err) {
    console.error('[compra/produto/relacao-fornecedores]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /relacao?nrFornec=242&busca=&comEstoque=1
//
// Os produtos cadastrados (arquivo_docs). Sem fornecedor e sem busca, nada.
// ---------------------------------------------------------------------------
router.get('/relacao', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const filtro = { loja_id: lojistaId };

    const nr = Number(req.query.nrFornec);
    if (Number.isFinite(nr) && nr) filtro.nrFornec = nr;

    const busca = String(req.query.busca || '').trim();
    if (busca) {
      const rx = new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ descricao: rx }, { referencia: rx }, { referencia2: rx }, { marcaproduto: rx }];
      const n = Number(busca);
      if (Number.isInteger(n) && n > 0) filtro.$or.push({ codigo: n });
    }
    if (!filtro.nrFornec && !busca) return res.json({ ok: true, produtos: [], total: 0 });

    if (req.query.comEstoque === '1') filtro.qte = { $gt: 0 };

    const r2 = v => Math.round(Number(v || 0) * 100) / 100;
    const produtos = (await col('arquivo_docs').find(filtro)
      .project({ codigo: 1, descricao: 1, referencia: 1, marcaproduto: 1, fornecedor: 1,
                 qte: 1, precocusto: 1, precovista: 1, precoprazo: 1, taxa: 1, ativo: 1 })
      .sort({ descricao: 1 }).limit(3000).toArray())
      .map(p => ({
        codigo: p.codigo,
        descricao: p.descricao || '',
        referencia: p.referencia || '',
        marca: p.marcaproduto || '',
        fornecedor: p.fornecedor || '',
        qte: Number(p.qte) || 0,
        custo: r2(p.precocusto),
        vista: r2(p.precovista),
        prazo: r2(p.precoprazo),
        taxa: r2(p.taxa),
        ativo: p.ativo !== false,
      }));

    res.json({ ok: true, produtos, total: produtos.length });
  } catch (err) {
    console.error('[compra/produto/relacao]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// Resumo de um produto, sem depender de arquivo_docs:
//   consumo   pecas vendidas por mes, ultimos 12 meses. Mes anterior ao
//             inicio das vendas sincronizadas vem null (nao se sabe), nao 0.
//             Devolucao fica de fora da soma.
//   aCaminho  saldo em pedidos pendentes (P) ou com saldo (S)
//   custo     medio e ultimo, em reais: o que a plataforma aprendeu nas notas;
//             sem isso, o do Access
//   origem    a linha do espelho do Access (descricao, referencia, estoque)
// Usado pela pagina do produto (/item) e pelo modal do pedido (/resumo).
// ---------------------------------------------------------------------------
async function resumoProduto(lojistaId, codigo) {
  const hoje = new Date();
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  const vendas = col('_venda_item_origem');
  const primeira = await vendas.find({ lojistaId }).sort({ data: 1 }).limit(1).project({ data: 1 }).next();
  const inicio = primeira ? new Date(primeira.data) : null;

  const somas = await vendas.aggregate([
    { $match: { lojistaId, codigoProd: codigo, devolucao: { $ne: true },
                data: { $gte: new Date(meses[0].ano, meses[0].mes - 1, 1) } } },
    { $group: { _id: { ano: '$ano', mes: '$mes' }, qte: { $sum: '$quantidade' } } },
  ]).toArray();
  const porMes = new Map(somas.map(s => [s._id.ano * 100 + s._id.mes, s.qte]));

  const consumo = meses.map(m => {
    const fimDoMes = new Date(m.ano, m.mes, 1);
    const conhecido = inicio && fimDoMes > inicio;
    return {
      ano: m.ano, mes: m.mes,
      qte: conhecido ? Math.round((porMes.get(m.ano * 100 + m.mes) || 0) * 100) / 100 : null,
      parcial: m.ano === hoje.getFullYear() && m.mes === hoje.getMonth() + 1,
    };
  });

  const pedidos = await col('_compra_pedidos').find({
    lojistaId, situacao: { $in: ['P', 'S'] }, 'itens.codigoOrigem': codigo,
  }).project({ numero: 1, itens: 1, dataEntregaPrevista: 1 }).toArray();
  const aCaminho = [];
  for (const p of pedidos) {
    const saldo = (p.itens || []).filter(i => i.codigoOrigem === codigo)
      .reduce((s, i) => s + Math.max(0, (i.quantidade || 0) - (i.quantidadeAtendida || 0)), 0);
    if (saldo > 0) aCaminho.push({ numero: p.numero, saldo, previsao: p.dataEntregaPrevista || null });
  }

  const o = await col('_produto_origem').findOne({ lojistaId, codigoProd: codigo });
  const r = c => (c ? Math.round(c) / 100 : 0);
  const custo = {
    medio: r(o?.custoMedio || o?.precoMedio),
    ultimo: r(o?.custoUltimo || o?.precoCusto),
  };
  const origem = o ? {
    descricao: o.descricao || '', referencia: o.referencia || '',
    marca: o.marca || '', estoque: Number(o.estoque) || 0,
    nrFornec: Number(o.nrFornec) || 0,
  } : null;

  return { consumo, aCaminho, custo, origem };
}

// ---------------------------------------------------------------------------
// GET /item/:codigo    a pagina do produto: a ficha (arquivo_docs) + o resumo
// ---------------------------------------------------------------------------
router.get('/item/:codigo', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const codigo = Number(req.params.codigo);
    if (!Number.isInteger(codigo) || codigo <= 0) {
      return res.status(400).json({ ok: false, erro: 'código inválido' });
    }

    const produto = await col('arquivo_docs').findOne({ loja_id: lojistaId, codigo });
    if (!produto) return res.status(404).json({ ok: false, erro: 'produto ' + codigo + ' não está cadastrado' });

    const { consumo, aCaminho, custo } = await resumoProduto(lojistaId, codigo);
    delete produto._id;
    res.json({ ok: true, produto, consumo, aCaminho, custo });
  } catch (err) {
    console.error('[compra/produto/item]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /resumo/:codigo    o modal do pedido: resumo + ultimas notas de entrada
//   notas: _nfe_item_origem (COMPRA-17), da mais recente para tras, 15 no maximo.
//   Valores em reais. unitarioComIpi = total do item / quantidade.
// ---------------------------------------------------------------------------
router.get('/resumo/:codigo', async (req, res) => {
  try {
    const lojistaId = new mongoose.Types.ObjectId(req.lojistaId);
    const codigo = Number(req.params.codigo);
    if (!Number.isInteger(codigo) || codigo <= 0) {
      return res.status(400).json({ ok: false, erro: 'código inválido' });
    }

    const resumo = await resumoProduto(lojistaId, codigo);
    // o periodo e decidido pelo COMPRA-17 (ano corrente): aqui mostra o que la esta
    const linhas = await col('_nfe_item_origem')
      .find({ lojistaId, codigoProd: codigo })
      .sort({ emissao: -1, chave: -1 }).limit(15).toArray();

    const notas = linhas.map(n => ({
      nota: n.nrNota,
      emissao: n.emissao,
      entrada: n.dataEntrada,
      qte: n.quantidade,
      unitario: (n.custoUnitario || 0) / 100,
      ipiPerc: n.ipiPerc || 0,
      unitarioComIpi: n.quantidade ? Math.round((n.valorTotal || 0) / n.quantidade) / 100 : 0,
      pedido: n.nrPedido || null,
    }));

    // notas em duvida (COMPRA-17: nota do ano sem itens) do FORNECEDOR deste produto
    const nrFornec = resumo.origem?.nrFornec || 0;
    const duvidas = nrFornec
      ? (await col('_nfe_item_duvida').find({ lojistaId, nrFornec }).sort({ emissao: -1 }).toArray())
          .map(d => ({ nota: d.nrNota, emissao: d.emissao || null, valor: (d.valorTotal || 0) / 100 }))
      : [];

    res.json({ ok: true, codigo, ...resumo, notas, duvidas });
  } catch (err) {
    console.error('[compra/produto/resumo]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
