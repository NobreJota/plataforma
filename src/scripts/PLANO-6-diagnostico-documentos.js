// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-6-diagnostico-documentos.js
// Criado em: 08/10/2026
//
// SO LE. Nao grava nada.
//
// O PLANO-5 mostrou: 6833 documentos de 2026, 602 que NAO fecham em zero e a soma
// geral dando -1.296.943,77. Este script separa e explica:
//   1) SALDO TRANSFERIDO (linhas com M = 0): saldo de abertura, perna unica — nao
//      fecha de proposito. Total por grupo (1 Ativo, 2 Passivo...).
//   2) os outros que nao fecham: por Origem, pelas marcas do Rotor (Ativo/Passivo/
//      Despesas/Receitas = 1) que NAO tem linha na tabela, e 8 exemplos completos.
//   3) as 7 chaves de linha sem documento no Rotor.
//
// Alterado em: 08/10/2026 - 2a rodada mostrou que M = 0 NAO e sinal seguro de saldo
//   transferido: ha linhas de documentos comuns com M = 0 (ex.: Chave 27, "diferenca" de
//   cartao, 921,62). Agora SALDO TRANSFERIDO = documento em que TODAS as linhas tem historico
//   "Saldo transferido"; o fechamento conta TODAS as linhas dos outros. Os que nao fecham
//   sao agrupados pelo inicio do historico (EstoqueAjuste, ...), para ver os tipos.
//
// Uso:
//   node src\scripts\PLANO-6-diagnostico-documentos.js
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const TABELAS = { ativo: '_access_contab_ativo', passivo: '_access_contab_passivo',
                  despesas: '_access_contab_despesas', receitas: '_access_contab_receitas' };
