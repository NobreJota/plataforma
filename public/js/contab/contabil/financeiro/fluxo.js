/* public/js/financeiro/fluxo.js
 * Tela do Fluxo de Caixa — lê o Fluxo Projetado, saldo acumulado, filtro mês/ano
 */
(() => {
  'use strict';
  console.log('%c🌊 fluxo.js v4.2 - dropdown banco código + nome', 'background:#6d28d9;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

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

      tbody.innerHTML = data.linhas.map(l => {
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
        return `
        <tr class="cor-${l.cor} ${clicavel}" data-acao="${acao}" data-data="${isoData}">
          <td class="c-item">${l.item}</td>
          <td class="c-chave">${l.chave}</td>
          <td class="c-hist">${l.historico}</td>
          <td class="c-conta">${l.codigoConta}</td>
          <td class="c-pos"><span class="c-pos-badge">${l.pos}</span></td>
          <td class="c-vect">${fmtData(l.vencimento)}</td>
          <td class="c-receber">${l.aReceber ? '<span class="val-receber">'+fmt(l.aReceber)+'</span>' : ''}</td>
          <td class="c-pagar">${l.aPagar ? '<span class="val-pagar">'+fmt(l.aPagar)+'</span>' : ''}</td>
          <td class="c-saldo"><span class="${l.saldo>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(l.saldo)}</span></td>
        </tr>`;
      }).join('');

      // Clique na linha → ação conforme o pos
      $$('#flx-body tr.flx-pagavel').forEach(tr => {
        tr.addEventListener('click', () => {
          const acao = tr.dataset.acao;
          const dataLinha = tr.dataset.data;
          console.log('🖱️ clique linha → acao:', acao, '| data:', dataLinha);
          if (!dataLinha) { console.warn('sem data na linha'); return; }
          if (acao === 'realizar') abrirRealizacao(dataLinha);
          else if (acao === 'pagar') abrirPagamento(dataLinha, 'pagar');
          else if (acao === 'receber') abrirPagamento(dataLinha, 'receber');
          else console.warn('acao não reconhecida:', acao);
        });
      });
      console.log('🔗 linhas clicáveis:', $$('#flx-body tr.flx-pagavel').length);

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

  /* ===== PAGAMENTO EM LOTE ===== */
  const PAG_API = '/financeiro/api/pagamento';
  const pag = { tipo: 'pagar', data: '', titulos: [], marcados: new Set(), historicos: {}, debHist: null };

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
          return `<option value="${b._id}">${label}</option>`;
        }).join('');
    } catch (err) { console.warn('bancos:', err.message); }
  }

  async function abrirPagamento(data, tipo) {
    pag.tipo = tipo; pag.data = data; pag.marcados = new Set(); pag.historicos = {};
    const ehRec = tipo === 'receber';
    $('#pag-titulo').textContent = ehRec ? '💵 Recebimento em lote' : '💰 Pagamento em lote';
    $('#pag-header').className = 'pag-modal-header' + (ehRec ? ' receber' : '');
    $('#pag-confirmar').textContent = ehRec ? '💵 Receber selecionados' : '💰 Pagar selecionados';
    $('#pag-data').value = data;
    await carregarBancos();
    await carregarJanela();
    $('#pag-modal').hidden = false;
  }

  async function carregarJanela() {
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
    if (pag.titulos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Nenhum título na janela de datas.</td></tr>';
      atualizarResumoPag();
      return;
    }
    tbody.innerHTML = pag.titulos.map(t => {
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
    const total = pag.titulos.filter(t => pag.marcados.has(t._id)).reduce((s,t) => s + t.valor, 0);
    $('#pag-resumo').textContent = `${pag.marcados.size} marcado(s) · Total: ${fmt(total) || '0,00'}`;
    $('#pag-confirmar').disabled = pag.marcados.size === 0;
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
    const bancoId = $('#pag-banco').value;
    if (!bancoId) { alert('Selecione o banco.'); return; }
    const btn = $('#pag-confirmar');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      const r = await pagApi('POST', '/quitar', {
        tipo: pag.tipo,
        data: $('#pag-data').value,
        contaBancariaId: bancoId,
        titulosIds: Array.from(pag.marcados),
        historicos: pag.historicos
      });
      $('#pag-modal').hidden = true;
      carregar(); // recarrega o fluxo (títulos pagos somem)
      // abre a boleta gerada
      abrirBoleta(r.boletaId);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = pag.tipo === 'receber' ? '💵 Receber selecionados' : '💰 Pagar selecionados';
    }
  }

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

      const bancoLinha = `
        <table class="bol-tabela">
          <thead><tr><th>Nº Conta</th><th>Nome da Conta</th><th>Histórico</th><th class="v">Valor</th></tr></thead>
          <tbody><tr>
            <td class="bol-cod">${b.bancoCodigo || '-'}</td>
            <td>${b.bancoNome}</td>
            <td>${b.historico || ''}</td>
            <td class="v">${ehRec ? '' : '-'}${fmt(b.valorTotal)}</td>
          </tr></tbody>
        </table>`;

      const contras = (b.contrapartidas || []).map(c => `
        <tr>
          <td class="bol-cod">${c.codigoConta || '-'}</td>
          <td>${c.nomeConta || '-'}</td>
          <td>${c.historico || ''}</td>
          <td class="v">${fmt(c.valor)}</td>
        </tr>`).join('');

      $('#bol-body').innerHTML = `
        <div class="bol-secao credito">
          <h3>${ehRec ? 'Débito (entrada no banco)' : 'Crédito (saída do banco)'}</h3>
          ${bancoLinha}
        </div>
        <div class="bol-secao debito">
          <h3>${ehRec ? 'Crédito (receitas)' : 'Débito (contrapartidas)'}</h3>
          <table class="bol-tabela">
            <thead><tr><th>Nº Conta</th><th>Nome da Conta</th><th>Histórico</th><th class="v">Valor</th></tr></thead>
            <tbody>${contras}</tbody>
          </table>
          <div class="bol-total">Total: ${fmt(b.valorTotal)}</div>
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
  $('#pag-cancelar').addEventListener('click', () => $('#pag-modal').hidden = true);
  $('#pag-confirmar').addEventListener('click', confirmarPagamento);
  $('#pag-todos').addEventListener('change', (e) => {
    if (e.target.checked) pag.titulos.forEach(t => pag.marcados.add(t._id));
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
  (function init() {
    renderAnos();
    renderMeses();
    carregar();
  })();
})();
