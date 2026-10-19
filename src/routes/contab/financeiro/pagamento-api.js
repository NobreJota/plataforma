// Destino: C:\plataformaRota\src\routes\contab\financeiro\pagamento-api.js
// (caminho corrigido em 05/10/2026; antes dizia src/routes/financeiro/pagamento-api.js)
// Pagamento/Recebimento em LOTE a partir do Fluxo de Caixa.
// Lista títulos numa janela de dias, e grava a Boleta (partida dobrada com rateio):
//   PAGAMENTO  → banco creditado (sai $), contrapartidas = débitos (despesas)
//   RECEBIMENTO→ banco debitado (entra $), contrapartidas = créditos (receitas)
// Após gravar, remove os títulos do Fluxo Projetado (some do Fluxo de Caixa).
//
// Alterado em 03/10/2026:
//  - DATA DO MOVIMENTO: nunca depois de hoje, nunca sabado/domingo, e no maximo
//    5 dias uteis para tras (evita lancamento em data errada). Vale para pagar e receber.
//  - CARTAO (pos 5 em 1.01.005.xxx):
//      GET /cartoes            os cartoes do plano com a conta da taxa de cada um
//      GET /cartao?conta=&historico=   as parcelas em aberto de um cartao (todas as
//                              datas); com historico, so as daquela venda
//      POST /quitar + valorLiquido: o que o cartao pagou de fato. Grava a boleta do
//      recebimento pelo TOTAL (cartao a credito, banco a debito) e uma segunda boleta
//      <codigo>-TAXA: banco a credito pela taxa, contra a despesa do cartao (contaTaxa
//      do subtitulo: Mastercard 3.03.001.017, Visa 3.03.001.018). No banco fica o liquido.
//      Estornar a boleta estorna a taxa junto.
//  05/10/2026: TAXA NA MESMA BOLETA. O recebimento de cartao com liquido menor grava UMA
//      boleta: banco a debito pelo LIQUIDO; contrapartidas = as parcelas do cartao (credito,
//      pelo total) + a taxa com valor NEGATIVO (= debito na despesa do cartao; o razao le
//      o negativo no lado oposto). Banco = soma das contrapartidas. Boletas antigas com
//      <codigo>-TAXA continuam sendo estornadas juntas.
//  06/10/2026: TRANSACAO (o BeginTrans/CommitTrans do Access) no /quitar e no estorno:
//      boleta + baixa das parcelas no fluxo (ou a volta delas) gravam juntas ou nada.
//      Parcela que ja foi recebida/paga por outra boleta derruba a operacao inteira, e
//      a boleta so grava se o banco for igual a soma das contrapartidas (em centavos).
//  07/10/2026: GET /versao — "impressao digital" do fluxo (parcelas ativas, ultima linha,
//      ultima baixa). A tela consulta a cada 15 s: mudou, recarrega a grade e o modal
//      aberto — o que outro usuario baixou some da tela dos outros.
//  05/10/2026: GET /cartao?...&historico=...&cliente=1 traz as parcelas em aberto do
//      cartao de TODAS as vendas do mesmo cliente daquela venda (venda -> cliente.id ->
//      vendas dele). Venda de balcao (sem cliente): as vendas de balcao daquele cartao.
//  18/10/2026: GET /receber — VENDAS - RECEBER (a receber de cliente, sem cartao e sem OS); POST /quitar
//      aceita juros e desconto (contas pelas chaves receber-juros / receber-desconto, botao ★).
//  18/10/2026: PUT /titulo/:id/vencimento — DDA - confere: acertar o vencimento do nosso fluxo pelo do banco.
//  18/10/2026: GET /dda-confere?de=&ate= — DDA - CONFERE: titulos de fornecedor do fluxo (pos 2 e 7) com o
//      CNPJ, e os CNPJs dos fornecedores; a tela compara com o CSV do banco.
//  18/10/2026: GET /dda?ate= — DDA - PAGA (sub-menu do Fluxo de Caixa): os titulos a pagar (pos 2)
//      vencendo ate o dia, vencidos inclusive; paga pelo POST /quitar.
//  16/10/2026: /janela do Fluxo de Caixa NAO traz as linhas do FLUXO DE SERVICO (origem 'OS',
//      a receber das OS): elas sao recebidas pela tela Servico > Fluxo de servico, que usa
//      este mesmo POST /quitar.

