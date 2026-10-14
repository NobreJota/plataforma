// =============================================================================
// Destino: C:\plataformaRota\src\routes\vendas\tecnicos-api.js
// Criado em: 13/10/2026
// Alterado em: 13/10/2026 - tecnico novo so ganha 2.06.001.NNN (receita da loja = 4.05.001.001)
// Alterado em: 13/10/2026 - "pagamento" (percVI/percC/valorG) virou a lista SERVICOS do tecnico
//
// CADASTRO DE TECNICOS (terceirizados, MEI). Montado em /vendas/api/tecnicos
// (src\routes\vendas\pages.js). Colecao _tecnicos (o OS-2 traz os do Access).
//
// Cada tecnico tem UMA conta: 2.06.001.NNN (o que a loja deve a ele; paga na sexta).
// 13/10/2026: a receita de servico da loja e UMA conta so, 4.05.001.001 (PLANO-9), com
// "OS nº / tecnico" no historico. Tecnico novo NAO ganha mais 4.03.002.NNN; as antigas
// ficam como estao (historico de 2026). O NNN novo pula os finais ja usados nos dois
// titulos, para nunca repetir um final antigo.
// Tecnico ja existente: a conta nao muda pela tela.
//
// SERVICOS DO TECNICO (13/10/2026, decisao do Jorge): a partilha e definida ANTES, na ficha.
// Cada linha: { id, descricao (texto livre, ex. "Instalação aquecedor"), modo, valor }
//   modo PERC  valor = % do TECNICO sobre a mao de obra (ex. 80 -> de 200,00 ele fica com 160,00)
//   modo FIXO  valor = quanto o tecnico recebe por servico, em centavos (ex. garantia)
// Na venda/OS escolhe-se a linha; a divisao tecnico x loja sai daqui. Mudou a regra:
// muda na ficha (nao na hora de fechar a venda).
//
// Nada e apagado: inativar (ativo = false). Tecnico inativo some dos combos.
//
// Rotas:
//   GET  /            todos (?ativos=1 so os ativos)
//   GET  /:id
//   POST /            novo (cria as duas contas)
//   PUT  /:id         altera o cadastro
//   POST /:id/ativo   { ativo: true|false }
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
router.use(express.json());

const col = n => mongoose.connection.collection(n);
const lojaDe = req => new mongoose.Types.ObjectId(req.lojistaId);
const oid = s => (mongoose.Types.ObjectId.isValid(String(s)) ? new mongoose.Types.ObjectId(String(s)) : null);
const TIT_TECNICO = '2.06.001';

const erro = (status, msg) => Object.assign(new Error(msg), { status });
const responder = fn => async (req, res) => {
  try { await fn(req, res); } catch (err) {
    if (!err.status) console.error('[tecnicos-api]', err.message);
    res.status(err.status || (err.code === 11000 ? 409 : 500))
      .json({ ok: false, erro: err.code === 11000 ? 'registro repetido, tente de novo' : err.message });
  }
};

const t = v => String(v ?? '').trim();
const so = v => t(v).replace(/\D/g, '');
const MODOS = ['PERC', 'FIXO'];
const perc = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : 0; };

// o que vem da tela, limpo (so os campos conhecidos)
function lerCadastro(b) {
  const e = b.endereco || {}, pix = b.pix || {}, bc = b.banco || {};
  const servicos = (Array.isArray(b.servicos) ? b.servicos : []).map(x => {
    const modo = MODOS.includes(x.modo) ? x.modo : 'PERC';
    return { id: oid(x.id) || new mongoose.Types.ObjectId(), descricao: t(x.descricao).slice(0, 80), modo,
             valor: modo === 'PERC' ? perc(x.valor) : Math.max(0, Math.round(Number(x.valor) || 0)) };
  }).filter(x => x.descricao);
  const d = {
    nome: t(b.nome), apelido: t(b.apelido),
    cpf: so(b.cpf), rg: t(b.rg), nascimento: /^\d{4}-\d{2}-\d{2}$/.test(t(b.nascimento)) ? t(b.nascimento) : '',
    mei: { cnpj: so(b.mei?.cnpj), razaoSocial: t(b.mei?.razaoSocial), inscricaoMunicipal: t(b.mei?.inscricaoMunicipal) },
    telefone: t(b.telefone), celular: t(b.celular), whatsapp: so(b.whatsapp), email: t(b.email).toLowerCase(),
    endereco: { logradouro: t(e.logradouro), numero: t(e.numero), complemento: t(e.complemento), bairro: t(e.bairro),
                cidade: t(e.cidade), uf: t(e.uf).toUpperCase().slice(0, 2), cep: so(e.cep) },
    pix: { tipo: ['CPF', 'CNPJ', 'CELULAR', 'EMAIL', 'ALEATORIA'].includes(pix.tipo) ? pix.tipo : '', chave: t(pix.chave) },
    banco: { banco: t(bc.banco), agencia: t(bc.agencia), conta: t(bc.conta) },
    servicos,
    observacao: t(b.observacao).slice(0, 2000),
  };
  if (!d.nome) throw erro(400, 'informe o nome do técnico');
  if (d.cpf && d.cpf.length !== 11) throw erro(400, 'CPF com 11 números');
  if (d.mei.cnpj && d.mei.cnpj.length !== 14) throw erro(400, 'CNPJ do MEI com 14 números');
  const nomes = new Set();
  for (const x of d.servicos) {
    const k = x.descricao.toLowerCase();
    if (nomes.has(k)) throw erro(400, 'serviço repetido na ficha: ' + x.descricao);
    nomes.add(k);
  }
  return d;
}

