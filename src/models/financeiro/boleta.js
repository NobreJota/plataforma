// src/models/financeiro/boleta.js
// BOLETA: documento de um pagamento/recebimento em LOTE (partida dobrada com rateio).
// 1 boleta = 1 lançamento no banco (crédito p/ pagamento, débito p/ recebimento)
//          + N contrapartidas (as contas das despesas/receitas, uma por título).
// A soma das contrapartidas = valor do banco.

const mongoose = require('mongoose');

// Cada linha da contrapartida (um título pago/recebido)
const ContrapartidaSchema = new mongoose.Schema({
  // Conta de despesa (pagamento) ou receita (recebimento)
  contaSubTitulo: { type: mongoose.Schema.Types.ObjectId, ref: 'ContaSubTitulo', default: null },
  codigoConta: { type: String, default: '' },
  nomeConta:   { type: String, default: '' },

  historico: { type: String, default: '' },
  nrTitulo:  { type: String, default: '' },
  valor:     { type: Number, required: true, default: 0 },

  // Rastreabilidade: de qual lançamento do Fluxo Projetado veio
  fluxoLancamentoId: { type: mongoose.Schema.Types.ObjectId, default: null },
  pos: { type: Number, default: null },

  // Relacionamentos opcionais
  fornecedor: { type: mongoose.Schema.Types.ObjectId, ref: 'fornec', default: null },
  cliente:    { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', default: null }
}, { _id: true });

const BoletaSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true },

  tipo: { type: String, required: true, enum: ['PAGAMENTO', 'RECEBIMENTO'] },

  data: { type: Date, required: true },

  // O BANCO (a "perna" única da partida)
  contaBancaria:  { type: mongoose.Schema.Types.ObjectId, ref: 'ContaBancaria', default: null },
  bancoSubTitulo: { type: mongoose.Schema.Types.ObjectId, ref: 'ContaSubTitulo', default: null },
  bancoCodigo: { type: String, default: '' },
  bancoNome:   { type: String, default: '' },

  // Valor total (= soma das contrapartidas)
  valorTotal: { type: Number, required: true, default: 0 },

  // Para PAGAMENTO: banco é creditado (sai dinheiro), contrapartidas são débitos
  // Para RECEBIMENTO: banco é debitado (entra dinheiro), contrapartidas são créditos
  contrapartidas: [ContrapartidaSchema],

  historico: { type: String, default: '' },
  mes: { type: Number, min: 1, max: 12 },
  ano: { type: Number },

  origem:   { type: String, default: 'FLUXO' },
  operador: { type: String, default: '' },
  status:   { type: String, enum: ['ATIVO', 'CANCELADO'], default: 'ATIVO' }
}, {
  collection: '_boletas',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

BoletaSchema.index({ data: -1 });
BoletaSchema.index({ ano: 1, mes: 1 });
BoletaSchema.index({ tipo: 1 });
BoletaSchema.index({ contaBancaria: 1 });
BoletaSchema.index({ status: 1 });

BoletaSchema.pre('save', function (next) {
  if (this.data) {
    this.mes = this.data.getMonth() + 1;
    this.ano = this.data.getFullYear();
  }
  next();
});

module.exports = mongoose.models.Boleta || mongoose.model('Boleta', BoletaSchema);
