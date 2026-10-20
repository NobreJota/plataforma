// =============================================================================
// Destino: C:\plataformaRota\src\routes\compra\programacao.js
// Criado em: 20/10/2026 — PROGRAMACAO DE COMPRAS (como a tela do Access, para o administrador)
//
// Montar no server.js, logo abaixo da linha do pedido-api (com o mesmo ensureContab):
//   app.use('/compra/programacao', ensureContab, require('./src/routes/compra/programacao'));
//
// TELA  GET /compra/programacao
// API   GET /compra/programacao/api/grade?ano=2026
//         a GRADE fornecedor x mes: soma das notas de entrada (NFE_Cabeçalho.VrNota) por fornecedor (NrFornec)
//         e mes da DataEntr — a mesma conta do Access (Program_Compras). Fonte: _access_nfe_cabecalho (PROG-2,
//         2025 em diante) e o nome: _access_compras_fornecedores.Marca.
//       GET /compra/programacao/api/realizacao?ano=2026&mes=10
//         as notas que ENTRARAM no mes (data de entrada, nota, fornecedor, valor, saldo acumulado).
//       GET /compra/programacao/api/fornecedor?nr=&ano=  (20/10/2026) resumo de UM fornecedor: comprado no ano,
//         media mensal, ano anterior, pedidos e compras projetadas ainda no ano
//       GET /compra/programacao/api/pedidos
//         esquerda: PEDIDOS FEITOS aguardando chegar (fluxo pos 3, por pedido); direita: COMPRAS PROJETADAS
//         (as previsoes: 997 Komlog...). 20/10/2026: previsoes da tabela Ped_Previsão do Access (espelho PROG-2).
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const col = n => mongoose.connection.collection(n);
const ano0 = a => new Date(Date.UTC(a, 0, 1)), ano1 = a => new Date(Date.UTC(a + 1, 0, 1));

// nome de cada fornecedor do Access (NrFornec -> Marca / Razao / ativo)
async function fornecedores() {
  const m = new Map();
  for (const f of await col('_access_compras_fornecedores').find({}).toArray()) {
    m.set(Number(f.NrFornec), { marca: String(f.Marca || f['Razão'] || '').trim(), razao: String(f['Razão'] || '').trim(),
      ativo: f.Ativado !== false && f.Ativado !== 0, conta: String(f.NrContabil || '').trim() });
  }
  return m;
}

router.get('/', (req, res) => {
  res.render('compra/pages/programacao', { layout: false, activeMenu: 'compra' });
});

