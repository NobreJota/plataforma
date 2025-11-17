/**
 * Um "lote" corresponde a um upload (arquivo) de um lojista para um fornecedor,
 * com a data da operação. Os itens (linhas do arquivo) ficam em outra coleção.
 */
// src/models/import_lote.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ImportLoteSchema = new Schema({
  lojista:      { type: Schema.Types.ObjectId, ref: 'lojista', required: true },
  fornecedor:   { type: Schema.Types.ObjectId, ref: 'fornec',  required: true },
  dataOperacao: { type: Date, required: true },

  // metadados do arquivo
  filename:     { type: String },
  originalName: { type: String },
  mimetype:     { type: String },
  size:         { type: Number },

  // mapeamento opcional de cabeçalho
  headerMap:    { type: Schema.Types.Mixed, default: {} },

  status:       { type: String, enum: ['preparando','pronto','processado','erro'], default: 'preparando' },
  msg:          { type: String },

  // TTL opcional (3 dias)
  // expiresAt: { type: Date, default: () => new Date(Date.now() + 3*24*60*60*1000) }
}, { timestamps: true });

// Indexes úteis
ImportLoteSchema.index({ fornecedor: 1, lojista: 1, createdAt: -1 });
// ImportLoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models['import_lote']
  || mongoose.model('import_lote', ImportLoteSchema);

