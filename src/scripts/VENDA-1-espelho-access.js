// =============================================================================
// Destino: C:\plataformaRota\src\scripts\VENDA-1-espelho-access.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - as tabelas de OS tem DOIS sublinhados: OrdemServiço__...
//
// ESPELHO: copia do Access para a plataforma, DO JEITO QUE ESTAO, as tabelas de
// venda (o historico):
//
//   Vendas_SaídaCupom          -> _access_vendas_saidacupom        (cabecalho)
//   Vendas_SaídaCupomItens     -> _access_vendas_saidacupomitens   (itens)
//   NFS_RegTítulos             -> _access_nfs_regtitulos           (titulos a receber)
//   OrdemServiço__Cabeçalho    -> _access_ordemservico_cabecalho   (OS de instalacao)
//   OrdemServiço__Complemento  -> _access_ordemservico_complemento
//
// NAO cria venda, titulo nem OS na plataforma: so copia. Cada --aplicar refaz o
// espelho (apaga o desta empresa e copia de novo). Tabela que nao existir e pulada.
//
// Uso (um comando por vez):
//   node src/scripts/VENDA-1-espelho-access.js
//   node src/scripts/VENDA-1-espelho-access.js --aplicar
// Opcoes: --mdb "C:\Armação\Dados\2026B\2026B.mdb"   --lojista <id>
// =============================================================================

'use strict';

require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
const mod = require('mdb-reader');
const MDBReader = mod.default || mod;

const args = process.argv.slice(2);
const opcao = (f, padrao) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };
const MDB     = opcao('--mdb', 'C:\\Armação\\Dados\\2026B\\2026B.mdb');
const LOJISTA = opcao('--lojista', '6892706a86509313e632f717');

const TABELAS = [
  'Vendas_SaídaCupom', 'Vendas_SaídaCupomItens', 'NFS_RegTítulos',
  'OrdemServiço__Cabeçalho', 'OrdemServiço__Complemento',
];

const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const colecaoDe = t => '_access_' + semAcento(t).toLowerCase().replace(/_+/g, '_');
const chave = k => String(k).replace(/\./g, '_').replace(/^\$/, '_');   // chave valida no Mongo

(async function () {
  const aplicar = args.includes('--aplicar');
  const reader = new MDBReader(fs.readFileSync(MDB));
  const todas = reader.getTableNames();
  // nome exato (ha copias como Vendas_SaídaCupom_2025: essas NAO entram)
  const achar = n => todas.find(t => t === n) || todas.find(t => semAcento(t).toLowerCase() === semAcento(n).toLowerCase());

  const lidas = [];
  for (const nome of TABELAS) {
    const real = achar(nome);
    if (!real) { console.log('  ' + nome.padEnd(28) + 'NAO ENCONTRADA (pulada)'); continue; }
    const t = reader.getTable(real);
    const dados = t.getData();
    lidas.push({ nome: real, colecao: colecaoDe(real), dados });
    console.log('  ' + real.padEnd(28) + String(dados.length).padStart(8) + ' linhas  -> ' + colecaoDe(real));
    console.log('      colunas: ' + t.getColumnNames().join(', '));
  }

  if (!aplicar) { console.log('\nSimulacao. Nada foi gravado. Para gravar: --aplicar'); return; }

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const lojistaId = new mongoose.Types.ObjectId(LOJISTA);
  const agora = new Date();

  console.log('\nGravando o espelho:');
  for (const l of lidas) {
    const col = db.collection(l.colecao);
    const fora = await col.deleteMany({ lojistaId });
    let n = 0;
    for (let i = 0; i < l.dados.length; i += 2000) {
      const lote = l.dados.slice(i, i + 2000).map(r => {
        const d = { lojistaId, _importadoEm: agora };
        for (const [k, v] of Object.entries(r)) d[chave(k)] = v;
        return d;
      });
      if (lote.length) n += (await col.insertMany(lote, { ordered: false })).insertedCount;
    }
    console.log('  ' + l.colecao.padEnd(36) + 'apagados ' + String(fora.deletedCount).padStart(7) + ' | copiados ' + String(n).padStart(7));
  }
  console.log('\nEspelho pronto. Nenhuma venda, titulo ou OS foi criado na plataforma.');

})().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
