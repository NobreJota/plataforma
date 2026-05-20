// src/routes/contabil/pages.js
// Responsável apenas por RENDERIZAR as telas (views).
// Delega tudo que começa com /api para o plano-api.js

const express = require('express');
const router  = express.Router();

const planoApi = require('./plano-api');

/* ===== Telas (renderizam HTML) ===== */

// Tela do Plano de Contas (cadastro hierárquico)
router.get('/plano', (req, res) => {
  res.render('pages/contabil/plano-contas', {
    layout: false,
    activeMenu: 'contabil'
  });
});

// Tela do Razão (lançamentos)
router.get('/razao', (req, res) => {
  res.render('pages/contabil/razao', {
    layout: false,
    activeMenu: 'contabil'
  });
});

/* ===== Delegação da API =====
   Tudo que vier em /contab/api/... cai aqui dentro */
router.use('/api', planoApi);

module.exports = router;
