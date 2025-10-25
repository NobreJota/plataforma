const express=require('express')
const router=express.Router()
const mongoose = require('mongoose');

const Mconstrucao  = require('../../models/mconstrucao');     // produtos
const Lojista = require('../../models/lojista');              // lojas
const Departamento = require('../../models/departamento');    // segmentos
const DeptoSetor   = require('../../models/deptosetores');    // admin.deptosetores
const DeptoSecao = require('../../models/deptosecao');

const CIDADES_ES = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'];

// helper pra regex segura
const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// helper para escapar caracteres especiais de RegExp
const escapeRx = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const norm = s => String(s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().trim();

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
// GET /
router.get('/', async (req, res) => {
     try {
    // 1️⃣ todos os departamentos ativados → botões do topo
    const depsAtivos = await Departamento
      .find({ ativado: 1 }, 'nomeDepartamento')
      .sort({ nomeDepartamento: 1 })
      .lean();

    // 2️⃣ define departamento alvo
    const segmentoIn = (req.query.segmento || '').trim();
    const isFirstLoad = !segmentoIn;
    const alvoNome = segmentoIn || 'E-commerce';

    // 🔍 busca o documento real do departamento (por nome, mas para capturar o _id)
    const depAlvo = await Departamento.findOne({
      nomeDepartamento: { $regex: new RegExp(`^${alvoNome}$`, 'i') }
    }, '_id nomeDepartamento ativado ').lean();

    if (depAlvo.ativado !== 1) return res.redirect('/');

    if (!depAlvo?._id) {
      return res.render('pages/site/home.handlebars', {
        layout: 'site/main.handlebars',
        departamentosAtivos: depsAtivos,
        segmentoAtual: 'Departamento não encontrado',
        atividades: []
      });
    }
    console.log('20X',depAlvo);
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

router.get('/produtos', async (req, res) => {
  
  try {
    const q        = (req.query.q || '').trim();
    const cidade   = (req.query.cidade || '').trim();
    const lojaId   = (req.query.loja || '').trim();
    const segmento = (req.query.segmento || '').trim();

    const filtro = {};

   let projecao = { descricao: 1, preco: 1, pageurls: 1, loja_id: 1, localloja: 1 };
   let ordenacao = { _id: -1 };

   if (q) {
      if (q.length >= 3) {
         filtro.$text = { $search: q };
         projecao.score = { $meta: 'textScore' };
         ordenacao = { score: { $meta: 'textScore' } };
      } else {
        const safe = escapeRegExp(q);
        filtro.$or = [
         { descricao:  { $regex: safe, $options: 'i' } },
         { referencia: { $regex: safe, $options: 'i' } }
        ];
      }
    }

    // segmento (departamento)
    if (segmento && mongoose.isValidObjectId(segmento)) {
      filtro['localloja.departamento'] = new mongoose.Types.ObjectId(segmento);
    }
    console.log('');
    console.log('buscando no "/" os elementos para carregar a home no primeiro momento');
    console.log('src/routes/site/home.js => filtro [ 73 ]=>', JSON.stringify(filtro));
    console.log('----------------------------------------------------------------');
    console.log('');

    // loja e/ou cidade
    if (lojaId && mongoose.isValidObjectId(lojaId)) {
      filtro.loja_id = new mongoose.Types.ObjectId(lojaId);
    } else if (cidade) {
      const lojasCidade = await Lojista.find({
        cidade: { $regex: `^${escapeRegExp(cidade)}$`, $options: 'i' }
      }).select('_id').lean();
      // [] => zero resultados (correto quando não há lojas no município)
      filtro.loja_id = { $in: lojasCidade.map(l => l._id) };
    }

    // listas para selects/chips
    const [segmentos, lojas] = await Promise.all([
      Departamento.find({}).select('nomeDepartamento').lean(),
      // se cidade vazia => todas as lojas; se cidade setada => só daquela cidade
      Lojista.find(
        cidade
          ? { cidade: { $regex: `^${escapeRegExp(cidade)}$`, $options: 'i' } }
          : {}
      ).select('razao').lean()
    ]);

    filtro['pageurls.0'] = { $exists: true, $regex: /\S/ };
    // não listar itens "apagados"
    filtro.$and = (filtro.$and || []);
    filtro.$and.push({ $or: [ { ativo: { $exists: false } }, { ativo: { $ne: 9 } } ] });
    // se você usa datadel, também filtra quem não foi “apagado logicamente”
    filtro.$and.push({ $or: [ { datadel: { $exists: false } }, { datadel: null } ] });

    const docs = await Mconstrucao.find(filtro, projecao)
         .sort(ordenacao)
         .limit(300)
         .lean();

    const produtos = docs.map(d => ({
      _id: d._id,
      descricao: d.descricao,
      preco: d.preco || 0,
      pageurls: Array.isArray(d.pageurls) && d.pageurls[0] ? d.pageurls[0] : '/img/sem-foto.png'
    }));

    //console.log(produtos[0].l);
    // evita 304 durante debug
    res.set('Cache-Control', 'no-store');
    console.log('');
    console.log('[ 96 ] routes/site/home.js')
    console.log('',produtos.length);
    console.log('');
    console.log('1000',produtos[0]);
    res.render('pages/site/home', {
         layout: 'site/home', // bate com views/layout/site/home.handlebars 
         q, cidades: CIDADES_ES, cidadeSelecionada: cidade,
         lojas, lojaSelecionada: lojaId,
         segmentos, segmentoSelecionado: segmento,
         produtos
   });
  } catch (e) {
    console.error('Erro ao carregar Home:', e);
    res.status(500).send('Erro ao carregar Home');
  }
});

router.get('/bairros', async (req, res) => {
  console.log('');
  console.log( ' [ 112 ] => src/routes/site/home.js')
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

    const produtos = await Mconstrucao.find(filtro)
      .populate('fornecedor', 'razao')
      .lean();
     console.log('');
     console.log('/buscar'); 
     console.log('produtos',);
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
router.get('/buscar-sugestoes', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 3) return res.json([]);

    // tokens -> regex tolerante: termo1 .* termo2 (acentos ignorados)
    const pattern = norm(q).split(/\s+/).filter(Boolean).map(escapeRx).join('.*');
    const rx = new RegExp(pattern, 'i');

    const docs = await Mconstrucao.find(
      { descricao: { $regex: rx } },
      { _id: 0, descricao: 1 }
    )
    .collation({ locale: 'pt', strength: 1 })
    .limit(30)
    .lean();

    const sugestoes = [...new Set(docs.map(d => d.descricao).filter(Boolean))].slice(0, 10);
    res.json(sugestoes);
  } catch (e) {
    console.error('erro /buscar-sugestoes', e);
    res.json([]);
  }
});

router.get('/setor/:idSetor', async (req, res) => {
  console.log('2000?');

  try {
        const idSetor=req.params;
        const n=req.params.idSetor
        console.log('vr de N',n)
        const setor = await DeptoSetor
          .findById(n, 'nomeDeptoSetor idDepto')
          .populate({ path: 'idDepto', select: 'nomeDepartamento' })
          .lean();

        if (!setor) return res.status(404).send('Setor não encontrado');

        // só seções COM imagem (http/https OU /uploads/)
        const IMG_HTTP_RX = /^(https?:\/\/|\/uploads\/)/i;

       const raw = await DeptoSecao
                  .find(
                    { idSetor: n, imagemUrl: { $regex: IMG_HTTP_RX } },
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
        console.log('',secoes);
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

// GET /secao/:secaoId/produtos  -> JSON
// GET /secao/:secaoId/produtos  -> JSON
// GET /secao/:secaoId/produtos
router.get('/secao/:secaoId/produtos', async (req, res) => {


  console.log(req.params)
   // paginação
          const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
          const limit = 50;
          const skip  = (page - 1) * limit;
      
  
  
  try {
    const param = req.params.secaoId;

    // se for um ObjectId válido, procuramos por id
    const isId = mongoose.Types.ObjectId.isValid(param);
    const orConds = [];
    console.log('isId',param)
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

    // const produtos = await Mconstrucao.find(
    //   { $or: orConds },
    //   { _id: 1, descricao: 1, preco1: 1, pageurlS: 1 }
    // )
    // .sort({ descricao: 1 })
    // .populate({ path: 'localloja.setor.idSetor',  model: 'deptosetores', select: 'nomeDeptoSetor imagemUrl' })
    // .populate({ path: 'localloja.setor.secao.idSecao', model: 'deptosecoes',  select: 'nomeSecao imagemUrl' })
    // .lean();

    const produtos = await Mconstrucao.find({
  localloja: { $elemMatch: {
    setor: { $elemMatch: {
      secao: { $elemMatch: { idSecao: param } }
    }}
  }}
})


     console.log(produtos)
    res.json({ ok: true, count: produtos.length, produtos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Falha ao buscar por seção' });
  }
});




module.exports = router;

