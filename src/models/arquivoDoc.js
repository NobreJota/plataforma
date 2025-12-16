const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;
// <<< NOVO: função de normalização da descrição
function normDesc(s = '') {
  return String(s || '')
    .normalize('NFD')                // separa acentos
    .replace(/\p{Diacritic}/gu, '')  // remove acentos
    .toLowerCase()
    .trim();
}

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
const ArquivoDocSchema = new Schema({
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
  descricaoNorm: { type: String, trim: true, index: true }, // <<< NOVO
  complete: { type: String, default: false },
  referencia: { type: String ,default: ''},
  referencia2: { type: String,default: ''},
  codEcf: { type: String,default: '' },
  localloja: [LocalizacaoRefSchema],
  fornecedor: { type: Schema.Types.ObjectId, ref: "fornec" },
  similares: [{ type: mongoose.Schema.Types.ObjectId, ref: "arquivo_doc" }],
  qte: { type: Number, min: 0 ,default:0},
  qte_negativa: { type: Number ,min:0,default:0},
  qte_reservada: { type: Number, min: 0,default:0 },
  e_max: { type: Number, min: 0 ,default:0},
  e_min: { type: Number, min: 0 ,default:0},
  precocusto: { type: mongoose.Types.Decimal128,default: null  },
  precovista: { type: mongoose.Types.Decimal128 ,default: null },
  precoprazo: { type: mongoose.Types.Decimal128 ,default: null },
  artigo: { type: String,default: '' },
  pageposicao: { type: Number ,min:0,default:0},
  pageurls: {
      type: [String],
      validate: {
        validator: arr => Array.isArray(arr) && arr.length <= 7,
        message: 'Máximo de 7 imagens.'
      },
      default: []
  },
  pageok: { type: Boolean, default: false },
  ativo: { type: Boolean, default: true, index: true },
  datadel: { type: Date, default: null },
  figure_mini: { type: String ,default: false},
  figure_media: { type: String,default: false },
  csosn: {type: String, default: ''},
  ncm: {type: String,default: ''},
  taxa: {type: mongoose.Types.Decimal128 ,default: 0},
  cfop_ecf: {type: String,default: ''},// “CFOP ECF” (nome interno sem espaço)
  cfop_nfe: {type: String,default: ''},


  

}, { timestamps: true });


// <<< NOVO: sempre que salvar UM documento, preenche descricaoNorm
ArquivoDocSchema.pre('save', function(next) {
  if (this.descricao) {
    this.descricaoNorm = normDesc(this.descricao);
  }
  next();
});

// <<< NOVO: em importações em lote (insertMany), também preenche descricaoNorm
ArquivoDocSchema.pre('insertMany',async function( next,docs) {
   try {
          if (!Array.isArray(docs)) return next();
          docs.forEach(d => {
                if (d && d.descricao ) {
                  d.descricaoNorm = normDesc(d.descricao);
                }
          });
        next();
    }catch(e){
        next(e);
     }
});

// campos usados nos filtros
ArquivoDocSchema.index({ 'localloja.departamento': 1 });
ArquivoDocSchema.index({ ativo: 1, datadel: 1 });
// índice de texto para busca por palavra
ArquivoDocSchema.index(
  { descricao: 'text', referencia: 'text' },
  { weights: { descricao: 3, referencia: 1 }, name: 'prod_text_idx' }
);

ArquivoDocSchema.plugin(mongoosePaginate);

module.exports =
  mongoose.models.d_documento ||
  mongoose.model("arquivo_doc", ArquivoDocSchema);

