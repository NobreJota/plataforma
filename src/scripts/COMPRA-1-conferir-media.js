// =============================================================================
// Destino: C:\plataformaRota\src\scripts\COMPRA-1-conferir-media.js
// Criado em: 23/09/2026
//
// Recalcula as janelas 15/30/60/90 a partir de Vendas_SaídaCupom(Itens) e
// compara com Compras_MédiaQuant, que o sistema antigo ja gravou.
// SOMENTE LEITURA. Nao escreve no .mdb nem no MongoDB.
//
// Uso (na raiz C:\plataformaRota):
//   node src\scripts\COMPRA-1-conferir-media.js --arquivo "C:\Armação\Dados\2026B\2026B.mdb" --salvar conferencia.txt
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

const DIA = 86400000;
const JANELAS = [15, 30, 60, 90];

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

// Soma a quantidade vendida de cada produto na janela que termina em "ancora".
function somarJanela(itens, ancora, dias, excluirDevolucao) {
  const inicio = ancora.getTime() - dias * DIA;
  const fim = ancora.getTime();
  const mapa = new Map();

  for (const it of itens) {
    const t = it.data.getTime();
    if (t < inicio || t > fim) continue;
    if (excluirDevolucao && it.devolucao) continue;
    mapa.set(it.cod, (mapa.get(it.cod) || 0) + it.qte);
  }
  return mapa;
}

function main() {
  const args = lerArgs(process.argv);
  if (!args.arquivo || !fs.existsSync(args.arquivo)) {
    console.error('\n[erro] informe --arquivo com um caminho valido\n');
    process.exit(1);
  }

  const reader = new MDBReader(fs.readFileSync(args.arquivo));
  const todas = reader.getTableNames().filter(n => !n.startsWith('MSys'));

  out('='.repeat(78));
  out('Conferencia das janelas de consumo');
  out(args.arquivo);
  out('='.repeat(78));

  // 1) data de cada cupom
  const cupons = new Map();
  for (const c of reader.getTable(acharTabela(todas, 'Vendas_SaídaCupom')).getData()) {
    const d = c['Data'];
    if (d instanceof Date && !isNaN(d)) cupons.set(Number(c['NrCupom']), d);
  }
  out('');
  out('Cupons com data: ' + cupons.size);

  // 2) itens com data resolvida
  const itens = [];
  let semCupom = 0;
  for (const it of reader.getTable(acharTabela(todas, 'Vendas_SaídaCupomItens')).getData()) {
    const data = cupons.get(Number(it['NrCupom']));
    if (!data) { semCupom++; continue; }
    itens.push({
      cod: Number(it['CódigoProd']),
      qte: Number(it['Qte']) || 0,
      data,
      devolucao: Number(it['NrDevolução']) !== 0,
    });
  }
  out('Itens usaveis:   ' + itens.length + '   (sem cupom correspondente: ' + semCupom + ')');

  // 3) o que o sistema antigo gravou
  const gravado = new Map();
  for (const r of reader.getTable(acharTabela(todas, 'Compras_MédiaQuant')).getData()) {
    gravado.set(Number(r['Cod']), {
      15: Number(r['Quinze']) || 0,
      30: Number(r['Trinta']) || 0,
      60: Number(r['Sessenta']) || 0,
      90: Number(r['Noventa']) || 0,
    });
  }
  out('Codigos gravados em Compras_MédiaQuant: ' + gravado.size);

  // 4) procurar a data-ancora que melhor explica o que foi gravado
  const datas = [...new Set(itens.map(i => i.data.toISOString().slice(0, 10)))]
    .sort().slice(-120).map(s => new Date(s + 'T23:59:59Z'));

  const placar = [];
  for (const ancora of datas) {
    for (const excluir of [false, true]) {
      const calc = somarJanela(itens, ancora, 30, excluir);
      let acertos = 0;
      for (const [cod, esperado] of gravado) {
        if ((calc.get(cod) || 0) === esperado[30]) acertos++;
      }
      placar.push({ ancora, excluir, acertos });
    }
  }
  placar.sort((a, b) => b.acertos - a.acertos);

  out('');
  out('### Melhores ancoras para a janela de 30 dias');
  out('');
  out('    data         devolucao        acertos / ' + gravado.size);
  for (const p of placar.slice(0, 5)) {
    out('    ' + p.ancora.toISOString().slice(0, 10)
      + '   ' + (p.excluir ? 'excluida ' : 'incluida ').padEnd(14)
      + String(p.acertos).padStart(5));
  }

  // 5) comparacao completa com a melhor ancora
  const melhor = placar[0];
  out('');
  out('### Conferencia das 4 janelas   (ancora ' + melhor.ancora.toISOString().slice(0, 10)
    + ', devolucao ' + (melhor.excluir ? 'excluida' : 'incluida') + ')');
  out('');

  const calculado = {};
  for (const j of JANELAS) calculado[j] = somarJanela(itens, melhor.ancora, j, melhor.excluir);

  const divergencias = [];
  const acertos = { 15: 0, 30: 0, 60: 0, 90: 0 };

  for (const [cod, esperado] of gravado) {
    const linha = { cod, dif: [] };
    for (const j of JANELAS) {
      const meu = calculado[j].get(cod) || 0;
      if (meu === esperado[j]) acertos[j]++;
      else linha.dif.push(j + 'd: antigo=' + esperado[j] + ' meu=' + meu);
    }
    if (linha.dif.length) divergencias.push(linha);
  }

  for (const j of JANELAS) {
    const pct = ((acertos[j] / gravado.size) * 100).toFixed(1);
    out('    ' + String(j).padStart(2) + ' dias .... '
      + String(acertos[j]).padStart(4) + ' / ' + gravado.size + '   (' + pct + '%)');
  }

  out('');
  out('Codigos com alguma divergencia: ' + divergencias.length);
  if (divergencias.length) {
    out('');
    out('    --- primeiras 15 ---');
    for (const d of divergencias.slice(0, 15)) {
      out('    cod ' + String(d.cod).padStart(6) + '   ' + d.dif.join('   '));
    }
  }

  if (args.salvar) {
    const destino = path.resolve(args.salvar);
    fs.writeFileSync(destino, buffer.join('\n'), 'utf8');
    console.log('\n[ok] relatorio salvo em ' + destino);
  }
}

main();