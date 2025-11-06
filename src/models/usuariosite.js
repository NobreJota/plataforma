const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSiteSchema = new mongoose.Schema({
  nome: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  senhaHash: { type: String, required: true },
  profileCompleted: { type: Boolean, default: false },
  visitas: { type: Number, default: 0 },
  lastLogin: { type: Date },
  cidadePadrao: { type: String, trim: true, default: '' },
  bairroPadrao: { type: String, trim: true, default: '' }
}, { timestamps: true });

// ✅ método de verificação
UsuarioSiteSchema.methods.checkPassword = function (senha) {
  return bcrypt.compare(senha, this.senhaHash);
};

module.exports =
  mongoose.models.UsuarioSite
  || mongoose.model('UsuarioSite', UsuarioSiteSchema, 'usuariosites');

