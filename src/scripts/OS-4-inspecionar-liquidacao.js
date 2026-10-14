// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-4-inspecionar-liquidacao.js
// Criado em: 13/10/2026
//
// SO LE. Nao grava nada.
//
// Antes de montar o RECEBIMENTO DA OS na plataforma (etapa 2b), ver como o Access
// lancou as OS liquidadas, para seguir as mesmas contas:
//   - pega as ultimas OS liquidadas (Status L) de cada tipo (VI, C, G) no
//     OrdemServico__Cabecalho, com Chave_Close
//   - de cada uma mostra: OrdemServico_Control (VrMObra, ValorShut, Mat*), Receitas
//     (M material / O mao de obra), ValorMaoObraCliente, TabelaProducao (tecnico,
//     VrPrinc...), Material_Consignado, MaterialVendDevolv, linhas do
//     Contab_Caixa_FluxoServico com o numero da OS
//   - e as BOLETAS da plataforma importadas do Access (PLANO-8, campo accessChave)
//     com a Chave_Close da OS e as chaves do fluxo de servico: perna + contrapartidas
//
// Gera tambem OS-4-inspecionar-liquidacao.txt (para me mandar).
//
// Uso:
//   node src\scripts\OS-4-inspecionar-liquidacao.js
//   opcao: --por-tipo 4      (quantas OS de cada tipo; padrao 4)
//   opcao: --os 13747        (so essa OS)
//   opcao: --mdb "C:\Armação\Dados\2026B\2026B.mdb"
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const opc = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const MDB = opc('--mdb') || 'C:\\Armação\\Dados\\2026B\\2026B.mdb';
const POR_TIPO = Number(opc('--por-tipo')) || 4;
const SO_OS = Number(opc('--os')) || 0;
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const SAIDA = path.join(process.cwd(), 'OS-4-inspecionar-liquidacao.txt');

