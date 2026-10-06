// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-10-fornecedores-access.js
// Criado em: 29/09/2026
// Alterado em: 29/09/2026 - a coluna no Access e NrContabil (nao Ncontabil)
//              29/09/2026 - SEM DE/PARA: conta nova = NrContabil com o prefixo
//                           "2.02." trocado por "2.01." (2.02.001.074 -> 2.01.001.074)
//
// Copia para _fornec_access os fornecedores ATIVOS (Ativado = 1) da tabela
// Compras_Fornecedores do Access. E tabela de referencia, como _produto_origem:
// nao cria fornecedor, nao cria conta, nao mexe em fornecs nem no de/para.
//
// Para cada fornecedor guarda: NrFornec, Marca, Razao, CNPJ, cidade, UF, o
// NrContabil antigo e a conta nova (o mesmo numero, com 2.01. no lugar de 2.02.).
//
// Os nomes das colunas do Access sao achados sem olhar maiuscula nem acento
// (Razão = razao). O --inspecionar mostra quais foram achados.
//
// Uso (um comando por vez):
//   node src/scripts/COMPRA-10-fornecedores-access.js --inspecionar
//   node src/scripts/COMPRA-10-fornecedores-access.js              (simulacao)
//   node src/scripts/COMPRA-10-fornecedores-access.js --aplicar
//
// Opcoes: --mdb "C:\Armação\Dados\2026B\2026B.mdb"   --lojista <id>
//
// Rodar de novo atualiza. Fornecedor que deixou de estar ativo no Access fica
// com ativo:false (nada e apagado). Backup EJSON antes de aplicar.
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const tem = f => args.includes(f);
const opcao = (f, padrao) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};

const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');
const TABELA  = 'Compras_Fornecedores';
const DESTINO = '_fornec_access';

// ---- utilitarios ------------------------------------------------------------
const semAcento = s => String(s).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase();

// acha o nome real da coluna: 'razao' acha 'Razão'
function acharColuna(colunas, ...nomes) {
  return colunas.find(c => nomes.includes(semAcento(c))) || null;
}

// "0" e "0000" sao o texto vazio do Access
function texto(v) {
  const s = String(v ?? '').trim();
  return (s === '0' || s === '0000') ? '' : s;
}

// a regra da conta do fornecedor: troca so o prefixo
const contaNovaDe = c => /^2\.02\./.test(c) ? c.replace(/^2\.02\./, '2.01.') : '';

function ehAtivo(v) {
  return v === true || v === 1 || String(v ?? '').trim() === '1';
}

