// src/routes/auxiliares/pages.js
// Renderiza as telas dos cadastros auxiliares e delega as APIs.

const express = require('express');
const router  = express.Router();

const clientesApi          = require('./clientes-api');
const fornecedoresApi      = require('./fornecedores-api');
const bancosApi            = require('./bancos-api');
const contasBancariasApi   = require('./contas-bancarias-api');
const lookupsApi           = require('./lookups-api');
const lookupsExtra         = require('./lookups-extra');

/* ===== Telas ===== */

router.get('/clientes', (req, res) => {
  res.render('pages/auxiliares/clientes', {
    layout: false,
    activeMenu: 'auxiliares'
  });
});

router.get('/fornecedores', (req, res) => {
  res.render('pages/auxiliares/fornecedores', {
    layout: false,
    activeMenu: 'auxiliares'
  });
});

router.get('/bancos', (req, res) => {
  res.render('pages/auxiliares/bancos', {
    layout: false,
    activeMenu: 'auxiliares'
  });
});

router.get('/contas-bancarias', (req, res) => {
  res.render('pages/auxiliares/contas-bancarias', {
    layout: false,
    activeMenu: 'auxiliares'
  });
});

/* ===== APIs (delegação) ===== */
router.use('/api/clientes',          clientesApi);
router.use('/api/fornecedores',      fornecedoresApi);
router.use('/api/bancos',            bancosApi);
router.use('/api/contas-bancarias',  contasBancariasApi);
router.use('/api/lookup',            lookupsApi);
router.use('/api/lookup',            lookupsExtra);

module.exports = router;