const express = require('express');
const mongoose = require('mongoose');
const FluxoProjetado = require('../../../models/contab/financeiro/fluxoProjetado');
const Boleta = require('../../../models/contab/financeiro/boleta');
const ContaBancaria = require('../../../models/contab/auxiliares/contaBancaria');
const HistoricoConta = require('../../../models/contab/financeiro/historicoConta');
const cfg = require('../../../models/contab/config-contas');      // 18/10/2026: juros/desconto do receber

const router = express.Router();

const PREFIXO_CARTAO = '1.01.005.';
const col = n => mongoose.connection.collection(n);
const lojaDe = req => (req.lojistaId ? new mongoose.Types.ObjectId(String(req.lojistaId)) : null);
const emCentavos = v => Math.round(Number(v || 0) * 100);

/* Data do movimento: 'AAAA-MM-DD'. Devolve o erro em texto, ou '' se vale.
   Nao pode ser depois de hoje, nem sabado/domingo, nem mais de 5 dias uteis atras. */
function erroDataMovimento(txt) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(txt || ''))) return 'Informe a data do movimento.';
  const d = new Date(txt + 'T12:00:00');
  if (isNaN(d)) return 'Data do movimento inválida.';
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  if (d > hoje) return 'A data do movimento não pode ser depois de hoje.';
  if (d.getDay() === 0 || d.getDay() === 6) return 'A data do movimento não pode ser sábado nem domingo.';
  let uteis = 0;
  for (const x = new Date(d); x < hoje; ) {
    x.setDate(x.getDate() + 1);
    if (x.getDay() !== 0 && x.getDay() !== 6) uteis++;
  }
  if (uteis > 5) return 'A data do movimento pode voltar no máximo 5 dias úteis.';
  return '';
}

/* O cartao (subtitulo 1.01.005.xxx) e a conta da taxa dele (campo contaTaxa). */
async function cartaoComTaxa(loja, codigo) {
  const filtro = { codigo, ativo: { $ne: false } };
  if (loja) filtro.lojistaId = loja;
  const c = await col('_contasubtitulos').findOne(filtro);
  if (!c) return null;
  let taxa = null;
  if (c.contaTaxa) {
    const ft = { codigo: c.contaTaxa, ativo: { $ne: false } };
    if (loja) ft.lojistaId = loja;
    taxa = await col('_contasubtitulos').findOne(ft);
  }
  return { _id: c._id, codigo: c.codigo, nome: c.nome,
           contaTaxa: taxa ? { _id: taxa._id, codigo: taxa.codigo, nome: taxa.nome } : null };
}

const tituloParaTela = (it, base) => ({
  _id: it._id,
  vencimento: it.vencimento,
  historico: it.historico || it.nomeConta || '',
  nomeConta: it.nomeConta || '',
  codigoConta: it.codigoConta || '',
  contaSubTitulo: it.contaSubTitulo || null,
  pos: it.pos,
  valor: Math.abs(it.valor),
  parcela: it.parcela, totalParcelas: it.totalParcelas,
  noDia: base ? new Date(it.vencimento).toDateString() === base.toDateString() : false,
});

// pos de recebimento (entrada) vs pagamento (saída)
const POS_RECEBE = new Set([1, 5]);
const ehRecebimento = (pos) => POS_RECEBE.has(pos);

/* GET /financeiro/api/pagamento/janela?data=YYYY-MM-DD&tipo=pagar|receber&dias=2
   Lista os títulos do Fluxo numa janela de ±dias ao redor da data,
   do mesmo tipo (pagar ou receber). */
