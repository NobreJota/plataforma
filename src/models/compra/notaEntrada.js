// =============================================================================
// Destino: C:\plataformaRota\src\models\compra\notaEntrada.js
// Criado em:   24/09/2026
// Alterado em: 26/09/2026 — tentativas de contagem e bloqueio da nota.
// Alterado em: 25/09/2026 — campos fiscais completos (tela em formato DANFE)
//                           e rateio separado do frete que veio no XML.
//
// Nota fiscal de ENTRADA de mercadoria.
//
// Ciclo:
//   RECEBIDA        XML lido, nada conferido
//   VINCULADA       pedido escolhido, itens comparados
//   EM_CONFERENCIA  leitura de codigo de barras em andamento
//   EFETIVADA       estoque subiu, pos 7 virou pos 2, pedido L ou S
//   RECUSADA        nota que nao e nossa ou veio errada
//
// A nota tem vida propria entre a chegada e a efetivacao: pode ficar dias
// em conferencia. Por isso e colecao, nao passo de tela.
//
// O ESTOQUE SO SOBE NA EFETIVACAO, nunca antes.
// =============================================================================

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SITUACOES = ['RECEBIDA', 'VINCULADA', 'EM_CONFERENCIA', 'EFETIVADA', 'RECUSADA'];

// ---------------------------------------------------------------------------
// Item da nota
//
// Carrega TRES identidades, e conciliar as tres e a razao da conferencia:
//   cProd  = codigo do produto no cadastro DO FORNECEDOR
//   cEAN   = codigo de barras (o que o leitor le)
//   produto = o nosso produto
// ---------------------------------------------------------------------------
const ItemSchema = new Schema({
  // ---- como veio no XML (nunca alterado) ---------------------------------
  numeroItem:   { type: Number },              // nItem
  codigoFornec: { type: String, trim: true },  // cProd
  ean:          { type: String, trim: true },  // cEAN
  eanTributavel:{ type: String, trim: true },  // cEANTrib
  descricaoXml: { type: String, trim: true },  // xProd
  ncm:          { type: String, trim: true },
  cest:         { type: String, trim: true },
  cfop:         { type: String, trim: true },
  unidade:      { type: String, trim: true },  // uCom
  infoAdicional:{ type: String, trim: true },  // infAdProd (o "Trib aprox" do DANFE)

  quantidade:    { type: Number, default: 0 }, // qCom
  valorUnitario: { type: Number, default: 0 }, // vUnCom, em centavos
  valorTotal:    { type: Number, default: 0 }, // vProd, em centavos
  desconto:      { type: Number, default: 0 },
  frete:         { type: Number, default: 0 }, // vFrete DO ITEM, como veio no XML
  seguro:        { type: Number, default: 0 },
  outras:        { type: Number, default: 0 },
  ipi:           { type: Number, default: 0 },
  icmsSt:        { type: Number, default: 0 },

  // ---- tributacao, para a tela em formato DANFE ---------------------------
  origem:   { type: String, trim: true },      // orig (0 nacional, 1 importado...)
  cst:      { type: String, trim: true },      // CST ou CSOSN
  bcIcms:   { type: Number, default: 0 },      // centavos
  icms:     { type: Number, default: 0 },      // centavos
  aliqIcms: { type: Number, default: 0 },      // 7 = 7%
  aliqIpi:  { type: Number, default: 0 },      // 6.5 = 6,5%

  // parte do frete/seguro/outras da NOTA que coube a este item.
  // Calculado, nao vem do XML — por isso e campo proprio, sem sobrescrever
  // o `frete` que o emitente mandou na linha.
  rateio: { type: Number, default: 0 },

  // custo real do item: produto + ipi + st + rateio - desconto
  custoUnitarioReal: { type: Number, default: 0 },

  // ---- nosso produto ------------------------------------------------------
  produto:      { type: Schema.Types.ObjectId, ref: 'arquivo_doc', default: null },
  codigoProd:   { type: Number, default: null },   // codigo do sistema antigo

  // como o produto foi identificado
  vinculadoPor: {
    type: String,
    enum: ['ean', 'codigoFornec', 'pedido', 'manual', ''],
    default: '',
  },

  // ---- conferencia fisica -------------------------------------------------
  quantidadeConferida: { type: Number, default: 0 },
  conferidoEm:  { type: Date, default: null },
  conferidoPor: { type: Schema.Types.ObjectId, ref: 'usuario', default: null },

  // Cada contagem que o conferente digitou, certa ou errada. Tres erradas
  // travam a nota. O historico fica para o gerente entender o que houve —
  // contar 1 quando sao 2 tres vezes seguidas e diferente de contar 1, 5 e 3.
  tentativas: [{
    quantidade: { type: Number },
    em:         { type: Date, default: Date.now },
    _id: false,
  }],

  // ---- ligacao com o pedido ----------------------------------------------
  itemPedidoId:      { type: Schema.Types.ObjectId, default: null },
  quantidadePedida:  { type: Number, default: 0 },
  custoPedido:       { type: Number, default: 0 },   // para ver se o preco mudou

  observacao: { type: String, trim: true, default: '' },
}, { _id: true });

