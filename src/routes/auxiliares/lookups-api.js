// src/routes/auxiliares/lookups-api.js
// Endpoints públicos de lookup (CNPJ e CEP) — reusáveis em qualquer tela.

const express = require('express');
const router  = express.Router();

const { consultarCnpj } = require('../../utils/consultaCnpj');
const { consultarCep }  = require('../../utils/consultaCep');

/* GET /aux/api/lookup/cnpj/:cnpj */
router.get('/cnpj/:cnpj', async (req, res) => {
  const r = await consultarCnpj(req.params.cnpj);
  if (!r.ok) return res.status(404).json({ erro: r.erro });
  res.json(r.dados);
});

/* GET /aux/api/lookup/cep/:cep */
router.get('/cep/:cep', async (req, res) => {
  const r = await consultarCep(req.params.cep);
  if (!r.ok) return res.status(404).json({ erro: r.erro });
  res.json(r.dados);
});

module.exports = router;
