// =============================================================================
// Destino: C:\plataformaRota\src\routes\vendas\venda-api.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - /clientes devolve endereco completo, telefone e e-mail (cabecalho)
// Alterado em: 02/10/2026 - GET /loja (cabecalho do cupom)
// Alterado em: 02/10/2026 - fornecedor e FILTRO separado (?fornecedor=marca), nao entra na busca
//              de texto; GET /fornecedores para o combo
// Alterado em: 03/10/2026 - /fornecedores: ha produto com NUMERO em `fornecedor` e o sort quebrava
//              (a.localeCompare is not a function); tudo vira texto. /produtos casa o filtro
//              como texto ou numero
// Alterado em: 03/10/2026 - combo so com MARCA (texto): produtos antigos com ObjectId em
//              `fornecedor` ficam fora do combo (continuam achados pela busca)
// Alterado em: 03/10/2026 - combo vem de _fornec_access ATIVO (so quem tem produto), valor =
//              nrFornec, texto = marca; /produtos filtra por nrFornec. Produtos antigos da
//              plataforma (codigo em TEXTO, 203 docs) ficam fora da busca
// Alterado em: 03/10/2026 - GET /relatorio?ano=&mes= (mes 0 = ano todo) para a tela
//              Venda > Relatorios; vem ANTES de GET /:id
// Alterado em: 03/10/2026 - PARTE 2, FECHAR A VENDA: GET /formas e POST /:id/fechar
//   a vista:  DINHEIRO (caixa 1.01.001.001) · PIX (banco com recebeVenda) ·
//             DEBITO (cartao 1.01.005.xxx: 1 linha pos 5 no dia seguinte)
//   a prazo:  CREDITO (cartao, 1 a 10x de 30 em 30 dias, pos 5) ·
//             TITULO (so PJ com NF: pos 5 na conta do cliente)
//   NFE:   boleta cliente x receita (4.01.001.001 vista / 4.02.001.001 prazo)
//          + boleta destino x cliente (menos TITULO, que fica a receber)
//   CUPOM: soma no lancamento DIARIO "Vendas balcao" da conta de destino
//   estoque baixado; tudo numa transacao (ou grava tudo, ou nada)
// Alterado em: 03/10/2026 - DEBITO entra no DIA SEGUINTE (nao tem antecipacao)
// Alterado em: 05/10/2026 - TITULO (so PJ com NF) fica em cobranca no Banestes/Armacao
//              (1.01.002.002): guardado em pagamentos[].contaDestino; o recebimento no
//              fluxo trava esse banco
// Alterado em: 05/10/2026 - GET /clientes?tipo=PF|PJ procura so aquele tipo
// Alterado em: 05/10/2026 - GET /clientes paginado (&pagina=N, 20 por pagina; devolve total)
// Alterado em: 05/10/2026 - CONTA CONTABIL DO CLIENTE pela tela da venda:
//   GET  /contas-cliente?tipo=PF|PJ&busca=   subtitulos (PF 1.03 · PJ 1.04) e quem ja usa
//   GET  /titulos-cliente?tipo=PF|PJ         titulos onde criar conta nova
//   POST /clientes/:id/conta      { codigo }          liga uma conta existente
//   POST /clientes/:id/conta-nova { titulo, nome }    cria o subtitulo (proximo numero) e liga
//   GET  /clientes/:id/ficha · POST /clientes/:id/ficha   ficha do cliente (com a conta)
// Alterado em: 07/10/2026 - PAGAMENTO EM MAIS DE UMA FORMA: POST /:id/fechar recebe
//   { pagamentos: [{ forma, valor (centavos), contaBancaria?, cartao?, parcelas? }] } e a soma
//   tem que dar o total. Cada parte vai para o seu destino (cupom: soma no "Vendas balcao" do
//   dia de cada conta; NF: um recebimento por parte). Venda A VISTA aceita tambem cartao de
//   CREDITO parcelado (preco a vista). O formato antigo { forma, ... } continua valendo.
// Alterado em: 07/10/2026 - CANCELAR VENDA e relatorio so das EMITIDAS:
//   GET  /relatorio   so vendas fechadas (F) e canceladas (C), pela data do fechamento
//   GET  /:id/espelho a venda + as parcelas dela no fluxo (aberta / recebida / cancelada)
//   POST /:id/cancelar { motivo }  numa TRANSACAO: devolve o estoque, cancela as parcelas
//        pos 5, cancela as boletas da NF (ou tira o valor do "Vendas balcao" do dia) e marca
//        a venda C. BLOQUEADO se alguma parcela ja foi recebida: estorne o recebimento antes.
//
// API da VENDA — Parte 1: buscar produto e cliente, abrir, alterar e listar
// vendas ABERTAS (situacao A). Fechar (pagamento, estoque, fluxo, lancamento
// do balcao) e a Parte 2.
//
// Montado em /vendas/api/venda  (ver src/routes/vendas/pages.js)
//
// O preco, o custo e os dados fiscais de cada item SAO DO SERVIDOR: a tela
// manda so codigo, quantidade e desconto; o resto sai do cadastro
// (arquivo_docs), pela condicao da venda (a vista ou a prazo).
// Dinheiro em CENTAVOS na venda; o cadastro do produto guarda REAIS.
// =============================================================================

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const Venda = require('../../models/vendas/venda');
const Boleta = require('../../models/contab/financeiro/boleta');
const FluxoProjetado = require('../../models/contab/financeiro/fluxoProjetado');
const { CONTAS, HISTORICO_BALCAO } = Venda;
const ContaSubTitulo = require('../../models/contab/financeiro/contaSubTitulo');

// grupo das contas de cliente: pessoa fisica 1.03, pessoa juridica 1.04
const GRUPO_CLIENTE = { PF: '1.03', PJ: '1.04' };
const grupoDoTipo = t => GRUPO_CLIENTE[String(t || '').toUpperCase()] || null;

const router = express.Router();
router.use(express.json());

