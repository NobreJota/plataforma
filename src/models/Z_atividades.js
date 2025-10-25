const mongoose = require('mongoose');
const { Schema } = mongoose;

const AtividadeSchema = new Schema({
  //loja_id:       { type: Schema.Types.ObjectId, ref: 'lojista' }, // opcional
  nome:          { type: String, required: true, trim: true },
  departamento:  { type: Schema.Types.ObjectId, ref: 'departamentos', required: true },
  imagemUrl:     { type: String, default: '' },
  ativo:         { type: Number, default: 1 }, // 1=ativo, 9=suspenso
  datadel:       { type: Date, default: null }
}, { timestamps: true });

AtividadeSchema.index({ nome: 'text' });

module.exports =
  mongoose.models.atividade || mongoose.model('atividade', AtividadeSchema);
