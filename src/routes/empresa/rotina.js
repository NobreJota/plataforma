const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose');
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
    console.log('[ 28-empresa ]',req.body)
    ////////////////////////////////////////////////////////////////////////
    // Confere o login do cooperado
    ////////////////////////////////////////////////////////////////////////
    console.log(" [ empresa-35 ]");
    console.log(' origem views : _cooperado/usuario/loginloja');
    console.log(' origem route : /lojista/empresa/rotina');
    console.log(' obs : ');
    console.log('');
    console.log(' destino : _cooperado/admin/admincooperados');
    console.log('____________________________________________');
    console.log('');
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
                          const { email, senha } = req.body;

                          const lojista = await Lojista.findOne({ email }).select("+senha").lean();

                          if (!lojista) {
                            console.log("Usuário não encontrado.");
                            return;
                          }
                          /////////////////////////////////////////////////////////////////////
                          const f = await fornec.find({ qlojistas: lojista._id }).populate();
                          console.log('');
                        //  console.log('[ 79  fornec => ]',f);
                          console.log('');
                          const produtos=await Mconstrucao.find({loja_id:lojista._id})
                                                            .populate({
                                                                    path: "fornecedor",
                                                                    model: "fornec", 
                                                                    select: "razao",
                                                                    options: { lean: true }});
                           // ///////////////////////////////////////////////////////////////////////
                           const senhaCorreta = await bcrypt.compare(senha, lojista.senha);
                          // console.log(' [ 86 - rotina.js produtos => ',produtos)
                          if (senhaCorreta) {
                            if (senhaCorreta) {
                                //  SE A SENHA ESTÁ CORRETA VAMOS REDIRECIONAR A ROTA
                                 return res.redirect(`/loja/produtos?loja_id=${lojista._id}`);
                            }
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
                  
                          } else {
                            console.log("Senha incorreta.");
                          }
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