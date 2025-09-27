// const express = require('express')
const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const localStrategy = require('passport-local').Strategy

//require("../src/models/usuario")
//const Usuario = mongoose.model('usuarios')
const Usuario = require('../src/models/usuario'); // caminho relativo a partir de config/
const passport = require('passport')
const res = require('express/lib/response')

module.exports = function (passport) {
    // Salvar os addos do usuário na sessão
    console.log('A-1000');
    passport.serializeUser((usuario,done) => {
        done(null,usuario.id)
    })
   
    passport.deserializeUser((id,done) => {
        console.log('BA-1000');
        Usuario.findById(id,(erro,usuario) => {
               done(erro,usuario)
        })
    }) 

    passport.use(new localStrategy({
        usernameField:'email',passwordField:'senha'
    }, async (email,senha,done)=>{
                Usuario.findOne({email:email})
                        .then((usuario)=>{
                           // console.log('______________________________');
                            console.log('');
                            console.log(' [ 31 ] => config/auth.js/passport.use(new localStrategy)')
                            console.log('');
                            //console.log('linha 39 --> module.export dentro de config/auth.js',usuario)
                            if(!usuario | usuario=='null'){
                                return done(null,false,{message:"Cadastro com este e-mail não encontrado!X"})
                            }
                            //console.log("valor do usuário???",usuario)
                            if(usuario.admin==1){
                                    bcryptjs.compare(senha,usuario.senha,(erro,correta) => {
                                        console.log('valor -correta- true');
                                        console.log(correta)
                                        if(correta){
                                           console.log(usuario) 
                                           return done(null,usuario)
                                        }else{
                                           return done(null,false,{message:"Dados de acesso não confere!"})
                                        }
                                    })
                                }else{
                                    console.log("não é administrador!")
                                    return done(null,false,{message:"não é administrador!"})
                                }         
                        })   
                        .catch((err)=>{
                            console.log(err)
                        })
                
                        // Salvar os addos do usuário na sessão
                       
                        //  
                          passport.serializeUser((usuario,done) => {
                             console.log('Deserializing User ...',usuario)
                             done(null,usuario.id)
                         })
                       
                        // passport.deserializeUser((id,done) => {
                        //     console.log('Deserializing User ...',id)
                        //      Usuario.findById(id,(erro,usuario) => {
                        //            done(erro,usuario)
                        //     })
                        
                        //  })
            }))

         //   console.log('linha 92-> config/auth =end')
}

   