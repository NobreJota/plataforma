// scripts/limpar-banco-agencia-conta.js
// Roda UMA VEZ para remover os campos banco/agencia/conta de todos os
// documentos da coleção contasubtitulos. Após rodar, pode apagar este arquivo.
//
// Uso:
//   cd C:\plataformaRota
//   node scripts/limpar-banco-agencia-conta.js
//
// Lê a string de conexão do .env (variável MONGO_URI ou MONGODB_URI).

require('dotenv').config();
const mongoose = require('mongoose');

const URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI;

if (!URI) {
  console.error('❌ Não achei a string de conexão no .env');
  console.error('   Variáveis aceitas: MONGO_URI, MONGODB_URI, DB_URI');
  process.exit(1);
}

(async () => {
  try {
    console.log('🔌 Conectando ao MongoDB...');
    await mongoose.connect(URI);
    console.log('✅ Conectado.');

    const col = mongoose.connection.collection('contasubtitulos');

    // Quantos têm pelo menos um dos campos?
    const antes = await col.countDocuments({
      $or: [
        { banco:   { $exists: true } },
        { agencia: { $exists: true } },
        { conta:   { $exists: true } },
      ],
    });
    console.log(`📊 Documentos com banco/agencia/conta: ${antes}`);

    if (antes === 0) {
      console.log('✨ Nada a limpar. Já está zerado.');
      await mongoose.disconnect();
      return;
    }

    console.log('🧹 Removendo os 3 campos de TODOS os documentos...');
    const r = await col.updateMany(
      {},
      { $unset: { banco: '', agencia: '', conta: '' } }
    );
    console.log(`✅ Documentos modificados: ${r.modifiedCount}`);

    // Confere
    const depois = await col.countDocuments({
      $or: [
        { banco:   { $exists: true } },
        { agencia: { $exists: true } },
        { conta:   { $exists: true } },
      ],
    });
    console.log(`📊 Documentos com os campos APÓS limpeza: ${depois}`);

    if (depois === 0) {
      console.log('🎉 Limpeza concluída com sucesso.');
    } else {
      console.log('⚠ Ainda restam documentos com os campos. Verifique manualmente.');
    }

    await mongoose.disconnect();
    console.log('🔌 Desconectado.');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
})();
