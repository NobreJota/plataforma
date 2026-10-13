// =============================================================================
// Destino: C:\plataformaRota\src\routes\vendas\pages.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - tela da venda (/vendas/venda e /vendas/venda/:id)
//                           e a API dela (/vendas/api/venda)
// Alterado em: 03/10/2026 - Relatorio de vendas mes a mes (/vendas/relatorio)
// Alterado em: 10/10/2026 - Servico > Agenda do dia (/vendas/servicos)
// Alterado em: 13/10/2026 - Servico > listas da OS (/vendas/servicos/lista?tipo=) e a API
//                           da OS (/vendas/api/os, os-api.js)
// Alterado em: 13/10/2026 - Servico > Tecnicos (/vendas/servicos/tecnicos) e a API
//                           (/vendas/api/tecnicos, tecnicos-api.js)
//
// Telas do modulo de vendas. Montado em /vendas no server.js, protegido por
// ensureContab (que expoe req.lojistaId).
//
// Clientes: a API continua em /aux/api/clientes (clientes-api.js, sem mudanca).
// =============================================================================

const express = require('express');
const router  = express.Router();

const vendaApi = require('./venda-api');
const osApi    = require('./os-api');
const tecApi   = require('./tecnicos-api');

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

// servico: agenda do dia dos tecnicos (instalacoes)
router.get('/servicos', (req, res) => {
  res.render('vendas/pages/servicos', { layout: false, activeMenu: 'servico' });
});

// servico: listas da OS (programadas, n/programadas, pendentes, concluidas, liquidadas)
router.get('/servicos/lista', (req, res) => {
  res.render('vendas/pages/servicos-lista', { layout: false, activeMenu: 'servico' });
});

// servico: cadastro de tecnicos (MEI)
router.get('/servicos/tecnicos', (req, res) => {
  res.render('vendas/pages/tecnicos', { layout: false, activeMenu: 'servico' });
});

/* ===== APIs ===== */
router.use('/api/venda', vendaApi);
router.use('/api/os', osApi);
router.use('/api/tecnicos', tecApi);

module.exports = router;
