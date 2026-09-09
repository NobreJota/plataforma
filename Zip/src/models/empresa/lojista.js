const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const bcrypt = require('bcryptjs');
const { isValid } = require('@fnando/cnpj');
const Schema = mongoose.Schema;


const LojistaSchema = new Schema({
  razao: { type: String, required: true },
  assinante: { type: String, required: true },
  situacao: { type: String, required: true },
  template: { type: String, required: true },
  atividade: { type: String, required: true },
  nomeresponsavel: { type: String, required: true },
  cpfresponsavel: { type: String, required: true },
  cnpj: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return isValid(v);
      },
      message: props => `${props.value} não é um CNPJ válido!`
    }
  },
  inscricao: { type: String, required: true },
  site: { type: String },
  marca: { type: String, required: true },
  celular: { type: String, required: true },
  telefone: { type: String, required: true },
  email: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  senha: { type: String, required: true, select: false },
  cep: { type: String },
  logradouro: { type: String },
  numero: { type: String },
  complemento: { type: String },
  cidade: { type: String },
  bairro: { type: String },
  estado: { type: String },
  corHeader: { type: String },
  logoUrl: { type: String, default: "" },
  tituloPage: { type: String },
  departamentos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'departamentos' }],
  fornecedores: [
    {
      fornecId: { type: String },
      fornecName: { type: String }
    }
  ],
  ativo: { type: String },
  slug: { type: String, trim: true, index: true },
  }, { timestamps: true });

LojistaSchema.plugin(mongoosePaginate);

LojistaSchema.pre('save', async function(next) {
  if (!this.isModified('senha')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
  } catch (err) {
    next(err);
  }
});

LojistaSchema.set('toJSON', {
  transform(doc, ret) { delete ret.senha; return ret; }
});
LojistaSchema.set('toObject', {
  transform(doc, ret) { delete ret.senha; return ret; }
});


LojistaSchema.methods.compararSenha = function(senhaDigitada) {
  return bcrypt.compare(senhaDigitada, this.senha);
};

  module.exports = mongoose.models.lojista || mongoose.model('lojista', LojistaSchema);

