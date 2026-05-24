// src/models/financeiro/orcamentoAnual.js
// VALORES do orçamento por ANO. As contas vinculadas vêm de OrcamentoConta.
// Aqui guardamos quanto foi projetado em cada mês, por conta, naquele ano.
// Os lançamentos (parcelas) geram linhas no Fluxo Projetado (pos 8).

const mongoose = require('mongoose');

/* Um lançamento dentro de uma conta no ano.
   Mesma mecânica do modal: valor + nº parcelas + mês inicial → gera parcelas. */
const LancamentoSchema = new mongoose.Schema({
  historico:     { type: String, trim: true, default: '' },
  valor:         { type: Number, required: true, default: 0 },  // valor de cada parcela
  numParcelas:   { type: Number, default: 1, min: 1 },
  mesInicial:    { type: Number, min: 1, max: 12, required: true },
  diaVencimento: { type: Number, min: 1, max: 31, default: 10 },
  mesesAfetados: [{ type: Number, min: 1, max: 12 }]  // ex [6,7,8,9]
}, { _id: true, timestamps: { createdAt: 'criadoEm', updatedAt: false } });

/* Valores de uma conta no ano (referencia a conta vinculada). */
const ContaValoresSchema = new mongoose.Schema({
  orcamentoConta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OrcamentoConta',
    required: true
  },
  codigo: { type: String, trim: true, default: '' },  // snapshot p/ facilitar
  nome:   { type: String, trim: true, default: '' },

  // Valor projetado por mês (índice 0=jan ... 11=dez)
  meses: { type: [Number], default: () => Array(12).fill(0) },

  // Lançamentos detalhados (geram as parcelas / o valor dos meses)
  lancamentos: [LancamentoSchema]
}, { _id: true });

const OrcamentoAnualSchema = new mongoose.Schema({
  ano: { type: Number, required: true, unique: true, index: true },

  contas: [ContaValoresSchema],

  observacoes: { type: String, default: '' },
  status: { type: String, enum: ['ABERTO', 'FECHADO'], default: 'ABERTO' }
}, {
  collection: '_orcamento_anual',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

OrcamentoAnualSchema.index({ ano: 1 });

module.exports = mongoose.model('OrcamentoAnual', OrcamentoAnualSchema);
