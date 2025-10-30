const express = require('express');
const router = express.Router();
const { Types } = require('mongoose');
const Departamento  = require('../../models/departamento');
const DeptoSetores  = require('../../models/deptosetores'); // ajuste o caminho/nome se diferir
require("dotenv").config();

/////////////////////////////////////////////////////////////
const path = require('path');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');


const BUCKET      = (process.env.BUCKET_NAME || '').trim();
const REGION      = (process.env.SPACES_REGION || '').trim();
const ENDPOINT    = (process.env.SPACE_ENDPOINT || '').trim();

if (!BUCKET) {
  console.error('[Spaces] SPACES_BUCKET não definido!');
}
console.log('[Spaces] region:', REGION);
console.log('[Spaces] endpoint:', ENDPOINT);
console.log('[Spaces] bucket:', BUCKET);

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});

// helper para slugar o nome do arquivo
function slug(s = '') {
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// monta URL pública (sem CDN)
function spacesPublicUrl(key) {
  if (!key) return '';
  const host = ENDPOINT.replace(/^https?:\/\//, '');
  return `https://${BUCKET}.${host}/${key}`;
}

// +// URL pública do arquivo (usa CDN se houver; senão, domínio padrão do Spaces)
function spacesPublicUrl(key) {
  if (!key) return '';
  //if (CDN_BASE) return `${CDN_BASE}/${key}`;
  return `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
}

router.get('/painel',async(req,res)=>{
  try {
    const departamentos = await Departamento.find()
      .collation({ locale: 'pt', strength: 1 })
      .sort({ nomeDepartamento: 1 })
      .lean();

    const depIds = departamentos.map(d => d._id);
    const setores = await DeptoSetores.find(
      { idDepto: { $in: depIds } },
      { _id: 1, idDepto: 1, nomeDeptoSetor: 1, imagemUrl: 1 }
    ).collation({ locale: 'pt', strength: 1 })
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

    const lista = departamentos.map(d => ({
      _id: d._id,
      nome: d.nomeDepartamento,
      imagemUrl: d.imagemUrl || null,
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

})

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

// 
router.post('/upload/image', upload.single('image'), async (req, res) => {
   try {
    if (!req.file) return res.status(400).json({ error: 'arquivo não enviado' });
    if (!BUCKET)   return res.status(500).json({ error: 'Storage mal configurado (SPACES_BUCKET)' });
    console.log('===> ',req.file)
    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.bin';
    const baseName = slug(req.body.name || path.basename(req.file.originalname, ext) || 'img');
    const key = `setores/${Date.now()}_${baseName}${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ACL: 'public-read',
      ContentType: req.file.mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    const url = spacesPublicUrl(key);
    return res.json({ url, key });
  } catch (err) {
    console.error('Falha no upload para Spaces:', err);
    return res.status(500).json({ error: 'falha no upload' });
  }
});


router.patch('/setor/:id/imagem', async (req, res) => {
  const { id } = req.params;
  const { imagemUrl } = req.body;
  await DeptoSetores.updateOne({ _id: id }, { $set: { imagemUrl: imagemUrl || null } });
  res.json({ ok: true });
});

// ==========================
// PATCH imagem da SEÇÃO (se você usa esse modelo em outro lugar)
// (mantém a assinatura como estava)
router.patch('/secao/:docId/item/:idx/imagem', async (req, res) => {
  const { docId, idx } = req.params;
  const { imagemUrl } = req.body;
  await DeptoSecoes.updateOne(
    { _id: docId },
    { $set: { [`secao.${Number(idx)}.imagemUrl`]: imagemUrl || null } }
  );
  res.json({ ok: true });
});

module.exports = router;

