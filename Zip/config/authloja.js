// const express = require('express')
const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const localStrategy = require('passport-local').Strategy

require("../src/models/cadastroNegocio")
const Cooperdao = mongoose.model('cadnegocio')
const passportLoja = require('passport')

module.exports = function (passportLoja) {
    console.log('--> Passport')
    passportLoja.use(new localStrategy({usernameField:'email',passwordField:'senha'},(email,senha,done)=>{
        Cooperdao.findOne({email:email})
                  .then((usuario)=>{
                     if(!usuario){
                         return done(null,false,{message:"Cadastro com este e-mail não encontrado!"})
                     }
                     console.log(usuario,"12")
                     bcryptjs.compare(senha,usuario.senha,(erro,correta) => {
                         console.log(correta)
                         if(correta){
                            return done(null,usuario)
                         }else{
                            return done(null,false,{message:"Dados de acesso não confere!"})
                         }
                     })
                  })   
                  .catch((err)=>{
                      console.log(err)
                  })

         
                  // Salvar os addos do usuário na sessão
                  passportLoja.serializeUser((usuario,done) => {
                      done(null,usuario.id)
                  })

                  passportLoja.deserializeUser((id,done) => {
                     Usuario.findById(id,(erro,usuario) => {
                        done(erro,usuario)
                     })
                  })         
    }))
  
}




