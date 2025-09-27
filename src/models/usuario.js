// models/usuario.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const UsuarioSchema = new Schema({
  nome:  { type: String, required: true },
  email: { type: String, required: true, trim: true, lowercase: true /*, unique: true */ },
  senha: { type: String, required: true, select: false },
  admin: { type: String, default: '' },
  createAt: { type: Date, default: Date.now },
  updateAt: { type: Date }
});

// Registra como 'usuarios' (bate com códigos antigos que chamavam por esse nome)
module.exports = mongoose.models['usuarios'] || mongoose.model('usuarios', UsuarioSchema);
