// =============================================================================
// Destino: C:\plataformaRota\src\models\contab\config-contas.js
// Criado em: 16/10/2026
//
// CONFIGURACAO DE CONTAS POR CHAVE (ideia do Jorge): o codigo nao tem mais a conta escrita;
// usa uma CHAVE (ex.: 'os-receita-servico') e a conta vem da colecao _config_contas da loja.
// Assim a conta pode ser trocada na empresa, pelo navegador (botao ★ da pagina), sem mexer
// no codigo nem publicar de novo.
//   - chave sem configuracao: vale o PADRAO (a conta que o codigo usava antes)
//   - chave sem padrao e sem configuracao: o lancamento para com "configure a conta ..."
//   - trocar a conta vale so para os lancamentos NOVOS (o que ja foi lancado nao muda)
//   - cada troca fica no historico do documento (de, para, quando)
// Documento: { lojistaId, chave, codigo, alteradoEm, historico: [{ de, para, em }] }
// Alterado em: 16/10/2026 - buscar(): consulta ao plano de contas (codigo ou nome) para o botao
//              do plano na janela de configuracao. navegar(): botoes Ativo/Passivo/Despesas/Receitas,
//              grupo -> subgrupos -> titulos -> contas.
// Alterado em: 16/10/2026 - conta COM MOVIMENTO (boleta ativa) nao pode ser trocada: listar() avisa
//              (movimento: true) e gravar() recusa. SUSPENSA (TRAVAR_COM_MOVIMENTO = false): nesta
//              fase as contas ainda mudam; a devolucao de vendido volta a ter o CPV como padrao.
// Alterado em: 17/10/2026 - pagina 'venda' (botao ★ da instalacao): receita de mao de obra e o TITULO
//              "mao de obra a apropriar" (2.06.002). Chave do tipo 'titulo': guarda um titulo e a conta
//              de cada tecnico e titulo + final da conta dele (2.06.001.008 -> 2.06.002.008).
// Alterado em: 18/10/2026 - pagina 'receber' (Fluxo de Caixa > Vendas - receber): juros e desconto.
// Alterado em: 24/10/2026 - pagina 'cartoes' (Fluxo de Caixa > Cartões - recebimento em lote): a conta de
//              despesa da taxa / juros do cartao (diferenca entre o total das parcelas e o liquido no banco).
// Cada pagina tem a sua lista (campo "pagina" do catalogo). Novas chaves: so acrescentar
// no CATALOGO abaixo.
// =============================================================================

'use strict';

const mongoose = require('mongoose');
const col = n => mongoose.connection.collection(n);
const COLECAO = '_config_contas';
const Boleta = require('./financeiro/boleta');

// 16/10/2026 (Jorge): conta COM MOVIMENTO nao pode ser trocada na configuracao
//   movimento = alguma boleta ATIVA da loja usando a conta (perna ou contrapartida)
// SUSPENSA em 16/10/2026: nesta fase muita conta ainda vai mudar. Para voltar a travar: true.
const TRAVAR_COM_MOVIMENTO = false;
const temMovimento = (loja, codigo) => codigo ? Boleta.exists({ lojistaId: loja, status: 'ATIVO',
  $or: [{ bancoCodigo: codigo }, { 'contrapartidas.codigoConta': codigo }] }).then(Boolean) : Promise.resolve(false);

