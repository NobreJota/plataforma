const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose');
////////////////////////////////////////////////
require('dotenv').config({path:'./.env'})
////////////////////////////////////////////////
const { eAdmin } = require("../../../helpers/eAdmin");
////////////////////////////////////////////////
require('../../models/lojista');
const Lojista = mongoose.model('lojista');

require('../../models/mconstrucao');
const Mconstrucao=mongoose.model('m_construcao')
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
                  .collation({ locale: 'pt', strength: 2 }) // case-insensitive
                        .select('+senha email razao _id')          // <-- inclui a senha só aqui
                        .lean();     
                        
                        if (!Usuario) {
                          req.flash('error_msg', 'Usuário não encontrado.');
                          return res.redirect('/usuarioloja/login');
                        }                              // use lean se quiser objeto simples
                            // .then((r)=>{
                            //     console.log('resultado pesquisa para ',emae,' : ',r)
                            //     if (r==="null"){
                            //         console.log('Não foi encontrado o lojista')
                            //         return
                            //     }else{
                            //         let Sub={};
                            //         let L={};
                            //         let Seg={};
                            //         let segment=[];
                            //     }
                                ///////////////////////////////////////////////////////////////
                                bcrypt.compare(senha,r.senha,(erro,correta) => {
                                    if(correta){
                                        console.log('_______________________________________________________')
                                        console.log('')
                                        console.log('a senha estando correta ,então')
                                        console.log('vai para: view/loja/menu-loja')
                                        console.log('')
                                        console.log('_______________________________________________________')
                                        console.log('')
                                        let _id=r._id
                                        console.log('2000',_id)
                                        Mconstrucao.find({loja_id:_id})
                                                    .then((result)=>{
                                                        console.log('10000',result);
                                                        res.render("pages/central/centralmenu.handlebars",{ layout:'central/admin.handlebars',loja:result}); 
                                                    }) 
                                                    .catch((e)=>{
                                                      console.log(e)
                                                    });
                                                  }     
                                                })           
            }                
            catch(err){
            console.log(err)
            }
   }
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

//})
module.exports = router;