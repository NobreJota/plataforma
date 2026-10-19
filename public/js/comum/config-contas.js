// =============================================================================
// Destino: C:\plataformaRota\public\js\comum\config-contas.js
// Criado em: 17/10/2026
//
// ★ CONFIGURACAO DE CONTAS (janela) — a mesma para todas as paginas. Saiu de dentro da ficha de
// fechamento da OS para servir tambem a venda (modal da instalacao).
//   ConfigContas.abrir({ pagina: 'os-fechamento', titulo: 'fechamento da OS' })
//   ConfigContas.abrir({ pagina: 'venda', titulo: 'venda (mão de obra)' })
// Lista as operacoes da pagina (chave -> conta). Botao do PLANO DE CONTAS em cada linha: navega
// Ativo / Passivo / Despesas / Receitas (grupo -> subgrupo -> titulo -> conta) ou procura por
// codigo/nome; clicar na conta pergunta se e para configurar. Chave do tipo "titulo" (ex.: mao de
// obra a apropriar 2.06.002) escolhe um TITULO, nao uma conta.
// Trocar a conta vale so para os lancamentos novos.
// API: /vendas/api/os/config-contas (os-api.js) · servidor: src\models\contab\config-contas.js
// O CSS vem junto (injetado uma vez).
// =============================================================================

