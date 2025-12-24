const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
require("../../../database/index"); // ajuste para seu caminho



const Departamento =require("../../models/departamento");
const Fornecedor =require('../../models/fornecedor');
const Lojista = require("../../models/lojista"); // <-- se ainda não tem


// Listar todos os fornecedores
router.get("/", async (req, res) => {
  console.log('');
  console.log(' [ src/routes/empresa/fornecedores => [17/ get("/fornec/") ] ');
  console.log('');
  //////////////////////////////////////////////////////////
  try {
    const fornecedores = await Fornecedor.find().lean();
    res.json(fornecedores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/cadastro/:id", (req, res) => {

  console.log('------------------------');
  console.log('');
  console.log('[ 1000-24 ]',req.params.id)
  console.log('------------------------');

  let lojaId=req.params.id;
  console.log('80001', lojaId);
  console.log('');

  const menuItens = [
    { nome: "Cadastrar clientes", link: "/cliente/cadastro" },
    { nome: "Relatórios", link: "/relatorios" },
    { nome: "Fornecedores", link: "/fornecedor/cadastro" }
  ];
  
  res.render("pages/empresa/cadfornecedores",
     { layout: false, menuItens,
       lojaId 
     });
});
// Buscar endereço via CEP (chamada externa)
router.get("/buscacep/:cep", async (req, res) => {
      const cep = req.params.cep.replace(/\D/g, "");

      if (cep.length !== 8) {
        return res.status(400).json({ error: "CEP inválido." });
      }

      try {
      // const fetch = (await import("node-fetch")).default;
      console.log(cep)
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
          return res.status(404).json({ error: "CEP não encontrado." });
        }

        res.json(data);
      } catch (err) {
        res.status(500).json({ error: "Erro ao consultar CEP." });
      }
});


router.post("/gravarfornec", async (req, res) => {
  console.log('');
  console.log(' vem : views/pages/empresa/cadfornecedor.handlebars');
  console.log(' router: routes/empresa/fornecedores.js/gravarfornec');
  console.log('');
  console.log('');
  
  try {
    // pega dados do vínculo (não faz parte do schema do fornecedor)
    const { lojaId, marcaLoja } = req.body;
    
    // remove do body antes de criar o fornecedor (pra não “poluir”)
    const fornecedorData = { ...req.body };
   
    delete fornecedorData.lojaId;
    delete fornecedorData.marcaLoja;
    console.log(' fornecedorData :');
    console.log('',fornecedorData);
    const fornecedor = new Fornecedor(fornecedorData);
    await fornecedor.save();

    // se veio lojaId, grava o vínculo nos 2 lados
    if (lojaId) {
      // 1) INSERE fornecedor no lojista.fornecedores[]
      await Lojista.findByIdAndUpdate(
        lojaId,
        {
          $addToSet: {
            fornecedores: {
              fornecId: String(fornecedor._id),
              fornecName: fornecedor.razao || ""
            }
          }
        },
        { new: true }
      );

      // 2) INSERE loja no fornecedor.lojistas[]
      await Fornecedor.updateOne(
        { _id: fornecedor._id },
        {
          $addToSet: {
            lojistas: {
              loja: lojaId,
              marcaLoja: marcaLoja || ""
            }
          }
        }
      );
    }

    return res.status(201).json(fornecedor);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Gravar fornecedor
router.post("/A231225", async (req, res) => {
  try {
    const fornecedor = new Fornecedor(req.body);
    await fornecedor.save();
    res.status(201).json(fornecedor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Buscar fornecedor por ID
router.get("/:id", async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findById(req.params.id).lean();
    if (!fornecedor) return res.status(404).json({ error: "Fornecedor não encontrado." });
   // res.json(fornecedor);
  } catch (err) {
   // res.status(500).json({ error: err.message });
  }
});

// Criar novo fornecedor
router.post("/", async (req, res) => {
  try {
    const novoFornecedor = new Fornecedor(req.body);
    await novoFornecedor.save();
    res.status(201).json(novoFornecedor);
  } catch (err) {
    //res.status(400).json({ error: err.message });
  }
});

// Atualizar fornecedor
router.put("/:id", async (req, res) => {
  try {
    const fornecedorAtualizado = await Fornecedor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!fornecedorAtualizado) return res.status(404).json({ error: "Fornecedor não encontrado." });
    res.json(fornecedorAtualizado);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Deletar fornecedor
router.delete("/:id", async (req, res) => {
  try {
    const result = await Fornecedor.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Fornecedor não encontrado." });
    res.json({ message: "Fornecedor removido com sucesso." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/buscarporloja/:lojaid", async (req, res) => {
  try {
    const { lojaid } = req.params;

    const fornecedores = await Fornecedor.find({ loja_id: lojaid }).lean();

   // res.json(fornecedores);
  } catch (err) {
    console.error(err);
   // res.status(500).json({ error: "Erro ao buscar fornecedores" });
  }
});

router.get("/addfornec/:id",async(req,res)=>{
    console.log("Alô!",req.params)

})

router.get("/departamentos", async (req, res) => {
  console.log('');
  console.log('routes/empresa/fornecedores.js/departamento [ 162 ]')
  console.log('');
  try {
    const departamentos = await Departamento.find().lean();
    console.log('');
    console.log('',departamentos);
    console.log('');
    res.json(departamentos);
  } catch (err) {
    console.error("Erro ao buscar departamentos:", err);
    res.status(500).json({ error: "Erro ao buscar departamentos" });
  }
});

router.get("/listafornec/:id",async(req,res)=>{
  console.log('');
  //console.log("AQUI",req.params)
  console.log('------------------------');
  console.log('');
  console.log('[ 171 router/empresa/fornecedores/listafornec/:id ]',req.params.id)
  console.log('------------------------');

 try {
    const lojistaId = req.params.id;
    console.log('');
    console.log('LojistaID',lojistaId);
    console.log('-------------------------------------------------------');
    console.log('');
    const fornecedores = await Fornecedor.find({
                                                 qlojistas: lojistaId
                                               })
                                         .populate('qlojistas.lojaid', 'codigo') // se quiser campos do lojista
                                         .lean();
    let lojaNumber=lojistaId
    console.log('');
    console.log('[ 180  router/empresa/fornecedores/listafornec/:id] ',fornecedores)
    console.log('');
    console.log('valor de lojaNumber ',lojaNumber);
    console.log('');
    res.render('pages/empresa/fornecedor_lista', {
      layout:"central/admin",
      fornecedores,
      lojaNumber,
    });
  } catch (err) {
    console.error('Erro ao buscar fornecedores:', err);
    res.status(500).send('Erro interno do servidor');
  }
});

// Listar os fornecedores de um determinado lojista
router.get("/fornecqlojista/:id", async (req, res) => {
  const lojaId = req.params.id;

  console.log('');
  console.log(' [ src/routes/empresas/fornecedores//forneclojista/ ] Loja ID:', lojaId);
  console.log('');

  try {
    // Valida se o id é um ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(lojaId)) {
      return res.status(400).json({ error: "ID de loja inválido" });
    }

    // Busca fornecedores onde o ID da loja está no array qlojistas
    const fornecedores = await Fornecedor.find({ qlojistas: lojaId }).lean();

    res.json(fornecedores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/novocadastro/:id",async(req,res)=>{
   let numberId=req.params.id;
   console.log('-------------------------------');
   console.log('ATENÇÃO =>  ',numberId)
  


   console.log('-------------------------------');
   res.render("pages/empresa/cadfornecedores",  {
    layout:"central/admin" ,
  //  numberId
  });
  
})

//No cadfornecedores.handlebars  checa se já está cadastrado
router.get('/checar-cnpj/:cnpj/:lojaId', async (req, res) => {
  console.log('');
  console.log('vem de : routes/empresa/fornecedores.js/checar=cnpj');
  console.log(' req.params.cnpj   :',req.params.cnpj );
  console.log(' req.params.lojaId :',req.params.lojaId)
  console.log('');
  //..........................................................................
  try {
    let cnpjNum = String(req.params.cnpj || '').replace(/\D/g,'');
    const lojaId  = req.params.lojaId;

    if (cnpjNum.length !== 14) {
      return res.json({ ok:false, error:'CNPJ inválido' });
    }

    console.log('cnpjNum do fornecedor novo',cnpjNum);
    console.log('numero do lojista =>lojaId',lojaId);
    console.log('');
    console.log('---------------------------------------------------------');
    
    function maskCNPJ(num14) {
        return String(num14).replace(
          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
          "$1.$2.$3/$4-$5"
        );
    }

    const cnpjMask = maskCNPJ(cnpjNum);
    
    // ✅ busca correta
    // const forn = await Fornecedor.findOne({ cnpj: cnpjNum }).lean();
    const forn = await Fornecedor.findOne({
          $or: [
            { cnpj: cnpjNum },   // caso você tenha algum salvo sem máscara
            { cnpj: cnpjMask }   // caso esteja salvo com máscara (seu caso agora)
          ]
    }).lean();

    console.log(' [ 267 passando ',forn)

    if (!forn) {
      return res.json({ ok:true, exists:false });
    }

    // ✅ checa vínculo
    const jaVinculado = Array.isArray(forn.lojistas) &&
      forn.lojistas.some(l => String(l.loja) === String(lojaId));

    console.log('');  
    console.log('jaVinculado',jaVinculado);


    // if (!jaVinculado) {
    //   await Fornecedor.updateOne(
    //     { _id: forn._id, 'lojistas.loja': { $ne: lojaId } },
    //     { $push: { lojistas: { loja: lojaId, marcaLoja: '' } } }
    //   );
    // }

    console.log('');
    console.log('-----------------------------------------------------');
    // return res.json({ ok:true, exists:true, fornecedor: forn });
    return res.json({
       ok: true,
       exists: true,
       fornecedor: forn,
       jaVinculado,
});

  } catch (err) {
    console.log(err);
    return res.status(500).json({ ok:false, error:'Erro interno' });
  }
});

//Aqui a consulta é para o CNPJ do fornecedor do lojista
router.get('/consulta-cnpj/:cnpj', async (req, res) => {
  console.log(' ');
  console.log('________________________________________________________________________ ');
  console.log(' [ 314 ]');
  console.log(' origem views :pages/empresa/cadfornecedor.handlebars');
  console.log(' .................................................................');
  console.log(' origem route :routes/empresa/fornecedores/consulta-cnpj ');
  console.log(' obs :consulta o cnpj na receita federal para buscar os dados reais ');
  console.log('');
  console.log(' destino : cadfornecedor.handlebars');
  console.log('');
  const cnpj = req.params.cnpj;
  console.log('consultando o cnpj nº :',cnpj)
  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
    console.log(' 312 ', response);
   // console.log('++++++++++++++++++',response.json());
    console.log('');
    const data = await response.json();
    res.json(data); // devolve pro front-end
    } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar CNPJ' });
  }
});

router.post('/vincular-fornecedor', async (req, res) => {
  try {
    const { fornecedorId, lojaId, marcaLoja = '' } = req.body || {};
    if (!fornecedorId || !lojaId) {
      return res.status(400).json({ ok:false, error:'fornecedorId e lojaId são obrigatórios' });
    }

    await Fornecedor.updateOne(
      { _id: fornecedorId, 'lojistas.loja': { $ne: lojaId } },
      { $push: { lojistas: { loja: lojaId, marcaLoja } } }
    );

    return res.json({ ok:true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ ok:false, error:'Erro ao vincular fornecedor' });
  }
});

module.exports = router;
