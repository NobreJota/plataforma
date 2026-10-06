// =============================================================================
// Destino: C:\plataformaRota\src\models\vendas\venda.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - decisoes do usuario:
//   - cartao entra INTEIRO no fluxo; a taxa da operadora e tratada no fluxo
//     (a venda nao guarda taxa). Parcelas de 30 em 30 dias, ate 10x
//   - contabilizacao: conta do CLIENTE contra Receita/Vendas/Vista ou Prazo
//   - NF-e: numero = ultima nota + 1 (documento oficial), serie 002
//   - item guarda o codigo da nota (contabilidade) ate os codigos se unirem
//   - item guarda as duas descricoes: comercial (nossa) e tecnica (fornecedor)
//   - DOIS DOCUMENTOS:
//       CUPOM (balcao): a vista, SEM cliente identificado. No razao entra UM
//         lancamento por dia, historico "Vendas balcao" (4.01.001.001): a 1a venda
//         do dia cria, as seguintes SOMAM nele. Clicar no lancamento abre a lista
//         das vendas que o compoem (contabil.boletaId liga cada venda ao do dia).
//       NFE: sempre com cliente, mesmo a vista. Conta do cliente (1.03/1.04)
//         contra 4.01.001.001 (a vista) ou 4.02.001.001 (a prazo).
//   - numeracao da NF-e: por enquanto segue da 8675 (teste). No dia D os testes
//     sao apagados e a numeracao real continua da ultima nota do Access.
//
// VENDA — um documento por venda, com tudo dentro: cliente, itens, pagamento,
// a nota fiscal e a OS de instalacao. No Access isso estava espalhado em
// Vendas_SaídaCupom + SaídaCupomItens + NFS_RegTítulos + OrdemServiço.
//
// Ciclo:
//   A  aberta ......... itens sendo lancados (balcao/caixa)
//   F  fechada ........ pagamento definido: estoque baixado, fluxo lancado
//   C  cancelada ...... nada e apagado; o estoque volta e as linhas do fluxo
//                       sao canceladas
//
// Dinheiro em CENTAVOS (como o pedido de compra).
//
// O FLUXO (mesmo caminho da compra, que usa pos 7 e pos 2):
//   - a vista (dinheiro, PIX, debito): boleta RECEBIMENTO direto no caixa/banco
//   - cartao de credito: uma linha pos 5 (a receber) por parcela, na conta da
//     operadora (1.01.005.xxx), valor INTEIRO, de 30 em 30 dias (ate 10x);
//     a taxa da operadora e tratada no fluxo, no recebimento
//   - titulo em banco (so PJ): uma linha pos 5 por parcela, na conta do
//     cliente (1.04.xxx) — e a "duplicata" da fatura da NF-e
//   - a baixa de cada parcela e a boleta RECEBIMENTO que ja existe
//
// NOTA FISCAL: a venda guarda tudo que o DANFE pede (NCM, CSOSN, CFOP por
// item; documento e endereco do cliente; duplicatas). Numero, serie, chave e
// protocolo entram quando a nota e emitida.
// =============================================================================

'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SITUACOES = ['A', 'F', 'C'];
const DOCUMENTOS = ['CUPOM', 'NFE'];

// contas de receita (plano da Armacao)
const CONTAS = {
  RECEITA_VISTA: '4.01.001.001',   // Vendas Balcao (a vista; tambem o lancamento diario do cupom)
  RECEITA_PRAZO: '4.02.001.001',   // Venda a Prazo
};
const HISTORICO_BALCAO = 'Vendas balcão';
const FORMAS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'TITULO'];

// ---------------------------------------------------------------------------
// Item: congelado na hora da venda (o cadastro pode mudar depois)
// ---------------------------------------------------------------------------
const ItemSchema = new Schema({
  codigo:     { type: Number, required: true },        // arquivo_docs.codigo (o nosso)
  codigoNota: { type: String, trim: true, default: '' },  // o da contabilidade, usado na NF-e
                                                          // (sai quando os codigos se unirem)
  descricao:        { type: String, trim: true, required: true },  // comercial (a nossa)
  descricaoTecnica: { type: String, trim: true, default: '' },     // a do fornecedor
  referencia: { type: String, trim: true, default: '' },
  unidade:    { type: String, trim: true, default: 'PC' },

  // fiscal (vai para a NF-e)
  ncm:   { type: String, trim: true, default: '' },
  csosn: { type: String, trim: true, default: '' },
  cfop:  { type: String, trim: true, default: '' },

  quantidade:     { type: Number, required: true, min: 1 },   // inteiro: nao ha fracionado
  precoUnitario:  { type: Number, required: true, min: 0 },   // centavos
  desconto:       { type: Number, default: 0, min: 0 },       // centavos, do item
  total:          { type: Number, default: 0, min: 0 },       // centavos = qtd x preco - desconto
  custoUnitario:  { type: Number, default: 0, min: 0 },       // centavos, para margem e CMV

  precisaInstalacao: { type: Boolean, default: false },       // abre OS ao fechar
}, { _id: true });

