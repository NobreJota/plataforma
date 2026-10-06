// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-2-levantar-notas.js
// Criado em: 23/09/2026
//
// Levantamento para o modelo de compra:
//   1. Estrutura de NFE_Cabeçalho, NFE_Itens, NFE_Títulos
//   2. Decodifica o indice dos meses de PROD_Estatística_Mensal
//   3. Perfil da serie mensal (giro, concentracao, sazonalidade)
//   4. Verifica se o prazo de entrega e recuperavel
//
// SOMENTE LEITURA. Nao escreve no .mdb nem no MongoDB.
//
// Uso (na raiz C:\plataformaRota):
//   node src\scripts\COMPRA-2-levantar-notas.js --arquivo "C:\Armação\Dados\2026B\2026B.mdb" --salvar notas.txt
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

function lerArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--arquivo') args.arquivo = argv[++i];
    else if (argv[i] === '--salvar') args.salvar = argv[++i];
  }
  return args;
}

const buffer = [];
function out(linha = '') {
  console.log(linha);
  buffer.push(linha);
}

function acharTabela(todas, nome) {
  return todas.find(t => t === nome)
      || todas.find(t => t.replace(/[^\w]/g, '') === nome.replace(/[^\w]/g, ''))
      || nome;
}

function pegarTabela(reader, todas, nome) {
  try { return reader.getTable(acharTabela(todas, nome)); }
  catch (e) { out('    [nao encontrada] ' + nome + ': ' + e.message); return null; }
}

function valorResumido(v) {
  if (v === null || v === undefined) return 'null';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Buffer.isBuffer(v)) return '<buffer ' + v.length + 'b>';
  const s = String(v);
  return s.length > 40 ? s.slice(0, 37) + '...' : s;
}

// Data sentinela do sistema antigo
function dataValida(d) {
  return d instanceof Date && !isNaN(d) && d.getUTCFullYear() > 1950;
}

