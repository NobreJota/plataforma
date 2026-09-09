// models/Departamento.js
const mongoose = require('mongoose');

const DepartamentoSchema = new mongoose.Schema({
  nomeDepartamento: { type: String, required: true },
  imagemUrl: { type: String, trim: true, default: '' },   // ✅ NOVO
  ativado: { type: Number, enum: [0,1], default: 0 },
  url:{type :String},
});


module.exports = mongoose.models.departamento || mongoose.model('departamentos', DepartamentoSchema);