router.get('/api/grade', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const forn = await fornecedores();
    const ag = await col('_access_nfe_cabecalho').aggregate([
      { $match: { DataEntr: { $gte: ano0(ano), $lt: ano1(ano) } } },
      // 20/10/2026: o Access grava o valor (moeda) como TEXTO ("183.0000"): converte antes de somar
      { $group: { _id: { f: '$NrFornec', m: { $month: '$DataEntr' } }, v: { $sum: { $convert: { input: '$VrNota', to: 'double', onError: 0, onNull: 0 } } }, n: { $sum: 1 } } },
    ]).toArray();
    const porF = new Map();
    for (const g of ag) {
      const nf = Number(g._id.f);
      if (!porF.has(nf)) porF.set(nf, { nrFornec: nf, meses: Array(12).fill(0), notas: 0 });
      const x = porF.get(nf); x.meses[g._id.m - 1] += Math.round(g.v * 100) / 100; x.notas += g.n;
    }
    // todos os fornecedores ativos (com zero onde nao comprou) + os que tiveram nota no ano
    for (const [nf, f] of forn) if (f.ativo && !porF.has(nf)) porF.set(nf, { nrFornec: nf, meses: Array(12).fill(0), notas: 0 });
    const linhas = [...porF.values()].map(x => {
      const f = forn.get(x.nrFornec) || {};
      return { ...x, marca: f.marca || ('fornecedor ' + x.nrFornec), ativo: f.ativo !== false,
        total: Math.round(x.meses.reduce((a, b) => a + b, 0) * 100) / 100 };
    }).sort((a, b) => a.marca.localeCompare(b.marca, 'pt-BR'));
    const anos = (await col('_access_nfe_cabecalho').aggregate([{ $group: { _id: { $year: '$DataEntr' } } }]).toArray())
      .map(a => a._id).filter(Boolean).sort();
    res.json({ ano, anos, linhas });
  } catch (err) {
    console.error('❌ /compra/programacao/api/grade:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/api/realizacao', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    const mes = parseInt(req.query.mes, 10) || (new Date().getMonth() + 1);
    const ini = new Date(Date.UTC(ano, mes - 1, 1)), fim = new Date(Date.UTC(ano, mes, 1));
    const forn = await fornecedores();
    const notas = await col('_access_nfe_cabecalho').find({ DataEntr: { $gte: ini, $lt: fim } }).sort({ DataEntr: 1, NrNota: 1 }).toArray();
    let saldo = 0;
    res.json({ ano, mes, notas: notas.map(n => {
      const v = Math.round((Number(n.VrNota) || 0) * 100) / 100; saldo = Math.round((saldo + v) * 100) / 100;
      const f = forn.get(Number(n.NrFornec)) || {};
      return { entrada: n.DataEntr, nota: n.NrNota, pedido: n.NrPedido || null, nrFornec: n.NrFornec,
        fornecedor: f.razao || f.marca || ('fornecedor ' + n.NrFornec), marca: f.marca || '', valor: v, saldo };
    }) });
  } catch (err) {
    console.error('❌ /compra/programacao/api/realizacao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

router.get('/api/pedidos', async (req, res) => {
  try {
    const linhas = await col('_fluxo_projetado').find({ status: 'ATIVO', pos: { $in: [3, 7] } }).sort({ vencimento: 1 }).toArray();
    // 20/10/2026 (Jorge): a data da lista e a PREVISAO DA COMPRA (como no Access), nao o vencimento da 1a parcela:
    //   previsao (pos 7): a data da linha no fluxo do Access (Data) · pedido (pos 3): a entrega prevista do pedido.
    //   O acumulado ZERA a cada mes (a tela pula uma linha entre os meses).
    const peds = new Map((await col('_compra_pedidos').find({ situacao: 'P' }).project({ numero: 1, dataEntregaPrevista: 1 }).toArray())
      .map(p => [String(p.numero), p.dataEntregaPrevista]));
    const grupo = (pos, chave, dataDe) => {
      const m = new Map();
      for (const l of linhas.filter(x => x.pos === pos)) {
        const k = chave(l); if (!m.has(k.k)) m.set(k.k, { numero: k.n, fornecedor: l.nomeConta || l.historico || '', conta: l.codigoConta || '',
          previsao: null, primeiro: l.vencimento, valor: 0, parcelas: [] });
        const g = m.get(k.k); g.valor = Math.round((g.valor + Math.abs(l.valor || 0)) * 100) / 100;
        g.parcelas.push({ venc: l.vencimento, valor: Math.abs(l.valor || 0), historico: l.historico || '' });
        if (l.vencimento < g.primeiro) g.primeiro = l.vencimento;
        const d = dataDe(l, k); if (d && (!g.previsao || d < g.previsao)) g.previsao = d;
      }
      const lista = [...m.values()].map(g => ({ ...g, previsao: g.previsao || g.primeiro }))
        .sort((a, b) => new Date(a.previsao) - new Date(b.previsao));
      let ac = 0, mesAnt = '';
      return lista.map(g => { const d = new Date(g.previsao), mk = d.getUTCFullYear() + '-' + d.getUTCMonth();
        if (mk !== mesAnt) { ac = 0; mesAnt = mk; }
        ac = Math.round((ac + g.valor) * 100) / 100; return { ...g, acumulado: ac }; });
    };
    // pedido: o numero no historico ("Pedido 7119 Eplax") ou no nrTitulo ("7113/0")
    const nPed = l => { const m = /pedido\D{0,60}?(\d{4,})/i.exec(l.historico || '') || /^(\d{4,})\//.exec(l.nrTitulo || ''); return m ? { k: 'P' + m[1], n: m[1] } : { k: 'H' + l.historico, n: '' }; };
    // previsao: o numero do nrTitulo ("997/0"), senao o historico
    const nPrev = l => { const m = /^(\d+)\//.exec(l.nrTitulo || '') || /·\s*(\d+)\/\d+\s*$/.exec(l.historico || ''); return m ? { k: 'R' + m[1], n: m[1] } : { k: 'H' + l.historico + l.vencimento, n: '' }; };
    // 20/10/2026 (Jorge): as PREVISOES vem da tabela do Access Ped_Previsão (espelho _access_ped_previsao, PROG-2):
    //   nº, fornecedor, Previsão (data da compra) e VTotal (o valor da compra, UMA vez). Pos 0 = em aberto.
    //   As parcelas no fluxo sao as linhas pos 7 com a Chave = coluna Fluxo. Sem o espelho: o jeito antigo (pelo fluxo).
    const prev = await col('_access_ped_previsao').find({}).toArray();
    let previsoes;
    if (prev.length) {
      const forn = await fornecedores();
      const parc = new Map();
      for (const l of linhas.filter(x => x.pos === 7 && x.chaveAccess)) {
        const k = Number(l.chaveAccess); if (!parc.has(k)) parc.set(k, []);
        parc.get(k).push({ venc: l.vencimento, valor: Math.abs(l.valor || 0), historico: l.historico || '' });
      }
      const lista = prev.filter(p => !Number(p.Pos)).map(p => {
        const f = forn.get(Number(p.NrFornec)) || {};
        return { numero: String(p.NrPedido), fornecedor: f.razao || f.marca || ('fornecedor ' + p.NrFornec), marca: f.marca || '',
          previsao: p['Previsão'] || p.Previsao || null, valor: Math.round((Number(p.VTotal) || 0) * 100) / 100,
          parcelas: parc.get(Number(p.Fluxo)) || [] };
      // 20/10/2026: so previsao de 2025 em diante (o Access tem sobra antiga: nº 300, fornecedor 17, 02/02/2009)
      }).filter(p => p.previsao && new Date(p.previsao).getUTCFullYear() >= 2025).sort((a, b) => new Date(a.previsao) - new Date(b.previsao) || Number(a.numero) - Number(b.numero));
      let ac = 0, mesAnt = '';
      previsoes = lista.map(g => { const d = new Date(g.previsao), mk = d.getUTCFullYear() + '-' + d.getUTCMonth();
        if (mk !== mesAnt) { ac = 0; mesAnt = mk; }
        ac = Math.round((ac + g.valor) * 100) / 100; return { ...g, acumulado: ac }; });
    } else previsoes = grupo(7, nPrev, l => l.dataAccess || null);
    res.json({ pedidos: grupo(3, nPed, (l, k) => peds.get(k.n) || null), previsoes, fontePrevisoes: prev.length ? 'Ped_Previsão' : 'fluxo' });
  } catch (err) {
    console.error('❌ /compra/programacao/api/pedidos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 20/10/2026 (Jorge): RESUMO DE UM FORNECEDOR no ano. GET /compra/programacao/api/fornecedor?nr=82&ano=2026
   - comprado no ano (notas que entraram), mes a mes, quantas notas, a ultima nota
   - media mensal: comprado / meses ja passados no ano (ano corrente: ate o mes de hoje; ano passado: 12)
   - o mesmo periodo do ano anterior (para comparar)
   - ainda a comprar no ano: compras projetadas (pos 7) e pedidos feitos (pos 3) em aberto com vencimento no ano
     (a ligacao e pela conta do fornecedor: Compras_Fornecedores.NrContabil, 2.02 -> 2.01) */
router.get('/api/fornecedor', async (req, res) => {
  try {
    const nr = parseInt(req.query.nr, 10), ano = parseInt(req.query.ano, 10) || new Date().getFullYear();
    if (!nr) return res.status(400).json({ erro: 'fornecedor?' });
    const f = (await fornecedores()).get(nr) || {};
    const valor = { $convert: { input: '$VrNota', to: 'double', onError: 0, onNull: 0 } };
    const porMes = async a => {
      const ag = await col('_access_nfe_cabecalho').aggregate([{ $match: { NrFornec: nr, DataEntr: { $gte: ano0(a), $lt: ano1(a) } } },
        { $group: { _id: { $month: '$DataEntr' }, v: { $sum: valor }, n: { $sum: 1 } } }]).toArray();
      const m = Array(12).fill(0); let n = 0;
      ag.forEach(g => { m[g._id - 1] = Math.round(g.v * 100) / 100; n += g.n; });
      return { meses: m, notas: n };
    };
    const atual = await porMes(ano), anterior = await porMes(ano - 1);
    const hoje = new Date(), ate = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : ano < hoje.getFullYear() ? 12 : 0;
    const soma = (a, k) => Math.round(a.slice(0, k).reduce((x, y) => x + y, 0) * 100) / 100;
    const comprado = soma(atual.meses, 12);
    const ultima = await col('_access_nfe_cabecalho').find({ NrFornec: nr }).sort({ DataEntr: -1 }).limit(1).toArray();
    // pedidos e projecoes pela conta do fornecedor
    let conta = String(f.conta || '').trim(); if (conta.startsWith('2.02.')) conta = '2.01.' + conta.slice(5);
    const abertos = conta ? await col('_fluxo_projetado').find({ status: 'ATIVO', pos: { $in: [3, 7] }, codigoConta: conta,
      vencimento: { $gte: new Date(ano, 0, 1), $lt: new Date(ano + 1, 0, 1) } }).sort({ vencimento: 1 }).toArray() : [];
    const tot = p => Math.round(abertos.filter(l => l.pos === p).reduce((x, l) => x + Math.abs(l.valor || 0), 0) * 100) / 100;
    res.json({ nr, ano, marca: f.marca || ('fornecedor ' + nr), razao: f.razao || '', conta,
      comprado, notas: atual.notas, meses: atual.meses, mesesPassados: ate,
      mediaMensal: ate ? Math.round(soma(atual.meses, ate) / ate * 100) / 100 : 0,
      anterior: { ano: ano - 1, total: soma(anterior.meses, 12), mesmoPeriodo: soma(anterior.meses, ate || 12), meses: anterior.meses },
      ultimaNota: ultima[0] ? { data: ultima[0].DataEntr, nota: ultima[0].NrNota, valor: Number(ultima[0].VrNota) || 0 } : null,
      pedidos: tot(3), projetado: tot(7),
      abertos: abertos.map(l => ({ pos: l.pos, venc: l.vencimento, valor: Math.abs(l.valor || 0), historico: l.historico || '' })) });
  } catch (err) {
    console.error('❌ /compra/programacao/api/fornecedor:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 20/10/2026 (Jorge): SUGESTAO DE COMPRA — os numeros para a regra do Jorge (a conta e feita na tela, nada e gravado):
   GET /compra/programacao/api/sugestao  ->  por fornecedor:
     compras dos 3 ULTIMOS MESES fechados (notas que entraram), o mes da ultima compra,
     e nos 3 PROXIMOS MESES: o que ja esta previsto (Ped_Previsão, pos 7) e os pedidos feitos (pos 3).
   Alterado em: 20/10/2026 - os 3 meses comecam no mes corrente; pedido atrasado conta no mes corrente; nº dos pedidos.
   Alterado em: 20/10/2026 - o que ja entrou no mes corrente (entrouMes / notasMes) e a ultima compra antes dele (ultimaAntes).
   Alterado em: 20/10/2026 - detalhe para a janelinha (prevDet/pedDet) e o que fica fora (fora.semFornecedor / fora.depois). */
router.get('/api/sugestao', async (req, res) => {
  try {
    const hoje = new Date(), am = (a, m) => { const d = new Date(Date.UTC(a, m - 1, 1)); return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }; };
    const A = hoje.getFullYear(), M = hoje.getMonth() + 1;
    // 20/10/2026 (correcao): os 3 meses da sugestao comecam no MES CORRENTE (antes pulava o mes de hoje e os pedidos
    //   com entrega neste mes ou atrasada sumiam — so aparecia o da Eplax)
    const ultimos = [am(A, M - 3), am(A, M - 2), am(A, M - 1)], futuros = [am(A, M), am(A, M + 1), am(A, M + 2)];
    const ini = new Date(Date.UTC(A, M - 1, 1));
    const chave = d => { const x = new Date(d); return x.getUTCFullYear() + '-' + (x.getUTCMonth() + 1); };
    const iU = new Map(ultimos.map((u, i) => [u.ano + '-' + u.mes, i])), iF = new Map(futuros.map((u, i) => [u.ano + '-' + u.mes, i]));
    const forn = await fornecedores();
    const valor = { $convert: { input: '$VrNota', to: 'double', onError: 0, onNull: 0 } };
    const L = new Map(), linha = nr => { if (!L.has(nr)) { const f = forn.get(nr) || {};
      L.set(nr, { nr, marca: f.marca || ('fornecedor ' + nr), razao: f.razao || '', ativo: f.ativo !== false, compras: [0, 0, 0], ultimaCompra: null, previsto: [0, 0, 0], pedidos: [0, 0, 0], pedNums: [[], [], []], atrasado: 0, comprou12: 0,
        prevDet: [[], [], []], pedDet: [[], [], []], ultimaAntes: null, entrouMes: 0, notasMes: [] }); }
      return L.get(nr); };
    // compras: os 3 ultimos meses fechados e o total dos ultimos 12 (para saber quem e fornecedor ativo de verdade)
    const desde12 = new Date(Date.UTC(A, M - 13, 1)), fimU = new Date(Date.UTC(A, M - 1, 1));
    const ag = await col('_access_nfe_cabecalho').aggregate([{ $match: { DataEntr: { $gte: desde12, $lt: fimU } } },
      { $group: { _id: { f: '$NrFornec', a: { $year: '$DataEntr' }, m: { $month: '$DataEntr' } }, v: { $sum: valor } } }]).toArray();
    for (const g of ag) { const l = linha(Number(g._id.f)), k = g._id.a + '-' + g._id.m, v = Math.round(g.v * 100) / 100;
      l.comprou12 += v; if (iU.has(k)) l.compras[iU.get(k)] += v; }
    const ult = await col('_access_nfe_cabecalho').aggregate([{ $group: { _id: '$NrFornec', d: { $max: '$DataEntr' } } }]).toArray();
    for (const u of ult) if (L.has(Number(u._id))) L.get(Number(u._id)).ultimaCompra = u.d;
    // 20/10/2026 (Jorge: "quanto ja entrou em outubro da Komeco?"): as notas que JA ENTRARAM no mes corrente,
    //   e a ultima compra ANTES do mes corrente (e dela que conta o intervalo da sugestao do mes corrente)
    for (const n of await col('_access_nfe_cabecalho').find({ DataEntr: { $gte: ini } }).project({ NrFornec: 1, NrNota: 1, DataEntr: 1, VrNota: 1 }).sort({ DataEntr: 1 }).toArray()) {
      const x = linha(Number(n.NrFornec)), v = Math.round((Number(n.VrNota) || 0) * 100) / 100;
      x.entrouMes = Math.round((x.entrouMes + v) * 100) / 100; x.notasMes.push({ nota: n.NrNota, data: n.DataEntr, valor: v });
    }
    const ua = await col('_access_nfe_cabecalho').aggregate([{ $match: { DataEntr: { $lt: ini } } }, { $group: { _id: '$NrFornec', d: { $max: '$DataEntr' } } }]).toArray();
    for (const u of ua) if (L.has(Number(u._id))) L.get(Number(u._id)).ultimaAntes = u.d;
    // previsto (Ped_Previsão em aberto) nos 3 proximos meses
    for (const p of await col('_access_ped_previsao').find({}).toArray()) {
      if (Number(p.Pos) || !p['Previsão']) continue;
      const k = chave(p['Previsão']); if (!iF.has(k)) continue;
      const x = linha(Number(p.NrFornec)), i = iF.get(k), v = Math.round((Number(p.VTotal) || 0) * 100) / 100;
      x.previsto[i] += v; x.prevDet[i].push({ num: String(p.NrPedido), data: p['Previsão'], valor: v });
    }
    // pedidos feitos (pos 3), pela entrega prevista do pedido, ligados ao fornecedor pela conta (NrContabil 2.02 -> 2.01)
    const porConta = new Map(); for (const [nr, f] of forn) { let c = String(f.conta || ''); if (c.startsWith('2.02.')) c = '2.01.' + c.slice(5); if (c) porConta.set(c, nr); }
    const peds = new Map((await col('_compra_pedidos').find({ situacao: 'P' }).project({ numero: 1, dataEntregaPrevista: 1 }).toArray()).map(p => [String(p.numero), p.dataEntregaPrevista]));
    // 20/10/2026: o que fica FORA da sugestao (para o total bater com os pedidos pendentes): sem fornecedor / depois
    const fora = { semFornecedor: [], depois: [] }, poe = (lst, num, l, v) => { let g = lst.find(z => z.num === num);
      if (!g) lst.push(g = { num, conta: l.codigoConta || '', historico: l.historico || '', valor: 0, parcelas: 0 }); g.valor = Math.round((g.valor + v) * 100) / 100; g.parcelas++; };
    let totalPed = 0;
    for (const l of await col('_fluxo_projetado').find({ status: 'ATIVO', pos: 3 }).toArray()) {
      const mm = /pedido\D{0,60}?(\d{4,})/i.exec(l.historico || '') || /^(\d{4,})\//.exec(l.nrTitulo || ''), vv = Math.round(Math.abs(l.valor || 0) * 100) / 100;
      totalPed += vv;
      const nr = porConta.get(l.codigoConta); if (!nr) { poe(fora.semFornecedor, mm ? mm[1] : (l.nrTitulo || '?'), l, vv); continue; }
      const m = /pedido\D{0,60}?(\d{4,})/i.exec(l.historico || '') || /^(\d{4,})\//.exec(l.nrTitulo || '');
      const d = new Date((m && peds.get(m[1])) || l.vencimento), v = Math.round(Math.abs(l.valor || 0) * 100) / 100;
      // pedido com entrega ja passada e que nao chegou (atrasado): conta no mes corrente — vai chegar a qualquer hora
      const num = m ? m[1] : (l.nrTitulo || '?');
      const i = d < ini ? 0 : iF.get(chave(d)); if (i === undefined) { poe(fora.depois, num, l, v); continue; }
      const x = linha(nr); x.pedidos[i] += v; if (d < ini) x.atrasado += v;
      if (!x.pedNums[i].includes(num)) x.pedNums[i].push(num);
      // detalhe por pedido: a entrega prevista (do pedido; sem ela, o vencimento), as parcelas e se esta atrasado
      let g = x.pedDet[i].find(z => z.num === num);
      if (!g) x.pedDet[i].push(g = { num, entrega: d, temEntrega: !!(m && peds.get(m[1])), atrasado: d < ini, valor: 0, parcelas: [] });
      g.valor = Math.round((g.valor + v) * 100) / 100; g.parcelas.push({ venc: l.vencimento, valor: v });
    }
    const linhas = [...L.values()].filter(l => l.comprou12 || l.entrouMes || l.previsto.some(Boolean) || l.pedidos.some(Boolean))
      .map(l => ({ ...l, compras: l.compras.map(v => Math.round(v * 100) / 100), previsto: l.previsto.map(v => Math.round(v * 100) / 100),
        pedidos: l.pedidos.map(v => Math.round(v * 100) / 100), atrasado: Math.round(l.atrasado * 100) / 100, comprou12: Math.round(l.comprou12 * 100) / 100 }))
      .sort((a, b) => b.comprou12 - a.comprou12);
    res.json({ ultimos, futuros, linhas, fora, totalPedidos: Math.round(totalPed * 100) / 100 });
  } catch (err) {
    console.error('❌ /compra/programacao/api/sugestao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
