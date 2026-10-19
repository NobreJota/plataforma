// =============================================================================
// Destino: C:\plataformaRota\public\js\contab\contabil\financeiro\vendas-receber.js
// Criado em: 18/10/2026
//
// FLUXO DE CAIXA > SUB-MENU > VENDAS - RECEBER (ideia do Jorge)
//   Janela com TUDO o que ha a receber de cliente (sem cartao e sem OS), ordenavel por
//   Historico, Venc. e Valor (clique no titulo da coluna). Busca por nome/historico.
//   Clicou no titulo: janela do CLIENTE com todos os titulos em aberto dele (caixinhas; o clicado
//   ja vem marcado) · JUROS e DESCONTO · total a receber · BANCO (so os da Armacao: CEF, BB,
//   Banestes — os que recebem venda) · data. Gravar pergunta "Quer gravar o recebimento?" e
//   grava a boleta RECEBIMENTO (banco a debito; titulos, juros a credito; desconto a debito).
//   ★ no titulo da janela do cliente: contas de juros e desconto (configuracao por chave).
// 18/10/2026: ordem Desconto, Juros, Data, Banco; ENTER anda de um ao outro ate o banco (e dai ao Gravar).
// 19/10/2026: botao "Excluir do fluxo" na janela do cliente: titulos que JA foram recebidos (ex.: antes da
//   virada do ano; o saldo transferido ja baixou na contabilidade) saem do fluxo SEM boleta, com
//   observacao obrigatoria. Antes, a tela mostra o saldo da conta do cliente no balancete para conferir.
// 19/10/2026: botao "Razão" na janela do cliente: abre (por cima, arrastavel) o razao da conta do cliente no
//   ano — data, historico, contrapartida, debito, credito e saldo — para conferir na hora antes de receber
//   ou excluir. Usa a mesma API da tela do Razao (/financeiro/api/razao/lancamentos).
// Carregado pelo sub-menu (fluxo-submenu.js): window.VendasReceber.abrir()
// API razao: /financeiro/api/razao/lancamentos?conta=
// API: /financeiro/api/pagamento (GET /receber, GET /bancos, POST /quitar, POST /titulos/excluir, GET /saldo-conta)
// =============================================================================

