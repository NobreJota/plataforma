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
     linhaBruta: { type: String },          // linha original (texto bruto, só pra conferência/diagnóstico)
      status: {                             // controle do fluxo
      type: String,
      enum: ['pendente', 'ajustado', 'migrado'],
      default: 'pendente',
    },
      revisado: {
         type: Boolean,
        default: false,
       index: true,
  },
   transferido: {
    type: Boolean,
    default: false,   // começa como NÃO transferido
    index: true       // facilita filtrar "pendentes" depois
  },
  },
  {
    collection: 'import_itens',
    timestamps: true,
  }
);

module.exports = mongoose.model('ImportItem', ImportItemSchema);
