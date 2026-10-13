// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-9-precos-prazo-e-vista.js
// Criado em: 10/10/2026
//
// REGRA DE PRECO (informada em 10/10/2026):
//   - preco A PRAZO = custo taxado (60%) — e o preco "cheio"
//   - preco A VISTA = A PRAZO com 5% de desconto
// No cadastro vindo do Access o campo "a prazo" esta parado (397 produtos com prazo
// MENOR que a vista, 123 zerados). Por enquanto:
//   A PRAZO = o MAIOR entre os dois precos de hoje (precovista, precoprazo)
//   A VISTA = A PRAZO x 0,95 (arredondado no centavo)
// Antes do dia D o Jorge faz a limpeza dos precos.
//
// Exemplo 6008: vista 5.791,48 / prazo 4.420,00  ->  prazo 5.791,48 / vista 5.501,91
//
// So a Armacao (arquivo_docs, valores em REAIS). Grava so precoprazo, precovista e
// atualizadoEm. Produto com os dois precos zerados fica como esta.
// Backup dos precos antigos (EJSON) antes de gravar: VENDA-9-backup-<data>.json
//
// Uso (um comando por vez):
//   node src\scripts\VENDA-9-precos-prazo-e-vista.js              simulacao
//   node src\scripts\VENDA-9-precos-prazo-e-vista.js --aplicar
// =============================================================================

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');
const DESCONTO_VISTA = 0.05;

const c = v => Math.round((Number(v) || 0) * 100);           // reais -> centavos (inteiro)
const brl = cent => (cent / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('arquivo_docs');
  console.log('Banco:', mongoose.connection.db.databaseName);

  const produtos = await col.find({ loja_id: ARMACAO })
    .project({ codigo: 1, descricao: 1, precovista: 1, precoprazo: 1, ativo: 1 }).toArray();

  const mudar = [];
  let zerados = 0, iguais = 0;
  for (const p of produtos) {
    const vista = c(p.precovista), prazo = c(p.precoprazo);
    const novoPrazo = Math.max(vista, prazo);
    if (!novoPrazo) { zerados++; continue; }
    const novaVista = Math.round(novoPrazo * (1 - DESCONTO_VISTA));
    if (novoPrazo === prazo && novaVista === vista) { iguais++; continue; }
    mudar.push({ p, vista, prazo, novoPrazo, novaVista });
  }

  console.log('\nprodutos da Armação ..........', produtos.length);
  console.log('   já na regra ...............', iguais);
  console.log('   sem preço (ficam) .........', zerados);
  console.log('   a mudar ...................', mudar.length);
  console.log('      prazo vinha MENOR ......', mudar.filter(m => m.prazo < m.vista && m.prazo > 0).length);
  console.log('      prazo vinha ZERADO .....', mudar.filter(m => !m.prazo).length);
  console.log('      prazo vinha IGUAL/MAIOR ', mudar.filter(m => m.prazo >= m.vista).length);

  console.log('\nexemplos (código · antes vista/prazo  ->  depois vista/prazo):');
  const ex = [mudar.find(m => m.p.codigo === 6008), ...mudar.slice(0, 12)].filter(Boolean)
    .filter((m, i, a) => a.indexOf(m) === i);
  ex.forEach(m => console.log('   ' + String(m.p.codigo).padStart(6)
    + brl(m.vista).padStart(12) + brl(m.prazo).padStart(12) + '   ->'
    + brl(m.novaVista).padStart(12) + brl(m.novoPrazo).padStart(12)
    + '   ' + String(m.p.descricao || '').slice(0, 34)));

  if (!mudar.length) { console.log('\nNada a fazer.'); return; }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para gravar: --aplicar'); return; }

  // backup dos precos antigos
  const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
  const arq = path.join(process.cwd(), 'VENDA-9-backup-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json');
  fs.writeFileSync(arq, EJSON.stringify(mudar.map(m => ({
    _id: m.p._id, codigo: m.p.codigo, precovista: m.p.precovista, precoprazo: m.p.precoprazo })), null, 1));
  console.log('\nbackup:', arq);

  const agora = new Date();
  let gravados = 0;
  for (let i = 0; i < mudar.length; i += 500) {
    const r = await col.bulkWrite(mudar.slice(i, i + 500).map(m => ({
      updateOne: {
        filter: { _id: m.p._id, loja_id: ARMACAO },
        update: { $set: { precoprazo: m.novoPrazo / 100, precovista: m.novaVista / 100, atualizadoEm: agora } },
      },
    })));
    gravados += r.modifiedCount;
  }
  console.log('Gravados:', gravados);
})()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