// o que falta conferir
ItemSchema.virtual('faltaConferir').get(function () {
  return Math.max(0, (this.quantidade || 0) - (this.quantidadeConferida || 0));
});

ItemSchema.virtual('conferido').get(function () {
  return (this.quantidadeConferida || 0) >= (this.quantidade || 0);
});

ItemSchema.virtual('identificado').get(function () {
  return !!this.produto || !!this.codigoProd;
});

// preco mudou desde o pedido?
ItemSchema.virtual('variacaoCusto').get(function () {
  if (!this.custoPedido) return null;
  return this.custoUnitarioReal - this.custoPedido;
});

// ---------------------------------------------------------------------------
// Nota
// ---------------------------------------------------------------------------
const NotaEntradaSchema = new Schema({
  lojistaId: { type: Schema.Types.ObjectId, ref: 'lojista', required: true, index: true },

  situacao: { type: String, enum: SITUACOES, default: 'RECEBIDA', required: true },

  // ---- identificacao da NF-e ---------------------------------------------
  chaveAcesso: { type: String, trim: true },          // 44 digitos
  numero:      { type: String, trim: true },          // nNF
  serie:       { type: String, trim: true },
  modelo:      { type: String, trim: true, default: '55' },
  naturezaOperacao: { type: String, trim: true },     // natOp
  dataEmissao: { type: Date },
  dataSaida:   { type: Date },                        // dhSaiEnt, saida do emitente
  dataEntrada: { type: Date },                        // quando a mercadoria chegou

  // ---- emitente -----------------------------------------------------------
  emitente: {
    cnpj:        { type: String, trim: true },
    razao:       { type: String, trim: true },
    fantasia:    { type: String, trim: true },
    inscricao:   { type: String, trim: true },
    logradouro:  { type: String, trim: true },
    complemento: { type: String, trim: true },
    bairro:      { type: String, trim: true },
    cidade:      { type: String, trim: true },
    uf:          { type: String, trim: true },
    cep:         { type: String, trim: true },
    fone:        { type: String, trim: true },
  },

  // ---- destinatario (nos) -------------------------------------------------
  // Guardado para conferir que a nota e mesmo desta empresa.
  destinatario: {
    cnpj:      { type: String, trim: true },
    razao:     { type: String, trim: true },
    inscricao: { type: String, trim: true },
    cidade:    { type: String, trim: true },
    uf:        { type: String, trim: true },
  },

  // fornecedor da plataforma, achado pelo CNPJ do emitente
  fornecedor: { type: Schema.Types.ObjectId, ref: 'fornec', default: null },

  // ---- valores (centavos) -------------------------------------------------
  valorBcIcms:   { type: Number, default: 0 },        // vBC
  valorIcms:     { type: Number, default: 0 },        // vICMS
  valorBcIcmsSt: { type: Number, default: 0 },        // vBCST
  valorIcmsSt:   { type: Number, default: 0 },        // vST
  valorProdutos: { type: Number, default: 0 },
  valorFrete:    { type: Number, default: 0 },
  valorSeguro:   { type: Number, default: 0 },
  valorDesconto: { type: Number, default: 0 },
  valorOutras:   { type: Number, default: 0 },        // vOutro
  valorIpi:      { type: Number, default: 0 },
  valorTotal:    { type: Number, default: 0 },        // vNF

  // ---- transporte ---------------------------------------------------------
  frete: { type: String, enum: ['CIF', 'FOB', ''], default: '' },
  modFrete: { type: String, trim: true, default: '' },  // 0..4, 9 — como no DANFE
  transportadora: { type: Schema.Types.ObjectId, ref: 'transportadora', default: null },
  transportadoraXml: {
    cnpj:      { type: String, trim: true },
    razao:     { type: String, trim: true },
    inscricao: { type: String, trim: true },
    endereco:  { type: String, trim: true },
    cidade:    { type: String, trim: true },
    uf:        { type: String, trim: true },
  },
  volumes: [{
    quantidade:  { type: Number, default: 0 },
    especie:     { type: String, trim: true },
    marca:       { type: String, trim: true },
    numeracao:   { type: String, trim: true },
    pesoBruto:   { type: Number, default: 0 },
    pesoLiquido: { type: Number, default: 0 },
    _id: false,
  }],

  // ---- duplicatas do XML --------------------------------------------------
  // Viram os titulos no fluxo. Podem divergir do pedido: a nota manda.
  duplicatas: [{
    numero:     { type: String, trim: true },
    vencimento: { type: Date },
    valor:      { type: Number, default: 0 },         // centavos
    _id: false,
  }],

  itens: { type: [ItemSchema], default: [] },

  // ---- autorizacao na SEFAZ ----------------------------------------------
  protocolo: {
    numero: { type: String, trim: true },
    data:   { type: Date },
    status: { type: String, trim: true },             // cStat, 100 = autorizada
    motivo: { type: String, trim: true },
  },

  informacoesComplementares: { type: String, trim: true, default: '' },

  // ---- ligacao com o pedido ----------------------------------------------
  pedido: { type: Schema.Types.ObjectId, ref: 'compraPedido', default: null },
  tipoEntrada: {
    type: String,
    enum: ['TOTAL', 'PARCIAL', 'SEM_PEDIDO', ''],
    default: '',
  },
  pedidoSaldoGerado: { type: Schema.Types.ObjectId, ref: 'compraPedido', default: null },

  // ---- efeitos da efetivacao ---------------------------------------------
  lancamentosFluxo: [{ type: Schema.Types.ObjectId, ref: 'FluxoProjetado' }],
  estoqueAplicado: { type: Boolean, default: false },
  efetivadaEm:  { type: Date, default: null },
  efetivadaPor: { type: Schema.Types.ObjectId, ref: 'usuario', default: null },

  // ---- procedencia --------------------------------------------------------
  origemXml: {
    type: String,
    enum: ['upload', 'email', 'sefaz', 'api', 'manual'],
    default: 'upload',
  },
  xmlBruto: { type: String, default: '' },            // guardado por exigencia legal

  // ---- travada na contagem -----------------------------------------------
  // Tres contagens erradas no mesmo item param a nota inteira. Destravar e
  // do gerente, em Compra -> Entrada de mercadoria -> Desbloqueio da nota.
  bloqueada:       { type: Boolean, default: false },
  bloqueadaEm:     { type: Date, default: null },
  bloqueadaItem:   { type: Number, default: null },   // indice do item
  bloqueadaMotivo: { type: String, trim: true, default: '' },

  recusadaMotivo: { type: String, trim: true, default: '' },
  observacao:     { type: String, trim: true, default: '' },
}, {
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  collection: '_compra_notas_entrada',
  toJSON:   { virtuals: true },
  toObject: { virtuals: true },
});

