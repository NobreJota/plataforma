const express = require('express')
const router = express.Router()
//ATENÇÃO =>> admin/login


// const { eAdmin } = require("../../../../helpers/eAdmin")
// -----------------------------------------------------------------------------------------------
//   ENTRANDO NO HOME DA PARTE ADMINISTRATIVA ? 
// -----------------------------------------------------------------------------------------------
router.get('/login',(req,res) => {
    console.log('');
    console.log('__________________________________________');
    console.log(' [ 11 ]');
    console.log(' origem views : /www.rotaes.com.br/{admin/login}');
    console.log(' origem route : { central/ } ./src/routes/_admin/admin_main.js=> get/');
    console.log(' obs : layout:"adminCentral.handlebars"');
    console.log('');
    console.log(' destino : _admin/admin/admincentral => central-dashboads');
    console.log('');
    res.render("pages/central/loginCentral.handlebars", {layout:'central/login.handlebars'})
})

module.exports = router;