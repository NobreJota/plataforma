const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Produto = mongoose.model("arquivo_doc")


router.get('/produto/:id/editar-imagens', async (req, res) => {
  const { id } = req.params;

  // Carrega do banco (recomendado)
  const produto = await Produto.findById(id)
  .populate({ path: 'fornecedor', select: 'marca' })
  .populate({ path: 'localloja.departamento',
              model: 'departamentos', select: 'nomeDepartamento' })
  .populate({ path: 'localloja.setor.idSetor',
              model: 'deptosetores', select: 'nomeSetor nameSetor' })
  .populate({ path: 'localloja.setor.secao.idSecao',
              model: 'deptosecoes', select: 'nomeSecao nameSecao' })
  .lean();
  
  const loc = produto?.localloja?.[0] || {};
  const setoresArr = Array.isArray(loc.setor) ? loc.setor : [];

  const departamentoNome = (Array.isArray(loc.departamento) ? loc.departamento : [])
  .map(d => d?.nomeDepartamento).filter(Boolean).join(', ');

    let setorNomes = setoresArr
      .map(s => (s?.idSetor && typeof s.idSetor === 'object' && 'nomeDeptoSetor' in s.idSetor)
        ? s.idSetor.nomeDeptoSetor
        : null)
      .filter(Boolean);


    /////////////////////////////////////////////////////////////////////////////////////////////
    const urlsOrig = Array.isArray(produto?.pageurls)
      ? produto.pageurls
      : Array.isArray(produto?.imagens)
        ? produto.imagens
        : [];

    // normaliza para array de strings (pode ser [{url:"..."}, ...] ou ["..."])
    const urls = urlsOrig.map(u => (typeof u === 'string' ? u : u?.url)).filter(Boolean);

// cria 7 posições fixas
const slots = Array.from({ length: 7 }, (_, i) => ({
  n: i + 1,
  url: urls[i] || ''   // se não houver, fica vazio
}));

console.log('20000 ======> ',slots)
console.log('2000',produto)
/////////////////////////////////////////////////////////////////////////////////////////////
const fornecedorNome = produto?.fornecedor?.marca || '';  // garanta isso antes

const mi = {
  id:           id,
  descricao:    produto?.descricao || '',
  fornecedor:   fornecedorNome,
  departamento: departamentoNome || setorNomes // use o que você preferir
};
////////////////////////////////////////////////////////////////////////////////////////////
if (setorNomes.length === 0 && setoresArr.length) {
  const DeptoSetores = require('../../models/deptosetores'); // ajuste o caminho

  // pegue o id mesmo que "idSetor" venha populado ou não
  const setorIds = setoresArr
    .map(s => (s?.idSetor?._id || s?.idSetor)) // pega _id se for doc populado, senão o ObjectId
    .filter(Boolean)
    .map(id => id.toString());                  // NORMALIZA

  const setoresDocs = await DeptoSetores
    .find({ _id: { $in: setorIds } })
    .select('_id nomeDeptoSetor')
    .lean();

  const byId = new Map(
    setoresDocs.map(d => [d._id.toString(), d]) // NORMALIZA
  );

  setorNomes = setoresArr
    .map(s => (s?.idSetor?._id || s?.idSetor))  // pega id (doc ou ObjectId)
    .map(id => byId.get(id.toString()))         // casa por string
    .map(d => d?.nomeDeptoSetor)                // usa o campo CERTO
    .filter(Boolean);
}

const secaoNomes = (Array.isArray(loc.setor) ? loc.setor : [])
  .flatMap(s => (s?.secao || [])
    .map(sc => sc?.idSecao?.nomeSecao || sc?.idSecao?.nameSecao))
  .filter(Boolean).join(', ');
  let [nsetor]=setorNomes
//   console.log('100 =>', setorNomes.join(', '));
  console.log('100 => ',nsetor);
  console.log('1000 => ',secaoNomes);
  console.log('');
  console.log( produto);
  console.log('');

  res.render('pages/empresa/produtoedit_image.handlebars', {
        layout: false,
        produtoId: id,
        produto,
        fornecedor: produto?.fornecedor?.marca || '',
        departamentoNome,
        nsetor,
        secaoNomes,
        slots,  
        mi,
        });
});

module.exports = router;