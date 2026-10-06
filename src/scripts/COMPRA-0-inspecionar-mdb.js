// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-0-inspecionar-mdb.js
// Alterado em: 23/09/2026  (v2: presets --pedido e --periodo)
//
// Inspetor do banco Access do sistema antigo (Armação / VB5 / 1997).
// SOMENTE LEITURA. Nunca abre o .mdb para escrita e nunca toca no MongoDB.
//
// Uso (na raiz C:\plataformaRota, um comando por vez):
//   node src\scripts\COMPRA-0-inspecionar-mdb.js --arquivo "..." --periodo
//   node src\scripts\COMPRA-0-inspecionar-mdb.js --arquivo "..." --pedido --linhas 3
//   node src\scripts\COMPRA-0-inspecionar-mdb.js --arquivo "..." --tabela A,B,C
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

let MDBReader;
try {
  const mod = require('mdb-reader');
  MDBReader = mod.default || mod;
} catch (e) {
  console.error('\n[erro] mdb-reader nao encontrado. Rode: npm install mdb-reader\n');
  process.exit(1);
}

const TABELAS_FOCO = [
  'PROD_Produto',
  'PROD_Produto_Detalhes',
  'Vendas_SaídaCupom',
  'Vendas_SaídaCupomItens',
];

// Tabelas que descrevem o pedido no sistema antigo.
const TABELAS_PEDIDO = [
  'Compras_MédiaQuant',
  'Compras_MédiaSintetizada',
  'PED_PedidoFornecedor',
  'PED_PedidoFornecedorItens',
  'PED_PedidoZerado',
  'PED_Previsão',
  'Compras_Fornecedores',
  'Compras_Transportadoras',
  'Compras_Representantes',
  'PROD_Estatística_Mensal',
];

function lerArgs(argv) {
  const args = { linhas: 3 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--arquivo') args.arquivo = argv[++i];
    else if (a === '--tabela') args.tabela = argv[++i];
    else if (a === '--linhas') args.linhas = Number(argv[++i]) || 3;
    else if (a === '--salvar') args.salvar = argv[++i];
    else if (a === '--foco') args.foco = true;
    else if (a === '--pedido') args.pedido = true;
    else if (a === '--periodo') args.periodo = true;
  }
  return args;
}

const buffer = [];
function out(linha = '') {
  console.log(linha);
  buffer.push(linha);
}

function valorResumido(v) {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Buffer.isBuffer(v)) return '<buffer ' + v.length + 'b>';
  const s = String(v);
  return s.length > 40 ? s.slice(0, 37) + '...' : s;
}

function acharTabela(todas, nome) {
  return todas.find(t => t === nome)
      || todas.find(t => t.replace(/[^\w]/g, '') === nome.replace(/[^\w]/g, ''))
      || nome;
}

function inspecionarTabela(reader, nome, linhas) {
  let tabela;
  try {
    tabela = reader.getTable(nome);
  } catch (e) {
    out('');
    out('### ' + nome);
    out('    [nao encontrada] ' + e.message);
    return;
  }

  const colunas = tabela.getColumns();
  out('');
  out('### ' + nome + '  --  ' + tabela.rowCount + ' registros, ' + colunas.length + ' colunas');
  out('');
  for (const c of colunas) {
    const tam = c.size ? ' (' + c.size + ')' : '';
    out('    ' + String(c.name).padEnd(28) + ' ' + c.type + tam);
  }

  if (linhas > 0 && tabela.rowCount > 0) {
    let dados = [];
    try {
      dados = tabela.getData({ rowLimit: linhas });
    } catch (e) {
      out('    [erro ao ler amostra] ' + e.message);
      return;
    }
    out('');
    out('    --- amostra (' + dados.length + ') ---');
    dados.forEach((linha, i) => {
      out('    [' + (i + 1) + ']');
      for (const [k, v] of Object.entries(linha)) {
        out('        ' + String(k).padEnd(26) + ' = ' + valorResumido(v));
      }
    });
  }
}

