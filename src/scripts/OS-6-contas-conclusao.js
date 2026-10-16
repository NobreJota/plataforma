// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-6-contas-conclusao.js
// Criado em: 15/10/2026
//
// SO LE. Nao grava nada.
//
// Antes de montar a CONCLUSAO DA OS (pagina nova), conferir no plano de contas as
// contas que ela vai usar:
//   - 3.06.006.004  Serv. Mat Complementares (consignado usado e NAO cobrado, a custo)
//   - 2.06...       onde fica a conta de ESPERA da mao de obra (cobrada na nota, dividida
//                   entre empresa e tecnico so na conclusao da OS): lista o que existe em
//                   2.06 para escolher um codigo livre
//   - 4.05.001.001, 1.02.001.001 (estoque), 3.05.001.001 (CPV), 4.02.001.001
//
// Gera tambem OS-6-contas-conclusao.txt (para me mandar).
//
// Uso:
//   node src\scripts\OS-6-contas-conclusao.js
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const SAIDA = path.join(process.cwd(), 'OS-6-contas-conclusao.txt');

const linhas = [];
const out = (...a) => { const t = a.join(' '); console.log(t); linhas.push(t); };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  out('Banco:', db.databaseName, '·', new Date().toLocaleString('pt-BR'));

  // subgrupo pode nao ter lojistaId (plano comum); titulo e subtitulo: com e sem
  const lista = async (col, rx) => {
    const com = await db.collection(col).find({ codigo: rx, lojistaId: ARMACAO }).sort({ codigo: 1 }).toArray();
    return com.length ? com : db.collection(col).find({ codigo: rx }).sort({ codigo: 1 }).toArray();
  };
  const desc = d => d.codigo + '  ' + (d.nome || '') + (d.ativo === false ? '  [INATIVA]' : '')
    + (d.natureza ? '  (' + d.natureza + ')' : '');

  out('\n== CONTAS QUE A CONCLUSAO DA OS VAI USAR ==');
  for (const cod of ['3.06.006.004', '4.05.001.001', '1.02.001.001', '3.05.001.001', '4.02.001.001']) {
    const d = (await lista('_contasubtitulos', cod))[0];
    out('  ' + (d ? 'OK     ' + desc(d) : 'FALTA  ' + cod));
  }

  out('\n== 3.06 (subgrupo, titulos e subtitulos) ==');
  for (const d of await lista('subgrupos', /^3\.06$/)) out('  subgrupo  ' + desc(d));
  for (const d of await lista('_contatitulos', /^3\.06\./)) out('  titulo    ' + desc(d));
  for (const d of await lista('_contasubtitulos', /^3\.06\.006\./)) out('  subtitulo ' + desc(d));

  out('\n== 2.06 (onde ficaria a conta de ESPERA da mao de obra) ==');
  for (const d of await lista('subgrupos', /^2\.06$/)) out('  subgrupo  ' + desc(d));
  for (const d of await lista('_contatitulos', /^2\.06\./)) out('  titulo    ' + desc(d));
  const subs = await lista('_contasubtitulos', /^2\.06\./);
  const fora = subs.filter(d => !d.codigo.startsWith('2.06.001.'));
  out('  subtitulos 2.06.001.*: ' + (subs.length - fora.length) + ' (tecnicos)');
  for (const d of fora) out('  subtitulo ' + desc(d));

  out('\n== 2.07 a 2.09 (titulos, para comparar) ==');
  for (const d of await lista('_contatitulos', /^2\.0[7-9]\./)) out('  titulo    ' + desc(d));

  fs.writeFileSync(SAIDA, linhas.join('\r\n'), 'utf8');
  out('\nGravado: ' + SAIDA);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
