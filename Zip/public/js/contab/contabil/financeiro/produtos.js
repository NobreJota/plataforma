/* public/js/financeiro/produtos.js
 * Lista de Produtos (gestão) — grid com filtros, paginação. SOMENTE LEITURA.
 */
(() => {
  'use strict';
  console.log('%c📦 produtos.js v5 - mascara moeda + modal fix', 'background:#0d9488;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

  const API = '/financeiro/api/produtos';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const state = { page: 1, limit: 50, busca: '', fornecedor: 'todos', ativo: 'todos', imagem: 'todos', debounce: null };

  async function api(path) {
    const res = await fetch(API + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  function fmt(v) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Máscara de moeda: conta só dígitos, 2 últimos = centavos.
  // Digita 4589 → 45,89 · 458900 → 4.589,00 · ignora ponto/vírgula digitados.
  function mascaraMoeda(str) {
    let dig = String(str).replace(/\D/g, '');   // só números
    if (!dig) return '';
    dig = dig.replace(/^0+/, '') || '0';         // tira zeros à esquerda
    while (dig.length < 3) dig = '0' + dig;       // garante centavos
    const centavos = dig.slice(-2);
    let inteiro = dig.slice(0, -2);
    inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // milhar
    return inteiro + ',' + centavos;
  }
  // Aplica a máscara num input enquanto digita
  function ligarMascaraMoeda(input) {
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      input.value = mascaraMoeda(input.value);
      // mantém o cursor no fim (mais simples e previsível para moeda)
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }
  function titleCase(s) {
    if (!s) return '';
    return String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  async function carregarResumo() {
    try {
      const r = await api('/resumo');
      $('#prd-resumo').innerHTML =
        `Total: <b>${r.total}</b> · Ativos: <b>${r.ativos}</b> · Com imagem: <b>${r.comImagem}</b> · Sem imagem: <b>${r.semImagem}</b>`;
    } catch (_) {}
  }

  async function carregarFornecedores() {
    try {
      const forns = await api('/fornecedores');
      const sel = $('#f-fornecedor');
      sel.innerHTML = '<option value="todos">Todos</option>' +
        forns.map(f => `<option value="${f._id}">${titleCase(f.razao)}</option>`).join('');
    } catch (_) {}
  }

  async function carregar() {
    const tbody = $('#prd-body');
    tbody.innerHTML = '<tr><td colspan="10" class="prd-empty">Carregando...</td></tr>';
    try {
      const params = new URLSearchParams({
        page: state.page, limit: state.limit,
        busca: state.busca, fornecedor: state.fornecedor,
        ativo: state.ativo, imagem: state.imagem
      });
      const data = await api('/?' + params.toString());

      if (!data.produtos || data.produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="prd-empty">Nenhum produto encontrado.</td></tr>';
        $('#prd-paginacao').innerHTML = '';
        return;
      }

      tbody.innerHTML = data.produtos.map(p => {
        const estoqueBaixo = p.qte <= p.eMin && p.eMin > 0;
        return `<tr>
          <td class="c-img">${p.thumbUrl
            ? `<img class="prd-thumb" src="${p.thumbUrl}" alt="" loading="lazy" title="${p.qtdImagens} imagem(ns) — clique para ampliar" data-amplia="${encodeURIComponent(JSON.stringify(p.imagens || []))}" data-nome="${titleCase(p.descricao || '')}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'prd-noimg',textContent:'∅'}))">`
            : '<span class="prd-noimg">∅</span>'}</td>
          <td><span class="prd-cod">${p.codigo || '-'}</span></td>
          <td class="prd-desc prd-editavel" data-id="${p._id}">${titleCase(p.descricao)} ${p.referencia2 ? '<small style="color:#9ca3af">'+p.referencia2+'</small>' : ''}</td>
          <td>${p.referencia || '-'}</td>
          <td>${titleCase(p.fornecedorRazao) || '-'}</td>
          <td class="c-num ${estoqueBaixo ? 'prd-estoque-baixo' : ''}">${p.qte}${estoqueBaixo ? ' ⚠️' : ''}</td>
          <td class="c-num">${p.precoCusto ? fmt(p.precoCusto) : '-'}</td>
          <td class="c-num">${p.precoVista ? fmt(p.precoVista) : '-'}</td>
          <td class="c-num">${p.precoPrazo ? fmt(p.precoPrazo) : '-'}</td>
          <td class="c-status">${p.ativo
            ? '<span class="prd-tag-ativo">Ativo</span>'
            : '<span class="prd-tag-inativo">Inativo</span>'}</td>
        </tr>`;
      }).join('');

      // Paginação
      const pg = data.paginacao;
      $('#prd-paginacao').innerHTML = `
        <button class="prd-pag-btn" id="pag-prev" ${!pg.hasPrev ? 'disabled' : ''}>« Anterior</button>
        <span class="prd-pag-info">Página ${pg.page} de ${pg.totalPages} · ${pg.total} produtos</span>
        <button class="prd-pag-btn" id="pag-next" ${!pg.hasNext ? 'disabled' : ''}>Próxima »</button>
      `;
      const prev = $('#pag-prev'), next = $('#pag-next');
      if (prev) prev.addEventListener('click', () => { if (pg.hasPrev) { state.page--; carregar(); } });
      if (next) next.addEventListener('click', () => { if (pg.hasNext) { state.page++; carregar(); } });

      // Barra de topo: contagem do filtro + navegação mini
      const labelFiltro = montarLabelFiltro(pg.total);
      $('#prd-barra-topo').innerHTML = `
        <span class="conta-filtro">${labelFiltro}</span>
        <span class="nav-mini">
          <button id="pag-prev-topo" ${!pg.hasPrev ? 'disabled' : ''}>« Anterior</button>
          <span class="info">Pág. ${pg.page}/${pg.totalPages}</span>
          <button id="pag-next-topo" ${!pg.hasNext ? 'disabled' : ''}>Próxima »</button>
        </span>
      `;
      const prevT = $('#pag-prev-topo'), nextT = $('#pag-next-topo');
      if (prevT) prevT.addEventListener('click', () => { if (pg.hasPrev) { state.page--; carregar(); window.scrollTo(0,0); } });
      if (nextT) nextT.addEventListener('click', () => { if (pg.hasNext) { state.page++; carregar(); window.scrollTo(0,0); } });

      // Clique na miniatura → amplia
      $$('.prd-thumb').forEach(img => {
        img.addEventListener('click', () => {
          try {
            const imgs = JSON.parse(decodeURIComponent(img.dataset.amplia || '[]'));
            abrirLightbox(imgs, img.dataset.nome || '');
          } catch (_) {}
        });
      });

      // Clique na descrição → editar gestão
      $$('.prd-editavel').forEach(td => {
        td.style.cursor = 'pointer';
        td.title = 'Clique para editar preços e estoque';
        td.addEventListener('click', () => abrirEdicao(td.dataset.id));
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="10" class="prd-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  // Monta o texto de contagem conforme o filtro ativo
  function montarLabelFiltro(total) {
    const partes = [];
    if (state.fornecedor !== 'todos') {
      const sel = $('#f-fornecedor');
      const nome = sel.options[sel.selectedIndex]?.text || 'fornecedor';
      partes.push(nome);
    }
    if (state.busca) partes.push(`busca "${state.busca}"`);
    if (state.ativo === 'true') partes.push('ativos');
    else if (state.ativo === 'false') partes.push('inativos');
    if (state.imagem === 'com') partes.push('com imagem');
    else if (state.imagem === 'sem') partes.push('sem imagem');

    const filtro = partes.length ? ` (${partes.join(' · ')})` : '';
    return `${total} produto${total === 1 ? '' : 's'}${filtro}`;
  }

  // ===== Modal de edição (gestão) =====
  let edId = null;
  async function abrirEdicao(id) {
    edId = id;
    $('#m-status').textContent = '';
    try {
      const p = await api('/' + id);
      $('#m-desc').textContent = titleCase(p.descricao || '');
      $('#m-cod').textContent = p.codigo || '-';
      $('#m-forn').textContent = titleCase(p.fornecedor?.razao || '-');
      const thumb = $('#m-thumb');
      if (Array.isArray(p.pageurls) && p.pageurls.length) {
        thumb.src = p.pageurls[0]; thumb.hidden = false;
      } else { thumb.hidden = true; }
      $('#m-custo').value = p.precoCusto ? fmt(p.precoCusto) : '';
      $('#m-vista').value = p.precoVista ? fmt(p.precoVista) : '';
      $('#m-prazo').value = p.precoPrazo ? fmt(p.precoPrazo) : '';
      $('#m-qte').value  = p.qte || 0;
      $('#m-emin').value = p.e_min || 0;
      $('#m-emax').value = p.e_max || 0;
      $('#prd-modal').hidden = false;
    } catch (err) {
      alert('Erro ao carregar produto: ' + err.message);
    }
  }
  function fecharEdicao() { $('#prd-modal').hidden = true; edId = null; }

  async function salvarEdicao() {
    if (!edId) return;
    const btn = $('#prd-modal-salvar');
    const st = $('#m-status');
    btn.disabled = true; btn.textContent = 'Salvando...';
    st.textContent = ''; st.className = 'prd-modal-status';
    try {
      const body = {
        precoCusto: $('#m-custo').value,
        precoVista: $('#m-vista').value,
        precoPrazo: $('#m-prazo').value,
        qte: $('#m-qte').value,
        eMin: $('#m-emin').value,
        eMax: $('#m-emax').value
      };
      const res = await fetch(API + '/' + edId + '/gestao', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao salvar');
      st.textContent = '✓ Salvo!'; st.className = 'prd-modal-status ok';
      setTimeout(() => { fecharEdicao(); carregar(); }, 600);
    } catch (err) {
      st.textContent = '✗ ' + err.message; st.className = 'prd-modal-status erro';
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  }

  // ===== Lightbox (ampliar imagem) =====
  let lbImgs = [], lbIdx = 0;
  function abrirLightbox(imgs, nome) {
    if (!imgs || imgs.length === 0) return;
    lbImgs = imgs; lbIdx = 0;
    let lb = $('#prd-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.id = 'prd-lightbox';
      lb.innerHTML = `
        <div class="lb-overlay"></div>
        <div class="lb-content">
          <button class="lb-close">×</button>
          <button class="lb-nav lb-prev">‹</button>
          <img class="lb-img" src="" alt="">
          <button class="lb-nav lb-next">›</button>
          <div class="lb-caption"></div>
        </div>`;
      document.body.appendChild(lb);
      lb.querySelector('.lb-overlay').addEventListener('click', fecharLightbox);
      lb.querySelector('.lb-close').addEventListener('click', fecharLightbox);
      lb.querySelector('.lb-prev').addEventListener('click', () => navLightbox(-1));
      lb.querySelector('.lb-next').addEventListener('click', () => navLightbox(1));
    }
    lb.querySelector('.lb-caption').textContent = nome;
    renderLightbox();
    lb.style.display = 'flex';
  }
  function renderLightbox() {
    const lb = $('#prd-lightbox');
    lb.querySelector('.lb-img').src = lbImgs[lbIdx];
    const mostraNav = lbImgs.length > 1;
    lb.querySelector('.lb-prev').style.display = mostraNav ? '' : 'none';
    lb.querySelector('.lb-next').style.display = mostraNav ? '' : 'none';
  }
  function navLightbox(dir) {
    lbIdx = (lbIdx + dir + lbImgs.length) % lbImgs.length;
    renderLightbox();
  }
  function fecharLightbox() {
    const lb = $('#prd-lightbox');
    if (lb) lb.style.display = 'none';
  }

  // Listeners do modal de edição
  $('#prd-modal-close').addEventListener('click', fecharEdicao);
  $('#prd-modal-cancel').addEventListener('click', fecharEdicao);
  $('#prd-modal-salvar').addEventListener('click', salvarEdicao);
  // Máscara de moeda nos 3 campos de preço
  ['#m-custo', '#m-vista', '#m-prazo'].forEach(sel => ligarMascaraMoeda($(sel)));

  // Listeners de filtro
  $('#f-busca').addEventListener('input', () => {
    clearTimeout(state.debounce);
    state.debounce = setTimeout(() => { state.busca = $('#f-busca').value.trim(); state.page = 1; carregar(); }, 350);
  });
  $('#f-fornecedor').addEventListener('change', () => { state.fornecedor = $('#f-fornecedor').value; state.page = 1; carregar(); });
  $('#f-ativo').addEventListener('change', () => { state.ativo = $('#f-ativo').value; state.page = 1; carregar(); });
  $('#f-imagem').addEventListener('change', () => { state.imagem = $('#f-imagem').value; state.page = 1; carregar(); });

  // Init
  (async function init() {
    await carregarResumo();
    await carregarFornecedores();
    await carregar();
  })();
})();
