const express=require('express')
const router=express.Router()
const mongoose = require('mongoose');

// const Ddocumento  = require('../../models/arquivoDoc');     // produtos
const Ddocumento=mongoose.model("arquivo_doc")
const Lojista = require('../../models/lojista');              // lojas
const Departamento = require('../../models/departamento');    // segmentos
const DeptoSetor   = require('../../models/deptosetores');    // admin.deptosetores
const DeptoSecao = require('../../models/deptosecao');
const ArquivoDoc=require('../../models/arquivoDoc');
const Parceiro = require('../../models/parceiro');
const HomeLayout = require('../../models/home_layout'); 
const ListaPedido = require("../../models/lista-pedido"); // seu model

// ✅ adapte conforme seu login
// Se você usa req.user, ok. Se usa req.session.usuario, troque aqui.
function getUsuarioId(req) {
  return req.user?._id || req.session?.usuario?._id || null;
}

async function getOrCreateLista(usuarioId) {
  let lista = await ListaPedido.findOne({ usuario: usuarioId });
  if (!lista) lista = await ListaPedido.create({ usuario: usuarioId, itens: [] });
  return lista;
}


// <<< função de normalizar descrição (igual ao schema)
function normDesc(s = '') {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // tira acentos
    .toLowerCase()
    .trim();
}
const { render } = require('express/lib/response');

const CIDADES_ES = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'];

// helper pra regex segura
const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// helper para escapar caracteres especiais de RegExp
const escapeRx = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ACCENT_GROUPS = {
      a: 'aáàâãä',
      e: 'eéèêë',
      i: 'iíìîï',
      o: 'oóòôõö',
      u: 'uúùûü',
      c: 'cç',
      n: 'nñ'
    };
function makeAccentPattern(q = '') {
  const base = normDesc(q);
  if (!base) return '';

  const termos = base
    .split(/\s+/)
    .filter(Boolean);

  if (!termos.length) return '';

  return termos.join('.*');
}

