const router = require('express').Router();
//const router = express.Router();
const bcrypt = require('bcryptjs')
//const mongoose = require('mongoose');
const { mongoose } = require('../../../database');
////////////////////////////////////////////////
const aws=require('@aws-sdk/client-s3')
const { S3 } =require('@aws-sdk/client-s3')
const multer = require('multer');
const multerS3 = require('multer-s3');
require('dotenv').config({path:'./.env'})
////////////////////////////////////////////////
const { eAdmin } = require("../../../helpers/eAdmin");
//require('../../models/lojista');
////////////////////////////////////////////////
const { upload } = require('../../libs/multer');
const { uploadFile,getFiles } = require('../../controllers/index.controllers');

require('../../models/lojista');
const Lojista = mongoose.model('lojista');

//require('../../models/departamento');
//const Departamento=mongoose.model("departamentos");
const escapeRegExp = s => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const Departamento = require('../../models/departamento');

require('../../models/deptosetores');
require('../../models/deptosecao');

require('../../models/mconstrucao');
const Mconstrucao=mongoose.model('m_construcao');

const fornec=require('../../models/fornecedor');

const csv=require('csvtojson');
const path =require('path');
//const { segmento } = require('../../models/lojista');

router.post('/cooperados',async(req,res)=>{
    console.log('');
    console.log('[ 28-empresa ]',req.body);
    console.log('');
    ////////////////////////////////////////////////////////////////////////
    try {
    const ns = Lojista.collection.namespace; // "<db>.<collection>"
    const collName = Lojista.collection.collectionName;
    const host = mongoose.connection.host;
    const dbName = mongoose.connection.name;

    // existe essa coleção nesse DB?
    const exists = await mongoose.connection.db
      .listCollections({ name: collName })
      .toArray();

    const total = exists.length
      ? await Lojista.estimatedDocumentCount()
      : 0;

    const sample = exists.length
      ? await Lojista.findOne({}).select('email razao').lean()
      : null;

    res.json({ host, dbName, ns, collectionExists: !!exists.length, total, sample });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
  //????????????????????????????????????????????????????????????????????????
  console.log('/////////////////////////////////////////////////////////////////////////')
    const peek = await Lojista.findOne({})
           .select('email emailloja contato.email razao')
           .lean();
   console.log('[peek]', peek); 
   console.log('');
   console.log('====================');

    return
    console.log(" [ empresa-35 ]");
    console.log(' origem views : _cooperado/usuario/loginloja');
    console.log(' origem route : /lojista/empresa/rotina');
    console.log(' obs : ');
    console.log('');
    console.log(' destino : _cooperado/admin/admincooperados');
    console.log('____________________________________________');
    console.log('');
    console.log('1000=>',req.body)
    let emae;
    let senha;
    let errors = []
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
           
             try {
                        console.log(req.body)
                        console.log('---------------------------------------------------')
                        console.log('');
                        const emailIn  = (req.body.email || '').trim();
                        const senhaIn  = String(req.body.senha || '');
                        
                        console.log('');
                        console.log('',emailIn);
                        console.log('',senhaIn);
                        console.log('');

                        if (!emailIn || !senhaIn) {
                          req.flash('error_msg', 'Informe e-mail e senha.');
                          return res.redirect('/usuarioloja/login'); // ajuste rota da página
                        }

                         // const filtro = {
                         //         $or: [
                         //           {  },
                         //           { emailloja: emailIn },
                         //           { 'contato.email': emailIn },
                         //         ]
                         //       };

                          // Se no Schema a senha tiver select:false, use "+senha"
                        const lojista = await Lojista.findOne({cnpj: '27323484000166'})
                           // .collation({ locale: 'pt', strength: 2 })   // case-insensitive
                           // .select('+senha razao') // traga a senha criptografada
                            .lean(); // pode ser sem lean() se preferir

                        if (!lojista) {
                          req.flash('error_msg', 'Usuário não encontrado.');
                          //return res.redirect('/usuarioloja/login');
                        }
                                            
                          ////////////////////////////////////////////////////////////////////////////////
                          const email = (req.body?.email || req.query?.email || '').trim();
                          const senha = (req.body?.senha || req.query?.senha || '').trim();
                            console.log(' [ 72 ]');
                          console.log(email);
                          console.log(senha);
                          console.log('');

                            // const lojista = await Lojista.findOne({
                            //   $or: [
                            //     { email: email },
                            //     { emailloja: email },
                            //     { 'contato.email': email },
                            //   ]
                            // })
                            // .collation({ locale: 'pt', strength: 2 }) // ignora caixa (case-insensitive)
                            // .select('+senha email') // "+senha" se tiver select:false no schema
                            // .lean();

                            if (!lojista) {
                              console.log('Usuário não encontrado.');
                              return;
                            }
                          /////////////////////////////////////////////////////////////////////
                         // const f = await fornec.find({ qlojistas: lojista._id }).populate();
                          console.log('');

                         /////////////////////////////////////////////////////////////////////
                         const ok = await bcrypt.compare(senha, lojista.senha); // se senha for hash
                           if (!ok) {
                              req.flash('error_msg','Usuário ou senha inválidos');
                              return res.redirect(`/loja/produtos?loja_id=${lojista._id}`);
                           }

                        //  console.log('[ 79  fornec => ]',f);
                         // console.log('');
                         // const produtos=await Mconstrucao.find({loja_id:lojista._id})
                         //                                   .populate({
                         //                                           path: "fornecedor",
                         //                                           model: "fornec", 
                         //                                           select: "razao",
                         //                                           options: { lean: true }});
                         //  // ///////////////////////////////////////////////////////////////////////
                        //   const senhaCorreta = await bcrypt.compare(senha, lojista.senha);
                          // console.log(' [ 86 - rotina.js produtos => ',produtos)
                        //  if (senhaCorreta) {
                        //    if (senhaCorreta) {
                                //  SE A SENHA ESTÁ CORRETA VAMOS REDIRECIONAR A ROTA
                        //         return res.redirect(`/loja/produtos?loja_id=${lojista._id}`);
                        //    }
                            // AQUI VAMOS RENDERIZAR PAGE LISTA PRODUTOS         
                           // console.log('');
                           // console.log('[ 95 ]',produtos[0].fornecedor);
                           // console.log('');                
                           // res.render("pages/empresa/produtos.handlebars", {
                           //   layout: "empresa/admin-empresa.handlebars",
                           //   loja: produtos,
                           //   lojista,
                           //   f,
                           // });
                  
                        //  } else {
                            console.log("Senha incorreta.");
                        //  }
                        } catch (err) {
                          console.error("Erro:", err);
                        }
                       
         
        }
     // }
})


router.get("/produtos", async (req, res) => {
  console.log('[ 116 -  => rotina.js/produtos')
  const loja_id = req.query.loja_id;
  console.log(loja_id)
 
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
  console.log('');
  console.log();
  //console.log(' [ 136 ]',produtos[0].localloja[0].setor[0].nameSetor);
  console.log('');


  

  // res.render("pages/empresa/produtos.handlebars", {
  //   layout: "empresa/admin-empresa.handlebars",
  //   produto: produtos,
  //   lojista,
  //   f,
  // });
});
   
module.exports = router;