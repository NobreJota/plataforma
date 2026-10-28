// =============================================================================
// Destino: C:\plataformaRota\public\js\contab\contabil\financeiro\cartoes-receber.js
// Criado em: 24/10/2026
//
// FLUXO DE CAIXA > CARTOES - RECEBIMENTO EM LOTE (ideia do Jorge)
//   A operadora deposita de uma vez varias parcelas (de varios clientes, as vezes de mais de um cartao).
//   ESQUERDA: todas as parcelas de cartao a receber da operadora (pos 6), com busca, cartao e "vencendo ate".
//             Clique na linha: passa para a direita. "→ todas" passa as que estao na lista.
//   DIREITA:  as escolhidas para este deposito. Clique na linha: volta para a esquerda.
//             Valores a receber (soma) · Recebido liquido (o que caiu no banco) · Despesas com taxa e juros (a diferenca).
//   Em cima: data do movimento e banco (padrao CEF/Armacao, 1.01.002.003, onde o cartao deposita) e o ★:
//             a conta da despesa com taxa e juros de cartao (chave 'cartao-taxa').
//   Gravar: UMA boleta RECEBIMENTO: banco a debito pelo liquido; cada parcela a credito na conta do cartao;
//             a taxa a debito na despesa (contrapartida negativa). As parcelas baixam. O estorno desfaz tudo.
// Abre pelo sub-menu (Cartões - recebimento) e pelo clique numa parcela de cartao no fluxo ("Receber em lote").
// 28/10/2026 (Jorge): 📂 IMPORTAR ARQUIVO DA REDE (relatorio de recebimentos, xlsx, aba "pagamentos": uma linha por
//   parcela paga). Cada parcela do arquivo casa com a pos 6 do fluxo (bandeira, n/N, valor, data da venda); as casadas
//   vao para a direita, o liquido vem do arquivo e a data do movimento e a do recebimento. Quadro por venda (NSU): bruto,
//   MDR, ANTECIPACAO ("taxa de recebimento automatico") e os JUROS AO MES da antecipacao. "Só na Rede" = venda que nao
//   esta no fluxo (ou com bandeira/parcelas/valor diferente). Gravando so parcelas do arquivo, a taxa vai em duas contas:
//   MDR ('cartao-taxa') e antecipacao ('cartao-antecipacao'), as duas pelo ★. Leitor de planilha: SheetJS (cdnjs).
// API: /financeiro/api/pagamento (GET /cartoes-receber, GET /bancos, POST /quitar { valorLiquido, lote: true, taxas })
// =============================================================================