const norm = s => String(s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().trim();

  const noStore = (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
};

function decToNumber(v){
  if (v == null) return null;

  // Decimal128 no mongoose tem .toString()
  const n = (typeof v === 'object' && typeof v.toString === 'function')
    ? Number(v.toString())
    : Number(v);

  if (!Number.isFinite(n)) return null;

  return n / 100;
}

async function montarMenus(baseFilter, depSelecionado, setorSelecionado) {
  // 1) Departamentos – já estava ok
  const depIds = await ArquivoDoc.distinct('localloja.departamento', baseFilter);

  let departamentosMenu = [];
  if (depIds && depIds.length) {
    const deps = await Departamento
      .find({ _id: { $in: depIds } })
      .sort('nomeDepartamento')
      .lean();

    departamentosMenu = deps.map(d => ({
      _id:  d._id.toString(),
      nome: d.nomeDepartamento
    }));
  }

  // 2) SETORES — só os que aparecem em ArquivoDoc dessa LOJA + DEP
  let setoresMenu = [];
  if (depSelecionado) {
    const filtroSetor = {
      ...baseFilter,
      'localloja.departamento': depSelecionado
    };

    const setorIds = await ArquivoDoc.distinct('localloja.setor.idSetor', filtroSetor);
    console.log('');
    //console.log(' [ 449 ] => ',setorIds)
    
    if (setorIds && setorIds.length) {
      const setores = await DeptoSetor
        .find({ _id: { $in: setorIds } })
        .sort('nomeDeptoSetor')
        .lean();

      setoresMenu = setores.map(s => ({
        _id:  s._id.toString(),
        nome: s.nomeDeptoSetor
      }));
    }
  }

  // 3) SEÇÕES — só as que aparecem em ArquivoDoc dessa LOJA + SETOR
  let secoesMenu = [];
  if (setorSelecionado) {
    const filtroSecao = {
      ...baseFilter,
      'localloja.setor.idSetor': setorSelecionado
    };

    const secaoIds = await ArquivoDoc.distinct('localloja.setor.secao.idSecao', filtroSecao);
    console.log('secaoId',secaoIds)

    if (secaoIds && secaoIds.length) {
      //console.log('dentro!')
      const secoes = await DeptoSecao
        .find({ _id: { $in: secaoIds } })
        .sort('nameSecao')
        .lean();
      // console.log(' ===> ',secoes)
      secoesMenu = secoes.map(s => ({
        _id:  s._id.toString(),
        nome: s.nameSecao
      }));
    }
  }

  return { departamentosMenu, setoresMenu, secoesMenu };
}

// ==== no topo do arquivo da rota home.js (ou equivalente) ====
const IMG_HTTP_RX     = /^https?:\/\/.+/i;             // imagem http/https
// ?????????????????????????????????????????????????????????????????????????????????????????
const TARGET_DEPTO_RX = /^e[\s-]?commerce$/i;          // "E-commerce" com ou sem hífen/space
const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
    <rect width="100%" height="100%" fill="#e5e7eb"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
          font-family="Arial" font-size="24" fill="#6b7280">Atividade</text>
  </svg>`);
  //???????????????????????????????????????????????????????????????????????????????????

// CARREGA A PARTE COMPRAS ONLINE COMO PADRÂO /
router.get('/', async (req, res) => {
     try {
          // 1️⃣ todos os departamentos ativados → botões do topo
          const deps = await Departamento
            .find({ ativado: 1 }, 'nomeDepartamento ativado imagemUrl')
            .sort({ nomeDepartamento: 1 })
            .lean();

          const rotaEspecial = {
              "Serviços": "/home-servico",
              "Turismo": "/home-turismo",
            };

           const departamentosView = deps.map(d => {
              const nome = (d.nomeDepartamento || "").trim();

              return {
                nomeDepartamento: nome,
                imagemUrl: d.imagemUrl || "/img/placeholder.png",
                ativado: d.ativado === 1 || d.ativado === true,

                // ✅ se for "Serviços" ou "Turismo" vai para rota própria
                // ✅ senão mantém seu comportamento atual
                url: rotaEspecial[nome] || `/?segmento=${encodeURIComponent(nome)}`
              };
            });


          // const departamentosView = deps.map(d => ({
          //   nomeDepartamento: d.nomeDepartamento,
          //   imagemUrl: d.imagemUrl || '/img/placeholder.png',
          //   ativado: d.ativado === 1 || d.ativado === true,
          //   url: `/?segmento=${encodeURIComponent(d.nomeDepartamento)}`
          // }));
          console.log('');
          console.log('_________________________________________________');  
          
          // 2️⃣ define departamento alvo
          const segmentoIn = (req.query.segmento || '').trim();
          //const isFirstLoad = !segmentoIn;
          const alvoNome = segmentoIn || 'Compras Online';

          // 2.1) HOME LAYOUT (hero / destaques / lateral) — NÃO altera seu fluxo
          const layoutHome = await HomeLayout.findOne({ nome: 'default' }).lean();

          const agora = new Date();
          const slots = layoutHome?.slots || [];

          // filtro por ativo + janela de data + (opcional) segmento
          const slotsAtivos = slots.filter(s => {
            if (!s?.ativo) return false;
            if (s.startAt && agora < new Date(s.startAt)) return false;
            if (s.endAt && agora > new Date(s.endAt)) return false;

            // se o slot tiver segmento preenchido, só aparece quando segmentoIn bater
            if (s.segmento && s.segmento.trim() && s.segmento.trim().toLowerCase() !== (segmentoIn || '').trim().toLowerCase()) {
              return false;
            }

            return true;
      });

      const homeHero      = slotsAtivos.filter(s => s.tipo === 'hero').sort((a,b)=> (a.ordem||0)-(b.ordem||0));
      const homeDestaques = slotsAtivos.filter(s => s.tipo === 'destaque').sort((a,b)=> (a.ordem||0)-(b.ordem||0));
      const homeLateral   = slotsAtivos.filter(s => s.tipo === 'lateral').sort((a,b)=> (a.ordem||0)-(b.ordem||0));

          // 🔍 busca o documento real do departamento (por nome, mas para capturar o _id)
          const depAlvo = await Departamento.findOne({
            nomeDepartamento: { $regex: new RegExp(`^${alvoNome}$`, 'i') }
          }, '_id nomeDepartamento ativado ').lean();
          //::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
          console.log('');
          console.log('B1000',departamentosView[3]); 
          console.log('______________________________________________________________');
          // ::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
          if (!depAlvo?._id) {
            return res.render('pages/site/home.handlebars', {
              layout:false,
              departamentos:departamentosView,
              segmentoAtual: depAlvo?.nomeDepartamento || 'Compras Online',
              homeHero,
              homeDestaques,
              homeLateral,
            });
          }

          if (depAlvo.ativado !== 1) return res.redirect('/');
    
          // 3️⃣ agora filtra SETORES pelo _id do departamento (e não pelo nome!)
          const IMG_HTTP_RX = /^https?:\/\/.+/i;
          const setoresQuery = {
              idDepto: depAlvo._id,
              imagemUrl: { $regex: IMG_HTTP_RX }  // <- sempre exigindo URL completa
          };

          // const setores = await DeptoSetor
          //   .find(setoresQuery, '_id nomeDeptoSetor imagemUrl idDepto slug')
          //   .sort({ nomeDeptoSetor: 1 })
          //   .lean();

          // console.log('');  
          // console.log('[ line 242 ] router.get("/buscar") => setores :',setores);
          // console.log('');
          // // 4️⃣ monta cards
          // const atividades = setores.map(s => ({
          //   _id:s._id,
          //   nome: s.nomeDeptoSetor,
          //   titulo: s.nomeDeptoSetor,
          //   imagemUrl: (s.imagemUrl && IMG_HTTP_RX.test(s.imagemUrl)) ? s.imagemUrl : '/img/placeholder.png',
          //   href: `/produtos?segmento=${encodeURIComponent(depAlvo.nomeDepartamento)}&setor=${encodeURIComponent(s.nomeDeptoSetor)}`
          // }));

          // 5️⃣ renderiza
            return res.render('pages/site/home.handlebars', {
            layout: 'site/home.handlebars',      // ajuste se seu layout for outro
            departamentos:departamentosView,// p/ botões
            segmentoAtual: depAlvo?.nomeDepartamento || 'Compras Online',
            homeHero,
            homeDestaques,
            homeLateral,
          });

  } catch (err) {
    console.error('[GET /home]', err);
    return res.status(500).send('Erro ao carregar a Home');
  }

});

// CARREGA OS PRODUTOS DA SECAO
router.get('/produtos', async (req, res) => {
  
    try {
        const lojistaId = req.query.lojista;   // vem da URL ?lojista=...
        const page      = Number(req.query.page || 1);
        const limit     = Number(req.query.limit || 50);

        // -------- FILTROS VINDOS DA URL ----------
        // ?ativo=S (Ativos) | N (Inativos) | T (Todos)
        // ?fornecedor=ID_DO_FORNECEDOR ou "todos"
        const filtroAtivo       = req.query.ativo       || 'S';     // default = Ativos
        const filtroFornecedor  = req.query.fornecedor  || 'todos'; // default = Todos

        if (!lojistaId) {
          return res.status(400).send('lojista é obrigatório');
        }

        // ----------- MONTAR FILTRO DO MONGO -------------
        const filtroMongo = { loja_id: lojistaId };

        // Ativo / inativo
        if (filtroAtivo === 'S') {
          filtroMongo.ativo = true;
        } else if (filtroAtivo === 'N') {
          filtroMongo.ativo = false;
        }
        // se for 'T' (todos), não filtra por ativo

        // Fornecedor selecionado
        if (filtroFornecedor !== 'todos') {
          filtroMongo.fornecedor = filtroFornecedor;
        }

        // --------- PEGAR PRODUTOS PAGINADOS -------------
        const resultado = await ArquivoDoc.paginate(filtroMongo, {
          page,
          limit,
          sort: { descricao: 1 }  // ou como você já faz aí
        });

        const produtos = resultado.docs;

        // --------- LISTA DE FORNECEDORES COM PRODUTOS -------------
        // Só fornecedores que têm produto desta loja
        const fornsIds = await ArquivoDoc.distinct('fornecedor', {
          loja_id: lojistaId
        });

        const fornecedores = await Fornecedor
          .find({ _id: { $in: fornsIds } })
          .sort({ fantasia: 1 });   // ou razao/nome, etc.

        // --------- RENDERIZAR VIEW -------------
        res.render('pages/site/home.handlebars', {
          layout: 'site/home',                 // se você usa ou não layout
          lojistaId,
          produtos,
          fornecedores,

          // filtros atuais (para marcar selected no HTML)
          filtroAtivo,
          filtroFornecedor,

          // paginação
          page,
          totalPages: resultado.totalPages,
          totalDocs: resultado.totalDocs,
        });

      } catch (err) {
        console.error('Erro ao listar produtos:', err);
        return res.status(500).send('Erro ao listar produtos');
      }
});

// BUSCA OS BAIRRO DO LOJISTA
router.get('/bairros',noStore, async (req, res) => {
  // consolxe.log('');
  // consolxe.log( ' [ 205 ] => src/routes/site/home.js//bairros');
  // consoxxe.log(req.query)
  // consolxe.log('');
  ////////////////////////////////////////////////////////////
  try {
   const cidade = (req.query.cidade || '').trim();
    if (!cidade) return res.json([]);
    
    // Case-insensitive, casa exatamente a cidade
    const re = new RegExp(`^${cidade}$`, 'i');

    // Pegue a lista distinta de bairros (ajuste o campo se o nome for diferente)
    const bairros = await Lojista.distinct('bairro', {
      cidade: re,
      bairro: { $exists: true, $ne: '' }
    });
    // Ordena alfabeticamente
    res.json(bairros.sort((a,b) => a.localeCompare(b)));
  } catch (e) {
     console.log('');
     console.log('Error catch');
     console.error('GET /home1/bairros', e);
     console.log('');
     res.json({ ok: false, items: [] });
  }
});

// VAI BUSCAR OS PRODUTOS DE ACORDO COM A CIDADE BAIRRO
router.get('/buscar', async (req, res) => {
  console.log('');
  console.log('router.get("/buscar,"',req.query)
  console.log('');
  try {
    const { q = '', municipio = '', bairro = '', IdProd = '',lojaId    = '' } = req.query;

    const filtro= {
      ativo: true,                      // só produto ativado
      qte:   { $gt: 0 },                // só quem tem estoque
      pageurls: {                       // pelo menos 1 imagem
        $exists: true,
        $not: { $size: 0 }
      }
    };

    if (municipio) filtro.cidade = municipio;
    if (bairro)    filtro.bairro = bairro;
    


    if (IdProd) {
      // busca o produto base para copiar descrição / seção
      const base = await Ddocumento.findById(IdProd).lean();

      if (base) {
        // se você tiver um campo normalizado, use ele aqui
        // ex.: filtro.descricaoNorm = base.descricaoNorm;
        filtro.descricao = base.descricao;

        // se tiver id da seção / categoria, filtre também
        if (base.idSecao) {
          filtro.idSecao = base.idSecao;    // ajuste pro nome real
        }
      }

      // limitar para a mesma loja, se você estiver enviando isso
      if (lojaId) {
        filtro.loja_id = lojaId;            // campo real no schema
      } 
    }
    else if (q.trim()) {
         const pattern = makeAccentPattern(q);   // <<< NOVO
         if (pattern) {
            const rx = new RegExp(pattern, 'i');
            filtro.descricao = { $regex: rx };
          }
    }
  
   
    console.log('FILTRO /buscar', filtro)
    const produtos = await Ddocumento.find(filtro)
      .populate('fornecedor', 'razao')
      .lean();
     console.log('');
     console.log('1000 /buscar produtos.length =>', produtos.length);
     console.log('');
     console.log('_______________________________________________');
      // >>> NOVO: mesmos departamentos que você usa na rota "/"
    const departamentosAtivos = await Departamento
      .find({ ativado: true })       // se na tua rota "/" tiver outro filtro (exibehome, etc),
      .sort({ ordem: 1 })          // copie exatamente o mesmo aqui
      .lean();


    // monta as listas para re-popular a UI
    const CIDADES_ES      = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'];
    const bairrosDaCidade = municipio
      ? await Lojista.distinct('endereco.bairro', { 'endereco.cidade': municipio })
      : [];

    console.log(' dentro de /buscar')  
    res.render('pages/site/home', {
      layout: 'site/home',
      q,
      cidades: CIDADES_ES,
      cidadeSelecionada: municipio,
      bairros: (bairrosDaCidade || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      bairroSelecionado: bairro,
      produtos,
      // >>> NOVO: manda os departamentos para a view
      departamentosAtivos,
      segmentoAtual: ''   // aqui não precisa ativar nenhum botão; fica tudo “neutro”
    });
  } catch (e) {
    console.error('Erro em /buscar', e);
    res.status(500).render('pages/site/home', {
      layout: 'site/home',
      q: req.query.q || '',
      cidades: ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'],
      produtos: [],
      departamentosAtivos: [],
      segmentoAtual: ''
    });
  }
});

// busca sugestões de palavra acima de 3 letras
router.get('/buscar-sugestoes', noStore, async (req, res) => {
  try {
    console.log("AQUI => /buscar-sugestoes :");
    console.log('req.query',req.query)
    const q = String(req.query.q || '').trim();
    const municipio = String(req.query.cidade || req.query.municipio || '').trim();
    const bairro = String(req.query.bairro || '').trim();

    if (q.length < 3) return res.json([]);

    const pattern = makeAccentPattern(q);
    if (!pattern) return res.json([]);
    const rx = new RegExp(pattern, 'i');

    const match = {
      ativo: true,
      qte: { $gt: 0 },
      pageurls: { $exists: true, $not: { $size: 0 } },
      descricaoNorm: { $regex: rx },
    };

    if (municipio) match.cidade = municipio;
    if (bairro) match.bairro = bairro;

    const docs = await Ddocumento.aggregate([
      { $match: match },

      // opcional: melhora consistência de acento
      { $sort: { loja_id: 1, qte: -1, updatedAt: -1 } },

      // 1 resultado por loja
      { $group: { _id: "$loja_id", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },

      { $limit: 10 },

      { $project: {
        _id: 1,
        loja_id: 1,
        descricao: 1,
        marcaloja: 1,
        cidade: 1,
        bairro: 1,
        precoprazo:1
      }}
    ]);

    const sugestoes = docs.map(d => ({
      idProd: String(d._id),
      descricao: d.descricao || '',
      loja: d.marcaloja || '',
      cidade: d.cidade || '',
      bairro: d.bairro || '',
      preco: d.precoprazo || '',
      lojaId: d.loja_id ? String(d.loja_id) : ''
    }));
    console.log('5000',sugestoes)
    return res.json(sugestoes);
  } catch (e) {
    console.error('erro /buscar-sugestoes', e);
    return res.json([]);
  }
});

router.get('/setor/:idSetor', async (req, res) => {
  console.log('');
  console.log(' [ line 389 ] src/routes/site/home.js//setor/:idSetor');
  console.log('');
  console.log(' [ line 391 ] ',req.params);
  console.log('_____________________________________________________________________');
  try {
        const idSetor=req.params.idSetor
        //const n=req.params.idSetor//
        //console.log('vr de N',n)
        const setor = await DeptoSetor
          .findById(idSetor, 'nomeDeptoSetor idDepto')
          .populate({ path: 'idDepto', select: 'nomeDepartamento' })
          .lean();

        if (!setor) return res.status(404).send('Setor não encontrado');

        // só seções COM imagem (http/https OU /uploads/)
        const IMG_HTTP_RX = /^(https?:\/\/|\/uploads\/)/i;

       const raw = await DeptoSecao
                  .find(
                    { idSetor: idSetor, imagemUrl: { $regex: IMG_HTTP_RX } },
                    '_id nameSecao imagemUrl'         // <-- no schema é nameSecao
                  )
                  .sort({ nameSecao: 1 })
                  .lean();

        

       const secoes = raw.map(s => ({
              _id: String(s._id),
              nome: s.nameSecao,                  // <-- usar nameSecao
              imagemUrl: s.imagemUrl,
              href: `/produtos?secao=${encodeURIComponent(s.nameSecao)}`
        }));
        
        console.log('');
        //console.log('',secoes);
        console.log('');
        res.json({
          departamento: setor.idDepto?.nomeDepartamento || '',
          setor: setor.nomeDeptoSetor,
          secoes
        });
  } catch (err) {
    console.error('[GET /setor/:idSetor]', err);
    res.status(500).json({ error: 'Falha ao carregar seções' });
  }

});

router.get('/secao/:secaoId/produtos', async (req, res) => {
    console.log('450');
    console.log('secao/:secaoId/produto ?',req.params);
    console.log('');
      // paginação
      const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = 50;
      const skip  = (page - 1) * limit;
    
  try {
      const param = req.params.secaoId;

      // se for um ObjectId válido, procuramos por id
      const isId = mongoose.Types.ObjectId.isValid(param);
      const orConds = [];
      
      if (isId) {
        orConds.push({
          'localloja.setor.secao.nameSecao': new mongoose.Types.ObjectId(param)
        });
      }

        // também aceitar "nome da seção" (ex.: "bicicleta") sem dar CastError
        // evita "Path must be an array" usando $cond + $isArray
      orConds.push({
          $expr: {
            $in: [
              isId ? await (async () => {
                const d = await DeptoSecao.findById(param, 'nomeSecao').lean();
                return d?.nomeSecao || param;   // se não achar por id, cai pro próprio param
              })() : param,
              {
                $cond: [
                  { $isArray: '$localloja.setor.secao.nameSecao' },
                  '$localloja.setor.secao.nameSecao',
                  [] // quando for null, ausente ou escalar, vira array vazio
                ]
              }
            ]
          }
      });

     const produtos = await Ddocumento.find({
              localloja: { $elemMatch: {
                setor: { $elemMatch: {
                  secao: { $elemMatch: { idSecao: param } }
                }}
              }}
      })

      //console.log('produtos)
      res.json({ ok: true, count: produtos.length, produtos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Falha ao buscar por seção' });
  }
});

router.get('/sejacooperado',async (req,res)=>{
  console.log('');
  console.log(' 20000');
  console.log('');
  res.render("pages/site/seja-cooperado", { layout:false});
});

router.get('/home-mortodetalhe/:id', async (req, res) => {
  try {
    const produto = await ArquivoDoc.findById(req.params.id).lean();
    if (!produto) return res.status(404).send('Produto não encontrado');

    // ⚠️ Ajuste o nome do Model conforme o seu projeto: Lojista / LojistaDoc / etc
    let slugLoja = "";
    if (produto.loja_id) {
      const lojista = await Lojista.findById(produto.loja_id).select("slug").lean();
      slugLoja = lojista?.slug || "";
    }

    console.log('__________________________________');
    console.log('',produto._id);
    console.log('__________________________________');
    const voltarUrl = slugLoja
      ? `/pagina-exclusiva/${slugLoja}?p=${produto._id}`
      : `/?p=${produto._id}`;
    //const voltarUrl = slugLoja ? `/pagina-exclusiva/${slugLoja}` : "/";

    console.log(' [ 689 ]');
    console.log(' slug', slugLoja);
    console.log(' [ 691 ]');
    //const voltarUrl = slugLoja ? `/pagina-exclusiva/${slugLoja}` : "/";
    console.log(voltarUrl)
    console.log('[EXCLUSIVA] produto._id:', produto._id);
    console.log('[EXCLUSIVA] loja_id:', produto.loja_id);
    console.log('[EXCLUSIVA] codigo:', produto.codigo);
    console.log('[EXCLUSIVA] localloja[0]:', JSON.stringify(produto.localloja?.[0], null, 2));

    res.render('pages/site/home-detalhe', {
      layout: false,
      produto,
      voltarUrl,
      usuarioLogado: req.user || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao abrir detalhes do produto');
  }
});

// BUSCA DE PRODUTOS NA LOJA (AJAX)
router.get('/home-page-exclusiva/busca', async (req, res) => {
      console.log('');
      console.log('[ 640 ]=> /home-page-exclusiva/busca');
      console.log('',req.params);
      console.log('');
      try {
            const lojaId = req.query.loja;
            const qRaw  = (req.query.q || '').trim();

            if (!lojaId || qRaw.length < 3) {
              return res.json([]);
            }

            const qEsc = qRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(qEsc, 'i');

            const docs = await ArquivoDoc.find({
                                loja_id: lojaId,
                                ativo: true,
                                qte: { $gt: 0 },
                                pageurls: { $exists: true, $type: 'array', $ne: [] },
                                descricao: regex,
                                descricaoNorm:{ $regex: qRaw, $options: 'i' }
                          })
                          .select('_id loja_id marcaloja codigo descricao  complete precoprazo  pageurls')
                          .limit(10)
                          .lean();

            const itens = docs.map(d => ({
                        idProd: d._id,
                        lojaId: d.loja_id,
                        codigo: d.codigo,
                        descricao: d.descricao,
                        complete: d.complete,
                        pageurls: d.pageurls,
                        precovista: decToNumber(d.precovista),
                        precoprazo: decToNumber(d.precoprazo),
              }));

              console.log('',itens)
              res.json(itens);
      } catch (err) {
        console.error('Erro na busca da página exclusiva:', err);
        res.status(500).json([]);
      }
});
// /home-page-exclusiva/:id -> página exclusiva do produto
router.get('/home-page-exclusiva/:id', async (req, res) => {
  console.log('');
  console.log('[ 683 ]=> /home-page-exclusiva/:id');
  console.log('código do produto selecionado :',req.params.id);
  console.log('______________________________________________');
 
  try {
    const produto = await ArquivoDoc.findById(req.params.id).lean();
    if (!produto) return res.status(404).send('Produto não encontrado');

    console.log('produtos [ 740 ] :',produto);
   // console.log(produto.localloja.setor.idSetor)

    const lojaId           = produto.loja_id;
    let depSelecionado   = req.query.dep   || null;
    let setorSelecionado = req.query.setor || null;
    let secaoSelecionada = req.query.secao || null;

    // Filtro base: só produtos "válidos" dessa loja
    const baseFilter = {
      loja_id:  lojaId,
      ativo:    true,
      qte:      { $gt: 0 },
      pageurls: { $exists: true, $type: 'array', $ne: [] }
    };

    const usuarioSelecionouAlgo =
      depSelecionado || setorSelecionado || secaoSelecionada;

    let produtosLoja = [];

    // ===================================================
    // MODO A → Vindo da HOME (sem dep/setor/secao)
    // ===================================================
    if (!usuarioSelecionouAlgo) {
        // ✅ 0) pega DEP/SETOR do produto clicado (para comboMenu e filtro padrão)
        const depId   = produto.localloja?.[0]?.departamento || null;
        const setorId =
          produto.localloja?.[0]?.setor?.[0]?.idSetor ||
          produto.localloja?.[0]?.setor?.[0]?._id ||
          null;


        if (depId)   depSelecionado   = String(depId);
        if (setorId) setorSelecionado = String(setorId);

        // ✅ 1) MOSTRAR PRODUTOS DA MESMA LOJA + MESMO SETOR (objetivo principal)
        if (setorId) {
          produtosLoja = await ArquivoDoc.find({
            ...baseFilter,
            'localloja.setor.idSetor': new mongoose.Types.ObjectId(String(setorId)),
            _id: { $ne: produto._id }
          }).lean();
        }

        console.log('setorId 783 ',setorId)
        // ✅ 2) fallback: se por algum motivo não achou pelo setor, tenta mesma SEÇÃO
        if (!produtosLoja.length) {
          // const secaoId =
          //   produto.localloja?.[0]?.setor?.[0]?.secao?.[0]?.idSecao ||
          //   produto.localloja?.[0]?.setor?.[0]?.secao?.[0] ||
          //   null;

          //   if (secaoId) {
          //     secaoSelecionada = String(secaoId);
          //     produtosLoja = await ArquivoDoc.find({
          //       ...baseFilter,
          //       'localloja.setor.secao.idSecao': new mongoose.Types.ObjectId(String(secaoId)),
          //       _id: { $ne: produto._id }
          //     }).lean();
          //   }
           // 2) se não tiver similares, usa o MESMO SETOR do produto (REGRA DA EXCLUSIVA)
             const setorId =
               produto.localloja?.[0]?.setor?.[0]?.idSetor ||
               produto.localloja?.[0]?.setor?.[0]; // (fallback se você salva só o id)
            
             if (setorId) {
               // marca setor/dep atuais para montar combo/menu corretamente
               setorSelecionado = String(setorId);
               depSelecionado   = depSelecionado || String(produto.localloja?.[0]?.departamento || '');
               secaoSelecionada = null; // vem por setor, não por secao
            
               produtosLoja = await ArquivoDoc.find({
                 ...baseFilter,
                 'localloja.setor.idSetor': setorId,
                 _id: { $ne: produto._id }
               }).lean();
             }

          }

          console.log('799 ',produtosLoja.length)
          // ✅ 3) fallback final: qualquer produto da loja
          if (!produtosLoja.length) {
            produtosLoja = await ArquivoDoc.find({
              ...baseFilter,
              _id: { $ne: produto._id }
            }).lean();
          }
}

    // ===================================================
    // MODO B → Usuário clicou em DEP / SETOR / SEÇÃO
    // (tour pela loja – ignora totalmente a seção do produto)
    // ===================================================
    if (usuarioSelecionouAlgo) {
      const filtro = { ...baseFilter };

      if (depSelecionado) {
        filtro['localloja.departamento'] =
          new mongoose.Types.ObjectId(depSelecionado);
      }
      
      if (setorSelecionado) {
        filtro['localloja.setor.idSetor'] =
          new mongoose.Types.ObjectId(setorSelecionado);
      }

      if (secaoSelecionada) {
        filtro['localloja.setor.secao.idSecao'] =
          new mongoose.Types.ObjectId(secaoSelecionada);
      }

      produtosLoja = await ArquivoDoc.find(filtro).lean();
    }

    
    // ===================================================
    // MENUS (sempre montados)
    // ===================================================
    const { departamentosMenu, setoresMenu, secoesMenu } =
      await montarMenus(baseFilter, depSelecionado, setorSelecionado);
    // ===== busca do lojista para pegar corHeader / logoUrl / tituloPage =====
    let lojista = null;

    // o seu produto tem isso: produto.loja_id (pelo print da header antiga)
    if (produto && produto.loja_id) {
      lojista = await Lojista.findById(produto.loja_id).lean();
    }

    // fallback: se por algum motivo não achou
    if (!lojista) {
      lojista = { corHeader: "#0069a8", logoUrl: "", tituloPage: "" };
    }

    console.log('');
    console.log('__________________________________________________________');
    console.log('');
    console.log('', produtosLoja.length);
    console.log('');
    res.render('pages/site/home-page-exclusiva', {
      layout: false, // ou seu layout padrão
      lojista,
      produto,
      produtosLoja,
      departamentosMenu,
      setoresMenu,
      secoesMenu,
      depSelecionado,
      setorSelecionado,
      secaoSelecionada
    });
  } catch (err) {
    console.error('ERRO /home-page-exclusiva:', err);
    res.status(500).send('Erro ao abrir página exclusiva');
  }
});

// ====================================================================
// BUSCA 1: clique na DESCRIÇÃO do produto (todas as lojas)
// GET /buscar-por-texto?q=...&municipio=...&bairro=...
// ====================================================================
router.get('/buscar-por-texto', async (req, res) => {
  console.log('');
  console.log('[ line 803 ] /buscar-por-texto');
  console.log('');
  //---------------------------------------------------------
  try {
          const {
            q = '',
            municipio = '',
            bairro = ''
          } = req.query;

          // ===== filtro base: só produto válido =====
          const filtro = {
            ativo: true,                 // só produto ativado
            qte: { $gt: 0 },             // só quem tem estoque
            pageurls: {                  // pelo menos 1 imagem
              $exists: true,
              $not: { $size: 0 }
            }
          };

          // cidade/bairro simples (sem localloja)
          if (municipio) filtro.cidade = municipio;
          if (bairro)    filtro.bairro = bairro;

          // ====== FILTRO DE TEXTO USANDO descricaoNorm ======
          if (q.trim()) {
            const pattern = makeAccentPattern(q);   // usa helper que normaliza

            if (pattern) {
              const rx = new RegExp(pattern, 'i');

              // ATENÇÃO: agora filtramos em descricaoNorm (campo normalizado do schema)
              filtro.descricaoNorm = { $regex: rx };
              // se quiser manter o antigo também, poderia fazer um $or,
              // mas como estamos migrando pra descricaoNorm, não vou misturar aqui.
            }
          }

          console.log('[ line 922 ] FILTRO /buscar-por-texto =>', filtro);

          const produtos = await Ddocumento.find(filtro)
            .populate('fornecedor', 'razao')
            .lean();
          console.log('');
          console.log(' 928 =>', produtos.length);
          //console.log(' 928 =>', produtos);
          console.log('1000 /buscar-por-texto produtos =>', produtos.length);
          console.log('_________________________________________');
          console.log('');

          let secaoIds = [];

          if (produtos.length > 0) {
              const p = produtos[0];
              console.log('produtos[ 938 ] :',produtos.length)   
              try {
                const loc = p.localloja?.[0];
                const setor = loc?.setor?.[0];
                const secoes = setor?.secao || [];

                secaoIds = secoes.map(s => s.idSecao?.toString()).filter(Boolean);

                console.log("Seções detectadas:", secaoIds);

              } catch (err) {
                console.log("Erro ao extrair idSecao:", err);
              }
          }

          // mesmos departamentos da home
          const departamentosAtivos = await Departamento
            .find({ ativado: true })
            .sort({ ordem: 1 })
            .lean();

          const CIDADES_ES = ['Vitória', 'Vila Velha', 'Guarapari', 'Cariacica', 'Serra'];
          const bairrosDaCidade = municipio
            ? await Lojista.distinct('endereco.bairro', { 'endereco.cidade': municipio })
            : [];

          let relacionados = [];
          const idsJaVieram = produtos.map(p => p._id); 
          if (secaoIds.length > 0) {
            relacionados = await Ddocumento.find({
              ativo: true,
              qte: { $gt: 0 },
              pageurls: { $exists: true, $not: { $size: 0 } },

              // FILTRO pela mesma seção
              'localloja.setor.secao.idSecao': { $in: secaoIds },

              // evita incluir novamente o produto principal
              _id: { $nin: produtos[0]._id }
            })
              .limit(40)
              .lean();

            console.log("Relacionados encontrados:", relacionados.length);
          }

          // =======================================================
          // 3) Resultado final: produto principal + relacionados
          // =======================================================
          const resultadoFinal = [...produtos, ...relacionados];
          console.log('');
          console.log(' resultadoFinal',resultadoFinal.length);
          console.log(' 990 resultado final ', resultadoFinal)
          console.log(
            `TOTAL enviado para o frontend => ${resultadoFinal.length}`
          );

          console.log(' 995 ',resultadoFinal.length)
          const uniq = [];
          const seen = new Set();

          for (const p of resultadoFinal) {
            const id = String(p._id);
            if (seen.has(id)) continue;
            seen.add(id);
            uniq.push(p);
          }

          res.render('pages/site/home', {
            layout: 'site/home',
            q,
            cidades: CIDADES_ES,
            cidadeSelecionada: municipio,
            bairros: bairrosDaCidade,
            bairroSelecionado: bairro,
            produtos: uniq,
            departamentosAtivos,
            segmentoAtual: ''
          });
    
  } catch (e) {
          console.error('Erro em /buscar-por-texto', e);
          res.status(500).render('pages/site/home', {
          layout: 'site/home',
          q: req.query.q || '',
          cidades: ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'],
          produtos: [],
          departamentosAtivos: [],
          segmentoAtual: ''
    });
  }

});

// ====================================================================
// BUSCA 2: clique na LOJA (mesma loja + mesma seção do produto)
// GET /buscar-por-loja?IdProd=...&lojaId=...&municipio=...&bairro=...
// ====================================================================
router.get('/buscar-por-loja', async (req, res) => {
  console.log('');
  console.log('[ 943 ] /buscar-por-loja',req.query);
  console.log('');

  try {
    const {
      IdProd   = '',
      lojaId   = '',
      municipio = '',
      bairro    = ''
    } = req.query;

    // sem produto base → volta pra home
    if (!IdProd) {
     // return res.redirect('/');
    }

    // pega produto base (o que o usuário clicou na sugestão)
    const base = await Ddocumento.findById(IdProd).lean();
    if (!base) {
      //return res.redirect('/');
    }

    // ============================
    // 1) FILTRO BASE (produto válido)
    // ============================
    const filtro = {
      ativo: true,                 // só produto ativado
      qte: { $gt: 0 },             // só quem tem estoque
      pageurls: {                  // pelo menos 1 imagem
        $exists: true,
        $not: { $size: 0 }
      }
    };

    // cidade/bairro simples
    if (municipio) filtro.cidade = municipio;
    if (bairro)    filtro.bairro = bairro;

    // ============================
    // 2) MESMA LOJA
    // ============================
    if (lojaId) {
      filtro.loja_id = lojaId;         // veio pela query
    } else if (base.loja_id) {
      filtro.loja_id = base.loja_id;   // fallback: usa a do produto base
    }

    // ============================
    // 3) MESMA(S) SEÇÃO(ÕES)
    // ============================
    let secaoIds = [];

    if (Array.isArray(base.localloja) && base.localloja.length) {
      for (const loc of base.localloja) {
        if (!Array.isArray(loc.setor)) continue;
        for (const s of loc.setor) {
          if (!Array.isArray(s.secao)) continue;
          for (const sec of s.secao) {
            if (sec.idSecao) {
              secaoIds.push(String(sec.idSecao));
            }
          }
        }
      }
    }

    // remove duplicados
    secaoIds = [...new Set(secaoIds)];

    if (secaoIds.length > 0) {
      filtro['localloja.setor.secao.idSecao'] = { $in: secaoIds };
    }

    console.log('FILTRO /buscar-por-loja =>', filtro);

    // ============================
    // 4) BUSCA PRODUTOS
    // ============================
    const produtos = await Ddocumento.find(filtro)
      .populate('fornecedor', 'razao')
      .lean();

    console.log('');
    console.log('1000 /buscar-por-loja produtos =>', produtos.length);
    console.log('');
    console.log('<><><><><><><><><><><><><><><><><><><><>');

    // ============================
    // 5) MESMOS DEPARTAMENTOS DA HOME
    // ============================
    const departamentosAtivos = await Departamento
      .find({ ativado: true })
      .sort({ ordem: 1 })
      .lean();

    const CIDADES_ES = ['Vitória', 'Vila Velha', 'Guarapari', 'Cariacica', 'Serra'];
    const bairrosDaCidade = municipio
      ? await Lojista.distinct('endereco.bairro', { 'endereco.cidade': municipio })
      : [];

    // usa descrição do produto base só para aparecer na barra de busca
    const q = base.descricao || '';

    res.render('pages/site/home', {
      layout: 'site/home',
      q,
      cidades: CIDADES_ES,
      cidadeSelecionada: municipio,
      bairros: (bairrosDaCidade || [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR')),
      bairroSelecionado: bairro,
      produtos,
      departamentosAtivos,
      segmentoAtual: ''
    });

  } catch (e) {
    console.error('Erro em /buscar-por-loja', e);
    res.status(500).render('pages/site/home', {
      layout: 'site/home',
      q: '',
      cidades: ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'],
      produtos: [],
      departamentosAtivos: [],
      segmentoAtual: ''
    });
  }
});

// ROTA PROVISÓRIA: atualiza descricaoNorm dos itens antigos
router.get('/atualizar-descricao-norm', async (req, res) => {
  console.log('5000-s')
  try {
    // pega só quem tem descricao mas ainda não tem descricaoNorm
    const docs = await Ddocumento.find({
      descricao: { $exists: true, $ne: '' },
      $or: [
        { descricaoNorm: { $exists: false } },
        { descricaoNorm: '' }
      ]
    }).lean(false); // importante: queremos documentos Mongoose, não plain JS

    if (!docs.length) {
      return res.send('Nenhum documento para atualizar. 👍');
    }

    let atualizados = 0;

    for (const doc of docs) {
      const nova = normDesc(doc.descricao || '');

      // se por algum motivo ficar vazio, pula
      if (!nova) continue;

      // só atualiza se mudou de fato
      if (doc.descricaoNorm !== nova) {
        doc.descricaoNorm = nova;
        await doc.save();
        atualizados++;
      }
    }

    res.send(`OK! Atualizados ${atualizados} documentos de ${docs.length} encontrados.`);
  } catch (err) {
    console.error('Erro em /atualizar-descricao-norm', err);
    res.status(500).send('Erro ao atualizar descricaoNorm. Veja o console do servidor.');
  }
});

router.get('/parceiro/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const parceiro = await Parceiro.findOne({ slug, ativo: true }).lean();
    if (!parceiro) return res.redirect('/');

    // mesmos departamentos (igual sua home)
    const departamentosAtivos = await Departamento
      .find({ ativado: true })
      .sort({ ordem: 1 })
      .lean();

    // cidades (igual você usa)
    const CIDADES_ES = ['Vitória', 'Vila Velha', 'Guarapari', 'Cariacica', 'Serra'];

    // bairros (se você quiser deixar funcionando nessa tela também)
    const municipio = String(req.query.municipio || '');
    const bairrosDaCidade = municipio
      ? await Lojista.distinct('endereco.bairro', { 'endereco.cidade': municipio })
      : [];

    res.render('pages/site/parceiro', {
      layout: 'site/home',
      parceiro,

      // mantém sua barra/topo como na home:
      q: '',
      cidades: CIDADES_ES,
      cidadeSelecionada: municipio,
      bairros: (bairrosDaCidade || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      bairroSelecionado: String(req.query.bairro || ''),

      departamentosAtivos,
      segmentoAtual: ''
    });

  } catch (e) {
    console.error('Erro em /parceiro/:slug', e);
    return res.redirect('/');
  }
});

router.get('/catalogo-teste', (req, res) => {
  console.log('olá!')
  res.render('pages/site/catalogo', { layout: false });
});

router.get("/home-layout", async (req, res) => {
  try {
    const doc = await HomeLayout.findOne({ nome: "default" }).lean();
    return res.render("pages/site/admin-home-layout.handlebars", {
      layout: false, // você está usando HTML completo
      home: doc || { nome: "default", slots: [] },
    });
  } catch (err) {
    console.error("[GET /admin/home-layout]", err);
    return res.status(500).send("Erro ao carregar admin da HOME");
  }
});

router.get('/home-detalhe/:id', async (req, res) => {
  console.log('');
  console.log('[ 1328 ] ',req.params.id);
  console.log('');
  try {
      const produto = await ArquivoDoc.findById(req.params.id).lean();
      // let lojista = await Lojista.findById(produto.loja_id).lean();
      if (!produto) return res.status(404).send('Produto não encontrado');

      // pega lojista da loja do produto
      let lojista = null;
      if (produto.loja_id) {
        lojista = await Lojista.findById(produto.loja_id).lean();
      }
      if (!lojista) lojista = { corHeader: "#0069a8", logoUrl: "", tituloPage: "" };

     
      const whatsappNumber = String(lojista?.celular || '').replace(/\D/g, '');


      const fotoUrl = Array.isArray(produto.pageurls) && produto.pageurls.length
        ? produto.pageurls[0]
        : "";

      const mensagemWhatsapp =
        `Olá! Tenho interesse no produto: ${produto?.descricao || ""} (código ${produto?.codigo || ""}).` +
        (fotoUrl ? `\n\nFoto: ${fotoUrl}` : "");

      const whatsappLink =
        whatsappNumber
          ? `https://api.whatsapp.com/send/?phone=55${whatsappNumber}&text=${encodeURIComponent(mensagemWhatsapp)}`
          : "#";


      console.log(' 3000',produto.pageurls)

      console.log('______________________________________________');
      console.log('whatsapplink', whatsappLink)
      console.log('______________________________________________');
      res.render('pages/site/home-detalhe', {
        layout: false,
        produto,
        lojista,
        whatsappLink,
        usuarioLogado: req.user || null
      });
  } catch (err) {
      console.error('ERRO /home-detalhe:', err);
      res.status(500).send('Erro ao abrir detalhes');
  }
});

