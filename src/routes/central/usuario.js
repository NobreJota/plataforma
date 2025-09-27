// routes/usuario.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Usuario = require('../../models/usuario'); // ajuste o caminho se sua pasta routes estiver em outro nível

// (Opcional) telas simples pra evitar erro de template enquanto testa
router.get('/login', (req, res) => {
  if (process.env.TEST_JSON) return res.json({ page: 'login' });
  return res.render('pages/central/loginCentral.handlebars', { layout: 'central/login.handlebars' });
});

router.get('/register', (req, res) => {
  if (process.env.TEST_JSON) return res.json({ page: 'register' });
  return res.render('pages/central/register.handlebars', { layout: 'central/admin.handlebars' });
});

// REGISTRO (com hash)
router.post('/register', async (req, res) => {
  try {
    const nome   = String(req.body.nome  || '').trim();
    const email  = String(req.body.email || '').trim().toLowerCase();
    const senha  = String(req.body.senha || '');
    const senha2 = String(req.body.senha2 || '');

    const erros = [];
    if (!nome) erros.push('Informe o nome.');
    if (!email) erros.push('Informe o e-mail.');
    if (!senha) erros.push('Informe a senha.');
    if (senha && senha.length < 6) erros.push('A senha deve ter ao menos 6 caracteres.');
    if (senha !== senha2) erros.push('As senhas não conferem.');
    if (erros.length) {
      req.flash?.('error_msg', erros.join(' '));
      return res.redirect('/usuarioloja/register');
    }

    const existe = await Usuario.findOne({ email })
      .collation({ locale: 'pt', strength: 2 })
      .select('_id')
      .lean();

    if (existe) {
      req.flash?.('error_msg', 'Este e-mail já está cadastrado.');
      return res.redirect('/usuarioloja/register');
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(senha, salt);

    await Usuario.create({
      nome,
      email,
      senha: hash,
      updateAt: new Date()
    });

    req.flash?.('success_msg', 'Cadastro realizado com sucesso! Faça login.');
    return res.redirect('/usuarioloja/login');
  } catch (err) {
    if (err && err.code === 11000) {
      req.flash?.('error_msg', 'E-mail já cadastrado.');
      return res.redirect('/usuarioloja/register');
    }
    console.error('Erro registro:', err);
    req.flash?.('error_msg', 'Falha ao registrar. Tente novamente.');
    return res.redirect('/usuarioloja/register');
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');

    const user = await Usuario.findOne({ email })
      .collation({ locale: 'pt', strength: 2 })
      .select('+senha nome email _id')
      .lean();

    if (!user) {
      req.flash?.('error_msg', 'Usuário não encontrado.');
      return res.redirect('/usuarioloja/login');
    }

    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
      req.flash?.('error_msg', 'Senha inválida.');
      return res.redirect('/usuarioloja/login');
    }

    // Exemplo de sessão (se usar express-session):
    // req.session.userId = user._id;

    if (process.env.TEST_JSON) return res.json({ login: 'ok', user: { _id: user._id, nome: user.nome, email: user.email } });

    return res.render('pages/central/centralmenu.handlebars', {
      layout: 'central/admin.handlebars',
      usuarioNome: user.nome
    });
  } catch (err) {
    console.error('Erro login:', err);
    req.flash?.('error_msg', 'Falha ao processar login.');
    return res.redirect('/usuarioloja/login');
  }
});

module.exports = router;