(function () {
  'use strict';

  const CFG = '/vendas/api/os/config-contas';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(url, op);
    if (r.status === 401) { location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
    if (!j.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }

  const ICONE_PLANO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
    + '<path d="M4 6h10M4 11h7M4 16h5"/><circle cx="16.5" cy="15.5" r="3.5"/><path d="M19 18l2.5 2.5"/></svg>';
  const nomeCfg = c => !c.codigo ? '<span class="ruim">sem conta: configure</span>'
    : c.existe ? esc(c.nome) : '<span class="ruim">não está no plano</span>';

  // ---- CSS (uma vez) ----
  function estilo() {
    if (document.getElementById('cfg-css')) return;
    const st = document.createElement('style');
    st.id = 'cfg-css';
    st.textContent = `
.cfg-fundo { position:fixed; inset:0; background:rgba(17,24,39,.45); display:flex; align-items:flex-start; justify-content:center; padding:70px 16px; z-index:200;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size:14px; color:#111827; }
.cfg { background:#fff; border-radius:12px; width:min(900px,100%); max-height:calc(100vh - 140px); display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(0,0,0,.25); text-align:left; }
.cfg-cab { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #e5e7eb; color:#92400e; font-size:15px; }
.cfg .x { border:0; background:none; color:#dc2626; font-size:20px; cursor:pointer; line-height:1; }
.cfg-corpo { padding:10px 16px; overflow:auto; }
.cfg-corpo table { width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed; }
.cfg-corpo th { text-align:left; font-size:11px; text-transform:uppercase; color:#374151; background:#f3f4f6; padding:6px 4px; }
.cfg-corpo td { padding:6px 4px; border-top:1px solid #f3f4f6; vertical-align:middle; }
.cfg-corpo input { width:100%; font:inherit; font-size:14px; padding:5px 7px; border:1px solid #d1d5db; border-radius:7px; box-sizing:border-box; }
.cfg-corpo .ruim { color:#dc2626; font-weight:700; }
.cfg-corpo .tit { font-size:10px; font-weight:800; color:#6b21a8; background:#ede9fe; border-radius:6px; padding:1px 5px; margin-left:4px; }
.cfg-corpo tr.alvo td { background:#fef3c7; }
.cfg-corpo tr.alvo td.op { font-weight:700; color:#92400e; }
.cfg-pe { display:flex; gap:8px; justify-content:flex-end; align-items:center; padding:10px 16px; border-top:1px solid #e5e7eb; }
.cfg-pe .msg { flex:1; font-weight:600; color:#dc2626; } .cfg-pe .msg.ok { color:#059669; }
.cfg-pe button { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:8px 14px; font-weight:700; cursor:pointer; font-size:14px; }
.cfg-pe button.roxo { background:#6b21a8; border-color:#6b21a8; color:#fff; }
.cfg-plano { border:1px solid #c4b5fd; background:#faf5ff; color:#6b21a8; border-radius:7px; width:34px; height:30px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.cfg-plano:hover { background:#ede9fe; }
.cfg-busca { margin-top:10px; border:1px solid #c4b5fd; border-radius:10px; background:#faf5ff; padding:8px 10px; }
.cfg-busca-cab { display:flex; justify-content:space-between; align-items:center; font-weight:700; color:#6b21a8; margin-bottom:6px; }
.cfg-grupos { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:8px; }
.cfg-grupos button { border:1px solid #c4b5fd; background:#fff; color:#6b21a8; border-radius:8px; padding:7px 6px; font-weight:700; font-size:14px; cursor:pointer; }
.cfg-grupos button:hover { background:#ede9fe; }
.cfg-grupos button.ativo { background:#6b21a8; border-color:#6b21a8; color:#fff; }
.cfg-trilha { font-size:12px; color:#6b7280; margin-top:6px; min-height:16px; }
.cfg-trilha a { color:#6b21a8; cursor:pointer; text-decoration:underline; }
.cfg-res { max-height:220px; overflow:auto; margin-top:6px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; }
.cfg-res tr { cursor:pointer; } .cfg-res tr:hover { background:#ede9fe; }
.cfg-res .seta { color:#6b21a8; font-weight:800; }
.cfg-res .vazio, .cfg .dica { color:#6b7280; padding:8px 4px; font-size:12px; }
.cfg-ajuda { display:inline-flex; align-items:center; justify-content:center; width:17px; height:17px; border-radius:50%; background:#ede9fe; color:#6b21a8;
  font-size:11px; font-weight:800; cursor:help; margin-left:4px; }
.cfg-bolha { position:fixed; z-index:300; max-width:300px; background:#1f2937; color:#fff; font-size:12.5px; line-height:1.45; padding:8px 11px; border-radius:8px;
  box-shadow:0 8px 24px rgba(0,0,0,.25); pointer-events:none; }`;
    document.head.appendChild(st);
  }

  // ---- balao do "?" (proprio, para nao depender da pagina) ----
  let bolha = null;
  function dicaLigar(raiz) {
    if (!bolha) { bolha = document.createElement('div'); bolha.className = 'cfg-bolha'; bolha.hidden = true; document.body.appendChild(bolha); }
    const mostra = el => {
      bolha.textContent = el.dataset.dica; bolha.hidden = false;
      const r = el.getBoundingClientRect(), w = bolha.offsetWidth, h = bolha.offsetHeight;
      let y = r.bottom + 8; if (y + h > innerHeight - 8) y = r.top - h - 8;
      bolha.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + 'px'; bolha.style.top = y + 'px';
    };
    raiz.addEventListener('mouseover', ev => { const a = ev.target.closest('.cfg-ajuda'); if (a) mostra(a); });
    raiz.addEventListener('mouseout', ev => { if (ev.target.closest('.cfg-ajuda')) bolha.hidden = true; });
  }
  const ajuda = t => ' <span class="cfg-ajuda" data-dica="' + esc(t) + '">?</span>';

  // ---------------------------------------------------------------------------
  async function abrir(op) {
    const pagina = op.pagina, titulo = op.titulo || pagina;
    estilo();
    let lista;
    try { lista = (await api('GET', CFG + '?pagina=' + encodeURIComponent(pagina))).contas; }
    catch (e) { alert(e.message); return; }
    const tipos = Object.fromEntries(lista.map(c => [c.chave, c.tipo || 'conta']));
    const fundo = document.createElement('div');
    fundo.className = 'cfg-fundo';
    fundo.innerHTML = '<div class="cfg"><div class="cfg-cab"><b>★ Configuração de contas · ' + esc(titulo) + '</b>'
      + '<button type="button" class="x" data-fechar title="fechar">×</button></div>'
      + '<div class="cfg-corpo"><table><colgroup><col><col style="width:140px"><col style="width:32%"><col style="width:110px"></colgroup>'
      + '<thead><tr><th>Operação</th><th>Conta</th><th>Nome da conta</th><th style="text-align:center">Plano de Contas</th></tr></thead><tbody>'
      + lista.map(c => '<tr data-linha="' + esc(c.chave) + '"><td class="op">'
          + esc(c.rotulo) + (c.tipo === 'titulo' ? '<span class="tit">título</span>' : '') + ajuda(c.uso + (c.padrao ? ' Padrão: ' + c.padrao + '.' : ''))
          + '</td><td><input data-chave="' + esc(c.chave) + '" data-antes="' + esc(c.codigo) + '" value="' + esc(c.codigo) + '" placeholder="código" autocomplete="off"></td>'
          + '<td class="d" id="cfgn-' + esc(c.chave) + '">' + nomeCfg(c) + '</td>'
          + '<td style="text-align:center"><button type="button" class="cfg-plano" data-plano="' + esc(c.chave) + '" title="consultar o plano de contas e trazer a conta para cá">'
          + ICONE_PLANO + '</button></td></tr>').join('')
      + '</tbody></table>'
      + '<div class="cfg-busca" id="cfg-busca" hidden><div class="cfg-busca-cab"><span id="cfg-busca-tit"></span>'
      + '<button type="button" class="x" id="cfg-busca-x" title="fechar a consulta">×</button></div>'
      + '<div class="cfg-grupos">' + [['1', 'Ativo'], ['2', 'Passivo'], ['3', 'Despesas'], ['4', 'Receitas']]
          .map(([g, n]) => '<button type="button" data-nav="' + g + '">' + n + '</button>').join('') + '</div>'
      + '<input id="cfg-q" placeholder="ou procure: código (ex.: 3.06) ou parte do nome" autocomplete="off" style="width:100%;box-sizing:border-box;font:inherit;padding:6px 8px;border:1px solid #d1d5db;border-radius:7px">'
      + '<div class="cfg-trilha" id="cfg-trilha"></div>'
      + '<div class="cfg-res" id="cfg-res"><div class="vazio">Escolha o grupo acima ou procure.</div></div></div>'
      + '<div class="dica">Trocar a conta vale só para os lançamentos <b>novos</b>; o que já foi lançado não muda.</div></div>'
      + '<div class="cfg-pe"><span class="msg" id="cfg-msg"></span><button type="button" data-fechar>Fechar</button>'
      + '<button type="button" class="roxo" id="cfg-gravar">Gravar</button></div></div>';
    document.body.appendChild(fundo);
    dicaLigar(fundo);
    const $f = sel => fundo.querySelector(sel);
    const fechar = () => { fundo.remove(); if (bolha) bolha.hidden = true; if (op.aoFechar) op.aoFechar(); };
    const cmsg = (t, ok) => { const m = $f('#cfg-msg'); m.textContent = t || ''; m.classList.toggle('ok', !!ok); };
    const busca = $f('#cfg-busca'), q = $f('#cfg-q'), res = $f('#cfg-res'), trilha = $f('#cfg-trilha');
    let alvo = null, tq = null, nBusca = 0;
    const tipoAlvo = () => (alvo ? tipos[alvo.dataset.chave] : 'conta');
    const rotulo = chave => $f('tr[data-linha="' + CSS.escape(chave) + '"] td.op').firstChild.textContent.trim();

    const marcar = chave => fundo.querySelectorAll('tr[data-linha]').forEach(tr => tr.classList.toggle('alvo', tr.dataset.linha === chave));
    const fecharBusca = () => { busca.hidden = true; marcar(null); };
    // chave "titulo": no nivel dos titulos, o titulo e o que se escolhe
    const listaHtml = itens => itens.length ? '<table><tbody>' + itens.map(c => '<tr ' + (c.conta ? 'data-cod' : 'data-nav') + '="' + esc(c.codigo)
        + '" data-nome="' + esc(c.nome) + '"><td style="width:120px">' + esc(c.codigo) + '</td><td>' + esc(c.nome)
        + (c.conta ? '' : ' <span class="seta">›</span>') + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="vazio">nada aqui</div>';

    const navegar = async codigo => {
      const n = ++nBusca;
      fundo.querySelectorAll('.cfg-grupos button').forEach(b => b.classList.toggle('ativo', b.dataset.nav === codigo.split('.')[0]));
      res.innerHTML = '<div class="vazio">abrindo…</div>';
      try {
        const r = await api('GET', CFG + '/plano/' + encodeURIComponent(codigo));
        if (n !== nBusca) return;
        trilha.innerHTML = r.trilha.map((t, i) => i < r.trilha.length - 1
          ? '<a data-nav="' + esc(t.codigo) + '">' + esc(t.codigo.length > 1 ? t.codigo + ' ' + t.nome : t.nome) + '</a>'
          : '<b>' + esc(t.codigo.length > 1 ? t.codigo + ' ' + t.nome : t.nome) + '</b>').join(' › ');
        const itens = tipoAlvo() === 'titulo' && r.nivel === 2 ? r.itens.map(x => ({ ...x, conta: true })) : r.itens;
        res.innerHTML = listaHtml(itens);
      } catch (e) { res.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; }
    };
    const procurar = async () => {
      const n = ++nBusca, txt = q.value.trim();
      if (!txt) { res.innerHTML = '<div class="vazio">Escolha o grupo acima ou procure.</div>'; trilha.innerHTML = ''; return; }
      fundo.querySelectorAll('.cfg-grupos button').forEach(b => b.classList.remove('ativo'));
      trilha.innerHTML = 'procurando “' + esc(txt) + '”';
      try {
        const r = await api('GET', CFG + '/busca?q=' + encodeURIComponent(txt) + '&tipo=' + tipoAlvo());
        if (n !== nBusca) return;
        res.innerHTML = listaHtml(r.contas.map(c => ({ ...c, conta: true })));
      } catch (e) { res.innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; }
    };
    const escolher = (cod, nome) => {
      const ehTit = tipoAlvo() === 'titulo';
      if (!confirm('Configurar "' + rotulo(alvo.dataset.chave) + '"\ncom ' + (ehTit ? 'o título ' : 'a conta ') + cod + ' · ' + nome + '?')) return;
      alvo.value = cod;
      $f('#cfgn-' + CSS.escape(alvo.dataset.chave)).textContent = nome;
      fecharBusca(); alvo.focus();
      cmsg(alvo.value !== alvo.dataset.antes ? 'Conta trocada: clique em Gravar.' : '');
    };

    fundo.addEventListener('click', ev => {
      if (ev.target === fundo || ev.target.closest('[data-fechar]')) { fechar(); return; }
      const b = ev.target.closest('[data-plano]');
      if (b) {
        alvo = $f('input[data-chave="' + CSS.escape(b.dataset.plano) + '"]');
        marcar(b.dataset.plano);
        $f('#cfg-busca-tit').textContent = 'Plano de contas → ' + rotulo(b.dataset.plano);
        busca.hidden = false; q.value = '';
        // ja tem conta: abre no titulo dela (chave titulo: no subgrupo dele)
        const cod = alvo.value.trim(), ehTit = tipoAlvo() === 'titulo';
        if (!ehTit && /^\d\.\d+\.\d+\.\d+$/.test(cod)) navegar(cod.split('.').slice(0, 3).join('.'));
        else if (ehTit && /^\d\.\d+\.\d+$/.test(cod)) navegar(cod.split('.').slice(0, 2).join('.'));
        else { res.innerHTML = '<div class="vazio">Escolha o grupo acima ou procure.</div>'; trilha.innerHTML = '';
               fundo.querySelectorAll('.cfg-grupos button').forEach(x => x.classList.remove('ativo')); }
        return;
      }
      const nav = ev.target.closest('[data-nav]');
      if (nav && busca.contains(nav)) { q.value = ''; navegar(nav.dataset.nav); return; }
      const tr = ev.target.closest('#cfg-res tr[data-cod]');
      if (tr && alvo) escolher(tr.dataset.cod, tr.dataset.nome);
    });
    fundo.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      if (!busca.hidden) fecharBusca(); else fechar();
    });
    $f('#cfg-busca-x').addEventListener('click', fecharBusca);
    q.addEventListener('input', () => { clearTimeout(tq); tq = setTimeout(procurar, 250); });
    fundo.addEventListener('change', async ev => {      // conferir o codigo digitado
      const el = ev.target; if (!el.dataset.chave) return;
      const cel = $f('#cfgn-' + CSS.escape(el.dataset.chave));
      const cod = el.value.trim();
      if (!cod) { cel.innerHTML = '<span class="ruim">sem conta</span>'; return; }
      try { const r = await api('GET', CFG + '/conta/' + encodeURIComponent(cod) + '?tipo=' + (tipos[el.dataset.chave] || 'conta'));
            cel.innerHTML = r.nome ? esc(r.nome) : '<span class="ruim">não está no plano</span>'; }
      catch (e) { cel.innerHTML = '<span class="ruim">' + esc(e.message) + '</span>'; }
    });
    $f('#cfg-gravar').addEventListener('click', async () => {
      const mud = [...fundo.querySelectorAll('input[data-chave]')].filter(i => i.value.trim() !== i.dataset.antes);
      if (!mud.length) { cmsg('Nada mudou.'); return; }
      try {
        for (const i of mud) { await api('PUT', CFG + '/' + encodeURIComponent(i.dataset.chave), { codigo: i.value.trim() }); i.dataset.antes = i.value.trim(); }
        cmsg('✓ ' + mud.length + ' conta(s) gravada(s)', true);
      } catch (e) { cmsg(e.message); }
    });
    const pri = fundo.querySelector('input[data-chave]'); if (pri) pri.focus();
  }

  window.ConfigContas = { abrir };
})();
