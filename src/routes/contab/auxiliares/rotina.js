// src/routes/contab/auxiliares/rotina.js
//
// AUTENTICAÇÃO DA ÁREA CONTAB
//
// Regra: o usuário do contab é o próprio LOJISTA (dono da empresa),
// usando o mesmo email e senha da loja. A diferença é só a URL de entrada.
//
// A sessão guarda `lojistaId` — chave do sistema multi-empresa. TODAS as
// queries de contab devem filtrar por esse lojistaId (etapa 2C).

const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

// Model do Lojista (mora em src/models/empresa/lojista.js)
const Lojista = require('../../../models/empresa/lojista');

/* ---------------------------------------------------------------
   MIDDLEWARE ensureContab
   Protege rotas internas do contab. Expõe `req.lojistaId` pras rotas
   usarem como filtro: Model.find({ lojistaId: req.lojistaId })

   IMPORTANTE — duas respostas diferentes:
   - Tela (GET /contab/plano)  → redirect pro login
   - API  (GET /contab/api/..) → 401 JSON

   Sem essa separação, um fetch() com sessão expirada recebe um 302 e
   depois o HTML da tela de login. O front tenta dar res.json() nisso e
   estoura "Unexpected token '<'" — erro que parece bug de API mas é
   sessão vencida.

   req.lojistaId vai como ObjectId, não string. Filtro de igualdade
   simples funciona com string, mas $in, $match de aggregate e
   populate/match NÃO fazem o cast — e falham em silêncio, devolvendo
   lista vazia. Convertendo aqui, no único lugar, o problema não existe.
   --------------------------------------------------------------- */
function ehRequisicaoApi(req) {
  return req.originalUrl.includes('/api/')
      || req.xhr
      || (req.get('accept') || '').includes('application/json');
}

function ensureContab(req, res, next) {
  const id = req.session && req.session.usuarioContab && req.session.usuarioContab.lojistaId;

  if (!id) {
    if (ehRequisicaoApi(req)) {
      return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
    }
    return res.redirect('/usuariocontab/login');
  }

  req.lojistaId = new mongoose.Types.ObjectId(String(id));
  res.locals.usuarioContab = req.session.usuarioContab;   // disponível nas views
  return next();
}

/* ---------------------------------------------------------------
   GET /usuariocontab/login
   Se já estiver logado, pula direto pro menu.
   --------------------------------------------------------------- */
router.get('/login', (req, res) => {
  if (req.session && req.session.usuarioContab) {
    return res.redirect('/usuariocontab/menu');
  }
  const erro = req.query.erro || '';
  res.render('contab/auxiliares/contab_login', {
    layout: false,
    erro
  });
});

/* ---------------------------------------------------------------
   POST /usuariocontab/login
   Valida email + senha do LOJISTA (coleção 'lojistas').
   --------------------------------------------------------------- */
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');

    if (!email || !senha) {
      return res.redirect('/usuariocontab/login?erro=' + encodeURIComponent('Preencha email e senha.'));
    }

    // O schema do lojista tem `select: false` na senha — precisa incluir
    const lojista = await Lojista.findOne({ email }).select('+senha');
    if (!lojista) {
      return res.redirect('/usuariocontab/login?erro=' + encodeURIComponent('Usuário ou senha inválidos.'));
    }

    // Aceita apenas lojistas com situação ativa
    if (lojista.situacao && String(lojista.situacao).toLowerCase() !== 'ativo') {
      return res.redirect('/usuariocontab/login?erro=' + encodeURIComponent('Acesso bloqueado. Contate a administração.'));
    }

    // Usa o método compararSenha que já existe no schema (bcrypt)
    const ok = await lojista.compararSenha(senha);
    if (!ok) {
      return res.redirect('/usuariocontab/login?erro=' + encodeURIComponent('Usuário ou senha inválidos.'));
    }

    // Sessão do contab (chave própria, não conflita com sessão da loja)
    req.session.usuarioContab = {
      lojistaId:   lojista._id.toString(),   // ← chave do multi-empresa
      razao:       lojista.razao,            // "Armação Comercial Ltda"
      marca:       lojista.marca,            // "Armação"
      email:       lojista.email,
      responsavel: lojista.nomeresponsavel   // "Augusta Cavalieri"
    };

    // Regrava o cookie de sessão com id novo. Sem isso, um id de sessão
    // capturado antes do login continua válido depois dele (session fixation).
    return req.session.regenerate((err) => {
      if (err) {
        console.error('❌ regenerate sessão contab:', err.message);
        return res.redirect('/usuariocontab/login?erro=' + encodeURIComponent('Erro interno. Tente novamente.'));
      }
      req.session.usuarioContab = {
        lojistaId:   lojista._id.toString(),
        razao:       lojista.razao,
        marca:       lojista.marca,
        email:       lojista.email,
        responsavel: lojista.nomeresponsavel
      };
      return res.redirect('/usuariocontab/menu');
    });
  } catch (err) {
    console.error('❌ POST /usuariocontab/login:', err.message);
    return res.redirect('/usuariocontab/login?erro=' + encodeURIComponent('Erro interno. Tente novamente.'));
  }
});

/* ---------------------------------------------------------------
   GET /usuariocontab/menu
   Menu principal do contab (protegido).
   --------------------------------------------------------------- */
router.get('/menu', ensureContab, (req, res) => {
  res.render('contab/contabil/cooperado_menu', {
    layout: false,
    usuario: req.session.usuarioContab
  });
});

/* ---------------------------------------------------------------
   GET /usuariocontab/logout
   Encerra APENAS a sessão do contab, sem afetar outros logins
   simultâneos no mesmo navegador.
   --------------------------------------------------------------- */
router.get('/logout', (req, res) => {
  if (req.session) {
    delete req.session.usuarioContab;
  }
  return res.redirect('/usuariocontab/login');
});

module.exports = router;
module.exports.ensureContab = ensureContab;
