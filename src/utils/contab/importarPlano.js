// src/utils/contab/importarPlano.js
// Lê um plano de contas de arquivo (CSV ou XLSX) e confere antes de gravar.
//
// Formato: uma conta por linha, com código e nome. A profundidade do código diz
// o nível, então não é preciso coluna de tipo:
//
//   1.01            → subgrupo
//   1.01.001        → título
//   1.01.001.0001   → subtítulo
//
// O primeiro número é o grupo (1 Ativo, 2 Passivo, 3 Despesas, 4 Receitas), que
// é fixo na plataforma e não vem no arquivo.
//
// MÁSCARA: o número de dígitos do último nível é escolhido na importação (3 ou 4).
// Precisa ser o mesmo para a empresa inteira: a ordenação do plano é feita como
// texto, e misturar 3 com 4 dígitos embaralha a ordem. O sistema antigo usava 3
// e batia no teto de 999 — a Armação tem 17 títulos "Clientes Pessoa Física"
// só por causa disso.

const DIGITOS = { subgrupo: 2, titulo: 3 };

/* ===== Leitura ===== */

// CSV do Excel em português vem com ponto e vírgula e, às vezes, BOM.
function lerCSV(buffer) {
  const texto = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!linhas.length) return [];

  const sep = (linhas[0].match(/;/g) || []).length >= (linhas[0].match(/,/g) || []).length ? ';' : ',';

  return linhas.map(linha => {
    const campos = [];
    let atual = '', dentroDeAspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (dentroDeAspas && linha[i + 1] === '"') { atual += '"'; i++; }
        else dentroDeAspas = !dentroDeAspas;
      } else if (c === sep && !dentroDeAspas) {
        campos.push(atual); atual = '';
      } else atual += c;
    }
    campos.push(atual);
    return campos.map(c => c.trim());
  });
}

// XLSX só funciona se a biblioteca estiver instalada (npm i xlsx).
function lerXLSX(buffer) {
  let XLSX;
  try { XLSX = require('xlsx'); }
  catch {
    const e = new Error('Para ler .xlsx é preciso instalar a biblioteca: npm i xlsx. Ou salve a planilha como CSV.');
    e.status = 400;
    throw e;
  }
  const pasta = XLSX.read(buffer, { type: 'buffer' });
  const aba = pasta.Sheets[pasta.SheetNames[0]];
  return XLSX.utils.sheet_to_json(aba, { header: 1, raw: false, defval: '' })
    .map(l => l.map(c => String(c == null ? '' : c).trim()));
}

/* Acha as colunas de código e nome. Com cabeçalho, pelo nome da coluna; sem
   cabeçalho, assume que são as duas primeiras. */
function localizarColunas(linhas) {
  const semAcento = s => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const cabecalho = linhas[0].map(semAcento);

  const iCodigo = cabecalho.findIndex(c => ['codigo', 'conta', 'cod', 'nrconta'].includes(c));
  const iNome = cabecalho.findIndex(c => ['nome', 'descricao', 'nmconta', 'historico', 'titulo'].includes(c));

  if (iCodigo >= 0 && iNome >= 0) return { iCodigo, iNome, pularPrimeira: true };
  return { iCodigo: 0, iNome: 1, pularPrimeira: false };
}

/* ===== Conferência =====
   Devolve o que seria criado, o que já existe e o que está errado. Nada grava. */