const col = n => mongoose.connection.collection(n);
const lojaDe = req => new mongoose.Types.ObjectId(req.lojistaId);
const centavos = v => Math.round((Number(v) || 0) * 100);
const escapar = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// GET /produtos?busca=   codigo exato, ou 2+ letras na descricao/referencia
// ---------------------------------------------------------------------------
router.get('/produtos', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const busca = String(req.query.busca || '').trim();
    const fornecedor = String(req.query.fornecedor || '').trim();
    // sem fornecedor escolhido, precisa de 2 letras ou de um codigo
    if (!fornecedor && busca.length < 2 && !/^\d+$/.test(busca)) return res.json({ ok: true, produtos: [] });

    // codigo NUMERO: os produtos antigos da plataforma (codigo em texto) nao entram
    const filtro = { loja_id: loja, ativo: { $ne: false }, codigo: { $type: 'number' } };
    if (fornecedor) filtro.nrFornec = Number(fornecedor) || -1;   // o combo manda o nrFornec
    if (busca) {                                             // a busca e SO no produto
      const rx = new RegExp(escapar(busca), 'i');
      filtro.$or = [{ descricao: rx }, { referencia: rx }, { referencia2: rx }, { descricaoTecnica: rx }];
      if (/^\d+$/.test(busca)) filtro.$or.unshift({ codigo: Number(busca) });
    }

    const docs = await col('arquivo_docs').find(filtro)
      .project({ codigo: 1, descricao: 1, descricaoTecnica: 1, referencia: 1, marcaproduto: 1,
                 fornecedor: 1, qte: 1, precovista: 1, precoprazo: 1 })
      .sort({ descricao: 1 }).limit(fornecedor && !busca ? 300 : 30).toArray();

    // codigo digitado exato vem primeiro
    docs.sort((a, b) => (b.codigo === Number(busca)) - (a.codigo === Number(busca)));

    res.json({ ok: true, produtos: docs.map(p => ({
      codigo: p.codigo, descricao: p.descricao || '', descricaoTecnica: p.descricaoTecnica || '',
      referencia: p.referencia || '', marca: p.marcaproduto || p.fornecedor || '', estoque: Number(p.qte) || 0,
      precoVista: centavos(p.precovista), precoPrazo: centavos(p.precoprazo),
    })) });
  } catch (err) {
    console.error('[vendas/produtos]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /fornecedores   para o combo: fornecedores ATIVOS no Access (_fornec_access)
// que tem produto nesta empresa. Devolve { nr, marca }; o combo mostra a marca.
// ---------------------------------------------------------------------------
router.get('/fornecedores', async (req, res) => {
  try {
    const comProduto = new Set((await col('arquivo_docs').distinct('nrFornec',
      { loja_id: lojaDe(req), ativo: { $ne: false } })).map(Number));
    const ativos = await col('_fornec_access').find({ ativo: { $ne: false } })
      .project({ nrFornec: 1, marca: 1 }).toArray();
    const lista = ativos
      .map(f => ({ nr: Number(f.nrFornec), marca: String(f.marca ?? '').trim() }))
      .filter(f => f.nr && f.marca && comProduto.has(f.nr))
      .sort((a, b) => a.marca.localeCompare(b.marca, 'pt-BR'));
    res.json({ ok: true, fornecedores: lista });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /loja   os dados da empresa para o cabecalho do cupom. O cadastro do
// lojista tem nomes de campo variados: pega o primeiro que existir.
// ---------------------------------------------------------------------------
router.get('/loja', async (req, res) => {
  try {
    const l = await col('lojistas').findOne({ _id: lojaDe(req) }) || {};
    const um = (...v) => v.find(x => x !== undefined && x !== null && String(x).trim() !== '') || '';
    const e = l.endereco || l.address || {};
    res.json({ ok: true, loja: {
      razao: um(l.razaoSocial, l.razao, l.nome),
      fantasia: um(l.marca, l.nomeFantasia, l.fantasia),
      cnpj: um(l.cnpj, l.cpfCnpj, l.documento),
      ie: um(l.inscricaoEstadual, l.ie, l.inscricao),
      logradouro: um(e.logradouro, e.rua, l.logradouro, l.endereco && typeof l.endereco === 'string' ? l.endereco : ''),
      numero: um(e.numero, l.numero),
      complemento: um(e.complemento, l.complemento),
      bairro: um(e.bairro, l.bairro),
      cidade: um(e.cidade, l.cidade),
      uf: um(e.uf, e.estado, l.uf, l.estado),
      cep: um(e.cep, l.cep),
      telefone: um(l.telefone, l.fone, l.celular),
    } });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /clientes?busca=   2+ letras no nome, numero do Access, F/J+numero, CPF/CNPJ
// ---------------------------------------------------------------------------
router.get('/clientes', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const busca = String(req.query.busca || '').trim();
    if (busca.length < 2) return res.json({ ok: true, clientes: [], total: 0, pagina: 1, paginas: 1 });

    const ou = [{ nome: new RegExp(escapar(busca), 'i') }];
    const m = /^([FJ]?)(\d+)$/i.exec(busca);
    if (m) {
      ou.push({ nrAccess: Number(m[2]) });
      if (m[1]) ou.push({ codigo: m[1].toUpperCase() + m[2] });
    }
    const dig = busca.replace(/\D/g, '');
    if (dig.length >= 5) ou.push({ cpfCnpj: new RegExp(dig) });

    const filtro = { lojistaId: loja, ativo: { $ne: false }, $or: ou };
    const tipo = String(req.query.tipo || '').toUpperCase();
    if (tipo === 'PF' || tipo === 'PJ') filtro.tipo = tipo;      // so o tipo escolhido na tela
    const POR_PAGINA = 20;
    const total = await col('_aux_clientes').countDocuments(filtro);
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const pagina = Math.min(paginas, Math.max(1, Math.floor(Number(req.query.pagina) || 1)));
    const docs = await col('_aux_clientes').find(filtro)
      .sort({ nome: 1 }).skip((pagina - 1) * POR_PAGINA).limit(POR_PAGINA).toArray();

    res.json({ ok: true, total, pagina, paginas, porPagina: POR_PAGINA, clientes: docs.map(c => ({
      id: c._id, codigo: c.codigo || '', tipo: c.tipo || '', nome: c.nome || '',
      documento: c.cpfCnpj || '', ie: c.inscricaoEstadual || '', ncontabil: c.ncontabil || '',
      telefone: c.telefone || '', email: c.email || '',
      logradouro: c.enderecoCobranca?.logradouro || '', numero: c.enderecoCobranca?.numero || '',
      complemento: c.enderecoCobranca?.complemento || '', bairro: c.enderecoCobranca?.bairro || '',
      cidade: c.enderecoCobranca?.cidade || '', uf: c.enderecoCobranca?.uf || '', cep: c.enderecoCobranca?.cep || '',
    })) });
  } catch (err) {
    console.error('[vendas/clientes]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// CONTA CONTABIL DO CLIENTE
// ---------------------------------------------------------------------------
const clienteDaLoja = async (loja, id) => mongoose.Types.ObjectId.isValid(id)
  ? col('_aux_clientes').findOne({ _id: new mongoose.Types.ObjectId(id), lojistaId: loja }) : null;

// GET /contas-cliente?tipo=PF&busca=texto   (nome ou codigo da conta)
router.get('/contas-cliente', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const grupo = grupoDoTipo(req.query.tipo);
    if (!grupo) return res.status(400).json({ ok: false, erro: 'tipo de cliente inválido' });
    const busca = String(req.query.busca || '').trim();
    if (busca.length < 2) return res.json({ ok: true, contas: [] });
    const filtro = { lojistaId: loja, codigo: new RegExp('^' + escapar(grupo) + '\\.') };
    filtro.$or = /^[\d.]+$/.test(busca)
      ? [{ codigo: new RegExp('^' + escapar(busca)) }]
      : [{ nome: new RegExp(escapar(busca), 'i') }];
    const contas = await col('_contasubtitulos').find(filtro).sort({ nome: 1 }).limit(40).toArray();
    const usos = await col('_aux_clientes').find({ lojistaId: loja, ncontabil: { $in: contas.map(c => c.codigo) } })
      .project({ codigo: 1, nome: 1, ncontabil: 1 }).toArray();
    const porConta = new Map(usos.map(u => [u.ncontabil, u]));
    res.json({ ok: true, contas: contas.map(c => ({
      codigo: c.codigo, nome: c.nome, ativo: c.ativo !== false,
      usadoPor: porConta.has(c.codigo) ? porConta.get(c.codigo).codigo + ' ' + porConta.get(c.codigo).nome : '',
    })) });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// GET /titulos-cliente?tipo=PF   titulos do grupo, para criar conta nova
router.get('/titulos-cliente', async (req, res) => {
  try {
    const grupo = grupoDoTipo(req.query.tipo);
    if (!grupo) return res.status(400).json({ ok: false, erro: 'tipo de cliente inválido' });
    const titulos = await col('_contatitulos')
      .find({ lojistaId: lojaDe(req), codigo: new RegExp('^' + escapar(grupo) + '\\.'), ativo: { $ne: false } })
      .sort({ codigo: 1 }).toArray();
    res.json({ ok: true, grupo, titulos: titulos.map(t => ({ codigo: t.codigo, nome: t.nome })) });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// confere a conta que vai para o cliente: grupo do tipo, existe, ativa, nao e de outro
async function conferirConta(loja, c, codigo, forcar) {
  const grupo = grupoDoTipo(c.tipo);
  if (!grupo || !codigo.startsWith(grupo + '.')) {
    return { status: 400, erro: 'conta de cliente ' + (c.tipo || '') + ' começa com ' + (grupo || '1.03/1.04') };
  }
  const sub = await col('_contasubtitulos').findOne({ lojistaId: loja, codigo });
  if (!sub) return { status: 404, erro: 'a conta ' + codigo + ' não está no plano' };
  if (sub.ativo === false) return { status: 409, erro: 'a conta ' + codigo + ' está suspensa' };
  const outro = await col('_aux_clientes').findOne({ lojistaId: loja, ncontabil: codigo, _id: { $ne: c._id } });
  if (outro && !forcar) return { status: 409, erro: 'a conta ' + codigo + ' já é do cliente ' + outro.codigo + ' ' + outro.nome, emUso: true };
  return { sub };
}

// GET /clientes/:id/ficha   todos os dados do cliente (para editar na venda)
router.get('/clientes/:id/ficha', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const c = await clienteDaLoja(loja, req.params.id);
    if (!c) return res.status(404).json({ ok: false, erro: 'cliente não encontrado' });
    const e = c.enderecoCobranca || {};
    let nomeConta = '';
    if (c.ncontabil) nomeConta = (await col('_contasubtitulos').findOne({ lojistaId: loja, codigo: c.ncontabil }))?.nome || '';
    res.json({ ok: true, ficha: {
      id: c._id, codigo: c.codigo || '', tipo: c.tipo || '', nome: c.nome || '', documento: c.cpfCnpj || '',
      ie: c.inscricaoEstadual || '', telefone: c.telefone || '', email: c.email || '',
      logradouro: e.logradouro || '', numero: e.numero || '', complemento: e.complemento || '',
      bairro: e.bairro || '', cidade: e.cidade || '', uf: e.uf || '', cep: e.cep || '',
      ncontabil: c.ncontabil || '', nomeConta,
    } });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /clientes/:id/ficha   grava a ficha (codigo, tipo e CPF/CNPJ nao mudam aqui)
router.post('/clientes/:id/ficha', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const c = await clienteDaLoja(loja, req.params.id);
    if (!c) return res.status(404).json({ ok: false, erro: 'cliente não encontrado' });
    const b = req.body || {};
    const txt = k => String(b[k] ?? '').trim();
    if (!txt('nome')) return res.status(400).json({ ok: false, erro: 'o nome não pode ficar vazio' });
    const set = {
      nome: txt('nome'), inscricaoEstadual: txt('ie'), telefone: txt('telefone'), email: txt('email'),
      'enderecoCobranca.logradouro': txt('logradouro'), 'enderecoCobranca.numero': txt('numero'),
      'enderecoCobranca.complemento': txt('complemento'), 'enderecoCobranca.bairro': txt('bairro'),
      'enderecoCobranca.cidade': txt('cidade'), 'enderecoCobranca.uf': txt('uf').toUpperCase(),
      'enderecoCobranca.cep': txt('cep').replace(/\D/g, ''),
      atualizadoEm: new Date(),
    };
    const conta = txt('ncontabil');
    let nomeConta = '';
    if (conta) {
      const r = await conferirConta(loja, c, conta, !!b.forcar);
      if (r.erro) return res.status(r.status).json({ ok: false, erro: r.erro, emUso: !!r.emUso });
      set.ncontabil = conta; nomeConta = r.sub.nome;
    } else {
      set.ncontabil = '';
    }
    await col('_aux_clientes').updateOne({ _id: c._id, lojistaId: loja }, { $set: set });
    res.json({ ok: true, ncontabil: set.ncontabil, nomeConta });
  } catch (err) {
    console.error('[vendas/cliente/ficha]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /clientes/:id/conta   { codigo, forcar? }   liga uma conta que ja existe
router.post('/clientes/:id/conta', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const c = await clienteDaLoja(loja, req.params.id);
    if (!c) return res.status(404).json({ ok: false, erro: 'cliente não encontrado' });
    const codigo = String(req.body?.codigo || '').trim();
    const r = await conferirConta(loja, c, codigo, !!req.body?.forcar);
    if (r.erro) return res.status(r.status).json({ ok: false, erro: r.erro, emUso: !!r.emUso });
    const sub = r.sub;
    await col('_aux_clientes').updateOne({ _id: c._id, lojistaId: loja }, { $set: { ncontabil: codigo, atualizadoEm: new Date() } });
    res.json({ ok: true, ncontabil: codigo, nomeConta: sub.nome });
  } catch (err) {
    console.error('[vendas/cliente/conta]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /clientes/:id/conta-nova   { titulo, nome }   cria no titulo (proximo numero) e liga
router.post('/clientes/:id/conta-nova', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const c = await clienteDaLoja(loja, req.params.id);
    if (!c) return res.status(404).json({ ok: false, erro: 'cliente não encontrado' });
    if (c.ncontabil) return res.status(409).json({ ok: false, erro: 'o cliente já tem a conta ' + c.ncontabil });
    const grupo = grupoDoTipo(c.tipo);
    const tituloCod = String(req.body?.titulo || '').trim();
    if (!grupo || !tituloCod.startsWith(grupo + '.')) {
      return res.status(400).json({ ok: false, erro: 'escolha um título do grupo ' + (grupo || '1.03/1.04') });
    }
    const titulo = await col('_contatitulos').findOne({ lojistaId: loja, codigo: tituloCod, ativo: { $ne: false } });
    if (!titulo) return res.status(404).json({ ok: false, erro: 'título ' + tituloCod + ' não encontrado' });
    const nome = String(req.body?.nome || c.nome || '').trim();
    if (!nome) return res.status(400).json({ ok: false, erro: 'informe o nome da conta' });

    // proximo numero do titulo (contando as suspensas: numero nao se reaproveita)
    const irmas = await col('_contasubtitulos').find({ lojistaId: loja, codigo: new RegExp('^' + escapar(tituloCod) + '\\.\\d+$') })
      .project({ codigo: 1 }).toArray();
    const maior = irmas.reduce((m, s) => Math.max(m, Number(s.codigo.split('.').pop()) || 0), 0);
    if (maior >= 999) return res.status(409).json({ ok: false, erro: 'o título ' + tituloCod + ' já chegou ao 999' });
    const codigo = tituloCod + '.' + String(maior + 1).padStart(3, '0');

    const sub = await ContaSubTitulo.create({
      contaTituloId: titulo._id, codigoContaTitulo: titulo.codigo, codigo, nome, descricao: '',
      saldoInicial: 0, natureza: 'devedora', ativo: true, lojistaId: loja,
    });
    await col('_aux_clientes').updateOne({ _id: c._id, lojistaId: loja }, { $set: { ncontabil: codigo, atualizadoEm: new Date() } });
    res.status(201).json({ ok: true, ncontabil: codigo, nomeConta: sub.nome });
  } catch (err) {
    console.error('[vendas/cliente/conta-nova]', err);
    res.status(err.code === 11000 ? 409 : 500).json({ ok: false, erro: err.code === 11000 ? 'conta repetida, tente de novo' : err.message });
  }
});

// ---------------------------------------------------------------------------
// Monta a venda a partir do que a tela mandou: itens e cliente saem do cadastro
// ---------------------------------------------------------------------------
async function montar(req, venda) {
  const loja = lojaDe(req);
  const b = req.body || {};

  venda.documento = b.documento === 'NFE' ? 'NFE' : 'CUPOM';
  venda.condicao = b.condicao === 'PRAZO' ? 'PRAZO' : 'VISTA';
  venda.local = b.local === 'CAIXA' ? 'CAIXA' : 'BALCAO';
  venda.ocCliente = String(b.ocCliente || '').trim();
  venda.observacao = String(b.observacao || '').trim();
  venda.descontoGeral = Math.max(0, Math.round(Number(b.descontoGeral) || 0));

  // cliente
  if (b.clienteId && mongoose.Types.ObjectId.isValid(b.clienteId)) {
    const c = await col('_aux_clientes').findOne({ _id: new mongoose.Types.ObjectId(b.clienteId), lojistaId: loja });
    if (!c) throw new Error('cliente não encontrado');
    const e = c.enderecoCobranca || {};
    venda.cliente = {
      id: c._id, codigo: c.codigo || '', tipo: c.tipo || '', nome: c.nome || '',
      documento: c.cpfCnpj || '', ie: c.inscricaoEstadual || '', ncontabil: c.ncontabil || '',
      endereco: { logradouro: e.logradouro || '', numero: e.numero || '', complemento: e.complemento || '',
                  bairro: e.bairro || '', cidade: e.cidade || '', uf: e.uf || '', cep: e.cep || '' },
    };
  } else {
    venda.cliente = { id: null, codigo: '', tipo: '', nome: '', documento: '', ie: '', ncontabil: '', endereco: {} };
  }
  if (venda.documento === 'NFE' && !venda.cliente.id) throw new Error('nota fiscal precisa de cliente');
  if (venda.cliente.tipo !== 'PJ') venda.ocCliente = '';

  // itens: precos e dados fiscais do cadastro
  const pedidos = Array.isArray(b.itens) ? b.itens : [];
  const codigos = [...new Set(pedidos.map(i => Number(i.codigo)).filter(Boolean))];
  const prods = new Map((await col('arquivo_docs').find({ loja_id: loja, codigo: { $in: codigos } }).toArray())
    .map(p => [p.codigo, p]));

  venda.itens = pedidos.map(i => {
    const p = prods.get(Number(i.codigo));
    if (!p) throw new Error('produto ' + i.codigo + ' não está cadastrado');
    const qtd = Math.floor(Number(i.quantidade) || 0);
    if (qtd < 1) throw new Error('quantidade inválida no produto ' + p.codigo);
    const preco = centavos(venda.condicao === 'PRAZO' ? (p.precoprazo || p.precovista) : p.precovista);
    return {
      codigo: p.codigo, codigoNota: String(p.codigoNota || ''),
      descricao: p.descricao || '', descricaoTecnica: p.descricaoTecnica || '',
      referencia: p.referencia || '', unidade: 'PC',
      ncm: String(p.ncm || ''), csosn: String(p.csosn || ''), cfop: String(p.cfop_nfe || ''),
      quantidade: qtd, precoUnitario: preco,
      desconto: Math.min(qtd * preco, Math.max(0, Math.round(Number(i.desconto) || 0))),
      custoUnitario: centavos(p.precocusto),
      precisaInstalacao: !!i.precisaInstalacao,
    };
  });
  venda.recalcular();
  if (venda.descontoGeral > venda.totalBruto) throw new Error('desconto maior que o total');
}

// ---------------------------------------------------------------------------
// GET /abertas   as vendas em aberto, da mais recente
// ---------------------------------------------------------------------------
router.get('/abertas', async (req, res) => {
  try {
    const vendas = await Venda.find({ lojistaId: lojaDe(req), situacao: 'A' })
      .sort({ data: -1 }).limit(100)
      .select('numero data documento condicao cliente.nome cliente.codigo totalLiquido itens.codigo');
    res.json({ ok: true, vendas });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /relatorio?ano=2026&mes=10   vendas do mes (mes=0: o ano todo), da mais
// antiga para a mais recente. Valores em CENTAVOS. Devolve tambem os anos que
// tem venda, para o combo.
// ---------------------------------------------------------------------------
router.get('/relatorio', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const hoje = new Date();
    const ano = Number(req.query.ano) || hoje.getFullYear();
    const mes = Math.min(12, Math.max(0, Number(req.query.mes ?? (hoje.getMonth() + 1)) || 0));
    const inicio = mes ? new Date(ano, mes - 1, 1) : new Date(ano, 0, 1);
    const fim = mes ? new Date(ano, mes, 1) : new Date(ano + 1, 0, 1);

    // so as EMITIDAS (fechadas e as canceladas depois de fechadas), pela data do fechamento
    const docs = await Venda.find({ lojistaId: loja, situacao: { $in: ['F', 'C'] }, fechadaEm: { $gte: inicio, $lt: fim } })
      .sort({ fechadaEm: 1, numero: 1 })
      .select('numero data fechadaEm situacao documento condicao cliente.nome cliente.codigo itens.quantidade itens.precoUnitario itens.desconto descontoGeral totalLiquido pagamentos.forma')
      .lean();

    const anos = (await Venda.aggregate([
      { $match: { lojistaId: loja, fechadaEm: { $ne: null } } },
      { $group: { _id: { $year: '$fechadaEm' } } },
    ])).map(a => a._id).filter(Boolean);
    if (!anos.includes(hoje.getFullYear())) anos.push(hoje.getFullYear());
    anos.sort((a, b) => b - a);

    res.json({ ok: true, ano, mes, anos, vendas: docs.map(v => {
      const itens = v.itens || [];
      const bruto = itens.reduce((s, i) => s + (i.quantidade || 0) * (i.precoUnitario || 0), 0);
      const desconto = itens.reduce((s, i) => s + (i.desconto || 0), 0) + (v.descontoGeral || 0);
      return {
        _id: v._id, numero: v.numero, data: v.fechadaEm || v.data, situacao: v.situacao,
        forma: v.pagamentos?.[0]?.forma || '',
        documento: v.documento, condicao: v.condicao,
        cliente: v.cliente?.nome || '', codigoCliente: v.cliente?.codigo || '',
        itens: itens.length, bruto, desconto,
        liquido: v.totalLiquido ?? (bruto - desconto),
      };
    }) });
  } catch (err) {
    console.error('[vendas/relatorio]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// FECHAMENTO — contas do plano usadas
// ---------------------------------------------------------------------------
const CAIXA = '1.01.001.001';
const BANCO_TITULO = '1.01.002.002';   // Banestes/Armacao: banco de cobranca dos titulos
const PREFIXO_CARTAO = '1.01.005.';
const DIA = 24 * 60 * 60 * 1000;
const FORMAS_VISTA = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'];   // credito a vista: preco a vista, parcelado
const FORMAS_PRAZO = ['CREDITO', 'TITULO'];
const NOME_FORMA = { DINHEIRO: 'dinheiro', PIX: 'PIX/transferência', DEBITO: 'débito', CREDITO: 'crédito', TITULO: 'título' };

const subtitulo = (loja, codigo, session) => col('_contasubtitulos')
  .findOne({ lojistaId: loja, codigo, ativo: { $ne: false } }, { session });

// divide o total em n parcelas (centavos); a sobra vai na primeira
function dividir(total, n) {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? total - base * n : 0));
}

const codigoBoleta = () => 'BOL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------------------
// GET /formas   caixa, bancos que recebem e cartoes, para o modal de fechamento
// ---------------------------------------------------------------------------
router.get('/formas', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const caixa = await subtitulo(loja, CAIXA);
    const cbs = await col('_aux_contas_bancarias')
      .find({ lojistaId: loja, recebeVenda: true, ativo: { $ne: false } }).sort({ codigo: 1 }).toArray();
    const subs = new Map((await col('_contasubtitulos')
      .find({ _id: { $in: cbs.map(c => c.contaSubTitulo).filter(Boolean) } }).toArray())
      .map(s => [String(s._id), s]));
    const cartoes = await col('_contasubtitulos')
      .find({ lojistaId: loja, codigo: new RegExp('^' + escapar(PREFIXO_CARTAO)), ativo: { $ne: false } })
      .sort({ codigo: 1 }).toArray();
    res.json({
      ok: true,
      caixa: caixa ? { codigo: caixa.codigo, nome: caixa.nome } : null,
      bancos: cbs.filter(c => subs.get(String(c.contaSubTitulo))).map(c => {
        const s = subs.get(String(c.contaSubTitulo));
        return { id: c._id, apelido: c.apelido || s.nome, codigo: s.codigo, nome: s.nome };
      }),
      cartoes: cartoes.map(c => ({ codigo: c.codigo, nome: c.nome })),
    });
  } catch (err) {
    console.error('[vendas/formas]', err);
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/fechar   { forma, contaBancaria?, cartao?, parcelas? }
// ---------------------------------------------------------------------------
router.post('/:id/fechar', async (req, res) => {
  const loja = lojaDe(req);
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ ok: false, erro: 'id inválido' });
  const b = req.body || {};
  let resposta = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const v = await Venda.findOne({ _id: req.params.id, lojistaId: loja }).session(session);
      if (!v) throw Object.assign(new Error('venda não encontrada'), { status: 404 });
      if (v.situacao !== 'A') throw Object.assign(new Error('a venda já está ' + (v.situacao === 'F' ? 'fechada' : 'cancelada')), { status: 409 });
      if (!v.itens.length) throw new Error('a venda não tem itens');
      v.recalcular();
      const total = v.totalLiquido;
      if (total <= 0) throw new Error('a venda está com total zero');

      // os pagamentos: lista nova, ou o formato antigo (uma forma so, pelo total)
      const pedidos = Array.isArray(b.pagamentos) && b.pagamentos.length
        ? b.pagamentos
        : [{ forma: b.forma, valor: total, contaBancaria: b.contaBancaria, cartao: b.cartao, parcelas: b.parcelas }];
      if (pedidos.length > 6) throw new Error('no máximo 6 formas de pagamento');
      const soma = pedidos.reduce((t, p) => t + Math.round(Number(p.valor) || 0), 0);
      if (soma !== total) {
        throw new Error('os pagamentos somam R$ ' + (soma / 100).toFixed(2).replace('.', ',')
          + ' e a venda é R$ ' + (total / 100).toFixed(2).replace('.', ','));
      }

      // conta do cliente (NFE)
      let contaCliente = null;
      if (v.documento === 'NFE') {
        if (!v.cliente?.id) throw new Error('nota fiscal precisa de cliente');
        if (!v.cliente.ncontabil) throw new Error('o cliente ' + v.cliente.codigo + ' não tem conta contábil');
        contaCliente = await subtitulo(loja, v.cliente.ncontabil, session);
        if (!contaCliente) throw new Error('a conta ' + v.cliente.ncontabil + ' do cliente não está no plano (ou está suspensa)');
      }

      const agora = new Date();
      const dataBoleta = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12, 0, 0);
      const permitidas = v.condicao === 'PRAZO' ? FORMAS_PRAZO : FORMAS_VISTA;

      // ---- confere cada pagamento e acha o destino e as parcelas dele ----
      const prontos = [];
      for (const p of pedidos) {
        const forma = String(p.forma || '').toUpperCase();
        const valor = Math.round(Number(p.valor) || 0);
        if (valor <= 0) throw new Error('pagamento com valor zero');
        if (!permitidas.includes(forma)) {
          throw new Error('venda ' + (v.condicao === 'PRAZO' ? 'a prazo' : 'à vista') + ' aceita: '
            + permitidas.map(f => NOME_FORMA[f]).join(', '));
        }
        if (forma === 'TITULO' && (v.documento !== 'NFE' || v.cliente?.tipo !== 'PJ')) {
          throw new Error('título em banco só para pessoa jurídica com nota fiscal');
        }
        let destino = null;
        if (forma === 'DINHEIRO') {
          destino = await subtitulo(loja, CAIXA, session);
          if (!destino) throw new Error('o caixa ' + CAIXA + ' não está no plano');
        } else if (forma === 'PIX') {
          if (!mongoose.Types.ObjectId.isValid(p.contaBancaria)) throw new Error('escolha o banco do PIX');
          const cb = await col('_aux_contas_bancarias').findOne({
            _id: new mongoose.Types.ObjectId(p.contaBancaria), lojistaId: loja, recebeVenda: true, ativo: { $ne: false },
          }, { session });
          if (!cb) throw new Error('este banco não recebe venda');
          destino = await col('_contasubtitulos').findOne({ _id: cb.contaSubTitulo, ativo: { $ne: false } }, { session });
          if (!destino) throw new Error('o banco ' + (cb.apelido || '') + ' não tem conta contábil ativa');
        } else if (forma === 'DEBITO' || forma === 'CREDITO') {
          const cod = String(p.cartao || '');
          if (!cod.startsWith(PREFIXO_CARTAO)) throw new Error('escolha o cartão');
          destino = await subtitulo(loja, cod, session);
          if (!destino) throw new Error('o cartão ' + cod + ' não está no plano');
        } else if (forma === 'TITULO') {
          destino = contaCliente;          // fica a receber do proprio cliente
          if (!(await subtitulo(loja, BANCO_TITULO, session))) {
            throw new Error('o banco de cobrança ' + BANCO_TITULO + ' não está no plano');
          }
        }
        // parcelas (pos 5): debito 1 no dia seguinte; credito e titulo de 30 em 30 dias
        let parcelas = [];
        if (forma === 'DEBITO') parcelas = [{ numero: 1, vencimento: new Date(dataBoleta.getTime() + DIA), valor }];
        if (forma === 'CREDITO' || forma === 'TITULO') {
          const n = Math.floor(Number(p.parcelas) || 1);
          if (n < 1 || n > 10) throw new Error('de 1 a 10 parcelas');
          parcelas = dividir(valor, n).map((x, i) => ({
            numero: i + 1, vencimento: new Date(dataBoleta.getTime() + (i + 1) * 30 * DIA), valor: x,
          }));
        }
        prontos.push({ forma, valor, destino, parcelas });
      }

      const receitaCod = v.documento === 'NFE' && v.condicao === 'PRAZO' ? CONTAS.RECEITA_PRAZO : CONTAS.RECEITA_VISTA;
      const receita = await subtitulo(loja, receitaCod, session);
      if (!receita) throw new Error('a conta de receita ' + receitaCod + ' não está no plano');

      const nomeCli = v.cliente?.nome || 'balcão';
      const contra = (conta, valorC, historico) => ({
        contaSubTitulo: conta._id, codigoConta: conta.codigo, nomeConta: conta.nome,
        historico, valor: valorC / 100, cliente: v.cliente?.id || null,
      });

      // NFE: a venda uma vez so — cliente (debito) x receita (credito), pelo total
      if (v.documento === 'NFE') {
        const [bv] = await Boleta.create([{
          codigo: codigoBoleta(), tipo: 'RECEBIMENTO', data: dataBoleta,
          bancoSubTitulo: contaCliente._id, bancoCodigo: contaCliente.codigo, bancoNome: contaCliente.nome,
          valorTotal: total / 100,
          contrapartidas: [contra(receita, total, 'Venda ' + v.numero + ' · NF · ' + nomeCli)],
          historico: 'Venda ' + v.numero + ' · ' + nomeCli, origem: 'VENDA', status: 'ATIVO', lojistaId: loja,
        }], { session });
        v.contabil = { contaCliente: contaCliente.codigo, contaReceita: receita.codigo, boletaId: bv._id, diaBalcao: null };
      }

      // ---- cada pagamento: lancamento e parcelas ----
      const gravados = [];
      for (const p of prontos) {
        const pag = { forma: p.forma, valor: p.valor, boletaId: null, parcelas: [],
                      contaDestino: p.forma === 'TITULO' ? BANCO_TITULO : p.destino.codigo };
        if (p.forma === 'DEBITO' || p.forma === 'CREDITO') { pag.operadora = p.destino.nome; pag.contaOperadora = p.destino.codigo; }

        if (v.documento === 'NFE') {
          // o recebimento: destino (debito) x cliente (credito) — titulo fica a receber
          if (p.forma !== 'TITULO') {
            const [br] = await Boleta.create([{
              codigo: codigoBoleta(), tipo: 'RECEBIMENTO', data: dataBoleta,
              bancoSubTitulo: p.destino._id, bancoCodigo: p.destino.codigo, bancoNome: p.destino.nome,
              valorTotal: p.valor / 100,
              contrapartidas: [contra(contaCliente, p.valor, 'Venda ' + v.numero + ' · ' + NOME_FORMA[p.forma])],
              historico: 'Recebimento venda ' + v.numero + ' · ' + nomeCli, origem: 'VENDA', status: 'ATIVO', lojistaId: loja,
            }], { session });
            pag.boletaId = br._id;
          }
        } else {
          // CUPOM: soma no lancamento do dia "Vendas balcao" desta conta de destino
          const dia = await Boleta.findOne({
            lojistaId: loja, origem: 'VENDA_BALCAO', bancoCodigo: p.destino.codigo, data: dataBoleta, status: 'ATIVO',
          }).session(session);
          let bd;
          if (dia) {
            const novo = Math.round(dia.valorTotal * 100) + p.valor;
            dia.valorTotal = novo / 100;
            dia.contrapartidas[0].valor = novo / 100;
            bd = await dia.save({ session });
          } else {
            [bd] = await Boleta.create([{
              codigo: codigoBoleta(), tipo: 'RECEBIMENTO', data: dataBoleta,
              bancoSubTitulo: p.destino._id, bancoCodigo: p.destino.codigo, bancoNome: p.destino.nome,
              valorTotal: p.valor / 100,
              contrapartidas: [{ contaSubTitulo: receita._id, codigoConta: receita.codigo, nomeConta: receita.nome,
                                 historico: HISTORICO_BALCAO, valor: p.valor / 100 }],
              historico: HISTORICO_BALCAO, origem: 'VENDA_BALCAO', status: 'ATIVO', lojistaId: loja,
            }], { session });
          }
          pag.boletaId = bd._id;
          if (!v.contabil?.boletaId) {
            v.contabil = { contaCliente: '', contaReceita: receita.codigo, boletaId: bd._id, diaBalcao: dataBoleta };
          }
        }

        // fluxo: uma linha pos 5 por parcela (reais, positivo)
        if (p.parcelas.length) {
          const linhas = await FluxoProjetado.insertMany(p.parcelas.map(x => ({
            lojistaId: loja,
            ano: x.vencimento.getFullYear(), mes: x.vencimento.getMonth() + 1,
            pos: 5,
            codigoConta: p.destino.codigo, nomeConta: p.destino.nome,
            historico: 'Venda ' + v.numero + ' ' + nomeCli + ' · ' + NOME_FORMA[p.forma],
            valor: x.valor / 100,
            vencimento: x.vencimento,
            parcela: x.numero, totalParcelas: p.parcelas.length,
            origem: 'VENDA', lancamentoId: v._id, status: 'ATIVO',
          })), { session });
          pag.parcelas = p.parcelas.map((x, i) => ({ ...x, fluxoId: linhas[i]._id }));
        }
        gravados.push(pag);
      }

      // estoque
      for (const i of v.itens) {
        await col('arquivo_docs').updateOne(
          { loja_id: loja, codigo: i.codigo },
          { $inc: { qte: -i.quantidade }, $set: { atualizadoEm: agora } },
          { session });
      }

      v.pagamentos = gravados;
      v.situacao = 'F';
      v.fechadaEm = agora;
      await v.save({ session });
      resposta = v;
    });
    res.json({ ok: true, venda: resposta });
  } catch (err) {
    console.error('[vendas/fechar]', err.message);
    res.status(err.status || 400).json({ ok: false, erro: err.message });
  } finally {
    session.endSession();
  }
});

// ---------------------------------------------------------------------------
// GET /:id/espelho   a venda + as parcelas no fluxo, com a situacao de cada uma
// ---------------------------------------------------------------------------
router.get('/:id/espelho', async (req, res) => {
  try {
    const loja = lojaDe(req);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ ok: false, erro: 'id inválido' });
    const v = await Venda.findOne({ _id: req.params.id, lojistaId: loja }).lean();
    if (!v) return res.status(404).json({ ok: false, erro: 'venda não encontrada' });
    const linhas = await col('_fluxo_projetado').find({ lojistaId: loja, lancamentoId: v._id }).sort({ vencimento: 1 }).toArray();
    const bols = new Map((await col('_boletas').find({ _id: { $in: linhas.map(l => l.boletaId).filter(Boolean) } })
      .project({ codigo: 1 }).toArray()).map(b => [String(b._id), b.codigo]));
    res.json({ ok: true, venda: v, parcelas: linhas.map(l => ({
      parcela: l.parcela, totalParcelas: l.totalParcelas, vencimento: l.vencimento, valor: l.valor,
      codigoConta: l.codigoConta, nomeConta: l.nomeConta, status: l.status,
      boleta: l.boletaId ? (bols.get(String(l.boletaId)) || '') : '',
    })) });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/cancelar   { motivo }
// Desfaz o fechamento numa TRANSACAO. Parcela ja recebida BLOQUEIA: o recebimento
// tem que ser estornado antes, no fluxo (a boleta do recebimento).
// ---------------------------------------------------------------------------
router.post('/:id/cancelar', async (req, res) => {
  const loja = lojaDe(req);
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ ok: false, erro: 'id inválido' });
  const motivo = String(req.body?.motivo || '').trim();
  if (motivo.length < 3) return res.status(400).json({ ok: false, erro: 'informe o motivo do cancelamento' });
  let resposta = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const v = await Venda.findOne({ _id: req.params.id, lojistaId: loja }).session(session);
      if (!v) throw Object.assign(new Error('venda não encontrada'), { status: 404 });
      if (v.situacao === 'C') throw Object.assign(new Error('a venda já está cancelada'), { status: 409 });
      const agora = new Date();

      if (v.situacao === 'F') {
        // 1) parcela recebida bloqueia
        const linhas = await col('_fluxo_projetado').find({ lojistaId: loja, lancamentoId: v._id }, { session }).toArray();
        const recebidas = linhas.filter(l => l.status === 'QUITADO');
        if (recebidas.length) {
          const bols = new Map((await col('_boletas').find({ _id: { $in: recebidas.map(l => l.boletaId).filter(Boolean) } }, { session })
            .project({ codigo: 1 }).toArray()).map(b => [String(b._id), b.codigo]));
          throw Object.assign(new Error('não dá para cancelar: '
            + recebidas.map(l => 'a parcela ' + l.parcela + '/' + l.totalParcelas + ' já foi recebida (boleta '
              + (bols.get(String(l.boletaId)) || '?') + ')').join('; ')
            + '. Estorne o recebimento no fluxo antes.'), { status: 409 });
        }

        // 2) parcelas em aberto: canceladas (somem do fluxo, ficam na memoria)
        await col('_fluxo_projetado').updateMany(
          { lojistaId: loja, lancamentoId: v._id, status: 'ATIVO' },
          { $set: { status: 'CANCELADO', canceladoEm: agora } }, { session });

        // 3) estoque volta
        for (const i of v.itens) {
          await col('arquivo_docs').updateOne({ loja_id: loja, codigo: i.codigo },
            { $inc: { qte: i.quantidade }, $set: { atualizadoEm: agora } }, { session });
        }

        // 4) contabil
        if (v.documento === 'NFE') {
          const ids = [v.contabil?.boletaId, ...(v.pagamentos || []).map(p => p.boletaId)].filter(Boolean);
          if (ids.length) await Boleta.updateMany({ _id: { $in: ids }, lojistaId: loja, status: 'ATIVO' },
            { $set: { status: 'CANCELADO' } }, { session });
        } else {
          // cupom: tira o valor do lancamento do dia "Vendas balcao"; zerou, cancela
          for (const p of (v.pagamentos || [])) {
            if (!p.boletaId) continue;
            const b = await Boleta.findOne({ _id: p.boletaId, lojistaId: loja, status: 'ATIVO' }).session(session);
            if (!b) continue;
            const novo = Math.round(b.valorTotal * 100) - (p.valor || 0);
            if (novo <= 0) b.status = 'CANCELADO';
            else { b.valorTotal = novo / 100; if (b.contrapartidas[0]) b.contrapartidas[0].valor = novo / 100; }
            await b.save({ session });
          }
        }
      }

      v.situacao = 'C';
      v.canceladaEm = agora;
      v.motivoCancelamento = motivo;
      await v.save({ session });
      resposta = v;
    });
    res.json({ ok: true, venda: resposta });
  } catch (err) {
    console.error('[vendas/cancelar]', err.message);
    res.status(err.status || 400).json({ ok: false, erro: err.message });
  } finally {
    session.endSession();
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ ok: false, erro: 'id inválido' });
    const v = await Venda.findOne({ _id: req.params.id, lojistaId: lojaDe(req) });
    if (!v) return res.status(404).json({ ok: false, erro: 'venda não encontrada' });
    res.json({ ok: true, venda: v });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

// POST /   abre uma venda (situacao A), numero = ultimo + 1 da empresa
router.post('/', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const venda = new Venda({ lojistaId: loja, situacao: 'A', data: new Date() });
    await montar(req, venda);
    if (!venda.itens.length) return res.status(400).json({ ok: false, erro: 'a venda não tem itens' });

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const ultima = await Venda.findOne({ lojistaId: loja }).sort({ numero: -1 }).select('numero');
      venda.numero = (ultima?.numero || 0) + 1;
      try { await venda.save(); break; }
      catch (e) { if (e.code !== 11000 || tentativa === 2) throw e; }   // dois ao mesmo tempo: tenta o proximo
    }
    res.status(201).json({ ok: true, venda });
  } catch (err) {
    console.error('[vendas/criar]', err);
    res.status(400).json({ ok: false, erro: err.message });
  }
});

// PUT /:id   altera uma venda ABERTA
router.put('/:id', async (req, res) => {
  try {
    const v = await Venda.findOne({ _id: req.params.id, lojistaId: lojaDe(req) });
    if (!v) return res.status(404).json({ ok: false, erro: 'venda não encontrada' });
    if (v.situacao !== 'A') return res.status(409).json({ ok: false, erro: 'só venda aberta pode ser alterada' });
    await montar(req, v);
    if (!v.itens.length) return res.status(400).json({ ok: false, erro: 'a venda não tem itens' });
    await v.save();
    res.json({ ok: true, venda: v });
  } catch (err) {
    console.error('[vendas/alterar]', err);
    res.status(400).json({ ok: false, erro: err.message });
  }
});

module.exports = router;
