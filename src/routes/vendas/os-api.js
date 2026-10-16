// =============================================================================
// Destino: C:\plataformaRota\src\routes\vendas\os-api.js
// Criado em: 13/10/2026
//
// ORDEM DE SERVICO (etapa 1: sem contabilidade). Montado em /vendas/api/os
// (src\routes\vendas\pages.js). Colecao _ordens_servico (nasce no fechamento da venda).
//
// Situacao (campo status):
//   P  pendente   servico ainda nao concluido
//                 - programada:    tem tecnico, dia e hora
//                 - n/programada:  falta tecnico, dia ou hora
//   E  concluida  servico feito (termino informado, valor final definido);
//                 aguarda o recebimento no fluxo de caixa de servico (etapa 2)
//   L  liquidada  concluida e recebida (etapa 2)
//   C  cancelada  (venda cancelada)
//
// CONSIGNADO: material que o tecnico leva alem do vendido. O estoque BAIXA quando sai
// (arquivo_docs.qte, em unidades). O que volta entra pela devolucao e repoe o estoque.
// Usado = saiu - voltou. Preco = a vista do cadastro no dia da saida (centavos).
// A troca de item vendido por consignado e a devolucao com nota (entrada/venda) ficam
// para a etapa 3.
//
// FOTO: o navegador ja manda a imagem reduzida (JPEG). Fica em
//   <pasta do sistema>\uploads\os\<empresa>\  (fora do public: so abre logado)
// Foto removida nao e apagada: ganha removida = true.
//
// Rotas:
//   GET  /lista?tipo=programadas|nprogramadas|pendentes|concluidas|liquidadas|geral
//   GET  /:id
//   PUT  /:id                         { terminoDia, terminoHora, valorServico, observacaoServico }
//   POST /:id/consignados             { codigo, quantidade }          baixa o estoque
//   POST /:id/consignados/:cid/devolver  { quantidade }              repoe o estoque
//   POST /:id/fotos                   corpo = a imagem (image/jpeg)
//   GET  /:id/fotos/:arquivo
//   POST /:id/fotos/:arquivo/remover
//   POST /:id/concluir                P -> E (exige termino)
//   POST /:id/reabrir                 E -> P
//   PUT  /:id/agenda                  { tecnicoConta, dia, horaIni, horaFim }  agenda/reagenda (14/10/2026)
// 13/10/2026: OS VI com servicoContabilizado (mao de obra cobrada e lancada na venda, com a
// partilha tecnico/loja): o valor do servico NAO muda pela OS.
// Dinheiro em CENTAVOS (arquivo_docs em reais: convertido aqui).
// Alterado em: 15/10/2026 - REAGENDAR (outro dia) apaga o termino: o servico nao terminou.
//              Termino antes do dia previsto nao vale (nao aparece e nao conclui).
//              Troca de tecnico com parte ja lancada: a parte vai inteira para o novo tecnico
//              (a ficha nao tem mais percentual).
// Alterado em: 15/10/2026 - FICHA DE FECHAMENTO da OS (pagina /vendas/servicos/fechamento/:id):
//   GET  /:id/fechamento   OS + itens da venda + custo do consignado + como e a mao de obra
//   POST /:id/fechamento   grava e conclui (P -> E, ou L se nao ha nada a receber):
//     - termino (no dia previsto ou depois, nunca no futuro)
//     - devolucao de consignado (repoe o estoque) e o USADO: cobrar do cliente ou nao
//         nao cobrado: despesa a CUSTO  3.06.006.004 (D) x 1.02.001.001 estoque (C)
//         cobrado:     cliente (D) x 4.02.001.001 (C) pelo preco  +  CPV 3.05.001.001 (D) x estoque (C) a custo
//     - devolucao de material VENDIDO (repoe o estoque): "receita extra" (fica como esta) ou
//       "estorno" (anotado como estorno pendente; o acerto com o cliente e feito a parte)
//     - MAO DE OBRA
//         VENDA (VI cobrada na nota, toda na 4.05.001.001): informa a parte da EMPRESA; o resto
//               sai da 4.05.001.001 (D) para o tecnico 2.06.001.NNN (C)
//         OS    (conserto, chamine...: cobrada agora do cliente): valor + parte da empresa;
//               cliente (D) x 4.05.001.001 (C, empresa) + tecnico (C)
//         JA_PARTILHADA (OS de antes de 15/10, partilha ja lancada): so mostra
//     - VALOR ADICIONAL: do TECNICO -> tecnico (D) x 4.05.001.001 (C) (sai no pagamento de sexta);
//                        do CLIENTE -> cliente (D) x 4.05.001.001 (C)
//     - o que e do cliente vira UM lancamento (cliente x receitas): fica "a receber" na OS (status E)
//       para o fluxo/recebimento de servico (proxima etapa)
//   POST /:id/reabrir     desfaz o fechamento (cancela os lancamentos, desfaz as devolucoes)
// Alterado em: 15/10/2026 - CONSIGNADO USADO: o destino de cada item e escolhido no fechamento
//     VENDA        venda adicional, pelo preco de venda (cliente a receber + CPV a custo)
//     COMPLEMENTAR material complementar / cortesia: despesa a CUSTO (3.06.006.004)
//     TROCA        trocado por material vendido que voltou (devolucao "troca"): sem lancamento
//   Devolucao de vendido ganha o tratamento TROCA. OS de instalacao (VI): a mao de obra e so a
//   da venda (zero se nao houve); cobranca de mao de obra na ficha so para conserto (depois).
// Alterado em: 15/10/2026 - CONSIGNADO: o mesmo produto levado de novo SOMA na linha que ainda esta
//   com o tecnico (nao abre outra linha); cada saida fica em consignados.saidas.
// Alterado em: 16/10/2026 - FLUXO DE SERVICO: o que fica a receber do cliente no fechamento vira
//   uma linha em _fluxo_projetado (pos 5, conta do cliente, vencimento = dia do termino) marcada
//   fluxo:'SERVICO' (fica fora do fluxo de caixa normal). O recebimento usa o MESMO codigo do
//   fluxo (POST /financeiro/api/pagamento/quitar); estornar la devolve a linha.
//   GET  /fluxo?situacao=aberto|recebido&os=   as linhas do fluxo de servico (com a OS)
//   POST /fluxo/sincronizar                    OS recebida -> L; recebimento estornado -> E
//   Reabrir: so se o a receber ainda nao foi recebido (a linha do fluxo e cancelada).
// Alterado em: 16/10/2026 - PUT /:id/consignados/:cid { usado }: acerta a quantidade USADA de uma
//   linha (na separacao do material a conta nem sempre bate). Saiu passa a ser voltou + usado e o
//   estoque acompanha a diferenca; cada acerto fica em consignados.saidas (positivo ou negativo).
// Alterado em: 16/10/2026 - TERMINO no fechamento: de quando a OS foi aberta ate agora (o servico pode
//   ser feito antes do dia previsto). OS fechada mostra o termino gravado. completa() devolve `aberta`.
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const Boleta = require('../../models/contab/financeiro/boleta');
// a agenda do tecnico (mesma conta da venda): require tardio, o venda-api tambem e montado no pages.js
const agendaDoTecnico = (...a) => require('./venda-api').agendaDoTecnico(...a);
const RECEITA_SERVICO = '4.05.001.001';
const paraMin = s => { const m = /^(\d{2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
const subtitulo = (loja, codigo, session) =>
  col('_contasubtitulos').findOne({ lojistaId: loja, codigo, ativo: { $ne: false } }, session ? { session } : {});

const col = n => mongoose.connection.collection(n);
const lojaDe = req => new mongoose.Types.ObjectId(req.lojistaId);
const centavos = v => Math.round((Number(v) || 0) * 100);
const oid = s => (mongoose.Types.ObjectId.isValid(String(s)) ? new mongoose.Types.ObjectId(String(s)) : null);
const PASTA_FOTOS = path.join(process.cwd(), 'uploads', 'os');
const MAX_FOTOS = 12;

const erro = (status, msg) => Object.assign(new Error(msg), { status });
const responder = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) {
    if (!err.status) console.error('[os-api]', err.message);
    res.status(err.status || 500).json({ ok: false, erro: err.message });
  }
};

const SEM = c => [{ [c]: { $in: ['', null] } }, { [c]: { $exists: false } }];
const FILTROS = {
  programadas:  { status: 'P', tecnicoConta: { $regex: '^2\\.06\\.' }, diaPrevisto: { $type: 'date' },
                  horaIni: { $regex: '^\\d{2}:\\d{2}$' } },
  nprogramadas: { status: 'P', $or: [...SEM('tecnicoConta'), ...SEM('diaPrevisto'), ...SEM('horaIni')] },
  pendentes:    { status: 'P' },
  concluidas:   { status: 'E' },
  liquidadas:   { status: 'L' },
  geral:        { status: { $in: ['P', 'E'] } },     // 14/10/2026: lista geral (em aberto), A-Z pelo cliente
};

const diaIso = d => (d ? new Date(d).toISOString().slice(0, 10) : '');
// termino so vale se for no dia previsto ou depois (reagendou: o termino antigo nao vale)
const terminoValido = o => (o.terminoEm && (o.status !== 'P' || !o.diaPrevisto || diaIso(o.terminoEm) >= diaIso(o.diaPrevisto)) ? o.terminoEm : null);
const consignadosDe = o => (o.consignados || []).map(c => {
  const usado = (c.quantidade || 0) - (c.devolvido || 0);
  return { id: String(c.id), codigo: c.codigo, descricao: c.descricao || '', referencia: c.referencia || '',
           quantidade: c.quantidade || 0, devolvido: c.devolvido || 0, usado,
           precoUnit: c.precoUnit || 0, total: usado * (c.precoUnit || 0), saidaEm: c.saidaEm || null };
});
function resumo(o) {
  const cons = consignadosDe(o);
  return {
    id: String(o._id), numero: o.numero, status: o.status, tipo: o.tipo || '',
    cliente: o.cliente || {}, venda: o.venda ? { id: String(o.venda.id || ''), numero: o.venda.numero } : null,
    tecnicoConta: o.tecnicoConta || '', tecnicoNome: o.tecnicoNome || '',
    // sem dia marcado, a hora nao vale (OS antigas gravadas com hora e sem dia)
    diaPrevisto: diaIso(o.diaPrevisto), horaIni: o.diaPrevisto ? o.horaIni || '' : '', horaFim: o.diaPrevisto ? o.horaFim || '' : '',
    endereco: o.endereco || {}, edificio: o.edificio || '', apto: o.apto || '',
    terminoEm: terminoValido(o), concluidaEm: o.concluidaEm || null, liquidadaEm: o.liquidadaEm || null,
    valorServico: o.valorServico || 0,
    servicoContabilizado: !!o.servicoContabilizado,          // VI: mao de obra ja lancada na venda
    servicoDescricao: o.servicoDescricao || '', parteTecnico: o.parteTecnico || 0, parteLoja: o.parteLoja || 0,
    totalConsignado: cons.reduce((t, c) => t + c.total, 0),
    programada: !!(o.tecnicoConta && o.diaPrevisto && o.horaIni),
    itens: (o.itens || []).map(i => ({ codigo: i.codigo, descricao: i.descricao || '', servico: i.servico || '' })),
  };
}

// ---------------------------------------------------------------------------
// GET /lista?tipo=   + contagem de cada aba
// ---------------------------------------------------------------------------
router.get('/lista', responder(async (req, res) => {
  await sincronizarRecebidas(lojaDe(req));        // 16/10/2026: recebida no fluxo de servico -> liquidada
  const loja = lojaDe(req);
  const tipo = FILTROS[req.query.tipo] ? req.query.tipo : 'pendentes';
  const ordem = tipo === 'geral' ? { 'cliente.nome': 1, diaPrevisto: 1, horaIni: 1 }
              : tipo === 'liquidadas' ? { liquidadaEm: -1, numero: -1 }
              : tipo === 'concluidas' ? { concluidaEm: -1, numero: -1 } : { diaPrevisto: 1, horaIni: 1, numero: 1 };
  const docs = await col('_ordens_servico').find({ lojistaId: loja, ...FILTROS[tipo] })
    .sort(ordem).limit(1000).toArray();
  const contagem = {};
  for (const [k, f] of Object.entries(FILTROS)) contagem[k] = await col('_ordens_servico').countDocuments({ lojistaId: loja, ...f });
  res.json({ ok: true, tipo, contagem, os: docs.map(resumo) });
}));

// ---------------------------------------------------------------------------
// GET /:id   a OS completa
// ---------------------------------------------------------------------------
async function lerOS(req, session) {
  const id = oid(req.params.id);
  if (!id) throw erro(400, 'OS inválida');
  const o = await col('_ordens_servico').findOne({ _id: id, lojistaId: lojaDe(req) }, { session });
  if (!o) throw erro(404, 'OS não encontrada');
  return o;
}
function completa(o) {
  return {
    ...resumo(o),
    pontoReferencia: o.pontoReferencia || '', telefone: o.telefone || '', celular: o.celular || '',
    observacao: o.observacao || '', observacaoServico: o.observacaoServico || '',
    aReceber: o.aReceber || 0, fechadaEm: o.fechamento?.em || null, aberta: o.data || o.criadoEm || null,
    itens: o.itens || [],
    consignados: consignadosDe(o),
    fotos: (o.fotos || []).filter(f => !f.removida).map(f => ({ arquivo: f.arquivo, enviadaEm: f.enviadaEm })),
  };
}
// ---------------------------------------------------------------------------
// FLUXO DE SERVICO (16/10/2026)
// ---------------------------------------------------------------------------
// OS concluida (E) cujo a receber ja foi recebido -> L; recebimento estornado -> volta a E
async function sincronizarRecebidas(loja) {
  const oss = await col('_ordens_servico').find({ lojistaId: loja, status: { $in: ['E', 'L'] },
    'fechamento.fluxoId': { $ne: null } }).project({ status: 1, fechamento: 1 }).toArray();
  if (!oss.length) return 0;
  const linhas = new Map((await col('_fluxo_projetado').find({ lojistaId: loja,
    _id: { $in: oss.map(o => o.fechamento.fluxoId) } }).project({ status: 1, quitadoEm: 1 }).toArray()).map(l => [String(l._id), l]));
  let n = 0;
  for (const o of oss) {
    const l = linhas.get(String(o.fechamento.fluxoId));
    if (!l) continue;
    if (o.status === 'E' && l.status === 'QUITADO') {
      await col('_ordens_servico').updateOne({ _id: o._id, status: 'E' }, { $set: { status: 'L', liquidadaEm: l.quitadoEm || new Date(), atualizadoEm: new Date() } });
      n++;
    } else if (o.status === 'L' && l.status === 'ATIVO') {
      await col('_ordens_servico').updateOne({ _id: o._id, status: 'L' }, { $set: { status: 'E', atualizadoEm: new Date() }, $unset: { liquidadaEm: '' } });
      n++;
    }
  }
  return n;
}

router.get('/fluxo', responder(async (req, res) => {
  const loja = lojaDe(req);
  await sincronizarRecebidas(loja);
  const filtro = { lojistaId: loja, fluxo: 'SERVICO' };
  const sit = String(req.query.situacao || 'aberto');
  filtro.status = sit === 'recebido' ? 'QUITADO' : 'ATIVO';
  const osId = req.query.os ? oid(req.query.os) : null;
  if (osId) { filtro.lancamentoId = osId; filtro.status = { $in: ['ATIVO', 'QUITADO'] }; }
  const linhas = await col('_fluxo_projetado').find(filtro).sort({ vencimento: sit === 'recebido' ? -1 : 1 }).limit(500).toArray();
  const oss = new Map((await col('_ordens_servico').find({ lojistaId: loja, _id: { $in: linhas.map(l => l.lancamentoId).filter(Boolean) } })
    .project({ numero: 1, tipo: 1, cliente: 1, tecnicoNome: 1, status: 1 }).toArray()).map(o => [String(o._id), o]));
  const bols = new Map((await col('_boletas').find({ _id: { $in: linhas.map(l => l.boletaId).filter(Boolean) } })
    .project({ codigo: 1 }).toArray()).map(b => [String(b._id), b.codigo]));
  res.json({ ok: true, linhas: linhas.map(l => {
    const o = oss.get(String(l.lancamentoId)) || {};
    return { _id: l._id, vencimento: l.vencimento, valor: Math.round(Math.abs(l.valor) * 100), historico: l.historico || '',
             codigoConta: l.codigoConta || '', nomeConta: l.nomeConta || '', status: l.status,
             quitadoEm: l.quitadoEm || null, boleta: l.boletaId ? bols.get(String(l.boletaId)) || '' : '',
             os: { id: String(l.lancamentoId || ''), numero: o.numero || l.osNumero, tipo: o.tipo || '', status: o.status || '',
                   cliente: o.cliente?.nome || '', tecnico: o.tecnicoNome || '' } };
  }) });
}));

router.post('/fluxo/sincronizar', responder(async (req, res) => {
  res.json({ ok: true, mudaram: await sincronizarRecebidas(lojaDe(req)) });
}));

router.get('/:id', responder(async (req, res) => {
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

const editavel = o => {
  if (o.status === 'L') throw erro(409, 'OS liquidada: só consulta');
  if (o.status === 'C') throw erro(409, 'OS cancelada: só consulta');
};

// ---------------------------------------------------------------------------
// PUT /:id   termino, valor final do servico, observacao do servico
// ---------------------------------------------------------------------------
router.put('/:id', express.json(), responder(async (req, res) => {
  const o = await lerOS(req);
  editavel(o);
  const b = req.body || {};
  const set = { atualizadoEm: new Date() };
  if ('terminoDia' in b) {
    const d = String(b.terminoDia || '').trim(), h = String(b.terminoHora || '').trim();
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw erro(400, 'dia do término inválido');
    if (h && !/^\d{2}:\d{2}$/.test(h)) throw erro(400, 'hora do término inválida');
    set.terminoEm = d ? new Date(d + 'T' + (h || '12:00') + ':00') : null;
    if (set.terminoEm && set.terminoEm > new Date()) throw erro(400, 'o término não pode ser no futuro');
    if (set.terminoEm && !(o.tecnicoConta && o.diaPrevisto)) throw erro(400, 'agende a OS (técnico e dia) antes de informar o término');
    if (set.terminoEm && o.diaPrevisto && d < new Date(o.diaPrevisto).toISOString().slice(0, 10)) throw erro(400, 'o término é antes do dia previsto');
    set.terminoHora = d ? h : '';
  }
  if ('valorServico' in b && !o.servicoContabilizado) {
    const v = Math.round(Number(b.valorServico));
    if (!Number.isFinite(v) || v < 0) throw erro(400, 'valor do serviço inválido');
    set.valorServico = v;
  }
  if ('observacaoServico' in b) set.observacaoServico = String(b.observacaoServico || '').trim().slice(0, 2000);
  await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId }, { $set: set });
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// POST /:id/consignados   { codigo, quantidade }   o tecnico leva: baixa o estoque
// ---------------------------------------------------------------------------
router.post('/:id/consignados', express.json(), responder(async (req, res) => {
  const codigo = Number(req.body?.codigo), qtd = Number(req.body?.quantidade);
  if (!Number.isInteger(codigo) || codigo <= 0) throw erro(400, 'código inválido');
  if (!Number.isInteger(qtd) || qtd <= 0) throw erro(400, 'quantidade tem que ser inteira e maior que zero');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await lerOS(req, session);
      editavel(o);
      const p = await col('arquivo_docs').findOne({ loja_id: o.lojistaId, codigo }, { session });
      if (!p) throw erro(404, 'produto ' + codigo + ' não encontrado');
      const agora = new Date();
      const ja = (o.consignados || []).find(c => c.codigo === codigo && (c.quantidade || 0) - (c.devolvido || 0) > 0);
      if (ja) {                       // ja esta com o tecnico: soma na mesma linha
        await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, 'consignados.id': ja.id }, {
          $inc: { 'consignados.$.quantidade': qtd }, $push: { 'consignados.$.saidas': { quantidade: qtd, em: agora } },
          $set: { atualizadoEm: agora } }, { session });
      } else {
        await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId }, {
          $push: { consignados: { id: new mongoose.Types.ObjectId(), codigo, descricao: p.descricao || '',
                                  referencia: p.referencia || '', quantidade: qtd, devolvido: 0,
                                  precoUnit: centavos(p.precovista), saidaEm: agora, saidas: [{ quantidade: qtd, em: agora }] } },
          $set: { atualizadoEm: agora } }, { session });
      }
      await col('arquivo_docs').updateOne({ _id: p._id, loja_id: o.lojistaId },
        { $inc: { qte: -qtd }, $set: { atualizadoEm: agora } }, { session });
    });
  } finally { session.endSession(); }
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// PUT /:id/consignados/:cid   { usado }   acerta a quantidade usada (16/10/2026)
// ---------------------------------------------------------------------------
router.put('/:id/consignados/:cid', express.json(), responder(async (req, res) => {
  const cid = oid(req.params.cid), usado = Number(req.body?.usado);
  if (!cid) throw erro(400, 'item inválido');
  if (!Number.isInteger(usado) || usado < 0) throw erro(400, 'quantidade usada tem que ser inteira (0 ou mais)');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await lerOS(req, session);
      if (o.status !== 'P') throw erro(409, 'só OS pendente: depois de fechada, o acerto é na ficha de fechamento');
      const c = (o.consignados || []).find(x => String(x.id) === String(cid));
      if (!c) throw erro(404, 'item consignado não encontrado');
      const nova = (c.devolvido || 0) + usado, dif = nova - (c.quantidade || 0);
      if (!dif) return;
      const agora = new Date();
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, 'consignados.id': cid }, {
        $set: { 'consignados.$.quantidade': nova, atualizadoEm: agora },
        $push: { 'consignados.$.saidas': { quantidade: dif, em: agora, acerto: true } } }, { session });
      await col('arquivo_docs').updateOne({ loja_id: o.lojistaId, codigo: c.codigo },
        { $inc: { qte: -dif }, $set: { atualizadoEm: agora } }, { session });
    });
  } finally { session.endSession(); }
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// POST /:id/consignados/:cid/devolver   { quantidade }   voltou para a loja: repoe o estoque
// ---------------------------------------------------------------------------
router.post('/:id/consignados/:cid/devolver', express.json(), responder(async (req, res) => {
  const cid = oid(req.params.cid), qtd = Number(req.body?.quantidade);
  if (!cid) throw erro(400, 'item inválido');
  if (!Number.isInteger(qtd) || qtd <= 0) throw erro(400, 'quantidade tem que ser inteira e maior que zero');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await lerOS(req, session);
      editavel(o);
      const c = (o.consignados || []).find(x => String(x.id) === String(cid));
      if (!c) throw erro(404, 'item consignado não encontrado');
      const resta = (c.quantidade || 0) - (c.devolvido || 0);
      if (qtd > resta) throw erro(400, 'só ' + resta + ' ainda com o técnico');
      const agora = new Date();
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, 'consignados.id': cid }, {
        $inc: { 'consignados.$.devolvido': qtd },
        $push: { 'consignados.$.devolucoes': { quantidade: qtd, em: agora } },
        $set: { atualizadoEm: agora } }, { session });
      await col('arquivo_docs').updateOne({ loja_id: o.lojistaId, codigo: c.codigo },
        { $inc: { qte: qtd }, $set: { atualizadoEm: agora } }, { session });
    });
  } finally { session.endSession(); }
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// fotos do servico acabado
// ---------------------------------------------------------------------------
const ARQ_OK = /^[A-Za-z0-9_-]+\.jpg$/;
router.post('/:id/fotos', express.raw({ type: 'image/*', limit: '12mb' }), responder(async (req, res) => {
  const o = await lerOS(req);
  editavel(o);
  if (!Buffer.isBuffer(req.body) || req.body.length < 100) throw erro(400, 'imagem não recebida');
  if ((o.fotos || []).filter(f => !f.removida).length >= MAX_FOTOS) throw erro(400, 'máximo de ' + MAX_FOTOS + ' fotos por OS');
  const pasta = path.join(PASTA_FOTOS, String(o.lojistaId));
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = 'os' + o.numero + '-' + Date.now() + '.jpg';
  fs.writeFileSync(path.join(pasta, arquivo), req.body);
  await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId },
    { $push: { fotos: { arquivo, enviadaEm: new Date(), bytes: req.body.length } }, $set: { atualizadoEm: new Date() } });
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));
router.get('/:id/fotos/:arquivo', responder(async (req, res) => {
  const o = await lerOS(req);
  const a = String(req.params.arquivo);
  if (!ARQ_OK.test(a) || !(o.fotos || []).some(f => f.arquivo === a)) throw erro(404, 'foto não encontrada');
  const caminho = path.join(PASTA_FOTOS, String(o.lojistaId), a);
  if (!fs.existsSync(caminho)) throw erro(404, 'arquivo da foto não está na pasta');
  res.sendFile(caminho);
}));
router.post('/:id/fotos/:arquivo/remover', responder(async (req, res) => {
  const o = await lerOS(req);
  editavel(o);
  await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, 'fotos.arquivo': String(req.params.arquivo) },
    { $set: { 'fotos.$.removida': true, 'fotos.$.removidaEm': new Date(), atualizadoEm: new Date() } });
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// PUT /:id/agenda   { tecnicoConta, dia: 'AAAA-MM-DD', horaIni, horaFim }   (14/10/2026)
// Agenda / reagenda a OS pendente: tecnico (do cadastro, ativo), dia (hoje ou depois), horario
// (hoje: nao pode ter passado) sem bater com outro cliente do tecnico.
// TROCA DE TECNICO numa OS VI com a mao de obra ja lancada na venda: a parte do tecnico passa
// da conta do antigo para a do novo (boleta "OS nº ... troca de técnico"); se a ficha do novo
// tiver o mesmo servico com outro %, a diferenca vai/volta da Receita de Servicos 4.05.001.001.
// ---------------------------------------------------------------------------
router.put('/:id/agenda', express.json(), responder(async (req, res) => {
  const loja = lojaDe(req), b = req.body || {};
  const t = v => String(v ?? '').trim();
  const tecConta = t(b.tecnicoConta), dia = t(b.dia), hi = t(b.horaIni), hf = t(b.horaFim);
  if (dia && !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw erro(400, 'dia inválido');
  if ((hi && paraMin(hi) === null) || (hf && paraMin(hf) === null)) throw erro(400, 'horário inválido');
  if (hi && !dia) throw erro(400, 'informe o dia antes do horário');
  if (hi && !hf) throw erro(400, 'informe o horário ATÉ');
  if (hf && !hi) throw erro(400, 'informe o horário DAS');
  if (hi && paraMin(hf) <= paraMin(hi)) throw erro(400, 'o ATÉ tem que ser depois do DAS');
  const agora = new Date();
  const hoje = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + String(agora.getDate()).padStart(2, '0');
  if (dia && dia < hoje) throw erro(400, 'esse dia já passou');
  if (dia === hoje && hi && paraMin(hi) < agora.getHours() * 60 + agora.getMinutes()) throw erro(400, 'esse horário de hoje já passou');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await lerOS(req, session);
      if (o.status !== 'P') throw erro(409, 'só OS pendente pode ser agendada');
      let tec = null;
      if (tecConta) {
        tec = await col('_tecnicos').findOne({ lojistaId: loja, contaTecnico: tecConta, ativo: { $ne: false } }, { session });
        if (!tec) throw erro(404, 'técnico ' + tecConta + ' não está no cadastro (ou está inativo)');
      }
      if (tec && dia && hi) {
        const ag = await agendaDoTecnico(loja, tecConta, dia, o.venda?.id ? String(o.venda.id) : null, session, String(o._id));
        const a = paraMin(hi), z = paraMin(hf);
        const bate = ag.ocupados.find(x => { const xi = paraMin(x.horaIni), xf = x.horaFim ? paraMin(x.horaFim) : xi + 30; return a < xf && z > xi; });
        if (bate) throw erro(409, 'o técnico já tem ' + bate.texto + ' às ' + bate.horaIni);
      }
      const set = {
        tecnicoConta: tecConta, tecnicoNome: tec ? (tec.apelido || tec.nome) : '',
        diaPrevisto: dia ? new Date(dia + 'T12:00:00') : null,
        horaIni: hi, horaFim: hf, periodo: hi ? 'FIXO' : 'NENHUM', atualizadoEm: agora,
      };
      const push = {}, unset = {};
      // 15/10/2026: mudou o dia -> o servico nao terminou: o termino gravado sai
      if (o.terminoEm && diaIso(o.diaPrevisto) !== dia) { unset.terminoEm = ''; unset.terminoHora = ''; }
      // troca de tecnico com a parte dele ja lancada
      if ((o.tecnicoConta || '') !== tecConta && o.servicoContabilizado && (o.parteTecnico || 0) > 0 && o.tecnicoConta) {
        if (!tec) throw erro(400, 'a mão de obra desta OS já foi lançada para ' + (o.tecnicoNome || o.tecnicoConta) + ': escolha outro técnico (não dá para deixar a definir)');
        // 15/10/2026: a ficha nao tem mais percentual: a parte vai inteira para o novo tecnico
        const mo = o.valorServico || 0, antiga = o.parteTecnico, nova = antiga;
        const cVelha = await subtitulo(loja, o.tecnicoConta, session);
        const cNova = await subtitulo(loja, tecConta, session);
        const cServ = await subtitulo(loja, RECEITA_SERVICO, session);
        if (!cVelha || !cNova || !cServ) throw erro(404, 'conta não encontrada no plano: ' + [!cVelha && o.tecnicoConta, !cNova && tecConta, !cServ && RECEITA_SERVICO].filter(Boolean).join(', '));
        const hist = 'OS nº ' + o.numero + ' troca de técnico: ' + (o.tecnicoNome || o.tecnicoConta) + ' → ' + (tec.apelido || tec.nome);
        const contra = (c, v) => ({ contaSubTitulo: c._id, codigoConta: c.codigo, nomeConta: c.nome, historico: hist, valor: v / 100 });
        const contras = [contra(cNova, nova)];
        if (antiga - nova !== 0) contras.push(contra(cServ, antiga - nova));    // negativo = sai da receita
        const dataB = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12, 0, 0);
        const [bt] = await Boleta.create([{
          codigo: 'BOL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), tipo: 'RECEBIMENTO', data: dataB,
          bancoSubTitulo: cVelha._id, bancoCodigo: cVelha.codigo, bancoNome: cVelha.nome, valorTotal: antiga / 100,
          contrapartidas: contras, historico: hist, origem: 'VENDA', status: 'ATIVO', lojistaId: loja,
        }], { session });
        set.parteTecnico = nova;
        set.parteLoja = mo - nova;
        push.trocasTecnico = { de: o.tecnicoConta, para: tecConta, parteAntiga: antiga, parteNova: nova, boletaId: bt._id, em: agora };
      }
      const upd = { $set: set };
      if (Object.keys(push).length) upd.$push = push;
      if (Object.keys(unset).length) upd.$unset = unset;
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: loja }, upd, { session });
    });
  } finally { session.endSession(); }
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// concluir / reabrir
// ---------------------------------------------------------------------------
router.post('/:id/concluir', responder(async (req, res) => {
  const o = await lerOS(req);
  if (o.status !== 'P') throw erro(409, 'só OS pendente pode ser concluída');
  if (!terminoValido(o)) throw erro(400, 'informe a data do término (no dia previsto ou depois) antes de concluir');
  if (!o.tecnicoConta) throw erro(400, 'OS sem técnico: escolha o técnico antes de concluir');
  await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, status: 'P' },
    { $set: { status: 'E', concluidaEm: new Date(), atualizadoEm: new Date() } });
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));
router.post('/:id/reabrir', responder(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await lerOS(req, session);
      const f = o.fechamento;
      if (!(o.status === 'E' || (o.status === 'L' && f && f.semReceber)))
        throw erro(409, 'só OS concluída (ainda não recebida) pode ser reaberta');
      const agora = new Date();
      if (f && f.fluxoId) {
        // 16/10/2026: o a receber ja foi recebido no fluxo de servico? entao nao reabre
        const lf = await col('_fluxo_projetado').findOne({ _id: f.fluxoId, lojistaId: o.lojistaId }, { session });
        if (lf && lf.status === 'QUITADO') throw erro(409, 'o serviço já foi recebido no fluxo de serviço: estorne o recebimento antes de reabrir');
        if (lf) await col('_fluxo_projetado').updateOne({ _id: lf._id }, { $set: { status: 'CANCELADO', canceladoEm: agora } }, { session });
      }
      if (f) {
        // desfaz o fechamento: lancamentos cancelados, devolucoes voltam
        if ((f.boletas || []).length) await Boleta.updateMany({ _id: { $in: f.boletas }, lojistaId: o.lojistaId, status: 'ATIVO' },
          { $set: { status: 'CANCELADO' } }, { session });
        for (const d of f.devolucoesConsignado || []) {
          await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, 'consignados.id': d.id },
            { $inc: { 'consignados.$.devolvido': -d.quantidade } }, { session });
          await col('arquivo_docs').updateOne({ loja_id: o.lojistaId, codigo: d.codigo }, { $inc: { qte: -d.quantidade }, $set: { atualizadoEm: agora } }, { session });
        }
        for (const d of f.devolucoesVendido || []) {
          await col('arquivo_docs').updateOne({ loja_id: o.lojistaId, codigo: d.codigo }, { $inc: { qte: -d.quantidade }, $set: { atualizadoEm: agora } }, { session });
        }
      }
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId },
        { $set: { status: 'P', atualizadoEm: agora,
                  ...(f ? { fechamentoDesfeito: { ...f, desfeitoEm: agora } } : {}),
                  // a partilha feita no fechamento sai junto (o lancamento foi cancelado)
                  ...(f && f.maoDeObra && f.maoDeObra.modo !== 'JA_PARTILHADA' ? { parteTecnico: 0, parteLoja: 0 } : {}),
                  ...(f && f.maoDeObra && f.maoDeObra.modo === 'OS' ? { valorServico: 0 } : {}) },
          $unset: { concluidaEm: '', liquidadaEm: '', fechamento: '', aReceber: '' } }, { session });
    });
  } finally { session.endSession(); }
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

