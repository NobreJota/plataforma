// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-8-inspecionar-precos.js
// Criado em: 10/10/2026
//
// SO LE. Nao grava nada.
//
// Na venda, o 6008 (Aquec. GN KO 38 Di) sai 5.791,48 a vista e 4.420,00 a prazo:
// o preco a prazo ficou MENOR que o a vista. A tela so le o cadastro
// (arquivo_docs.precovista / precoprazo), entao o problema esta nos dados.
// Este script mostra:
//   1) o produto (padrao 6008) no cadastro (arquivo_docs) e no espelho do Access
//      (_produto_origem, feito pelo COMPRA-5): todos os campos de preco/custo/taxa
//   2) em TODOS os produtos ativos da Armacao: quantos tem prazo > vista, = vista,
//      < vista e prazo zerado — para ver se e um produto so ou o cadastro inteiro
//
// Uso:
//   node src\scripts\VENDA-8-inspecionar-precos.js
//   node src\scripts\VENDA-8-inspecionar-precos.js 6147     (outro codigo)
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const CODIGO = Number(process.argv.slice(2).find(a => /^\d+$/.test(a)) || 6008);
const campoDePreco = k => /pre[cç]o|custo|taxa|vista|prazo|margem|valor/i.test(k);
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  // 1) o produto nos dois lugares
  const cad = await db.collection('arquivo_docs').findOne({ loja_id: ARMACAO, codigo: CODIGO });
  console.log('\n=== cadastro (arquivo_docs) · produto', CODIGO, '· valores em REAIS ===');
  if (!cad) console.log('   não encontrado');
  else {
    console.log('   ' + (cad.descricao || ''));
    Object.keys(cad).filter(campoDePreco).forEach(k => console.log('   ' + k.padEnd(18) + JSON.stringify(cad[k])));
  }
  const ori = await db.collection('_produto_origem').findOne({ lojistaId: ARMACAO, codigoProd: CODIGO });
  console.log('\n=== espelho do Access (_produto_origem) · valores em CENTAVOS ===');
  if (!ori) console.log('   não encontrado');
  else {
    console.log('   ' + (ori.descricao || '') + (ori.atualizadoEm ? '  · espelho de ' + new Date(ori.atualizadoEm).toLocaleString('pt-BR') : ''));
    Object.keys(ori).filter(campoDePreco).forEach(k => console.log('   ' + k.padEnd(18) + JSON.stringify(ori[k])));
  }

  // 2) todos os ativos: prazo x vista
  const todos = await db.collection('arquivo_docs').find({ loja_id: ARMACAO, ativo: { $ne: false } })
    .project({ codigo: 1, descricao: 1, precovista: 1, precoprazo: 1 }).toArray();
  const g = { maior: [], igual: [], menor: [], zero: [] };
  for (const p of todos) {
    const v = Number(p.precovista) || 0, z = Number(p.precoprazo) || 0;
    if (!z) g.zero.push(p); else if (z > v) g.maior.push(p); else if (z === v) g.igual.push(p); else g.menor.push(p);
  }
  console.log('\n=== produtos ativos da Armação:', todos.length, '===');
  console.log('   prazo MAIOR que à vista ...', g.maior.length);
  console.log('   prazo IGUAL à vista .......', g.igual.length);
  console.log('   prazo MENOR que à vista ...', g.menor.length, '  <- o caso do', CODIGO);
  console.log('   prazo zerado (usa à vista) ', g.zero.length);
  if (g.menor.length) {
    console.log('\n   exemplos com prazo MENOR (código · à vista · a prazo · descrição):');
    g.menor.slice(0, 15).forEach(p => console.log('   ' + String(p.codigo).padStart(6) + brl(p.precovista).padStart(12)
      + brl(p.precoprazo).padStart(12) + '   ' + String(p.descricao || '').slice(0, 45)));
  }
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
