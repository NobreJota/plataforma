// ==================================================================
// src/routes/empresa/rotina.js
// Alterado em 26/09/2026: login do lojista unificado (POST /cooperados e
// POST /usuarioloja/login), sessão de SESSAO_HORAS (padrão 12h) e
// gravação da sessão antes do redirect. Exporta autenticarLojista.
// GET /loja/cooperados volta a abrir empresa/pages/cooperado-admin;
// fornecedores do filtro incluem os vínculos novos (vinculos[]).
// Alterado em 03/10/2026: o produto do Access grava a MARCA (texto) em
// `fornecedor`, e não o ObjectId do fornec; o populate('fornecedor') quebrava
// com CastError e /loja/cooperados dava 500. Agora o fornecedor é anexado à
// mão (anexarFornecedor): ObjectId → busca no fornec; texto → vira a marca.
// O filtro por fornecedor acha os produtos do Access por fornecId e por
// nrFornec (_fornec_access). Mesmo conserto no GET /produtos.
// ==================================================================
const router = require('express').Router();
const bcrypt = require('bcryptjs')
const { mongoose } = require('../../../database');
////////////////////////////////////////////////
require('dotenv').config({path:'./.env'})
////////////////////////////////////////////////
const { eAdmin } = require("../../../helpers/eAdmin");
const escapeRegExp = s => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const Departamento = require('../../models/departamento');
////////////////////////////////////////////////
require('../../models/empresa/lojista');
const Lojista = mongoose.model('lojista');
const DeptoSetores=require('../../models/deptosetores');
const DeptoSecoes=require('../../models/deptosecao');

//require('../../models/ddocumento');
const Ddocumento=mongoose.model('arquivo_doc');
const fornec=require('../../models/fornec');

// ------------------------------------------------------------------
// Fornecedor do produto. Há dois jeitos gravados em arquivo_docs.fornecedor:
//   - ObjectId do fornec (produtos cadastrados pela área da empresa)
//   - a MARCA em texto (produtos vindos do Access, padrão atual)
// populate() só entende o primeiro e quebra no segundo (CastError), então o
// fornecedor é anexado aqui: p.fornecedor vira { _id, marca, razao } nos dois casos.
// ------------------------------------------------------------------
const ehObjectId = v => v instanceof mongoose.Types.ObjectId || /^[0-9a-f]{24}$/i.test(String(v || ''));

async function anexarFornecedor(produtos) {
  const ids = [...new Set(produtos.map(p => p.fornecedor).filter(ehObjectId).map(String))];
  const mapa = new Map();
  if (ids.length) {
    const docs = await fornec.find({ _id: { $in: ids } }, '_id marca razao').lean();
    docs.forEach(f => mapa.set(String(f._id), { _id: f._id, marca: f.marca || '', razao: f.razao || '' }));
  }
  for (const p of produtos) {
    const v = p.fornecedor;
    if (ehObjectId(v)) p.fornecedor = mapa.get(String(v)) || null;
    else if (v && String(v).trim()) p.fornecedor = { _id: null, marca: String(v).trim(), razao: '' };
    else p.fornecedor = null;
  }
  return produtos;
}

// Filtro de produtos de UM fornecedor (id do fornec escolhido no combo):
// os da área da empresa têm o ObjectId em `fornecedor`; os do Access têm
// fornecId e/ou nrFornec (ligado ao fornec por _fornec_access.fornecId).
async function filtroDoFornecedor(fornId) {
  const oid = new mongoose.Types.ObjectId(String(fornId));
  const nrs = (await mongoose.connection.collection('_fornec_access')
    .find({ fornecId: { $in: [oid, String(fornId)] } }).project({ nrFornec: 1 }).toArray())
    .map(f => Number(f.nrFornec)).filter(Boolean);
  const ou = [{ fornecedor: oid }, { fornecId: oid }];
  if (nrs.length) ou.push({ nrFornec: { $in: nrs } });
  return ou;
}

function ensureLojista(req, res, next) {
  if (req.session && req.session.lojistaId) return next();
  return res.redirect('/usuarioloja/login');
}

