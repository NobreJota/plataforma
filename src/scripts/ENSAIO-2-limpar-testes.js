// =============================================================================
// Destino: C:\plataformaRota\src\scripts\ENSAIO-2-limpar-testes.js
// Criado em: 19/10/2026 (ensaio do dia "D")
//
// LIMPA OS TESTES feitos na plataforma antes do dia D (decisao do Jorge, 19/10/2026: "os testes
// feitos anteriormente serao todos deletados"; o que vale e o Access). E a causa "C" do
// ENSAIO-1-conferir-balancete.
//
// APAGA (com backup EJSON de tudo antes):
//   _boletas          as que NAO vieram do Access (origem diferente de ACCESS): vendas, vendas
//                     balcao, recebimentos e pagamentos do fluxo, OS ...
//   _vendas           as feitas na plataforma (origem diferente de ACCESS)
//   _ordens_servico   as OS nascidas dessas vendas
//   _fluxo_projetado  origem VENDA e OS (parcelas das vendas e a receber das OS) e TODAS as
//                     linhas ACCESS (abertas e as quitadas nos testes): o FLUXO-1, rodado DEPOIS
//                     desta limpeza, traz o fluxo do Access de novo, limpo.
// ACERTA: _numeracao OS -> a maior OS do Access (espelho OrdemServiço__Cabeçalho, VENDA-1),
//         para a proxima OS da plataforma continuar a do Access.
// NAO MEXE: clientes, contas do plano, produtos e estoque (o COMPRA-22 ja trouxe o estoque do
//   Access), kits, tecnicos, pedidos de compra e as linhas do fluxo de outras origens
//   (PEDIDO_IMPORTADO, PEDIDO_COMPRA ...): estas so aparecem na lista.
// Opcional --orcamentos: apaga tambem as linhas do fluxo de origem ORCAMENTO (pos 8, feitas na
//   plataforma). Sem a opcao elas ficam (podem ser projecoes de verdade).
// Alterado em: 19/10/2026 - opcao --orcamentos (1a simulacao: 26 linhas ORCAMENTO, R$ 13.570,00).
// Opcional --sem-loja: apaga tambem as linhas dessas origens SEM lojistaId (gravadas antes da
//   marca da loja). Sem a opcao elas so aparecem listadas.
// Alterado em: 19/10/2026 - lista as linhas sem lojistaId e opcao --sem-loja (o comando
//   node -e com $exists nao roda no PowerShell: o $ e lido como variavel).
// Venda com NF-e AUTORIZADA (tem chave) nao e apagada: aparece com aviso. So com --com-nfe.
// Alterado em: 31/10/2026 (simulacao do dia D) - apaga TODAS as OS da plataforma (as de conserto/garantia/servico,
//   sem venda, nascidas na Nova OS desde 23/10, tambem sao teste); a numeracao da OS volta para a maior do Access.
//   Parcelas de cartao (pos 6) e o recebimento em partes tem origem VENDA: ja entram. NAO MEXE tambem em:
//   _vendedores, _comissao_grupos, _produto_grupo_comissao (classificacao dos produtos), _config_contas (★).
//
// Seguranca: para gravar, o nome da base tem que ser dito: --base rotaes_ensaio (ou admin no
// dia D). Assim nao se apaga a base errada por engano do .env.
//
// Uso (um comando por vez):
//   node src\scripts\ENSAIO-2-limpar-testes.js                                simulacao
//   node src\scripts\ENSAIO-2-limpar-testes.js --aplicar --base rotaes_ensaio
//   (com os orcamentos de teste: acrescente --orcamentos nos dois; sem lojistaId: --sem-loja)
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const op = k => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const APLICAR = args.includes('--aplicar');
const BASE = op('--base');
const COM_NFE = args.includes('--com-nfe');
const SEM_LOJA = args.includes('--sem-loja');
const ORIGENS = ['ACCESS', 'VENDA', 'OS', ...(args.includes('--orcamentos') ? ['ORCAMENTO'] : [])];
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const LOJA = { $in: [ARMACAO, String(ARMACAO)] };
const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reais = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dia = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '-');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const nomeBase = db.databaseName;
  console.log('Base:', nomeBase, APLICAR ? '· APLICAR' : '· simulação');
  if (APLICAR && BASE !== nomeBase) throw new Error('para gravar diga a base: --base ' + nomeBase + ' (confira se é a base certa)');

  // ---------------- boletas ----------------
  const bols = await db.collection('_boletas').find({ lojistaId: LOJA, origem: { $ne: 'ACCESS' } }).sort({ data: 1 }).toArray();
  const porOrigem = new Map();
  for (const b of bols) {
    const k = (b.origem || '(sem origem)') + ' / ' + (b.tipo || '') + ' / ' + (b.status || '');
    const x = porOrigem.get(k) || { n: 0, v: 0 }; x.n++; x.v += Number(b.valorTotal) || 0; porOrigem.set(k, x);
  }
  console.log('\n1) BOLETAS que não vieram do Access: ' + bols.length);
  for (const [k, x] of porOrigem) console.log('     ' + k.padEnd(40) + String(x.n).padStart(5) + '  R$ ' + reais(x.v));

  // ---------------- vendas ----------------
  const vendas = await db.collection('_vendas').find({ lojistaId: LOJA, origem: { $ne: 'ACCESS' } }).sort({ numero: 1 }).toArray();
  const comNfe = vendas.filter(v => v.nfe && String(v.nfe.chave || '').trim());
  const vendasApagar = COM_NFE ? vendas : vendas.filter(v => !comNfe.includes(v));
  console.log('\n2) VENDAS feitas na plataforma: ' + vendas.length);
  for (const v of vendas) {
    console.log('     nº ' + String(v.numero).padEnd(5) + dia(v.data).padEnd(12) + String(v.situacao || '').padEnd(3) + String(v.documento || '').padEnd(6)
      + String(v.cliente?.nome || '(balcão)').padEnd(34).slice(0, 34) + brl(v.totalLiquido).padStart(12)
      + (v.os?.numero ? '  OS ' + v.os.numero : '') + (comNfe.includes(v) ? '  ⚠ NF-e ' + (v.nfe.numero || '') + ' AUTORIZADA' + (COM_NFE ? '' : ' (fica)') : ''));
  }
  if (comNfe.length && !COM_NFE) console.log('     ⚠ ' + comNfe.length + ' venda(s) com NF-e autorizada NÃO serão apagadas (documento fiscal). Para apagar: --com-nfe');

  // ---------------- OS ----------------
  const idsVenda = vendasApagar.map(v => v._id);
  const oss = await db.collection('_ordens_servico').find({ lojistaId: LOJA }).sort({ numero: 1 }).toArray();
  // 31/10/2026: TODAS as OS da plataforma sao teste (as de venda com NF-e autorizada que fica, ficam junto)
  const vendaFica = id => comNfe.some(v => !COM_NFE && String(v._id) === String(id));
  const osApagar = oss.filter(o => o.origem !== 'ACCESS' && !(o.venda && vendaFica(o.venda.id)));
  const osFica = oss.filter(o => !osApagar.includes(o));
  console.log('\n3) OS da plataforma: ' + oss.length + ' · apagar (todas as de teste): ' + osApagar.length);
  for (const o of osApagar) console.log('     OS ' + String(o.numero).padEnd(7) + String(o.status || '').padEnd(3) + String(o.tipo || '').padEnd(4)
    + (o.venda ? 'venda ' + String(o.venda.numero ?? '-').padEnd(5) : 'sem venda  ') + (o.cliente?.nome || ''));
  for (const o of osFica) console.log('     (fica) OS ' + o.numero + ' · ' + (o.cliente?.nome || '') + ' · venda ' + (o.venda?.numero ?? '-'));

  // ---------------- fluxo ----------------
  const FLX = db.collection('_fluxo_projetado');
  const semLojaL = await FLX.find({ $or: [{ lojistaId: { $exists: false } }, { lojistaId: null }], origem: { $in: ORIGENS } }).sort({ vencimento: 1 }).toArray();
  const semLoja = semLojaL.length;
  const flxApagar = (await FLX.find({ lojistaId: LOJA, origem: { $in: ORIGENS } }).toArray()).concat(SEM_LOJA ? semLojaL : []);
  const grupos = new Map();
  for (const f of flxApagar) {
    const k = f.origem + ' / ' + f.status; const x = grupos.get(k) || { n: 0, v: 0 }; x.n++; x.v += Number(f.valor) || 0; grupos.set(k, x);
  }
  console.log('\n4) FLUXO a apagar (o FLUXO-1 traz o do Access de novo): ' + flxApagar.length);
  for (const [k, x] of [...grupos].sort()) console.log('     ' + k.padEnd(24) + String(x.n).padStart(6) + '  R$ ' + reais(x.v));
  if (semLoja) {
    console.log('   linhas dessas origens SEM lojistaId: ' + semLoja + (SEM_LOJA ? ' — entram na limpeza (--sem-loja)' : ' — FICAM (para apagar: --sem-loja)'));
    for (const f of semLojaL) console.log('     ' + String(f.origem).padEnd(10) + String(f.status || '').padEnd(10) + 'pos ' + String(f.pos ?? '-').padEnd(3)
      + dia(f.vencimento).padEnd(12) + reais(f.valor).padStart(12) + '  ' + String(f.historico || '').slice(0, 45));
  }
  const fica = await FLX.aggregate([{ $match: { lojistaId: LOJA, origem: { $nin: ORIGENS } } },
    { $group: { _id: { o: '$origem', s: '$status' }, n: { $sum: 1 }, v: { $sum: '$valor' } } }, { $sort: { _id: 1 } }]).toArray();
  if (fica.length) {
    console.log('   fluxo que FICA (outras origens):');
    for (const g of fica) console.log('     ' + (String(g._id.o || '(sem origem)') + ' / ' + g._id.s).padEnd(30) + String(g.n).padStart(6) + '  R$ ' + reais(g.v));
  }

  // ---------------- numeracao da OS ----------------
  let maiorAccess = 0;
  for await (const c of db.collection('_access_ordemservico_cabecalho').find({}).project({ 'NrOServiço': 1 })) {
    maiorAccess = Math.max(maiorAccess, Number(c['NrOServiço']) || 0);
  }
  const maiorFica = osFica.reduce((m, o) => Math.max(m, Number(o.numero) || 0), 0);
  const num = await db.collection('_numeracao').findOne({ lojistaId: LOJA, chave: 'OS' });
  const novoUlt = Math.max(maiorAccess, maiorFica);
  console.log('\n5) NUMERAÇÃO DA OS: maior no Access ' + (maiorAccess || '(espelho vazio: rode o VENDA-1)') + ' · contador hoje ' + (num ? num.ultimo : '(nenhum)')
    + ' → fica ' + novoUlt + ' (próxima OS ' + (novoUlt + 1) + ')');

  // ---------------- vendas: numeracao ----------------
  const ultimaFica = await db.collection('_vendas').find({ lojistaId: LOJA, _id: { $nin: idsVenda } }).sort({ numero: -1 }).limit(1).project({ numero: 1 }).toArray();
  console.log('6) NUMERAÇÃO DA VENDA: próxima venda será nº ' + ((ultimaFica[0]?.numero || 0) + 1));

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar --base ' + nomeBase); await mongoose.disconnect(); return; }
  if (!maiorAccess) throw new Error('espelho das OS do Access vazio: rode o VENDA-1-espelho-access antes; nada foi gravado');

  // ---------------- backup ----------------
  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const pasta = path.join(__dirname, 'backup'); fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, 'ENSAIO-2-' + nomeBase + '-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
  fs.writeFileSync(arq, EJSON.stringify({ base: nomeBase, boletas: bols, vendas: vendasApagar, os: osApagar, fluxo: flxApagar, numeracaoOS: num },
    null, 1, { relaxed: false }));
  console.log('\nBackup:', arq);

  // ---------------- apaga ----------------
  const r1 = await db.collection('_boletas').deleteMany({ _id: { $in: bols.map(b => b._id) }, origem: { $ne: 'ACCESS' } });
  const r2 = await db.collection('_vendas').deleteMany({ _id: { $in: idsVenda }, origem: { $ne: 'ACCESS' } });
  const r3 = await db.collection('_ordens_servico').deleteMany({ _id: { $in: osApagar.map(o => o._id) } });
  const r4 = await FLX.deleteMany({ _id: { $in: flxApagar.map(f => f._id) } });
  await db.collection('_numeracao').updateOne({ lojistaId: num ? num.lojistaId : ARMACAO, chave: 'OS' },
    { $set: { ultimo: novoUlt, atualizadoEm: new Date() } }, { upsert: true });
  console.log('✓ apagadas: boletas ' + r1.deletedCount + ' · vendas ' + r2.deletedCount + ' · OS ' + r3.deletedCount + ' · fluxo ' + r4.deletedCount);
  console.log('✓ numeração da OS: último ' + novoUlt + ' (próxima ' + (novoUlt + 1) + ')');
  console.log('Agora: FLUXO-1-importar-fluxo-access (traz o fluxo do Access) e o ENSAIO-1 (conferir).');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
