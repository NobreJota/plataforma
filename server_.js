const express = require('express');
const app = express();
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const morgan = require('morgan');
const passport = require('passport');
const bcrypt = require('bcryptjs');

require('dotenv').config();
require('./config/auth')(passport);
require('./src/config/multer');
require('./database/index');

app.use(express.urlencoded({extended: true}));

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname,"public")));
app.use(express.static("imagens"));
///////////////////////////////////////////////////////

/////////////////////////////////////////////////////////
// Esse é um middleware para enviar dados via formulário?


// Configura o EJS como view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configurações de sessão;
app.use(session({
  secret: process.env.SECRET || 'seusegredo',
  resave: false,
  saveUninitialized: true
}));
 
app.use(flash());
/// MORGAN
// Ativa o morgan no modo 'dev'
// app.use(morgan('dev'));

// app.get('/', (req, res) => {
//   res.send('Morgan está funcionando!??');
// });

// Middleware para tornar as mensagens flash disponíveis em todas as views
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

app.get('/flash', (req, res) => {
  req.flash('success_msg', 'Mensagem flash exibida com sucesso!');
  res.redirect('/');
});


app.use(passport.initialize());
app.use(passport.session());

const exphbs = require('express-handlebars');

//const hbs = require('hbs');
//hbs.registerHelper('moeda', (v) => {
//  const n = Number(v || 0);
//  return `R$ ${n.toFixed(2).replace('.', ',')}`;
//});
///////////////////////////////////////////////////////////////////
//hbs.registerHelper('containsId', function(id, list) {
//  if (!list) return false;
//  return list.some(item => item.toString() === id.toString());
//});
//////////////////////////////////////////////////////////////////////////

// Criação da instância do Handlebars com helpers e configurações
const hbsInstance = exphbs.create({
  defaultLayout: 'não encontrado',
  layoutsDir: __dirname + '/views/layout',
  helpers: {
    formatarDecimal: valor => {
      const num = parseFloat(valor);
      return isNaN(num) ? "" : num.toFixed(2);
    },
    json: context => JSON.stringify(context),
    inc: value => parseInt(value) + 1
  },
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    allowProtoMethodsByDefault: true,
  }
});

// Configurações do Express com Handlebars
app.engine('handlebars', hbsInstance.engine);
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
// Variáveis globais para flash messages
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

const admin = require("./src/routes/central/usuario");
const central = require("./src/routes/central/menu-admin");
const segmento = require("./src/routes/central/rotacentral");
const similares = require("./src/routes/central/rotacentral");
const simiproduto=require("./src/routes/empresa/similares");
const lojista = require("./src/routes/central/lojista");

//app.use("/uploads", express.static("uploads")); // servir imagens
//app.use("/produtoImagem", require("./src/routes/empresa/upload_foto"));


const home1 = require("./src/routes/site/home");
const usuarioloja = require("./src/routes/empresa/usuario");
const loja = require("./src/routes/empresa/rotina");
const produto = require("./src/routes/empresa/produtos");
const fornec = require("./src/routes/empresa/fornecedores");

const gravafoto=require("./src/routes/empresa/upload_foto");

app.use('/admin',admin);
app.use('/central',central);
app.use('/lojista',lojista);
app.use('/segmento',segmento);
app.use('/similares',similares);

app.use('/',home1);
app.use('/usuarioloja',usuarioloja);
app.use('/loja',loja);
app.use('/produto',produto);
app.use('/gravafoto',gravafoto);
app.use('/fornec',fornec);
app.use('/simiproduto',simiproduto);
//app.use("/produtoimagem", produtoimagem);

app.use((req, res, next) => {
  console.log('');
  console.log(`[ 145 -server.js ]>>> Chamada não tratada: ${req.method} ${req.originalUrl}`);
  console.log('');
  next();
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

////////////////////////////////////////////////
//app.engine('handlebars', handlebars.engine({ defaultLayout:'main',
//        runtimeOptions: {
//            allowProtoPropertiesByDefault: true,
//            allowProtoMethodsByDefault: true,
//        },
//}))
//////////////////////////////////////////////////////////////

