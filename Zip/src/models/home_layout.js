// src/models/home_layout.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const HomeSlotSchema = new Schema({
  tipo: { type: String, enum: ['hero', 'destaque', 'lateral'], required: true },
  ordem: { type: Number, required: true },

  titulo: { type: String, default: '' },
  subtitulo: { type: String, default: '' },

  imgUrl: { type: String, default: '' },   // não force required agora
  linkUrl: { type: String, default: '' },

  ativo: { type: Boolean, default: true },

  // janela de tempo (campanha)
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
}); // <-- SEM { _id:false }

const HomeLayoutSchema = new Schema({
  nome: { type: String, default: 'default' },

  // liga a uma campanha (é isso que você quer)
  campanhaId: { type: Schema.Types.ObjectId, ref: 'Campanha', default: null },

  // dono da campanha (lojista ou empresa “de fora”)
  lojistaId: { type: Schema.Types.ObjectId, ref: 'lojistas', default: null },
  empresaNome: { type: String, default: '' },

  slots: [HomeSlotSchema],

  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('HomeLayout', HomeLayoutSchema);
