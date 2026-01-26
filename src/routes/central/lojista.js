const express = require('express');
const router = express.Router();

const Segmentos = require("../../models/departamento");
const Lojista = require('../../models/lojista');
const produtoController = require('../../controllers/produtoController');
const Departamento = require('../../models/departamento');
//////////////////////////////////////////////////////
const path = require("path");
const crypto = require("crypto");        // ✅ Node crypto (randomBytes)
const bcrypt = require("bcryptjs");      // ✅ bcryptjs (genSalt/hash)

const multer = require("multer");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

// mesmo padrão do seu upload_foto.js
const uploadMem = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "https://nyc3.digitaloceanspaces.com",
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET,
  },
});
//////////////////////////////////////////////////////

//Pega os dados dos lojista para colocar na tabela Lista
router.get('/lojista', async (req, res) => {
   console.log('');
   console.log(" [ 12  ] ");
   console.log(" [ vem de => views/pages/central/centralMenu.handlebars ] ")
   console.log(" [ vem de => src/routes/central/lojista.js ]");
   console.log(' destino =>  views/pages/central/listaLojista.handlebars');
   console.log('');
   try {
    const lojistas = await Lojista.find()
      .populate("departamentos", "nomeDepartamento")
      .lean();

    console.log('[ 22 lista de lojistas para listaLojista.handlebars ]:');
    console.log(' segue :', lojistas)
    
    res.render("pages/central/listaLojista.handlebars", {
      layout: false,
      lojista: lojistas
    });

  } catch (err) {
    console.error('[Erro ao buscar lojistas]:', err);

    // Renderiza mesmo com erro, apenas com lista vazia
    res.render("pages/central/listaLojista.handlebars", {
      layout: false,
      lojista: [],
      erro: 'Erro ao carregar lojistas'
    });
  }
});

