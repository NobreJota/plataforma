// models/bco_imagem.js
const mongoose = require('mongoose');

const BcoImagemSchema = new mongoose.Schema({
  imagemUrl:   { type: String, required: true, trim: true, unique: true },
  key:         { type: String, default: '' }, // nome do arquivo no Space (opcional)
  mimeType:    { type: String, default: '' },
  size:        { type: Number, default: 0 },

  origem:      { type: String, enum: ['atividade','produto','outro'], default: 'atividade' },
  atividadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'atividade', default: null },
  produtoId:   { type: mongoose.Schema.Types.ObjectId, ref: 'arquivo_doc', default: null },

  departamento:{ type: mongoose.Schema.Types.ObjectId, ref: 'departamento', default: null },
}, { timestamps: true });

// BcoImagemSchema.index({ imagemUrl: 1 }, { unique: true });

module.exports = mongoose.models.bco_imagem || mongoose.model('bco_imagem', BcoImagemSchema);