const saida = x => ({ ...x, id: String(x._id), _id: undefined, lojistaId: undefined,
  servicos: (x.servicos || []).map(s => ({ ...s, id: String(s.id) })) });

router.get('/', responder(async (req, res) => {
  const f = { lojistaId: lojaDe(req) };
  if (req.query.ativos === '1') f.ativo = { $ne: false };
  const docs = await col('_tecnicos').find(f).sort({ ativo: -1, nome: 1 }).toArray();
  res.json({ ok: true, tecnicos: docs.map(saida) });
}));

router.get('/:id', responder(async (req, res) => {
  const id = oid(req.params.id); if (!id) throw erro(400, 'técnico inválido');
  const x = await col('_tecnicos').findOne({ _id: id, lojistaId: lojaDe(req) });
  if (!x) throw erro(404, 'técnico não encontrado');
  res.json({ ok: true, tecnico: saida(x) });
}));

// proximo final livre (olha 2.06.001 e as antigas 4.03.002; conta suspensa tambem conta)
async function proximoFinal(loja, session) {
  const titulo = await col('_contatitulos').findOne({ lojistaId: loja, codigo: TIT_TECNICO }, { session });
  if (!titulo) throw erro(404, 'título ' + TIT_TECNICO + ' não encontrado no plano de contas');
  const subs = await col('_contasubtitulos').find({ lojistaId: loja,
    codigo: { $regex: '^(2\\.06\\.001|4\\.03\\.002)\\.\\d+$' } }, { session }).project({ codigo: 1 }).toArray();
  const maior = subs.reduce((m, s) => Math.max(m, Number(s.codigo.split('.').pop()) || 0), 0);
  if (maior >= 999) throw erro(409, 'os títulos de técnico chegaram ao 999');
  return { final: String(maior + 1).padStart(3, '0'), titulo };
}

router.post('/', responder(async (req, res) => {
  const loja = lojaDe(req);
  const d = lerCadastro(req.body || {});
  let novo = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (d.cpf && await col('_tecnicos').findOne({ lojistaId: loja, cpf: d.cpf }, { session })) throw erro(409, 'já existe técnico com esse CPF');
      const { final, titulo } = await proximoFinal(loja, session);
      const agora = new Date();
      const contaTecnico = TIT_TECNICO + '.' + final;
      await col('_contasubtitulos').insertOne({
        contaTituloId: titulo._id, codigoContaTitulo: TIT_TECNICO, codigo: contaTecnico, nome: d.nome, descricao: 'técnico',
        saldoInicial: 0, natureza: 'credora', ativo: true, criadoEm: agora, atualizadoEm: agora, __v: 0, lojistaId: loja,
      }, { session });
      const ult = await col('_tecnicos').find({ lojistaId: loja }, { session }).sort({ numero: -1 }).limit(1).project({ numero: 1 }).toArray();
      const doc = { lojistaId: loja, numero: (ult[0]?.numero || 0) + 1, ...d,
                    contaTecnico,
                    ativo: true, origem: 'PLATAFORMA', criadoEm: agora, atualizadoEm: agora };
      const r = await col('_tecnicos').insertOne(doc, { session });
      novo = { ...doc, _id: r.insertedId };
    });
  } finally { session.endSession(); }
  res.status(201).json({ ok: true, tecnico: saida(novo) });
}));

router.put('/:id', responder(async (req, res) => {
  const loja = lojaDe(req);
  const id = oid(req.params.id); if (!id) throw erro(400, 'técnico inválido');
  const d = lerCadastro(req.body || {});
  if (d.cpf && await col('_tecnicos').findOne({ lojistaId: loja, cpf: d.cpf, _id: { $ne: id } })) throw erro(409, 'já existe técnico com esse CPF');
  const r = await col('_tecnicos').findOneAndUpdate({ _id: id, lojistaId: loja },
    { $set: { ...d, atualizadoEm: new Date() }, $unset: { pagamento: '' } }, { returnDocument: 'after' });
  const x = r && r.value !== undefined ? r.value : r;
  if (!x) throw erro(404, 'técnico não encontrado');
  res.json({ ok: true, tecnico: saida(x) });
}));

router.post('/:id/ativo', responder(async (req, res) => {
  const id = oid(req.params.id); if (!id) throw erro(400, 'técnico inválido');
  const ativo = req.body?.ativo === true;
  const r = await col('_tecnicos').findOneAndUpdate({ _id: id, lojistaId: lojaDe(req) },
    { $set: { ativo, atualizadoEm: new Date() } }, { returnDocument: 'after' });
  const x = r && r.value !== undefined ? r.value : r;
  if (!x) throw erro(404, 'técnico não encontrado');
  res.json({ ok: true, tecnico: saida(x) });
}));

module.exports = router;
