// src/routes/contabil/pages.js
// Responsável apenas por RENDERIZAR as telas (views).
// Delega tudo que começa com /api para o plano-api.js (e demais APIs do módulo).

const express = require('express');
const router  = express.Router();

const planoApi          = require('./plano-api');
const titulosPorGrupoApi = require('./titulos-por-grupo-api');

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

/* ===== Delegação das APIs =====
   Tudo que vier em /contab/api/... cai aqui dentro.
   A ORDEM importa: rotas específicas vêm antes das genéricas.
   O titulos-por-grupo-api define /titulos-por-grupo/:codigo e é montado
   antes do plano-api para evitar qualquer conflito de match. */
router.use('/api', titulosPorGrupoApi);
router.use('/api', planoApi);

module.exports = router;
