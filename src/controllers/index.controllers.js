const { render } = require("express-handlebars");
const { ObjectId } = require("mongodb");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// require('../models/sample_roupa');
// const Roupa = mongoose.model('sample_roupa');

require('../models/lojista');
const Lojista = mongoose.model('lojista');

// require('../models/imageUp')
// const ImageItem = mongoose.model('uploadimage')

// const renderIndex = (req,res)=>{
//     res.render('upload',{
//         title:'Upload an image',
//     })
// };

const uploadFile =async (req,res) =>{
    console.log('¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨¨')
    console.log('');
    console.log('___________________________________');
    console.log('');
    console.log(' [ 27 index.controllers ]');
    console.log(' origem views : src/libs/multer.js');
    console.log(' origem route : src/controllers/index.controllers.js');
    console.log(' obs : aqui grava no MongoDb o path da imagem da OceanDigital');
    console.log('');
    console.log(' destino : ');
    console.log('');
    console.log(' ___________________________________');
    console.log('');
    //......................................................
    let corpo=req.body;
    let local=req.file.location;
    console.log('body :',corpo);
    console.log('____________________________________________________')
    //........................................................
    let idProduto=corpo.idProduto;
    let loja_id=corpo.nameLoja_id;
    let cor_id=corpo.idCorFoto;
    let t=corpo.LocalImagem;
    let side=corpo.PosicaoImg;
    console.log('');
    console.log('id do produto : ',idProduto);
    console.log('___________________________________')  
    console.log('');
    console.log('Loja_id : ',loja_id)
    console.log('___________________________________________');
    console.log('');
    console.log('cor_id : ',cor_id);
    console.log('___________________________________')  
    console.log(                 ); 
    console.log('valor de side : ',side);
    console.log('valor de type :',t);
    console.log('_________________________________');
    console.log('');
    console.log('[ 68 ] local : ',local)
    console.log('_________________________');
    console.log('');
    let idLojista;
    if(side=="tipolista" || side=="logomarca" || side=="titulopage"){
        idLojista=idProduto;
        console.log('1001',idLojista)
    }
    
    if(t==0){
         primeira_foto(side,t)    
    }else if(t>0){
        console.log('gravando nova foto ')
        segunda_foto(idProduto,side,local,t,cor_id)      
    }else if(t==10){
        logo_marca(side)   
    }
  
    // gravar foto da Vitrine
   async function primeira_foto(side,t){
        console.log('primeira foto')
        if (side=='front'){
            foto_front(t)
        }else if(side=='left'){
            console.log('primeira foto/left');
            foto_left(t)
        }else if(side=='back'){
            console.log('primeira foto/back');
            foto_back(t)
        }else if(side=='right'){
            console.log('primeira foto/right');
            foto_right(t)      
        }

        function foto_front(t){
                Roupa.findOne({
                    $and:[
                        {_id:idProduto},
                        {loja_id:loja_id}, 
                    ]
                },
                )
                .then((result)=>{
                    // Pega a cores
                    //let obj1=result.cores;
                    console.log('',result);
                    //let h=Object.values(obj1);
                    //.......................................
                   // if (h==0){
                        // Se não há cores então grava a primeira
                        console.log('[105');
                        updatePrime(idProduto,t)
                        loaddirect1(idProduto,loja_id,side,t)
                   // }else{
                   //     console.log('valor já registrado!')
                   //     loaddirect1(idProduto,loja_id,side,h)
                   // }
                })
                .catch((er)=>{
                    console.log(er);
                })
        }

        ///////////////////////////////////////////////////////////////////////// 
       function updatePrime(idProduto,t){
               Roupa.updateMany(
                 {
                     $and:[
                         {_id:idProduto},
                         {loja_id:loja_id},
                         {'cores.obj':0},    
                     ]
                 },
                 { $set:{cores:{
                                     obj:t,
                                     fase:1,
                                     urlfront:`${local}`,
                                     urlleft:'https://',  
                                     urlback:'https://',  
                                     urlright:'https://', 
                                     corback:'default',         
                                     corfront:'default',         
                                     corinput:'default', 
                                     especificacao:[
                                         {
                                             tamanho:'default',
                                             qte:0,
                                             precocusto:0,
                                             precovista:0,
                                             precoprazo:0,
                                         },  
                                     ],        
                                     }
                             } 
                 },{upsert:false}
             )
             .then((result)=>{
               console.log('result',result)
               ////////////////////////////////////////////////////////////
               Roupa.updateOne(
                        {_id:idProduto},
                        {$set:{
                               ponto:1
                              }
                        }
                    )
                    .then((result)=>{
                        console.log(result)
                    })         
                    .catch((error)=>{
                        console.log(error)
                    })
                    /////////////////////////////////////////////////////////////////    
             })
             .catch((er)=>{
             console.log('[ 138 ] index.controllers ]',er)
             })
}

       async function foto_left(t){
           await   Roupa.updateOne({
                                $and:[
                                    {_id:idProduto},
                                    {'cores._id':cor_id},    
                                    ]
                            },
                            { $set:{
                                    'cores.$[].urlleft':`${local}`,
                                    }
                            },
                        )   
                        .then((vitrine)=>{
                            console.log('');
                            console.log('extensao left :',vitrine)
                            console.log('______________________________________');
                            //::::::::::::::::::::::::::::::::::::::::::::::::::::::
                            loaddirect1(idProduto,cor_id,side,t)
                        })
                        .catch((er)=>{
                            console.log('[169] error ',er)
                        })
        }

       async function foto_back(){
                await  Roupa.updateOne({
                    $and:[
                        {_id:idProduto},
                        {'cores._id':cor_id},    
                    ]},
                    { $set:{
                        'cores.$[].urlback':`${local}`,
                        }
                    },
                )   
                .then((vitrine)=>{
                    console.log('');
                    console.log('[185] extensao back :',vitrine);
                    console.log('_________________________________________');
                    loaddirect1(idProduto,cor_id,side,t)
                })
                .catch((er)=>{
                    console.log('error 191 ',er)
                })
       }
       
        async function foto_right(){
            await  Roupa.updateOne({
                $and:[
                    {_id:idProduto},
                    {'cores._id':cor_id},    
                ]},
                { $set:{
                     'cores.$.urlright':`${local}`,
                     'cores.$.fase':2,
                     'cores.$.corback':"#888888"
                    }
                },
             )   
            .then((vitrine)=>{
                console.log('');
                console.log('vitrine right :',vitrine)
                console.log('______________________________________________');
                ////////////////////////////////////////////////////////////
                Roupa.updateOne(
                            {_id:idProduto},
                            {$set:{
                                ponto:2
                            }
                            } )
                     .then((result)=>{
                         console.log(result)
                     })         
                     .catch((error)=>{
                         console.log(error)
                     })
                /////////////////////////////////////////////////////////////////    
                loaddirect1(idProduto,cor_id,side,t)
                /////////////////////////////////////////////////////////////////    
            })
            .catch((er)=>{
                console.log('[210] error :',er)
            })
        }
        
    }

    function segunda_foto(idProduto,side,local,t,cor_id){
        // grava uma nova cor  
        console.log('gravando nova cor t=2',idProduto)
        if (side=='front'){
            segundafoto_front(idProduto,side,local,t)
        }else if(side=='left'){
            console.log('gravando nova foto left')
            segundafoto_left(idProduto,local,side,t,cor_id)
        }else if(side=='back'){
            segundafoto_back(idProduto,local,side,t,cor_id)
        }else if(side=='right'){
            segundafoto_right(idProduto,local,side,t,cor_id)      
        }
        //>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

        async function segundafoto_front(idProduto,side,local,t){
            console.log('[ 243 ] ==>',idProduto,local,t,side)
            Roupa.findOne({_id:idProduto})
                 .then((vitrine)=>{
                   // console.log(vitrine);
                    let cores=vitrine.cores;
                    console.log(typeof(cores))
                    console.log('_______________________________')
                    let n=cores.length;
                    console.log(n)
                    //[cores]=cores;
                    console.log('[253]====> ',cores)
                    let p;
                    p=cores.length;
                    //////////////////////////////////////
                  
                    console.log('');
                    console.log('[259]vr de p',p)
                    console.log('_________________________________');
                    ////////////////////////////////////////////////
                    //if (p==1){
                        console.log('[263]',500)
                        //return
                        gravaNovaCor(idProduto,side,local,t)
                    //}else if(p>1){
                        //COLOCAR UMA MSG
                    //    console.log(1000)
                    //    cor_id=cores[p-1]._id;
                    //    console.log('vvvv',cor_id);
                    //    cor_id=cor_id.toString();
                       // res.render("_cooperado/lojista/roupas/roupa-tabela-cores-home",{ layout:'lojista/roupa-table-cor-home.handlebars',vitrine:vitrine,corUrl:corUrl,corId:corId});
                        loaddirect2(idProduto,side,local,t,cor_id)
                        
                    //}
                 })
                 .catch((e)=>{
                    console.log(e)
                 })
            function gravaNovaCor(idProduto,side,local,t){
                Roupa.updateMany(
                    {_id:idProduto},
                    { $push :
                       {
                          cores:{
                            obj:t,
                            fase:1,
                            urlfront:`${local}`,
                            urlleft:'https://',
                            urlback:'https://',
                            urlright:'https://',
                            corback:'808080',
                            corfront:'080808',
                            corinput:'888888',
                            especificacao: [
                               {
                                   tamanho:'default',
                                   qte:0,
                                   precocusto:0,
                                   precovista:0,
                                   precoprazo:0,
                               }
                            ]
                          } 
                       }
                  })
                 .then((result)=>{
                    console.log('[306] march ====> ',result);
                    ////////////////////////////////////////////////////////////
                    Roupa.updateOne(
                                     {_id:idProduto},
                                     {$set:{
                                                     ponto:1
                                                  }
                                      }
                         )
                        .then((result)=>{
                            console.log(result)
                        })         
                        .catch((error)=>{
                            console.log(error)
                        })
                        /////////////////////////////////////////////////////////////////    
                    
                    //::::::::::::::::::::::::::::::::::::::::::::
                    Roupa.aggregate([{
                                       $match:{
                                           'cores.corback':'808080',
                                        } 
                                     },{$project:{
                                             'cores.corback':1, 
                                             'cores._id':1,
                                             'cores.obj':1, 
                                          }
                                   },
                                   ])
                          .then((vitrine)=>{
                              console.log('');
                              console.log('_______________________________________');
                              [vitrine]=vitrine;
                              let G=vitrine.cores;
                              console.log('Emissor : ',G);
                              let l=G.length;
                              console.log('');
                              console.log('');
                              console.log(' [ 328 n]:::::::::',Object.values(G[l-1]));
                              let p=Object.values(G[l-1]);
                              cor_id=p[2],
                              console.log('_______________________________________');
                              loaddirect2(idProduto,side,local,t,cor_id)
                           })
                          .catch((e)=>{
                              console.log(e);
                          })
                    //::::::::::::::::::::::::::::::::::::::::::      
                    
                 })
                 .catch((er)=>{
                   console.log('[ 230 index.controllers ]',er)
                 })
            }     
        }

        async function segundafoto_left(idProduto,local,side,t,cor_id){
               console.log('gravando nova foto 100')
               console.log('idproduto',idProduto);
               console.log('cor_id',cor_id)
               console.log('__________________________________')
               console.log('');
               Roupa.updateOne({
                                $and:[
                                        {idproduto:idProduto},
                                        {'cores._id':cor_id},
                                     ]
                                },
                                { $set:{
                                          'cores.$[].urlleft':`${local}`
                                        }
                                }
                    )
                    .then((result)=>{
                        console.log('');
                        console.log('modifiedCount',result);
                        console.log('idfoto',cor_id)
                        /////////////////////////////////////////////////////
                        loaddirect2(idProduto,side,local,t,cor_id)
                        /////////////////////////////////////////////////////
                    })           
                    .catch((er)=>{
                        console.log(er);
                    })
        }

        async function segundafoto_back(idProduto,local,side,t,cor_id){
            console.log('');
            Roupa.updateOne({
                    $and:[
                            {idproduto:idProduto},
                            {'cores._id':cor_id},
                        ]
                    },
                    { $set:{
                            'cores.$[].urlback':`${local}`
                            }
                    }
                )
                .then((result)=>{
                    console.log('');
                    console.log('modifiedCount',result);
                    console.log('modifiedCount',result);
                    console.log('idfoto',cor_id)
                    /////////////////////////////////////////////////////
                    loaddirect2(idProduto,side,local,t,cor_id)
                })           
                .catch((er)=>{
                  console.log(er);
                })
        }
        
        async function segundafoto_right(idProduto,local,side,t,cor_id){
            console.log('');
            Roupa.updateOne({
                $and:[
                        {idproduto:idProduto},
                        {'cores._id':cor_id},
                        ]
                },
                { $set:{
                            'cores.$.fase':2,
                            'cores.$.urlright':`${local}`
                        }
                }
            )
            .then((result)=>{
                console.log('');
                console.log('modifiedCount',result);
                console.log('idfoto',cor_id)
                ////////////////////////////////////////////////////////////
                Roupa.updateOne(
                    {_id:idProduto},
                    {$set:{
                        ponto:4
                          }
                    })
                    .then((result)=>{
                        console.log(result)
                    })         
                    .catch((error)=>{
                        console.log(error)
                    })
                /////////////////////////////////////////////////////////////////    
                loaddirect2(idProduto,side,local,t,cor_id)
            })           
            .catch((er)=>{
               console.log(er);
            })
        }
    }

    function logo_marca(side){
            // aqui 
            if(side=='tipolista'){
                logo_lojotipo()
            }else if(side=='logomarca'){
                logo_marca()
            }else if(side=='titulopage'){
                titulopage()
            }
    }
    
    function logo_lojotipo(){
             Lojista.updateOne(
                        {_id:`${idLojista}`},
                        { $set:{
                                'urllogolista':`${local}`,
                            }
                        },
                    )
                    .then((r1)=>{
                        console.log('tipo lista ',r1);
                        Lojista.findOne({ _id:idLojista},{urllogolista:1,urllogomarca:1,urltitulopage:1})
                                .then((r2)=>{
                                    console.log('......>',r2);
                                    res.render("_cooperado/templates/roupa-header-logo",{ layout:'lojista/admin-loja.handlebars',idLoja:idLojista,r1:r2});
                                })
                                .catch((er)=>{
                                    console.log(er) ;
                                })
                        })
                    .catch((er)=>{
                        console.log(' [ 402 index.controllers  ] src/controllers/index.controllers.js ',er)
                    })
    }
     
    function logo_marca(){
            Lojista.updateOne(
                {_id:`${idProduto}`},
                { $set:{
                        'urllogomarca':`${local}`,
                    }
                },
                )
            .then((r1)=>{
                console.log('logomarca : ',r1);
                Lojista.findOne({ _id:idLojista},{urllogolista:1,urllogomarca:1,urltitulopage:1})
                                    .then((r2)=>{
                                        console.log('......>',r2);
                                        res.render("_cooperado/templates/roupa-header-logo",{ layout:'lojista/admin-loja.handlebars',idLoja:idLojista,r1:r2});
                                    })
                                    .catch((er)=>{
                                        console.log(er) ;
                                    })
            })
            .catch((er)=>{
                console.log(' [ 424 index.controllers ] src/controllers/index.controllers.js ',er)
            }) 
     }
    
     function titulopage(){
            Lojista.updateOne(
                {_id:`${idProduto}`},
                { $set:{
                        'urltitulopage':`${local}`,
                    }
                },
            )
            .then((r1)=>{
                console.log(' match titulo page',r1);
                Lojista.findOne({ _id:idLojista},{urllogolista:1,urllogomarca:1,urltitulopage:1})
                        .then((r2)=>{
                            console.log(' titulo page : ',r2);
                            res.render("_cooperado/templates/roupa-header-logo",{ layout:'lojista/admin-loja.handlebars',idLoja:idLojista,r1:r2});
                        })
                        .catch((er)=>{
                            console.log(er) ;
                        })
            })
            .catch((er)=>{
                console.log(' [ 446 index.controllers  ] src/controllers/index.controllers.js ',er)
            })   

     }

    function  loaddirect1(idProduto,loja_id,side,t,h){
        console.log(idProduto,loja_id,side)
        Roupa.find({_id:idProduto})
                 .then((vitrine)=>{
                       console.log('');
                       console.log(' [ 583 index.controllers ] vitrine =>',vitrine)
                       console.log('');
                       [vitrine]=vitrine;
                       console.log(vitrine.cores)
                       carregaPage1(idProduto,side,t,h)
                       //.....................................................
               
                 })
                 .catch((err)=>{
                    console.log('error',err);
                 })
        //??????????????????????????????????????????????????????????????
     
    }

    function  loaddirect2(idProduto,side,local,t,cor_id){
        console.log('');
        console.log(idProduto,side,t,cor_id)
        console.log(local,)
        console.log('[576]___________________________________________');
        Roupa.find({
                    $and:[
                         {_id:idProduto},
                         {'cores._id':cor_id}
                        ]
                  })
                 .then((vitrine)=>{
                       console.log('');
                       console.log(' [ 563 index.controllers ] vitrine =>',vitrine)
                       console.log('');
                       [vitrine]=vitrine;
                       let h=0;
                       Roupa.findOne({_id:idProduto})
                            .then((vitrine)=>{
                                carregaPage2(vitrine,side,t,h)
                            })
                            .catch((e)=>{
                                 console.log(e)
                            })
                       //.....................................................
               
                 })
                 .catch((err)=>{
                    console.log('error',err);
                 })
        //??????????????????????????????????????????????????????????????
     
    }


    function carregaPage1(idProduto,side,t,h){
        console.log('valor de t :',t,'valor de side :',side)
        console.log('');
        //console.log('[ 605 ] vitrine',vitrine)
        /////////////////////////////////////////////////////
        Roupa.findOne({_id:idProduto})
             .then((vitrine)=>{
                console.log('10',vitrine);
                let cores=vitrine.cores;
                [cores]=cores;
                console.log('20',cores);
                let especificacao=cores.especificacao;
                [especificacao]=especificacao;
                console.log('30',especificacao);
                //return
                res.render("_cooperado/lojista/roupas/roupa_insere-foto",{ layout:'lojista/roupa-edita-temp.handlebars',vitrine:vitrine,cores:cores,especificacao:especificacao});  
             })
             .catch((e)=>{
                console.log(e);
             })
       
      
    }         

    function carregaPage2(vitrine,side,t,h){
        console.log('valor de t :',t,'valor de side :',side)
        console.log('');
        //console.log('[ 637 ] vitrine',vitrine)
        /////////////////////////////////////////////////////
        let idproduto=vitrine._id;
        let cores=vitrine.cores;
        [cores]=cores;
        let especificacao=cores.especificacao;
        [especificacao]=especificacao
        //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
        if (side=='front'){
            console.log('[646]') 
            console.log('______________________________________') 
            Roupa.distinct('cores',{_id:idproduto})
            .then((cores)=>{
                console.log('array de cores : ',cores)
                let pacote=cores[1];
                console.log('');
                console.log('',pacote);
                console.log('');
                let p=cores.length;
                console.log('vr de p',p)
                cores=cores[p-1];
                console.log('');
                console.log('cores',cores);
                console.log('__________________________________________');
                let ponto=t;
                //return
                res.render("_cooperado/lojista/roupas/roupa_insere-foto",{ layout:'lojista/roupa-edita-temp.handlebars',vitrine:vitrine,cores:cores,ponto:ponto});  
            })
            .catch((er)=>{
                console.log(er)
            })
        }else{
            Roupa.distinct('cores',{_id:idproduto})
            .then((cores)=>{
                console.log('array de cores : ',cores)
                let pacote=cores[1];
                console.log('');
                console.log('',pacote);
                console.log('');
                let p=cores.length;
                console.log('vr de p',p)
                cores=cores[p-1];
                console.log('');
                console.log('cores',cores);
                console.log('__________________________________________');
                let ponto=t;
                //return
                res.render("_cooperado/lojista/roupas/roupa_insere-foto",{ layout:'lojista/roupa-edita-temp.handlebars',vitrine:vitrine,cores:cores,ponto:ponto});  
            })
            .catch((er)=>{
                console.log(er)
            })
        }
    }         
}  
    
    



