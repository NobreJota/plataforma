// src/scripts/reconstruir-subtitulos-bancarios.js
// Reconstrói os subtítulos bancários (1.01.002.x) do zero e vincula às contas
// bancárias em _aux_contas_bancarias.
//
// FAZ:
//   1. Confere que nenhum subtítulo bancário tem movimento (aborta se tiver)
//   2. Faz backup dos subtítulos atuais em _backup_contasubtitulos_YYYYMMDD
//   3. Deleta os subtítulos atuais de 1.01.002.x
//   4. Cria 7 novos subtítulos no padrão "Banco/Titular"
//   5. Vincula cada conta bancária ao subtítulo correto
//   6. Imprime diagnóstico final
//
// Uso:
//   cd C:\plataformaRota
//   node src/scripts/reconstruir-subtitulos-bancarios.js
//
// Se algo der errado, restaure do backup manualmente via Compass.

require('dotenv').config();
const mongoose = require('mongoose');

const URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.DB_URI;

if (!URI) {
  console.error('❌ Não achei a string de conexão no .env');
  process.exit(1);
}

// ============================================================
// DEFINIÇÃO DOS 7 SUBTÍTULOS NOVOS
// (ordem importa: o _id da conta bancária associa ao subtítulo)
// ============================================================
const PLANO = [
  { seq: '001', nome: 'BB/Armação',       contaBancariaId: '6a0dfc75b7604ce06084eee4' }, // BBrasil
  { seq: '002', nome: 'Banestes/Armação', contaBancariaId: '6a0dfd19b7604ce06084eeee' }, // Banestes
  { seq: '003', nome: 'CEF/Armação',      contaBancariaId: '6a0dfda5b7604ce06084eefe' }, // Caixa Econômica
  { seq: '004', nome: 'Banestes/Augusta', contaBancariaId: '6a0dfe29b7604ce06084ef07' }, // Augusta
  { seq: '005', nome: 'Banestes/Jorge',   contaBancariaId: '6a0dfe84b7604ce06084ef10' }, // Jorge
  { seq: '006', nome: 'CEF/Jorge',        contaBancariaId: '6a0dfee6b7604ce06084ef1a' }, // Jorge Lessa
  { seq: '007', nome: 'Banestes/Rota ES', contaBancariaId: '6a0dff2bb7604ce06084ef23' }, // Rota ES
];

const CODIGO_TITULO_PAI = '1.01.002';   // Bancos

function dataBackupTag() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

