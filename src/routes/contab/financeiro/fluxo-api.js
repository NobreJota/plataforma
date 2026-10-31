// Destino: C:\plataformaRota\src\routes\contab\financeiro\fluxo-api.js
// Alterado em: 31/10/2026 - ENTRADA marcada na linha (entrada: true, ex.: pos 0 "aluguel a receber" vindo do Access com
//              Deb) conta como a receber (+), em vermelho. Regra: entradaDe(linha).
// Alterado em: 23/10/2026 - POS 6 = CARTOES A RECEBER DA OPERADORA (Jorge): entra como "a receber" (+) junto
//              com o 1 e o 5. O 5 fica para o titulo a receber do cliente.
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
// Alterado em: 23/10/2026 - GET /nota/:nr?conta=2.01.001.160 — ESPELHO da nota de entrada (janela do razao):
//              cabecalho (_access_nfe_cabecalho: entrada, emissao, pedido, valor) + itens (_nfe_item_origem,
//              COMPRA-17, pela Chave da nota) + os titulos dela no fluxo.
// Alterado em: 22/10/2026 - GET /meses/:codigo?de=2026-01&n=15 — a conta MES A MES (para a aba da janela do pos):
//              o que esta em aberto no fluxo por pos (mes do vencimento) e, se a conta e de FORNECEDOR do Access,
//              o que foi COMPRADO (notas, mes da entrada) e o PREVISTO (Ped_Previsão, mes da compra) + media/maior
//              dos 3 ultimos meses fechados.

const express = require('express');
const FluxoProjetado = require('../../../models/contab/financeiro/fluxoProjetado');
const mongoose = require('mongoose');
const col = n => mongoose.connection.collection(n);

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
  6: { rotulo: 'Cartão operadora', cor: 'vermelho' },   // 23/10/2026: cartoes a receber da operadora
  7: { rotulo: 'Compra projetada', cor: 'preto' },   // 19/10/2026: previsao (programacao de compras)
  8: { rotulo: 'Orçamento',    cor: 'verde'    }
};
// 31/10/2026: entrada (+) = pos de receber (1, 5, 6) ou linha marcada entrada (ex.: pos 0 aluguel a receber)
const entradaDe = it => it.pos === 5 || it.pos === 1 || it.pos === 6 || it.entrada === true;


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

