const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  nome: String,
  codigo: String,
  fornecedor: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  similares: [{ type: Schema.Types.ObjectId, ref: 'Product' }]  // Array de refs para produtos similares
});

module.exports = mongoose.model('Product', ProductSchema);