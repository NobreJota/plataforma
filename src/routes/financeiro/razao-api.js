// src/routes/financeiro/razao-api.js
// RAZÃO contábil: monta os lançamentos de uma conta a partir das BOLETAS.
// Cada boleta gera lançamentos:
//   - na conta do BANCO (crédito p/ pagamento, débito p/ recebimento)
//   - nas contas das CONTRAPARTIDAS (débito p/ pagamento, crédito p/ recebimento)
// O razão de uma conta = todos os lançamentos onde ela aparece.

const express = require('express');
const Boleta = require('../../models/financeiro/boleta');

const router = express.Router();

function fmtDoc(b) {
  // "chave" curta para exibir no documento (últimos dígitos do código)
  return b.codigo ? b.codigo.replace('BOL-', '') : '';
}

/* GET /contab/api/razao/lancamentos?conta=CODIGO&de=YYYY-MM-DD&ate=YYYY-MM-DD
   Retorna os lançamentos da conta no período, com saldo acumulado. */
router.get('/lancamentos', async (req, res) => {
  try {
    const { conta, de, ate } = req.query;
    if (!conta) return res.json({ conta: '', lancamentos: [], totalDebito: 0, totalCredito: 0, saldo: 0 });

    const filtroData = {};
    if (de)  filtroData.$gte = new Date(de + 'T00:00:00');
    if (ate) filtroData.$lte = new Date(ate + 'T23:59:59');

    const queryBoleta = { status: 'ATIVO' };
    if (de || ate) queryBoleta.data = filtroData;

    const boletas = await Boleta.find(queryBoleta).sort({ data: 1, criadoEm: 1 }).lean();

    const lancamentos = [];
    for (const b of boletas) {
      const ehPagamento = b.tipo === 'PAGAMENTO';
      const doc = fmtDoc(b);

      // A conta é o BANCO desta boleta?
      if (b.bancoCodigo === conta) {
        // pagamento: banco a crédito (saiu). recebimento: banco a débito (entrou)
        lancamentos.push({
          data: b.data,
          historico: b.historico || `${b.tipo} ${doc}`,
          documento: doc,
          boletaId: b._id,
          debito:  ehPagamento ? 0 : b.valorTotal,
          credito: ehPagamento ? b.valorTotal : 0
        });
      }

      // A conta é uma das CONTRAPARTIDAS?
      for (const c of (b.contrapartidas || [])) {
        if (c.codigoConta === conta) {
          // pagamento: despesa a débito. recebimento: receita a crédito
          lancamentos.push({
            data: b.data,
            historico: c.historico || c.nomeConta || '',
            documento: doc,
            boletaId: b._id,
            debito:  ehPagamento ? c.valor : 0,
            credito: ehPagamento ? 0 : c.valor
          });
        }
      }
    }

    // ordena por data e calcula saldo acumulado
    lancamentos.sort((a, b) => new Date(a.data) - new Date(b.data));
    let saldo = 0, totalDebito = 0, totalCredito = 0;
    lancamentos.forEach(l => {
      saldo += l.debito - l.credito;
      totalDebito += l.debito;
      totalCredito += l.credito;
      l.saldo = saldo;
    });

    res.json({ conta, lancamentos, totalDebito, totalCredito, saldo });
  } catch (err) {
    console.error('❌ /razao/lancamentos:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/razao/diagnostico
   Lista todas as boletas e os códigos de conta usados (para depuração). */
router.get('/diagnostico', async (req, res) => {
  try {
    const boletas = await Boleta.find({}).sort({ criadoEm: -1 }).limit(20).lean();
    const contas = new Set();
    const resumo = boletas.map(b => {
      if (b.bancoCodigo) contas.add(b.bancoCodigo);
      (b.contrapartidas || []).forEach(c => { if (c.codigoConta) contas.add(c.codigoConta); });
      return {
        codigo: b.codigo,
        tipo: b.tipo,
        status: b.status,
        data: b.data,
        bancoCodigo: b.bancoCodigo || '(vazio)',
        bancoNome: b.bancoNome,
        valorTotal: b.valorTotal,
        contrapartidas: (b.contrapartidas || []).map(c => ({
          codigoConta: c.codigoConta || '(vazio)',
          nomeConta: c.nomeConta,
          valor: c.valor
        }))
      };
    });
    res.json({
      totalBoletas: boletas.length,
      contasUsadas: Array.from(contas),
      boletas: resumo
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* GET /financeiro/api/razao/diag-bancos
   Lista as contas bancárias e se têm subtítulo vinculado (depuração). */
router.get('/diag-bancos', async (req, res) => {
  try {
    const ContaBancaria = require('../../models/auxiliares/contaBancaria');
    const contas = await ContaBancaria.find({})
      .populate('banco', 'nome')
      .populate('contaSubTitulo', 'codigo nome')
      .lean();
    res.json({
      totalContas: contas.length,
      contas: contas.map(c => ({
        _id: c._id,
        apelido: c.apelido || '',
        banco: c.banco?.nome || '(sem banco)',
        numero: c.numero || '',
        ativo: c.ativo,
        temSubTitulo: !!c.contaSubTitulo,
        subTituloCodigo: c.contaSubTitulo?.codigo || '(VAZIO - precisa vincular!)',
        subTituloNome: c.contaSubTitulo?.nome || ''
      }))
    });
  } catch (err) {
    res.status(500).json({ erro: err.message, dica: 'Verifique o caminho do model contaBancaria' });
  }
});

module.exports = router;
