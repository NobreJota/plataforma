const express = require('express');
const router = express.Router();
const Departamento = require('../../models/departamento'); // ajuste o caminho
const Lojista = require('../../models/lojista'); // se quiser mostrar a marca

router.get('/cadastro', async (req, res) => {
  try {
    const departamentos = await Departamento
      .find({}, { nomeDepartamento: 1 })
      .sort({ nomeDepartamento: 1 })
      .lean();

    // opcional: receber lojista/marca via query
    const lojistaId = req.query.lojista || '';
    const lojista = lojistaId
      ? await Lojista.findById(lojistaId, { marca: 1 }).lean()
      : null;

    return res.render('pages/empresa/produto_cadastro.handlebars', {
      layout: '',
      departamentos,
      lojista
    });
  } catch (e) {
    console.error('erro ao abrir cadastro:', e);
    return res.status(500).send('Erro ao abrir cadastro de produto');
  }
});

router.post('/gravarproduto',async(req,res)=>{
  try {
      const doc = await Ddocumento.create(req.body); // ou payload montado
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
module.exports = router;