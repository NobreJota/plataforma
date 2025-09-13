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

require('../../models/mconstrucao');
const Mconstrucao=mongoose.model('m_construcao')

const csv=require('csvtojson');
const path =require('path');
require('../../models/usuario');
const Usuario=mongoose.model("usuarios")

router.post('/menu',(req,res)=>{
    console.log('[ 28-central ]',req.body)
    ////////////////////////////////////////////////////////////////////////
    // Confere o login do cooperado
    ////////////////////////////////////////////////////////////////////////
    console.log('');
    console.log('___________________________________________');
    console.log('');
    console.log(" [ 35 ]");
    console.log(' origem views : _cooperado/usuario/loginloja');
    console.log(' origem route : /lojista/empresa/rotina');
    console.log(' obs : ');
    console.log('');
    console.log(' destino : _cooperado/admin/admincooperados');
    console.log('____________________________________________');
    console.log('');
    let emae=req.body.email;
    let senha=req.body.senha;
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
                              // Se não tiver error então segue em frente
                              console.log(' [ 73-central ]',senha)
                              Usuario.findOne({email:emae})
                                        .then((r)=>{
                                           console.log('resultado pesquisa para ',emae,' : ',r)
                                          // console.log(typeof(r))
                                            if (r==="null"){
                                                console.log('Não foi encontrado o lojista')
                                                return
                                            }else{
                                                let Sub={};
                                                let L={};
                                                let Seg={};
                                                let segment=[];
                                            //   console.log('agora result=',r.segmento);
                                                // segment=r.segmento;
                                                // console.log('segment : ',segment);

                                              //  const titulo = Array.isArray(segment) && segment[0]?.titulo;
                                              //  console.log(titulo);
                                              //  if (Array.isArray(segment) && segment.length > 0) {
                                              //     const titulo1 = segment[0].titulo;
                                              //     console.log('Título:', titulo1);
                                              //  } else {
                                              //     console.log('Segmento está vazio ou inválido.');
                                              //  }

                                              //  console.log('12',x);
                                              //  return
                                            //    let [segmento]=r.segmento;
                                            //    L=segmento.titulo;
                                            //    let template=r.template;
                                                //Seg=segmento;
                                              // let W=segmento.sub_titulo
                                              //  let n=W.length;
                                              //  for (d=0;d<n;d++){
                                              //      Sub={
                                              //          sub:W[d],
                                              //      }
                                                }
                                                bcrypt.compare(senha,r.senha,(erro,correta) => {
                                                        if(correta){
                                                         // console.log(' num templete' ,template)
                                                            console.log('_______________________________________________________')
                                                            console.log('')
                                                            console.log('a senha estando correta ,então')
                                                            console.log('vai para: view/loja/menu-loja')
                                                            console.log('')
                                                            console.log('_______________________________________________________')
                                                            console.log('')
                                                         //   if (template==0){
                                                         //     res.render("_cooperado/admin/admincooperados",{ layout:'lojista/admin-loja.handlebars',cooperado:r,segmento:Seg}) 
                                                         //   }else if(template==1){
                                                         //     res.render("_cooperado/admin/sample-roupas",{ layout:'lojista/admin-loja.handlebars',cooperado:r,segmento:Seg}) 
                                                         //   }else if(template==2){
                                                         //     res.render("_cooperado/admin/sample-mconstrucao",{ layout:'lojista/admin-loja.handlebars',cooperado:r,segmento:Seg})    
                                                         //   }else if(template==4){
                                                                let _id=r._id
                                                              console.log('2000',_id)
                                                                Mconstrucao.find({loja_id:_id})
                                                                            .then((result)=>{
                                                                            console.log('10000',result);
                                                                              res.render("pages/central/centralmenu.handlebars",{ layout:'central/admin.handlebars',loja:result}); 
                                                                          //    res.render("loja/empresa/alterar-produto",{ layout:'admin-loja.handlebars',cooperado:r,segmento:Seg,produto:result});
                                                                              }) 
                                                                              .catch((e)=>{
                                                                                  console.log(e)
                                                                              });
                                                          }                
                                                    //    }else{
                                                    //        console.log("Senha não confere?")
                                                    //        if(!r || r==undefined){
                                                    //            console.log("Senha não confere?")
                                                    //            console.log("algo está errado")
                                                    //            res.render("usuario/loginloja",{ layout:'admin.handlebars',errors:r})
                                                    //        }else{
                                                    //          console.log("FUDEU!")
                                                    //        }
                                                    //    }
                                                
                                                })
                                              }   
                                      
                                        //}
                                      )
              }                    
              catch(err){
                console.log(err)
            }
        }
     // }
})


//router.get('/alterar/:id',async(req,res)=>{
//   console.log('6');
//   console.log('--------------------------------') 
//   console.log("Alterar => ",req.params)
//     console.log('');
//   console.log('--------------------------------')
//   let id=req.params.id;
//   console.log(id)
//   Mconstrucao.find({_id:id})
//               .then((result)=>{
//                  console.log('');
                  //console.log('5656',result);
//                  let G=JSON.stringify(result)
                  //G=result;
//                  console.log('--------------------------------')
//                  console.log('');
//                  console.log(typeof(result));
//                  console.log(typeof(G));
//                  console.log('------------------------------------------');
                  //const Objet = Object.keys(G);
//                  console.log(G)
//                  res.render("loja/empresa/alterar-produto",{ layout:'admin-loja.handlebars',produto:G});
//               })
//               .catch((err)=>{
//                  console.log(err)
//               })
//})
module.exports = router;