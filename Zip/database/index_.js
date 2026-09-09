
const mongoose = require('mongoose')
require('dotenv').config({path:'./.env'})

// const 
if (`${process.env.NODE_ENV}`!=='development'){
        mongoose.connect(`${process.env.DB_CONNECT}`,
            {useNewUrlParser:true,
        }).then(()=>{

            console.log('___________________________________________________________');

            console.log(" => Conexão com MongoDB- Rotaes realizada com sucesso!!! <= ");
            urr=`${process.env.DB_URL}`;
            console.log('   URL :',urr);

            console.log('___________________________________________________________');

        }).catch((erro)=>{
            console.log('');
            console.log('_______________________________________________________________');
            console.log('');
            console.log("- Error:Não foi possivel conectar ao banco Development!!",erro)
            console.log('');
            console.log('_______________________________________________________________>');
            console.log('');
        });
 }else{
     console.log('linha 27',1)
     busc()
     async function  busc(){
             mongoose.connect("",{
                useNewUrlParser: true,
                useUnifiedTopology: true,
            }).then(()=>{
                console.log("Conexão com MongoDB-?????Loja Hum realizada com sucesso!!!")
            }).catch((erro)=>{
                console.log("-production - Error:Não foi possivel conectar ao banco Produção!",erro)
            });
      }
 }
 

module.exports = mongoose.connect;