const MARCA = { ativo: 'Ativo', passivo: 'Passivo', despesas: 'Despesas', receitas: 'Receitas' };
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const reais = c => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  // documentos do Rotor
  const rotor = new Map();
  for await (const r of db.collection('_access_contab_rotor').find({})) rotor.set(String(r.Chave), r);

  // linhas, por documento
  const docs = new Map();          // chave -> { linhas: [], soma, tabelas:Set }
  const saldoAbertura = new Map(); // grupo (1 digito) -> centavos
  let linhasSaldo = 0;
  for (const [nome, col] of Object.entries(TABELAS)) {
    for await (const d of db.collection(col).find({})) {
      const k = String(d.Chave);
      const c = Math.round(num(d.Valor) * 100);
      if (!docs.has(k)) docs.set(k, { linhas: [], soma: 0, somaSemSaldo: 0, tabelas: new Set() });
      const doc = docs.get(k);
      doc.linhas.push({ tabela: nome, cta: d.Cta, hist: d.Hist, c, m: d.M });
      doc.soma += c;
      doc.tabelas.add(nome);
    }
  }

  // documento de saldo transferido: todas as linhas com historico "Saldo transferido"
  const ehSaldo = d => d.linhas.every(l => /^\s*saldo\s+transf/i.test(String(l.hist || '')));
  let mZeroFora = 0;
  for (const [, d] of docs) {
    if (ehSaldo(d)) {
      for (const l of d.linhas) {
        linhasSaldo++;
        const g = String(l.cta || '?').slice(0, 1);
        saldoAbertura.set(g, (saldoAbertura.get(g) || 0) + l.c);
      }
      d.somaSemSaldo = 0;
    } else {
      d.somaSemSaldo = d.soma;
      mZeroFora += d.linhas.filter(l => Number(l.m) === 0).length;
    }
  }

  // 1) saldo transferido
  console.log('\n=== 1) SALDO TRANSFERIDO (historico "Saldo transferido") ===');
  console.log('linhas:', linhasSaldo, '· linhas com M = 0 em documentos comuns (M digitado errado):', mZeroFora);
  let totAb = 0;
  for (const [g, c] of [...saldoAbertura].sort()) { console.log('  grupo ' + g + ':', reais(c).padStart(16)); totAb += c; }
  console.log('  soma (Ativo + Passivo de abertura; deve ser perto de zero se o 2025 fechou):', reais(totAb));

  // 2) os que nao fecham, tirando as linhas de saldo transferido
  const abertos = [...docs].filter(([, d]) => d.somaSemSaldo !== 0);
  console.log('\n=== 2) DOCUMENTOS QUE NÃO FECHAM (sem contar o saldo transferido) ===');
  console.log('quantos:', abertos.length, '· sobra total:', reais(abertos.reduce((t, [, d]) => t + d.somaSemSaldo, 0)));

  const porOrigem = new Map();
  const marcaSemLinha = new Map();
  for (const [k, d] of abertos) {
    const r = rotor.get(k) || {};
    const o = String(r.Origem ?? '').trim() || '(vazio)';
    const x = porOrigem.get(o) || { n: 0, c: 0 };
    x.n++; x.c += d.somaSemSaldo; porOrigem.set(o, x);
    for (const [t, campo] of Object.entries(MARCA)) {
      if (Number(r[campo]) === 1 && !d.tabelas.has(t)) marcaSemLinha.set(t, (marcaSemLinha.get(t) || 0) + 1);
    }
  }
  console.log('por Origem do Rotor:');
  [...porOrigem].sort((a, b) => b[1].n - a[1].n)
    .forEach(([o, x]) => console.log('  ' + o.padEnd(22) + String(x.n).padStart(5) + ' doc(s) · sobra ' + reais(x.c).padStart(14)));
  console.log('Rotor marcado com tabela que NÃO tem linha (nos que não fecham):',
    [...marcaSemLinha].map(([t, n]) => t + ':' + n).join('  ') || 'nenhum');

  // tipos: pelo inicio do historico da 1a linha (ate / : espaco)
  const porTipo = new Map();
  for (const [, d] of abertos) {
    const h = String(d.linhas[0]?.hist || '(sem histórico)').trim();
    const tipo = (h.split(/[\/:]| - /)[0] || h).trim().slice(0, 24) || '(vazio)';
    const x = porTipo.get(tipo) || { n: 0, c: 0, linhas: 0 };
    x.n++; x.c += d.somaSemSaldo; x.linhas += d.linhas.length; porTipo.set(tipo, x);
  }
  console.log('por tipo (início do histórico):');
  [...porTipo].sort((a, b) => b[1].n - a[1].n).slice(0, 25)
    .forEach(([t, x]) => console.log('  ' + t.padEnd(26) + String(x.n).padStart(5) + ' doc(s) · ' + String(x.linhas).padStart(5)
      + ' linha(s) · sobra ' + reais(x.c).padStart(14)));

  // so 1 tabela envolvida? (lancamento de perna unica)
  const umaTabela = abertos.filter(([, d]) => d.tabelas.size === 1).length;
  console.log('dos que não fecham, com linhas em UMA tabela só:', umaTabela);

  console.log('\nexemplos (os 8 primeiros):');
  for (const [k, d] of abertos.slice(0, 8)) {
    const r = rotor.get(k) || {};
    console.log('  Chave ' + k + '  ' + (r.Data ? new Date(r.Data).toISOString().slice(0, 10) : '?')
      + '  Origem=' + (r.Origem || '') + '  marcas A/P/D/R=' + [r.Ativo, r.Passivo, r.Despesas, r.Receitas].join('/')
      + '  sobra ' + reais(d.somaSemSaldo));
    for (const l of d.linhas) {
      console.log('      ' + l.tabela.padEnd(9) + String(l.cta).padEnd(14) + reais(l.c).padStart(13) + '  ' + String(l.hist || '').slice(0, 50));
    }
  }

  // 3) chaves sem Rotor
  const sem = [...docs.keys()].filter(k => !rotor.has(k));
  console.log('\n=== 3) CHAVES DE LINHA SEM DOCUMENTO NO ROTOR ===', sem.length);
  for (const k of sem) {
    const d = docs.get(k);
    console.log('  Chave ' + k + ' · ' + d.linhas.length + ' linha(s) · soma ' + reais(d.soma) + ' · '
      + d.linhas.map(l => l.tabela + ' ' + l.cta).join(', '));
  }
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
