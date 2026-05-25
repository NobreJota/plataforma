/* public/js/financeiro/orcamento.js
 * Orçamento Anual — Entrega 1: grid + vincular contas
 */
(() => {
  'use strict';
  console.log('%c📊 orcamento.js v5 - editar lancamento', 'background:#0891b2;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

  const API = '/financeiro/api/orcamento';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const state = { ano: new Date().getFullYear(), disponiveis: [], marcadas: new Set(), debounce: null };

  async function api(method, path = '', body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  // Formata número como moeda BR (sem R$)
  function fmt(v) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ===== Combo de anos ===== */
  async function carregarAnos() {
    try {
      const anos = await api('GET', '/anos');
      const sel = $('#combo-ano');
      sel.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
      if (anos.includes(state.ano)) sel.value = state.ano;
      else state.ano = anos[0];
    } catch (err) {
      console.warn('Erro ao carregar anos:', err);
    }
  }

  /* ===== Grid ===== */
  async function carregarGrid() {
    const tbody = $('#grid-body');
    tbody.innerHTML = '<tr><td colspan="14" class="orc-empty">Carregando...</td></tr>';
    try {
      const data = await api('GET', '/grid/' + state.ano);
      if (!data.grupos || data.grupos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="orc-empty">Nenhuma conta vinculada. Clique em "🔗 Vincular contas" para começar.</td></tr>';
        return;
      }

      let html = '';
      let item = 0;
      for (const grupo of data.grupos) {
        // Cabeçalho de grupo (azul)
        html += `<tr class="orc-grupo-row"><td></td><td class="cel-conta" colspan="13">${grupo.nome}</td></tr>`;
        // Contas do grupo
        for (const conta of grupo.contas) {
          item++;
          let celulas = '';
          for (let m = 0; m < 12; m++) {
            const v = conta.meses[m] || 0;
            const cls = v > 0 ? 'tem-valor' : 'vazio';
            const txt = v > 0 ? fmt(v) : ',00';
            celulas += `<td class="cel-valor ${cls}" data-conta="${conta.orcamentoContaId}" data-mes="${m}" data-nome="${conta.nome}" data-codigo="${conta.codigo}">${txt}</td>`;
          }
          html += `<tr class="orc-conta-row">
            <td class="cel-item">${item}</td>
            <td class="cel-conta cel-abre-lanc" data-conta="${conta.orcamentoContaId}" data-nome="${conta.nome}" data-codigo="${conta.codigo}">${conta.nome}</td>
            ${celulas}
          </tr>`;
        }
      }
      tbody.innerHTML = html;

      // Clique na célula ou no nome da conta → abre modal de lançamento
      $$('.cel-valor, .cel-abre-lanc').forEach(el => {
        el.addEventListener('click', () => {
          abrirLancamento({
            contaId: el.dataset.conta,
            nome: el.dataset.nome,
            codigo: el.dataset.codigo,
            mesInicial: el.dataset.mes !== undefined ? parseInt(el.dataset.mes, 10) + 1 : 1
          });
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="14" class="orc-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  /* ===== Modal vincular ===== */
  async function abrirVincular() {
    $('#modal-vincular').hidden = false;
    $('#lista-vincular').innerHTML = '<p class="orc-empty">Carregando contas...</p>';
    try {
      state.disponiveis = await api('GET', '/disponiveis');
      // Inicializa o Set de marcadas com as que já estão vinculadas e ativas
      state.marcadas = new Set(
        state.disponiveis.filter(c => c.vinculada && c.ativa).map(c => String(c._id))
      );
      popularFiltroTitulo();
      renderVincular(state.disponiveis);
    } catch (err) {
      $('#lista-vincular').innerHTML = `<p class="orc-empty">Erro: ${err.message}</p>`;
    }
  }

  function renderVincular(lista) {
    if (lista.length === 0) {
      $('#lista-vincular').innerHTML = '<p class="orc-empty">Nenhuma conta encontrada com esse filtro.</p>';
      return;
    }
    // Agrupa por codigoContaTitulo
    const grupos = {};
    lista.forEach(c => {
      const k = c.codigoContaTitulo || '—';
      if (!grupos[k]) grupos[k] = { nome: c.nomeContaTitulo || k, itens: [] };
      grupos[k].itens.push(c);
    });

    let html = '';
    Object.keys(grupos).sort().forEach(k => {
      const g = grupos[k];
      html += `<div class="orc-grupo-vinc">${k} - ${g.nome}</div>`;
      g.itens.forEach(c => {
        const checked = state.marcadas.has(String(c._id)) ? 'checked' : '';
        html += `<label class="orc-item-vinc">
          <input type="checkbox" value="${c._id}" ${checked}>
          <span class="cod">${c.codigo}</span>
          <span class="nm">${c.nome}</span>
        </label>`;
      });
    });
    $('#lista-vincular').innerHTML = html;
    atualizarContador();

    // Ao marcar/desmarcar, atualiza o Set (persiste entre filtros)
    $$('#lista-vincular input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.marcadas.add(cb.value);
        else state.marcadas.delete(cb.value);
        atualizarContador();
      });
    });
  }

  // Popula o dropdown de títulos a partir dos disponíveis
  function popularFiltroTitulo() {
    const titulos = {};
    state.disponiveis.forEach(c => {
      const k = c.codigoContaTitulo || '—';
      if (!titulos[k]) titulos[k] = c.nomeContaTitulo || k;
    });
    const sel = $('#filtro-titulo');
    sel.innerHTML = '<option value="">Todos os títulos</option>' +
      Object.keys(titulos).sort().map(k =>
        `<option value="${k}">${k} - ${titulos[k]}</option>`
      ).join('');
  }

  function atualizarContador() {
    $('#contador-vinc').textContent = `${state.marcadas.size} conta(s) selecionada(s)`;
  }

  async function salvarVincular() {
    // Usa o Set completo (persiste entre filtros) — não só os visíveis
    const ids = Array.from(state.marcadas);
    const btn = $('#btn-salvar-vincular');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      // Vincula/reativa as marcadas
      await api('POST', '/vincular', { subtituloIds: ids });

      // Desvincular: as que ESTAVAM vinculadas+ativas e agora NÃO estão marcadas
      const desmarcadas = state.disponiveis.filter(c =>
        c.vinculada && c.ativa && !state.marcadas.has(String(c._id))
      );
      if (desmarcadas.length > 0) {
        const vinc = await api('GET', '/vinculadas?incluirInativas=true');
        for (const d of desmarcadas) {
          const v = vinc.find(x => String(x.contaSubTitulo) === String(d._id));
          if (v && v.ativo) await api('POST', `/conta/${v._id}/toggle`);
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

  /* ===== Busca + filtro no modal ===== */
  function filtrarVincular() {
    const termo = $('#busca-contas').value.trim().toLowerCase();
    const titulo = $('#filtro-titulo').value;
    let filtrada = state.disponiveis;
    if (titulo) filtrada = filtrada.filter(c => c.codigoContaTitulo === titulo);
    if (termo) filtrada = filtrada.filter(c =>
      c.nome.toLowerCase().includes(termo) || c.codigo.includes(termo)
    );
    renderVincular(filtrada);
  }

  /* ============================================================
     MODAL DE LANÇAMENTO (Entrega 2)
     ============================================================ */
  const lanc = { contaId: null, nome: '', codigo: '', editandoId: null };

  // Parse de valor BR "1.465,00" → 1465.00
  function parseValor(s) {
    if (!s) return 0;
    return Number(String(s).replace(/\./g, '').replace(',', '.')) || 0;
  }

  function calcularParcelasPreview(valor, numParcelas, modo) {
    numParcelas = Math.max(1, parseInt(numParcelas, 10) || 1);
    const out = [];
    if (modo === 'total') {
      const base = Math.floor((valor / numParcelas) * 100) / 100;
      let acc = 0;
      for (let i = 0; i < numParcelas; i++) {
        let v = base;
        if (i === numParcelas - 1) v = Math.round((valor - acc) * 100) / 100;
        acc += base;
        out.push(v);
      }
    } else {
      for (let i = 0; i < numParcelas; i++) out.push(valor);
    }
    return out;
  }

  async function abrirLancamento({ contaId, nome, codigo, mesInicial }) {
    lanc.contaId = contaId; lanc.nome = nome; lanc.codigo = codigo;
    lanc.editandoId = null;
    $('#lanc-titulo').textContent = 'Lançamento';
    $('#lanc-codigo').textContent = codigo || '';
    $('#lanc-nome').textContent = nome || '';
    $('#lanc-ano').textContent = 'Ano ' + state.ano;

    // Reset form
    $('#lanc-historico').value = nome || '';
    $('#lanc-valor').value = '';
    $('#lanc-modo').value = 'parcela';
    $('#lanc-parcelas').value = '12';
    $('#lanc-mes-inicial').value = mesInicial || 1;
    $('#lanc-dia').value = '10';
    $('#lanc-preview').hidden = true;
    $('#btn-add-lancamento').textContent = '+ Adicionar';

    $('#modal-lancamento').hidden = false;
    await carregarLancamentosSalvos();
    setTimeout(() => $('#lanc-valor').focus(), 50);
  }

  // Preenche o formulário para editar um lançamento existente
  function editarLancamento(l) {
    lanc.editandoId = l._id;
    $('#lanc-historico').value = l.historico || '';
    $('#lanc-valor').value = fmt(l.valor);
    $('#lanc-modo').value = 'parcela';  // valor salvo é por parcela
    $('#lanc-parcelas').value = l.numParcelas || 1;
    $('#lanc-mes-inicial').value = l.mesInicial || 1;
    $('#lanc-dia').value = l.diaVencimento || 10;
    $('#btn-add-lancamento').textContent = '✓ Salvar alteração';
    atualizarPreview();
    $('#lanc-valor').focus();
    // rola para o topo do form
    $('#lanc-valor').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function atualizarPreview() {
    const valor = parseValor($('#lanc-valor').value);
    const nParc = parseInt($('#lanc-parcelas').value, 10) || 1;
    const modo = $('#lanc-modo').value;
    const mesIni = parseInt($('#lanc-mes-inicial').value, 10) || 1;
    const dia = parseInt($('#lanc-dia').value, 10) || 10;

    if (valor <= 0) { $('#lanc-preview').hidden = true; return; }

    const parcelas = calcularParcelasPreview(valor, nParc, modo);
    let html = '';
    let total = 0;
    for (let i = 0; i < parcelas.length; i++) {
      const mesIndex = (mesIni - 1 + i) % 12;
      const anoP = state.ano + Math.floor((mesIni - 1 + i) / 12);
      total += parcelas[i];
      html += `<div class="lanc-preview-item">
        <span>${String(dia).padStart(2,'0')}/${String(mesIndex+1).padStart(2,'0')}/${anoP}</span>
        <span>${fmt(parcelas[i])}</span>
      </div>`;
    }
    $('#lanc-preview-lista').innerHTML = html;
    $('#lanc-preview-total').textContent = `Total: ${fmt(total)} em ${nParc}x`;
    $('#lanc-preview').hidden = false;
  }

  async function carregarLancamentosSalvos() {
    const cont = $('#lanc-salvos-lista');
    cont.innerHTML = '<p class="orc-empty">Carregando...</p>';
    try {
      const data = await api('GET', `/lancamentos/${state.ano}/${lanc.contaId}`);
      const lancs = data.lancamentos || [];
      if (lancs.length === 0) {
        cont.innerHTML = '<p class="orc-empty">Nenhum lançamento ainda.</p>';
        return;
      }
      const nomeMes = (m) => MESES[m-1];
      cont.innerHTML = lancs.map(l => `
        <div class="lanc-salvo-item">
          <span class="lanc-salvo-desc">${l.historico} · ${l.numParcelas}x · a partir de ${nomeMes(l.mesInicial)}</span>
          <span class="lanc-salvo-valor">${fmt(l.valor)}</span>
          <button class="lanc-btn-edit" data-id="${l._id}" title="Alterar">✏️</button>
          <button class="lanc-btn-del" data-id="${l._id}" title="Excluir">🗑️</button>
        </div>
      `).join('');
      // Guarda os lançamentos para edição
      lanc._cache = lancs;
      $$('#lanc-salvos-lista .lanc-btn-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const l = (lanc._cache || []).find(x => String(x._id) === String(btn.dataset.id));
          if (l) editarLancamento(l);
        });
      });
      $$('#lanc-salvos-lista .lanc-btn-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Excluir este lançamento? As parcelas projetadas serão removidas.')) return;
          try {
            await api('DELETE', `/lancamento/${state.ano}/${lanc.contaId}/${btn.dataset.id}`);
            if (lanc.editandoId === btn.dataset.id) { lanc.editandoId = null; $('#btn-add-lancamento').textContent = '+ Adicionar'; }
            await carregarLancamentosSalvos();
            carregarGrid();
          } catch (err) { alert('Erro: ' + err.message); }
        });
      });
    } catch (err) {
      cont.innerHTML = `<p class="orc-empty">Erro: ${err.message}</p>`;
    }
  }

  async function adicionarLancamento() {
    const valor = parseValor($('#lanc-valor').value);
    if (valor <= 0) { alert('Informe um valor válido.'); $('#lanc-valor').focus(); return; }
    const payload = {
      ano: state.ano,
      orcamentoContaId: lanc.contaId,
      historico: $('#lanc-historico').value.trim() || lanc.nome,
      valor,
      numParcelas: parseInt($('#lanc-parcelas').value, 10) || 1,
      modo: $('#lanc-modo').value,
      mesInicial: parseInt($('#lanc-mes-inicial').value, 10) || 1,
      diaVencimento: parseInt($('#lanc-dia').value, 10) || 10
    };
    const btn = $('#btn-add-lancamento');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (lanc.editandoId) {
        // EDITAR: PUT (remove parcelas antigas, gera novas — sem lixo)
        await api('PUT', `/lancamento/${state.ano}/${lanc.contaId}/${lanc.editandoId}`, payload);
        lanc.editandoId = null;
      } else {
        // NOVO: POST
        await api('POST', '/lancamento', payload);
      }
      // Reset campos de valor, mantém histórico
      $('#lanc-valor').value = '';
      $('#lanc-preview').hidden = true;
      $('#btn-add-lancamento').textContent = '+ Adicionar';
      await carregarLancamentosSalvos();
      carregarGrid();  // atualiza o grid de fundo
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false;
      if (!lanc.editandoId) btn.textContent = '+ Adicionar';
    }
  }

  function fecharLancamento() { $('#modal-lancamento').hidden = true; }

  // Listeners do modal de lançamento
  ['#lanc-valor', '#lanc-parcelas', '#lanc-modo', '#lanc-mes-inicial', '#lanc-dia'].forEach(sel => {
    $(sel).addEventListener('input', atualizarPreview);
    $(sel).addEventListener('change', atualizarPreview);
  });
  $('#btn-add-lancamento').addEventListener('click', adicionarLancamento);
  $('#btn-fechar-lanc').addEventListener('click', fecharLancamento);
  $('#btn-fechar-lanc-rodape').addEventListener('click', fecharLancamento);

  /* ===== Listeners ===== */
  $('#combo-ano').addEventListener('change', (e) => { state.ano = parseInt(e.target.value, 10); carregarGrid(); });
  $('#btn-vincular').addEventListener('click', abrirVincular);
  $('#btn-fechar-vincular').addEventListener('click', () => $('#modal-vincular').hidden = true);
  $('#btn-cancelar-vincular').addEventListener('click', () => $('#modal-vincular').hidden = true);
  $('#btn-salvar-vincular').addEventListener('click', salvarVincular);
  $('#busca-contas').addEventListener('input', () => { clearTimeout(state.debounce); state.debounce = setTimeout(filtrarVincular, 200); });
  $('#filtro-titulo').addEventListener('change', filtrarVincular);

  /* ===== Init ===== */
  (async function init() {
    await carregarAnos();
    await carregarGrid();
  })();
})();
