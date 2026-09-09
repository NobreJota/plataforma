// scripts/seed_grupos.js
// Popula os 4 grupos fixos do plano de contas.
// Rode uma vez:  node scripts/seed_grupos.js
//
// Usa o mesmo conector do projeto: config/database/index.js
// (aceita MONGO_URI ou MONGODB_URI no .env)

require('dotenv').config();

const { connectToDatabase, mongoose } = require('../database');
const Grupo = require('../src/models/grupo');

const GRUPOS = [
  { codigo: '1', nome: 'Ativo',    tipo: 'ativo'    },
  { codigo: '2', nome: 'Passivo',  tipo: 'passivo'  },
  { codigo: '3', nome: 'Despesas', tipo: 'despesas' },
  { codigo: '4', nome: 'Receitas', tipo: 'receitas' }
];

(async () => {
  try {
    await connectToDatabase();

    console.log('\n📋 Inserindo grupos contábeis...\n');

    for (const g of GRUPOS) {
      const r = await Grupo.updateOne(
        { codigo: g.codigo },
        { $setOnInsert: g },
        { upsert: true }
      );
      const acao = r.upsertedCount ? '✓ inserido' : '↻ já existia';
      console.log(`  ${acao}  →  ${g.codigo} - ${g.nome}`);
    }

    console.log('\n✅ Seed concluído.\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    process.exit(1);
  }
})();
