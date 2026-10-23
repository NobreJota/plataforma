/* Destino: C:\plataformaRota\public\js\contab\contabil\financeiro\fluxo.js
 * (caminho corrigido em 05/10/2026; antes dizia public/js/financeiro/fluxo.js)
 * Tela do Fluxo de Caixa — lê o Fluxo Projetado, saldo acumulado, filtro mês/ano
 *
 * Alterado em 03/10/2026:
 *  - data do movimento nasce HOJE (sabado/domingo -> a sexta); nao aceita data
 *    depois de hoje, sabado/domingo, nem mais de 5 dias uteis para tras
 *  - clique numa parcela de CARTAO (1.01.005.xxx) abre todas as parcelas em
 *    aberto daquela venda; botao "Antecipacao de cartao" lista todas as parcelas
 *    em aberto de um cartao
 *  - "Valor liquido pago pelo cartao": a diferenca vai para a despesa do cartao
 *    (taxa em R$ e %); API /financeiro/api/pagamento (cartao, cartoes, quitar)
 *  - recebimento de CARTAO: banco fixo CEF/Armacao (1.01.002.003, por contrato) e
 *    travado; data vem VAZIA para escolher; o valor liquido so abre depois da data;
 *    parcela de DEBITO nao tem antecipacao (o botao some)
 *  - cartao: escolhida a data, o foco vai para o valor liquido (fundo amarelo);
 *    Enter no liquido confirma o valor, libera e foca "Receber selecionados"
 *    (antes disso o botao fica desativado)
 *
 * Alterado em 05/10/2026: parcela de TITULO de venda (historico "... · título")
 *    recebe sempre no Banestes/Armacao (1.01.002.002), banco travado
 * Alterado em 05/10/2026: clique na parcela de cartao mostra SO a parcela clicada;
 *    "Antecipacao de cartao" traz as outras a vencer daquela venda; "todos" traz e
 *    marca todas as parcelas em aberto do cartao (todas as vendas). Caixa "Valor
 *    total do cartao" ao lado do valor liquido
 * Alterado em 05/10/2026: "todos" = todas as parcelas em aberto do CLIENTE daquela
 *    venda neste cartao (todas as vendas dele), ja marcadas
 * Alterado em 07/10/2026: VARIOS USUARIOS — a cada 15 s (e ao voltar para a aba) a
 *    tela pergunta a /versao do fluxo; se mudou, recarrega a grade e o modal aberto.
 *    Parcela baixada por outro usuario sai da lista com aviso; as marcadas continuam
 *    marcadas. Erro de "ja baixada" ao gravar tambem recarrega na hora.
 * Alterado em 05/10/2026: janela da boleta mostra a contrapartida NEGATIVA (taxa do
 *    cartao) do lado do banco, em valor positivo; cada lado com o seu total
 * Alterado em 18/10/2026: window.FluxoCaixa.recarregar() para o sub-menu (fluxo-submenu.js)
 * Alterado em 18/10/2026: FluxoCaixa.mostrar(pos, sim): o sub-menu esconde orcamento/compras proj./pedidos
 * Alterado em 19/10/2026 (Jorge, como no Access): clique no NUMERO do pos (a bolinha) abre uma janela com
 *    TODOS os registros daquele pos no mes escolhido (ou no ano, em "todos"): vencimento, nome, conta,
 *    valor e a situacao (vencido ha Nd / vence hoje / em Nd); ordena por Venc., Nome e Valor; totais
 *    do mes, vencidos e a vencer. Vale para todos os pos (5 a receber, 2 a pagar, 7 pedidos, 3 compras...).
 *    Usa as linhas que a grade ja carregou (sem ir ao servidor). Arrastavel; Esc fecha.
 *    E TODOS os pos aparecem sempre na grade: saiu o esconder do sub-menu (ocultos fica vazio).
 *    19/10/2026: a janela do pos AGRUPA por documento (pedido, nota, cliente): uma linha com o total; clique no
 *    numero abre a aba com os vencimentos (de todos os meses: API GET /financeiro/api/fluxo/pos/:pos).
 *    "só os que vencem em <mes>" (marcado) mostra so os documentos com parcela no mes da grade.
 *    POS como no Access: 3 = Pedidos feitos, 7 = Compras projetadas.
 *    19/10/2026: linha pos 7 (compra projetada) leva a etiqueta "previsão" antes do historico e fica em italico.
 * Alterado em 23/10/2026 (Jorge): RECEBIMENTO DE TITULO DE CLIENTE com tres formas: botoes Banco · Caixa · Cartão
 *    no modal, cada um com o seu quadro. Banco: so os que recebem venda (BB, Banestes, CEF). Caixa: 1.01.001.001
 *    (POST /quitar com forma CAIXA). Cartão: bandeira, débito/crédito, 1 a 10x e a previa das parcelas; grava pelo
 *    POST /receber-cartao (o titulo do cliente baixa contra a operadora e nascem as parcelas pos 5 do cartao).
 *    Com Cartão a lista mostra so os titulos do cliente clicado. Fora do recebimento de cliente (pagar, cartao,
 *    titulo PJ no Banestes) os botoes nao aparecem.
 * Alterado em 23/10/2026 (Jorge): o modal de pagamento/recebimento ARRASTA pelo titulo (volta ao centro ao abrir).
 *    No recebimento de cliente (Banco · Caixa · Cartão) o botao "Antecipação de cartão" nao aparece: o cliente
 *    ainda nao pagou no cartao, nao ha parcela de operadora para antecipar.
 * Alterado em 23/10/2026 (Jorge): janela do pos — so UM documento aberto: abrir um fecha os outros.
 * Alterado em 23/10/2026 (Jorge): janela do pos — clique no NOME abre o RAZAO da conta (RazaoConta, janela por cima;
 *    passar o mouse diz "acesso razão"). Grade mes a mes da aba em letra menor (cabe sem rolar para o lado).
 * Alterado em 23/10/2026 (Jorge): ORDENAR a grade clicando em Histórico, Conta, T, Vencto, A receber, A pagar
 *    (montarGrade). Aba do documento: sai a linha do fluxo do MESMO pos do documento (repetia "Este documento");
 *    rotulos mais curtos (coluna mais estreita).
 * Alterado em 22/10/2026 (Jorge): a ABA do documento (botao "ver") virou uma GRADE MES A MES (jan do ano da grade
 *    ate mar do ano seguinte): Comprado (notas que entraram), Previsto (Ped_Previsão, mes da compra), o fluxo em
 *    aberto da conta por pos e as parcelas deste documento — cada valor no seu mes; o mes da grade em destaque.
 *    Media e maior dos 3 ultimos meses ao lado. API GET /financeiro/api/fluxo/meses/:conta. Saiu a lista de vencimentos.
 * Alterado em 22/10/2026 (Jorge): janela do pos — com "só os que vencem em <mes>" o VALOR e so o do mes
 *    (e a data e a da parcela do mes); sem marcar, o total em aberto do documento. A situacao so mostra
 *    "vencido ha Nd" e "vence hoje" (saiu o verde "em Nd").
 * Alterado em 20/10/2026: com um pos escolhido no Sintetizar, a coluna Saldo e o rodape sao SO daquele pos.
 * Alterado em 20/10/2026: Sintetizar SO do mes escolhido (sem o saldo dos meses anteriores — Jorge).
 * Alterado em 20/10/2026: "● Sintetizar" na legenda: total de cada pos no periodo e total do mes; clicou num pos, a
 *    grade mostra so ele ("mostrar todos" ou clicar num mes volta ao normal).
 */
