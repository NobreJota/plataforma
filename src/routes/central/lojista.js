const express = require('express');
const router = express.Router();
const { Lojista , segmento }= require('../../models/lojista');
const Segmentos = require("../../models/departamento");


router.get('/lojista', async (req, res) => {
   console.log(" [ 8 passando por lojista ] ")
   try {
    const lojistas = await Lojista.find()
      .populate("departamentos", "nomeDepartamento")
      .lean();

    console.log('[ 11 lojista ]:', lojistas);
    
    res.render("pages/central/listaLojista.handlebars", {
      layout: 'empresa/admin-empresa.handlebars',
      lojista: lojistas
    });

  } catch (err) {
    console.error('[Erro ao buscar lojistas]:', err);

    // Renderiza mesmo com erro, apenas com lista vazia
    res.render("pages/central/listaLojista.handlebars", {
      layout: 'empresa/admin-empresa.handlebars',
      lojista: [],
      erro: 'Erro ao carregar lojistas'
    });
  }
});

router.post("/lojista/create", async (req, res) => {
  console.log('');
  console.log('-----------------------------------------');
  console.log(' [ 24 /lojista/create ]',req.body);
  console.log('');
  console.log(req.body);
  console.log('');
 try {
    //const { segmentos, ...dados } = req.body;

    // const novoLojista = new Lojista({
    //   ...dados,
    //   departamento: req.body.departamento,
    // });
    const novoLojista = new Lojista(req.body);

    await novoLojista.save();
    res.status(200).json({ message: "Lojista salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar Lojista:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/segmentos", async (req, res) => {
  console.log('------------------');
  console.log("Consultando segmentos...");
  try {
    const segmentos = await Segmentos.find().lean();
    console.log("Segmentos retornados:", segmentos);
    res.set("Cache-Control", "no-store");
    res.json(segmentos);
  } catch (err) {
    res.status(500).send("Erro ao buscar segmentos.");
  }
});

router.put('/lojistas/:id', async (req, res) => {
  try {
    console.log(8000)
    const lojista = await Lojista.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(lojista);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/lojistas/:id', async (req, res) => {
  try {
    await Lojista.findByIdAndDelete(req.params.id);
    res.json({ message: 'Lojista removido com sucesso.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/lojista/update/:id", async (req, res) => {
  console.log('[ 76 ] ',  req.params)
  try {
    const { id } = req.params;
    const updateData = req.body;

    await Lojista.findByIdAndUpdate(id, updateData, { new: true });
    res.json({ message: "Atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar Lojista:", error);
    res.status(500).json({ message: error.message });
  }
});

// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// routes/api/departamentos.js

const Departamento = require('../../models/departamento');

router.get('/', async (req, res) => {
  try {
    const departamentos = await Departamento.find({}, '_id nomeDepartamento').lean();
    res.json(departamentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar departamentos' });
  }
});

router.post('/salvar', async (req, res) => {
  try {
    const {
      _id, razao, responsavel, cpf, cnpj, inscricao, site, marca,
      celular, fone, email, senha,
      cep, logradouro, complemento, bairro, cidade, estado,
      departamentos // isso vem como array de ObjectId (name="departamentos[]")
    } = req.body;

    // ⚠️ Validação: checar se todos os departamentos existem
    const encontrados = await Departamento.find({ _id: { $in: departamentos } }).lean();
    if (encontrados.length !== departamentos.length) {
      return res.status(400).json({ erro: 'Um ou mais departamentos inválidos' });
    }

    const lojistaData = {
      razao, responsavel, cpf, cnpj, inscricao, site, marca,
      celular, fone, email, senha,
      endereco: { cep, logradouro, complemento, bairro, cidade, estado },
      departamentos
    };

    let resultado;
    if (_id) {
      resultado = await Lojista.findByIdAndUpdate(_id, lojistaData, { new: true });
    } else {
      resultado = await Lojista.create(lojistaData);
    }

    res.json({ sucesso: true, lojista: resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar lojista' });
  }
});


router.get("/departamento-selecao", (req, res) => {
   res.render("pages/central/departamento-selecao",{ layout: "central/admin"}); // caminho completo até o handlebars);});
});

router.post("/gravar", async (req, res) => {
  console.log('[ 181 ] /gravar lojista',req.body)
  try {
   // const {
   //   inputrazao,
   //   responsavel,
   //   cpf,
   //   cnpj,
   //   inscricao,
   //   site,
   //   marca,
   //   celular,
   //   fone,
   //   email,
   //   senha,
   //   cep,
   //  logradouro,
   //   complemento,
   //  bairro,
   //   cidade,
   //   estado,
   //   departamentos_nome // ← vem como array de IDs
   // } = req.body;

    const novoLojista = new Lojista({
      razao: req.body.inputrazao,
      nomeresponsavel: req.body.responsavel,
      cpfresponsavel: req.body.cpf,
      cnpj: req.body.cnpj,
      inscricao: req.body.inscricao,
      site: req.body.site,
      marca: req.body.marca,
      celular: req.body.celular,
      telefone: req.body.fone,
      email: req.body.email,
      senha: req.body.senha,
      cep: req.body.cep,
      logradouro: req.body.logradouro,
      complemento: req.body.complemento,
      bairro: req.body.bairro,
      cidade: req.body.cidade,
      estado: req.body.estado,
      assinante: "padrao",
      situacao: "ativo",
      template: "base",
      atividade: "não informada",
      departamentos:req.body.departamentos_ids,
      
    });
    // Defaults temporários (pode ajustar conforme seu fluxo depois) 
    console.log('Bola dentro!!!!!')

    await novoLojista.save();
    console.log('');
    console.log('[ 222 ] novoLojista.save');
    console.log('');
    res.redirect("/lojista/lojista"); // ajuste para onde redirecionar após salvar
  } catch (err) {
    console.error("❌ Erro ao salvar lojista:", err);
    res.status(500).send("Erro ao salvar lojista.");
  }
});

router.get('/consulta-cnpj/:cnpj', async (req, res) => {
  const cnpj = req.params.cnpj;

  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
    const data = await response.json();
    res.json(data); // devolve pro front-end
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar CNPJ' });
  }
});

module.exports = router;
