// =============================================================================
// Destino: C:\plataformaRota\src\models\compra\pedido.js
// Criado em:   23/09/2026
// Alterado em: 27/09/2026 — pedido importado pode nascer sem fornecedor
//              vigente, guardando o nome do sistema antigo.
//
// Pedido de compra. Ciclo:
//   PP  pre-pedido ...... itens guardados para a proxima compra, nao pedidos
//   P   pendente ........ emitido, aguardando entrega
//   L   liquidado ....... entregue integralmente
//   S   com saldo ....... entregue em parte; gera pedido novo com o que faltou
//   C   cancelado ....... nada e apagado, so muda a situacao
//
// O pedido NAO move estoque. Quem move e a entrada da nota fiscal.
// Na emissao gera previsao no fluxo (tipo 7). Na entrada da nota, a parte
// atendida vira obrigacao a pagar (tipo 2) e o restante segue como previsao.
// =============================================================================

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// Se o model de produto tiver outro nome, esta e a unica linha a trocar.
const REF_PRODUTO = 'arquivoDoc';

// Tipos na coluna T do fluxo. Numeros herdados do sistema antigo.
const TIPO_FLUXO = {
  PREVISAO_PEDIDO: 7,
  OBRIGACAO_PAGAR: 2,
};

const SITUACOES = ['PP', 'P', 'L', 'S', 'C'];

// ---------------------------------------------------------------------------
// Item
// ---------------------------------------------------------------------------
const ItemSchema = new Schema({
  produto:     { type: Schema.Types.ObjectId, ref: REF_PRODUTO },

  // Congelados na emissao: o cadastro pode mudar depois e o pedido nao muda.
  codigoOrigem: { type: Number },   // CódigoProd do sistema antigo
  referencia:   { type: String, trim: true },
  descricao:    { type: String, trim: true },

  quantidade:         { type: Number, required: true, min: 0 },
  quantidadeAtendida: { type: Number, default: 0, min: 0 },

  custoUnitario: { type: Number, required: true, min: 0 }, // centavos

  // Como a sugestao foi calculada — fica gravado para auditoria depois.
  baseCalculo: {
    janelaDias:     { type: Number },  // 15, 30, 60 ou 90
    saidaNoPeriodo: { type: Number },
    estoqueNaData:  { type: Number },
    aCaminhoNaData: { type: Number },
    ajustadoAMao:   { type: Boolean, default: false },
  },
}, { _id: true });

ItemSchema.virtual('saldo').get(function () {
  return Math.max(0, (this.quantidade || 0) - (this.quantidadeAtendida || 0));
});

