// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-10-ver-mao-de-obra.js
// Criado em: 18/10/2026
//
// SO LE (nao grava nada). Mostra o que ficou gravado da MAO DE OBRA numa venda:
//   - a venda: documento, situacao, itens marcados para instalar, instalacao (tecnico,
//     maoDeObra, parteTecnico, confirmada), totalServico, totalLiquido
//   - a OS ligada (valorServico, maoDeObraVenda, apropriar)
//   - a boleta da NF (contrapartidas: produtos, receita de servicos, a apropriar)
// Sem --venda: as ultimas 5 vendas fechadas com nota fiscal.
//
// Uso:
//   node src\scripts\VENDA-10-ver-mao-de-obra.js --venda 41
//   node src\scripts\VENDA-10-ver-mao-de-obra.js
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const args = process.argv.slice(2);
const i = args.indexOf('--venda');
const NUM = i >= 0 ? Number(args[i + 1]) : null;
const r$ = c => 'R$ ' + ((Number(c) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const filtro = NUM ? { lojistaId: ARMACAO, numero: NUM } : { lojistaId: ARMACAO, documento: 'NFE', situacao: 'F' };
  const vendas = await db.collection('_vendas').find(filtro).sort({ numero: -1 }).limit(NUM ? 1 : 5).toArray();
  if (!vendas.length) console.log('Nenhuma venda encontrada.');
  for (const v of vendas) {
    console.log('\n=== Venda nº ' + v.numero + ' · ' + v.documento + ' · situação ' + v.situacao + ' · ' + (v.cliente?.nome || 'sem cliente'));
    const marc = (v.itens || []).filter(x => x.precisaInstalacao);
    console.log('itens para instalar:', marc.length ? marc.map(x => x.codigo + ' ' + x.descricao).join(' | ') : 'NENHUM');
    const ins = v.instalacao;
    if (!ins) console.log('instalação: NÃO GRAVADA (null)');
    else console.log('instalação: confirmada=' + ins.confirmada + ' · técnico ' + (ins.tecnicoNome || '-') + ' ' + (ins.tecnicoConta || '')
      + ' · mão de obra ' + r$(ins.maoDeObra) + ' · parte do técnico ' + r$(ins.parteTecnico) + ' · parte da loja ' + r$(ins.parteLoja));
    console.log('totalServico ' + r$(v.totalServico) + ' · totalLiquido ' + r$(v.totalLiquido));
    if (v.os?.id) {
      const o = await db.collection('_ordens_servico').findOne({ _id: v.os.id });
      console.log('OS nº ' + (o?.numero || v.os.numero) + ': valorServico ' + r$(o?.valorServico) + ' · maoDeObraVenda ' + r$(o?.maoDeObraVenda)
        + ' · servicoContabilizado ' + !!o?.servicoContabilizado + (o?.apropriar ? ' · apropriar ' + JSON.stringify(o.apropriar) : ''));
    } else console.log('OS: nenhuma ligada');
    if (v.contabil?.boletaId) {
      const b = await db.collection('_boletas').findOne({ _id: v.contabil.boletaId });
      console.log('boleta da NF ' + (b?.codigo || '') + ' · total R$ ' + (b?.valorTotal ?? '?'));
      for (const c of (b?.contrapartidas || [])) console.log('   ' + String(c.codigoConta).padEnd(14) + ' R$ ' + String(c.valor).padStart(10) + '  ' + (c.historico || ''));
    }
  }
  await mongoose.disconnect();
})().catch(async e => { console.error('ERRO:', e.message); try { await mongoose.disconnect(); } catch (x) { /* */ } process.exit(1); });
