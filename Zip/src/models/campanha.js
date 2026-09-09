// models/campanha.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CampanhaSchema = new Schema({
  titulo:   { type: String, required: true },          // ex: "Natal 2025"
  status:   { type: String, enum: ['rascunho','ativa','arquivada'], default: 'rascunho' },

  // “de quem é”
  lojistaId:    { type: Schema.Types.ObjectId, ref: 'Lojista', default: null, index: true },
  empresaNome:  { type: String, default: '' },         // se não for lojista
  tipoDono: { type: String, enum: ['lojista', 'empresa'], default: 'lojista' },

  // janela da campanha
  startAt: { type: Date, default: null },
  endAt:   { type: Date, default: null },

  // ajuda a repetir campanhas
  tags:    { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Campanha', CampanhaSchema);