/* 22/10/2026: GET /financeiro/api/fluxo/meses/:codigo?de=2026-01&n=15 — a conta mes a mes. */
router.get('/meses/:codigo', async (req, res) => {
  try {
    const codigo = String(req.params.codigo || '').trim();
    if (!/^\d\.\d{2}\.\d{3}\.\d{3}$/.test(codigo)) return res.status(400).json({ erro: 'código de conta inválido' });
    const hoje = new Date();
    const m0 = /^(\d{4})-(\d{1,2})$/.exec(String(req.query.de || '')) || [null, hoje.getFullYear(), 1];
    const n = Math.min(24, Math.max(3, parseInt(req.query.n, 10) || 15));
    const ini = Number(m0[1]) * 12 + Number(m0[2]) - 1;                      // mes como numero
    const meses = Array.from({ length: n }, (_, i) => ({ ano: Math.floor((ini + i) / 12), mes: (ini + i) % 12 + 1 }));
    const idx = d => { const x = new Date(d); const k = x.getUTCFullYear() * 12 + x.getUTCMonth() - ini; return k >= 0 && k < n ? k : -1; };
    const zeros = () => Array(n).fill(0);
    const r2 = v => Math.round(v * 100) / 100;

    // o fluxo em aberto desta conta, por pos, no mes do vencimento
    const fluxo = {};
    for (const l of await FluxoProjetado.find({ codigoConta: codigo, status: 'ATIVO', ...FORA_SERVICO }).lean()) {
      const k = idx(l.vencimento); if (k < 0) continue;
      (fluxo[l.pos] = fluxo[l.pos] || zeros())[k] += Math.abs(l.valor || 0);
    }
    for (const p of Object.keys(fluxo)) fluxo[p] = fluxo[p].map(r2);

    // fornecedor do Access com esta conta (NrContabil 2.02 -> 2.01 na plataforma)
    let fornecedor = null, comprado = null, previsto = null, media3 = 0, maior3 = 0;
    const fs = await col('_access_compras_fornecedores').find({}).toArray();
    const f = fs.find(x => { let c = String(x.NrContabil || '').trim(); if (c.startsWith('2.02.')) c = '2.01.' + c.slice(5); return c === codigo; });
    if (f) {
      const nr = Number(f.NrFornec);
      fornecedor = { nr, marca: String(f.Marca || f['Razão'] || '').trim() };
      comprado = zeros(); previsto = zeros();
      const atual = hoje.getFullYear() * 12 + hoje.getMonth(), ult = [atual - 3, atual - 2, atual - 1].map(() => 0);
      const desde = new Date(Date.UTC(Math.floor(Math.min(ini, atual - 3) / 12), Math.min(ini, atual - 3) % 12, 1));
      for (const nf of await col('_access_nfe_cabecalho').find({ NrFornec: nr, DataEntr: { $gte: desde } }).project({ DataEntr: 1, VrNota: 1 }).toArray()) {
        const v = Number(nf.VrNota) || 0, d = new Date(nf.DataEntr), mm = d.getUTCFullYear() * 12 + d.getUTCMonth();
        const k = idx(d); if (k >= 0) comprado[k] += v;
        const u = mm - (atual - 3); if (u >= 0 && u < 3) ult[u] += v;
      }
      media3 = r2(ult.reduce((a, b) => a + b, 0) / 3); maior3 = r2(Math.max(...ult));
      for (const p of await col('_access_ped_previsao').find({ NrFornec: nr }).toArray()) {
        if (Number(p.Pos) || !p['Previsão']) continue;
        const k = idx(p['Previsão']); if (k >= 0) previsto[k] += Number(p.VTotal) || 0;
      }
      comprado = comprado.map(r2); previsto = previsto.map(r2);
    }
    res.json({ codigo, meses, fluxo, fornecedor, comprado, previsto, media3, maior3 });
  } catch (err) {
    console.error('❌ /fluxo/meses:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 23/10/2026: GET /financeiro/api/fluxo/nota/:nr?conta= — espelho da nota de entrada do fornecedor da conta. */
router.get('/nota/:nr', async (req, res) => {
  try {
    const nrTxt = String(req.params.nr || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!nrTxt) return res.status(400).json({ erro: 'número da nota?' });
    const conta = String(req.query.conta || '').trim();
    const nrs = [nrTxt, Number(nrTxt)];
    // o fornecedor do Access pela conta (NrContabil 2.02 -> 2.01)
    let nrForn = null, marca = '';
    if (conta) {
      const f = (await col('_access_compras_fornecedores').find({}).toArray())
        .find(x => { let c = String(x.NrContabil || '').trim(); if (c.startsWith('2.02.')) c = '2.01.' + c.slice(5); return c === conta; });
      if (f) { nrForn = Number(f.NrFornec); marca = String(f.Marca || f['Razão'] || '').trim(); }
    }
    const filtro = { NrNota: { $in: nrs } }; if (nrForn) filtro.NrFornec = nrForn;
    const cabs = await col('_access_nfe_cabecalho').find(filtro).sort({ DataEntr: -1 }).limit(1).toArray();
    const c = cabs[0] || null;
    // itens: pela Chave da nota (COMPRA-17); sem a chave, pelo numero
    let itens = [];
    const fi = c && c.Chave != null ? { chave: { $in: [c.Chave, String(c.Chave)] } } : { nrNota: { $in: nrs } };
    const brutos = await col('_nfe_item_origem').find(fi).toArray();
    const cods = [...new Set(brutos.map(i => Number(i.codigoProd)).filter(Boolean))];
    const nomes = new Map((cods.length ? await col('arquivo_docs').find({ codigo: { $in: cods } }).project({ codigo: 1, descricao: 1 }).toArray() : [])
      .map(p => [Number(p.codigo), p.descricao || '']));
    itens = brutos.map(i => ({
      codigo: Number(i.codigoProd) || null,
      descricao: i.descricao || i.descricaoProd || i.descricaoNota || nomes.get(Number(i.codigoProd)) || '',
      qte: Number(i.quantidade) || 0,
      unitario: (Number(i.custoUnitario) || 0) / 100,
      ipi: Number(i.ipiPerc) || 0,
      total: (Number(i.valorTotal) || 0) / 100,
    }));
    const rx = new RegExp('NF\\D{0,6}0*' + nrTxt + '(?!\\d)', 'i');
    const titulos = conta ? (await FluxoProjetado.find({ codigoConta: conta, historico: rx }).sort({ vencimento: 1 }).lean())
      .map(l => ({ vencimento: l.vencimento, valor: Math.abs(l.valor || 0), status: l.status, pos: l.pos, parcela: l.parcela || null, totalParcelas: l.totalParcelas || null })) : [];
    res.json({ nr: nrTxt, fornecedor: marca, cab: c ? {
      nota: c.NrNota, entrada: c.DataEntr || null, emissao: c['Emissão'] || c.Emissao || null, pedido: c.NrPedido || null,
      valor: Number(c.VrNota) || 0, chave: c.Chave } : null, itens, titulos });
  } catch (err) {
    console.error('❌ /fluxo/nota:', err.message);
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
        const ehEntrada = entradaDe(it);
        saldoAnterior += ehEntrada ? Math.abs(it.valor) : -Math.abs(it.valor);
      }
    }

    // Monta as linhas com saldo acumulado
    let saldo = saldoAnterior;
    let totalReceber = 0;
    let totalPagar = 0;

    const linhas = itens.map((it, i) => {
      const info = POS_INFO[it.pos] || { rotulo: '?', cor: 'preto' };
      // pos de recebimento (1, 5, 6) = entrada (+); demais = saída (-)
      const ehEntrada = entradaDe(it);
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
        cor: it.entrada === true && ![1, 5, 6].includes(it.pos) ? 'vermelho' : info.cor,   // 31/10/2026: entrada
        entrada: entradaDe(it),
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
      const ehEntrada = entradaDe(it);
      if (ehEntrada) meses[idx].receber += Math.abs(it.valor);
      else meses[idx].pagar += Math.abs(it.valor);
    });

    res.json({ ano, meses });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