// ---------------------------------------------------------------------------
// 1) Estrutura das tabelas de nota
// ---------------------------------------------------------------------------
function estrutura(reader, todas, nomes, amostras) {
  for (const nome of nomes) {
    const t = pegarTabela(reader, todas, nome);
    if (!t) continue;
    const cols = t.getColumns();
    out('');
    out('### ' + nome + '  --  ' + t.rowCount + ' registros, ' + cols.length + ' colunas');
    out('');
    for (const c of cols) {
      out('    ' + String(c.name).padEnd(28) + ' ' + c.type + (c.size ? ' (' + c.size + ')' : ''));
    }
    if (amostras > 0 && t.rowCount > 0) {
      out('');
      out('    --- amostra ---');
      t.getData({ rowLimit: amostras }).forEach((linha, i) => {
        out('    [' + (i + 1) + ']');
        for (const [k, v] of Object.entries(linha)) {
          out('        ' + String(k).padEnd(26) + ' = ' + valorResumido(v));
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 2) Qte_01 e qual mes? Testa os 12 deslocamentos contra a venda crua.
// ---------------------------------------------------------------------------
function decodificarMeses(reader, todas) {
  const tCupom = pegarTabela(reader, todas, 'Vendas_SaídaCupom');
  const tItens = pegarTabela(reader, todas, 'Vendas_SaídaCupomItens');
  const tEst   = pegarTabela(reader, todas, 'PROD_Estatística_Mensal');
  if (!tCupom || !tItens || !tEst) return null;

  const dataCupom = new Map();
  for (const c of tCupom.getData()) {
    if (dataValida(c['Data'])) dataCupom.set(Number(c['NrCupom']), c['Data']);
  }

  // cru[prod][mes 1..12] no ano corrente
  const cru = new Map();
  for (const it of tItens.getData()) {
    const d = dataCupom.get(Number(it['NrCupom']));
    if (!d) continue;
    const cod = Number(it['CódigoProd']);
    if (!cru.has(cod)) cru.set(cod, new Array(13).fill(0));
    cru.get(cod)[d.getUTCMonth() + 1] += Number(it['Qte']) || 0;
  }

  const est = tEst.getData();
  out('');
  out('### Indice dos meses em PROD_Estatística_Mensal');
  out('');
  out('    Produtos na tabela: ' + est.length);

  const placar = [];
  for (let off = 0; off < 12; off++) {
    let iguais = 0, iguaisNaoZero = 0, diferentes = 0;
    for (const r of est) {
      const cod = Number(r['ProdCod']);
      const linha = cru.get(cod);
      for (let k = 1; k <= 12; k++) {
        const mes = ((k - 1 + off) % 12) + 1;
        const tabela = Number(r['Qte_' + String(k).padStart(2, '0')]) || 0;
        const real = linha ? linha[mes] : 0;
        if (tabela === real) {
          iguais++;
          if (tabela !== 0) iguaisNaoZero++;
        } else diferentes++;
      }
    }
    placar.push({ off, iguais, iguaisNaoZero, diferentes });
  }

  placar.sort((a, b) => b.iguaisNaoZero - a.iguaisNaoZero);

  out('');
  out('    desloc   Qte_01 =    iguais!=0   iguais    difere');
  const MES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  for (const p of placar.slice(0, 4)) {
    out('      ' + String(p.off).padStart(2)
      + '      ' + MES[p.off].padEnd(8)
      + String(p.iguaisNaoZero).padStart(8)
      + String(p.iguais).padStart(10)
      + String(p.diferentes).padStart(10));
  }

  const melhor = placar[0];
  out('');
  out('    => Qte_01 corresponde a ' + MES[melhor.off].toUpperCase());
  if (melhor.iguaisNaoZero < 50) {
    out('    [ALERTA] Encaixe fraco. A tabela pode ser de outro periodo,');
    out('             ou estar desatualizada em relacao as vendas.');
  }
  return melhor.off;
}

// ---------------------------------------------------------------------------
// 3) Perfil da serie: giro, concentracao, sazonalidade
// ---------------------------------------------------------------------------
function perfilSerie(reader, todas) {
  const tEst = pegarTabela(reader, todas, 'PROD_Estatística_Mensal');
  if (!tEst) return;

  const faixas = { zero: 0, ate2: 0, ate5: 0, ate12: 0, ate50: 0, acima: 0 };
  const mesesComVenda = new Array(13).fill(0);
  let concentrados = 0, comSerie = 0;

  for (const r of tEst.getData()) {
    const q = [];
    for (let k = 1; k <= 12; k++) q.push(Number(r['Qte_' + String(k).padStart(2, '0')]) || 0);
    const total = q.reduce((a, b) => a + b, 0);
    const nMeses = q.filter(v => v > 0).length;
    const pico = Math.max(...q);

    mesesComVenda[nMeses]++;
    if (total === 0) faixas.zero++;
    else if (total <= 2) faixas.ate2++;
    else if (total <= 5) faixas.ate5++;
    else if (total <= 12) faixas.ate12++;
    else if (total <= 50) faixas.ate50++;
    else faixas.acima++;

    if (total >= 3) {
      comSerie++;
      if (pico / total >= 0.5) concentrados++;
    }
  }

  out('');
  out('### Perfil da serie mensal');
  out('');
  out('    Giro anual por produto:');
  out('        zero ............ ' + faixas.zero);
  out('        1 a 2 ........... ' + faixas.ate2);
  out('        3 a 5 ........... ' + faixas.ate5);
  out('        6 a 12 .......... ' + faixas.ate12);
  out('        13 a 50 ......... ' + faixas.ate50);
  out('        acima de 50 ..... ' + faixas.acima);

  out('');
  out('    Em quantos meses do ano houve venda:');
  for (let n = 0; n <= 12; n++) {
    if (mesesComVenda[n]) out('        ' + String(n).padStart(2) + ' meses ...... ' + mesesComVenda[n]);
  }

  out('');
  out('    Produtos com giro >= 3: ' + comSerie);
  out('    Destes, com metade ou mais do ano concentrado em UM mes: ' + concentrados);
  out('    (esse e o grupo que exige tratamento sazonal)');
}

// ---------------------------------------------------------------------------
// 4) O prazo de entrega e recuperavel?
// ---------------------------------------------------------------------------
function prazoEntrega(reader, todas) {
  const t = pegarTabela(reader, todas, 'PED_PedidoFornecedor');
  if (!t) return;

  const dados = t.getData();
  let comEntrega = 0, comPrevisao = 0;
  const prazos = [];

  for (const p of dados) {
    const emis = p['DataEmisPedido'];
    if (dataValida(p['Previsão'])) comPrevisao++;
    if (dataValida(p['Entrega'])) {
      comEntrega++;
      if (dataValida(emis)) {
        prazos.push(Math.round((p['Entrega'].getTime() - emis.getTime()) / 86400000));
      }
    }
  }

  out('');
  out('### Prazo de entrega em PED_PedidoFornecedor');
  out('');
  out('    Pedidos ................... ' + dados.length);
  out('    Com data de Entrega real .. ' + comEntrega);
  out('    Com Previsão real ......... ' + comPrevisao);

  if (prazos.length) {
    prazos.sort((a, b) => a - b);
    const p50 = prazos[Math.floor(prazos.length * 0.5)];
    const p80 = prazos[Math.floor(prazos.length * 0.8)];
    out('    Prazo tipico (p50) ........ ' + p50 + ' dias');
    out('    Prazo ruim   (p80) ........ ' + p80 + ' dias');
  } else {
    out('');
    out('    [sem dado] O campo Entrega nao foi preenchido.');
    out('    O prazo tera que sair do cruzamento com as notas de entrada,');
    out('    ou de faixas informadas por fornecedor.');
  }

  out('');
  out('    Condicoes de pagamento usadas:');
  const cond = new Map();
  for (const p of dados) {
    const c = String(p['CondPag'] ?? '').trim() || '(vazio)';
    cond.set(c, (cond.get(c) || 0) + 1);
  }
  for (const [c, n] of [...cond].sort((a, b) => b[1] - a[1])) {
    out('        ' + String(n).padStart(4) + '  ' + c);
  }
}

// ---------------------------------------------------------------------------
function main() {
  const args = lerArgs(process.argv);
  if (!args.arquivo || !fs.existsSync(args.arquivo)) {
    console.error('\n[erro] informe --arquivo com um caminho valido\n');
    process.exit(1);
  }

  const reader = new MDBReader(fs.readFileSync(args.arquivo));
  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  out('='.repeat(78));
  out('Levantamento para o modelo de compra');
  out(args.arquivo);
  out('SOMENTE LEITURA -- nada foi alterado.');
  out('='.repeat(78));

  out('');
  out('/'.repeat(30) + ' 1. NOTAS DE ENTRADA ' + '/'.repeat(28));
  estrutura(reader, todas, ['NFE_Cabeçalho', 'NFE_Itens', 'NFE_Títulos'], 3);

  out('');
  out('/'.repeat(30) + ' 2. SERIE MENSAL ' + '/'.repeat(32));
  decodificarMeses(reader, todas);
  perfilSerie(reader, todas);

  out('');
  out('/'.repeat(30) + ' 3. PRAZO DE ENTREGA ' + '/'.repeat(28));
  prazoEntrega(reader, todas);

  if (args.salvar) {
    const destino = path.resolve(args.salvar);
    fs.writeFileSync(destino, buffer.join('\n'), 'utf8');
    console.log('\n[ok] relatorio salvo em ' + destino);
  }
}

main();