// =============================================================================
// Destino: C:\plataformaRota\src\scripts\PLANO-8-importar-lancamentos.js
// Criado em: 08/10/2026
//
// IMPORTA os lancamentos de 2026 do Access (espelho _access_contab_*) para BOLETAS,
// para o razao e o balancete. Pode rodar quantas vezes quiser ate o dia D: apaga
// as boletas de origem ACCESS (com backup EJSON) e importa de novo.
//
// REGRAS (decididas com o usuario em 08/10/2026):
//   - Um documento do Rotor (Chave) = uma boleta, codigo "ACC-<Chave>".
//     Data: a do Rotor; as 7 chaves sem Rotor usam a DtaOp do Contab__Empacotamento.
//   - Conta 2.02.xxx do Access vira 2.01.xxx (fornecedores).
//   - SALDO TRANSFERIDO (todas as linhas com historico "Saldo transferido"): uma boleta
//     SALDO_TRANSFERIDO por linha (perna unica, valor assinado), em 01/01/2026.
//   - EstoqueAjuste (perna unica no estoque): ganha a contrapartida —
//       falta (estoque diminuiu) -> 3.08.001.001 Perda de estoque  (despesa)
//       sobra (estoque aumentou) -> 4.04.001.001 Sobra de estoque  (receita)
//     As duas contas sao criadas se nao existirem (o titulo tem que existir).
//   - Documento comum: uma linha vira a perna unica (a de maior valor) e as outras,
//     contrapartidas. Linha do mesmo lado da perna entra com valor NEGATIVO (lado
//     oposto), a regra que o razao ja le. Debito +, credito -, como no Access.
//   - Documento que nao fecha (fora os ajustes) ou com conta que nao existe no plano:
//     NAO entra, a nao ser com --conta-diferenca <codigo> (a diferenca vai para ela).
//     Todos aparecem listados, com as linhas.
//
// Alterado em: 08/10/2026 - 1a simulacao:
//   - documento com TODAS as linhas zeradas: so contado (nao aparece mais na lista)
//   - chave sem data no Rotor nem no empacotamento: usa a data da chave anterior
//     (as chaves sao sequenciais no tempo)
//   - receita de OS SEM CONTA ("I->OS"/"C->OS") junto de 2.06.001.NNN: a receita vai
//     para 4.03.002.NNN (mesmo final, como nas outras OS). CONFIRMAR com o usuario.
//   - a lista dos que nao entram sai agrupada pelo motivo
// Alterado em: 08/10/2026 - decisoes do usuario:
//   - receita de OS sem conta -> 4.03.002.013 CONFIRMADO
//   - 4.03.002.010 (Cristiane) e 4.03.002.013: importa e deixa SOB OBSERVACAO. As duas sao
//     criadas se faltarem, e as linhas delas levam "[observação]" no historico. Vem das
//     Ordens de Servico (proximo passo): R$ 1,00 marca OS que nao e nossa, passada ao tecnico.
//   - "Receb." com juros/centavos, cartao com diferenca e conta "0" (Robson) ficam FORA
//     por enquanto (listados); entram depois com --conta-diferenca, quando houver a conta.
//
// Uso (um comando por vez):
//   node src\scripts\PLANO-8-importar-lancamentos.js                      simulacao
//   node src\scripts\PLANO-8-importar-lancamentos.js --aplicar
//   opcoes: --conta-diferenca 9.99.999.999   --mdb "C:\Armação\Dados\2026B\2026B.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let EJSON;
try { EJSON = mongoose.mongo.BSON.EJSON; } catch (e) { /* pacote */ }
if (!EJSON) EJSON = require('bson').EJSON;

const args = process.argv.slice(2);
const opcao = (f, p) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
const APLICAR = args.includes('--aplicar');
const CONTA_DIF = opcao('--conta-diferenca', '');
const MDB = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');

const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const TABELAS = { ativo: '_access_contab_ativo', passivo: '_access_contab_passivo',
                  despesas: '_access_contab_despesas', receitas: '_access_contab_receitas' };
const PERDA = { codigo: '3.08.001.001', nome: 'Perda de estoque' };
const SOBRA = { codigo: '4.04.001.001', nome: 'Sobra de estoque' };
// contas das OS, importadas SOB OBSERVACAO (criadas se faltarem)
const OBSERVACAO = [
  { codigo: '4.03.002.010', nome: 'Cristiane (OS) - em observação' },
  { codigo: '4.03.002.013', nome: 'Receita OS 013 - em observação' },
];
const EM_OBSERVACAO = new Set(OBSERVACAO.map(c => c.codigo));
const ESTOQUE_AJUSTE = /^\s*EstoqueAjuste/i;
const SALDO = /^\s*saldo\s+transf/i;

