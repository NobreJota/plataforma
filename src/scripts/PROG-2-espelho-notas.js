// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PROG-2-espelho-notas.js
// Criado em: 20/10/2026 — PROGRAMACAO DE COMPRAS (1o passo)
//
// ESPELHO, na plataforma, das tabelas do Access que a tela "Programação de Compras" usa:
//   NFE_Cabeçalho        -> _access_nfe_cabecalho        (as notas de entrada desde 2015: a grade
//                           fornecedor x mes soma VrNota por NrFornec e mes da DataEntr — como no Access)
//   Compras_Fornecedores -> _access_compras_fornecedores (NrFornec -> Marca, o nome da grade)
// Copia as linhas como estao (todas as colunas). Rodar de novo troca tudo (sempre igual ao Access).
// Alterado em: 20/10/2026 - so as notas de 2025 em diante (Jorge: "nao quero dados inferior a 2025").
//   Outro ano de corte: --desde 2024.
// Alterado em: 20/10/2026 - tambem Ped_Previsão -> _access_ped_previsao (as compras programadas: NrPedido, NrFornec,
//   Previsão = data prevista da compra, VTotal, Pos 0 = em aberto, Fluxo = Chave das parcelas no fluxo do Access).
// Nao mexe em nenhuma outra colecao.
//
// Uso (um comando por vez):
//   node src\scripts\PROG-2-espelho-notas.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"            simulacao
//   node src\scripts\PROG-2-espelho-notas.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb" --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const APLICAR = args.includes('--aplicar');
const j = args.indexOf('--desde');
const DESDE = j >= 0 && Number(args[j + 1]) ? Number(args[j + 1]) : 2025;
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const TABELAS = [
  { access: 'nfe_cabecalho', destino: '_access_nfe_cabecalho' },
  { access: 'compras_fornecedores', destino: '_access_compras_fornecedores' },
  { access: 'ped_previsao', destino: '_access_ped_previsao' },        // 20/10/2026: as compras PROGRAMADAS (997 Komlog...)
];

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nomes = reader.getTableNames();

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Base:', db.databaseName, APLICAR ? '· APLICAR' : '· simulação', '· Access:', MDB, '\n');

  for (const t of TABELAS) {
    const nome = nomes.find(n => limpo(n) === t.access);
    if (!nome) { console.log('✗ tabela não encontrada no Access:', t.access); continue; }
    const tab = reader.getTable(nome);
    let linhas = tab.getData();
    if (t.access === 'nfe_cabecalho') {                    // 20/10/2026: so a partir de DESDE
      const cE = tab.getColumnNames().find(c => limpo(c) === 'dataentr'), antes = linhas.length;
      linhas = linhas.filter(l => l[cE] instanceof Date && l[cE].getUTCFullYear() >= DESDE);
      console.log('   (de ' + antes + ' notas, ficam as de ' + DESDE + ' em diante)');
    }
    console.log('== ' + nome + ' → ' + t.destino + ' · ' + linhas.length + ' linhas');
    console.log('   colunas: ' + tab.getColumnNames().join(', '));
    if (t.access === 'nfe_cabecalho') {
      const col = k => tab.getColumnNames().find(c => limpo(c) === k);
      const cE = col('dataentr'), cV = col('vrnota');
      const porAno = new Map();
      for (const l of linhas) {
        const d = l[cE] instanceof Date ? l[cE] : null, a = d ? d.getUTCFullYear() : 'sem data';
        const x = porAno.get(a) || { n: 0, v: 0 }; x.n++; x.v += Number(l[cV]) || 0; porAno.set(a, x);
      }
      for (const [a, x] of [...porAno].sort((p, q) => String(p[0]).localeCompare(String(q[0]))))
        console.log('   ' + String(a).padEnd(9) + String(x.n).padStart(5) + ' nota(s) · R$ ' + brl(x.v));
    }
    const ja = await db.collection(t.destino).countDocuments();
    console.log('   hoje na plataforma: ' + ja + ' (serão trocadas)\n');
    if (!APLICAR) continue;
    await db.collection(t.destino).deleteMany({});
    const docs = linhas.map(l => ({ ...l, _importadoEm: new Date() }));
    for (let k = 0; k < docs.length; k += 1000) await db.collection(t.destino).insertMany(docs.slice(k, k + 1000), { ordered: false });
    console.log('   ✓ gravadas: ' + docs.length + '\n');
  }
  if (APLICAR) {
    await db.collection('_access_nfe_cabecalho').createIndex({ NrFornec: 1, DataEntr: 1 });
    console.log('✓ índice NrFornec + DataEntr');
  } else console.log('SIMULAÇÃO — nada foi gravado. Para gravar: --aplicar');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
