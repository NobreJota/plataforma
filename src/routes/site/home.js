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

// CARREGA A PADE COMPRAS ONLINE COMO PADRÂO /
router.get('/', async (req, res) => {
     try {
    // 1️⃣ todos os departamentos ativados → botões do topo
    const depsAtivos = await Departamento
      .find({ ativado: 1 }, 'nomeDepartamento')
      .sort({ nomeDepartamento: 1 })
      .lean();

    console.log('');  
    
    // 2️⃣ define departamento alvo
    const segmentoIn = (req.query.segmento || '').trim();
    const isFirstLoad = !segmentoIn;
    const alvoNome = segmentoIn || 'Construção Civil';

    // 🔍 busca o documento real do departamento (por nome, mas para capturar o _id)
    const depAlvo = await Departamento.findOne({
      nomeDepartamento: { $regex: new RegExp(`^${alvoNome}$`, 'i') }
    }, '_id nomeDepartamento ativado ').lean();

    
    if (depAlvo.ativado !== 1) return res.redirect('/');

    if (!depAlvo?._id) {
      return res.render('pages/site/home.handlebars', {
        layout:false,
        departamentosAtivos: depsAtivos,
        segmentoAtual: 'Departamento não encontrado',
        atividades: []
      });
    }
    
    // 3️⃣ agora filtra SETORES pelo _id do departamento (e não pelo nome!)
    const IMG_HTTP_RX = /^https?:\/\/.+/i;
    const setoresQuery = {
        idDepto: depAlvo._id,
        imagemUrl: { $regex: IMG_HTTP_RX }  // <- sempre exigindo URL completa
    };

    const setores = await DeptoSetor
      .find(setoresQuery, '_id nomeDeptoSetor imagemUrl idDepto slug')
      .sort({ nomeDeptoSetor: 1 })
      .lean();

    console.log('');  
    console.log('[ line 125 ] router.get("/buscar") => setores :',setores);
    console.log('');
    // 4️⃣ monta cards
    const atividades = setores.map(s => ({
      _id:s._id,
      nome: s.nomeDeptoSetor,
      titulo: s.nomeDeptoSetor,
      imagemUrl: (s.imagemUrl && IMG_HTTP_RX.test(s.imagemUrl)) ? s.imagemUrl : '/img/placeholder.png',
      href: `/produtos?segmento=${encodeURIComponent(depAlvo.nomeDepartamento)}&setor=${encodeURIComponent(s.nomeDeptoSetor)}`
    }));

    // 5️⃣ renderiza
      return res.render('pages/site/home.handlebars', {
      layout: 'site/home.handlebars',      // ajuste se seu layout for outro
      departamentosAtivos: depsAtivos,     // p/ botões
      segmentoAtual: depAlvo?.nomeDepartamento || 'E-commerce',
      atividades });

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

//Pontos-chave que quebravam o filtro:
// SUBSTITUA a rota antiga /buscar-sugesXtoes por esta
router.get('/buscar-sugestoes', noStore, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3) return res.json([]);

    // filtro base
    const filtroBase = {
      ativo: true,
      qte: { $gt: 0 },
      pageurls: { $exists: true, $not: { $size: 0 } }
    };

    // =============================
    // 1) Montar regex de pesquisa
    // =============================
    const pattern = makeAccentPattern(q);  
    let rx = null;

    if (pattern) {
      rx = new RegExp(pattern, 'i');
    }

    if (rx) {
      filtroBase.descricao = { $regex: rx };
    } else {
      // se algo der errado, retorna vazio
      return res.json([]);
    }

    // =============================
    // 2) Consulta ao Mongo
    // =============================
    const docs = await Ddocumento.find(
      filtroBase,
      {
        descricao: 1,
        codigo: 1,
        qte: 1,
        marcaloja: 1,
        cidade: 1,
        bairro: 1,
        loja_id: 1
      }
    )
      .collation({ locale: 'pt', strength: 1 })
      .limit(30)
      .lean();

    // =============================
    // 3) Formatar sugestões
    // =============================
    const sugestoes = docs
      .map(d => ({
        idProd: String(d._id),
        descricao: d.descricao || '',
        loja: d.marcaloja || '',
        cidade: d.cidade || '',
        bairro: d.bairro || '',
        lojaId: d.loja_id ? String(d.loja_id) : ''
      }))
      .filter(s => s.descricao)   // garante texto
      .slice(0, 10);

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

router.get('/home-detalhe/:id', async (req, res) => {
  
  try {
    const produto = await ArquivoDoc.findById(req.params.id).lean();
    if (!produto) return res.status(404).send('Produto não encontrado');

    res.render('pages/site/home-detalhe', {
      layout: false,  // ou seu layout padrão, se estiver usando
      produto,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao abrir detalhes do produto');
  }
});

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
    console.log(' [ 449 ] => ',setorIds)
    
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
      console.log('dentro!')
      const secoes = await DeptoSecao
        .find({ _id: { $in: secaoIds } })
        .sort('nameSecao')
        .lean();
       console.log(' ===> ',secoes)
      secoesMenu = secoes.map(s => ({
        _id:  s._id.toString(),
        nome: s.nameSecao
      }));
    }
  }

  return { departamentosMenu, setoresMenu, secoesMenu };
}
// BUSCA DE PRODUTOS NA LOJA (AJAX)
router.get('/home-page-exclusiva/busca', async (req, res) => {
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
      descricao: regex
    })
      .select('_id descricao codigo precovista complete marcaloja loja_id pageurls')
      .limit(40)
      .lean();

    res.json(docs);
  } catch (err) {
    console.error('Erro na busca da página exclusiva:', err);
    res.status(500).json([]);
  }
});
// /home-page-exclusiva/:id -> página exclusiva do produto
router.get('/home-page-exclusiva/:id', async (req, res) => {
  console.log('');
  console.log('[ 493 ]=> /home-page-exclusiva/:id');
  console.log('',req.params.id);
  console.log('');
 
  try {
    const produto = await ArquivoDoc.findById(req.params.id).lean();
    if (!produto) return res.status(404).send('Produto não encontrado');

    const lojaId           = produto.loja_id;
    const depSelecionado   = req.query.dep   || null;
    const setorSelecionado = req.query.setor || null;
    const secaoSelecionada = req.query.secao || null;

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
      // 1) tenta achar produtos com MESMO CÓDIGO na loja
      const similares = await ArquivoDoc.find({
        ...baseFilter,
        codigo: produto.codigo,
        _id:    { $ne: produto._id }
      }).lean();

      if (similares.length) {
        produtosLoja = similares;
      } else {
        // 2) se não tiver similares, usa a MESMA SEÇÃO do produto
        //    (ajuste o caminho conforme seu localloja real)
        const secaoId =
          produto.localloja?.[0]?.setor?.[0]?.secao?.[0]?.idSecao ||
          produto.localloja?.[0]?.setor?.[0]?.secao?.[0];

        if (secaoId) {
          produtosLoja = await ArquivoDoc.find({
            ...baseFilter,
            'localloja.setor.secao.idSecao': secaoId,
            _id: { $ne: produto._id }
          }).lean();
        }
      }

      // Se ainda assim não tiver nada, mostra qualquer produto da loja
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

    res.render('pages/site/home-page-exclusiva', {
      layout: false, // ou seu layout padrão
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
  console.log('[ line 796 ] /buscar-por-texto');
  console.log('');
  console.log('');
  console.log('[ line 796 ] /buscar-por-texto');
  console.log('');
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

          console.log('[ line 831 ] FILTRO /buscar-por-texto =>', filtro);

          const produtos = await Ddocumento.find(filtro)
            .populate('fornecedor', 'razao')
            .lean();
          console.log('');
          console.log('', produtos);
          console.log('1000 /buscar-por-texto produtos =>', produtos.length);
          console.log('_________________________________________');
          console.log('');

          let secaoIds = [];

          if (produtos.length > 0) {
              const p = produtos[0];
              console.log('produtos :',produtos)   
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

          if (secaoIds.length > 0) {
            relacionados = await Ddocumento.find({
              ativo: true,
              qte: { $gt: 0 },
              pageurls: { $exists: true, $not: { $size: 0 } },

              // FILTRO pela mesma seção
              'localloja.setor.secao.idSecao': { $in: secaoIds },

              // evita incluir novamente o produto principal
              _id: { $ne: produtos[0]._id }
            })
              .limit(40)
              .lean();

            console.log("Relacionados encontrados:", relacionados.length);
          }

          // =======================================================
          // 3) Resultado final: produto principal + relacionados
          // =======================================================
          const resultadoFinal = [...produtos, ...relacionados];

          console.log(
            `TOTAL enviado para o frontend => ${resultadoFinal.length}`
          );

          res.render('pages/site/home', {
            layout: 'site/home',
            q,
            cidades: CIDADES_ES,
            cidadeSelecionada: municipio,
            bairros: bairrosDaCidade,
            bairroSelecionado: bairro,
            produtos: resultadoFinal,
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
  console.log('[ 872 ] /buscar-por-loja',req.query);
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



module.exports = router;

// router.get('/buscar-relacionados', async (req, res) => {
//   try {
//     const { idProd = '', lojaId = '' } = req.query;

//     if (!idProd) {
//       return res.redirect('/');
//     }

//     // produto base
//     const base = await Ddocumento.findById(idProd).lean();
//     if (!base) {
//       return res.redirect('/');
//     }

//     const filtro = {
//       ativo: true,
//       qte: { $gt: 0 },
//       pageurls: { $exists: true, $not: { $size: 0 } },
//       descricao: base.descricao,        // mesma descrição base
//       idSecao: base.idSecao || null     // mesma seção, se existir
//     };

//     if (lojaId) filtro.loja_id = lojaId;

//     const produtos = await Ddocumento.find(filtro)
//       .populate('fornecedor', 'razao')
//       .lean();

//     const departamentosAtivos = await Departamento
//       .find({ ativado: true })
//       .sort({ ordem: 1 })
//       .lean();

//     res.render('pages/site/home', {
//       layout: 'site/home',
//       q: '',
//       cidades: ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'],
//       cidadeSelecionada: '',
//       bairros: [],
//       bairroSelecionado: '',
//       produtos,
//       departamentosAtivos,
//       segmentoAtual: ''
//     });

//   } catch (e) {
//     console.error('ERRO /buscar-relacionados', e);
//     res.redirect('/');
//   }
// });