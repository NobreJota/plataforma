// models/subGrupo.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SubGrupoSchema = new Schema(
  {
    grupoId: {
      type: Schema.Types.ObjectId,
      ref: "Grupo",
      required: true,
      index: true,
    },
    // Mantido em texto para facilitar queries sem populate
    codigoGrupo: { type: String, required: true, trim: true }, // "1"
    codigo:       { type: String, required: true, trim: true, unique: true }, // "1.01"
    nome:         { type: String, required: true, trim: true }, // "Disponível"
    descricao:    { type: String, default: "" },
    ativo:        { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    autoIndex: false,
  }
);

SubGrupoSchema.index({ codigo: 1 }, { unique: true });
SubGrupoSchema.index({ grupoId: 1 });
SubGrupoSchema.index({ codigoGrupo: 1 });

module.exports = mongoose.model("SubGrupo", SubGrupoSchema);
