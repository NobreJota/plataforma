// =============================================================================
// Destino: C:\plataformaRota\src\scripts\2C-0-sincronizar-indices.js
// Alterado em: 24/09/2026  (acrescentado models/compra/pedido)
// Alterado em: 25/09/2026  (acrescentado models/compra/notaEntrada)
// Alterado em: 25/09/2026  (acrescentado models/grupo)
// Alterado em: 25/09/2026  (acrescentados grupoSub, fornec e empresa/lojista;
//                           documentados os models que ficaram de fora)
//
// Sincroniza os indices dos models com o banco.
// O Mongoose cria indices novos mas nunca apaga o antigo. Um `unique` global
// que ficou para tras continua ativo no banco e barra a segunda empresa.
// syncIndexes() apaga os que nao estao mais no schema e cria os que faltam.
//
// Model com `autoIndex: false` (grupo.js, por exemplo) depende SO deste
// script: sem ele, os indices declarados no schema nunca chegam ao banco.
// Foi o caso do unico de `grupo.codigo`, que so nasceu em 25/09/2026.
//
// CUIDADO AO ACRESCENTAR MODEL VELHO: syncIndexes() APAGA todo indice que o
// schema nao declara. Numa colecao antiga do site, com indice criado a mao
// ha anos, isso derruba o indice em silencio — a pagina so fica lenta.
// Antes de incluir um desses, olhe o que existe hoje:
//   db.getCollection("<colecao>").getIndexes()
//
// Uso:  node src/scripts/2C-0-sincronizar-indices.js
//
// Seguro de rodar mais de uma vez.
//
// A lista abaixo e escrita a mao: model novo nao entra sozinho. Sempre que
// nascer um model, acrescente aqui — senao os indices dele nunca existem no
// banco, e a protecao contra duplicata fica so no codigo da API.
// =============================================================================

require('dotenv').config();
const path = require('path');
const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'));

const MODELS = [
  // ---- plano de contas: grupo e comum, subgrupo e por empresa -------------
  '../models/grupo',
  '../models/grupoSub',

  // ---- multi-empresa ------------------------------------------------------
  '../models/empresa/lojista',

  // ---- contab -------------------------------------------------------------
  '../models/contab/auxiliares/cliente',
  '../models/contab/auxiliares/contaBancaria',
  '../models/contab/auxiliares/banco',
  '../models/contab/financeiro/boleta',
  '../models/contab/financeiro/compraAnual',
  '../models/contab/financeiro/compraFornecedor',
  '../models/contab/financeiro/contaSubTitulo',
  '../models/contab/financeiro/contaTitulo',
  '../models/contab/financeiro/fluxoCaixa',
  '../models/contab/financeiro/fluxoProjetado',
  '../models/contab/financeiro/historicoConta',
  '../models/contab/financeiro/orcamentoAnual',
  '../models/contab/financeiro/orcamentoConta',
  '../models/contab/financeiro/registroContabil',

  // ---- fornecedor (compartilhado por CNPJ, vinculo por empresa) -----------
  '../models/fornec',

  // ---- compras ------------------------------------------------------------
  '../models/compra/pedido',
  '../models/compra/notaEntrada'
];

// ---------------------------------------------------------------------------
// FORA DA LISTA, DE PROPOSITO (levantamento de 25/09/2026)
//
// Colecoes antigas do site. Entram quando alguem conferir os indices que ja
// existem no banco — syncIndexes() apagaria os nao declarados:
//   ../models/arquivoDoc          arquivo unico de produto/estoque
//   ../models/usuario
//   ../models/usuariosite
//   ../models/parceiro
//   ../models/campanha
//   ../models/similares
//   ../models/produtoImagem
//   ../models/bco_imagem
//   ../models/departamento
//   ../models/deptosecao
//   ../models/deptosetores
//   ../models/home_layout
//   ../models/lista-pedido
//   ../models/import_item
//   ../models/import_lote
//   ../models/ImportModelo
//
// Provavel lixo, a decidir antes de qualquer coisa:
//   ../models/fornecedor copy     copia de fornec.js; carregar colide no
//                                 mongoose.model() com o mesmo nome
//   ../models/Z_atividades
//   ../models/Z_mconstrucao
// ---------------------------------------------------------------------------

async function listarIndices(Model) {
  try {
    return (await Model.collection.indexes()).map(i => i.name);
  } catch (err) {
    if (/ns does not exist/i.test(err.message)) return [];   // colecao ainda vazia
    throw err;
  }
}

async function main() {
  await connectToDatabase();
  console.log('');

  for (const caminho of MODELS) {
    let Model;
    try {
      Model = require(path.join(__dirname, caminho));
    } catch (err) {
      console.log('[ERRO ao carregar] ' + caminho);
      console.log('    ' + err.message + '\n');
      continue;
    }

    const nome = Model.modelName;
    const colecao = Model.collection.collectionName;
    console.log(nome + '  (' + colecao + ')');

    const antes = await listarIndices(Model);

    try {
      await Model.syncIndexes();
    } catch (err) {
      console.log('    [ERRO ao sincronizar] ' + err.message + '\n');
      continue;
    }

    const depois = await listarIndices(Model);

    const criados = depois.filter(i => !antes.includes(i));
    const apagados = antes.filter(i => !depois.includes(i));

    if (!criados.length && !apagados.length) {
      console.log('    sem mudanças');
    } else {
      for (const i of apagados) console.log('    - apagado: ' + i);
      for (const i of criados) console.log('    + criado:  ' + i);
    }
    console.log('');
  }

  console.log('=== FIM ===');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n[erro] ' + err.message);
  process.exit(1);
});
