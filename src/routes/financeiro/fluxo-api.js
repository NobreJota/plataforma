// src/routes/financeiro/fluxo-api.js
// API da Tela do Fluxo de Caixa: lista lançamentos (projetados + futuros)
// com saldo acumulado, filtrável por mês e ano.

const express = require('express');
const FluxoProjetado = require('../../models/financeiro/fluxoProjetado');

const router = express.Router();

// Significado de cada pos (para cor e rótulo)
const POS_INFO = {
  0: { rotulo: 'Avulso',       cor: 'preto'    },
  1: { rotulo: 'Cartão receber', cor: 'vermelho' },
  2: { rotulo: 'Compra pagar', cor: 'preto'    },
  3: { rotulo: 'Compra futura', cor: 'preto'   },
  5: { rotulo: 'Título receber', cor: 'vermelho' },
  7: { rotulo: 'Proj. compra', cor: 'preto'    },
  8: { rotulo: 'Orçamento',    cor: 'verde'    }
};

/* GET /financeiro/api/fluxo/:ano?mes=N
   Lista o fluxo do ano (e mês opcional) com saldo acumulado.
   Por enquanto lê do Fluxo Projetado (pos 8 do orçamento). */
router.get('/:ano', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const mes = req.query.mes ? parseInt(req.query.mes, 10) : null;

    const filter = { ano, status: 'ATIVO' };
    if (mes) filter.mes = mes;

    const itens = await FluxoProjetado.find(filter)
      .sort({ vencimento: 1, _id: 1 })
      .lean();

    // Monta as linhas com saldo acumulado
    let saldo = 0;
    let totalReceber = 0;
    let totalPagar = 0;

    const linhas = itens.map((it, i) => {
      const info = POS_INFO[it.pos] || { rotulo: '?', cor: 'preto' };
      // pos de recebimento (1,5) = entrada (+); demais = saída (-)
      const ehEntrada = (it.pos === 5 || it.pos === 1);
      const aReceber = ehEntrada ? Math.abs(it.valor) : 0;
      const aPagar   = ehEntrada ? 0 : -Math.abs(it.valor);

      saldo += aReceber + aPagar;
      totalReceber += aReceber;
      totalPagar += aPagar;

      return {
        item: i + 1,
        _id: it._id,
        chave: it.parcela ? `${it.parcela}/${it.totalParcelas}` : '',
        historico: it.historico || it.nomeConta || '',
        nomeConta: it.nomeConta || '',
        codigoConta: it.codigoConta || '',
        pos: it.pos,
        posRotulo: info.rotulo,
        cor: info.cor,
        vencimento: it.vencimento,
        aReceber,
        aPagar,
        saldo
      };
    });

    res.json({
      ano, mes,
      linhas,
      resumo: {
        totalReceber,
        totalPagar,
        saldoFinal: saldo,
        quantidade: linhas.length
      }
    });
  } catch (err) {
    console.error('❌ /fluxo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/fluxo/:ano/resumo-mensal
   Totais por mês (para visão anual rápida). */
router.get('/:ano/resumo-mensal', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const itens = await FluxoProjetado.find({ ano, status: 'ATIVO' }).lean();

    const meses = Array.from({ length: 12 }, () => ({ receber: 0, pagar: 0 }));
    itens.forEach(it => {
      const idx = it.mes - 1;
      const ehEntrada = (it.pos === 5 || it.pos === 1);
      if (ehEntrada) meses[idx].receber += Math.abs(it.valor);
      else meses[idx].pagar += Math.abs(it.valor);
    });

    res.json({ ano, meses });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