router.post("/lojista/create", async (req, res) => {
  console.log('');
  console.log('-----------------------------------------');
  console.log(' [ 24 /lojista/create ]',req.body);
  console.log('');
  console.log(req.body);
  console.log('');
 try {
    //const { segmentos, ...dados } = req.body;

    // const novoLojista = new Lojista({
    //   ...dados,
    //   departamento: req.body.departamento,
    // });
    const novoLojista = new Lojista(req.body);

    await novoLojista.save();
    res.status(200).json({ message: "Lojista salvo com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar Lojista:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get("/segmentos", async (req, res) => {
  console.log('------------------');
  console.log("Consultando segmentos...");
  try {
    const segmentos = await Segmentos.find().lean();
    console.log("Segmentos retornados:", segmentos);
    res.set("Cache-Control", "no-store");
    res.json(segmentos);
  } catch (err) {
    res.status(500).send("Erro ao buscar segmentos.");
  }
});

router.put('/lojistas/:id', async (req, res) => {
  try {
    console.log(8000)
    const lojista = await Lojista.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(lojista);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/lojistas/:id', async (req, res) => {
  try {
    await Lojista.findByIdAndDelete(req.params.id);
    res.json({ message: 'Lojista removido com sucesso.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put("/lojista/update/:id", async (req, res) => {
  console.log('[ 76 ] ',  req.params)
  try {
    const { id } = req.params;
    const updateData = req.body;

    await Lojista.findByIdAndUpdate(id, updateData, { new: true });
    res.json({ message: "Atualizado com sucesso!" });
  } catch (error) {
    console.error("Erro ao atualizar Lojista:", error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const departamentos = await Departamento.find({}, '_id nomeDepartamento').lean();
    res.json(departamentos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar departamentos' });
  }
});

router.post('/salvar', async (req, res) => {
  try {
    const {
      _id, razao, responsavel, cpf, cnpj, inscricao, site, marca,
      celular, fone, email, senha,
      cep, logradouro, complemento, bairro, cidade, estado,
      departamentos // isso vem como array de ObjectId (name="departamentos[]")
    } = req.body;

    // ⚠️ Validação: checar se todos os departamentos existem
    const encontrados = await Departamento.find({ _id: { $in: departamentos } }).lean();
    if (encontrados.length !== departamentos.length) {
      return res.status(400).json({ erro: 'Um ou mais departamentos inválidos' });
    }

    const lojistaData = {
      razao, responsavel, cpf, cnpj, inscricao, site, marca,
      celular, fone, email, senha,
      endereco: { cep, logradouro, complemento, bairro, cidade, estado },
      departamentos
    };

    let resultado;
    if (_id) {
      resultado = await Lojista.findByIdAndUpdate(_id, lojistaData, { new: true });
    } else {
      resultado = await Lojista.create(lojistaData);
    }

    res.json({ sucesso: true, lojista: resultado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar lojista' });
  }
});

router.get("/cadastro-cooperado", (req, res) => {
  console.log(5050)
  return res.render("pages/central/cadastro-cooperado.handlebars",{
    layout:false,
  });
});

// grava lojista/cooperados
router.post("/gravar", async (req, res) => {
  console.log('');
  console.log('[ 188 ]');
  console.log(' Vem : views/pages/central/cadastro-cooperados.handlebars');
  console.log(' router:/routes/central/lojista.js/gravar');
  console.log(' => :');
  console.log('',req.body)
  console.log('---------------------------------------------------');
  try {
      const novoLojista = new Lojista({
          razao: req.body.inputrazao,
          nomeresponsavel: req.body.responsavel,
          cpfresponsavel: req.body.cpf,
          cnpj: req.body.inputCNPJ,
          inscricao: req.body.inscricao,
          site: req.body.site,
          marca: req.body.marca,
          celular: req.body.celular,
          telefone: req.body.fone,
          email: req.body.email,
          senha: req.body.senha,
          cep: req.body.cep,
          logradouro: req.body.logradouro,
          complemento: req.body.complemento,
          bairro: req.body.bairro,
          cidade: req.body.cidade,
          estado: req.body.estado,
          assinante: "padrao",
          situacao: "ativo",
          template: "base",
          atividade: "não informada",
          departamentos:req.body.departamentos_ids,
    });
        // Defaults temporários (pode ajustar conforme seu fluxo depois) 
        await novoLojista.save();
        console.log('');
        console.log('[ 206 ] novoLojista.save');
        console.log('');
        res.redirect("/lojista/lojista"); // ajuste para onde redirecionar após salvar
  } catch (err) {
    console.error("❌ Erro ao salvar lojista:", err);
    res.status(500).send("Erro ao salvar lojista.");
  }
});

// PERTENCE A CADASTRO DE LOJISTA
router.get("/selectlista-depto", async (req, res) => {
  console.log('');
  console.log('');
  console.log(' [ 250 ]');
  console.log(' origem views :pages/central/departamento-seleção:Cadastro de Lojista');
  console.log('');
  console.log(' origem route :Quando digitado RAZÃO SOCIAL para pegar os segmentos" ');
  console.log(' obs : ');
  console.log('');
  console.log(' destino :mesmo');
  console.log('______________________________________');
  try {
    const departamentos = Departamento.find({ ativado: 1 }, '_id nomeDepartamento')   // ✅ só ativos
      .sort({ nomeDepartamento: 1 })
      .lean();
    //console.log('258 lista de departamentos :');
    console.log(departamentos);
    res.json(departamentos); // retorna [{ _id, titulo }]
  } catch (err) {
    console.error("Erro ao buscar segmentos:", err);
    res.status(500).json({ erro: "Erro ao buscar segmentos" });
  }
});

// usa fetch nativo (Node >=18) ou undici como fallback
let fetchFn = globalThis.fetch;
if (!fetchFn) {
  const { fetch } = require('undici');
  fetchFn = fetch;
}

//consulta secretaria da fazenda Espírito Santo
router.get('/consulta-ie-es/:cnpj', async (req, res) => {
  try {
    const cnpj = (req.params.cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14) {
      return res.status(400).json({ ok: false, message: 'CNPJ inválido' });
    }

    const base  = process.env.IE_API_URL;   // ex.: https://api.seu_provedor.com/ie
    const token = process.env.IE_API_TOKEN; // seu token do provedor (quando tiver)

    // ✅ Sem provedor: não quebra o front, apenas informa indisponível
    if (!base || !token) {
      return res.json({
        ok: true,
        inscricaoEstadual: '',
        message: 'Consulta automática desativada (sem provedor configurado).'
      });
    }

    // ===== Com provedor (opcional, quando você tiver) =====
    const url = `${base}?cnpj=${cnpj}&uf=ES&token=${encodeURIComponent(token)}`;

    // Timeout seguro
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 20000);

    const resp = await fetchFn(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: ac.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`IE provider HTTP ${resp.status}: ${body}`);
    }

    // 🔴 AQUI estava o seu erro: garanta que "data" exista SEMPRE
    const data = await resp.json().catch(() => ({}));

    const ie =
      data?.inscricaoEstadual ??
      data?.inscricao_estadual ??
      data?.ie ??
      data?.inscricao ??
      data?.result?.ie ??
      '';

    return res.json({ ok: true, inscricaoEstadual: ie, raw: data });

  } catch (err) {
    console.error('consulta-ie-es erro:', err);
    const isAbort = String(err?.name).toLowerCase() === 'aborterror';
    return res.status(500).json({
      ok: false,
      message: isAbort ? 'Timeout ao consultar provedor IE' : 'Falha na consulta IE (SEFAZ-ES)'
    });
  }
});

//está consultando o cnpj do lojista que está sendo cadastrado
router.get('/consulta-cnpj/:cnpj', async (req, res) => {
  console.log(' ');
  console.log(' [ 201 ]');
  console.log(' origem views :pages/central/departamento-seleção:Cadastro de Lojista');
  console.log(' origem route :routes/central/lojista/consulta-cnpj ');
  console.log(' obs :busca na receita federal os dados para cadastrar o lojista na central ');
  console.log('');
  console.log(' destino : departamento-selecao.handlebars');
  console.log('');
  const cnpj = req.params.cnpj;
  console.log('===>',cnpj)
  try {
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
    console.log(' 236 ');
   // console.log('++++++++++++++++++',response.json());
    console.log('');
    const data = await response.json();
    res.json(data); // devolve pro front-end
    } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar CNPJ' });
  }
});

// routes
router.delete('/produto-delete/:id', produtoController.softDelete);

// GET - abrir tela de edição
router.get("/editar/:id", async (req, res) => {

  console.log('BRAVO!')
  try {
    const lojista = await Lojista.findById(req.params.id)
      .populate("departamentos", "nome") // se o schema de departamento tiver "nome"
      .lean();

    if (!lojista) return res.status(404).send("Lojista não encontrado.");

    res.render("pages/central/editando-lojista", {layout:false, lojista });
  } catch (err) {
    console.error("GET /lojistas/editar/:id", err);
    res.status(500).send("Erro ao abrir edição do lojista.");
  }
});

router.post("/editar/:id", uploadMem.single("logoFile"), async (req, res) => {
  console.log("[POST /lojista/editar/:id] params:", req.params);

  try {
    const { id } = req.params;

    // defesa: se BUCKET_NAME não existir, já acusa com clareza
    if (!process.env.BUCKET_NAME) {
      console.error("ENV BUCKET_NAME está vazio/undefined. Verifique seu .env e dotenv.");
      return res.status(500).send("Configuração do Space inválida (BUCKET_NAME).");
    }

    // ===== whitelist (mantive seu padrão) =====
    const update = {
      razao: req.body.razao,
      assinante: req.body.assinante,
      situacao: req.body.situacao,
      template: req.body.template,
      atividade: req.body.atividade,
      nomeresponsavel: req.body.nomeresponsavel,
      cpfresponsavel: req.body.cpfresponsavel,
      cnpj: req.body.cnpj,
      inscricao: req.body.inscricao,
      site: req.body.site,
      marca: req.body.marca,
      celular: req.body.celular,
      telefone: req.body.telefone,
      email: req.body.email,

      cep: req.body.cep,
      logradouro: req.body.logradouro,
      numero: req.body.numero,
      complemento: req.body.complemento,
      cidade: req.body.cidade,
      bairro: req.body.bairro,
      estado: req.body.estado,

      corHeader: req.body.corHeader,
      tituloPage: req.body.tituloPage,

      // mantém a logo antiga se não vier nova
      logoUrl: req.body.logoUrl || "",

      ativo: req.body.ativo,
    };

    // ===== senha opcional (igual seu padrão) =====
    console.log('');
    console.log('____________________________________________');
    console.log("[bcrypt check]", {
      hasGenSalt: typeof bcrypt.genSalt,
      hasHash: typeof bcrypt.hash
    });
    console.log('');
    if (req.body.senha && String(req.body.senha).trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      update.senha = await bcrypt.hash(String(req.body.senha), salt);
    }

    // ===== se veio arquivo, sobe no Space e grava logoUrl =====
    if (req.file && req.file.buffer) {
      if (!req.file.mimetype || !req.file.mimetype.startsWith("image/")) {
        return res.status(400).send("Arquivo inválido. Envie uma imagem.");
      }

      const ext = (path.extname(req.file.originalname || "") || ".jpg").toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";

      // const hash = bcrypt.randomBytes(8).toString("hex");
      const hash = crypto.randomBytes(8).toString("hex");
      const key = `lojistas/${id}/logo/${Date.now()}_${hash}${safeExt}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: key,
          Body: req.file.buffer,
          ACL: "public-read",
          ContentType: req.file.mimetype || "image/jpeg",
        })
      );

      const urlPublica = `https://${process.env.BUCKET_NAME}.nyc3.digitaloceanspaces.com/${key}`;
      console.log('') ;
      console.log('',urlPublica) ;
      console.log('') ;
      update.logoUrl = urlPublica;
    }

    await Lojista.findByIdAndUpdate(id, update, { runValidators: true });

    return res.redirect("/lojista/lista");
  } catch (err) {
    console.error("POST /lojista/editar/:id", err);
    return res.status(500).send("Erro ao salvar lojista.");
  }
});

router.post('/gravar-cooperado', async (req, res) => {
  console.log('');
  console.log('[ 467 ]');
  console.log(' Vem : views/pages/sitel/seja-cooperados.handlebars');
  console.log(' router:/routes/central/lojista.js/gravar');
  console.log(' => :');
  console.log('',req.body)
  console.log('---------------------------------------------------');
  try {
      // ✅ normaliza CNPJ (somente números)
      const cnpjRaw = (req.body.inputCNPJ || '').toString();
      const cnpj = cnpjRaw.replace(/\D/g, '');

      // valida tamanho
      if (cnpj.length !== 14) {
        return res.status(400).send("CNPJ inválido.");
      }

      // ✅ verifica se já existe
      const jaExiste = await Lojista.findOne({ cnpj }).select("_id cnpj razao situacao").lean();

      if (jaExiste) {
        // (pode trocar a mensagem pelo seu texto final)
        return res
          .status(409)
          .send(`CNPJ já cadastrado. Situação: ${jaExiste.situacao || 'não informada'}.`);
      }

      const novoLojista = new Lojista({
          razao: req.body.inputrazao,
          assinante: "padrao",
          situacao: (req.body.situacao && String(req.body.situacao).trim())
              ? String(req.body.situacao).trim()
              : "ativo",
          template: "base",
          atividade: "não informada",
          nomeresponsavel: req.body.responsavel,
          cpfresponsavel: req.body.cpf,
          cnpj: req.body.inputCNPJ,
          inscricao: req.body.inscricao,
          site: req.body.site,
          marca: req.body.marca,
          celular: req.body.celular,
          telefone: req.body.fone,
          email: req.body.email,
          senha: req.body.senha,
          cep: req.body.cep,
          logradouro: req.body.logradouro,
          complemento: req.body.complemento,
          bairro: req.body.bairro,
          cidade: req.body.cidade,
          estado: req.body.estado,
          departamentos:req.body.departamentos_ids,
    });
        // Defaults temporários (pode ajustar conforme seu fluxo depois) 
        await novoLojista.save();
        console.log('');
        console.log('[ 503 ] novoLojista.save');
        console.log('');
        res.redirect("/lojista/lojista"); // ajuste para onde redirecionar após salvar
  } catch (err) {
    console.error("❌ Erro ao salvar lojista:", err);
    res.status(500).send("Erro ao salvar lojista.");
  }
});

// ✅ /src/routes/central/lojista.js (ou onde está sua rota lojista)
router.get('/selectlistaDepto', async (req, res) => {
  console.log( ' 514 ');
  try {
    const deps = await Departamento
      .find({ ativado: 1 }, '_id nomeDepartamento')   // ✅ só ativos
      .sort({ nomeDepartamento: 1 })
      .lean();

    return res.json(deps);
  } catch (e) {
    console.error('❌ /selectlista-depto', e);
    return res.status(500).json([]);
  }
});



module.exports = router;
