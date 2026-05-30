// src/routes/financeiro/pages.js
// Rotas do módulo financeiro: telas + APIs.

const express = require('express');
const router  = express.Router();

const orcamentoApi = require('./orcamento-api');
const fluxoApi     = require('./fluxo-api');
const comprasApi   = require('./compras-api');
const produtosApi  = require('./produtos-api');
const pagamentoApi = require('./pagamento-api');
const realizacaoApi = require('./realizacao-api');
const razaoApi = require('./razao-api');

/* ===== Telas ===== */
router.get('/orcamento', (req, res) => {
  res.render('pages/financeiro/orcamento', { layout: false, activeMenu: 'financeiro' });
});

router.get('/fluxo', (req, res) => {
  res.render('pages/financeiro/fluxo', { layout: false, activeMenu: 'financeiro' });
});

router.get('/compras', (req, res) => {
  res.render('pages/financeiro/compras', { layout: false, activeMenu: 'compra' });
});

router.get('/produtos', (req, res) => {
  res.render('pages/financeiro/produtos', { layout: false, activeMenu: 'produto' });
});

/* ===== APIs ===== */
router.use('/api/orcamento', orcamentoApi);
router.use('/api/fluxo', fluxoApi);
router.use('/api/compras', comprasApi);
router.use('/api/produtos', produtosApi);
router.use('/api/pagamento', pagamentoApi);
router.use('/api/realizacao', realizacaoApi);
router.use('/api/razao', razaoApi);

module.exports = router;
