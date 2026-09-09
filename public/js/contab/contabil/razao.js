/* public/js/contabil/razao.js
 * Tela do Razão — combos Conta-título + Subtítulo, busca rápida,
 * filtro de período, grade de lançamentos, modal de boleta,
 * navegação por contrapartida (clica no código C/PART → pula pra outra conta).
 */
(() => {
  'use strict';
  console.log('%c📘 razao.js v1.1', 'background:#1d4ed8;color:white;padding:4px 10px;border-radius:4px');

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const API_CONTAB = '/contab/api';
  const API_RAZAO  = '/financeiro/api/razao';
  const API_PAG    = '/financeiro/api/pagamento';

  const st = {
    grupo: '1',
    titulos: [],
    titulo: null,
    subtitulos: [],
    sub: null,
    de: null,
    ate: null,
  };

  // ============================================================
  // HELPERS
  // ============================================================
  async function getJson(url) {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
    return d;
  }
  function fmt(v) {
    if (v == null || v === 0) return '0,00';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtData(d) {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
  }
  function fmtDataBr(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
  }

  // ============================================================
  // PERÍODO (default: ano atual completo)
  // ============================================================
  function inicializarPeriodo() {
    const ano = new Date().getFullYear();
    st.de  = `${ano}-01-01`;
    st.ate = `${ano}-12-31`;
    $('#rz-de').value  = st.de;
    $('#rz-ate').value = st.ate;
    atualizarLabelPeriodo();
  }
  function atualizarLabelPeriodo() {
    $('#rz-periodo-label').textContent = `${fmtDataBr(st.de)} a ${fmtDataBr(st.ate)}`;
  }

  // ============================================================
  // CARREGAR TÍTULOS DO GRUPO
  // ============================================================
  async function carregarTitulosDoGrupo() {
    try {
      const tits = await getJson(`${API_CONTAB}/titulos-por-grupo/${st.grupo}`);
      tits.sort((a, b) => a.codigo.localeCompare(b.codigo));
      st.titulos = tits;
      renderDropdownTitulo();
    } catch (err) {
      console.warn('titulos-por-grupo:', err.message);
      st.titulos = [];
      renderDropdownTitulo();
    }
  }

  function renderDropdownTitulo() {
    const dd = $('#rz-titulo-list');
    if (st.titulos.length === 0) {
      dd.innerHTML = '<div class="rz-empty-opt">Nenhuma conta-título nesse grupo.</div>';
      return;
    }
    dd.innerHTML = st.titulos.map(t => {
      const cls = (st.titulo && st.titulo._id === t._id) ? 'rz-opt selected' : 'rz-opt';
      return `<div class="${cls}" data-id="${t._id}">${t.codigo} ${t.nome}</div>`;
    }).join('');
    dd.querySelectorAll('.rz-opt').forEach(el => {
      el.addEventListener('click', () => {
        const t = st.titulos.find(x => x._id === el.dataset.id);
        selecionarTitulo(t);
        fecharDropdowns();
      });
    });
  }

  function selecionarTitulo(t) {
    st.titulo = t;
    st.sub = null;
    st.subtitulos = [];
    $('#rz-titulo-value').textContent = `${t.codigo} ${t.nome}`;
    $('#rz-sub-value').textContent = 'Carregando...';
    renderGrade([]);
    carregarSubtitulos();
  }

  // ============================================================
  // CARREGAR SUBTÍTULOS DO TÍTULO
  // ============================================================
  async function carregarSubtitulos() {
    try {
      const subs = await getJson(`${API_CONTAB}/subtitulos/${st.titulo._id}`);
      subs.sort((a, b) => a.codigo.localeCompare(b.codigo));
      st.subtitulos = subs;
      renderDropdownSub();
      $('#rz-sub-value').textContent = subs.length ? 'Selecione...' : 'Nenhum subtítulo';
    } catch (err) {
      console.warn('subtitulos:', err.message);
      st.subtitulos = [];
      $('#rz-sub-value').textContent = 'Erro ao carregar';
    }
  }

  function renderDropdownSub() {
    const dd = $('#rz-sub-list');
    if (st.subtitulos.length === 0) {
      dd.innerHTML = '<div class="rz-empty-opt">Nenhum subtítulo.</div>';
      return;
    }
    dd.innerHTML = st.subtitulos.map(s => {
      const cls = (st.sub && st.sub._id === s._id) ? 'rz-opt selected' : 'rz-opt';
      const seq = (s.codigo || '').split('.').pop();
      return `<div class="${cls}" data-id="${s._id}">${seq} ${s.nome}</div>`;
    }).join('');
    dd.querySelectorAll('.rz-opt').forEach(el => {
      el.addEventListener('click', () => {
        const s = st.subtitulos.find(x => x._id === el.dataset.id);
        selecionarSubtitulo(s);
        fecharDropdowns();
      });
    });
  }

  function selecionarSubtitulo(s) {
    st.sub = s;
    const seq = (s.codigo || '').split('.').pop();
    $('#rz-sub-value').textContent = `${seq} ${s.nome}`;
    carregarRazao();
  }

  // ============================================================
  // CARREGAR LANÇAMENTOS DO RAZÃO
  // ============================================================
  async function carregarRazao() {
    if (!st.sub) return;
    const params = new URLSearchParams({ conta: st.sub.codigo, de: st.de, ate: st.ate });
    try {
      $('#rz-grade-body').innerHTML = '<div class="rz-empty">Carregando...</div>';
      const d = await getJson(`${API_RAZAO}/lancamentos?${params.toString()}`);
      renderGrade(d.lancamentos || []);
      $('#rz-tot-deb').textContent = fmt(d.totalDebito);
      $('#rz-tot-cre').textContent = fmt(d.totalCredito);
      const saldo = d.saldo || 0;
      const el = $('#rz-tot-saldo');
      el.textContent = (saldo < 0 ? '−' : '') + fmt(Math.abs(saldo));
      el.style.color = saldo < 0 ? '#b91c1c' : '#15803d';
    } catch (err) {
      $('#rz-grade-body').innerHTML = `<div class="rz-empty">Erro: ${err.message}</div>`;
    }
  }

  function renderGrade(linhas) {
    const body = $('#rz-grade-body');
    if (!linhas || linhas.length === 0) {
      body.innerHTML = '<div class="rz-empty">Nenhum lançamento no período.</div>';
      return;
    }
    body.innerHTML = linhas.map(l => {
      const saldoCls = (l.saldo || 0) < 0 ? 'rz-saldo-neg' : 'rz-saldo-pos';
      const saldoTxt = ((l.saldo || 0) < 0 ? '−' : '') + fmt(Math.abs(l.saldo || 0));
      const chaveTxt = l.documento || '—';

      // C/Partida: mostra o código real da contrapartida e torna clicável.
      // O backend devolve cPartida pronta (ex.: "3.01.001.003" ou "3.01.001.003 +1").
      // Pra navegar, usamos só o primeiro código (antes do "+N").
      let cpartHtml = '<span class="rz-dash">—</span>';
      if (l.cPartida) {
        const codNav = l.cPartida.split(' ')[0];
        cpartHtml = `<span class="rz-cpart-link" data-cod="${codNav}">${l.cPartida}</span>`;
      }

      return `<div class="rz-row">
        <div><span class="rz-chave-link" data-bid="${l.boletaId}">${chaveTxt}</span></div>
        <div>${fmtData(l.data)}</div>
        <div>${cpartHtml}</div>
        <div class="rz-hist">${l.historico || ''}</div>
        <div class="rz-right ${l.debito  ? 'rz-deb' : ''}">${l.debito  ? fmt(l.debito)  : '<span class="rz-dash">—</span>'}</div>
        <div class="rz-right ${l.credito ? 'rz-cre' : ''}">${l.credito ? fmt(l.credito) : '<span class="rz-dash">—</span>'}</div>
        <div class="rz-right ${saldoCls}">${saldoTxt}</div>
      </div>`;
    }).join('');

    // clique na chave → abre boleta
    body.querySelectorAll('.rz-chave-link').forEach(el => {
      el.addEventListener('click', () => abrirBoleta(el.dataset.bid));
    });
    // clique na C/Partida → navega pra outra conta
    body.querySelectorAll('.rz-cpart-link').forEach(el => {
      el.addEventListener('click', () => navegarParaConta(el.dataset.cod));
    });
  }

  // ============================================================
  // NAVEGAR PRA OUTRA CONTA (clique na C/PART)
  // ============================================================
  async function navegarParaConta(codigoSubtitulo) {
    if (!codigoSubtitulo) return;
    const grupo = codigoSubtitulo.charAt(0);
    const codigoTitulo = codigoSubtitulo.split('.').slice(0, 3).join('.');

    // 1) muda grupo se preciso
    if (st.grupo !== grupo) {
      st.grupo = grupo;
      $$('.rz-tab').forEach(b => b.classList.toggle('active', b.dataset.grupo === grupo));
      await carregarTitulosDoGrupo();
    }

    // 2) acha o título
    const tit = st.titulos.find(t => t.codigo === codigoTitulo);
    if (!tit) { alert('Conta-título não encontrada: ' + codigoTitulo); return; }
    selecionarTitulo(tit);

    // 3) espera carregar subtítulos e seleciona o subtítulo
    let tentativas = 0;
    while (st.subtitulos.length === 0 && tentativas < 30) {
      await new Promise(r => setTimeout(r, 50));
      tentativas++;
    }
    const sub = st.subtitulos.find(s => s.codigo === codigoSubtitulo);
    if (!sub) { alert('Subtítulo não encontrado: ' + codigoSubtitulo); return; }
    selecionarSubtitulo(sub);
  }

  // ============================================================
  // BOLETA (modal)
  // ============================================================
  async function abrirBoleta(boletaId) {
    if (!boletaId) return;
    try {
      const b = await getJson(`${API_PAG}/boleta/${boletaId}`);
      const ehRec = b.tipo === 'RECEBIMENTO';
      $('#bol-titulo').textContent = `Boleta ${b.codigo} — ${b.tipo}`;
      const bancoLinha = `
        <table class="bol-tabela">
          <thead><tr><th>Nº Conta</th><th>Nome</th><th>Histórico</th><th class="v">Valor</th></tr></thead>
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
        <div class="bol-secao">
          <h3>${ehRec ? 'Débito (entrada no banco)' : 'Crédito (saída do banco)'}</h3>
          ${bancoLinha}
        </div>
        <div class="bol-secao">
          <h3>${ehRec ? 'Crédito (receitas)' : 'Débito (contrapartidas)'}</h3>
          <table class="bol-tabela">
            <thead><tr><th>Nº Conta</th><th>Nome</th><th>Histórico</th><th class="v">Valor</th></tr></thead>
            <tbody>${contras}</tbody>
          </table>
          <div class="bol-total">Total: ${fmt(b.valorTotal)}</div>
        </div>`;
      $('#bol-modal').hidden = false;
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  // ============================================================
  // BUSCA RÁPIDA (filtra subtítulos do título atual por nome)
  // ============================================================
  let buscaDebounce = null;
  function configurarBusca() {
    const input = $('#rz-busca');
    const list  = $('#rz-busca-list');

    input.addEventListener('input', () => {
      clearTimeout(buscaDebounce);
      buscaDebounce = setTimeout(() => filtrarBusca(input.value), 150);
    });
    input.addEventListener('focus', () => {
      if (input.value) filtrarBusca(input.value);
    });

    function filtrarBusca(termo) {
      termo = (termo || '').toLowerCase().trim();
      if (!termo) { list.hidden = true; list.innerHTML = ''; return; }
      const candidatos = [];
      if (st.subtitulos.length > 0) {
        for (const s of st.subtitulos) {
          if ((s.nome || '').toLowerCase().includes(termo) ||
              (s.codigo || '').includes(termo)) {
            candidatos.push(s);
          }
        }
      }
      if (candidatos.length === 0) {
        list.innerHTML = '<div class="rz-empty-opt">Nenhum resultado nos subtítulos do título selecionado.</div>';
        list.hidden = false;
        return;
      }
      list.innerHTML = candidatos.map(s =>
        `<div class="rz-opt" data-id="${s._id}">${s.codigo} ${s.nome}</div>`
      ).join('');
      list.hidden = false;
      list.querySelectorAll('.rz-opt').forEach(el => {
        el.addEventListener('click', () => {
          const s = st.subtitulos.find(x => x._id === el.dataset.id);
          if (s) { selecionarSubtitulo(s); list.hidden = true; input.value = ''; }
        });
      });
    }
  }

  // ============================================================
  // DROPDOWNS (abrir/fechar)
  // ============================================================
  function fecharDropdowns() {
    $('#rz-titulo-list').hidden = true;
    $('#rz-sub-list').hidden = true;
    $('#rz-busca-list').hidden = true;
    $('#rz-periodo-pop').hidden = true;
  }

  function configurarCombos() {
    $('#rz-combo-titulo').addEventListener('click', () => {
      const dd = $('#rz-titulo-list');
      const willOpen = dd.hidden;
      fecharDropdowns();
      dd.hidden = !willOpen;
    });
    $('#rz-combo-subtitulo').addEventListener('click', () => {
      if (!st.titulo) return;
      const dd = $('#rz-sub-list');
      const willOpen = dd.hidden;
      fecharDropdowns();
      dd.hidden = !willOpen;
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.rz-combo') &&
          !e.target.closest('.rz-search') &&
          !e.target.closest('.rz-periodo') &&
          !e.target.closest('.rz-periodo-pop')) {
        fecharDropdowns();
      }
    });
  }

  // ============================================================
  // PERÍODO
  // ============================================================
  function configurarPeriodo() {
    $('#rz-periodo').addEventListener('click', (e) => {
      e.stopPropagation();
      const pop = $('#rz-periodo-pop');
      const willOpen = pop.hidden;
      fecharDropdowns();
      pop.hidden = !willOpen;
    });
    $('#rz-periodo-aplicar').addEventListener('click', () => {
      st.de  = $('#rz-de').value;
      st.ate = $('#rz-ate').value;
      atualizarLabelPeriodo();
      $('#rz-periodo-pop').hidden = true;
      if (st.sub) carregarRazao();
    });
  }

  // ============================================================
  // GRUPOS (abas)
  // ============================================================
  function configurarGrupos() {
    $$('.rz-tab').forEach(btn => {
      btn.addEventListener('click', async () => {
        $$('.rz-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        st.grupo = btn.dataset.grupo;
        st.titulo = null; st.sub = null;
        st.titulos = []; st.subtitulos = [];
        $('#rz-titulo-value').textContent = 'Selecione...';
        $('#rz-sub-value').textContent    = 'Selecione um título...';
        renderGrade([]);
        $('#rz-tot-deb').textContent = '0,00';
        $('#rz-tot-cre').textContent = '0,00';
        $('#rz-tot-saldo').textContent = '0,00';
        await carregarTitulosDoGrupo();
      });
    });
  }

  // ============================================================
  // MODAL
  // ============================================================
  $('#bol-close').addEventListener('click',  () => $('#bol-modal').hidden = true);
  $('#bol-fechar').addEventListener('click', () => $('#bol-modal').hidden = true);

  // ============================================================
  // INIT
  // ============================================================
  (function init() {
    inicializarPeriodo();
    configurarCombos();
    configurarPeriodo();
    configurarGrupos();
    configurarBusca();
    carregarTitulosDoGrupo();
  })();

})();
