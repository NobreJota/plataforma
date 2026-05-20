// src/routes/contabil/plano-api.js
// API JSON do Plano de Contas
// Endpoints publicados: /contab/api/grupos, /subgrupos, /titulos, /subtitulos
// (o prefixo /contab/api é definido pelo pages.js e pelo server.js)

const express = require('express');
const router  = express.Router();

const Grupo          = require('../../models/grupo');
const SubGrupo       = require('../../models/grupoSub');       // model "SubGrupo"
const ContaTitulo    = require('../../models/contaTitulo');
const ContaSubTitulo = require('../../models/contaSubTitulo');

/* =========================================================
   HELPERS - Próximo código sequencial
   ========================================================= */

async function proxCodigoSubGrupo(grupoId, codigoGrupo) {
  const ultimo = await SubGrupo.findOne({ grupoId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoGrupo}.01`;
  const seq = parseInt(ultimo.codigo.split('.')[1], 10) + 1;
  return `${codigoGrupo}.${String(seq).padStart(2, '0')}`;
}

async function proxCodigoContaTitulo(subGrupoId, codigoSubGrupo) {
  const ultimo = await ContaTitulo.findOne({ subGrupoId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoSubGrupo}.001`;
  const seq = parseInt(ultimo.codigo.split('.')[2], 10) + 1;
  return `${codigoSubGrupo}.${String(seq).padStart(3, '0')}`;
}

async function proxCodigoContaSubTitulo(contaTituloId, codigoContaTitulo) {
  const ultimo = await ContaSubTitulo.findOne({ contaTituloId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoContaTitulo}.001`;
  const seq = parseInt(ultimo.codigo.split('.')[3], 10) + 1;
  return `${codigoContaTitulo}.${String(seq).padStart(3, '0')}`;
}

/* =========================================================
   NÍVEL 1: GRUPOS (somente leitura)
   ========================================================= */
router.get('/grupos', async (req, res) => {
  try {
    const grupos = await Grupo.find({ ativo: true }).sort({ codigo: 1 });
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 2: SUBGRUPOS
   ========================================================= */
router.get('/subgrupos/:grupoId', async (req, res) => {
  try {
    const subs = await SubGrupo
      .find({ grupoId: req.params.grupoId, ativo: true })
      .sort({ codigo: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/subgrupos', async (req, res) => {
  try {
    const { grupoId, nome, descricao } = req.body;
    if (!grupoId || !nome) {
      return res.status(400).json({ erro: 'grupoId e nome são obrigatórios.' });
    }
    const grupo = await Grupo.findById(grupoId);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });

    const codigo = await proxCodigoSubGrupo(grupoId, grupo.codigo);
    const novo = await SubGrupo.create({
      grupoId,
      codigoGrupo: grupo.codigo,
      codigo,
      nome,
      descricao: descricao || ''
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Subgrupo já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

router.put('/subgrupos/:id', async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    const upd = await SubGrupo.findByIdAndUpdate(
      req.params.id, { nome, descricao },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/subgrupos/:id', async (req, res) => {
  try {
    const filhos = await ContaTitulo.countDocuments({ subGrupoId: req.params.id });
    if (filhos > 0) {
      return res.status(409).json({
        erro: `Este subgrupo possui ${filhos} título(s). Exclua-os antes.`
      });
    }
    const rem = await SubGrupo.findByIdAndDelete(req.params.id);
    if (!rem) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 3: CONTAS TÍTULO
   ========================================================= */
router.get('/titulos/:subGrupoId', async (req, res) => {
  try {
    const titulos = await ContaTitulo
      .find({ subGrupoId: req.params.subGrupoId, ativo: true })
      .sort({ codigo: 1 });
    res.json(titulos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/titulos', async (req, res) => {
  try {
    const { subGrupoId, nome, descricao, aceitaLancamento } = req.body;
    if (!subGrupoId || !nome) {
      return res.status(400).json({ erro: 'subGrupoId e nome são obrigatórios.' });
    }
    const sub = await SubGrupo.findById(subGrupoId);
    if (!sub) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });

    const codigo = await proxCodigoContaTitulo(subGrupoId, sub.codigo);
    const novo = await ContaTitulo.create({
      subGrupoId,
      codigoSubGrupo: sub.codigo,
      codigo,
      nome,
      descricao: descricao || '',
      aceitaLancamento: aceitaLancamento ?? false
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Título já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

router.put('/titulos/:id', async (req, res) => {
  try {
    const { nome, descricao, aceitaLancamento } = req.body;
    const upd = await ContaTitulo.findByIdAndUpdate(
      req.params.id,
      { nome, descricao, aceitaLancamento },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Título não encontrado.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/titulos/:id', async (req, res) => {
  try {
    const filhos = await ContaSubTitulo.countDocuments({ contaTituloId: req.params.id });
    if (filhos > 0) {
      return res.status(409).json({
        erro: `Este título possui ${filhos} subtítulo(s). Exclua-os antes.`
      });
    }
    const rem = await ContaTitulo.findByIdAndDelete(req.params.id);
    if (!rem) return res.status(404).json({ erro: 'Título não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 4: SUB-TÍTULOS
   ========================================================= */
router.get('/subtitulos/:contaTituloId', async (req, res) => {
  try {
    const subs = await ContaSubTitulo
      .find({ contaTituloId: req.params.contaTituloId, ativo: true })
      .sort({ codigo: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/subtitulos', async (req, res) => {
  try {
    const {
      contaTituloId, nome, descricao,
      banco, agencia, conta, saldoInicial, natureza
    } = req.body;

    if (!contaTituloId || !nome || !natureza) {
      return res.status(400).json({
        erro: 'contaTituloId, nome e natureza são obrigatórios.'
      });
    }
    const tit = await ContaTitulo.findById(contaTituloId);
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    const codigo = await proxCodigoContaSubTitulo(contaTituloId, tit.codigo);
    const novo = await ContaSubTitulo.create({
      contaTituloId,
      codigoContaTitulo: tit.codigo,
      codigo,
      nome,
      descricao:    descricao || '',
      banco:        banco     || '',
      agencia:      agencia   || '',
      conta:        conta     || '',
      saldoInicial: saldoInicial || 0,
      natureza
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Subtítulo já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

router.put('/subtitulos/:id', async (req, res) => {
  try {
    const {
      nome, descricao, banco, agencia, conta, saldoInicial, natureza
    } = req.body;
    const upd = await ContaSubTitulo.findByIdAndUpdate(
      req.params.id,
      { nome, descricao, banco, agencia, conta, saldoInicial, natureza },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/subtitulos/:id', async (req, res) => {
  try {
    const rem = await ContaSubTitulo.findByIdAndDelete(req.params.id);
    if (!rem) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