// ------------------------------------------------------------------
// LOGIN DO LOJISTA — um só caminho para os dois POSTs
// (antes: /cooperados e /usuarioloja/login tinham códigos diferentes;
//  o /cooperados quebrava sem senha e renderizava view inexistente)
// ------------------------------------------------------------------
const SESSAO_HORAS = Number(process.env.SESSAO_HORAS || 12);
const URL_LOGIN_LOJA = '/usuarioloja/login';

async function autenticarLojista(req, res) {
  const emailIn = String(req.body.email || '').trim().toLowerCase();
  const senhaIn = String(req.body.senha || '');

  if (!emailIn || !senhaIn) {
    req.flash('error_msg', 'Preencha email e senha.');
    return res.redirect(URL_LOGIN_LOJA);
  }

  try {
    const lojista = await Lojista.findOne({
      $or: [{ email: emailIn }, { emailloja: emailIn }, { 'contato.email': emailIn }]
    })
      .collation({ locale: 'pt', strength: 2 })          // sem diferença de maiúsculas
      .select('+senha email razao _id marca bairro cidade')
      .lean();

    if (!lojista) {
      console.log('[login loja] email não encontrado:', emailIn);
      req.flash('error_msg', 'Usuário não encontrado.');
      return res.redirect(URL_LOGIN_LOJA);
    }

    if (!lojista.senha) {
      // sem senha gravada o bcrypt lança "Illegal arguments" e virava "Erro ao autenticar"
      console.log('[login loja] lojista sem senha cadastrada:', String(lojista._id));
      req.flash('error_msg', 'Este usuário não tem senha cadastrada. Defina a senha na área central.');
      return res.redirect(URL_LOGIN_LOJA);
    }

    const ok = await bcrypt.compare(senhaIn, lojista.senha);
    if (!ok) {
      console.log('[login loja] senha inválida para', String(lojista._id));
      req.flash('error_msg', 'Senha inválida.');
      return res.redirect(URL_LOGIN_LOJA);
    }

    req.session.lojistaId = String(lojista._id);
    req.session.cookie.maxAge = SESSAO_HORAS * 60 * 60 * 1000;   // sessão longa para o dia de trabalho

    // grava a sessão ANTES de redirecionar; sem isso a próxima requisição
    // pode chegar antes do store e o usuário "cai" de volta no login
    return req.session.save(err => {
      if (err) {
        console.error('[login loja] erro ao gravar sessão:', err);
        req.flash('error_msg', 'Erro ao iniciar a sessão.');
        return res.redirect(URL_LOGIN_LOJA);
      }
      console.log('[login loja] ok', String(lojista._id), '→ /loja/cooperados');
      return res.redirect('/loja/cooperados');
    });
  } catch (err) {
    console.error('[login loja] erro:', err);
    req.flash('error_msg', 'Erro ao autenticar.');
    return res.redirect(URL_LOGIN_LOJA);
  }
}

router.post('/cooperados', autenticarLojista);


