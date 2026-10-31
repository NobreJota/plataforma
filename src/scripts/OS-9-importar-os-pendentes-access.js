// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-9-importar-os-pendentes-access.js
// Criado em: 31/10/2026 (Jorge — simulacao do dia D)
//
// TRAZ AS OS PENDENTES DO ACCESS (Status P) para a plataforma (_ordens_servico), com o MESMO numero, para
// aparecerem na Agenda, na Lista geral e na Nova OS e serem fechadas (liquidar), canceladas ou apagadas aqui.
// Decisao do Jorge (31/10): "Importa e eu analiso se vai deletar, liquidar ou nao" — muitas VI sao aquecedores
// vendidos ha tempo esperando a obra; as recentes esperam a palavra do cliente.
//
// Le o ESPELHO do Access (VENDA-1-espelho-access precisa ter rodado antes):
//   _access_ordemservico_cabecalho   (Status P)  -> numero, tipo (VI / C / G), cliente, endereco, tecnico, dia previsto
//   _access_ordemservico_complemento             -> servico, defeito, produto, observacao (os itens)
//   _access_vendas_saidacupomitens   (VI)        -> os produtos do cupom da venda (quando o cupom e do ano)
// Liga: cliente (_aux_clientes pela conta 1.03/1.04, ou F/J + numero) · tecnico (_tecnicos pela conta 2.06.001.NNN)
//       · venda do Access (_vendas origem ACCESS, nº = cupom, mesmo ano) para a VI.
// A OS entra com origem ACCESS, status P, sem valor (mao de obra / combinado se acertam aqui, na OS).
// NAO traz o consignado do Access (so 1 OS tem: aparece no aviso). NAO mexe no estoque, razao ou fluxo.
// 31/10/2026 (opcao A do Jorge): DATA DE ESPERA do Access (o mesmo dia previsto em 8 ou mais OS pendentes, ex.:
//   30/06/2025 e 30/11/2026 = "aguardando") entra como NAO PROGRAMADA (sem dia); fica escrita na observacao.
// Nao repete: OS cujo numero ja existe na plataforma fica de fora (pode rodar de novo).
// O ENSAIO-2 (versao 31/10) NAO apaga estas OS (origem ACCESS).
//
// Uso (um comando por vez):
//   node src\scripts\OS-9-importar-os-pendentes-access.js                                simulacao (lista as OS)
//   node src\scripts\OS-9-importar-os-pendentes-access.js --aplicar --base rotaes_ensaio
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
const UF = { 'espírito santo': 'ES', 'espirito santo': 'ES', 'rio de janeiro': 'RJ', 'minas gerais': 'MG', 'bahia': 'BA', 'são paulo': 'SP', 'sao paulo': 'SP' };
const txt = v => { const s = String(v ?? '').trim(); return s === 'x' || s === 'X' || s === '0' || s === 'null' || s === 'nenhum' ? '' : s; };
const dataOk = d => { const x = d ? new Date(d) : null; return x && !isNaN(x) && x.getFullYear() > 1950 ? x : null; };
const dia = d => (d ? new Date(d).toLocaleDateString('pt-BR') : '-');
const meioDia = d => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);   // a data do Access, as 12h

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const nomeBase = db.databaseName;
  console.log('Base:', nomeBase, APLICAR ? '· APLICAR' : '· simulação');
  if (APLICAR && BASE !== nomeBase) throw new Error('para gravar diga a base: --base ' + nomeBase);

  const cabs = await db.collection('_access_ordemservico_cabecalho').find({ Status: 'P' }).sort({ 'NrOServiço': 1 }).toArray();
  if (!cabs.length) throw new Error('nenhuma OS pendente no espelho: rode o VENDA-1-espelho-access antes');
  const nums = cabs.map(c => c['NrOServiço']);
  const comps = await db.collection('_access_ordemservico_complemento').find({ NrOS: { $in: nums } }).toArray();
  const compDe = n => comps.filter(c => c.NrOS === n);
  const ja = new Set((await db.collection('_ordens_servico').find({ lojistaId: LOJA, numero: { $in: nums } }).project({ numero: 1 }).toArray()).map(o => o.numero));
  const tecnicos = await db.collection('_tecnicos').find({ lojistaId: LOJA }).toArray();
  const prods = new Map((await db.collection('arquivo_docs').find({ loja_id: LOJA, codigo: { $in: [...new Set(comps.map(c => Number(c.CodProduto)).filter(Boolean))] } })
    .project({ codigo: 1, descricao: 1 }).toArray()).map(p => [Number(p.codigo), p.descricao || '']));

  // datas de espera: o mesmo dia previsto em 8 ou mais OS pendentes
  const contaDia = new Map();
  for (const a of cabs) { const d = dataOk(a.DiaPrevisto); if (d) { const k = d.toISOString().slice(0, 10); contaDia.set(k, (contaDia.get(k) || 0) + 1); } }
  const ESPERA = new Set([...contaDia].filter(([, q]) => q >= 8).map(([k]) => k));
  console.log('Datas de espera do Access (entram sem dia): ' + ([...ESPERA].map(k => k.split('-').reverse().join('/') + ' (' + contaDia.get(k) + ' OS)').join(', ') || 'nenhuma'));

  const novas = [], avisos = [];
  for (const a of cabs) {
    const n = a['NrOServiço'];
    if (ja.has(n)) { avisos.push('OS ' + n + ': já existe na plataforma (fica de fora)'); continue; }
    const tipo = ['VI', 'C', 'G'].includes(a.Tipo) ? a.Tipo : 'C';
    // cliente
    let cli = null;
    if (txt(a.CtaCliente)) cli = await db.collection('_aux_clientes').findOne({ lojistaId: LOJA, ncontabil: txt(a.CtaCliente) });
    if (!cli && a.Class && a.NrCliente) cli = await db.collection('_aux_clientes').findOne({ lojistaId: LOJA, codigo: String(a.Class).toUpperCase() + a.NrCliente });
    if (!cli) avisos.push('OS ' + n + ': cliente ' + (a.Cliente || '') + ' (' + (a.CtaCliente || '') + ') não achado no cadastro — entra só com o nome');
    // tecnico
    const tec = tecnicos.find(t => String(t.contaTecnico) === txt(a['CtaTécnico']));
    if (txt(a['CtaTécnico']) && !tec) avisos.push('OS ' + n + ': técnico ' + a['CtaTécnico'] + ' não está no cadastro de técnicos — entra sem técnico');
    // itens: complemento + (VI) produtos do cupom do ano
    const cp = compDe(n);
    const itens = cp.map(c => ({ codigo: Number(c.CodProduto) || 0, descricao: prods.get(Number(c.CodProduto)) || txt(c['Serviço']) || 'produto',
      servico: txt(c['Serviço']) || (tipo === 'VI' ? 'Instalação' : 'Conserto'), observacao: [txt(c.Defeito), txt(c.Conserto), txt(c['Observação'])].filter(Boolean).join(' · ') }));
    let venda = null;
    const dOS = dataOk(a.Data);
    if (tipo === 'VI' && Number(a.NrCupom)) {
      const v = await db.collection('_vendas').findOne({ lojistaId: LOJA, origem: 'ACCESS', numero: Number(a.NrCupom) });
      // o nº do cupom recomeca a cada ano: so liga se a venda e de perto da OS
      if (v && dOS && Math.abs(new Date(v.data || v.fechadaEm) - dOS) < 40 * 864e5) {
        venda = { id: v._id, numero: v.numero };
        if (!itens.length) for (const i of v.itens || []) itens.push({ codigo: Number(i.codigo) || 0, descricao: i.descricao || '', servico: 'Instalação', observacao: '' });
      }
    }
    const servico = (cp.map(c => txt(c['Serviço'])).find(Boolean)) || (tipo === 'VI' ? 'Instalação' : 'Conserto');
    const fone = [a.FoneRes, a.FoneComal].map(txt).find(Boolean) || '';
    const diaA = dataOk(a.DiaPrevisto);
    const espera = diaA && ESPERA.has(diaA.toISOString().slice(0, 10));
    const diaP = espera ? null : diaA;
    const agora = new Date();
    const doc = {
      lojistaId: ARMACAO, numero: n, tipo, status: 'P', data: dOS ? meioDia(dOS) : agora,
      origem: 'ACCESS', importadoEm: agora, nrCupomAccess: Number(a.NrCupom) || null,
      venda, valorServico: 0, servicoContabilizado: false,
      cliente: cli ? { id: cli._id, codigo: cli.codigo || '', tipo: cli.tipo || '', nome: cli.nome || '', documento: cli.cpfCnpj || '', ncontabil: cli.ncontabil || '' }
                   : { id: null, codigo: '', tipo: a.Class === 'J' ? 'PJ' : 'PF', nome: txt(a.Cliente), documento: '', ncontabil: txt(a.CtaCliente) },
      endereco: { logradouro: txt(a.End), numero: '', complemento: '', bairro: txt(a.Bairro), cidade: txt(a.Cidade),
                  uf: UF[txt(a.Estado).toLowerCase()] || txt(a.Estado).slice(0, 2).toUpperCase(), cep: txt(a.Cep).replace(/\D/g, '') },
      edificio: txt(a['Edifício']), apto: txt(a.Apto), pontoReferencia: txt(cp[0] && cp[0].PontoRefer),
      telefone: fone, celular: txt(a.Celular), observacao: 'Importada do Access (OS ' + n + ', aberta em ' + dia(dOS) + ')'
        + (espera ? '; no Access estava com dia de espera ' + dia(diaA) + ' (aguardando)' : '') + '.',
      tecnicoConta: tec ? tec.contaTecnico : '', tecnicoNome: tec ? (tec.apelido || tec.nome || '') : '',
      diaPrevisto: diaP ? meioDia(diaP) : null, horaIni: '', horaFim: '',
      servicoDescricao: servico, defeito: tipo === 'VI' ? '' : servico,
      itens, consignados: [], fotos: [], parteTecnico: 0, parteLoja: 0,
      criadoEm: agora, atualizadoEm: agora,
    };
    novas.push(doc);
  }

  // consignado do Access nas pendentes (nao vem): so avisa
  const cons = await db.collection('_access_ordemservico_consignado').find({}).limit(1).toArray().catch(() => []);
  if (!cons.length) avisos.push('consignado do Access não vem (só a OS 9813 tem: 1 usina s/timer, cód. 5124) — acertar na OS se precisar');

  const porTipo = novas.reduce((m, o) => (m[o.tipo] = (m[o.tipo] || 0) + 1, m), {});
  console.log('\nOS pendentes no Access: ' + cabs.length + ' · entram agora: ' + novas.length + ' ' + JSON.stringify(porTipo));
  for (const o of novas) {
    console.log('  OS ' + String(o.numero).padEnd(6) + o.tipo.padEnd(3) + dia(o.data).padEnd(11) + (o.cliente.nome || '').padEnd(32).slice(0, 32) + ' '
      + (o.tecnicoNome || '(sem técnico)').padEnd(10).slice(0, 10) + ' dia ' + (o.diaPrevisto ? dia(o.diaPrevisto) : 'sem dia').padEnd(11)
      + (o.venda ? 'venda ' + o.venda.numero : o.nrCupomAccess ? 'cupom ' + o.nrCupomAccess + ' (sem venda no ano)' : '').padEnd(26)
      + String(o.itens.length) + ' item(ns) · ' + o.servicoDescricao.slice(0, 40));
  }
  if (avisos.length) { console.log('\nAvisos:'); avisos.forEach(a => console.log('  ⚠ ' + a)); }

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar --base ' + nomeBase); await mongoose.disconnect(); return; }
  if (novas.length) {
    const r = await db.collection('_ordens_servico').insertMany(novas, { ordered: false });
    console.log('\n✓ OS importadas: ' + r.insertedCount + ' (origem ACCESS, pendentes). Veja em Serviço > Lista geral.');
  } else console.log('\nNada a importar.');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
