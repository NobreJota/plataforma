// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-18-relatorio-nfe-repetidas.js
// Criado em: 01/10/2026
//
// SOMENTE LEITURA do Access. Nao conecta no banco.
//
// Lista os itens de NFE_Itens (emissao dos ultimos 5 anos) cujo par
// (Chave, Ordem) aparece mais de uma vez — os que o COMPRA-17 sobrepos.
// Para cada par diz se as linhas sao IGUAIS (duplicata no Access, nada se
// perde) ou DIFERENTES (produto/quantidade/valor diferentes: item perdido).
//
// Saida: resumo no terminal + planilha
//   src\scripts\relatorios\nfe-repetidas-AAAA-MM-DD.csv
// (separador ";" e acentos certos para abrir no Excel)
//
// Uso:  node src/scripts/COMPRA-18-relatorio-nfe-repetidas.js
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const MDB = process.argv[2] || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const CORTE = new Date(Date.UTC(new Date().getFullYear() - 5, 0, 1));

const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const numero = v => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const br = n => numero(n).toFixed(2).replace('.', ',');
const dia = d => (d instanceof Date && !isNaN(d)) ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '';
const txt = v => String(v ?? '').trim();
const csv = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

const reader = new MDBReader(fs.readFileSync(MDB));
const todas = reader.getTableNames();
const achar = n => todas.find(t => t === n) || todas.find(t => semAcento(t) === semAcento(n));

const cab = new Map();
for (const c of reader.getTable(achar('NFE_Cabeçalho')).getData()) cab.set(Number(c['Chave']), c);

// agrupa por (Chave, Ordem), so dentro do periodo
const grupos = new Map();
for (const it of reader.getTable(achar('NFE_Itens')).getData()) {
  const c = cab.get(Number(it['Chave']));
  if (!c || !(c['Emissão'] instanceof Date) || c['Emissão'] < CORTE) continue;
  const k = Number(it['Chave']) + '|' + Number(it['Ordem']);
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push({ it, c });
}

const assinatura = ({ it }) => [txt(it['NotaFiscal']), Number(it['Código']), numero(it['Qte']), numero(it['Vrtotal'])].join('|');

const linhasCsv = [[
  'situacao', 'chave', 'ordem', 'nota_item', 'nota_cabecalho', 'emissao', 'entrada',
  'nr_fornec', 'pedido', 'codigo_produto', 'referencia', 'qte', 'vr_custo', 'ipi_perc', 'vr_total',
].join(';')];

let pares = 0, paresIguais = 0, paresDiferentes = 0, itensPerdidos = 0;
const exemplos = [];

for (const [k, lista] of grupos) {
  if (lista.length < 2) continue;
  pares++;
  const distintas = new Set(lista.map(assinatura)).size;
  const situacao = distintas === 1 ? 'IGUAIS' : 'DIFERENTES';
  if (distintas === 1) paresIguais++;
  else { paresDiferentes++; itensPerdidos += distintas - 1; if (exemplos.length < 15) exemplos.push(lista); }

  for (const { it, c } of lista) {
    linhasCsv.push([
      situacao, it['Chave'], it['Ordem'], txt(it['NotaFiscal']), txt(c['NrNota']),
      dia(c['Emissão']), dia(c['DataEntr']), it['Nr_Fornec'], c['NrPedido'],
      it['Código'], txt(it['Refer']), br(it['Qte']), br(it['VrCusto']), br(it['IPI']), br(it['Vrtotal']),
    ].map(csv).join(';'));
  }
}

const pasta = path.join(__dirname, 'relatorios');
fs.mkdirSync(pasta, { recursive: true });
const arq = path.join(pasta, 'nfe-repetidas-' + new Date().toISOString().slice(0, 10) + '.csv');
fs.writeFileSync(arq, '\uFEFF' + linhasCsv.join('\r\n'), 'utf8');

console.log('Periodo: emissao a partir de', dia(CORTE));
console.log('Pares (Chave, Ordem) repetidos:   ', pares);
console.log('  com linhas IGUAIS (nada perdido):', paresIguais);
console.log('  com linhas DIFERENTES:           ', paresDiferentes, '->', itensPerdidos, 'item(ns) perdido(s)');

if (exemplos.length) {
  console.log('\nPrimeiros pares DIFERENTES:');
  for (const lista of exemplos) {
    console.log('  Chave', lista[0].it['Chave'], 'Ordem', lista[0].it['Ordem']);
    for (const { it, c } of lista) {
      console.log('     nota', txt(it['NotaFiscal']).padEnd(8), dia(c['Emissão']),
        '| prod', String(it['Código']).padStart(5), txt(it['Refer']).padEnd(14),
        '| qte', br(it['Qte']).padStart(7), '| total', br(it['Vrtotal']).padStart(10));
    }
  }
}

console.log('\nPlanilha:', arq);
