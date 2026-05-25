// src/routes/financeiro/orcamento-api.js
// API do Orçamento Anual: vincular contas (geral) + montar grid (por ano).

const express = require('express');
const ContaSubTitulo = require('../../models/contaSubTitulo');
const ContaTitulo    = require('../../models/contaTitulo');
const OrcamentoConta = require('../../models/financeiro/orcamentoConta');
const OrcamentoAnual = require('../../models/financeiro/orcamentoAnual');
const FluxoProjetado = require('../../models/financeiro/fluxoProjetado');

const router = express.Router();

/* ============================================================
   VINCULAÇÃO DE CONTAS (geral, vale para todos os anos)
   ============================================================ */

/* GET /financeiro/api/orcamento/disponiveis
   Lista subtítulos de DESPESA (código 3.x) que ainda PODEM ser vinculados,
   marcando quais já estão vinculados. Inclui o nome do ContaTítulo pai. */
router.get('/disponiveis', async (req, res) => {
  try {
    // Subtítulos de despesa (código começa com "3.") e ativos
    const subtitulos = await ContaSubTitulo.find({
      codigo: /^3\./,
      ativo: true
    }).sort({ codigo: 1 }).lean();

    // Já vinculados
    const vinculadas = await OrcamentoConta.find({}).lean();
    const setVinc = new Set(vinculadas.map(v => String(v.contaSubTitulo)));

    // Mapa de nomes dos ContaTítulo de despesa (código → nome)
    const titulos = await ContaTitulo.find({ codigo: /^3\./ }, 'codigo nome').lean();
    const nomeTitulo = {};
    titulos.forEach(t => { nomeTitulo[t.codigo] = t.nome; });

    const lista = subtitulos.map(s => ({
      _id: s._id,
      codigo: s.codigo,
      nome: s.nome,
      codigoContaTitulo: s.codigoContaTitulo,
      nomeContaTitulo: nomeTitulo[s.codigoContaTitulo] || s.codigoContaTitulo,
      vinculada: setVinc.has(String(s._id)),
      ativa: setVinc.has(String(s._id))
        ? (vinculadas.find(v => String(v.contaSubTitulo) === String(s._id))?.ativo ?? true)
        : false
    }));

    res.json(lista);
  } catch (err) {
    console.error('❌ /disponiveis:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/orcamento/vinculadas
   Lista as contas já vinculadas ao orçamento (com status ativo). */
router.get('/vinculadas', async (req, res) => {
  try {
    const incluirInativas = req.query.incluirInativas === 'true';
    const filter = incluirInativas ? {} : { ativo: true };
    const lista = await OrcamentoConta.find(filter).sort({ codigo: 1 }).lean();
    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/orcamento/vincular
   Body: { subtituloIds: [...] }  → vincula os subtítulos selecionados.
   Mantém os que já existiam; adiciona os novos. */
router.post('/vincular', async (req, res) => {
  try {
    const { subtituloIds } = req.body;
    if (!Array.isArray(subtituloIds)) {
      return res.status(400).json({ erro: 'subtituloIds deve ser um array.' });
    }

    let adicionadas = 0;
    for (const id of subtituloIds) {
      const jaExiste = await OrcamentoConta.findOne({ contaSubTitulo: id });
      if (jaExiste) {
        // se estava inativa, reativa
        if (!jaExiste.ativo) { jaExiste.ativo = true; await jaExiste.save(); }
        continue;
      }
      // Busca dados do subtítulo + título pai
      const sub = await ContaSubTitulo.findById(id).lean();
      if (!sub) continue;
      const titulo = await ContaTitulo.findOne({ codigo: sub.codigoContaTitulo }).lean();

      await OrcamentoConta.create({
        contaSubTitulo: sub._id,
        codigo: sub.codigo,
        nome: sub.nome,
        codigoContaTitulo: sub.codigoContaTitulo,
        nomeContaTitulo: titulo?.nome || '',
        ativo: true
      });
      adicionadas++;
    }

    res.json({ ok: true, adicionadas });
  } catch (err) {
    console.error('❌ /vincular:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/orcamento/conta/:id/toggle
   Ativa/desativa uma conta vinculada (ex: financiamento que acabou). */
router.post('/conta/:id/toggle', async (req, res) => {
  try {
    const conta = await OrcamentoConta.findById(req.params.id);
    if (!conta) return res.status(404).json({ erro: 'Conta vinculada não encontrada.' });
    conta.ativo = !conta.ativo;
    await conta.save();
    res.json({ ok: true, ativo: conta.ativo });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ============================================================
   GRID DO ORÇAMENTO (valores por ano)
   ============================================================ */

/* GET /financeiro/api/orcamento/grid/:ano
   Monta o grid: contas vinculadas (ativas) agrupadas por ContaTítulo,
   com os valores de cada mês do ano. */
router.get('/grid/:ano', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    if (!ano || ano < 2000 || ano > 2100) {
      return res.status(400).json({ erro: 'Ano inválido.' });
    }

    // Contas vinculadas ativas
    const contas = await OrcamentoConta.find({ ativo: true }).sort({ codigo: 1 }).lean();

    // Valores do ano (se já existir orçamento)
    const orcamento = await OrcamentoAnual.findOne({ ano }).lean();
    const valoresPorConta = {};
    if (orcamento?.contas) {
      orcamento.contas.forEach(c => {
        valoresPorConta[String(c.orcamentoConta)] = c.meses || Array(12).fill(0);
      });
    }

    // Agrupa por ContaTítulo (cabeçalho azul)
    const gruposMap = {};
    for (const c of contas) {
      const chave = c.codigoContaTitulo;
      if (!gruposMap[chave]) {
        gruposMap[chave] = {
          codigo: c.codigoContaTitulo,
          nome: c.nomeContaTitulo || c.codigoContaTitulo,
          contas: []
        };
      }
      gruposMap[chave].contas.push({
        orcamentoContaId: c._id,
        subTituloId: c.contaSubTitulo,
        codigo: c.codigo,
        nome: c.nome,
        meses: valoresPorConta[String(c._id)] || Array(12).fill(0)
      });
    }

    // Ordena grupos por código
    const grupos = Object.values(gruposMap).sort((a, b) => a.codigo.localeCompare(b.codigo));

    res.json({ ano, grupos });
  } catch (err) {
    console.error('❌ /grid:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/orcamento/anos
   Lista os anos que já têm orçamento (para o combo). */
router.get('/anos', async (req, res) => {
  try {
    const docs = await OrcamentoAnual.find({}, 'ano').sort({ ano: -1 }).lean();
    const anos = docs.map(d => d.ano);
    // Garante o ano atual na lista
    const atual = new Date().getFullYear();
    if (!anos.includes(atual)) anos.unshift(atual);
    res.json(anos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ============================================================
   LANÇAMENTOS (parcelas) de uma conta no ano
   ============================================================ */

/* Helper: calcula as parcelas a partir do modo (parcela/total) */
function calcularParcelas({ valor, numParcelas, modo }) {
  numParcelas = Math.max(1, parseInt(numParcelas, 10) || 1);
  valor = Number(valor) || 0;
  const parcelas = [];

  if (modo === 'total') {
    // Divide o total; ajusta centavos na última
    const base = Math.floor((valor / numParcelas) * 100) / 100;
    let acumulado = 0;
    for (let i = 0; i < numParcelas; i++) {
      let v = base;
      if (i === numParcelas - 1) v = Math.round((valor - acumulado) * 100) / 100; // última ajusta
      acumulado += base;
      parcelas.push(v);
    }
  } else {
    // Por parcela: cada uma = valor cheio
    for (let i = 0; i < numParcelas; i++) parcelas.push(valor);
  }
  return parcelas;
}

/* GET /financeiro/api/orcamento/lancamentos/:ano/:orcamentoContaId
   Lista os lançamentos de uma conta naquele ano. */
router.get('/lancamentos/:ano/:contaId', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const orc = await OrcamentoAnual.findOne({ ano }).lean();
    if (!orc) return res.json({ lancamentos: [], meses: Array(12).fill(0) });

    const conta = (orc.contas || []).find(c => String(c.orcamentoConta) === String(req.params.contaId));
    if (!conta) return res.json({ lancamentos: [], meses: Array(12).fill(0) });

    res.json({
      lancamentos: conta.lancamentos || [],
      meses: conta.meses || Array(12).fill(0)
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/orcamento/lancamento
   Body: { ano, orcamentoContaId, historico, valor, numParcelas, modo, mesInicial, diaVencimento }
   Cria um lançamento, distribui nos meses e gera parcelas no Fluxo Projetado. */
router.post('/lancamento', async (req, res) => {
  try {
    const {
      ano, orcamentoContaId, historico,
      valor, numParcelas, modo, mesInicial, diaVencimento
    } = req.body;

    if (!ano || !orcamentoContaId) {
      return res.status(400).json({ erro: 'Ano e conta são obrigatórios.' });
    }
    const nParc = Math.max(1, parseInt(numParcelas, 10) || 1);
    const mesIni = Math.min(12, Math.max(1, parseInt(mesInicial, 10) || 1));
    const dia = Math.min(31, Math.max(1, parseInt(diaVencimento, 10) || 10));

    // Dados da conta vinculada
    const oc = await OrcamentoConta.findById(orcamentoContaId).lean();
    if (!oc) return res.status(404).json({ erro: 'Conta vinculada não encontrada.' });

    // Calcula valores das parcelas
    const valoresParcelas = calcularParcelas({ valor, numParcelas: nParc, modo });

    // Acha/cria o orçamento do ano
    let orc = await OrcamentoAnual.findOne({ ano });
    if (!orc) orc = await OrcamentoAnual.create({ ano, contas: [] });

    // Acha/cria a conta dentro do orçamento
    let conta = orc.contas.find(c => String(c.orcamentoConta) === String(orcamentoContaId));
    if (!conta) {
      orc.contas.push({
        orcamentoConta: orcamentoContaId,
        codigo: oc.codigo,
        nome: oc.nome,
        meses: Array(12).fill(0),
        lancamentos: []
      });
      conta = orc.contas[orc.contas.length - 1];
    }

    // Distribui as parcelas nos meses (a partir de mesInicial, dando a volta no ano)
    const mesesAfetados = [];
    for (let i = 0; i < nParc; i++) {
      const mesIndex = (mesIni - 1 + i) % 12; // 0..11, dá a volta
      conta.meses[mesIndex] = (conta.meses[mesIndex] || 0) + valoresParcelas[i];
      mesesAfetados.push(mesIndex + 1);
    }

    // Registra o lançamento
    conta.lancamentos.push({
      historico: historico || oc.nome,
      valor: Number(valor) || 0,
      numParcelas: nParc,
      mesInicial: mesIni,
      diaVencimento: dia,
      mesesAfetados
    });

    await orc.save();
    const lancamentoSalvo = conta.lancamentos[conta.lancamentos.length - 1];

    // Gera linhas no Fluxo Projetado (pos 8)
    const docsFluxo = [];
    for (let i = 0; i < nParc; i++) {
      const mesIndex = (mesIni - 1 + i) % 12;
      const anoParcela = ano + Math.floor((mesIni - 1 + i) / 12); // vira o ano se passar dez
      docsFluxo.push({
        ano: anoParcela,
        mes: mesIndex + 1,
        pos: 8,
        contaSubTitulo: oc.contaSubTitulo,
        codigoConta: oc.codigo,
        nomeConta: oc.nome,
        historico: historico || oc.nome,
        valor: valoresParcelas[i],
        vencimento: new Date(anoParcela, mesIndex, dia),
        parcela: i + 1,
        totalParcelas: nParc,
        origem: 'ORCAMENTO',
        orcamentoAno: ano,
        lancamentoId: lancamentoSalvo._id
      });
    }
    await FluxoProjetado.insertMany(docsFluxo);

    res.status(201).json({
      ok: true,
      lancamentoId: lancamentoSalvo._id,
      meses: conta.meses,
      parcelasGeradas: docsFluxo.length
    });
  } catch (err) {
    console.error('❌ /lancamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* DELETE /financeiro/api/orcamento/lancamento/:ano/:contaId/:lancamentoId
   Remove um lançamento, subtrai dos meses e apaga as parcelas do Fluxo Projetado. */
router.delete('/lancamento/:ano/:contaId/:lancamentoId', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const { contaId, lancamentoId } = req.params;

    const orc = await OrcamentoAnual.findOne({ ano });
    if (!orc) return res.status(404).json({ erro: 'Orçamento não encontrado.' });

    const conta = orc.contas.find(c => String(c.orcamentoConta) === String(contaId));
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada no orçamento.' });

    const lanc = conta.lancamentos.id(lancamentoId);
    if (!lanc) return res.status(404).json({ erro: 'Lançamento não encontrado.' });

    // Subtrai dos meses (recalcula a partir do Fluxo Projetado deste lançamento)
    const parcelas = await FluxoProjetado.find({ lancamentoId }).lean();
    parcelas.forEach(p => {
      const idx = p.mes - 1;
      conta.meses[idx] = Math.max(0, (conta.meses[idx] || 0) - p.valor);
    });

    // Remove o lançamento e as parcelas
    conta.lancamentos.pull(lancamentoId);
    await orc.save();
    await FluxoProjetado.deleteMany({ lancamentoId });

    res.json({ ok: true, meses: conta.meses });
  } catch (err) {
    console.error('❌ delete lancamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* PUT /financeiro/api/orcamento/lancamento/:ano/:contaId/:lancamentoId
   Edita um lançamento: remove as parcelas antigas (sem lixo) e gera as novas. */
router.put('/lancamento/:ano/:contaId/:lancamentoId', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const { contaId, lancamentoId } = req.params;
    const { historico, valor, numParcelas, modo, mesInicial, diaVencimento } = req.body;

    const nParc = Math.max(1, parseInt(numParcelas, 10) || 1);
    const mesIni = Math.min(12, Math.max(1, parseInt(mesInicial, 10) || 1));
    const dia = Math.min(31, Math.max(1, parseInt(diaVencimento, 10) || 10));

    const orc = await OrcamentoAnual.findOne({ ano });
    if (!orc) return res.status(404).json({ erro: 'Orçamento não encontrado.' });

    const conta = orc.contas.find(c => String(c.orcamentoConta) === String(contaId));
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' });

    const lanc = conta.lancamentos.id(lancamentoId);
    if (!lanc) return res.status(404).json({ erro: 'Lançamento não encontrado.' });

    const oc = await OrcamentoConta.findById(contaId).lean();

    // 1. Subtrai os valores ANTIGOS dos meses (a partir das parcelas antigas)
    const parcelasAntigas = await FluxoProjetado.find({ lancamentoId }).lean();
    parcelasAntigas.forEach(p => {
      const idx = p.mes - 1;
      conta.meses[idx] = Math.max(0, (conta.meses[idx] || 0) - p.valor);
    });

    // 2. Remove as parcelas antigas do Fluxo Projetado (LIMPA o lixo)
    await FluxoProjetado.deleteMany({ lancamentoId });

    // 3. Calcula as novas parcelas
    const valoresParcelas = calcularParcelas({ valor, numParcelas: nParc, modo });

    // 4. Atualiza o lançamento
    const mesesAfetados = [];
    for (let i = 0; i < nParc; i++) {
      const mesIndex = (mesIni - 1 + i) % 12;
      conta.meses[mesIndex] = (conta.meses[mesIndex] || 0) + valoresParcelas[i];
      mesesAfetados.push(mesIndex + 1);
    }
    lanc.historico = historico || (oc ? oc.nome : lanc.historico);
    lanc.valor = Number(valor) || 0;
    lanc.numParcelas = nParc;
    lanc.mesInicial = mesIni;
    lanc.diaVencimento = dia;
    lanc.mesesAfetados = mesesAfetados;

    await orc.save();

    // 5. Gera as novas parcelas no Fluxo Projetado (mesmo lancamentoId)
    const docsFluxo = [];
    for (let i = 0; i < nParc; i++) {
      const mesIndex = (mesIni - 1 + i) % 12;
      const anoParcela = ano + Math.floor((mesIni - 1 + i) / 12);
      docsFluxo.push({
        ano: anoParcela,
        mes: mesIndex + 1,
        pos: 8,
        contaSubTitulo: oc ? oc.contaSubTitulo : null,
        codigoConta: oc ? oc.codigo : conta.codigo,
        nomeConta: oc ? oc.nome : conta.nome,
        historico: lanc.historico,
        valor: valoresParcelas[i],
        vencimento: new Date(anoParcela, mesIndex, dia),
        parcela: i + 1,
        totalParcelas: nParc,
        origem: 'ORCAMENTO',
        orcamentoAno: ano,
        lancamentoId: lanc._id
      });
    }
    await FluxoProjetado.insertMany(docsFluxo);

    res.json({ ok: true, meses: conta.meses, parcelasGeradas: docsFluxo.length });
  } catch (err) {
    console.error('❌ PUT lancamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
