// src/scripts/2C-3-migrar-plano-legado.js
// Troca o plano montado à mão pelo plano importado do sistema antigo, numa
// empresa só. São três passos, cada um separado e com simulação:
//
//   1) --backup      grava em disco tudo que será apagado (JSON, uma pasta por execução)
//   2) --limpar      apaga plano e movimento DESTA empresa (depois do backup!)
//   3) --religar     liga os fornecedores às contas importadas, pelo nome
//
// Também há --restaurar=<pasta> para desfazer, caso algo dê errado.
//
// Ordem recomendada:
//   node src/scripts/2C-3-migrar-plano-legado.js --lojista=<id> --backup --aplicar
//   node src/scripts/2C-3-migrar-plano-legado.js --lojista=<id> --limpar            (simula)
//   node src/scripts/2C-3-migrar-plano-legado.js --lojista=<id> --limpar --aplicar
//   → importar o plano pela tela da administração
//   node src/scripts/2C-3-migrar-plano-legado.js --lojista=<id> --religar --mapa=religar-fornecedores.csv
//   node src/scripts/2C-3-migrar-plano-legado.js --lojista=<id> --religar --mapa=religar-fornecedores.csv --aplicar
//
// ⚠ Apagar aqui não contraria a regra de "nada é apagado": aquela vale para o
// usuário no dia a dia. Isto é migração controlada, com backup e escopo de uma
// empresa só.

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

// Coleções com dado da empresa. Cada uma é filtrada por lojistaId.
const COLECOES = [
  '../models/grupoSub',
  '../models/contab/financeiro/contaTitulo',
  '../models/contab/financeiro/contaSubTitulo',
  '../models/contab/financeiro/boleta',
  '../models/contab/financeiro/fluxoCaixa',
  '../models/contab/financeiro/fluxoProjetado',
  '../models/contab/financeiro/orcamentoAnual',
  '../models/contab/financeiro/orcamentoConta',
  '../models/contab/financeiro/historicoConta',
  '../models/contab/financeiro/registroContabil',
  '../models/contab/financeiro/compraAnual',
  '../models/contab/financeiro/compraFornecedor'
];

const Fornecedor = require('../models/fornec');

function arg(nome) {
  const a = process.argv.find(x => x === `--${nome}` || x.startsWith(`--${nome}=`));
  if (!a) return undefined;
  return a.includes('=') ? a.split('=').slice(1).join('=') : true;
}

function carregarColecoes() {
  const lista = [];
  for (const caminho of COLECOES) {
    try {
      const model = require(caminho);
      lista.push({ nome: model.collection.collectionName, col: model.collection });
    } catch {
      console.log(`  ⚠ model não encontrado, ignorado: ${caminho}`);
    }
  }
  return lista;
}

/* JSON comum não guarda os tipos do MongoDB: ObjectId e data viram texto.
   O backup passa a usar EJSON, que guarda; e a restauração reconverte também
   os backups antigos, gravados em JSON comum. */
const { ObjectId } = mongoose.Types;
let EJSON = null;
try { EJSON = mongoose.mongo.BSON.EJSON; } catch { /* sem EJSON: cai no JSON comum */ }

const HEX24 = /^[0-9a-f]{24}$/i;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function reviver(valor) {
  if (Array.isArray(valor)) return valor.map(reviver);
  if (valor && typeof valor === 'object') {
    if (valor.$oid) return new ObjectId(valor.$oid);
    if (valor.$date) return new Date(valor.$date.$numberLong ? Number(valor.$date.$numberLong) : valor.$date);
    const o = {};
    for (const [k, v] of Object.entries(valor)) o[k] = reviver(v);
    return o;
  }
  if (typeof valor === 'string') {
    if (HEX24.test(valor)) return new ObjectId(valor);
    if (DATA_ISO.test(valor)) return new Date(valor);
  }
  return valor;
}

function gravarBackup(arquivo, docs) {
  const texto = EJSON ? EJSON.stringify(docs, null, 1, { relaxed: false }) : JSON.stringify(docs, null, 1);
  fs.writeFileSync(arquivo, texto);
}

const semAcento = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

