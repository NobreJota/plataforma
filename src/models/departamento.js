// models/Departamento.js
const mongoose = require('mongoose');

const DepartamentoSchema = new mongoose.Schema({
  nomeDepartamento: { type: String, required: true },
  ativado: { type: Number, enum: [0,1], default: 0 },
});


module.exports = mongoose.models.departamento || mongoose.model('departamentos', DepartamentoSchema);
