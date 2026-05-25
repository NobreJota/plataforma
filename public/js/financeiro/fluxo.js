/* public/js/financeiro/fluxo.js
 * Tela do Fluxo de Caixa — lê o Fluxo Projetado, saldo acumulado, filtro mês/ano
 */
(() => {
  'use strict';
  console.log('%c🌊 fluxo.js v1', 'background:#6d28d9;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

  const API = '/financeiro/api/fluxo';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const state = { ano: new Date().getFullYear(), mes: null };

  async function api(path) {
    const res = await fetch(API + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

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
    let html = `<button class="flx-mes-btn ${state.mes === null ? 'ativo' : ''}" data-mes="">Ano</button>`;
    MESES.forEach((m, i) => {
      html += `<button class="flx-mes-btn ${state.mes === i+1 ? 'ativo' : ''}" data-mes="${i+1}">${m.slice(0,3)}</button>`;
    });
    cont.innerHTML = html;
    $$('#flx-meses .flx-mes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mes = btn.dataset.mes ? parseInt(btn.dataset.mes, 10) : null;
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

  /* ===== Grid ===== */
  async function carregar() {
    const tbody = $('#flx-body');
    tbody.innerHTML = '<tr><td colspan="9" class="flx-empty">Carregando...</td></tr>';
    try {
      const q = '/' + state.ano + (state.mes ? `?mes=${state.mes}` : '');
      const data = await api(q);

      if (!data.linhas || data.linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="flx-empty">Nenhum lançamento no período. Lance projeções no Orçamento para vê-las aqui.</td></tr>';
        $('#flx-resumo').innerHTML = '';
        return;
      }

      tbody.innerHTML = data.linhas.map(l => `
        <tr class="cor-${l.cor}">
          <td class="c-item">${l.item}</td>
          <td class="c-chave">${l.chave}</td>
          <td class="c-hist">${l.historico}</td>
          <td class="c-conta">${l.codigoConta}</td>
          <td class="c-pos"><span class="c-pos-badge">${l.pos}</span></td>
          <td class="c-vect">${fmtData(l.vencimento)}</td>
          <td class="c-receber">${l.aReceber ? '<span class="val-receber">'+fmt(l.aReceber)+'</span>' : ''}</td>
          <td class="c-pagar">${l.aPagar ? '<span class="val-pagar">'+fmt(l.aPagar)+'</span>' : ''}</td>
          <td class="c-saldo"><span class="${l.saldo>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(l.saldo)}</span></td>
        </tr>
      `).join('');

      const r = data.resumo;
      $('#flx-resumo').innerHTML = `
        <div class="flx-resumo-item"><span class="lbl">A receber</span><span class="val val-receber">${fmt(r.totalReceber)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">A pagar</span><span class="val val-pagar">${fmt(r.totalPagar)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Saldo do período</span><span class="val ${r.saldoFinal>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(r.saldoFinal)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Lançamentos</span><span class="val">${r.quantidade}</span></div>
      `;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="flx-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  /* ===== Listeners ===== */
  $('#flx-ano').addEventListener('change', (e) => { state.ano = parseInt(e.target.value, 10); carregar(); });

  /* ===== Init ===== */
  (function init() {
    renderAnos();
    renderMeses();
    carregar();
  })();
})();
