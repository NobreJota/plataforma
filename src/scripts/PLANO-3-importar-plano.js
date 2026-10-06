// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-3-importar-plano.js
// Criado em: 02/10/2026
//
// Importa o PLANO DE CONTAS do Access para o plano novo, a partir do espelho
// (PLANO-2): _access_contab_ctastitulos e _access_contab_ctastitulossub.
//
//   - fornecedores: 2.02 -> 2.01 (o Access nao tem nada em 2.01: sem colisao)
//   - titulos  -> _contatitulos     (subGrupoId do subgrupo que ja existe)
//   - subtitulos -> _contasubtitulos (contaTituloId do titulo)
//   - SO ACRESCENTA: titulo ou subtitulo que ja existe no plano novo (mesmo
//     codigo, mesma empresa) nao e tocado — fluxo, bancos e boletas apontam
//     para eles. Nada e apagado.
//   - SUBGRUPO NAO E CRIADO AQUI (e da administracao, /central/plano/estrutura).
//     Subgrupo que falta e listado; os titulos dele ficam para depois.
//   - natureza: a das contas que ja existem no mesmo grupo; sem nenhuma, pelo
//     grupo (1 e 3 devedora, 2 e 4 credora).
//
// Uso (um comando por vez):
//   node src/scripts/PLANO-3-importar-plano.js
//   node src/scripts/PLANO-3-importar-plano.js --aplicar
// Opcoes: --lojista <id>
// =============================================================================

'use strict';

require('dotenv').config();

const mongoose = require('mongoose');

const args = process.argv.slice(2);
const opcao = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');

const RX_TIT = /^\d\.\d{2}\.\d{3}$/;
const RX_SUB = /^\d\.\d{2}\.\d{3}\.\d{3,4}$/;
const troca = c => c.startsWith('2.02.') ? '2.01.' + c.slice(5) : c;
const subgrupoDe = c => c.split('.').slice(0, 2).join('.');
const tituloDe = c => c.split('.').slice(0, 3).join('.');
const NATUREZA_PADRAO = { '1': 'devedora', '2': 'credora', '3': 'devedora', '4': 'credora' };
const txt = v => String(v ?? '').trim();
const secao = t => console.log('\n' + '='.repeat(74) + '\n' + t + '\n' + '='.repeat(74));

