// =============================================================================
// Destino: C:\plataformaRota\src\scripts\CLIENTE-3-inspecionar-enderecos.js
// Criado em: 02/10/2026
//
// SOMENTE LEITURA do Access. Mostra as colunas e linhas das tabelas de endereco
// (rua, edificio, tipo de logradouro) para o CLIENTE-2 traduzir os codigos
// pelas colunas certas.
//
// Uso:  node src/scripts/CLIENTE-3-inspecionar-enderecos.js
// =============================================================================

'use strict';

const fs = require('fs');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const reader = new MDBReader(fs.readFileSync('C:\\Armação\\Dados\\2026B\\2026B.mdb'));
const nomes = reader.getTableNames().filter(n => /usogeral|rua|logradouro|edif/i.test(n));

console.log('Tabelas de endereco:', nomes.join(', '));
for (const n of nomes) {
  const t = reader.getTable(n);
  const dados = t.getData();
  console.log('\n' + '='.repeat(70) + '\n' + n + '  (' + dados.length + ' linhas)');
  console.log('colunas: ' + t.getColumnNames().join(', '));
  dados.slice(0, 4).forEach(l => console.log('  ' + JSON.stringify(l)));
}

// um cliente PF de exemplo, para ver os codigos que ele guarda
const pf = reader.getTable('Cliente_PFis').getData().slice(-2);
console.log('\n' + '='.repeat(70) + '\nCliente_PFis (2 ultimos), so os campos de endereco:');
pf.forEach(l => console.log('  ' + JSON.stringify({
  NCliente: l.NCliente, TipoLogradouro: l.TipoLogradouro, End: l.End, Nr_End: l.Nr_End,
  Edifício: l['Edifício'], Apto: l.Apto, Bairro: l.Bairro, Cidade: l.Cidade, Estado: l.Estado,
})));
