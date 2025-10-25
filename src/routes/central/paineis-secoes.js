// src/routes/central/paineis-secoes.js
const express       = require('express');
const router        = express.Router();
const Departamento  = require('../../models/departamento');
const DeptoSetores  = require('../../models/deptosetores');
const DeptoSecoes   = require('../../models/deptosecao');

/////////////////////////////////////////////////////////////
const path = require('path');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.resolve('public/uploads')), // ou 'uploads' se usa o middleware acima
  filename:    (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// POST /paineis/upload/image  -> { url: '/uploads/xxxxx.png' }
router.post('/upload/image', upload.single('image'), (req, res) => {
  console.log('');
  console.log('ABC-300');
  console.log('');
  if (!req.file) return res.status(400).json({ error: 'arquivo não enviado' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// PATCH /paineis/secao/:docId/item/:idx/imagem
router.patch('/secao/:docId/item/:idx/imagem', async (req, res) => {
  console.log('1200',req.params)
  console.log('');
  console.log('1200',req.body)
  try{
  const { docId } = req.params;                 // id do doc em deptosecoes
    const { imagemUrl } = req.body;               // '/uploads/....png'

    if (!imagemUrl) return res.status(400).json({ ok:false, msg:'imagemUrl vazio' });

    const { Types } = require('mongoose');
    const r = await DeptoSecoes.updateOne(
      { _id: new Types.ObjectId(docId) },
      { $set: { imagemUrl: imagemUrl || '' } }
    );

    if (r.matchedCount === 0) {
      return res.status(404).json({ ok:false, msg:'Seção não encontrada' });
    }

    return res.status(200).json({ ok:true });
  } catch (err) {
    console.error('Erro ao salvar imagem da seção:', err);
    return res.status(500).json({ ok:false, msg:'Falha ao salvar' });
  }
});

// GET /paineis/secoes?dep=<ObjectId>
router.get('/secoes', async (req, res) => {
  console.log('9000')
  try {
    const departamentos = await Departamento.find()
      .collation({ locale: 'pt', strength: 1 })
      .sort({ nomeDepartamento: 1 })
      .lean();

    const depSelecionado = String(req.query.dep || '').trim();
    let lista = [];

    if (depSelecionado) {
      // 1) Setores do departamento
      const setores = await DeptoSetores.find(
        { idDepto: depSelecionado },
        { _id: 1, nomeDeptoSetor: 1, imagemUrl: 1 }
      )
      .collation({ locale: 'pt', strength: 1 })
      .sort({ nomeDeptoSetor: 1 })
      .lean();

      const setorIds = setores.map(s => s._id);

      // 2) Documentos de seções por setor
      const docsSecoes = await DeptoSecoes.find(
        { idDeptoSetor: { $in: setorIds } },
        { _id: 1, idDeptoSetor: 1, secao: 1 }
      ).lean();

      // 3) Indexa seções por setor (achatando o array "secao")
      const secoesBySetor = {};
      for (const doc of docsSecoes) {
        const k = String(doc.idDeptoSetor);
        const itens = Array.isArray(doc.secao) ? doc.secao : [];
        for (let i = 0; i < itens.length; i++) {
          const it = itens[i] || {};
          (secoesBySetor[k] ||= []).push({
            _idDoc: doc._id,          // id do documento pai (deptosecoes)
            idx: i,                   // índice do item dentro de "secao"
            nome: it.nameSecao || '',
            imagemUrl: it.imagemUrl || null
          });
        }
      }

      // 4) Monta lista final para a view
      lista = setores.map(s => ({
        _id: s._id,
        nome: s.nomeDeptoSetor,
        imagemUrl: s.imagemUrl || null,
        secoes: secoesBySetor[String(s._id)] || []
      }));
    }

    return res.render('pages/central/painel-secoes', {
      layout: 'central/segmento',
      departamentos,
      depSelecionado,
      lista
    });
  } catch (err) {
    console.error('Erro ao carregar painel de seções:', err);
    res.status(500).send('Erro ao carregar painel de seções');
  }
});
// ... (importes iguais)

router.get('/secoes/data', async (req, res) => {
  console.log('');
  console.log('AQUI ??');  
  console.log(req.query.dep)
  try {
    const depId = String(req.query.dep || '').trim();
    if (!depId) return res.json({ lista: [] });

    const { Types } = require('mongoose');

    const lista = await DeptoSetores.aggregate([
      // setores do departamento informado
      { $match: { idDepto: new Types.ObjectId(depId) } },
      { $sort: { nomeDeptoSetor: 1 } },

      // busca seções cujo idSetor = _id do setor
      {
        $lookup: {
          from: 'deptosecoes',
          localField: '_id',           // _id do setor
          foreignField: 'idSetor',     // campo nas seções
          pipeline: [
            { $project: { _id: 1, nome: '$nameSecao', imagemUrl: 1 } },
            { $sort: { nome: 1 } }
          ],
          as: 'secoes'
        }
      },

      // normaliza nomes dos campos do setor
      {
        $project: {
          _id: 1,
          nome: '$nomeDeptoSetor',
          imagemUrl: 1,
          secoes: 1
        }
      }
    ]).collation({ locale: 'pt', strength: 1 });

    // normaliza para a view
    const saida = lista.map(s => ({
      _id: s._id,
      nome: s.nome,
      imagemUrl: s.imagemUrl || null,
      secoes: (s.secoes || []).map((c, idx) => ({
        _idDoc: c._id,
        idx,
        nome: c.nome || '',
        imagemUrl: c.imagemUrl || null
      }))
    }));

    console.log('LISTA', lista);
    console.log('4000', saida);

    return res.json({ lista: saida });
  } catch (e) {
    console.error('JSON /paineis/secoes/data', e);
    return res.status(500).json({ lista: [], error: 'fail' });
  }

});

//const DeptoSetores = require('../../models/deptosetores');
router.patch('/setor/:id/imagem', async (req, res) => {
  await DeptoSetores.updateOne({ _id: req.params.id }, { $set: { imagemUrl: req.body.imagemUrl || null } });
  res.json({ ok: true });
});

// PATCH imagem da SEÇÃO (item do array)
//const DeptoSecoes = require('../../models/deptosecao');
router.patch('/secao/:docId/item/:idx/imagem', async (req, res) => {
  await DeptoSecoes.updateOne(
    { _id: req.params.docId },
    { $set: { [`secao.${Number(req.params.idx)}.imagemUrl`]: (req.body.imagemUrl || null) } }
  );
  res.json({ ok: true });
});

module.exports = router;