// Ate onde vao as vendas? Define se as janelas 30/60/90 tem dado.
function periodoVendas(reader, todas) {
  const nome = acharTabela(todas, 'Vendas_SaídaCupom');
  let tabela;
  try {
    tabela = reader.getTable(nome);
  } catch (e) {
    out('[erro] ' + nome + ': ' + e.message);
    return;
  }

  const dados = tabela.getData();
  const porMes = new Map();
  let min = null, max = null, semData = 0;

  for (const linha of dados) {
    const d = linha['Data'];
    if (!(d instanceof Date) || isNaN(d)) { semData++; continue; }
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
    const chave = d.toISOString().slice(0, 7);
    porMes.set(chave, (porMes.get(chave) || 0) + 1);
  }

  out('');
  out('### Periodo das vendas  --  ' + nome);
  out('');
  out('    Cupons ....... ' + dados.length);
  out('    Sem data ..... ' + semData);
  out('    Primeiro ..... ' + (min ? min.toISOString().slice(0, 10) : '-'));
  out('    Ultimo ....... ' + (max ? max.toISOString().slice(0, 10) : '-'));

  if (max) {
    const dias = Math.round((Date.now() - max.getTime()) / 86400000);
    out('    Defasagem .... ' + dias + ' dias em relacao a hoje');
    if (dias > 30) {
      out('');
      out('    [ALERTA] A janela de 30 dias contada de hoje vem VAZIA.');
    }
  }

  out('');
  out('    Cupons por mes:');
  for (const chave of [...porMes.keys()].sort()) {
    out('        ' + chave + '   ' + String(porMes.get(chave)).padStart(6));
  }
}

function finalizar(args) {
  if (args.salvar) {
    const destino = path.resolve(args.salvar);
    fs.writeFileSync(destino, buffer.join('\n'), 'utf8');
    console.log('\n[ok] relatorio salvo em ' + destino);
  }
}

function main() {
  const args = lerArgs(process.argv);

  if (!args.arquivo) {
    console.error('\n[erro] informe --arquivo "C:\\Armação\\Dados\\2026B\\2026B.mdb"\n');
    process.exit(1);
  }
  if (!fs.existsSync(args.arquivo)) {
    console.error('\n[erro] arquivo nao encontrado: ' + args.arquivo + '\n');
    process.exit(1);
  }

  const reader = new MDBReader(fs.readFileSync(args.arquivo));
  const stat = fs.statSync(args.arquivo);

  out('='.repeat(78));
  out('Inspecao: ' + args.arquivo);
  out('Tamanho: ' + (stat.size / 1048576).toFixed(1) + ' MB   Modificado: ' + stat.mtime.toLocaleString('pt-BR'));
  out('SOMENTE LEITURA -- nada foi alterado.');
  out('='.repeat(78));

  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  if (args.periodo) {
    periodoVendas(reader, todas);
    return finalizar(args);
  }

  if (args.tabela) {
    for (const nome of args.tabela.split(',').map(s => s.trim()).filter(Boolean)) {
      inspecionarTabela(reader, acharTabela(todas, nome), args.linhas);
    }
    return finalizar(args);
  }

  if (args.pedido) {
    out('');
    out('Tabelas do pedido no sistema antigo (' + TABELAS_PEDIDO.length + '):');
    for (const nome of TABELAS_PEDIDO) {
      inspecionarTabela(reader, acharTabela(todas, nome), args.linhas);
    }
    return finalizar(args);
  }

  if (args.foco) {
    out('');
    out('Tabelas do modulo de compras (' + TABELAS_FOCO.length + '):');
    for (const nome of TABELAS_FOCO) {
      inspecionarTabela(reader, acharTabela(todas, nome), args.linhas);
    }
    return finalizar(args);
  }

  out('');
  out('Tabelas encontradas: ' + todas.length);
  out('');
  for (const nome of todas.sort()) {
    let qtd = '?';
    try { qtd = reader.getTable(nome).rowCount; } catch (e) { qtd = 'erro'; }
    out('    ' + String(qtd).padStart(8) + '  ' + nome);
  }
  out('');
  out('Detalhar: --foco | --pedido | --periodo | --tabela NOME1,NOME2');

  finalizar(args);
}

main();