// ---------------------------------------------------------------------------
// FICHA DE FECHAMENTO (15/10/2026)
// ---------------------------------------------------------------------------
const CONTA = {
  RECEITA_SERVICO: '4.05.001.001', RECEITA_MATERIAL: '4.02.001.001',
  ESTOQUE: '1.02.001.001', CPV: '3.05.001.001', MAT_COMPLEMENTAR: '3.06.006.004',
};

// como e a mao de obra desta OS
const ehVI = o => o.tipo === 'VI' || o.tipo === 'INSTALACAO';
function modoMaoDeObra(o) {
  if (o.servicoContabilizado && (o.parteTecnico || 0) > 0) return { modo: 'JA_PARTILHADA', valor: o.valorServico || 0 };
  if (o.servicoContabilizado) return { modo: 'VENDA', valor: o.maoDeObraVenda || o.valorServico || 0 };
  if (ehVI(o)) return { modo: 'VENDA', valor: 0 };        // VI sem mao de obra na venda: nada a dividir
  return { modo: 'OS', valor: 0 };
}
const DESTINOS = ['VENDA', 'COMPLEMENTAR', 'TROCA'];

async function dadosFechamento(o) {
  const v = o.venda?.id ? await col('_vendas').findOne({ _id: o.venda.id, lojistaId: o.lojistaId }) : null;
  const cods = [...new Set((o.consignados || []).map(c => c.codigo).concat((v?.itens || []).map(i => i.codigo)))];
  const prods = cods.length ? await col('arquivo_docs').find({ loja_id: o.lojistaId, codigo: { $in: cods } })
    .project({ codigo: 1, precocusto: 1, qte: 1 }).toArray() : [];
  const custo = Object.fromEntries(prods.map(p => [p.codigo, centavos(p.precocusto)]));
  return {
    os: completa(o),
    fechamento: o.fechamento || null,
    aReceber: o.aReceber || 0,
    maoDeObra: modoMaoDeObra(o),
    parteTecnico: o.parteTecnico || 0, parteLoja: o.parteLoja || 0,
    clienteConta: o.cliente?.ncontabil || '',
    vendidos: (v?.itens || []).map(i => ({
      codigo: i.codigo, descricao: i.descricao || '', quantidade: i.quantidade || 0,
      precoUnit: i.quantidade ? Math.round(((i.quantidade * (i.precoUnitario || 0)) - (i.desconto || 0)) / i.quantidade) : 0,
      total: (i.quantidade || 0) * (i.precoUnitario || 0) - (i.desconto || 0),
    })),
    custo,
  };
}

