// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-7-garantia-so-marcas-atuais.js
// Criado em: 09/10/2026
// Alterado em: 09/10/2026 - decisao: a tabela Vendas_Garantia_Produtos do Access
//              fica de lado. TODOS os produtos voltam para garantia = 0; a garantia
//              passa a ser marcada na tela da venda, clicando na linha ("É garantia?"),
//              produto a produto, conforme a necessidade. Desfaz o VENDA-5.
//
// So a Armacao. Grava so garantia = 0 (e atualizadoEm).
//
// Uso (um comando por vez):
//   node src\scripts\VENDA-7-garantia-so-marcas-atuais.js              simulacao
//   node src\scripts\VENDA-7-garantia-so-marcas-atuais.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('arquivo_docs');
  console.log('Banco:', mongoose.connection.db.databaseName);

  const filtro = { loja_id: ARMACAO, $or: [{ garantia: 1 }, { instala: true }] };
  const marcados = await col.find(filtro).project({ codigo: 1, descricao: 1, marcaproduto: 1 }).toArray();

  const m = new Map();
  for (const p of marcados) { const k = String(p.marcaproduto || '(sem marca)').trim(); m.set(k, (m.get(k) || 0) + 1); }
  console.log('\ncom garantia hoje (voltam para 0):', marcados.length);
  [...m].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('   ' + k.padEnd(26) + String(n).padStart(5)));

  if (!marcados.length) { console.log('\nNada a fazer.'); return; }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); return; }

  const r = await col.updateMany(
    { loja_id: ARMACAO, _id: { $in: marcados.map(p => p._id) } },
    { $set: { garantia: 0, atualizadoEm: new Date() }, $unset: { instala: '' } });
  console.log('\nZerados:', r.modifiedCount, '· com garantia agora:', await col.countDocuments({ loja_id: ARMACAO, garantia: 1 }));
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
