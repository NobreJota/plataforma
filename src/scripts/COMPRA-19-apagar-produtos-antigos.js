// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-19-apagar-produtos-antigos.js
// Criado em: 03/10/2026
// Alterado em: 03/10/2026 - SO A ARMACAO. Os 203 com codigo em texto sao de 6 empresas,
//              cadastrados pela area da empresa (usuarioloja); os das outras 5 sao dados
//              reais delas e NUNCA entram. Da Armacao sao 40.
//
// Apaga de arquivo_docs os produtos da ARMACAO cadastrados pela area da empresa
// que nao vieram do Access: `codigo` gravado como TEXTO ('5702').
// Os do Access tem codigo NUMERO (5702) e nao sao tocados.
// Exemplo de duplicidade: 5702 do Access (Emmeti) x '5702' da area da empresa.
//
// Protecao: documento com origemAccess ou origemPlataforma = true NUNCA entra,
// mesmo com codigo em texto (o script avisa se achar algum).
//
// Uso (um comando por vez):
//   node src\scripts\COMPRA-19-apagar-produtos-antigos.js              simulacao
//   node src\scripts\COMPRA-19-apagar-produtos-antigos.js --aplicar    backup EJSON + apaga
//   node src\scripts\COMPRA-19-apagar-produtos-antigos.js --restaurar src\scripts\backup\<arquivo>.json
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let EJSON;
try { EJSON = mongoose.mongo.BSON.EJSON; } catch (e) { /* tenta o pacote */ }
if (!EJSON) EJSON = require('bson').EJSON;

const args = process.argv.slice(2);
const APLICAR = args.includes('--aplicar');
const iRest = args.indexOf('--restaurar');
const RESTAURAR = iRest >= 0 ? args[iRest + 1] : null;

// a empresa e FIXA: nenhum parametro troca isto
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');

const FILTRO = {
  loja_id: ARMACAO,
  codigo: { $type: 'string' },
  origemAccess: { $ne: true },
  origemPlataforma: { $ne: true },
};

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI não está no .env');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection('arquivo_docs');
  console.log('Banco:', db.databaseName);

  // ---- restaurar um backup ---------------------------------------------------
  if (RESTAURAR) {
    const arq = path.resolve(RESTAURAR);
    if (!fs.existsSync(arq)) throw new Error('arquivo não encontrado: ' + arq);
    const docs = EJSON.parse(fs.readFileSync(arq, 'utf8'));
    console.log('Backup:', arq, '·', docs.length, 'documentos');
    const ja = await col.countDocuments({ _id: { $in: docs.map(d => d._id) } });
    if (ja) throw new Error(ja + ' desses documentos já existem no banco; nada foi gravado');
    if (!APLICAR) { console.log('\nSIMULAÇÃO — para restaurar, repita com --aplicar'); return; }
    const r = await col.insertMany(docs, { ordered: true });
    console.log('Restaurados:', r.insertedCount);
    return;
  }

  // ---- levantamento ------------------------------------------------------------
  const docs = await col.find(FILTRO).toArray();
  const protegidos = await col.countDocuments({
    loja_id: ARMACAO,
    codigo: { $type: 'string' },
    $or: [{ origemAccess: true }, { origemPlataforma: true }],
  });

  const porLoja = {};
  let fornecObjectId = 0, comDuplicadoNoAccess = 0;
  const numeros = docs.map(d => Number(d.codigo)).filter(Number.isFinite);
  const doAccess = new Set((await col.find({ loja_id: ARMACAO, codigo: { $in: numeros } }).project({ codigo: 1 }).toArray())
    .map(d => d.codigo));
  for (const d of docs) {
    const l = String(d.loja_id || 'sem loja_id');
    porLoja[l] = (porLoja[l] || 0) + 1;
    if (d.fornecedor instanceof mongoose.mongo.ObjectId) fornecObjectId++;
    if (doAccess.has(Number(d.codigo))) comDuplicadoNoAccess++;
  }

  const outras = await col.countDocuments({ loja_id: { $ne: ARMACAO }, codigo: { $type: 'string' } });
  console.log('\nArmação — produtos da área da empresa (codigo em texto) a apagar:', docs.length);
  console.log('  outras empresas com codigo em texto (NÃO tocados):', outras);
  console.log('  por empresa (loja_id):');
  for (const [l, n] of Object.entries(porLoja)) console.log('    ', l, '→', n);
  console.log('  com fornecedor gravado como ObjectId:', fornecObjectId);
  console.log('  com o mesmo número já vindo do Access:', comDuplicadoNoAccess);
  if (protegidos) console.log('\n  ATENÇÃO:', protegidos, 'com codigo em texto mas origemAccess/origemPlataforma = true — NÃO serão apagados');

  console.log('\n  primeiros 10:');
  for (const d of docs.slice(0, 10)) {
    console.log('    ', String(d.codigo).padEnd(8), String(d.descricao || '').slice(0, 45).padEnd(46), String(d.fornecedor || ''));
  }

  if (!docs.length) { console.log('\nNada a fazer.'); return; }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi apagado. Para aplicar, repita com --aplicar'); return; }

  // ---- backup EJSON e apagar -----------------------------------------------------
  const pasta = path.join(__dirname, 'backup');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const arq = path.join(pasta, 'arquivo_docs_armacao_area_empresa_' + carimbo + '.json');
  fs.writeFileSync(arq, EJSON.stringify(docs, null, 1, { relaxed: false }));
  const conferido = EJSON.parse(fs.readFileSync(arq, 'utf8')).length;
  if (conferido !== docs.length) throw new Error('backup não conferiu (' + conferido + ' × ' + docs.length + '); nada foi apagado');
  console.log('\nBackup:', arq, '·', conferido, 'documentos');

  const r = await col.deleteMany({ _id: { $in: docs.map(d => d._id) } });
  console.log('Apagados:', r.deletedCount);
}

main()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