// ---------------------------------------------------------------------------
// Parcela de um pagamento a prazo: vira uma linha pos 5 no fluxo
// ---------------------------------------------------------------------------
const ParcelaSchema = new Schema({
  numero:     { type: Number, required: true },       // 1, 2, 3...  (a "duplicata 001")
  vencimento: { type: Date, required: true },
  valor:      { type: Number, required: true },       // centavos
  fluxoId:    { type: Schema.Types.ObjectId, ref: 'FluxoProjetado', default: null },
  recebidaEm: { type: Date, default: null },
}, { _id: false });

// ---------------------------------------------------------------------------
// Pagamento: uma venda pode ter mais de uma forma (parte em dinheiro, parte
// no cartao). A soma dos valores = total liquido da venda.
// ---------------------------------------------------------------------------
const PagamentoSchema = new Schema({
  forma: { type: String, enum: FORMAS, required: true },
  valor: { type: Number, required: true, min: 0 },     // centavos

  // cartao: a operadora e a conta dela no plano (1.01.005.003 MasterCard...).
  // A taxa NAO fica aqui: o valor vai inteiro e a taxa e tratada no fluxo.
  operadora:      { type: String, trim: true, default: '' },
  contaOperadora: { type: String, trim: true, default: '' },

  // a vista: em que conta de caixa/banco entrou (boleta RECEBIMENTO)
  contaDestino: { type: String, trim: true, default: '' },
  boletaId:     { type: Schema.Types.ObjectId, ref: 'Boleta', default: null },

  // CREDITO e TITULO: de 30 em 30 dias, ate 10
  parcelas: {
    type: [ParcelaSchema], default: [],
    validate: { validator: v => v.length <= 10, message: 'no maximo 10 parcelas' },
  },
}, { _id: true });

// ---------------------------------------------------------------------------
// Venda
// ---------------------------------------------------------------------------
const VendaSchema = new Schema({
  lojistaId: { type: Schema.Types.ObjectId, ref: 'lojista', required: true, index: true },

  numero:   { type: Number, required: true },          // sequencial por empresa
  situacao: { type: String, enum: SITUACOES, default: 'A', required: true },
  data:     { type: Date, default: Date.now },
  operador: { type: String, trim: true, default: '' },
  local:    { type: String, enum: ['BALCAO', 'CAIXA'], default: 'BALCAO' },

  // preco usado nos itens: tabela a vista ou a prazo do produto
  condicao: { type: String, enum: ['VISTA', 'PRAZO'], default: 'VISTA' },

  // CUPOM: balcao, sem cliente, soma no lancamento diario "Vendas balcao"
  // NFE:   com cliente, lancada na conta dele
  documento: { type: String, enum: DOCUMENTOS, default: 'CUPOM' },

  // cliente: opcional a vista; obrigatorio a prazo e para NF-e com destinatario
  cliente: {
    id:        { type: Schema.Types.ObjectId, ref: 'Cliente', default: null },
    codigo:    { type: String, trim: true, default: '' },   // F17281 / J1705
    tipo:      { type: String, enum: ['PF', 'PJ', ''], default: '' },
    nome:      { type: String, trim: true, default: '' },
    documento: { type: String, trim: true, default: '' },   // CPF/CNPJ (so digitos)
    ie:        { type: String, trim: true, default: '' },
    ncontabil: { type: String, trim: true, default: '' },   // 1.03.xxx / 1.04.xxx
    endereco: {
      logradouro: String, numero: String, complemento: String,
      bairro: String, cidade: String, uf: String, cep: String,
    },
  },
  ocCliente: { type: String, trim: true, default: '' },     // ordem de compra do PJ ("OC:")

  itens: { type: [ItemSchema], default: [] },

  totalBruto:    { type: Number, default: 0 },   // centavos: soma de qtd x preco
  totalDesconto: { type: Number, default: 0 },   // centavos: descontos dos itens + o geral
  descontoGeral: { type: Number, default: 0 },   // centavos: desconto no total
  totalLiquido:  { type: Number, default: 0 },   // centavos

  pagamentos: { type: [PagamentoSchema], default: [] },

  // contabilizacao da venda
  //   NFE:   conta do cliente contra a receita (vista ou prazo); boleta propria
  //   CUPOM: entra no lancamento diario "Vendas balcao"; boletaId = o do dia
  contabil: {
    contaCliente: { type: String, trim: true, default: '' },   // 1.03.xxx / 1.04.xxx (so NFE)
    contaReceita: { type: String, trim: true, default: '' },   // 4.01.001.001 / 4.02.001.001
    boletaId:     { type: Schema.Types.ObjectId, ref: 'Boleta', default: null },
    diaBalcao:    { type: Date, default: null },               // CUPOM: o dia do lancamento somado
  },

  // nota fiscal (preenchida quando emitida)
  // numero = ultima nota + 1 (documento oficial: sem buraco, sem repetir)
  nfe: {
    numero:     { type: Number, default: null },
    serie:      { type: String, trim: true, default: '002' },
    chave:      { type: String, trim: true, default: '' },
    protocolo:  { type: String, trim: true, default: '' },
    emitidaEm:  { type: Date, default: null },
    natureza:   { type: String, trim: true, default: 'Venda a vista' },
  },

  // OS de instalacao aberta por esta venda
  os: {
    numero: { type: Number, default: null },
    id:     { type: Schema.Types.ObjectId, default: null },
  },

  observacao: { type: String, trim: true, default: '' },

  // importada do Access (historico): o cupom de origem
  origem:          { type: String, enum: ['PLATAFORMA', 'ACCESS'], default: 'PLATAFORMA' },
  nrCupomAccess:   { type: Number, default: null },

  fechadaEm:          { type: Date, default: null },
  canceladaEm:        { type: Date, default: null },
  motivoCancelamento: { type: String, trim: true, default: '' },
}, {
  collection: '_vendas',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
});

