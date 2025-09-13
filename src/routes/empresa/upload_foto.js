const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
//const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const ProdutoImagem = require("../../models/produtoImagem");
//const MConstrucao =require('../../models/mconstrucao');
const MConstrucao = require("../../models/mconstrucao");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});
const upload = multer({ storage });

// Configure seu cliente do Spaces
const s3 = new S3Client({
  region: "us-east-1", // Para DigitalOcean, qualquer região funciona
  endpoint: "https://nyc3.digitaloceanspaces.com", // Região do seu Space
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET
  }
});
/* <><><><><><><><></></></></></></></></><><><><><><><><></></></></></></></></><><><><><><><><></></></></></></></></> */

/* <><><><><><><><></></></></></></></></><><><><><><><><></></></></></></></></><><><><><><><><></></></></></></></></> */
// Rota para gerar a URL assinada
//router.get("/getpresignedurl", async (req, res) => {
router.get("/getpresignedurl", async (req, res) => {
  try{
        const { filename = "", filetype = "",  ordem = "01" } = req.query;
        const num = String(ordem).padStart(2, "0");
        const safe = String(filename).replace(/\s+/g, "_");
        const key  = `${num}_${Date.now()}_${safe}`;

        const command = new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: key,
          ContentType: filetype,
          ACL: "public-read"
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        res.json({ uploadUrl, key });
        console.log('[ 47 ]'); 
        console.log('');
        console.log('',upload);
        console.log('',key);
        console.log('-----------------------------------------------------------------------');
  
        //res.json({ uploadUrl, key });
  } catch (err) {
       console.error("Erro ao gerar URL assinada:", err);
        res.status(500).json({ error: "Erro ao gerar URL" });
  }
   console.log('');
   console.log('----------------------------------');
   console.log(' [ 60 = > uplaod.js => router.get("/getpresignedurl');
   console.log('');
   console.log('----------------------------------');

});
///});

//const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });  //https://amelia.nyc3.digitaloceanspaces.com/produtos/biquiniVermelho.png
//});//


router.get("/listararquivos", async (req, res) => {
  console.log(' [ 45 uplaod.js => router.get("/listararquivos');
  const { prefixo, filtro } = req.query;

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefixo || "produtos/",
  };

  try {
    const data = await s3.send(new ListObjectsV2Command(params));
    let arquivos = (data.Contents || []).map(obj => obj.Key);
    if (filtro) arquivos = arquivos.filter(key => key.includes(filtro));
    console.log(arquivos);
    res.json(arquivos);
  } catch (err) {
    console.error("Erro ao listar arquivos:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  console.log(' [ 68 uplaod.js => router.get("/" => carregar imagens');
  try {
    const imagens = await ProdutoImagem.find().lean();
    res.render("grafafoto/index", { imagens });
  } catch (err) {
    console.error("Erro ao listar imagens:", err);
    res.status(500).send("Erro ao carregar imagens");
  }
});

// upload_foto.js
router.post("/imagem/salvar", async (req, res) => {
  console.log('');
  console.log(' [ 106 ] req.body',req.body);
  console.log('');
  console.log('');
  try {
    const {
      codigoId,       // ObjectId do produto
      produtoNome,    // descrição/nome do produto
      fornecedor,     // razão social
      departamento,   // nome do departamento
      imagemUrl,      // URL pública do Space
      shortkey,            // chave no Space (ex.: produtos/semcodigo/Meu_Arquivo.png)
      mimeType,       // ex.: image/png
      size            // bytes
    } = req.body;

    if (!imagemUrl || !shortkey) {
      return res.status(400).json({ error: "imagemUrl e key são obrigatórios." });
    }

    const key=shortkey;
    const nova = await ProdutoImagem.create({
      codigoId:  codigoId || null,
      produtoNome: produtoNome?.trim() || "",
      fornecedor:  fornecedor?.trim() || "",
      departamento: departamento?.trim() || "",
      imagemUrl,
      key,
      mimeType: mimeType || "",
      size: Number(size) || 0
    });

    // 2) adiciona a URL no produto (m_construcao.pageurls)
    if (codigoId) {
      console.log('codigoId')
      await MConstrucao.findByIdAndUpdate(
        codigoId,
        {
          // empurra a imagem para o fim e garante no máx. 7 entradas
          $push: { pageurls: { $each: [imagemUrl], $slice: 7 } },
          $set: { pageok: true }
        },
        { new: false }
      );
    }

    //res.status(200).json({ ok: true, id: docImg._id });
    res.status(200).json({ ok: true, id: nova._id });
  } catch (err) {
    console.error("Erro ao salvar imagem:", err);
    res.status(500).json({ error: "Erro ao salvar imagem." });
  }
});


router.post("/upload", upload.array("imagens", 7), async (req, res) => {
  try {
    const { codigo, descricao, referencia } = req.body;
    const imagens = req.files;

    for (const img of imagens) {
      const nova = new ProdutoImagem({
        codigo,
        descricao,
        referencia,
        nome: img.originalname,
        imagemUrl: `/uploads/${img.filename}`
      });
      await nova.save();
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao gravar imagens:", err);
    res.status(500).json({ error: "Erro ao salvar imagens." });
  }
});

router.get("/produtoImagem/buscar/:id", async (req, res) => {
  console.log('');
  console.log(' [ 187 ] => routes/empresa/upload_foto',req.params);
  console.log('');
  const c=req.params.id;
  console.log('valor de c :',c)
  try {
    const docs = await ProdutoImagem.find({'produtoNome':c})
       .sort({ createdAt: -1 })
       .limit(60)
       .lean();
        console.log('--->', docs)
        res.json(docs);
  } catch (err) {
    console.error("Erro em /produtoImagem/buscar:", err);
    res.status(500).json({ ok:false, error:"Erro ao buscar produtoImagem" });
  }
});
module.exports = router;