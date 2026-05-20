// src/routes/auxiliares/contas-bancarias-api.js
const express = require('express');
const ContaBancaria = require('../../models/auxiliares/contaBancaria');
const Banco = require('../../models/auxiliares/banco');

const router = express.Router();

/* ===== Helpers ===== */
async function proximoCodigo() {
  const ultima = await ContaBancaria.findOne()
    .sort({ codigo: -1 })
    .collation({ locale: 'en_US', numericOrdering: true });
  if (!ultima) return 'CB-0001';
  const num = parseInt(String(ultima.codigo).replace(/\D/g, ''), 10) || 0;
  return 'CB-' + String(num + 1).padStart(4, '0');
}

/* ===== Rotas ===== */

/* LISTAR */
router.get('/', async (req, res) => {
  try {
    const incluirInativos = req.query.incluirInativos === 'true';
    const busca = (req.query.busca || '').trim();
    const filter = {};
    if (!incluirInativos) filter.ativo = true;
    if (busca) {
      filter.$or = [
        { codigo: new RegExp(busca, 'i') },
        { apelido: new RegExp(busca, 'i') },
        { agencia: new RegExp(busca, 'i') },
        { numero: new RegExp(busca, 'i') }
      ];
    }
    const contas = await ContaBancaria.find(filter)
      .populate('banco', 'codigo nome nomeCurto')
      .populate('contaSubTitulo', 'codigo descricao')
      .sort({ codigo: 1 });
    res.json(contas);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* OBTER POR ID */
router.get('/:id', async (req, res) => {
  try {
    const c = await ContaBancaria.findById(req.params.id)
      .populate('banco', 'codigo nome nomeCurto')
      .populate('contaSubTitulo', 'codigo descricao');
    if (!c) return res.status(404).json({ erro: 'Conta bancária não encontrada.' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* CRIAR */
router.post('/', async (req, res) => {
  try {
    const {
      banco, agencia, agenciaDv, numero, numeroDv,
      tipo, apelido, titular, cpfCnpjTitular,
      contaSubTitulo, saldoInicial, dataSaldoInicial, observacoes
    } = req.body;

    if (!banco)   return res.status(400).json({ erro: 'Banco é obrigatório.' });
    if (!agencia) return res.status(400).json({ erro: 'Agência é obrigatória.' });
    if (!numero)  return res.status(400).json({ erro: 'Número da conta é obrigatório.' });
    if (!tipo)    return res.status(400).json({ erro: 'Tipo é obrigatório.' });
    if (!['CORRENTE', 'POUPANCA', 'APLICACAO', 'PAGAMENTO'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo inválido.' });
    }

    // Verifica se banco existe
    const bancoExiste = await Banco.findById(banco);
    if (!bancoExiste) return res.status(400).json({ erro: 'Banco selecionado não existe.' });

    const codigo = await proximoCodigo();
    const nova = await ContaBancaria.create({
      codigo,
      banco,
      agencia:    String(agencia).trim(),
      agenciaDv:  String(agenciaDv || '').trim(),
      numero:     String(numero).trim(),
      numeroDv:   String(numeroDv || '').trim(),
      tipo,
      apelido:    String(apelido || '').trim(),
      titular:    String(titular || '').trim(),
      cpfCnpjTitular: cpfCnpjTitular || '',
      contaSubTitulo: contaSubTitulo || null,
      saldoInicial:     Number(saldoInicial) || 0,
      dataSaldoInicial: dataSaldoInicial || null,
      observacoes: String(observacoes || '').trim()
    });

    const populada = await ContaBancaria.findById(nova._id)
      .populate('banco', 'codigo nome nomeCurto')
      .populate('contaSubTitulo', 'codigo descricao');
    res.status(201).json(populada);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* ATUALIZAR */
router.put('/:id', async (req, res) => {
  try {
    const {
      banco, agencia, agenciaDv, numero, numeroDv,
      tipo, apelido, titular, cpfCnpjTitular,
      contaSubTitulo, saldoInicial, dataSaldoInicial,
      observacoes, ativo
    } = req.body;

    const patch = {};
    if (banco !== undefined)         patch.banco = banco;
    if (agencia !== undefined)       patch.agencia = String(agencia).trim();
    if (agenciaDv !== undefined)     patch.agenciaDv = String(agenciaDv).trim();
    if (numero !== undefined)        patch.numero = String(numero).trim();
    if (numeroDv !== undefined)      patch.numeroDv = String(numeroDv).trim();
    if (tipo !== undefined)          patch.tipo = tipo;
    if (apelido !== undefined)       patch.apelido = String(apelido).trim();
    if (titular !== undefined)       patch.titular = String(titular).trim();
    if (cpfCnpjTitular !== undefined) patch.cpfCnpjTitular = cpfCnpjTitular;
    if (contaSubTitulo !== undefined) patch.contaSubTitulo = contaSubTitulo || null;
    if (saldoInicial !== undefined)  patch.saldoInicial = Number(saldoInicial) || 0;
    if (dataSaldoInicial !== undefined) patch.dataSaldoInicial = dataSaldoInicial || null;
    if (observacoes !== undefined)   patch.observacoes = String(observacoes).trim();
    if (ativo !== undefined)         patch.ativo = !!ativo;

    const c = await ContaBancaria.findByIdAndUpdate(req.params.id, patch, { new: true })
      .populate('banco', 'codigo nome nomeCurto')
      .populate('contaSubTitulo', 'codigo descricao');
    if (!c) return res.status(404).json({ erro: 'Conta bancária não encontrada.' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* INATIVAR */
router.delete('/:id', async (req, res) => {
  try {
    const c = await ContaBancaria.findByIdAndUpdate(
      req.params.id, { ativo: false }, { new: true }
    );
    if (!c) return res.status(404).json({ erro: 'Conta bancária não encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* REATIVAR */
router.post('/:id/reativar', async (req, res) => {
  try {
    const c = await ContaBancaria.findByIdAndUpdate(
      req.params.id, { ativo: true }, { new: true }
    );
    if (!c) return res.status(404).json({ erro: 'Conta bancária não encontrada.' });
    res.json(c);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
