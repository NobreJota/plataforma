// src/models/financeiro/fluxoProjetado.js
// FLUXO PROJETADO: memória PERMANENTE das parcelas projetadas.
// Gerado pelo Orçamento (pos 8) e futuramente por Projeção de Compras (pos 7).
// NÃO se apaga quando uma conta é paga — é o histórico do que foi planejado.

const mongoose = require('mongoose');

const FluxoProjetadoSchema = new mongoose.Schema({
  ano: { type: Number, required: true, index: true },
  mes: { type: Number, min: 1, max: 12, required: true },

  // Orientador (8=orçamento, 7=projeção compras...)
  pos: { type: Number, required: true, default: 8 },

  // Vínculo com Plano de Contas
  contaSubTitulo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    default: null
  },
  codigoConta: { type: String, trim: true, default: '' },
  nomeConta:   { type: String, trim: true, default: '' },

  historico:  { type: String, trim: true, default: '' },
  valor:      { type: Number, default: 0 },          // valor da parcela
  vencimento: { type: Date, default: null },

  // Identificação da parcela
  parcela:      { type: Number, default: 1 },        // 1, 2, 3...
  totalParcelas:{ type: Number, default: 1 },

  // Origem: liga ao orçamento que gerou
  origem: { type: String, default: 'ORCAMENTO' },
  orcamentoAno:       { type: Number, default: null },
  lancamentoId:       { type: mongoose.Schema.Types.ObjectId, default: null },

  status: { type: String, enum: ['ATIVO', 'CANCELADO'], default: 'ATIVO' }
}, {
  collection: '_fluxo_projetado',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

FluxoProjetadoSchema.index({ ano: 1, mes: 1 });
FluxoProjetadoSchema.index({ pos: 1 });
FluxoProjetadoSchema.index({ orcamentoAno: 1 });

module.exports = mongoose.model('FluxoProjetado', FluxoProjetadoSchema);
