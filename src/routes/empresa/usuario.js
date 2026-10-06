// ==================================================================
// src/routes/empresa/usuario.js   (montado em /usuarioloja no server.js)
// Alterado em 26/09/2026:
//   - POST /usuarioloja/login passa a existir (usa a mesma função do
//     POST /loja/cooperados, em src/routes/empresa/rotina.js)
//   - GET /login pula direto para /loja/cooperados se já estiver logado
//   - logout encerra só a sessão da loja (antes chamava req.logout do
//     passport, que derrubava o login da central, e ia para /usuario/login,
//     rota que não existe)
// ==================================================================
const express = require('express');
const router  = express.Router();
const { autenticarLojista } = require('./rotina');

router.get('/login', (req, res) => {
  if (req.session && req.session.lojistaId) {
    return res.redirect('/loja/cooperados');
  }
  res.render('empresa/pages/lojalogin.handlebars', { layout: 'empresa/login' });
});

router.post('/login', autenticarLojista);

router.get('/logout', (req, res) => {
  if (req.session) delete req.session.lojistaId;
  req.flash('success_msg', 'Deslogado com sucesso!');
  return req.session.save(() => res.redirect('/usuarioloja/login'));
});

module.exports = router;