const limpo = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const linhas = [];
const out = (...a) => { const t = a.join(' '); console.log(t); linhas.push(t); };
const curto = v => {
  if (v === null || v === undefined) return '·';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > 40 ? s.slice(0, 40) + '…' : s;
};
const brl = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  if (!fs.existsSync(MDB)) throw new Error('Access não encontrado: ' + MDB);
  const mod = require('mdb-reader');
  const reader = new (mod.default || mod)(fs.readFileSync(MDB));
  const nomes = reader.getTableNames();
  const tab = alvo => { const n = nomes.find(x => limpo(x) === limpo(alvo)); return n ? reader.getTable(n).getData() : []; };

  const cab = tab('OrdemServiço__Cabeçalho');
  const control = tab('OrdemServiço_Control');
  const receitas = tab('OrdemServiço_Receitas');
  const mobra = tab('OrdemServiço_ValorMãoObraCliente');
  const producao = tab('OrdemServiço_TabelaProdução');
  const consig = tab('OrdemServiço_Material_Consignado');
  const devolv = tab('OrdemServiço_MaterialVendDevolv');
  const fluxoServ = tab('Contab_Caixa_FluxoServiço');

  // OS escolhidas
  let escolhidas;
  if (SO_OS) escolhidas = cab.filter(o => Number(o['NrOServiço']) === SO_OS);
  else {
    const liq = cab.filter(o => o['Status'] === 'L' && Number(o['Chave_Close']) > 0)
      .sort((a, b) => Number(b['NrOServiço']) - Number(a['NrOServiço']));
    const tipos = [...new Set(liq.map(o => o['Tipo']))];
    out('Tipos entre as liquidadas:', tipos.map(t => t + ' ' + liq.filter(o => o['Tipo'] === t).length).join(' · '));
    escolhidas = tipos.flatMap(t => liq.filter(o => o['Tipo'] === t).slice(0, POR_TIPO));
  }
  if (!escolhidas.length) throw new Error('nenhuma OS encontrada');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  out('Banco:', db.databaseName, '· Access:', MDB);

  const mostrarBoleta = async (chave, rotulo) => {
    const bs = await db.collection('_boletas').find({ lojistaId: ARMACAO, accessChave: Number(chave) }).toArray();
    if (!bs.length) { out('    ' + rotulo + ' chave ' + chave + ': (sem boleta na plataforma)'); return; }
    for (const b of bs) {
      out('    ' + rotulo + ' chave ' + chave + ' · ' + b.codigo + ' · ' + b.tipo + ' · ' + curto(b.data) + ' · ' + (b.historico || ''));
      out('       perna  ' + String(b.bancoCodigo).padEnd(15) + String(b.bancoNome || '').slice(0, 30).padEnd(31) + brl(b.valorTotal).padStart(12));
      for (const c of b.contrapartidas || []) {
        out('       contra ' + String(c.codigoConta).padEnd(15) + String(c.nomeConta || '').slice(0, 30).padEnd(31) + brl(c.valor).padStart(12)
          + '  ' + String(c.historico || '').slice(0, 40));
      }
    }
  };

  for (const o of escolhidas) {
    const nr = Number(o['NrOServiço']);
    out('\n' + '='.repeat(90));
    out('OS ' + nr + ' · tipo ' + o['Tipo'] + ' · status ' + o['Status'] + ' · ' + curto(o['Data']) + ' · cupom ' + curto(o['NrCupom'])
      + ' · ' + curto(o['Cliente']) + ' (' + curto(o['CtaCliente']) + ')');
    out('  técnico ' + curto(o['NrTécnico']) + ' ' + curto(o['CtaTécnico']) + ' · previsto ' + curto(o['DiaPrevisto'])
      + ' · liquidação ' + curto(o['DataLiquidação']) + ' · Chave_Close ' + curto(o['Chave_Close']));
    const mostrar = (rot, rows, cols) => rows.forEach(r => out('  ' + rot.padEnd(10) + cols.map(c => c + '=' + curto(r[c])).join(' | ')));
    mostrar('Control', control.filter(r => Number(r['OServiço']) === nr),
      ['data', 'NrCupom', 'MatVend', 'MatConsig', 'MatGarantia', 'MatAvulso', 'MatPeças', 'Fluxo', 'MObra', 'Tipo', 'VrMObra', 'ValorShut', 'TipoOS']);
    mostrar('Receita', receitas.filter(r => Number(r['OrdemServiço']) === nr), ['Dta', 'Tipo', 'ValorCobrado']);
    mostrar('MObraCli', mobra.filter(r => Number(r['OrdemServiço']) === nr), ['DataEmissão', 'Tipo', 'ValorMObraCliente']);
    mostrar('Produção', producao.filter(r => Number(r['NrOrdemServiço']) === nr),
      ['NmTécnico', 'DataConclusão', 'M', 'VrPrinc', 'Assist1', 'VrHum', 'Assist2', 'VrDois', 'Excesso', 'Retorno', 'TipoOrdem']);
    mostrar('Consig', consig.filter(r => Number(r['OrdemServiço']) === nr),
      ['QteConsig', 'QteDevolv', 'CodMaterial', 'DescrMaterial', 'PreçoCusto', 'PreçoVenda', 'Tipo', 'Realizado']);
    mostrar('DevolVend', devolv.filter(r => Number(r['OrdemServiço']) === nr),
      ['Data', 'NrCupom', 'CodProdutoVend', 'QteDevolv', 'PreçoCustProd', 'PreçoProd', 'Realizado']);
    const fs_ = fluxoServ.filter(r => new RegExp('^OC:' + nr + '/').test(String(r['NrTítulo'] || '')));
    mostrar('FluxoServ', fs_, ['Data', 'Chave', 'NrCta', 'Pos', 'NrTítulo', 'Hist', 'Vect', 'Deb', 'Tipo', 'Origem']);

    if (Number(o['Chave_Close']) > 0) await mostrarBoleta(o['Chave_Close'], 'liquidação');
    for (const f of fs_) if (Number(f['Chave']) > 0) await mostrarBoleta(f['Chave'], 'fluxo serv.');
    const realiz = new Set(consig.filter(r => Number(r['OrdemServiço']) === nr && Number(r['Realizado']) > 0).map(r => Number(r['Realizado'])));
    for (const k of realiz) if (k !== Number(o['Chave_Close'])) await mostrarBoleta(k, 'consignado');
  }

  fs.writeFileSync(SAIDA, '\uFEFF' + linhas.join('\r\n'));
  out('\nSaída gravada em:', SAIDA);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
