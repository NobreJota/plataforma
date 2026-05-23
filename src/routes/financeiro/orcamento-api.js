// src/routes/financeiro/orcamento-api.js
// API do Orçamento Anual: vincular contas (geral) + montar grid (por ano).

const express = require('express');
const ContaSubTitulo = require('../../models/contaSubTitulo');
const ContaTitulo    = require('../../models/contaTitulo');
const OrcamentoConta = require('../../models/financeiro/orcamentoConta');
const OrcamentoAnual = require('../../models/financeiro/orcamentoAnual');

const router = express.Router();

/* ============================================================
   VINCULAÇÃO DE CONTAS (geral, vale para todos os anos)
   ============================================================ */

/* GET /financeiro/api/orcamento/disponiveis
   Lista subtítulos de DESPESA (código 3.x) que ainda PODEM ser vinculados,
   marcando quais já estão vinculados. */
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

    const lista = subtitulos.map(s => ({
      _id: s._id,
      codigo: s.codigo,
      nome: s.nome,
      codigoContaTitulo: s.codigoContaTitulo,
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

module.exports = router;