router.get("/pedido", async (req, res) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) return res.status(401).json({ ok: false, msg: "Não logado" });

    const lista = await getOrCreateLista(usuarioId);

    // total só dos ativos
    const total = (lista.itens || [])
      .filter(it => it.ativo !== false)
      .reduce((acc, it) => acc + Number(it.preco || 0), 0);

    res.json({ ok: true, itens: lista.itens || [], total });
  } catch (e) {
    console.error("GET /api/pedido", e);
    res.status(500).json({ ok: false, msg: "Erro ao carregar pedido" });
  }
});

router.post("/pedido/add", async (req, res) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) return res.status(401).json({ ok: false, msg: "Não logado" });

    const { produtoId } = req.body;
    if (!produtoId || !mongoose.Types.ObjectId.isValid(produtoId)) {
      return res.status(400).json({ ok: false, msg: "produtoId inválido" });
    }

    const produto = await ArquivoDoc.findById(produtoId).lean();
    if (!produto) return res.status(404).json({ ok: false, msg: "Produto não encontrado" });

    if (!produto.loja_id) {
      return res.status(400).json({ ok: false, msg: "Produto sem loja_id" });
    }

    const lista = await getOrCreateLista(usuarioId);

    // evita duplicar por produto
    const idx = (lista.itens || []).findIndex(it => String(it.produto) === String(produto._id));

    if (idx >= 0) {
      // se já tem, reativa e atualiza preço/código (você decide se soma qtd futuramente)
      lista.itens[idx].ativo = true;
      lista.itens[idx].preco = Number(produto.preco || 0);
      lista.itens[idx].codigo = produto.codigo || lista.itens[idx].codigo;
    } else {
      lista.itens.push({
        produto: produto._id,
        loja: produto.loja_id,
        codigo: produto.codigo || "",
        preco: Number(produto.preco || 0),
        ativo: true,
      });
    }

    await lista.save();

    res.json({ ok: true });
  } catch (e) {
    console.error("POST /api/pedido/add", e);
    res.status(500).json({ ok: false, msg: "Erro ao adicionar item" });
  }
});

