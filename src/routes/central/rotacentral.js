// routes/central.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Departamento = require("../../models/departamento");
const DeptoSetor = require("../../models/deptosetores");
const DeptoSecoes = require("../../models/deptosecao");
//const Ddocumento = mongoose.model("d_documento");
const Fornec = require("../../models/fornecedor");

router.get("/lista", async (req, res) => {
  const depto = await Departamento
                       .find()
                       .collation({ locale: 'pt', strength: 1 }) // ordena A=a=á
                       .sort({ nomeDepartamento: 1 }) 
                       .lean();
  console.log('[ 10 ] ',depto)
  res.render("pages/central/listaSegmento", { layout: "central/segmento", depto });
});

// PERTENCE A CADASTRO DE PRODUTO
router.get("/selectlista", async (req, res) => {
  console.log('');
  console.log(' [ 20 - router.get("/selectlista]');
  console.log(' [ cadastro de produto - router.get("/selectlista]');
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

router.get("/secoes/:setorId", async (req, res) => {
   console.log('2345');
    try {
    const idSetor = req.params.setorId;
    console.log('');
    console.log('idSetor_Seção ==> ',idSetor);
    console.log('');
    const rows = await DeptoSecoes
      .find({ idSetor }, 'nameSecao')        // só o campo que você precisa
      .sort({ nameSecao: 1 })
      .lean();
    console.log('valor de rows',rows)
    const n=rows.map(r => r.nameSecao)
    console.log('VR DE N',n)
    return res.status(200).json({itens:n}); // array simples de strings

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar seções' });
  }
});
//////////////////////  FIM DO CADASTRO DE PRODUTO
router.get("/setores/:departamentoId", async (req, res) => {
  console.log('');
  console.log(' [ 58 ] req.params :',req.params);
  console.log('');

  const { departamentoId } = req.params;
  const setores = await DeptoSetor.find({ idDepto: departamentoId }).sort({ nomeDeptoSetor: 1 }).lean();
  console.log(' [ 78 ] rotacentral ==> router.get("/setores"',setores)
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
  res.redirect("/segmento/lista");
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

// POST /segmento/secao/salvar
router.post('/secao/salvar', async (req, res) => {
  try {
    // const { nomeSecao, departamentoId, deptosetorId, imagemUrl } = req.body;

    // if (!nomeSecao || !departamentoId || !deptosetorId) {
    //   return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    // }

    // // IDs
    // const depId   = new mongoose.Types.ObjectId(departamentoId);
    // const setorId = new mongoose.Types.ObjectId(deptosetorId);

    // // imagemUrl pode vir como [] (ex.: form) — normaliza para string
    // const img = Array.isArray(imagemUrl)
    //   ? (imagemUrl[0] || '')
    //   : String(imagemUrl || '').trim();

    // // cria 1 documento por seção
    // const doc = await deptosecoes.create({
    //   nameSecao: String(nomeSecao).trim(),
    //   imagemUrl: img,          // String (pode ser '')
    //   idDepto: depId,
    //   idSetor: setorId,
    // });

    // return res.status(201).json({ ok: true, id: doc._id });
     const { nomeSecao, departamentoId, deptosetorId, imagemUrl } = req.body;

    if (!nomeSecao || !departamentoId || !deptosetorId) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
    }

    const depId   = new mongoose.Types.ObjectId(departamentoId);
    const setorId = new mongoose.Types.ObjectId(deptosetorId);

    const img = Array.isArray(imagemUrl)
      ? (imagemUrl[0] || '')
      : String(imagemUrl || '').trim();

    // (opcional) evitar duplicado: mesma seção no mesmo setor
    const exists = await DeptoSecoes.findOne({ idSetor: setorId, nameSecao: String(nomeSecao).trim() }).lean();
    if (exists) {
      return res.status(409).json({ error: 'Já existe uma seção com esse nome nesse setor.' });
    }

    const doc = await DeptoSecoes.create({
      nameSecao: String(nomeSecao).trim(),
      imagemUrl: img,
      idDepto: depId,
      idSetor: setorId,
    });

    // 👇 marca e incrementa no setor
    await DeptoSetor.updateOne(
      { _id: setorId },
      { $set: { hasSecoes: true }, $inc: { secoesCount: 1 } }
    );

    return res.status(201).json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('Erro ao salvar seção:', err);
    return res.status(400).json({
      error: 'Falha ao salvar seção',
      details: err?.message,
    });
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
    const secoes = await DeptoSecoes.find({ idDeptoSetor: deptoSetorId }).lean();
    console.log(' [ 139 ] ',secoes)
    res.send(secoes);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

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
// [GET] Painel de ativação
router.get('/ativardepto', async (req, res) => {
  console.log('');
   console.log('9000');
   console.log('');
    try {
    const departamentos = await Departamento
    .find({}, 'nomeDepartamento ativado imagemUrl')
    .sort({ nomeDepartamento: 1 })
    .lean();


    return res.render('pages/central/painel-depto_ativar.handlebars', {
        layout: 'central/segmento',
        title: 'Ativar/Desativar Departamentos',
        departamentos
    });
    } catch (err) {
      console.error('[GET painel.depto_ativar]', err);
    return res.status(500).send('Erro ao carregar lista');
    }
});

// [POST] Ativar
router.post('/departamentos/:id/ativar', async (req, res) => {
    try {
      await Departamento.updateOne({ _id: req.params.id }, { $set: { ativado: 1 } });
      return res.redirect('back');
    } catch (err) {
      console.error('[POST ativar departamento]', err);
    return res.status(500).send('Falha ao ativar');
    }
});

// [POST] Desativar
router.post('/departamentos/:id/desativar', async (req, res) => {
      try {
      await Departamento.updateOne({ _id: req.params.id }, { $set: { ativado: 0 } });
      return res.redirect('back');
      } catch (err) {
      console.error('[POST desativar departamento]', err);
      return res.status(500).send('Falha ao desativar');
      }
});

router.post('/depto-foto', async (req, res) => {
  try {
    const { id, imagemUrl } = req.body;

    await Departamento.updateOne(
      { _id: id },
      { $set: { imagemUrl: (imagemUrl || '').trim() } }
    );

    return res.redirect('/segmento/ativardepto');
  } catch (err) {
    console.error('[POST /segmento/depto-foto]', err);
    return res.status(500).send('Erro ao salvar foto do departamento');
  }
});

module.exports = router;
