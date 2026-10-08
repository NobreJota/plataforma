// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-5-inspecionar-lancamentos.js
// Criado em: 08/10/2026
// Alterado em: 08/10/2026 - campos vistos na 1a rodada: as linhas tem Chave (liga ao Rotor),
//   M, Cta (conta), Valor (TEXTO, "600.0000"), Hist, Cc (despesas), Transfer, Codigo.
//   Agora usa esses nomes; a data vem do Rotor pela Chave. Mostra tambem M, Transfer e Cc.
// Alterado em 08/10/2026 - pelo Access: M = mes; Status 'd' = registro DELETADO (no Rotor e
//   nas linhas). Mostra Status/Status1/Conciliado das linhas e Status/Origem do Rotor, e
//   confere o fechamento SO com o que nao esta deletado.
//
// SO LE. Nao grava nada.
//
// Antes de importar os lancamentos antigos (para o balancete), mostra como o
// espelho do Access ficou no banco (PLANO-2):
//   _access_contab_rotor      o documento (chave + data)
//   _access_contab_ativo / _passivo / _despesas / _receitas   as linhas
//
// Para cada colecao: quantos documentos, os campos e 2 exemplos. Depois tenta
// achar, sem presumir nomes: o campo que liga a linha ao Rotor, o campo da
// conta (cara de 1.01.002.003), o do valor e o da data. Com isso confere se cada
// documento fecha em zero (debito + / credito -), o periodo, e quais contas nao
// existem no plano (trocando 2.02 por 2.01, como ficou combinado).
//
// Uso:
//   node src\scripts\PLANO-5-inspecionar-lancamentos.js
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const LINHAS = ['_access_contab_ativo', '_access_contab_passivo', '_access_contab_despesas', '_access_contab_receitas'];
const CONTA = /^\d\.\d{2}\.\d{3}(\.\d{3,4})?$/;

const curto = v => v instanceof Date ? v.toISOString().slice(0, 10)
  : (v && typeof v === 'object' && v._bsontype === 'ObjectId') ? 'ObjectId(' + String(v) + ')'
  : JSON.stringify(v)?.slice(0, 40);

function mostrar(nome, docs, total) {
  console.log('\n=== ' + nome + ' ===  ' + total + ' documentos');
  if (!docs.length) return;
  const campos = new Map();
  for (const d of docs) for (const [k, v] of Object.entries(d)) {
    if (!campos.has(k)) campos.set(k, new Set());
    campos.get(k).add(v === null ? 'null' : v instanceof Date ? 'data' : typeof v === 'object' ? (v._bsontype || 'objeto') : typeof v);
  }
  console.log('campos:', [...campos].map(([k, t]) => k + '(' + [...t].join('/') + ')').join('  '));
  for (const d of docs.slice(0, 2)) {
    console.log('  exemplo:', Object.entries(d).filter(([k]) => k !== '__v').map(([k, v]) => k + '=' + curto(v)).join('  '));
  }
}

