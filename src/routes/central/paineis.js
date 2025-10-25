// src/routes/central/paineis.js
const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const Departamento  = require('../../models/departamento');
const DeptoSetores  = require('../../models/deptosetores'); // ajuste o caminho/nome se diferir

/////////////////////////////////////////////////////////////
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = String(Date.now());
    cb(null, base + ext);
  }
});
const upload = multer({ storage });

// LISTA do painel de Atividades (Departamentos + Setores + Imagens)
router.get('/painel', async (req, res) => {
  console.log('1000');
  try {
    // 1) Departamentos alfabeticamente (PT-BR)
    const departamentos = await Departamento.find()
      .collation({ locale: 'pt', strength: 1 })
      .sort({ nomeDepartamento: 1 })
      .lean();

    // 2) Busca todos os setores ligados a esses departamentos
    const depIds = departamentos.map(d => d._id);
    // const setores = await DeptoSetores.find({ idDepto: { $in: depIds } })
    //   .collation({ locale: 'pt', strength: 1 })
    //   .sort({ nomeDeptoSetor: 1 })
    //   .lean();

    // // 3) Agrupa setores por idDepto
    // const setoresByDep = setores.reduce((acc, s) => {
    //   const k = String(s.idDepto);
    //   (acc[k] ||= []).push(s.nomeDeptoSetor);
    //   return acc;
    // }, {});
    const setores = await DeptoSetores.find(
  { idDepto: { $in: depIds } },
  { _id: 1, idDepto: 1, nomeDeptoSetor: 1, imagemUrl: 1 }   // ← garante campos
)
  .collation({ locale: 'pt', strength: 1 })
  .sort({ nomeDeptoSetor: 1 })
  .lean();

const setoresByDep = setores.reduce((acc, s) => {
  const k = String(s.idDepto);
  (acc[k] ||= []).push({
    _id: s._id,
    nome: s.nomeDeptoSetor,
    imagemUrl: s.imagemUrl || null
  });
  return acc;
}, {});

    // 4) Monta a lista final para a view
    const lista = departamentos.map(d => ({
      _id: d._id,
      nome: d.nomeDepartamento,
      imagemUrl: d.imagemUrl || null,       // se tiver esse campo
      setores: setoresByDep[String(d._id)] || []
    }));

    return res.render('pages/central/painel-setor', {
      layout: 'central/segmento',
      lista
    });
  } catch (err) {
    console.error('Erro ao carregar painel de atividades:', err);
    return res.status(500).send('Erro ao carregar painel de atividades');
  }

});

// router.get('/setor/:id/imagem', async (req, res) => {
//   const id = req.params.id;
//   const setor = await DeptoSetores.findById(id).lean();
//   if (!setor) return res.status(404).send('Setor não encontrado');
//   res.render('pages/central/setor-imagem', {
//     layout: 'central/segmento',
//     setor
//   });
// });

// router.post('/setor/:id/imagem', async (req, res) => {
//   const id = req.params.id;
//   const { imagemUrl } = req.body;
//   await DeptoSetores.updateOne({ _id: id }, { $set: { imagemUrl: (imagemUrl||'').trim() || null } });
//   res.redirect('/paineis/painel');
// });

// Upload local
router.post('/upload/image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'arquivo não enviado' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// PATCH imagem do SETOR
router.patch('/setor/:id/imagem', async (req, res) => {
  const { id } = req.params;
  const { imagemUrl } = req.body;
  await DeptoSetores.updateOne({ _id: id }, { $set: { imagemUrl: imagemUrl || null } });
  res.json({ ok: true });
});

// PATCH imagem da SEÇÃO (por índice)
router.patch('/secao/:docId/item/:idx/imagem', async (req, res) => {
  const { docId, idx } = req.params;
  const { imagemUrl } = req.body;
  await DeptoSecoes.updateOne(
    { _id: docId },
    { $set: { [`secao.${Number(idx)}.imagemUrl`]: (imagemUrl || null) } }
  );
  res.json({ ok: true });
});

module.exports = router;
