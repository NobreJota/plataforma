/* public/js/financeiro/orcamento.js
 * Orçamento Anual — Entrega 1: grid + vincular contas
 */
(() => {
  'use strict';
  console.log('%c📊 orcamento.js v3 - fix marcacao persistente', 'background:#0891b2;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

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
            if (v > 0) {
              celulas += `<td class="cel-valor tem-valor" data-conta="${conta.orcamentoContaId}" data-mes="${m}">${fmt(v)}</td>`;
            } else {
              celulas += `<td class="cel-valor vazio" data-conta="${conta.orcamentoContaId}" data-mes="${m}">,00</td>`;
            }
          }
          html += `<tr class="orc-conta-row">
            <td class="cel-item">${item}</td>
            <td class="cel-conta">${conta.nome}</td>
            ${celulas}
          </tr>`;
        }
      }
      tbody.innerHTML = html;

      // Clique nas células (Entrega 2 fará o modal; por ora só avisa)
      $$('.cel-valor').forEach(cel => {
        cel.addEventListener('click', () => {
          const contaId = cel.dataset.conta;
          const mes = MESES[cel.dataset.mes];
          console.log(`Clicou: conta ${contaId}, mês ${mes}`);
          // Entrega 2: abrir modal de lançamento aqui
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
