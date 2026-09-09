// src/scripts/2B-adicionar-lojistaid.js
// ETAPA 2B.1 — Migração multi-empresa
// Adiciona lojistaId (Armação) nas 12 coleções do domínio CONTAB.

require('dotenv').config();
const mongoose = require('mongoose');

const URI =
  process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;

if (!URI) {
  console.error('❌ Não achei a string de conexão no .env');
  process.exit(1);
}

const ID_ARMACAO = '6892706a86509313e632f717';

const COLECOES = [
  // Plano de contas
  '_contatitulos',
  '_contasubtitulos',
  '_historico_contas',
  // Financeiro
  '_boletas',
  '_fluxo_projetado',
  '_compra_anual',
  '_compra_fornecedores',
  '_orcamento_anual',
  '_orcamento_contas',
  // Auxiliares
  '_aux_clientes',
  'fornecs',
  '_aux_contas_bancarias',
];

(async () => {
  let conexao;
  try {
    console.log('🔌 Conectando ao MongoDB...');
    conexao = await mongoose.connect(URI);
    console.log('✅ Conectado.\n');

    const db = mongoose.connection.db;

    const lojista = await db.collection('lojistas').findOne({
      _id: new mongoose.Types.ObjectId(ID_ARMACAO)
    });
    if (!lojista) {
      console.error('❌ ABORTADO: Armação não encontrada.');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`👤 Destino: ${lojista.razao} (${lojista.email})\n`);

    const lojistaObjectId = new mongoose.Types.ObjectId(ID_ARMACAO);
    let totalAtualizados = 0;
    const atualizadas = [], jaMigradas = [], pulados = [];

    console.log(`📋 Processando ${COLECOES.length} coleções...\n`);

    for (const nome of COLECOES) {
      const existe = await db.listCollections({ name: nome }).hasNext();
      if (!existe) {
        console.log(`⚠  ${nome.padEnd(30)} → NÃO EXISTE, pulando`);
        pulados.push(nome);
        continue;
      }

      const totalDocs = await db.collection(nome).countDocuments({});
      const semLojistaId = await db.collection(nome).countDocuments({
        lojistaId: { $exists: false }
      });

      if (totalDocs === 0) {
        console.log(`⏭  ${nome.padEnd(30)} → vazia, pulando`);
        pulados.push(nome);
        continue;
      }

      if (semLojistaId === 0) {
        console.log(`✔  ${nome.padEnd(30)} → já migrada (${totalDocs} docs)`);
        jaMigradas.push(nome);
        continue;
      }

      const r = await db.collection(nome).updateMany(
        { lojistaId: { $exists: false } },
        { $set: { lojistaId: lojistaObjectId } }
      );
      totalAtualizados += r.modifiedCount;
      atualizadas.push(nome);
      console.log(`✅ ${nome.padEnd(30)} → ${r.modifiedCount}/${totalDocs} docs atualizados`);
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`✅ Atualizadas: ${atualizadas.length} coleções, ${totalAtualizados} docs`);
    console.log(`✔  Já migradas: ${jaMigradas.length} coleções`);
    console.log(`⚠  Puladas: ${pulados.length} coleções`);
    if (pulados.length) console.log(`     → ${pulados.join(', ')}`);
    console.log('');

    await mongoose.disconnect();
    console.log('🔌 Desconectado.');
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    if (conexao) await mongoose.disconnect();
    process.exit(1);
  }
})();
