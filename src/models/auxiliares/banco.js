// src/models/auxiliares/banco.js
// Instituição bancária (BB, Bradesco, Itaú...). Cadastro mestre.

const mongoose = require('mongoose');

const BancoSchema = new mongoose.Schema({
  // Código FEBRABAN (3 dígitos, ex: "001" = Banco do Brasil)
  codigo: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    minlength: 3,
    maxlength: 3
  },
  nome: { type: String, required: true, trim: true },
  nomeCurto: { type: String, trim: true, default: '' },
  ativo: { type: Boolean, default: true }
}, {
  collection: '_aux_bancos',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

BancoSchema.index({ nome: 1 });
BancoSchema.index({ ativo: 1 });

module.exports = mongoose.model('Banco', BancoSchema);