(() => {
  'use strict';
  console.log('%c🌊 fluxo.js v4.2 - dropdown banco código + nome', 'background:#6d28d9;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

  const API = '/financeiro/api/fluxo';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Abre no mês corrente. Trazer o ano inteiro de saída enche a tela de
  // linhas que raramente interessam — o "todos" está a um clique.
  const state = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };

  async function api(path) {
    const res = await fetch(API + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  const escAttr = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function fmt(v) {
    if (!v) return '';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtData(d) {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
  }

  /* ===== Botões de mês ===== */
  function renderMeses() {
    const cont = $('#flx-meses');
    let html = '';
    MESES.forEach((m, i) => {
      html += `<button class="flx-mes-btn ${state.mes === i+1 ? 'ativo' : ''}" data-mes="${i+1}">${m.slice(0,3)}</button>`;
    });
    // "todos" fecha a fila, depois de Dez: é o passo seguinte a percorrer os
    // meses, não o começo.
    html += `<button class="flx-mes-btn flx-todos ${state.mes === null ? 'ativo' : ''}" data-mes="">todos</button>`;
    cont.innerHTML = html;
    $$('#flx-meses .flx-mes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mes = btn.dataset.mes ? parseInt(btn.dataset.mes, 10) : null;
        filtroPos = null;                                   // 20/10/2026: clicou no mes, volta ao normal (todos)
        renderMeses();
        carregar();
      });
    });
  }

  /* ===== Combo de ano ===== */
  function renderAnos() {
    const atual = new Date().getFullYear();
    const anos = [atual - 1, atual, atual + 1];
    $('#flx-ano').innerHTML = anos.map(a => `<option value="${a}" ${a===state.ano?'selected':''}>${a}</option>`).join('');
  }

  // 19/10/2026 (Jorge): TODOS os pos aparecem sempre (o "Mostrar no fluxo" do sub-menu saiu). O que um
  // computador tinha escondido antes e apagado aqui. Para resumir um pos: clique no numero dele.
  const ocultos = new Set();
  try { localStorage.removeItem('fluxo-ocultar'); } catch (_) { /* sem storage */ }

  /* ===== 19/10/2026: janela "todos os registros do pos" (clique na bolinha do pos) ===== */
  // 19/10/2026: como no Access — 3 = pedido feito ao fabricante, 7 = compra projetada (previsao)
  const POS_NOME = { 0: 'Avulso', 1: 'Cartão - receber', 2: 'A pagar', 3: 'Pedidos feitos', 5: 'A receber',
                     7: 'Compras projetadas', 8: 'Orçamento projetado' };
  let ultimasLinhas = [], jp = null, jpOrdem = { k: 'venc', asc: true };
  (function estiloPos() {
    const st = document.createElement('style');
    st.textContent = `
    .c-pos-badge { cursor:pointer; } .c-pos-badge:hover { outline:2px solid #6d28d9; }
    .tag-prev { font-size:.68rem; font-weight:800; color:#92400e; background:#fef3c7; border:1px solid #fde68a; border-radius:6px; padding:0 5px; }
    tr.pos-7 td.c-hist { font-style:italic; }
    .jp-jan { position:fixed; left:50%; top:5vh; transform:translateX(-50%); z-index:90; width:min(920px, calc(100vw - 24px)); max-height:88vh;
              display:flex; flex-direction:column; background:#fff; border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.3);
              font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:14px; color:#111827; }
    .jp-cab { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#6d28d9; color:#fff; border-radius:12px 12px 0 0;
              font-weight:800; font-size:15px; cursor:move; user-select:none; }
    .jp-cab span { flex:1; } .jp-cab button { border:0; background:none; color:#fff; font-size:20px; cursor:pointer; }
    .jp-ctl { padding:8px 14px; border-bottom:1px solid #e5e7eb; }
    .jp-ctl input { height:30px; width:280px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; font-size:14px; }
    .jp-corpo { flex:1; min-height:0; overflow:auto; }
    .jp-tab { width:100%; border-collapse:collapse; font-size:13px; }
    .jp-tab th { position:sticky; top:0; background:#f3f4f6; color:#374151; font-size:11px; text-transform:uppercase; text-align:left; padding:6px 8px; }
    .jp-tab th.ord { cursor:pointer; user-select:none; } .jp-tab th.ord:hover { color:#6d28d9; }
    .jp-tab td { padding:5px 8px; border-top:1px solid #f3f4f6; } .jp-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .jp-tab .cn { color:#6b7280; font-size:12px; }
    .jp-atr { font-size:11px; font-weight:800; border-radius:8px; padding:1px 6px; white-space:nowrap; }
    .jp-atr.v { background:#fee2e2; color:#991b1b; } .jp-atr.h { background:#fef9c3; color:#854d0e; } .jp-atr.f { background:#dcfce7; color:#166534; }
    .jp-pe { display:flex; gap:16px; align-items:center; padding:10px 14px; border-top:1px solid #e5e7eb; flex-wrap:wrap; font-weight:700; }
    .jp-pe .tot { flex:1; } .jp-pe b { font-size:16px; }
    .jp-num { border:1px solid #c4b5fd; background:#faf5ff; color:#6d28d9; border-radius:6px; padding:2px 8px; font-weight:800; cursor:pointer; font-size:13px; white-space:nowrap; }
    .jp-num:hover { background:#ede9fe; }
    .jp-tab tr.jp-aba > td { background:#faf5ff; border-top:0; }
    .jp-sub { border-collapse:collapse; font-size:13px; margin:2px 0 8px; min-width:380px; }
    .jp-sub th { position:static; background:#ede9fe; font-size:10px; padding:4px 10px; }
    .jp-sub td { padding:3px 10px; border-top:1px solid #ede9fe; } .jp-sub tr.mes td { font-weight:800; }
    .jp-meses { border-collapse:collapse; font-size:10.5px; margin:4px 0 8px; width:100%; }
    .jp-meses th { position:static; background:#ede9fe; color:#4c1d95; font-size:10px; padding:3px 3px; text-align:right; white-space:nowrap; }
    .jp-meses th.rot, .jp-meses td.rot { text-align:left; white-space:nowrap; padding-right:6px; }
    .jp-meses td { padding:2px 3px; border-top:1px solid #ede9fe; text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; letter-spacing:-.2px; }
    .jp-razao { color:inherit; text-decoration:none; cursor:pointer; } .jp-razao:hover { color:#6b21a8; text-decoration:underline; }
    .jp-meses td.z { color:#d1d5db; } .jp-meses .cur { background:#ddd6fe; font-weight:800; }
    .jp-meses tr.doc td { font-weight:800; color:#6b21a8; } .jp-meses tr.comp td:not(.rot) { color:#047857; }
    .jp-rodmes { font-size:12px; color:#6b7280; margin:2px 0 6px; }
    .jp-pe button { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:7px 14px; font-weight:700; cursor:pointer; }`;
    document.head.appendChild(st);
  })();
  // 19/10/2026 (Jorge): a janela AGRUPA por documento — o pedido (ou a nota, ou o cliente) aparece UMA vez,
  // com o total; clique no numero e abre a "aba" com os vencimentos dele. Le TODAS as linhas em aberto
  // do pos (todos os meses: as parcelas de um pedido passam de um mes para o outro).
  function docDe(l) {
    const h = String(l.historico || '');
    let m = /pedido\D{0,60}?(\d{4,})/i.exec(h);
    if (m) return { k: 'P' + m[1], rot: 'nº ' + m[1] };
    m = /\bNF\s*N?[ºo°.]*\s*(\d+)/i.exec(h);
    if (m) return { k: 'N' + l.codigoConta + '|' + Number(m[1]), rot: 'NF ' + Number(m[1]) };
    if (Number(l.pos) === 5 || Number(l.pos) === 1) return { k: 'C' + l.codigoConta, rot: '' };      // a receber: por cliente
    const base = h.replace(/[\s\-·:]*\d+\s*\/\s*\d+\s*[a-z]?\s*$/i, '').trim().toLowerCase();       // tira o "5/6" do fim
    return { k: 'H' + l.codigoConta + '|' + base, rot: '' };
  }
  async function abrirPos(pos) {
    if (jp) jp.remove();
    const quando = state.mes ? MESES[state.mes - 1] + '/' + state.ano : '';
    jp = document.createElement('div'); jp.className = 'jp-jan';
    jp.innerHTML = '<div class="jp-cab"><span>pos ' + pos + ' · ' + escAttr(POS_NOME[pos] || '') + '</span><button type="button" data-x title="fechar (Esc)">×</button></div>'
      + '<div class="jp-ctl" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><input data-busca placeholder="procurar nome, histórico ou conta" autocomplete="off">'
      + (quando ? '<label style="font-size:13px;display:flex;gap:5px;align-items:center"><input type="checkbox" data-mes checked style="height:auto;width:auto"> só os que vencem em ' + quando + '</label>' : '')
      + '</div><div class="jp-corpo" data-lista><div style="padding:24px;text-align:center;color:#6b7280">Carregando…</div></div>'
      + '<div class="jp-pe"><span class="tot" data-tot></span><button type="button" data-x>Fechar</button></div>';
    document.body.appendChild(jp);
    const cab = jp.querySelector('.jp-cab');
    cab.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      const r = jp.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      jp.style.transform = 'none'; jp.style.left = r.left + 'px'; jp.style.top = r.top + 'px';
      const m = e => { jp.style.left = Math.min(Math.max(0, e.clientX - dx), innerWidth - 80) + 'px'; jp.style.top = Math.min(Math.max(0, e.clientY - dy), innerHeight - 40) + 'px'; };
      const u = () => { document.removeEventListener('mousemove', m); document.removeEventListener('mouseup', u); };
      document.addEventListener('mousemove', m); document.addEventListener('mouseup', u);
    });
    const meu = jp;
    jp.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { meu.remove(); if (jp === meu) jp = null; }));

    let linhas = [];
    try { linhas = (await api('/pos/' + pos)).linhas || []; }
    catch (e) { meu.querySelector('[data-lista]').innerHTML = '<div style="padding:24px;color:#b91c1c">' + escAttr(e.message) + '</div>'; return; }

    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    const atraso = d => { const v = new Date(d); v.setHours(12, 0, 0, 0); return Math.round((hoje - v) / 86400000); };
    const noMes = l => { const d = new Date(l.vencimento); return state.mes && d.getFullYear() === state.ano && d.getMonth() + 1 === state.mes; };
    const sit = d => { const a = atraso(d); return a > 0 ? '<span class="jp-atr v">vencido há ' + a + 'd</span>' : a === 0 ? '<span class="jp-atr h">vence hoje</span>' : ''; };   // 22/10/2026: sem o verde "em Nd" 
    // agrupa
    const grupos = new Map();
    for (const l of linhas) {
      const d = docDe(l);
      if (!grupos.has(d.k)) grupos.set(d.k, { k: d.k, rot: d.rot, nome: l.nomeConta || l.historico, hist: l.historico, conta: l.codigoConta, parc: [] });
      grupos.get(d.k).parc.push(l);
    }
    const docs = [...grupos.values()].map(g => {
      g.parc.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
      g.total = g.parc.reduce((t, l) => t + Math.round(l.valor * 100), 0) / 100;
      g.mes = g.parc.filter(noMes).reduce((t, l) => t + Math.round(l.valor * 100), 0) / 100;
      g.temMes = g.parc.some(noMes);
      g.prox = g.parc[0].vencimento;
      const pm = g.parc.find(noMes); g.proxMes = pm ? pm.vencimento : g.prox;   // 22/10/2026: a parcela do mes
      g.venc = g.parc.filter(l => atraso(l.vencimento) > 0).reduce((t, l) => t + Math.round(l.valor * 100), 0) / 100;
      return g;
    });
    const abertos = new Set();
    // 22/10/2026: a conta mes a mes (jan do ano da grade ate mar do ano seguinte), lida uma vez por conta
    const N_MESES = 15, iniMes = state.ano * 12, mesesCache = new Map();
    const MES3 = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const POS_ROT = { 0: 'Avulso', 1: 'Cartão', 2: 'A pagar (notas)', 3: 'Pedidos feitos', 5: 'A receber', 7: 'Compras proj.', 8: 'Orçamento' };
    function gradeMeses(g) {
      const d = mesesCache.get(g.conta);
      if (!d) {
        if (g.conta && !mesesCache.has(g.conta)) {
          mesesCache.set(g.conta, null);
          api('/meses/' + encodeURIComponent(g.conta) + '?de=' + state.ano + '-01&n=' + N_MESES)
            .then(r => { mesesCache.set(g.conta, r); desenhar(); })
            .catch(e => { mesesCache.set(g.conta, { erro: e.message }); desenhar(); });
        }
        return g.conta ? '<div class="jp-rodmes">Carregando os meses…</div>' : '';
      }
      if (d.erro) return '<div class="jp-rodmes" style="color:#991b1b">' + escAttr(d.erro) + '</div>';
      const cur = state.mes ? (state.mes - 1) : -1;                          // o mes da grade
      const este = Array(N_MESES).fill(0);                                     // as parcelas deste documento
      for (const l of g.parc) { const x = new Date(l.vencimento); const k = x.getFullYear() * 12 + x.getMonth() - iniMes; if (k >= 0 && k < N_MESES) este[k] += Math.round(l.valor * 100); }
      const cel = (v, k) => '<td class="' + (v ? '' : 'z') + (k === cur ? ' cur' : '') + '">' + (v ? fmt(v) : '·') + '</td>';
      const lin = (rot, vals, cls) => '<tr class="' + (cls || '') + '"><td class="rot">' + rot + '</td>' + vals.map(cel).join('')
        + '<td class="rot"><b>' + (fmt(vals.reduce((a, b) => a + b, 0)) || '') + '</b></td></tr>';
      let h = '<table class="jp-meses"><tr><th class="rot"></th>' + d.meses.map((m, k) => '<th' + (k === cur ? ' class="cur"' : '') + '>'
        + MES3[m.mes - 1] + (m.mes === 1 || k === 0 ? '/' + String(m.ano).slice(2) : '') + '</th>').join('') + '<th class="rot">total</th></tr>';
      if (d.comprado) h += lin('Comprado', d.comprado, 'comp');
      if (d.previsto) h += lin('Previsto', d.previsto);
      // 23/10/2026: a linha do MESMO pos do documento repetia "Este documento": sai
      const posDoc = String(g.parc[0] && g.parc[0].pos);
      for (const p of Object.keys(d.fluxo || {}).sort()) if (p !== posDoc) h += lin(POS_ROT[p] || 'pos ' + p, d.fluxo[p]);
      h += lin('Este documento', este.map(v => v / 100), 'doc');
      h += '</table><div class="jp-rodmes">Comprado = notas que entraram (mês da entrada) · Previsto = Ped_Previsão (mês da compra) · as outras linhas = vencimentos em aberto da conta'
        + (d.fluxo && d.fluxo[2] ? ' — "A pagar (notas)" são as parcelas das notas já compradas' : '') + '.</div>';
      if (d.fornecedor) h += '<div class="jp-rodmes">' + escAttr(d.fornecedor.marca) + ' · compras dos 3 últimos meses: média <b>R$ ' + (fmt(d.media3) || '0,00')
        + '</b> · maior <b>R$ ' + (fmt(d.maior3) || '0,00') + '</b> · ' + (d.media3 >= 6000 ? 'compra mensal' : 'compra a cada 2 ou 3 meses') + ' (regra da programação)</div>';
      return h;
    }
    const desenhar = () => {
      const b = meu.querySelector('[data-busca]').value.trim().toLowerCase();
      const soMes = !!(meu.querySelector('[data-mes]') && meu.querySelector('[data-mes]').checked);
      const vis = docs.filter(g => (!soMes || g.temMes) && (!b || (g.rot + ' ' + g.nome + ' ' + g.hist + ' ' + g.conta).toLowerCase().includes(b)));
      const val = g => soMes ? g.mes : g.total, vcto = g => soMes ? g.proxMes : g.prox;   // 22/10/2026
      const f = jpOrdem.k === 'nome' ? (g => String(g.nome).toLowerCase()) : jpOrdem.k === 'valor' ? val : (g => String(vcto(g) || ''));
      vis.sort((x, y) => { const a = f(x), c = f(y); return (a < c ? -1 : a > c ? 1 : 0) * (jpOrdem.asc ? 1 : -1); });
      const seta = k => jpOrdem.k === k ? (jpOrdem.asc ? ' ▲' : ' ▼') : ' ⇅';
      meu.querySelector('[data-lista]').innerHTML = vis.length ? '<table class="jp-tab"><thead><tr><th style="width:34px">#</th><th>Número</th>'
        + '<th class="ord" data-ord="nome">Nome / histórico' + seta('nome') + '</th><th class="ord" data-ord="venc">Próx. venc.' + seta('venc') + '</th>'
        + '<th class="ord n" data-ord="valor">Valor' + seta('valor') + '</th><th>Situação</th></tr></thead><tbody>'
        + vis.map((g, k) => {
          const aberto = abertos.has(g.k);
          const linha = '<tr><td class="cn">' + (k + 1) + '</td>'
            + '<td><button type="button" class="jp-num" data-doc="' + escAttr(g.k) + '" title="ver os vencimentos">' + (aberto ? '▾ ' : '▸ ') + escAttr(g.rot || 'ver') + '</button>'
            + '<br><span class="cn">' + g.parc.length + ' parcela(s)</span></td>'
            + '<td><a href="#" class="jp-razao" data-razao="' + escAttr(g.conta) + '" data-nome="' + escAttr(g.nome) + '" title="acesso razão — ' + escAttr(g.conta) + '"><b>' + escAttr(g.nome) + '</b></a><br><span class="cn">' + escAttr(g.hist) + ' · ' + escAttr(g.conta) + '</span></td>'
            + '<td>' + fmtData(vcto(g)) + '</td><td class="n"><b>' + fmt(val(g)) + '</b></td>'
            + '<td>' + sit(vcto(g)) + '</td></tr>';
          const aba = !aberto ? '' : '<tr class="jp-aba"><td></td><td colspan="5"><div style="overflow-x:auto">' + gradeMeses(g) + '</div>'
            + '<button type="button" class="jp-num" data-doc="' + escAttr(g.k) + '">fecha aba</button></td></tr>';
          return linha + aba;
        }).join('') + '</tbody></table>'
        : '<div style="padding:24px;text-align:center;color:#6b7280">Nenhum registro.</div>';
      const tot = vis.reduce((t, g) => t + Math.round(g.total * 100), 0) / 100, mes = vis.reduce((t, g) => t + Math.round(g.mes * 100), 0) / 100;
      const venc = vis.reduce((t, g) => t + Math.round(g.venc * 100), 0) / 100;
      meu.querySelector('[data-tot]').innerHTML = vis.length + ' documento(s) · '
        + (soMes ? 'no mês <b>R$ ' + (fmt(mes) || '0,00') + '</b>' : 'em aberto <b>R$ ' + (fmt(tot) || '0,00') + '</b>')
        + ' &nbsp;·&nbsp; <span style="color:#991b1b">vencidos R$ ' + (fmt(venc) || '0,00') + '</span>';
    };
    meu.querySelector('[data-busca]').addEventListener('input', desenhar);
    const cx = meu.querySelector('[data-mes]'); if (cx) cx.addEventListener('change', desenhar);
    meu.addEventListener('click', ev => {
      const rz = ev.target.closest('[data-razao]');                    // 23/10/2026: nome -> razao da conta
      if (rz) {
        ev.preventDefault();
        if (!rz.dataset.razao) return;
        if (window.RazaoConta) window.RazaoConta.abrir(rz.dataset.razao, rz.dataset.nome);
        else alert('A janela do razão não está carregada nesta página.');
        return;
      }
      const n = ev.target.closest('[data-doc]');
      if (n) { const k = n.dataset.doc; const ja = abertos.has(k); abertos.clear(); if (!ja) abertos.add(k); desenhar();   // 23/10: so UM aberto
        if (!ja) { const b = meu.querySelector('[data-doc="' + CSS.escape(k) + '"]'); if (b) b.closest('tr').scrollIntoView({ block: 'nearest' }); }
        return; }
      const th = ev.target.closest('th[data-ord]'); if (!th) return;
      jpOrdem = jpOrdem.k === th.dataset.ord ? { k: jpOrdem.k, asc: !jpOrdem.asc } : { k: th.dataset.ord, asc: true };
      desenhar();
    });
    desenhar();
  }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && jp && !document.querySelector('.rc-jan')) { jp.remove(); jp = null; } });   // 23/10: com o razao aberto, Esc fecha so ele

  /* 23/10/2026 (Jorge): ORDENAR a grade clicando no cabecalho: Histórico, Conta, T, Vencto, A receber, A pagar.
     2o clique inverte; 3o volta a ordem normal (vencimento). Fora da ordem por vencimento a coluna Saldo fica
     vazia (saldo acumulado so faz sentido na ordem das datas) e sai o separador de mes. */
  let gradeOrdem = { k: null, asc: true };
  const natural = s => String(s || '').replace(/\d+/g, n => n.padStart(8, '0'));
  function linhasOrdenadas() {
    const L = ultimasLinhas.map((l, i) => ({ ...l, _i: i }));
    if (!gradeOrdem.k) return L;
    const k = gradeOrdem.k, s = gradeOrdem.asc ? 1 : -1;
    const val = l => k === 'hist' ? String(l.historico || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      : k === 'conta' ? natural(l.codigoConta) : k === 'pos' ? Number(l.pos) || 0
      : k === 'vect' ? String(l.vencimento || '') : k === 'receber' ? Math.abs(Number(l.aReceber) || 0) : Math.abs(Number(l.aPagar) || 0);
    return L.sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -s : x > y ? s : 0) || (a._i - b._i); });
  }
  function marcarOrdemGrade() {
    $$('.flx-grid thead th[data-ord]').forEach(th => {
      let sp = th.querySelector('.seta'); if (!sp) { sp = document.createElement('span'); sp.className = 'seta'; th.appendChild(sp); }
      const on = th.dataset.ord === gradeOrdem.k; sp.textContent = on ? (gradeOrdem.asc ? ' ▲' : ' ▼') : ' ⇅'; sp.style.opacity = on ? '1' : '.5';
    });
  }
  function montarGrade() {
    const tbody = $('#flx-body');
    marcarOrdemGrade();
    // No modo "todos", uma linha em branco separa um mês do outro. Sem ela
    // os doze meses viram um bloco único e o olho se perde.
    let mesAnterior = null, corre = 0;
    const porData = !gradeOrdem.k;                       // ordem do servidor (vencimento)
    tbody.innerHTML = linhasOrdenadas().map(l => {
      let separador = '';
      if (porData && state.mes === null && l.vencimento) {
        const m = new Date(l.vencimento).getMonth();
        if (mesAnterior !== null && m !== mesAnterior) {
          separador = `<tr class="flx-sep"><td colspan="9">${MESES[m]}</td></tr>`;
        }
        mesAnterior = m;
      }
      // Define a ação conforme o pos:
      //  8 = despesa projetada → REALIZAR (vira pos 2)
      //  2 = despesa real → PAGAR
      //  5,1 = título a receber → RECEBER
      //  7 = compra projetada → só vira real na Entrada de NF (não clica aqui)
      let acao = '';
      if (l.pos === 8) acao = 'realizar';
      else if (l.pos === 2) acao = 'pagar';
      else if (l.pos === 5 || l.pos === 1) acao = 'receber';
      const isoData = l.vencimento ? new Date(l.vencimento).toISOString().slice(0,10) : '';
      const clicavel = acao ? 'flx-pagavel' : '';
      return separador + `
      <tr class="cor-${l.cor} ${clicavel} pos-${l.pos}" data-v="${Math.round(((Number(l.aReceber) || 0) + (Number(l.aPagar) || 0)) * 100)}" data-acao="${acao}" data-data="${isoData}" data-conta="${escAttr(l.codigoConta)}" data-hist="${escAttr(l.historico)}">
        <td class="c-item">${l.item}</td>
        <td class="c-chave">${l.chave}</td>
        <td class="c-hist">${Number(l.pos) === 7 && !/^\s*previs/i.test(l.historico || '') ? '<span class="tag-prev">previsão</span> ' : ''}${l.historico}</td>
        <td class="c-conta">${l.codigoConta}</td>
        <td class="c-pos"><span class="c-pos-badge">${l.pos}</span></td>
        <td class="c-vect">${fmtData(l.vencimento)}</td>
        <td class="c-receber">${l.aReceber ? '<span class="val-receber">'+fmt(l.aReceber)+'</span>' : ''}</td>
        <td class="c-pagar">${l.aPagar ? '<span class="val-pagar">'+fmt(l.aPagar)+'</span>' : ''}</td>
        <td class="c-saldo">${porData ? `<span class="${l.saldo>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(l.saldo)}</span>` : '<span></span>'}</td>
      </tr>`;
    }).join('');

    // 19/10/2026: clique na bolinha do pos -> todos os registros daquele pos (nao abre a acao da linha)
    $$('#flx-body .c-pos-badge').forEach(b => {
      b.title = 'ver todos os registros deste pos no período';
      b.addEventListener('click', ev => { ev.stopPropagation(); abrirPos(b.textContent.trim()); });
    });

    // Clique na linha → ação conforme o pos
    $$('#flx-body tr.flx-pagavel').forEach(tr => {
      tr.addEventListener('click', () => {
        const acao = tr.dataset.acao;
        const dataLinha = tr.dataset.data;
        console.log('🖱️ clique linha → acao:', acao, '| data:', dataLinha);
        if (!dataLinha) { console.warn('sem data na linha'); return; }
        if (acao === 'realizar') abrirRealizacao(dataLinha);
        else if (acao === 'pagar') abrirPagamento(dataLinha, 'pagar');
        else if (acao === 'receber') abrirPagamento(dataLinha, 'receber', { conta: tr.dataset.conta, historico: tr.dataset.hist });
        else console.warn('acao não reconhecida:', acao);
      });
    });
    console.log('🔗 linhas clicáveis:', $$('#flx-body tr.flx-pagavel').length);
  }
  $$('.flx-grid thead th[data-ord]').forEach(th => {
    th.style.cursor = 'pointer'; th.title = 'ordenar (clique de novo inverte; 3º clique volta à ordem por vencimento)';
    th.addEventListener('click', () => {
      const k = th.dataset.ord;
      if (gradeOrdem.k !== k) gradeOrdem = { k, asc: k !== 'receber' && k !== 'pagar' };
      else if (gradeOrdem.asc === (k !== 'receber' && k !== 'pagar')) gradeOrdem.asc = !gradeOrdem.asc;
      else gradeOrdem = { k: null, asc: true };
      if (!ultimasLinhas.length) return;
      montarGrade(); aplicarFiltroPos();
    });
  });

  /* ===== Grid ===== */
  async function carregar() {
    const tbody = $('#flx-body');
    tbody.innerHTML = '<tr><td colspan="9" class="flx-empty">Carregando...</td></tr>';
    try {
      const oc = [...ocultos].join(',');                 // 18/10/2026: o que o sub-menu escondeu
      const q = '/' + state.ano + '?' + (state.mes ? `mes=${state.mes}&` : '') + (oc ? `ocultar=${oc}` : '');
      const data = await api(q);
      ultimasLinhas = data.linhas || [];                   // 19/10/2026: para a janela do pos
      ultimoResumo = data.resumo || null;                  // 20/10/2026: saldo anterior para o Sintetizar

      if (!data.linhas || data.linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="flx-empty">Nenhum lançamento no período. Lance projeções no Orçamento para vê-las aqui.</td></tr>';
        $('#flx-resumo').innerHTML = '';
        return;
      }

      montarGrade();                                       // 23/10/2026: na ordem escolhida no cabecalho

      const r = data.resumo;
      $('#flx-resumo').innerHTML = `
        <div class="flx-resumo-item"><span class="lbl">A receber</span><span class="val val-receber">${fmt(r.totalReceber)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">A pagar</span><span class="val val-pagar">${fmt(r.totalPagar)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Saldo do período</span><span class="val ${r.saldoFinal>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(r.saldoFinal)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Lançamentos</span><span class="val">${r.quantidade}</span></div>
      `;
      resumoNormal = $('#flx-resumo').innerHTML;
      aplicarFiltroPos();                                   // 20/10/2026: "Sintetizar" escolheu um pos
      if (sint && !sint.hidden) desenharSintese();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="flx-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  /* ===== PAGAMENTO EM LOTE ===== */
  const PAG_API = '/financeiro/api/pagamento';
  const pag = { tipo: 'pagar', data: '', titulos: [], marcados: new Set(), historicos: {}, debHist: null,
                cartao: null,        // { conta, historico } quando a lista e de cartao
                cartaoInfo: null,    // { codigo, nome, contaTaxa:{codigo,nome} } vindo da API
                cartoes: null,       // lista para a antecipacao
                liqOk: false,        // Enter no valor liquido ja confirmou o valor
                forma: 'BANCO',      // 23/10/2026: BANCO | CAIXA | CARTAO (recebimento de cliente)
                formaAtiva: false,   // os botoes Banco · Caixa · Cartão estao valendo
                contaClicada: '',    // a conta do titulo clicado (o cliente)
                caixa: null };       // { codigo, nome } do caixa
  const PREFIXO_CARTAO = '1.01.005.';
  const BANCO_CARTAO = '1.01.002.003';   // CEF/Armacao: o cartao deposita sempre aqui (contrato)
  const ehDebito = h => /d[ée]bito\s*$/i.test(String(h || ''));
  const BANCO_TITULO = '1.01.002.002';   // Banestes/Armacao: cobranca dos titulos de venda
  const ehTitulo = h => /·\s*t[íi]tulo\s*$/i.test(String(h || ''));

  /* ---- data do movimento ----
     Nasce hoje; sabado/domingo vira a sexta. Nao pode passar de hoje, nem cair
     em fim de semana, nem voltar mais de 5 dias uteis. O servidor confere igual. */
  const isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fimDeSemana = d => d.getDay() === 0 || d.getDay() === 6;
  function dataMovimentoPadrao() {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    while (fimDeSemana(d)) d.setDate(d.getDate() - 1);
    return isoLocal(d);
  }
  function limiteRetroativo() {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let uteis = 0;
    while (uteis < 5) { d.setDate(d.getDate() - 1); if (!fimDeSemana(d)) uteis++; }
    return isoLocal(d);
  }
  function erroDataMovimento(txt) {
    if (!txt) return 'Informe a data do movimento.';
    const d = new Date(txt + 'T12:00:00');
    if (isNaN(d)) return 'Data do movimento inválida.';
    if (txt > isoLocal(new Date())) return 'A data do movimento não pode ser depois de hoje.';
    if (fimDeSemana(d)) return 'A data do movimento não pode ser sábado nem domingo.';
    if (txt < limiteRetroativo()) return 'A data do movimento pode voltar no máximo 5 dias úteis.';
    return '';
  }

  async function pagApi(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(PAG_API + path, opts);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `Erro ${res.status}`);
    return d;
  }

  async function carregarBancos() {
    try {
      const bancos = await pagApi('GET', '/bancos');
      pag.bancos = bancos;
      // Ordena pelo código contábil do subtítulo (1.01.002.001, 002, 003...).
      // Contas sem vínculo (subCodigo vazio) vão pro fim, claramente sinalizadas.
      bancos.sort((a, b) => {
        const ca = a.subCodigo || 'zzz';
        const cb = b.subCodigo || 'zzz';
        return ca.localeCompare(cb);
      });
      // Formato: "1.01.002.001 - Banestes/Armação"  (código primeiro, alinha em coluna)
      // Sem vínculo: "(sem vínculo) Apelido"
      $('#pag-banco').innerHTML = '<option value="">Selecione...</option>' +
        bancos.map(b => {
          const label = b.subCodigo
            ? `${b.subCodigo} - ${b.subNome || b.apelido}`
            : `(sem vínculo) ${b.apelido}`;
          return `<option value="${b._id}" data-recebe="${b.recebeVenda ? '1' : ''}">${label}</option>`;
        }).join('');
    } catch (err) { console.warn('bancos:', err.message); }
  }

  async function abrirPagamento(data, tipo, cartao) {
    pag.tipo = tipo; pag.data = data; pag.marcados = new Set(); pag.historicos = {};
    const ehRec = tipo === 'receber';
    pag.cartao = ehRec && cartao && String(cartao.conta || '').startsWith(PREFIXO_CARTAO) ? cartao : null;
    pag.cartaoInfo = null;
    $('#pag-titulo').textContent = pag.cartao ? '💳 Recebimento de cartão' : (ehRec ? '💵 Recebimento em lote' : '💰 Pagamento em lote');
    $('#pag-header').className = 'pag-modal-header' + (ehRec ? ' receber' : '');
    $('#pag-confirmar').textContent = ehRec ? '💵 Receber selecionados' : '💰 Pagar selecionados';
    // data do movimento: hoje (ou a sexta); no cartao vem vazia para escolher
    $('#pag-data').value = pag.cartao ? '' : dataMovimentoPadrao();
    $('#pag-data').max = isoLocal(new Date());
    $('#pag-data').min = limiteRetroativo();
    $('#pag-data-dica').textContent = 'data: hoje ou até 5 dias úteis atrás, sem sábado/domingo';
    $('#pag-extra').hidden = !ehRec;
    $('#pag-antecipar').hidden = !!(pag.cartao && ehDebito(pag.cartao.historico));   // debito nao antecipa
    $('#pag-cartao-sel').hidden = true;
    $('#pag-liquido').value = '';
    pag.liqOk = false;
    await carregarBancos();
    if (pag.cartao) modoCartao(true);
    else if (ehRec && cartao && ehTitulo(cartao.historico)) travarBanco(BANCO_TITULO);
    else modoCartao(false);
    $('#pag-todos-cartao').hidden = true;
    // 23/10/2026: Banco · Caixa · Cartão so no recebimento de titulo de cliente
    pag.contaClicada = ehRec && cartao ? String(cartao.conta || '') : '';
    pag.formaAtiva = ehRec && !pag.cartao && !(cartao && ehTitulo(cartao.historico));
    $('#pag-forma').hidden = !pag.formaAtiva;
    $('#pag-cc-bandeira').value = '';
    $('#pag-cc-parcelas').value = '1';
    const credito = document.querySelector('input[name="pag-cc-modo"][value="CREDITO"]');
    if (credito) credito.checked = true;
    await aplicarForma('BANCO');
    if (pag.cartao) await carregarCartao(pag.cartao.conta, pag.cartao.historico, data, 'clicado');
    else await carregarJanela();
    $('#pag-modal .pag-modal-content').style.transform = '';   // 23/10/2026: abre no centro
    $('#pag-modal').hidden = false;
  }

  /* ===== 23/10/2026: FORMA DO RECEBIMENTO (Banco · Caixa · Cartão) ===== */
  const DIA_MS = 86400000;
  // com Cartão, so os titulos do cliente clicado (uma transacao de cartao e de uma pessoa)
  function titulosVisiveis() {
    return pag.forma === 'CARTAO' && pag.contaClicada
      ? pag.titulos.filter(t => (t.codigoConta || '') === pag.contaClicada) : pag.titulos;
  }
  function textoConfirmar() {
    if (pag.tipo !== 'receber') return '💰 Pagar selecionados';
    return pag.forma === 'CARTAO' ? '💳 Lançar no cartão' : '💵 Receber selecionados';
  }
  async function aplicarForma(f) {
    pag.forma = pag.formaAtiva ? f : 'BANCO';
    $$('#pag-forma [data-forma]').forEach(b => b.classList.toggle('ativo', b.dataset.forma === pag.forma));
    $('#pag-campo-banco').hidden = pag.forma !== 'BANCO';
    $('#pag-campo-caixa').hidden = pag.forma !== 'CAIXA';
    $('#pag-cartao').hidden = pag.forma !== 'CARTAO';
    $('#pag-confirmar').textContent = textoConfirmar();
    if (!pag.formaAtiva) { $$('#pag-banco option').forEach(o => { o.hidden = false; }); return; }
    $('#pag-antecipar').hidden = true;                    // recebimento de cliente: sem antecipacao de cartao
    // banco: so os que recebem venda (BB, Banestes, CEF)
    const sel = $('#pag-banco');
    $$('#pag-banco option').forEach(o => { if (o.value) o.hidden = o.dataset.recebe !== '1'; });
    if (sel.selectedOptions[0] && sel.selectedOptions[0].hidden) sel.value = '';
    if (pag.forma === 'CAIXA') await carregarCaixa();
    if (pag.forma === 'CARTAO') {
      await carregarBandeiras();
      const vis = new Set(titulosVisiveis().map(t => t._id));
      pag.marcados = new Set([...pag.marcados].filter(id => vis.has(id)));
    }
  }
  async function carregarCaixa() {
    try {
      if (!pag.caixa) pag.caixa = await pagApi('GET', '/caixa');
      $('#pag-caixa-nome').textContent = pag.caixa.codigo + ' - ' + pag.caixa.nome;
    } catch (err) { $('#pag-caixa-nome').textContent = 'Erro: ' + err.message; }
  }
  async function carregarBandeiras() {
    const sel = $('#pag-cc-bandeira');
    try {
      if (!pag.cartoes) pag.cartoes = await pagApi('GET', '/cartoes');
      if (sel.options.length <= 1) {
        sel.innerHTML = '<option value="">escolha o cartão…</option>'
          + pag.cartoes.map(c => `<option value="${escAttr(c.codigo)}">${escAttr(c.codigo)} - ${escAttr(c.nome)}</option>`).join('');
      }
    } catch (err) { alert('Erro ao ler os cartões: ' + err.message); }
  }
  function lerCartao() {
    const r = document.querySelector('input[name="pag-cc-modo"]:checked');
    const modo = r ? r.value : 'CREDITO';
    return { conta: $('#pag-cc-bandeira').value, modo,
             parcelas: modo === 'DEBITO' ? 1 : (parseInt($('#pag-cc-parcelas').value, 10) || 1) };
  }
  // previa: as mesmas contas do servidor (debito: dia seguinte; credito: de 30 em 30 dias; sobra na 1a)
  function desenharPreviaCartao() {
    if (pag.forma !== 'CARTAO') return;
    const cc = lerCartao();
    $('#pag-cc-parcelas').disabled = cc.modo === 'DEBITO';
    const prev = $('#pag-cc-previa');
    const total = Math.round(titulosVisiveis().filter(t => pag.marcados.has(t._id)).reduce((s, t) => s + t.valor, 0) * 100);
    const dtxt = $('#pag-data').value;
    if (!total) { prev.textContent = 'Marque o título do cliente.'; return; }
    if (!dtxt || erroDataMovimento(dtxt)) { prev.textContent = 'Escolha a data do movimento.'; return; }
    const base = new Date(dtxt + 'T12:00:00');
    const n = cc.parcelas, b0 = Math.floor(total / n);
    const linhas = Array.from({ length: n }, (_, i) => {
      const v = b0 + (i === 0 ? total - b0 * n : 0);
      const d = new Date(base.getTime() + (cc.modo === 'DEBITO' ? 1 : (i + 1) * 30) * DIA_MS);
      return '<tr><td>' + (i + 1) + '/' + n + '</td><td>' + fmtData(d) + '</td><td class="v">' + fmt(v / 100) + '</td></tr>';
    });
    const op = cc.conta ? $('#pag-cc-bandeira').selectedOptions[0].textContent : 'o cartão (escolha a bandeira)';
    prev.innerHTML = 'O título do cliente é baixado e passa a receber de <b>' + escAttr(op) + '</b>, no CEF/Armação:'
      + '<table class="pag-cc-tab">' + linhas.join('') + '</table>';
  }
  async function confirmarCartao() {
    const marcados = titulosVisiveis().filter(t => pag.marcados.has(t._id));
    if (!marcados.length) return;
    const cc = lerCartao();
    if (!cc.conta) { alert('Escolha o cartão (bandeira).'); $('#pag-cc-bandeira').focus(); return; }
    const btn = $('#pag-confirmar');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      const r = await pagApi('POST', '/receber-cartao', {
        data: $('#pag-data').value,
        titulosIds: marcados.map(t => t._id),
        historicos: pag.historicos,
        cartao: cc.conta, modo: cc.modo, parcelas: cc.parcelas
      });
      $('#pag-modal').hidden = true;
      carregar();
      abrirBoleta(r.boletaId);
    } catch (err) {
      alert('Erro: ' + err.message);
      if (/já foi baixada|já foram baixadas|marcadas já/.test(err.message)) { await recarregarModal(true); carregar(); }
    } finally {
      btn.disabled = false;
      btn.textContent = textoConfirmar();
      atualizarResumoPag();
    }
  }

  // cartao: banco fixo (CEF/Armacao) e travado; fora do cartao o select volta livre
  function modoCartao(liga) {
    $('#pag-banco').disabled = false;
    if (liga) travarBanco(BANCO_CARTAO);
  }
  // seleciona o banco pelo codigo da conta e trava o select
  function travarBanco(codigo) {
    const sel = $('#pag-banco');
    const b = (pag.bancos || []).find(x => x.subCodigo === codigo);
    if (b) { sel.value = b._id; sel.disabled = true; } else sel.disabled = false;
  }

  // o valor liquido so abre depois de escolhida uma data valida
  function travaLiquido() {
    const ok = !!$('#pag-data').value && !erroDataMovimento($('#pag-data').value);
    const inp = $('#pag-liquido');
    inp.disabled = !ok;
    inp.placeholder = ok ? 'Enter = igual ao total' : 'escolha antes a data do recebimento';
    if (!ok) { inp.value = ''; pag.liqOk = false; }
    return ok;
  }

  // parcelas em aberto de um cartao (todas as datas); com historico, so as da venda
  // modo: 'clicado' = so a(s) parcela(s) do dia clicado; 'venda' = todas daquela venda
  //       (mantem as ja marcadas); 'cartao' = todas do cartao, todas marcadas
  async function carregarCartao(conta, historico, dataBase, modo = 'venda') {
    pag.recarregar = () => carregarCartao(conta, historico, dataBase, modo === 'clicado' ? 'venda' : modo);
    const tbody = $('#pag-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Carregando...</td></tr>';
    try {
      const q = new URLSearchParams({ conta });
      if (historico) q.set('historico', historico);
      if (dataBase) q.set('data', dataBase);
      if (modo === 'cliente') q.set('cliente', '1');
      let d = await pagApi('GET', '/cartao?' + q.toString());
      if (historico && modo !== 'cliente' && !(d.titulos || []).length) {   // historico nao bateu: mostra o cartao inteiro
        q.delete('historico');
        d = await pagApi('GET', '/cartao?' + q.toString());
      }
      pag.cartaoInfo = d.cartao || null;
      const todos = d.titulos || [];
      const antes = pag.marcados;
      if (modo === 'clicado') {
        const doDia = todos.filter(t => t.noDia);
        pag.titulos = doDia.length ? doDia : todos;
        pag.marcados = new Set(pag.titulos.map(t => t._id));
      } else if (modo === 'cartao' || modo === 'cliente') {
        pag.titulos = todos;
        pag.marcados = new Set(todos.map(t => t._id));
      } else {
        pag.titulos = todos;
        pag.marcados = new Set(todos.filter(t => antes.has(t._id) || t.noDia).map(t => t._id));
      }
      pag.liqOk = false;
      renderJanela();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="pag-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  // botao "Antecipacao de cartao": escolhe o cartao e lista todas as parcelas dele
  async function antecipar() {
    const sel = $('#pag-cartao-sel');
    if (pag.cartao && pag.cartao.historico) {              // veio de uma parcela: as outras da venda
      $('#pag-titulo').textContent = '💳 Antecipação de cartão';
      await carregarCartao(pag.cartao.conta, pag.cartao.historico, pag.data, 'venda');
      $('#pag-todos-cartao').hidden = false;
      return;
    }
    try {
      if (!pag.cartoes) pag.cartoes = await pagApi('GET', '/cartoes');
      sel.innerHTML = '<option value="">escolha o cartão…</option>'
        + pag.cartoes.map(c => `<option value="${escAttr(c.codigo)}">${escAttr(c.codigo)} - ${escAttr(c.nome)}</option>`).join('');
      if (pag.cartao) sel.value = pag.cartao.conta;
      sel.hidden = false;
      sel.focus();
    } catch (err) { alert('Erro: ' + err.message); }
  }
  async function escolherCartaoAntecipacao() {
    const conta = $('#pag-cartao-sel').value;
    if (!conta) return;
    pag.cartao = { conta, historico: '' };
    pag.historicos = {};
    $('#pag-liquido').value = '';
    $('#pag-data').value = '';
    pag.liqOk = false;
    modoCartao(true);
    $('#pag-titulo').textContent = '💳 Antecipação de cartão';
    await carregarCartao(conta, '', '', 'venda');
    $('#pag-todos-cartao').hidden = false;
  }

  // "todos": todas as parcelas em aberto do CLIENTE da venda clicada, neste cartao,
  // de todas as vendas dele, ja marcadas (sem venda clicada: o cartao inteiro)
  async function todasDoCartao() {
    if (!pag.cartao) return;
    if (pag.cartao.historico) {
      $('#pag-titulo').textContent = '💳 Antecipação de cartão — todas do cliente';
      await carregarCartao(pag.cartao.conta, pag.cartao.historico, '', 'cliente');
    } else {
      $('#pag-titulo').textContent = '💳 Antecipação de cartão — todas as parcelas';
      await carregarCartao(pag.cartao.conta, '', '', 'cartao');
    }
  }

  async function carregarJanela() {
    pag.recarregar = () => carregarJanela();
    const tbody = $('#pag-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Carregando...</td></tr>';
    try {
      const d = await pagApi('GET', `/janela?data=${pag.data}&tipo=${pag.tipo}&dias=2`);
      pag.titulos = d.titulos || [];
      // marca por padrão os do dia
      pag.marcados = new Set(pag.titulos.filter(t => t.noDia).map(t => t._id));
      renderJanela();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="pag-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  function renderJanela() {
    const tbody = $('#pag-tbody');
    const lista = titulosVisiveis();                       // 23/10/2026: com Cartão, so o cliente clicado
    if (lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Nenhum título na janela de datas.</td></tr>';
      atualizarResumoPag();
      return;
    }
    tbody.innerHTML = lista.map(t => {
      const marc = pag.marcados.has(t._id);
      const histAtual = pag.historicos[t._id] !== undefined ? pag.historicos[t._id] : t.historico;
      return `<tr class="${marc ? 'marcado' : ''} ${t.noDia ? '' : 'fora-do-dia'}" data-id="${t._id}">
        <td class="pl-check"><input type="checkbox" ${marc ? 'checked' : ''} data-id="${t._id}"></td>
        <td class="pl-data">${fmtData(t.vencimento)}${t.noDia ? '' : ' ⚠️'}</td>
        <td class="pl-hist">
          <input type="text" class="pl-hist-input" data-id="${t._id}" data-conta="${t.codigoConta || ''}"
                 value="${(histAtual || '').replace(/"/g,'&quot;')}" list="dl-${t._id}" autocomplete="off">
          <datalist id="dl-${t._id}"></datalist>
        </td>
        <td class="pl-conta">${t.codigoConta || '-'}</td>
        <td class="pl-valor">${fmt(t.valor)}</td>
      </tr>`;
    }).join('');
    // listeners checkbox
    $$('#pag-tbody input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) pag.marcados.add(cb.dataset.id);
        else pag.marcados.delete(cb.dataset.id);
        renderJanela();
      });
    });
    // listeners histórico (guarda edição + autocomplete que aprende)
    $$('#pag-tbody .pl-hist-input').forEach(inp => {
      inp.addEventListener('input', () => {
        pag.historicos[inp.dataset.id] = inp.value;
        sugerirHistoricos(inp);
      });
      inp.addEventListener('focus', () => sugerirHistoricos(inp));
    });
    atualizarResumoPag();
  }

  function atualizarResumoPag() {
    const marcados = pag.titulos.filter(t => pag.marcados.has(t._id));
    const total = marcados.reduce((s,t) => s + t.valor, 0);
    $('#pag-resumo').textContent = `${pag.marcados.size} marcado(s) · Total: ${fmt(total) || '0,00'}`;
    atualizarLiquido(marcados, total);
    // cartao: so libera depois do Enter no valor liquido
    const precisaLiq = !$('#pag-liq').hidden;
    desenharPreviaCartao();                                // 23/10/2026
    $('#pag-confirmar').disabled = pag.marcados.size === 0 || (precisaLiq && !pag.liqOk)
      || (pag.forma === 'CARTAO' && !lerCartao().conta);
  }

  // valor liquido: so quando tudo que esta marcado e de UM cartao
  function contaUnicaDeCartao(marcados) {
    const contas = [...new Set(marcados.map(t => t.codigoConta || ''))];
    return pag.tipo === 'receber' && contas.length === 1 && contas[0].startsWith(PREFIXO_CARTAO) ? contas[0] : '';
  }
  function atualizarLiquido(marcados, total) {
    const conta = contaUnicaDeCartao(marcados);
    $('#pag-liq').hidden = !conta;
    if (!conta) { $('#pag-liquido').value = ''; return; }
    const info = $('#pag-taxa-info');
    $('#pag-total-cartao').value = fmt(total) || '0,00';
    if (!travaLiquido()) { info.textContent = 'Escolha a data do recebimento para informar o valor líquido.'; return; }
    const liq = $('#pag-liquido').value.trim() ? parseMoeda($('#pag-liquido').value) : total;
    const taxaC = Math.round(total * 100) - Math.round(liq * 100);
    const despesa = pag.cartaoInfo && pag.cartaoInfo.codigo === conta && pag.cartaoInfo.contaTaxa
      ? pag.cartaoInfo.contaTaxa.codigo + ' ' + pag.cartaoInfo.contaTaxa.nome : 'a despesa ligada ao cartão';
    if (taxaC < 0) { info.innerHTML = '<b>O líquido não pode passar do total (' + fmt(total) + ').</b>'; return; }
    if (taxaC === 0) { info.innerHTML = 'Sem taxa: entra ' + (fmt(total) || '0,00') + ' no banco.'; return; }
    const pct = (taxaC / Math.round(total * 100) * 100).toFixed(2).replace('.', ',');
    info.innerHTML = 'No banco entra <strong>' + fmt(liq) + '</strong>. Taxa do cartão: <b>'
      + fmt(taxaC / 100) + ' (' + pct + '%)</b><br>lançada em ' + despesa + '.';
  }

  // Autocomplete que aprende: busca históricos da conta/termo e preenche o datalist
  function sugerirHistoricos(input) {
    clearTimeout(pag.debHist);
    pag.debHist = setTimeout(async () => {
      const conta = input.dataset.conta || '';
      const termo = input.value || '';
      try {
        const params = new URLSearchParams({ conta, termo });
        const sugestoes = await pagApi('GET', '/historicos?' + params.toString());
        const dl = document.getElementById('dl-' + input.dataset.id);
        if (dl) dl.innerHTML = sugestoes.map(s => `<option value="${s.replace(/"/g,'&quot;')}">`).join('');
      } catch (_) {}
    }, 250);
  }

  async function confirmarPagamento() {
    if (pag.marcados.size === 0) return;
    const erroData = erroDataMovimento($('#pag-data').value);
    if (erroData) { alert(erroData); $('#pag-data').focus(); return; }
    if (pag.forma === 'CARTAO') return confirmarCartao();      // 23/10/2026
    const noCaixa = pag.forma === 'CAIXA';
    const bancoId = noCaixa ? '' : $('#pag-banco').value;
    if (!noCaixa && !bancoId) { alert('Selecione o banco.'); return; }
    const marcados = pag.titulos.filter(t => pag.marcados.has(t._id));
    let valorLiquido;
    if (contaUnicaDeCartao(marcados) && $('#pag-liquido').value.trim()) {
      valorLiquido = parseMoeda($('#pag-liquido').value);
      const total = marcados.reduce((s, t) => s + t.valor, 0);
      if (valorLiquido <= 0 || Math.round(valorLiquido * 100) > Math.round(total * 100)) {
        alert('O valor líquido deve ser maior que zero e no máximo ' + fmt(total) + '.'); return;
      }
    }
    const btn = $('#pag-confirmar');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      const r = await pagApi('POST', '/quitar', {
        tipo: pag.tipo,
        data: $('#pag-data').value,
        forma: noCaixa ? 'CAIXA' : 'BANCO',
        contaBancariaId: bancoId,
        titulosIds: Array.from(pag.marcados),
        historicos: pag.historicos,
        valorLiquido
      });
      $('#pag-modal').hidden = true;
      carregar(); // recarrega o fluxo (títulos pagos somem)
      // abre a boleta gerada
      abrirBoleta(r.boletaId);
    } catch (err) {
      alert('Erro: ' + err.message);
      if (/já foi baixada|já foram baixadas|marcadas já/.test(err.message)) {   // outro usuario baixou antes
        await recarregarModal(true);
        carregar();
      }
    } finally {
      btn.disabled = false;
      btn.textContent = textoConfirmar();
    }
  }

  /* ===== VARIOS USUARIOS: acompanha as baixas dos outros ===== */
  // Recarrega a lista do modal aberto mantendo as marcas; avisa o que sumiu.
  async function recarregarModal(avisar) {
    if ($('#pag-modal').hidden || !pag.recarregar) return;
    const antes = new Map(pag.titulos.map(t => [String(t._id), t]));
    const marcadas = new Set([...pag.marcados].map(String));
    await pag.recarregar();
    const agora = new Set(pag.titulos.map(t => String(t._id)));
    const sumiram = [...antes.keys()].filter(id => !agora.has(id));
    pag.marcados = new Set(pag.titulos.filter(t => marcadas.has(String(t._id))).map(t => t._id));
    pag.liqOk = false;
    renderJanela();
    if (sumiram.length && (avisar || [...marcadas].some(id => sumiram.includes(id)))) {
      alert(sumiram.length + ' parcela(s) foram baixadas por outro usuário e saíram da lista:\n'
        + sumiram.map(id => '• ' + (antes.get(id).historico || '') + ' — ' + fmt(antes.get(id).valor)).join('\n'));
    }
  }

  let versaoFluxo = null, conferindo = false;
  async function conferirVersao() {
    if (conferindo || document.hidden) return;
    conferindo = true;
    try {
      const d = await pagApi('GET', '/versao');
      if (versaoFluxo !== null && d.versao !== versaoFluxo) {
        await carregar();                 // a grade do fluxo
        await recarregarModal(false);     // e o modal, se estiver aberto
      }
      versaoFluxo = d.versao;
    } catch (_) { /* sem rede: tenta na proxima */ }
    conferindo = false;
  }
  setInterval(conferirVersao, 15000);
  // 18/10/2026: o sub-menu (fluxo-submenu.js) pede para recarregar depois de pagar
  window.FluxoCaixa = {
    recarregar: () => { conferirVersao(); },
    // 18/10/2026: mostrar / esconder orcamento (8), compras projetadas (3) e pedidos (7)
    mostrando: () => true,                          // 19/10/2026: tudo aparece sempre
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) conferirVersao(); });
  window.addEventListener('focus', conferirVersao);
  conferirVersao();

  /* ===== REALIZAÇÃO DE DESPESA (pos 8 → pos 2) ===== */
  const REAL_API = '/financeiro/api/realizacao';
  const real = { data: '', titulos: [], marcados: new Set(), edits: {} };

  async function realApi(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(REAL_API + path, opts);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `Erro ${res.status}`);
    return d;
  }

  async function abrirRealizacao(data) {
    real.data = data; real.marcados = new Set(); real.edits = {};
    const tbody = $('#real-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Carregando...</td></tr>';
    $('#real-modal').hidden = false;
    try {
      const d = await realApi('GET', `/janela?data=${data}&dias=2`);
      real.titulos = d.titulos || [];
      real.marcados = new Set(real.titulos.filter(t => t.noDia).map(t => t._id));
      renderRealizacao();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="pag-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  function renderRealizacao() {
    const tbody = $('#real-tbody');
    if (real.titulos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Nenhuma despesa projetada (pos 8) na janela.</td></tr>';
      atualizarResumoReal();
      return;
    }
    tbody.innerHTML = real.titulos.map(t => {
      const marc = real.marcados.has(t._id);
      const e = real.edits[t._id] || {};
      const hist = e.historico !== undefined ? e.historico : t.historico;
      const val = e.valor !== undefined ? e.valor : fmt(t.valor);
      const doc = e.documento !== undefined ? e.documento : '';
      const venc = t.vencimento ? new Date(t.vencimento).toISOString().slice(0,10) : '';
      return `<tr class="${marc ? 'marcado' : ''} ${t.noDia ? '' : 'fora-do-dia'}">
        <td class="pl-check"><input type="checkbox" ${marc ? 'checked' : ''} data-id="${t._id}"></td>
        <td class="pl-data">${fmtData(t.vencimento)}${t.noDia ? '' : ' ⚠️'}
          <input type="hidden" data-venc="${t._id}" value="${venc}"></td>
        <td class="pl-hist"><input type="text" class="pl-edit" data-hist="${t._id}" value="${(hist||'').replace(/"/g,'&quot;')}"></td>
        <td><input type="text" class="pl-edit" data-doc="${t._id}" value="${(doc||'').replace(/"/g,'&quot;')}" placeholder="NF/doc"></td>
        <td class="pl-valor"><input type="text" class="pl-edit valor" data-valor="${t._id}" value="${val}"></td>
      </tr>`;
    }).join('');
    // checkboxes
    $$('#real-tbody input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) real.marcados.add(cb.dataset.id); else real.marcados.delete(cb.dataset.id);
        renderRealizacao();
      });
    });
    // edições (histórico, documento, valor)
    $$('#real-tbody .pl-edit').forEach(inp => {
      inp.addEventListener('input', () => {
        const id = inp.dataset.hist || inp.dataset.doc || inp.dataset.valor;
        if (!real.edits[id]) real.edits[id] = {};
        if (inp.dataset.hist !== undefined && inp.dataset.hist) real.edits[id].historico = inp.value;
        if (inp.dataset.doc !== undefined && inp.dataset.doc) real.edits[id].documento = inp.value;
        if (inp.dataset.valor !== undefined && inp.dataset.valor) {
          inp.value = mascaraMoeda(inp.value);
          real.edits[id].valor = inp.value;
        }
      });
    });
    atualizarResumoReal();
  }

  function atualizarResumoReal() {
    $('#real-resumo').textContent = `${real.marcados.size} marcada(s)`;
    $('#real-confirmar').disabled = real.marcados.size === 0;
  }

  // máscara de moeda (compartilhada)
  function mascaraMoeda(str) {
    let dig = String(str).replace(/\D/g, '');
    if (!dig) return '';
    dig = dig.replace(/^0+/, '') || '0';
    while (dig.length < 3) dig = '0' + dig;
    const c = dig.slice(-2);
    let i = dig.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return i + ',' + c;
  }
  function parseMoeda(s) {
    if (!s) return 0;
    return Number(String(s).replace(/\./g,'').replace(',','.')) || 0;
  }

  async function confirmarRealizacao() {
    if (real.marcados.size === 0) return;
    const btn = $('#real-confirmar');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      const itens = Array.from(real.marcados).map(id => {
        const e = real.edits[id] || {};
        const venc = $(`#real-tbody input[data-venc="${id}"]`)?.value || '';
        return {
          id,
          valor: e.valor !== undefined ? parseMoeda(e.valor) : undefined,
          documento: e.documento || '',
          vencimento: venc,
          historico: e.historico
        };
      });
      const r = await realApi('POST', '/realizar', { itens });
      $('#real-modal').hidden = true;
      carregar();
      alert(`${r.realizadas} despesa(s) realizada(s)! Agora aparecem como pos 2 (a pagar).`);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = '✅ Realizar selecionadas';
    }
  }

  /* ===== BOLETA ===== */
  let boletaAtual = null;
  async function abrirBoleta(id) {
    try {
      const b = await pagApi('GET', '/boleta/' + id);
      boletaAtual = b;
      const ehRec = b.tipo === 'RECEBIMENTO';
      $('#bol-titulo').textContent = `Boleta ${b.codigo} — ${b.tipo}`;

      // lado do banco: o banco + as contrapartidas invertidas (valor negativo, ex.: taxa do cartao)
      // outro lado: as contrapartidas normais. Os dois totais tem que bater.
      const linha = (cod, nome, hist, v) => `
        <tr>
          <td class="bol-cod">${cod || '-'}</td>
          <td>${nome || '-'}</td>
          <td>${hist || ''}</td>
          <td class="v">${fmt(v)}</td>
        </tr>`;
      const invertidas = (b.contrapartidas || []).filter(c => (c.valor || 0) < 0);
      const normais    = (b.contrapartidas || []).filter(c => (c.valor || 0) >= 0);
      const totBanco = (b.valorTotal || 0) + invertidas.reduce((t, c) => t - c.valor, 0);
      const totOutro = normais.reduce((t, c) => t + (c.valor || 0), 0);
      const cab = '<thead><tr><th>Nº Conta</th><th>Nome da Conta</th><th>Histórico</th><th class="v">Valor</th></tr></thead>';

      $('#bol-body').innerHTML = `
        <div class="bol-secao credito">
          <h3>${ehRec ? 'Débito (entrada no banco)' : 'Crédito (saída do banco)'}</h3>
          <table class="bol-tabela">${cab}<tbody>
            ${linha(b.bancoCodigo, b.bancoNome, b.historico, b.valorTotal)}
            ${invertidas.map(c => linha(c.codigoConta, c.nomeConta, c.historico, -c.valor)).join('')}
          </tbody></table>
          ${invertidas.length ? `<div class="bol-total">Total: ${fmt(totBanco)}</div>` : ''}
        </div>
        <div class="bol-secao debito">
          <h3>${ehRec ? 'Crédito (receitas)' : 'Débito (contrapartidas)'}</h3>
          <table class="bol-tabela">${cab}
            <tbody>${normais.map(c => linha(c.codigoConta, c.nomeConta, c.historico, c.valor)).join('')}</tbody>
          </table>
          <div class="bol-total">Total: ${fmt(totOutro)}</div>
        </div>`;
      $('#bol-estornar').style.display = (b.status === 'CANCELADO') ? 'none' : '';
      $('#bol-modal').hidden = false;
    } catch (err) {
      alert('Erro ao abrir boleta: ' + err.message);
    }
  }

  async function estornarBoleta() {
    if (!boletaAtual) return;
    if (!confirm('Estornar esta boleta? Os títulos voltam ao Fluxo.')) return;
    try {
      await pagApi('POST', `/boleta/${boletaAtual._id}/estornar`);
      $('#bol-modal').hidden = true;
      carregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  /* ===== Listeners dos modais ===== */
  $('#pag-close').addEventListener('click', () => $('#pag-modal').hidden = true);
  // 23/10/2026 (Jorge): ARRASTAR o modal pelo titulo (o botao × continua so fechando)
  (function arrastarModalPag() {
    const cab = $('#pag-header'), caixa = $('#pag-modal .pag-modal-content');
    cab.addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      const m0 = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(caixa.style.transform || '');
      const x0 = m0 ? Number(m0[1]) : 0, y0 = m0 ? Number(m0[2]) : 0;
      const sx = ev.clientX, sy = ev.clientY;
      const mover = e => { caixa.style.transform = 'translate(' + (x0 + e.clientX - sx) + 'px, ' + (y0 + e.clientY - sy) + 'px)'; };
      const soltar = () => { document.removeEventListener('mousemove', mover); document.removeEventListener('mouseup', soltar); };
      document.addEventListener('mousemove', mover); document.addEventListener('mouseup', soltar);
    });
  })();
  $('#pag-cancelar').addEventListener('click', () => $('#pag-modal').hidden = true);
  $('#pag-confirmar').addEventListener('click', confirmarPagamento);
  $('#pag-antecipar').addEventListener('click', antecipar);
  $('#pag-todos-cartao').addEventListener('click', todasDoCartao);
  $('#pag-cartao-sel').addEventListener('change', escolherCartaoAntecipacao);
  // 23/10/2026: Banco · Caixa · Cartão
  $$('#pag-forma [data-forma]').forEach(b => b.addEventListener('click', async () => {
    await aplicarForma(b.dataset.forma);
    renderJanela();
  }));
  $('#pag-cc-bandeira').addEventListener('change', atualizarResumoPag);
  $$('input[name="pag-cc-modo"]').forEach(r => r.addEventListener('change', atualizarResumoPag));
  $('#pag-cc-parcelas').addEventListener('change', atualizarResumoPag);
  function dataEscolhida() {
    pag.liqOk = false;
    atualizarResumoPag();
    const inp = $('#pag-liquido');
    if (!$('#pag-liq').hidden && !inp.disabled) inp.focus();
  }
  $('#pag-data').addEventListener('change', dataEscolhida);
  $('#pag-data').addEventListener('input', () => { if ($('#pag-data').value) dataEscolhida(); });
  $('#pag-liquido').addEventListener('input', (e) => {
    e.target.value = mascaraMoeda(e.target.value);
    pag.liqOk = false;
    atualizarResumoPag();
  });
  $('#pag-liquido').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const marcados = pag.titulos.filter(t => pag.marcados.has(t._id));
    const total = marcados.reduce((s, t) => s + t.valor, 0);
    const v = e.target.value.trim() ? parseMoeda(e.target.value) : total;   // vazio = sem taxa
    if (v <= 0 || Math.round(v * 100) > Math.round(total * 100)) {
      $('#pag-taxa-info').innerHTML = '<b>O líquido deve ser maior que zero e no máximo ' + fmt(total) + '.</b>';
      return;
    }
    if (!e.target.value.trim()) e.target.value = mascaraMoeda(Math.round(total * 100));
    pag.liqOk = true;
    atualizarResumoPag();
    $('#pag-confirmar').focus();
  });
  // marcar/desmarcar parcela muda o total: o liquido precisa ser confirmado de novo
  $('#pag-tbody').addEventListener('change', (e) => { if (e.target.type === 'checkbox') pag.liqOk = false; }, true);
  $('#pag-todos').addEventListener('change', () => { pag.liqOk = false; }, true);
  $('#pag-todos').addEventListener('change', (e) => {
    if (e.target.checked) titulosVisiveis().forEach(t => pag.marcados.add(t._id));
    else pag.marcados.clear();
    renderJanela();
  });
  $('#bol-close').addEventListener('click', () => $('#bol-modal').hidden = true);
  $('#bol-fechar').addEventListener('click', () => $('#bol-modal').hidden = true);
  $('#bol-estornar').addEventListener('click', estornarBoleta);

  // Realização
  $('#real-close').addEventListener('click', () => $('#real-modal').hidden = true);
  $('#real-cancelar').addEventListener('click', () => $('#real-modal').hidden = true);
  $('#real-confirmar').addEventListener('click', confirmarRealizacao);
  $('#real-todos').addEventListener('change', (e) => {
    if (e.target.checked) real.titulos.forEach(t => real.marcados.add(t._id));
    else real.marcados.clear();
    renderRealizacao();
  });

  /* ===== Listeners ===== */
  $('#flx-ano').addEventListener('change', (e) => { state.ano = parseInt(e.target.value, 10); carregar(); });

  /* ===== Init ===== */
  /* ===== 20/10/2026 (Jorge): "● Sintetizar" na legenda =====
     Janela pequena com o TOTAL de cada pos no periodo da grade (0 avulso, 2 a pagar, 5 a receber, 3 pedidos,
     7 previsao de compras, 8 orcamento) e o total do mes. Clicou num item: a grade mostra SO aquele pos.
     "todos" (ou clicar num mes) volta ao normal. Usa as linhas que a grade ja carregou. */
  let filtroPos = null, sint = null, ultimoResumo = null, resumoNormal = '';
  const SINT = [[0, 'avulso'], [2, 'contas a pagar'], [5, 'contas a receber'], [1, 'cartões a receber'], [3, 'pedidos'], [7, 'previsão compras'], [8, 'orçamento']];
  (function estiloSint() {
    const st = document.createElement('style');
    st.textContent = `
    .flx-leg.sint-leg { color:#0284c7; font-weight:800; cursor:pointer; } .flx-leg.sint-leg:hover { text-decoration:underline; }
    .sint-cx { position:fixed; z-index:62; width:300px; background:#fff; border:1px solid #0284c7; border-radius:10px;
               box-shadow:0 12px 30px rgba(0,0,0,.2); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:13px; }
    .sint-cx[hidden] { display:none; }
    .sint-cab { display:flex; align-items:center; padding:7px 10px; background:#0284c7; color:#fff; border-radius:10px 10px 0 0; font-weight:800; cursor:move; user-select:none; }
    .sint-cab span { flex:1; } .sint-cab button { border:0; background:none; color:#fff; font-size:18px; cursor:pointer; }
    .sint-it { display:flex; gap:8px; align-items:baseline; width:100%; border:0; border-bottom:1px solid #f1f5f9; background:#fff; padding:6px 10px; cursor:pointer; font-size:13px; text-align:left; }
    .sint-it:hover { background:#f0f9ff; } .sint-it.on { background:#e0f2fe; font-weight:800; }
    .sint-it b { width:18px; color:#6d28d9; } .sint-it span { flex:1; } .sint-it em { font-style:normal; font-variant-numeric:tabular-nums; }
    .sint-it .neg { color:#b91c1c; } .sint-it .pos { color:#059669; }
    .sint-tot { display:flex; padding:8px 10px; font-weight:800; border-top:2px solid #cbd5e1; } .sint-tot span { flex:1; }
    .sint-aviso { margin:0 0 6px; padding:5px 10px; background:#e0f2fe; color:#075985; border-radius:8px; font-size:.8rem; font-weight:700; display:inline-block; }`;
    document.head.appendChild(st);
  })();
  function aplicarFiltroPos() {
    // 20/10/2026 (Jorge): com um pos escolhido, o SALDO e o rodape sao SO daquele pos (soma e saldo dos avulsos...)
    let corre = 0, rec = 0, pag = 0, n = 0;
    $$('#flx-body tr').forEach(tr => {
      if (tr.classList.contains('flx-sep')) { tr.hidden = filtroPos !== null; return; }
      const vis = filtroPos === null || tr.classList.contains('pos-' + filtroPos);
      tr.hidden = !vis;
      const cel = tr.querySelector('td.c-saldo span'); if (!cel) return;
      if (cel.dataset.orig === undefined) { cel.dataset.orig = cel.textContent; cel.dataset.cls = cel.className; }
      if (filtroPos === null) { cel.textContent = cel.dataset.orig; cel.className = cel.dataset.cls; return; }
      if (!vis) return;
      if (gradeOrdem.k) { const v0 = Number(tr.dataset.v) || 0; n++; if (v0 > 0) rec += v0; else pag += v0; corre += v0; return; }   // 23/10: fora da ordem por data, sem saldo
      const v = Number(tr.dataset.v) || 0; corre += v; n++; if (v > 0) rec += v; else pag += v;
      cel.textContent = fmt(corre / 100) || '0,00'; cel.className = corre >= 0 ? 'val-saldo-pos' : 'val-saldo-neg';
    });
    const res = $('#flx-resumo');
    if (res) res.innerHTML = filtroPos === null ? resumoNormal : `
        <div class="flx-resumo-item"><span class="lbl">A receber (pos ${filtroPos})</span><span class="val val-receber">${fmt(rec / 100) || '0,00'}</span></div>
        <div class="flx-resumo-item"><span class="lbl">A pagar (pos ${filtroPos})</span><span class="val val-pagar">${fmt(pag / 100) || '0,00'}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Saldo (pos ${filtroPos})</span><span class="val ${corre >= 0 ? 'val-saldo-pos' : 'val-saldo-neg'}">${fmt(corre / 100) || '0,00'}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Lançamentos</span><span class="val">${n}</span></div>`;
    let av = $('#flx-sint-aviso');
    if (filtroPos === null) { if (av) av.remove(); return; }
    if (!av) { av = document.createElement('div'); av.id = 'flx-sint-aviso'; const leg = $('.flx-legenda'); if (leg) leg.insertAdjacentElement('afterend', av); }
    av.className = 'sint-aviso';
    av.innerHTML = 'Mostrando só: pos ' + filtroPos + ' · ' + (SINT.find(x => x[0] === filtroPos) || [0, ''])[1] + ' &nbsp; <a href="#" data-sint-todos>mostrar todos</a>';
    av.querySelector('[data-sint-todos]').addEventListener('click', ev => { ev.preventDefault(); filtroPos = null; aplicarFiltroPos(); if (sint && !sint.hidden) desenharSintese(); });
  }
  function desenharSintese() {
    const tot = new Map();
    for (const l of ultimasLinhas) tot.set(Number(l.pos), (tot.get(Number(l.pos)) || 0) + Math.round(((Number(l.aReceber) || 0) + (Number(l.aPagar) || 0)) * 100));
    const quando = state.mes ? MESES[state.mes - 1] + '/' + state.ano : 'ano ' + state.ano;
    const v = c => '<em class="' + (c < 0 ? 'neg' : c > 0 ? 'pos' : '') + '">' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</em>';
    const total = [...tot.values()].reduce((a, b) => a + b, 0);
    sint.querySelector('[data-t]').textContent = 'Sintetizar · ' + quando;
    sint.querySelector('[data-c]').innerHTML = '<button type="button" class="sint-it' + (filtroPos === null ? ' on' : '') + '" data-p=""><b></b><span>todos</span></button>'
      + SINT.filter(([p]) => p !== 1 || tot.has(1)).map(([p, n]) => '<button type="button" class="sint-it' + (filtroPos === p ? ' on' : '') + '" data-p="' + p + '"><b>' + p + '</b><span>' + n + '</span>' + v(tot.get(p) || 0) + '</button>').join('')
      + '<div class="sint-tot"><span>total ' + (state.mes ? 'do mês' : 'do ano') + ':</span>' + v(total) + '</div>'
      ;   // 20/10/2026 (Jorge): SEM saldo anterior aqui — so o que vence no mes escolhido
  }
  function abrirSintese(ancora) {
    if (!sint) {
      sint = document.createElement('div'); sint.className = 'sint-cx'; sint.hidden = true;
      sint.innerHTML = '<div class="sint-cab"><span data-t>Sintetizar</span><button type="button" data-x title="fechar">×</button></div><div data-c></div>';
      document.body.appendChild(sint);
      sint.querySelector('[data-x]').addEventListener('click', () => { sint.hidden = true; });
      sint.addEventListener('click', ev => {
        const b = ev.target.closest('[data-p]'); if (!b) return;
        filtroPos = b.dataset.p === '' ? null : Number(b.dataset.p);
        aplicarFiltroPos(); desenharSintese();
      });
      const cab = sint.querySelector('.sint-cab');
      cab.addEventListener('mousedown', ev => {
        if (ev.button !== 0 || ev.target.closest('button')) return;
        ev.preventDefault();
        const r = sint.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
        const m = e => { sint.style.left = Math.max(0, e.clientX - dx) + 'px'; sint.style.top = Math.max(0, e.clientY - dy) + 'px'; };
        const u = () => { document.removeEventListener('mousemove', m); document.removeEventListener('mouseup', u); };
        document.addEventListener('mousemove', m); document.addEventListener('mouseup', u);
      });
    }
    if (!sint.hidden) { sint.hidden = true; return; }
    const r = ancora.getBoundingClientRect();
    sint.style.left = Math.min(r.left, innerWidth - 320) + 'px'; sint.style.top = (r.bottom + 6) + 'px';
    desenharSintese(); sint.hidden = false;
  }
  (function legendaSintese() {
    const leg = $('.flx-legenda'); if (!leg) return;
    const s = document.createElement('span');
    s.className = 'flx-leg sint-leg'; s.textContent = '● Sintetizar'; s.title = 'total de cada tipo (pos) no período; clique num tipo para ver só ele';
    s.addEventListener('click', () => abrirSintese(s));
    leg.appendChild(s);
  })();

  (function init() {
    renderAnos();
    renderMeses();
    carregar();
  })();
})();
