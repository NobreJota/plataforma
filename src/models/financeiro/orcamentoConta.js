// src/models/financeiro/orcamentoConta.js
// CONTAS VINCULADAS ao orçamento (lista GERAL, vale para todos os anos).
// Vincula-se uma vez. Ativo/inativo controla se entra nas projeções.
// Ex: financiamento que acabou → ativo:false → some das projeções futuras.

const mongoose = require('mongoose');

const OrcamentoContaSchema = new mongoose.Schema({
  // Vínculo com o SubTítulo do Plano de Contas (despesa, código 3.x)
  contaSubTitulo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    required: true,
    unique: true   // cada subtítulo só pode ser vinculado uma vez
  },

  // Snapshot dos dados (evita lookup constante + histórico)
  codigo:           { type: String, required: true, trim: true }, // 3.01.001.001
  nome:             { type: String, required: true, trim: true }, // Aluguel
  codigoContaTitulo:{ type: String, required: true, trim: true }, // 3.01.001
  nomeContaTitulo:  { type: String, default: '', trim: true },    // Administrativo

  // Ordem de exibição no grid (opcional, default pelo código)
  ordem: { type: Number, default: 0 },

  // ativo:false = financiamento acabou, não projeta mais
  ativo: { type: Boolean, default: true }
}, {
  collection: '_orcamento_contas',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

OrcamentoContaSchema.index({ codigo: 1 });
OrcamentoContaSchema.index({ codigoContaTitulo: 1 });
OrcamentoContaSchema.index({ ativo: 1 });

module.exports = mongoose.model('OrcamentoConta', OrcamentoContaSchema);
