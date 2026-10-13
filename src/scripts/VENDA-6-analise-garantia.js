// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-6-analise-garantia.js
// Criado em: 09/10/2026
//
// SO LE. Nao grava nada no banco.
//
// Analisa a tabela Vendas_Garantia_Produtos do Access (574 produtos) contra:
//   - _produto_origem (espelho do Access feito pelo COMPRA-5: TODOS os produtos,
//     ativos e inativos)
//   - arquivo_docs (cadastro da plataforma: so os ATIVOS e sem "Z_", pelo COMPRA-15)
//
// Separa os codigos da tabela em:
//   MARCADO      esta no cadastro e ja tem garantia = 1
//   INATIVO      no Access o produto esta desativado
//   Z_           descricao comeca com "Z_" (saiu de linha)
//   SEM_PRODUTO  o codigo nem existe mais no Access (produto apagado)
//   ATIVO_FORA   ativo no Access, mas nao entrou no cadastro (nao devia acontecer)
// Mostra quantos inativos/Z_ ainda tem ESTOQUE (anomalia para conferir).
//
// Gera VENDA-6-analise-garantia.csv (abre no Excel) com TODOS os 574, por
// situacao e marca, para revisar tambem os MARCADOS que nao sao de instalar
// (ex.: 2906 joelho galvanizado).
//
// Uso:
//   node src\scripts\VENDA-6-analise-garantia.js
//   opcao: --mdb "C:\Armação\Dados\2026B\2026B.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const SAIDA = path.join(process.cwd(), 'VENDA-6-analise-garantia.csv');
const Z = /^\s*z_/i;

const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const csv = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

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
  console.log('Tabela', nomeTab, '·', codigos.length, 'produtos diferentes');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  const origem = new Map((await db.collection('_produto_origem')
    .find({ lojistaId: ARMACAO, codigoProd: { $in: codigos } })
    .project({ codigoProd: 1, descricao: 1, marca: 1, ativo: 1, estoque: 1 }).toArray())
    .map(p => [p.codigoProd, p]));
  const cadastro = new Map((await db.collection('arquivo_docs')
    .find({ loja_id: ARMACAO, codigo: { $in: codigos } })
    .project({ codigo: 1, descricao: 1, marcaproduto: 1, garantia: 1, qte: 1 }).toArray())
    .map(p => [p.codigo, p]));

  const linhas = [];
  for (const c of codigos) {
    const o = origem.get(c), a = cadastro.get(c);
    let sit;
    if (a) sit = Number(a.garantia) === 1 ? 'MARCADO' : 'NO_CADASTRO_SEM_MARCA';
    else if (!o) sit = 'SEM_PRODUTO';
    else if (Z.test(o.descricao || '')) sit = 'Z_';
    else if (o.ativo === false) sit = 'INATIVO';
    else sit = 'ATIVO_FORA';
    linhas.push({
      sit, codigo: c,
      descricao: (a?.descricao ?? o?.descricao ?? '').trim(),
      marca: (a?.marcaproduto ?? o?.marca ?? '').trim(),
      estoque: Number(a ? a.qte : o?.estoque) || 0,
    });
  }

  const ORDEM = ['MARCADO', 'NO_CADASTRO_SEM_MARCA', 'INATIVO', 'Z_', 'SEM_PRODUTO', 'ATIVO_FORA'];
  console.log('\nsituação                 produtos   com estoque');
  for (const s of ORDEM) {
    const g = linhas.filter(l => l.sit === s);
    if (!g.length) continue;
    console.log('  ' + s.padEnd(24) + String(g.length).padStart(6) + String(g.filter(l => l.estoque !== 0).length).padStart(12));
  }

  const foraComEstoque = linhas.filter(l => ['INATIVO', 'Z_'].includes(l.sit) && l.estoque !== 0);
  if (foraComEstoque.length) {
    console.log('\nINATIVOS / Z_ COM ESTOQUE (conferir no Access):');
    foraComEstoque.slice(0, 30).forEach(l => console.log('   ', String(l.codigo).padStart(6), String(l.estoque).padStart(5), ' ', l.descricao.slice(0, 55)));
    if (foraComEstoque.length > 30) console.log('    …', foraComEstoque.length - 30, 'a mais no CSV');
  }

  const ativosFora = linhas.filter(l => l.sit === 'ATIVO_FORA');
  if (ativosFora.length) {
    console.log('\nATIVOS NO ACCESS QUE NÃO ESTÃO NO CADASTRO:');
    ativosFora.slice(0, 30).forEach(l => console.log('   ', String(l.codigo).padStart(6), ' ', l.descricao.slice(0, 55)));
  }

  // marcados por marca: para achar o que nao e de instalar
  const porMarca = new Map();
  for (const l of linhas.filter(x => x.sit === 'MARCADO')) porMarca.set(l.marca || '(sem marca)', (porMarca.get(l.marca || '(sem marca)') || 0) + 1);
  console.log('\nMARCADOS por marca:');
  [...porMarca].sort((a, b) => b[1] - a[1]).forEach(([m, n]) => console.log('  ' + m.slice(0, 30).padEnd(32) + String(n).padStart(5)));

  linhas.sort((a, b) => ORDEM.indexOf(a.sit) - ORDEM.indexOf(b.sit) || a.marca.localeCompare(b.marca) || a.descricao.localeCompare(b.descricao));
  const txt = '\uFEFF' + ['situacao;codigo;marca;descricao;estoque']
    .concat(linhas.map(l => [l.sit, l.codigo, l.marca, l.descricao, l.estoque].map(csv).join(';'))).join('\r\n');
  fs.writeFileSync(SAIDA, txt);
  console.log('\nLista completa:', SAIDA);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
