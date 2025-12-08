const express = require('express')
const router = express.Router()
const passport = require('passport')
//ATENÇÃO =>> usuarioloja/login

router.get('/logout',(req,res) => {
    console.log('--> /logout')
    req.logout()
    req.flash("success_msg","Deslogado com successo!")
    res.redirect('/usuario/login')
})

router.get('/login',(req,res)=>{
    console.log('');
    console.log('_______________________________________');
    console.log('');
    console.log(' [ empresa-17 ]');
    console.log(' origem views : views/empresa/usuario/{loja/login} ');
    console.log(' origem route : /empresa/usuario.js(get(/login))');
    console.log(' obs : renderizou a page do login.handlebars"');
    console.log('');
    console.log(' destino :page/empresa/lojalogin.handlebars');
    console.log('');
    console.log('__________________________________________________');
    console.log('')
   
    res.render("pages/empresa/lojalogin.handlebars",{layout:"empresa/login"})
    //...............................................................
})



module.exports = router;