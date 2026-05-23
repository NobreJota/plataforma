const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Normaliza: mantém só dígitos
function apenasNumeros(s = '') {
  return String(s || '').replace(/\D/g, '');
}

// Normaliza texto para busca (sem acento, minúsculo)
function normTexto(s = '') {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Sub-schema para contatos especializados (mantido do site)
const ContatoSchema = new Schema({
  nome:    { type: String, default: '' },
  email:   { type: String, default: '' },
  celular: { type: String, default: '' }
}, { _id: false });

// Sub-schema para endereço (mantido do site + complemento)
const EnderecoSchema = new Schema({
  cep:         { type: String, default: '', set: v => apenasNumeros(v) },
  logradouro:  { type: String, default: '' },
  numero:      { type: String, default: '' },
  complemento: { type: String, default: '' },   // 🆕 adicionado
  bairro:      { type: String, default: '' },
  cidade:      { type: String, default: '' },
  estado:      { type: String, default: '', uppercase: true, maxlength: 2 }
}, { _id: false });

const FornecedorSchema = new Schema({
  // 🆕 Tipo PF/PJ (default PJ — compatível com registros antigos)
  tipo: { type: String, enum: ['PF', 'PJ'], default: 'PJ' },

  razao: { type: String, default: '' },
  // 🆕 razão normalizada para busca sem acento
  razaoNorm: { type: String, default: '', index: true, select: false },

  // CNPJ/CPF — só dígitos, único
  cnpj: { type: String, required: true, index: true, unique: true, set: v => apenasNumeros(v) },

  // Vínculo multi-loja (mantido do site)
  lojistas: [{
    loja: { type: mongoose.Schema.Types.ObjectId, ref: 'lojistas', required: true },
    marcaLoja: { type: String, default: '' }
  }],

  inscricao:  { type: String, default: '' },           // Inscrição Estadual (nome do site)
  inscricaoMunicipal: { type: String, default: '' },   // 🆕 Inscrição Municipal
  ncontabil:  { type: String, default: '' },           // número contábil (vínculo plano de contas)
  marca:      { type: String, default: '' },

  // 🆕 Contato principal (preenchido pela BrasilAPI / nossas telas)
  email:    { type: String, default: '' },
  telefone: { type: String, default: '' },

  address: { type: EnderecoSchema, default: () => ({}) },

  // Contatos especializados (mantidos do site)
  contato: {
    representante: { type: ContatoSchema, default: () => ({}) },
    comercial:     { type: ContatoSchema, default: () => ({}) },
    tecnica:       { type: ContatoSchema, default: () => ({}) }
  },

  // 🆕 controle
  ativo: { type: Boolean, default: true, index: true },

  createAt: { type: Date, default: Date.now },
  updateAt: { type: Date }
});

// Preenche razaoNorm + updateAt ao salvar
FornecedorSchema.pre('save', function (next) {
  if (this.razao) this.razaoNorm = normTexto(this.razao);
  this.updateAt = new Date();
  next();
});

// Em findOneAndUpdate, mantém razaoNorm e updateAt
FornecedorSchema.pre('findOneAndUpdate', function (next) {
  const upd = this.getUpdate() || {};
  const set = upd.$set || upd;
  if (set.razao !== undefined) set.razaoNorm = normTexto(set.razao);
  set.updateAt = new Date();
  if (upd.$set) upd.$set = set; else this.setUpdate(set);
  next();
});

// Índices úteis
FornecedorSchema.index({ razao: 1 });
FornecedorSchema.index({ ativo: 1 });

module.exports = mongoose.models.Fornecedor || mongoose.model('fornec', FornecedorSchema);
