const mongoose = require('mongoose');

const DeptoSetorSchema = new mongoose.Schema({
  nomeDeptoSetor: { type: String, required: true },
  idDepto: { type: mongoose.Schema.Types.ObjectId, ref: 'departamentos', required: true }
});

module.exports = mongoose.model('deptosetores', DeptoSetorSchema);