// ---------------------------------------------------------------------------
// Indices compostos com lojistaId — nunca unique global
// ---------------------------------------------------------------------------
NotaEntradaSchema.index({ lojistaId: 1, chaveAcesso: 1 }, {
  unique: true,
  partialFilterExpression: { chaveAcesso: { $type: 'string' } },
});
NotaEntradaSchema.index({ lojistaId: 1, situacao: 1, dataEmissao: -1 });
NotaEntradaSchema.index({ lojistaId: 1, fornecedor: 1 });
NotaEntradaSchema.index({ lojistaId: 1, pedido: 1 });
NotaEntradaSchema.index({ lojistaId: 1, 'itens.ean': 1 });

// ---------------------------------------------------------------------------
// Virtuais
// ---------------------------------------------------------------------------
NotaEntradaSchema.virtual('itensIdentificados').get(function () {
  return (this.itens || []).filter(i => i.identificado).length;
});

NotaEntradaSchema.virtual('itensConferidos').get(function () {
  return (this.itens || []).filter(i => i.conferido).length;
});

NotaEntradaSchema.virtual('prontaParaEfetivar').get(function () {
  const itens = this.itens || [];
  if (!itens.length) return false;
  return itens.every(i => i.identificado && i.conferido);
});

NotaEntradaSchema.virtual('somaDuplicatas').get(function () {
  return (this.duplicatas || []).reduce((s, d) => s + (d.valor || 0), 0);
});