// Indices compostos com lojistaId — nunca unique global.
VendaSchema.index({ lojistaId: 1, numero: 1 }, { unique: true });
VendaSchema.index({ lojistaId: 1, data: -1 });
VendaSchema.index({ lojistaId: 1, 'cliente.id': 1, data: -1 });
VendaSchema.index({ lojistaId: 1, situacao: 1 });
VendaSchema.index({ lojistaId: 1, 'itens.codigo': 1, data: -1 });   // consumo por produto
VendaSchema.index({ lojistaId: 1, nrCupomAccess: 1 });
VendaSchema.index({ lojistaId: 1, 'contabil.boletaId': 1 });   // as vendas de um lancamento do balcao
VendaSchema.index({ lojistaId: 1, 'nfe.serie': 1, 'nfe.numero': 1 }, {
  unique: true, partialFilterExpression: { 'nfe.numero': { $type: 'number' } },
});

// ---------------------------------------------------------------------------
// Totais: recalculados a partir dos itens (nunca digitados)
// ---------------------------------------------------------------------------
VendaSchema.methods.recalcular = function () {
  let bruto = 0, descItens = 0;
  for (const i of this.itens || []) {
    const b = (i.quantidade || 0) * (i.precoUnitario || 0);
    i.total = Math.max(0, b - (i.desconto || 0));
    bruto += b;
    descItens += i.desconto || 0;
  }
  this.totalBruto = bruto;
  this.totalDesconto = descItens + (this.descontoGeral || 0);
  this.totalLiquido = Math.max(0, bruto - this.totalDesconto);
  return this.totalLiquido;
};

// Pagamento fecha com o total? (diferenca em centavos; 0 = fecha)
VendaSchema.methods.diferencaPagamento = function () {
  const pago = (this.pagamentos || []).reduce((s, p) => s + (p.valor || 0), 0);
  return (this.totalLiquido || 0) - pago;
};

VendaSchema.pre('save', function (next) {
  if (this.isModified('itens') || this.isModified('descontoGeral')) this.recalcular();
  next();
});

const Venda = mongoose.models.Venda || mongoose.model('Venda', VendaSchema);

module.exports = Venda;
module.exports.SITUACOES = SITUACOES;
module.exports.FORMAS = FORMAS;
module.exports.DOCUMENTOS = DOCUMENTOS;
module.exports.CONTAS = CONTAS;
module.exports.HISTORICO_BALCAO = HISTORICO_BALCAO;
