const mongoose = require('mongoose');

const SecaoSchema = new mongoose.Schema({
  nameSecao:  { type: String, required: false },
  imagemUrl:  { type: String, default: '' },   // <-- NOVO
  idDepto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'departamentos',
      required: true
  },
  idSetor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'deptosetores',
      required: true
  }
});

module.exports = mongoose.models.secoes || mongoose.model('deptosecoes', SecaoSchema);