// models/HomeLayout.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const HomeSlotSchema = new Schema({
  tipo: { type: String, enum: ['hero', 'destaque', 'lateral'], required: true },
  ordem: { type: Number, default: 0 },

  titulo: { type: String, default: '' },
  subtitulo: { type: String, default: '' },

  imgUrl: { type: String, required: true },
  linkUrl: { type: String, default: '/' },

  // opcional: amarrar a um produto (quando você quiser)
  produtoId: { type: Schema.Types.ObjectId, ref: 'Produto', default: null },

  // exibição/segmento
  segmento: { type: String, default: '' },     // "Imóveis", "Construção Civil" etc.
  ativo: { type: Boolean, default: true },

  // janela de tempo (para promoções)
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
}, { _id: false });

const HomeLayoutSchema = new Schema({
  nome: { type: String, default: 'default' }, // pode ter múltiplas homes no futuro
  slots: [HomeSlotSchema],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('HomeLayout', HomeLayoutSchema);