(function () {
  'use strict';
  const API = '/financeiro/api/pagamento';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cent = v => Math.round(Number(v || 0) * 100);
  const paraCent = t => { let s = String(t || '').replace(/[R$\s]/g, ''); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const br = s => { const d = new Date(s); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2); };
  const diaUtil = () => { const d = new Date(); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return d; };
  async function api(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' }, cache: 'no-store' };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(API + url, op);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  function arrastar(caixa, cab) {
    cab.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      const r = caixa.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      caixa.style.transform = 'none'; caixa.style.left = r.left + 'px'; caixa.style.top = r.top + 'px';
      const m = e => { caixa.style.left = Math.min(Math.max(0, e.clientX - dx), innerWidth - 80) + 'px'; caixa.style.top = Math.min(Math.max(0, e.clientY - dy), innerHeight - 40) + 'px'; };
      const u = () => { document.removeEventListener('mousemove', m); document.removeEventListener('mouseup', u); };
      document.addEventListener('mousemove', m); document.addEventListener('mouseup', u);
    });
  }

  const st = document.createElement('style');
  st.textContent = `
  .vr-fundo { position:fixed; inset:0; background:rgba(15,23,42,.22); z-index:80; }
  .vr-fundo[hidden], .vr-jan[hidden] { display:none; }
  .vr-jan { position:fixed; left:50%; top:3vh; transform:translateX(-50%); z-index:81; width:min(1000px, calc(100vw - 24px)); max-height:93vh;
            display:flex; flex-direction:column; background:#fff; border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.3);
            font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:14px; color:#111827; }
  .vr-jan.cli { z-index:83; width:min(760px, calc(100vw - 24px)); top:6vh; }
  .vr-cab { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#b91c1c; color:#fff; border-radius:12px 12px 0 0;
            font-weight:800; font-size:15px; cursor:move; user-select:none; }
  .vr-cab span { flex:1; } .vr-cab button { border:0; background:none; color:#fff; font-size:20px; cursor:pointer; }
  .vr-cab .estrela { font-size:16px; color:#fde68a; }
  .vr-ctl { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; padding:9px 14px; border-bottom:1px solid #e5e7eb; }
  .vr-ctl label { display:flex; flex-direction:column; gap:3px; font-size:10px; font-weight:700; text-transform:uppercase; color:#374151; }
  .vr-ctl input, .vr-ctl select { height:32px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; font-size:14px; }
  .vr-ctl input.num { width:120px; text-align:right; }
  .vr-ctl select { min-width:220px; font-weight:700; }
  .vr-corpo { flex:1; min-height:0; overflow:auto; }
  .vr-tab { width:100%; border-collapse:collapse; font-size:13px; }
  .vr-tab th { position:sticky; top:0; background:#f3f4f6; color:#374151; font-size:11px; text-transform:uppercase; text-align:left; padding:6px 8px; z-index:1; }
  .vr-tab th.ord { cursor:pointer; user-select:none; } .vr-tab th.ord:hover { color:#b91c1c; }
  .vr-tab td { padding:6px 8px; border-top:1px solid #f3f4f6; vertical-align:top; }
  .vr-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .vr-tab .cn { color:#6b7280; font-size:12px; }
  .vr-tab .h { color:#b91c1c; font-weight:700; cursor:pointer; } .vr-tab .h:hover { text-decoration:underline; }
  .vr-tab tr.marc td { background:#fef2f2; } .vr-jan.cli .vr-tab tr { cursor:pointer; }
  .vr-atr { font-size:11px; font-weight:800; border-radius:8px; padding:1px 6px; white-space:nowrap; }
  .vr-atr.v { background:#fee2e2; color:#991b1b; } .vr-atr.h { background:#dcfce7; color:#166534; } .vr-atr.f { background:#f3f4f6; color:#374151; }
  .vr-pe { display:flex; gap:12px; align-items:center; padding:10px 14px; border-top:1px solid #e5e7eb; flex-wrap:wrap; }
  .vr-pe .tot { flex:1; font-weight:700; } .vr-pe .tot b { font-size:17px; color:#b91c1c; }
  .vr-msg { color:#dc2626; font-weight:600; font-size:13px; } .vr-msg.ok { color:#059669; }
  .vr-btn { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:8px 14px; font-weight:700; cursor:pointer; font-size:14px; }
  .vr-btn.verm { background:#b91c1c; border-color:#b91c1c; color:#fff; } .vr-btn:disabled { opacity:.5; cursor:not-allowed; }
  .vr-btn.exc { color:#6b7280; font-weight:600; font-size:13px; padding:7px 10px; } .vr-btn.exc:hover:not(:disabled) { color:#b91c1c; border-color:#b91c1c; }
  .vr-vz { padding:24px; color:#6b7280; text-align:center; }
  .vr-conta { display:grid; grid-template-columns:auto 1fr; gap:2px 14px; padding:8px 14px; font-size:13px; background:#fafafa; border-bottom:1px solid #e5e7eb; }
  .vr-conta b { font-variant-numeric:tabular-nums; }
  .vr-jan.raz { z-index:85; width:min(900px, calc(100vw - 24px)); top:9vh; max-height:84vh; }
  .vr-jan.raz .vr-cab { background:#374151; }
  .vr-tab td.deb { color:#1d4ed8; } .vr-tab td.cre { color:#b91c1c; } .vr-tab tr.ant td { background:#f9fafb; font-style:italic; }
  .vr-tab tfoot td { position:sticky; bottom:0; background:#f3f4f6; font-weight:800; border-top:2px solid #d1d5db; }`;
  document.head.appendChild(st);

  let raz = null;
  let fundo, jan, cli, titulos = [], bancos = null, ordem = { k: 'venc', asc: true };
  const q = id => document.getElementById(id);

  // ---- janela principal: o que ha a receber ----
  function montar() {
    fundo = document.createElement('div'); fundo.className = 'vr-fundo'; fundo.hidden = true;
    jan = document.createElement('div'); jan.className = 'vr-jan'; jan.hidden = true;
    jan.innerHTML = '<div class="vr-cab"><span>Vendas - receber · títulos de clientes em aberto</span><button type="button" id="vr-x" title="fechar (Esc)">×</button></div>'
      + '<div class="vr-ctl"><label>Procurar<input id="vr-busca" placeholder="cliente ou histórico" autocomplete="off" style="width:260px"></label>'
      + '<label style="flex-direction:row;align-items:center;gap:6px;font-size:13px;text-transform:none"><input type="checkbox" id="vr-venc" style="height:auto"> só vencidos e de hoje</label></div>'
      + '<div class="vr-corpo" id="vr-lista"><div class="vr-vz">Carregando…</div></div>'
      + '<div class="vr-pe"><span class="tot" id="vr-tot"></span><button type="button" class="vr-btn" id="vr-fechar">Fechar</button></div>';
    document.body.appendChild(fundo); document.body.appendChild(jan);
    arrastar(jan, jan.querySelector('.vr-cab'));
    const fechar = () => { jan.hidden = true; fundo.hidden = true; };
    q('vr-x').addEventListener('click', fechar); q('vr-fechar').addEventListener('click', fechar); fundo.addEventListener('click', fechar);
    document.addEventListener('keydown', ev => { if (ev.key !== 'Escape') return; if (raz) { raz.remove(); raz = null; } else if (cli && !cli.hidden) cli.remove(); else if (!jan.hidden) fechar(); });
    q('vr-busca').addEventListener('input', desenhar); q('vr-venc').addEventListener('change', desenhar);
    jan.addEventListener('click', ev => {
      const th = ev.target.closest('th[data-ord]');
      if (th) { ordem = ordem.k === th.dataset.ord ? { k: ordem.k, asc: !ordem.asc } : { k: th.dataset.ord, asc: true }; desenhar(); return; }
      const h = ev.target.closest('[data-id]'); if (h) abrirCliente(h.dataset.id);
    });
  }
  async function abrir() {
    if (!jan) montar();
    jan.hidden = false; fundo.hidden = false;
    await carregar();
    q('vr-busca').focus();
  }
  async function carregar() {
    try { titulos = ((await api('GET', '/receber')).titulos || []).map(t => ({ ...t, _id: String(t._id) })); }
    catch (e) { titulos = []; q('vr-lista').innerHTML = '<div class="vr-vz">' + esc(e.message) + '</div>'; return; }
    desenhar();
  }
  const nomeDe = t => t.nomeConta || t.historico;
  const atraso = t => t.atraso > 0 ? '<span class="vr-atr v">vencido há ' + t.atraso + 'd</span>' : t.atraso === 0 ? '<span class="vr-atr h">vence hoje</span>' : '<span class="vr-atr f">em ' + (-t.atraso) + 'd</span>';
  function desenhar() {
    const b = q('vr-busca').value.trim().toLowerCase(), sv = q('vr-venc').checked;
    const vis = titulos.filter(t => (!b || (nomeDe(t) + ' ' + t.historico + ' ' + t.codigoConta).toLowerCase().includes(b)) && (!sv || t.atraso >= 0));
    const f = ordem.k === 'hist' ? (t => nomeDe(t).toLowerCase() + ' ' + t.vencimento) : ordem.k === 'valor' ? (t => cent(t.valor)) : (t => String(t.vencimento));
    vis.sort((x, y) => { const a = f(x), c = f(y); return (a < c ? -1 : a > c ? 1 : 0) * (ordem.asc ? 1 : -1); });
    const seta = k => ordem.k === k ? (ordem.asc ? ' ▲' : ' ▼') : ' ⇅';
    q('vr-lista').innerHTML = vis.length ? '<table class="vr-tab"><thead><tr><th style="width:34px">#</th><th class="ord" data-ord="hist">Histórico' + seta('hist')
      + '</th><th class="ord" data-ord="venc">Venc.' + seta('venc') + '</th><th class="ord n" data-ord="valor">Valor' + seta('valor') + '</th><th></th></tr></thead><tbody>'
      + vis.map((t, k) => '<tr><td class="cn">' + (k + 1) + '</td><td><span class="h" data-id="' + esc(t._id) + '" title="abrir os títulos deste cliente">' + esc(nomeDe(t)) + '</span>'
        + '<br><span class="cn">' + esc(t.historico) + ' · ' + esc(t.codigoConta) + (t.parcela ? ' · ' + t.parcela + '/' + t.totalParcelas : '') + '</span></td>'
        + '<td>' + br(t.vencimento) + '</td><td class="n">' + brl(t.valor) + '</td><td>' + atraso(t) + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="vr-vz">' + (titulos.length ? 'Nada com essa busca.' : 'Nenhum título de cliente a receber.') + '</div>';
    const tot = vis.reduce((s, t) => s + cent(t.valor), 0) / 100, venc = vis.filter(t => t.atraso > 0).reduce((s, t) => s + cent(t.valor), 0) / 100;
    q('vr-tot').innerHTML = vis.length + ' título(s) · R$ ' + brl(tot) + (venc ? ' · <span style="color:#991b1b">vencidos R$ ' + brl(venc) + '</span>' : '');
  }

  // ---- janela do cliente: escolher os titulos e receber ----
  async function abrirCliente(id) {
    const t0 = titulos.find(t => t._id === id); if (!t0) return;
    const doCli = titulos.filter(t => t.codigoConta === t0.codigoConta).sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
    const marc = new Set([id]);
    if (cli) cli.remove();
    cli = document.createElement('div'); cli.className = 'vr-jan cli';
    cli.innerHTML = '<div class="vr-cab"><span>Receber · ' + esc(nomeDe(t0)) + ' <small style="font-weight:600;opacity:.85">' + esc(t0.codigoConta) + '</small></span>'
      + '<button type="button" class="estrela" id="vc-cfg" title="contas de juros e desconto">★</button><button type="button" id="vc-x" title="fechar">×</button></div>'
      + '<div class="vr-corpo" id="vc-lista" style="max-height:40vh"></div>'
      + '<div class="vr-ctl"><label>Desconto (R$)<input class="num" id="vc-desc" inputmode="decimal" placeholder="0,00"></label>'
      + '<label>Juros / multa (R$)<input class="num" id="vc-juros" inputmode="decimal" placeholder="0,00"></label>'
      + '<label>Data do recebimento<input type="date" id="vc-data" value="' + ymd(diaUtil()) + '"></label>'
      + '<label>Banco<select id="vc-banco"><option value="">escolha o banco</option></select></label></div>'
      + '<div class="vr-conta" id="vc-conta"></div>'
      + '<div class="vr-pe"><button type="button" class="vr-btn" id="vc-raz" title="ver o razão da conta do cliente">Razão</button>'
      + '<button type="button" class="vr-btn exc" id="vc-exc" title="título que JÁ foi recebido: sai do fluxo sem lançamento, com observação">Excluir do fluxo…</button>'
      + '<span class="vr-msg" id="vc-msg" style="flex:1"></span><button type="button" class="vr-btn" id="vc-canc">Cancelar</button>'
      + '<button type="button" class="vr-btn verm" id="vc-ok" disabled>Gravar o recebimento</button></div>';
    document.body.appendChild(cli);
    arrastar(cli, cli.querySelector('.vr-cab'));
    const fechar = () => { cli.remove(); cli = null; };
    q('vc-x').addEventListener('click', fechar); q('vc-canc').addEventListener('click', fechar);
    q('vc-cfg').addEventListener('click', abrirConfig);
    q('vc-raz').addEventListener('click', () => abrirRazao(t0.codigoConta, nomeDe(t0)));
    if (!bancos) { try { const b = await api('GET', '/bancos'); bancos = Array.isArray(b) ? b : []; } catch (e) { bancos = []; } }
    const rec = bancos.filter(b => b.recebeVenda), lista = rec.length ? rec : bancos;
    q('vc-banco').insertAdjacentHTML('beforeend', lista.map(b => '<option value="' + esc(b._id) + '">' + esc(b.apelido) + '</option>').join(''));
    const msg = (t, ok) => { q('vc-msg').textContent = t || ''; q('vc-msg').classList.toggle('ok', !!ok); };
    function contas() {
      const sel = doCli.filter(t => marc.has(t._id)), tit = sel.reduce((s, t) => s + cent(t.valor), 0);
      const j = paraCent(q('vc-juros').value), d = paraCent(q('vc-desc').value), total = tit + j - d;
      q('vc-conta').innerHTML = '<span>Títulos marcados (' + sel.length + ')</span><b>R$ ' + brl(tit / 100) + '</b>'
        + (j ? '<span>+ juros / multa</span><b>R$ ' + brl(j / 100) + '</b>' : '') + (d ? '<span>− desconto</span><b>R$ ' + brl(d / 100) + '</b>' : '')
        + '<span style="font-weight:800">Total a receber</span><b style="font-size:17px;color:#b91c1c">R$ ' + brl(total / 100) + '</b>';
      q('vc-ok').disabled = !sel.length || !q('vc-banco').value || total <= 0;
      q('vc-exc').disabled = !sel.length;
      return { sel, j, d, total };
    }
    function lista2() {
      q('vc-lista').innerHTML = '<table class="vr-tab"><thead><tr><th style="width:30px"></th><th>Histórico</th><th>Venc.</th><th class="n">Valor</th><th></th></tr></thead><tbody>'
        + doCli.map(t => '<tr data-m="' + esc(t._id) + '"' + (marc.has(t._id) ? ' class="marc"' : '') + '><td><input type="checkbox" tabindex="-1"' + (marc.has(t._id) ? ' checked' : '') + '></td>'
          + '<td>' + esc(t.historico) + (t.parcela ? ' · ' + t.parcela + '/' + t.totalParcelas : '') + '</td><td>' + br(t.vencimento) + '</td><td class="n">' + brl(t.valor) + '</td><td>' + atraso(t) + '</td></tr>').join('')
        + '</tbody></table>';
      contas();
    }
    q('vc-lista').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-m]'); if (!tr) return; const k = tr.dataset.m; if (marc.has(k)) marc.delete(k); else marc.add(k); lista2(); });
    ['vc-juros', 'vc-desc'].forEach(k => { q(k).addEventListener('input', contas); q(k).addEventListener('blur', () => { const c = paraCent(q(k).value); q(k).value = c ? brl(c / 100) : ''; contas(); }); });
    q('vc-banco').addEventListener('change', contas);
    // 18/10/2026: Enter anda: desconto -> juros -> data -> banco; no banco escolhido, vai ao Gravar
    const ORDEM = ['vc-desc', 'vc-juros', 'vc-data', 'vc-banco'];
    ORDEM.forEach((id, k) => q(id).addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (id === 'vc-desc' || id === 'vc-juros') { const c = paraCent(q(id).value); q(id).value = c ? brl(c / 100) : ''; contas(); }
      if (id === 'vc-banco') { if (q('vc-banco').value && !q('vc-ok').disabled) q('vc-ok').focus(); return; }
      const prox = q(ORDEM[k + 1]); prox.focus();
      if (prox.select && prox.tagName === 'INPUT' && prox.type !== 'date') prox.select();
      if (prox.tagName === 'SELECT') { try { prox.showPicker(); } catch (e) { /* sem showPicker */ } }
    }));
    q('vc-ok').addEventListener('click', async () => {
      const { sel, j, d, total } = contas();
      const banco = q('vc-banco').selectedOptions[0].textContent;
      if (!confirm('Quer gravar o recebimento?\n\n' + nomeDe(t0) + '\n' + sel.length + ' título(s): R$ ' + brl(sel.reduce((s, t) => s + cent(t.valor), 0) / 100)
        + (j ? '\n+ juros/multa R$ ' + brl(j / 100) : '') + (d ? '\n− desconto R$ ' + brl(d / 100) : '')
        + '\n\nTotal R$ ' + brl(total / 100) + ' no ' + banco + ' em ' + br(q('vc-data').value + 'T12:00:00'))) return;
      q('vc-ok').disabled = true; msg('');
      try {
        const r = await api('POST', '/quitar', { tipo: 'receber', data: q('vc-data').value, contaBancariaId: q('vc-banco').value,
          titulosIds: sel.map(t => t._id), juros: j / 100, desconto: d / 100,
          historico: sel.length > 1 ? 'Diversos títulos — ' + nomeDe(t0) + ' (' + sel.length + ')' : 'Recebimento — ' + sel[0].historico });
        fechar();
        await carregar();
        q('vr-tot').insertAdjacentHTML('afterbegin', '<span class="vr-msg ok">✓ recebido: boleta ' + esc(r.codigo || '') + ' · R$ ' + brl(r.liquido ?? total / 100) + '</span> &nbsp; ');
        if (window.FluxoCaixa && window.FluxoCaixa.recarregar) window.FluxoCaixa.recarregar();
      } catch (e) { msg(e.message); contas(); }
    });
    // 19/10/2026: excluir do fluxo (ja recebido), com observacao e conferindo o saldo da conta
    q('vc-exc').addEventListener('click', async () => {
      const sel = doCli.filter(t => marc.has(t._id)); if (!sel.length) return;
      const soma = sel.reduce((s, t) => s + cent(t.valor), 0);
      const emAberto = doCli.reduce((s, t) => s + cent(t.valor), 0);
      let aviso = '';
      try {
        const sc = await api('GET', '/saldo-conta?codigo=' + encodeURIComponent(t0.codigoConta)), saldo = cent(sc.saldo);
        aviso = 'Na contabilidade, a conta ' + t0.codigoConta + ' está com saldo R$ ' + brl(saldo / 100) + '.\n'
          + (saldo <= 0 ? '✓ Confere: a conta não deve nada, os títulos já foram recebidos.'
            : saldo >= emAberto ? '⚠ ATENÇÃO: a conta ainda DEVE R$ ' + brl(saldo / 100) + ' — os títulos podem estar em aberto de verdade.'
            : '⚠ A conta deve R$ ' + brl(saldo / 100) + ' (menos que os R$ ' + brl(emAberto / 100) + ' do fluxo): confira quais foram recebidos.');
      } catch (e) { aviso = '(não consegui ler o saldo da conta: ' + e.message + ')'; }
      const motivo = prompt('EXCLUIR DO FLUXO, sem lançamento — ' + nomeDe(t0) + '\n' + sel.length + ' título(s): R$ ' + brl(soma / 100) + '\n\n'
        + aviso + '\n\nObservação (obrigatória):', 'Já recebido em 2025 — veio no saldo transferido da virada do ano');
      if (motivo === null) return;
      if (motivo.trim().length < 5) { msg('Escreva a observação.'); return; }
      q('vc-exc').disabled = true; msg('');
      try {
        const r = await api('POST', '/titulos/excluir', { ids: sel.map(t => t._id), motivo: motivo.trim() });
        fechar();
        await carregar();
        q('vr-tot').insertAdjacentHTML('afterbegin', '<span class="vr-msg ok">✓ ' + r.excluidos + ' título(s) excluído(s) do fluxo</span> &nbsp; ');
        if (window.FluxoCaixa && window.FluxoCaixa.recarregar) window.FluxoCaixa.recarregar();
      } catch (e) { msg(e.message); contas(); }
    });
    lista2();
    setTimeout(() => q('vc-desc').focus(), 0);
  }

  // ---- 19/10/2026: razao da conta do cliente (o ano todo, com o saldo corrido) ----
  async function abrirRazao(conta, nome) {
    if (raz) raz.remove();
    raz = document.createElement('div'); raz.className = 'vr-jan raz';
    raz.innerHTML = '<div class="vr-cab"><span>Razão · ' + esc(nome) + ' <small style="font-weight:600;opacity:.85">' + esc(conta) + '</small></span>'
      + '<button type="button" id="vz-x" title="fechar (Esc)">×</button></div>'
      + '<div class="vr-corpo" id="vz-lista"><div class="vr-vz">Carregando…</div></div>'
      + '<div class="vr-pe"><span class="tot" id="vz-tot"></span><button type="button" class="vr-btn" id="vz-fechar">Fechar</button></div>';
    document.body.appendChild(raz);
    arrastar(raz, raz.querySelector('.vr-cab'));
    const fechar = () => { if (raz) raz.remove(); raz = null; };
    raz.querySelector('#vz-x').addEventListener('click', fechar); raz.querySelector('#vz-fechar').addEventListener('click', fechar);
    const ano = new Date().getFullYear();
    try {
      const r = await fetch('/financeiro/api/razao/lancamentos?conta=' + encodeURIComponent(conta) + '&de=' + ano + '-01-01&ate=' + ano + '-12-31', { cache: 'no-store' });
      const j = await r.json(); if (!r.ok || j.erro) throw new Error(j.erro || 'erro ' + r.status);
      const ls = j.lancamentos || [];
      const v = x => x ? brl(x) : '';
      raz.querySelector('#vz-lista').innerHTML = ls.length ? '<table class="vr-tab"><thead><tr><th>Data</th><th>Histórico</th><th>C/Part.</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr></thead><tbody>'
        + ls.map(l => '<tr' + (l.saldoAnterior ? ' class="ant"' : '') + '><td>' + br(l.data) + '</td><td>' + esc(l.historico) + '</td>'
          + '<td class="cn">' + esc(l.cPartida || '') + (l.cPartidaNome ? '<br>' + esc(l.cPartidaNome) : '') + '</td>'
          + '<td class="n deb">' + v(l.debito) + '</td><td class="n cre">' + v(l.credito) + '</td><td class="n"><b>' + brl(l.saldo) + '</b></td></tr>').join('')
        + '</tbody><tfoot><tr><td colspan="3">Total do ano</td><td class="n deb">' + brl(j.totalDebito) + '</td><td class="n cre">' + brl(j.totalCredito) + '</td><td class="n">' + brl(j.saldo) + '</td></tr></tfoot></table>'
        : '<div class="vr-vz">Nenhum lançamento nesta conta em ' + ano + '.</div>';
      raz.querySelector('#vz-tot').innerHTML = 'Saldo da conta: <b>R$ ' + brl(j.saldo) + '</b>'
        + (Math.abs(cent(j.saldo)) < 1 ? ' · <span class="vr-msg ok">zerada: não deve nada</span>' : j.saldo > 0 ? ' · <span style="color:#991b1b">o cliente deve</span>' : ' · <span style="color:#1d4ed8">crédito do cliente</span>');
    } catch (e) { raz.querySelector('#vz-lista').innerHTML = '<div class="vr-vz">' + esc(e.message) + '</div>'; }
  }

  // ★ contas de juros e desconto (configuracao por chave)
  function abrirConfig() {
    const ir = () => window.ConfigContas.abrir({ pagina: 'receber', titulo: 'vendas - receber (juros e desconto)' });
    if (window.ConfigContas) { ir(); return; }
    const sc = document.createElement('script'); sc.src = '/js/comum/config-contas.js';
    sc.onload = ir; sc.onerror = () => alert('Não carregou o config-contas.js'); document.head.appendChild(sc);
  }

  window.VendasReceber = { abrir };
})();
