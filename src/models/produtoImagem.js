// src/models/produtoImagem.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ProdutoImagemSchema = new Schema(
  {
    codigoId:    { type: Schema.Types.ObjectId, ref: "m_construcao", index: true },
    produtoNome: { type: String, trim: true, index: true },
    fornecedor:  { type: String, trim: true, index: true },
    departamento:{ type: String, trim: true, index: true },
    imagemUrl:   { type: String, required: true },
    key:         { type: String, required: true, index: true },
    mimeType:    { type: String },
    size:        { type: Number }
  },
  { timestamps: { createdAt: "dataUpload", updatedAt: "dataAtualizacao" } }
);

// texto pra buscas simples
ProdutoImagemSchema.index({ produtoNome: "text", fornecedor: "text", departamento: "text" });

// ⚠️ importante para não dar OverwriteModelError
module.exports = mongoose.models.produtoImagem
  || mongoose.model("produtoImagem", ProdutoImagemSchema);
