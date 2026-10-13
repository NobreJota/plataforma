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
//   GET  /lista?tipo=programadas|nprogramadas|pendentes|concluidas|liquidadas
//   GET  /:id
//   PUT  /:id                         { terminoDia, terminoHora, valorServico, observacaoServico }
//   POST /:id/consignados             { codigo, quantidade }          baixa o estoque
//   POST /:id/consignados/:cid/devolver  { quantidade }              repoe o estoque
//   POST /:id/fotos                   corpo = a imagem (image/jpeg)
//   GET  /:id/fotos/:arquivo
//   POST /:id/fotos/:arquivo/remover
//   POST /:id/concluir                P -> E (exige termino)
//   POST /:id/reabrir                 E -> P
// Dinheiro em CENTAVOS (arquivo_docs em reais: convertido aqui).
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const router = express.Router();

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
};

const diaIso = d => (d ? new Date(d).toISOString().slice(0, 10) : '');
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
    diaPrevisto: diaIso(o.diaPrevisto), horaIni: o.horaIni || '', horaFim: o.horaFim || '',
    endereco: o.endereco || {}, edificio: o.edificio || '', apto: o.apto || '',
    terminoEm: o.terminoEm || null, concluidaEm: o.concluidaEm || null, liquidadaEm: o.liquidadaEm || null,
    valorServico: o.valorServico || 0,
    totalConsignado: cons.reduce((t, c) => t + c.total, 0),
    programada: !!(o.tecnicoConta && o.diaPrevisto && o.horaIni),
  };
}

// ---------------------------------------------------------------------------
// GET /lista?tipo=   + contagem de cada aba
// ---------------------------------------------------------------------------
router.get('/lista', responder(async (req, res) => {
  const loja = lojaDe(req);
  const tipo = FILTROS[req.query.tipo] ? req.query.tipo : 'pendentes';
  const ordem = tipo === 'liquidadas' ? { liquidadaEm: -1, numero: -1 }
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
    itens: o.itens || [],
    consignados: consignadosDe(o),
    fotos: (o.fotos || []).filter(f => !f.removida).map(f => ({ arquivo: f.arquivo, enviadaEm: f.enviadaEm })),
  };
}
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
    set.terminoHora = d ? h : '';
  }
  if ('valorServico' in b) {
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
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId }, {
        $push: { consignados: { id: new mongoose.Types.ObjectId(), codigo, descricao: p.descricao || '',
                                referencia: p.referencia || '', quantidade: qtd, devolvido: 0,
                                precoUnit: centavos(p.precovista), saidaEm: agora } },
        $set: { atualizadoEm: agora } }, { session });
      await col('arquivo_docs').updateOne({ _id: p._id, loja_id: o.lojistaId },
        { $inc: { qte: -qtd }, $set: { atualizadoEm: agora } }, { session });
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
// concluir / reabrir
// ---------------------------------------------------------------------------
router.post('/:id/concluir', responder(async (req, res) => {
  const o = await lerOS(req);
  if (o.status !== 'P') throw erro(409, 'só OS pendente pode ser concluída');
  if (!o.terminoEm) throw erro(400, 'informe a data do término antes de concluir');
  if (!o.tecnicoConta) throw erro(400, 'OS sem técnico: escolha o técnico antes de concluir');
  await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, status: 'P' },
    { $set: { status: 'E', concluidaEm: new Date(), atualizadoEm: new Date() } });
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));
router.post('/:id/reabrir', responder(async (req, res) => {
  const o = await lerOS(req);
  if (o.status !== 'E') throw erro(409, 'só OS concluída (ainda não recebida) pode ser reaberta');
  await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: o.lojistaId, status: 'E' },
    { $set: { status: 'P', atualizadoEm: new Date() }, $unset: { concluidaEm: '' } });
  res.json({ ok: true, os: completa(await lerOS(req)) });
}));

module.exports = router;
