// src/models/financeiro/compraFornecedor.js
// FORNECEDORES VINCULADOS à Programação de Compras (lista GERAL, todos os anos).
// Espelha o orcamentoConta, mas referencia o fornecedor (fornec) em vez de conta.
// ativo:false = fornecedor não entra mais nas projeções (mas mantém histórico).

const mongoose = require('mongoose');

const CompraFornecedorSchema = new mongoose.Schema({
  // Vínculo com o fornecedor unificado (model 'fornec')
  fornecedor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'fornec',
    required: true,
    unique: true   // cada fornecedor vinculado uma vez
  },

  // Snapshot (evita lookup + histórico)
  razao: { type: String, required: true, trim: true },
  cnpj:  { type: String, default: '', trim: true },
  marca: { type: String, default: '', trim: true },

  ordem: { type: Number, default: 0 },
  ativo: { type: Boolean, default: true }
}, {
  collection: '_compra_fornecedores',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

CompraFornecedorSchema.index({ razao: 1 });
CompraFornecedorSchema.index({ ativo: 1 });

module.exports = mongoose.model('CompraFornecedor', CompraFornecedorSchema);
