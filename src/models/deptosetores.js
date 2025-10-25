const mongoose = require('mongoose');

// models/deptosetores.js  ✅ ADICIONE esse campo (opcional)
const DeptoSetorSchema = new mongoose.Schema({
  nomeDeptoSetor: { type: String, required: true },
  idDepto: { type: mongoose.Schema.Types.ObjectId, ref: 'departamentos', required: true },
  imagemUrl: { type: String, default: null }             // ← novo (opcional)
});


module.exports = mongoose.models.deptosetores
  || mongoose.model('deptosetores', DeptoSetorSchema);