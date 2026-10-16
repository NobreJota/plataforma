// =============================================================================
// Destino: C:\plataformaRota\src\scripts\OS-7-ver-consignado.js
// Criado em: 15/10/2026
//
// SO LE. Nao grava nada.
//
// Mostra o que esta GRAVADO numa OS: situacao, agendamento, cada consignado (saiu,
// voltou, devolucoes com data/hora), fechamento e o estoque atual de cada produto.
// Serve para conferir o "+ levar" que nao apareceu na ficha de fechamento.
//
// Uso:
//   node src\scripts\OS-7-ver-consignado.js --os 13765
// =============================================================================

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const opc = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
const NUM = Number(opc('--os'));
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const hora = d => (d ? new Date(d).toLocaleString('pt-BR') : '·');
const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

(async () => {
  if (!NUM) throw new Error('informe a OS: --os 13765');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const o = await db.collection('_ordens_servico').findOne({ lojistaId: ARMACAO, numero: NUM });
  if (!o) throw new Error('OS ' + NUM + ' não encontrada');

  console.log('OS', o.numero, '· status', o.status, '· tipo', o.tipo, '· cliente', o.cliente?.nome);
  console.log('técnico', o.tecnicoConta || '·', o.tecnicoNome || '', '· dia', hora(o.diaPrevisto), o.horaIni || '', o.horaFim || '');
  console.log('atualizada em', hora(o.atualizadoEm), '· fechamento', o.fechamento ? hora(o.fechamento.em) : 'não');

  const cons = o.consignados || [];
  console.log('\nCONSIGNADOS gravados:', cons.length);
  for (const c of cons) {
    const p = await db.collection('arquivo_docs').findOne({ loja_id: ARMACAO, codigo: c.codigo }, { projection: { qte: 1 } });
    console.log('  ' + c.codigo + '  ' + (c.descricao || '').slice(0, 40).padEnd(40) + '  saiu ' + c.quantidade + '  voltou ' + (c.devolvido || 0)
      + '  R$ ' + brl(c.precoUnit) + '  saída ' + hora(c.saidaEm) + '  · estoque hoje ' + (p ? p.qte : '?'));
    for (const d of c.devolucoes || []) console.log('        devolução ' + d.quantidade + ' em ' + hora(d.em) + (d.noFechamento ? ' (na ficha)' : ''));
  }
  if (o.fechamentoDesfeito) console.log('\nfechamento DESFEITO em', hora(o.fechamentoDesfeito.desfeitoEm));
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
