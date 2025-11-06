const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const ArquivoDoc = mongoose.model("arquivo_doc");
const Departamento = require("../../models/departamento");
const DeptoSetor = require('../../models/deptosetores');
const DeptoSecoes= require('../../models/deptosecao')
const Lojista = require('../../models/lojista');
//const segmentoSetor= require('../../models/deptosetores')

//  busca os produto conforme a cidade
router.get("/produtos-por-cidade/:cidade", async (req, res) => {
  try {
    const { cidade } = req.params;

    const produtos = await ArquivoDoc
      .find()
      .populate({ path: 'loja_id', match: { cidade } })
      .lean();

    const produtosFiltrados = produtos.filter(p => p.loja_id !== null);

    res.json(produtosFiltrados);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao buscar produtos por cidade." });
  }
});

// Procura produtos pelo loja_Id
router.get("/produtos-por-lojista/:id", async (req, res) => {
  const { id } = req.params;
  const produtos = await ArquivoDoc.find(
                          {descricao: { $regex: '\\d' }, loja_id: id })
                                    .lean();
  res.json(produtos);
});

router.get("/segmento/:id/setores", async (req, res) => {
  console.log('mil');
  const segmento = await DeptoSetor.findById(req.params.id).populate({
    path: 'setores',
    populate: { path: 'secoes' }
  });

  res.json(segmento);
});

router.put("/alterar/:id", async (req, res) => {
  console.log('');
  console.log(' [ 80 public/js/empresa/produtos.js   put/alterar ]');
  console.log(req.params);

  const { id } = req.params;
  const {
    codigo,
    descricao,
    complete,
    referencia,
    fornecedor,
    qte,
    precocusto,
    precovista,
    precoprazo
  } = req.body;

  try {
    const update = {
      codigo,
      descricao,
      complete,
      referencia,
      fornecedor,
      qte,
      precocusto: mongoose.Types.Decimal128.fromString(precocusto),
      precovista: mongoose.Types.Decimal128.fromString(precovista),
      precoprazo: mongoose.Types.Decimal128.fromString(precoprazo),
    };

    console.log(' [ 94 ] ', update);

    await ArquivoDoc.findByIdAndUpdate(id, update,{
       runValidators: true,
       context: 'query'
    });

    res.status(200).json({ mensagem: "Produto atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ erro: "Erro ao atualizar produto" });
  }
});

router.get('/lojistadepartamentos/:id', async (req, res) => {
  console.log('');
  console.log('Alô!',req.params)
  console.log('');
   const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
  }
  console.log('');
 // console.log('[ 138 ] route=>src/routes/empresa/produtos/lojistadepartamento/:id');
  console.log('');
  console.log('');
 // console.log(' id do lojista : ',id);
  ///console.log('');
    
  try {
    const lojista = await Lojista.findById(id).populate('departamentos', 'nomeDepartamento');
    //console.log('resultado da pesquisa =>',lojista.departamentos)
    let departamentos=lojista.departamentos
    
    res.json(departamentos);
  } catch (err) {
    console.error('Erro ao buscar departamentos:', err);
    res.status(500).json({ error: 'Erro ao buscar departamentos' });
  }
});

router.get('/setores/:departamentoId', async (req, res) => {
  ////////////////////////////////////////
  try {
      const departamentoId = req.params.departamentoId;

      const registros = await DeptoSetor.find({
        idDepto: departamentoId,
        hasSecoes: true,            // 👈 só setores com seções
      })
      .select('nomeDeptoSetor idDepto imagemUrl') // campos que você precisa
      .lean();

      const setores = registros.map(r => ({
        idSetor: String(r._id),
        nomeDeptoSetor: r.nomeDeptoSetor || '',
        idDepto: String(r.idDepto),
        imagemUrl: r.imagemUrl || ''
      }));

      res.json(setores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar setores.' });
  }
});

router.get("/secoes/:setorId", async (req, res) => {
    console.log(5000)
    try {
    const idSetor = req.params.setorId;
    console.log('');
    console.log('B ==> ',idSetor);
    console.log('');
    const rows = await DeptoSecoes
      .find({ idSetor }, 'nameSecao')        // só o campo que você precisa
      .sort({ nameSecao: 1 })
      .lean();
    console.log('valor de rows',rows)
    // const n=rows.map(r => r.nameSecao)
    // console.log('VR DE N',n)
    return res.status(200).json({itens:rows}); // array simples de strings

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao carregar seções' });
  }
});
module.exports = router;