// GET /loja/cooperados — lista paginada com filtros
router.get('/cooperados', ensureLojista, async (req, res) => {
    console.log("abrindo cooperados-GET")
    try {
          const loja_number = req.session.lojistaId; // vem da sessão
          //////////////////////////////////////////////////////////////////
          console.log('---------------------------------------------------');
          console.log(req.session.lojistaId);
          console.log('[ 96 /routes/empresa/rotina.js/cooperados:  ]',loja_number);
          console.log('---------------------------------------------------');
          ///////////////////////////////////////////////////////////////////
          // paginação
          const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
          const limit = 50;
          const skip  = (page - 1) * limit;

          // filtros
          const statusAtivo = String(req.query.ativo || 'S').toUpperCase(); // '' | 'ativos' | 'inativos'

          const fornId = String(req.query.fornecedor || '').trim();
          const modo   = String(req.query.modo || 'lista').toLowerCase();
          console.log('-------------------------------------------------');
          console.log('fornId [ 110 ] /cooperados CORRIGIR-sem valor fornId',fornId);
          console.log('');

          const filtro = { loja_id: loja_number };

          if (statusAtivo === 'S') {
            filtro.ativo = true;          // só ATIVOS
          } else if (statusAtivo === 'N') {
            filtro.ativo = false;         // só INATIVOS
          }
          if (fornId && ehObjectId(fornId)) {
            filtro.$or = await filtroDoFornecedor(fornId);   // empresa (ObjectId) + Access (fornecId/nrFornec)
          }

          // count + busca
          const [total, produtos, fornecedores, lojista] = await Promise.all([
            Ddocumento.countDocuments(filtro),
            Ddocumento.find(filtro)
              // fornecedor: anexado depois, por anexarFornecedor (populate quebra com a marca em texto)
              .populate({ path: 'localloja.departamento', select: 'nomeDepartamento' })
              .populate({ path: 'localloja.setor.idSetor', model: 'deptosetores', select: 'nomeDeptoSetor' })
              .populate({ path: 'localloja.setor.secao.idSecao', model: 'deptosecoes', select: 'nomeSecao' })
              .sort({ descricao: 1 })
              .collation({ locale: 'pt', strength: 1 })
              .skip(skip).limit(limit)
              .lean(),
            // fornecedores da loja: cadastro antigo (qlojistas) OU vínculo novo (vinculos[])
            fornec.find({
              $or: [
                { qlojistas: loja_number },
                { vinculos: { $elemMatch: { lojistaId: new mongoose.Types.ObjectId(String(loja_number)), ativo: { $ne: false } } } }
              ]
            }, '_id razao marca').sort({ razao: 1 }).lean(),
            Lojista.findById(loja_number).lean()
          ]);

          await anexarFornecedor(produtos);

          // dígitos da paginação
          const pages = Math.max(Math.ceil(total / limit), 1);
          const win = 7;
          let start = Math.max(1, page - Math.floor(win / 2));
          let end   = Math.min(pages, start + win - 1);
          start     = Math.max(1, end - win + 1);
          const pageNumbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

          // query base sem 'page'
          const params = new URLSearchParams();
          //if (statusAtivo) params.set('status', statusAtivo);
          if (statusAtivo) params.set('ativo', statusAtivo);    // 'N' ou 'T'
          if (fornId) params.set('fornecedor', fornId);
          if (modo)   params.set('modo',   modo);
          const qsNoPage = params.toString();
          //////////////////////////////////////////////////////////////////////
                    // ===============================
          //   DEPARTAMENTOS / SETORES / SEÇÕES
          // ===============================
          const departamentos = await Departamento.find({}).lean();
          const setores       = await DeptoSetores.find({loja_id:loja_number}).lean();
          const secoes        = await DeptoSecoes.find({}).lean();

          //console.log('[]',setores)
          // monta os mapas para os selects em cascata
          const SETORES_POR_DEPTO = {};
          setores.forEach(setor => {
            const depIdRaw =
              setor.departamentoId ||
              setor.idDepto ||
              (setor.departamento && setor.departamento._id) ||
              null;

            const depId = depIdRaw ? String(depIdRaw) : null;
            if (!depId) return;

            if (!SETORES_POR_DEPTO[depId]) SETORES_POR_DEPTO[depId] = [];

            SETORES_POR_DEPTO[depId].push({
              _id: setor._id,
              nomeSetor:
                setor.nomeDeptoSetor ||
                setor.nomeDeptoSetor ||
                setor.descricao ||
                "(sem nome)",
            });
          });

          //console.log('SETORES_POR_DEPTO',SETORES_POR_DEPTO)
          const SECOES_POR_SETOR = {};
          secoes.forEach(sec => {
            const setorIdRaw =
              sec.idSetor ||
              sec.setorId ||
              (sec.setor && sec.setor._id) ||
              null;

            const setorId = setorIdRaw ? String(setorIdRaw) : null;
            if (!setorId) return;

            if (!SECOES_POR_SETOR[setorId]) SECOES_POR_SETOR[setorId] = [];

            SECOES_POR_SETOR[setorId].push({
              _id: sec._id,
              nomeSecao: sec.nameSecao || sec.descricao || "(sem nome)",
            });
          });
          /////////////////////////////////////////////////////////////////////////
          //////////////////////////////////////////////////////////////////////////
          // render
          console.log('comprimento do produto ',produtos.length)
          // Tela da LOJA (cooperado-admin). O menu contábil fica só no /usuariocontab/menu.
          res.render('empresa/pages/cooperado-admin.handlebars', {
            layout: false,
            basePath: '/loja/cooperados',      // <- use isso nos links
            produtos,
            fornecedores,
            lojista,
            total, page, pages, limit,
            pageNumbers, qsNoPage,
            filtroAtivo: statusAtivo,
            fornecedorSelecionado: fornId,
            modoSelecionado: modo,
            departamentos,
            setoresPorDepto: SETORES_POR_DEPTO,
            secoesPorSetor:  SECOES_POR_SETOR,
          });
    } catch (err) {
          console.error(err);
            res.status(500).send('Erro ao carregar a lista.');
    }
});

