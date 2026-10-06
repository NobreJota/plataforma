// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-20-limpar-localloja.js
// Criado em: 03/10/2026
//
// /loja/cooperados dava 500: CastError "Cast to ObjectId failed for value ''"
// no model "departamentos". O populate de localloja (departamento, setor,
// secao) recebe TEXTO VAZIO onde espera um ObjectId e derruba a lista inteira.
//
// Este script limpa os produtos da ARMACAO em arquivo_docs:
//   - localloja gravado como texto ('')         → []
//   - departamento / idSetor / idSecao = ''      → null  (populate ignora null)
//   - '' dentro de lista de departamento         → retirado da lista
// Nada mais do documento e tocado.
//
// Uso (um comando por vez):
//   node src\scripts\COMPRA-20-limpar-localloja.js              simulacao
//   node src\scripts\COMPRA-20-limpar-localloja.js --aplicar    backup EJSON + grava
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

let EJSON;
try { EJSON = mongoose.mongo.BSON.EJSON; } catch (e) { /* tenta o pacote */ }
if (!EJSON) EJSON = require('bson').EJSON;

const APLICAR = process.argv.includes('--aplicar');
const ARMACAO = new mongoose.Types.ObjectId('6892706a86509313e632f717');   // fixa
const REFS = new Set(['departamento', 'idSetor', 'idSecao']);

const vazio = v => typeof v === 'string' && v.trim() === '';

// devolve uma copia limpa de localloja e conta o que mudou
function limpar(valor, cont) {
  if (Array.isArray(valor)) return valor.map(v => limpar(v, cont));
  if (valor && typeof valor === 'object' && !(valor instanceof mongoose.mongo.ObjectId) && !(valor instanceof Date)) {
    const novo = {};
    for (const [k, v] of Object.entries(valor)) {
      if (REFS.has(k)) {
        if (vazio(v)) { novo[k] = null; cont[k] = (cont[k] || 0) + 1; continue; }
        if (Array.isArray(v) && v.some(vazio)) {
          novo[k] = v.filter(x => !vazio(x)).map(x => limpar(x, cont));
          cont[k + '[]'] = (cont[k + '[]'] || 0) + 1;
          continue;
        }
      }
      novo[k] = limpar(v, cont);
    }
    return novo;
  }
  return valor;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI não está no .env');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection('arquivo_docs');
  console.log('Banco:', db.databaseName);

  const docs = await col.find({ loja_id: ARMACAO, localloja: { $exists: true } })
    .project({ codigo: 1, descricao: 1, localloja: 1, origemAccess: 1, origemPlataforma: 1 }).toArray();

  const mudar = [];
  const cont = { 'localloja texto': 0 };
  const porOrigem = { access: 0, plataforma: 0, outros: 0 };
  for (const d of docs) {
    let novo;
    if (typeof d.localloja === 'string') { novo = []; cont['localloja texto']++; }
    else {
      const antes = JSON.stringify(d.localloja);
      novo = limpar(d.localloja, cont);
      if (JSON.stringify(novo) === antes) continue;
    }
    mudar.push({ d, novo });
    porOrigem[d.origemAccess ? 'access' : d.origemPlataforma ? 'plataforma' : 'outros']++;
  }

  console.log('\nArmação — produtos lidos:', docs.length);
  console.log('Produtos a limpar:', mudar.length,
    '(Access', porOrigem.access, '· plataforma', porOrigem.plataforma, '· outros', porOrigem.outros + ')');
  console.log('Trocas:');
  for (const [k, n] of Object.entries(cont)) if (n) console.log('   ', k.padEnd(18), n);
  console.log('\n  primeiros 5:');
  for (const { d, novo } of mudar.slice(0, 5)) {
    console.log('    ', String(d.codigo).padEnd(7), String(d.descricao || '').slice(0, 40));
    console.log('        antes:', JSON.stringify(d.localloja).slice(0, 110));
    console.log('        depois:', JSON.stringify(novo).slice(0, 110));
  }

  if (!mudar.length) { console.log('\nNada a fazer.'); return; }
  if (!APLICAR) { console.log('\nSIMULAÇÃO — nada foi gravado. Para aplicar, repita com --aplicar'); return; }

  // backup EJSON so do campo localloja (com _id), conferido antes de gravar
  const pasta = path.join(__dirname, 'backup');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const arq = path.join(pasta, 'arquivo_docs_localloja_armacao_' + carimbo + '.json');
  fs.writeFileSync(arq, EJSON.stringify(mudar.map(m => ({ _id: m.d._id, localloja: m.d.localloja })), null, 1, { relaxed: false }));
  const conferido = EJSON.parse(fs.readFileSync(arq, 'utf8')).length;
  if (conferido !== mudar.length) throw new Error('backup não conferiu; nada foi gravado');
  console.log('\nBackup:', arq, '·', conferido, 'documentos');

  const r = await col.bulkWrite(mudar.map(m => ({
    updateOne: { filter: { _id: m.d._id, loja_id: ARMACAO }, update: { $set: { localloja: m.novo } } },
  })));
  console.log('Gravados:', r.modifiedCount);
}

main()
  .catch(err => { console.error('\nERRO:', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
