const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ArquivoDoc = mongoose.model("arquivo_doc");
///////////////////////////////////////////////////////////////////
// FAZ A BUSCA DE PRODUTOS COM TERMOS SIMILARES
router.get("/buscar", async (req, res) => {
  console.log('');
  console.log('[ 9 - similares => GET /buscar ]');
  console.log('');

  const { termo, baseId } = req.query;

  if (!termo || !baseId) {
    return res.status(400).json({ erro: "Parâmetros obrigatórios não informados." });
  }

  try {
    // Carrega o produto base
    const produtoBase = await ArquivoDoc.findById(baseId).lean();

    if (!produtoBase) {
      return res.status(404).json({ erro: "Produto base não encontrado." });
    }

    // Obtém lista de similares já vinculados (para evitar duplicação)
    const idsSimilares = (produtoBase.similares || []).map(id => id.toString());

    // Busca produtos que não são o base e nem já similares
    const produtos = await ArquivoDoc.find({
      _id: { $ne: baseId, $nin: idsSimilares },
      $or: [
        { codigo: new RegExp(termo, "i") },
        { descricao: new RegExp(termo, "i") },
        { referencia: new RegExp(termo, "i") },
        { complete: new RegExp(termo, "i") }
      ]
    })
      .limit(10)
      .select("codigo descricao precovista") // seleciona apenas campos úteis
      .lean();

    res.json(produtos);

  } catch (err) {
    console.error("Erro na busca:", err);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

router.get("/produtos/detalhes/:id", async (req, res) => {
  console.log('');
  console.log(" [ 53 \routes\empresa\similares.js ]")
  console.log('');
  try {
    //const fornecedor = await Fornec.findById("687bb4f0505327b30d3c81b5").lean();
    console.log('');
    console.log('req.params.id',req.params.id)
    console.log('');
    const produto = await ArquivoDoc.findById(req.params.id)
      .populate({ 
                  path: "fornecedor", select: "razao marca", model: "fornec" })
      .populate({path:"similares", select:"codigo descricao referencia precovista"}) 
      .lean();
      console.log('');
      console.log('[ 66 - similares.js ] ',produto)
      console.log('');
    res.json(produto);
  } catch (err) {
    console.error("Erro ao buscar produto:", err);
    res.status(500).json({ erro: "Erro ao buscar produto" });
  }
});

// UPDATE PARA VINCULAR PRODUTO 
router.post("/vincular", async (req, res) => {
    console.log('[ 53 -simiproduto vincular ]',req.body)
  const { produtoBaseId, similarId } = req.body;
  try {
    // Evita duplicados
    const produto = await ArquivoDoc.findById(produtoBaseId);

    if (!produto) {
      return res.status(404).json({ erro: "Produto base não encontrado" });
    }

    // Verifica se já está incluso
    if (produto.similares.includes(similarId)) {
      return res.status(400).json({ erro: "Produto já é similar" });
    }

    produto.similares.push(similarId);
    await produto.save();

    res.json({ mensagem: "Similar vinculado com sucesso" });
  } catch (e) {
    console.error("Erro ao vincular similar:", e);
    res.status(500).json({ erro: "Erro ao vincular similar" });
  }
  ///////////////////////////////////////////////////////////////
  
 //       try {
 //         const { produtoBaseId, similarId } = req.body;
//
//          if (!produtoBaseId || !similarId) {
//            return res.status(400).json({ error: "IDs inválidos" });
//          }

//          await MconstXrucao.updateOne(
//            { _id: produtoBaseId },
//            { $addToSet: { similares: similarId } }
//          );

//          await MconstruXcao.updateOne(
//            { _id: similarId },
//            { $addToSet: { similares: produtoBaseId } }
//          );

//          res.json({ success: true, message: "Vinculado com sucesso!" });

//        } catch (err) {
//          console.error("Erro ao vincular similar:", err);
//          res.status(500).json({ error: "Erro ao vincular similar" });
//        }
  

});

router.post("/corrigir-legado", async (req, res) => {
  console.log('');
  console.log('[ 106 /similares/corrigir-legado');
  console.log('');
  try {
    const resultado = await ArquivoDoc.updateMany(
      { similares: { $type: "objectId" } },
      [{ $set: { similares: ["$similares"] } }]
    );

    res.json({
      success: true,
      modifiedCount: resultado.modifiedCount,
      message: "Correção concluída. Campos similares agora são arrays.",
    });

  } catch (err) {
    console.error("Erro ao corrigir dados legados:", err);
    res.status(500).json({ error: "Erro ao corrigir dados legados" });
  }
});

// PUT /produtos/:produtoId/removersimilar/:similarId
router.put('/produtos/:produtoId/removersimilar/:similarId', async (req, res) => {
  console.log('[ 154 => router/empresa/similares(simiproduto) =>/produtos/:produtoId/removersimilar/:similarId]')
  const { produtoId, similarId } = req.params;
  try {
    await ArquivoDoc.findByIdAndUpdate(produtoId, {
      $pull: { similares: similarId }
    });
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro ao remover similar:", err);
    res.sendStatus(500);
  }
});

module.exports = router;

// router.get("/buscar", async (req, res) => {
//   console.log('');  
//   console.log(' [ 9 - similares=> get/buscar');
//   console.log('');
//   const { termo, baseId } = req.query;

//   try {
//     const produtos = await MconstrXucao.find({
//       _id: { $ne: baseId },
//       $or: [
//         { codigo: new RegExp(termo, "i") },
//         { descricao: new RegExp(termo, "i") }
//       ]
//     }).limit(10).lean();

//     res.json(produtos);
//   } catch (err) {
//     console.error("Erro na busca:", err);
//     res.status(500).json([]);
//   }
// });

