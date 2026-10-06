// src/scripts/2C-2-estrutura-por-empresa.js
// SubGrupo passou a ser POR EMPRESA. Este script faz as três coisas que a
// mudança exige, cada uma opcional e todas com simulação antes de gravar.
//
//   1) --lojista=<id>            dono dos subgrupos que estão sem lojistaId
//   2) --indices                 troca o índice único: codigo → {lojistaId, codigo}
//   3) --clonar --de=<id> --para=<id>   copia a estrutura de subgrupos de uma
//                                empresa para outra (empresa nova entrando)
//
// Nada grava sem --aplicar.
//
// Exemplos:
//   node src/scripts/2C-2-estrutura-por-empresa.js --lojista=6892706a86509313e632f717 --indices
//   node src/scripts/2C-2-estrutura-por-empresa.js --lojista=6892706a86509313e632f717 --indices --aplicar
//   node src/scripts/2C-2-estrutura-por-empresa.js --clonar --de=6892... --para=70ab... --aplicar

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const SubGrupo = require('../models/grupoSub');

// ⚠ Use a mesma variável de conexão do 2C-0-sincronizar-indices.js
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

function arg(nome) {
  const a = process.argv.find(x => x === `--${nome}` || x.startsWith(`--${nome}=`));
  if (!a) return undefined;
  return a.includes('=') ? a.split('=').slice(1).join('=') : true;
}

function objectId(valor, rotulo) {
  if (!valor || !mongoose.isValidObjectId(valor)) {
    throw new Error(`${rotulo} inválido. Informe um ObjectId.`);
  }
  return new mongoose.Types.ObjectId(valor);
}

async function main() {
  if (!MONGO_URI) throw new Error('Variável de conexão do MongoDB não encontrada no .env.');
  const aplicar = !!arg('aplicar');
  const fazerIndices = !!arg('indices');
  const clonar = !!arg('clonar');
  const lojistaStr = arg('lojista');

  if (!lojistaStr && !fazerIndices && !clonar) {
    throw new Error('Informe pelo menos --lojista, --indices ou --clonar. Veja o cabeçalho do arquivo.');
  }

  await mongoose.connect(MONGO_URI);
  const col = SubGrupo.collection;
  console.log(`\n${aplicar ? '🟢 APLICANDO' : '🔎 DRY-RUN (nada será gravado)'} — coleção ${col.collectionName}\n`);

  /* 1) Dono dos subgrupos órfãos ------------------------------------------ */
  if (lojistaStr) {
    const lojistaId = objectId(lojistaStr, '--lojista');
    const orfaos = await col.countDocuments({ lojistaId: { $exists: false } });
    console.log(`1) Subgrupos sem lojistaId: ${orfaos}`);
    if (orfaos && aplicar) {
      const r = await col.updateMany({ lojistaId: { $exists: false } }, { $set: { lojistaId } });
      console.log(`   → ${r.modifiedCount} passaram a ser da empresa ${lojistaStr}`);
    }
  }

  /* 2) Índices ------------------------------------------------------------
     O model tem autoIndex:false, então o índice novo não nasce sozinho. E o
     antigo (codigo único no banco inteiro) precisa sair antes, senão a
     segunda empresa não consegue ter o seu próprio 1.01.                    */
  if (fazerIndices) {
    const indices = await col.indexes();
    const antigo = indices.find(i => i.unique && JSON.stringify(i.key) === JSON.stringify({ codigo: 1 }));
    const novo   = indices.find(i => JSON.stringify(i.key) === JSON.stringify({ lojistaId: 1, codigo: 1 }));
    console.log(`2) Índice antigo (codigo único): ${antigo ? antigo.name : 'já não existe'}`);
    console.log(`   Índice novo {lojistaId, codigo}: ${novo ? 'já existe' : 'a criar'}`);

    if (aplicar) {
      if (antigo) { await col.dropIndex(antigo.name); console.log(`   → removido ${antigo.name}`); }
      if (!novo) {
        await col.createIndex({ lojistaId: 1, codigo: 1 }, { unique: true });
        console.log('   → criado {lojistaId:1, codigo:1} único');
      }
    }
  }

  /* 3) Clonar a estrutura para uma empresa nova --------------------------- */
  if (clonar) {
    const de   = objectId(arg('de'),   '--de');
    const para = objectId(arg('para'), '--para');
    if (String(de) === String(para)) throw new Error('--de e --para precisam ser empresas diferentes.');

    const origem = await col.find({ lojistaId: de, ativo: { $ne: false } }).sort({ codigo: 1 }).toArray();
    if (!origem.length) throw new Error('A empresa de origem não tem subgrupos.');

    const jaTem = new Set(
      (await col.find({ lojistaId: para }).project({ codigo: 1 }).toArray()).map(x => x.codigo)
    );

    console.log(`3) Clonando ${origem.length} subgrupos`);
    const novos = [];
    for (const sg of origem) {
      if (jaTem.has(sg.codigo)) { console.log(`   ⏭  já existe   ${sg.codigo} - ${sg.nome}`); continue; }
      console.log(`   ➕ ${sg.codigo} - ${sg.nome}`);
      novos.push({
        grupoId: sg.grupoId,
        codigoGrupo: sg.codigoGrupo,
        codigo: sg.codigo,
        nome: sg.nome,
        descricao: sg.descricao || '',
        ativo: true,
        lojistaId: para,
        criadoEm: new Date(),
        atualizadoEm: new Date()
      });
    }
    // Só a estrutura é copiada. Títulos e subtítulos são da operação de cada
    // empresa e nascem pelas telas — inclusive os de fornecedor, que nascem
    // pelo cadastro de fornecedor.
    if (aplicar && novos.length) {
      const r = await col.insertMany(novos);
      console.log(`   → ${r.insertedCount} criados para ${arg('para')}`);
    }
  }

  if (!aplicar) console.log('\nConfira acima e rode de novo com --aplicar.');
}

main()
  .catch(err => { console.error('\n❌', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
