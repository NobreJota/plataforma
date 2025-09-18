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

// -------------------------------------------------------------------
// Static
// -------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));      // /css, /js, /img
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

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
  layoutsDir: path.join(__dirname, 'views', 'layout'),   // use 'layouts' se renomeou a pasta
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
    inc: (v) => parseInt(v, 10) + 1
  },
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

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

// -------------------------------------------------------------------
// Rotas
// -------------------------------------------------------------------
const admin       = require('./src/routes/central/usuario');
const central     = require('./src/routes/central/menu-admin');
const segmento    = require('./src/routes/central/rotacentral');
const similares   = require('./src/routes/central/rotacentral');
const simiproduto = require('./src/routes/empresa/similares');
const lojista     = require('./src/routes/central/lojista');

const home1       = require('./src/routes/site/home');
const usuarioloja = require('./src/routes/empresa/usuario');
const loja        = require('./src/routes/empresa/rotina');
const produto     = require('./src/routes/empresa/produtos');
const fornec      = require('./src/routes/empresa/fornecedores');
const gravafoto   = require('./src/routes/empresa/upload_foto');

app.use('/admin', admin);
app.use('/central', central);
app.use('/lojista', lojista);
app.use('/segmento', segmento);
app.use('/similares', similares);

app.use('/', home1);
app.use('/usuarioloja', usuarioloja);
app.use('/loja', loja);
app.use('/produto', produto);
app.use('/gravafoto', gravafoto);
app.use('/fornec', fornec);
app.use('/simiproduto', simiproduto);

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
  console.log(`[server] Não tratada: ${req.method} ${req.originalUrl}`);
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