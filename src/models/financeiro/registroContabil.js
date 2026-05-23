// src/models/financeiro/registroContabil.js
// FONTE DA VERDADE: registros financeiros permanentes da empresa.
// Pagamentos, recebimentos, transferências, recebimento de cartões.

const mongoose = require('mongoose');

const RegistroContabilSchema = new mongoose.Schema({
  codigo: { type: String, required: true, trim: true, unique: true },

  tipo: {
    type: String,
    required: true,
    enum: ['PAGAMENTO', 'RECEBIMENTO', 'TRANSFERENCIA', 'CARTAO']
  },

  data: { type: Date, required: true },

  // Vínculo com Plano de Contas (NrCta, ex: 1.03.017.472)
  contaSubTitulo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    required: true
  },

  // Conta bancária movimentada (opcional)
  contaBancaria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaBancaria',
    default: null
  },

  // Conta da outra ponta da partida dobrada (C/Partida)
  contaContrapartida: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    default: null
  },

  nrTitulo:  { type: String, trim: true, default: '' },  // NF/duplicata 1665/0-D
  historico: { type: String, trim: true, default: '' },

  valor:   { type: Number, default: 0 },
  debito:  { type: Number, default: 0 },
  credito: { type: Number, default: 0 },

  // Relacionamentos opcionais
  cliente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    default: null
  },
  fornecedor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fornecedor',
    default: null
  },
  titular: { type: String, trim: true, default: '' },

  // Período (facilita consultas e fechamento mensal)
  mes: { type: Number, min: 1, max: 12 },
  ano: { type: Number },

  conciliado: { type: Boolean, default: false },

  // De onde veio: COMPRAS, VENDAS, PESSOAL, MANUAL...
  origem:   { type: String, trim: true, default: 'MANUAL' },
  operador: { type: String, trim: true, default: '' },

  status: { type: String, enum: ['ATIVO', 'CANCELADO'], default: 'ATIVO' }
}, {
  collection: '_reg_contabeis',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

// Índices para consultas frequentes
RegistroContabilSchema.index({ data: -1 });
RegistroContabilSchema.index({ ano: 1, mes: 1 });
RegistroContabilSchema.index({ tipo: 1 });
RegistroContabilSchema.index({ contaSubTitulo: 1 });
RegistroContabilSchema.index({ contaBancaria: 1 });
RegistroContabilSchema.index({ status: 1 });

// Preenche mes/ano automaticamente a partir da data
RegistroContabilSchema.pre('save', function (next) {
  if (this.data) {
    this.mes = this.data.getMonth() + 1;
    this.ano = this.data.getFullYear();
  }
  next();
});

module.exports = mongoose.model('RegistroContabil', RegistroContabilSchema);
