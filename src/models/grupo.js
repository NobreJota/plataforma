// =============================================================================
// Destino: C:\plataformaRota\src\models\grupo.js
// Alterado em: 25/09/2026 — tirado o `unique: true` do campo, que duplicava
//                           o indice declarado por schema.index().
//
// Grupo do plano de contas: 1 Ativo, 2 Passivo, 3 Despesas, 4 Receitas.
//
// ATENCAO: este model NAO tem lojistaId de proposito. Os quatro grupos sao
// comuns a todas as empresas — quem e por empresa e o subgrupo (grupoSub.js).
// Por isso o `unique` global em `codigo` esta certo aqui, ao contrario do
// resto do contab.
// =============================================================================

const mongoose = require("mongoose");
const { Schema } = mongoose;

const GrupoSchema = new Schema(
  {
    // "1" = Ativo | "2" = Passivo | "3" = Despesas | "4" = Receitas
    // O indice unico esta declarado la embaixo, em schema.index().
    // Nao repetir `unique: true` aqui: o Mongoose avisa duplicidade e um dos
    // dois acaba ignorado.
    codigo: { type: String, required: true, trim: true },
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