(async function () {
  const aplicar = args.includes('--aplicar');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);
  const C = n => db.collection(n);

  // ---- o Access, pelo espelho ----------------------------------------------------
  const titAccess = new Map();   // codigo novo -> nome
  for (const d of await C('_access_contab_ctastitulos').find({ lojistaId }).toArray()) {
    const cod = troca(txt(d.NrCtasTitulos));
    if (RX_TIT.test(cod) && !titAccess.has(cod)) titAccess.set(cod, txt(d.NmCtasTitulos) || cod);
  }
  const subAccess = new Map();   // codigo novo -> nome
  let repetidos = 0;
  for (const d of await C('_access_contab_ctastitulossub').find({ lojistaId }).toArray()) {
    const cod = troca(txt(d.NrSubCtasTitulos));
    if (!RX_SUB.test(cod)) continue;
    if (subAccess.has(cod)) { repetidos++; continue; }
    subAccess.set(cod, txt(d.NmSubCtasTitulos) || cod);
  }
  if (!titAccess.size || !subAccess.size) {
    console.error('Espelho vazio. Rode antes: node src/scripts/PLANO-2-espelho-access.js --aplicar');
    process.exitCode = 1; return;
  }

  // ---- o plano novo ---------------------------------------------------------------
  // colecao dos subgrupos: a que tem documentos com codigo "1.01" desta empresa
  const nomes = (await db.listCollections().toArray()).map(c => c.name);
  let colSub = null;
  for (const n of nomes.filter(n => /grupo/i.test(n))) {
    if (await C(n).findOne({ lojistaId, codigo: /^\d\.\d{2}$/ })) { colSub = n; break; }
  }
  const subgrupos = new Map(colSub
    ? (await C(colSub).find({ lojistaId, codigo: /^\d\.\d{2}$/ }).toArray()).map(s => [s.codigo, s])
    : []);

  const titNovo = new Map((await C('_contatitulos').find({ lojistaId }).toArray()).map(t => [t.codigo, t]));
  const subNovo = await C('_contasubtitulos').find({ lojistaId }).project({ codigo: 1, natureza: 1 }).toArray();
  const subNovoSet = new Set(subNovo.map(s => s.codigo));

  // natureza por grupo: a que ja e usada no plano novo
  const natureza = {};
  for (const g of ['1', '2', '3', '4']) {
    const cont = {};
    subNovo.filter(s => s.codigo.startsWith(g + '.') && s.natureza).forEach(s => { cont[s.natureza] = (cont[s.natureza] || 0) + 1; });
    const maior = Object.entries(cont).sort((a, b) => b[1] - a[1])[0];
    natureza[g] = maior ? maior[0] : NATUREZA_PADRAO[g];
  }

  // ---- o que entra ------------------------------------------------------------------
  // titulos: os do Access + os que so aparecem nos subtitulos (orfaos)
  const titulosNecessarios = new Map(titAccess);
  let orfaos = 0;
  for (const cod of subAccess.keys()) {
    const t = tituloDe(cod);
    if (!titulosNecessarios.has(t)) { titulosNecessarios.set(t, t + ' (sem nome no Access)'); orfaos++; }
  }

  const faltaSubgrupo = new Set();
  const titulosCriar = [];
  for (const [cod, nome] of titulosNecessarios) {
    if (titNovo.has(cod)) continue;
    if (!subgrupos.has(subgrupoDe(cod))) { faltaSubgrupo.add(subgrupoDe(cod)); continue; }
    titulosCriar.push({ cod, nome });
  }
  const titulosOk = new Set([...titNovo.keys(), ...titulosCriar.map(t => t.cod)]);

  const subsCriar = [];
  let semTitulo = 0;
  for (const [cod, nome] of subAccess) {
    if (subNovoSet.has(cod)) continue;
    if (!titulosOk.has(tituloDe(cod))) { semTitulo++; continue; }
    subsCriar.push({ cod, nome });
  }

  // ---- relatorio -----------------------------------------------------------------------
  secao('Plano do Access (espelho, ja com 2.02 -> 2.01)');
  console.log('Titulos:', titAccess.size, '| subtitulos:', subAccess.size, '| codigos repetidos ignorados:', repetidos,
    '| titulos que so aparecem nos subtitulos:', orfaos);

  secao('Plano novo hoje');
  console.log('Colecao dos subgrupos:', colSub || '*** NAO ACHADA ***', '| subgrupos desta empresa:', subgrupos.size);
  console.log('  ' + [...subgrupos.keys()].sort().join(', '));
  console.log('Titulos:', titNovo.size, '| subtitulos:', subNovo.length);
  console.log('Natureza por grupo:', JSON.stringify(natureza));

  secao('O que entra');
  const porSub = new Map();
  for (const t of titulosCriar) { const k = subgrupoDe(t.cod); porSub.set(k, porSub.get(k) || { t: 0, s: 0 }); porSub.get(k).t++; }
  for (const s of subsCriar) { const k = subgrupoDe(s.cod); porSub.set(k, porSub.get(k) || { t: 0, s: 0 }); porSub.get(k).s++; }
  console.log('  subgrupo   titulos novos   subtitulos novos');
  for (const [k, v] of [...porSub].sort()) console.log('  ' + k.padEnd(10) + String(v.t).padStart(14) + String(v.s).padStart(19));
  console.log('Total: titulos', titulosCriar.length, '| subtitulos', subsCriar.length,
    '| ja existiam (ficam como estao): titulos', [...titulosNecessarios.keys()].filter(c => titNovo.has(c)).length,
    ', subtitulos', [...subAccess.keys()].filter(c => subNovoSet.has(c)).length);

  if (faltaSubgrupo.size) {
    console.log('\nSUBGRUPOS QUE FALTAM no plano novo (criar em /central/plano/estrutura e rodar de novo):');
    for (const s of [...faltaSubgrupo].sort()) {
      const nT = [...titulosNecessarios.keys()].filter(c => subgrupoDe(c) === s).length;
      console.log('   ' + s + '  (' + nT + ' titulos, ' + [...subAccess.keys()].filter(c => subgrupoDe(c) === s).length + ' subtitulos esperando)');
    }
  }
  console.log('Subtitulos sem titulo (ficam para depois):', semTitulo);

  console.log('\nExemplos do que entra:');
  titulosCriar.slice(0, 5).forEach(t => console.log('   titulo    ' + t.cod + ' - ' + t.nome));
  subsCriar.slice(0, 5).forEach(s => console.log('   subtitulo ' + s.cod + ' - ' + s.nome));

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  // ---- aplicar ---------------------------------------------------------------------------
  const agora = new Date();
  if (titulosCriar.length) {
    await C('_contatitulos').insertMany(titulosCriar.map(t => {
      const sg = subgrupos.get(subgrupoDe(t.cod));
      return {
        subGrupoId: sg._id, codigoSubGrupo: sg.codigo, codigo: t.cod, nome: t.nome,
        descricao: '', aceitaLancamento: false, ativo: true, lojistaId,
        criadoEm: agora, atualizadoEm: agora,
      };
    }), { ordered: false });
  }
  console.log('\nTitulos criados:', titulosCriar.length);

  const titulos = new Map((await C('_contatitulos').find({ lojistaId }).project({ codigo: 1 }).toArray()).map(t => [t.codigo, t._id]));
  let n = 0;
  for (let i = 0; i < subsCriar.length; i += 2000) {
    const lote = subsCriar.slice(i, i + 2000).map(s => ({
      contaTituloId: titulos.get(tituloDe(s.cod)),
      codigoContaTitulo: tituloDe(s.cod), codigo: s.cod, nome: s.nome, descricao: '',
      saldoInicial: 0, natureza: natureza[s.cod[0]] || NATUREZA_PADRAO[s.cod[0]],
      ativo: true, lojistaId, criadoEm: agora, atualizadoEm: agora,
    }));
    n += (await C('_contasubtitulos').insertMany(lote, { ordered: false })).insertedCount;
    process.stdout.write('\r    subtitulos ... ' + Math.min(i + 2000, subsCriar.length) + '/' + subsCriar.length);
  }
  console.log('\nSubtitulos criados:', n);
  console.log('Nada foi apagado nem alterado no que ja existia.');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
