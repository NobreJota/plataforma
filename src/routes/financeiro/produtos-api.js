// src/routes/financeiro/produtos-api.js
// API de PRODUTOS para gestão/contábil. SOMENTE LEITURA por enquanto
// (listar, filtrar, buscar). NÃO altera o arquivo_doc — zero risco ao site.
// O cadastro/edição virá depois, com cuidado.

const express = require('express');
const mongoose = require('mongoose');
const ArquivoDoc = require('../../models/arquivoDoc'); // ajuste o caminho se necessário

const router = express.Router();

// Converte Decimal128 → número (para enviar ao front)
function dec(v) {
  if (v == null) return 0;
  try { return parseFloat(v.toString()); } catch { return 0; }
}

/* GET /financeiro/api/produtos
   Lista paginada com filtros: busca, fornecedor, ativo, comImagem, page, limit */
router.get('/', async (req, res) => {
  try {
    console.log('📦 GET produtos chamado, query:', JSON.stringify(req.query));
    const { busca, fornecedor, ativo, imagem, page = 1, limit = 50 } = req.query;

    const filter = {};

    // Ativo / inativo
    if (ativo === 'true') filter.ativo = true;
    else if (ativo === 'false') filter.ativo = false;
    // 'todos' → não filtra

    // Fornecedor
    if (fornecedor && fornecedor !== 'todos') {
      filter.fornecedor = fornecedor;
    }

    // Com / sem imagem
    if (imagem === 'com') filter['pageurls.0'] = { $exists: true };
    else if (imagem === 'sem') filter.$or = [
      { pageurls: { $exists: false } },
      { pageurls: { $size: 0 } }
    ];

    // Busca por texto (usa descricaoNorm se disponível, senão regex)
    if (busca && busca.trim()) {
      const termo = busca.trim();
      const norm = termo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      filter.$or = [
        { descricaoNorm: { $regex: norm, $options: 'i' } },
        { codigo: { $regex: termo, $options: 'i' } },
        { referencia: { $regex: termo, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10) || 50, 200),
      sort: { descricao: 1 },
      populate: { path: 'fornecedor', select: 'razao marca' },
      lean: true,
      // descricaoNorm tem select:false; trazemos só o necessário
      select: 'codigo descricao referencia referencia2 complete marcaproduto ' +
              'fornecedor qte qte_reservada e_min e_max precocusto precovista precoprazo ' +
              'pageurls pageok ativo ncm csosn cfop_ecf cfop_nfe createdAt'
    };

    let result;
    try {
      result = await ArquivoDoc.paginate(filter, options);
    } catch (errPag) {
      // Fallback: se paginate não estiver disponível, usa find + count manual
      console.warn('⚠️ paginate falhou, usando find:', errPag.message);
      const lim = options.limit;
      const skip = (options.page - 1) * lim;
      const [docs, total] = await Promise.all([
        ArquivoDoc.find(filter).sort(options.sort).skip(skip).limit(lim)
          .populate(options.populate.path, options.populate.select)
          .select(options.select).lean(),
        ArquivoDoc.countDocuments(filter)
      ]);
      result = {
        docs, totalDocs: total, page: options.page, limit: lim,
        totalPages: Math.ceil(total / lim),
        hasNextPage: options.page * lim < total,
        hasPrevPage: options.page > 1
      };
    }

    // Decora cada produto (Decimal128 → número, flag de imagem)
    const docs = result.docs.map(p => ({
      _id: p._id,
      codigo: p.codigo || '',
      descricao: p.descricao || '',
      referencia: p.referencia || '',
      referencia2: p.referencia2 || '',
      marcaproduto: p.marcaproduto || '',
      fornecedorRazao: p.fornecedor?.razao || '',
      fornecedorMarca: p.fornecedor?.marca || '',
      qte: p.qte || 0,
      qteReservada: p.qte_reservada || 0,
      eMin: p.e_min || 0,
      eMax: p.e_max || 0,
      precoCusto: dec(p.precocusto),
      precoVista: dec(p.precovista),
      precoPrazo: dec(p.precoprazo),
      temImagem: Array.isArray(p.pageurls) && p.pageurls.length > 0,
      qtdImagens: Array.isArray(p.pageurls) ? p.pageurls.length : 0,
      thumbUrl: (Array.isArray(p.pageurls) && p.pageurls.length > 0) ? p.pageurls[0] : '',
      imagens: Array.isArray(p.pageurls) ? p.pageurls : [],
      ativo: p.ativo !== false,
      ncm: p.ncm || '',
      csosn: p.csosn || ''
    }));

    res.json({
      produtos: docs,
      paginacao: {
        total: result.totalDocs,
        page: result.page,
        totalPages: result.totalPages,
        limit: result.limit,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage
      }
    });
  } catch (err) {
    console.error('❌ /produtos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/produtos/resumo
   Totais: quantos produtos, com imagem, sem imagem */
router.get('/resumo', async (req, res) => {
  try {
    const total = await ArquivoDoc.countDocuments({});
    const ativos = await ArquivoDoc.countDocuments({ ativo: true });
    const comImagem = await ArquivoDoc.countDocuments({ 'pageurls.0': { $exists: true } });
    res.json({ total, ativos, inativos: total - ativos, comImagem, semImagem: total - comImagem });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/produtos/fornecedores
   Lista de fornecedores que têm produtos (para o filtro). */
router.get('/fornecedores', async (req, res) => {
  try {
    const ids = await ArquivoDoc.distinct('fornecedor', { fornecedor: { $ne: null } });
    const Fornecedor = require('../../models/fornec');
    const forns = await Fornecedor.find({ _id: { $in: ids } }, 'razao marca')
      .sort({ razao: 1 }).lean();
    res.json(forns.map(f => ({ _id: f._id, razao: f.razao, marca: f.marca || '' })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/produtos/:id  (detalhe de um produto) */
router.get('/:id', async (req, res) => {
  try {
    const p = await ArquivoDoc.findById(req.params.id)
      .populate('fornecedor', 'razao marca cnpj')
      .lean();
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' });

    p.precoCusto = dec(p.precocusto);
    p.precoVista = dec(p.precovista);
    p.precoPrazo = dec(p.precoprazo);
    res.json(p);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* PUT /financeiro/api/produtos/:id/gestao
   Atualiza APENAS campos de gestão (preços e estoque). NÃO toca em descrição,
   imagens, fiscal ou qualquer campo que o site exibe. Mínimo risco. */
router.put('/:id/gestao', async (req, res) => {
  try {
    const { precoCusto, precoVista, precoPrazo, qte, eMin, eMax } = req.body;

    const p = await ArquivoDoc.findById(req.params.id);
    if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' });

    // Atualiza só os campos de gestão (se vierem no body)
    const toDecimal = (v) => {
      if (v === '' || v == null) return null;
      const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? null : mongoose.Types.Decimal128.fromString(n.toFixed(2));
    };

    if (precoCusto !== undefined) p.precocusto = toDecimal(precoCusto);
    if (precoVista !== undefined) p.precovista = toDecimal(precoVista);
    if (precoPrazo !== undefined) p.precoprazo = toDecimal(precoPrazo);
    if (qte  !== undefined) p.qte   = Math.max(0, parseInt(qte, 10)  || 0);
    if (eMin !== undefined) p.e_min = Math.max(0, parseInt(eMin, 10) || 0);
    if (eMax !== undefined) p.e_max = Math.max(0, parseInt(eMax, 10) || 0);

    await p.save();

    res.json({
      ok: true,
      precoCusto: dec(p.precocusto),
      precoVista: dec(p.precovista),
      precoPrazo: dec(p.precoprazo),
      qte: p.qte, eMin: p.e_min, eMax: p.e_max
    });
  } catch (err) {
    console.error('❌ PUT produto/gestao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