// peso total dos volumes, para a tela
NotaEntradaSchema.virtual('pesoBruto').get(function () {
  return (this.volumes || []).reduce((s, v) => s + (v.pesoBruto || 0), 0);
});

NotaEntradaSchema.virtual('pesoLiquido').get(function () {
  return (this.volumes || []).reduce((s, v) => s + (v.pesoLiquido || 0), 0);
});

// ---------------------------------------------------------------------------
// Metodos
// ---------------------------------------------------------------------------

// Rateia frete, seguro e outras despesas da NOTA sobre os itens, proporcional
// ao valor do produto. O custo que entra no estoque e o custo REAL, nunca o
// valor do produto: na nota 620819 da Rinnai o IPI sozinho move 6,5%.
//
// O `frete` do item continua sendo o que o emitente mandou na linha; a parte
// rateada mora em `rateio`. Assim nada do XML e sobrescrito.
//
// O resto de arredondamento vai para o item de maior valor, para a soma dos
// custos fechar com o total da nota.
NotaEntradaSchema.methods.calcularCustoReal = function () {
  const itens = this.itens || [];
  if (!itens.length) return;

  const base = itens.reduce((s, i) => s + (i.valorTotal || 0), 0);
  const rateavel = (this.valorFrete || 0)
                 + (this.valorSeguro || 0)
                 + (this.valorOutras || 0);

  let distribuido = 0;
  let maior = 0;

  itens.forEach((i, idx) => {
    const parte = base ? Math.round(rateavel * ((i.valorTotal || 0) / base)) : 0;
    i.rateio = parte;
    distribuido += parte;
    if ((i.valorTotal || 0) > (itens[maior].valorTotal || 0)) maior = idx;
  });

  // sobra ou falta de centavo vai para o item de maior valor
  const resto = rateavel - distribuido;
  if (resto) itens[maior].rateio += resto;

  for (const i of itens) {
    const total = (i.valorTotal || 0)
                + (i.ipi || 0)
                + (i.icmsSt || 0)
                + (i.rateio || 0)
                - (i.desconto || 0);

    i.custoUnitarioReal = i.quantidade
      ? Math.round(total / i.quantidade)
      : 0;
  }
};

// Compara a nota com o pedido e diz o que aconteceu.
// Nao grava nada: quem decide e a API.
NotaEntradaSchema.methods.compararComPedido = function (pedido) {
  if (!pedido) return { tipo: 'SEM_PEDIDO', linhas: [], temSaldo: false };

  const porCodigo = new Map();
  for (const ip of pedido.itens || []) {
    porCodigo.set(ip.codigoOrigem, ip);
  }

  const linhas = [];
  let temSaldo = false;

  // o que veio na nota
  for (const inf of this.itens || []) {
    const ip = inf.codigoProd ? porCodigo.get(inf.codigoProd) : null;
    if (ip) porCodigo.delete(inf.codigoProd);

    linhas.push({
      codigo: inf.codigoProd,
      descricao: inf.descricaoXml,
      pedido: ip ? ip.quantidade : 0,
      chegou: inf.quantidade,
      falta: ip ? Math.max(0, ip.quantidade - inf.quantidade) : 0,
      aMais: ip ? Math.max(0, inf.quantidade - ip.quantidade) : inf.quantidade,
      custoPedido: ip ? ip.custoUnitario : 0,
      custoNota: inf.custoUnitarioReal,
      noPedido: !!ip,
    });

    if (ip && inf.quantidade < ip.quantidade) temSaldo = true;
  }

  // o que estava no pedido e nao veio
  for (const ip of porCodigo.values()) {
    linhas.push({
      codigo: ip.codigoOrigem,
      descricao: ip.descricao,
      pedido: ip.quantidade,
      chegou: 0,
      falta: ip.quantidade,
      aMais: 0,
      custoPedido: ip.custoUnitario,
      custoNota: 0,
      noPedido: true,
    });
    temSaldo = true;
  }

  return {
    tipo: temSaldo ? 'PARCIAL' : 'TOTAL',
    linhas,
    temSaldo,
  };
};

NotaEntradaSchema.pre('save', function (next) {
  if (this.isModified('itens')
   || this.isModified('valorFrete')
   || this.isModified('valorSeguro')
   || this.isModified('valorOutras')) {
    this.calcularCustoReal();
  }
  next();
});

const NotaEntrada = mongoose.model('compraNotaEntrada', NotaEntradaSchema);

module.exports = NotaEntrada;
module.exports.SITUACOES = SITUACOES;
