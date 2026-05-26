// src/models/financeiro/compraAnual.js
// VALORES da Programação de Compras por ANO (por fornecedor).
// Espelha o orcamentoAnual. Os lançamentos geram parcelas no Fluxo Projetado (pos 7).

const mongoose = require('mongoose');

const LancamentoCompraSchema = new mongoose.Schema({
  historico:     { type: String, trim: true, default: '' },
  valor:         { type: Number, required: true, default: 0 },
  numParcelas:   { type: Number, default: 1, min: 1 },
  mesInicial:    { type: Number, min: 1, max: 12, required: true },
  diaVencimento: { type: Number, min: 1, max: 31, default: 10 },
  intervalo:     { type: Number, default: 1 },  // 1=mensal, 2=bimensal, 3=trimestral, 6=semestral
  mesesAfetados: [{ type: Number, min: 1, max: 12 }]
}, { _id: true, timestamps: { createdAt: 'criadoEm', updatedAt: false } });

const FornecedorValoresSchema = new mongoose.Schema({
  compraFornecedor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CompraFornecedor',
    required: true
  },
  razao: { type: String, trim: true, default: '' },  // snapshot
  meses: { type: [Number], default: () => Array(12).fill(0) },
  lancamentos: [LancamentoCompraSchema]
}, { _id: true });

const CompraAnualSchema = new mongoose.Schema({
  ano: { type: Number, required: true, unique: true, index: true },
  fornecedores: [FornecedorValoresSchema],
  observacoes: { type: String, default: '' },
  status: { type: String, enum: ['ABERTO', 'FECHADO'], default: 'ABERTO' }
}, {
  collection: '_compra_anual',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

CompraAnualSchema.index({ ano: 1 });

module.exports = mongoose.model('CompraAnual', CompraAnualSchema);
