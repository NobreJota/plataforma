// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-11-importar-vendas-access.js
// Criado em: 22/10/2026
//
// As VENDAS JA FEITAS NO ACCESS no Relatorio de vendas da plataforma (Jorge, 21/10/2026: "essas vendas
// ja realizadas nao foram importadas"). O relatorio le a colecao _vendas, onde so havia as feitas na
// plataforma.
//
// Le do Access (o ano corrente):
//   Vendas_SaídaCupom       -> uma venda por cupom (NrCupom, Data + Hora, VrBruto, Desc, VrLiquido, Condição)
//   Vendas_SaídaCupomItens  -> os itens (CódigoProd, Descrição, Qte, VrVenda, VrCusto)
//   NFS_RegTítulos          -> o cliente da venda com cliente (VendPrzo_Chave = Chave: TpClient 1 = F, 2 = J,
//                              NrClient, CPartida = conta do cliente; "OC:nnnn" = material de OS)
// Grava em _vendas: origem ACCESS, situacao F (fechada), numero = nº do cupom no Access.
//   - Cupom sem cliente (Condição 0)  -> documento CUPOM, à vista
//   - Venda com cliente (VendPrzo_Chave) -> documento NFE (como na plataforma: "com cliente, na conta dele")
//   - Os TOTAIS sao os do cabecalho do cupom (no Access o VrTotalVenda do item as vezes esta errado):
//     bruto = soma qtd x unitario; desconto = bruto - VrLiquido; liquido = VrLiquido.
//
// NAO MEXE em lancamento, fluxo nem estoque: isso ja veio do Access (PLANO-8, FLUXO-1, COMPRA-22).
//   A venda do Access e so HISTORICO: na plataforma ela nao pode ser cancelada nem ganhar instalacao
//   (venda-api.js recusa origem ACCESS).
// Rodar de novo ATUALIZA (chave: origem ACCESS + nº do cupom) — no dia D, com o Access do dia.
// Se uma venda FEITA NA PLATAFORMA ja usa o mesmo numero, aquele cupom fica de fora e aparece na lista.
// A proxima venda da plataforma continua a numeracao (ultimo nº + 1).
// Alterado em: 22/10/2026 - cupons 1 a 5 do Access (02 e 03/01/2026) DESPREZADOS (Jorge: pouco valor, provavel
//   teste; os numeros sao das vendas 1-5 da plataforma). Ficam de fora sempre, sem alarme. Qualquer OUTRO
//   numero repetido continua como ✗ (e venda de verdade que precisa ser vista).
//
// Uso (um comando por vez):
//   node src\scripts\VENDA-11-importar-vendas-access.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"            simulacao
//   node src\scripts\VENDA-11-importar-vendas-access.js --mdb "C:\Armação\Dados\2026B\D\2026BD.mdb" --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const i = args.indexOf('--mdb');
const MDB = i >= 0 && args[i + 1] ? args[i + 1] : 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const APLICAR = args.includes('--aplicar');
const LOJA = new mongoose.Types.ObjectId('6892706a86509313e632f717');   // Armacao
const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cent = v => Math.round((Number(v) || 0) * 100);
const brl = c => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DESPREZADOS = new Set([1, 2, 3, 4, 5]);   // 22/10/2026 (Jorge): cupons de 02 e 03/01/2026, provavel teste
const MES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nomes = reader.getTableNames();
  const tab = n => { const t = nomes.find(x => limpo(x) === limpo(n)); if (!t) throw new Error('tabela não encontrada no Access: ' + n); return reader.getTable(t).getData(); };
  const cupons = tab('Vendas_SaídaCupom'), itensA = tab('Vendas_SaídaCupomItens'), titulos = tab('NFS_RegTítulos');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('Base:', db.databaseName, APLICAR ? '· APLICAR' : '· simulação', '· Access:', MDB, '\n');

  const porCupom = new Map();
  for (const it of itensA) { const k = Number(it.NrCupom); if (!porCupom.has(k)) porCupom.set(k, []); porCupom.get(k).push(it); }
  const porChave = new Map(titulos.map(t => [Number(t.Chave), t]));

  // clientes da plataforma (pelo codigo F/J + nº do Access; senao pela conta)
  const clis = await db.collection('_aux_clientes').find({ lojistaId: LOJA })
    .project({ codigo: 1, tipo: 1, nome: 1, cpfCnpj: 1, inscricaoEstadual: 1, ncontabil: 1, enderecoCobranca: 1 }).toArray();
  const porCodigo = new Map(clis.map(c => [String(c.codigo || '').toUpperCase(), c]));
  const porConta = new Map(clis.filter(c => c.ncontabil).map(c => [c.ncontabil, c]));

  // vendas da plataforma: os numeros ja usados (nao podem ser repetidos)
  const daPlataforma = new Map((await db.collection('_vendas').find({ lojistaId: LOJA, origem: { $ne: 'ACCESS' } })
    .project({ numero: 1, situacao: 1, data: 1 }).toArray()).map(v => [v.numero, v]));
  const jaImportadas = await db.collection('_vendas').countDocuments({ lojistaId: LOJA, origem: 'ACCESS' });

  const ops = [], desprezados = [], conflito = [], semCliente = [], ajusteBruto = [], semItens = [], porMes = new Map();
  let nCupom = 0, nNf = 0;
  for (const c of cupons.sort((a, b) => a.NrCupom - b.NrCupom)) {
    const nr = Number(c.NrCupom);
    if (DESPREZADOS.has(nr)) { desprezados.push(nr); continue; }
    if (daPlataforma.has(nr)) { conflito.push(nr); continue; }
    const d = c.Data instanceof Date ? c.Data : new Date(c.Data), h = c.Hora instanceof Date ? c.Hora : null;
    // data do Access = dia (meia-noite UTC) + hora local de Brasilia (UTC-3)
    const quando = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (h ? h.getUTCHours() : 12) + 3, h ? h.getUTCMinutes() : 0));
    const its = (porCupom.get(nr) || []).sort((a, b) => a['Código'] - b['Código']);
    if (!its.length) semItens.push(nr);
    const itens = its.map(it => {
      const q = Math.max(1, Math.round(Number(it.Qte) || 0)), pu = cent(it.VrVenda);
      return { _id: new mongoose.Types.ObjectId(), codigo: Number(it['CódigoProd']) || 0, codigoNota: '',
        descricao: String(it['Descrição'] || '').trim() || ('produto ' + it['CódigoProd']), descricaoTecnica: '', referencia: '', unidade: 'PC',
        ncm: '', csosn: '', cfop: '', quantidade: q, precoUnitario: pu, precoTabela: pu, desconto: 0, total: q * pu,
        custoUnitario: cent(it.VrCusto), precisaInstalacao: false };
    });
    const bruto = itens.reduce((s, x) => s + x.total, 0), liquido = cent(c.VrLiquido);
    const descontoGeral = Math.max(0, bruto - liquido);
    if (Math.abs(bruto - cent(c.VrBruto)) > 1 || bruto < liquido) ajusteBruto.push(nr + ' (cupom ' + brl(cent(c.VrBruto)) + ', itens ' + brl(bruto) + ')');

    // cliente
    const t = Number(c.VendPrzo_Chave) > 0 ? porChave.get(Number(c.VendPrzo_Chave)) : null;
    const prazo = String(c['Condição']).trim() === '1';
    const comCliente = !!t || prazo;
    let cliente = { id: null, codigo: '', tipo: '', nome: '', documento: '', ie: '', ncontabil: '', endereco: {} };
    let obs = 'Importada do Access (cupom nº ' + nr + '). Lançamento, fluxo e estoque vieram do Access.';
    if (t) {
      const cod = (Number(t.TpClient) === 2 ? 'J' : 'F') + Number(t.NrClient || 0);
      const cc = (Number(t.NrClient) ? porCodigo.get(cod) : null) || porConta.get(String(t.CPartida || '').trim());
      if (cc) {
        const e = cc.enderecoCobranca || {};
        cliente = { id: cc._id, codigo: cc.codigo || '', tipo: cc.tipo || '', nome: cc.nome || '', documento: cc.cpfCnpj || '',
          ie: cc.inscricaoEstadual || '', ncontabil: cc.ncontabil || '',
          endereco: { logradouro: e.logradouro || '', numero: e.numero || '', complemento: e.complemento || '',
            bairro: e.bairro || '', cidade: e.cidade || '', uf: e.uf || '', cep: e.cep || '' } };
      } else {
        cliente.codigo = Number(t.NrClient) ? cod : ''; cliente.ncontabil = String(t.CPartida || '').trim();
        cliente.nome = '(cliente do Access ' + (cliente.codigo || cliente.ncontabil) + ')';
        semCliente.push(nr + ' ' + (cliente.codigo || '') + ' conta ' + cliente.ncontabil);
      }
      const os = /^OC:\s*(\d+)/i.exec(String(t.NrNota || ''));
      if (os) obs += ' Material da OS nº ' + os[1] + '.';
    } else if (comCliente) semCliente.push(nr + ' (prazo sem título no NFS_RegTítulos)');
    if (Number(c['NrDevolução']) > 0) obs += ' Devolução nº ' + c['NrDevolução'] + ' no Access.';

    const documento = comCliente ? 'NFE' : 'CUPOM';
    if (documento === 'NFE') nNf++; else nCupom++;
    const mk = quando.getUTCFullYear() + '-' + String(quando.getUTCMonth() + 1).padStart(2, '0');
    const pm = porMes.get(mk) || { n: 0, v: 0 }; pm.n++; pm.v += liquido; porMes.set(mk, pm);

    ops.push({ updateOne: { filter: { lojistaId: LOJA, origem: 'ACCESS', nrCupomAccess: nr }, upsert: true, update: {
      $set: { numero: nr, situacao: 'F', data: quando, fechadaEm: quando, operador: String(c.Operador ?? ''),
        local: Number(c.Local) === 1 ? 'CAIXA' : 'BALCAO', condicao: prazo ? 'PRAZO' : 'VISTA', documento, cliente, ocCliente: '',
        itens, totalBruto: bruto, totalDesconto: descontoGeral, descontoGeral, totalServico: 0, totalLiquido: liquido,
        pagamentos: [], contabil: { contaCliente: cliente.ncontabil || '', contaReceita: '', boletaId: null, diaBalcao: null },
        nfe: { numero: null, serie: '002', chave: '', protocolo: '', emitidaEm: null, natureza: '' },
        instalacao: null, os: { numero: null, id: null }, observacao: obs,
        canceladaEm: null, motivoCancelamento: '', atualizadoEm: new Date() },
      $setOnInsert: { lojistaId: LOJA, origem: 'ACCESS', nrCupomAccess: nr, criadoEm: new Date() } } } });
  }

  console.log('Access: ' + cupons.length + ' cupons, ' + itensA.length + ' itens · na plataforma hoje: ' + jaImportadas + ' já importadas, '
    + daPlataforma.size + ' feitas na plataforma\n');
  console.log('Por mês (líquido) — compare com o Access:');
  for (const [k, x] of [...porMes].sort()) console.log('   ' + MES[Number(k.slice(5))] + '/' + k.slice(0, 4) + String(x.n).padStart(6) + ' vendas   R$ ' + brl(x.v).padStart(14));
  const tot = [...porMes.values()].reduce((s, x) => s + x.v, 0);
  console.log('   total ' + String(ops.length).padStart(8) + ' vendas   R$ ' + brl(tot).padStart(14));
  console.log('\n   cupom (balcão, sem cliente): ' + nCupom + ' · com cliente (NF/prazo/OS): ' + nNf);
  if (semCliente.length) console.log('\n⚠ ' + semCliente.length + ' venda(s) com cliente que não achei no cadastro (entram com o código/conta do Access): '
    + semCliente.slice(0, 15).join(' · ') + (semCliente.length > 15 ? ' …' : ''));
  if (ajusteBruto.length) console.log('\n• ' + ajusteBruto.length + ' cupom(ns) em que a soma dos itens ≠ bruto do cupom (o LÍQUIDO fica o do cupom): '
    + ajusteBruto.slice(0, 8).join(' · ') + (ajusteBruto.length > 8 ? ' …' : ''));
  if (semItens.length) console.log('\n• ' + semItens.length + ' cupom(ns) sem itens: ' + semItens.slice(0, 20).join(', '));
  if (desprezados.length) console.log('\n• cupons desprezados (decisão de 22/10): ' + desprezados.join(', '));
  if (conflito.length) console.log('\n✗ ' + conflito.length + ' cupom(ns) FICAM DE FORA: o número já é de uma venda feita na plataforma: '
    + conflito.slice(0, 30).join(', ') + (conflito.length > 30 ? ' …' : ''));
  const maior = Math.max(0, ...cupons.map(c => Number(c.NrCupom)), ...daPlataforma.keys());
  console.log('\nA próxima venda da plataforma será a nº ' + (maior + 1) + '.');

  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); await mongoose.disconnect(); return; }
  let ins = 0, mod2 = 0;
  for (let k = 0; k < ops.length; k += 500) {
    const r = await db.collection('_vendas').bulkWrite(ops.slice(k, k + 500), { ordered: false });
    ins += r.upsertedCount || 0; mod2 += r.modifiedCount || 0;
  }
  console.log('\n✓ gravadas: ' + ins + ' novas, ' + mod2 + ' atualizadas');
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
