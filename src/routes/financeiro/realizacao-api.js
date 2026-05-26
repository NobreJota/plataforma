// src/routes/financeiro/realizacao-api.js
// REALIZAÇÃO de despesas administrativas: transforma projeção (pos 8) em
// despesa REAL a pagar (pos 2). Ex: Papelaria, Energia, IPTU.
// A compra de mercadoria (pos 7) NÃO passa por aqui — ela vira pos 2 só na
// Entrada de Nota Fiscal de mercadoria (módulo próprio, com estoque).

const express = require('express');
const FluxoProjetado = require('../../models/financeiro/fluxoProjetado');
const HistoricoConta = require('../../models/financeiro/historicoConta');

const router = express.Router();

/* GET /financeiro/api/realizacao/janela?data=YYYY-MM-DD&dias=2
   Lista despesas ADMINISTRATIVAS projetadas (pos 8) numa janela de dias,
   para realizar (transformar em pos 2). */
router.get('/janela', async (req, res) => {
  try {
    const { data, dias = 2 } = req.query;
    if (!data) return res.status(400).json({ erro: 'Informe a data (YYYY-MM-DD).' });

    const base = new Date(data + 'T12:00:00');
    const janela = parseInt(dias, 10) || 2;
    const ini = new Date(base); ini.setDate(ini.getDate() - janela); ini.setHours(0,0,0,0);
    const fim = new Date(base); fim.setDate(fim.getDate() + janela); fim.setHours(23,59,59,999);

    const itens = await FluxoProjetado.find({
      status: 'ATIVO',
      pos: 8,                               // só despesas administrativas projetadas
      vencimento: { $gte: ini, $lte: fim }
    }).sort({ vencimento: 1 }).lean();

    const titulos = itens.map(it => ({
      _id: it._id,
      vencimento: it.vencimento,
      historico: it.historico || it.nomeConta || '',
      nomeConta: it.nomeConta || '',
      codigoConta: it.codigoConta || '',
      contaSubTitulo: it.contaSubTitulo || null,
      valor: Math.abs(it.valor),
      parcela: it.parcela, totalParcelas: it.totalParcelas,
      noDia: new Date(it.vencimento).toDateString() === base.toDateString()
    }));

    res.json({ data, dias: janela, titulos, total: titulos.reduce((s,t)=>s+t.valor,0) });
  } catch (err) {
    console.error('❌ /realizacao/janela:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/realizacao/realizar
   Body: { itens: [{ id, valor, documento, vencimento, historico }] }
   Cada item (pos 8) é transformado em pos 2 (despesa real a pagar).
   Estratégia: marca o pos 8 como REALIZADO (não some do histórico de projeção)
   e cria um NOVO registro pos 2 a pagar. */
router.post('/realizar', async (req, res) => {
  try {
    const { itens } = req.body;
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: 'Selecione ao menos uma despesa.' });
    }

    let realizadas = 0;
    for (const item of itens) {
      const proj = await FluxoProjetado.findById(item.id);
      if (!proj || proj.status !== 'ATIVO' || proj.pos !== 8) continue;

      const valorReal = item.valor != null ? Math.abs(Number(item.valor)) : Math.abs(proj.valor);
      const venc = item.vencimento ? new Date(item.vencimento + 'T12:00:00') : proj.vencimento;
      const histReal = (item.historico || proj.historico || proj.nomeConta || '').trim();

      // Cria o lançamento REAL (pos 2) a pagar
      await FluxoProjetado.create({
        ano: venc.getFullYear(),
        mes: venc.getMonth() + 1,
        pos: 2,                                   // despesa REALIZADA a pagar
        contaSubTitulo: proj.contaSubTitulo,
        codigoConta: proj.codigoConta,
        nomeConta: proj.nomeConta,
        historico: histReal,
        valor: valorReal,
        vencimento: venc,
        parcela: proj.parcela,
        totalParcelas: proj.totalParcelas,
        origem: 'REALIZADA_CUSTEIO',
        documento: item.documento || '',
        projecaoOrigemId: proj._id,
        status: 'ATIVO'
      });

      // Marca a projeção como REALIZADA (sai do fluxo projetado ativo,
      // mas fica como memória do que foi planejado)
      proj.status = 'REALIZADA';
      proj.realizadaEm = new Date();
      await proj.save();

      // Aprende o histórico
      if (histReal) {
        try {
          await HistoricoConta.findOneAndUpdate(
            { codigoConta: proj.codigoConta || '', texto: histReal },
            { $inc: { usos: 1 }, $set: { ultimoUso: new Date() } },
            { upsert: true }
          );
        } catch (_) {}
      }
      realizadas++;
    }

    res.status(201).json({ ok: true, realizadas });
  } catch (err) {
    console.error('❌ /realizacao/realizar:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
