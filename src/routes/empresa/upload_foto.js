const express = require("express");
const router = express.Router();

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

const multer = require("multer");
const { Types } = require('mongoose');

const { S3Client, PutObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const ProdutoImagem = require("../../models/produtoImagem");
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
function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

const STOP = new Set(['de','da','do','das','dos','para','pra','e','a','o','as','os','no','na','nos','nas']);

function normalizePlain(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokenizeNorm(s) {
  return normalizePlain(s).split(/\s+/).filter(Boolean);
}
function escRE(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function wordBoundary(token) { return new RegExp(`\\b${escRE(token)}(?:s)?\\b`, "i"); } // singular/plural
function looseRE(token) { return new RegExp(token.split("").join(".{0,2}"), "i"); }     // fuzzy leve

/* <><><><><><><><></></></></></></></></><><><><><><><><></></></></></></></></><><><><><><><><></></></></></></></></> */
// Rota para gerar a URL assinada
//router.get("/getpresignedurl", async (req, res) => {
router.get("/getpresignedurl", async (req, res) => {
   try {
    const { filename = "", filetype = "", ordem = "01" } = req.query;
    const num  = String(ordem).padStart(2, "0");
    const safe = String(filename).replace(/\s+/g, "_");
    const key  = `${num}_${Date.now()}_${safe}`;

    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      ContentType: filetype,
      ACL: "public-read",          // OK
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    res.json({ uploadUrl, key });

    // logs opcionais (válidos)
    console.log('');
    console.log('[getpresignedurl] key:', key);
    console.log('.........................................................');
    console.log('[getpresignedurl] url:', uploadUrl);
    console.log('');
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

router.get("/listararquivos", async (req, res) => {
  console.log('');
  console.log(' [ 79 ] routes/empresa/upload_foto.js => router.get("/listararquivos');
  console.log('');
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
  console.log(' [ 95 ] routes/empresa/upload_foto.js => router.get("/" => carregar imagens');
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
  console.log(' [ 108 ] routes/empresa/upload_foto.js==>imagem/salvar',req.body);
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
  console.log('');
  console.log(' [ 164 ] => routes/empresa/upload',req.params);
  console.log('');
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

// >>> Se usa /gravafoto/produtoImagem/buscar/:termo, troque a linha abaixo:
router.get("/produtoImagem/buscar/:termo", async (req, res) => {

    console.log('---------------------------------');
    console.log('');
    console.log(' valor de termo => ',req.params.termo);
    console.log(' [ 221 ]');
    console.log('---------------------------------');

    try {
        const produtoId = String(req.params.termo || "").trim();
        console.log("GET /produtoImagem/buscar/:termo  -> produtoId =", produtoId);

        if (!produtoId) return res.json([]);

       
        console.log('')

        const termoRaw = String(req.params.termo || '').trim();
        if (!termoRaw || !Types.ObjectId.isValid(termoRaw)) return res.json([]);

        const docs = await MConstrucao
          .find({ _id: new Types.ObjectId(termoRaw) })
          .sort({ ordem: 1, createdAt: 1 })
          .lean();
        console.log('');  
        console.log('-------------------------------------');
        console.log(' docs ',docs)
        console.log('-----------------------------------------------');
        console.log('');

        const out = (Array.isArray(docs) ? docs : []).map(d => ({
          ...d,
          id: String(d._id || ""),
          codigoId: d.codigoId ? String(d.codigoId) : null,
          url: d.imagemUrl || "",
          descricao: d.produtoNome || d.descricao || ""
        }));

        return res.json(out);
   } catch (err) {
        console.error("Erro na busca por ID do produto:", err);
        return res.status(500).json({ error: "falha na busca" });
   }
});

// GET /gravafoto/produtoImagem/buscar?descricao=...&fornecedor=...
router.get("/buscar-BcoImg", async (req, res) => {
  console.log('=========100======>>',req.query)
  console.log('');
  try {
  //  const rawDesc  = String(req.query.descricao || '').trim();
  //  const fornecedor = String(req.query.fornecedor || '').trim();
  //  const departamento = String(req.query.departamento || '').trim();

    // --- monta filtro dinamicamente ---
  //  const filter = {};

    // filtro leve por descrição no servidor (produtoNome / url)
 //   if (rawDesc) {
 //     const rx = new RegExp(rawDesc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // escape + case-insensitive
      // tente bater em produtoNome; se não existir no schema, remova essa linha
  //    filter.$or = [
  //      { produtoNome: rx },
  //      { url: rx }
  //    ];
   // }

    const rawDesc = String(req.query.descricao || '').trim();
console.log('',rawDesc)
// escape seguro + permite “qualquer coisa entre as palavras”
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rxLoose = rawDesc ? new RegExp(escape(rawDesc).replace(/\s+/g, '.*'), 'i') : null;

const filter = {};
if (rxLoose) {
  filter.$or = [
    { produtoNome: rxLoose },
    { nome: rxLoose },
    { descricao: rxLoose },
    { descricaoProduto: rxLoose },
    { codigo: rxLoose },
    { code: rxLoose },
    { url: rxLoose },
    { filename: rxLoose },
    { key: rxLoose },
  ];
}

    // se no seu schema fornecedor é string (nome/razao) OU ObjectId (ref):
  //  if (fornecedor) {
      // Ex. se for string "razao":
  //    filter['fornecedor'] = fornecedor; 
      // Se for ObjectId de ref: filter['fornecedor'] = new mongoose.Types.ObjectId(fornecedor)
  //  }

    // idem para departamento: ajuste campo conforme seu schema
 //   if (departamento) {
 //     filter['departamento'] = departamento;
 //   }

    // limites/ordem — ajuste conforme necessidade
    const limit  = Math.min(parseInt(req.query.limit || '60', 10), 200);
    const cursor = ProdutoImagem.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    const docs = await cursor;
     console.log('URLDOCS',docs)
    // normaliza para o formato que o front espera
    const resp = (docs || []).map(d => ({
      url: d.imagemUrl,                     // precisa existir no schema
      key: d.key || d.filename || null, // ajuste conforme seu storage
      produtoNome: d.produtoNome || ''  // opcional, ajuda no matchDescricaoTexto
    }));

    console.log('1000=> resp',resp)
     
    // cache-control para evitar resultados “velhos”
    res.set('Cache-Control', 'no-store');
    return res.json(resp);

  } catch (err) {
    console.error('Erro em /buscarBcoImg:', err);
    return res.status(500).json({ error: 'Falha ao buscar banco de imagens' });
  }

});


//const ProdutoImagem = require("./models/ProdutoImagem");
(async () => {
  const cur = ProdutoImagem.find().cursor();
  for await (const d of cur) { await d.save(); } // dispara o pre('save') e preenche *_norm
  console.log("Backfill *_norm concluído");
})();

router.get("/buscar_BcoImg", async (req, res) => {

  try{
        // se nada foi passado, evite varrer a coleção inteira
        if (!descricao && !fornecedor) return res.json([]);

    // --- helpers simples (use os seus se já existirem no arquivo) ---
    const norm = s => String(s || "")
      .toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9\s._-]/g, " ");
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokens = norm(descricao).split(/\s+/).filter(Boolean);

    const conds = [];

    // filtro por DESCRIÇÃO (nome/descrição normalizados)
    if (tokens.length) {
      if (tokens.length === 1) {
        const t = esc(tokens[0]);
        conds.push({ produtoNome_norm: new RegExp(`\\b${t}(?:s|es)?\\b`, "i") });
        conds.push({ descricao_norm:   new RegExp(`\\b${t}(?:s|es)?\\b`, "i") });
      } else {
        // exige todos os tokens (qualquer ordem), tanto em nome quanto em descrição
        conds.push({ $and: tokens.map(t => ({ produtoNome_norm: new RegExp(`\\b${esc(t)}(?:s|es)?\\b`, "i") })) });
        conds.push({ $and: tokens.map(t => ({ descricao_norm:   new RegExp(`\\b${esc(t)}(?:s|es)?\\b`, "i") })) });
      }
    }

    // filtro por FORNECEDOR (use os campos que você tiver no schema)
    if (fornecedor) {
      const f = esc(norm(fornecedor));
      conds.push({ fornecedor_norm: new RegExp(f, "i") });
      conds.push({ fornecedor:      new RegExp(f, "i") }); // fallback se não houver _norm
      conds.push({ fornecedorNome:  new RegExp(f, "i") }); // outro fallback comum
    }

    // monta a query
    const query = conds.length ? { $or: conds } : {};

    // busque na sua coleção de imagens (ajuste o nome do model se for diferente)
    const docs = await ProdutoImagem
      .find(query)
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    // payload simples esperado no front
    const out = docs.map(d => ({
      url: d.imagemUrl || d.url || "",
      key: d.key || d.shortkey || String(d._id || ""),
      produtoNome: d.produtoNome || d.descricao || "",
      fornecedor: d.fornecedorNome || d.fornecedor || ""
    })).filter(x => !!x.url);

    return res.json(out);
  } catch (err) {
    console.error("Erro na busca (banco por query):", err);
    return res.status(500).json({ error: "falha na busca do banco" });
  }
});

router.get("/buscarBcoImg", async (req, res) => {
// ===== filtro por descricao (ignorando números e unidades) =====
const rawDesc = String(req.query.descricao || '').trim();

const escapeRx = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = s => String(s || '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().trim();

// remove palavras inúteis e números (80, 100, mm, cm, x, de/da/do…)
const STOP = new Set(['de','da','do','das','dos','mm','cm','m','x','para','e']);
const tokens = norm(rawDesc).split(/[^a-z0-9]+/g)
  .filter(t => t && !STOP.has(t) && !/^\d+$/.test(t));

// constrói um regex tolerante: termo1 .* termo2 (ordem preservada)
let rxLoose = null;
if (tokens.length) {
  const pattern = tokens.map(escapeRx).join('.*');
  rxLoose = new RegExp(pattern, 'i');   // ex.: "aro.*arremate"
}

const filter = {};
if (rxLoose) {
  filter.$or = [
    { produtoNome: rxLoose },
    { nome: rxLoose },
    { descricao: rxLoose },
    { imagemUrl: rxLoose },
    { key: rxLoose },
    { filename: rxLoose },
    { url: rxLoose },
  ];
}

// ===== busca =====
const limit = Math.min(parseInt(req.query.limit || '60', 10), 200);

let docs = await ProdutoImagem
  .find(filter, { imagemUrl:1, url:1, key:1, filename:1, produtoNome:1 })
  .sort({ createdAt: -1 })
  .limit(limit)
  .lean();

// (opcional) dedup por key/url
const seen = new Set();
docs = docs.filter(d => {
  const k = d.key || d.filename || d.imagemUrl || d.url;
  if (!k) return true;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// map final
const resp = docs.map(d => ({
  url: (d.imagemUrl && /^https?:\/\//i.test(d.imagemUrl)) ? d.imagemUrl
       : (d.url || d.imagemUrl || ''),
  key: d.key || d.filename || null,
  produtoNome: d.produtoNome || d.nome || d.descricao || ''
}));

console.log('');
console.log('',resp);
console.log('');

res.set('Cache-Control', 'no-store');
return res.json(resp);

});
module.exports = router;