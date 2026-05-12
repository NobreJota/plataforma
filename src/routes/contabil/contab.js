// routes/contabil.js
// Rotas CRUD para o plano de contas contábil
// Grupos → SubGrupos → ContaTitulos → ContaSubTitulos

const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");

const Grupo          = require("../models/grupo");
const SubGrupo       = require("../models/subGrupo");
const ContaTitulo    = require("../models/contaTitulo");
const ContaSubTitulo = require("../models/contaSubTitulo");

// ============================================================
// GRUPOS
// ============================================================

// GET /contabil/grupos — lista todos
router.get("/grupos", async (req, res) => {
  try {
    const grupos = await Grupo.find({ ativo: true }).sort({ codigo: 1 });
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /contabil/grupos — cria novo
router.post("/grupos", async (req, res) => {
  try {
    const grupo = new Grupo(req.body);
    await grupo.save();
    res.status(201).json(grupo);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// PUT /contabil/grupos/:id — atualiza
router.put("/grupos/:id", async (req, res) => {
  try {
    const grupo = await Grupo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(grupo);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ============================================================
// SUBGRUPOS
// ============================================================

// GET /contabil/subgrupos?grupoId=xxx  ou  ?codigoGrupo=1
router.get("/subgrupos", async (req, res) => {
  try {
    const filtro = { ativo: true };
    if (req.query.grupoId)     filtro.grupoId     = req.query.grupoId;
    if (req.query.codigoGrupo) filtro.codigoGrupo = req.query.codigoGrupo;
    const subGrupos = await SubGrupo.find(filtro).sort({ codigo: 1 });
    res.json(subGrupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /contabil/subgrupos
router.post("/subgrupos", async (req, res) => {
  try {
    const sub = new SubGrupo(req.body);
    await sub.save();
    res.status(201).json(sub);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// PUT /contabil/subgrupos/:id
router.put("/subgrupos/:id", async (req, res) => {
  try {
    const sub = await SubGrupo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(sub);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ============================================================
// CONTA TÍTULOS
// ============================================================

// GET /contabil/contatitulos?subGrupoId=xxx  ou  ?codigoSubGrupo=1.01
router.get("/contatitulos", async (req, res) => {
  try {
    const filtro = { ativo: true };
    if (req.query.subGrupoId)     filtro.subGrupoId     = req.query.subGrupoId;
    if (req.query.codigoSubGrupo) filtro.codigoSubGrupo = req.query.codigoSubGrupo;
    const titulos = await ContaTitulo.find(filtro).sort({ codigo: 1 });
    res.json(titulos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /contabil/contatitulos
router.post("/contatitulos", async (req, res) => {
  try {
    const titulo = new ContaTitulo(req.body);
    await titulo.save();
    res.status(201).json(titulo);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// PUT /contabil/contatitulos/:id
router.put("/contatitulos/:id", async (req, res) => {
  try {
    const titulo = await ContaTitulo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(titulo);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ============================================================
// CONTA SUB-TÍTULOS
// ============================================================

// GET /contabil/contasubtitulos?contaTituloId=xxx  ou  ?codigoContaTitulo=1.01.002
router.get("/contasubtitulos", async (req, res) => {
  try {
    const filtro = { ativo: true };
    if (req.query.contaTituloId)     filtro.contaTituloId     = req.query.contaTituloId;
    if (req.query.codigoContaTitulo) filtro.codigoContaTitulo = req.query.codigoContaTitulo;
    if (req.query.natureza)          filtro.natureza          = req.query.natureza;
    const subs = await ContaSubTitulo.find(filtro).sort({ codigo: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// POST /contabil/contasubtitulos
router.post("/contasubtitulos", async (req, res) => {
  try {
    const sub = new ContaSubTitulo(req.body);
    await sub.save();
    res.status(201).json(sub);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// PUT /contabil/contasubtitulos/:id
router.put("/contasubtitulos/:id", async (req, res) => {
  try {
    const sub = await ContaSubTitulo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(sub);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ============================================================
// ROTA ESPECIAL — Hierarquia completa de uma sub-conta
// GET /contabil/hierarquia/:codigo
// Ex: /contabil/hierarquia/1.01.002.001
// ============================================================
router.get("/hierarquia/:codigo", async (req, res) => {
  try {
    const sub = await ContaSubTitulo.findOne({ codigo: req.params.codigo })
      .populate({
        path: "contaTituloId",
        populate: {
          path: "subGrupoId",
          populate: { path: "grupoId" },
        },
      });
    if (!sub) return res.status(404).json({ erro: "Conta não encontrada" });
    res.json(sub);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ============================================================
// ROTA ESPECIAL — Plano de contas completo agrupado
// GET /contabil/plano
// Retorna toda a árvore: grupos > subgrupos > titulos > subtitulos
// ============================================================
router.get("/plano", async (req, res) => {
  try {
    const grupos = await Grupo.find({ ativo: true }).sort({ codigo: 1 }).lean();

    for (const grupo of grupos) {
      const subGrupos = await SubGrupo.find({ grupoId: grupo._id, ativo: true })
        .sort({ codigo: 1 }).lean();

      for (const sub of subGrupos) {
        const titulos = await ContaTitulo.find({ subGrupoId: sub._id, ativo: true })
          .sort({ codigo: 1 }).lean();

        for (const titulo of titulos) {
          titulo.subTitulos = await ContaSubTitulo.find({
            contaTituloId: titulo._id, ativo: true,
          }).sort({ codigo: 1 }).lean();
        }

        sub.titulos = titulos;
      }

      grupo.subGrupos = subGrupos;
    }

    res.json(grupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/razao', (req, res) => {
  alert("BRAVO!")
  console.log('Olá!')
  //res.render('contabil/razao', { activeMenu: 'contabil' });
});

module.exports = router;
