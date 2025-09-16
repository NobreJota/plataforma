// server.js
'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const morgan = require('morgan');
const passport = require('passport');
const bcrypt = require('bcryptjs'); // (se usar em algum lugar)
const { engine } = require('express-handlebars');

require('dotenv').config();
require('./config/auth')(passport);
require('./src/config/multer');
require('./database/index');

// -------------------------------------------------------------------
// Middlewares básicos
// -------------------------------------------------------------------
app.use(express.urlencoded({ extended: true })); // aceita POST de forms
app.use(express.json());
app.use(cors());
app.use(morgan('dev'));

// Arquivos estáticos
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------------
// View Engine: express-handlebars
// -------------------------------------------------------------------
app.engine('handlebars', engine({
  defaultLayout: 'main', // espera views/layouts/main.handlebars
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
  cookie: {
    maxAge: 1000 * 60 * 60 * 4 // 4h (ajuste se quiser)
  }
}));

app.use(flash());

// Disponibiliza mensagens flash em todas as views
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
const admin       = require("./src/routes/central/usuario");
const central     = require("./src/routes/central/menu-admin");
const segmento    = require("./src/routes/central/rotacentral");
const similares   = require("./src/routes/central/rotacentral");
const simiproduto = require("./src/routes/empresa/similares");
const lojista     = require("./src/routes/central/lojista");

const home1       = require("./src/routes/site/home");
const usuarioloja = require("./src/routes/empresa/usuario");
const loja        = require("./src/routes/empresa/rotina");
const produto     = require("./src/routes/empresa/produtos");
const fornec      = require("./src/routes/empresa/fornecedores");
const gravafoto   = require("./src/routes/empresa/upload_foto");

// Montagem das rotas
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

// Log para rotas não tratadas (debug)
app.use((req, res, next) => {
  console.log('');
  console.log(`[145 - server.js] >>> Chamada não tratada: ${req.method} ${req.originalUrl}`);
  console.log('');
  next();
});

// -------------------------------------------------------------------
// Start
// -------------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
