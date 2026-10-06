// =============================================================================
// Destino: C:\plataformaRota\src\routes\compra\pages.js
// Alterado em: 26/09/2026 — rotas do terceiro nivel do menu.
// Alterado em: 26/09/2026 — a conferencia fisica ganhou tela e API.
// Alterado em: 30/09/2026 — Relacao de produtos ganhou tela.
// Alterado em: 30/09/2026 — pagina do produto (/produto/:codigo); sai produtos-alteracao.
//
// Rotas do modulo de compra: telas + APIs.
// Protegido por ensureContab no server.js, que expoe req.lojistaId.
//
// ATENCAO A ORDEM: /entrada/:id engole qualquer /entrada/<coisa>. Por isso o
// desbloqueio e a pesquisa moram em /desbloqueio e /notas, fora de /entrada.
// =============================================================================

const express = require('express');
const router  = express.Router();

const pedidoApi = require('./pedido-api');
const notaApi   = require('./nota-api');
const produtoApi = require('./produto-api');
const conferenciaApi = require('./conferencia-api');

// tela que ainda nao existe: nasce anunciada, nao quebrada
function emBreve(res, titulo, descricao) {
  res.render('compra/pages/em-breve', {
    layout: false,
    activeMenu: 'compra',
    titulo,
    descricao,
  });
}

/* ===== Pedidos ===== */

// emitir
router.get('/pedidos', (req, res) => {
  res.render('compra/pages/pedidos', { layout: false, activeMenu: 'compra' });
});

// o que foi comprado e ainda nao chegou
router.get('/pedidos-pendentes', (req, res) => {
  res.render('compra/pages/pedidos-pendentes', {
    layout: false, activeMenu: 'compra',
  });
});

router.get('/pedidos-liquidados', (req, res) => {
  emBreve(res, 'Pedido liquidado',
    'Os pedidos já entregues por completo, com a nota que os encerrou.');
});

/* ===== Produtos ===== */

// produto NOVO (01/10/2026): ficha em branco, codigo automatico. Os produtos
// do Access ja foram importados em lote (COMPRA-15)
router.get('/produtos', (req, res) => {
  res.render('compra/pages/produto-cadastro', {
    layout: false, activeMenu: 'compra',
  });
});

// a lista dos produtos cadastrados (arquivo_docs), por fornecedor
router.get('/produtos-relacao', (req, res) => {
  res.render('compra/pages/produtos-relacao', {
    layout: false, activeMenu: 'compra',
  });
});

// um produto: ficha editavel + consumo por mes (duplo clique na Relacao)
router.get('/produto/:codigo', (req, res) => {
  res.render('compra/pages/produto', {
    layout: false, activeMenu: 'compra',
    codigo: String(Number(req.params.codigo) || ''),
  });
});

/* ===== Entrada de mercadoria ===== */

// painel das notas de entrada
router.get('/entrada', (req, res) => {
  res.render('compra/pages/entrada', { layout: false, activeMenu: 'compra' });
});

// uma nota: vinculo com o pedido, conferencia, efetivacao
router.get('/entrada/:id', (req, res) => {
  res.render('compra/pages/nota', {
    layout: false,
    activeMenu: 'compra',
    notaId: req.params.id,
  });
});

// contagem fisica: outra pagina, outro operador, um item por vez
router.get('/conferencia/:id', (req, res) => {
  res.render('compra/pages/conferencia', {
    layout: false,
    activeMenu: 'compra',
    notaId: req.params.id,
  });
});

router.get('/desbloqueio', (req, res) => {
  emBreve(res, 'Desbloqueio da nota',
    'As notas travadas por divergência de contagem. Exige nível de acesso de '
    + 'gerente, que ainda não existe.');
});

// o historico: por mes, por fornecedor, por numero
router.get('/notas', (req, res) => {
  res.render('compra/pages/notas', { layout: false, activeMenu: 'compra' });
});

/* ===== APIs ===== */
router.use('/api/pedido', pedidoApi);
router.use('/api/nota', notaApi);
router.use('/api/produto', produtoApi);
router.use('/api/conferencia', conferenciaApi);

module.exports = router;
