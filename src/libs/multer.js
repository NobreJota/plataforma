const aws = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
require('dotenv').config({path:'./.env'})
const crypto = require('crypto')
// const path = require('path');

//const { S3_ENDPOINT } = process.env.S3_ENDPOINT;
const BUCKET_NAME = process.env.BUCKET_NAME;
const SPACES_KEY = process.env.SPACES_KEY;
const SPACES_SECRET = process.env.SPACES_SECRET;

console.log('-----------------------------')
console.log('12',BUCKET_NAME)
console.log('-----------------------------')
console.log('16',SPACES_KEY)
console.log('-----------------------------')
console.log('18',SPACES_SECRET)
console.log('-----------------------------')

//endpoint:'nyc3.digitaloceanspaces.com',
const s3 = new aws.S3({
        endpoint:`https://${process.env.S3_ENDPOINT}`,
        accessKeyId:SPACES_KEY,
        secretAccessKey:SPACES_SECRET,
})

const upload = multer({
         storage:multerS3({
         s3,
         bucket:BUCKET_NAME,
         acl:'public-read',
         metadata:(req,file,cb) =>{
            cb(null,{
                fieldname:file.fieldname ,
            })
         },
         key:(req,file,cb)=>{
            cb(null,crypto.randomBytes(10).toString('hex')  + "_" + file.originalname);
            console.log(' obs : Faz a gravação da imagem na OceanDigital');
            console.log('  :');
            console.log(' destino  : src/controlles/index.controllers.js');
            console.log('______________________________________')
            console.log('');
        }
         
    }),
}).single('upload');

module.exports = { upload,s3 };