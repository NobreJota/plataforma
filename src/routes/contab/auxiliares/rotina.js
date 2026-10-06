// src/routes/contab/auxiliares/rotina.js
//
// AUTENTICAÇÃO DA ÁREA CONTAB
// Alterado em 26/09/2026:
//   - login aceita email, emailloja ou contato.email (igual ao login da loja),
//     sem diferença de maiúsculas
//   - senha conferida com bcrypt direto (não depende de compararSenha no schema)
//   - regenerate preserva os outros logins do navegador (central, loja)
//   - sessão gravada antes do redirect
//   - log [login contab] com a causa exata de cada recusa
//
// Regra: o usuário do contab é o próprio LOJISTA (dono da empresa),
// usando o mesmo email e senha da loja. A diferença é só a URL de entrada.
//
// A sessão guarda `lojistaId` — chave do sistema multi-empresa. TODAS as
// queries de contab devem filtrar por esse lojistaId (etapa 2C).

const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const router   = express.Router();

// Mesmo jeito do src/routes/empresa/rotina.js: carrega o arquivo e pega o
// model registrado. Funciona exporte o arquivo o model ou não.
require('../../../models/empresa/lojista');
const Lojista = mongoose.model('lojista');

/* ---------------------------------------------------------------
   MIDDLEWARE ensureContab
   Protege rotas internas do contab. Expõe `req.lojistaId` pras rotas
   usarem como filtro: Model.find({ lojistaId: req.lojistaId })

   Duas respostas diferentes:
   - Tela (GET /contab/plano)  → redirect pro login
   - API  (GET /contab/api/..) → 401 JSON
   (sem isso o fetch recebe o HTML do login e estoura "Unexpected token '<'")

   req.lojistaId vai como ObjectId: $in, $match de aggregate e populate
   não fazem o cast de string e devolvem lista vazia em silêncio.
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
   Utilitários do login
   --------------------------------------------------------------- */
function voltarAoLogin(res, msg, email) {
  let url = '/usuariocontab/login?erro=' + encodeURIComponent(msg);
  if (email) url += '&email=' + encodeURIComponent(email);
  return res.redirect(url);
}

// Situações que liberam o acesso. Vazio/ausente também libera.
const SITUACOES_ATIVAS = ['ativo', 'ativa', 'a', 's', 'sim', 'true'];

/* ---------------------------------------------------------------
   GET /usuariocontab/login
   Se já estiver logado, pula direto pro menu.
   --------------------------------------------------------------- */
router.get('/login', (req, res) => {
  if (req.session && req.session.usuarioContab) {
    return res.redirect('/usuariocontab/menu');
  }
  res.render('contab/auxiliares/contab_login', {
    layout: false,
    erro:  req.query.erro  || '',
    email: req.query.email || ''
  });
});

/* ---------------------------------------------------------------
   POST /usuariocontab/login
   Valida email + senha do LOJISTA (coleção 'lojistas').
   --------------------------------------------------------------- */
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');

  try {
    if (!email || !senha) {
      return voltarAoLogin(res, 'Preencha email e senha.', email);
    }

    // A senha tem `select: false` no schema — precisa pedir com +senha
    const lojista = await Lojista.findOne({
      $or: [{ email }, { emailloja: email }, { 'contato.email': email }]
    })
      .collation({ locale: 'pt', strength: 2 })
      .select('+senha email razao marca nomeresponsavel situacao')
      .lean();

    if (!lojista) {
      console.log('[login contab] email não encontrado:', email);
      return voltarAoLogin(res, 'Usuário ou senha inválidos.', email);
    }

    const situacao = String(lojista.situacao ?? '').trim().toLowerCase();
    if (situacao && !SITUACOES_ATIVAS.includes(situacao)) {
      console.log('[login contab] bloqueado pela situação:', lojista.situacao, String(lojista._id));
      return voltarAoLogin(res, 'Acesso bloqueado. Contate a administração.', email);
    }

    if (!lojista.senha) {
      console.log('[login contab] lojista sem senha gravada:', String(lojista._id));
      return voltarAoLogin(res, 'Este usuário não tem senha cadastrada. Defina a senha na área central.', email);
    }

    const ok = await bcrypt.compare(senha, lojista.senha);
    if (!ok) {
      console.log('[login contab] senha não confere para', String(lojista._id));
      return voltarAoLogin(res, 'Usuário ou senha inválidos.', email);
    }

    const usuarioContab = {
      lojistaId:   String(lojista._id),        // ← chave do multi-empresa
      razao:       lojista.razao,
      marca:       lojista.marca,
      email:       lojista.email || email,
      responsavel: lojista.nomeresponsavel
    };

    // Troca o id da sessão (contra session fixation), mas preserva o que
    // já estava nela: login da central (passport), da loja, flash etc.
    // Antes, o regenerate apagava esses outros logins.
    const anterior = { ...req.session };
    delete anterior.cookie;

    return req.session.regenerate(errRegen => {
      if (errRegen) {
        console.error('[login contab] regenerate:', errRegen.message);
        return voltarAoLogin(res, 'Erro interno. Tente novamente.', email);
      }
      Object.assign(req.session, anterior);
      req.session.usuarioContab = usuarioContab;

      // grava ANTES do redirect — senão o /menu pode chegar antes da sessão
      req.session.save(errSave => {
        if (errSave) {
          console.error('[login contab] save:', errSave.message);
          return voltarAoLogin(res, 'Erro ao iniciar a sessão.', email);
        }
        console.log('[login contab] ok', usuarioContab.lojistaId, usuarioContab.razao);
        return res.redirect('/usuariocontab/menu');
      });
    });
  } catch (err) {
    console.error('[login contab] erro:', err);
    return voltarAoLogin(res, 'Erro interno. Tente novamente.', email);
  }
});

/* ---------------------------------------------------------------
   GET /usuariocontab/menu
   --------------------------------------------------------------- */
router.get('/menu', ensureContab, (req, res) => {
  res.render('contab/contabil/cooperado_menu', {
    layout: false,
    usuario: req.session.usuarioContab
  });
});

/* ---------------------------------------------------------------
   GET /usuariocontab/logout
   Encerra APENAS a sessão do contab.
   --------------------------------------------------------------- */
router.get('/logout', (req, res) => {
  if (req.session) delete req.session.usuarioContab;
  return req.session.save(() => res.redirect('/usuariocontab/login'));
});

module.exports = router;
module.exports.ensureContab = ensureContab;
