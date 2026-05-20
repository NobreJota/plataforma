// src/models/auxiliares/cliente.js
const mongoose = require('mongoose');
const { apenasNumeros } = require('../../utils/validadorDocumento');

const EnderecoSchema = new mongoose.Schema({
  cep:         { type: String, trim: true, default: '', set: v => apenasNumeros(v) },
  logradouro:  { type: String, trim: true, default: '' },
  numero:      { type: String, trim: true, default: '' },
  complemento: { type: String, trim: true, default: '' },
  bairro:      { type: String, trim: true, default: '' },
  cidade:      { type: String, trim: true, default: '' },
  uf:          { type: String, trim: true, default: '', uppercase: true, maxlength: 2 }
}, { _id: false });

const ClienteSchema = new mongoose.Schema({
  codigo: { type: String, required: true, trim: true, unique: true },
  tipo:   { type: String, required: true, enum: ['PF', 'PJ'] },
  nome:   { type: String, required: true, trim: true },
  cpfCnpj: {
    type: String, required: true, unique: true,
    set: v => apenasNumeros(v)
  },
  email:       { type: String, trim: true, default: '', lowercase: true },
  telefone:    { type: String, trim: true, default: '' },

  // 🆕 Inscrições (só para PJ)
  inscricaoEstadual:  { type: String, trim: true, default: '' },  // pode ser número ou "ISENTO"
  inscricaoMunicipal: { type: String, trim: true, default: '' },

  observacoes: { type: String, default: '' },

  enderecoCobranca: { type: EnderecoSchema, default: () => ({}) },
  enderecoEntrega:  { type: EnderecoSchema, default: () => ({}) },
  entregaIgualCobranca: { type: Boolean, default: true },

  ativo: { type: Boolean, default: true }
}, {
  collection: '_aux_clientes',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

ClienteSchema.index({ nome: 1 });
ClienteSchema.index({ ativo: 1 });

module.exports = mongoose.model('Cliente', ClienteSchema);