const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const reais = c => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const meioDia = d => { const x = new Date(d); return new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 12, 0, 0); };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName, APLICAR ? '· APLICAR' : '· simulação');

  // ---------------- plano de contas ----------------
  const plano = new Map((await db.collection('_contasubtitulos').find({ lojistaId: ARMACAO }).toArray())
    .map(c => [c.codigo, c]));

  // contas novas do ajuste de estoque
  const criar = [];
  for (const nova of [PERDA, SOBRA, ...OBSERVACAO]) {
    if (plano.has(nova.codigo)) continue;
    const tituloCod = nova.codigo.split('.').slice(0, 3).join('.');
    const titulo = await db.collection('_contatitulos').findOne({ lojistaId: ARMACAO, codigo: tituloCod });
    if (!titulo) throw new Error('o título ' + tituloCod + ' não existe no plano: crie o título (e o subgrupo, se faltar) antes');
    criar.push({ ...nova, titulo });
  }

  // ---------------- datas: Rotor e, na falta, o empacotamento ----------------
  const dataDe = new Map();
  for await (const r of db.collection('_access_contab_rotor').find({})) if (r.Data) dataDe.set(String(r.Chave), r.Data);
  if (fs.existsSync(MDB)) {
    const mod = require('mdb-reader');
    const reader = new (mod.default || mod)(fs.readFileSync(MDB));
    const nomeEmp = reader.getTableNames().find(n => n === 'Contab__Empacotamento');
    if (nomeEmp) for (const e of reader.getTable(nomeEmp).getData()) {
      const k = String(e.Chave);
      if (!dataDe.has(k) && e.DtaOp) dataDe.set(k, e.DtaOp);
    }
  } else console.warn('Access não encontrado (' + MDB + '): chaves sem Rotor ficam sem data.');

  // ---------------- linhas por documento ----------------
  const docs = new Map();
  for (const [tab, col] of Object.entries(TABELAS)) {
    for await (const d of db.collection(col).find({})) {
      const k = String(d.Chave);
      let cta = String(d.Cta || '').trim();
      if (cta.startsWith('2.02.')) cta = '2.01.' + cta.slice(5);
      if (!docs.has(k)) docs.set(k, []);
      docs.get(k).push({ tab, cta, hist: String(d.Hist || '').trim(), c: Math.round(num(d.Valor) * 100), ordem: d['Código'] || 0 });
    }
  }

  // ---------------- monta as boletas ----------------
  const boletas = [];
  const fora = [];               // documentos que nao entram, com o motivo
  const cont = { saldo: 0, ajusteFalta: 0, ajusteSobra: 0, comum: 0, comDiferenca: 0, zerados: 0, osMapeada: 0, dataVizinha: 0 };
  let ultimaData = null;
  const sub = cod => plano.get(cod) || criar.find(x => x.codigo === cod) || null;
  const idDe = s => s && s._id ? s._id : null;

  for (const [k, linhas] of [...docs].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    let data = dataDe.get(k);
    if (!data && ultimaData) { data = ultimaData; cont.dataVizinha++; }      // data da chave anterior
    if (!data) { fora.push({ k, motivo: 'sem data', linhas }); continue; }
    ultimaData = data;
    if (linhas.every(l => l.c === 0)) { cont.zerados++; continue; }        // nada a lancar

    // receita de OS sem conta: mesmo final da 2.06.001.NNN (ex.: 2.06.001.013 -> 4.03.002.013)
    const tecnico = linhas.map(l => /^2\.06\.001\.(\d{3})$/.exec(l.cta)).find(Boolean);
    if (tecnico) {
      for (const l of linhas) {
        if (l.tab === 'receitas' && (!l.cta || l.cta === '0') && /^\s*[IC]->OS/i.test(l.hist)) {
          l.cta = '4.03.002.' + tecnico[1]; cont.osMapeada++;
        }
      }
    }
    for (const l of linhas) if (EM_OBSERVACAO.has(l.cta) && !l.hist.startsWith('[observação]')) l.hist = '[observação] ' + l.hist;
    const semConta = linhas.filter(l => !sub(l.cta));

    // saldo transferido: uma boleta por linha
    if (linhas.every(l => SALDO.test(l.hist))) {
      if (semConta.length) { fora.push({ k, motivo: 'conta fora do plano', linhas }); continue; }
      for (const [n, l] of linhas.entries()) {
        const s = sub(l.cta);
        boletas.push({ codigo: 'ACC-' + k + '-' + (n + 1), tipo: 'SALDO_TRANSFERIDO', data: new Date(2026, 0, 1, 12),
          bancoSubTitulo: idDe(s), bancoCodigo: l.cta, bancoNome: s.nome, valorTotal: l.c / 100,
          contrapartidas: [], historico: 'Saldo transferido', accessChave: Number(k) });
        cont.saldo++;
      }
      continue;
    }

    let ls = linhas.map(l => ({ ...l }));
    let soma = ls.reduce((t, l) => t + l.c, 0);
    if (soma !== 0 && ls.every(l => ESTOQUE_AJUSTE.test(l.hist))) {
      // ajuste de estoque: contrapartida na perda (falta) ou na sobra
      const conta = soma < 0 ? PERDA : SOBRA;
      ls.push({ tab: soma < 0 ? 'despesas' : 'receitas', cta: conta.codigo, hist: ls[0].hist, c: -soma });
      soma < 0 ? cont.ajusteFalta++ : cont.ajusteSobra++;
      soma = 0;
    }
    if (semConta.length || soma !== 0) {
      if (CONTA_DIF && sub(CONTA_DIF)) {
        // a diferenca e as linhas sem conta vao para a conta de diferencas
        ls = ls.map(l => sub(l.cta) ? l : { ...l, cta: CONTA_DIF, hist: '[sem conta ' + (l.cta || 'vazia') + '] ' + l.hist });
        if (soma !== 0) ls.push({ tab: '?', cta: CONTA_DIF, hist: 'Diferença da importação', c: -soma });
        cont.comDiferenca++;
      } else {
        fora.push({ k, motivo: semConta.length ? 'conta fora do plano: ' + semConta.map(l => l.cta || '(vazia)').join(', ')
                                               : 'não fecha (sobra ' + reais(soma) + ')', linhas });
        continue;
      }
    }

    // perna unica = a linha de maior valor; as outras, contrapartidas
    ls.sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
    const perna = ls[0];
    const outras = ls.slice(1).filter(l => l.c !== 0);
    const ps = sub(perna.cta);
    const recebimento = perna.c > 0;                 // perna a debito
    boletas.push({
      codigo: 'ACC-' + k, tipo: recebimento ? 'RECEBIMENTO' : 'PAGAMENTO', data: meioDia(data),
      bancoSubTitulo: idDe(ps), bancoCodigo: perna.cta, bancoNome: ps.nome,
      valorTotal: Math.abs(perna.c) / 100,
      contrapartidas: outras.map(l => {
        const s = sub(l.cta);
        // RECEBIMENTO: contrapartida a credito (= -valor da linha); PAGAMENTO: a debito (= valor)
        const v = recebimento ? -l.c : l.c;
        return { contaSubTitulo: idDe(s), codigoConta: l.cta, nomeConta: s.nome, historico: l.hist,
                 nrTitulo: '', valor: v / 100, fluxoLancamentoId: null, pos: null, fornecedor: null, cliente: null,
                 _id: new mongoose.Types.ObjectId() };
      }),
      historico: perna.hist || ('Access ' + k), accessChave: Number(k),
    });
    cont.comum++;
  }

  // ---------------- confere as boletas (partida dobrada, em centavos) ----------------
  let erradas = 0;
  for (const b of boletas) {
    if (b.tipo === 'SALDO_TRANSFERIDO') continue;
    const s = b.contrapartidas.reduce((t, c) => t + Math.round(c.valor * 100), 0);
    if (s !== Math.round(b.valorTotal * 100)) erradas++;
  }

  // ---------------- relatorio ----------------
  const jaAccess = await db.collection('_boletas').countDocuments({ lojistaId: ARMACAO, origem: 'ACCESS' });
  const saldoPlataforma = await db.collection('_boletas').countDocuments({ lojistaId: ARMACAO, tipo: 'SALDO_TRANSFERIDO',
    origem: { $ne: 'ACCESS' }, status: 'ATIVO' });
  console.log('\ndocumentos no espelho:', docs.size);
  console.log('boletas a gravar:', boletas.length);
  console.log('   saldo transferido ........', cont.saldo, '(uma por conta, em 01/01/2026)');
  console.log('   ajuste de estoque (falta) ', cont.ajusteFalta, '→', PERDA.codigo, PERDA.nome);
  console.log('   ajuste de estoque (sobra) ', cont.ajusteSobra, '→', SOBRA.codigo, SOBRA.nome);
  console.log('   documentos comuns ........', cont.comum - cont.ajusteFalta - cont.ajusteSobra);
  if (CONTA_DIF) console.log('   com diferença em', CONTA_DIF, '..', cont.comDiferenca);
  console.log('documentos zerados (não lançados) ...', cont.zerados);
  console.log('receitas de OS sem conta → 4.03.002.NNN:', cont.osMapeada, '(confirmar a regra)');
  console.log('chaves sem data → data da chave anterior:', cont.dataVizinha);
  console.log('boletas que não fecham (deve ser 0):', erradas);
  console.log('contas a criar:', criar.length ? criar.map(c => c.codigo + ' ' + c.nome + ' (título ' + c.titulo.codigo + ' ' + c.titulo.nome + ')').join(' · ') : 'nenhuma');
  console.log('boletas ACCESS já no banco (serão apagadas e refeitas):', jaAccess);
  if (saldoPlataforma) console.log('ATENÇÃO:', saldoPlataforma, 'saldo(s) transferido(s) lançados pela tela da plataforma — vão SOMAR com os do Access. Confira.');

  console.log('\ndocumentos que NÃO entram:', fora.length);
  const porMotivo = new Map();
  for (const f of fora) {
    const m = f.motivo.replace(/\(sobra.*\)/, '').trim();
    const x = porMotivo.get(m) || { n: 0, sobra: 0 };
    x.n++; x.sobra += f.linhas.reduce((t, l) => t + l.c, 0); porMotivo.set(m, x);
  }
  for (const [m, x] of porMotivo) console.log('   ' + m.padEnd(46) + String(x.n).padStart(4) + ' doc(s) · sobra ' + reais(x.sobra));
  console.log('detalhe:');
  for (const f of fora) {
    console.log('  Chave ' + f.k + ' — ' + f.motivo);
    for (const l of f.linhas) console.log('      ' + String(l.tab).padEnd(9) + String(l.cta || '(vazia)').padEnd(14) + reais(l.c).padStart(13) + '  ' + l.hist.slice(0, 50));
  }

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); return; }
  if (erradas) throw new Error(erradas + ' boleta(s) não fecham; nada foi gravado');

  // ---------------- grava ----------------
  // backup das ACCESS que existem, e apaga
  if (jaAccess) {
    const pasta = path.join(__dirname, 'backup');
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'PLANO-8-boletas-access-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
    const antigas = await db.collection('_boletas').find({ lojistaId: ARMACAO, origem: 'ACCESS' }).toArray();
    fs.writeFileSync(arq, EJSON.stringify(antigas, null, 1, { relaxed: false }));
    console.log('\nBackup das boletas ACCESS anteriores:', arq);
    const r = await db.collection('_boletas').deleteMany({ lojistaId: ARMACAO, origem: 'ACCESS' });
    console.log('Apagadas:', r.deletedCount);
  }

  // contas novas
  for (const c of criar) {
    await db.collection('_contasubtitulos').insertOne({
      contaTituloId: c.titulo._id, codigoContaTitulo: c.titulo.codigo, codigo: c.codigo, nome: c.nome, descricao: '',
      saldoInicial: 0, natureza: c.codigo.startsWith('3') ? 'devedora' : 'credora', ativo: true,
      criadoEm: new Date(), atualizadoEm: new Date(), __v: 0, lojistaId: ARMACAO,
    });
    console.log('Conta criada:', c.codigo, c.nome);
  }
  // as boletas usam o _id das contas novas
  const novas = new Map((await db.collection('_contasubtitulos').find({ lojistaId: ARMACAO, codigo: { $in: criar.map(c => c.codigo) } }).toArray())
    .map(c => [c.codigo, c._id]));
  const agora = new Date();
  const docsGravar = boletas.map(b => ({
    ...b,
    bancoSubTitulo: b.bancoSubTitulo || novas.get(b.bancoCodigo) || null,
    contrapartidas: b.contrapartidas.map(c => ({ ...c, contaSubTitulo: c.contaSubTitulo || novas.get(c.codigoConta) || null })),
    contaBancaria: null, mes: b.data.getMonth() + 1, ano: b.data.getFullYear(),
    origem: 'ACCESS', operador: '', status: 'ATIVO', lojistaId: ARMACAO,
    criadoEm: agora, atualizadoEm: agora, __v: 0,
  }));
  let gravadas = 0;
  for (let i = 0; i < docsGravar.length; i += 1000) {
    const r = await db.collection('_boletas').insertMany(docsGravar.slice(i, i + 1000), { ordered: false });
    gravadas += r.insertedCount;
    process.stdout.write('\r  gravando ... ' + gravadas + '/' + docsGravar.length);
  }
  console.log('\n\nBoletas gravadas:', gravadas);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
