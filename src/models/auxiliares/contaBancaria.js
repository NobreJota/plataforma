// src/models/auxiliares/contaBancaria.js
// Conta bancária da cooperativa (CC-0001, CC-0002...).
// Cada conta pertence a um Banco e está vinculada a um SubTítulo do plano.

const mongoose = require('mongoose');
const { apenasNumeros } = require('../../utils/validadorDocumento');

const ContaBancariaSchema = new mongoose.Schema({
  codigo: { type: String, required: true, trim: true, unique: true },

  // Banco (referência ao cadastro mestre)
  banco: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Banco',
    required: true
  },

  agencia:    { type: String, required: true, trim: true },
  agenciaDv:  { type: String, trim: true, default: '' },
  numero:     { type: String, required: true, trim: true },
  numeroDv:   { type: String, trim: true, default: '' },

  tipo: {
    type: String,
    required: true,
    enum: ['CORRENTE', 'POUPANCA', 'APLICACAO', 'PAGAMENTO']
  },

  apelido: { type: String, trim: true, default: '' },

  // Titular (default: cooperativa, mas pode ser outro CPF/CNPJ)
  titular:        { type: String, trim: true, default: '' },
  cpfCnpjTitular: {
    type: String,
    trim: true,
    default: '',
    set: v => apenasNumeros(v)
  },

  // Vínculo com plano de contas
  contaSubTitulo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    default: null
  },

  saldoInicial:     { type: Number, default: 0 },
  dataSaldoInicial: { type: Date, default: null },

  observacoes: { type: String, default: '' },
  ativo:       { type: Boolean, default: true }
}, {
  collection: '_aux_contas_bancarias',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

ContaBancariaSchema.index({ banco: 1 });
ContaBancariaSchema.index({ ativo: 1 });
ContaBancariaSchema.index({ apelido: 1 });

module.exports = mongoose.model('ContaBancaria', ContaBancariaSchema);
