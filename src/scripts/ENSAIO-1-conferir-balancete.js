// =============================================================================
// Destino: C:\plataformaRota\src\scripts\ENSAIO-1-conferir-balancete.js
// Criado em: 18/10/2026
//
// ENSAIO DO DIA "D" — CONFERE O BALANCETE: Access x plataforma, conta por conta, num mes.
// SO LE (nao grava nada).
//
// Access: as tabelas de lancamento do ano (Contab__Ativo, __Passivo, __Despesas, __Receitas):
//   Cta, M (mes; 0 = abertura), Valor (debito +, credito -). Saldo anterior = M < mes;
//   debito/credito = M = mes. Conta 2.02.xxx vira 2.01.xxx (como no plano novo).
//   (Conferido em 18/10/2026: da exatamente o balancete do Access — ex. Fornecedores out/2026
//    anterior -484.937,64 · debito 126.538,64 · credito -164.180,65 · atual -522.579,65.)
// Plataforma: as boletas ATIVAS ate o fim do mes, com a mesma regra do balancete da tela.
//
// Mostra: o resumo por titulo (x.xx.xxx) e a lista das contas que NAO batem (diferenca maior
// que 1 centavo), com os dois lados. Bateu tudo: "✓ balancete igual ao do Access".
//
// Uso:
//   node src\scripts\ENSAIO-1-conferir-balancete.js --mdb "C:\Armação\Dados\2026BD.mdb" --mes 10
//   opcoes: --grupo 2 (so o Passivo; 1 Ativo, 3 Despesas, 4 Receitas, ou um prefixo: 2.01.001)
//           --ano 2026 (padrao: o ano de hoje)   --todas (lista tambem as que batem)
//
// Alterado em: 19/10/2026 - 1o ensaio: 63 contas diferentes, quase todas por causas conhecidas.
//   Agora o script EXPLICA cada diferenca, documento por documento (Chave do Access x boleta
//   ACC-<Chave>), e separa em causas:
//     A. contrapartida criada na migracao (ajuste de estoque -> perda/sobra): esperado
//     B. documento do Access que nao entrou na plataforma
//     C. boleta feita na plataforma (nao veio do Access): testes -> saem na limpeza
//     D. documento importado com valor diferente do Access: ERRO da importacao (deve ser 0)
//   e diz quantos documentos cairam em outro mes (so troca anterior/mes, nao o saldo).
//   (A inclui a conta de --conta-diferenca, padrao 4.04.001.002, e a conta "0" do Access.)
// Alterado em: 19/10/2026 - 2o ensaio:
//   - receita de OS sem conta no Access (o PLANO-8 manda para 4.03.002.NNN, regra confirmada em
//     08/10) agora conta como A (migracao), nao como erro. O Access deixa essas linhas fora do
//     balancete dele.
//   - documento que no Access esta num mes DEPOIS do conferido (M > --mes) mas cuja data do
//     Rotor cai ate o mes: nova causa E (so data), com o M do Access, em vez de "erro".
//   - coluna do codigo da boleta mais larga.
//   A tabela longa (anterior/debito/credito) agora so com --detalhe. O veredito final e o
//   "resto": diferenca que nenhuma causa explica (tem que dar 0).
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const op = (k, p) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
const MDB = op('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const MES = Number(op('--mes', new Date().getMonth() + 1));
const ANO = Number(op('--ano', new Date().getFullYear()));
const PREF = String(op('--grupo', ''));
const TODAS = args.includes('--todas');
const DETALHE = args.includes('--detalhe') || TODAS;
const PERDA = '3.08.001.001', SOBRA = '4.04.001.001';
const DIFCONTA = String(op('--conta-diferenca', '4.04.001.002'));   // a do PLANO-8 --conta-diferenca
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brl = c => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cent = v => Math.round((Number(v) || 0) * 100);
const conta202 = c => { c = String(c || '').trim(); return c.startsWith('2.02.') ? '2.01.' + c.slice(5) : c; };

(async () => {
  if (!(MES >= 1 && MES <= 12)) throw new Error('--mes de 1 a 12');
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);

  // ---- Access ----
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nomes = reader.getTableNames();
  const acc = new Map();                                     // conta -> { ant, deb, cre } centavos (cre negativo)
  const accDoc = new Map();                                  // Chave -> { m, ajuste, semConta, contas: Map(conta -> centavos) }
  const accFut = new Map();                                  // Chave -> M, dos documentos lancados depois do mes
  for (const g of ['contab__ativo', 'contab__passivo', 'contab__despesas', 'contab__receitas']) {
    const n = nomes.find(x => limpo(x) === g);
    if (!n) { console.log('(sem a tabela ' + g + ')'); continue; }
    for (const l of reader.getTable(n).getData()) {
      const c = conta202(l.Cta), v0 = cent(l.Valor), m0 = Number(l.M) || 0, k0 = String(l.Chave);
      if (m0 > MES) { if (v0) accFut.set(k0, m0); continue; }
      if ((!c || c === '0') && v0) {                         // linha sem conta: fica fora do balancete do Access
        if (!accDoc.has(k0)) accDoc.set(k0, { m: m0, ajuste: true, semConta: false, contas: new Map() });
        accDoc.get(k0).semConta = true;
        if (!/^\s*EstoqueAjuste/i.test(String(l.Hist || ''))) accDoc.get(k0).ajuste = false;
      }
      if (!c || (PREF && !c.startsWith(PREF))) continue;
      const v = v0, m = m0;
      if (!acc.has(c)) acc.set(c, { ant: 0, deb: 0, cre: 0 });
      const x = acc.get(c);
      if (m < MES) x.ant += v; else if (v > 0) x.deb += v; else x.cre += v;
      const k = String(l.Chave);
      if (!accDoc.has(k)) accDoc.set(k, { m, ajuste: true, semConta: false, contas: new Map() });
      const D = accDoc.get(k);
      if (v) D.m = m;
      if (!/^\s*EstoqueAjuste/i.test(String(l.Hist || ''))) D.ajuste = false;
      D.contas.set(c, (D.contas.get(c) || 0) + v);
    }
  }

  // ---- plataforma ----
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Base da plataforma:', db.databaseName, '· Access:', MDB, '· mês', String(MES).padStart(2, '0') + '/' + ANO);
  const ini = new Date(ANO, MES - 1, 1, 0, 0, 0), fim = new Date(ANO, MES, 0, 23, 59, 59, 999);
  const bols = await db.collection('_boletas').find({ status: 'ATIVO', data: { $lte: fim },
    $or: [{ lojistaId: ARMACAO }, { lojistaId: null }, { lojistaId: { $exists: false } }] })
    .project({ tipo: 1, data: 1, valorTotal: 1, bancoCodigo: 1, 'contrapartidas.codigoConta': 1, 'contrapartidas.valor': 1,
      origem: 1, accessChave: 1, codigo: 1, historico: 1, criadoEm: 1 }).toArray();
  const plat = new Map();                                    // conta -> { ant, deb, cre } (cre negativo, como o Access)
  const lanca = (c, d, cr, antes) => {
    if (!c || (PREF && !c.startsWith(PREF))) return;
    if (!plat.has(c)) plat.set(c, { ant: 0, deb: 0, cre: 0 });
    const x = plat.get(c);
    if (antes) x.ant += d - cr; else { x.deb += d; x.cre -= cr; }
  };
  for (const b of bols) {
    const antes = new Date(b.data) < ini;
    if (b.tipo === 'SALDO_TRANSFERIDO') { const v = cent(b.valorTotal); lanca(b.bancoCodigo, v > 0 ? v : 0, v < 0 ? -v : 0, true); continue; }
    const pag = b.tipo === 'PAGAMENTO', V = cent(b.valorTotal);
    lanca(b.bancoCodigo, pag ? 0 : V, pag ? V : 0, antes);
    for (const c of (b.contrapartidas || [])) {
      const v = cent(c.valor);
      let d = pag ? v : 0, cr = pag ? 0 : v;
      if (v < 0) { const t = d; d = -cr; cr = -t; }
      lanca(c.codigoConta, d, cr, antes);
    }
  }
  console.log('Boletas lidas:', bols.length);

  // ---- cada boleta, conta por conta (debito +, credito -, como o Access) ----
  const pernas = b => {
    const r = new Map(), soma = (c, v) => { if (c && (!PREF || c.startsWith(PREF))) r.set(c, (r.get(c) || 0) + v); };
    const V = cent(b.valorTotal);
    if (b.tipo === 'SALDO_TRANSFERIDO') { soma(b.bancoCodigo, V); return r; }
    const pag = b.tipo === 'PAGAMENTO';
    soma(b.bancoCodigo, pag ? -V : V);
    for (const c of (b.contrapartidas || [])) { const v = cent(c.valor); soma(c.codigoConta, pag ? v : -v); }
    return r;
  };
  const platDoc = new Map(), soPlat = [];                    // Chave -> { m, contas } · boletas sem Chave
  for (const b of bols) {
    const p = pernas(b);
    if (b.origem === 'ACCESS' && b.accessChave != null) {
      const k = String(b.accessChave);
      const dt = new Date(b.data);
      if (!platDoc.has(k)) platDoc.set(k, { m: b.tipo === 'SALDO_TRANSFERIDO' || dt.getFullYear() < ANO ? 0 : dt.getMonth() + 1, contas: new Map() });
      const D = platDoc.get(k);
      for (const [c, v] of p) D.contas.set(c, (D.contas.get(c) || 0) + v);
    } else soPlat.push({ b, p });
  }

  // ---- comparar ----
  const todas = [...new Set([...acc.keys(), ...plat.keys()])].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const zero = { ant: 0, deb: 0, cre: 0 };
  const atual = x => x.ant + x.deb + x.cre;
  const titulos = new Map(), difs = [];
  for (const c of todas) {
    const a = acc.get(c) || zero, p = plat.get(c) || zero;
    if (!a.ant && !a.deb && !a.cre && !p.ant && !p.deb && !p.cre) continue;
    const t = c.split('.').slice(0, 3).join('.');
    if (!titulos.has(t)) titulos.set(t, { a: { ant: 0, deb: 0, cre: 0 }, p: { ant: 0, deb: 0, cre: 0 } });
    const T = titulos.get(t);
    for (const k of ['ant', 'deb', 'cre']) { T.a[k] += a[k]; T.p[k] += p[k]; }
    const ok = ['ant', 'deb', 'cre'].every(k => Math.abs(a[k] - p[k]) <= 1);
    if (!ok || TODAS) difs.push({ c, a, p, ok });
  }

  const col = (v, w) => brl(v).padStart(w || 15);
  console.log('\nRESUMO POR TÍTULO (Access | plataforma) — saldo atual');
  console.log('título'.padEnd(12) + 'Access'.padStart(16) + 'plataforma'.padStart(16) + 'diferença'.padStart(15));
  for (const [t, T] of titulos) {
    const d = atual(T.p) - atual(T.a);
    console.log(t.padEnd(12) + col(atual(T.a), 16) + col(atual(T.p), 16) + (Math.abs(d) > 1 ? col(d) + '  ✗' : '            ✓'));
  }

  // ---- DE ONDE VEM CADA DIFERENCA (documento por documento, saldo atual) ----
  const causa = { A: new Map(), B: new Map(), C: new Map(), D: new Map(), E: new Map() };
  const poe = (q, c, v) => { if (v) causa[q].set(c, (causa[q].get(c) || 0) + v); };
  const faltam = [], errados = [];
  let outroMes = 0, docsA = 0;
  const osSemConta = new Set(), futuros = [];
  for (const [k, A] of accDoc) {
    if (![...A.contas.values()].some(v => v)) continue;      // documento zerado
    const P = platDoc.get(k);
    if (!P) {                                                // B: nao entrou
      for (const [c, v] of A.contas) poe('B', c, -v);
      faltam.push({ k, A }); continue;
    }
    if (P.m !== A.m) outroMes++;
    let errou = [];
    for (const c of new Set([...A.contas.keys(), ...P.contas.keys()])) {
      const d = (P.contas.get(c) || 0) - (A.contas.get(c) || 0);
      if (Math.abs(d) < 1) continue;
      if (A.ajuste && (c === PERDA || c === SOBRA)) { poe('A', c, d); continue; }
      if (P.contas.has(DIFCONTA) && (c === DIFCONTA || c === '0' || c === '')) { poe('A', c, d); continue; }
      if (A.semConta && (c.startsWith('4.03.002.') || c === '0')) { poe('A', c, d); osSemConta.add(k); continue; }
      poe('D', c, d); errou.push({ c, a: A.contas.get(c) || 0, p: P.contas.get(c) || 0 });
    }
    if ((A.ajuste && (P.contas.has(PERDA) || P.contas.has(SOBRA))) || P.contas.has(DIFCONTA) || osSemConta.has(k)) docsA++;
    if (errou.length) errados.push({ k, errou });
  }
  for (const [k, P] of platDoc) if (!accDoc.has(k)) {        // boleta ACC- sem documento no Access (ate o mes)
    if (accFut.has(k)) {                                     // E: no Access esta num mes depois do conferido
      for (const [c, v] of P.contas) poe('E', c, v);
      futuros.push({ k, M: accFut.get(k), P }); continue;
    }
    for (const [c, v] of P.contas) poe('D', c, v);
    errados.push({ k, errou: [...P.contas].map(([c, v]) => ({ c, a: 0, p: v })) });
  }
  for (const { p } of soPlat) for (const [c, v] of p) poe('C', c, v);

  const somaQ = q => [...causa[q].values()].reduce((t, v) => t + v, 0);
  const linhaQ = (q, max) => [...causa[q]].filter(([, v]) => Math.abs(v) >= 1).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, max || 6).map(([c, v]) => c + ' ' + brl(v)).join(' · ');
  console.log('\nDE ONDE VÊM AS DIFERENÇAS (plataforma − Access, saldo atual)');
  console.log('A. contrapartida criada na migração: ' + docsA + ' doc(s) — ESPERADO');
  console.log('     ' + linhaQ('A'));
  console.log('     (ajuste de estoque com uma perna só; documentos que o Access deixou sem fechar → ' + DIFCONTA + ';');
  console.log('      receita de OS sem conta no Access → 4.03.002.NNN: ' + osSemConta.size + ' doc(s); na plataforma toda boleta fecha)');
  console.log('B. documentos do Access que NÃO entraram: ' + faltam.length + (faltam.length ? ' — Chaves ' + faltam.map(f => f.k).join(', ') : ''));
  if (faltam.length) console.log('     ' + linhaQ('B'));
  console.log('C. boletas feitas na PLATAFORMA (não vieram do Access): ' + soPlat.length + (soPlat.length ? ' — testes: saem na limpeza' : ''));
  if (soPlat.length) {
    const porTipo = new Map();
    for (const { b } of soPlat) { const t = (b.origem || '(sem origem)') + ' / ' + b.tipo; const x = porTipo.get(t) || { n: 0, v: 0 }; x.n++; x.v += cent(b.valorTotal); porTipo.set(t, x); }
    for (const [t, x] of porTipo) console.log('     ' + t.padEnd(34) + String(x.n).padStart(4) + '  R$ ' + brl(x.v));
    console.log('     data        código                      tipo          banco/perna     valor  histórico');
    for (const { b } of soPlat.slice().sort((x, y) => new Date(x.data) - new Date(y.data)).slice(0, 150)) {
      const d = new Date(b.data);
      console.log('     ' + d.toLocaleDateString('pt-BR').padEnd(12) + String(b.codigo || '').padEnd(28).slice(0, 27).padEnd(28) + String(b.tipo || '').padEnd(14).slice(0, 14)
        + String(b.bancoCodigo || '').padEnd(14) + brl(cent(b.valorTotal)).padStart(11) + '  ' + String(b.historico || '').slice(0, 40));
    }
    if (soPlat.length > 150) console.log('     … e mais ' + (soPlat.length - 150));
  }
  console.log('D. documentos importados DIFERENTES do Access: ' + errados.length + (errados.length ? '  ✗ ERRO DA IMPORTAÇÃO' : '  ✓'));
  for (const e of errados.slice(0, 60)) {
    console.log('     Chave ' + e.k + ': ' + e.errou.map(x => x.c + ' Access ' + brl(x.a) + ' plat ' + brl(x.p)).join(' · '));
  }
  console.log('E. documentos que no Access estão num mês DEPOIS de ' + MES + ' (data do Rotor até ' + MES + '): ' + futuros.length + (futuros.length ? ' — só data' : ''));
  for (const f of futuros.slice(0, 40)) console.log('     Chave ' + f.k + ' (Access M=' + f.M + ', plataforma mês ' + f.P.m + '): ' + [...f.P.contas].map(([c, v]) => c + ' ' + brl(v)).join(' · '));
  console.log('Documentos em outro mês (data do Rotor ≠ mês do Access): ' + outroMes + ' — só troca "anterior"/"mês", o saldo não muda');

  // ---- conta por conta: a diferenca e as causas ----
  const ruins = difs.filter(x => !x.ok);
  const linhas = ruins.map(x => {
    const d = atual(x.p) - atual(x.a), q = {};
    for (const k of ['A', 'B', 'C', 'D', 'E']) q[k] = causa[k].get(x.c) || 0;
    return { c: x.c, d, q, resto: d - q.A - q.B - q.C - q.D - q.E, x };
  });
  console.log('\nCONTAS QUE NÃO BATEM: ' + ruins.length + ' — saldo atual, por causa');
  console.log('conta'.padEnd(15) + 'diferença'.padStart(14) + 'A migração'.padStart(14) + 'B não entrou'.padStart(14) + 'C plataforma'.padStart(14) + 'D erro'.padStart(12) + 'E data'.padStart(12) + 'resto'.padStart(11));
  for (const l of linhas) {
    const f = (v, w) => (Math.abs(v) < 1 ? '·' : brl(v)).padStart(w);
    console.log(l.c.padEnd(15) + f(l.d, 14) + f(l.q.A, 14) + f(l.q.B, 14) + f(l.q.C, 14) + f(l.q.D, 12) + f(l.q.E, 12) + f(l.resto, 11) + (Math.abs(l.resto) >= 1 || Math.abs(l.q.D) >= 1 ? '  ✗' : ''));
  }
  const semExplicar = linhas.filter(l => Math.abs(l.resto) >= 1);

  if (DETALHE && difs.length) {
    console.log('\nDETALHE (anterior / débito / crédito do mês)');
    console.log('conta'.padEnd(15) + 'lado'.padEnd(6) + 'anterior'.padStart(15) + 'débito'.padStart(15) + 'crédito'.padStart(15) + 'atual'.padStart(15));
    for (const x of difs.slice(0, 300)) {
      console.log(x.c.padEnd(15) + 'Acc'.padEnd(6) + col(x.a.ant) + col(x.a.deb) + col(x.a.cre) + col(atual(x.a)) + (x.ok ? '  ✓' : ''));
      if (!x.ok) {
        console.log(''.padEnd(15) + 'Plat'.padEnd(6) + col(x.p.ant) + col(x.p.deb) + col(x.p.cre) + col(atual(x.p)));
        console.log(''.padEnd(15) + 'dif'.padEnd(6) + col(x.p.ant - x.a.ant) + col(x.p.deb - x.a.deb) + col(x.p.cre - x.a.cre) + col(atual(x.p) - atual(x.a)) + '  ✗');
      }
    }
    if (difs.length > 300) console.log('… e mais ' + (difs.length - 300));
  }

  console.log('\nVEREDITO');
  if (!ruins.length) console.log('✓ balancete igual ao do Access' + (PREF ? ' (' + PREF + ')' : '') + '.');
  else {
    console.log('  A migração (esperado) ......... ' + brl(somaQ('A')));
    console.log('  B não entraram ................ ' + faltam.length + ' doc(s)');
    console.log('  C feitas na plataforma ........ ' + soPlat.length + ' boleta(s)');
    console.log('  D importadas diferente ........ ' + errados.length + ' doc(s)');
    console.log('  E Access em mês posterior ..... ' + futuros.length + ' doc(s)');
    console.log('  contas sem explicação (resto) . ' + semExplicar.length);
    console.log(!errados.length && !semExplicar.length
      ? (faltam.length || soPlat.length ? '✓ a importação está fiel ao Access. Falta: ' + [faltam.length ? 'B (fazer entrar)' : '', soPlat.length ? 'C (limpar os testes)' : ''].filter(Boolean).join(' e ') + '.'
                                         : '✓ a importação está fiel ao Access: só a diferença esperada da migração (A).')
      : '✗ há diferença que não é das causas conhecidas: me mande esta saída.');
  }
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
