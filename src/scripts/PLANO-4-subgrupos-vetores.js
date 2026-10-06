// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-4-subgrupos-vetores.js
// Criado em: 02/10/2026
//
// Cria no plano novo os SUBGRUPOS que faltam, com o nome de Contab_CtasVetores
// (NrVetores, NmVetores) do Access.
//
//   - so os subgrupos que tem titulo no Access (os que o PLANO-3 listou)
//   - 2.02 do Access (Fornecedores) = 2.01 do plano novo: nao e criado
//   - cada subgrupo novo e copiado de um IRMAO do mesmo grupo que ja existe
//     (1.07 copia o 1.05...): mesmos campos e ligacoes, so muda codigo e nome
//   - nao altera nem apaga nenhum subgrupo existente
//
// Depois: node src/scripts/PLANO-3-importar-plano.js --aplicar
//
// Uso (um comando por vez):
//   node src/scripts/PLANO-4-subgrupos-vetores.js
//   node src/scripts/PLANO-4-subgrupos-vetores.js --aplicar
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
const COLECAO = 'subgrupos';   // achada pelo PLANO-3

const troca = c => c.startsWith('2.02') ? '2.01' + c.slice(4) : c;
const subgrupoDe = c => c.split('.').slice(0, 2).join('.');
const txt = v => String(v ?? '').trim();

(async function () {
  const aplicar = args.includes('--aplicar');

  // ---- nomes no Access ----------------------------------------------------------
  const reader = new MDBReader(fs.readFileSync(MDB));
  const nomeTab = reader.getTableNames().find(t => /^contab_?ctas_?vetores$/i.test(t));
  if (!nomeTab) { console.error('Contab_CtasVetores nao encontrada.'); process.exitCode = 1; return; }
  const vetores = new Map();
  for (const l of reader.getTable(nomeTab).getData()) {
    const cod = troca(txt(l['NrVetores']));
    if (/^\d\.\d{2}$/.test(cod)) vetores.set(cod, txt(l['NmVetores']) || cod);
  }

  // ---- o que falta -----------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const existentes = await db.collection(COLECAO).find({ lojistaId, codigo: /^\d\.\d{2}$/ }).toArray();
  const jaTem = new Set(existentes.map(s => s.codigo));

  // subgrupos que tem titulo no Access (pelo espelho)
  const precisa = new Set();
  for (const d of await db.collection('_access_contab_ctastitulos').find({ lojistaId }).toArray()) {
    const c = troca(txt(d.NrCtasTitulos));
    if (/^\d\.\d{2}\.\d{3}$/.test(c)) precisa.add(subgrupoDe(c));
  }
  for (const d of await db.collection('_access_contab_ctastitulossub').find({ lojistaId }).project({ NrSubCtasTitulos: 1 }).toArray()) {
    const c = troca(txt(d.NrSubCtasTitulos));
    if (/^\d\.\d{2}\.\d{3}\.\d{3,4}$/.test(c)) precisa.add(subgrupoDe(c));
  }

  const criar = [...precisa].filter(c => !jaTem.has(c)).sort();

  console.log('Subgrupos na Contab_CtasVetores:', vetores.size, '| no plano novo:', jaTem.size);
  if (existentes[0]) console.log('Campos de um subgrupo existente:', Object.keys(existentes[0]).join(', '));
  console.log('\nA criar:');
  const docs = [];
  for (const cod of criar) {
    const irmao = existentes.filter(s => s.codigo[0] === cod[0]).sort((a, b) => b.codigo.localeCompare(a.codigo))[0];
    const nome = vetores.get(cod);
    if (!irmao) { console.log('   ' + cod + '  *** sem irmao no grupo ' + cod[0] + ', nao criado'); continue; }
    if (!nome) { console.log('   ' + cod + '  *** sem nome na Contab_CtasVetores, nao criado'); continue; }

    const { _id, ...base } = irmao;
    const agora = new Date();
    const novo = { ...base, codigo: cod };
    // o campo do nome e o mesmo do irmao (nome / descricao)
    if ('nome' in base) novo.nome = nome;
    else if ('descricao' in base) novo.descricao = nome;
    else novo.nome = nome;
    for (const k of ['criadoEm', 'atualizadoEm', 'createdAt', 'updatedAt']) if (k in base) novo[k] = agora;
    if ('ativo' in base) novo.ativo = true;
    docs.push(novo);
    console.log('   ' + cod + '  ' + nome.padEnd(32) + '(copiado de ' + irmao.codigo + ')');
  }
  if (!criar.length) console.log('   nenhum: o plano ja tem todos os subgrupos usados pelo Access');

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  if (docs.length) await db.collection(COLECAO).insertMany(docs, { ordered: false });
  console.log('\nSubgrupos criados:', docs.length);
  console.log('Agora: node src/scripts/PLANO-3-importar-plano.js --aplicar');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
