// src/scripts/2B-adicionar-lojistaid.js
//
// ETAPA 2B.1 — Migração de dados
// Adiciona o campo `lojistaId` em TODOS os documentos das 16 coleções do
// domínio contab, atribuindo o _id da Armação Comercial Ltda (única lojista
// com dados reais no momento).
//
// SEGURANÇA:
//   - Faz backup automático das contagens antes/depois (log)
//   - Só atualiza documentos que AINDA NÃO têm lojistaId (evita re-escrever)
//   - Aborta se a Armação não for encontrada
//
// Uso:
//   cd C:\plataformaRota
//   node src/scripts/2B-adicionar-lojistaid.js

require('dotenv').config();
const mongoose = require('mongoose');

const URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI;

if (!URI) {
  console.error('❌ Não achei a string de conexão no .env');
  process.exit(1);
}

// _id fixo da Armação Comercial Ltda (email 1212@gmail.com)
const ID_ARMACAO = '6892706a86509313e632f717';

// As 16 coleções que recebem lojistaId
// (nomes conferem com os que aparecem no Compass — plural, em snake_case
//  ou lowercase conforme o Mongoose registrou)
const COLECOES = [
  // Plano de contas
  { nome: 'grupos',                grupo: 'contabil'   },
  { nome: 'grupossubs',            grupo: 'contabil'   },   // ← confirmar nome real
  { nome: 'contatitulos',          grupo: 'contabil'   },
  { nome: 'contasubtitulos',       grupo: 'contabil'   },
  { nome: 'historicocontas',       grupo: 'contabil'   },   // ← confirmar
  { nome: 'registrocontabeis',     grupo: 'contabil'   },   // ← confirmar

  // Financeiro
  { nome: '_boletas',              grupo: 'financeiro' },
  { nome: 'fluxocaixas',           grupo: 'financeiro' },   // ← confirmar
  { nome: '_fluxo_projetado',      grupo: 'financeiro' },   // ← confirmar
  { nome: 'orcamentoanuais',       grupo: 'financeiro' },   // ← confirmar
  { nome: 'orcamentocontas',       grupo: 'financeiro' },   // ← confirmar
  { nome: 'compraanuais',          grupo: 'financeiro' },   // ← confirmar
  { nome: 'comprafornecedores',    grupo: 'financeiro' },   // ← confirmar

  // Auxiliares (globais do contab, precisam pertencer a um lojista)
  { nome: '_aux_clientes',         grupo: 'auxiliares' },
  { nome: 'fornecs',               grupo: 'auxiliares' },
  { nome: '_aux_contas_bancarias', grupo: 'auxiliares' },
];

(async () => {
  let conexao;
  try {
    console.log('🔌 Conectando ao MongoDB...');
    conexao = await mongoose.connect(URI);
    console.log('✅ Conectado.\n');

    const db = mongoose.connection.db;

    // Confere se a Armação existe (validação de segurança)
    const lojista = await db.collection('lojistas').findOne({
      _id: new mongoose.Types.ObjectId(ID_ARMACAO)
    });
    if (!lojista) {
      console.error('❌ ABORTADO: Lojista Armação não encontrado (_id: ' + ID_ARMACAO + ')');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`👤 Lojista de destino: ${lojista.razao} (${lojista.email})\n`);

    const lojistaObjectId = new mongoose.Types.ObjectId(ID_ARMACAO);
    let totalGeral = 0;

    console.log('📋 Processando 16 coleções...\n');

    for (const col of COLECOES) {
      const nome = col.nome;

      // Verifica se a coleção existe
      const existe = await db.listCollections({ name: nome }).hasNext();
      if (!existe) {
        console.log(`⚠  ${nome.padEnd(30)} → coleção NÃO EXISTE, pulando`);
        continue;
      }

      // Conta documentos ANTES
      const totalDocs   = await db.collection(nome).countDocuments({});
      const semLojistaId = await db.collection(nome).countDocuments({
        lojistaId: { $exists: false }
      });

      if (totalDocs === 0) {
        console.log(`⏭  ${nome.padEnd(30)} → vazia (0 docs), pulando`);
        continue;
      }

      if (semLojistaId === 0) {
        console.log(`✔  ${nome.padEnd(30)} → já migrada (todos os ${totalDocs} docs têm lojistaId)`);
        continue;
      }

      // Atualiza SÓ os que ainda não têm lojistaId (idempotente = seguro rodar 2x)
      const r = await db.collection(nome).updateMany(
        { lojistaId: { $exists: false } },
        { $set: { lojistaId: lojistaObjectId } }
      );

      totalGeral += r.modifiedCount;
      console.log(`✅ ${nome.padEnd(30)} → ${r.modifiedCount}/${totalDocs} docs atualizados`);
    }

    console.log(`\n🎉 Migração concluída. Total geral: ${totalGeral} documentos atualizados.`);
    console.log('\n📌 PRÓXIMO PASSO:');
    console.log('   1. Confere no Compass que cada coleção tem o campo lojistaId preenchido');
    console.log('   2. Aplica os 16 schemas atualizados (bloco lojistaId com required: false)');
    console.log('   3. Reinicia o nodemon');
    console.log('   4. Depois de testar tudo funcionando, virar required: true (Etapa 2B.2)\n');

    await mongoose.disconnect();
    console.log('🔌 Desconectado.');
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
    if (conexao) await mongoose.disconnect();
    process.exit(1);
  }
})();
