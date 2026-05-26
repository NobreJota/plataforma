// src/routes/financeiro/compras-api.js
// API da Programação de Compras: vincular fornecedores + grid + lançamentos (pos 7).

const express = require('express');
const Fornecedor = require('../../models/fornec');
const CompraFornecedor = require('../../models/financeiro/compraFornecedor');
const CompraAnual = require('../../models/financeiro/compraAnual');
const FluxoProjetado = require('../../models/financeiro/fluxoProjetado');

const router = express.Router();

/* ============================================================
   VINCULAÇÃO DE FORNECEDORES
   ============================================================ */

/* GET /financeiro/api/compras/disponiveis
   Lista fornecedores ativos, marcando quais já estão vinculados. */
router.get('/disponiveis', async (req, res) => {
  try {
    const fornecedores = await Fornecedor.find({ ativo: { $ne: false } })
      .sort({ razao: 1 }).limit(1000).lean();

    const vinculados = await CompraFornecedor.find({}).lean();
    const setVinc = new Set(vinculados.map(v => String(v.fornecedor)));

    const lista = fornecedores.map(f => ({
      _id: f._id,
      razao: f.razao || '(sem razão)',
      cnpj: f.cnpj || '',
      marca: f.marca || '',
      vinculado: setVinc.has(String(f._id)),
      ativo: setVinc.has(String(f._id))
        ? (vinculados.find(v => String(v.fornecedor) === String(f._id))?.ativo ?? true)
        : false
    }));

    res.json(lista);
  } catch (err) {
    console.error('❌ /compras/disponiveis:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/compras/vinculados */
router.get('/vinculados', async (req, res) => {
  try {
    const incluirInativos = req.query.incluirInativos === 'true';
    const filter = incluirInativos ? {} : { ativo: true };
    const lista = await CompraFornecedor.find(filter).sort({ razao: 1 }).lean();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/compras/vincular  Body: { fornecedorIds: [...] } */
router.post('/vincular', async (req, res) => {
  try {
    const { fornecedorIds } = req.body;
    if (!Array.isArray(fornecedorIds)) {
      return res.status(400).json({ erro: 'fornecedorIds deve ser um array.' });
    }
    let adicionados = 0;
    for (const id of fornecedorIds) {
      const jaExiste = await CompraFornecedor.findOne({ fornecedor: id });
      if (jaExiste) {
        if (!jaExiste.ativo) { jaExiste.ativo = true; await jaExiste.save(); }
        continue;
      }
      const f = await Fornecedor.findById(id).lean();
      if (!f) continue;
      await CompraFornecedor.create({
        fornecedor: f._id,
        razao: f.razao || '(sem razão)',
        cnpj: f.cnpj || '',
        marca: f.marca || '',
        ativo: true
      });
      adicionados++;
    }
    res.json({ ok: true, adicionados });
  } catch (err) {
    console.error('❌ /compras/vincular:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/compras/fornecedor/:id/toggle */
router.post('/fornecedor/:id/toggle', async (req, res) => {
  try {
    const cf = await CompraFornecedor.findById(req.params.id);
    if (!cf) return res.status(404).json({ erro: 'Fornecedor vinculado não encontrado.' });
    cf.ativo = !cf.ativo;
    await cf.save();
    res.json({ ok: true, ativo: cf.ativo });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ============================================================
   GRID (fornecedores × meses + total)
   ============================================================ */

router.get('/grid/:ano', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    if (!ano) return res.status(400).json({ erro: 'Ano inválido.' });

    const fornecedores = await CompraFornecedor.find({ ativo: true }).sort({ razao: 1 }).lean();

    const compra = await CompraAnual.findOne({ ano }).lean();
    const valoresPorForn = {};
    if (compra?.fornecedores) {
      compra.fornecedores.forEach(f => {
        valoresPorForn[String(f.compraFornecedor)] = f.meses || Array(12).fill(0);
      });
    }

    const linhas = fornecedores.map(f => {
      const meses = valoresPorForn[String(f._id)] || Array(12).fill(0);
      const total = meses.reduce((s, v) => s + (v || 0), 0);
      return {
        compraFornecedorId: f._id,
        fornecedorId: f.fornecedor,
        razao: f.razao,
        marca: f.marca,
        meses,
        total
      };
    });

    res.json({ ano, linhas });
  } catch (err) {
    console.error('❌ /compras/grid:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/anos', async (req, res) => {
  try {
    const docs = await CompraAnual.find({}, 'ano').sort({ ano: -1 }).lean();
    const anos = docs.map(d => d.ano);
    const atual = new Date().getFullYear();
    if (!anos.includes(atual)) anos.unshift(atual);
    res.json(anos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ============================================================
   LANÇAMENTOS (parcelas) — geram pos 7 no Fluxo Projetado
   ============================================================ */

function calcularParcelas({ valor, numParcelas, modo }) {
  numParcelas = Math.max(1, parseInt(numParcelas, 10) || 1);
  valor = Number(valor) || 0;
  const parcelas = [];
  if (modo === 'total') {
    const base = Math.floor((valor / numParcelas) * 100) / 100;
    let acc = 0;
    for (let i = 0; i < numParcelas; i++) {
      let v = base;
      if (i === numParcelas - 1) v = Math.round((valor - acc) * 100) / 100;
      acc += base;
      parcelas.push(v);
    }
  } else {
    for (let i = 0; i < numParcelas; i++) parcelas.push(valor);
  }
  return parcelas;
}

router.get('/lancamentos/:ano/:fornId', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const compra = await CompraAnual.findOne({ ano }).lean();
    if (!compra) return res.json({ lancamentos: [], meses: Array(12).fill(0) });
    const f = (compra.fornecedores || []).find(x => String(x.compraFornecedor) === String(req.params.fornId));
    if (!f) return res.json({ lancamentos: [], meses: Array(12).fill(0) });
    res.json({ lancamentos: f.lancamentos || [], meses: f.meses || Array(12).fill(0) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/lancamento', async (req, res) => {
  try {
    const { ano, compraFornecedorId, historico, valor, numParcelas, modo, mesInicial, diaVencimento, intervalo } = req.body;
    if (!ano || !compraFornecedorId) return res.status(400).json({ erro: 'Ano e fornecedor são obrigatórios.' });

    const nParc = Math.max(1, parseInt(numParcelas, 10) || 1);
    const mesIni = Math.min(12, Math.max(1, parseInt(mesInicial, 10) || 1));
    const dia = Math.min(31, Math.max(1, parseInt(diaVencimento, 10) || 10));
    const interv = Math.max(1, parseInt(intervalo, 10) || 1);  // 1=mensal, 2=bimensal, 3=trimestral...

    const cf = await CompraFornecedor.findById(compraFornecedorId).lean();
    if (!cf) return res.status(404).json({ erro: 'Fornecedor vinculado não encontrado.' });

    const valoresParcelas = calcularParcelas({ valor, numParcelas: nParc, modo });

    let compra = await CompraAnual.findOne({ ano });
    if (!compra) compra = await CompraAnual.create({ ano, fornecedores: [] });

    let forn = compra.fornecedores.find(f => String(f.compraFornecedor) === String(compraFornecedorId));
    if (!forn) {
      compra.fornecedores.push({ compraFornecedor: compraFornecedorId, razao: cf.razao, meses: Array(12).fill(0), lancamentos: [] });
      forn = compra.fornecedores[compra.fornecedores.length - 1];
    }

    const mesesAfetados = [];
    for (let i = 0; i < nParc; i++) {
      const idx = (mesIni - 1 + i * interv) % 12;
      forn.meses[idx] = (forn.meses[idx] || 0) + valoresParcelas[i];
      mesesAfetados.push(idx + 1);
    }
    forn.lancamentos.push({
      historico: historico || cf.razao,
      valor: Number(valor) || 0,
      numParcelas: nParc, mesInicial: mesIni, diaVencimento: dia, intervalo: interv, mesesAfetados
    });
    await compra.save();
    const lancSalvo = forn.lancamentos[forn.lancamentos.length - 1];

    // Gera parcelas no Fluxo Projetado (pos 7 = compras futuras)
    const docs = [];
    for (let i = 0; i < nParc; i++) {
      const idx = (mesIni - 1 + i * interv) % 12;
      const anoP = ano + Math.floor((mesIni - 1 + i * interv) / 12);
      docs.push({
        ano: anoP, mes: idx + 1, pos: 7,
        contaSubTitulo: null,
        codigoConta: '',
        nomeConta: cf.razao,
        historico: historico || cf.razao,
        valor: valoresParcelas[i],
        vencimento: new Date(anoP, idx, dia),
        parcela: i + 1, totalParcelas: nParc,
        origem: 'COMPRA_PROJETADA',
        orcamentoAno: ano,
        lancamentoId: lancSalvo._id
      });
    }
    await FluxoProjetado.insertMany(docs);

    res.status(201).json({ ok: true, lancamentoId: lancSalvo._id, meses: forn.meses, parcelasGeradas: docs.length });
  } catch (err) {
    console.error('❌ /compras/lancamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.put('/lancamento/:ano/:fornId/:lancId', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const { fornId, lancId } = req.params;
    const { historico, valor, numParcelas, modo, mesInicial, diaVencimento, intervalo } = req.body;

    const nParc = Math.max(1, parseInt(numParcelas, 10) || 1);
    const mesIni = Math.min(12, Math.max(1, parseInt(mesInicial, 10) || 1));
    const dia = Math.min(31, Math.max(1, parseInt(diaVencimento, 10) || 10));
    const interv = Math.max(1, parseInt(intervalo, 10) || 1);

    const compra = await CompraAnual.findOne({ ano });
    if (!compra) return res.status(404).json({ erro: 'Programação não encontrada.' });
    const forn = compra.fornecedores.find(f => String(f.compraFornecedor) === String(fornId));
    if (!forn) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    const lanc = forn.lancamentos.id(lancId);
    if (!lanc) return res.status(404).json({ erro: 'Lançamento não encontrado.' });

    const cf = await CompraFornecedor.findById(fornId).lean();

    // Subtrai antigos
    const antigas = await FluxoProjetado.find({ lancamentoId: lancId }).lean();
    antigas.forEach(p => { forn.meses[p.mes - 1] = Math.max(0, (forn.meses[p.mes - 1] || 0) - p.valor); });
    await FluxoProjetado.deleteMany({ lancamentoId: lancId });

    const valoresParcelas = calcularParcelas({ valor, numParcelas: nParc, modo });
    const mesesAfetados = [];
    for (let i = 0; i < nParc; i++) {
      const idx = (mesIni - 1 + i * interv) % 12;
      forn.meses[idx] = (forn.meses[idx] || 0) + valoresParcelas[i];
      mesesAfetados.push(idx + 1);
    }
    lanc.historico = historico || (cf ? cf.razao : lanc.historico);
    lanc.valor = Number(valor) || 0;
    lanc.numParcelas = nParc; lanc.mesInicial = mesIni; lanc.diaVencimento = dia; lanc.intervalo = interv; lanc.mesesAfetados = mesesAfetados;
    await compra.save();

    const docs = [];
    for (let i = 0; i < nParc; i++) {
      const idx = (mesIni - 1 + i * interv) % 12;
      const anoP = ano + Math.floor((mesIni - 1 + i * interv) / 12);
      docs.push({
        ano: anoP, mes: idx + 1, pos: 7, contaSubTitulo: null, codigoConta: '',
        nomeConta: cf ? cf.razao : forn.razao, historico: lanc.historico,
        valor: valoresParcelas[i], vencimento: new Date(anoP, idx, dia),
        parcela: i + 1, totalParcelas: nParc, origem: 'COMPRA_PROJETADA',
        orcamentoAno: ano, lancamentoId: lanc._id
      });
    }
    await FluxoProjetado.insertMany(docs);

    res.json({ ok: true, meses: forn.meses });
  } catch (err) {
    console.error('❌ PUT /compras/lancamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/lancamento/:ano/:fornId/:lancId', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const { fornId, lancId } = req.params;
    const compra = await CompraAnual.findOne({ ano });
    if (!compra) return res.status(404).json({ erro: 'Programação não encontrada.' });
    const forn = compra.fornecedores.find(f => String(f.compraFornecedor) === String(fornId));
    if (!forn) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });

    const parcelas = await FluxoProjetado.find({ lancamentoId: lancId }).lean();
    parcelas.forEach(p => { forn.meses[p.mes - 1] = Math.max(0, (forn.meses[p.mes - 1] || 0) - p.valor); });

    forn.lancamentos.pull(lancId);
    await compra.save();
    await FluxoProjetado.deleteMany({ lancamentoId: lancId });

    res.json({ ok: true, meses: forn.meses });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
