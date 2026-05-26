// src/models/financeiro/historicoConta.js
// HISTÓRICOS SUGERIDOS por conta (autocomplete que aprende com o uso).
// Cada vez que um histórico é usado num pagamento, ele entra/atualiza aqui.
// Assim o dropdown sugere os mais usados daquela conta.

const mongoose = require('mongoose');

const HistoricoContaSchema = new mongoose.Schema({
  // Chave: a conta (subtítulo). Pode ser null para históricos gerais.
  contaSubTitulo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContaSubTitulo',
    default: null,
    index: true
  },
  // Também guardamos o código para busca rápida sem populate
  codigoConta: { type: String, default: '', index: true },

  texto: { type: String, required: true, trim: true },

  // Quantas vezes foi usado (para ordenar por mais frequentes)
  usos: { type: Number, default: 1 },
  ultimoUso: { type: Date, default: Date.now }
}, {
  collection: '_historico_contas',
  timestamps: { createdAt: 'criadoEm', updatedAt: 'atualizadoEm' },
  autoIndex: false
});

// Evita duplicar o mesmo texto na mesma conta
HistoricoContaSchema.index({ codigoConta: 1, texto: 1 }, { unique: true });
HistoricoContaSchema.index({ usos: -1 });

module.exports = mongoose.models.HistoricoConta ||
  mongoose.model('HistoricoConta', HistoricoContaSchema);
