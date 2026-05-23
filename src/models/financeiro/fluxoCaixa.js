// src/models/financeiro/fluxoCaixa.js
// FERRAMENTA DE DECISÃO: grid efêmero mensal.
// "Vai morrendo junto com o mês". Alimentado por outras operações + avulsos.

const mongoose = require('mongoose');

/* ===== Dicionário do campo `pos` =====
 * O significado só vira código quando criamos o menu/modal da operação.
 * Mantido aqui como referência. Campo é número livre.
 *
 *   0 = Lançamento avulso (lembrete)
 *   1 = Cartão de crédito a receber (transformação do 5)
 *   2 = Compras realizadas (a pagar fornecedor)
 *   3 = Compras programadas futuras (projeção por médias)
 *   5 = Título a receber
 *   8 = Orçamento a realizar (projeção, cor verde)
 *   (4, 6, 7, 9... reservados — ex: 9 para folha de pessoal)
 */
const POS = {
  AVULSO: 0,
  CARTAO_RECEBER: 1,
  COMPRA_PAGAR: 2,
  COMPRA_FUTURA: 3,
  TITULO_RECEBER: 5,
  ORCAMENTO: 8
};

const FluxoCaixaSchema = new mongoose.Schema({
  data: { type: Date, required: true },
  ord:  { type: Number, default: 0 },

  // Orientador de operação (ver dicionário acima)
  pos: { type: Number, required: true, default: 0 },

  // Vínculo com Plano de Contas (NrCta)
  contaSubTitulo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    default: null
  },

  nrTitulo:   { type: String, trim: true, default: '' },  // 1665/0-D
  historico:  { type: String, trim: true, default: '' },
  vencimento: { type: Date, default: null },              // Vect

  debito:  { type: Number, default: 0 },   // saída prevista/real
  credito: { type: Number, default: 0 },   // entrada prevista/real

  titular: { type: String, trim: true, default: '' },

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

  // Quando a linha é efetivada, aponta para o registro contábil real
  registroContabil: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RegistroContabil',
    default: null
  },

  // Período (o fluxo é mensal)
  mes: { type: Number, min: 1, max: 12 },
  ano: { type: Number },

  realizado: { type: Boolean, default: false },  // já virou registro contábil?
  projecao:  { type: Boolean, default: false },  // é projeção (pos 3, 8)?

  origem: { type: String, trim: true, default: 'MANUAL' },
  status: { type: String, enum: ['ATIVO', 'CANCELADO'], default: 'ATIVO' }
}, {
  collection: '_fluxo_caixa',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

// Índices
FluxoCaixaSchema.index({ ano: 1, mes: 1 });
FluxoCaixaSchema.index({ data: 1 });
FluxoCaixaSchema.index({ pos: 1 });
FluxoCaixaSchema.index({ realizado: 1 });
FluxoCaixaSchema.index({ status: 1 });

// Preenche mes/ano + flag de projeção automaticamente
FluxoCaixaSchema.pre('save', function (next) {
  if (this.data) {
    this.mes = this.data.getMonth() + 1;
    this.ano = this.data.getFullYear();
  }
  // Projeções: orçamento (8) e compras futuras (3)
  this.projecao = (this.pos === POS.ORCAMENTO || this.pos === POS.COMPRA_FUTURA);
  next();
});

// Exporta também o dicionário POS para uso nas rotas/frontend
module.exports = mongoose.model('FluxoCaixa', FluxoCaixaSchema);
module.exports.POS = POS;
