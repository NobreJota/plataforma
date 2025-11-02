'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const morgan = require('morgan');
const passport = require('passport');
const { engine } = require('express-handlebars');

require('dotenv').config();
require('./config/auth')(passport);
require('./src/config/multer');

// ✅ ÚNICA importação do módulo de DB
const { connectToDatabase, mongoose } = require('./database'); // <- use SEMPRE este
//-------------------------------------------------------------------
//const pa-th = require('path');
app.use('/uploads', require('express').static(path.join(process.cwd(), 'uploads')));
// -------------------------------------------------------------------
// Static
// -------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));      // /css, /js, /img
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));
app.use(express.static(path.join(process.cwd(), 'public')));

// -------------------------------------------------------------------
// Middlewares
// -------------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));


// -------------------------------------------------------------------
// View Engine (ajuste 'layout' ou 'layouts' conforme sua pasta)
// -------------------------------------------------------------------
app.engine('handlebars', engine({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views', 'layout'),
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: {
    eq: (a, b) => String(a) === String(b),
    moeda: (v) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
        .format(Number(v || 0)),
    containsId: (id, list) =>
      Array.isArray(list) && list.some(item => String(item) === String(id)),
    formatarDecimal: (valor) => {
      const n = parseFloat(valor);
      return Number.isFinite(n) ? n.toFixed(2) : '';
    },
    json: (ctx) => JSON.stringify(ctx),
    inc: (v) => parseInt(v, 10) + 1,
    dec: (v) => Math.max(parseInt(v, 10) - 1, 1),

    // ✅ ESTES DOIS PRECISAM FICAR DENTRO DE "helpers"
    encodeURIComponent: (s) => encodeURIComponent(String(s ?? '')),
    includes: (arr, val) =>
      Array.isArray(arr) && arr.map(String).includes(String(val)),
  },
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  },
}));


app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));
app.use('/uploads', express.static(path.resolve('uploads')));

///////////////////////////////////////////////////////////////////////

const hbs = require('hbs'); 
hbs.handlebars.registerHelper('eq', (a,b) => String(a) === String(b));
hbs.handlebars.registerHelper('inc', v => Math.max(Number(v)+1, 1));
hbs.handlebars.registerHelper('dec', v => Math.max(Number(v)-1, 1));
hbs.handlebars.registerHelper('firstName', n => String(n||'').trim().split(' ')[0] || '');
// AQUI COMEÇA AJUSTE
hbs.registerHelper('firstIdSetor', p => {
  try {
      return p.localloja?.[0]?.setor?.[0]?.idSetor || '';
  } catch { return ''; }
});
hbs.registerHelper('increment', v => Number(v)+1);
hbs.registerHelper('decrement', v => Math.max(Number(v)-1,1));
hbs.registerHelper('pickImg', p => {
  const arrs = [p.pageurlS, p.pageurls, p.pageurl, p.imagens, p.images];
  for (const a of arrs){ if (Array.isArray(a) && a.length && a[0]) return a[0]; }
  const s = p.imagemUrl || p.imageUrl || p.fotoUrl || '';
  return (s && String(s).trim()) || 'https://via.placeholder.com/480x360?text=Produto';
});


// -------------------------------------------------------------------
// Sessão, flash e Passport
// -------------------------------------------------------------------
app.use(session({
  secret: process.env.SECRET || 'seusegredo',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4h
}));
 
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});
app.use(passport.initialize());
app.use(passport.session());

//const Usuario = require('./models/usuariossite');

app.use(async (req, res, next) => {
  res.locals.userSite = null;
  try {
    if (req.session?.userId) {
      const u = await Usuario.findById(req.session.userId)
        .select('nome email cidadePadrao bairroPadrao')
        .lean();
      if (u) res.locals.userSite = u;
    }
  } catch {}
  next();
});

// Evitar cache do navegador para não voltar com valores/login usuarioSite
app.use(morgan('dev'));

app.use((req, res, next) => {
  // evita que o browser mostre página antiga com selects preenchidos
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// -------------------------------------------------------------------
// Rotas
// -------------------------------------------------------------------
const admin       = require('./src/routes/central/usuario');
const central     = require('./src/routes/central/menu-admin');
const atividades  = require('./src/routes/central/atividades');
const segmento    = require('./src/routes/central/rotacentral');
const similares   = require('./src/routes/central/rotacentral');
const simiproduto = require('./src/routes/empresa/similares');
const lojista     = require('./src/routes/central/lojista');
const paineis     = require('./src/routes/central/paineis');
const paineisSecoes = require('./src/routes/central/paineis-secoes');

const home        = require('./src/routes/site/home');
const usuarioloja = require('./src/routes/empresa/usuario');
const loja        = require('./src/routes/empresa/rotina');
const produto     = require('./src/routes/empresa/produtos');
const cadproduto  = require("./src/routes/empresa/produto_cadastro")
const fornec      = require('./src/routes/empresa/fornecedores');
const gravafoto   = require('./src/routes/empresa/upload_foto');
const ajuste      = require('./src/routes/empresa/ajuste');
const auth = require('./src/routes/auth');

const UsuarioSite = require('./src/models/usuariosite');

app.use(async (req, res, next) => {
  res.locals.userSite = null;
  try{
    if (req.session?.userId){
      const u = await UsuarioSite.findById(req.session.userId)
        .select('nome email')
        .lean();
      if (u) res.locals.userSite = u;
    }
  }catch(_){}
  next();
});

app.use('/admin', admin);
app.use('/central', central);
app.use('/lojista', lojista);
app.use('/segmento', segmento);
app.use('/similares', similares);
app.use('/atividades',atividades);
app.use('/paineis',paineis);
app.use('/paineisecoes', paineisSecoes);

app.use('/', home);
app.use('/usuarioloja', usuarioloja);
app.use('/loja', loja);
app.use('/produto', produto);
app.use('/cadproduto',cadproduto);
app.use('/gravafoto', gravafoto);
app.use('/fornec', fornec);
app.use('/simiproduto', simiproduto);
app.use('/ajuste',ajuste);
app.use('/', auth.router);


// -------------------------------------------------------------------
// Healthchecks (usam o MESMO mongoose importado no topo)
// -------------------------------------------------------------------
const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

app.get('/health/live', (_req, res) => res.sendStatus(200));

app.get('/health/db', async (_req, res) => {
  const { connection } = mongoose;
  const state = STATES[connection.readyState] ?? 'unknown';

  const out = {
    state,
    readyState: connection.readyState,
    dbName: connection.name || null,
    host: connection.host || null,
  };

  if (connection.readyState === 1) {
    try {
      await connection.db.admin().command({ ping: 1 });
      out.ping = 'ok';
      return res.status(200).json(out);
    } catch {
      out.ping = 'fail';
    }
  }
  res.status(503).json(out);
});

// Chrome devtools check
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req,res)=>res.status(204).end());

// 404
app.use((req, _res, next) => {
  console.log('');
  console.log(`[server] Não tratada: ${req.method} ${req.originalUrl}`);
  console.log('...........................................');
  next();
});
app.use((_, res) => res.status(404).send('404 - Página não encontrada'));

// -------------------------------------------------------------------
// Boot: conecta no Mongo ANTES de ouvir porta
// -------------------------------------------------------------------
(async () => {
  try {
    await connectToDatabase(); // ✅ único ponto de conexão
    const PORT = process.env.PORT || 5000;
    console.log('');
    app.listen(PORT, () => console.log(`HTTP on ${PORT}`));
  } catch (err) {
    console.error('❌ Falha ao conectar no Mongo:', err);
    process.exit(1);
  }
})();