// src/routes/financeiro/pages.js
// Rotas do módulo financeiro: telas + APIs.

const express = require('express');
const router  = express.Router();

const orcamentoApi = require('./orcamento-api');

/* ===== Telas ===== */
router.get('/orcamento', (req, res) => {
  res.render('pages/financeiro/orcamento', {
    layout: false,
    activeMenu: 'financeiro'
  });
});

/* ===== APIs ===== */
router.use('/api/orcamento', orcamentoApi);

module.exports = router;
