// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-5-garantia-dos-produtos.js
// Criado em: 09/10/2026
//
// Marca GARANTIA = 1 (garantia, servico e manutencao: o produto pode ser instalado)
// nos produtos da tabela Vendas_Garantia_Produtos do Access (Código, NrFornec,
// CódProduto). Na tela da venda eles passam a aparecer em VIOLETA e com a caixa
// "Instalar".
//
// So a Armacao. So ACRESCENTA: produto ja marcado continua; nada e desmarcado
// (o que foi marcado na tela pelo "É garantia?" fica).
// Mostra tambem os codigos da tabela que nao existem no cadastro (arquivo_docs).
//
// Uso (um comando por vez):
//   node src\scripts\VENDA-5-garantia-dos-produtos.js              simulacao
//   node src\scripts\VENDA-5-garantia-dos-produtos.js --aplicar
//   opcao: --mdb "C:\Armação\Dados\2026B\2026B.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

// acha a coluna pelo nome, sem depender de acento
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nomeTab = reader.getTableNames().find(n => limpo(n) === 'vendasgarantiaprodutos');
  if (!nomeTab) throw new Error('tabela Vendas_Garantia_Produtos não encontrada no Access');
  const tab = reader.getTable(nomeTab);
  const colProd = tab.getColumnNames().find(c => limpo(c) === 'codproduto');
  if (!colProd) throw new Error('coluna CódProduto não encontrada. Colunas: ' + tab.getColumnNames().join(', '));

  const codigos = [...new Set(tab.getData().map(l => Number(l[colProd])).filter(n => Number.isInteger(n) && n > 0))];
  console.log('Tabela', nomeTab, '·', tab.getData().length, 'linhas ·', codigos.length, 'produtos diferentes');

  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('arquivo_docs');
  console.log('Banco:', mongoose.connection.db.databaseName);

  const achados = await col.find({ loja_id: ARMACAO, codigo: { $in: codigos } })
    .project({ codigo: 1, descricao: 1, garantia: 1, ativo: 1 }).toArray();
  const porCodigo = new Map(achados.map(p => [p.codigo, p]));
  const jaMarcados = achados.filter(p => Number(p.garantia) === 1);
  const marcar = achados.filter(p => Number(p.garantia) !== 1);
  const faltam = codigos.filter(c => !porCodigo.has(c)).sort((a, b) => a - b);
  const inativos = marcar.filter(p => p.ativo === false).length;

  console.log('\nno cadastro ...................', achados.length);
  console.log('   já com garantia ............', jaMarcados.length);
  console.log('   a marcar agora .............', marcar.length, inativos ? '(' + inativos + ' inativos, marcados também)' : '');
  console.log('não estão no cadastro .........', faltam.length);
  if (faltam.length) console.log('   ', faltam.slice(0, 60).join(', ') + (faltam.length > 60 ? ' …' : ''));
  console.log('\nexemplos a marcar:');
  marcar.slice(0, 10).forEach(p => console.log('   ', String(p.codigo).padStart(6), String(p.descricao || '').slice(0, 60)));

  const total = await col.countDocuments({ loja_id: ARMACAO, garantia: 1 });
  console.log('\nprodutos com garantia hoje (todos):', total);

  if (!marcar.length) { console.log('Nada a fazer.'); return; }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); return; }

  const r = await col.updateMany(
    { loja_id: ARMACAO, _id: { $in: marcar.map(p => p._id) } },
    { $set: { garantia: 1, atualizadoEm: new Date() }, $unset: { instala: '' } });
  console.log('\nMarcados:', r.modifiedCount, '· com garantia agora:', await col.countDocuments({ loja_id: ARMACAO, garantia: 1 }));
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
