// models/ImportModelo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CampoMapaSchema = new Schema({
  colunaArquivo: { type: String, required: true },  // ex: "Pre�o" ou "Preço"
  campoInterno: { type: String, required: true }    // ex: "precovista"
}, { _id: false });

const ImportModeloSchema = new Schema({
  // Nome da empresa / sistema do fornecedor
  software: { type: String, required: true, trim: true },   // ex: "TOTVS-XYZ", "LINX-ABC"

  // opcional: vincular a um lojista específico (ou deixar null = modelo global)
 // lojista: { type: Schema.Types.ObjectId, ref: 'Lojista', default: null },
  lojistas: [{ type: Schema.Types.ObjectId, ref: 'lojistas'}],


  // opcional: vincular a um fornecedor específico (se quiser)
  //fornecedor: { type: Schema.Types.ObjectId, ref: 'Fornecedor', default: null },

  // aqui vem a “tabela” campo_extrangeiro x nosso_campo
  campos: { type: [CampoMapaSchema], default: [] },

  createdAt: { type: Date, default: Date.now }
});

ImportModeloSchema.index({ software: 1, lojista: 1, fornecedor: 1 }, { unique: true });

module.exports = mongoose.model('ImportModelo', ImportModeloSchema);
