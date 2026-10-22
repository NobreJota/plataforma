// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\produtos-relacao.js
// Criado em: 30/09/2026
//
// RELAÇÃO DE PRODUTOS: escolhe o fornecedor (ou busca), lista o que está
// cadastrado em arquivo_docs. Só consulta.
// Alterado em: 30/09/2026 — duplo clique na linha abre a página do produto.
// Alterado em: 10/10/2026 — o combo mostra só os fornecedores ATIVOS: saiu o grupo
//              "Inativos no Access" (e os "(sem nome)" que vinham nele).
//
// Alterado em: 22/10/2026 — o FORNECEDOR ESCOLHIDO fica (sessionStorage + endereco ?f=): ao voltar do
//              produto a lista volta no mesmo fornecedor, busca e ordem; sai so pelo botao "✕ lista geral".
//              Coluna Cód. barras (ean). Ordenar clicando no cabecalho (2o clique inverte).
// API: /compra/api/produto/relacao-fornecedores  e  /compra/api/produto/relacao
// =============================================================================

'use strict';

(function () {

  const $ = id => document.getElementById(id);

  const el = {
    fornecedor: $('fornecedor'),
    busca:      $('busca'),
    comEstoque: $('comEstoque'),
    conta:      $('conta'),
    linhas:     $('linhas'),
    rodape:     $('rodape'),
    rodapeTexto:$('rodapeTexto'),
    rodapeQte:  $('rodapeQte'),
    rodapeValor:$('rodapeValor'),
  };

  const COLUNAS = 11;   // o mesmo numero do <thead>

  const escapar = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const moeda = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // 22/10/2026: o fornecedor escolhido (e a busca, o "so com estoque" e a ordem) ficam guardados:
  // ao voltar do produto a lista volta igual. So sai do fornecedor pelo botao "lista geral".
  const CHAVE = 'compra-produtos-relacao';
  const est = { f: '', b: '', e: false, ord: 'descricao', desc: false, produtos: [], mostrarForn: false };
  function guardar() {
    try { sessionStorage.setItem(CHAVE, JSON.stringify({ f: est.f, b: est.b, e: est.e, ord: est.ord, desc: est.desc })); } catch (x) { /* sem storage */ }
    const q = new URLSearchParams();
    if (est.f) q.set('f', est.f);
    if (est.b) q.set('b', est.b);
    if (est.e) q.set('e', '1');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  }
  function lerGuardado() {
    const u = new URLSearchParams(location.search);
    let g = {};
    try { g = JSON.parse(sessionStorage.getItem(CHAVE) || '{}'); } catch (x) { g = {}; }
    if (u.has('f') || u.has('b')) { g.f = u.get('f') || ''; g.b = u.get('b') || ''; g.e = u.get('e') === '1'; }
    return g;
  }

  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  function mensagem(titulo, texto) {
    el.linhas.innerHTML = '<tr><td colspan="' + COLUNAS + '"><div class="vazio"><strong>'
      + escapar(titulo) + '</strong>' + escapar(texto) + '</div></td></tr>';
    el.rodape.hidden = true;
    el.conta.textContent = '';
  }

  // ---- lista ----------------------------------------------------------------
  async function carregar() {
    est.f = el.fornecedor.value; est.b = el.busca.value.trim(); est.e = el.comEstoque.checked;
    guardar();
    if (!est.f && !est.b) {
      est.produtos = [];
      mensagem('Escolha um fornecedor', 'Ou busque por descrição, referência, marca ou código.');
      return;
    }

    mensagem('Carregando…', '');
    try {
      const q = new URLSearchParams();
      if (est.f) q.set('nrFornec', est.f);
      if (est.b) q.set('busca', est.b);
      if (est.e) q.set('comEstoque', '1');

      const d = await buscar('/compra/api/produto/relacao?' + q);
      if (!d) return;
      est.produtos = d.produtos.map(p => ({ ...p, vcusto: p.qte > 0 ? p.qte * p.custo : 0 }));
      est.mostrarForn = !est.f;   // na busca sem fornecedor, diz de quem e
      desenhar();
    } catch (e) {
      mensagem('Erro', e.message);
    }
  }

  // 22/10/2026: ordem pela coluna clicada (texto sem acento; numero como numero)
  const NUM = new Set(['codigo', 'qte', 'custo', 'vista', 'prazo', 'taxa', 'vcusto']);
  function ordenados() {
    const k = est.ord, s = est.desc ? -1 : 1;
    const val = p => NUM.has(k) ? Number(p[k]) || 0
      : String(p[k] || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() || '￿';   // vazio no fim
    return est.produtos.slice().sort((a, b) => { const x = val(a), y = val(b);
      return (x < y ? -s : x > y ? s : 0) || (a.codigo - b.codigo); });
  }
  function marcarOrdem() {
    document.querySelectorAll('thead th.ord').forEach(th => { const on = th.dataset.ord === est.ord;
      th.classList.toggle('on', on); th.querySelector('.seta').textContent = on ? (est.desc ? '▼' : '▲') : '↕'; });
  }

  function desenhar() {
    marcarOrdem();
    if (!est.produtos.length) { mensagem('Nada aqui', 'Nenhum produto com esse filtro.'); return; }
    let qte = 0, valor = 0;
    el.linhas.innerHTML = ordenados().map(p => {
      qte += p.qte; valor += p.vcusto;
      return '<tr data-cod="' + p.codigo + '" title="duplo clique abre o produto"'
        + (p.ativo ? '' : ' class="inativo"') + '>'
        + '<td><code>' + p.codigo + '</code></td>'
        + '<td>' + escapar(p.descricao)
        +   (est.mostrarForn && p.fornecedor ? '<div class="forn">' + escapar(p.fornecedor) + '</div>' : '')
        + '</td>'
        + '<td class="ean">' + escapar(p.ean || '') + '</td>'
        + '<td>' + escapar(p.referencia) + '</td>'
        + '<td>' + escapar(p.marca) + '</td>'
        + '<td class="num' + (p.qte <= 0 ? ' zero' : '') + '">' + p.qte + '</td>'
        + '<td class="num">' + moeda(p.custo) + '</td>'
        + '<td class="num">' + moeda(p.vista) + '</td>'
        + '<td class="num">' + moeda(p.prazo) + '</td>'
        + '<td class="num">' + moeda(p.taxa) + '</td>'
        + '<td class="num">' + (p.vcusto ? moeda(p.vcusto) : '') + '</td>'
        + '</tr>';
    }).join('');
    const n = est.produtos.length;
    el.conta.textContent = n + ' produto' + (n === 1 ? '' : 's');
    el.rodapeTexto.textContent = n + ' produto' + (n === 1 ? '' : 's');
    el.rodapeQte.textContent = qte;
    el.rodapeValor.textContent = 'R$ ' + moeda(valor);
    el.rodape.hidden = false;
  }

  // ---- eventos --------------------------------------------------------------
  el.fornecedor.addEventListener('change', carregar);

  el.linhas.addEventListener('dblclick', ev => {
    const tr = ev.target.closest('tr[data-cod]');
    if (tr) { guardar(); window.location.href = '/compra/produto/' + tr.dataset.cod; }
  });
  el.comEstoque.addEventListener('change', carregar);

  let espera = null;
  el.busca.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(carregar, 250);
  });

  document.querySelectorAll('thead th.ord').forEach(th => th.addEventListener('click', () => {
    if (est.ord === th.dataset.ord) est.desc = !est.desc;
    else { est.ord = th.dataset.ord; est.desc = NUM.has(est.ord) && est.ord !== 'codigo'; }   // valores: maior primeiro
    guardar(); desenhar();
  }));

  // "lista geral": sai do fornecedor
  $('listaGeral').addEventListener('click', () => {
    el.fornecedor.value = ''; el.busca.value = '';
    carregar(); el.busca.focus();
  });

  // voltando pelo "voltar" do navegador com a pagina guardada em memoria: recarrega o que mudou no produto
  window.addEventListener('pageshow', ev => { if (ev.persisted && (est.f || est.b)) carregar(); });

  // ---- inicio ---------------------------------------------------------------
  (async function () {
    try {
      const d = await buscar('/compra/api/produto/relacao-fornecedores');
      if (!d) return;
      const lista = d.fornecedores.filter(f => f.nrFornec);   // sem numero nao tem como filtrar
      const ativos = lista.filter(f => !f.inativo);              // inativos no Access: fora
      const opcao = f => '<option value="' + (f.nrFornec || '') + '">'
        + escapar(f.nome) + '</option>';
      el.fornecedor.innerHTML = '<option value="">— selecione —</option>'
        + ativos.map(opcao).join('');
      // 22/10/2026: volta para o fornecedor / busca / ordem que estavam
      const g = lerGuardado();
      if (g.ord) { est.ord = g.ord; est.desc = !!g.desc; }
      if (g.f && [...el.fornecedor.options].some(o => o.value === String(g.f))) el.fornecedor.value = String(g.f);
      if (g.b) el.busca.value = g.b;
      el.comEstoque.checked = !!g.e;
      marcarOrdem();
      if (el.fornecedor.value || el.busca.value.trim()) carregar();
    } catch (e) {
      el.fornecedor.innerHTML = '<option value="">erro ao carregar</option>';
      console.error('[relacao-fornecedores]', e);
    }
  })();

})();
