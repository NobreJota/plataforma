// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\kits.js
// Criado em: 17/10/2026
//
// VENDA > KITS (views\vendas\pages\kits.handlebars). Produto principal + itens que vao junto.
// Alterado em: 17/10/2026 - do jeito do Jorge: ESQUERDA = fornecedor -> produtos; clique no que vai
//   ser a cabeca do kit (com 📦 = ja tem kit: abre o dele, sem kit duplo). DIREITA = o kit; para
//   formar: fornecedor -> clique nos produtos (cada clique soma 1) -> Gravar.
//   17/10/2026: coluna MARCA nos itens; "neste kit: n" (o mesmo item pode estar em varios kits);
//               botao "recolher lista"; Gravar limpa a lista de produtos da direita.
//   17/10/2026: o "no kit: n" da lista da direita acompanha o kit (tirar, mudar quantidade, abrir outro)
//   17/10/2026: ESQUERDA em duas caixas (desenho do Jorge): LISTA DE KITS em cima (Cod | Descricao |
//               Marca | Itens) e MONTAR UM KIT embaixo; produto com kit sai da lista de baixo.
//   17/10/2026: NUMERO DO KIT (Jorge): varios produtos principais com o MESMO kit. Combo no produto
//               principal: usar um kit que ja existe (traz os itens) ou kit novo. Gravar um kit muda
//               todos os produtos do mesmo numero; "Tirar do kit" so tira este produto.
//   18/10/2026: Gravar kit LIMPA a tela (fecha o kit, recado verde no lugar) para o proximo.
//   17/10/2026: mouse sobre o 📦 n (itens) do kit: lista dos itens em pe (cod. | descricao | marca | qtd)
//   GET  /vendas/api/venda/kits            a lista
//   PUT  /vendas/api/venda/kits/:codigo    { itens: [{ codigo, quantidade }] } (vazio apaga)
//   GET  /vendas/api/venda/produtos?fornecedor=&busca=    produtos
//   GET  /vendas/api/venda/fornecedores    o combo (principais primeiro)
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/venda';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(API + url, op);
    if (r.status === 401) { location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  const msg = (t, ok) => { $('msg').textContent = t || ''; $('msg').classList.toggle('ok', !!ok); };

  let kits = [], aberto = null, sujo = false;   // aberto = { codigo, descricao, itens, novo }
  let prodsE = [], prodsD = [];                 // produtos das listas (esquerda / direita)
  const kitDe = cod => kits.find(k => k.codigo === Number(cod));
  const nn = n => String(n || '').padStart(2, '0');
  const doNumero = n => kits.filter(k => k.numero === n);          // produtos que usam o kit n
  const numeros = () => [...new Set(kits.map(k => k.numero))].sort((a, b) => a - b);
  const mesmosItens = (a, b) => JSON.stringify(a.map(i => [i.codigo, i.quantidade]).sort((x, y) => x[0] - y[0]))
                               === JSON.stringify(b.map(i => [i.codigo, i.quantidade]).sort((x, y) => x[0] - y[0]));

  // ---- fornecedores nos dois combos (principais primeiro) ----
  async function fornecedores() {
    try {
      const f = (await api('GET', '/fornecedores')).fornecedores || [];
      const princ = f.filter(x => x.principal), outros = f.filter(x => !x.principal);
      const ops = (princ.length ? '<optgroup label="principais">' + princ.map(o).join('') + '</optgroup><optgroup label="outros">' : '')
        + outros.map(o).join('') + (princ.length ? '</optgroup>' : '');
      function o(x) { return '<option value="' + esc(x.nr) + '">' + esc(x.marca) + '</option>'; }
      $('forn').insertAdjacentHTML('beforeend', ops);
      $('forn-i').insertAdjacentHTML('beforeend', ops);
    } catch (e) { msg('Fornecedores: ' + e.message); }
  }

  // ---- ESQUERDA: kits feitos (sem fornecedor) ou produtos do fornecedor ----
  async function carregarKits() {
    try { kits = (await api('GET', '/kits')).kits || []; } catch (e) { kits = []; }
  }
  // 17/10/2026: em cima a LISTA DE KITS (sempre visivel); embaixo MONTAR UM KIT (so o que nao tem kit)
  function desenharKits() {
    const f = $('filtro-k').value.trim().toLowerCase();
    const vis = kits.filter(k => !f || (k.codigo + ' ' + k.descricao + ' ' + (k.fornecedor || '') + ' kit ' + nn(k.numero)).toLowerCase().includes(f))
      .sort((a, b) => a.numero - b.numero || a.descricao.localeCompare(b.descricao, 'pt-BR'));   // o mesmo kit fica junto
    $('lista-k').innerHTML = vis.length ? vis.map(k => '<div class="lin' + (aberto && aberto.codigo === k.codigo ? ' ativo' : aberto && aberto.numero && aberto.numero === k.numero ? ' mesmo' : '') + '" data-cod="' + k.codigo + '">'
        + '<span class="c">' + esc(k.codigo) + '</span><span class="d">' + esc(k.descricao) + '</span><span class="nk">' + nn(k.numero) + '</span>'
        + '<span class="mk">' + esc(k.fornecedor || '') + '</span><span class="qk"><span class="tem-kit">📦 ' + k.itens.length + '</span></span></div>').join('')
      : '<div class="vazio">' + (kits.length ? 'Nada com esse filtro.' : 'Nenhum kit ainda: monte o primeiro abaixo.') + '</div>';
  }
  async function listaEsquerda() {
    const nr = $('forn').value, f = $('filtro').value.trim();
    if (!nr && f.length < 2 && !/^\d+$/.test(f)) { prodsE = []; desenharEsquerda(); return; }
    $('lista').innerHTML = '<div class="vazio">Carregando…</div>';
    try { prodsE = (await api('GET', '/produtos?fornecedor=' + encodeURIComponent(nr) + '&busca=' + encodeURIComponent(f))).produtos || []; }
    catch (e) { prodsE = []; }
    desenharEsquerda();
  }
  function desenharEsquerda() {
    desenharKits();
    const nr = $('forn').value, f = $('filtro').value.trim();
    if (!nr && f.length < 2 && !/^\d+$/.test(f)) { $('lista').innerHTML = '<div class="vazio">Escolha o fornecedor (ou procure).</div>'; return; }
    const vis = prodsE.filter(p => !kitDe(p.codigo));          // os que ja tem kit ficam so na lista de cima
    const fora = prodsE.length - vis.length;
    $('lista').innerHTML = (vis.length ? vis.map(p => '<div class="lin' + (aberto && aberto.codigo === p.codigo ? ' ativo' : '') + '" data-cod="' + p.codigo + '" title="criar o kit deste produto">'
          + '<span class="c">' + esc(p.codigo) + '</span><span class="d">' + esc(p.descricao) + '</span><span class="e">est. ' + p.estoque + '</span></div>').join('')
        : '<div class="vazio">Nenhum produto' + (fora ? ' sem kit' : '') + '.</div>')
      + (fora ? '<div class="vazio" style="font-size:12px">' + fora + ' produto(s) deste filtro já têm kit: estão na Lista de kits.</div>' : '');
  }
  const deixar = () => !sujo || confirm('O kit aberto não foi gravado. Continuar mesmo assim?');
  function abrirPrincipal(cod) {
    const k = kitDe(cod);
    if (k) aberto = { codigo: k.codigo, descricao: k.descricao, itens: k.itens.map(i => ({ ...i })), novo: false, numero: k.numero, numeroOrig: k.numero };
    else {
      const p = prodsE.find(x => x.codigo === Number(cod)); if (!p) return;
      aberto = { codigo: p.codigo, descricao: p.descricao, itens: [], novo: true, numero: null, numeroOrig: null };
    }
    sujo = false; desenharEditor(); desenharEsquerda(); marcasNoKit();
    if (aberto.novo) $('forn-i').focus();
  }

  // ---- DIREITA: o kit ----
  function desenharEditor() {
    $('ed-vazio').hidden = !!aberto; $('ed').hidden = !aberto;
    if (!aberto) return;
    // combo do numero: um kit que ja existe (traz os itens dele) ou kit novo
    const ops = numeros().map(n => { const ps = doNumero(n), ex = ps.find(x => x.codigo !== aberto.codigo) || ps[0];
      return '<option value="' + n + '"' + (aberto.numero === n ? ' selected' : '') + '>kit ' + nn(n) + ' · ' + ex.itens.length + ' itens</option>'; }).join('');
    $('ed-principal').innerHTML = '<div class="principal"><span>📦</span><div><b>' + esc(aberto.codigo) + ' · ' + esc(aberto.descricao) + '</b><br><small>'
      + (aberto.novo ? 'kit novo · produto principal' : 'produto principal') + '</small></div>'
      + '<select class="num" id="kit-num" title="usar um kit que já existe (traz os itens) ou kit novo">'
      + '<option value="novo"' + (aberto.numero ? '' : ' selected') + '>＋ kit novo' + (aberto.numeroOrig ? ' (separar)' : '') + '</option>' + ops + '</select></div>'
      + (() => { const o = aberto.numero ? doNumero(aberto.numero).filter(x => x.codigo !== aberto.codigo) : [];
          return o.length ? '<div class="outros">O kit ' + nn(aberto.numero) + ' também vale para: ' + o.map(x => esc(x.codigo + ' ' + x.descricao)).join(' · ')
            + '. Mudar os itens muda para todos.</div>' : ''; })();
    $('kit-num').addEventListener('change', ev => {
      const v = ev.target.value;
      if (v === 'novo') aberto.numero = null;                       // fica com os itens que estao ai
      else { aberto.numero = Number(v); const ex = doNumero(aberto.numero)[0]; aberto.itens = ex.itens.map(i => ({ ...i })); }
      sujo = true; desenharEditor(); desenharKits(); marcasNoKit();
    });
    $('itens').innerHTML = aberto.itens.length ? aberto.itens.map((i, k) => '<tr><td>' + esc(i.codigo) + '</td><td>' + esc(i.descricao)
        + '</td><td class="m">' + esc(i.marca || '') + '</td><td class="n"><input class="q" data-k="' + k + '" value="' + i.quantidade + '" inputmode="numeric"></td>'
        + '<td><button type="button" class="x" data-tira="' + k + '" title="tirar">×</button></td></tr>').join('')
      : '<tr><td colspan="5" class="vazio">Nenhum item ainda: escolha o fornecedor abaixo e clique nos produtos.</td></tr>';
    $('excluir').hidden = aberto.novo;
    $('excluir').textContent = aberto.numeroOrig && doNumero(aberto.numeroOrig).length > 1 ? 'Tirar do kit' : 'Excluir kit';
    msg('');
  }
  $('itens').addEventListener('input', ev => {
    const k = ev.target.dataset.k; if (k === undefined) return;
    ev.target.value = ev.target.value.replace(/\D/g, '').slice(0, 2);
    aberto.itens[k].quantidade = Number(ev.target.value) || 0; sujo = true; marcasNoKit();
  });
  $('itens').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tira]'); if (!b) return;
    aberto.itens.splice(Number(b.dataset.tira), 1); sujo = true; desenharEditor(); marcasNoKit();
  });
  // a lista de produtos da direita mostra "no kit: n" de acordo com o kit aberto
  function marcasNoKit() {
    document.querySelectorAll('#lista-i .lin[data-cod]').forEach(d => {
      const no = aberto && aberto.itens.find(i => i.codigo === Number(d.dataset.cod));
      const p = prodsD.find(x => x.codigo === Number(d.dataset.cod));
      const e = d.querySelector('.e, .no-kit'); if (!e) return;
      if (no) { e.className = 'no-kit'; e.textContent = 'neste kit: ' + no.quantidade; }
      else { e.className = 'e'; e.textContent = 'est. ' + (p ? p.estoque : ''); }
    });
  }
  async function listaDireita() {
    const nr = $('forn-i').value, f = $('filtro-i').value.trim();
    if (!nr && f.length < 2 && !/^\d+$/.test(f)) { prodsD = []; $('lista-i').innerHTML = '<div class="vazio">Escolha o fornecedor ou procure.</div>'; return; }
    $('lista-i').innerHTML = '<div class="vazio">Carregando…</div>';
    try { prodsD = (await api('GET', '/produtos?fornecedor=' + encodeURIComponent(nr) + '&busca=' + encodeURIComponent(f))).produtos || []; }
    catch (e) { prodsD = []; }
    $('lista-i').innerHTML = prodsD.length ? prodsD.map(p => { const no = aberto && aberto.itens.find(i => i.codigo === p.codigo);
        return '<div class="lin" data-cod="' + p.codigo + '"><span class="c">' + esc(p.codigo) + '</span><span class="d">' + esc(p.descricao) + '</span>'
          + (no ? '<span class="no-kit" data-q="' + p.codigo + '">neste kit: ' + no.quantidade + '</span>' : '<span class="e">est. ' + p.estoque + '</span>') + '</div>'; }).join('')
      : '<div class="vazio">Nenhum produto.</div>';
  }
  $('lista-i').addEventListener('click', ev => {
    const d = ev.target.closest('[data-cod]'); if (!d || !aberto) return;
    const p = prodsD.find(x => x.codigo === Number(d.dataset.cod)); if (!p) return;
    if (p.codigo === aberto.codigo) { msg('O produto principal não entra como item do próprio kit.'); return; }
    const ja = aberto.itens.find(i => i.codigo === p.codigo);
    if (ja) ja.quantidade += 1; else aberto.itens.push({ codigo: p.codigo, descricao: p.descricao, marca: p.marca || ($('forn-i').value ? $('forn-i').selectedOptions[0].textContent : ''), quantidade: 1 });
    sujo = true; desenharEditor();
    // marca na lista quantos ja estao no kit
    const q = aberto.itens.find(i => i.codigo === p.codigo).quantidade;
    const e = d.querySelector('.e, .no-kit'); if (e) { e.className = 'no-kit'; e.textContent = 'neste kit: ' + q; }
  });

  // ---- gravar / excluir ----
  $('gravar').addEventListener('click', async () => {
    if (!aberto.itens.length) { msg('Adicione pelo menos um item (ou use “Excluir kit”).'); return; }
    const ruim = aberto.itens.find(i => !(i.quantidade >= 1 && i.quantidade <= 99));
    if (ruim) { msg(ruim.codigo + ': quantidade de 1 a 99.'); return; }
    // o kit vale para outros produtos e os itens mudaram: avisa
    const outros = aberto.numero ? doNumero(aberto.numero).filter(x => x.codigo !== aberto.codigo) : [];
    if (outros.length && !mesmosItens(aberto.itens, outros[0].itens)
        && !confirm('O kit ' + nn(aberto.numero) + ' também vale para:\n' + outros.map(x => x.codigo + ' ' + x.descricao).join('\n') + '\n\nOs itens mudam para todos. Continuar?')) return;
    $('gravar').disabled = true;
    try {
      const r = await api('PUT', '/kits/' + aberto.codigo, { numero: aberto.numero || 'novo', itens: aberto.itens.map(i => ({ codigo: i.codigo, quantidade: i.quantidade })) });
      // 18/10/2026: gravou, a tela limpa (pronta para o proximo kit); o recado fica no lugar do kit
      const feito = '✓ kit ' + nn(r.numero) + ' gravado: ' + aberto.codigo + ' · ' + aberto.descricao
        + (r.outros ? ' (+' + r.outros + ' produto(s) com o mesmo kit)' : '');
      sujo = false; aberto = null;
      await carregarKits(); desenharEditor(); desenharEsquerda();
      limparDireita();
      $('ed-vazio').innerHTML = '<div style="color:var(--verde);font-weight:700;margin-bottom:6px">' + esc(feito) + '</div>Escolha o próximo produto principal à esquerda.';
    } catch (e) { msg(e.message); }
    finally { $('gravar').disabled = false; }
  });
  $('excluir').addEventListener('click', async () => {
    const ficam = doNumero(aberto.numeroOrig).filter(x => x.codigo !== aberto.codigo).length;
    if (!confirm((ficam ? 'Tirar ' + aberto.descricao + ' do kit ' + nn(aberto.numeroOrig) + '?\nOs outros ' + ficam + ' produto(s) continuam com o kit.'
                        : 'Excluir o kit de ' + aberto.descricao + '?') + '\nO produto continua; só deixa de trazer os itens na venda.')) return;
    try {
      await api('PUT', '/kits/' + aberto.codigo, { itens: [] });
      aberto = null; sujo = false; desenharEditor(); await carregarKits(); desenharEsquerda();
      $('ed-vazio').textContent = 'Escolha o produto principal à esquerda.';
    } catch (e) { msg(e.message); }
  });

  // 17/10/2026: recolher / limpar a lista de produtos da direita
  function limparDireita() {
    $('forn-i').value = ''; $('filtro-i').value = ''; prodsD = [];
    $('lista-i').innerHTML = '<div class="vazio">Escolha o fornecedor ou procure.</div>';
  }
  $('recolher').addEventListener('click', limparDireita);

  let tE = null, tD = null;
  const clicou = ev => { const d = ev.target.closest('[data-cod]'); if (d && deixar()) abrirPrincipal(d.dataset.cod); };
  $('lista').addEventListener('click', clicou);
  $('lista-k').addEventListener('click', clicou);
  $('filtro-k').addEventListener('input', desenharKits);
  // 17/10/2026 (Jorge): passando o mouse no kit, a lista dos itens em pe (cod. | descricao | marca | qtd)
  const bolha = document.createElement('div'); bolha.className = 'bolha-kit'; bolha.hidden = true; document.body.appendChild(bolha);
  let sobre = null;
  $('lista-k').addEventListener('mousemove', ev => {
    const d = ev.target.closest('.qk') && ev.target.closest('[data-cod]');   // so sobre o numero de itens (📦 n)
    if (!d) { bolha.hidden = true; sobre = null; return; }
    if (sobre !== d.dataset.cod) {
      sobre = d.dataset.cod; const k = kitDe(sobre); if (!k) { bolha.hidden = true; return; }
      bolha.innerHTML = '<div class="bt">kit ' + nn(k.numero) + ' · ' + esc(k.descricao) + '</div><table>' + k.itens.map(i => '<tr><td class="bc">' + esc(i.codigo)
        + '</td><td>' + esc(i.descricao) + '</td><td class="bm">' + esc(i.marca || '') + '</td><td class="bq">' + esc(i.quantidade) + '</td></tr>').join('') + '</table>';
      bolha.hidden = false;
    }
    const w = bolha.offsetWidth, h = bolha.offsetHeight;
    let x = ev.clientX + 16, y = ev.clientY + 14;
    if (x + w > innerWidth - 8) x = Math.max(8, ev.clientX - w - 16);
    if (y + h > innerHeight - 8) y = Math.max(8, ev.clientY - h - 14);
    bolha.style.left = x + 'px'; bolha.style.top = y + 'px';
  });
  $('lista-k').addEventListener('mouseleave', () => { bolha.hidden = true; sobre = null; });
  $('lista-k').addEventListener('click', () => { bolha.hidden = true; sobre = null; });
  $('forn').addEventListener('change', listaEsquerda);
  $('filtro').addEventListener('input', () => { clearTimeout(tE); tE = setTimeout(listaEsquerda, 250); });
  $('forn-i').addEventListener('change', listaDireita);
  $('filtro-i').addEventListener('input', () => { clearTimeout(tD); tD = setTimeout(listaDireita, 250); });
  window.addEventListener('beforeunload', ev => { if (sujo) { ev.preventDefault(); ev.returnValue = ''; } });
  (async () => { await Promise.all([carregarKits(), fornecedores()]); desenharEsquerda(); })();
})();
