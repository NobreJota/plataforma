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
// Middleware para evitar qualquer cache no cliente e proxies
// const noStore = (req, res, next) => {
//   res.set({
//     'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
//     'Pragma': 'no-cache',
//     'Expires': '0',
//     'Surrogate-Control': 'no-store'
//   });
//   next();
// };
function formatarDecimalDeCentavos(valor) {
  if (valor == null) return '';
    
  const num=Number(valor);
  if (!Number.isFinite(num)) return '';

  const reais= num/100; // 8343 -> 83.43

  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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

          firstName(full) {
            return (full || '').toString().trim().split(/\s+/)[0] || 'Visitante';
          },
          formatLocalloja(item) {
                 try {
                  if (!item || !Array.isArray(item.localloja) || item.localloja.length === 0) {
                    return "";
                  }

                  const loc = item.localloja[0];

                  // =====================================================
                  // 1) DEPARTAMENTO  (coleção "departamentos")
                  // =====================================================
                  let deptNome = "";
                  if (Array.isArray(loc.departamento) && loc.departamento.length > 0) {
                    const d = loc.departamento[0];

                    deptNome =
                      d.nomeDepartamento ||   // <- seu campo
                      d.nome ||
                      d.descricao ||
                      "";
                  }

                  // =====================================================
                  // 2) SETOR  (coleção "deptosetores")
                  // =====================================================
                  let setorNome = "";
                  if (Array.isArray(loc.setor) && loc.setor.length > 0) {
                    const s = loc.setor[0].idSetor || loc.setor[0];

                    setorNome =
                      s.nomeDeptoSetor ||     // <- seu campo (Material de Construção-elétrica)
                      s.nomeSetor ||
                      s.nome ||
                      s.descricao ||
                      "";
                  }

                  // =====================================================
                  // 3) SEÇÃO  (coleção "deptosecoes")
                  // =====================================================
                  let secaoNome = "";
                  if (Array.isArray(loc.setor?.[0]?.secao) && loc.setor[0].secao.length > 0) {
                    const sc = loc.setor[0].secao[0].idSecao || loc.setor[0].secao[0];

                    secaoNome =
                      sc.nameSecao ||         // <- seu campo (Caixas)
                      sc.nome ||
                      sc.descricao ||
                      "";
                  }

                  // =====================================================
                  // 4) TEXTO FINAL
                  // =====================================================
                  const texto = [deptNome, setorNome, secaoNome]
                    .filter(v => v && String(v).trim() !== "")
                    .join(" / ");

                  console.log("formatLocalloja =>", texto);
                  return texto;

                } catch (e) {
                  console.log("ERRO formatLocalloja =>", e);
                  return "";
                }  
          },
          formatarDecimal_precocusto(valor) {
            return formatarDecimalDeCentavos(this.precocusto);
          },
          formatarDecimal_precovista(valor) {
            return formatarDecimalDeCentavos(this.precovista);
          },
          formatarDecimal_precoprazo(valor) {
            return formatarDecimalDeCentavos(this.precoprazo);
          },
           formatCurrency(value) {
              if (!value) return '0,00';

              // Decimal128, Number ou string
              const num = Number(value.toString());
              if (Number.isNaN(num)) return '0,00';

                return num
                .toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
              });
          },
              },
              runtimeOptions: {
                allowProtoPropertiesByDefault: true,
                allowProtoMethodsByDefault: true,
              },
          }
));


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

hbs.handlebars.registerHelper('includes', function(arr, val) {
  return Array.isArray(arr) && arr.includes(val);
});
//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
//hbs.registerHelper('eq', (a, b) => String(a) === String(b));

hbs.registerHelper('formatLocalloja', function (item) {
  try {
    if (!item || !Array.isArray(item.localloja) || item.localloja.length === 0) {
      return "";
    }

    const loc = item.localloja[0];
    console.log( 'loc ',loc)
    // 1) DEPARTAMENTO
    let deptNome = "";
    const dArr = loc.departamento;

    if (Array.isArray(dArr) && dArr.length > 0) {
      const d = dArr[0];

      if (typeof d === "object") {
        deptNome = d.nome || d.descricao || "";
      } else {
        deptNome = String(d);
      }
    }

    // 2) SETOR
    let setorNome = "";
    if (Array.isArray(loc.setor) && loc.setor.length > 0) {
      const s = loc.setor[0];

      if (typeof s === "object") {
        setorNome = s.nome || s.descricao || "";
      } else {
        setorNome = String(s);
      }
    }

    // 3) SEÇÃO
    let secaoNome = "";
    if (Array.isArray(loc.setor) && loc.setor.length > 0) {
      const s = loc.setor[0];

      if (Array.isArray(s.secao) && s.secao.length > 0) {
        const sc = s.secao[0];

        if (typeof sc === "object") {
          secaoNome = sc.nome || sc.descricao || "";
        } else {
          secaoNome = String(sc);
        }
      }
    }

    // 🔥 Monta o texto final
    const texto = [deptNome, setorNome, secaoNome].filter(v => v).join(" / ");

    return texto || "";
  }
  catch (e) {
    console.log("ERRO formatLocalLoja =>", e);
    return "";
  }
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


const UsuarioSite = require('./src/models/usuariosite');

app.use(async (req, res, next) => {
  res.locals.userSite = null;

  try {
    if (req.session?.userId) {
      const u = await UsuarioSite.findById(req.session.userId)
        .select('nome email cidadePadrao bairroPadrao') // traga o que usa no site
        .lean();
      if (u) res.locals.userSite = u;
    }
  } catch (e) {
    // opcional: console.warn('[userSite mw]', e.message);
  }

  // 👉 calcula firstName aqui (AGORA existe res)
  const nome = res.locals.userSite?.nome || res.locals.userSite?.name || '';
  res.locals.firstName = (nome.trim().split(/\s+/)[0]) || 'Visitante';

  next();
});

// app.use(async (req, res, next) => {
//   res.locals.userSite = null;
//   try {
//     if (req.session?.userId) {
//       const u = await UsuarioSite.findById(req.session.userId)
//         .select('nome email cidadePadrao bairroPadrao')
//         .lean();
//       if (u) res.locals.userSite = u;
//     }
//   } catch (e) {
//     // opcional: console.warn('[userSite mw]', e.message);
//   }
//   next();
// });

//const nome = res.locals.userSite?.nome || res.locals.userSite?.name || '';
//res.locals.firstName = (nome.trim().split(/\s+/)[0]) || 'Visitante';

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
const atividades  = require('./src/routes/central/atividades'); // controla as foto dos departamentos e dos setores 
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
const cadproduto  = require("./src/routes/empresa/produto_cadastro");
const importtabela  = require("./src/routes/empresa/produto_import");
const importItensRoutes = require('./src/routes/empresa/produto_import');
const editimagem  = require("./src/routes/empresa/produtoeditimagem");
const fornec      = require('./src/routes/empresa/fornecedores');
const gravafoto   = require('./src/routes/empresa/upload_foto');
const ajuste      = require('./src/routes/empresa/ajuste');
const auth = require('./src/routes/auth');



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
app.use('/importtabela',importtabela);
app.use(importItensRoutes);
app.use('/gravafoto', gravafoto);
app.use('/fornec', fornec);
app.use('/simiproduto', simiproduto);
app.use('/ajuste',ajuste);
app.use('/', auth.router);
app.use('/editimagem',editimagem);

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