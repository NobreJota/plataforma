const mongoose = require('mongoose')
const Schema = mongoose.Schema
// Está tabela cadastrará os usuários/clientes do do site e administradores do site
const Usuario = new Schema ( {
    nome:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        //minlength:[6,'email must be at least 6'],
       //unique:true
    },
    senha:{
        type:String,
        required:true,
        select: false
    },
    admin:{
        type:String,
        required:false
    },
    createAt:{
        type:Date,
        default:Date.now()
    },
    updateAt:{
       type:Date,
       required:false
   }
})

mongoose.model("usuarios",Usuario)