(function () {
  'use strict';
  const API = '/financeiro/api/pagamento';
  const BANCO_CARTAO = '1.01.002.003';     // CEF/Armacao: o cartao deposita aqui (contrato)
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
  .cr-fundo { position:fixed; inset:0; background:rgba(15,23,42,.22); z-index:80; }
  .cr-fundo[hidden], .cr-jan[hidden] { display:none; }
  .cr-jan { position:fixed; left:50%; top:3vh; transform:translateX(-50%); z-index:81; width:min(1320px, calc(100vw - 24px)); height:92vh;
            display:flex; flex-direction:column; background:#fff; border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.3);
            font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:14px; color:#111827; }
  .cr-cab { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#059669; color:#fff; border-radius:12px 12px 0 0;
            font-weight:800; font-size:15px; cursor:move; user-select:none; }
  .cr-cab span { flex:1; } .cr-cab button { border:0; background:none; color:#fff; font-size:20px; cursor:pointer; }
  .cr-cab .estrela { font-size:18px; color:#fde68a; }
  .cr-ctl { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; padding:9px 14px; border-bottom:1px solid #e5e7eb; }
  .cr-ctl label { display:flex; flex-direction:column; gap:3px; font-size:10px; font-weight:700; text-transform:uppercase; color:#374151; }
  .cr-ctl input, .cr-ctl select { height:32px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; font-size:14px; }
  .cr-ctl select { min-width:180px; font-weight:700; }
  .cr-dois { flex:1; min-height:0; display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:12px 14px; }
  .cr-lado { display:flex; flex-direction:column; min-height:0; border:1px solid #d1d5db; border-radius:10px; overflow:hidden; }
  .cr-lado h3 { margin:0; padding:8px 10px; font-size:13px; background:#f3f4f6; display:flex; gap:8px; align-items:center; }
  .cr-lado h3 span { flex:1; }
  .cr-lado.dir h3 { background:#ecfdf5; color:#065f46; }
  .cr-filtro { display:flex; gap:8px; padding:7px 10px; border-bottom:1px solid #e5e7eb; flex-wrap:wrap; align-items:center; }
  .cr-filtro input, .cr-filtro select { height:30px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; font-size:13px; }
  .cr-lista { flex:1; min-height:0; overflow:auto; }
  .cr-tab { width:100%; border-collapse:collapse; font-size:13px; }
  .cr-tab th { position:sticky; top:0; background:#fafafa; color:#374151; font-size:11px; text-transform:uppercase; text-align:left; padding:5px 8px; z-index:1; }
  .cr-tab td { padding:5px 8px; border-top:1px solid #f3f4f6; }
  .cr-tab tr { cursor:pointer; } .cr-tab tbody tr:hover td { background:#f0fdf4; }
  .cr-lado.dir .cr-tab tbody tr:hover td { background:#fef2f2; }
  .cr-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .cr-tab .cn { color:#6b7280; font-size:12px; white-space:nowrap; }
  .cr-tab .v { color:#b91c1c; font-weight:700; }
  .cr-vz { padding:20px; color:#6b7280; text-align:center; }
  .cr-mini { border:1px solid #d1d5db; background:#fff; border-radius:6px; padding:4px 9px; font-weight:700; cursor:pointer; font-size:12px; }
  .cr-contas { display:grid; grid-template-columns:1fr 170px; gap:6px 12px; align-items:center; padding:10px 12px; border-top:2px solid #d1fae5; background:#f9fafb; }
  .cr-contas span { text-align:right; font-weight:600; color:#374151; }
  .cr-contas input { height:32px; text-align:right; font-weight:800; font-size:15px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; background:#f3f4f6; }
  .cr-contas input.dig { background:#fef9c3; border:2px solid #eab308; }
  .cr-contas input.taxa { color:#b91c1c; }
  .cr-contas small { grid-column:1 / -1; text-align:right; color:#6b7280; font-size:12px; }
  .cr-pe { display:flex; gap:12px; align-items:center; padding:10px 14px; border-top:1px solid #e5e7eb; }
  .cr-msg { flex:1; color:#dc2626; font-weight:600; font-size:13px; } .cr-msg.ok { color:#059669; }
  .cr-btn { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:8px 14px; font-weight:700; cursor:pointer; font-size:14px; }
  .cr-rede { margin:0 14px; border:1px solid #a7f3d0; border-radius:10px; background:#f0fdf4; overflow:hidden; }
  .cr-rede[hidden] { display:none; }
  .cr-rede-cab { padding:7px 10px; font-size:13px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .cr-rede-cab .cr-mini { margin-left:auto; }
  .cr-rede-lista { max-height:150px; overflow:auto; background:#fff; border-top:1px solid #d1fae5; }
  .cr-rede .cr-tab tr { cursor:default; } .cr-rede .cr-tab tr.so td { background:#fef2f2; }
  .cr-rede .cr-tab tfoot td { position:sticky; bottom:0; background:#ecfdf5; font-weight:800; }
  .cr-split { grid-column:1 / -1; text-align:right; font-size:12px; color:#065f46; }
  .cr-btn.verde { background:#059669; border-color:#059669; color:#fff; } .cr-btn:disabled { opacity:.5; cursor:not-allowed; }`;
  document.head.appendChild(st);

  let fundo, jan, titulos = [], escolhidos = new Set(), bancos = null;
  const q = id => document.getElementById(id);

  function montar() {
    fundo = document.createElement('div'); fundo.className = 'cr-fundo'; fundo.hidden = true;
    jan = document.createElement('div'); jan.className = 'cr-jan'; jan.hidden = true;
    jan.innerHTML = '<div class="cr-cab"><span>💳 Cartões - recebimento em lote · títulos a receber da operadora</span>'
      + '<button type="button" class="estrela" id="cr-cfg" title="conta da despesa com taxa e juros de cartão">★</button>'
      + '<button type="button" id="cr-x" title="fechar (Esc)">×</button></div>'
      + '<div class="cr-ctl"><label>Data do movimento<input type="date" id="cr-data" title="dia útil, até 5 dias úteis para trás"></label>'
      + '<label>Banco (onde caiu)<select id="cr-banco"><option value="">escolha o banco</option></select></label>'
      + '<button type="button" class="cr-btn" id="cr-rede-bt" title="relatório de recebimentos da Rede (xlsx, aba pagamentos): casa as parcelas com o fluxo">📂 Importar arquivo da Rede</button>'
      + '<input type="file" id="cr-rede-arq" accept=".xlsx,.xls,.csv" hidden></div>'
      + '<div class="cr-rede" id="cr-rede" hidden></div>'
      + '<div class="cr-dois">'
      + '<div class="cr-lado"><h3><span>Títulos a receber da operadora (6)</span><span class="cn" id="cr-qe"></span></h3>'
      + '<div class="cr-filtro"><input id="cr-busca" placeholder="cliente ou venda" autocomplete="off" style="flex:1;min-width:140px">'
      + '<select id="cr-cartao"><option value="">todos os cartões</option></select>'
      + '<label class="cn" style="display:flex;gap:4px;align-items:center">até <input type="date" id="cr-ate" title="vencendo até (vazio: todas)"></label>'
      + '<button type="button" class="cr-mini" id="cr-todas" title="passa para a direita todas as da lista">→ todas</button></div>'
      + '<div class="cr-lista" id="cr-esq"></div></div>'
      + '<div class="cr-lado dir"><h3><span>Neste depósito</span><button type="button" class="cr-mini" id="cr-limpa" title="devolve todas para a esquerda">← limpar</button></h3>'
      + '<div class="cr-lista" id="cr-dir"></div>'
      + '<div class="cr-contas"><span>Valores a receber</span><input id="cr-total" readonly tabindex="-1">'
      + '<span>Recebido líquido</span><input id="cr-liq" class="dig" inputmode="decimal" autocomplete="off" placeholder="o que caiu no banco">'
      + '<span>Despesas com taxa e juros</span><input id="cr-taxa" class="taxa" readonly tabindex="-1">'
      + '<small id="cr-pct"></small></div></div>'
      + '</div>'
      + '<div class="cr-pe"><span class="cr-msg" id="cr-msg"></span><button type="button" class="cr-btn" id="cr-fechar">Fechar</button>'
      + '<button type="button" class="cr-btn verde" id="cr-ok" disabled>Gravar o recebimento</button></div>';
    document.body.appendChild(fundo); document.body.appendChild(jan);
    arrastar(jan, jan.querySelector('.cr-cab'));
    const fechar = () => { jan.hidden = true; fundo.hidden = true; };
    q('cr-x').addEventListener('click', fechar); q('cr-fechar').addEventListener('click', fechar); fundo.addEventListener('click', fechar);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !jan.hidden) fechar(); });
    q('cr-cfg').addEventListener('click', abrirConfig);
    ['cr-busca', 'cr-cartao', 'cr-ate'].forEach(id => q(id).addEventListener(id === 'cr-busca' ? 'input' : 'change', desenhar));
    q('cr-esq').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-id]'); if (!tr) return; escolhidos.add(tr.dataset.id); desenhar(); });
    q('cr-dir').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-id]'); if (!tr) return; escolhidos.delete(tr.dataset.id); desenhar(); });
    q('cr-todas').addEventListener('click', () => { esquerda().forEach(t => escolhidos.add(t._id)); desenhar(); });
    q('cr-limpa').addEventListener('click', () => { escolhidos = new Set(); desenhar(); });
    q('cr-liq').addEventListener('input', contas);
    q('cr-liq').addEventListener('blur', () => { const c = paraCent(q('cr-liq').value); q('cr-liq').value = c ? brl(c / 100) : ''; contas(); });
    q('cr-liq').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); q('cr-liq').blur(); if (!q('cr-ok').disabled) q('cr-ok').focus(); } });
    q('cr-banco').addEventListener('change', contas);
    q('cr-data').addEventListener('change', contas);
    q('cr-ok').addEventListener('click', gravar);
    // 28/10/2026: arquivo da Rede
    q('cr-rede-bt').addEventListener('click', () => q('cr-rede-arq').click());
    q('cr-rede-arq').addEventListener('change', ev => { const a = ev.target.files[0]; ev.target.value = ''; if (a) importarRede(a); });
  }

  async function abrir() {
    if (!jan) montar();
    jan.hidden = false; fundo.hidden = false;
    q('cr-data').value = ymd(diaUtil()); q('cr-data').max = ymd(new Date());
    q('cr-liq').value = ''; msg('');
    if (!bancos) {
      try { const b = await api('GET', '/bancos'); bancos = Array.isArray(b) ? b : []; } catch (e) { bancos = []; msg('Bancos: ' + e.message); }
      const rec = bancos.filter(b => b.recebeVenda), lista = rec.length ? rec : bancos;
      q('cr-banco').insertAdjacentHTML('beforeend', lista.map(b => '<option value="' + esc(b._id) + '"' + (b.subCodigo === BANCO_CARTAO ? ' selected' : '') + '>'
        + esc(b.subCodigo ? b.subCodigo + ' - ' : '') + esc(b.apelido) + '</option>').join(''));
    }
    await carregar();
    q('cr-busca').focus();
  }
  const msg = (t, ok) => { q('cr-msg').textContent = t || ''; q('cr-msg').classList.toggle('ok', !!ok); };

  async function carregar() {
    q('cr-esq').innerHTML = '<div class="cr-vz">Carregando…</div>';
    try { titulos = ((await api('GET', '/cartoes-receber')).titulos || []).map(t => ({ ...t, _id: String(t._id) })); }
    catch (e) { titulos = []; q('cr-esq').innerHTML = '<div class="cr-vz">' + esc(e.message) + '</div>'; return; }
    escolhidos = new Set([...escolhidos].filter(id => titulos.some(t => t._id === id)));
    // cartoes que aparecem na lista
    const sel = q('cr-cartao'), atual = sel.value;
    const cartoes = [...new Map(titulos.map(t => [t.codigoConta, t.nomeConta || t.codigoConta])).entries()].sort();
    sel.innerHTML = '<option value="">todos os cartões</option>' + cartoes.map(([c, n]) => '<option value="' + esc(c) + '">' + esc(n) + '</option>').join('');
    if (cartoes.some(([c]) => c === atual)) sel.value = atual;
    desenhar();
  }

  // a esquerda: o que nao foi escolhido e passa nos filtros
  function esquerda() {
    const b = q('cr-busca').value.trim().toLowerCase(), c = q('cr-cartao').value, ate = q('cr-ate').value;
    return titulos.filter(t => !escolhidos.has(t._id)
      && (!b || (t.historico + ' ' + t.nomeConta).toLowerCase().includes(b))
      && (!c || t.codigoConta === c)
      && (!ate || ymd(new Date(t.vencimento)) <= ate));
  }
  const direita = () => titulos.filter(t => escolhidos.has(t._id));
  const cartaoCurto = t => String(t.nomeConta || t.codigoConta).replace(/^cart[ãa]o\s*/i, '');
  function tabela(lista, vazio) {
    if (!lista.length) return '<div class="cr-vz">' + vazio + '</div>';
    return '<table class="cr-tab"><thead><tr><th>Venc.</th><th>Histórico</th><th>Cartão</th><th class="n">Parc.</th><th class="n">Valor</th></tr></thead><tbody>'
      + lista.map(t => '<tr data-id="' + esc(t._id) + '"><td' + (t.atraso > 0 ? ' class="v"' : '') + '>' + br(t.vencimento) + '</td>'
        + '<td>' + esc(t.historico) + '</td><td class="cn">' + esc(cartaoCurto(t)) + '</td>'
        + '<td class="n cn">' + (t.parcela ? t.parcela + '/' + t.totalParcelas : '') + '</td><td class="n">' + brl(t.valor) + '</td></tr>').join('')
      + '</tbody></table>';
  }
  function desenhar() {
    const esq = esquerda(), dir = direita();
    q('cr-esq').innerHTML = tabela(esq, titulos.length ? 'Nada com esse filtro.' : 'Nenhum título de cartão a receber.');
    q('cr-dir').innerHTML = tabela(dir, 'Clique nas linhas da esquerda para trazer para este depósito.');
    q('cr-qe').textContent = esq.length + ' · R$ ' + brl(esq.reduce((s, t) => s + cent(t.valor), 0) / 100);
    desenharRede();
    contas();
  }
  function contas() {
    const dir = direita(), total = dir.reduce((s, t) => s + cent(t.valor), 0);
    const liq = paraCent(q('cr-liq').value), taxa = liq ? total - liq : 0;
    q('cr-total').value = total ? brl(total / 100) : '';
    q('cr-taxa').value = liq ? brl(taxa / 100) : '';
    q('cr-pct').textContent = !dir.length ? '' : !liq ? dir.length + ' parcela(s) · informe o recebido líquido'
      : liq > total ? '⚠ o líquido passa do total a receber'
      : dir.length + ' parcela(s) · taxa e juros ' + (taxa / total * 100).toFixed(2).replace('.', ',') + '%';
    // 28/10/2026: so parcelas do arquivo da Rede e o liquido do arquivo: MDR e antecipacao separadas
    const ta = taxasDoArquivo(dir);
    const split = ta && ta.liquido === liq ? ta : null;
    if (split) q('cr-pct').innerHTML = esc(q('cr-pct').textContent) + '<br><b>MDR R$ ' + brl(split.mdr / 100) + ' · antecipação R$ ' + brl(split.antecipacao / 100)
      + (split.juros ? ' (≈ ' + (split.juros * 100).toFixed(2).replace('.', ',') + '% ao mês)' : '') + '</b>';
    else if (ta) q('cr-pct').innerHTML = esc(q('cr-pct').textContent) + '<br>o líquido não é o do arquivo (R$ ' + brl(ta.liquido / 100) + '): a taxa vai numa conta só';
    q('cr-ok').disabled = !dir.length || !liq || liq > total || !q('cr-banco').value || !q('cr-data').value;
    return { dir, total, liq, taxa, split };
  }

  async function gravar() {
    const { dir, total, liq, taxa, split } = contas();
    const banco = q('cr-banco').selectedOptions[0].textContent;
    if (!confirm('Quer gravar o recebimento do cartão?\n\n' + dir.length + ' parcela(s): R$ ' + brl(total / 100)
      + '\nRecebido líquido: R$ ' + brl(liq / 100) + ' no ' + banco
      + (split ? '\nTaxa MDR: R$ ' + brl(split.mdr / 100) + '\nJuros da antecipação: R$ ' + brl(split.antecipacao / 100)
          + (split.juros ? ' (≈ ' + (split.juros * 100).toFixed(2).replace('.', ',') + '% ao mês)' : '')
        : taxa ? '\nDespesas com taxa e juros: R$ ' + brl(taxa / 100) : '')
      + '\nData: ' + br(q('cr-data').value + 'T12:00:00'))) return;
    q('cr-ok').disabled = true; msg('');
    try {
      const r = await api('POST', '/quitar', { tipo: 'receber', data: q('cr-data').value, contaBancariaId: q('cr-banco').value,
        titulosIds: dir.map(t => t._id), valorLiquido: liq / 100, lote: true,
        ...(split && split.antecipacao ? { taxas: { mdr: total - liq - split.antecipacao, antecipacao: split.antecipacao } } : {}),
        historico: 'Recebimento cartões em lote — ' + dir.length + ' parcela(s)' });
      escolhidos = new Set(); q('cr-liq').value = ''; rede = null;
      await carregar();
      msg('✓ recebido: boleta ' + (r.codigo || '') + ' · líquido R$ ' + brl(r.liquido) + (r.taxa ? ' · taxa R$ ' + brl(r.taxa) : '')
        + (r.antecipacao ? ' (antecipação R$ ' + brl(r.antecipacao) + ')' : ''), true);
      if (window.FluxoCaixa && window.FluxoCaixa.recarregar) window.FluxoCaixa.recarregar();
    } catch (e) { msg(e.message); contas(); }
  }

  // ★ conta da despesa com taxa e juros (configuracao por chave 'cartao-taxa')
  function abrirConfig() {
    const ir = () => window.ConfigContas.abrir({ pagina: 'cartoes', titulo: 'cartões - recebimento (MDR e antecipação)' });
    if (window.ConfigContas) { ir(); return; }
    const sc = document.createElement('script'); sc.src = '/js/comum/config-contas.js';
    sc.onload = ir; sc.onerror = () => alert('Não carregou o config-contas.js'); document.head.appendChild(sc);
  }

  // ===================== 28/10/2026: ARQUIVO DA REDE =====================
  // Relatorio de recebimentos da Rede (xlsx, aba "pagamentos": uma linha por PARCELA paga):
  //   data do recebimento · data original da venda · valor bruto da parcela original · taxa MDR (%) ·
  //   valor MDR descontado (MDR + antecipacao) · valor liquido da parcela · NSU/CV · bandeira · numero de parcelas · parcela
  // Cada linha casa com uma parcela pos 6 do fluxo: mesma bandeira, mesmo n/N, valor (±0,03) e data da venda (±4 dias).
  // A taxa se divide em MDR (taxa MDR x bruto) e ANTECIPACAO (o resto do "valor MDR descontado").
  const semAc = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const bandeiraDe = s => { const x = semAc(s);
    return /master/.test(x) ? 'master' : /visa/.test(x) ? 'visa' : /\belo\b/.test(x) ? 'elo' : /amex|american/.test(x) ? 'amex'
      : /hiper/.test(x) ? 'hiper' : /diners/.test(x) ? 'diners' : x; };
  const numRede = v => { if (typeof v === 'number') return v; let s = String(v ?? '').replace(/[R$\s%]/g, ''); if (!s || s === '-') return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); return Number(s); };
  const pctRede = v => { const n = numRede(v); if (!Number.isFinite(n)) return 0; return typeof v === 'string' && v.includes('%') ? n / 100 : (n > 1 ? n / 100 : n); };
  const DIA = 86400000;
  const diaRede = v => {                     // serial do Excel, Date ou dd/mm/aaaa -> 'aaaa-mm-dd'
    if (v instanceof Date && !isNaN(v)) return ymd(v);
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DIA); return d.toISOString().slice(0, 10); }
    const m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})/.exec(String(v ?? '').trim());
    return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  };
  const difDias = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / DIA);

  // linhas do arquivo (SheetJS: matriz de celulas) -> parcelas
  function lerPlanilhaRede(wb) {
    const nomes = wb.SheetNames.slice().sort((a, b) => (semAc(b) === 'pagamentos') - (semAc(a) === 'pagamentos'));
    for (const nome of nomes) {
      const m = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: '' });
      const h = m.findIndex(r => r.some(c => semAc(c) === 'valor liquido da parcela') && r.some(c => semAc(c) === 'nsu/cv'));
      if (h < 0) continue;
      const col = {}; m[h].forEach((c, i) => { col[semAc(c)] = i; });
      const pega = (r, ...ks) => { for (const k of ks) if (col[k] !== undefined) return r[col[k]]; return ''; };
      const linhas = [];
      for (const r of m.slice(h + 1)) {
        const bruto = numRede(pega(r, 'valor bruto da parcela original', 'valor bruto da parcela'));
        const liq = numRede(pega(r, 'valor liquido da parcela'));
        if (!Number.isFinite(bruto) || !Number.isFinite(liq)) continue;
        const tx = numRede(pega(r, 'valor mdr descontado'));
        const mdrPct = pctRede(pega(r, 'taxa mdr'));
        const cB = Math.round(bruto * 100), cL = Math.round(liq * 100);
        const cTx = Number.isFinite(tx) ? Math.round(tx * 100) : cB - cL;
        const cMdr = Math.min(cTx, Math.round(cB * mdrPct));
        linhas.push({ receb: diaRede(pega(r, 'data do recebimento', 'data prevista do recebimento')),
          venda: diaRede(pega(r, 'data original da venda')), bruto: cB, liquido: cL, mdr: cMdr, antecipacao: Math.max(0, cB - cL - cMdr),
          mdrPct, nsu: String(pega(r, 'nsu/cv')).trim(), bandeira: String(pega(r, 'bandeira')).trim(), band: bandeiraDe(pega(r, 'bandeira')),
          n: Number(numRede(pega(r, 'numero de parcelas'))) || 1, k: Number(numRede(pega(r, 'parcela'))) || 1,
          status: String(pega(r, 'status')).trim() });
      }
      if (linhas.length) return { aba: nome, linhas };
    }
    return null;
  }

  // juros da antecipacao ao mes: o que viria em 30/60/90... dias (liquido de MDR) contra o que veio hoje
  function jurosMes(ls) {
    const fluxos = ls.map(l => ({ v: l.bruto - l.mdr, t: Math.max(0, difDias(l.venda, l.receb) + 30 * l.k) / 30 }));
    const hoje = ls.reduce((s, l) => s + l.liquido, 0);
    if (!fluxos.some(f => f.t > 0.05) || ls.every(l => !l.antecipacao)) return 0;
    let lo = 0, hi = 0.5;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; const v = fluxos.reduce((s, f) => s + f.v / Math.pow(1 + m, f.t), 0); if (v > hoje) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // casa as linhas do arquivo com as parcelas do fluxo
  function casarRede(linhas) {
    const usados = new Set(), vendaDoNsu = new Map(), casadas = new Map(), soRede = [];
    const dVendaT = t => t.dataVenda ? ymd(new Date(t.dataVenda)) : ymd(new Date(new Date(t.vencimento).getTime() - 30 * (t.parcela || 1) * DIA));
    const ordem = linhas.slice().sort((a, b) => a.nsu.localeCompare(b.nsu) || a.k - b.k);
    for (const l of ordem) {
      const pref = vendaDoNsu.get(l.nsu);
      let melhor = null, nota = 1e9;
      for (const t of titulos) {
        if (usados.has(t._id) || bandeiraDe(t.nomeConta || t.codigoConta) !== l.band) continue;
        if ((t.totalParcelas || 1) !== l.n || (t.parcela || 1) !== l.k) continue;
        const dv = Math.abs(Math.round(t.valor * 100) - l.bruto); if (dv > 3) continue;
        const dd = l.venda ? Math.abs(difDias(dVendaT(t), l.venda)) : 0; if (dd > 4) continue;
        const n = dd * 10 + dv + (pref && String(t.vendaId) !== pref ? 50 : 0);
        if (n < nota) { nota = n; melhor = t; }
      }
      if (melhor) { usados.add(melhor._id); casadas.set(melhor._id, l); if (!pref && melhor.vendaId) vendaDoNsu.set(l.nsu, String(melhor.vendaId)); }
      else soRede.push(l);
    }
    return { casadas, soRede };
  }

  let rede = null;          // { arquivo, aba, linhas, casadas: Map(tituloId -> linha), soRede }
  async function carregarSheetJS() {
    if (window.XLSX) return;
    await new Promise((ok, falha) => { const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      sc.onload = ok; sc.onerror = () => falha(new Error('não carregou o leitor de planilha (internet?)')); document.head.appendChild(sc); });
  }
  async function importarRede(arq) {
    msg('Lendo ' + arq.name + '…', true);
    try {
      await carregarSheetJS();
      const wb = XLSX.read(await arq.arrayBuffer(), { type: 'array', cellDates: false });
      const lido = lerPlanilhaRede(wb);
      if (!lido) { msg('Não achei as parcelas no arquivo: use o relatório de recebimentos da Rede (aba "pagamentos", com "valor líquido da parcela" e "NSU/CV").'); return; }
      await carregar();                                   // fluxo atualizado antes de casar
      const { casadas, soRede } = casarRede(lido.linhas);
      rede = { arquivo: arq.name, aba: lido.aba, linhas: lido.linhas, casadas, soRede };
      escolhidos = new Set(casadas.keys());
      const liq = [...casadas.values()].reduce((s, l) => s + l.liquido, 0);
      q('cr-liq').value = liq ? brl(liq / 100) : '';
      const dias = [...new Set(lido.linhas.map(l => l.receb).filter(Boolean))];
      if (dias.length === 1 && dias[0] <= ymd(new Date())) q('cr-data').value = dias[0];
      desenhar();
      msg(casadas.size + ' de ' + lido.linhas.length + ' parcela(s) do arquivo casaram com o fluxo' + (soRede.length ? ' · ' + soRede.length + ' só na Rede' : ''), !soRede.length);
    } catch (e) { msg('Arquivo da Rede: ' + e.message); }
  }
  // o quadro do arquivo: por venda (NSU), com MDR, antecipacao e juros ao mes
  function desenharRede() {
    const box = q('cr-rede');
    if (!rede) { box.hidden = true; return; }
    const grupos = new Map();
    for (const l of rede.linhas) { const g = grupos.get(l.nsu) || { ls: [], nsu: l.nsu, bandeira: l.bandeira, n: l.n, venda: l.venda }; g.ls.push(l); grupos.set(l.nsu, g); }
    const so = new Set(rede.soRede);
    const tot = { bruto: 0, liq: 0, mdr: 0, ant: 0 };
    const linhas = [...grupos.values()].map(g => {
      const s = k => g.ls.reduce((t, l) => t + l[k], 0);
      const b = s('bruto'), lq = s('liquido'), md = s('mdr'), an = s('antecipacao'), j = jurosMes(g.ls);
      tot.bruto += b; tot.liq += lq; tot.mdr += md; tot.ant += an;
      const falta = g.ls.filter(l => so.has(l)).length;
      return '<tr' + (falta ? ' class="so"' : '') + '><td>' + esc(br(g.venda + 'T12:00:00')) + '</td><td>' + esc(g.bandeira) + ' ' + g.n + 'x</td><td class="cn">' + esc(g.nsu)
        + '</td><td class="n">' + g.ls.length + '</td><td class="n">' + brl(b / 100) + '</td><td class="n">' + brl(md / 100) + '</td><td class="n">' + brl(an / 100)
        + '</td><td class="n">' + (j ? (j * 100).toFixed(2).replace('.', ',') + '%' : '—') + '</td><td class="n">' + brl(lq / 100) + '</td><td>'
        + (falta ? '<b class="v">' + falta + ' só na Rede</b>' : '✓') + '</td></tr>';
    });
    const jt = jurosMes(rede.linhas);
    box.hidden = false;
    box.innerHTML = '<div class="cr-rede-cab"><b>📂 ' + esc(rede.arquivo) + '</b> · aba ' + esc(rede.aba) + ' · ' + rede.linhas.length + ' parcela(s) · '
      + 'casadas <b>' + rede.casadas.size + '</b>' + (rede.soRede.length ? ' · <b class="v">' + rede.soRede.length + ' só na Rede</b> (venda que não está no fluxo, ou com bandeira/parcelas/valor diferente)' : '')
      + ' <button type="button" class="cr-mini" id="cr-rede-x" title="esquecer o arquivo">×</button></div>'
      + '<div class="cr-rede-lista"><table class="cr-tab"><thead><tr><th>Venda</th><th>Cartão</th><th>NSU</th><th class="n">Parc.</th><th class="n">Bruto</th><th class="n">MDR</th><th class="n">Antecipação</th><th class="n">Juros a.m.</th><th class="n">Líquido</th><th></th></tr></thead><tbody>'
      + linhas.join('') + '</tbody><tfoot><tr><td colspan="4">Total do arquivo</td><td class="n">' + brl(tot.bruto / 100) + '</td><td class="n">' + brl(tot.mdr / 100)
      + '</td><td class="n">' + brl(tot.ant / 100) + '</td><td class="n">' + (jt ? (jt * 100).toFixed(2).replace('.', ',') + '%' : '—') + '</td><td class="n">' + brl(tot.liq / 100) + '</td><td></td></tr></tfoot></table></div>';
    q('cr-rede-x').addEventListener('click', () => { rede = null; desenhar(); });
  }
  // as escolhidas vieram TODAS do arquivo? entao a taxa se divide em MDR e antecipacao
  function taxasDoArquivo(dir) {
    if (!rede || !dir.length || !dir.every(t => rede.casadas.has(t._id))) return null;
    const ls = dir.map(t => rede.casadas.get(t._id));
    return { mdr: ls.reduce((s, l) => s + l.mdr, 0), antecipacao: ls.reduce((s, l) => s + l.antecipacao, 0),
             liquido: ls.reduce((s, l) => s + l.liquido, 0), juros: jurosMes(ls) };
  }

  window.CartoesReceber = { abrir };
})();
