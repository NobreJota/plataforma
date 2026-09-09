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
    console.log(' [ dentro de : routes/contab/auxiliares/usuario line 71 ]');
    console.log(' origem views : ???views/auxiliares/usuario/{loja/login} ');
    console.log(' origem route : /contab/auxiliares/usuario.js(get(/login))');
    console.log(' obs : renderizou a page do login.handlebars"');
    console.log('');
    console.log(' destino :contab/auxiliares/contab_login.handlebars');
    console.log('');
    console.log('__________________________________________________');
    console.log('')
   
    res.render("contab/auxiliares/contab_login.handlebars",{layout:"contab/login"})
    //...............................................................
})



module.exports = router;