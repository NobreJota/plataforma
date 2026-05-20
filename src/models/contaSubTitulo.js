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
    // Campos bancários (opcionais — preencher quando for conta bancária)
    banco:   { type: String, default: "" }, // "Banestes"
    agencia: { type: String, default: "" }, // "0042"
    conta:   { type: String, default: "" }, // "123456-7"

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
    autoIndex: false,
  }
);

ContaSubTituloSchema.index({ codigo: 1 }, { unique: true });
ContaSubTituloSchema.index({ contaTituloId: 1 });
ContaSubTituloSchema.index({ codigoContaTitulo: 1 });
ContaSubTituloSchema.index({ natureza: 1 });

module.exports = mongoose.model("ContaSubTitulo", ContaSubTituloSchema);