ItemSchema.virtual('valorTotal').get(function () {
  return (this.quantidade || 0) * (this.custoUnitario || 0);
});

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------
const PedidoSchema = new Schema({
  lojistaId: { type: Schema.Types.ObjectId, ref: 'lojista', required: true, index: true },

  numero:    { type: Number },              // sequencial por empresa; PP nasce sem
  situacao:  { type: String, enum: SITUACOES, default: 'PP', required: true },

  // Pedido EMITIDO na plataforma exige fornecedor vigente — a API recusa sem
  // ele. Pedido IMPORTADO do sistema antigo pode vir de fornecedor que ainda
  // nao passou pelo de/para: e historico, e esconder historico por falta de
  // cadastro seria esconder compromisso a pagar.
  fornecedor:      { type: Schema.Types.ObjectId, ref: 'fornec', default: null },
  fornecedorNome:  { type: String, trim: true },  // o nome no sistema antigo
  nrFornecOrigem:  { type: Number },        // NrFornec do Access, ate o de/para fechar

  dataEmissao:         { type: Date },
  dataEntregaPrevista: { type: Date },      // marcada no calendario; base dos vencimentos
  dataEntregaReal:     { type: Date },

  // "84/112 dias" -> dias: [84, 112]. Contados da entrega prevista.
  condicaoPagamento: {
    texto: { type: String, trim: true },
    dias:  [{ type: Number, min: 0 }],
  },

  transportadora: { type: Schema.Types.ObjectId, ref: 'transportadora' },
  representante:  { type: String, trim: true },
  entregaPara:    { type: Date },

  itens: { type: [ItemSchema], default: [] },

  valorTotal: { type: Number, default: 0, min: 0 }, // centavos

  // Encadeamento do saldo
  saldoDe:    { type: Schema.Types.ObjectId, ref: 'compraPedido' }, // pedido que o originou
  pedidoSaldo:{ type: Schema.Types.ObjectId, ref: 'compraPedido' }, // filho gerado

  // Linhas geradas no fluxo, para achar e substituir na entrada da nota.
  lancamentosFluxo: [{ type: Schema.Types.ObjectId, ref: 'fluxoProjetado' }],

  observacao: { type: String, trim: true },

  criadoPor:  { type: Schema.Types.ObjectId, ref: 'usuario' },
  canceladoEm:{ type: Date },
  motivoCancelamento: { type: String, trim: true },
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  collection: '_compra_pedidos',
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ---------------------------------------------------------------------------
// Indices compostos com lojistaId — nunca unique global.
// ---------------------------------------------------------------------------
PedidoSchema.index({ lojistaId: 1, numero: 1 }, {
  unique: true,
  partialFilterExpression: { numero: { $type: 'number' } }, // PP nao entra
});
PedidoSchema.index({ lojistaId: 1, situacao: 1, fornecedor: 1 });
PedidoSchema.index({ lojistaId: 1, 'itens.produto': 1 });   // consulta "a caminho"
PedidoSchema.index({ lojistaId: 1, dataEmissao: -1 });

// ---------------------------------------------------------------------------
// Virtuais
// ---------------------------------------------------------------------------
PedidoSchema.virtual('valorAtendido').get(function () {
  return (this.itens || []).reduce(
    (s, i) => s + (i.quantidadeAtendida || 0) * (i.custoUnitario || 0), 0);
});

PedidoSchema.virtual('valorSaldo').get(function () {
  return Math.max(0, (this.valorTotal || 0) - this.valorAtendido);
});

// Fracao entregue. E ela que rateia a previsao do fluxo na entrada da nota.
PedidoSchema.virtual('percentualAtendido').get(function () {
  if (!this.valorTotal) return 0;
  return this.valorAtendido / this.valorTotal;
});

PedidoSchema.virtual('temSaldo').get(function () {
  return (this.itens || []).some(i => i.saldo > 0);
});

// ---------------------------------------------------------------------------
// Metodos
// ---------------------------------------------------------------------------
PedidoSchema.methods.recalcularTotal = function () {
  this.valorTotal = (this.itens || []).reduce(
    (s, i) => s + (i.quantidade || 0) * (i.custoUnitario || 0), 0);
  return this.valorTotal;
};

// Vencimentos a partir da data de entrega prevista.
PedidoSchema.methods.calcularVencimentos = function () {
  const base = this.dataEntregaPrevista;
  const dias = this.condicaoPagamento?.dias || [];
  if (!base || !dias.length) return [];

  const total = this.valorTotal || 0;
  const porTitulo = Math.floor(total / dias.length);
  const resto = total - porTitulo * dias.length;

  return dias.map((d, i) => ({
    vencimento: new Date(base.getTime() + d * 86400000),
    valor: porTitulo + (i === dias.length - 1 ? resto : 0), // sobra no ultimo
  }));
};

// Monta o pedido do saldo. Nao grava — quem grava e a API.
PedidoSchema.methods.montarPedidoSaldo = function () {
  const pendentes = (this.itens || []).filter(i => i.saldo > 0);
  if (!pendentes.length) return null;

  return {
    lojistaId: this.lojistaId,
    situacao: 'P',
    fornecedor: this.fornecedor,
    nrFornecOrigem: this.nrFornecOrigem,
    dataEmissao: new Date(),
    condicaoPagamento: this.condicaoPagamento, // herda o prazo do original
    transportadora: this.transportadora,
    representante: this.representante,
    saldoDe: this._id,
    itens: pendentes.map(i => ({
      produto: i.produto,
      codigoOrigem: i.codigoOrigem,
      referencia: i.referencia,
      descricao: i.descricao,
      quantidade: i.saldo,
      custoUnitario: i.custoUnitario,
      baseCalculo: { ajustadoAMao: false },
    })),
  };
};

PedidoSchema.pre('save', function (next) {
  if (this.isModified('itens')) this.recalcularTotal();
  next();
});

const Pedido = mongoose.model('compraPedido', PedidoSchema);

module.exports = Pedido;
module.exports.TIPO_FLUXO = TIPO_FLUXO;
module.exports.SITUACOES = SITUACOES;