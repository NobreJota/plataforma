// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-2-espelho-access.js
// Criado em: 02/10/2026
//
// ESPELHO: copia do Access para a plataforma, DO JEITO QUE ESTAO, as tabelas
// do plano de contas e dos lancamentos:
//
//   Contab_CtasTitulos       -> _access_contab_ctastitulos
//   Contab_CtasTitulosSub    -> _access_contab_ctastitulossub
//   Contab__Rotor            -> _access_contab_rotor        (o documento)
//   Contab__Ativo            -> _access_contab_ativo        (as linhas)
//   Contab__Passivo          -> _access_contab_passivo
//   Contab__Despesas         -> _access_contab_despesas
//   Contab__Receitas         -> _access_contab_receitas
//
// NAO mexe no plano novo (_contasubtitulos etc.) nem cria boleta. E a base da
// importacao do plano e dos lancamentos, que vem depois.
// Cada --aplicar refaz o espelho inteiro (apaga o desta empresa e copia de novo).
//
// Tambem responde: o que o Access tem em 2.01, se o numero dos fornecedores
// (2.02 -> 2.01) se choca com ele, e quantos lancamentos usam 2.01 e 2.02.
//
// Uso (um comando por vez):
//   node src/scripts/PLANO-2-espelho-access.js
//   node src/scripts/PLANO-2-espelho-access.js --aplicar
// Opcoes: --mdb "C:\Armação\Dados\2026B\2026B.mdb"   --lojista <id>
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const args = process.argv.slice(2);
const opcao = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };
const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');

const TABELAS = [
  'Contab_CtasTitulos', 'Contab_CtasTitulosSub',
  'Contab__Rotor', 'Contab__Ativo', 'Contab__Passivo', 'Contab__Despesas', 'Contab__Receitas',
];

const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const colecaoDe = t => '_access_' + semAcento(t).toLowerCase().replace(/_+/g, '_');
const RX_CONTA = /^\d\.\d{2}\.\d{3}\.\d{3,4}$/;
const RX_TITULO = /^\d\.\d{2}\.\d{3}$/;
const secao = t => console.log('\n' + '='.repeat(74) + '\n' + t + '\n' + '='.repeat(74));

// chave de documento no Mongo nao pode ter "." nem comecar com "$"
const chave = k => String(k).replace(/\./g, '_').replace(/^\$/, '_');

(async function () {
  const aplicar = args.includes('--aplicar');
  const reader = new MDBReader(fs.readFileSync(MDB));
  const todas = reader.getTableNames();
  const achar = n => todas.find(t => t === n) || todas.find(t => semAcento(t).toLowerCase() === semAcento(n).toLowerCase());

  const lidas = [];
  secao('Tabelas');
  for (const nome of TABELAS) {
    const real = achar(nome);
    if (!real) { console.log('  ' + nome.padEnd(24) + 'NAO ENCONTRADA'); continue; }
    const t = reader.getTable(real);
    const cols = t.getColumnNames();
    const dados = t.getData();
    // coluna(s) com codigo de conta (pelo formato), para a analise do 2.01
    const contaCols = cols.filter(c => dados.slice(0, 2000).some(l => RX_CONTA.test(String(l[c] ?? '').trim()) || RX_TITULO.test(String(l[c] ?? '').trim())));
    lidas.push({ nome: real, colecao: colecaoDe(real), cols, dados, contaCols });
    console.log('  ' + real.padEnd(24) + String(dados.length).padStart(8) + ' linhas  -> ' + colecaoDe(real));
    console.log('      colunas: ' + cols.join(', '));
    console.log('      com codigo de conta: ' + (contaCols.join(', ') || '(nenhuma)'));
  }

  // ---- analise do 2.01 ------------------------------------------------------------
  secao('2.01 no Access (fornecedores 2.02 vao para 2.01)');
  const plano = lidas.filter(l => /ctastitulos/i.test(semAcento(l.nome)));
  for (const p of plano) {
    for (const c of p.contaCols) {
      const em201 = p.dados.filter(l => String(l[c] ?? '').trim().startsWith('2.01.'));
      const em202 = p.dados.filter(l => String(l[c] ?? '').trim().startsWith('2.02.'));
      console.log(p.nome + ' (' + c + '): em 2.01 = ' + em201.length + ' | em 2.02 = ' + em202.length);
      em201.slice(0, 15).forEach(l => console.log('    2.01: ' + JSON.stringify(l)));
      if (em201.length) {
        const s201 = new Set(em201.map(l => String(l[c]).trim()));
        const choque = em202.map(l => String(l[c]).trim()).filter(x => s201.has('2.01.' + x.slice(5)));
        console.log('    numeros 2.02 que, trocados para 2.01, ja existem: ' + choque.length + (choque.length ? '  ex.: ' + choque.slice(0, 8).join(', ') : ''));
      }
    }
  }
  console.log('\nLancamentos por grupo de conta:');
  for (const l of lidas.filter(x => !/ctastitulos/i.test(semAcento(x.nome)))) {
    for (const c of l.contaCols) {
      const cont = { '2.01': 0, '2.02': 0 };
      for (const r of l.dados) {
        const v = String(r[c] ?? '').trim();
        if (v.startsWith('2.01.')) cont['2.01']++;
        else if (v.startsWith('2.02.')) cont['2.02']++;
      }
      console.log('  ' + (l.nome + '.' + c).padEnd(36) + 'usa 2.01: ' + String(cont['2.01']).padStart(6) + '   usa 2.02: ' + String(cont['2.02']).padStart(6));
    }
  }

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // ---- aplicar ------------------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);
  const agora = new Date();

  secao('Gravando o espelho');
  for (const l of lidas) {
    const col = db.collection(l.colecao);
    const fora = await col.deleteMany({ lojistaId });
    let n = 0;
    for (let i = 0; i < l.dados.length; i += 2000) {
      const lote = l.dados.slice(i, i + 2000).map(r => {
        const d = { lojistaId, _importadoEm: agora };
        for (const [k, v] of Object.entries(r)) d[chave(k)] = v;
        return d;
      });
      if (lote.length) n += (await col.insertMany(lote, { ordered: false })).insertedCount;
    }
    for (const c of l.contaCols) await col.createIndex({ lojistaId: 1, [chave(c)]: 1 });
    console.log('  ' + l.colecao.padEnd(32) + 'apagados ' + String(fora.deletedCount).padStart(7) + ' | copiados ' + String(n).padStart(7));
  }
  console.log('\nEspelho pronto. Nada do plano novo foi alterado.');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
