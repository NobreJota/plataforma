// src/routes/contab/financeiro/fluxo-api.js
// API da Tela do Fluxo de Caixa: lista lançamentos (projetados + futuros)
// com saldo acumulado, filtrável por mês e ano.
// Alterado em: 16/10/2026 - fica de fora o FLUXO DE SERVICO (origem 'OS': o a receber das OS),
//              que tem tela propria (Servico > Fluxo de servico).
// Alterado em: 18/10/2026 - ?ocultar=8,3,7 (sub-menu: mostrar ou nao orcamento, compras proj., pedidos).
// Alterado em: 20/10/2026 - o saldo da grade comeca do ZERO no mes (sem o saldo dos meses anteriores).
// Alterado em: 19/10/2026 - pos como no Access: 3 = Pedido feito, 7 = Compra projetada (rotulos trocados).
//              GET /pos/:pos — TODAS as linhas em aberto daquele pos (todos os anos), para a janela do pos
//              agrupar por pedido/nota e mostrar os vencimentos de cada um.
//              GET /conta/:codigo — titulos em aberto de uma conta (conferir com o saldo do razao).

const express = require('express');
const FluxoProjetado = require('../../../models/contab/financeiro/fluxoProjetado');

const router = express.Router();

// 16/10/2026: o a receber das OS (origem 'OS') e do fluxo de servico, nao do fluxo de caixa
const FORA_SERVICO = { origem: { $ne: 'OS' } };

// Significado de cada pos (para cor e rótulo)
const POS_INFO = {
  0: { rotulo: 'Avulso',       cor: 'preto'    },
  1: { rotulo: 'Cartão receber', cor: 'vermelho' },
  2: { rotulo: 'Compra pagar', cor: 'preto'    },
  3: { rotulo: 'Pedido feito', cor: 'preto'    },     // 19/10/2026: como no Access
  5: { rotulo: 'Título receber', cor: 'vermelho' },
  7: { rotulo: 'Compra projetada', cor: 'preto' },   // 19/10/2026: previsao (programacao de compras)
  8: { rotulo: 'Orçamento',    cor: 'verde'    }
};

/* 19/10/2026: GET /financeiro/api/fluxo/conta/:codigo — os titulos EM ABERTO de uma conta (cliente ou
   fornecedor), todos os anos, para conferir com o saldo do razao (janela "Razão · títulos em aberto"). */
router.get('/conta/:codigo', async (req, res) => {
  try {
    const codigo = String(req.params.codigo || '').trim();
    if (!/^\d\.\d{2}\.\d{3}\.\d{3}$/.test(codigo)) return res.status(400).json({ erro: 'código de conta inválido' });
    const itens = await FluxoProjetado.find({ codigoConta: codigo, status: 'ATIVO' }).sort({ vencimento: 1, _id: 1 }).lean();
    res.json({ codigo, linhas: itens.map(it => ({
      _id: it._id, pos: it.pos, historico: it.historico || it.nomeConta || '', vencimento: it.vencimento,
      valor: Math.abs(it.valor || 0), parcela: it.parcela || null, totalParcelas: it.totalParcelas || null, origem: it.origem || '',
    })) });
  } catch (err) {
    console.error('❌ /fluxo/conta:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 19/10/2026: GET /financeiro/api/fluxo/pos/:pos — todas as linhas EM ABERTO do pos (sem limite de data),
   para a janela do pos: agrupa por pedido / nota e abre os vencimentos de cada um. */
router.get('/pos/:pos', async (req, res) => {
  try {
    const pos = parseInt(req.params.pos, 10);
    if (!Number.isFinite(pos)) return res.status(400).json({ erro: 'pos inválido' });
    const itens = await FluxoProjetado.find({ pos, status: 'ATIVO', ...FORA_SERVICO }).sort({ vencimento: 1, _id: 1 }).lean();
    res.json({ pos, linhas: itens.map(it => ({
      _id: it._id, pos: it.pos, historico: it.historico || it.nomeConta || '', nomeConta: it.nomeConta || '',
      codigoConta: it.codigoConta || '', vencimento: it.vencimento, valor: Math.abs(it.valor || 0),
      parcela: it.parcela || null, totalParcelas: it.totalParcelas || null, origem: it.origem || '',
    })) });
  } catch (err) {
    console.error('❌ /fluxo/pos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/fluxo/:ano?mes=N
   Lista o fluxo do ano (e mês opcional) com saldo acumulado.
   Por enquanto lê do Fluxo Projetado (pos 8 do orçamento). */
router.get('/:ano', async (req, res) => {
  try {
    const ano = parseInt(req.params.ano, 10);
    const mes = req.query.mes ? parseInt(req.query.mes, 10) : null;

    // 18/10/2026: ?ocultar=8,3,7 — o sub-menu esconde orcamento / compras projetadas / pedidos
    // (o saldo e calculado sem eles)
    const ocultar = String(req.query.ocultar || '').split(',').map(Number).filter(n => [3, 7, 8].includes(n));
    const SEM = ocultar.length ? { pos: { $nin: ocultar } } : {};
    const filter = { ano, status: 'ATIVO', ...FORA_SERVICO, ...SEM };
    if (mes) filter.mes = mes;

    const itens = await FluxoProjetado.find(filter)
      .sort({ vencimento: 1, _id: 1 })
      .lean();

    /* Saldo que vem dos meses anteriores.
       Abrindo setembro, o saldo precisa continuar de agosto — começar do zero
       mostraria um número que não existe. Sem filtro de mês, começa em zero
       porque aí janeiro é mesmo o começo. */
    // 20/10/2026 (Jorge): "so entrada e saida do mes" — o saldo da grade COMECA DO ZERO no mes escolhido
    // (nao soma mais o que venceu nos meses anteriores e esta em aberto). Para voltar: SALDO_ANTERIOR = true.
    const SALDO_ANTERIOR = false;
    let saldoAnterior = 0;
    if (mes && SALDO_ANTERIOR) {
      const anteriores = await FluxoProjetado.find({
        ano, status: 'ATIVO', mes: { $lt: mes }, ...FORA_SERVICO, ...SEM
      }).select('pos valor').lean();

      for (const it of anteriores) {
        const ehEntrada = (it.pos === 5 || it.pos === 1);
        saldoAnterior += ehEntrada ? Math.abs(it.valor) : -Math.abs(it.valor);
      }
    }

    // Monta as linhas com saldo acumulado
    let saldo = saldoAnterior;
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
        saldoAnterior,
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
    const itens = await FluxoProjetado.find({ ano, status: 'ATIVO', ...FORA_SERVICO }).lean();

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