const CATALOGO = {
  // ---- ficha de fechamento da OS (/vendas/servicos/fechamento/:id) ----
  'os-receita-servico': { pagina: 'os-fechamento', ordem: 1, padrao: '4.05.001.001',
    rotulo: 'Receita de serviços (mão de obra)',
    uso: 'mão de obra da venda e da OS, valor adicional. A parte do técnico sai desta conta para a conta dele.' },
  'os-receita-material': { pagina: 'os-fechamento', ordem: 2, padrao: '4.02.001.001',
    rotulo: 'Venda de material (consignado vendido)',
    uso: 'consignado usado com destino "venda adicional": cliente (D) x esta conta (C), preço de venda.' },
  'os-cpv': { pagina: 'os-fechamento', ordem: 3, padrao: '3.05.001.001',
    rotulo: 'Custo do material vendido (CPV)',
    uso: 'consignado vendido: esta conta (D) x estoque (C), a preço de custo.' },
  'os-material-complementar': { pagina: 'os-fechamento', ordem: 4, padrao: '3.06.006.004',
    rotulo: 'Material complementar / cortesia',
    uso: 'consignado usado com destino "complementar": esta conta (D) x estoque (C), a preço de custo.' },
  'os-estoque': { pagina: 'os-fechamento', ordem: 5, padrao: '1.02.001.001',
    rotulo: 'Estoque de mercadorias',
    uso: 'saída do consignado usado e volta do material vendido devolvido, sempre a preço de custo.' },
  'os-devolucao-vendido': { pagina: 'os-fechamento', ordem: 6, padrao: '3.05.001.001',
    rotulo: 'Devolução de material vendido [1]',
    uso: 'material vendido que voltou e o cliente não recebe de volta (saldo a compensar, sem troca): '
       + 'estoque (D) x esta conta (C), a preço de custo. Padrão: estorna o CPV.' },
  'os-mo-adicional-cortesia': { pagina: 'os-fechamento', ordem: 7, padrao: '',
    rotulo: 'Mão de obra adicional paga pela empresa (cortesia)',
    uso: 'mão de obra adicional que a empresa paga ao técnico: esta conta (D) x conta do técnico (C).' },

  // ---- venda (modal da instalacao, 17/10/2026) ----
  'venda-mo-receita': { pagina: 'venda', ordem: 1, padrao: '4.05.001.001',
    rotulo: 'Receita de mão de obra (parte da empresa)',
    uso: 'na nota fiscal: a parte da EMPRESA na mão de obra cobrada do cliente vai para esta conta (C).' },
  'venda-mo-apropriar': { pagina: 'venda', ordem: 2, padrao: '2.06.002', tipo: 'titulo',
    rotulo: 'Mão de obra a apropriar',
    uso: 'TÍTULO das contas "a apropriar" de cada técnico. Na nota fiscal a parte do TÉCNICO vai para a conta dele '
       + 'neste título (mesmo final da 2.06.001: José 2.06.001.008 -> 2.06.002.008) até a OS ser fechada.' },

  // ---- fluxo de caixa > vendas - receber (18/10/2026): juros e desconto no recebimento ----
  'receber-juros': { pagina: 'receber', ordem: 1, padrao: '',
    rotulo: 'Juros / multa recebidos do cliente',
    uso: 'recebimento de título com juros: o que o cliente pagou A MAIS vai para esta conta (C); o banco recebe o total.' },
  'receber-desconto': { pagina: 'receber', ordem: 2, padrao: '',
    rotulo: 'Desconto concedido ao cliente',
    uso: 'recebimento de título com desconto: o que o cliente pagou A MENOS vai para esta conta (D); o título baixa inteiro.' },

  // ---- fluxo de caixa > cartoes - recebimento em lote (24/10/2026) ----
  'cartao-taxa': { pagina: 'cartoes', ordem: 1, padrao: '',
    rotulo: 'Despesa com taxa e juros de cartão',
    uso: 'recebimento de cartão em lote: a diferença entre o total das parcelas e o líquido que caiu no banco vai para esta conta (D).' },
};

const subtitulo = (loja, codigo, session) =>
  col('_contasubtitulos').findOne({ lojistaId: loja, codigo, ativo: { $ne: false } }, session ? { session } : {});

const erro = (status, msg) => Object.assign(new Error(msg), { status });
const COMUM = loja => ({ $or: [{ lojistaId: loja }, { lojistaId: { $exists: false } }, { lojistaId: null }] });
// conta do tipo da chave: subtitulo (padrao) ou titulo
const contaDoTipo = (loja, codigo, tipo, session) => tipo === 'titulo'
  ? col('_contatitulos').findOne({ ...COMUM(loja), codigo, ativo: { $ne: false } }, session ? { session } : {})
  : subtitulo(loja, codigo, session);

