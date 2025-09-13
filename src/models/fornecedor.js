const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Sub-schema para contatos
const ContatoSchema = new Schema({
  nome: { type: String },
  email: { type: String },
  celular: { type: String }
}, { _id: false });

// Sub-schema para lojistas relacionados
const LojistaSchema = new Schema({
  lojaid: { type: String },
  lojaname: { type: String },
  lojasegmento: { type: String },
  number_contabil: { type: String },
  ativo: { type: Number }
}, { _id: false });

// Sub-schema para endereço
const EnderecoSchema = new Schema({
  cep: { type: String },
  logradouro: { type: String },
  numero: { type: String },
  bairro: { type: String },
  cidade: { type: String },
  estado: { type: String }
}, { _id: false });

// Schema principal do fornecedor
const FornecedorSchema = new Schema({
  razao: { type: String },
  cnpj: { type: String, required: true, unique: true },
  inscricao: { type: String },
  ncontabil: { type: String },
  marca: { type: String },
  email: { type: String },

  qlojistas: [{
    type: Schema.Types.ObjectId,
    ref: "lojista"
  }],
  address: EnderecoSchema,

  contato: {
    representante: ContatoSchema,
    comercial: ContatoSchema,
    tecnica: ContatoSchema
  },

  createAt: {
    type: Date,
    default: Date.now
  },
  updateAt: {
    type: Date
  }
});

//module.exports = mongoose.model("fornec", FornecedorSchema);
module.exports = mongoose.models.Fornecedor || mongoose.model('fornec', FornecedorSchema);
