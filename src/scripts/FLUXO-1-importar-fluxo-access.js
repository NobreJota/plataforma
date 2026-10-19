// =============================================================================
// Destino: C:\plataformaRota\src\scripts\FLUXO-1-importar-fluxo-access.js
// Criado em: 18/10/2026
//
// Traz o FLUXO DE CAIXA do Access (Contab_Caixa_Fluxo) para o fluxo da plataforma
// (_fluxo_projetado), para simular o DDA - confere / DDA - paga com os titulos de verdade.
//
// Colunas do Access: Data, Chave, Ord, NrCta, Pos, NrTitulo, Hist, Vect, Deb, Cre, Titular
//   - conta: NrCta; fornecedor 2.02.xxx.xxx do Access vira 2.01.xxx.xxx (o plano novo)
//   - valor: Deb (a receber) ou Cre (a pagar), sempre positivo (o fluxo grava reais positivos)
//   - vencimento: Vect · pos: Pos (0 avulso, 2 a pagar, 3 programacao de compras, 5 a receber, 7 pedido, 8 orcamento)
// Alterado em: 19/10/2026 - nome da pos 3 (programacao de compras futuras; a tela ainda vai ser feita).
//   - historico: Hist + NrTitulo (quando tem) · nomeConta e contaSubTitulo: do plano
//   - origem 'ACCESS' + chaveImport (Chave|Ord|NrCta|NrTitulo|Vect|valor) para rodar de novo
// Alterado em: 19/10/2026 - O POS DO ACCESS (confirmado com o Jorge): 3 = PEDIDO FEITO ao fabricante (aguardando
//   mercadoria), 7 = COMPRA PROJETADA (previsao: "previsaoRinnai"...). Antes eu tinha os dois trocados: a pos 7
//   (90 linhas de previsao) ficava de fora e a pos 3 (os pedidos) entrava EM DOBRO com os do COMPRA-9.
//   Agora: entra a pos 7 (previsao) e, da pos 3, so o que NAO e pedido da plataforma ("Saldo / PedidoOrbis");
//   a parcela de pedido que o COMPRA-9 ja trouxe (o numero do pedido no NrTitulo "7119/0") fica de fora.
//   E tambem a linha cuja Chave e a coluna Fluxo do pedido no PED_PedidoFornecedor (o saldo 7113 Orbis,
//   que no historico nao tem o numero). Pos 1 do pedido = SALDO pendente (o COMPRA-9 agora importa).
// (antes) POS 8 (orcamento) e POS 7 (pedido) ficam de fora: a plataforma ja tem o orcamento e os pedidos
// dela (seriam linhas repetidas). Use --com-orcamento / --com-pedidos para trazer tambem.
//
// Rodar de novo: as linhas ACCESS ainda em aberto (ATIVO) sao trocadas pelas atuais do Access;
// as que ja foram pagas/recebidas na plataforma (QUITADO) ficam e nao entram de novo.
// Backup EJSON das linhas trocadas em src\scripts\backup.
//
// Uso (um comando por vez):
//   node src\scripts\FLUXO-1-importar-fluxo-access.js                 simulacao
//   node src\scripts\FLUXO-1-importar-fluxo-access.js --aplicar
//   opcoes: --com-orcamento  --com-pedidos  --mdb "C:\Armação\Dados\2026B\2026B.mdb"
//   para tirar tudo o que veio do Access:  --remover --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const COM_ORC = args.includes('--com-orcamento');
const COM_PED = args.includes('--com-pedidos');
const REMOVER = args.includes('--remover');
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const txt = v => (v === null || v === undefined ? '' : String(v).trim());
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const brl = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = d => d.toISOString().slice(0, 10);
const POS = { 0: 'avulso', 2: 'a pagar', 3: 'pedido feito (não é pedido da plataforma)', 5: 'a receber', 7: 'compra projetada', 8: 'orçamento' };

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const FLX = db.collection('_fluxo_projetado');

  if (REMOVER) {
    const n = await FLX.countDocuments({ origem: 'ACCESS', status: 'ATIVO' });
    console.log('Linhas do Access em aberto no fluxo:', n);
    if (APLICAR && n) { await backup(await FLX.find({ origem: 'ACCESS', status: 'ATIVO' }).toArray()); await FLX.deleteMany({ origem: 'ACCESS', status: 'ATIVO' }); console.log('Removidas.'); }
    else if (!APLICAR) console.log('(simulação: use --remover --aplicar)');
    await mongoose.disconnect(); return;
  }

  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nome = reader.getTableNames().find(n => limpo(n) === 'contab_caixa_fluxo');
  if (!nome) throw new Error('tabela Contab_Caixa_Fluxo não encontrada');
  const tab = reader.getTable(nome);
  const col = c => tab.getColumnNames().find(x => limpo(x) === limpo(c));
  const C = { data: col('Data'), chave: col('Chave'), ord: col('Ord'), cta: col('NrCta'), pos: col('Pos'), tit: col('NrTítulo'),
              hist: col('Hist'), vect: col('Vect'), deb: col('Deb'), cre: col('Cre'), titular: col('Titular') };
  const faltam = Object.entries(C).filter(([, v]) => !v).map(([k]) => k);
  if (faltam.length) throw new Error('colunas não encontradas: ' + faltam.join(', ') + ' (tem: ' + tab.getColumnNames().join(', ') + ')');
  const linhas = tab.getData();
  console.log('Access:', nome, '·', linhas.length, 'linhas');

  // 19/10/2026: os numeros dos pedidos que a plataforma ja tem (as parcelas deles vem do COMPRA-9)
  const pedidosPlat = new Set((await db.collection('_compra_pedidos').find({ lojistaId: { $in: [ARMACAO, String(ARMACAO)] } })
    .project({ numero: 1 }).toArray()).map(p => Number(p.numero)));
  // e a Chave do fluxo de cada pedido (coluna Fluxo do PED_PedidoFornecedor): pega a parcela que nao tem o
  // numero no historico (ex.: "Saldo / PedidoOrbis" do pedido 7113)
  const chavesPed = new Set();
  const tPed = reader.getTableNames().find(n => limpo(n) === 'ped_pedidofornecedor');
  if (tPed) for (const p of reader.getTable(tPed).getData()) if (pedidosPlat.has(Number(p.NrPedido)) && num(p.Fluxo)) chavesPed.add(num(p.Fluxo));

  // plano: codigo -> subtitulo
  const subs = new Map((await db.collection('_contasubtitulos').find({ lojistaId: ARMACAO }).project({ codigo: 1, nome: 1 }).toArray())
    .map(s => [s.codigo, s]));

  const fora = { semVenc: 0, semValor: 0, orcamento: 0, pedidos: 0 }, semConta = new Map(), docs = [];
  for (const l of linhas) {
    const pos = Number(txt(l[C.pos])) || 0;
    if (pos === 8 && !COM_ORC) { fora.orcamento++; continue; }
    // 19/10/2026: pos 3 = pedido feito; o que e pedido da plataforma (COMPRA-9, ligado ao pedido) nao entra de novo
    if (pos === 3 && !COM_PED) {
      const nped = (/^\s*(\d{4,})\s*\//.exec(txt(l[C.tit])) || /pedido\D{0,60}?(\d{4,})/i.exec(txt(l[C.hist])) || [])[1];
      if ((nped && pedidosPlat.has(Number(nped))) || chavesPed.has(num(l[C.chave]))) { fora.pedidos++; continue; }
    }
    const vect = l[C.vect] instanceof Date ? l[C.vect] : null;
    if (!vect || vect.getUTCFullYear() < 1990) { fora.semVenc++; continue; }
    const deb = num(l[C.deb]), cre = num(l[C.cre]);
    const valor = Math.round(Math.abs(deb || cre) * 100) / 100;
    if (!valor) { fora.semValor++; continue; }
    let conta = txt(l[C.cta]);
    if (conta.startsWith('2.02.')) conta = '2.01.' + conta.slice(5);          // fornecedor: 2.02 -> 2.01
    const sub = subs.get(conta);
    if (!sub) semConta.set(conta, (semConta.get(conta) || 0) + 1);
    const nrTit = txt(l[C.tit]), temTit = nrTit && !/^0+$/.test(nrTit);
    const hist = txt(l[C.hist]);
    const venc = new Date(vect.getUTCFullYear(), vect.getUTCMonth(), vect.getUTCDate(), 12);   // o dia do Access, meio-dia
    docs.push({
      lojistaId: ARMACAO, ano: venc.getFullYear(), mes: venc.getMonth() + 1, pos,
      codigoConta: conta, nomeConta: sub ? sub.nome : '', contaSubTitulo: sub ? sub._id : null,
      historico: (hist || (sub ? sub.nome : conta)) + (temTit && !hist.includes(nrTit) ? ' · ' + nrTit : ''),
      valor, vencimento: venc, status: 'ATIVO', origem: 'ACCESS',
      nrTitulo: temTit ? nrTit : '', titular: txt(l[C.titular]),
      chaveAccess: num(l[C.chave]), ordAccess: num(l[C.ord]),
      dataAccess: l[C.data] instanceof Date ? l[C.data] : null,
      chaveImport: [num(l[C.chave]), num(l[C.ord]), txt(l[C.cta]), nrTit, dia(venc), valor.toFixed(2)].join('|'),
      importadoEm: new Date(),
    });
  }

  // o que ja foi baixado na plataforma nao entra de novo
  const quitados = new Set((await FLX.find({ origem: 'ACCESS', status: { $ne: 'ATIVO' } }).project({ chaveImport: 1 }).toArray()).map(d => d.chaveImport));
  const entram = docs.filter(d => !quitados.has(d.chaveImport));
  const abertosAntes = await FLX.countDocuments({ origem: 'ACCESS', status: 'ATIVO' });

  // ---- relatorio ----
  console.log('\nVão entrar:', entram.length, 'linhas  (fora: orçamento', fora.orcamento, '· parcelas de pedido da plataforma', fora.pedidos, '· sem vencimento', fora.semVenc,
    '· sem valor', fora.semValor, '· já baixadas na plataforma', docs.length - entram.length, ')');
  const porPos = {};
  for (const d of entram) { const k = d.pos; porPos[k] = porPos[k] || { n: 0, v: 0 }; porPos[k].n++; porPos[k].v += d.valor; }
  for (const [k, x] of Object.entries(porPos)) console.log('  pos ' + k + ' (' + (POS[k] || '?') + '):', x.n, 'linhas · R$', brl(x.v));
  const forn = entram.filter(d => d.codigoConta.startsWith('2.01.001.'));
  console.log('  de fornecedor (2.01.001):', forn.length, 'linhas · R$', brl(forn.reduce((s, d) => s + d.valor, 0)));
  if (semConta.size) {
    console.log('\nContas que NÃO estão no plano (entram assim mesmo, sem nome):');
    for (const [c, n] of semConta) console.log('  ' + c + '  (' + n + ')');
  }
  console.log('\nExemplos:');
  for (const d of entram.slice(0, 8)) console.log('  ' + dia(d.vencimento) + '  pos ' + d.pos + '  ' + d.codigoConta.padEnd(13) + ' R$ ' + brl(d.valor).padStart(12) + '  ' + d.historico);
  console.log('\nLinhas do Access em aberto hoje no fluxo da plataforma:', abertosAntes, '(serão trocadas)');

  if (!APLICAR) { console.log('\nSIMULAÇÃO: nada foi gravado. Para gravar: --aplicar'); await mongoose.disconnect(); return; }

  const velhos = await FLX.find({ origem: 'ACCESS', status: 'ATIVO' }).toArray();
  if (velhos.length) await backup(velhos);
  await FLX.deleteMany({ origem: 'ACCESS', status: 'ATIVO' });
  if (entram.length) await FLX.insertMany(entram);
  console.log('\n✓ Gravado:', entram.length, 'linhas no fluxo (origem ACCESS).');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });

async function backup(docs) {
  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta);
  const arq = path.join(pasta, 'FLUXO-1-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify(docs, null, 1, { relaxed: false }));
  console.log('Backup:', arq, '(' + docs.length + ' linhas)');
}
