// =============================================================================
// Destino: C:\plataformaRota\public\js\contab\contabil\financeiro\fluxo-submenu.js
// Criado em: 18/10/2026
//
// FLUXO DE CAIXA > SUB-MENU (ideia do Jorge): "● sub-menu" na legenda abre uma janela flutuante
// na lateral esquerda (arrasta pelo titulo) com as rotinas:
//   DDA - confere            importar o CSV do DDA do banco e comparar com o fluxo (dda-confere.js)
//   DDA - paga               titulos a pagar vencendo hoje ou ja vencidos (ex.: sabado e domingo);
//                            escolhe o banco, marca e paga (uma boleta: banco a credito)
//   Vendas - receber         titulos de clientes em aberto; receber com juros/desconto (vendas-receber.js)
//   Cartões - recebimento    (em breve)
//   Mostrar no fluxo: Orçamento proj. (pos 8) · Compras proj. (pos 3) · Pedidos feitos (pos 7) — caixinhas;
//                            escondido sai da grade e do saldo (fica guardado neste computador)
// API: /financeiro/api/pagamento (GET /dda?ate=, GET /bancos, POST /quitar)
// Depois de pagar, a grade do fluxo recarrega (window.FluxoCaixa.recarregar, do fluxo.js).
// =============================================================================

