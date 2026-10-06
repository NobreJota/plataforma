// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-16-inspecionar-nfe.js
// Criado em: 30/09/2026
//
// SOMENTE LEITURA, nem conecta no banco. Mostra as colunas e 3 linhas de
// NFE_Cabeçalho e NFE_Itens, para a lista de notas de entrada do produto
// (modal do pedido) usar os nomes certos.
//
// Uso:  node src/scripts/COMPRA-16-inspecionar-nfe.js
// =============================================================================

'use strict';

const fs = require('fs');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const MDB = process.argv[2] || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const reader = new MDBReader(fs.readFileSync(MDB));
const todas = reader.getTableNames();

for (const alvo of ['NFE_Cabeçalho', 'NFE_Itens']) {
  const nome = todas.find(t => t === alvo)
    || todas.find(t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === alvo.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  console.log('\n' + '='.repeat(70) + '\n' + alvo + (nome && nome !== alvo ? '  (achada como ' + nome + ')' : ''));
  if (!nome) { console.log('  nao encontrada'); continue; }
  const t = reader.getTable(nome);
  const linhas = t.getData();
  console.log('linhas:', linhas.length);
  console.log('colunas:', t.getColumnNames().join(', '));
  linhas.slice(-3).forEach(l => console.log(' ', JSON.stringify(l)));
}