function conferir(buffer, nomeArquivo, opcoes) {
  const { digitosSubtitulo = 4, existentes = new Set(), gruposPorCodigo = {}, nomesAtuais = {} } = opcoes || {};

  const linhas = /\.xlsx?$/i.test(nomeArquivo) ? lerXLSX(buffer) : lerCSV(buffer);
  if (!linhas.length) {
    const e = new Error('Arquivo vazio.'); e.status = 400; throw e;
  }

  /* O arquivo pode trazer a data do último lançamento do sistema antigo numa
     linha própria, começando com #referencia. Assim ela não precisa ser
     digitada, e vem do mesmo lugar de onde o plano saiu. */
  let referenciaDoArquivo = null;
  const comentario = linhas.findIndex(l => String(l[0] || '').toLowerCase().startsWith('#referencia'));
  if (comentario >= 0) {
    const bruto = String(linhas[comentario][1] || '').trim();
    const br = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);       // 19/05/2026
    referenciaDoArquivo = br ? `${br[3]}-${br[2]}-${br[1]}`
                             : (/^\d{4}-\d{2}-\d{2}$/.test(bruto) ? bruto : null);
    linhas.splice(comentario, 1);
  }

  const { iCodigo, iNome, pularPrimeira } = localizarColunas(linhas);
  const dados = pularPrimeira ? linhas.slice(1) : linhas;

  const contas = [];
  const erros = [];
  const vistos = new Map();   // código normalizado → linha onde apareceu

  dados.forEach((linha, i) => {
    const numeroLinha = i + (pularPrimeira ? 2 : 1);
    const bruto = (linha[iCodigo] || '').trim();
    const nome = (linha[iNome] || '').trim();
    if (!bruto && !nome) return;                       // linha em branco no meio do arquivo

    if (!/^[0-9.]+$/.test(bruto)) {
      erros.push({ linha: numeroLinha, codigo: bruto, erro: 'Código só pode ter números e pontos.' });
      return;
    }

    const partes = bruto.split('.').filter(p => p !== '');
    if (partes.length < 2 || partes.length > 4) {
      erros.push({ linha: numeroLinha, codigo: bruto, erro: 'O código precisa ter de 2 a 4 níveis.' });
      return;
    }
    if (!['1', '2', '3', '4'].includes(partes[0].replace(/^0+/, '') || partes[0])) {
      erros.push({ linha: numeroLinha, codigo: bruto, erro: 'O grupo precisa ser 1, 2, 3 ou 4.' });
      return;
    }
    if (!nome) {
      erros.push({ linha: numeroLinha, codigo: bruto, erro: 'Nome em branco.' });
      return;
    }

    // Normaliza cada nível para a largura da máscara
    const largura = [1, DIGITOS.subgrupo, DIGITOS.titulo, digitosSubtitulo];
    const codigo = partes.map((p, n) => p.replace(/^0+(?=\d)/, '').padStart(largura[n], '0')).join('.');
    const nivel = ['', '', 'subgrupo', 'titulo', 'subtitulo'][partes.length];

    if (vistos.has(codigo)) {
      erros.push({
        linha: numeroLinha, codigo, nome,
        erro: `Código repetido no arquivo (já apareceu na linha ${vistos.get(codigo)}).`
      });
      return;
    }
    vistos.set(codigo, numeroLinha);

    const grupo = partes[0];
    if (!gruposPorCodigo[grupo]) {
      erros.push({ linha: numeroLinha, codigo, erro: `O grupo ${grupo} não existe na plataforma.` });
      return;
    }

    contas.push({
      linha: numeroLinha,
      codigo,
      codigoOriginal: bruto,
      nome,
      nivel,
      grupo,
      pai: partes.length > 2 ? codigo.split('.').slice(0, -1).join('.') : null,
      // Ativo e Despesa são devedoras; Passivo e Receita, credoras
      natureza: ['1', '3'].includes(grupo) ? 'devedora' : 'credora',
      jaExiste: existentes.has(codigo)
    });
  });

  // Todo título precisa do subgrupo, e todo subtítulo precisa do título — no
  // arquivo ou já no banco. Sem isso a conta nasceria solta.
  const noArquivo = new Set(contas.map(c => c.codigo));
  contas.forEach(c => {
    if (c.pai && !noArquivo.has(c.pai) && !existentes.has(c.pai)) {
      erros.push({ linha: c.linha, codigo: c.codigo, erro: `A conta superior ${c.pai} não existe nem vem no arquivo.` });
    }
  });

  const novas = contas.filter(c => !c.jaExiste && !erros.some(e => e.codigo === c.codigo));

  /* No dia da virada o que interessa é a diferença, não o total: contas novas
     criadas no sistema antigo desde o ensaio, nomes que mudaram lá, e contas
     que existem aqui e sumiram do arquivo (candidatas a suspender). */
  const nomeMudou = contas
    .filter(c => c.jaExiste && nomesAtuais[c.codigo] && nomesAtuais[c.codigo] !== c.nome)
    .map(c => ({ codigo: c.codigo, de: nomesAtuais[c.codigo], para: c.nome }));

  const soAqui = Object.keys(nomesAtuais)
    .filter(codigo => !noArquivo.has(codigo))
    .map(codigo => ({ codigo, nome: nomesAtuais[codigo] }));

  return {
    referenciaDoArquivo,
    nomeMudou,
    soAqui: soAqui.slice(0, 200),
    soAquiTotal: soAqui.length,
    resumo: {
      lidas: contas.length,
      criar: novas.length,
      jaExistem: contas.filter(c => c.jaExiste).length,
      erros: erros.length,
      nomeMudou: nomeMudou.length,
      soAqui: soAqui.length,
      porNivel: {
        subgrupo: novas.filter(c => c.nivel === 'subgrupo').length,
        titulo: novas.filter(c => c.nivel === 'titulo').length,
        subtitulo: novas.filter(c => c.nivel === 'subtitulo').length
      }
    },
    contas,
    novas,
    erros: erros.slice(0, 200),     // o suficiente para corrigir o arquivo
    errosTotal: erros.length
  };
}

module.exports = { conferir, DIGITOS, lerCSV, lerXLSX };
