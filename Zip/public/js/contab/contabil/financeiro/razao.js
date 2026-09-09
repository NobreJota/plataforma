/* public/js/contabil/razao.js
 * Tela do Razão (nova) — combos Conta-título + Subtítulo, busca rápida,
 * filtro de período via calendário, grade de lançamentos, modal de boleta,
 * navegação por contrapartida (clica no código C/PART. → pula pra outra conta).
 */
(() => {
  'use strict';
  console.log('%c📘 razao.js v1.0', 'background:#1d4ed8;color:white;padding:4px 10px;border-radius:4px');

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const API_CONTAB = '/contab/api';
  const API_RAZAO  = '/financeiro/api/razao';
  const API_PAG    = '/financeiro/api/pagamento';

  // estado
  const st = {
    grupo: '1',                    // 1=Ativo, 2=Passivo, 3=Despesa, 4=Receita
    titulos: [],                   // [{_id, codigo, nome}]
    titulo: null,                  // título selecionado
    subtitulos: [],                // [{_id, codigo, nome}]
    sub: null,                     // subtítulo selecionado
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
  function isoHoje(offsetDias = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDias);
    return d.toISOString().slice(0,10);
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
      // ordena por código
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
    renderGrade([]);   // limpa
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
      // extrai só os 3 últimos dígitos (sequencial) para exibir compacto
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
      $('#rz-tot-deb').textContent   = fmt(d.totalDebito);
      $('#rz-tot-cre').textContent   = fmt(d.totalCredito);
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
      const cpart = l.boletaId ? cpartidaLink(l, st.sub.codigo) : '<span class="rz-dash">—</span>';
      return `<div class="rz-row">
        <div><span class="rz-chave-link" data-bid="${l.boletaId}">${chaveTxt}</span></div>
        <div>${fmtData(l.data)}</div>
        <div>${cpart}</div>
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
    // clique na contrapartida → pula pra outra conta
    body.querySelectorAll('.rz-cpart-link').forEach(el => {
      el.addEventListener('click', () => pularPara(el.dataset.cod));
    });
  }

  // Determina a contrapartida da linha a partir da boleta
  function cpartidaLink(l, contaAtual) {
    // O razao-api não devolve C/Partida na linha. Fazemos uma busca rápida na boleta.
    // Estratégia simples: deixar o código aparecer quando o usuário passar o mouse —
    // mas o melhor é resolver no clique. Para evitar fazer N+1 fetch agora,
    // colocamos um placeholder clicável que, ao clicar, busca a boleta e pergunta
    // "qual contrapartida abrir?" caso tenha mais de uma. Como hoje a maioria das
    // boletas tem 1 contrapartida, abre direto.
    return `<span class="rz-cpart-link" data-bid="${l.boletaId}" data-conta-atual="${contaAtual}">ver →</span>`;
  }

  async function pularPara(boletaId) {
    // este caminho é chamado pelo click no "ver →" da C/Partida.
    // Pega a boleta, identifica a contrapartida que NÃO é a conta atual,
    // e navega pra ela.
  }

  // intercepta clique no "ver →"
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('.rz-cpart-link');
    if (!el) return;
    const bid = el.dataset.bid;
    const contaAtual = el.dataset.contaAtual;
    try {
      const b = await getJson(`${API_PAG}/boleta/${bid}`);
      // se a conta atual é o banco, contrapartida(s) são as contrapartidas
      // se a conta atual é uma contrapartida, contrapartida é o banco
      let destino = null;
      if (b.bancoCodigo === contaAtual) {
        // pega a primeira contrapartida diferente
        destino = (b.contrapartidas || []).find(c => c.codigoConta && c.codigoConta !== contaAtual);
        if (destino) destino = destino.codigoConta;
      } else {
        destino = b.bancoCodigo;
      }
      if (!destino) { alert('Não foi possível identificar a contrapartida.'); return; }
      await navegarParaConta(destino);
    } catch (err) {
      alert('Erro ao abrir contrapartida: ' + err.message);
    }
  });

  // Navega pra outra conta: muda grupo/titulo/subtitulo e recarrega razão
  async function navegarParaConta(codigoSubtitulo) {
    // O código é tipo "3.01.001.003". O primeiro dígito é o grupo.
    const grupo = codigoSubtitulo.charAt(0);
    const codigoTitulo = codigoSubtitulo.split('.').slice(0,3).join('.'); // "3.01.001"

    // 1) muda grupo
    if (st.grupo !== grupo) {
      st.grupo = grupo;
      $$('.rz-tab').forEach(b => b.classList.toggle('active', b.dataset.grupo === grupo));
      await carregarTitulosDoGrupo();
    }
    // 2) acha o título
    const tit = st.titulos.find(t => t.codigo === codigoTitulo);
    if (!tit) { alert('Conta-título não encontrada: ' + codigoTitulo); return; }
    selecionarTitulo(tit);
    // 3) espera carregar subtítulos e acha o subtítulo
    // selecionarTitulo dispara carregarSubtitulos (async). Esperamos:
    await new Promise(r => setTimeout(r, 50));
    let tentativas = 0;
    while (st.subtitulos.length === 0 && tentativas < 20) {
      await new Promise(r => setTimeout(r, 50));
      tentativas++;
    }
    const sub = st.subtitulos.find(s => s.codigo === codigoSubtitulo);
    if (!sub) { alert('Subtítulo não encontrado: ' + codigoSubtitulo); return; }
    selecionarSubtitulo(sub);
  }

  // ============================================================
  // BOLETA
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
      // busca em TODOS os subtítulos do grupo atual (não só do título atual)
      // para isso percorre os títulos e seus subtítulos JÁ carregados;
      // se nenhum título foi escolhido ainda, busca também buscando subtítulos diretamente.
      const candidatos = [];
      if (st.titulos.length === 0) return;
      // Estratégia simples: busca em todos os subtítulos do título atual, se houver.
      // (mais rico exigiria uma rota de busca global; deixamos pra fase 2.)
      if (st.subtitulos.length > 0) {
        for (const s of st.subtitulos) {
          if ((s.nome || '').toLowerCase().includes(termo) ||
              (s.codigo || '').includes(termo)) {
            candidatos.push({ sub: s, titulo: st.titulo });
          }
        }
      }
      if (candidatos.length === 0) {
        list.innerHTML = '<div class="rz-empty-opt">Nenhum resultado. (busca atual: subtítulos do título selecionado)</div>';
        list.hidden = false;
        return;
      }
      list.innerHTML = candidatos.map(c =>
        `<div class="rz-opt" data-id="${c.sub._id}">${c.sub.codigo} ${c.sub.nome}</div>`
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
    $('#rz-combo-titulo').addEventListener('click', (e) => {
      const dd = $('#rz-titulo-list');
      const willOpen = dd.hidden;
      fecharDropdowns();
      dd.hidden = !willOpen;
    });
    $('#rz-combo-subtitulo').addEventListener('click', (e) => {
      if (!st.titulo) return;
      const dd = $('#rz-sub-list');
      const willOpen = dd.hidden;
      fecharDropdowns();
      dd.hidden = !willOpen;
    });
    // fecha ao clicar fora
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
        // reset
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
    carregarTitulosDoGrupo();   // começa em Ativo
  })();

})();
