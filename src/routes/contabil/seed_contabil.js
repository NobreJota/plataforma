// scripts/seed_contabil.js
// Popula o banco com os dados iniciais do plano de contas
// Uso: node scripts/seed_contabil.js

require("dotenv").config();
const mongoose       = require("mongoose");


const Grupo          = require("../models/grupo");
const SubGrupo       = require("../models/subGrupo");
const ContaTitulo    = require("../models/contaTitulo");
const ContaSubTitulo = require("../models/contaSubTitulo");

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/plataformaRota";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Conectado ao MongoDB");

  // ---- GRUPOS ----
  const gruposData = [
    { codigo: "1", nome: "Ativo",    tipo: "ativo" },
    { codigo: "2", nome: "Passivo",  tipo: "passivo" },
    { codigo: "3", nome: "Despesas", tipo: "despesas" },
    { codigo: "4", nome: "Receitas", tipo: "receitas" },
  ];

  for (const g of gruposData) {
    await Grupo.updateOne({ codigo: g.codigo }, g, { upsert: true });
  }
  console.log("✅ Grupos inseridos");

  // Busca _ids gerados
  const [ativo, passivo, despesas, receitas] = await Promise.all([
    Grupo.findOne({ codigo: "1" }),
    Grupo.findOne({ codigo: "2" }),
    Grupo.findOne({ codigo: "3" }),
    Grupo.findOne({ codigo: "4" }),
  ]);

  // ---- SUBGRUPOS ----
  const subGruposData = [
    // ATIVO
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.01", nome: "Disponível",                   descricao: "Caixa e equivalentes" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.02", nome: "Estoque",                      descricao: "Mercadorias para revenda" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.03", nome: "Clientes Pessoa Física",       descricao: "Contas a receber PF" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.04", nome: "Clientes Pessoa Jurídica",     descricao: "Contas a receber PJ" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.05", nome: "Aplicações",                   descricao: "Aplicações financeiras" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.07", nome: "Investimentos",                descricao: "Participações societárias" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.09", nome: "Encargos Financeiros a Transcorrer", descricao: "" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.10", nome: "Automóvel",                    descricao: "Veículos da empresa" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.11", nome: "Hariaidina/Obra-1",            descricao: "" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.12", nome: "Hariaidina/Obra-2",            descricao: "" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.13", nome: "Hariaidina/Obra-3",            descricao: "" },
    { grupoId: ativo._id,    codigoGrupo: "1", codigo: "1.14", nome: "Hariaidina/Cartão Augusta",    descricao: "" },
    // PASSIVO
    { grupoId: passivo._id,  codigoGrupo: "2", codigo: "2.01", nome: "Fornecedores",                 descricao: "Contas a pagar" },
    { grupoId: passivo._id,  codigoGrupo: "2", codigo: "2.02", nome: "Pessoal",                      descricao: "Salários e encargos" },
    { grupoId: passivo._id,  codigoGrupo: "2", codigo: "2.03", nome: "Financeiro",                   descricao: "Empréstimos e financiamentos" },
    { grupoId: passivo._id,  codigoGrupo: "2", codigo: "2.04", nome: "Tributário",                   descricao: "Impostos a recolher" },
    { grupoId: passivo._id,  codigoGrupo: "2", codigo: "2.05", nome: "Outros Passivos",              descricao: "Demais obrigações" },
    // DESPESAS
    { grupoId: despesas._id, codigoGrupo: "3", codigo: "3.01", nome: "Administrativo",               descricao: "Despesas gerais" },
    { grupoId: despesas._id, codigoGrupo: "3", codigo: "3.02", nome: "Pessoal",                      descricao: "Folha e encargos" },
    { grupoId: despesas._id, codigoGrupo: "3", codigo: "3.03", nome: "Financeiro",                   descricao: "Juros e tarifas bancárias" },
    { grupoId: despesas._id, codigoGrupo: "3", codigo: "3.04", nome: "Tributário",                   descricao: "Impostos sobre atividade" },
    { grupoId: despesas._id, codigoGrupo: "3", codigo: "3.05", nome: "Comercial",                    descricao: "Vendas e marketing" },
    // RECEITAS
    { grupoId: receitas._id, codigoGrupo: "4", codigo: "4.01", nome: "Vendas à Vista",               descricao: "Receita à vista" },
    { grupoId: receitas._id, codigoGrupo: "4", codigo: "4.02", nome: "Vendas a Prazo",               descricao: "Receita parcelada" },
    { grupoId: receitas._id, codigoGrupo: "4", codigo: "4.03", nome: "Serviços",                     descricao: "Prestação de serviços" },
    { grupoId: receitas._id, codigoGrupo: "4", codigo: "4.04", nome: "Outras Receitas",              descricao: "Receitas não operacionais" },
  ];

  for (const s of subGruposData) {
    await SubGrupo.updateOne({ codigo: s.codigo }, s, { upsert: true });
  }
  console.log("✅ SubGrupos inseridos");

  // Busca _id do subgrupo Disponível para os exemplos de conta título
  const disponivel = await SubGrupo.findOne({ codigo: "1.01" });

  // ---- CONTA TÍTULOS (exemplo: subgrupo Disponível) ----
  const contaTitulosData = [
    { subGrupoId: disponivel._id, codigoSubGrupo: "1.01", codigo: "1.01.001", nome: "Caixa",      aceitaLancamento: false },
    { subGrupoId: disponivel._id, codigoSubGrupo: "1.01", codigo: "1.01.002", nome: "Bancos",     aceitaLancamento: false },
    { subGrupoId: disponivel._id, codigoSubGrupo: "1.01", codigo: "1.01.005", nome: "Cartões",    aceitaLancamento: true  },
    { subGrupoId: disponivel._id, codigoSubGrupo: "1.01", codigo: "1.01.006", nome: "Bloqueados", aceitaLancamento: true  },
    { subGrupoId: disponivel._id, codigoSubGrupo: "1.01", codigo: "1.01.007", nome: "Aluguel",    aceitaLancamento: true  },
    { subGrupoId: disponivel._id, codigoSubGrupo: "1.01", codigo: "1.01.008", nome: "Rota ES",    aceitaLancamento: true  },
  ];

  for (const t of contaTitulosData) {
    await ContaTitulo.updateOne({ codigo: t.codigo }, t, { upsert: true });
  }
  console.log("✅ ContaTitulos inseridos");

  const bancos = await ContaTitulo.findOne({ codigo: "1.01.002" });

  // ---- CONTA SUB-TÍTULOS (exemplo: 1.01.002 Bancos) ----
  const subTitulosData = [
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.001", nome: "Banestes/Armação",          banco: "Banestes", natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.002", nome: "Banestes Augusta Cavalieri", banco: "Banestes", natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.003", nome: "Banestes Jorge",             banco: "Banestes", natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.006", nome: "Banco do Brasil",            banco: "BB",       natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.014", nome: "C.E.F/Armação",              banco: "CEF",      natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.015", nome: "C.E.F/Augusta",              banco: "CEF",      natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.016", nome: "Coopgás",                    banco: "Coopgás",  natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.020", nome: "Banestes Poupança Augusta",  banco: "Banestes", natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.021", nome: "Banestes Rota ES",           banco: "Banestes", natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.022", nome: "Sicoob Armação",             banco: "Sicoob",   natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.023", nome: "Sicoob Jorge",               banco: "Sicoob",   natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.025", nome: "Poupança Jorge - C.E.F",     banco: "CEF",      natureza: "devedora" },
    { contaTituloId: bancos._id, codigoContaTitulo: "1.01.002", codigo: "1.01.002.026", nome: "Rotativo Banestes",          banco: "Banestes", natureza: "credora"  },
  ];

  for (const s of subTitulosData) {
    await ContaSubTitulo.updateOne({ codigo: s.codigo }, s, { upsert: true });
  }
  console.log("✅ ContaSubTitulos inseridos");

  await mongoose.disconnect();
  console.log("✅ Seed concluído com sucesso!");
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
