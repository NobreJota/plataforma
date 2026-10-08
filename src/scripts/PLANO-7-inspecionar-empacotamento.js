// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-7-inspecionar-empacotamento.js
// Criado em: 08/10/2026
//
// SO LE. Nao grava nada (le o .mdb e o espelho do banco).
//
// Pelo desenho do usuario: Contab_Empacotamento guarda a CHAVE GERAL DA GRAVACAO
// (data, ?, chave) e aponta para o Rotor; o Rotor diz em quais tabelas procurar
// (Ativo/Passivo/Despesas/Receitas = 1); as Receitas ligam ao cupom pelo
// VendPrzo_Chave. Suspeita: uma gravacao pode ter VARIAS chaves de Rotor, e o
// fechamento (debito = credito) acontece no PACOTE, nao em cada chave.
//
// O script:
//   1) mostra as colunas e exemplos de Contab_Empacotamento (2026 e 2025, se houver)
//   2) descobre sozinho qual coluna e a chave do Rotor e qual agrupa (o pacote)
//   3) confere quantos documentos fecham por chave e quantos fecham por pacote
//
// Uso:
//   node src\scripts\PLANO-7-inspecionar-empacotamento.js
//   node src\scripts\PLANO-7-inspecionar-empacotamento.js --mdb "C:\Armação\Dados\2026B\2026B.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const i = args.indexOf('--mdb');
const MDB = i >= 0 ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const TABELAS = ['_access_contab_ativo', '_access_contab_passivo', '_access_contab_despesas', '_access_contab_receitas'];
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const reais = c => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const curto = v => v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v)?.slice(0, 30);

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const MDBReader = mod.default || mod;
  const reader = new MDBReader(fs.readFileSync(MDB));
  const nomes = reader.getTableNames().filter(n => /empacot/i.test(n));
  console.log('Tabelas de empacotamento no Access:', nomes.join(', ') || '(nenhuma)');
  const nome = nomes.find(n => !/2025/.test(n)) || nomes[0];
  if (!nome) return;

  const t = reader.getTable(nome);
  const cols = t.getColumnNames();
  const dados = t.getData();
  console.log('\n=== ' + nome + ' ===  ' + dados.length + ' linhas');
  console.log('colunas:', cols.map(c => c + '(' + (t.getColumn(c).type || '?') + ')').join('  '));
  dados.slice(0, 5).forEach(d => console.log('  ', cols.map(c => c + '=' + curto(d[c])).join('  ')));
  dados.slice(-3).forEach(d => console.log('   (fim) ', cols.map(c => c + '=' + curto(d[c])).join('  ')));

  // ---- espelho: linhas por chave do Rotor (sem o saldo transferido M=0) ----
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const somaChave = new Map();
  for (const n of TABELAS) {
    for await (const d of db.collection(n).find({ M: { $ne: 0 } })) {
      const k = String(d.Chave);
      somaChave.set(k, (somaChave.get(k) || 0) + Math.round(num(d.Valor) * 100));
    }
  }
  const chaves = new Set(somaChave.keys());

  // ---- qual coluna do empacotamento bate com a Chave do Rotor? ----
  const numericas = cols.filter(c => dados.some(d => typeof d[c] === 'number'));
  const acerto = numericas.map(c => [c, dados.filter(d => chaves.has(String(d[c]))).length]).sort((a, b) => b[1] - a[1]);
  console.log('\ncolunas numéricas e quantas linhas batem com uma Chave do Rotor:',
    acerto.map(([c, n]) => c + ':' + n).join('  '));
  const colChave = acerto[0] && acerto[0][1] > 0 ? acerto[0][0] : null;
  if (!colChave) { console.log('Nenhuma coluna bate com a Chave do Rotor. Me mande esta saída.'); return; }

  // ---- testa cada outra coluna como "pacote" ----
  const fechaPorChave = [...somaChave.values()].filter(c => c === 0).length;
  console.log('\nchave do Rotor = coluna "' + colChave + '"');
  console.log('documentos (sem saldo transferido):', somaChave.size, '· fecham por CHAVE:', fechaPorChave,
    '· não fecham:', somaChave.size - fechaPorChave);
  for (const colPac of cols.filter(c => c !== colChave)) {
    const pacote = new Map();      // pacote -> centavos
    const chavePac = new Map();
    for (const d of dados) {
      const k = String(d[colChave]);
      if (!somaChave.has(k)) continue;
      const p = d[colPac] instanceof Date ? d[colPac].toISOString() : String(d[colPac]);
      chavePac.set(k, p);
    }
    for (const [k, c] of somaChave) {
      const p = chavePac.get(k) ?? ('sem:' + k);
      pacote.set(p, (pacote.get(p) || 0) + c);
    }
    const fecham = [...pacote.values()].filter(c => c === 0).length;
    const sobra = [...pacote.values()].reduce((t, c) => t + Math.abs(c), 0);
    console.log('  agrupando por "' + colPac + '": ' + pacote.size + ' pacotes · fecham ' + fecham
      + ' · não fecham ' + (pacote.size - fecham) + ' · sobra absoluta ' + reais(sobra));
  }
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
