// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-12-contas-novas-do-access.js
// Criado em: 31/10/2026 (simulacao do dia D)
//
// CONTAS NOVAS DO ACCESS que ainda nao estao no plano da plataforma (_contasubtitulos).
// Achado na simulacao de 31/10: a conta 2.03.001.025 "Otávio Lessa" foi criada no Access em 21/10 e nao
// existia aqui; o PLANO-8 importou os lancamentos dela (Chaves 8636 e 8638, R$ 25.000,00) mas a conta
// ficou com 0 (o ENSAIO-1 acusou "D. importados diferente").
//
// Le o espelho do plano do Access (_access_contab_ctastitulossub, gravado pelo PLANO-2) e compara com o
// plano da plataforma. Fornecedor 2.02.* do Access e 2.01.* aqui (mesma regra do PLANO-8).
// Para cada conta que falta: copia os campos de uma conta IRMA (mesmo titulo, a ultima) e troca so
// codigo, nome e datas. Conta sem irma (titulo inteiro novo) so aparece na lista: nao e criada.
// Nao apaga nem altera nada: so inclui.
//
// Uso (um comando por vez):
//   node src\scripts\PLANO-12-contas-novas-do-access.js                                simulacao (mostra a conta como fica)
//   node src\scripts\PLANO-12-contas-novas-do-access.js --aplicar --base rotaes_ensaio
// Depois: PLANO-8-importar-lancamentos de novo (refaz as boletas do Access) e ENSAIO-1.
// =============================================================================
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const op = k => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const APLICAR = args.includes('--aplicar');
const BASE = op('--base');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const LOJA = { $in: [ARMACAO, String(ARMACAO)] };
const daPlataforma = c => String(c || '').trim().replace(/^2\.02\./, '2.01.');   // fornecedor 2.02 -> 2.01
const tituloDe = c => c.split('.').slice(0, 3).join('.');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const nomeBase = db.databaseName;
  console.log('Base:', nomeBase, APLICAR ? '· APLICAR' : '· simulação');
  if (APLICAR && BASE !== nomeBase) throw new Error('para gravar diga a base: --base ' + nomeBase);

  const esp = await db.collection('_access_contab_ctastitulossub').find({}).toArray();
  if (!esp.length) throw new Error('espelho do plano vazio: rode o PLANO-2-espelho-access antes');
  const SUB = db.collection('_contasubtitulos');
  const temLoja = await SUB.countDocuments({ lojistaId: LOJA }) > 0;
  const filtroLoja = temLoja ? { lojistaId: LOJA } : {};
  const existentes = new Set((await SUB.find(filtroLoja).project({ codigo: 1 }).toArray()).map(d => String(d.codigo)));

  const faltam = [];
  for (const e of esp) {
    const cod = daPlataforma(e.NrSubCtasTitulos);
    if (!/^\d\.\d{2}\.\d{3}\.\d{3}$/.test(cod) || existentes.has(cod)) continue;
    faltam.push({ codigo: cod, nome: String(e.NmSubCtasTitulos || '').trim(), data: e.Data || null, origem: e.NrSubCtasTitulos });
  }
  faltam.sort((a, b) => a.codigo.localeCompare(b.codigo));
  console.log('\nContas no Access: ' + esp.length + ' · no plano da plataforma: ' + existentes.size + ' · faltam: ' + faltam.length);

  const novas = [], semIrma = [];
  for (const f of faltam) {
    const irma = await SUB.find({ ...filtroLoja, codigo: { $regex: '^' + tituloDe(f.codigo).replace(/\./g, '\\.') + '\\.' } })
      .sort({ codigo: -1 }).limit(1).next();
    if (!irma) { semIrma.push(f); continue; }
    const { _id, ...base } = irma;
    const doc = { ...base, codigo: f.codigo, nome: f.nome || f.codigo, criadoEm: new Date(), atualizadoEm: new Date(), origem: 'ACCESS',
                  criadaPor: 'PLANO-12', dataAccess: f.data };
    if ('ativo' in base) doc.ativo = true;
    if ('suspensa' in base) doc.suspensa = false;
    novas.push({ f, irma, doc });
  }
  for (const n of novas) console.log('  + ' + n.f.codigo.padEnd(14) + (n.f.nome || '').padEnd(40).slice(0, 40) + '  (copia da ' + n.irma.codigo + ' ' + (n.irma.nome || '') + ')'
    + (n.f.origem !== n.f.codigo ? '  [Access ' + n.f.origem + ']' : ''));
  for (const s of semIrma) console.log('  ? ' + s.codigo.padEnd(14) + (s.nome || '') + '  — título sem nenhuma conta na plataforma: NÃO criada (me avise)');

  if (novas.length) {
    // a primeira, inteira, para conferir os campos copiados da irma
    const ex = { ...novas[0].doc };
    console.log('\nComo fica a ' + ex.codigo + ' (confira os campos; os que vieram da irmã ' + novas[0].irma.codigo + ' e não são dela, me avise):');
    for (const [k, v] of Object.entries(ex)) console.log('    ' + k.padEnd(22) + ' = ' + (v instanceof Date ? v.toISOString() : JSON.stringify(v)));
  }

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar --base ' + nomeBase); await mongoose.disconnect(); return; }
  if (novas.length) {
    const r = await SUB.insertMany(novas.map(n => n.doc), { ordered: false });
    console.log('\n✓ contas criadas: ' + r.insertedCount);
  } else console.log('\nNada a criar.');
  console.log('Agora: PLANO-8-importar-lancamentos de novo e o ENSAIO-1.');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
