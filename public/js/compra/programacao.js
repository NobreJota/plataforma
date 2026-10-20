// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\programacao.js
// Criado em: 20/10/2026 — tela PROGRAMACAO DE COMPRAS (views/compra/pages/programacao.handlebars)
// 20/10/2026: clique no NOME do fornecedor na grade: resumo dele no ano (comprado, media mensal, ano anterior,
//   ainda a comprar: previsoes e pedidos). API /fornecedor?nr=&ano=
//   Grade do ano (fornecedor x mes) · Realização do mês (notas que entraram) · Pedidos (pos 3) e previsões (pos 7)
// API: /compra/programacao/api/grade?ano= · /realizacao?ano=&mes= · /pedidos
// =============================================================================

(function () {
  'use strict';
  const API = '/compra/programacao/api';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const br = s => { const d = new Date(s); return isNaN(d) ? '' : String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCFullYear()).slice(2); };
  const brL = s => { const d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); };   // a data do Access (meia-noite UTC)
  const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const hoje = new Date();
  const st = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, grade: null, notas: [] };
  async function api(url) {
    const r = await fetch(API + url, { cache: 'no-store', credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }

  // ---- abas ----
  document.querySelectorAll('.abas button').forEach(b => b.addEventListener('click', () => abrirAba(b.dataset.aba)));
  function abrirAba(a) {
    document.querySelectorAll('.abas button').forEach(b => b.classList.toggle('on', b.dataset.aba === a));
    $('aba-grade').hidden = a !== 'grade'; $('aba-real').hidden = a !== 'real'; $('aba-ped').hidden = a !== 'ped';
    if (a === 'real') carregarReal();
    if (a === 'ped') carregarPedidos();
  }

  // ---- grade do ano ----
  async function carregarGrade() {
    $('g-corpo').innerHTML = '<tr><td class="vz" colspan="15">Carregando…</td></tr>';
    try { st.grade = await api('/grade?ano=' + st.ano); }
    catch (e) { $('g-corpo').innerHTML = '<tr><td class="vz" colspan="15">' + esc(e.message) + '</td></tr>'; return; }
    const anos = st.grade.anos && st.grade.anos.length ? st.grade.anos : [st.ano];
    if (!anos.includes(st.ano)) anos.push(st.ano);
    const op = anos.sort().map(a => '<option' + (a === st.ano ? ' selected' : '') + '>' + a + '</option>').join('');
    $('g-ano').innerHTML = op; $('r-ano').innerHTML = op;
    desenharGrade();
  }
  function desenharGrade() {
    const g = st.grade; if (!g) return;
    const so = $('g-so').checked, b = $('g-busca').value.trim().toLowerCase();
    const ls = g.linhas.filter(l => (!so || l.total) && (!b || l.marca.toLowerCase().includes(b)));
    $('g-cab').innerHTML = '<tr><th>Itens</th><th class="e">Fornecedores</th>' + MES.map((m, i) => '<th class="ord" data-mes="' + (i + 1) + '" title="ver as notas de ' + m + '">' + m + '</th>').join('') + '<th>Total</th></tr>';
    const cel = (v, i, nf) => '<td class="cel' + (v ? '' : ' zero') + '" data-mes="' + (i + 1) + '" data-forn="' + nf + '">' + brl(v) + '</td>';
    $('g-corpo').innerHTML = ls.length ? ls.map((l, k) => '<tr' + (l.ativo ? '' : ' class="inativo" title="fornecedor desativado"') + '><td>' + (k + 1) + '</td><td class="e"><a href="#" class="forn" data-nr="' + l.nrFornec + '" title="resumo deste fornecedor">' + esc(l.marca) + '</a></td>'
      + l.meses.map((v, i) => cel(v, i, l.nrFornec)).join('') + '<td class="tot">' + brl(l.total) + '</td></tr>').join('')
      : '<tr><td class="vz" colspan="15">Nenhuma compra em ' + st.ano + '.</td></tr>';
    const tm = MES.map((_, i) => ls.reduce((s, l) => s + l.meses[i], 0)), tt = tm.reduce((a, c) => a + c, 0);
    $('g-pe').innerHTML = '<tr><td></td><td class="e">Total do mês</td>' + tm.map(v => '<td>' + brl(v) + '</td>').join('') + '<td>' + brl(tt) + '</td></tr>';
  }
  $('g-ano').addEventListener('change', () => { st.ano = Number($('g-ano').value); carregarGrade(); });
  $('g-so').addEventListener('change', desenharGrade);
  $('g-busca').addEventListener('input', desenharGrade);
  document.addEventListener('click', ev => {                       // clique no mes ou no valor: notas do mes
    const c = ev.target.closest('#aba-grade [data-mes]'); if (!c) return;
    st.mes = Number(c.dataset.mes);
    const f = c.dataset.forn && st.grade ? st.grade.linhas.find(l => String(l.nrFornec) === c.dataset.forn) : null;
    $('r-busca').value = f ? f.marca : '';
    abrirAba('real');
  });

  // ---- realizacao do mes ----
  $('r-meses').innerHTML = MES.map((m, i) => '<button type="button" data-m="' + (i + 1) + '">' + m + '</button>').join('');
  $('r-meses').addEventListener('click', ev => { const b = ev.target.closest('[data-m]'); if (!b) return; st.mes = Number(b.dataset.m); carregarReal(); });
  $('r-ano').addEventListener('change', () => { st.ano = Number($('r-ano').value); carregarReal(); });
  $('r-ord').addEventListener('change', desenharReal);
  $('r-busca').addEventListener('input', desenharReal);
  async function carregarReal() {
    $('r-meses').querySelectorAll('button').forEach(b => b.classList.toggle('on', Number(b.dataset.m) === st.mes));
    if ($('r-ano').value && Number($('r-ano').value) !== st.ano) $('r-ano').value = st.ano;
    $('r-corpo').innerHTML = '<tr><td class="vz" colspan="7">Carregando…</td></tr>';
    try { st.notas = (await api('/realizacao?ano=' + st.ano + '&mes=' + st.mes)).notas || []; }
    catch (e) { $('r-corpo').innerHTML = '<tr><td class="vz" colspan="7">' + esc(e.message) + '</td></tr>'; return; }
    desenharReal();
  }
  function desenharReal() {
    const b = $('r-busca').value.trim().toLowerCase(), o = $('r-ord').value;
    let ls = st.notas.filter(n => !b || (n.fornecedor + ' ' + n.marca + ' ' + n.nota).toLowerCase().includes(b));
    const k = o === 'nota' ? (n => Number(n.nota) || 0) : o === 'forn' ? (n => n.fornecedor.toLowerCase()) : o === 'valor' ? (n => -n.valor) : (n => String(n.entrada));
    ls = ls.slice().sort((x, y) => { const a = k(x), c = k(y); return a < c ? -1 : a > c ? 1 : 0; });
    let saldo = 0;
    $('r-corpo').innerHTML = ls.length ? ls.map((n, i) => { saldo += n.valor;
      return '<tr><td>' + (i + 1) + '</td><td class="e">' + brL(n.entrada) + '</td><td class="e">' + esc(n.nota) + '</td><td class="e">' + esc(n.pedido || '') + '</td><td class="e">' + esc(n.fornecedor) + '</td>'
        + '<td>' + brl(n.valor) + '</td><td><b>' + brl(saldo) + '</b></td></tr>'; }).join('')
      : '<tr><td class="vz" colspan="7">Nenhuma nota entrou em ' + MES[st.mes - 1] + '/' + st.ano + (b ? ' com "' + esc(b) + '"' : '') + '.</td></tr>';
    $('r-pe').innerHTML = '<tr><td></td><td class="e" colspan="4">' + ls.length + ' nota(s) em ' + MES[st.mes - 1] + '/' + st.ano + '</td><td>' + brl(saldo) + '</td><td></td></tr>';
  }

  // ---- pedidos e previsoes ----
  async function carregarPedidos() {
    $('p-esq').innerHTML = $('p-dir').innerHTML = '<tr><td class="vz" colspan="6">Carregando…</td></tr>';
    let d;
    try { d = await api('/pedidos'); }
    catch (e) { $('p-esq').innerHTML = '<tr><td class="vz" colspan="6">' + esc(e.message) + '</td></tr>'; return; }
    // 20/10/2026: data = previsao da compra; o acumulado zera a cada mes e pula uma linha entre os meses (com o total)
    const MESL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const lista = ls => {
      let h = '', mesAnt = '', ult = null, n = 0;
      const fecha = () => { if (ult) h += '<tr class="tot"><td></td><td class="e" colspan="3">total de ' + mesAnt + '</td><td></td><td>' + brl(ult.acumulado) + '</td></tr><tr><td colspan="6" style="border:0;height:10px"></td></tr>'; };
      ls.forEach(g => { const d = new Date(g.previsao), mk = MESL[d.getUTCMonth()] + '/' + d.getUTCFullYear();
        if (mk !== mesAnt) { fecha(); mesAnt = mk; n = 0; }
        n++; ult = g;
        h += '<tr title="' + esc('parcelas no fluxo:\n' + g.parcelas.map(p => br(p.venc) + '  R$ ' + brl(p.valor)).join('\n')) + '"><td>' + n + '</td><td class="e"><b>' + esc(g.numero || '—') + '</b></td>'
          + '<td class="e">' + esc(g.fornecedor) + (g.parcelas.length > 1 ? ' <span style="color:#6b7280">(' + g.parcelas.length + ' parc.)</span>' : '') + '</td><td class="e">' + br(g.previsao) + '</td>'
          + '<td>' + brl(g.valor) + '</td><td><b>' + brl(g.acumulado) + '</b></td></tr>'; });
      fecha();
      return h;
    };
    $('p-esq').innerHTML = d.pedidos.length ? lista(d.pedidos) : '<tr><td class="vz" colspan="6">Nenhum pedido aguardando.</td></tr>';
    $('p-dir').innerHTML = d.previsoes.length ? lista(d.previsoes) : '<tr><td class="vz" colspan="6">Nenhuma compra projetada.</td></tr>';
  }

  // ---- 20/10/2026: RESUMO DE UM FORNECEDOR (clique no nome na grade) ----
  const stl = document.createElement('style');
  stl.textContent = `
  a.forn { color:inherit; text-decoration:none; } a.forn:hover { color:#6b21a8; text-decoration:underline; }
  .rf-fundo { position:fixed; inset:0; background:rgba(15,23,42,.25); z-index:80; }
  .rf-jan { position:fixed; left:50%; top:5vh; transform:translateX(-50%); z-index:81; width:min(820px, calc(100vw - 24px)); max-height:90vh; overflow:auto;
            background:#fff; border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.3); }
  .rf-cab { display:flex; align-items:center; padding:10px 14px; background:#6b21a8; color:#fff; font-weight:800; font-size:15px; border-radius:12px 12px 0 0; }
  .rf-cab span { flex:1; } .rf-cab button { border:0; background:none; color:#fff; font-size:20px; cursor:pointer; }
  .rf-cards { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; padding:12px 14px; }
  .rf-card { border:1px solid #e5e7eb; border-left:4px solid #6b21a8; border-radius:8px; padding:8px 10px; }
  .rf-card .l { font-size:11px; font-weight:700; text-transform:uppercase; color:#6b7280; } .rf-card .v { font-size:18px; font-weight:800; }
  .rf-card .s { font-size:11px; color:#6b7280; }
  .rf-sec { padding:4px 14px 12px; } .rf-sec h4 { margin:6px 0; font-size:13px; color:#6b21a8; }
  .rf-sec table th { position:static; }
  .rf-bar { height:10px; background:#c4b5fd; border-radius:3px; display:inline-block; vertical-align:middle; }
  @media (max-width: 700px) { .rf-cards { grid-template-columns:repeat(2, 1fr); } }`;
  document.head.appendChild(stl);
  document.addEventListener('click', ev => { const a = ev.target.closest('a.forn'); if (!a) return; ev.preventDefault(); abrirFornecedor(Number(a.dataset.nr)); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { const j = document.querySelector('.rf-jan'); if (j) { j.remove(); document.querySelector('.rf-fundo')?.remove(); } } });
  async function abrirFornecedor(nr) {
    document.querySelector('.rf-jan')?.remove(); document.querySelector('.rf-fundo')?.remove();
    const fundo = document.createElement('div'); fundo.className = 'rf-fundo';
    const j = document.createElement('div'); j.className = 'rf-jan';
    j.innerHTML = '<div class="rf-cab"><span>Carregando…</span><button type="button" data-x>×</button></div>';
    document.body.appendChild(fundo); document.body.appendChild(j);
    const fechar = () => { j.remove(); fundo.remove(); };
    fundo.addEventListener('click', fechar); j.querySelector('[data-x]').addEventListener('click', fechar);
    let d; try { d = await api('/fornecedor?nr=' + nr + '&ano=' + st.ano); }
    catch (e) { j.querySelector('span').textContent = e.message; return; }
    const pct = d.anterior.mesmoPeriodo ? Math.round((d.comprado - d.anterior.mesmoPeriodo) / d.anterior.mesmoPeriodo * 100) : null;
    const max = Math.max(1, ...d.meses, ...d.anterior.meses);
    const POS = { 3: 'pedido feito', 7: 'previsão' };
    j.innerHTML = '<div class="rf-cab"><span>' + esc(d.marca) + ' · ' + d.ano + ' <small style="opacity:.8;font-weight:600">' + esc(d.razao) + (d.conta ? ' · ' + esc(d.conta) : '') + '</small></span><button type="button" data-x>×</button></div>'
      + '<div class="rf-cards">'
      + '<div class="rf-card"><div class="l">Comprado em ' + d.ano + '</div><div class="v">R$ ' + brl(d.comprado) + '</div><div class="s">' + d.notas + ' nota(s)' + (d.ultimaNota ? ' · última ' + brL(d.ultimaNota.data) : '') + '</div></div>'
      + '<div class="rf-card"><div class="l">Média mensal</div><div class="v">R$ ' + brl(d.mediaMensal) + '</div><div class="s">em ' + d.mesesPassados + ' mês(es)</div></div>'
      + '<div class="rf-card" style="border-left-color:#d97706"><div class="l">Ainda a comprar em ' + d.ano + '</div><div class="v">R$ ' + brl(d.projetado + d.pedidos) + '</div><div class="s">previsão R$ ' + brl(d.projetado) + ' · pedidos R$ ' + brl(d.pedidos) + '</div></div>'
      + '<div class="rf-card" style="border-left-color:#059669"><div class="l">' + d.anterior.ano + ' (mesmo período)</div><div class="v">R$ ' + brl(d.anterior.mesmoPeriodo) + '</div><div class="s">'
        + (pct === null ? 'sem compras' : (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% em ' + d.ano) + ' · ano todo R$ ' + brl(d.anterior.total) + '</div></div>'
      + '</div>'
      + '<div class="rf-sec"><h4>Mês a mês</h4><table><thead><tr><th class="e">Mês</th><th>' + d.ano + '</th><th class="e"></th><th>' + d.anterior.ano + '</th></tr></thead><tbody>'
      + MES.map((m, i) => '<tr><td class="e">' + m + '</td><td' + (d.meses[i] ? '' : ' class="zero"') + '>' + brl(d.meses[i]) + '</td>'
        + '<td class="e"><span class="rf-bar" style="width:' + Math.round(d.meses[i] / max * 160) + 'px"></span></td><td' + (d.anterior.meses[i] ? '' : ' class="zero"') + '>' + brl(d.anterior.meses[i]) + '</td></tr>').join('')
      + '</tbody></table></div>'
      + '<div class="rf-sec"><h4>Pedidos e previsões em aberto em ' + d.ano + '</h4>'
      + (d.abertos.length ? '<table><thead><tr><th class="e">Venc.</th><th class="e">Tipo</th><th class="e">Histórico</th><th>Valor</th></tr></thead><tbody>'
        + d.abertos.map(l => '<tr><td class="e">' + br(l.venc) + '</td><td class="e">' + (POS[l.pos] || l.pos) + '</td><td class="e">' + esc(l.historico) + '</td><td>' + brl(l.valor) + '</td></tr>').join('') + '</tbody></table>'
        : '<div class="vz">' + (d.conta ? 'Nada em aberto.' : 'Fornecedor sem conta contábil no cadastro do Access: não dá para ligar ao fluxo.') + '</div>')
      + '</div>';
    j.querySelector('[data-x]').addEventListener('click', fechar);
  }

  carregarGrade();
})();
