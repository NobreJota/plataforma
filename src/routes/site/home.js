const express=require('express')
const router=express.Router()
const mongoose = require('mongoose')
const multer = require('multer')
const path =require('path')
const fs = require('fs')

// const { eAdmin } = require("../../../../helpers/eAdmin")
// const { eAdmin } = require("../../helpers/eAdmin")
const flash = require('connect-flash')
const console = require('console')

// 7768
router.get('/',(req,res)=>{
   console.log('');
   console.log('______________________________________');
   console.log(' ');
   console.log(' [ 18-site/home ]');
   console.log(' origem views :quando usuário digita a URL "rotaes.com.br" ');
   console.log(' origem route : _admin/admin-central/home.js/get("/")');
   console.log(' obs : página do site HOME');
   console.log('');
   console.log(' destino :pages/site/home.handlebars :: layout:""');
   console.log('');
   console.log('');
   // res.render("pages/site/home",{ layouts:'central/main.handlebars'});
   res.render('pages/site/home',{layout:''})
})
  
module.exports=router