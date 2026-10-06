// =============================================================================
// Destino: C:\plataformaRota\src\scripts\CLIENTE-1-inspecionar.js
// Criado em: 01/10/2026
//
// SOMENTE LEITURA do Access. Nao conecta no banco.
//
// Para cada tabela de cliente (Cliente_PFis, Cliente_PJur) mostra:
//   - quantas linhas e todas as colunas, com quantas estao preenchidas
//   - duas linhas de exemplo (as mais novas)
//   - as colunas que parecem conta contabil (NC...): os valores mais comuns
//     e quantos clientes tem conta propria
// E mostra as tabelas UsoGeral_Bairros / Cidades / Estado (codigo -> nome).
//
// Uso:  node src/scripts/CLIENTE-1-inspecionar.js
// =============================================================================

'use strict';

const fs = require('fs');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const MDB = process.argv[2] || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const reader = new MDBReader(fs.readFileSync(MDB));
const todas = reader.getTableNames();

const vazio = v => v === null || v === undefined || ['', '0', '0000'].includes(String(v).trim())
  || /^[0.\-/ ]*$/.test(String(v).trim());
const curto = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 40);
const linha = t => console.log('\n' + '='.repeat(74) + '\n' + t + '\n' + '='.repeat(74));

for (const nome of ['Cliente_PFis', 'Cliente_PJur']) {
  linha(nome);
  if (!todas.includes(nome)) { console.log('nao encontrada'); continue; }
  const t = reader.getTable(nome);
  const cols = t.getColumnNames();
  const dados = t.getData();
  console.log('linhas:', dados.length);

  console.log('\ncoluna                    preenchidas   exemplo');
  for (const c of cols) {
    const n = dados.filter(l => !vazio(l[c])).length;
    const ex = dados.find(l => !vazio(l[c]));
    console.log('  ' + c.padEnd(24) + String(n).padStart(8) + '   ' + (ex ? curto(ex[c]) : ''));
  }

  console.log('\nDuas linhas mais novas:');
  dados.slice(-2).forEach(l => console.log(' ', JSON.stringify(l)));

  for (const c of cols.filter(c => /^nc|contab/i.test(c))) {
    const cont = new Map();
    for (const l of dados) {
      const v = String(l[c] ?? '').trim();
      cont.set(v, (cont.get(v) || 0) + 1);
    }
    const top = [...cont].sort((a, b) => b[1] - a[1]);
    console.log('\nColuna ' + c + ': ' + cont.size + ' valores distintos. Mais comuns:');
    top.slice(0, 10).forEach(([v, n]) => console.log('   ' + (v || '(vazio)').padEnd(20) + n));
    const unicos = top.filter(([, n]) => n === 1).length;
    console.log('   valores usados por UM cliente so (conta propria?):', unicos);
  }
}

for (const nome of ['UsoGeral_Bairros', 'UsoGeral_Cidades', 'UsoGeral_Estado']) {
  linha(nome);
  if (!todas.includes(nome)) { console.log('nao encontrada'); continue; }
  const t = reader.getTable(nome);
  const dados = t.getData();
  console.log('linhas:', dados.length, '| colunas:', t.getColumnNames().join(', '));
  dados.slice(0, 5).forEach(l => console.log(' ', JSON.stringify(l)));
}
