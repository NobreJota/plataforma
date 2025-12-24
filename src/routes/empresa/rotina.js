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
require('../../models/lojista');
const Lojista = mongoose.model('lojista');
const DeptoSetores=require('../../models/deptosetores');
const DeptoSecoes=require('../../models/deptosecao');

//require('../../models/ddocumento');
const Ddocumento=mongoose.model('arquivo_doc');
const fornec=require('../../models/fornecedor');

function ensureLojista(req, res, next) {
  if (req.session && req.session.lojistaId) return next();
  return res.redirect('/usuarioloja/login');
}

//CONFERE SE O USUARIO É VERDADEIRO
router.post('/cooperados',async(req,res)=>{
    console.log('');
    console.log('');
    ////////////////////////////////////////////////////////////////////////
    // Confere o login do cooperado
    ////////////////////////////////////////////////////////////////////////
    console.log('____________________________________________');
    console.log('');
    let errors = [];
    let loja_number;
    if(!req.body.email || typeof req.body.email == undefined || req.body.email == null){
      errors.push({ error : "Erro: Necessário preencher o email!"})
    }

    if(!req.body.senha || typeof req.body.senha == undefined || req.body.senha == null){
      errors.push({ error : "Erro: Necessário colocar a senha!"})
    }

    if(req.body.senha.length>9 || req.body.senha.length<6){
      errors.push({ error : "Erro: A senha não pode ser de comprimento maior que 9 ou menor que 6!"})
    }
    
    if(errors.length>0){
        console.log('os erros',errors)
        res.render("usuario/loginloja",{ layout:'admin.handlebars',errors:errors})
    }else{
       try{
            /////////////////////////////////////////////////////
            // Se não tiver error então segue em frente
            const emailIn = String(req.body.email || '').trim().toLowerCase();

            const lojista = await Lojista.findOne({
                                                    $or: [
                                                      { email: emailIn },
                                                      { emailloja: emailIn },
                                                      { 'contato.email': emailIn },
                                                    ]
                                                 })
                                         .collation({ locale: 'pt', strength: 2 }) // case-insensitive
                                         .select('+senha email razao _id marca bairro cidade')          // <-- inclui a senha só aqui
                                         .lean();                                   // use lean se quiser objeto simples
            if (!lojista) {
              req.flash('error_msg', 'Usuário não encontrado.');
              return res.redirect('/usuarioloja/login');
            }
            /////////////////////////////////////////////////////////////
            loja_number=lojista._id
            const ok = await bcrypt.compare(String(req.body.senha || ''), lojista.senha);
            if (!ok) {
              req.flash('error_msg', 'Senha inválida.');
              return res.redirect('/usuarioloja/login');
            }
            req.session.lojistaId = String(lojista._id);
            return res.redirect('/loja/cooperados');
       }
         catch(err){
         console.log(err)
       }
         }
});

// GET /loja/cooperados — lista paginada com filtros
router.get('/cooperados', ensureLojista, async (req, res) => {
    try {
          const loja_number = req.session.lojistaId; // vem da sessão
          //////////////////////////////////////////////////////////////////
          console.log('---------------------------------------------------');
          console.log(req.session.lojistaId);
          console.log('[ 93 /routes/empresa/rotina.js/cooperados:  ]',loja_number);
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
          console.log('fornId [ 106 ] /cooperados CORRIGIR-sem valor fornId',fornId);
          console.log('');

          const filtro = { loja_id: loja_number };

          if (statusAtivo === 'S') {
            filtro.ativo = true;          // só ATIVOS
          } else if (statusAtivo === 'N') {
            filtro.ativo = false;         // só INATIVOS
          }
          if (fornId) {
            filtro.fornecedor = fornId;
          }

          // count + busca
          const [total, produtos, fornecedores, lojista] = await Promise.all([
            Ddocumento.countDocuments(filtro),
            Ddocumento.find(filtro)
              .populate('fornecedor', 'marca')
              .populate({ path: 'localloja.departamento', select: 'nomeDepartamento' })
              .populate({ path: 'localloja.setor.idSetor', model: 'deptosetores', select: 'nomeDeptoSetor' })
              .populate({ path: 'localloja.setor.secao.idSecao', model: 'deptosecoes', select: 'nomeSecao' })
              .sort({ descricao: 1 })
              .collation({ locale: 'pt', strength: 1 })
              .skip(skip).limit(limit)
              .lean(),
            fornec.find({ qlojistas: loja_number }, '_id razao').sort({ razao: 1 }).lean(),
            Lojista.findById(loja_number).lean()
          ]);

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
          console.log(' ',produtos.length)
          // 'empresa/empresa-produto.handlebars'
          res.render('pages/empresa/cooperado-admin.handlebars', {
            layout:false ,
            basePath: '/loja/cooperados',      // <- use isso nos links
            produtos,
            fornecedores,
            lojista,
            total, page, pages, limit,
            pageNumbers, qsNoPage,
            filtroAtivo: statusAtivo,
            //statusSelecionado: status,
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
                        .populate('fornecedor', 'razao')
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
      res.render("pages/empresa/produtos.handlebars", {
        layout: "empresa/admin-empresa.handlebars",
        produtos:list,
        f,
        lojista,
        todosSetoresSecoes: JSON.stringify(todosSetoresSecoes)
      });
      //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
      
});

router.post('/usuarioloja/login', async (req, res) => {
  console.log('');
  console.log(' Origem:routes/empresa/rotina.js/usuarioloja/login');
  console.log(' Vai :');
  console.log(' obs:');
  console.log('');
  try {
    const emailIn = String(req.body.email || '').trim().toLowerCase();
    const senhaIn = String(req.body.senha || '');

    const lojista = await Lojista.findOne({
      $or: [{ email: emailIn }, { emailloja: emailIn }, { 'contato.email': emailIn }]
    })
    .select('+senha razao _id marca bairro cidade')
    .collation({ locale: 'pt', strength: 2 });

    if (!lojista) {
      req.flash('error_msg', 'Usuário não encontrado.');
      return res.redirect('/usuarioloja/login');
    }

    const ok = await bcrypt.compare(senhaIn, lojista.senha);
    if (!ok) {
      req.flash('error_msg', 'Senha inválida.');
      return res.redirect('/usuarioloja/login');
    }

    // ✅ guarda o ID do lojista
    req.session.lojistaId = String(lojista._id);

    // ✅ vai para a LISTA (GET)
    return res.redirect('/loja/cooperados');
  } catch (e) {
    console.error(e);
    req.flash('error_msg', 'Erro ao autenticar.');
    return res.redirect('/usuarioloja/login');
  }
});

module.exports = router;

