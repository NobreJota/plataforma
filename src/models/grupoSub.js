// src/models/grupoSub.js
// SubGrupo é POR EMPRESA: cada lojista monta os seus 1.01, 2.01, 2.02...
// Os Grupos (1 a 4) continuam comuns, porque são fundamento contábil.
// O código só é único dentro da empresa: duas empresas podem ter 2.02
// com nomes diferentes.
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SubGrupoSchema = new Schema(
  {
    grupoId: {
      type: Schema.Types.ObjectId,
      ref: "Grupo",
      required: true,
     // index: true,
    },
    // Mantido em texto para facilitar queries sem populate
    codigoGrupo: { type: String, required: true, trim: true }, // "1"
    codigo:       { type: String, required: true, trim: true }, // "1.01"
    nome:         { type: String, required: true, trim: true }, // "Disponível"
    descricao:    { type: String, default: "" },
    ativo:        { type: Boolean, default: true },

    // 🔑 Multi-empresa (Etapa 2C)
    lojistaId: {
      type: Schema.Types.ObjectId,
      ref: 'lojista',
      required: false,
      index: true
    },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    autoIndex: false,
  }
);

// ⚠ autoIndex:false — o índice antigo (codigo único global) é trocado por este
// pelo script src/scripts/2C-2-estrutura-por-empresa.js --indices
SubGrupoSchema.index({ lojistaId: 1, codigo: 1 }, { unique: true });
SubGrupoSchema.index({ grupoId: 1 });
SubGrupoSchema.index({ codigoGrupo: 1 });

module.exports = mongoose.model("SubGrupo", SubGrupoSchema);