router.patch("/pedido/item/:produtoId/toggle", async (req, res) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) return res.status(401).json({ ok: false, msg: "Não logado" });

    const { produtoId } = req.params;

    const lista = await getOrCreateLista(usuarioId);
    const it = (lista.itens || []).find(x => String(x.produto) === String(produtoId));
    if (!it) return res.status(404).json({ ok: false, msg: "Item não encontrado" });

    it.ativo = !it.ativo;
    await lista.save();

    res.json({ ok: true, ativo: it.ativo });
  } catch (e) {
    console.error("PATCH /api/pedido/toggle", e);
    res.status(500).json({ ok: false, msg: "Erro ao alternar item" });
  }
});

router.delete("/pedido/item/:produtoId", async (req, res) => {
  try {
    const usuarioId = getUsuarioId(req);
    if (!usuarioId) return res.status(401).json({ ok: false, msg: "Não logado" });

    const { produtoId } = req.params;

    const lista = await getOrCreateLista(usuarioId);
    lista.itens = (lista.itens || []).filter(it => String(it.produto) !== String(produtoId));
    await lista.save();

    res.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/pedido/item", e);
    res.status(500).json({ ok: false, msg: "Erro ao remover item" });
  }
});

router.get("/pagina-exclusiva/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { p } = req.query; // id do produto em destaque

    const lojista = await Lojista.findOne({ slug }).lean();
    if (!lojista) return res.status(404).send("404 - Página não encontrada");

    let filtro = { loja_id: lojista._id };

    let produtoDestaque = null;
    let secaoId = null;

    if (p) {
      produtoDestaque = await ArquivoDoc.findById(p).lean();

      // garante que o destaque é dessa loja
      if (produtoDestaque && String(produtoDestaque.loja_id) === String(lojista._id)) {
        // pega a seção do produto (ajuste se seu caminho mudar)
        secaoId = produtoDestaque?.localloja?.[0]?.secao?.[0]?.idSecao;

        if (secaoId) {
          filtro["localloja.secao.idSecao"] = secaoId;
        }
      }
    }

    const produtos = await ArquivoDoc.find(filtro)
      .sort({ pageposicao: 1, descricao: 1 })
      .lean();
    console.log(' produto :')
    return res.render("pages/site/home-page-exclusiva", {
      layout:false,
      lojista,
      produtos,
      produtoDestaqueId: produtoDestaque?._id ? String(produtoDestaque._id) : null,
      secaoId: secaoId ? String(secaoId) : null,
      usuarioLogado: req.user || null
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao abrir página exclusiva");
  }
});

// SERVIÇO
router.get("/home-servico", async (req, res) => {
  try {
      // se você já carrega dados na home (departamentos, cidades, etc),
      // copie o mesmo "bloco de dados" aqui (o mínimo).
      return res.render("pages/site/home-servico.handlebars", {
      layout:false,
      titulo: "Serviços",
    });
  } catch (e) {
      console.error("[GET /home-servico] ERRO:", e);
      return res.status(500).send("Erro ao abrir Serviços: " + (e?.message || e));
  }
});

// TURISMO
router.get("/home-turismo", async (req, res) => {
  try {
      return res.render("pages/site/home-turismo.handlebars", {
      layout:false,
      titulo: "Turismo",
    });
  } catch (e) {
     console.error("[GET /home-turismo] ERRO:", e);
     return res.status(500).send("Erro ao abrir turismo: " + (e?.message || e));
  }
});


module.exports = router;

