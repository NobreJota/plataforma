// models/importItem.js
const mongoose  = require('mongoose');
const ArquivoDoc = require('./arquivoDoc'); // mesmo model que você já usa

const { Schema } = mongoose;

// pega a definição dos campos de ArquivoDoc
const baseCampos = ArquivoDoc.schema.obj;

const ImportItemSchema = new Schema(
  {
    // TODOS os campos que existem em arquivoDoc
    ...baseCampos,

    // metadados da importação
    loja_id: {
      type: Schema.Types.ObjectId,
      ref: 'lojistas',
      required: true,
    },
    revisado: {
    type: Boolean,
    default: false,
    index: true,
  },
    fornecedorId: {
      type: Schema.Types.ObjectId,
      ref: 'fornecedores',
      required: true,
    },
    // loteId: {
    //   type: Schema.Types.ObjectId,
    //   ref: 'ImportLote',
    //   required: true,
    // },

    // linha original (texto bruto, só pra conferência/diagnóstico)
    linhaBruta: { type: String },

    // controle do fluxo
    status: {
      type: String,
      enum: ['pendente', 'ajustado', 'migrado'],
      default: 'pendente',
    },
  },
  {
    collection: 'import_itens',
    timestamps: true,
  }
);

module.exports = mongoose.model('ImportItem', ImportItemSchema);
