const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParceiroSchema = new Schema({
  nome:      { type: String, required: true, trim: true },
  slug:      { type: String, required: true, unique: true, index: true }, // ex: "armacao"
  url:       { type: String, required: true, trim: true }, // site do parceiro
  logo:      { type: String, default: '', trim: true },
  descricao: { type: String, default: '', trim: true },

  // cobrança / plano (opcional, mas já deixo pronto)
  plano: {
    type: String,
    enum: ['free', 'mensal', 'trimestral', 'anual'],
    default: 'mensal'
  },
  ativo: { type: Boolean, default: true, index: true },
}, { timestamps: true });

module.exports =
  mongoose.models.parceiro ||
  mongoose.model('parceiro', ParceiroSchema);