// 17/10/2026: conta do TECNICO dentro de um titulo da configuracao (titulo + final da conta dele)
//   ('venda-mo-apropriar', '2.06.001.008') -> subtitulo 2.06.002.008
async function contaDoTecnico(loja, chaveTitulo, tecnicoConta, session) {
  const tit = await codigoDe(loja, chaveTitulo, session);
  const final = String(tecnicoConta || '').split('.').pop();
  if (!final) throw erro(400, 'escolha o técnico');
  const codigo = tit + '.' + final;
  const c = await subtitulo(loja, codigo, session);
  if (!c) throw erro(404, 'a conta ' + codigo + ' (' + CATALOGO[chaveTitulo].rotulo.replace(' (título)', '') + ' do técnico ' + tecnicoConta
    + ') não está no plano: crie no título ' + tit + ' com o mesmo final da conta do técnico');
  return c;
}

// codigo da conta da chave (configurado ou padrao)
async function codigoDe(loja, chave, session) {
  const cat = CATALOGO[chave];
  if (!cat) throw erro(500, 'chave de conta desconhecida: ' + chave);
  const doc = await col(COLECAO).findOne({ lojistaId: loja, chave }, session ? { session } : {});
  const codigo = (doc && doc.codigo) || cat.padrao;
  if (!codigo) throw erro(400, 'configure a conta "' + cat.rotulo + '" (botão ★ configuração da página)');
  return codigo;
}

// a conta (subtitulo) da chave, conferindo se existe no plano
async function contaDe(loja, chave, session) {
  const codigo = await codigoDe(loja, chave, session);
  const c = await subtitulo(loja, codigo, session);
  if (!c) throw erro(404, 'a conta ' + codigo + ' ("' + CATALOGO[chave].rotulo + '") não está no plano (ou está suspensa): troque no botão ★ configuração');
  return c;
}

// lista da pagina, com o nome da conta
async function listar(loja, pagina) {
  const chaves = Object.entries(CATALOGO).filter(([, c]) => c.pagina === pagina).sort((a, b) => a[1].ordem - b[1].ordem);
  const docs = await col(COLECAO).find({ lojistaId: loja, chave: { $in: chaves.map(([k]) => k) } }).toArray();
  const out = [];
  for (const [chave, cat] of chaves) {
    const doc = docs.find(d => d.chave === chave);
    const codigo = (doc && doc.codigo) || cat.padrao;
    const c = codigo ? await contaDoTipo(loja, codigo, cat.tipo) : null;
    out.push({ chave, rotulo: cat.rotulo, uso: cat.uso, padrao: cat.padrao, codigo, configurada: !!(doc && doc.codigo), tipo: cat.tipo || 'conta',
               nome: c ? c.nome : '', existe: !!c, alteradoEm: doc ? doc.alteradoEm : null,
               movimento: TRAVAR_COM_MOVIMENTO && c ? await temMovimento(loja, codigo) : false });
  }
  return out;
}

// troca a conta da chave (vale para os lancamentos novos)
async function gravar(loja, chave, codigo) {
  const cat = CATALOGO[chave];
  if (!cat) throw erro(404, 'chave desconhecida: ' + chave);
  codigo = String(codigo || '').trim();
  if (!codigo) throw erro(400, 'informe a conta');
  const c = await contaDoTipo(loja, codigo, cat.tipo);
  if (!c) throw erro(404, (cat.tipo === 'titulo' ? 'o título ' : 'a conta ') + codigo + ' não está no plano (ou está suspenso)');
  const atual = await codigoDe(loja, chave).catch(() => '');
  if (atual === codigo) return { codigo, nome: c.nome, mudou: false };
  if (TRAVAR_COM_MOVIMENTO && await temMovimento(loja, atual)) throw erro(409, '"' + cat.rotulo + '": a conta ' + atual + ' já tem movimento. Não pode mudar conta com movimento.');
  const agora = new Date();
  await col(COLECAO).updateOne({ lojistaId: loja, chave }, {
    $set: { codigo, alteradoEm: agora },
    $push: { historico: { de: atual, para: codigo, em: agora } },
    $setOnInsert: { lojistaId: loja, chave, criadoEm: agora },
  }, { upsert: true });
  return { codigo, nome: c.nome, mudou: true };
}

