// =============================================================================
// Destino: C:\plataformaRota\src\routes\vendas\pages.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - tela da venda (/vendas/venda e /vendas/venda/:id)
//                           e a API dela (/vendas/api/venda)
// Alterado em: 03/10/2026 - Relatorio de vendas mes a mes (/vendas/relatorio)
//
// Telas do modulo de vendas. Montado em /vendas no server.js, protegido por
// ensureContab (que expoe req.lojistaId).
//
// Clientes: a API continua em /aux/api/clientes (clientes-api.js, sem mudanca).
// =============================================================================

const express = require('express');
const router  = express.Router();

const vendaApi = require('./venda-api');

// cadastro de clientes
router.get('/clientes', (req, res) => {
  res.render('vendas/pages/clientes', { layout: false, activeMenu: 'vendas' });
});

// venda: nova, ou uma aberta pelo id
router.get('/venda', (req, res) => {
  res.render('vendas/pages/venda', { layout: false, activeMenu: 'vendas', vendaId: '' });
});
router.get('/venda/:id', (req, res) => {
  res.render('vendas/pages/venda', { layout: false, activeMenu: 'vendas', vendaId: req.params.id });
});

// relatorio de vendas, mes a mes (como o fluxo)
router.get('/relatorio', (req, res) => {
  res.render('vendas/pages/relatorio', { layout: false, activeMenu: 'vendas' });
});

/* ===== APIs ===== */
router.use('/api/venda', vendaApi);

module.exports = router;