async function main() {
  if (!MONGO_URI) throw new Error('Variável de conexão do MongoDB não encontrada no .env.');
  const lojistaStr = arg('lojista');
  const aplicar = !!arg('aplicar');
  if (!lojistaStr || !mongoose.isValidObjectId(lojistaStr)) throw new Error('Informe --lojista=<ObjectId>.');

  await mongoose.connect(MONGO_URI);
  const lojistaId = new mongoose.Types.ObjectId(lojistaStr);
  const filtro = { lojistaId };
  const colecoes = carregarColecoes();

  console.log(`\n${aplicar ? '🟢 APLICANDO' : '🔎 DRY-RUN (nada será gravado)'} — empresa ${lojistaStr}\n`);

  /* ===== 1) Backup ===== */
  if (arg('backup')) {
    const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const pasta = path.join(__dirname, '../../backup', `${lojistaStr}_${carimbo}`);
    console.log(`1) Backup em ${pasta}`);

    if (aplicar) fs.mkdirSync(pasta, { recursive: true });
    for (const { nome, col } of colecoes) {
      const docs = await col.find(filtro).toArray();
      console.log(`   ${nome}: ${docs.length}`);
      if (aplicar && docs.length) {
        gravarBackup(path.join(pasta, `${nome}.json`), docs);
      }
    }
    // os vínculos dos fornecedores também somem na limpeza
    const forn = await Fornecedor.collection.find({ 'vinculos.lojistaId': lojistaId }).toArray();
    console.log(`   fornecedores com vínculo: ${forn.length}`);
    if (aplicar && forn.length) {
      gravarBackup(path.join(pasta, 'fornecs.json'), forn);
      console.log(`   → backup gravado. Guarde esta pasta antes de limpar.`);
    }
  }

  /* ===== 2) Limpeza ===== */
  if (arg('limpar')) {
    console.log('2) Limpeza (só desta empresa)');
    for (const { nome, col } of colecoes) {
      const n = await col.countDocuments(filtro);
      console.log(`   ${nome}: ${n} documento(s)`);
      if (aplicar && n) await col.deleteMany(filtro);
    }
    // Fornecedor é compartilhado: o documento fica, só o vínculo desta empresa sai
    const n = await Fornecedor.collection.countDocuments({ 'vinculos.lojistaId': lojistaId });
    console.log(`   fornecedores: ${n} vínculo(s) removido(s) (o cadastro continua)`);
    if (aplicar && n) {
      await Fornecedor.collection.updateMany(
        { 'vinculos.lojistaId': lojistaId },
        { $pull: { vinculos: { lojistaId }, vinculosAnteriores: { lojistaId } } }
      );
    }
    if (aplicar) console.log('   → limpo. Agora importe o plano pela tela da administração.');
  }

  /* ===== 3) Religar fornecedores =====
     Pela tabela revisada (--mapa=arquivo.csv), casando por CNPJ. O casamento
     automático por nome não serve: o legado usa nomes curtos ("Rinnai") e
     chegou a mandar duas Tramontinas de CNPJ diferente para a mesma conta.
     Só entram as linhas com situacao = sim; "conferir" e "nova" ficam de fora. */
  if (arg('religar')) {
    const ContaSubTitulo = require('../models/contab/financeiro/contaSubTitulo');
    const mapa = arg('mapa');
    if (!mapa || !fs.existsSync(String(mapa))) throw new Error('Informe --mapa=<caminho do religar-fornecedores.csv>.');

    const linhas = fs.readFileSync(String(mapa), 'utf8').replace(/^\uFEFF/, '')
      .split(/\r?\n/).filter(l => l.trim()).slice(1)
      .map(l => l.split(';'));

    const contagem = { ligados: 0, jaTinham: 0, ignorados: 0, erros: 0 };
    const contasUsadas = new Set();

    for (const [cnpj, razao, conta, , situacao] of linhas) {
      if (String(situacao).trim() !== 'sim' || !conta) { contagem.ignorados++; continue; }

      if (contasUsadas.has(conta)) {
        contagem.erros++;
        console.log(`   ❌ conta ${conta} já usada por outro fornecedor nesta lista: ${razao}`);
        continue;
      }
      contasUsadas.add(conta);

      const existeConta = await ContaSubTitulo.findOne({ lojistaId, codigo: conta }, { _id: 1 }).lean();
      if (!existeConta) { contagem.erros++; console.log(`   ❌ conta ${conta} não existe no plano: ${razao}`); continue; }

      const f = await Fornecedor.collection.findOne({ cnpj: String(cnpj).replace(/\D/g, '') });
      if (!f) { contagem.erros++; console.log(`   ❌ CNPJ não cadastrado: ${cnpj} ${razao}`); continue; }

      if ((f.vinculos || []).some(v => String(v.lojistaId) === lojistaStr)) { contagem.jaTinham++; continue; }

      console.log(`   ${aplicar ? '✅ ligou ' : '➕ ligaria'}  ${conta}  ${f.razao}`);
      contagem.ligados++;
      if (aplicar) {
        await Fornecedor.collection.updateOne(
          { _id: f._id, 'vinculos.lojistaId': { $ne: lojistaId } },
          { $push: { vinculos: { lojistaId, ncontabil: conta, ativo: f.ativo !== false } } }
        );
      }
    }
    console.log('\n   Resumo:', contagem);
    if (contagem.ignorados) {
      console.log('   Os ignorados ("conferir" e "nova") entram pela tela de fornecedores;');
      console.log('   os "nova" ganham conta automaticamente ao serem salvos lá.');
    }
  }

  /* ===== Desfazer a importação do plano legado =====
     O legado deixou de ser copiado para o plano: passa a ser só referência,
     e cada conta entra no plano novo por decisão, numa tela de/para. Aqui sai
     o que a importação inteira criou. Títulos e subtítulos saem na
     restauração do backup (--restaurar); os subgrupos criados pela importação
     não estavam no backup, então saem aqui.

     Como identificar os criados pela importação: todos os títulos atuais da
     empresa vieram dela, então o mais antigo deles marca o início. Subgrupo
     criado a partir daí também veio dela; os 22 originais são bem anteriores. */
  if (arg('desfazer-importacao')) {
    const ContaTitulo = require('../models/contab/financeiro/contaTitulo');
    const SubGrupo = require('../models/grupoSub');

    const primeiro = await ContaTitulo.findOne({ lojistaId }, { criadoEm: 1 }).sort({ criadoEm: 1 }).lean();
    if (!primeiro || !primeiro.criadoEm) {
      console.log('Nenhum título da importação encontrado. Nada a desfazer.');
    } else {
      const corte = new Date(primeiro.criadoEm.getTime() - 10 * 60 * 1000);
      const criados = await SubGrupo.find({ lojistaId, criadoEm: { $gte: corte } }).sort({ codigo: 1 }).lean();
      const antigos = await SubGrupo.countDocuments({ lojistaId, criadoEm: { $lt: corte } });

      console.log(`Importação começou em ${primeiro.criadoEm.toLocaleString('pt-BR')}`);
      console.log(`Subgrupos originais que ficam: ${antigos}`);
      console.log(`Subgrupos criados pela importação, a remover: ${criados.length}`);
      criados.forEach(sg => console.log(`   ${sg.codigo}  ${sg.nome}`));

      if (aplicar && criados.length) {
        await SubGrupo.deleteMany({ _id: { $in: criados.map(x => x._id) } });
        console.log('   → removidos. Agora restaure o backup com --restaurar=<pasta> --aplicar');
      }
    }
  }

  /* ===== Restaurar ===== */
  if (arg('restaurar')) {
    const pasta = String(arg('restaurar'));
    if (!fs.existsSync(pasta)) throw new Error(`Pasta não encontrada: ${pasta}`);
    console.log(`Restaurando de ${pasta}`);
    for (const arquivo of fs.readdirSync(pasta).filter(a => a.endsWith('.json'))) {
      const nome = arquivo.replace(/\.json$/, '');
      const docs = reviver(JSON.parse(fs.readFileSync(path.join(pasta, arquivo), 'utf8')));
      console.log(`   ${nome}: ${docs.length}`);
      if (!aplicar || !docs.length) continue;
      const col = mongoose.connection.collection(nome);
      if (nome === 'fornecs') {
        for (const d of docs) await col.replaceOne({ _id: d._id }, d, { upsert: true });
      } else {
        // Apaga também cópias restauradas antes com os tipos errados (lojistaId em texto)
        await col.deleteMany({ $or: [{ lojistaId }, { lojistaId: lojistaStr }] });
        await col.insertMany(docs);
      }
    }
  }

  if (!aplicar) console.log('\nConfira acima e rode de novo com --aplicar.');
}

main()
  .catch(err => { console.error('\n❌', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