router.get("/produtos", async (req, res) => {
  console.log('');
  console.log('[ 123 ] -  => rotina.js/produtos')
  console.log('route=>src/routes/empresa/rotina.js');
  console.log('get => /produtoso');
  console.log('');
  console.log(' id do lojista : ',req.params.id);
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  console.log('');
  const loja_id = req.query.loja_id;
 // console.log(loja_id)

  const lojista = await Lojista.findById(loja_id).lean();
  console.log(' [ 127 ]',lojista)

  const produtos = await Ddocumento.find({ loja_id: lojista._id })
                        // fornecedor: anexado depois, por anexarFornecedor
                        .populate({ path: 'localloja.departamento', select: 'nomeDepartamento' })
                        .populate({
                          path: 'localloja.setor.nameSetor',
                          model: 'deptosetores',
                          select: 'nomeDeptoSetor'
                        })
                        .populate({
                          path: 'localloja.setor.secao.nameSecao',
                          model: 'deptosecoes',
                        select: 'nomeSecao'
                        })
                        .lean();
      await anexarFornecedor(produtos);
      //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      const list = produtos.map(p => ({
                         ...p,
                         departamentoNome: p?.localloja?.[0]?.departamento?.[0]?.nomeDepartamento || '',
                         fornecedorRazao:  p?.fornecedor?.razao || '',
                         descricaoSafe:    p?.descricao || ''   // garante string
      }));
 
      const todosSetoresSecoes = produtos.map(prod => {
              const setorList = [];
              const secaoList = [];

              prod.localloja.forEach(loc => {
              loc.setor?.forEach(s => {
                if (s.nameSetor?.nomeDeptoSetor)
                  setorList.push(s.nameSetor.nomeDeptoSetor);
                s.secao?.forEach(sec => {
                  if (sec.nameSecao?.nomeSecao)
                    secaoList.push(sec.nameSecao.nomeSecao);
                });
              });
            });

            return {
              setores: setorList,
              secoes: secaoList
            };
      });

      const f = await fornec.find({ qlojistas: loja_id });
      res.render("pages/empresa/produto_cadastro.handlebars", {
        layout: "empresa/admin-empresa.handlebars",
        produtos:list,
        f,
        lojista,
        todosSetoresSecoes: JSON.stringify(todosSetoresSecoes)
      });
      //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      
});

router.post('/usuarioloja/login', autenticarLojista);

'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

router.get('/assistente-lojista', async (req, res) => {
  try {
    res.render('pages/empresa/assistente_lojista', {
      layout: '',
      produto: {
        nome: '',
        codigo: '',
        marca: '',
        categoria: '',
        preco: '',
        descricao: ''
      }
    });
  } catch (erro) {
    console.error('Erro ao abrir assistente do lojista:', erro);
    res.status(500).send('Erro ao abrir a página do assistente.');
  }
});

router.post('/assistente-lojista/gerar', async (req, res) => {
  try {
    const { prompt, produto } = req.body;

    if (!prompt) {
      return res.status(400).json({ erro: 'Prompt não enviado.' });
    }

    const respostaFake = `
Sugestão gerada para o produto "${produto?.nome || 'Sem nome'}":

${prompt}

Texto sugerido:
Este produto se destaca pela sua qualidade, praticidade e excelente custo-benefício. Ideal para clientes que procuram eficiência, durabilidade e um ótimo resultado no uso diário.
    `.trim();

    return res.json({
      ok: true,
      resposta: respostaFake
    });

  } catch (erro) {
    console.error('Erro ao gerar resposta do assistente:', erro);
    return res.status(500).json({
      erro: 'Erro interno ao gerar resposta.'
    });
  }
});
module.exports = router;
module.exports.autenticarLojista = autenticarLojista;   // usado por src/routes/empresa/usuario.js

