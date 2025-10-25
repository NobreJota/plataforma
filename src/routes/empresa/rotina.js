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
require('../../models/deptosetores');
require('../../models/deptosecao');

require('../../models/mconstrucao');
const Mconstrucao=mongoose.model('m_construcao');
const fornec=require('../../models/fornecedor');

function ensureLojista(req, res, next) {
  if (req.session && req.session.lojistaId) return next();
  return res.redirect('/usuarioloja/login');
}

//CONFERE SE O USUARIO É VERDADEIRO
router.post('/cooperados',async(req,res)=>{
    console.log('');
    console.log('[ 23-central ]',req.body)
    console.log('');
    ////////////////////////////////////////////////////////////////////////
    // Confere o login do cooperado
    ////////////////////////////////////////////////////////////////////////
    console.log('');
    console.log('___________________________________________');
    console.log('');
    console.log(" [ 31 ]");
    console.log(' origem views : _cooperado/usuario/loginloja');
    console.log(' origem route : [loja=/lojista/empresa/rotina]');
    console.log(' obs : ');
    console.log('');
    console.log(' destino : _cooperado/admin/admincooperados');
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

          // paginação
          const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
          const limit = 50;
          const skip  = (page - 1) * limit;

          // filtros
          const status = String(req.query.status || '').toLowerCase(); // '' | 'ativos' | 'inativos'
          const fornId = String(req.query.fornecedor || '').trim();
          const modo   = String(req.query.modo || 'lista').toLowerCase();

          const filtro = { loja_id: loja_number };
          if (status === 'ativos')   filtro.$or   = [{ ativo: 1 }, { ativo: { $exists: false } }];
          if (status === 'inativos') filtro.ativo = 9;
          if (fornId)                filtro.fornecedor = fornId;

          // count + busca
          const [total, produtos, fornecedores, lojista] = await Promise.all([
            Mconstrucao.countDocuments(filtro),
            Mconstrucao.find(filtro)
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
          if (status) params.set('status', status);
          if (fornId) params.set('fornecedor', fornId);
          if (modo)   params.set('modo',   modo);
          const qsNoPage = params.toString();

          // render
          res.render('pages/empresa/produtos.handlebars', {
            layout: 'empresa/empresa-produto.handlebars',
            basePath: '/loja/cooperados',      // <- use isso nos links
            produtos,
            fornecedores,
            lojista,
            total, page, pages, limit,
            pageNumbers, qsNoPage,
            statusSelecionado: status,
            fornecedorSelecionado: fornId,
            modoSelecionado: modo
          });
    } catch (err) {
          console.error(err);
            res.status(500).send('Erro ao carregar a lista.');
    }
});

                          // }); 


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

  const produtos = await Mconstrucao.find({ loja_id: lojista._id })
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

