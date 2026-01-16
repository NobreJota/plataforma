// models/ImportModelo.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const ListaPedidoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },

  itens: [{
    produto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Produto',
      required: true
    },
    loja: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lojista',
      required: true
    },
    codigo: String,
    preco: Number,     // SEMPRE EM REAIS (ex: 41.90)
    ativo: { type: Boolean, default: true }
  }],

  criadoEm: { type: Date, default: Date.now }
});
module.exports = mongoose.model('lista_pedido', ListaPedidoSchema);