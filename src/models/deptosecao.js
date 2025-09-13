const mongoose = require('mongoose');

const SecaoSchema = new mongoose.Schema({
  secao: {
       type: [{ nameSecao: { type: String, required: false } }],
       default: null
  },
  idDepto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'departamentos',
    required: true
  },
  idDeptoSetor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'deptosetores',
    required: true
  }
});

module.exports = mongoose.models.secoes || mongoose.model('deptosecoes', SecaoSchema);