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
//   PUT  /:id/agenda                  { tecnicoConta, dia, horaIni, horaFim }  agenda/reagenda (14/10/2026)
// 13/10/2026: OS VI com servicoContabilizado (mao de obra cobrada e lancada na venda, com a
// partilha tecnico/loja): o valor do servico NAO muda pela OS.
// Dinheiro em CENTAVOS (arquivo_docs em reais: convertido aqui).
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
    // sem dia marcado, a hora nao vale (OS antigas gravadas com hora e sem dia)
    diaPrevisto: diaIso(o.diaPrevisto), horaIni: o.diaPrevisto ? o.horaIni || '' : '', horaFim: o.diaPrevisto ? o.horaFim || '' : '',
    endereco: o.endereco || {}, edificio: o.edificio || '', apto: o.apto || '',
    terminoEm: o.terminoEm || null, concluidaEm: o.concluidaEm || null, liquidadaEm: o.liquidadaEm || null,
    valorServico: o.valorServico || 0,
    servicoContabilizado: !!o.servicoContabilizado,          // VI: mao de obra ja lancada na venda
    servicoDescricao: o.servicoDescricao || '', parteTecnico: o.parteTecnico || 0, parteLoja: o.parteLoja || 0,
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
      const push = {};
      // troca de tecnico com a parte dele ja lancada
      if ((o.tecnicoConta || '') !== tecConta && o.servicoContabilizado && (o.parteTecnico || 0) > 0 && o.tecnicoConta) {
        if (!tec) throw erro(400, 'a mão de obra desta OS já foi lançada para ' + (o.tecnicoNome || o.tecnicoConta) + ': escolha outro técnico (não dá para deixar a definir)');
        const mo = o.valorServico || 0, antiga = o.parteTecnico;
        const sv = (tec.servicos || []).find(s => String(s.descricao || '').toLowerCase() === String(o.servicoDescricao || '').toLowerCase());
        const nova = sv ? (sv.modo === 'FIXO' ? Math.round(sv.valor || 0) : Math.round(mo * (Number(sv.valor) || 0) / 100)) : antiga;
        if (nova > mo) throw erro(400, 'o valor fixo do novo técnico é maior que a mão de obra');
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
      await col('_ordens_servico').updateOne({ _id: o._id, lojistaId: loja },
        Object.keys(push).length ? { $set: set, $push: push } : { $set: set }, { session });
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
