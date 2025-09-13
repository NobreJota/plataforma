// models/Departamento.js
const mongoose = require('mongoose');

const DepartamentoSchema = new mongoose.Schema({
  nomeDepartamento: { type: String, required: true }
});


module.exports = mongoose.models.departamento || mongoose.model('departamentos', DepartamentoSchema);
