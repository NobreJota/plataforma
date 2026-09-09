// scripts/seed-bancos.js
// Pré-cadastra os 10 bancos mais comuns. Idempotente: roda quantas vezes quiser.
// USO: node scripts/seed-bancos.js

require('dotenv').config();
const { connectToDatabase, mongoose } = require('../database');
const Banco = require('../src/models/auxiliares/banco');

const BANCOS = [
  { codigo: '001', nome: 'Banco do Brasil S.A.',   nomeCurto: 'BB' },
  { codigo: '104', nome: 'Caixa Econômica Federal', nomeCurto: 'CEF' },
  { codigo: '237', nome: 'Banco Bradesco S.A.',     nomeCurto: 'Bradesco' },
  { codigo: '341', nome: 'Banco Itaú Unibanco S.A.', nomeCurto: 'Itaú' },
  { codigo: '033', nome: 'Banco Santander Brasil S.A.', nomeCurto: 'Santander' },
  { codigo: '260', nome: 'Nu Pagamentos S.A.',      nomeCurto: 'Nubank' },
  { codigo: '077', nome: 'Banco Inter S.A.',        nomeCurto: 'Inter' },
  { codigo: '756', nome: 'Banco Cooperativo do Brasil S.A. – Bancoob', nomeCurto: 'Sicoob' },
  { codigo: '021', nome: 'Banestes S.A. Banco do Estado do Espírito Santo', nomeCurto: 'Banestes' },
  { codigo: '336', nome: 'Banco C6 S.A.',           nomeCurto: 'C6' }
];

async function main() {
  await connectToDatabase();
  console.log('🌱 Iniciando seed de bancos...\n');

  // Garante índice único em código
  try {
    await Banco.collection.createIndex({ codigo: 1 }, { unique: true, name: 'codigo_unique' });
    console.log('✅ Índice único garantido em codigo');
  } catch (err) {
    console.log('ℹ️ Índice já existia ou outro erro:', err.message);
  }

  let inseridos = 0;
  let existentes = 0;

  for (const b of BANCOS) {
    try {
      const existe = await Banco.findOne({ codigo: b.codigo });
      if (existe) {
        console.log(`   ⏭ ${b.codigo} - ${b.nomeCurto} já cadastrado (pulando)`);
        existentes++;
        continue;
      }
      await Banco.create(b);
      console.log(`   ✅ ${b.codigo} - ${b.nomeCurto} inserido`);
      inseridos++;
    } catch (err) {
      console.error(`   ❌ Erro em ${b.codigo}:`, err.message);
    }
  }

  console.log(`\n🏁 Concluído: ${inseridos} inseridos, ${existentes} já existiam.`);
  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