(function () {
  'use strict';
  const API = '/financeiro/api/pagamento';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cent = v => Math.round(Number(v || 0) * 100);
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const dataBr = s => { const d = new Date(s); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2); };
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  async function api(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(API + url, op);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  // ultimo dia util (hoje, ou a sexta se hoje e fim de semana)
  function diaUtil() { const d = new Date(); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return d; }

  // ---- CSS ----
  const st = document.createElement('style');
  st.textContent = `
  .sm-leg { color:#0284c7; cursor:pointer; font-weight:700; }
  .sm-leg, .sm-leg:hover { text-decoration:none; } .sm-leg:hover { color:#0369a1; }
  .sm-sep { border-top:2px solid #e0f2fe; margin-top:4px; padding:5px 12px 2px; font-size:10px; font-weight:800; text-transform:uppercase; color:#94a3b8; }
  .sm-tg input { margin-right:6px; accent-color:#0284c7; pointer-events:none; }
  .sm-cx { position:fixed; left:12px; top:150px; z-index:60; width:250px; background:#fff; border:1px solid #0ea5e9;
           border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,.18); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .sm-cx[hidden], .sm-jan[hidden], .sm-fundo[hidden] { display:none; }
  .sm-cab { display:flex; justify-content:space-between; align-items:center; padding:7px 10px; background:#0284c7; color:#fff;
            border-radius:9px 9px 0 0; cursor:move; user-select:none; font-weight:800; font-size:13px; }
  .sm-cab button { border:0; background:none; color:#fff; font-size:18px; cursor:pointer; line-height:1; }
  .sm-it { display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left; border:0; background:none;
           padding:9px 12px; font-size:14px; font-weight:700; color:#0369a1; cursor:pointer; border-top:1px solid #f0f9ff; }
  .sm-it:hover:not(:disabled) { background:#f0f9ff; }
  .sm-it:disabled { color:#94a3b8; cursor:default; }
  .sm-it small { font-size:10px; font-weight:600; color:#94a3b8; }
  .sm-fundo { position:fixed; inset:0; background:rgba(15,23,42,.18); z-index:70; }
  .sm-jan { position:fixed; left:50%; top:4vh; transform:translateX(-50%); z-index:71; width:min(1000px, calc(100vw - 24px));
            max-height:92vh; display:flex; flex-direction:column; background:#fff; border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.3);
            font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:14px; color:#111827; }
  .sm-jan .sm-cab { background:#6d28d9; padding:10px 14px; font-size:15px; }
  .sm-ctl { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; padding:10px 14px; border-bottom:1px solid #e5e7eb; }
  .sm-ctl label { display:flex; flex-direction:column; gap:3px; font-size:10px; font-weight:700; text-transform:uppercase; color:#374151; }
  .sm-ctl label.lin { flex-direction:row; align-items:center; gap:5px; font-size:13px; text-transform:none; font-weight:600; }
  .sm-ctl input[type=date], .sm-ctl select { height:32px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; font-size:14px; }
  .sm-ctl select { min-width:220px; font-weight:700; }
  .sm-corpo { flex:1; min-height:0; overflow:auto; }
  .sm-tab { width:100%; border-collapse:collapse; font-size:13px; }
  .sm-tab th { position:sticky; top:0; background:#f3f4f6; color:#374151; font-size:11px; text-transform:uppercase; text-align:left; padding:6px 8px; }
  .sm-tab td { padding:6px 8px; border-top:1px solid #f3f4f6; }
  .sm-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .sm-tab tr.marc td { background:#f5f3ff; }
  .sm-tab tr:hover td { background:#faf5ff; cursor:pointer; }
  .sm-tab .atr { color:#dc2626; font-weight:700; } .sm-tab .hoje { color:#059669; font-weight:700; }
  .sm-tab .cta { color:#6b7280; font-size:12px; white-space:nowrap; }
  .sm-tab tr.grupo td { background:#fafafa; font-size:11px; font-weight:800; color:#6b7280; text-transform:uppercase; cursor:default; }
  .sm-pe { display:flex; gap:12px; align-items:center; padding:10px 14px; border-top:1px solid #e5e7eb; }
  .sm-pe .tot { flex:1; font-weight:700; } .sm-pe .tot b { font-size:16px; color:#6d28d9; }
  .sm-msg { color:#dc2626; font-weight:600; font-size:13px; } .sm-msg.ok { color:#059669; }
  .sm-btn { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:8px 14px; font-weight:700; cursor:pointer; font-size:14px; }
  .sm-btn.roxo { background:#6d28d9; border-color:#6d28d9; color:#fff; } .sm-btn:disabled { opacity:.5; cursor:not-allowed; }
  .sm-vz { padding:24px; color:#6b7280; text-align:center; }`;
  document.head.appendChild(st);

  // ---- arrastar pelo titulo ----
  function arrastavel(caixa, cab, chave) {
    cab.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      const r = caixa.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      caixa.style.transform = 'none'; caixa.style.left = r.left + 'px'; caixa.style.top = r.top + 'px';
      const mexe = e => {
        caixa.style.left = Math.min(Math.max(0, e.clientX - dx), innerWidth - 60) + 'px';
        caixa.style.top = Math.min(Math.max(0, e.clientY - dy), innerHeight - 30) + 'px';
      };
      const solta = () => {
        document.removeEventListener('mousemove', mexe); document.removeEventListener('mouseup', solta);
        if (chave) try { localStorage.setItem(chave, JSON.stringify({ l: caixa.style.left, t: caixa.style.top })); } catch (e) { /* sem storage */ }
      };
      document.addEventListener('mousemove', mexe); document.addEventListener('mouseup', solta);
    });
  }

  // ---- o sub-menu ----
  const menu = document.createElement('div');
  menu.className = 'sm-cx'; menu.hidden = true;
  menu.innerHTML = '<div class="sm-cab"><span>☰ Sub-menu</span><button type="button" data-x title="fechar">×</button></div>'
    + '<button type="button" class="sm-it" data-r="dda-confere" title="importar o CSV do DDA do banco e conferir com o fluxo">DDA - confere</button>'
    + '<button type="button" class="sm-it" data-r="dda-paga">DDA - paga</button>'
    + '<button type="button" class="sm-it" data-r="vendas-receber" title="títulos de clientes em aberto: receber com juros ou desconto">Vendas - receber</button>'
    + '<button type="button" class="sm-it" disabled>Cartões - recebimento <small>em breve</small></button>'
    // 18/10/2026: mostrar/esconder no fluxo (o saldo e refeito sem o que estiver escondido)
    + '<div class="sm-sep">Mostrar no fluxo</div>'
    + '<button type="button" class="sm-it sm-tg" data-pos="8"><span><input type="checkbox" tabindex="-1">Orçamento proj.</span></button>'
    + '<button type="button" class="sm-it sm-tg" data-pos="3"><span><input type="checkbox" tabindex="-1">Compras proj.</span></button>'
    + '<button type="button" class="sm-it sm-tg" data-pos="7"><span><input type="checkbox" tabindex="-1">Pedidos feitos</span></button>';
  document.body.appendChild(menu);
  try { const p = JSON.parse(localStorage.getItem('fluxo-submenu-pos') || 'null'); if (p) { menu.style.left = p.l; menu.style.top = p.t; } } catch (e) { /* sem storage */ }
  arrastavel(menu, menu.querySelector('.sm-cab'), 'fluxo-submenu-pos');
  menu.querySelector('[data-x]').addEventListener('click', () => { menu.hidden = true; });
  const marcarTg = () => menu.querySelectorAll('[data-pos]').forEach(b => {
    b.querySelector('input').checked = !window.FluxoCaixa || !window.FluxoCaixa.mostrando || window.FluxoCaixa.mostrando(Number(b.dataset.pos));
  });
  marcarTg();
  menu.addEventListener('click', ev => {
    const t = ev.target.closest('[data-pos]');
    if (t && window.FluxoCaixa && window.FluxoCaixa.mostrar) {
      const pos = Number(t.dataset.pos);
      window.FluxoCaixa.mostrar(pos, !window.FluxoCaixa.mostrando(pos)); marcarTg(); return;
    }
    const b = ev.target.closest('[data-r]'); if (!b) return;
    if (b.dataset.r === 'dda-paga') abrirDdaPaga();
    if (b.dataset.r === 'dda-confere') abrirDdaConfere();
    if (b.dataset.r === 'vendas-receber') carregarJs('VendasReceber', '/js/contab/contabil/financeiro/vendas-receber.js');
  });
  // arquivo carregado na primeira vez (vendas-receber.js, dda-confere.js)
  function carregarJs(nome, src) {
    if (window[nome]) { window[nome].abrir(); return; }
    const sc = document.createElement('script'); sc.src = src;
    sc.onload = () => window[nome].abrir(); sc.onerror = () => alert('Não carregou ' + src);
    document.head.appendChild(sc);
  }
  // DDA - confere fica em outro arquivo (carregado na primeira vez)
  function abrirDdaConfere() {
    if (window.DdaConfere) { window.DdaConfere.abrir(); return; }
    const sc = document.createElement('script'); sc.src = '/js/contab/contabil/financeiro/dda-confere.js';
    sc.onload = () => window.DdaConfere.abrir(); sc.onerror = () => alert('Não carregou o dda-confere.js');
    document.head.appendChild(sc);
  }

  // "● sub-menu" na legenda
  const leg = document.querySelector('.flx-legenda');
  if (leg) {
    const s = document.createElement('span');
    s.className = 'flx-leg sm-leg'; s.textContent = '● Sub-menu'; s.title = 'DDA, vendas a receber, cartões';
    s.addEventListener('click', () => { menu.hidden = !menu.hidden; });
    leg.appendChild(s);
  }

  // ===================== DDA - PAGA =====================
  let jan = null, titulos = [], marcados = new Set(), bancos = null;
  function montarJanela() {
    const f = document.createElement('div'); f.className = 'sm-fundo'; f.hidden = true;
    jan = document.createElement('div'); jan.className = 'sm-jan'; jan.hidden = true;
    jan.innerHTML = '<div class="sm-cab"><span>DDA - paga · títulos a pagar vencendo até o dia (vencidos inclusive)</span><button type="button" data-x title="fechar (Esc)">×</button></div>'
      + '<div class="sm-ctl">'
      + '<label>Vencidos até<input type="date" id="dda-ate"></label>'
      + '<label>Data do pagamento<input type="date" id="dda-data" title="dia útil, até 5 dias úteis para trás"></label>'
      + '<label>Banco que paga<select id="dda-banco"><option value="">escolha o banco</option></select></label>'
      + '<label class="lin"><input type="checkbox" id="dda-forn" checked> só fornecedores (2.01.001)</label>'
      + '<label class="lin"><input type="checkbox" id="dda-todos"> marcar todos</label>'
      + '</div>'
      + '<div class="sm-corpo" id="dda-corpo"><div class="sm-vz">Carregando…</div></div>'
      + '<div class="sm-pe"><span class="tot" id="dda-tot"></span><span class="sm-msg" id="dda-msg"></span>'
      + '<button type="button" class="sm-btn" data-x>Fechar</button><button type="button" class="sm-btn roxo" id="dda-pagar" disabled>Pagar marcados</button></div>';
    document.body.appendChild(f); document.body.appendChild(jan);
    jan._fundo = f;
    arrastavel(jan, jan.querySelector('.sm-cab'));
    const fechar = () => { jan.hidden = true; f.hidden = true; };
    jan.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', fechar));
    f.addEventListener('click', fechar);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !jan.hidden) fechar(); });
    const $ = id => jan.querySelector('#' + id);
    $('dda-ate').addEventListener('change', carregar);
    $('dda-forn').addEventListener('change', () => { marcados = new Set([...marcados].filter(id => visiveis().some(t => t._id === id))); desenhar(); });
    $('dda-todos').addEventListener('change', ev => { marcados = ev.target.checked ? new Set(visiveis().map(t => t._id)) : new Set(); desenhar(); });
    $('dda-banco').addEventListener('change', rodape);
    $('dda-data').addEventListener('change', rodape);
    $('dda-corpo').addEventListener('click', ev => {
      const tr = ev.target.closest('tr[data-id]'); if (!tr) return;
      const id = tr.dataset.id;
      if (marcados.has(id)) marcados.delete(id); else marcados.add(id);
      desenhar();
    });
    $('dda-pagar').addEventListener('click', pagar);
  }
  const q = id => jan.querySelector('#' + id);
  const visiveis = () => titulos.filter(t => !q('dda-forn').checked || t.fornecedor);
  async function abrirDdaPaga() {
    if (!jan) montarJanela();
    q('dda-ate').value = iso(new Date()); q('dda-data').value = iso(diaUtil());
    q('dda-msg').textContent = ''; marcados = new Set(); q('dda-todos').checked = false;
    jan.hidden = false; jan._fundo.hidden = false;
    if (!bancos) {
      try {
        bancos = await api('GET', '/bancos');
        const arm = bancos.filter(b => b.recebeVenda);              // 18/10/2026: so os da Armacao (CEF, BB, Banestes)
        if (arm.length) bancos = arm;
        q('dda-banco').insertAdjacentHTML('beforeend', bancos.map(b => '<option value="' + esc(b._id) + '">' + esc(b.apelido)
          + (b.subCodigo ? ' · ' + esc(b.subCodigo) : '') + '</option>').join(''));
      } catch (e) { msg('Bancos: ' + e.message); }
    }
    carregar();
  }
  const msg = (t, ok) => { q('dda-msg').textContent = t || ''; q('dda-msg').classList.toggle('ok', !!ok); };
  async function carregar() {
    q('dda-corpo').innerHTML = '<div class="sm-vz">Carregando…</div>';
    try { titulos = (await api('GET', '/dda?ate=' + encodeURIComponent(q('dda-ate').value))).titulos || []; titulos.forEach(t => { t._id = String(t._id); }); }
    catch (e) { titulos = []; msg(e.message); }
    marcados = new Set([...marcados].filter(id => titulos.some(t => t._id === id)));
    desenhar();
  }
  function desenhar() {
    const vis = visiveis();
    if (!vis.length) {
      q('dda-corpo').innerHTML = '<div class="sm-vz">Nenhum título a pagar vencendo até ' + dataBr(q('dda-ate').value + 'T12:00:00')
        + (titulos.length ? ' (' + titulos.length + ' que não são de fornecedor: desmarque "só fornecedores")' : '') + '.</div>';
    } else {
      let dia = '';
      q('dda-corpo').innerHTML = '<table class="sm-tab"><thead><tr><th style="width:30px"></th><th>Vencimento</th><th>Histórico</th><th>Conta</th><th class="n">Parc.</th><th class="n">Valor</th></tr></thead><tbody>'
        + vis.map(t => {
          const d = new Date(t.vencimento), k = iso(d);
          const cab = k !== dia ? (dia = k, '<tr class="grupo"><td colspan="6">' + SEM[d.getDay()] + ' ' + dataBr(t.vencimento)
            + (t.atraso > 0 ? ' · vencido há ' + t.atraso + ' dia(s)' : t.atraso === 0 ? ' · vence hoje' : '') + '</td></tr>') : '';
          return cab + '<tr data-id="' + esc(t._id) + '"' + (marcados.has(t._id) ? ' class="marc"' : '') + '><td><input type="checkbox" tabindex="-1"' + (marcados.has(t._id) ? ' checked' : '') + '></td>'
            + '<td class="' + (t.atraso > 0 ? 'atr' : 'hoje') + '">' + dataBr(t.vencimento) + '</td>'
            + '<td>' + esc(t.historico) + '</td><td class="cta">' + esc(t.codigoConta) + ' ' + esc(t.nomeConta) + '</td>'
            + '<td class="n">' + (t.parcela ? t.parcela + '/' + t.totalParcelas : '') + '</td><td class="n">' + brl(t.valor) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    q('dda-todos').checked = vis.length > 0 && vis.every(t => marcados.has(t._id));
    rodape();
  }
  function rodape() {
    const sel = titulos.filter(t => marcados.has(t._id));
    const total = sel.reduce((s, t) => s + cent(t.valor), 0) / 100;
    const vis = visiveis(), totVis = vis.reduce((s, t) => s + cent(t.valor), 0) / 100;
    q('dda-tot').innerHTML = sel.length ? sel.length + ' marcado(s) · <b>R$ ' + brl(total) + '</b>' : vis.length + ' título(s) · R$ ' + brl(totVis) + ' — clique nas linhas para marcar';
    const banco = q('dda-banco').selectedOptions[0];
    q('dda-pagar').disabled = !sel.length || !q('dda-banco').value;
    q('dda-pagar').textContent = sel.length && q('dda-banco').value ? 'Pagar ' + sel.length + ' pelo ' + banco.textContent.split(' · ')[0] : 'Pagar marcados';
  }
  async function pagar() {
    const sel = titulos.filter(t => marcados.has(t._id));
    const banco = q('dda-banco').selectedOptions[0].textContent.split(' · ')[0];
    const total = sel.reduce((s, t) => s + cent(t.valor), 0) / 100;
    if (!confirm('Pagar ' + sel.length + ' título(s), total R$ ' + brl(total) + '\npelo ' + banco + ' em ' + dataBr(q('dda-data').value + 'T12:00:00') + '?\n\n'
      + sel.slice(0, 12).map(t => '• ' + t.historico + ' — R$ ' + brl(t.valor)).join('\n') + (sel.length > 12 ? '\n…' : ''))) return;
    q('dda-pagar').disabled = true; msg('');
    try {
      const r = await api('POST', '/quitar', { tipo: 'pagar', data: q('dda-data').value, contaBancariaId: q('dda-banco').value,
        titulosIds: sel.map(t => t._id),
        historico: sel.length > 1 ? 'Diversos DDA — ' + sel.length + ' títulos pagos pelo ' + banco : 'DDA — ' + sel[0].historico });
      marcados = new Set();
      msg('✓ pago: boleta ' + (r.codigo || '') + ' · R$ ' + brl(r.valorTotal), true);
      await carregar();
      if (window.FluxoCaixa && window.FluxoCaixa.recarregar) window.FluxoCaixa.recarregar();
    } catch (e) { msg(e.message); rodape(); }
  }
})();
