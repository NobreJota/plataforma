// src/routes/contab/contabil/saldo-api.js
//
// SALDO TRANSFERIDO
//
// O saldo que uma conta traz do exercício anterior — quando a empresa entra na
// plataforma, ou quando a conta abre no meio do ano.
//
// Grava como BOLETA de tipo SALDO_TRANSFERIDO. É uma boleta de perna única:
// não tem contrapartida, porque não houve troca com ninguém. Fica junto das
// outras boletas de propósito: assim o razão a encontra pela mesma busca de
// sempre (código da conta + período), sem tratamento especial na tela.
//
// A conta vai no campo do "banco" da boleta porque é ali que mora a perna
// única de qualquer boleta. O nome do campo é herança de pagamento e
// recebimento; aqui ele guarda a própria conta que recebeu o saldo.
//
// Só Ativo (1) e Passivo (2) entram. Despesa e Receita zeram na virada do
// ano — não há saldo a transportar, e listá-las só daria chance de erro.
//
// O valor é assinado: + aumenta o saldo da conta, − diminui.

const express = require('express');
const router  = express.Router();

const Boleta         = require('../../../models/contab/financeiro/boleta');
const ContaSubTitulo = require('../../../models/contab/financeiro/contaSubTitulo');

const HISTORICO = 'SALDO TRANSFERIDO';

/* Código da boleta no mesmo padrão das outras: BOL- + timestamp. */
function novoCodigo() {
  return `BOL-${Date.now()}`;
}

/* =========================================================
   GET /contab/api/saldo-transferido?ano=2026
   Lista as contas analíticas com o saldo já lançado (se houver).
   É o que a tela precisa para montar a grade de digitação.
   ========================================================= */
router.get('/saldo-transferido', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();

    // ^1\. ou ^2\. = Ativo ou Passivo. O código carrega o grupo no primeiro
    // dígito, então dá para filtrar sem carregar a hierarquia inteira.
    const contas = await ContaSubTitulo
      .find({ ativo: true, codigo: /^[12]\./ })
      .sort({ codigo: 1 })
      .lean();

    const saldos = await Boleta
      .find({ tipo: 'SALDO_TRANSFERIDO', status: 'ATIVO', ano })
      .lean();

    // Indexa por código para casar em uma passada só, em vez de varrer a
    // lista de saldos uma vez por conta.
    const porCodigo = new Map();
    for (const s of saldos) porCodigo.set(s.bancoCodigo, s);

    const linhas = contas.map(c => {
      const s = porCodigo.get(c.codigo);
      return {
        contaSubTituloId: c._id,
        codigo:   c.codigo,
        nome:     c.nome,
        grupo:    c.codigo.charAt(0) === '2' ? 'Passivo' : 'Ativo',
        valor:    s ? s.valorTotal : 0,
        data:     s ? s.data : null,
        boletaId: s ? s._id : null
      };
    });

    // Num balanço de abertura os dois lados têm que se anular: a soma de tudo
    // com sinal deve dar zero. O que sobrar é lucro ou prejuízo acumulado que
    // ainda não foi lançado na conta certa.
    let somaPositivos = 0, somaNegativos = 0;
    for (const l of linhas) {
      if (l.valor > 0) somaPositivos += l.valor;
      if (l.valor < 0) somaNegativos += l.valor;
    }

    res.json({
      ano,
      linhas,
      somaPositivos,
      somaNegativos,
      diferenca: somaPositivos + somaNegativos
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   PUT /contab/api/saldo-transferido
   body: { contaSubTituloId, ano, valor, data? }

   Um saldo por conta por ano. Reenviar a mesma conta atualiza o valor em vez
   de criar uma segunda boleta — senão o razão somaria as duas.
   Valor zero apaga o lançamento: é assim que o usuário corrige um saldo
   digitado por engano.
   ========================================================= */
router.put('/saldo-transferido', async (req, res) => {
  try {
    const { contaSubTituloId, ano, valor, data } = req.body;

    const anoNum = parseInt(ano, 10);
    if (!contaSubTituloId || !anoNum) {
      return res.status(400).json({ erro: 'Conta e ano são obrigatórios.' });
    }

    // Negativo é válido e esperado: é assim que o Passivo entra.
    const valorNum = Number(valor) || 0;

    const conta = await ContaSubTitulo.findById(contaSubTituloId).lean();
    if (!conta) return res.status(404).json({ erro: 'Conta não encontrada.' });

    if (!/^[12]\./.test(conta.codigo)) {
      return res.status(400).json({
        erro: 'Saldo transferido só vale para Ativo e Passivo. Despesa e Receita zeram na virada do ano.'
      });
    }

    const existente = await Boleta.findOne({
      tipo: 'SALDO_TRANSFERIDO',
      status: 'ATIVO',
      ano: anoNum,
      bancoCodigo: conta.codigo
    });

    // Zero significa "não tem saldo": remove o lançamento se existir.
    if (valorNum === 0) {
      if (existente) await Boleta.deleteOne({ _id: existente._id });
      return res.json({ ok: true, removido: true });
    }

    // Padrão: 1º de janeiro do ano. A tela pode mandar outra data para o caso
    // da conta que abre no meio do exercício.
    const dataFinal = data ? new Date(data + 'T12:00:00') : new Date(anoNum, 0, 1, 12, 0, 0);

    if (existente) {
      existente.valorTotal = valorNum;
      existente.data       = dataFinal;
      existente.mes        = dataFinal.getMonth() + 1;
      existente.bancoNome  = conta.nome;
      await existente.save();
      return res.json({ ok: true, boletaId: existente._id, atualizado: true });
    }

    const nova = await Boleta.create({
      codigo:         novoCodigo(),
      tipo:           'SALDO_TRANSFERIDO',
      data:           dataFinal,
      bancoSubTitulo: conta._id,
      bancoCodigo:    conta.codigo,
      bancoNome:      conta.nome,
      valorTotal:     valorNum,
      contrapartidas: [],              // perna única, de propósito
      historico:      HISTORICO,
      mes:            dataFinal.getMonth() + 1,
      ano:            anoNum,
      origem:         'SALDO',
      status:         'ATIVO'
    });

    res.status(201).json({ ok: true, boletaId: nova._id, criado: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: 'Já existe uma boleta com esse código. Tente de novo.' });
    }
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
