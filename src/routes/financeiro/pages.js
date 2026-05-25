// src/routes/financeiro/pages.js
// Rotas do módulo financeiro: telas + APIs.

const express = require('express');
const router  = express.Router();

const orcamentoApi = require('./orcamento-api');
const fluxoApi     = require('./fluxo-api');

/* ===== Telas ===== */
router.get('/orcamento', (req, res) => {
  res.render('pages/financeiro/orcamento', {
    layout: false,
    activeMenu: 'financeiro'
  });
});

router.get('/fluxo', (req, res) => {
  res.render('pages/financeiro/fluxo', {
    layout: false,
    activeMenu: 'financeiro'
  });
});

/* ===== APIs ===== */
router.use('/api/orcamento', orcamentoApi);
router.use('/api/fluxo', fluxoApi);

module.exports = router;
