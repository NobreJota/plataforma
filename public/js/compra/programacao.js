// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\programacao.js
// Criado em: 20/10/2026 — tela PROGRAMACAO DE COMPRAS (views/compra/pages/programacao.handlebars)
// 20/10/2026: mes corrente mostra o que JA ENTROU (notas); o intervalo conta da ultima compra antes do mes
// 20/10/2026: janelinha ao passar o mouse num mes (conta da sugestao, previsoes e pedidos) e no total (conferencia dos pedidos)
// 20/10/2026: sugestao a partir do MES CORRENTE; pedido atrasado (⚠) entra no mes corrente; passe o mouse no 'ped' = nº dos pedidos
// 20/10/2026: aba SUGESTAO DE COMPRA (regra do Jorge: 3 ultimos meses, media ou maior, mensal acima de R$ 6.000,
//   senao a cada 2/3 meses) lado a lado com o previsto (Ped_Previsão) e os pedidos — nada e gravado. API /sugestao
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
    $('aba-grade').hidden = a !== 'grade'; $('aba-real').hidden = a !== 'real'; $('aba-ped').hidden = a !== 'ped'; $('aba-sug').hidden = a !== 'sug';
    if (a === 'real') carregarReal();
    if (a === 'ped') carregarPedidos();
    if (a === 'sug') carregarSug();
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

  // ---- 20/10/2026: SUGESTAO DE COMPRA (a regra do Jorge; nada e gravado) ----
  //   base = media OU maior valor das compras dos 3 ultimos meses fechados (escolha por fornecedor)
  //   frequencia = mensal se a media passa de R$ 6.000; senao a cada 2 (ou 3) meses (escolha por fornecedor)
  //   compra sugerida = base x meses do intervalo, no mes em que vence o intervalo contado da ULTIMA compra
  //   ao lado: o que ja esta previsto (Ped_Previsão) e os pedidos feitos (pos 3) no mesmo mes. As escolhas
  //   (base / frequencia) ficam guardadas neste computador.
  const LIMITE_MENSAL = 6000;
  let sug = null, esc2 = {};
  try { esc2 = JSON.parse(localStorage.getItem('prog-sugestao') || '{}'); } catch (e) { esc2 = {}; }
  const guarda = () => { try { localStorage.setItem('prog-sugestao', JSON.stringify(esc2)); } catch (e) { /* sem storage */ } };
  const mi = (a, m) => a * 12 + (m - 1);                            // mes como numero, para contar intervalos
  async function carregarSug() {
    $('s-corpo').innerHTML = '<tr><td class="vz">Carregando…</td></tr>';
    try { sug = await api('/sugestao'); } catch (e) { $('s-corpo').innerHTML = '<tr><td class="vz">' + esc(e.message) + '</td></tr>'; return; }
    desenharSug();
  }
  function calc(l) {
    const media = Math.round(l.compras.reduce((a, b) => a + b, 0) / 3 * 100) / 100, maior = Math.max(...l.compras);
    const e = esc2[l.nr] || {};
    const base = e.base === 'maior' ? maior : media;
    const freq = Number(e.freq) || (media >= LIMITE_MENSAL ? 1 : 2);
    const f0 = mi(sug.futuros[0].ano, sug.futuros[0].mes);
    // 20/10/2026: o intervalo conta da ultima compra ANTES do mes corrente (o que entrou neste mes aparece como "entrou"
    //   e e descontado na comparacao) — assim a Komeco mensal tem sugestao em outubro mesmo ja tendo nota em outubro
    const uc = l.ultimaAntes || (l.entrouMes ? null : l.ultimaCompra);
    let ult = null; if (uc) { const d = new Date(uc); ult = mi(d.getUTCFullYear(), d.getUTCMonth() + 1); }
    const prox = ult === null ? f0 : Math.max(ult + freq, f0);
    const sugerido = sug.futuros.map(f => { const m = mi(f.ano, f.mes); return base > 0 && m >= prox && (m - prox) % freq === 0 ? Math.round(base * freq * 100) / 100 : 0; });
    return { media, maior, base, freq, sugerido, baseEsc: e.base === 'maior' ? 'maior' : 'media' };
  }
  function desenharSug() {
    if (!sug) return;
    const b = $('s-busca').value.trim().toLowerCase(), so = $('s-dif').checked;
    const nomeM = x => MES[x.mes - 1] + '/' + String(x.ano).slice(2);
    $('s-regra').textContent = '3 últimos meses: ' + sug.ultimos.map(nomeM).join(', ') + ' · sugestão para: ' + sug.futuros.map(nomeM).join(', ');
    $('s-cab').innerHTML = '<tr><th class="e">Fornecedor</th>' + sug.ultimos.map(u => '<th>' + nomeM(u) + '</th>').join('')
      + '<th>Média</th><th>Maior</th><th class="e">Base</th><th class="e">Frequência</th><th class="e">Última compra</th>'
      + sug.futuros.map(f => '<th>' + nomeM(f) + '</th>').join('') + '</tr>';
    const tot = sug.futuros.map(() => ({ s: 0, p: 0, d: 0, e: 0 }));
    const linhas = sug.linhas.map(l => ({ l, c: calc(l) })).filter(({ l, c }) => {
      if (b && !(l.marca + ' ' + l.razao).toLowerCase().includes(b)) return false;
      if (so) return c.sugerido.some((v, i) => { const t = l.previsto[i] + l.pedidos[i] + (i === 0 ? l.entrouMes : 0); return Math.abs(v - t) > Math.max(500, t * 0.2); });
      return true;
    });
    const cel = v => '<td' + (v ? '' : ' class="zero"') + '>' + brl(v) + '</td>';
    $('s-corpo').innerHTML = linhas.length ? linhas.map(({ l, c }) => {
      const meses = sug.futuros.map((f, i) => {
        const e = i === 0 ? l.entrouMes : 0;
        const s1 = c.sugerido[i], p = l.previsto[i], d = l.pedidos[i], t = p + d + e; tot[i].s += s1; tot[i].p += p; tot[i].d += d; tot[i].e += e;
        const longe = Math.abs(s1 - t) > Math.max(500, t * 0.2);
        return '<td data-pop="' + l.nr + ':' + i + '" style="cursor:help;' + (longe ? 'background:#fffbeb' : '') + '"><b>' + brl(s1) + '</b><br><span style="color:#6b7280;font-size:11px">' + (e ? '<span style="color:#059669">entrou ' + brl(e) + '</span> · ' : '') + 'prev ' + brl(p) + (d ? ' · <span style="border-bottom:1px dotted">ped ' + brl(d) + (i === 0 && l.atrasado ? ' ⚠' : '') + '</span>' : '') + '</span></td>';
      }).join('');
      return '<tr' + (l.ativo ? '' : ' class="inativo"') + '><td class="e"><a href="#" class="forn" data-nr="' + l.nr + '">' + esc(l.marca) + '</a></td>' + l.compras.map(cel).join('')
        + '<td>' + brl(c.media) + '</td><td>' + brl(c.maior) + '</td>'
        + '<td class="e"><select data-sb="' + l.nr + '"><option value="media"' + (c.baseEsc === 'media' ? ' selected' : '') + '>média</option><option value="maior"' + (c.baseEsc === 'maior' ? ' selected' : '') + '>maior</option></select></td>'
        + '<td class="e"><select data-sf="' + l.nr + '">' + [1, 2, 3].map(n => '<option value="' + n + '"' + (c.freq === n ? ' selected' : '') + '>' + (n === 1 ? 'mensal' : 'a cada ' + n + ' meses') + '</option>').join('') + '</select></td>'
        + '<td class="e">' + (l.ultimaCompra ? brL(l.ultimaCompra) : '—') + '</td>' + meses + '</tr>';
    }).join('') : '<tr><td class="vz" colspan="12">Nada com esse filtro.</td></tr>';
    $('s-pe').innerHTML = '<tr><td class="e">Total</td><td colspan="8"></td>' + tot.map((t, i) => '<td data-pop="T:' + i + '" style="cursor:help"><b>' + brl(t.s) + '</b><br><span style="font-size:11px">' + (t.e ? '<span style="color:#059669">entrou ' + brl(t.e) + '</span> · ' : '') + 'prev ' + brl(t.p) + ' · ped ' + brl(t.d) + '</span></td>').join('') + '</tr>';
  }
  // ---- 20/10/2026: JANELINHA ao passar o mouse (como o "Sintetizar"): a conta da sugestao, as previsoes e os pedidos ----
  const pop = document.createElement('div');
  pop.style.cssText = 'position:fixed;z-index:50;display:none;background:#fff;border:1px solid #d8b4fe;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);min-width:300px;max-width:440px;font-size:12px;overflow:hidden';
  document.body.appendChild(pop);
  const ln = (a, b, st) => '<div style="display:flex;justify-content:space-between;gap:14px;padding:2px 0;' + (st || '') + '"><span>' + a + '</span><b style="font-variant-numeric:tabular-nums">' + b + '</b></div>';
  const sec = t => '<div style="margin:8px 0 3px;font-weight:800;color:#6b21a8;border-bottom:1px solid #f3e8ff">' + t + '</div>';
  function textoPop(chave) {
    const [a, b] = chave.split(':'), i = Number(b), f = sug.futuros[i], nomeM = MES[f.mes - 1] + '/' + f.ano;
    if (a === 'T') {                                                   // rodape: o mes inteiro
      const ls = sug.linhas.map(l => ({ l, c: calc(l) }));
      const en = i === 0 ? ls.filter(x => x.l.entrouMes).sort((p, q) => q.l.entrouMes - p.l.entrouMes) : [];
      let h = (en.length ? sec('Já entrou (notas do mês)') + en.map(x => ln(esc(x.l.marca), brl(x.l.entrouMes))).join('') : '') + sec('Sugerido') + ls.filter(x => x.c.sugerido[i]).sort((p, q) => q.c.sugerido[i] - p.c.sugerido[i]).map(x => ln(esc(x.l.marca), brl(x.c.sugerido[i]))).join('');
      const pv = ls.filter(x => x.l.previsto[i]); h += sec('Previsto (Ped_Previsão)') + (pv.length ? pv.map(x => ln(esc(x.l.marca), brl(x.l.previsto[i]))).join('') : '<i>nada</i>');
      const pd = ls.filter(x => x.l.pedidos[i]); h += sec('Pedidos feitos') + (pd.length ? pd.map(x => ln(esc(x.l.marca) + ' <span style="color:#6b7280">nº ' + esc(x.l.pedNums[i].join(', ')) + '</span>' + (i === 0 && x.l.atrasado ? ' ⚠' : ''), brl(x.l.pedidos[i]))).join('') : '<i>nada</i>');
      if (i === 2 && sug.fora) {                                       // no ultimo mes: o que nao entrou, para bater com o total
        const so = (sug.fora.semFornecedor || []), dp = (sug.fora.depois || []);
        const somaF = so.concat(dp).reduce((x, g) => x + g.valor, 0), dentro = sug.linhas.reduce((x, l) => x + l.pedidos.reduce((y, z) => y + z, 0), 0);
        h += sec('Conferência dos pedidos pendentes')
          + ln('nos 3 meses', brl(dentro)) + dp.map(g => ln('depois de ' + nomeM + ': nº ' + esc(g.num), brl(g.valor))).join('')
          + so.map(g => ln('sem fornecedor (conta ' + esc(g.conta) + '): nº ' + esc(g.num), brl(g.valor), 'color:#dc2626')).join('')
          + ln('total pedidos pendentes (pos 3)', brl(sug.totalPedidos), 'border-top:1px solid #e5e7eb;margin-top:3px')
          + (Math.abs(dentro + somaF - sug.totalPedidos) > 0.01 ? ln('diferença', brl(sug.totalPedidos - dentro - somaF), 'color:#dc2626') : '');
      }
      return '<div style="background:#6b21a8;color:#fff;padding:7px 12px;font-weight:800">Total de ' + nomeM + '</div><div style="padding:6px 12px 10px">' + h + '</div>';
    }
    const l = sug.linhas.find(x => String(x.nr) === a); if (!l) return '';
    const c = calc(l), v = c.sugerido[i];
    let h = sec('Sugestão');
    h += ln('compras ' + sug.ultimos.map(u => MES[u.mes - 1]).join('/'), l.compras.map(brl).join(' · '));
    h += ln('base (' + (c.baseEsc === 'maior' ? 'maior valor' : 'média') + ')', brl(c.base));
    h += ln('frequência', c.freq === 1 ? 'mensal' : 'a cada ' + c.freq + ' meses');
    h += ln('última compra' + (l.entrouMes ? ' antes de ' + MES[sug.futuros[0].mes - 1] : ''), (l.ultimaAntes || l.ultimaCompra) ? brL(l.ultimaAntes || l.ultimaCompra) : '—');
    h += v ? ln('compra sugerida = ' + brl(c.base) + ' × ' + c.freq, brl(v), 'color:#6b21a8')
           : '<div style="color:#6b7280;padding:2px 0">' + (c.base ? 'não é mês de compra (intervalo contado da última compra)' : 'sem compras nos 3 últimos meses') + '</div>';
    if (i === 0) h += sec('Já entrou em ' + nomeM + ' (notas)') + (l.notasMes.length ? l.notasMes.map(n => ln('NF ' + esc(n.nota) + ' · ' + brL(n.data), brl(n.valor))).join('')
        + (l.notasMes.length > 1 ? ln('total', brl(l.entrouMes), 'border-top:1px solid #e5e7eb') : '') : '<i>nada ainda</i>');
    h += sec('Previsto (Ped_Previsão)') + (l.prevDet[i].length ? l.prevDet[i].map(p => ln('nº ' + esc(p.num) + ' · ' + brL(p.data), brl(p.valor))).join('') : '<i>nada</i>');
    h += sec('Pedidos feitos aguardando chegar') + (l.pedDet[i].length ? l.pedDet[i].map(p => ln('nº ' + esc(p.num) + ' · ' + (p.temEntrega ? 'entrega ' : 'venc. ') + brL(p.entrega)
        + (p.atrasado ? ' <span style="color:#dc2626">⚠ atrasado</span>' : '') + ' · ' + p.parcelas.length + ' parc.', brl(p.valor))).join('') : '<i>nada</i>');
    const t = l.previsto[i] + l.pedidos[i] + (i === 0 ? l.entrouMes : 0);
    h += ln('sugerido − (' + (i === 0 ? 'entrou + ' : '') + 'previsto + pedidos)', brl(v - t), 'border-top:1px solid #e5e7eb;margin-top:6px;color:' + (v - t > 0 ? '#059669' : v - t < 0 ? '#dc2626' : '#1f2937'));
    return '<div style="background:#6b21a8;color:#fff;padding:7px 12px;font-weight:800">' + esc(l.marca) + ' · ' + nomeM + '</div><div style="padding:6px 12px 10px">' + h + '</div>';
  }
  $('aba-sug').addEventListener('mouseover', ev => {
    const td = ev.target.closest('[data-pop]'); if (!td || !sug) return;
    pop.innerHTML = textoPop(td.dataset.pop); pop.style.display = 'block';
    const r = td.getBoundingClientRect(), w = pop.offsetWidth, hgt = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
    pop.style.top = (r.bottom + hgt + 8 < innerHeight ? r.bottom + 4 : Math.max(8, r.top - hgt - 4)) + 'px';
  });
  $('aba-sug').addEventListener('mouseout', ev => { const td = ev.target.closest('[data-pop]'); if (td && !td.contains(ev.relatedTarget)) pop.style.display = 'none'; });

  $('s-busca').addEventListener('input', desenharSug);
  $('s-dif').addEventListener('change', desenharSug);
  $('aba-sug').addEventListener('change', ev => {
    const s1 = ev.target.closest('[data-sb]'), s2 = ev.target.closest('[data-sf]');
    if (s1) { (esc2[s1.dataset.sb] = esc2[s1.dataset.sb] || {}).base = s1.value; guarda(); desenharSug(); }
    if (s2) { (esc2[s2.dataset.sf] = esc2[s2.dataset.sf] || {}).freq = Number(s2.value); guarda(); desenharSug(); }
  });

  carregarGrade();
})();
