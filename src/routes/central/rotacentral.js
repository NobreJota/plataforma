// routes/central.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Departamento = require("../../models/departamento");
const DeptoSetor = require("../../models/deptosetores");
const deptosecoes = require("../../models/deptosecao");
const Mconstrucao = mongoose.model("m_construcao");
const Fornec = require("../../models/fornecedor");

router.get("/lista", async (req, res) => {
  const depto = await Departamento.find().lean();
  console.log('[ 10 ] ',depto)
  res.render("pages/central/listaSegmento", { layout: "central/segmento", depto });
});

// PERTENCE A CADASTRO DE PRODUTO
router.get("/selectlista", async (req, res) => {
  console.log('');
  console.log(' [ 20 - router.get("/selectlista]');
  console.log('');
  try {
    const departamentos = await Departamento.find().lean();
    console.log('24 ',departamentos)
    res.json(departamentos); // retorna [{ _id, titulo }]
  } catch (err) {
    console.error("Erro ao buscar segmentos:", err);
    res.status(500).json({ erro: "Erro ao buscar segmentos" });
  }
});

router.get("/por-segmento/:id", async (req, res) => {
  try {
    const segmentoId = req.params.id;
    const setores = await DeptoSetor.find({ segmento: segmentoId }).lean();
    
    res.json(setores); // [{ _id, titulo }]
  } catch (err) {
    console.error("Erro ao buscar setores:por Id ??", err);
    res.status(500).json({ erro: "Erro ao buscar setores" });
  }
});

router.get("/secoes_/:setorId", async (req, res) => {
  try {
    console.log('300000',req.params);
    const setorId = mongoose.Types.ObjectId(req.params.setorId);
    const secoes = await Secao.find({ setor: setorId }).lean();
    //const secoes = await Secao.find({ setor: req.params.setorId }).lean();
    res.json(secoes); // [{ _id, titulo }]
  } catch (err) {
    console.error("Erro ao buscar seções:", err);
    res.status(500).json({ erro: "Erro ao buscar seções" });
  }
});
//////////////////////  FIM DO CADASTRO DE PRODUTO
router.get("/setores/:departamentoId", async (req, res) => {
  console.log('');
  console.log(' [ 58 ] req.params :',req.params);
  console.log('');

  const { departamentoId } = req.params;
  const setores = await DeptoSetor.find({ idDepto: departamentoId }).lean();
  console.log(' [ 64 ] rotacentral ==> router.get("/setores"',setores)
  res.send(setores);
});

router.post("/segmento/salvar", async (req, res) => {
  console.log('');
  console.log(' [ 69 ]',req.body);
  console.log('');
  let n1=req.body.nomeDepartamento
  console.log(n1)
  await Departamento.create({ nomeDepartamento: n1 });
  console.log("------------------------------");
  console.log("------------------------------");
  res.redirect("/lista");
});

router.post("/setor/salvar", async (req, res) => {
  console.log(" [ 80 ] JSON recebido:", req.body);
  console.log('');
  const { nomeDeptoSetor, departamentoId } = req.body;

  if (!nomeDeptoSetor || !departamentoId) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  try{
     const novoDeptoSetor = await DeptoSetor.create({
                                                   nomeDeptoSetor,
                                                   idDepto:departamentoId
                                                   });
      console.log('--------');
      console.log('novo setor ',novoDeptoSetor)
      console.log('--------');
      //res.json(novoDeptoSetor);
       res.status(201).json(novoDeptoSetor);
   } catch (err) {
    console.error("Erro ao salvar setor:", err);
    res.status(500).json({ error: "Erro interno ao salvar setor" });
  }    
});

router.post("/secao/salvar", async (req, res) => {
  const { nomeSecao, departamentoId, deptosetorId } = req.body;
  console.log("");
  console.log(" [ 107 ] ",req.body);
  console.log("");
  if (!nomeSecao || !departamentoId || !deptosetorId) {
    return res.status(400).json({ error: "Campos obrigatórios não preenchidos" });
  }

  try {
    const novaSecao = await deptosecoes.create({
      nomeSecao,
      idDepto: departamentoId,
      idDeptoSetor: deptosetorId
    });

    res.status(201).json(novaSecao);
  } catch (err) {
    console.error("Erro ao salvar seção:", err);
    res.status(500).json({ error: "Erro ao salvar" });
  }

});

router.get("/secoes/:deptoSetorId", async (req, res) => {
  console.log('');
  console.log(' [ 128 ] ',req.params)
  console.log('');

  try {
    const { deptoSetorId } = req.params;
    console.log('');
    console.log('[ 136 /rotacentral/secoes/:deptoSetorId',deptoSetorId);
    console.log('');
    const secoes = await deptosecoes.find({ idDeptoSetor: deptoSetorId }).lean();
    console.log(' [ 139 ] ',secoes)
    res.send(secoes);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

/////////////////////////////////////////////////////////////////////////////
// Rota de busca de produtos (retorna JSON)
router.get('/produtos/search', async (req, res) => {
  const termo = req.query.q || "";
  const regex = new RegExp(termo, 'i');
  try {
    // Busca por código ou nome (ajuste os campos conforme seu schema)
    const produtos = await Product.find({
      $or: [{ codigo: regex }, { nome: regex }]
    }).limit(10).lean();  // limitando a 10 resultados por exemplo
    res.json(produtos);
  } catch(err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/produtos/:id', async (req, res) => {
  try {
    const { nome, fornecedor, similarProducts } = req.body;
    // Garante que similarProducts seja um array (mesmo que venha um único id)
    let similares = [];
    if (similarProducts) {
      similares = Array.isArray(similarProducts) ? similarProducts : [ similarProducts ];
    }
    // Atualiza o produto com os novos dados
    await Product.findByIdAndUpdate(req.params.id, {
      nome,
      fornecedor,
      similares  // atribui array de ObjectIds
    });
    res.redirect(`/produtos/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao salvar produto.");
  }
});

router.get('/produtos/:id', async (req, res) => {
  const produto = await Product.findById(req.params.id)
    .populate('fornecedor')
    .populate('similares');  // preenche o array de similares com documentos de Produto
  res.render('produto-detalhe', { produto });
});



////////////// SIMILARES ADICIONANDO


module.exports = router;
