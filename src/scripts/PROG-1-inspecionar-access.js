// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PROG-1-inspecionar-access.js
// Criado em: 19/10/2026 — SO LE o Access (nao toca no banco da plataforma).
//
// PROGRAMACAO DE COMPRAS (proxima tela): antes de montar, ver ONDE o Access guarda
//   - a grade fornecedor x mes (tela "Programação de Compras", com o ano em cima),
//   - a realizacao do mes (notas que entraram: Entrada / Nota Fiscal / Fornecedor / Valor / Saldo),
//   - a lista de pedidos programados (lado direito da "Lista de Pedidos Pendente": 997 Komlog...).
// Mostra as tabelas com nome de programacao / previsao / compra / pedido: linhas, colunas e 3 exemplos.
//
// Uso: node src\scripts\PROG-1-inspecionar-access.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"
//      opcional: --tabela NomeDaTabela   (mostra 15 exemplos so dela)
// =============================================================================

'use strict';

const fs = require('fs');
const args = process.argv.slice(2);
const op = k => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const MDB = op('--mdb') || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const SO = op('--tabela');
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mostra = v => v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? '' : String(v).slice(0, 30);

if (!fs.existsSync(MDB)) { console.error('Access não encontrado: ' + MDB); process.exit(1); }
const mod = require('mdb-reader');
const reader = new (mod.default || mod)(fs.readFileSync(MDB));
const nomes = reader.getTableNames();
const alvo = SO ? nomes.filter(n => limpo(n) === limpo(SO))
  : nomes.filter(n => /progr|previs|proje|compra|pedid|ped_|entrada|nfe_|nf_ent|fornec/i.test(limpo(n)));
console.log('Access: ' + MDB + ' · ' + nomes.length + ' tabelas · ' + alvo.length + ' com nome de programação/compra/pedido\n');
for (const n of alvo) {
  let t; try { t = reader.getTable(n); } catch (e) { console.log(n + ': (não abriu: ' + e.message + ')\n'); continue; }
  const dados = t.getData();
  console.log('== ' + n + ' · ' + dados.length + ' linhas');
  console.log('   colunas: ' + t.getColumnNames().join(', '));
  for (const l of dados.slice(0, SO ? 15 : 3)) console.log('   · ' + t.getColumnNames().map(c => c + '=' + mostra(l[c])).join(' | '));
  console.log('');
}
