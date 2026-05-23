const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Sub-schema para contatos
const ContatoSchema = new Schema({
  nome: { type: String },
  email: { type: String },
  celular: { type: String }
}, { _id: false });

// Sub-schema para lojistas relacionados
// const LojistaSchema = new Schema({
//   lojaid: { type: String },
//   lojaname: { type: String },
//   lojasegmento: { type: String },
//   number_contabil: { type: String },
//   ativo: { type: Number }
// }, { _id: false });

// Sub-schema para endereço
const EnderecoSchema = new Schema({
  cep: { type: String },
  logradouro: { type: String },
  numero: { type: String },
  bairro: { type: String },
  cidade: { type: String },
  estado: { type: String }
}, { _id: false });

const FornecedorSchema = new Schema({
  razao: { type: String },
  // ✅ CNPJ padronizado: só dígitos
  cnpj: { type: String, required: true, index: true, unique: true },
  // ✅ vínculo único (sem qlojistas)
  lojistas: [{
    loja: { type: mongoose.Schema.Types.ObjectId, ref: 'lojistas', required: true },
    marcaLoja: { type: String, default: '' }
  }],

  inscricao: { type: String },
  ncontabil: { type: String },
  marca: { type: String },
  email: { type: String },

  address: EnderecoSchema,
  contato: {
    representante: ContatoSchema,
    comercial: ContatoSchema,
    tecnica: ContatoSchema
  },

  createAt: { type: Date, default: Date.now },
  updateAt: { type: Date }
});


module.exports = mongoose.models.Fornecedor || mongoose.model('fornec', FornecedorSchema);
