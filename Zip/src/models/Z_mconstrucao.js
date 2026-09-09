const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

// LocalizacaoRefSchema (apenas o trecho)
const LocalizacaoRefSchema = new Schema({
  departamento: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'departamentos' }],
    default: []
  },
  setor: {
    type: [{
      // RENOMEADO
      idSetor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'deptosetores',
        required: true
      },
      // secao é ARRAY de refs; default: []
      secao: {
        type: [{
          // RENOMEADO
          idSecao: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'deptosecoes',
            required: true
          },
          _id: false
        }],
        default: []    // evita voltar "secao: null"
      },
      _id: false
    }],
    default: []        // idem para "setor"
  }
}, { _id: false });


// 🔸 Schema principal
const MconstrucaoSchema = new Schema({
  loja_id: { type: Schema.Types.ObjectId, ref: 'lojista', index: true },
  marcaloja: { type: String },
  cidade: { type: String },
  bairro: { type: String },
  codigo: { type: String, index: true },
  // NOVO: validação que proíbe dígitos
  descricao: {
      type: String,
      trim: true,
      minlength: 2,
      validate: {
        validator: v => !/\d/.test(v || ''),
        message: 'Descrição não pode conter números; use os campos "complemento" ou "referência".'
      }
  },
  complete: { type: String, default: false },
  referencia: { type: String },
  fornecedor: { type: Schema.Types.ObjectId, ref: "fornec" },
  similares: [{ type: mongoose.Schema.Types.ObjectId, ref: "m_construcao" }],
  qte: { type: Number, min: 0 },
  qte_negativa: { type: Number },
  qte_reservada: { type: Number, min: 0 },
  e_max: { type: Number, min: 0 },
  e_min: { type: Number, min: 0 },
  precocusto: { type: mongoose.Types.Decimal128 },
  precovista: { type: mongoose.Types.Decimal128 },
  precoprazo: { type: mongoose.Types.Decimal128 },
  artigo: { type: String },
  marcaItem: { type: String },
  page: { type: String },
  pageposicao: { type: Number },
  pageurls: {
      type: [String],
      validate: {
        validator: arr => Array.isArray(arr) && arr.length <= 7,
        message: 'Máximo de 7 imagens.'
      },
      default: []
  },
  pageok: { type: Boolean, default: false },
  ativo: { type: Number, enum: [1, 9], default: 1, index: true },
  datadel: { type: Date, default: null },
  figure_mini: { type: String },
  figure_media: { type: String },

  localloja: [LocalizacaoRefSchema]

}, { timestamps: true });

// campos usados nos filtros
MconstrucaoSchema.index({ loja_id: 1 });
MconstrucaoSchema.index({ 'localloja.departamento': 1 });
MconstrucaoSchema.index({ ativo: 1, datadel: 1 });


// índice de texto para busca por palavra
MconstrucaoSchema.index(
  { descricao: 'text', referencia: 'text' },
  { weights: { descricao: 3, referencia: 1 }, name: 'prod_text_idx' }
);

MconstrucaoSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.m_construcao ||
  mongoose.model("m_construcao", MconstrucaoSchema);

