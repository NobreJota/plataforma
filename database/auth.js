// const express = require('express')
const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const localStrategy = require('passport-local').Strategy

require("../src/models/usuario")
const Usuario = mongoose.model('usuario');
const passport = require('passport');
console.log('passando aqui')
module.exports = async function (passport) {
    console.log('(11) -->module.export/config/auth')
    //console.log('valor de ->>>','email')
    await  passport.use(new localStrategy({usernameField:'email',passwordField:'senha'},(email,senha,done)=>{
    //   Usuario.findOne({email:email})
    //          .then((usuario)=>{
    //             console.log('(616) -->module.export/config/auth')
    //             if(!usuario){
    //                 return done(null,false,{message:"Cadastro com este e-mail não encontrado!X"})
    //             }
    //             console.log("valor do usuário",usuario)
    //             if(usuario.admin==1){
    //                     bcryptjs.compare(senha,usuario.senha,(erro,correta) => {
    //                         console.log('linha 23 --> database/auth.js',correta)
    //                         if(correta){
    //                         return done(null,usuario)
    //                         }else{
    //                         return done(null,false,{message:"Dados de acesso não confere!"})
    //                         }
    //                     })
    //                 }else{
    //                     console.log("não é administrador!")
    //                     return done(null,false,{message:"não é administrador!"})
    //                 }         
    //          })   
    //          .catch((err)=>{
    //              console.log(err)
    //          })
    
             // Salvar os addos do usuário na sessão
             passport.serializeUser((usuario,done) => {
                 done(null,usuario.id)
             })

             passport.deserializeUser((id,done) => {
                Usuario.findById(id,(erro,usuario) => {
                   done(erro,usuario)
                })
             })         
            }))
}