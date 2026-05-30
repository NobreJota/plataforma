// models/contaSubTitulo.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ContaSubTituloSchema = new Schema(  {
    contaTituloId: {
      type: Schema.Types.ObjectId,
      ref: "ContaTitulo", required: true,
      // index: true,
    },
    codigoContaTitulo: { type: String, required: true, trim: true }, // "1.01.002"
    codigo:            { type: String, required: true, trim: true, unique: true }, // "1.01.002.001"
    nome:              { type: String, required: true, trim: true }, // "Banestes/Armação"
    descricao:         { type: String, default: "" },

    saldoInicial: { type: Number, default: 0 },
    // natureza contábil: devedora (ativo/despesa) | credora (passivo/receita)
    natureza: {
      type: String,
      enum: ["devedora", "credora"],
      required: true,
    },

    ativo: { type: Boolean, default: true },
  },
  {
    timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
  }
);

module.exports =
  mongoose.models.ContaSubTitulo ||
  mongoose.model("ContaSubTitulo", ContaSubTituloSchema, "contasubtitulos");
