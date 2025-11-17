
// normaliza: minúsculas, sem acentos, sem pontuação
function norm(s='') {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')    // acentos
    .replace(/[^a-z0-9\s]/g, ' ')                        // pontuação
    .replace(/\s+/g, ' ')                                // espaços
    .trim();
}

// tokens relevantes (descarta palavrinhas curtas)
function tokens(s='') {
  const stop = new Set(['de','da','do','das','dos','para','com','sem','e','ou','a','o','as','os']);
  return norm(s).split(' ').filter(w => w.length >= 3 && !stop.has(w));
}

// score baseado em interseção de tokens
function similarityScore(filename='', produtoTexto='') {
  const A = new Set(tokens(filename));
  const B = new Set(tokens(produtoTexto));
  if (!A.size || !B.size) return 0;

  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  // peso leve para números/refs/códigos que também batem
  const numHit = /\d+/.test(filename) && /\d+/.test(produtoTexto) &&
                 (norm(filename).match(/\d+/g)?.some(n => norm(produtoTexto).includes(n)));
  const base = inter / Math.min(A.size, B.size);
  return base + (numHit ? 0.15 : 0); // bônus
}

// decide se é similar o bastante
function isSimilar(filename, produtoTexto, {minTokens=2, minScore=0.45} = {}) {
  const A = new Set(tokens(filename));
  const B = new Set(tokens(produtoTexto));
  const common = [...A].filter(w => B.has(w));
  const score = similarityScore(filename, produtoTexto);
  return (common.length >= minTokens) || (score >= minScore);
}

function buildProdutoTexto(produto) {
  return [
    produto?.descricao,
    produto?.complemento,
    produto?.referencia,
    produto?.codigo,
    // opcional: nome de setor/ seção/ fornecedor
    produto?.fornecedor?.marca,
    produto?.setorNomes,
    produto?.secaoNomes
  ].filter(Boolean).join(' ');
}

function buildProdutoTexto(produto) {
  return [
    produto?.descricao,
    produto?.complemento,
    produto?.referencia,
    produto?.codigo,
    // opcional: nome de setor/ seção/ fornecedor
    produto?.fornecedor?.marca,
    produto?.setorNomes,
    produto?.secaoNomes
  ].filter(Boolean).join(' ');
}


