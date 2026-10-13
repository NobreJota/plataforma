// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-1-inspecionar-access.js
// Criado em: 13/10/2026
//
// SO LE. Nao grava nada (nem no Access, nem no Mongo).
//
// Antes de montar a OS na plataforma (consignados, termino, foto, recebimento,
// devolucao, liquidacao), ver como o Access guarda isso. Lista TODAS as tabelas
// cujo nome lembra OS / servico / consignado / tecnico / devolucao, e de cada uma:
//   - colunas (nome e tipo)
//   - quantidade de linhas
//   - as 3 ultimas linhas (valores cortados em 40 caracteres)
// E, nas colunas que parecem SITUACAO (Pos, Status, Situacao, Liquid...), quantas
// linhas tem cada valor, para entender os estados da OS.
//
// Gera tambem OS-1-inspecionar-access.txt com a mesma saida (para me mandar).
//
// Uso:
//   node src\scripts\OS-1-inspecionar-access.js
//   opcao: --mdb "C:\Armação\Dados\2026B\2026B.mdb"
//   opcao: --tabela NomeExato     (so essa tabela, com 15 linhas)
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opc = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const MDB = opc('--mdb') || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const SO = opc('--tabela');
const SAIDA = path.join(process.cwd(), 'OS-1-inspecionar-access.txt');

const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const PARECE_OS = /(^|[^a-z])os([^a-z]|$)|oservi|ordem|servi|consig|tecnic|devol|garant|instal|mao ?de ?obra/;
const PARECE_SITUACAO = /^(pos|status|situac|liquid|baixa|conclu|fechad|encerr|cancel)/;

const linhasSaida = [];
const out = (...a) => { const t = a.join(' '); console.log(t); linhasSaida.push(t); };
const curto = v => {
  if (v === null || v === undefined) return '·';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Buffer.isBuffer(v)) return '<binário ' + v.length + ' bytes>';
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
};

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const todas = reader.getTableNames();
  const alvo = SO ? todas.filter(n => n === SO) : todas.filter(n => PARECE_OS.test(limpo(n).replace(/_/g, ' ')));
  if (!alvo.length) throw new Error(SO ? 'tabela não encontrada: ' + SO : 'nenhuma tabela de OS encontrada');

  out('Access:', MDB);
  out('Tabelas encontradas (' + alvo.length + '):', alvo.join(' · '));

  for (const nome of alvo) {
    const tab = reader.getTable(nome);
    const cols = tab.getColumns();
    const dados = tab.getData();
    out('\n' + '='.repeat(78));
    out(nome, '·', dados.length, 'linhas');
    out('colunas:', cols.map(c => c.name + ' (' + c.type + ')').join(', '));

    const ultimas = dados.slice(-(SO ? 15 : 3));
    ultimas.forEach((l, k) => {
      out('  [' + (dados.length - ultimas.length + k + 1) + ']', cols.map(c => c.name + '=' + curto(l[c.name])).join(' | '));
    });

    for (const c of cols.filter(c => PARECE_SITUACAO.test(limpo(c.name)))) {
      const cont = new Map();
      dados.forEach(l => { const k = curto(l[c.name]); cont.set(k, (cont.get(k) || 0) + 1); });
      if (cont.size > 15) { out('  ' + c.name + ':', cont.size, 'valores diferentes'); continue; }
      out('  ' + c.name + ':', [...cont].sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' → ' + n).join(' · '));
    }
  }

  fs.writeFileSync(SAIDA, '\uFEFF' + linhasSaida.join('\r\n'));
  out('\nSaída gravada em:', SAIDA);
})().catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; });
