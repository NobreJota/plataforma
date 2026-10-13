// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-2-tecnicos-e-numeracao.js
// Criado em: 13/10/2026
// Alterado em: 13/10/2026 - a numeracao vem SO do OrdemServico__Cabecalho (a tabela atual).
//              As copias (Cabecalho_, _2025, _X, canceladas) tem numeros de um ciclo antigo
//              (ate 32767, o limite do campo inteiro do Access) e deram "ultima OS = 32767".
//              Agora o contador e GRAVADO (nao so aumentado), corrigindo o 32767.
//              Mostra tambem o que ja existe em _tecnicos (o cadastro ja tinha os 7).
//
// Prepara a OS na plataforma (so a Armacao):
//
// 1) CADASTRO DE TECNICOS (_tecnicos)
//    - os do Access (OrdemServico_Tecnico: Numero, Tecnico, Cta_Tecnico, Cta_Receita)
//    - e os subtitulos ATIVOS de 2.06.001 que nao estao no Access (origem PLANO)
//    Tecnico ja cadastrado (mesma conta 2.06.001) fica como esta. Entram ATIVOS;
//    quem nao trabalha mais, inativar na tela Servico > Tecnicos.
//    A receita e a conta 4.03.002 com o mesmo final (avisa se nao existir no plano).
//
// 2) NUMERACAO DA OS: continua o Access. Le o maior NrOServico de todas as tabelas
//    de cabecalho (inclusive canceladas e copias) e grava em
//    _numeracao { lojistaId, chave: 'OS', ultimo }.
//    OS ja criadas na plataforma com numero que BATE com o Access: listadas.
//    So a tabela atual (OrdemServico__Cabecalho) conta; as copias sao de outro ciclo.
//    Com --renumerar elas ganham numero novo (depois do Access) e a venda ligada
//    (_vendas.os.numero) acompanha. Backup EJSON antes.
//
// 3) TIPO: OS da plataforma com tipo INSTALACAO passam a VI (VI venda/instalacao,
//    C conserto, G garantia).
//
// Uso (um comando por vez):
//   node src\scripts\OS-2-tecnicos-e-numeracao.js                      simulacao
//   node src\scripts\OS-2-tecnicos-e-numeracao.js --aplicar
//   node src\scripts\OS-2-tecnicos-e-numeracao.js --aplicar --renumerar
//   opcao: --mdb "C:\Armação\Dados\2026B\2026B.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const RENUMERAR = args.includes('--renumerar');
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const txt = v => (v === null || v === undefined ? '' : String(v).trim());

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nomes = reader.getTableNames();

  // ---- Access: tecnicos ----
  const nTec = nomes.find(n => limpo(n) === 'ordemservico_tecnico');
  if (!nTec) throw new Error('tabela OrdemServiço_Técnico não encontrada');
  const tecAccess = reader.getTable(nTec).getData().map(l => ({
    numero: Number(l['Número']) || 0, nome: txt(l['Técnico']),
    contaTecnico: txt(l['Cta_Técnico']), contaReceita: txt(l['Cta_Receita']),
  })).filter(x => x.nome);

  // ---- Access: maior numero de OS (so a tabela atual) ----
  const tabsCab = nomes.filter(n => /cabecalho/.test(limpo(n)) && /ordemservico/.test(limpo(n)) && !/proposta/.test(limpo(n)));
  const maiorPorTabela = [];
  for (const n of tabsCab) {
    const tab = reader.getTable(n);
    if (!tab.getColumnNames().includes('NrOServiço')) continue;
    let m = 0, ult = 0, ultData = null;
    for (const l of tab.getData()) {
      const nr = Number(l['NrOServiço']) || 0;
      m = Math.max(m, nr);
      const d = l['Data'] || l['DataCancel'];
      if (d instanceof Date && (!ultData || d > ultData)) { ultData = d; ult = nr; }
    }
    maiorPorTabela.push({ n, m, ult, ultData });
  }
  const atual = maiorPorTabela.find(x => limpo(x.n) === 'ordemservico__cabecalho');
  if (!atual) throw new Error('tabela OrdemServiço__Cabeçalho não encontrada');
  const maiorAccess = atual.m;

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Banco:', db.databaseName, '· Access:', MDB);

  // ---- plano ----
  const subs = await db.collection('_contasubtitulos').find({ lojistaId: ARMACAO,
    codigo: { $regex: '^(2\\.06\\.001|4\\.03\\.002)\\.\\d+$' } }).project({ codigo: 1, nome: 1, ativo: 1 }).toArray();
  const noPlano = new Map(subs.map(s => [s.codigo, s]));
  const cadastrados = await db.collection('_tecnicos').find({ lojistaId: ARMACAO }).toArray();
  const jaCad = new Set(cadastrados.map(x => x.contaTecnico));
  console.log('\n=== 0) _tecnicos hoje: ' + cadastrados.length + ' ===');
  cadastrados.forEach(x => console.log('  ' + String(x.numero ?? '-').padStart(3) + '  ' + String(x.nome || '').padEnd(20)
    + String(x.contaTecnico || '').padEnd(15) + String(x.contaReceita || '').padEnd(15)
    + (x.ativo === false ? 'inativo  ' : 'ativo    ') + 'origem ' + (x.origem || '-')
    + ' · criado ' + (x.criadoEm ? new Date(x.criadoEm).toISOString().slice(0, 10) : '-')));
  if (cadastrados[0]) console.log('  campos do 1º:', Object.keys(cadastrados[0]).join(', '));

  const novos = [];
  console.log('\n=== 1) técnicos ===');
  for (const t of tecAccess) {
    const receita = t.contaReceita || ('4.03.002.' + t.contaTecnico.split('.').pop());
    const avisos = [];
    if (!noPlano.has(t.contaTecnico)) avisos.push(t.contaTecnico + ' não está no plano');
    if (!noPlano.has(receita)) avisos.push(receita + ' não está no plano');
    const ja = jaCad.has(t.contaTecnico);
    console.log('  Access ' + String(t.numero).padStart(3) + '  ' + t.nome.padEnd(20) + t.contaTecnico.padEnd(15) + receita.padEnd(15)
      + (ja ? 'já cadastrado' : 'ENTRA') + (avisos.length ? '   ⚠ ' + avisos.join(' · ') : ''));
    if (!ja && t.contaTecnico) { novos.push({ numero: t.numero, nome: t.nome, contaTecnico: t.contaTecnico, contaReceita: receita, origem: 'ACCESS' }); jaCad.add(t.contaTecnico); }
  }
  let prox = Math.max(0, ...tecAccess.map(t => t.numero));
  for (const s of subs.filter(s => s.codigo.startsWith('2.06.001.') && s.ativo !== false)) {
    if (jaCad.has(s.codigo)) continue;
    const receita = '4.03.002.' + s.codigo.split('.').pop();
    console.log('  Plano       ' + String(s.nome || '').padEnd(20) + s.codigo.padEnd(15) + receita.padEnd(15) + 'ENTRA (só no plano)'
      + (noPlano.has(receita) ? '' : '   ⚠ ' + receita + ' não está no plano'));
    novos.push({ numero: ++prox, nome: String(s.nome || '').trim(), contaTecnico: s.codigo, contaReceita: noPlano.has(receita) ? receita : '', origem: 'PLANO' });
    jaCad.add(s.codigo);
  }
  console.log('  a cadastrar:', novos.length);

  // ---- numeracao ----
  console.log('\n=== 2) numeração da OS ===');
  maiorPorTabela.forEach(x => console.log('  ' + x.n.padEnd(36) + ' maior ' + String(x.m).padStart(6)
    + ' · a mais recente: ' + x.ult + (x.ultData ? ' em ' + x.ultData.toISOString().slice(0, 10) : '')
    + (x === atual ? '   ← vale esta' : '')));
  console.log('  maior OS no Access ......', maiorAccess);
  const osPlat = await db.collection('_ordens_servico').find({ lojistaId: ARMACAO }).sort({ numero: 1 })
    .project({ numero: 1, tipo: 1, status: 1, venda: 1, cliente: 1 }).toArray();
  const batem = osPlat.filter(o => o.numero <= maiorAccess);
  console.log('  OS na plataforma ........', osPlat.length, '· com número que bate com o Access:', batem.length);
  batem.forEach(o => console.log('     OS ' + o.numero + ' · ' + (o.cliente?.nome || '') + ' · venda ' + (o.venda?.numero ?? '-') + ' · ' + o.status));
  const maiorPlat = osPlat.reduce((m, o) => Math.max(m, o.numero || 0), 0);
  let ultimo = Math.max(maiorAccess, maiorPlat);
  const renum = [];
  if (batem.length) {
    if (RENUMERAR) batem.forEach(o => renum.push({ o, novo: ++ultimo }));
    else console.log('  → para dar número novo a elas: --renumerar');
  }
  renum.forEach(r => console.log('     OS ' + r.o.numero + ' → ' + r.novo));
  const numAtual = await db.collection('_numeracao').findOne({ lojistaId: ARMACAO, chave: 'OS' });
  console.log('  contador gravado hoje ....', numAtual ? numAtual.ultimo : '(nenhum)');
  console.log('  próxima OS será ..........', ultimo + 1);

  // ---- tipo ----
  const instal = osPlat.filter(o => o.tipo === 'INSTALACAO').length;
  console.log('\n=== 3) tipo ===\n  INSTALACAO → VI:', instal);

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar' + (batem.length ? ' (e --renumerar)' : '')); return; }

  const agora = new Date();
  if (novos.length) {
    await db.collection('_tecnicos').insertMany(novos.map(n => ({
      lojistaId: ARMACAO, numero: n.numero, nome: n.nome, apelido: '', cpf: '', rg: '', nascimento: '',
      mei: { cnpj: '', razaoSocial: '', inscricaoMunicipal: '' }, telefone: '', celular: '', whatsapp: '', email: '',
      endereco: { logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', cep: '' },
      pix: { tipo: '', chave: '' }, banco: { banco: '', agencia: '', conta: '' },
      pagamento: { percVI: 0, percC: 0, valorG: 0 }, observacao: '',
      contaTecnico: n.contaTecnico, contaReceita: n.contaReceita, ativo: true, origem: n.origem,
      criadoEm: agora, atualizadoEm: agora })));
    console.log('\nTécnicos cadastrados:', novos.length);
  }
  if (renum.length) {
    const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
    const pasta = path.join(__dirname, 'backup');
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'OS-2-ordens-antes-' + agora.toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
    const docs = await db.collection('_ordens_servico').find({ _id: { $in: renum.map(r => r.o._id) } }).toArray();
    fs.writeFileSync(arq, EJSON.stringify(docs, null, 1, { relaxed: false }));
    console.log('Backup:', arq);
    for (const r of renum) {
      await db.collection('_ordens_servico').updateOne({ _id: r.o._id, lojistaId: ARMACAO },
        { $set: { numero: r.novo, numeroAntigo: r.o.numero, atualizadoEm: agora } });
      if (r.o.venda?.id) await db.collection('_vendas').updateOne({ _id: r.o.venda.id, lojistaId: ARMACAO },
        { $set: { 'os.numero': r.novo } });
    }
    console.log('OS renumeradas:', renum.length);
  }
  await db.collection('_numeracao').updateOne({ lojistaId: ARMACAO, chave: 'OS' },
    { $set: { ultimo, atualizadoEm: agora } }, { upsert: true });
  console.log('Numeração gravada: última OS =', ultimo);
  if (instal) {
    const r = await db.collection('_ordens_servico').updateMany({ lojistaId: ARMACAO, tipo: 'INSTALACAO' }, { $set: { tipo: 'VI' } });
    console.log('Tipo VI:', r.modifiedCount);
  }
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
