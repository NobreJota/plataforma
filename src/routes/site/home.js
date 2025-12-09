const express=require('express')
const router=express.Router()
const mongoose = require('mongoose');

// const Ddocumento  = require('../../models/arquivoDoc');     // produtos
const Ddocumento=mongoose.model("arquivo_doc")
const Lojista = require('../../models/lojista');              // lojas
const Departamento = require('../../models/departamento');    // segmentos
const DeptoSetor   = require('../../models/deptosetores');    // admin.deptosetores
const DeptoSecao = require('../../models/deptosecao');
const ArquivoDoc=require('../../models/arquivoDoc')
const { render } = require('express/lib/response');

const CIDADES_ES = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'];

// helper pra regex segura
const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// helper para escapar caracteres especiais de RegExp
const escapeRx = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    //console.log('GET/2001',depsAtivos)
    //console.log('');
    //console.log(' req.query : ',req.query);
    // 2️⃣ define departamento alvo
    const segmentoIn = (req.query.segmento || '').trim();
    const isFirstLoad = !segmentoIn;
    const alvoNome = segmentoIn || 'Construção Civil';

    // 🔍 busca o documento real do departamento (por nome, mas para capturar o _id)
    const depAlvo = await Departamento.findOne({
      nomeDepartamento: { $regex: new RegExp(`^${alvoNome}$`, 'i') }
    }, '_id nomeDepartamento ativado ').lean();

    //console.log('depAlvo :',depAlvo)
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
    console.log('',setores);
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
  console.log('');
  console.log( ' [ 205 ] => src/routes/site/home.js//bairros');
  console.log(req.query)
  console.log('');
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

  try {
    const { q = '', municipio = '', bairro = '' } = req.query;

    const filtro = {};
    if (q.trim()) {
      // se você não tem índice de texto, troque por regex:
      // filtro.descricao = new RegExp(escapeRegExp(q.trim()), 'i');
      filtro.$text = { $search: q.trim() };
    }
    if (municipio) filtro['localloja.cidade'] = municipio;
    if (bairro)    filtro['localloja.bairro'] = bairro;

    const produtos = await Ddocumento.find(filtro)
      .populate('fornecedor', 'razao')
      .lean();

     console.log('');
     console.log('/buscar/produtos'); 
     console.log(produtos);
     console.log('');
    // monte as listas para repovoar a UI
    const CIDADES_ES = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra']; // ou busque do BD
    const bairrosDaCidade = municipio
      ? await Lojista.distinct('endereco.bairro', { 'endereco.cidade': municipio })
      : [];

    res.render('pages/site/home', {
      layout: 'site/home',
      q, cidades: CIDADES_ES,
      cidadeSelecionada: municipio,
      bairros: (bairrosDaCidade || []).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      bairroSelecionado: bairro,
      produtos
    });
  } catch (e) {
    console.error('Erro em /buscar', e);
    res.status(500).send('Erro ao aplicar filtros');
  }
});
//Pontos-chave que quebravam o filtro:
// SUBSTITUA a rota antiga /buscar-sugestoes por esta
router.get('/buscar-sugestoes', noStore, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3) return res.json([]);

    // monta regex tolerante (como já estava)
    const pattern = norm(q)
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRx)
      .join('.*');
    const rx = new RegExp(pattern, 'i');

    const docs = await Ddocumento.find(
      { descricao: { $regex: rx } },
      {
        descricao: 1,
        marcaloja: 1,
        localloja: 1,      // para pegar cidade do 1º localloja
        cidade:1
      }
    )
      .collation({ locale: 'pt', strength: 1 })
      .limit(30)
      .lean();

    // transforma em objetos já no formato que o front vai usar
    const sugestoes = docs
      .map(d => ({
        descricao: d.descricao || '',
        loja: d.marcaloja || '',
        cidade:d.cidade
          // (d.localloja &&
          //   d.localloja[0] &&
          //   (d.localloja[0].cidade || d.localloja[0].localidade)) ||
          // '',
      }))
      .filter(s => s.descricao)        // garante descrição
      .slice(0, 10);                   // no máx. 10 linhas

      console.log(' ', sugestoes)

    // ex: [{descricao:'vaso...', loja:'Loja Tal', cidade:'Vitória'}, ...]
    res.json(sugestoes);
  } catch (e) {
    console.error('erro /buscar-sugestoes', e);
    res.json([]);
  }
});


router.get('/setor/:idSetor', async (req, res) => {
  console.log('');
  console.log(' [ 299 ] src/routes/site/home.js//setor/:idSetor');
  console.log(' [ 297 ] ',req.params);
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
       console.log('secao/:secaoId/produto',req.params)
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


module.exports = router;