const getFiles =async (req,res) =>{
    console.log(8888)
    const images = await Image.find()
    console.log(images)
    res.render('files',{
        title:'Get files',
        images
    })
};

const getSingleFile = (req,res)=>{};

module.exports = {
    getFiles,
    getSingleFile,
    uploadFile
}


 //async function outra_foto(){
   //     if (side=='front'){
   //         console.log('aqui dentro front')
   //         console.log('-----',idcorfoto)
   //         console.log('');
   //         await  Roupa.updateOne(
   //                             {_id:`${idcorfoto}`},
   //                             { $set:{
   //                                 urlfront:`${local}`,
   //                                 }
   //                             },
   //                        )   
   //                       .then((extensao)=>{
   //                         console.log('');
   //                         console.log('extensao left :',extensao)
   //                         console.log('');
   //                         console.log(' [ 300 index.controllers ] idProduto dentro de left',idProduto,idcorfoto)
   //                         console.log('')
   //                         console.log('______________________________________');
   //                        loaddirect(idProduto,idcorfoto,side,t)
   //                 })
   //                 .catch((er)=>{
   //                     console.log(er)
   //                 })
   //             //}  
   //     }else if(side=='left'){
   //         console.log('aqui dentro left=3')
   //         console.log('-----',idcorfoto)
   //         console.log('');
   //         await  Roupa.updateOne(
   //             {_id:`${idcorfoto}`},
   //             { $set:{
   //                   urlleft:`${local}`,
   //                 }
   //             },
   //         )   
   //         .then((extensao)=>{
   //             console.log('');
   //             console.log('extensao left :',extensao)
   //             console.log('');
   //             console.log(' [ 324 index.controllers ] idProduto dentro de left',idProduto,idcorfoto)
   //             console.log('')
   //             console.log('______________________________________');
   //             //....................................
   //             loaddirect(idProduto,idcorfoto,side,t)
   //         })
   //         .catch((er)=>{
   //             console.log('error 275',er)
   //         })
   //     }else if(side=='back'){
   //         console.log('1 :',idProduto,    '2 :',local)
   //         await  Roupa.updateOne(
   //             {_id:`${idcorfoto}`},
   //             { $set:{
   //                    urlback:`${local}`,
   //                 }
   //             },
   //         )   
   //         .then((extensao)=>{
   //             console.log('');
   //             console.log('extensao back :',extensao);
   //             console.log('');
   //             console.log('idProduto dentro de back',idProduto)
   //             console.log('')
   //            console.log('_________________________________________');
   //             loaddirect(idProduto,idcorfoto,side,t)
   //         })
   //        .catch((er)=>{
   //             console.log(er)
   //         })
   //     }else if(side=='right'){
   //         await  Roupa.updateOne(
   //             {_id:`${idcorfoto}`},
   //             { $set:{
   //                   urlright:`${local}`,
   //                 }
   //             },
   //         )   
   //         .then((extensao)=>{
   //             console.log('');
   //             console.log('extensao right :',extensao)
   //             console.log('');
   //             console.log('boxBody dentro de right',idProduto,idcorfoto)
   //             console.log('')
   //             console.log('______________________________________________');
   //             loaddirect(idProduto,idcorfoto,side,t)
   //         })
   //         .catch((er)=>{
   //             console.log(er)
   //         })
   //     }else{
   //         console.log('bingo!')
   //     }
   // }


