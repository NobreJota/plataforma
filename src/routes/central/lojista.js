const express = require('express');
const router = express.Router();
//const { segmento }= require('../../models/lojista');
const Segmentos = require("../../models/departamento");
const Lojista = require('../../models/lojista');

router.get('/lojista', async (req, res) => {
   console.log('');
   console.log(" [ 8 passando por lojista ] ");
   console.log(" [ vem de => src/routes/cetral/lojista.js ]");
   console.log(" [ vem de => views/pages/central/loginCentral.handlebars ] ")
   console.log('');
   try {
    const lojistas = await Lojista.find()
      .populate("departamentos", "nomeDepartamento")
      .lean();

    console.log('[ 11 lojista ]:', lojistas);
    
    res.render("pages/central/listaLojista.handlebars", {
      layout: 'empresa/admin-empresa.handlebars',
      lojista: lojistas
    });

  } catch (err) {
    console.error('[Erro ao buscar lojistas]:', err);

    // Renderiza mesmo com erro, apenas com lista vazia
    res.render("pages/central/listaLojista.handlebars", {
      layout: 'empresa/admin-empresa.handlebars',
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

// XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
// routes/api/departamentos.js

const Departamento = require('../../models/departamento');

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


router.get("/departamento-selecao", (req, res) => {
   res.render("pages/central/departamento-selecao",{ layout: "central/admin"}); // caminho completo até o handlebars);});
});

router.post("/gravar", async (req, res) => {
  console.log('[ 159 ] /gravar lojista',req.body)
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
    console.log('[ 216 ] novoLojista.save');
    console.log('');
    res.redirect("/lojista/lojista"); // ajuste para onde redirecionar após salvar
  } catch (err) {
    console.error("❌ Erro ao salvar lojista:", err);
    res.status(500).send("Erro ao salvar lojista.");
  }
});

router.get('/consulta-cnpj/:cnpj', async (req, res) => {
  console.log(' ');
  console.log(' [ 225 ]');
  console.log(' origem views :pages/central/departamento-seleção:Cadastro de Lojista');
  console.log(' origem route :Quando digitado CNPJ para cadastrar o lojista" ');
  console.log(' obs : ');
  console.log('');
  console.log(' destino :mesmo??');
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
    const departamentos = await Departamento.find().lean();
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


module.exports = router;
