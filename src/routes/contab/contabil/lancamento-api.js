// src/routes/contab/contabil/lancamento-api.js
//
// GRAVAÇÃO DA BOLETA MANUAL
//
// A boleta tem uma perna única e N contrapartidas. Crédito e Débito usam a
// mesma estrutura: o que muda é o tipo, e é o tipo que o razão lê para saber
// de que lado cada valor entra.
//
//   credito → PAGAMENTO    perna única creditada, contrapartidas a débito
//   debito  → RECEBIMENTO  perna única debitada, contrapartidas a crédito
//
// A validação é refeita aqui inteira, mesmo o front já barrando: a tela pode
// ficar aberta enquanto os dados mudam, e nada impede alguém de chamar a rota
// direto.

const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Boleta         = require('../../../models/contab/financeiro/boleta');
const ContaSubTitulo = require('../../../models/contab/financeiro/contaSubTitulo');
const HistoricoConta = require('../../../models/contab/financeiro/historicoConta');

/* Centavos comparados como inteiros. Somar float direto erra: 0.1 + 0.2 dá
   0.30000000000000004, e a boleta nunca fecharia. */
const emCentavos = (v) => Math.round(Number(v || 0) * 100);

/* Guarda o histórico usado para virar sugestão da próxima vez.
   O tipo entra na chave: "recebido" só faz sentido em RECEBIMENTO, e sem essa
   separação ele apareceria como sugestão numa boleta de pagamento.
   Falha aqui não derruba a gravação: sugestão é conveniência, boleta é dado. */
async function registrarHistorico(lojistaId, conta, tipo, texto) {
  const t = String(texto || '').trim();
  if (!t) return;
  try {
    await HistoricoConta.updateOne(
      { codigoConta: conta || '', tipo, texto: t },
      {
        $inc:  { usos: 1 },
        $set:  { ultimoUso: new Date() },
        $setOnInsert: { lojistaId: lojistaId || null }
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('histórico não registrado:', err.message);
  }
}

/* =========================================================
   GET /contab/api/historicos?conta=CODIGO&tipo=PAGAMENTO&termo=texto
   Sugestões da conta, da mesma natureza, mais usadas primeiro.
   ========================================================= */
router.get('/historicos', async (req, res) => {
  try {
    const { conta = '', tipo = '', termo = '' } = req.query;

    const filtro = {};
    if (tipo) filtro.tipo = tipo;

    // Históricos da conta específica e os gerais (gravados sem conta).
    if (conta) filtro.$or = [{ codigoConta: conta }, { codigoConta: '' }];

    const t = String(termo).trim();
    if (t) {
      // Escapa o que o usuário digitou: um parêntese solto quebraria a regex.
      filtro.texto = { $regex: t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const lista = await HistoricoConta.find(filtro)
      .sort({ usos: -1, ultimoUso: -1 })
      .limit(5)
      .lean();

    res.json(lista.map(h => h.texto));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   POST /contab/api/lancamento
   ========================================================= */
router.post('/lancamento', async (req, res) => {
  try {
    const {
      modo = 'credito',
      data,
      contaId,
      historico = '',
      valor,
      contrapartidas = []
    } = req.body;

    /* ---------- data ---------- */
    if (!data) return res.status(400).json({ erro: 'Informe a data.' });
    // Meio-dia evita o vaivém de fuso que joga o lançamento para o dia anterior.
    const dataBoleta = new Date(`${data}T12:00:00`);
    if (isNaN(dataBoleta)) return res.status(400).json({ erro: 'Data inválida.' });

    /* ---------- perna única ---------- */
    if (!contaId) return res.status(400).json({ erro: 'Escolha a conta do lançamento.' });
    if (!mongoose.isValidObjectId(contaId)) {
      return res.status(400).json({ erro: 'Conta inválida.' });
    }

    const conta = await ContaSubTitulo.findById(contaId).lean();
    if (!conta)       return res.status(404).json({ erro: 'Conta não encontrada.' });
    if (!conta.ativo) return res.status(409).json({ erro: `A conta ${conta.codigo} está suspensa.` });

    const totalCent = emCentavos(valor);
    if (totalCent <= 0) return res.status(400).json({ erro: 'O valor deve ser maior que zero.' });

    /* ---------- contrapartidas ---------- */
    const linhas = (contrapartidas || []).filter(c => emCentavos(c.valor) > 0);
    if (!linhas.length) {
      return res.status(400).json({ erro: 'Informe ao menos uma contrapartida.' });
    }

    // Uma consulta só para todas as contas, em vez de uma por linha.
    const ids = linhas.map(c => c.contaId);
    if (ids.some(id => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ erro: 'Há contrapartida sem conta escolhida.' });
    }
    const contas = await ContaSubTitulo.find({ _id: { $in: ids } }).lean();
    const porId = new Map(contas.map(c => [String(c._id), c]));

    const montadas = [];
    let somaCent = 0;

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      const c = porId.get(String(l.contaId));
      if (!c)       return res.status(404).json({ erro: 'Contrapartida com conta inexistente.' });
      if (!c.ativo) return res.status(409).json({ erro: `A conta ${c.codigo} está suspensa.` });

      const vCent = emCentavos(l.valor);
      somaCent += vCent;

      montadas.push({
        contaSubTitulo: c._id,
        codigoConta:    c.codigo,
        nomeConta:      c.nome,
        historico:      String(l.historico || '').trim(),
        valor:          vCent / 100,
        pos:            i + 1
      });
    }

    if (somaCent !== totalCent) {
      return res.status(409).json({
        erro: `As contrapartidas somam ${(somaCent/100).toFixed(2)} e o valor é ${(totalCent/100).toFixed(2)}. Os dois lados precisam bater.`
      });
    }

    /* ---------- grava ---------- */
    const lojistaId = req.lojistaId || null;

    const tipoBoleta = modo === 'debito' ? 'RECEBIMENTO' : 'PAGAMENTO';

    const boleta = await Boleta.create({
      codigo:         `BOL-${Date.now()}`,
      tipo:           tipoBoleta,
      data:           dataBoleta,
      bancoSubTitulo: conta._id,
      bancoCodigo:    conta.codigo,
      bancoNome:      conta.nome,
      valorTotal:     totalCent / 100,
      contrapartidas: montadas,
      historico:      String(historico || '').trim(),
      origem:         'MANUAL',
      status:         'ATIVO',
      lojistaId
    });

    // Depois de gravado: alimenta as sugestões de histórico.
    await registrarHistorico(lojistaId, conta.codigo, tipoBoleta, historico);
    for (const m of montadas) {
      await registrarHistorico(lojistaId, m.codigoConta, tipoBoleta, m.historico);
    }

    res.status(201).json({
      ok: true,
      boletaId: boleta._id,
      codigo:   boleta.codigo
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: 'Código de boleta repetido. Tente gravar de novo.' });
    }
    console.error('❌ POST /contab/api/lancamento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
