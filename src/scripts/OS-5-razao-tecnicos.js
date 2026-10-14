// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-5-razao-tecnicos.js
// Criado em: 13/10/2026
//
// SO LE. Nao grava nada.
//
// O OS-4 mostrou a LIQUIDACAO da OS no Access:
//   C  (conserto):  Cliente  x  4.03.002.NNN (mao de obra)  [+ 4.02.001.001 / estoque / CPV se usou material]
//   VI (instalacao): 2.06.001.NNN (tecnico)  x  4.03.002.NNN
// Falta ver o resto do caminho da conta do tecnico 2.06.001.NNN: QUEM lanca nela
// alem da liquidacao (a venda do cupom? o pagamento ao tecnico?) e como a 4.03.002
// e zerada/repassada. Este script lista, em forma de RAZAO, todas as boletas da
// plataforma (importadas do Access pelo PLANO-8) que mexem nas contas de tecnico
// 2.06.001.* e de receita de servico 4.03.002.*, a partir de uma data.
// Cada linha: data · boleta · tipo · conta · D/C · valor · historico · outras contas
// do documento (para ver a contrapartida).
//
// Gera tambem OS-5-razao-tecnicos.txt.
//
// Uso:
//   node src\scripts\OS-5-razao-tecnicos.js                    (desde 01/08/2026, todos)
//   node src\scripts\OS-5-razao-tecnicos.js --desde 2026-09-01 --conta 2.06.001.008
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const opc = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const DESDE = new Date((opc('--desde') || '2026-08-01') + 'T00:00:00');
const CONTA = opc('--conta');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const SAIDA = path.join(process.cwd(), 'OS-5-razao-tecnicos.txt');
const ALVO = CONTA ? new RegExp('^' + CONTA.replace(/\./g, '\\.') + '$') : /^(2\.06\.001|4\.03\.002)\./;

const linhas = [];
const out = (...a) => { const t = a.join(' '); console.log(t); linhas.push(t); };
const brl = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  out('Banco:', db.databaseName, '· desde', DESDE.toISOString().slice(0, 10), '· contas', String(ALVO));

  const bs = await db.collection('_boletas').find({
    lojistaId: ARMACAO, status: { $ne: 'CANCELADO' }, data: { $gte: DESDE },
    $or: [{ bancoCodigo: ALVO }, { 'contrapartidas.codigoConta': ALVO }],
  }).sort({ data: 1, codigo: 1 }).toArray();
  out('Boletas:', bs.length);

  // lancamentos com sinal: debito +, credito -
  const porConta = new Map();
  const lanc = [];
  for (const b of bs) {
    const rec = b.tipo !== 'PAGAMENTO';   // RECEBIMENTO / SALDO: perna a debito
    const pernas = [{ conta: b.bancoCodigo, nome: b.bancoNome, v: (rec ? 1 : -1) * Number(b.valorTotal || 0), hist: b.historico }];
    for (const c of b.contrapartidas || []) {
      // RECEBIMENTO: contrapartida positiva = credito; PAGAMENTO: positiva = debito
      pernas.push({ conta: c.codigoConta, nome: c.nomeConta, v: (rec ? -1 : 1) * Number(c.valor || 0), hist: c.historico || b.historico });
    }
    const outras = pernas.map(p => p.conta + ' ' + (p.v >= 0 ? 'D' : 'C') + ' ' + brl(Math.abs(p.v))).join(' | ');
    for (const p of pernas.filter(p => ALVO.test(String(p.conta)))) {
      lanc.push({ b, p, outras });
      const t = porConta.get(p.conta) || { nome: p.nome, d: 0, c: 0, n: 0 };
      if (p.v >= 0) t.d += p.v; else t.c -= p.v;
      t.n++;
      porConta.set(p.conta, t);
    }
  }

  out('\n=== resumo por conta (débito / crédito / saldo) ===');
  [...porConta].sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, t]) =>
    out('  ' + k.padEnd(15) + String(t.nome || '').slice(0, 22).padEnd(23) + String(t.n).padStart(4) + ' lanç.'
      + brl(t.d).padStart(13) + brl(t.c).padStart(13) + brl(t.d - t.c).padStart(13)));

  out('\n=== razão (D = débito, C = crédito) ===');
  for (const { b, p, outras } of lanc) {
    out(b.data.toISOString().slice(0, 10) + ' ' + String(b.codigo).padEnd(11) + String(b.tipo).slice(0, 4) + ' '
      + String(p.conta).padEnd(15) + (p.v >= 0 ? 'D ' : 'C ') + brl(Math.abs(p.v)).padStart(10) + '  '
      + String(p.hist || '').slice(0, 45));
    out('      documento: ' + outras);
  }

  fs.writeFileSync(SAIDA, '\uFEFF' + linhas.join('\r\n'));
  out('\nSaída gravada em:', SAIDA);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