router.get('/:id/fechamento', responder(async (req, res) => {
  res.json({ ok: true, ...(await dadosFechamento(await lerOS(req))) });
}));

router.post('/:id/fechamento', express.json(), responder(async (req, res) => {
  const loja = lojaDe(req), b = req.body || {};
  const t = v => String(v ?? '').trim();
  const inteiro = v => { const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : NaN; };
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const o = await lerOS(req, session);
      if (o.status !== 'P') throw erro(409, 'esta OS já foi fechada');
      if (!o.tecnicoConta || !o.diaPrevisto) throw erro(400, 'agende a OS (técnico e dia) antes de fechar');
      const agora = new Date();

      // ---- termino ----
      const d = t(b.terminoDia), h = t(b.terminoHora);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw erro(400, 'informe o dia do término');
      if (h && !/^\d{2}:\d{2}$/.test(h)) throw erro(400, 'hora do término inválida');
      const terminoEm = new Date(d + 'T' + (h || '12:00') + ':00');
      if (terminoEm > agora) throw erro(400, 'o término não pode ser no futuro');
      const aberta = o.data || o.criadoEm;
      if (aberta && terminoEm < new Date(new Date(aberta).setHours(0, 0, 0, 0))) throw erro(400, 'o término é antes da abertura da OS (' + new Date(aberta).toLocaleDateString('pt-BR') + ')');

      const conta = async cod => {
        const c = await subtitulo(loja, cod, session);
        if (!c) throw erro(404, 'a conta ' + cod + ' não está no plano (ou está suspensa)');
        return c;
      };
      const nomeCli = o.cliente?.nome || '';
      const hist = txt => 'OS nº ' + o.numero + ' · ' + nomeCli + ' · ' + txt;
      const contra = (c, valor, historico) => ({ contaSubTitulo: c._id, codigoConta: c.codigo, nomeConta: c.nome,
                                                 historico, valor: valor / 100, cliente: o.cliente?.id || null });
      const dataB = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12, 0, 0);
      const boletas = [];
      const lancar = async (perna, contras, historico) => {
        const total = contras.reduce((s, x) => s + Math.round(x.valor * 100), 0);
        if (total <= 0) return;
        const [bt] = await Boleta.create([{
          codigo: 'BOL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), tipo: 'RECEBIMENTO', data: dataB,
          bancoSubTitulo: perna._id, bancoCodigo: perna.codigo, bancoNome: perna.nome, valorTotal: total / 100,
          contrapartidas: contras, historico, origem: 'VENDA', status: 'ATIVO', lojistaId: loja,
        }], { session });
        boletas.push(bt._id);
      };

      // ---- consignado: devolucao + usado (destino: venda adicional, complementar ou troca) ----
      const pedCons = new Map((Array.isArray(b.consignados) ? b.consignados : []).map(x => [String(x.id), x]));
      const prods = new Map((await col('arquivo_docs').find({ loja_id: loja,
        codigo: { $in: [...new Set((o.consignados || []).map(c => c.codigo))] } }, { session })
        .project({ codigo: 1, precocusto: 1 }).toArray()).map(p => [p.codigo, p]));
      const devolucoesConsignado = [], consResumo = [];
      let consCobrado = 0, consCobradoCusto = 0, consNaoCobradoCusto = 0;
      for (const c of o.consignados || []) {
        const ped = pedCons.get(String(c.id)) || {};
        const resta = (c.quantidade || 0) - (c.devolvido || 0);
        const dev = ped.devolver === undefined || ped.devolver === '' ? 0 : inteiro(ped.devolver);
        if (!Number.isFinite(dev) || dev > resta) throw erro(400, c.codigo + ' ' + (c.descricao || '') + ': devolução maior que o que está com o técnico (' + resta + ')');
        if (dev > 0) {
          devolucoesConsignado.push({ id: c.id, codigo: c.codigo, quantidade: dev });
          await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: loja, 'consignados.id': c.id }, {
            $inc: { 'consignados.$.devolvido': dev }, $push: { 'consignados.$.devolucoes': { quantidade: dev, em: agora, noFechamento: true } } }, { session });
          await col('arquivo_docs').updateOne({ loja_id: loja, codigo: c.codigo }, { $inc: { qte: dev }, $set: { atualizadoEm: agora } }, { session });
        }
        const usado = resta - dev;
        if (usado <= 0) continue;
        const custoUnit = centavos(prods.get(c.codigo)?.precocusto);
        const destino = DESTINOS.includes(ped.destino) ? ped.destino : (ped.cobrar === true ? 'VENDA' : '');
        if (!destino) throw erro(400, c.codigo + ' ' + (c.descricao || '') + ': escolha o destino do consignado usado (venda adicional, complementar ou troca)');
        const cobrar = destino === 'VENDA';
        consResumo.push({ id: c.id, codigo: c.codigo, descricao: c.descricao || '', usado, destino, cobrar,
                          precoUnit: c.precoUnit || 0, custoUnit });
        if (destino === 'VENDA') { consCobrado += usado * (c.precoUnit || 0); consCobradoCusto += usado * custoUnit; }
        else if (destino === 'COMPLEMENTAR') consNaoCobradoCusto += usado * custoUnit;
      }

      // ---- devolucao de material vendido ----
      const devolucoesVendido = [];
      let estornoPendente = 0;
      if (Array.isArray(b.vendidos) && b.vendidos.some(x => Number(x.devolver) > 0)) {
        const v = o.venda?.id ? await col('_vendas').findOne({ _id: o.venda.id, lojistaId: loja }, { session }) : null;
        if (!v) throw erro(400, 'OS sem venda: não há material vendido para devolver');
        for (const x of b.vendidos) {
          const dev = x.devolver === undefined || x.devolver === '' ? 0 : inteiro(x.devolver);
          if (!dev) continue;
          const it = (v.itens || []).find(i => Number(i.codigo) === Number(x.codigo));
          if (!it) throw erro(400, 'item ' + x.codigo + ' não está na venda');
          if (!Number.isFinite(dev) || dev > it.quantidade) throw erro(400, it.codigo + ': devolução maior que o vendido (' + it.quantidade + ')');
          const precoUnit = Math.round((it.quantidade * (it.precoUnitario || 0) - (it.desconto || 0)) / it.quantidade);
          const tratamento = ['ESTORNO', 'TROCA'].includes(x.tratamento) ? x.tratamento : 'RECEITA_EXTRA';
          devolucoesVendido.push({ codigo: it.codigo, descricao: it.descricao || '', quantidade: dev, precoUnit,
                                   valor: dev * precoUnit, tratamento });
          if (tratamento === 'ESTORNO') estornoPendente += dev * precoUnit;
          await col('arquivo_docs').updateOne({ loja_id: loja, codigo: it.codigo }, { $inc: { qte: dev }, $set: { atualizadoEm: agora } }, { session });
        }
      }

      // troca: tem que haver dos dois lados (consignado usado <-> vendido que voltou)
      const trocaCons = consResumo.some(c => c.destino === 'TROCA'), trocaVend = devolucoesVendido.some(x => x.tratamento === 'TROCA');
      if (trocaCons && !trocaVend) throw erro(400, 'consignado marcado como TROCA: informe na devolução de material vendido o que voltou (tratamento "troca")');
      if (trocaVend && !trocaCons) throw erro(400, 'devolução de vendido marcada como TROCA: marque no consignado o item que ficou no lugar');

      // ---- mao de obra ----
      const mo = modoMaoDeObra(o);
      if (mo.modo === 'OS') {
        const val = inteiro(b.maoDeObra);
        if (!Number.isFinite(val)) throw erro(400, 'valor da mão de obra inválido');
        mo.valor = val;
      }
      let empresa = 0, tecnico = 0;
      if (mo.modo !== 'JA_PARTILHADA' && mo.valor > 0) {
        empresa = inteiro(b.empresa);
        if (!Number.isFinite(empresa) || empresa > mo.valor) throw erro(400, 'a parte da empresa tem que ser de 0 até a mão de obra (' + (mo.valor / 100).toFixed(2).replace('.', ',') + ')');
        tecnico = mo.valor - empresa;
      }

      // ---- adicionais ----
      const adicionais = (Array.isArray(b.adicionais) ? b.adicionais : []).map(a => ({
        quem: a.quem === 'TECNICO' ? 'TECNICO' : 'CLIENTE', valor: inteiro(a.valor), motivo: t(a.motivo).slice(0, 120),
      })).filter(a => a.valor);
      for (const a of adicionais) {
        if (!Number.isFinite(a.valor)) throw erro(400, 'valor adicional inválido');
        if (!a.motivo) throw erro(400, 'informe o motivo do valor adicional');
      }
      const adCliente = adicionais.filter(a => a.quem === 'CLIENTE');
      const adTecnico = adicionais.filter(a => a.quem === 'TECNICO');

      // ---- lancamentos ----
      const precisaTec = tecnico > 0 || adTecnico.length;
      const cTec = precisaTec ? await conta(o.tecnicoConta) : null;
      const tecNome = o.tecnicoNome || o.tecnicoConta;
      // VI: a parte do tecnico sai da receita de servicos
      if (mo.modo === 'VENDA' && tecnico > 0) {
        await lancar(await conta(CONTA.RECEITA_SERVICO), [contra(cTec, tecnico, hist('mão de obra · parte de ' + tecNome))],
          hist('mão de obra (venda ' + (o.venda?.numero || '') + ') · parte do técnico ' + tecNome));
      }
      // adicional cobrado do tecnico
      if (adTecnico.length) {
        const cServ = await conta(CONTA.RECEITA_SERVICO);
        await lancar(cTec, adTecnico.map(a => contra(cServ, a.valor, hist('cobrado do técnico ' + tecNome + ': ' + a.motivo))),
          hist('cobrado do técnico ' + tecNome));
      }
      // consignado nao cobrado: despesa a custo
      if (consNaoCobradoCusto > 0) {
        await lancar(await conta(CONTA.MAT_COMPLEMENTAR), [contra(await conta(CONTA.ESTOQUE), consNaoCobradoCusto, hist('consignado usado, não cobrado (custo)'))],
          hist('material complementar (consignado não cobrado)'));
      }
      // consignado cobrado: custo da mercadoria
      if (consCobradoCusto > 0) {
        await lancar(await conta(CONTA.CPV), [contra(await conta(CONTA.ESTOQUE), consCobradoCusto, hist('consignado cobrado (custo)'))],
          hist('CPV do consignado cobrado'));
      }
      // o que e do cliente: um lancamento, fica a receber
      const contrasCli = [];
      if (consCobrado > 0) contrasCli.push(contra(await conta(CONTA.RECEITA_MATERIAL), consCobrado, hist('material (consignado usado)')));
      if (mo.modo === 'OS' && mo.valor > 0) {
        if (empresa > 0) contrasCli.push(contra(await conta(CONTA.RECEITA_SERVICO), empresa, hist('mão de obra · empresa')));
        if (tecnico > 0) contrasCli.push(contra(cTec, tecnico, hist('mão de obra · parte de ' + tecNome)));
      }
      if (adCliente.length) {
        const cServ = await conta(CONTA.RECEITA_SERVICO);
        for (const a of adCliente) contrasCli.push(contra(cServ, a.valor, hist('adicional: ' + a.motivo)));
      }
      const aReceber = contrasCli.reduce((s, x) => s + Math.round(x.valor * 100), 0);
      let fluxoId = null;
      if (aReceber > 0) {
        if (!o.cliente?.ncontabil) throw erro(400, 'o cliente não tem conta contábil: abra a ficha do cliente e crie a conta');
        const cCli = await conta(o.cliente.ncontabil);
        await lancar(cCli, contrasCli, hist('serviço a receber'));
        // 16/10/2026: fluxo de servico (pos 5, conta do cliente, vence no dia do termino)
        const venc = new Date(terminoEm.getFullYear(), terminoEm.getMonth(), terminoEm.getDate(), 12, 0, 0);
        const r = await col('_fluxo_projetado').insertOne({
          lojistaId: loja, ano: venc.getFullYear(), mes: venc.getMonth() + 1, pos: 5,
          contaSubTitulo: cCli._id, codigoConta: cCli.codigo, nomeConta: cCli.nome,
          historico: 'OS nº ' + o.numero + ' ' + nomeCli + ' · serviço',
          valor: aReceber / 100, vencimento: venc, parcela: 1, totalParcelas: 1,
          origem: 'OS', fluxo: 'SERVICO', lancamentoId: o._id, osNumero: o.numero,
          status: 'ATIVO', criadoEm: agora,
        }, { session });
        fluxoId = r.insertedId;
      }

      const semReceber = aReceber === 0;
      const fechamento = {
        em: agora, terminoEm, maoDeObra: { modo: mo.modo, valor: mo.valor, empresa, tecnico },
        consignados: consResumo, devolucoesConsignado, devolucoesVendido, estornoPendente,
        adicionais, aReceber, semReceber, boletas, fluxoId,
      };
      const set = {
        status: semReceber ? 'L' : 'E', fechamento, aReceber, terminoEm, terminoHora: h,
        concluidaEm: agora, atualizadoEm: agora,
      };
      if (semReceber) set.liquidadaEm = agora;
      if (mo.modo !== 'JA_PARTILHADA' && mo.valor > 0) { set.parteTecnico = tecnico; set.parteLoja = empresa; set.valorServico = mo.valor; }
      if ('observacaoServico' in b) set.observacaoServico = t(b.observacaoServico).slice(0, 2000);
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: loja, status: 'P' }, { $set: set }, { session });
    });
  } finally { session.endSession(); }
  res.json({ ok: true, ...(await dadosFechamento(await lerOS(req))) });
}));

module.exports = router;
