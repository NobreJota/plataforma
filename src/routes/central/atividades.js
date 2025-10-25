const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

//const Atividade = require('../../models/atividades');
const Departamento = require('../../models/departamento'); // o mesmo que você já usa
const BcoImagem = require('../../models/bco_imagem');

// LISTA (com departamentos para selects)
router.get('/', async (req, res) => {
  try {
    const atividades = await Atividade.find({ ativo: { $ne: 9 } })
      .populate({ path: 'departamento', select: 'nomeDepartamento' })
      .sort({ createdAt: -1 })
      .lean();

      console.log(' [ 16 ] ');
      console.log('atividades');
      console.log('');
    const departamentos = await Departamento.find({})
      .select('nomeDepartamento')
      .sort({ nomeDepartamento: 1 })
      .lean();

    res.render('pages/central/atividades', {
      layout: 'central/lojista', // ajuste se seu layout for outro
      atividades,
      departamentos
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao carregar atividades');
  }
});

// CADASTRAR
router.post('/', async (req, res) => {
  console.log(' [ 34 ]',req.body)
  try {
    const { nome, departamento } = req.body;
    const doc = await Atividade.create({ nome, departamento });
    res.json({ ok: true, _id: doc._id });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, msg: 'Falha ao salvar' });
  }
});

// EDITAR
router.put('/:id', async (req, res) => {
  try {
    const { nome, departamento } = req.body;
    await Atividade.findByIdAndUpdate(req.params.id, { nome, departamento });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, msg: 'Falha ao editar' });
  }
});

// ATUALIZAR IMAGEM (só grava a URL final)
router.put('/:id/imagem', async (req, res) => {
  try{
    const { imagemUrl, mimeType = '', size = 0 } = req.body || {};
    if (!imagemUrl) return res.json({ ok:false, msg:'imagemUrl obrigatório' });

    // 1) Atualiza a Atividade
    await Atividade.findByIdAndUpdate(req.params.id, { imagemUrl });

    // 2) Busca a atividade para obter o departamento
    const atv = await Atividade.findById(req.params.id).select('departamento').lean();

    // 3) Calcula key simples a partir da URL (opcional)
    const key = imagemUrl.split('/').pop();

    // 4) Upsert no banco de imagens (não duplica se a URL já existe)
    await BcoImagem.updateOne(
      { imagemUrl },  // critério único
      {
        $setOnInsert: {
          key,
          mimeType,
          size,
          origem: 'atividade',
          atividadeId: req.params.id,
          departamento: atv?.departamento || null,
        }
      },
      { upsert: true }
    );

    return res.json({ ok:true });
  }catch(e){
    console.error('PUT /atividades/:id/imagem', e);
    return res.json({ ok:false });
  }

});

// SUSPENDER (soft delete)
router.patch('/:id/suspender', async (req, res) => {
  try {
    await Atividade.findByIdAndUpdate(req.params.id, { ativo: 9, datadel: new Date() });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, msg: 'Falha ao suspender' });
  }
});

router.get('/atividades', async(req, res) => {
  try {
    const [atividades, departamentos] = await Promise.all([
      Atividade.find({ ativo: true })
        .populate('departamento', 'nomeDepartamento')
        .sort({ createdAt: -1 })
        .lean(),
      Departamento.find({}, 'nomeDepartamento')
        .sort({ nomeDepartamento: 1 })
        .lean()
    ]);
     console.log(' [ 94 ]');
     console.log(' ',atividades);
     console.log('');

    res.render('pages/central/atividades.handlebars', {
      layout: 'central/admin.handlebars',
      atividades,
      departamentos
    });
  } catch (err) {
    console.error('GET /atividades erro:', err);
    res.status(500).send('Erro ao carregar atividades');
  }
  /////////////////////////////////////////////////////////////////
});

// LISTAR imagens do banco
router.get('/bco-imagens', async (req, res) => {
  console.log('');
  console.log('[ 140 ] bco_imagem');
  console.log('');

  try {
   // const BcoImagem = require('./src/models/bco_imagem'); // ajuste o caminho se preciso

    const { departamento, q, limit = 200 } = req.query;
    const f = {};
    if (departamento) f.departamento = departamento;
    if (q) f.imagemUrl = { $regex: q, $options: 'i' };

    const items = await BcoImagem
      .find(f, { imagemUrl: 1 })  // só o que a UI precisa
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    return res.json({ ok: true, items });
  } catch (e) {
    console.error('GET /bco-imagens', e);
    return res.json({ ok: false, items: [] });
  }
});



module.exports = router;
