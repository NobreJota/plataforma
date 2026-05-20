// models/contaTitulo.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ContaTituloSchema = new Schema(
  {
    subGrupoId: {
      type: Schema.Types.ObjectId,
      ref: "SubGrupo",
      required: true,
    //  index: true,
    },
    codigoSubGrupo:   { type: String, required: true, trim: true }, // "1.01"
    codigo:           { type: String, required: true, trim: true, unique: true }, // "1.01.002"
    nome:             { type: String, required: true, trim: true }, // "Bancos"
    descricao:        { type: String, default: "" },
    // false = conta sintética (agrupa), true = permite lançamento direto
    aceitaLancamento: { type: Boolean, default: false },
    ativo:            { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    autoIndex: false,
  }
);

ContaTituloSchema.index({ codigo: 1 }, { unique: true });
ContaTituloSchema.index({ subGrupoId: 1 });
ContaTituloSchema.index({ codigoSubGrupo: 1 });

module.exports = mongoose.model("ContaTitulo", ContaTituloSchema);
