const express = require('express');
const bcrypt = require('bcryptjs');
const UsuarioSite = require('../models/usuariosite');
const router = express.Router();

const multer = require('multer');
const upload = multer();

router.get('/', async (req, res) => {
  const user = res.locals.userSite; // vem do middleware

  // Caso tenha filtros em querystring (ou sessão), eles prevalecem.
  const cidadeSelecionada =
    req.query.municipio ||
    (req.session?.filtros?.municipio) ||
    (user?.cidadePadrao) || '';

  const bairroSelecionado =
    req.query.loja ||
    (req.session?.filtros?.bairro) ||
    (user?.bairroPadrao) || '';

  // Render
  res.render('pages/site/home', {
    // ...
    cidadeSelecionada,
    bairroSelecionado,
  });
});

/* GET /login */
router.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect('/pos-login');
  res.render('pages/site/login.handlebars', { layout: false, erro: req.query.e });
});

/* POST /login */
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    console.log(' email => ',email)
    const u = await UsuarioSite.findOne({ email });
    if (!u) return res.redirect('/login?e=Email%20ou%20senha%20inv%C3%A1lidos');

    const ok = await u.checkPassword(senha);
    if (!ok) return res.redirect('/login?e=Email%20ou%20senha%20inv%C3%A1lidos');

    u.visitas = (u.visitas || 0) + 1;
    u.lastLogin = new Date();
    await u.save();

    req.session.userId = u._id;
    return res.redirect('/pos-login'); // << aqui é o destino certo
  } catch (e) {
    console.error(e);
    res.redirect('/login?e=Erro%20inesperado');
  }
});
 

// INSERIR
/* GET /site/registrar */
router.get('/site/registrar', (req, res) => {
  if (req.session?.userId) return res.redirect('/pos-login');
  res.render('pages/site/registrar-site.handlebars', { layout: false, erro: req.query.e });
});

/* POST /site/registrar */
router.post('/site/registrar', async (req, res) => {
  try{
    const nome  = String(req.body.nome||'').trim();
    const email = String(req.body.email||'').trim().toLowerCase();
    const senha = String(req.body.senha||'');
    const senha2= String(req.body.senha2||'');

    const erros = [];
    if (!email) erros.push('Informe o e-mail.');
    if (!senha || senha.length < 6) erros.push('Senha deve ter ao menos 6 caracteres.');
    if (senha !== senha2) erros.push('As senhas não conferem.');
    if (erros.length) return res.status(400).render('pages/site/registrar-site.handlebars', { layout:false, erro: erros.join(' ') });

    const ja = await UsuarioSite.findOne({ email }).lean();
    if (ja) return res.status(400).render('pages/site/registrar-site.handlebars', { layout:false, erro: 'E-mail já cadastrado.' });

    const bcrypt = require('bcryptjs');
    const senhaHash = await bcrypt.hash(senha, 10);

    const novo = await UsuarioSite.create({
      nome, email, senhaHash,
      profileCompleted: !!nome
    });

    // loga automaticamente
    req.session.userId = novo._id.toString();
    return res.redirect('/pos-login');
  }catch(e){
    console.error(e);
    return res.status(500).render('pages/site/registrar-site.handlebars', { layout:false, erro: 'Erro ao cadastrar. Tente novamente.' });
  }
});
// linha POSTERIOR (ex.: router.get('/logout'...) )


/* GET /logout */
router.get('/logout', (req, res) => {
   try {
    delete req.session.userId;
    delete req.session.filtros;   // se você estiver guardando filtros na sessão
    req.session.regenerate(err => {
      if (err) return res.redirect('/?t=logout_err');
      res.clearCookie('connect.sid');       // derruba cookie de sessão
      return res.redirect('/?t=logout_ok'); // redireciona para home “limpa”
    });
  } catch {
    return res.redirect('/?t=logout_ok');
  }
});

/* middleware simples */
function ensureAuth(req,res,next){
  if (!req.session?.userId) return res.redirect('/login');
  next();
}

/* decide se mostra modal de cadastro ou vai direto pra home-logado */
router.get('/pos-login', ensureAuth, async (req,res)=>{
  const u = await UsuarioSite.findById(req.session.userId).lean();
  if (!u) return res.redirect('/login');

  res.render('pages/site/home-logado.handlebars', {
    layout: false,
    userSite: { nome: u.nome || u.email, visitas: u.visitas },
    showOnboarding: (!u.profileCompleted && !u.nome) 
  });
});

/* endpoint para marcar profileCompleted (quando salvar o mini cadastro) */
router.post('/perfil/concluir', ensureAuth, upload.none(), async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  await UsuarioSite.updateOne(
    { _id: req.session.userId },
    { $set: { nome, profileCompleted: true } }
  );
  res.json({ ok: true });
});

// salvar cidade/bairro padrão
router.post('/perfil/local', ensureAuth, upload.none(), async (req, res) => {
  const cidade = String(req.body.cidade || '').trim();
  const bairro = String(req.body.bairro || '').trim();
  await UsuarioSite.updateOne(
    { _id: req.session.userId },
    { $set: { cidadePadrao: cidade, bairroPadrao: bairro } }
  );
  res.json({ ok: true });
});
function ensureAuth(req,res,next){
  if (!req.session?.userId) return res.redirect('/login');
  next();
}


module.exports = { router, ensureAuth };