// nome da conta (para a tela conferir o codigo digitado)
async function nomeConta(loja, codigo, tipo) {
  const c = await contaDoTipo(loja, String(codigo || '').trim(), tipo);
  return c ? c.nome : '';
}

// busca no plano de contas (botao do plano na configuracao): por codigo (comeco) ou por nome
async function buscar(loja, q, tipo) {
  q = String(q || '').trim();
  const fil = tipo === 'titulo' ? { ...COMUM(loja), ativo: { $ne: false } } : { lojistaId: loja, ativo: { $ne: false } };
  const rx = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[\d.]+$/.test(q)) fil.codigo = { $regex: '^' + rx };
  else if (q) fil.nome = { $regex: rx, $options: 'i' };
  const r = await col(tipo === 'titulo' ? '_contatitulos' : '_contasubtitulos').find(fil).project({ codigo: 1, nome: 1 }).sort({ codigo: 1 }).limit(60).toArray();
  return r.map(c => ({ codigo: c.codigo, nome: c.nome }));
}

// navegar no plano (botoes Ativo / Passivo / Despesas / Receitas):
//   '3' -> subgrupos 3.xx · '3.06' -> titulos 3.06.xxx · '3.06.006' -> subtitulos (as contas)
// subgrupo e titulo podem ser do plano comum (sem lojistaId)
const GRUPOS = { 1: 'Ativo', 2: 'Passivo', 3: 'Despesas', 4: 'Receitas' };
async function navegar(loja, codigo) {
  codigo = String(codigo || '').trim();
  if (!/^\d(\.\d+){0,2}$/.test(codigo)) throw erro(400, 'código inválido para navegar: ' + codigo);
  const nivel = codigo.split('.').length;                       // 1 grupo, 2 subgrupo, 3 titulo
  const rx = { $regex: '^' + codigo.replace(/\./g, '\\.') + '\\.[^.]+$' };
  const comum = { $or: [{ lojistaId: loja }, { lojistaId: { $exists: false } }, { lojistaId: null }] };
  const nomeDe = d => d.nome || d.descricao || '';
  let itens;
  if (nivel === 3) {
    itens = (await col('_contasubtitulos').find({ lojistaId: loja, ativo: { $ne: false }, codigo: rx })
      .project({ codigo: 1, nome: 1 }).toArray()).map(d => ({ codigo: d.codigo, nome: nomeDe(d), conta: true }));
  } else {
    const c = nivel === 1 ? 'subgrupos' : '_contatitulos';
    const vistos = new Map();
    for (const d of await col(c).find({ ...comum, ativo: { $ne: false }, codigo: rx }).toArray())
      if (!vistos.has(d.codigo) || d.lojistaId) vistos.set(d.codigo, { codigo: d.codigo, nome: nomeDe(d), conta: false });
    itens = [...vistos.values()];
  }
  itens.sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  // trilha: Despesas > 3.06 nome > 3.06.006 nome
  const trilha = [{ codigo: codigo.split('.')[0], nome: GRUPOS[codigo.split('.')[0]] || codigo.split('.')[0] }];
  if (nivel >= 2) { const g = await col('subgrupos').findOne({ ...comum, codigo: codigo.split('.').slice(0, 2).join('.') });
                    trilha.push({ codigo: codigo.split('.').slice(0, 2).join('.'), nome: g ? nomeDe(g) : '' }); }
  if (nivel >= 3) { const t = await col('_contatitulos').findOne({ ...comum, codigo });
                    trilha.push({ codigo, nome: t ? nomeDe(t) : '' }); }
  return { codigo, nivel, trilha, itens };
}

module.exports = { CATALOGO, GRUPOS, temMovimento, codigoDe, contaDe, contaDoTecnico, listar, gravar, nomeConta, buscar, navegar };
