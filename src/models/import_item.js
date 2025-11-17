// src/models/import_item.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImportItemSchema = new Schema({
  lote:        { type: Schema.Types.ObjectId, ref: 'import_lote', required: true },
  lojista:     { type: Schema.Types.ObjectId, ref: 'lojista',     required: true },
  fornecedor:  { type: Schema.Types.ObjectId, ref: 'fornec',      required: true },
  dataOperacao:{ type: Date, required: true },

  codigo:      { type: String },
  descricao:   { type: String },
  estoqueQte:  { type: Number },
  precoCusto:  { type: Number },
  taxaPercent: { type: Number },
  precoVista:  { type: Number },
  precoMedio:  { type: Number },
  precoPrazo:  { type: Number },
  csosn:       { type: String },
  ncm:         { type: String },
  statusLinha: { type: String, default: 'ok' },
  raw:         { type: Schema.Types.Mixed, default: {} },
  erros:       [{ type: String }]
}, { timestamps: true });



module.exports = mongoose.models['import_item']
  || mongoose.model('import_item', ImportItemSchema);
