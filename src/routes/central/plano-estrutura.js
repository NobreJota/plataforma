// src/routes/central/plano-estrutura.js
// Administração da ESTRUTURA do plano de contas (subgrupos), por empresa.
//
// Por que aqui e não na tela do contab: subgrupo é a espinha do plano. Se cada
// cooperada criar os seus livremente, uma chama 2.02 de "fornecedores diversos"
// e outra de "despesas gerais", e os relatórios deixam de ser comparáveis.
// A criação passa pela administração; a empresa cria títulos e subtítulos dentro.
//
// Montar no server.js:  app.use('/central/plano', require('./src/routes/central/plano-estrutura'));

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const router = express.Router();

// O arquivo do plano fica em memória: é lido, conferido e descartado.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const { eAdmin } = require('../../../helpers/eAdmin');

const Lojista        = require('../../models/empresa/lojista');
const Grupo          = require('../../models/grupo');
const SubGrupo       = require('../../models/grupoSub');
const ContaTitulo    = require('../../models/contab/financeiro/contaTitulo');
const ContaSubTitulo = require('../../models/contab/financeiro/contaSubTitulo');
const { podeSuspender } = require('../../utils/contab/movimentoConta');
const { conferir, lerCSV, lerXLSX } = require('../../utils/contab/importarPlano');

router.use(eAdmin);

/* ===== Tela ===== */
router.get('/estrutura', (req, res) => {
  res.render('central/pages/plano-estrutura.handlebars', { layout: false });
});

