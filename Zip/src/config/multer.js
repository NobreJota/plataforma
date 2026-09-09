const express=require('express')
const multer = require('multer')
const path =require('path')
const crypto = require('crypto')

const tmpFolder =path.resolve(__dirname,'..','..','tmp')

module.exports = app => {
    console.log(2323)
    directory=tmpFolder;
  
    storage=multer.diskStorage({
       destination:tmpFolder,
       filename:(req,res)=>{
           const fileHasn=crypto.randomBytes(10).toString('hex');
           const filename=`${fileHasn}-${file.originalname}`

           return callback(null,filename)
       }
    })
}