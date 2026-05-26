/* public/js/financeiro/compras.js
 * Programação de Compras — grid fornecedores + vincular + lançamentos (pos 7)
 */
(() => {
  'use strict';
  console.log('%c🛒 compras.js v3 - linha de totais', 'background:#d97706;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

  const API = '/financeiro/api/compras';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const state = { ano: new Date().getFullYear(), disponiveis: [], marcadas: new Set(), debounce: null };
  const lanc = { fornId: null, razao: '', editandoId: null, _cache: [] };

  async function api(method, path = '', body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  function fmt(v) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function parseValor(s) {
    if (!s) return 0;
    return Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  }

  // Title Case: primeira maiúscula, resto minúsculo (com siglas e conectivos)
  function titleCase(s) {
    if (!s) return '';
    const min = new Set(['de','da','do','das','dos','e','a','o','em','para','com']);
    const mai = new Set(['SA','S/A','LTDA','ME','EPP','EIRELI','CIA','MEI','EI']);
    return String(s).toLowerCase().split(/\s+/).map((p, i) => {
      if (!p) return p;
      const u = p.toUpperCase().replace(/[.,]/g,'');
      if (mai.has(u)) return p.toUpperCase();
      if (i > 0 && min.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  /* ===== Combo anos ===== */
  async function carregarAnos() {
    try {
      const anos = await api('GET', '/anos');
      const sel = $('#cmp-ano');
      sel.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
      if (anos.includes(state.ano)) sel.value = state.ano;
      else state.ano = anos[0];
    } catch (err) { console.warn(err); }
  }

  /* ===== Grid ===== */
  async function carregarGrid() {
    const tbody = $('#grid-body');
    tbody.innerHTML = '<tr><td colspan="15" class="cmp-empty">Carregando...</td></tr>';
    try {
      const data = await api('GET', '/grid/' + state.ano);
      if (!data.linhas || data.linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="cmp-empty">Nenhum fornecedor vinculado. Clique em "🔗 Vincular fornecedores".</td></tr>';
        return;
      }
      let html = '';
      const totaisMes = Array(12).fill(0);
      let totalGeral = 0;
      data.linhas.forEach((l, i) => {
        let celulas = '';
        for (let m = 0; m < 12; m++) {
          const v = l.meses[m] || 0;
          totaisMes[m] += v;
          const cls = v > 0 ? 'tem-valor' : 'vazio';
          const txt = v > 0 ? fmt(v) : ',00';
          celulas += `<td class="cel-valor ${cls}" data-forn="${l.compraFornecedorId}" data-razao="${l.razao}" data-mes="${m}">${txt}</td>`;
        }
        totalGeral += l.total || 0;
        const razaoTC = titleCase(l.razao);
        html += `<tr class="cmp-conta-row">
          <td class="cel-item">${i + 1}</td>
          <td class="cel-forn cel-abre-lanc" data-forn="${l.compraFornecedorId}" data-razao="${l.razao}">${razaoTC}</td>
          ${celulas}
          <td class="cel-total">${l.total > 0 ? fmt(l.total) : ',00'}</td>
        </tr>`;
      });

      // Linha de TOTAIS por mês (rodapé)
      let totaisCelulas = '';
      for (let m = 0; m < 12; m++) {
        totaisCelulas += `<td class="cel-total-mes">${totaisMes[m] > 0 ? fmt(totaisMes[m]) : ',00'}</td>`;
      }
      html += `<tr class="cmp-totais-row">
        <td></td>
        <td class="cel-total-label">TOTAL PROGRAMADO</td>
        ${totaisCelulas}
        <td class="cel-total-geral">${fmt(totalGeral)}</td>
      </tr>`;

      tbody.innerHTML = html;

      $$('.cel-valor, .cel-abre-lanc').forEach(el => {
        el.addEventListener('click', () => {
          abrirLancamento({
            fornId: el.dataset.forn,
            razao: el.dataset.razao,
            mesInicial: el.dataset.mes !== undefined ? parseInt(el.dataset.mes, 10) + 1 : 1
          });
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="15" class="cmp-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  /* ===== Modal vincular ===== */
  async function abrirVincular() {
    $('#modal-vincular').hidden = false;
    $('#lista-vincular').innerHTML = '<p class="cmp-empty">Carregando fornecedores...</p>';
    try {
      state.disponiveis = await api('GET', '/disponiveis');
      state.marcadas = new Set(state.disponiveis.filter(f => f.vinculado && f.ativo).map(f => String(f._id)));
      renderVincular(state.disponiveis);
    } catch (err) {
      $('#lista-vincular').innerHTML = `<p class="cmp-empty">Erro: ${err.message}</p>`;
    }
  }

  function renderVincular(lista) {
    if (lista.length === 0) {
      $('#lista-vincular').innerHTML = '<p class="cmp-empty">Nenhum fornecedor encontrado.</p>';
      return;
    }
    $('#lista-vincular').innerHTML = lista.map(f => {
      const checked = state.marcadas.has(String(f._id)) ? 'checked' : '';
      return `<label class="cmp-item-vinc">
        <input type="checkbox" value="${f._id}" ${checked}>
        <span class="razao">${titleCase(f.razao)}</span>
        ${f.marca ? `<span class="marca">${f.marca}</span>` : ''}
        <span class="cnpj">${f.cnpj || ''}</span>
      </label>`;
    }).join('');
    atualizarContador();
    $$('#lista-vincular input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.marcadas.add(cb.value);
        else state.marcadas.delete(cb.value);
        atualizarContador();
      });
    });
  }

  function atualizarContador() {
    $('#contador-vinc').textContent = `${state.marcadas.size} fornecedor(es) selecionado(s)`;
  }

  function filtrarVincular() {
    const termo = $('#busca-forn').value.trim().toLowerCase();
    if (!termo) { renderVincular(state.disponiveis); return; }
    const f = state.disponiveis.filter(x =>
      (x.razao || '').toLowerCase().includes(termo) ||
      (x.cnpj || '').includes(termo) ||
      (x.marca || '').toLowerCase().includes(termo)
    );
    renderVincular(f);
  }

  async function salvarVincular() {
    const ids = Array.from(state.marcadas);
    const btn = $('#btn-salvar-vincular');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      await api('POST', '/vincular', { fornecedorIds: ids });
      const desmarcados = state.disponiveis.filter(f => f.vinculado && f.ativo && !state.marcadas.has(String(f._id)));
      if (desmarcados.length > 0) {
        const vinc = await api('GET', '/vinculados?incluirInativos=true');
        for (const d of desmarcados) {
          const v = vinc.find(x => String(x.fornecedor) === String(d._id));
          if (v && v.ativo) await api('POST', `/fornecedor/${v._id}/toggle`);
        }
      }
      $('#modal-vincular').hidden = true;
      carregarGrid();
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar vinculação';
    }
  }

  /* ===== Modal lançamento ===== */
  function calcularParcelasPreview(valor, numParcelas, modo) {
    numParcelas = Math.max(1, parseInt(numParcelas, 10) || 1);
    const out = [];
    if (modo === 'total') {
      const base = Math.floor((valor / numParcelas) * 100) / 100;
      let acc = 0;
      for (let i = 0; i < numParcelas; i++) {
        let v = base;
        if (i === numParcelas - 1) v = Math.round((valor - acc) * 100) / 100;
        acc += base; out.push(v);
      }
    } else {
      for (let i = 0; i < numParcelas; i++) out.push(valor);
    }
    return out;
  }

  async function abrirLancamento({ fornId, razao, mesInicial }) {
    lanc.fornId = fornId; lanc.razao = razao; lanc.editandoId = null;
    $('#lanc-razao').textContent = titleCase(razao || '');
    $('#lanc-ano').textContent = 'Ano ' + state.ano;
    $('#lanc-historico').value = titleCase(razao || '');
    $('#lanc-valor').value = '';
    $('#lanc-modo').value = 'parcela';
    $('#lanc-parcelas').value = '1';
    $('#lanc-mes-inicial').value = mesInicial || 1;
    $('#lanc-dia').value = '10';
    $('#lanc-frequencia').value = '1';
    $('#lanc-preview').hidden = true;
    $('#btn-add-lancamento').textContent = '+ Adicionar';
    $('#modal-lancamento').hidden = false;
    await carregarLancamentosSalvos();
    setTimeout(() => $('#lanc-valor').focus(), 50);
  }

  function editarLancamento(l) {
    lanc.editandoId = l._id;
    $('#lanc-historico').value = l.historico || '';
    $('#lanc-valor').value = fmt(l.valor);
    $('#lanc-modo').value = 'parcela';
    $('#lanc-parcelas').value = l.numParcelas || 1;
    $('#lanc-mes-inicial').value = l.mesInicial || 1;
    $('#lanc-dia').value = l.diaVencimento || 10;
    $('#lanc-frequencia').value = l.intervalo || 1;
    $('#btn-add-lancamento').textContent = '✓ Salvar alteração';
    atualizarPreview();
    $('#lanc-valor').focus();
  }

  function atualizarPreview() {
    const valor = parseValor($('#lanc-valor').value);
    const nParc = parseInt($('#lanc-parcelas').value, 10) || 1;
    const modo = $('#lanc-modo').value;
    const mesIni = parseInt($('#lanc-mes-inicial').value, 10) || 1;
    const dia = parseInt($('#lanc-dia').value, 10) || 10;
    const interv = parseInt($('#lanc-frequencia').value, 10) || 1;
    if (valor <= 0) { $('#lanc-preview').hidden = true; return; }
    const parcelas = calcularParcelasPreview(valor, nParc, modo);
    let html = '', total = 0;
    for (let i = 0; i < parcelas.length; i++) {
      const idx = (mesIni - 1 + i * interv) % 12;
      const anoP = state.ano + Math.floor((mesIni - 1 + i * interv) / 12);
      total += parcelas[i];
      html += `<div class="lanc-preview-item"><span>${String(dia).padStart(2,'0')}/${String(idx+1).padStart(2,'0')}/${anoP}</span><span>${fmt(parcelas[i])}</span></div>`;
    }
    $('#lanc-preview-lista').innerHTML = html;
    $('#lanc-preview-total').textContent = `Total: ${fmt(total)} em ${nParc}x`;
    $('#lanc-preview').hidden = false;
  }

  async function carregarLancamentosSalvos() {
    const cont = $('#lanc-salvos-lista');
    cont.innerHTML = '<p class="cmp-empty">Carregando...</p>';
    try {
      const data = await api('GET', `/lancamentos/${state.ano}/${lanc.fornId}`);
      const lancs = data.lancamentos || [];
      lanc._cache = lancs;
      if (lancs.length === 0) {
        cont.innerHTML = '<p class="cmp-empty">Nenhum lançamento ainda.</p>';
        return;
      }
      cont.innerHTML = lancs.map(l => `
        <div class="lanc-salvo-item">
          <span class="lanc-salvo-desc">${l.historico} · ${l.numParcelas}x · a partir de ${MESES_FULL[l.mesInicial-1]}</span>
          <span class="lanc-salvo-valor">${fmt(l.valor)}</span>
          <button class="lanc-btn-edit" data-id="${l._id}" title="Alterar">✏️</button>
          <button class="lanc-btn-del" data-id="${l._id}" title="Excluir">🗑️</button>
        </div>
      `).join('');
      $$('#lanc-salvos-lista .lanc-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const l = lanc._cache.find(x => String(x._id) === String(btn.dataset.id));
          if (l) editarLancamento(l);
        });
      });
      $$('#lanc-salvos-lista .lanc-btn-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este lançamento? As parcelas projetadas serão removidas.')) return;
          try {
            await api('DELETE', `/lancamento/${state.ano}/${lanc.fornId}/${btn.dataset.id}`);
            if (lanc.editandoId === btn.dataset.id) { lanc.editandoId = null; $('#btn-add-lancamento').textContent = '+ Adicionar'; }
            await carregarLancamentosSalvos();
            carregarGrid();
          } catch (err) { alert('Erro: ' + err.message); }
        });
      });
    } catch (err) {
      cont.innerHTML = `<p class="cmp-empty">Erro: ${err.message}</p>`;
    }
  }

  async function adicionarLancamento() {
    const valor = parseValor($('#lanc-valor').value);
    if (valor <= 0) { alert('Informe um valor válido.'); $('#lanc-valor').focus(); return; }
    const payload = {
      ano: state.ano,
      compraFornecedorId: lanc.fornId,
      historico: $('#lanc-historico').value.trim() || lanc.razao,
      valor,
      numParcelas: parseInt($('#lanc-parcelas').value, 10) || 1,
      modo: $('#lanc-modo').value,
      mesInicial: parseInt($('#lanc-mes-inicial').value, 10) || 1,
      diaVencimento: parseInt($('#lanc-dia').value, 10) || 10,
      intervalo: parseInt($('#lanc-frequencia').value, 10) || 1
    };
    const btn = $('#btn-add-lancamento');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (lanc.editandoId) {
        await api('PUT', `/lancamento/${state.ano}/${lanc.fornId}/${lanc.editandoId}`, payload);
        lanc.editandoId = null;
      } else {
        await api('POST', '/lancamento', payload);
      }
      $('#lanc-valor').value = '';
      $('#lanc-preview').hidden = true;
      $('#btn-add-lancamento').textContent = '+ Adicionar';
      await carregarLancamentosSalvos();
      carregarGrid();
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false;
      if (!lanc.editandoId) btn.textContent = '+ Adicionar';
    }
  }

  function fecharLancamento() { $('#modal-lancamento').hidden = true; }

  /* ===== Listeners ===== */
  ['#lanc-valor', '#lanc-parcelas', '#lanc-modo', '#lanc-mes-inicial', '#lanc-dia', '#lanc-frequencia'].forEach(sel => {
    $(sel).addEventListener('input', atualizarPreview);
    $(sel).addEventListener('change', atualizarPreview);
  });
  $('#btn-add-lancamento').addEventListener('click', adicionarLancamento);
  $('#btn-fechar-lanc').addEventListener('click', fecharLancamento);
  $('#btn-fechar-lanc-rodape').addEventListener('click', fecharLancamento);

  $('#cmp-ano').addEventListener('change', (e) => { state.ano = parseInt(e.target.value, 10); carregarGrid(); });
  $('#btn-vincular').addEventListener('click', abrirVincular);
  $('#btn-fechar-vincular').addEventListener('click', () => $('#modal-vincular').hidden = true);
  $('#btn-cancelar-vincular').addEventListener('click', () => $('#modal-vincular').hidden = true);
  $('#btn-salvar-vincular').addEventListener('click', salvarVincular);
  $('#busca-forn').addEventListener('input', () => { clearTimeout(state.debounce); state.debounce = setTimeout(filtrarVincular, 200); });

  /* ===== Init ===== */
  (async function init() {
    await carregarAnos();
    await carregarGrid();
  })();
})();
