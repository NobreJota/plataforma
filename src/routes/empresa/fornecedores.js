const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
require("../../../database/index"); // ajuste para seu caminho



const Departamento =require("../../models/departamento");

const Fornecedor =require('../../models/fornecedor');



// Listar todos os fornecedores
router.get("/", async (req, res) => {
  console.log('');
  console.log(' [ 17 /fornec/ ] ');
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

// Gravar fornecedor
router.post("/gravarfornec", async (req, res) => {
  try {
    let n1=req.body;
    console.log("=> ",n1)
    const fornecedor = new Fornecedor(req.body);
    await fornecedor.save();
    res.status(201).json(fornecedor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Gravar fornecedor
router.post("/", async (req, res) => {
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
  console.log(40000)

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
  console.log(' [ 17 /fornec/ ] Loja ID:', lojaId);
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

module.exports = router;
