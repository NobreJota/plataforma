/* Destino: C:\plataformaRota\public\js\contab\contabil\razao.js
 * Tela do Razão — combos Conta-título + Subtítulo, busca rápida,
 * filtro de período, grade de lançamentos, modal de boleta,
 * navegação por contrapartida (clica no código C/PART → pula pra outra conta).
 *
 * Alterado em 06/10/2026: janela da boleta em DÉBITO e CRÉDITO, com o sinal da
 *   convenção (débito +, crédito −). Contrapartida com valor NEGATIVO (ex.: taxa do
 *   cartão num recebimento) vai para o lado oposto, em valor positivo — como o
 *   razão já lança. Valor da boleta = total do débito = total do crédito.
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

    // Sessão do contab expirada: as rotas de API respondem 401 em JSON. Sem
    // este ramo o front tentaria ler a tela de login como JSON e mostraria
    // um erro que não diz nada ao usuário.
    if (r.status === 401) {
      alert('Sua sessão expirou. Faça login novamente.');
      window.location.href = '/usuariocontab/login';
      return new Promise(() => {});   // trava aqui até a navegação acontecer
    }

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
  // O período virou campo fixo na primeira linha, então os próprios inputs já
  // mostram as datas e não existe mais rótulo separado para atualizar.
  function atualizarLabelPeriodo() {
    const el = $('#rz-periodo-label');
    if (el) el.textContent = `${fmtDataBr(st.de)} a ${fmtDataBr(st.ate)}`;
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
      el.addEventListener('click', (ev) => {
        // O dropdown fica DENTRO do .rz-combo. Sem parar aqui, o clique sobe
        // até o combo, cujo handler alterna aberto/fechado — e reabre a lista
        // que acabamos de fechar.
        ev.stopPropagation();
        const t = st.titulos.find(x => x._id === el.dataset.id);
        selecionarTitulo(t);
        fecharDropdowns();
      });
    });
  }

  function selecionarTitulo(t) {
    st.titulo = t;
    st.sub = null;
    atualizarMenuLancamentos();
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
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();   // ver nota no dropdown de conta-título
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
    atualizarMenuLancamentos();
    carregarRazao();
  }

  /* Sem conta escolhida não há de onde tirar a perna única da boleta, então
     o item de Lançamentos fica apagado até a conta ser selecionada. */
  function atualizarMenuLancamentos() {
    const item = $('#rz-menu-lanc');
    if (!item) return;
    item.classList.toggle('desativado', !st.sub);
    item.title = st.sub
      ? `Lançar sobre ${st.sub.codigo} - ${st.sub.nome}`
      : 'Escolha primeiro a conta no razão';
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
        <div class="rz-cpart-nome" title="${l.cPartidaNome || ''}">${l.cPartidaNome || ''}</div>
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
    // clique na C/Partida → abre o popup ao lado, sem sair do razão atual
    body.querySelectorAll('.rz-cpart-link').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        abrirPopContrapartida(el, el.dataset.cod);
      });
    });
  }

  /* Chamada pelo módulo de lançamento depois de gravar, para a boleta nova
     aparecer sem o usuário ter de recarregar a página. */
  window.recarregarRazao = () => { if (st.sub) carregarRazao(); };

  // ============================================================
  // POPUP DA CONTRAPARTIDA
  // Antes o clique trocava o razão na hora. Agora mostra de que conta se
  // trata e só troca se o usuário pedir — quem está conferindo uma conta não
  // perde o lugar por causa de um clique de curiosidade.
  // ============================================================
  let codPopAtual = null;

  function abrirPopContrapartida(elemento, codigo) {
    if (!codigo) return;
    const pop = $('#cp-pop');
    if (!pop) return;

    codPopAtual = codigo;
    $('#cp-cod').textContent  = codigo;
    $('#cp-nome').textContent = nomeDaConta(codigo);

    // Precisa ficar visível antes de medir: elemento escondido tem altura zero
    // e o cálculo de posição sairia errado.
    pop.hidden = false;
    const r = elemento.getBoundingClientRect();
    const alturaPop = pop.offsetHeight;

    // Abre para baixo; se não couber até o fim da janela, abre para cima.
    const cabeAbaixo = (r.bottom + alturaPop + 8) < window.innerHeight;
    const topo = cabeAbaixo ? r.bottom + 6 : r.top - alturaPop - 6;

    pop.style.left = (window.scrollX + r.left) + 'px';
    pop.style.top  = (window.scrollY + topo) + 'px';
  }

  function fecharPopContrapartida() {
    const pop = $('#cp-pop');
    if (pop) pop.hidden = true;
    codPopAtual = null;
  }

  /* Procura o nome nos subtítulos já carregados. Se a conta for de outro
     grupo ela ainda não está em memória, e aí mostramos só o código em vez de
     buscar no servidor a cada clique. */
  function nomeDaConta(codigo) {
    const achado = st.subtitulos.find(s => s.codigo === codigo);
    return achado ? achado.nome : 'Clique em abrir para ver os lançamentos.';
  }

  function configurarPopContrapartida() {
    const btnAbrir  = $('#cp-abrir');
    const btnFechar = $('#cp-fechar');
    if (btnAbrir) {
      btnAbrir.addEventListener('click', (e) => {
        e.stopPropagation();
        const cod = codPopAtual;
        fecharPopContrapartida();
        if (cod) navegarParaConta(cod);
      });
    }
    if (btnFechar) {
      btnFechar.addEventListener('click', (e) => {
        e.stopPropagation();
        fecharPopContrapartida();
      });
    }
  }

  // ============================================================
  // NAVEGAR PRA OUTRA CONTA (botão "Abrir esta conta" do popup)
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
      // Monta os dois lados. RECEBIMENTO: banco a débito, contrapartidas a crédito.
      // PAGAMENTO: o contrário. Contrapartida negativa troca de lado (valor positivo).
      const banco = { cod: b.bancoCodigo, nome: b.bancoNome, hist: b.historico, v: b.valorTotal || 0 };
      const debito = [], credito = [];
      (ehRec ? debito : credito).push(banco);
      for (const c of (b.contrapartidas || [])) {
        const v = c.valor || 0;
        const l = { cod: c.codigoConta, nome: c.nomeConta, hist: c.historico, v: Math.abs(v) };
        const ladoNormal = ehRec ? credito : debito;
        const ladoOposto = ehRec ? debito : credito;
        (v < 0 ? ladoOposto : ladoNormal).push(l);
      }
      const soma = lista => lista.reduce((t, l) => t + l.v, 0);
      const tabela = (lista, sinal) => `
        <table class="bol-tabela">
          <thead><tr><th>Nº Conta</th><th>Nome</th><th>Histórico</th><th class="v">Valor</th></tr></thead>
          <tbody>${lista.map(l => `
            <tr>
              <td class="bol-cod">${l.cod || '-'}</td>
              <td>${l.nome || '-'}</td>
              <td>${l.hist || ''}</td>
              <td class="v">${sinal}${fmt(l.v)}</td>
            </tr>`).join('')}</tbody>
        </table>`;
      const totD = soma(debito), totC = soma(credito);
      $('#bol-body').innerHTML = `
        <div class="bol-secao">
          <h3>Débito${ehRec ? ' (entrada no banco)' : ''}</h3>
          ${tabela(debito, '')}
          <div class="bol-total">Total débito: ${fmt(totD)}</div>
        </div>
        <div class="bol-secao">
          <h3>Crédito${ehRec ? '' : ' (saída do banco)'}</h3>
          ${tabela(credito, '-')}
          <div class="bol-total">Total crédito: -${fmt(totC)}</div>
        </div>
        <div class="bol-total" style="margin-top:6px">Valor da boleta: ${fmt(totD)}${
          Math.round(totD * 100) !== Math.round(totC * 100) ? ' &nbsp;<span style="color:#dc2626">(débito e crédito não batem!)</span>' : ''}</div>`;
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
    fecharMenus();
    fecharPopContrapartida();
  }

  function fecharMenus() {
    const drop = $('#rz-menu-lanc-drop');
    if (drop) drop.hidden = true;
    $$('.rz-menu-item').forEach(el => el.classList.remove('aberto'));
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
          !e.target.closest('.rz-periodo-box') &&
          !e.target.closest('.rz-cp-pop') &&
          !e.target.closest('.rz-menu')) {
        fecharDropdowns();
      }
    });
  }

  // ============================================================
  // MENU DE AÇÕES (Lançamentos / Transferir saldo / Imprimir)
  // ============================================================
  function configurarMenu() {
    const item = $('#rz-menu-lanc');
    const drop = $('#rz-menu-lanc-drop');
    if (!item || !drop) return;

    item.addEventListener('click', (e) => {
      e.stopPropagation();

      // Sem conta no razão não há de onde tirar a perna única da boleta, então
      // o submenu nem chega a abrir — mostrar Crédito e Débito para depois
      // recusar seria oferecer o que não funciona.
      if (!st.sub) {
        fecharDropdowns();
        return;
      }

      const vaiAbrir = drop.hidden;
      fecharDropdowns();
      drop.hidden = !vaiAbrir;
      item.classList.toggle('aberto', vaiAbrir);
    });

    drop.addEventListener('click', (e) => {
      const acao = e.target.dataset.acao;
      if (!acao) return;
      e.stopPropagation();
      fecharMenus();

      // A boleta nasce da conta que está aberta no razão: é ela que vira a
      // perna única do lançamento.
      if (!st.sub) {
        alert('Escolha primeiro a conta no razão.');
        return;
      }
      if (typeof Lancamento === 'undefined') {
        alert('lancamento.js não carregou.');
        return;
      }
      Lancamento.abrir({
        modo: acao === 'lanc-debito' ? 'debito' : 'credito',
        conta: { codigo: st.sub.codigo, nome: st.sub.nome, _id: st.sub._id }
      });
    });

    const btnImprimir = $('#rz-menu-imprimir');
    if (btnImprimir) {
      btnImprimir.addEventListener('click', (e) => {
        e.stopPropagation();
        fecharDropdowns();   // popups abertos sairiam impressos junto
        window.print();
      });
    }
  }

  // ============================================================
  // PERÍODO
  // ============================================================
  function configurarPeriodo() {
    $('#rz-periodo-aplicar').addEventListener('click', () => {
      st.de  = $('#rz-de').value;
      st.ate = $('#rz-ate').value;
      atualizarLabelPeriodo();
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
        atualizarMenuLancamentos();
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
    configurarMenu();
    atualizarMenuLancamentos();
    configurarPopContrapartida();
    configurarPeriodo();
    configurarGrupos();
    configurarBusca();
    carregarTitulosDoGrupo();
  })();

})();