// o campo que mais parece X numa amostra
function achar(docs, teste) {
  const conta = {};
  for (const d of docs) for (const [k, v] of Object.entries(d)) if (teste(v, k)) conta[k] = (conta[k] || 0) + 1;
  return Object.entries(conta).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName);

  // ---- Rotor ----
  const rotorCol = db.collection('_access_contab_rotor');
  const rotorAm = await rotorCol.find({}).limit(300).toArray();
  mostrar('_access_contab_rotor', rotorAm, await rotorCol.countDocuments({}));

  // ---- linhas ----
  const amostras = {};
  for (const n of LINHAS) {
    const c = db.collection(n);
    amostras[n] = await c.find({}).limit(300).toArray();
    mostrar(n, amostras[n], await c.countDocuments({}));
  }
  const todasAm = LINHAS.flatMap(n => amostras[n]);
  if (!todasAm.length) { console.log('\nNenhuma linha no espelho. Rode o PLANO-2 antes.'); return; }

  // ---- campos conhecidos (1a rodada) ----
  const campoConta = 'Cta', campoValor = 'Valor', chave = 'Chave';
  const numero = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  // data: no Rotor, pela Chave (o campo de data do Rotor que nao e o _importadoEm)
  const campoDataRotor = achar(rotorAm, (v, k) => v instanceof Date && k !== '_importadoEm');
  console.log('\n--- campos usados ---');
  console.log('linha: chave=Chave · conta=Cta · valor=Valor (texto → número)');
  console.log('Rotor: chave=Chave · data=' + campoDataRotor);
  const dataDoc = new Map();
  const rotorDel = new Set();
  const distRotor = { Status: new Map(), Origem: new Map() };
  for await (const r of rotorCol.find({}).project({ Chave: 1, Status: 1, Origem: 1, [campoDataRotor || 'Data']: 1 })) {
    dataDoc.set(String(r.Chave), r[campoDataRotor || 'Data']);
    const st = String(r.Status ?? '').trim().toLowerCase();
    if (st === 'd') rotorDel.add(String(r.Chave));
    distRotor.Status.set(st || '(vazio)', (distRotor.Status.get(st || '(vazio)') || 0) + 1);
    const o = String(r.Origem ?? '').trim() || '(vazio)';
    distRotor.Origem.set(o, (distRotor.Origem.get(o) || 0) + 1);
  }
  console.log('documentos no Rotor:', dataDoc.size, '· deletados (Status d):', rotorDel.size);

  // ---- totais, periodo e fechamento por documento ----
  const porDoc = new Map();
  const contasUsadas = new Map();
  const semRotor = new Set();
  const dist = { M: new Map(), Transfer: new Map(), Cc: new Map(), Status: new Map(), Status1: new Map(), Conciliado: new Map() };
  const porDocVivo = new Map();
  let linhasDel = 0;
  const conta1 = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  let linhasTotal = 0, menor = null, maior = null, soma = 0;
  const porTabela = {};
  for (const n of LINHAS) {
    porTabela[n] = { linhas: 0, debito: 0, credito: 0 };
    for await (const d of db.collection(n).find({})) {
      linhasTotal++;
      const c = Math.round(numero(d[campoValor]) * 100);
      soma += c;
      porTabela[n].linhas++;
      if (c > 0) porTabela[n].debito += c; else porTabela[n].credito -= c;
      let conta = String(d[campoConta] || '').trim();
      if (conta.startsWith('2.02.')) conta = '2.01.' + conta.slice(5);
      conta1(contasUsadas, conta);
      const k = String(d[chave]);
      porDoc.set(k, (porDoc.get(k) || 0) + c);
      if (!dataDoc.has(k)) semRotor.add(k);
      conta1(dist.M, d.M); conta1(dist.Transfer, d.Transfer);
      conta1(dist.Status, d.Status ?? '(vazio)'); conta1(dist.Status1, d.Status1 ?? '(vazio)'); conta1(dist.Conciliado, d.Conciliado ?? '(vazio)');
      const deletada = String(d.Status ?? '').trim().toLowerCase() === 'd' || rotorDel.has(k);
      if (deletada) linhasDel++;
      else porDocVivo.set(k, (porDocVivo.get(k) || 0) + c);
      if (n.endsWith('despesas')) conta1(dist.Cc, d.Cc);
      const dt = dataDoc.get(k);
      if (dt instanceof Date) { if (!menor || dt < menor) menor = dt; if (!maior || dt > maior) maior = dt; }
    }
  }
  console.log('\n--- linhas ---');
  for (const [n, t] of Object.entries(porTabela)) {
    console.log('  ' + n.padEnd(26) + String(t.linhas).padStart(6) + ' linhas · débito ' + (t.debito / 100).toFixed(2).padStart(14)
      + ' · crédito ' + (t.credito / 100).toFixed(2).padStart(14));
  }
  console.log('total de linhas:', linhasTotal, '· contas diferentes:', contasUsadas.size,
    '· soma geral (deve dar 0):', (soma / 100).toFixed(2));
  if (menor) console.log('período (data do Rotor):', curto(menor), 'a', curto(maior));
  console.log('chaves de linha sem documento no Rotor:', semRotor.size, [...semRotor].slice(0, 10).join(', '));
  const abertos = [...porDoc].filter(([, c]) => c !== 0);
  console.log('documentos (todos):', porDoc.size, '· que NÃO fecham em zero:', abertos.length);
  const abertosVivos = [...porDocVivo].filter(([, c]) => c !== 0);
  console.log('linhas deletadas (Status d na linha ou no Rotor):', linhasDel);
  console.log('documentos SEM os deletados:', porDocVivo.size, '· que NÃO fecham em zero:', abertosVivos.length);
  abertosVivos.slice(0, 15).forEach(([k, c]) => console.log('   Chave', k, '→ sobra', (c / 100).toFixed(2)));
  const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => String(k) + ':' + v).join('  ');
  console.log('valores de M ........', top(dist.M));
  console.log('valores de Transfer .', top(dist.Transfer));
  console.log('valores de Cc (desp.)', top(dist.Cc));
  console.log('linha Status .........', top(dist.Status));
  console.log('linha Status1 ........', top(dist.Status1));
  console.log('linha Conciliado .....', top(dist.Conciliado));
  console.log('Rotor Status .........', top(distRotor.Status));
  console.log('Rotor Origem .........', top(distRotor.Origem));

  // ---- contas que nao existem no plano ----
  const plano = new Set((await db.collection('_contasubtitulos').find({ lojistaId: ARMACAO })
    .project({ codigo: 1 }).toArray()).map(c => c.codigo));
  const faltam = [...contasUsadas].filter(([c]) => c && !plano.has(c)).sort((a, b) => b[1] - a[1]);
  console.log('\n--- contas usadas que NÃO estão no plano (já com 2.02 → 2.01) ---');
  console.log('total:', faltam.length);
  faltam.slice(0, 40).forEach(([c, n]) => console.log('   ', c.padEnd(16), n + ' linha(s)'));
  if (faltam.length > 40) console.log('    … e mais', faltam.length - 40);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
