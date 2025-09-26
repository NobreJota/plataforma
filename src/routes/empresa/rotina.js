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
    let emae=req.body.email;
    let senha=req.body.senha;
    let errors = [];
    let loja_number;
    if(!req.body.email || typeof req.body.email == undefined || req.body.email == null){
      errors.push({ error : "Erro: Necessário preencher o email!"})
    }

    if(!req.body.senha || typeof req.body.senha == undefined || req.body.senha == null){
      errors.push({ error : "Erro: Necessário colocar a senha!"})
    }

    if(req.body.senha.length>6 || req.body.senha.length<6){
      errors.push({ error : "Erro: A senha não pode ser de comprimento diferente de 6!"})
    }
    
    if(errors.length>0){
        console.log('os erros',errors)
        res.render("usuario/loginloja",{ layout:'admin.handlebars',errors:errors})
    }else{
              try{
                // vai conferir se senha está correta
                password=req.body.senha;
                const salt = bcrypt.genSaltSync(10)
                password= bcrypt.hashSync(password,salt)
                      bcrypt.genSalt(10,(erro,salt)=>{
                            bcrypt.hash(senha,salt,(erro,hash)=>{
                              return senha
                            })
                      })
                      console.log(' [ 69-rotina ]',senha)
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
                        loja_number=lojista._id
                        const ok = await bcrypt.compare(String(req.body.senha || ''), lojista.senha);
                        if (!ok) {
                          req.flash('error_msg', 'Senha inválida.');
                          return res.redirect('/usuarioloja/login');
                        }
                        ///////////////////////////////////////////
                        console.log('96');
                        console.log(lojista);
                        console.log('');
                                          //////////////////////////////////////////////////////////////////////////////////////
                                          const produtos = await  Mconstrucao.find({ loja_id: lojista._id })
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

                                                      // console.log('==> ',produtos)
                                                      // // ///////////////////////////////////////////////////////////////////////////////////////
                                                      //  res.render("pages/empresa/produtos.handlebars", {
                                                      //          layout: "empresa/admin-empresa.handlebars",
                                                      //          lojista:produtos,
                                                      //  });
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

      const f = await fornec.find({ qlojistas: loja_number });
      res.render("pages/empresa/produtos.handlebars", {
        layout: "empresa/admin-empresa.handlebars",
        produtos:list,
        f,
        lojista,
        todosSetoresSecoes: JSON.stringify(todosSetoresSecoes)
      });
                               //     })
                               }
                               catch(err){
                                  console.log(err)
                               }
                              // .catch((e)=>{
                              //    console.log(e)
                              // });
             // }                    
             // catch(err){
             //     console.log(err)
             // }
         }
})

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
        // res.render("pages/empresa/produtos.handlebars", {
        //   layout: "empresa/admin-empresa.handlebars",
        //   produto: produtos,
        //   lojista,
        //   f,
        // });
});
   
module.exports = router;

