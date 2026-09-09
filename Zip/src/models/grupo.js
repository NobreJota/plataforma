// models/grupo.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const GrupoSchema = new Schema(
  {
    codigo: { type: String, required: true, trim: true, unique: true },
    // "1" = Ativo | "2" = Passivo | "3" = Despesas | "4" = Receitas
    nome:   { type: String, required: true, trim: true },
    tipo: {
      type: String,
      required: true,
      enum: ["ativo", "passivo", "despesas", "receitas"],
    },
    ativo: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    autoIndex: false,
  }
);

GrupoSchema.index({ codigo: 1 }, { unique: true });
GrupoSchema.index({ tipo: 1 });

module.exports = mongoose.model("Grupo", GrupoSchema);
