// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\produto-cadastro.js
// Criado em: 27/09/2026
// Alterado em: 02/10/2026 - campo descricaoTecnica (a do fornecedor; descricao e a comercial)
// Reescrito em: 01/10/2026 — NOVO PRODUTO. Os produtos do Access ja foram
// importados em lote; produto novo nasce aqui:
//   - codigo automatico (o maior existente + 1), so leitura
//   - fornecedor escolhido pela marca; traz a conta (ncontabil) e a marca do
//     produto (marcaproduto), as duas so leitura: a marca e sempre a do fornecedor
//   - Enter vai ao proximo campo; depois do ultimo, ao botao Gravar
//   - gravado, abre a pagina do produto para conferir
//   - 01/10/2026: estoque so numeros, precos so moeda, taxa antes dos precos e
//     calculada (ficha-produto-campos.js); sem o botao limpar ficha
//   - 01/10/2026: duas taxas (prazo e vista), cada uma com o seu preco
//
// API: GET /compra/api/produto/loja   GET /compra/api/produto/novo
//      POST /compra/api/produto/gravar  (com ficha.novo = true)
// =============================================================================

'use strict';

(function () {

  const CAMPOS = [
    { grupo: 'O produto' },
    { id: 'codigo',        rot: 'código',        leitura: true },
    { id: 'marcaproduto',  rot: 'marcaproduto',  leitura: true },
    { id: 'descricao',     rot: 'descrição',     largo: true, obrigatorio: true },
    { id: 'descricaoTecnica', rot: 'descrição técnica (fornecedor)', largo: true },
    { id: 'descricaoNorm', rot: 'descricaoNorm', largo: true },
    { id: 'complete',      rot: 'complete',      largo: true },
    { id: 'referencia',    rot: 'referencia' },
    { id: 'referencia2',   rot: 'referencia2' },
    { id: 'codEcf',        rot: 'codEcf' },
    { id: 'fornecedor',    rot: 'fornecedor',    leitura: true },
    { id: 'ncontabil',     rot: 'ncontabil',     leitura: true },
    { id: 'similares',     rot: 'similares' },
    { id: 'artigo',        rot: 'artigo' },
    { id: 'localloja',     rot: 'localloja' },

    { grupo: 'Estoque' },
    { id: 'qte',           rot: 'qte' },
    { id: 'qte_negativa',  rot: 'qte_negativa' },
    { id: 'qte_reservada', rot: 'qte_reservada' },
    { id: 'e_min',         rot: 'e_min' },
    { id: 'e_max',         rot: 'e_max' },

    { grupo: 'Preço' },
    { id: 'precocusto',    rot: 'precocusto' },
    { id: 'taxaprazo',     rot: 'taxa % prazo' },
    { id: 'precoprazo',    rot: 'precoprazo' },
    { id: 'taxa',          rot: 'taxa % vista',  col: 2 },   // abaixo da taxa prazo
    { id: 'precovista',    rot: 'precovista' },

    { grupo: 'Fiscal' },
    { id: 'ncm',           rot: 'ncm' },
    { id: 'csosn',         rot: 'csosn' },
    { id: 'cfop_ecf',      rot: 'cfop_ecf' },
    { id: 'cfop_nfe',      rot: 'cfop_nfe' },

    { grupo: 'Site' },
    { id: 'pageposicao',   rot: 'pageposicao' },
    { id: 'pageurls',      rot: 'pageurls',      largo: true },
    { id: 'figure_mini',   rot: 'figure_mini' },
    { id: 'figure_media',  rot: 'figure_media' },
  ];

  const $ = id => document.getElementById(id);
  const campo = id => document.getElementById('f_' + id);
  const valor = (id, v) => { const c = campo(id); if (c) c.value = v ?? ''; };

  const estado = { loja: null, proximo: null, fornecedores: [], escolhido: null };

  const escapar = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  let sumir = null;
  function recado(texto, tipo) {
    clearTimeout(sumir);
    $('recado').className = 'recado ' + (tipo || 'ok');
    $('recado').textContent = texto;
    if (tipo !== 'erro') sumir = setTimeout(() => { $('recado').textContent = ''; }, 5000);
  }

  // ---- ficha -----------------------------------------------------------------
  function desenharFicha() {
    $('ficha').innerHTML = '<div class="grade">' + CAMPOS.map(c => {
      if (c.grupo) return '<div class="titulo-grupo">' + c.grupo + '</div>';
      return '<div class="campo' + (c.largo ? ' largo' : '') + (c.obrigatorio ? ' obrigatorio' : '') + '"' + (c.col ? ' style="grid-column-start:' + c.col + '"' : '') + '>'
        + '<label for="f_' + c.id + '">' + c.rot + '</label>'
        + '<input id="f_' + c.id + '" autocomplete="off" placeholder=" "' + (c.leitura ? ' readonly' : '') + '>'
        + '</div>';
    }).join('') + '</div>';
    valor('codigo', estado.proximo);
    aplicarFornecedor();
  }

  function aplicarFornecedor() {
    const f = estado.escolhido;
    valor('fornecedor', f ? f.marca : '');
    valor('marcaproduto', f ? f.marca : '');
    valor('ncontabil', f ? f.ncontabil : '');
    $('contaForn').textContent = f ? (f.ncontabil ? 'conta ' + f.ncontabil : 'sem conta no plano') : '';
    $('gravar').disabled = !f;
  }

  FichaProduto.ligar($('ficha'), campo);   // numeros, moeda, taxa

  // Enter: proximo campo editavel; depois do ultimo, o botao Gravar.
  $('ficha').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT') return;
    ev.preventDefault();
    const lista = [...$('ficha').querySelectorAll('input:not([readonly])')];
    const prox = lista[lista.indexOf(ev.target) + 1];
    if (prox) prox.focus(); else $('gravar').focus();
  });

  // ---- fornecedor --------------------------------------------------------------
  $('fornecedor').addEventListener('change', () => {
    estado.escolhido = estado.fornecedores.find(f => f.fornecId === $('fornecedor').value) || null;
    aplicarFornecedor();
    if (estado.escolhido) campo('descricao')?.focus();
  });

  // ---- gravar --------------------------------------------------------------------
  async function gravar() {
    if (!estado.escolhido) { recado('Escolha o fornecedor.', 'erro'); $('fornecedor').focus(); return; }
    if (!(campo('descricao')?.value || '').trim()) { recado('Preencha a descrição.', 'erro'); campo('descricao').focus(); return; }

    const ficha = {
      novo: true,
      marcaloja: estado.loja?.marcaloja || '', cidade: estado.loja?.cidade || '', bairro: estado.loja?.bairro || '',
      fornecId: estado.escolhido.fornecId,
      nrFornec: estado.escolhido.nrFornec || null,
      ativo: true,
    };
    for (const c of CAMPOS) {
      if (c.grupo) continue;
      ficha[c.id] = FichaProduto.paraApi(c.id, (campo(c.id)?.value ?? '').trim());
    }

    $('gravar').disabled = true;
    $('gravar').textContent = 'Gravando…';
    try {
      const r = await fetch('/compra/api/produto/gravar', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ficha }),
      });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'falha ao gravar');

      alert('Produto ' + j.codigo + ' cadastrado.\n\n' + j.descricao);
      window.location.href = '/compra/produto/' + j.codigo;   // confere na pagina do produto
    } catch (e) {
      recado(e.message, 'erro');
      $('gravar').disabled = false;
      $('gravar').textContent = 'Gravar produto';
    }
  }
  $('gravar').addEventListener('click', gravar);

  // ---- inicio --------------------------------------------------------------------
  (async function () {
    try {
      const l = await buscar('/compra/api/produto/loja');
      if (l) estado.loja = l.loja;

      const d = await buscar('/compra/api/produto/novo');
      if (!d) return;
      estado.proximo = d.proximoCodigo;
      estado.fornecedores = d.fornecedores;
      $('fornecedor').innerHTML = '<option value="">— escolha —</option>'
        + d.fornecedores.map(f => '<option value="' + f.fornecId + '">' + escapar(f.marca) + '</option>').join('');
    } catch (e) {
      recado(e.message, 'erro');
      $('fornecedor').innerHTML = '<option value="">erro ao carregar</option>';
    }
    desenharFicha();
    $('fornecedor').focus();
  })();

})();
