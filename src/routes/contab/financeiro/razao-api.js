// Destino: C:\plataformaRota\src\routes\contab\financeiro\razao-api.js
// Alterado em: 05/10/2026 - CONTRAPARTIDA INVERTIDA: valor NEGATIVO numa contrapartida
//   vai para o lado oposto, em valor positivo. Ex.: recebimento de cartao com taxa —
//   banco a debito pelo liquido, cartao a credito pelo total e a taxa (valor -12,00)
//   a DEBITO na despesa. A boleta continua fechando: banco = soma das contrapartidas.
// Alterado em: 08/10/2026 - GET /balancete?de=&ate= : saldo anterior, debitos, creditos e
//   saldo atual de cada subtitulo no periodo (mesma leitura do razao: SALDO_TRANSFERIDO
//   pelo sinal, banco e contrapartidas pelo tipo, contrapartida negativa no lado oposto).
//   Filtra a empresa (lojistaId; boletas antigas sem lojistaId entram junto).
//   O SALDO TRANSFERIDO entra sempre como saldo anterior; assim, no periodo, debitos = creditos.
//
// RAZÃO contábil: monta os lançamentos de uma conta a partir das BOLETAS.
// Cada boleta gera lançamentos:
//   - na conta do BANCO (crédito p/ pagamento, débito p/ recebimento)
//   - nas contas das CONTRAPARTIDAS (débito p/ pagamento, crédito p/ recebimento)
// O razão de uma conta = todos os lançamentos onde ela aparece.

const express = require('express');
const mongoose = require('mongoose');
const Boleta = require('../../../models/contab/financeiro/boleta');

const router = express.Router();

function fmtDoc(b) {
  // "chave" curta para exibir no documento (últimos dígitos do código)
  return b.codigo ? b.codigo.replace('BOL-', '') : '';
}

