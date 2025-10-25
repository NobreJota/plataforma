const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Mconstrucao = mongoose.model("m_construcao");
const Departamento = require("../../models/departamento");
const DeptoSetor = require('../../models/deptosetores');
const Lojista = require('../../models/lojista');

//  busca os produto conforme a cidade
router.get("/produtos-por-cidade/:cidade", async (req, res) => {
  try {
    const { cidade } = req.params;

    const produtos = await Mconstrucao
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
  const produtos = await Mconstrucao.find(
                          {descricao: { $regex: '\\d' }, loja_id: id })
                                    .lean();
  res.json(produtos);
});

router.post('/gravarproduto',async(req,res)=>{
  try {
      const doc = await Mconstrucao.create(req.body); // ou payload montado
      // Pega o departamento (array ou singular)
      const depId = Array.isArray(doc.localloja?.[0]?.departamento)
        ? doc.localloja[0].departamento[0] || null
        : (doc.localloja?.departamento || null);

      let depNome = null;
      if (depId) {
        const dep = await Departamento.findById(depId).select("nomeDepartamento");
        depNome = dep?.nomeDepartamento || null;
      }

      return res.status(201).json({
        ok: true,
        produtoId: doc._id,
        departamentoId: depId,
        departamentoNome: depNome
      });
  } catch (err) {
      if (err.name === 'ValidationError' && err.errors?.descricao) {
          return res.status(400).render('pages/empresa/produto-form', {
            erroDescricao: err.errors.descricao.message,
            produto: req.body
          });
      }
      throw err;
  }
})

router.get("/segmento/:id/setores", async (req, res) => {
  const segmento = await Segmento.findById(req.params.id).populate({
    path: 'setores',
    populate: { path: 'secoes' }
  });

  res.json(segmento);
});

router.get("/segmento/:id/setores", async (req, res) => {
  const segmento = await Segmento.findById(req.params.id).populate({
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

    await Mconstrucao.findByIdAndUpdate(id, update,{
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
   const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
  }
  console.log('');
  console.log('[ 122 ]');
  console.log('route=>src/routes/empresa/produtos');
  console.log('get => /lojistadepartamento');
  console.log('');
  console.log(' id do lojista : ',id);
  console.log('');
    
  try {
    const lojista = await Lojista.findById(id).populate('departamentos', 'nomeDepartamento');
    console.log('666',lojista.departamentos)
    let departamentos=lojista.departamentos
    res.json(departamentos);
  } catch (err) {
    console.error('Erro ao buscar departamentos:', err);
    res.status(500).json({ error: 'Erro ao buscar departamentos' });
  }
});

router.get('/setores/:departamentoId', async (req, res) => {
  try {
    const { departamentoId } = req.params;

    const registros = await DeptoSetor.find({ departamento: departamentoId })
      .populate('setor', 'titulo') // traz apenas o título
      .lean();

    const setores = registros.map(r => r.setor); // array com os setores populados
    res.json(setores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar setores.' });
  }
});

module.exports = router;
