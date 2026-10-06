// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\produto.js
// Criado em: 30/09/2026
// Alterado em: 02/10/2026 - campo descricaoTecnica (a do fornecedor; descricao e a comercial)
//
// UM PRODUTO: numeros do topo, pecas vendidas por mes e a ficha editavel.
// Abre por duplo clique na Relacao de produtos (/compra/produto/:codigo).
//
// API: GET /compra/api/produto/item/:codigo   POST /compra/api/produto/gravar
// Alterado em: 01/10/2026 — o produto ja existe: o botao e "Gravar alteracoes"
// Alterado em: 01/10/2026 — estoque so numeros, precos so moeda, taxa antes dos
//              precos e calculada (ficha-produto-campos.js)
// Alterado em: 01/10/2026 — duas taxas (prazo e vista); a que falta e calculada ao abrir
// =============================================================================

'use strict';

(function () {

  // Os campos da ficha: os mesmos da ficha de cadastro, sem o grupo da loja
  // (que vai junto na gravacao, com o valor que ja esta no documento).
  const CAMPOS = [
    { grupo: 'O produto' },
    { id: 'codigo',        rot: 'código',        leitura: true },
    { id: 'marcaproduto',  rot: 'marcaproduto' },
    { id: 'descricao',     rot: 'descrição',     largo: true },
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

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const $ = id => document.getElementById(id);
  const codigo = document.body.dataset.codigo;
  let doc = null;

  const escapar = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const moeda = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qtd = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  let sumir = null;
  function recado(texto, tipo) {
    clearTimeout(sumir);
    $('recado').className = 'recado ' + (tipo || 'ok');
    $('recado').textContent = texto;
    if (tipo !== 'erro') sumir = setTimeout(() => { $('recado').textContent = ''; }, 5000);
  }

  // ---- voltar: se veio da relacao, volta para ela com o filtro que estava -----
  $('voltar').addEventListener('click', ev => {
    if (document.referrer.includes('/compra/produtos-relacao')) {
      ev.preventDefault();
      history.back();
    }
  });

  // ---- numeros do topo e meses -----------------------------------------------
  function desenharConsumo(consumo) {
    // max/min so entre meses fechados e conhecidos
    const fechados = consumo.filter(m => m.qte !== null && !m.parcial);
    let max = null, min = null;
    for (const m of fechados) {
      if (!max || m.qte > max.qte) max = m;
      if (!min || m.qte < min.qte) min = m;
    }
    const nome = m => MESES[m.mes - 1] + '/' + String(m.ano).slice(2);

    $('nMax').textContent = max ? qtd(max.qte) : '–';
    $('nMaxMes').textContent = max ? nome(max) : 'sem meses fechados';
    $('nMin').textContent = min ? qtd(min.qte) : '–';
    $('nMinMes').textContent = min ? nome(min) : '';

    $('meses').innerHTML = consumo.map(m => {
      const cls = ['mes'];
      if (m.qte === null) cls.push('desconhecido');
      if (m.parcial) cls.push('parcial');
      if (max && m === max && max.qte !== min.qte) cls.push('max');
      if (min && m === min && max.qte !== min.qte) cls.push('min');
      return '<div class="' + cls.join(' ') + '"><div class="m">' + nome(m)
        + (m.parcial ? ' *' : '') + '</div><div class="q">'
        + (m.qte === null ? '–' : qtd(m.qte)) + '</div></div>';
    }).join('');
  }

  // ---- ficha -----------------------------------------------------------------
  const campo = id => document.getElementById('f_' + id);

  function desenharFicha() {
    $('ficha').innerHTML = '<div class="grade">' + CAMPOS.map(c => {
      if (c.grupo) return '<div class="titulo-grupo">' + c.grupo + '</div>';
      let v = doc[c.id];
      v = FichaProduto.exibir(c.id, v);
      return '<div class="campo' + (c.largo ? ' largo' : '') + '"' + (c.col ? ' style="grid-column-start:' + c.col + '"' : '') + '>'
        + '<label for="f_' + c.id + '">' + c.rot + '</label>'
        + '<input id="f_' + c.id + '" autocomplete="off" placeholder=" "'
        + (c.leitura ? ' readonly' : '') + ' value="' + escapar(v ?? '') + '">'
        + '</div>';
    }).join('') + '</div>';
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

  async function gravar() {
    const ficha = {
      marcaloja: doc.marcaloja || '', cidade: doc.cidade || '', bairro: doc.bairro || '',
      nrFornec: doc.nrFornec || null,
      ativo: doc.ativo !== false,
      pageok: doc.pageok === true,
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
      recado('✓ alterações gravadas: ' + j.codigo + ' — ' + j.descricao, 'ok');
      await carregar();
    } catch (e) {
      recado(e.message, 'erro');
    } finally {
      $('gravar').disabled = false;
      $('gravar').textContent = 'Gravar alterações';
    }
  }
  $('gravar').addEventListener('click', gravar);

  // ---- carga -----------------------------------------------------------------
  async function carregar() {
    try {
      const r = await fetch('/compra/api/produto/item/' + codigo, { credentials: 'same-origin' });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');

      doc = d.produto;
      document.title = 'Produto ' + doc.codigo;
      $('titulo').textContent = doc.descricao || '(sem descrição)';
      $('sub').textContent = 'cód ' + doc.codigo
        + (doc.fornecedor ? ' · ' + doc.fornecedor : '')
        + (doc.referencia ? ' · ' + doc.referencia : '');

      $('nEstoque').textContent = qtd(doc.qte);
      const total = d.aCaminho.reduce((s, p) => s + p.saldo, 0);
      $('nCaminho').textContent = total ? qtd(total) : '0';
      $('nCaminhoDet').textContent = d.aCaminho.map(p => 'ped. ' + p.numero).join(', ');
      $('nCusto').textContent = moeda(d.custo.medio) + ' / ' + moeda(d.custo.ultimo);

      desenharConsumo(d.consumo);
      desenharFicha();
      FichaProduto.completar(campo);   // ex.: taxa prazo dos produtos vindos do Access
      $('gravar').disabled = false;
    } catch (e) {
      $('titulo').textContent = 'Não foi possível abrir';
      $('ficha').innerHTML = '<div class="vazio">' + escapar(e.message) + '</div>';
    }
  }

  carregar();

})();