/* GET /contab/api/razao/lancamentos?conta=CODIGO&de=YYYY-MM-DD&ate=YYYY-MM-DD
   Retorna os lançamentos da conta no período, com saldo acumulado.
   Cada linha inclui cPartida: o código da contrapartida da boleta
   (se houver várias, junta em "3.01.001.003 +1"). */
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

      // SALDO TRANSFERIDO: perna única, sem contrapartida. Quem manda é o
      // sinal do valor: + entra na coluna que aumenta o saldo, − na que
      // diminui. Sem este ramo a linha cairia no comportamento de recebimento
      // e todo saldo viraria positivo, invertendo as contas de Passivo.
      if (b.tipo === 'SALDO_TRANSFERIDO') {
        if (b.bancoCodigo === conta) {
          const v = b.valorTotal || 0;
          lancamentos.push({
            data: b.data,
            historico: b.historico || 'SALDO TRANSFERIDO',
            documento: doc,
            boletaId: b._id,
            cPartida: '',                    // não há contrapartida, de propósito
            cPartidaNome: '',
            debito:  v > 0 ?  v : 0,
            credito: v < 0 ? -v : 0
          });
        }
        continue;
      }

      // A conta é o BANCO desta boleta?
      if (b.bancoCodigo === conta) {
        // contrapartida(s): a(s) conta(s) das contrapartidas.
        // Se houver várias diferentes, mostra a primeira + "(+N)".
        const codsContras = Array.from(new Set(
          (b.contrapartidas || []).map(c => c.codigoConta).filter(Boolean)
        ));
        const cPartida = codsContras[0]
          ? (codsContras.length > 1 ? `${codsContras[0]} +${codsContras.length - 1}` : codsContras[0])
          : '';

        // O nome acompanha o código: ler "3.01.001.003" não diz nada, ler
        // "Papelaria" ao lado resolve na hora. Com várias contrapartidas,
        // mostra a da primeira e avisa que há outras.
        const primeira = (b.contrapartidas || []).find(c => c.codigoConta === codsContras[0]);
        const cPartidaNome = primeira
          ? (codsContras.length > 1 ? `${primeira.nomeConta} e outras` : (primeira.nomeConta || ''))
          : '';

        // pagamento: banco a crédito (saiu). recebimento: banco a débito (entrou)
        lancamentos.push({
          data: b.data,
          historico: b.historico || `${b.tipo} ${doc}`,
          documento: doc,
          boletaId: b._id,
          cPartida,
          cPartidaNome,
          debito:  ehPagamento ? 0 : b.valorTotal,
          credito: ehPagamento ? b.valorTotal : 0
        });
      }

      // A conta é uma das CONTRAPARTIDAS?
      for (const c of (b.contrapartidas || [])) {
        if (c.codigoConta === conta) {
          // contrapartida desta perna = o BANCO da boleta
          const cPartida     = b.bancoCodigo || '';
          const cPartidaNome = b.bancoNome  || '';

          // pagamento: despesa a débito. recebimento: receita a crédito.
          // Valor negativo = contrapartida invertida: vai para o outro lado, positivo.
          const v = c.valor || 0;
          let debito  = ehPagamento ? v : 0;
          let credito = ehPagamento ? 0 : v;
          if (v < 0) { const d = debito; debito = -credito; credito = -d; }
          lancamentos.push({
            data: b.data,
            historico: c.historico || c.nomeConta || '',
            documento: doc,
            boletaId: b._id,
            cPartida,
            cPartidaNome,
            debito,
            credito
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

/* GET .../razao/balancete?de=YYYY-MM-DD&ate=YYYY-MM-DD
   Uma linha por subtitulo com movimento ou saldo: anterior (antes de "de"), debitos e
   creditos no periodo, atual. Valores em REAIS; saldo = debito - credito (debito +). */
router.get('/balancete', async (req, res) => {
  try {
    const { de, ate } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(de || '') || !/^\d{4}-\d{2}-\d{2}$/.test(ate || '')) {
      return res.status(400).json({ erro: 'Informe o período (de e até).' });
    }
    const ini = new Date(de + 'T00:00:00');
    const fim = new Date(ate + 'T23:59:59.999');
    const loja = req.lojistaId ? new mongoose.Types.ObjectId(String(req.lojistaId)) : null;

    const filtro = { status: 'ATIVO', data: { $lte: fim } };
    if (loja) filtro.$or = [{ lojistaId: loja }, { lojistaId: null }, { lojistaId: { $exists: false } }];
    const boletas = await Boleta.find(filtro)
      .select('tipo data valorTotal bancoCodigo contrapartidas.codigoConta contrapartidas.valor').lean();

    const cent = v => Math.round((Number(v) || 0) * 100);
    const contas = new Map();                    // codigo -> { ant, deb, cred } em centavos
    const lanca = (cod, d, c, antes) => {
      if (!cod) return;
      if (!contas.has(cod)) contas.set(cod, { ant: 0, deb: 0, cred: 0 });
      const x = contas.get(cod);
      if (antes) x.ant += d - c; else { x.deb += d; x.cred += c; }
    };
    for (const b of boletas) {
      const antes = new Date(b.data) < ini;
      if (b.tipo === 'SALDO_TRANSFERIDO') {
        // saldo de abertura: entra sempre no SALDO ANTERIOR (nao e movimento do periodo)
        const v = cent(b.valorTotal);
        if (new Date(b.data) <= fim) lanca(b.bancoCodigo, v > 0 ? v : 0, v < 0 ? -v : 0, true);
        continue;
      }
      const ehPag = b.tipo === 'PAGAMENTO';
      const V = cent(b.valorTotal);
      lanca(b.bancoCodigo, ehPag ? 0 : V, ehPag ? V : 0, antes);
      for (const c of (b.contrapartidas || [])) {
        const v = cent(c.valor);
        let d = ehPag ? v : 0, cr = ehPag ? 0 : v;
        if (v < 0) { const t = d; d = -cr; cr = -t; }     // invertida: lado oposto
        lanca(c.codigoConta, d, cr, antes);
      }
    }

    // nomes: subtitulos, titulos e subgrupos da empresa
    const col = n => mongoose.connection.collection(n);
    const doLoja = loja ? { $or: [{ lojistaId: loja }, { lojistaId: { $exists: false } }, { lojistaId: null }] } : {};
    const nomeSub = new Map((await col('_contasubtitulos').find(doLoja).project({ codigo: 1, nome: 1 }).toArray())
      .map(c => [c.codigo, c.nome]));
    const titulos = Object.fromEntries((await col('_contatitulos').find(doLoja).project({ codigo: 1, nome: 1 }).toArray())
      .map(t => [t.codigo, t.nome]));
    const subgrupos = Object.fromEntries((await col('subgrupos').find(doLoja).toArray())
      .filter(g => g.codigo).map(g => [g.codigo, g.nome || g.descricao || '']));

    const reais = c => c / 100;
    const lista = [...contas].map(([codigo, x]) => ({
      codigo, nome: nomeSub.get(codigo) || '(fora do plano)',
      anterior: reais(x.ant), debito: reais(x.deb), credito: reais(x.cred), atual: reais(x.ant + x.deb - x.cred),
    })).filter(l => l.anterior || l.debito || l.credito)
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));

    res.json({ de, ate, contas: lista, titulos, subgrupos, boletas: boletas.length });
  } catch (err) {
    console.error('❌ /razao/balancete:', err.message);
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