router.get('/janela', async (req, res) => {
  try {
    const { data, tipo = 'pagar', dias = 2 } = req.query;
    if (!data) return res.status(400).json({ erro: 'Informe a data (YYYY-MM-DD).' });

    const base = new Date(data + 'T12:00:00');
    const janela = parseInt(dias, 10) || 2;
    const ini = new Date(base); ini.setDate(ini.getDate() - janela); ini.setHours(0,0,0,0);
    const fim = new Date(base); fim.setDate(fim.getDate() + janela); fim.setHours(23,59,59,999);

    // pos conforme o tipo:
    // - receber: títulos a receber realizados (1 = cartão, 5 = título de venda)
    // - pagar: SOMENTE despesas REAIS (pos 2 = compra/despesa realizada).
    //   pos 8 (orçamento) e 7 (compra projetada) NÃO se pagam: precisam ser
    //   realizados (virar pos 2) antes.
    const posFiltro = tipo === 'receber' ? [1, 5] : [2];

    const itens = await FluxoProjetado.find({
      status: 'ATIVO',
      vencimento: { $gte: ini, $lte: fim },
      pos: { $in: posFiltro },
      origem: { $ne: 'OS' },              // 16/10/2026: o a receber das OS fica no fluxo de servico
    }).sort({ vencimento: 1 }).lean();

    const titulos = itens.map(it => ({
      _id: it._id,
      vencimento: it.vencimento,
      historico: it.historico || it.nomeConta || '',
      nomeConta: it.nomeConta || '',
      codigoConta: it.codigoConta || '',
      contaSubTitulo: it.contaSubTitulo || null,
      pos: it.pos,
      valor: Math.abs(it.valor),
      parcela: it.parcela, totalParcelas: it.totalParcelas,
      noDia: new Date(it.vencimento).toDateString() === base.toDateString()
    }));

    res.json({
      data, tipo, dias: janela,
      titulos,
      total: titulos.reduce((s, t) => s + t.valor, 0)
    });
  } catch (err) {
    console.error('❌ /pagamento/janela:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 18/10/2026 (Jorge): DDA - PAGA. GET /financeiro/api/pagamento/dda?ate=YYYY-MM-DD
   Titulos a PAGAR realizados (pos 2) vencendo ate o dia (default hoje) — os vencidos tambem
   (ex.: na segunda, os de sabado e domingo). A tela marca, escolhe o banco e paga pelo
   POST /quitar (tipo pagar). fornecedor = conta 2.01.001.xxx */
router.get('/dda', async (req, res) => {
  try {
    const ate = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.ate || '')) ? new Date(req.query.ate + 'T23:59:59.999') : (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; })();
    // como o /janela (a tela de pagar do fluxo): sem filtro de loja
    const filtro = { status: 'ATIVO', pos: 2, vencimento: { $lte: ate }, origem: { $ne: 'OS' } };
    const itens = await FluxoProjetado.find(filtro).sort({ vencimento: 1, historico: 1 }).lean();
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    const titulos = itens.map(it => {
      const v = new Date(it.vencimento); v.setHours(12, 0, 0, 0);
      return { ...tituloParaTela(it, null), atraso: Math.round((hoje - v) / 86400000),
               fornecedor: String(it.codigoConta || '').startsWith('2.01.001.') };
    });
    res.json({ ate: ate.getFullYear() + '-' + String(ate.getMonth() + 1).padStart(2, '0') + '-' + String(ate.getDate()).padStart(2, '0'), titulos });
  } catch (err) {
    console.error('❌ /pagamento/dda:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 18/10/2026 (Jorge): DDA - CONFERE. GET /financeiro/api/pagamento/dda-confere?de=&ate=
   O lado do FLUXO para comparar com o arquivo do DDA do banco (a comparacao e na tela):
   - titulos de fornecedor (conta 2.01.001.xxx) a pagar (pos 2), compra programada (pos 3) e pedido (pos 7),
     em aberto, vencendo de/ate (padrao: hoje-7 ate hoje+90), com o CNPJ do fornecedor
   - fornecedores: os CNPJs conhecidos (cadastro fornecs -> vinculo da loja -> conta), para
     apontar no arquivo do banco o CNPJ que NAO e nosso fornecedor (principal sinal de fraude) */
router.get('/dda-confere', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const dia = (txt, soma, fim) => { const d = /^\d{4}-\d{2}-\d{2}$/.test(String(txt || '')) ? new Date(txt + 'T12:00:00') : (() => { const x = new Date(); x.setDate(x.getDate() + soma); return x; })();
      fim ? d.setHours(23, 59, 59, 999) : d.setHours(0, 0, 0, 0); return d; };
    const de = dia(req.query.de, -7, false), ate = dia(req.query.ate, 90, true);
    const soDig = v => String(v || '').replace(/\D/g, '');
    // fornecedores: conta 2.01.001.xxx -> { cnpj, razao, marca }
    const porConta = new Map(), fornecedores = [];
    for (const f of await col('fornecs').find({}).project({ cnpj: 1, razao: 1, razaoSocial: 1, marca: 1, nome: 1, vinculos: 1 }).toArray()) {
      const v = (f.vinculos || []).find(x => x.ativo !== false && (!loja || String(x.lojistaId) === String(loja)));
      const conta = String(v?.ncontabil || '').trim();
      const razao = String(f.razao || f.razaoSocial || f.nome || '').trim();
      const cnpj = soDig(f.cnpj);
      if (conta) porConta.set(conta, { cnpj, razao, marca: String(f.marca || '').trim() });
      if (cnpj) fornecedores.push({ cnpj, razao, marca: String(f.marca || '').trim(), conta });
    }
    const itens = await FluxoProjetado.find({ status: 'ATIVO', pos: { $in: [2, 3, 7] }, codigoConta: /^2\.01\.001\./,
      vencimento: { $gte: de, $lte: ate }, origem: { $ne: 'OS' } }).sort({ vencimento: 1 }).lean();
    const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    res.json({ de: ymd(de), ate: ymd(ate), fornecedores,
      titulos: itens.map(it => { const f = porConta.get(it.codigoConta) || {};
        return { ...tituloParaTela(it, null), cnpj: f.cnpj || '', razao: f.razao || it.nomeConta || '', marca: f.marca || '' }; }) });
  } catch (err) {
    console.error('❌ /pagamento/dda-confere:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 18/10/2026 (Jorge): DDA - CONFERE: AJUSTAR O VENCIMENTO do titulo no nosso fluxo (o do banco
   estava certo). PUT /financeiro/api/pagamento/titulo/:id/vencimento { vencimento: 'YYYY-MM-DD', motivo }
   So titulo em aberto (ATIVO). Guarda o historico em `ajustes` (de, para, motivo, em). */
router.put('/titulo/:id/vencimento', async (req, res) => {
  try {
    const txt = String(req.body?.vencimento || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) return res.status(400).json({ erro: 'Informe o vencimento (AAAA-MM-DD).' });
    const novo = new Date(txt + 'T12:00:00');
    if (isNaN(novo)) return res.status(400).json({ erro: 'Vencimento inválido.' });
    const t = await FluxoProjetado.findOne({ _id: req.params.id, status: 'ATIVO' }).lean();
    if (!t) return res.status(404).json({ erro: 'Título não encontrado ou já baixado.' });
    // direto na colecao (o schema do fluxo nao tem `ajustes`; assim nada e descartado nem recusado)
    const r = await FluxoProjetado.collection.updateOne({ _id: t._id, status: 'ATIVO' }, {
      $set: { vencimento: novo, ano: novo.getFullYear(), mes: novo.getMonth() + 1 },
      $push: { ajustes: { campo: 'vencimento', de: t.vencimento, para: novo, motivo: String(req.body?.motivo || 'DDA - confere').slice(0, 200), em: new Date() } },
    });
    if (!r.modifiedCount) return res.status(409).json({ erro: 'O título não foi alterado (já baixado?). Abra de novo.' });
    const conf = await FluxoProjetado.findById(t._id).select('vencimento').lean();
    res.json({ ok: true, vencimento: conf?.vencimento || null });
  } catch (err) {
    console.error('❌ /pagamento/titulo/vencimento:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* 18/10/2026 (Jorge): VENDAS - RECEBER. GET /financeiro/api/pagamento/receber
   Tudo o que ha a receber de cliente (pos 5, em aberto), sem os cartoes (1.01.005: tem rotina
   propria) e sem o fluxo de servico (OS). A tela agrupa pelo cliente (codigoConta) e recebe
   pelo POST /quitar (tipo receber) com juros/desconto. */
router.get('/receber', async (req, res) => {
  try {
    const itens = await FluxoProjetado.find({ status: 'ATIVO', pos: 5, origem: { $ne: 'OS' },
      codigoConta: { $not: /^1\.01\.005\./ } }).sort({ vencimento: 1 }).lean();
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    res.json({ titulos: itens.map(it => { const v = new Date(it.vencimento); v.setHours(12, 0, 0, 0);
      return { ...tituloParaTela(it, null), atraso: Math.round((hoje - v) / 86400000) }; }) });
  } catch (err) {
    console.error('❌ /pagamento/receber:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/pagamento/bancos  (lista contas bancárias para o dropdown) */
router.get('/bancos', async (req, res) => {
  try {
    const contas = await ContaBancaria.find({ ativo: true })
      .populate('banco', 'nome codigo')
      .populate('contaSubTitulo', 'codigo nome')
      .sort({ apelido: 1 }).lean();

    res.json(contas.map(c => ({
      _id: c._id,
      apelido: c.apelido || `${c.banco?.nome || 'Banco'} ${c.numero}`,
      banco: c.banco?.nome || '',
      numero: c.numero,
      subTituloId: c.contaSubTitulo?._id || null,
      subCodigo: c.contaSubTitulo?.codigo || '',
      subNome: c.contaSubTitulo?.nome || '',
      recebeVenda: c.recebeVenda === true          // 18/10/2026: so as da Armacao (VENDA-3)
    })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/pagamento/versao   muda sempre que o fluxo muda */
router.get('/versao', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const f = loja ? { lojistaId: loja } : {};
    const [ativos, ultima, baixa] = await Promise.all([
      FluxoProjetado.countDocuments({ ...f, status: 'ATIVO' }),
      FluxoProjetado.findOne(f).sort({ _id: -1 }).select('_id').lean(),
      FluxoProjetado.findOne({ ...f, quitadoEm: { $ne: null } }).sort({ quitadoEm: -1 }).select('quitadoEm').lean(),
    ]);
    res.json({ versao: ativos + '|' + (ultima?._id || '') + '|' + (baixa?.quitadoEm ? new Date(baixa.quitadoEm).getTime() : '') });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/pagamento/cartoes   cartoes do plano (1.01.005.xxx) */
router.get('/cartoes', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const filtro = { codigo: new RegExp('^' + PREFIXO_CARTAO.replace(/\./g, '\\.')), ativo: { $ne: false } };
    if (loja) filtro.lojistaId = loja;
    const lista = await col('_contasubtitulos').find(filtro).sort({ codigo: 1 }).toArray();
    res.json(lista.map(c => ({ codigo: c.codigo, nome: c.nome, contaTaxa: c.contaTaxa || '' })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/pagamento/cartao?conta=1.01.005.003[&historico=...]
   Parcelas EM ABERTO (pos 5) de um cartao, de qualquer data. Com historico,
   so as daquela venda (o historico da venda e o mesmo em todas as parcelas). */
router.get('/cartao', async (req, res) => {
  try {
    const loja = lojaDe(req);
    const conta = String(req.query.conta || '');
    if (!conta.startsWith(PREFIXO_CARTAO)) return res.status(400).json({ erro: 'Conta de cartão inválida.' });
    const filtro = { status: 'ATIVO', pos: 5, codigoConta: conta };
    if (loja) filtro.lojistaId = loja;
    if (req.query.cliente && req.query.historico) {
      // todas as vendas do mesmo cliente: parte da parcela clicada para chegar na venda
      const uma = await FluxoProjetado.findOne({ ...filtro, historico: String(req.query.historico) }).lean();
      const venda = uma?.lancamentoId ? await col('_vendas').findOne({ _id: uma.lancamentoId }) : null;
      if (venda?.cliente?.id) {
        const fv = { 'cliente.id': venda.cliente.id };
        if (loja) fv.lojistaId = loja;
        const ids = (await col('_vendas').find(fv).project({ _id: 1 }).toArray()).map(v => v._id);
        filtro.lancamentoId = { $in: ids };
      } else {
        filtro.historico = /^Venda \d+ balcão · /;          // balcao: as de balcao deste cartao
      }
    } else if (req.query.historico) filtro.historico = String(req.query.historico);
    const itens = await FluxoProjetado.find(filtro).sort({ vencimento: 1, parcela: 1 }).lean();
    const base = req.query.data ? new Date(req.query.data + 'T12:00:00') : null;
    res.json({
      cartao: await cartaoComTaxa(loja, conta),
      titulos: itens.map(it => tituloParaTela(it, base)),
    });
  } catch (err) {
    console.error('❌ /pagamento/cartao:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/pagamento/quitar
   Body: { tipo, data, contaBancariaId, titulosIds: [...], historico }
   Grava a Boleta e remove os títulos do Fluxo. */
router.post('/quitar', async (req, res) => {
  try {
    const { tipo = 'pagar', data, contaBancariaId, titulosIds, historico, historicos, valorLiquido, juros, desconto } = req.body;
    const erroData = erroDataMovimento(data);
    if (erroData) return res.status(400).json({ erro: erroData });
    const loja = lojaDe(req);
    if (!Array.isArray(titulosIds) || titulosIds.length === 0) {
      return res.status(400).json({ erro: 'Selecione ao menos um título.' });
    }
    if (!contaBancariaId) return res.status(400).json({ erro: 'Selecione o banco.' });

    // historicos: objeto opcional { tituloId: "texto editado" }
    const histMap = historicos || {};

    // Carrega banco
    const banco = await ContaBancaria.findById(contaBancariaId)
      .populate('banco', 'nome')
      .populate('contaSubTitulo', 'codigo nome').lean();
    if (!banco) return res.status(404).json({ erro: 'Conta bancária não encontrada.' });

    // Carrega os títulos do fluxo
    const titulos = await FluxoProjetado.find({ _id: { $in: titulosIds }, status: 'ATIVO' }).lean();
    if (titulos.length === 0) return res.status(404).json({ erro: 'Nenhum título válido encontrado.' });
    if (titulos.length !== new Set(titulosIds.map(String)).size) {
      return res.status(409).json({ erro: 'Uma das parcelas marcadas já foi baixada. Nada foi gravado; abra o fluxo de novo.' });
    }

    const ehRec = (tipo === 'receber');
    const tipoBoleta = ehRec ? 'RECEBIMENTO' : 'PAGAMENTO';

    // Monta contrapartidas
    const contrapartidas = titulos.map(t => ({
      contaSubTitulo: t.contaSubTitulo || null,
      codigoConta: t.codigoConta || '',
      nomeConta: t.nomeConta || '',
      historico: (histMap[String(t._id)] || t.historico || t.nomeConta || '').trim(),
      valor: Math.abs(t.valor),
      fluxoLancamentoId: t.lancamentoId || null,
      pos: t.pos
    }));
    const valorTotal = contrapartidas.reduce((s, c) => s + c.valor, 0);

    // CARTAO: o que a operadora pagou de fato. A diferenca e a taxa.
    let taxa = null;   // { centavos, cartao }
    const temLiquido = valorLiquido !== undefined && valorLiquido !== null && String(valorLiquido).trim() !== '';
    if (temLiquido) {
      if (!ehRec) return res.status(400).json({ erro: 'Valor líquido só existe no recebimento de cartão.' });
      const contas = [...new Set(titulos.map(t => t.codigoConta || ''))];
      if (contas.length !== 1 || !contas[0].startsWith(PREFIXO_CARTAO)) {
        return res.status(400).json({ erro: 'Para informar o valor líquido, marque parcelas de um único cartão.' });
      }
      const totalC = emCentavos(valorTotal), liqC = emCentavos(valorLiquido);
      if (liqC <= 0) return res.status(400).json({ erro: 'O valor líquido deve ser maior que zero.' });
      if (liqC > totalC) return res.status(400).json({ erro: 'O valor líquido não pode passar do total das parcelas.' });
      if (liqC < totalC) {
        const cartao = await cartaoComTaxa(loja, contas[0]);
        if (!cartao) return res.status(400).json({ erro: 'O cartão ' + contas[0] + ' não está no plano.' });
        if (!cartao.contaTaxa) {
          return res.status(400).json({ erro: 'O cartão ' + cartao.nome + ' não tem conta de taxa (despesa) ligada.' });
        }
        taxa = { centavos: totalC - liqC, cartao };
      }
    }

    // 18/10/2026: JUROS e DESCONTO no recebimento (Vendas - receber). Juros: contrapartida a credito
    // (receita), o banco recebe a mais. Desconto: contrapartida NEGATIVA (debito na despesa), o banco
    // recebe a menos; o titulo baixa inteiro. Contas pela configuracao (chaves receber-juros/-desconto).
    const jurosC = Math.max(0, emCentavos(juros)), descC = Math.max(0, emCentavos(desconto));
    let extra = 0;
    if (jurosC || descC) {
      if (!ehRec) return res.status(400).json({ erro: 'Juros e desconto só no recebimento.' });
      if (temLiquido) return res.status(400).json({ erro: 'Juros/desconto não se misturam com o valor líquido do cartão.' });
      if (descC >= emCentavos(valorTotal) + jurosC) return res.status(400).json({ erro: 'O desconto não pode ser maior que o total.' });
      if (jurosC) {
        const c = await cfg.contaDe(loja, 'receber-juros');
        contrapartidas.push({ contaSubTitulo: c._id, codigoConta: c.codigo, nomeConta: c.nome,
          historico: 'Juros/multa recebidos (' + titulos.length + ' título(s))', valor: jurosC / 100, fluxoLancamentoId: null, pos: null });
      }
      if (descC) {
        const c = await cfg.contaDe(loja, 'receber-desconto');
        contrapartidas.push({ contaSubTitulo: c._id, codigoConta: c.codigo, nomeConta: c.nome,
          historico: 'Desconto concedido (' + titulos.length + ' título(s))', valor: -descC / 100, fluxoLancamentoId: null, pos: null });
      }
      extra = jurosC - descC;
    }

    // taxa do cartao: entra na MESMA boleta, como contrapartida negativa (debito na despesa)
    let valorBoleta = (emCentavos(valorTotal) + extra) / 100;
    if (taxa) {
      const v = taxa.centavos / 100;
      const pct = (taxa.centavos / emCentavos(valorTotal) * 100).toFixed(2).replace('.', ',');
      contrapartidas.push({
        contaSubTitulo: taxa.cartao.contaTaxa._id,
        codigoConta: taxa.cartao.contaTaxa.codigo,
        nomeConta: taxa.cartao.contaTaxa.nome,
        historico: 'Taxa ' + taxa.cartao.nome + ' ' + pct + '% s/ ' + valorTotal.toFixed(2).replace('.', ','),
        valor: -v,
        fluxoLancamentoId: null,
        pos: null
      });
      valorBoleta = (emCentavos(valorTotal) - taxa.centavos) / 100;   // o que caiu no banco
    }

    // conferencia da partida dobrada, em centavos: banco = soma das contrapartidas
    const somaContras = contrapartidas.reduce((t, c) => t + emCentavos(c.valor), 0);
    if (somaContras !== emCentavos(valorBoleta)) {
      return res.status(409).json({ erro: 'A boleta não fecha: banco ' + valorBoleta.toFixed(2)
        + ' × contrapartidas ' + (somaContras / 100).toFixed(2) + '. Nada foi gravado.' });
    }

    // Código sequencial simples (timestamp)
    const codigo = `BOL-${Date.now()}`;
    const dataBoleta = data ? new Date(data + 'T12:00:00') : new Date();

    // ---- TRANSACAO: boleta + baixa das parcelas, tudo ou nada ----
    let boleta = null;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        [boleta] = await Boleta.create([{
          codigo, tipo: tipoBoleta, data: dataBoleta,
          contaBancaria: banco._id,
          bancoSubTitulo: banco.contaSubTitulo?._id || null,
          bancoCodigo: banco.contaSubTitulo?.codigo || '',
          bancoNome: banco.apelido || banco.banco?.nome || 'Banco',
          valorTotal: valorBoleta,
          contrapartidas,
          historico: historico || `${tipoBoleta} em lote — ${titulos.length} título(s)`,
          origem: 'FLUXO',
          lojistaId: loja
        }], { session });

        // Baixa das parcelas no Fluxo (o Fluxo Projetado guarda memória: marca QUITADO;
        // o Fluxo de Caixa só mostra ATIVO). So as que ainda estao ATIVAS: se alguma ja
        // foi baixada por outra boleta no meio do caminho, desfaz tudo.
        const r = await FluxoProjetado.updateMany(
          { _id: { $in: titulos.map(t => t._id) }, status: 'ATIVO' },
          { $set: { status: 'QUITADO', boletaId: boleta._id, quitadoEm: new Date() } },
          { session }
        );
        if (r.modifiedCount !== titulos.length) {
          throw Object.assign(new Error('Uma das parcelas já foi baixada por outra boleta. Nada foi gravado; abra o fluxo de novo.'), { status: 409 });
        }
      });
    } finally {
      session.endSession();
    }

    // Aprende os históricos usados (para sugestões futuras)
    for (const c of contrapartidas) {
      await registrarHistorico(c.codigoConta, c.historico);
    }

    res.status(201).json({
      ok: true,
      boletaId: boleta._id,
      codigo: boleta.codigo,
      valorTotal,
      titulosQuitados: titulos.length,
      liquido: valorBoleta,
      taxa: taxa ? taxa.centavos / 100 : 0
    });
  } catch (err) {
    console.error('❌ /pagamento/quitar:', err.message);
    res.status(err.status || 500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/pagamento/boleta/:id  (abre a boleta detalhada) */
router.get('/boleta/:id', async (req, res) => {
  try {
    const b = await Boleta.findById(req.params.id).lean();
    if (!b) return res.status(404).json({ erro: 'Boleta não encontrada.' });
    res.json(b);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/pagamento/boleta/:id/estornar
   Desfaz a boleta: cancela e devolve os títulos ao Fluxo (status ATIVO). */
router.post('/boleta/:id/estornar', async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let resposta = null;
    // TRANSACAO: cancelar a boleta, a taxa antiga (-TAXA) e devolver as parcelas, tudo ou nada
    await session.withTransaction(async () => {
      const b = await Boleta.findById(req.params.id).session(session);
      if (!b) throw Object.assign(new Error('Boleta não encontrada.'), { status: 404 });
      if (b.status === 'CANCELADO') throw Object.assign(new Error('Boleta já estornada.'), { status: 400 });

      // Devolve os títulos ao Fluxo (QUITADO → ATIVO)
      const f = await FluxoProjetado.updateMany(
        { boletaId: b._id },
        { $set: { status: 'ATIVO' }, $unset: { boletaId: '', quitadoEm: '' } },
        { session }
      );

      b.status = 'CANCELADO';
      await b.save({ session });

      // a taxa do cartao gravada do jeito antigo (boleta <codigo>-TAXA) sai junto
      const t = await Boleta.updateOne(
        { codigo: b.codigo + '-TAXA', status: 'ATIVO' },
        { $set: { status: 'CANCELADO' } },
        { session }
      );
      resposta = { ok: true, titulosDevolvidos: f.modifiedCount, taxaEstornada: t.modifiedCount > 0 };
    });
    res.json(resposta);
  } catch (err) {
    console.error('❌ /pagamento/estornar:', err.message);
    res.status(err.status || 500).json({ erro: err.message });
  } finally {
    session.endSession();
  }
});

/* GET /financeiro/api/pagamento/boletas?ano=&mes=  (lista boletas do período) */
router.get('/boletas', async (req, res) => {
  try {
    const { ano, mes } = req.query;
    const filter = { status: 'ATIVO' };
    if (ano) filter.ano = parseInt(ano, 10);
    if (mes) filter.mes = parseInt(mes, 10);
    const boletas = await Boleta.find(filter).sort({ data: -1 }).lean();
    res.json(boletas.map(b => ({
      _id: b._id, codigo: b.codigo, tipo: b.tipo, data: b.data,
      bancoNome: b.bancoNome, valorTotal: b.valorTotal,
      qtdTitulos: b.contrapartidas?.length || 0
    })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/pagamento/historicos?conta=CODIGO&termo=texto
   Sugere históricos da conta (e gerais), filtrando pelo termo digitado.
   Ordena por mais usados. */
router.get('/historicos', async (req, res) => {
  try {
    const { conta = '', termo = '' } = req.query;
    const filtro = {};
    // históricos da conta específica OU gerais (sem conta)
    if (conta) filtro.$or = [{ codigoConta: conta }, { codigoConta: '' }];
    if (termo.trim()) {
      const rx = { $regex: termo.trim(), $options: 'i' };
      filtro.texto = rx;
    }
    const lista = await HistoricoConta.find(filtro)
      .sort({ usos: -1, ultimoUso: -1 })
      .limit(10).lean();
    res.json(lista.map(h => h.texto));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Helper: registra/atualiza um histórico usado (aprende) */
async function registrarHistorico(codigoConta, texto) {
  if (!texto || !texto.trim()) return;
  texto = texto.trim();
  try {
    await HistoricoConta.findOneAndUpdate(
      { codigoConta: codigoConta || '', texto },
      { $inc: { usos: 1 }, $set: { ultimoUso: new Date() } },
      { upsert: true, new: true }
    );
  } catch (_) { /* duplicata concorrente: ignora */ }
}

module.exports = router;