/* ===== Empresas ===== */
router.get('/api/empresas', async (req, res) => {
  try {
    const lista = await Lojista.find({}, { razao: 1, marca: 1 }).sort({ razao: 1 }).lean();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Estrutura de uma empresa: grupos (comuns) + subgrupos (dela) ===== */
router.get('/api/estrutura/:lojistaId', async (req, res) => {
  try {
    const { lojistaId } = req.params;
    const incluirInativos = req.query.incluirInativos === 'true';

    const filtro = { lojistaId };
    if (!incluirInativos) filtro.ativo = { $ne: false };

    const [grupos, subgrupos] = await Promise.all([
      Grupo.find({ ativo: { $ne: false } }).sort({ codigo: 1 }).lean(),
      SubGrupo.find(filtro).sort({ codigo: 1 }).lean()
    ]);

    // Quantos títulos cada subgrupo já tem: subgrupo em uso não deve ser mexido à toa
    const contagem = await ContaTitulo.aggregate([
      { $match: { lojistaId: new mongoose.Types.ObjectId(String(lojistaId)) } },
      { $group: { _id: '$subGrupoId', total: { $sum: 1 } } }
    ]);
    const porSubgrupo = Object.fromEntries(contagem.map(c => [String(c._id), c.total]));

    res.json(grupos.map(g => ({
      _id: g._id,
      codigo: g.codigo,
      nome: g.nome,
      tipo: g.tipo,
      subgrupos: subgrupos
        .filter(s => String(s.grupoId) === String(g._id))
        .map(s => ({ ...s, titulos: porSubgrupo[String(s._id)] || 0 }))
    })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Criar subgrupo ===== */
router.post('/api/subgrupos', async (req, res) => {
  try {
    const { lojistaId, grupoId, nome, descricao } = req.body;
    if (!lojistaId || !grupoId || !String(nome || '').trim()) {
      return res.status(400).json({ erro: 'Empresa, grupo e nome são obrigatórios.' });
    }

    const grupo = await Grupo.findById(grupoId).lean();
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });

    // Sequência por empresa: cada uma numera os seus a partir do 01
    const ultimo = await SubGrupo.findOne({ grupoId, lojistaId }).sort({ codigo: -1 }).lean();
    const seq = ultimo ? parseInt(ultimo.codigo.split('.')[1], 10) + 1 : 1;
    if (seq > 99) return res.status(409).json({ erro: `O grupo ${grupo.codigo} não tem mais numeração livre.` });

    const novo = await SubGrupo.create({
      grupoId,
      codigoGrupo: grupo.codigo,
      codigo: `${grupo.codigo}.${String(seq).padStart(2, '0')}`,
      nome: String(nome).trim(),
      descricao: descricao || '',
      lojistaId
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Já existe um subgrupo com este código nesta empresa.' });
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Renomear ===== */
router.put('/api/subgrupos/:id', async (req, res) => {
  try {
    const { lojistaId, nome, descricao } = req.body;
    if (!String(nome || '').trim()) return res.status(400).json({ erro: 'Nome não pode ficar vazio.' });

    const upd = await SubGrupo.findOneAndUpdate(
      { _id: req.params.id, lojistaId },
      { nome: String(nome).trim(), descricao: descricao || '' },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Subgrupo não encontrado nesta empresa.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Suspender (nada é apagado) ===== */
router.delete('/api/subgrupos/:id', async (req, res) => {
  try {
    const { lojistaId } = req.query;
    if (!lojistaId) return res.status(400).json({ erro: 'Informe a empresa.' });

    // Mesma regra do plano: título ativo abaixo, ou conta com movimento, impede
    const r = await podeSuspender('subgrupo', req.params.id, lojistaId);
    if (!r.ok) return res.status(r.status).json({ erro: r.erro });

    r.doc.ativo = false;
    await r.doc.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Reativar ===== */
router.post('/api/subgrupos/:id/reativar', async (req, res) => {
  try {
    const { lojistaId } = req.body;
    const sg = await SubGrupo.findOne({ _id: req.params.id, lojistaId });
    if (!sg) return res.status(404).json({ erro: 'Subgrupo não encontrado nesta empresa.' });
    sg.ativo = true;
    await sg.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Clonar a estrutura de uma empresa para outra =====
   Empresa nova entrando: em vez de digitar tudo de novo, copia-se o esqueleto
   de uma que já está montada. Só os subgrupos; títulos e subtítulos são da
   operação de cada uma. */
router.post('/api/clonar', async (req, res) => {
  try {
    const { de, para } = req.body;
    if (!de || !para) return res.status(400).json({ erro: 'Informe as duas empresas.' });
    if (String(de) === String(para)) return res.status(400).json({ erro: 'As empresas precisam ser diferentes.' });

    const origem = await SubGrupo.find({ lojistaId: de, ativo: { $ne: false } }).sort({ codigo: 1 }).lean();
    if (!origem.length) return res.status(400).json({ erro: 'A empresa de origem não tem subgrupos.' });

    const jaTem = new Set(
      (await SubGrupo.find({ lojistaId: para }, { codigo: 1 }).lean()).map(x => x.codigo)
    );

    const novos = origem
      .filter(sg => !jaTem.has(sg.codigo))
      .map(sg => ({
        grupoId: sg.grupoId,
        codigoGrupo: sg.codigoGrupo,
        codigo: sg.codigo,
        nome: sg.nome,
        descricao: sg.descricao || '',
        ativo: true,
        lojistaId: para
      }));

    if (novos.length) await SubGrupo.insertMany(novos);
    res.json({ ok: true, criados: novos.length, ignorados: origem.length - novos.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ===== Importação do plano =====
   Duas etapas de propósito: a conferência mostra o que vai acontecer e não
   grava nada; só depois, confirmando, é que as contas são criadas. Importar um
   plano torto e depois suspender conta por conta seria bem pior. */

async function preparar(lojistaId) {
  const [grupos, subgrupos, titulos, subtitulos] = await Promise.all([
    Grupo.find({}, { codigo: 1 }).lean(),
    SubGrupo.find({ lojistaId }, { codigo: 1, nome: 1 }).lean(),
    ContaTitulo.find({ lojistaId }, { codigo: 1, nome: 1 }).lean(),
    ContaSubTitulo.find({ lojistaId }, { codigo: 1, nome: 1 }).lean()
  ]);
  const todas = [...subgrupos, ...titulos, ...subtitulos];
  return {
    gruposPorCodigo: Object.fromEntries(grupos.map(g => [g.codigo, g._id])),
    existentes: new Set(todas.map(x => x.codigo)),
    nomesAtuais: Object.fromEntries(todas.map(x => [x.codigo, x.nome]))
  };
}

// Histórico das importações: no dia da virada é preciso saber o que já entrou,
// de qual arquivo e até que data o sistema antigo estava fechado.
function registro() {
  return mongoose.connection.collection('_import_plano_log');
}

router.get('/api/importacoes/:lojistaId', async (req, res) => {
  try {
    const lista = await registro()
      .find({ lojistaId: new mongoose.Types.ObjectId(String(req.params.lojistaId)) })
      .sort({ quando: -1 }).limit(20).toArray();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/api/importar', upload.single('arquivo'), async (req, res) => {
  try {
    const { lojistaId, digitos, aplicar, dataReferencia, ensaio, atualizarNomes } = req.body;
    if (!lojistaId) return res.status(400).json({ erro: 'Escolha a empresa.' });
    if (!req.file) return res.status(400).json({ erro: 'Envie o arquivo (.csv ou .xlsx).' });

    const digitosSubtitulo = parseInt(digitos, 10) === 3 ? 3 : 4;
    const { gruposPorCodigo, existentes, nomesAtuais } = await preparar(lojistaId);
    const r = conferir(req.file.buffer, req.file.originalname, { digitosSubtitulo, existentes, gruposPorCodigo, nomesAtuais });

    if (aplicar !== 'true') {
      // Prévia: uma amostra basta para conferir se a leitura entendeu o arquivo
      return res.json({ ...r, contas: undefined, novas: r.novas.slice(0, 50) });
    }
    if (r.errosTotal) {
      return res.status(400).json({ erro: `O arquivo tem ${r.errosTotal} problema(s). Corrija antes de aplicar.`, ...r, contas: undefined });
    }

    // Cria de cima para baixo: o filho precisa do pai já gravado
    const criados = { subgrupo: 0, titulo: 0, subtitulo: 0 };
    const idPorCodigo = {};

    for (const c of r.novas.filter(x => x.nivel === 'subgrupo')) {
      const novo = await SubGrupo.create({
        grupoId: gruposPorCodigo[c.grupo], codigoGrupo: c.grupo,
        codigo: c.codigo, nome: c.nome, lojistaId
      });
      idPorCodigo[c.codigo] = novo._id; criados.subgrupo++;
    }

    async function idSubgrupo(codigo) {
      if (idPorCodigo[codigo]) return idPorCodigo[codigo];
      const sg = await SubGrupo.findOne({ lojistaId, codigo }, { _id: 1 }).lean();
      return sg && (idPorCodigo[codigo] = sg._id);
    }
    async function idTitulo(codigo) {
      if (idPorCodigo[codigo]) return idPorCodigo[codigo];
      const t = await ContaTitulo.findOne({ lojistaId, codigo }, { _id: 1 }).lean();
      return t && (idPorCodigo[codigo] = t._id);
    }

    for (const c of r.novas.filter(x => x.nivel === 'titulo')) {
      const paiId = await idSubgrupo(c.pai);
      if (!paiId) continue;
      const novo = await ContaTitulo.create({
        subGrupoId: paiId, codigoSubGrupo: c.pai,
        codigo: c.codigo, nome: c.nome,
        aceitaLancamento: false,          // o lançamento vive no subtítulo
        lojistaId
      });
      idPorCodigo[c.codigo] = novo._id; criados.titulo++;
    }

    // Subtítulos em lote: são dezenas de milhares
    const lote = [];
    for (const c of r.novas.filter(x => x.nivel === 'subtitulo')) {
      const paiId = await idTitulo(c.pai);
      if (!paiId) continue;
      lote.push({
        contaTituloId: paiId, codigoContaTitulo: c.pai,
        codigo: c.codigo, nome: c.nome,
        natureza: c.natureza, lojistaId
      });
      if (lote.length === 1000) { await ContaSubTitulo.insertMany(lote); criados.subtitulo += lote.length; lote.length = 0; }
    }
    if (lote.length) { await ContaSubTitulo.insertMany(lote); criados.subtitulo += lote.length; }

    // Nomes que mudaram no sistema antigo desde a última importação
    let renomeados = 0;
    if (atualizarNomes === 'true' && r.nomeMudou.length) {
      for (const n of r.nomeMudou) {
        const partes = n.codigo.split('.').length;
        const Model = partes === 2 ? SubGrupo : partes === 3 ? ContaTitulo : ContaSubTitulo;
        await Model.updateOne({ lojistaId, codigo: n.codigo }, { $set: { nome: n.para } });
        renomeados++;
      }
    }

    await registro().insertOne({
      lojistaId: new mongoose.Types.ObjectId(String(lojistaId)),
      quando: new Date(),
      arquivo: req.file.originalname,
      dataReferencia: dataReferencia || null,   // até quando o sistema antigo estava fechado
      ensaio: ensaio !== 'false',               // ensaio ou virada definitiva
      digitosSubtitulo,
      criados,
      renomeados,
      jaExistiam: r.resumo.jaExistem,
      soAqui: r.soAquiTotal
    });

    res.json({ ok: true, criados, renomeados, jaExistiam: r.resumo.jaExistem, soAqui: r.soAquiTotal });
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message });
  }
});

/* =====================================================================
   DE/PARA — plano antigo → plano novo, conta por conta
   ---------------------------------------------------------------------
   O plano do sistema antigo não é copiado: fica guardado só para consulta
   (_plano_origem), e cada conta dele recebe uma decisão, gravada no mapa
   (_mapa_contas):

     vincular  → equivale a uma conta que já existe no plano novo
     criar     → ganha uma conta nova, no título escolhido do plano novo
     descartar → não entra (gambiarra, conta morta)

   O importador de lançamentos usa esse mapa para traduzir cada código antigo.
   Conta antiga sem decisão bloqueia o lançamento em vez de sumir em silêncio.
   ===================================================================== */

const colOrigem = () => mongoose.connection.collection('_plano_origem');
const colMapa   = () => mongoose.connection.collection('_mapa_contas');
// Decisão desfeita ou trocada não some: vai para cá, com data e autor.
const colHist   = () => mongoose.connection.collection('_mapa_contas_historico');

async function arquivarDecisao(lojistaId, codigoAntigo, motivo, usuario) {
  const atual = await colMapa().findOne({ lojistaId, codigoAntigo });
  if (!atual) return;
  const { _id, ...resto } = atual;
  await colHist().insertOne({ ...resto, arquivadoEm: new Date(), arquivadoPor: usuario || '', motivo });
}
const oid = v => new mongoose.Types.ObjectId(String(v));

router.get('/depara', (req, res) => {
  res.render('central/pages/plano-depara.handlebars', { layout: false });
});

/* Carrega (ou recarrega) o plano antigo como referência. As decisões ficam,
   porque o mapa é ligado pelo código antigo, não pelo documento. */
router.post('/api/origem/carregar', upload.single('arquivo'), async (req, res) => {
  try {
    const { lojistaId } = req.body;
    if (!lojistaId) return res.status(400).json({ erro: 'Escolha a empresa.' });
    if (!req.file) return res.status(400).json({ erro: 'Envie o arquivo do plano antigo.' });

    let linhas = /\.xlsx?$/i.test(req.file.originalname) ? lerXLSX(req.file.buffer) : lerCSV(req.file.buffer);
    let referencia = null;
    linhas = linhas.filter(l => {
      if (String(l[0] || '').toLowerCase().startsWith('#referencia')) { referencia = l[1] || null; return false; }
      return true;
    });
    if (linhas.length && !/^[0-9.]+$/.test(String(linhas[0][0] || '').trim())) linhas.shift(); // cabeçalho

    const vistos = new Set();
    const docs = [];
    for (const [codigoBruto, nomeBruto] of linhas) {
      const codigo = String(codigoBruto || '').trim();
      const nome = String(nomeBruto || '').trim();
      if (!/^[0-9.]+$/.test(codigo) || !nome || vistos.has(codigo)) continue;
      vistos.add(codigo);
      const partes = codigo.split('.').length;
      docs.push({
        lojistaId: oid(lojistaId), origem: 'sistema-antigo',
        codigo, nome, nivel: ['', '', 'subgrupo', 'titulo', 'subtitulo'][partes] || 'outro',
        carregadoEm: new Date()
      });
    }
    await colOrigem().deleteMany({ lojistaId: oid(lojistaId) });
    if (docs.length) await colOrigem().insertMany(docs);
    res.json({ ok: true, contas: docs.length, referencia });
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message });
  }
});

/* Os dois lados da tela, já com as decisões aplicadas */
router.get('/api/depara/:lojistaId', async (req, res) => {
  try {
    const lojistaId = oid(req.params.lojistaId);
    const antigo = String(req.query.antigo || '').trim();
    const novo = String(req.query.novo || '').trim();
    const busca = String(req.query.busca || '').trim();
    const rx = s => new RegExp('^' + s.replace(/\./g, '\\.') + '(\\.|$)');
    const texto = busca ? new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

    const filtroAntigo = { lojistaId, nivel: { $in: ['titulo', 'subtitulo'] } };
    if (antigo) filtroAntigo.codigo = rx(antigo);
    if (texto) filtroAntigo.nome = texto;

    const [esquerda, decisoes, titulos, subtitulos, totalOrigem] = await Promise.all([
      colOrigem().find(filtroAntigo).sort({ codigo: 1 }).limit(2000).toArray(),
      colMapa().find({ lojistaId }).toArray(),
      ContaTitulo.find({ lojistaId, ...(novo ? { codigo: rx(novo) } : {}) }).sort({ codigo: 1 }).lean(),
      ContaSubTitulo.find({ lojistaId, ...(novo ? { codigo: rx(novo) } : {}) }).sort({ codigo: 1 }).limit(3000).lean(),
      colOrigem().countDocuments({ lojistaId })
    ]);

    const porAntigo = Object.fromEntries(decisoes.map(d => [d.codigoAntigo, d]));
    const destinoDe = {};
    decisoes.forEach(d => { if (d.codigoNovo) (destinoDe[d.codigoNovo] ||= []).push(d.codigoAntigo); });

    res.json({
      totalOrigem,
      esquerda: esquerda.map(c => ({
        codigo: c.codigo, nome: c.nome, nivel: c.nivel,
        decisao: porAntigo[c.codigo] ? {
          acao: porAntigo[c.codigo].acao, codigoNovo: porAntigo[c.codigo].codigoNovo
        } : null
      })),
      direita: [
        ...titulos.map(t => ({ codigo: t.codigo, nome: t.nome, nivel: 'titulo', ativo: t.ativo !== false })),
        ...subtitulos.map(s => ({ codigo: s.codigo, nome: s.nome, nivel: 'subtitulo', ativo: s.ativo !== false,
                                  recebeDe: destinoDe[s.codigo] || [] }))
      ].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt', { numeric: true }))
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Próximo subtítulo de um título do plano novo, na mesma largura dos irmãos */
async function proximoSubtitulo(lojistaId, tituloCodigo) {
  const irmaos = await ContaSubTitulo.find({ lojistaId, codigoContaTitulo: tituloCodigo }, { codigo: 1 }).lean();
  const largura = irmaos.length ? irmaos[0].codigo.split('.').pop().length : 3;
  const maior = irmaos.reduce((m, x) => Math.max(m, parseInt(x.codigo.split('.').pop(), 10) || 0), 0);
  const seq = maior + 1;
  if (String(seq).length > largura) {
    const e = new Error(`O título ${tituloCodigo} não tem mais numeração livre com ${largura} dígitos.`);
    e.status = 409; throw e;
  }
  return `${tituloCodigo}.${String(seq).padStart(largura, '0')}`;
}

router.post('/api/depara/decidir', async (req, res) => {
  try {
    const { lojistaId, codigoAntigo, acao, codigoNovo, tituloDestino, observacao } = req.body;
    if (!lojistaId || !codigoAntigo || !['vincular', 'criar', 'descartar'].includes(acao)) {
      return res.status(400).json({ erro: 'Dados incompletos.' });
    }
    const loja = oid(lojistaId);
    const antiga = await colOrigem().findOne({ lojistaId: loja, codigo: codigoAntigo });
    if (!antiga) return res.status(404).json({ erro: 'Conta antiga não encontrada.' });

    let destino = null;

    if (acao === 'vincular') {
      const existe = await ContaSubTitulo.findOne({ lojistaId: loja, codigo: codigoNovo }, { codigo: 1 }).lean()
                  || await ContaTitulo.findOne({ lojistaId: loja, codigo: codigoNovo }, { codigo: 1 }).lean();
      if (!existe) return res.status(404).json({ erro: `A conta ${codigoNovo} não existe no plano novo.` });
      destino = codigoNovo;
    }

    if (acao === 'criar') {
      const titulo = await ContaTitulo.findOne({ lojistaId: loja, codigo: tituloDestino }).lean();
      if (!titulo) return res.status(400).json({ erro: 'Escolha à direita o título onde a conta será criada.' });
      const grupo = tituloDestino.split('.')[0];
      for (let tentativa = 0; tentativa < 5 && !destino; tentativa++) {
        const codigo = await proximoSubtitulo(loja, tituloDestino);
        try {
          await ContaSubTitulo.create({
            contaTituloId: titulo._id, codigoContaTitulo: titulo.codigo,
            codigo, nome: antiga.nome, lojistaId: loja,
            natureza: ['1', '3'].includes(grupo) ? 'devedora' : 'credora'
          });
          destino = codigo;
        } catch (err) { if (err.code !== 11000) throw err; }
      }
      if (!destino) return res.status(409).json({ erro: 'Não consegui numerar a conta. Tente de novo.' });
    }

    const usuario = (req.user && (req.user.email || req.user.nome)) || '';
    await arquivarDecisao(loja, codigoAntigo, 'substituída', usuario);
    await colMapa().updateOne(
      { lojistaId: loja, codigoAntigo },
      { $set: {
          lojistaId: loja, codigoAntigo, nomeAntigo: antiga.nome,
          acao, codigoNovo: destino, observacao: observacao || '',
          decididoEm: new Date(), decididoPor: usuario
      } },
      { upsert: true }
    );
    res.json({ ok: true, acao, codigoNovo: destino });
  } catch (err) {
    res.status(err.status || 500).json({ erro: err.message });
  }
});

/* Suspende uma conta do plano novo pelo de/para (duplo clique). Nada é
   apagado: a conta fica em Contas suspensas e pode ser reativada. Recusa se a
   conta recebe alguma conta antiga no mapa, ou se tem movimento. */
router.post('/api/depara/suspender', async (req, res) => {
  try {
    const { lojistaId, codigo } = req.body;
    const loja = oid(lojistaId);
    const conta = await ContaSubTitulo.findOne({ lojistaId: loja, codigo });
    if (!conta) return res.status(404).json({ erro: 'Só subtítulos podem ser suspensos por aqui.' });

    const recebe = await colMapa().find({ lojistaId: loja, codigoNovo: codigo }).toArray();
    if (recebe.length) {
      return res.status(409).json({
        erro: `Esta conta recebe ${recebe.map(r => r.codigoAntigo).join(', ')} no mapa. Desfaça essa decisão antes.`
      });
    }
    const r = await podeSuspender('subtitulo', conta._id, loja);
    if (!r.ok) return res.status(r.status).json({ erro: r.erro });

    conta.ativo = false;
    await conta.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Exporta o mapa em CSV (ponto e vírgula, para abrir direto no Excel).
   ?historico=true inclui as decisões desfeitas ou substituídas. */
router.get('/api/depara/:lojistaId/exportar', async (req, res) => {
  try {
    const lojistaId = oid(req.params.lojistaId);
    const campo = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const data = d => d ? new Date(d).toLocaleString('pt-BR') : '';
    const acaoPt = { vincular: 'equivalência', criar: 'criada', descartar: 'descartada' };

    const atuais = await colMapa().find({ lojistaId }).sort({ codigoAntigo: 1 }).toArray();
    const linhas = [['situacao', 'codigo_antigo', 'nome_antigo', 'decisao', 'codigo_novo', 'decidido_em', 'decidido_por', 'observacao'].join(';')];
    atuais.forEach(d => linhas.push([
      'vigente', d.codigoAntigo, d.nomeAntigo, acaoPt[d.acao] || d.acao, d.codigoNovo || '',
      data(d.decididoEm), d.decididoPor || '', d.observacao || ''
    ].map(campo).join(';')));

    if (req.query.historico === 'true') {
      const antigas = await colHist().find({ lojistaId }).sort({ codigoAntigo: 1, arquivadoEm: 1 }).toArray();
      antigas.forEach(d => linhas.push([
        d.motivo, d.codigoAntigo, d.nomeAntigo, acaoPt[d.acao] || d.acao, d.codigoNovo || '',
        data(d.decididoEm), d.decididoPor || '', `arquivada em ${data(d.arquivadoEm)} por ${d.arquivadoPor || '?'}`
      ].map(campo).join(';')));
    }

    const nome = `mapa-contas-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    res.send('\uFEFF' + linhas.join('\r\n'));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Desfaz uma decisão. Se ela tinha criado conta, a conta continua no plano
   (nada é apagado); só o vínculo com a conta antiga sai. */
router.post('/api/depara/desfazer', async (req, res) => {
  try {
    const { lojistaId, codigoAntigo } = req.body;
    const usuario = (req.user && (req.user.email || req.user.nome)) || '';
    await arquivarDecisao(oid(lojistaId), codigoAntigo, 'desfeita', usuario);
    await colMapa().deleteOne({ lojistaId: oid(lojistaId), codigoAntigo });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =====================================================================
   FORNECEDORES DO SISTEMA ANTIGO → cadastro da plataforma
   ---------------------------------------------------------------------
   Lista de trabalho: cada fornecedor do cadastro antigo é aberto numa ficha,
   conferido e confirmado. Ao confirmar, ele entra no cadastro (ou, se o CNPJ
   já existe, só completa o que estiver vazio) e ganha o vínculo com a conta
   nova que o de/para decidiu. A linha fica marcada como feita.
   ===================================================================== */

const Fornecedor = require('../../models/fornec');
const colFornOrigem = () => mongoose.connection.collection('_fornec_origem');
const soDigitos = v => String(v || '').replace(/\D/g, '');
const UF = {
  'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE','distrito federal':'DF',
  'espirito santo':'ES','goias':'GO','maranhao':'MA','mato grosso':'MT','mato grosso do sul':'MS',
  'minas gerais':'MG','para':'PA','paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI',
  'rio de janeiro':'RJ','rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO','roraima':'RR',
  'santa catarina':'SC','sao paulo':'SP','sergipe':'SE','tocantins':'TO'
};
const siglaUF = v => {
  const t = String(v || '').trim();
  if (t.length === 2) return t.toUpperCase();
  return UF[t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()] || '';
};

router.get('/fornecedores-antigos', (req, res) => {
  res.render('central/pages/fornecedores-antigos.handlebars', { layout: false });
});

/* Carrega a lista. Recarregar não perde o trabalho feito: a situação de cada
   fornecedor (pendente, feito, ignorado) é preservada. */
router.post('/api/fornec-origem/carregar', upload.single('arquivo'), async (req, res) => {
  try {
    const { lojistaId } = req.body;
    if (!lojistaId || !req.file) return res.status(400).json({ erro: 'Escolha a empresa e o arquivo.' });
    const linhas = lerCSV(req.file.buffer);
    const cab = linhas.shift().map(c => c.trim());
    const ops = linhas.filter(l => l[0]).map(l => {
      const d = Object.fromEntries(cab.map((c, i) => [c, (l[i] || '').trim()]));
      d.lanc_2026 = parseInt(d.lanc_2026, 10) || 0;
      return {
        updateOne: {
          filter: { lojistaId: oid(lojistaId), chave: d.chave },
          update: { $set: { dados: d, carregadoEm: new Date() }, $setOnInsert: { status: 'pendente' } },
          upsert: true
        }
      };
    });
    if (ops.length) await colFornOrigem().bulkWrite(ops);
    res.json({ ok: true, fornecedores: ops.length });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Lista com a conta nova (do mapa) e se o CNPJ já está no cadastro */
router.get('/api/fornec-origem/:lojistaId', async (req, res) => {
  try {
    const loja = oid(req.params.lojistaId);
    const [itens, decisoes] = await Promise.all([
      colFornOrigem().find({ lojistaId: loja }).toArray(),
      colMapa().find({ lojistaId: loja }).toArray()
    ]);
    const porAntigo = Object.fromEntries(decisoes.map(d => [d.codigoAntigo, d]));
    const cnpjs = itens.map(i => soDigitos(i.dados.cnpj)).filter(c => c.length >= 11);
    const cadastrados = await Fornecedor.collection.find({ cnpj: { $in: cnpjs } }, { projection: { cnpj: 1, razao: 1, vinculos: 1 } }).toArray();
    const porCnpj = Object.fromEntries(cadastrados.map(f => [f.cnpj, f]));

    res.json(itens.map(i => {
      const d = porAntigo[i.dados.conta_antiga];
      const f = porCnpj[soDigitos(i.dados.cnpj)];
      const vinc = f && (f.vinculos || []).find(v => String(v.lojistaId) === String(loja));
      return {
        chave: i.chave, status: i.status, dados: i.dados,
        feitoEm: i.feitoEm, feitoPor: i.feitoPor,
        conta: d ? { acao: d.acao, codigoNovo: d.codigoNovo } : null,
        cadastro: f ? { razao: f.razao, contaLigada: vinc ? vinc.ncontabil : null } : null
      };
    }).sort((a, b) => (b.dados.lanc_2026 - a.dados.lanc_2026) || a.dados.razao.localeCompare(b.dados.razao, 'pt')));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Confirma a ficha: cadastra (ou completa) e liga à conta nova */
router.post('/api/fornec-origem/confirmar', async (req, res) => {
  try {
    const { lojistaId, chave, ficha } = req.body;
    const loja = oid(lojistaId);
    const item = await colFornOrigem().findOne({ lojistaId: loja, chave });
    if (!item) return res.status(404).json({ erro: 'Fornecedor não encontrado na lista.' });

    // A conta vem do de/para: sem decisão lá, não há onde ligar
    const decisao = await colMapa().findOne({ lojistaId: loja, codigoAntigo: item.dados.conta_antiga });
    if (!decisao) return res.status(409).json({ erro: `A conta ${item.dados.conta_antiga} ainda não foi decidida no de/para. Decida lá primeiro.` });
    if (decisao.acao === 'descartar' || !decisao.codigoNovo) {
      return res.status(409).json({ erro: 'A conta deste fornecedor foi descartada no de/para. Use Ignorar, ou desfaça o descarte lá.' });
    }
    const contaNova = decisao.codigoNovo;

    const cnpj = soDigitos(ficha.cnpj);
    if (![11, 14].includes(cnpj.length)) return res.status(400).json({ erro: 'Informe um CPF ou CNPJ válido.' });
    if (!String(ficha.razao || '').trim()) return res.status(400).json({ erro: 'Informe a razão social.' });

    const usuario = (req.user && (req.user.email || req.user.nome)) || '';
    const endereco = {
      cep: soDigitos(ficha.cep), logradouro: ficha.logradouro || '', numero: ficha.numero || '',
      complemento: ficha.complemento || '', bairro: ficha.bairro || '', cidade: ficha.cidade || '',
      estado: siglaUF(ficha.uf)
    };

    // Outra conta desta empresa já usa este CNPJ? (um vínculo por empresa)
    const outro = await Fornecedor.collection.findOne({ vinculos: { $elemMatch: { lojistaId: loja, ncontabil: contaNova } }, cnpj: { $ne: cnpj } });
    if (outro) return res.status(409).json({ erro: `A conta ${contaNova} já está ligada a ${outro.razao}.` });

    let criado = false;
    let fornecedor = await Fornecedor.collection.findOne({ cnpj });
    if (fornecedor) {
      const vinc = (fornecedor.vinculos || []).find(v => String(v.lojistaId) === String(loja));
      if (vinc && vinc.ncontabil !== contaNova) {
        return res.status(409).json({
          erro: `Este CNPJ já está ligado à conta ${vinc.ncontabil}. Uma empresa só pode ter uma conta: ` +
                `junte as duas no de/para (equivalência) e confirme de novo.`
        });
      }
      // Cadastro compartilhado: só completa o que estiver vazio, nunca sobrescreve
      const completar = {};
      const vazio = v => !v || String(v).trim() === '';
      if (vazio(fornecedor.inscricao) && ficha.inscricao) completar.inscricao = ficha.inscricao;
      if (vazio(fornecedor.marca) && ficha.marca) completar.marca = ficha.marca;
      if (vazio(fornecedor.telefone) && ficha.telefone) completar.telefone = ficha.telefone;
      if (vazio(fornecedor.email) && ficha.email) completar.email = ficha.email;
      const a = fornecedor.address || {};
      if (vazio(a.logradouro) && endereco.logradouro) completar.address = { ...a, ...endereco };
      const atualizacao = { $set: { ...completar, updateAt: new Date() } };
      if (!vinc) atualizacao.$push = { vinculos: { lojistaId: loja, ncontabil: contaNova, ativo: true } };
      await Fornecedor.collection.updateOne({ _id: fornecedor._id }, atualizacao);
    } else {
      criado = true;
      fornecedor = await Fornecedor.create({
        tipo: cnpj.length === 11 ? 'PF' : 'PJ',
        razao: String(ficha.razao).trim(),
        cnpj,
        marca: ficha.marca || '',
        inscricao: ficha.inscricao || '',
        email: ficha.email || '',
        telefone: ficha.telefone || '',
        address: endereco,
        contato: {
          comercial: { nome: ficha.contato_vendas || '', celular: ficha.fone_vendas || '' },
          representante: { nome: ficha.contato_cobranca || '', celular: ficha.fone_cobranca || '' }
        },
        vinculos: [{ lojistaId: loja, ncontabil: contaNova, ativo: true }],
        ativo: true
      });
    }

    await colFornOrigem().updateOne(
      { _id: item._id },
      { $set: { status: 'feito', fornecedorId: fornecedor._id, contaNova, feitoEm: new Date(), feitoPor: usuario } }
    );
    res.json({ ok: true, contaNova, criado });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Este CNPJ já está no cadastro.' });
    res.status(500).json({ erro: err.message });
  }
});

/* Ignorar ou reabrir. Reabrir não tira o vínculo já criado: só volta a linha para a lista. */
router.post('/api/fornec-origem/status', async (req, res) => {
  try {
    const { lojistaId, chave, status } = req.body;
    if (!['ignorado', 'pendente'].includes(status)) return res.status(400).json({ erro: 'Situação inválida.' });
    const usuario = (req.user && (req.user.email || req.user.nome)) || '';
    await colFornOrigem().updateOne(
      { lojistaId: oid(lojistaId), chave },
      { $set: { status, alteradoEm: new Date(), alteradoPor: usuario } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
