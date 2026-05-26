// src/routes/financeiro/pagamento-api.js
// Pagamento/Recebimento em LOTE a partir do Fluxo de Caixa.
// Lista títulos numa janela de dias, e grava a Boleta (partida dobrada com rateio):
//   PAGAMENTO  → banco creditado (sai $), contrapartidas = débitos (despesas)
//   RECEBIMENTO→ banco debitado (entra $), contrapartidas = créditos (receitas)
// Após gravar, remove os títulos do Fluxo Projetado (some do Fluxo de Caixa).

const express = require('express');
const FluxoProjetado = require('../../models/financeiro/fluxoProjetado');
const Boleta = require('../../models/financeiro/boleta');
const ContaBancaria = require('../../models/auxiliares/contaBancaria');
const HistoricoConta = require('../../models/financeiro/historicoConta');

const router = express.Router();

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
      pos: { $in: posFiltro }
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
      subNome: c.contaSubTitulo?.nome || ''
    })));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* POST /financeiro/api/pagamento/quitar
   Body: { tipo, data, contaBancariaId, titulosIds: [...], historico }
   Grava a Boleta e remove os títulos do Fluxo. */
router.post('/quitar', async (req, res) => {
  try {
    const { tipo = 'pagar', data, contaBancariaId, titulosIds, historico, historicos } = req.body;
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

    // Código sequencial simples (timestamp)
    const codigo = `BOL-${Date.now()}`;
    const dataBoleta = data ? new Date(data + 'T12:00:00') : new Date();

    const boleta = await Boleta.create({
      codigo, tipo: tipoBoleta, data: dataBoleta,
      contaBancaria: banco._id,
      bancoSubTitulo: banco.contaSubTitulo?._id || null,
      bancoCodigo: banco.contaSubTitulo?.codigo || '',
      bancoNome: banco.apelido || banco.banco?.nome || 'Banco',
      valorTotal,
      contrapartidas,
      historico: historico || `${tipoBoleta} em lote — ${contrapartidas.length} título(s)`,
      origem: 'FLUXO'
    });

    // Remove os títulos quitados do Fluxo (Fluxo Projetado guarda memória,
    // mas marcamos como QUITADO; o Fluxo de Caixa só mostra ATIVO).
    await FluxoProjetado.updateMany(
      { _id: { $in: titulosIds } },
      { $set: { status: 'QUITADO', boletaId: boleta._id, quitadoEm: new Date() } }
    );

    // Aprende os históricos usados (para sugestões futuras)
    for (const c of contrapartidas) {
      await registrarHistorico(c.codigoConta, c.historico);
    }

    res.status(201).json({
      ok: true,
      boletaId: boleta._id,
      codigo: boleta.codigo,
      valorTotal,
      titulosQuitados: titulos.length
    });
  } catch (err) {
    console.error('❌ /pagamento/quitar:', err.message);
    res.status(500).json({ erro: err.message });
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
  try {
    const b = await Boleta.findById(req.params.id);
    if (!b) return res.status(404).json({ erro: 'Boleta não encontrada.' });
    if (b.status === 'CANCELADO') return res.status(400).json({ erro: 'Boleta já estornada.' });

    // Devolve os títulos ao Fluxo (QUITADO → ATIVO)
    await FluxoProjetado.updateMany(
      { boletaId: b._id },
      { $set: { status: 'ATIVO' }, $unset: { boletaId: '', quitadoEm: '' } }
    );

    b.status = 'CANCELADO';
    await b.save();

    res.json({ ok: true, titulosDevolvidos: b.contrapartidas.length });
  } catch (err) {
    console.error('❌ /pagamento/estornar:', err.message);
    res.status(500).json({ erro: err.message });
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