// ---- principal --------------------------------------------------------------
(async function () {

  if (!fs.existsSync(MDB)) {
    console.error('Arquivo do Access nao encontrado:', MDB);
    console.error('Informe com --mdb "caminho\\do\\arquivo.mdb"');
    process.exitCode = 1;
    return;
  }

  const { default: MDBReader } = await import('mdb-reader');
  const reader = new MDBReader(fs.readFileSync(MDB));

  const tabelas = reader.getTableNames();
  if (!tabelas.includes(TABELA)) {
    console.error('Tabela', TABELA, 'nao encontrada. Parecidas:',
      tabelas.filter(n => /fornec/i.test(n)).join(', ') || '(nenhuma)');
    process.exitCode = 1;
    return;
  }

  const tabela = reader.getTable(TABELA);
  const colunas = tabela.getColumnNames();
  const linhas = tabela.getData();

  const C = {
    nr:        acharColuna(colunas, 'nrfornec'),
    ativado:   acharColuna(colunas, 'ativado'),
    marca:     acharColuna(colunas, 'marca'),
    razao:     acharColuna(colunas, 'razao'),
    cnpj:      acharColuna(colunas, 'cgc', 'cnpj'),
    cidade:    acharColuna(colunas, 'cidade'),
    estado:    acharColuna(colunas, 'estado', 'uf'),
    ncontabil: acharColuna(colunas, 'nrcontabil', 'ncontabil'),
  };

  console.log('Tabela', TABELA + ':', linhas.length, 'linhas');
  console.log('Colunas usadas:');
  for (const [k, v] of Object.entries(C)) console.log('  ' + k.padEnd(10), v || '*** NAO ACHADA ***');

  // ---- inspecionar: so olha, nao conecta no banco ----------------------------
  if (tem('--inspecionar')) {
    console.log('\nTodas as colunas:', colunas.join(', '));

    if (C.ativado) {
      const cont = new Map();
      for (const l of linhas) {
        const k = JSON.stringify(l[C.ativado]);
        cont.set(k, (cont.get(k) || 0) + 1);
      }
      console.log('\nValores de', C.ativado + ':');
      for (const [k, n] of cont) console.log('  ' + k.padEnd(8), n, 'linha(s)',
        ehAtivo(JSON.parse(k)) ? '<- conta como ativo' : '');
    }

    console.log('\nTres linhas ativas, como vieram:');
    linhas.filter(l => C.ativado && ehAtivo(l[C.ativado])).slice(0, 3).forEach(l => {
      const r = {};
      for (const [k, v] of Object.entries(C)) if (v) r[k] = l[v];
      console.log(' ', JSON.stringify(r));
    });
    return;
  }

  if (!C.nr || !C.ativado) {
    console.error('\nSem as colunas NrFornec e Ativado nao da para seguir.'
      + ' Rode com --inspecionar e me mande a saida.');
    process.exitCode = 1;
    return;
  }

  const ativos = linhas.filter(l => ehAtivo(l[C.ativado]));

  // ---- banco -----------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);

  const docs = [];
  const vistos = new Set();
  for (const l of ativos) {
    const nr = Number(l[C.nr]);
    if (!Number.isInteger(nr) || nr <= 0) continue;
    if (vistos.has(nr)) { console.warn('NrFornec repetido no Access:', nr); continue; }
    vistos.add(nr);

    const ncontabil = C.ncontabil ? texto(l[C.ncontabil]) : '';
    docs.push({
      lojistaId,
      nrFornec: nr,
      marca:  C.marca  ? texto(l[C.marca])  : '',
      razao:  C.razao  ? texto(l[C.razao])  : '',
      cnpj:   C.cnpj   ? texto(l[C.cnpj])   : '',
      cidade: C.cidade ? texto(l[C.cidade]) : '',
      estado: C.estado ? texto(l[C.estado]) : '',
      ncontabilAntigo: ncontabil,
      contaNova: contaNovaDe(ncontabil),
    });
  }

  const col = db.collection(DESTINO);
  const existentes = await col.find({ lojistaId }).toArray();
  const desativar = existentes
    .filter(e => e.ativo !== false && !vistos.has(e.nrFornec))
    .map(e => e.nrFornec);

  // ---- relatorio -------------------------------------------------------------
  const semNome = docs.filter(d => !d.marca && !d.razao);
  const semConta = docs.filter(d => !d.contaNova);

  console.log('\nAtivos no Access:          ', docs.length);
  console.log('  com Marca:                ', docs.filter(d => d.marca).length);
  console.log('  sem Marca nem Razao:      ', semNome.length);
  console.log('  com Ncontabil:            ', docs.filter(d => d.ncontabilAntigo).length);
  console.log('  com conta nova (2.01.):   ', docs.length - semConta.length);
  console.log('Ja em', DESTINO + ':           ', existentes.length);
  console.log('A marcar ativo:false:       ', desativar.length);

  console.log('\nExemplos:');
  docs.slice(0, 5).forEach(d => console.log('  ', d.nrFornec, '|', d.marca || '-', '|',
    d.razao || '-', '|', d.ncontabilAntigo || '-', '->', d.contaNova || '(sem)'));

  if (semConta.length) {
    console.log('\nSem conta nova (ate 15):');
    semConta.slice(0, 15).forEach(d => console.log('  ', d.nrFornec, '|',
      d.marca || d.razao || '-', '| Ncontabil', d.ncontabilAntigo || '(vazio)'));
  }

  if (!tem('--aplicar')) {
    console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar');
    return;
  }

  // ---- aplicar ---------------------------------------------------------------
  if (existentes.length) {
    const EJSON = mongoose.mongo.BSON?.EJSON || require('bson').EJSON;
    const pasta = path.join(__dirname, 'backup');
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, 'COMPRA-10-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(arq, EJSON.stringify(existentes, null, 2, { relaxed: false }));
    console.log('\nBackup:', arq);
  }

  const agora = new Date();
  if (docs.length) {
    await col.bulkWrite(docs.map(d => ({
      updateOne: {
        filter: { lojistaId, nrFornec: d.nrFornec },
        update: { $set: { ...d, ativo: true, importadoEm: agora } },
        upsert: true,
      },
    })));
  }
  if (desativar.length) {
    await col.updateMany(
      { lojistaId, nrFornec: { $in: desativar } },
      { $set: { ativo: false, importadoEm: agora } },
    );
  }
  await col.createIndex({ lojistaId: 1, nrFornec: 1 }, { unique: true });

  console.log('\nGravado:', docs.length, 'ativo(s),', desativar.length, 'marcado(s) inativo(s).');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