(async () => {
  let conexao;
  try {
    console.log('🔌 Conectando ao MongoDB...');
    conexao = await mongoose.connect(URI);
    console.log('✅ Conectado.\n');

    const db = mongoose.connection.db;
    const colSub      = db.collection('contasubtitulos');
    const colContas   = db.collection('_aux_contas_bancarias');
    const colBoletas  = db.collection('_boletas');

    // ========================================================
    // PASSO 1: SEGURANÇA — sem movimento nos subtítulos atuais
    // ========================================================
    console.log('🔒 Passo 1/6 — Verificando se há movimento nos subtítulos bancários atuais...');

    const subsAtuais = await colSub.find({ codigoContaTitulo: CODIGO_TITULO_PAI }).toArray();
    console.log(`   Subtítulos bancários encontrados: ${subsAtuais.length}`);

    if (subsAtuais.length === 0) {
      console.error('❌ ABORTADO: Nenhum subtítulo encontrado em 1.01.002.x. Verifique o plano.');
      await mongoose.disconnect();
      process.exit(1);
    }

    const codigosAtuais = subsAtuais.map(s => s.codigo);
    const subIdsAtuais  = subsAtuais.map(s => s._id);

    // Confere se alguma boleta usa esses subtítulos (banco ou contrapartida)
    const boletasComEsses = await colBoletas.countDocuments({
      $or: [
        { bancoCodigo:   { $in: codigosAtuais } },
        { bancoSubTitulo:{ $in: subIdsAtuais } },
        { 'contrapartidas.codigoConta':    { $in: codigosAtuais } },
        { 'contrapartidas.contaSubTitulo': { $in: subIdsAtuais } },
      ]
    });

    if (boletasComEsses > 0) {
      console.error(`❌ ABORTADO: Existem ${boletasComEsses} boleta(s) usando esses subtítulos.`);
      console.error('   Não posso deletar/recriar — perderia integridade dos lançamentos.');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log('   ✅ Sem movimento. Seguro prosseguir.\n');

    // Pega o contaTituloId do primeiro subtítulo (todos têm o mesmo pai)
    const contaTituloId = subsAtuais[0].contaTituloId;
    console.log(`   contaTituloId (Bancos): ${contaTituloId}\n`);

    // ========================================================
    // PASSO 2: BACKUP
    // ========================================================
    const tagBackup = dataBackupTag();
    const nomeBackup = `_backup_contasubtitulos_${tagBackup}`;
    console.log(`💾 Passo 2/6 — Backup em "${nomeBackup}"...`);
    await db.collection(nomeBackup).insertMany(subsAtuais);
    console.log(`   ✅ ${subsAtuais.length} documentos salvos.\n`);

    // ========================================================
    // PASSO 3: DELETAR SUBTÍTULOS ATUAIS
    // ========================================================
    console.log('🗑  Passo 3/6 — Deletando subtítulos atuais de 1.01.002.x...');
    const rDel = await colSub.deleteMany({ codigoContaTitulo: CODIGO_TITULO_PAI });
    console.log(`   ✅ ${rDel.deletedCount} subtítulos deletados.\n`);

    // ========================================================
    // PASSO 4: CRIAR OS 7 SUBTÍTULOS NOVOS
    // ========================================================
    console.log('✨ Passo 4/6 — Criando os 7 subtítulos novos...');
    const agora = new Date();
    const novos = PLANO.map(p => ({
      contaTituloId,
      codigoContaTitulo: CODIGO_TITULO_PAI,
      codigo:    `${CODIGO_TITULO_PAI}.${p.seq}`,
      nome:      p.nome,
      descricao: '',
      saldoInicial: 0,
      natureza: 'devedora',     // Banco é Ativo → devedora
      ativo: true,
      criadoEm: agora,
      atualizadoEm: agora,
      __v: 0,
    }));
    const rIns = await colSub.insertMany(novos);
    console.log(`   ✅ ${rIns.insertedCount} subtítulos criados.`);

    // Mapa: contaBancariaId -> _id do subtítulo recém-criado
    const subIdPorConta = {};
    PLANO.forEach((p, i) => {
      subIdPorConta[p.contaBancariaId] = rIns.insertedIds[i];
    });

    novos.forEach((s, i) => {
      console.log(`      ${s.codigo}  ${s.nome.padEnd(20)} _id=${rIns.insertedIds[i]}`);
    });
    console.log('');

    // ========================================================
    // PASSO 5: VINCULAR CONTAS BANCÁRIAS
    // ========================================================
    console.log('🔗 Passo 5/6 — Vinculando contas bancárias aos novos subtítulos...');
    let vinculadas = 0;
    for (const p of PLANO) {
      const subId = subIdPorConta[p.contaBancariaId];
      const r = await colContas.updateOne(
        { _id: new mongoose.Types.ObjectId(p.contaBancariaId) },
        { $set: { contaSubTitulo: subId, atualizadoEm: agora } }
      );
      if (r.matchedCount === 1) {
        vinculadas++;
        console.log(`   ✅ Conta ${p.contaBancariaId} → ${CODIGO_TITULO_PAI}.${p.seq} ${p.nome}`);
      } else {
        console.log(`   ⚠ Conta ${p.contaBancariaId} NÃO encontrada em _aux_contas_bancarias`);
      }
    }
    console.log(`   Total vinculadas: ${vinculadas}/${PLANO.length}\n`);

    // ========================================================
    // PASSO 6: DIAGNÓSTICO FINAL
    // ========================================================
    console.log('📊 Passo 6/6 — Diagnóstico final:\n');
    const todasContas = await colContas
      .aggregate([
        {
          $lookup: {
            from: 'contasubtitulos',
            localField: 'contaSubTitulo',
            foreignField: '_id',
            as: 'sub',
          },
        },
        { $unwind: { path: '$sub', preserveNullAndEmptyArrays: true } },
        { $sort: { 'sub.codigo': 1 } },
      ])
      .toArray();

    console.log('   Código          Apelido               Titular                            Subtítulo');
    console.log('   --------------- --------------------- ---------------------------------- ----------------------');
    for (const c of todasContas) {
      const code  = (c.sub?.codigo || '(VAZIO)').padEnd(15);
      const apel  = (c.apelido || '').padEnd(21);
      const tit   = (c.titular || '').padEnd(34);
      const nome  = c.sub?.nome || '';
      console.log(`   ${code} ${apel} ${tit} ${nome}`);
    }
    console.log('');

    console.log('🎉 Reconstrução concluída com sucesso.');
    console.log(`   Backup disponível em: ${nomeBackup}`);
    console.log('');

    await mongoose.disconnect();
    console.log('🔌 Desconectado.');
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
    if (conexao) await mongoose.disconnect();
    process.exit(1);
  }
})();
