// models/ProdutoImagem.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// util de normalização (sem acento, minúsculas, espaço simples)
function normalize(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ProdutoImagemSchema = new Schema(
  {
    codigoId:     { type: Schema.Types.ObjectId, ref: "m_construcao", index: true },
    produtoNome:  { type: String, trim: true, index: true },
    fornecedor:   { type: String, trim: true, index: true },
    departamento: { type: String, trim: true, index: true },
    imagemUrl:    { type: String, required: true },
    key:          { type: String, required: true, index: true },
    mimeType:     { type: String },
    size:         { type: Number },

    // ---- campos normalizados para busca sem acento
    produtoNome_norm:  { type: String, index: true, default: "" },
    fornecedor_norm:   { type: String, index: true, default: "" },
    departamento_norm: { type: String, index: true, default: "" },
  },
  { timestamps: { createdAt: "dataUpload", updatedAt: "dataAtualizacao" } }
);

// >>> REMOVA QUALQUER índice antigo de texto (ex.: produtoNome/descricao)
// ProdutoImagemSchema.index({ produtoNome: 'text', descricao: 'text' });  // <-- APAGAR

// mantém *_norm sempre atualizado
ProdutoImagemSchema.pre("save", function (next) {
  this.produtoNome_norm  = normalize(this.produtoNome || "");
  this.fornecedor_norm   = normalize(this.fornecedor || "");
  this.departamento_norm = normalize(this.departamento || "");
  next();
});

ProdutoImagemSchema.pre("findOneAndUpdate", function (next) {
  const u = this.getUpdate() || {};
  const set = u.$set ?? u;
  if ("produtoNome"  in set) set.produtoNome_norm  = normalize(set.produtoNome  || "");
  if ("fornecedor"   in set) set.fornecedor_norm   = normalize(set.fornecedor   || "");
  if ("departamento" in set) set.departamento_norm = normalize(set.departamento || "");
  if (u.$set) u.$set = set; else Object.assign(u, set);
  next();
});

// ---- ÚNICO índice de TEXTO (agora nos *_norm)
ProdutoImagemSchema.index(
  { produtoNome_norm: "text", fornecedor_norm: "text", departamento_norm: "text" },
  {
    name: "texto_norm",
    default_language: "portuguese",
    weights: { produtoNome_norm: 8, fornecedor_norm: 2, departamento_norm: 1 }
  }
);

// índices auxiliares que você já usava
// ProdutoImagemSchema.index({ codigoId: 1 });
// ProdutoImagemSchema.index({ key: 1 });
// ProdutoImagemSchema.index({ produtoNome: 1 });
// ProdutoImagemSchema.index({ fornecedor: 1 });
// ProdutoImagemSchema.index({ departamento: 1 });

// evita OverwriteModelError
module.exports = mongoose.models.produtoImagem
  || mongoose.model("produtoImagem", ProdutoImagemSchema);
