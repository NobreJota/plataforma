/* public/js/contab/contabil/contabil-plano.js
 * Alterado em: 02/10/2026 - nas Contas-titulo de subgrupo com muitas contas (> 200
 *   subtitulos) aparece uma caixa de busca: 2 letras procuram em todos os titulos
 *   do subgrupo; clicar no achado abre o titulo com a conta marcada.
 * Plano de Contas - 4 níveis: Grupo → SubGrupo → ContaTitulo → ContaSubTitulo
 * API: /contab/api/...
 */
(() => {
  'use strict';

  const API = '/contab/api';   // ← prefixo unificado
  const $   = (sel) => document.querySelector(sel);
  const $$  = (sel) => document.querySelectorAll(sel);

  const state = {
    grupoAtual:     null,
    subGrupoAtual:  null,
    tituloAtual:    null,
    subtituloAtual: null,
    modo:           null,
    nivel:          null,
    titulos:        [],     // os titulos do subgrupo aberto (para a busca abrir o certo)
    marcarCodigo:   null    // subtitulo a marcar quando os subtitulos abrirem
  };

  const MUITAS_CONTAS = 200;   // a partir daqui o subgrupo ganha a caixa de busca

  const abrir = (id) => $('#' + id).hidden = false;

  const MODAIS_PLANO = ['modal-grupos', 'modal-subgrupos', 'modal-titulos',
                        'modal-subtitulos', 'modal-form'];

  /* Esconde os modais do plano sem passar por fechar(), que reabriria o pai.
     Usado quando outra caixa toma a tela. */
  function esconderModaisPlano() {
    MODAIS_PLANO.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  // Ao fechar um modal, reabre o de trás em vez de deixar a tela em branco.
  // Vale tanto para o botão "Voltar" quanto para o X do cabeçalho.
  const PAI = {
    'modal-subgrupos': () => abrirGrupos()
  };

  function fechar(id) {
    $('#' + id).hidden = true;
    const voltarPara = PAI[id];
    if (voltarPara) voltarPara();
  }

  document.addEventListener('click', (e) => {
    const id = e.target.dataset.close;
    if (id) fechar(id);
  });

  /* ============================================================
     CAIXAS DE DIÁLOGO PRÓPRIAS
     Substituem confirm() e alert() do navegador. As nativas mostram
     "localhost:5000 diz" no topo e não aceitam estilo nenhum.
     Tudo é montado aqui no JS de propósito: assim o handlebars não precisa
     de marcação nova e estas funções servem em qualquer tela do contab.
     ============================================================ */
  (function injetarEstiloDialogo() {
    if (document.getElementById('cx-estilo')) return;
    const st = document.createElement('style');
    st.id = 'cx-estilo';
    st.textContent = `
      .cx-fundo { position:fixed; inset:0; background:rgba(15,23,42,.55);
        display:flex; align-items:center; justify-content:center; z-index:9999; }
      .cx-caixa { background:#fff; border-radius:8px; width:min(420px,92vw);
        box-shadow:0 18px 45px rgba(0,0,0,.3); overflow:hidden;
        font-family:inherit; animation:cx-entra .12s ease-out; }
      @keyframes cx-entra { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
      .cx-topo { background:#1d4ed8; color:#fff; padding:12px 18px;
        font-weight:600; font-size:15px; }
      .cx-topo.cx-perigo { background:#b91c1c; }
      .cx-corpo { padding:20px 18px; color:#1e293b; font-size:14px;
        line-height:1.5; white-space:pre-line; }
      .cx-pe { padding:12px 18px 16px; display:flex; gap:10px; justify-content:flex-end; }
      .cx-btn { padding:8px 18px; border-radius:6px; border:1px solid #cbd5e1;
        background:#fff; cursor:pointer; font-size:14px; font-family:inherit; }
      .cx-btn:hover { background:#f1f5f9; }
      .cx-btn-ok { background:#1d4ed8; border-color:#1d4ed8; color:#fff; }
      .cx-btn-ok:hover { background:#1e40af; }
      .cx-btn-perigo { background:#b91c1c; border-color:#b91c1c; color:#fff; }
      .cx-btn-perigo:hover { background:#991b1b; }
    `;
    document.head.appendChild(st);
  })();

  function montarDialogo({ titulo, mensagem, okTexto, cancelar, perigo }) {
    return new Promise((resolve) => {
      const fundo = document.createElement('div');
      fundo.className = 'cx-fundo';
      fundo.innerHTML = `
        <div class="cx-caixa" role="dialog" aria-modal="true">
          <div class="cx-topo ${perigo ? 'cx-perigo' : ''}">${titulo}</div>
          <div class="cx-corpo"></div>
          <div class="cx-pe">
            ${cancelar ? '<button class="cx-btn" data-r="0">Cancelar</button>' : ''}
            <button class="cx-btn ${perigo ? 'cx-btn-perigo' : 'cx-btn-ok'}" data-r="1">${okTexto}</button>
          </div>
        </div>`;
      // textContent, e não innerHTML: o nome da conta vem do banco e não deve
      // ser interpretado como HTML.
      fundo.querySelector('.cx-corpo').textContent = mensagem;

      function encerrar(valor) {
        document.removeEventListener('keydown', aoTeclar);
        fundo.remove();
        resolve(valor);
      }
      function aoTeclar(ev) {
        if (ev.key === 'Escape') encerrar(false);
        if (ev.key === 'Enter')  encerrar(true);
      }

      fundo.addEventListener('click', (ev) => {
        const r = ev.target.dataset.r;
        if (r !== undefined) encerrar(r === '1');
        else if (ev.target === fundo && cancelar) encerrar(false);   // clique fora
      });
      document.addEventListener('keydown', aoTeclar);

      document.body.appendChild(fundo);
      fundo.querySelector('.cx-btn[data-r="1"]').focus();
    });
  }

  // Aviso simples, no lugar de alert().
  const avisar = (mensagem, titulo = 'Aviso') =>
    montarDialogo({ titulo, mensagem, okTexto: 'OK', cancelar: false, perigo: false });

  // Pergunta sim/não, no lugar de confirm(). Devolve true/false.
  const perguntar = (mensagem, okTexto = 'Confirmar', titulo = 'Confirmação') =>
    montarDialogo({ titulo, mensagem, okTexto, cancelar: true, perigo: true });

  /* ============================================================
     CONTAS SUSPENSAS DENTRO DAS LISTAS
     As listas passaram a trazer também as contas suspensas, em cinza e com
     etiqueta. Assim a conta é reativada no mesmo lugar onde ela estava, sem
     precisar procurar em outra tela.
     ============================================================ */
  (function injetarEstiloSuspensa() {
    if (document.getElementById('cx-estilo-susp')) return;
    const st = document.createElement('style');
    st.id = 'cx-estilo-susp';
    st.textContent = `
      .item.suspensa, #lista-grupos button.suspensa { opacity:.55; }
      .item.suspensa { font-style:italic; }
      .badge-susp { display:inline-block; margin-left:8px; padding:1px 7px;
        border-radius:10px; font-size:11px; font-style:normal;
        background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; }
    `;
    document.head.appendChild(st);
  })();

  const etiquetaSuspensa = (reg) =>
    reg.ativo === false ? '<span class="badge-susp">suspensa</span>' : '';

  /* Pergunta ao servidor se a conta pode ser suspensa ANTES de mostrar a
     confirmação. Sem isso o usuário confirma uma ação que já se sabe que vai
     ser recusada, e só descobre o motivo depois. Devolve true se pode.
     A mesma checagem continua acontecendo no DELETE — esta aqui é só para a
     ordem das telas fazer sentido, não é a trava de verdade. */
  async function confirmarSuspensao(nivel, rotulo, reg) {
    let r;
    try {
      r = await api('GET', `/pode-suspender/${nivel}/${reg._id}`);
    } catch (err) {
      // Sem try/catch aqui o erro sumia e o botão parecia não fazer nada,
      // que é pior do que falhar avisando.
      await avisar(
        'Não consegui verificar se a conta tem movimento.\n\n' + err.message,
        'Falha na verificação'
      );
      return false;
    }
    if (!r.pode) {
      await avisar(r.erro, 'Não foi possível');
      return false;
    }
    return perguntar(
      `Suspender o ${rotulo} ${reg.codigo} - ${reg.nome}?\n\n` +
      `A conta sai das listas mas continua guardada, e pode ser reativada depois.`,
      'Suspender'
    );
  }

  /* Chamado quando o usuário clica numa linha suspensa. Devolve true se a
     conta foi reativada, para quem chamou recarregar a lista. */
  async function tentarReativar(nivel, reg) {
    const ok = await perguntar(
      `A conta ${reg.codigo} - ${reg.nome} está suspensa.\n\nReativar?`,
      'Reativar',
      'Conta suspensa'
    );
    if (!ok) return false;
    try {
      await api('POST', `/suspensas/${nivel}/${reg._id}/reativar`);
      return true;
    } catch (err) {
      await avisar(err.message, 'Não foi possível reativar');
      return false;
    }
  }

  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);

    // 401 = sessão do contab expirada. O servidor responde em JSON (e não com
    // a tela de login) para as chamadas de API, então é aqui que a gente leva
    // o usuário de volta ao login em vez de mostrar um erro solto na tela.
    if (res.status === 401) {
      await avisar('Sua sessão expirou. Faça login novamente.', 'Sessão encerrada');
      window.location.href = '/usuariocontab/login';
      // A navegação não é instantânea. Devolvendo uma Promise que nunca resolve,
      // quem chamou esta função para aqui e não dispara um segundo alerta por
      // cima do primeiro.
      return new Promise(() => {});
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
    return data;
  }

  /* Ctrl + duplo clique desce um nível, como o botão da direita.
     O botão continua existindo: o atalho é para quem já conhece a tela, e
     ninguém descobre um atalho sem que alguém conte. */
  function ligarAtalhoDescer(item, registro, slot, listaId, descer) {
    // Dica no hover: sem isso o atalho fica invisível para quem chega agora.
    if (registro.ativo !== false) item.title = 'Ctrl + duplo clique para abrir';

    item.addEventListener('dblclick', (e) => {
      if (!e.ctrlKey) return;
      if (registro.ativo === false) return;   // suspensa não navega, só reativa
      e.preventDefault();
      selecionarItem(listaId, item, registro, slot);
      descer();
    });
  }

  function selecionarItem(listaId, item, registro, slot) {
    $$(`#${listaId} .item`).forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    state[slot] = registro;
  }

  // ============================================================
  // NÍVEL 1: GRUPOS
  // ============================================================
  async function abrirGrupos() {
    // As duas caixas ocupam o mesmo lugar da tela: abrir uma fecha a outra.
    const busca = document.querySelector('.sp-fundo');
    if (busca) busca.hidden = true;

    const lista = $('#lista-grupos');
    lista.innerHTML = '<div class="empty">Carregando...</div>';
    abrir('modal-grupos');
    try {
      const grupos = await api('GET', '/grupos');
      if (!grupos.length) {
        lista.innerHTML = '<div class="empty">Nenhum grupo cadastrado. Rode o seed.</div>';
        return;
      }
      lista.innerHTML = '';
      grupos.forEach(g => {
        const btn = document.createElement('button');
        // Número e nome em elementos separados, para o CSS alinhar cada um
        // na sua coluna.
        btn.innerHTML = `<span class="gr-num">${g.codigo}</span><span>${g.nome}</span>`;
        btn.onclick = () => abrirSubGrupos(g);
        lista.appendChild(btn);
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  // O botão continua reabrindo o modal se o usuário fechar no X...
  $('#btn-abrir-grupos').addEventListener('click', abrirGrupos);

  /* ============================================================
     BUSCA DE CONTAS SUSPENSAS

     As suspensas já aparecem em cinza dentro das listas, o que resolve quando
     se sabe onde a conta estava. Esta busca resolve o outro caso: lembrar o
     nome e não o lugar. Com muitos clientes e fornecedores, procurar nível a
     nível deixa de ser viável.

     Tudo é montado aqui no JS, inclusive o botão, para o handlebars não
     precisar de marcação nova.
     ============================================================ */
  (function montarBuscaSuspensas() {
    const estilo = document.createElement('style');
    estilo.textContent = `
      /* Mesma posição e mesmo comportamento dos modais do plano: centralizada
         e sem véu escuro, porque as duas caixas se revezam no mesmo ponto e
         escurecer o fundo a cada troca deixava a tela piscando. */
      .sp-fundo { position: fixed; inset: 0;
        display: flex; align-items: center; justify-content: center;
        z-index: 9998; pointer-events: none; }
      .sp-fundo > * { pointer-events: auto; }
      .sp-fundo[hidden] { display: none !important; }
      /* Mesma largura e altura dos modais do plano, para as duas caixas se
         revezarem sem a tela mudar de tamanho a cada troca. */
      .sp-caixa { background: #fff; border-radius: 12px;
        width: 860px; max-width: 94vw; height: 440px;
        border: 1px solid #c7d7fe;
        box-shadow: 0 20px 60px rgba(29,78,216,.18); overflow: hidden;
        display: flex; flex-direction: column; }
      .sp-topo { background: #1d4ed8; color: #fff; padding: 12px 16px;
        display: flex; align-items: center; gap: 10px; }
      .sp-topo h3 { margin: 0; font-size: 15px; font-weight: 600; }
      .sp-x { margin-left: auto; background: transparent; border: 0; color: #fff;
        font-size: 20px; line-height: 1; cursor: pointer; }
      .sp-busca { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
      .sp-busca input { width: 100%; box-sizing: border-box; height: 34px;
        border: 1px solid #9ca3af; border-radius: 6px; padding: 4px 10px;
        font-size: 14px; font-family: inherit; }
      .sp-busca input:focus { outline: 2px solid #bfdbfe; border-color: #1d4ed8; }
      .sp-lista { overflow: auto; flex: 1; }
      .sp-item { display: flex; align-items: center; gap: 10px;
        padding: 10px 16px; border-bottom: 1px solid #f3f4f6; }
      .sp-item:hover { background: #fafafa; }
      .sp-nivel { font-size: 10px; color: #6b7280; background: #f3f4f6;
        border-radius: 10px; padding: 2px 8px; white-space: nowrap; }
      .sp-cod { font-family: ui-monospace, monospace; font-size: 13px; color: #1d4ed8; }
      .sp-nome { flex: 1; font-size: 13px; color: #111;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sp-reativar { border: 1px solid #1d4ed8; background: #fff; color: #1d4ed8;
        border-radius: 6px; padding: 5px 12px; font-size: 12px;
        font-family: inherit; cursor: pointer; }
      .sp-reativar:hover { background: #eef2ff; }
      .sp-vazio { padding: 26px; text-align: center; color: #9ca3af; font-size: 13px; }
      /* O botão entra na .plano-barra, que já cuida do espaçamento. */
    `;
    document.head.appendChild(estilo);

    // Botão ao lado do que abre o plano.
    const btnPlano = $('#btn-abrir-grupos');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = btnPlano ? btnPlano.className : 'btn-primary';
    btn.textContent = 'Contas suspensas';
    if (btnPlano && btnPlano.parentNode) {
      btnPlano.parentNode.insertBefore(btn, btnPlano.nextSibling);
    } else {
      document.body.appendChild(btn);
    }

    const fundo = document.createElement('div');
    fundo.className = 'sp-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="sp-caixa">
        <div class="sp-topo">
          <h3>Contas suspensas</h3>
          <button class="sp-x" title="Fechar">×</button>
        </div>
        <div class="sp-busca">
          <input type="text" placeholder="digite o nome da conta" autocomplete="off">
        </div>
        <div class="sp-lista"><div class="sp-vazio">Carregando...</div></div>
      </div>`;
    document.body.appendChild(fundo);

    const entrada = fundo.querySelector('.sp-busca input');
    const lista   = fundo.querySelector('.sp-lista');

    const rotulos = { subgrupo: 'SubGrupo', titulo: 'Conta-título', subtitulo: 'Sub-título' };

    async function procurar() {
      const termo = entrada.value.trim();
      lista.innerHTML = '<div class="sp-vazio">Procurando...</div>';
      try {
        const achados = await api('GET', `/suspensas?busca=${encodeURIComponent(termo)}`);
        if (!achados.length) {
          lista.innerHTML = `<div class="sp-vazio">${
            termo ? 'Nenhuma conta suspensa com esse nome.' : 'Nenhuma conta suspensa.'
          }</div>`;
          return;
        }
        lista.innerHTML = '';
        achados.forEach(a => lista.appendChild(montarItem(a)));
      } catch (err) {
        lista.innerHTML = `<div class="sp-vazio">Erro: ${err.message}</div>`;
      }
    }

    function montarItem(a) {
      const div = document.createElement('div');
      div.className = 'sp-item';
      div.innerHTML = `
        <span class="sp-nivel">${rotulos[a.nivel] || a.nivel}</span>
        <span class="sp-cod">${a.codigo}</span>
        <span class="sp-nome" title="${a.nome}">${a.nome}</span>`;

      const b = document.createElement('button');
      b.className = 'sp-reativar';
      b.textContent = 'Reativar';
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          await api('POST', `/suspensas/${a.nivel}/${a._id}/reativar`);
          div.remove();
          if (!lista.querySelector('.sp-item')) {
            lista.innerHTML = '<div class="sp-vazio">Nenhuma conta suspensa.</div>';
          }
        } catch (err) {
          b.disabled = false;
          await avisar(err.message, 'Não foi possível reativar');
        }
      });
      div.appendChild(b);
      return div;
    }

    let atraso = null;
    entrada.addEventListener('input', () => {
      // Espera a digitação parar: uma consulta por tecla castigaria o servidor
      // e as respostas chegariam fora de ordem.
      clearTimeout(atraso);
      atraso = setTimeout(procurar, 250);
    });

    /* Fechar a busca devolve o plano, em vez de deixar a tela vazia. */
    const fecharBusca = () => {
      fundo.hidden = true;
      abrirGrupos();
    };
    fundo.querySelector('.sp-x').addEventListener('click', fecharBusca);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !fundo.hidden) fecharBusca();
    });

    btn.addEventListener('click', () => {
      esconderModaisPlano();      // uma caixa por vez
      fundo.hidden = false;
      entrada.value = '';
      entrada.focus();
      procurar();
    });
  })();

  // ...e aqui ele abre sozinho ao carregar a página, para não começar em branco.
  abrirGrupos();

  // ============================================================
  // NÍVEL 2: SUBGRUPOS
  // ============================================================
  async function abrirSubGrupos(grupo) {
    state.grupoAtual = grupo;
    state.subGrupoAtual = null;
    $('#titulo-modal-subgrupos').textContent = `${grupo.codigo} - ${grupo.nome} · SubGrupos`;
    fechar('modal-grupos');
    abrir('modal-subgrupos');
    await recarregarSubGrupos();
  }

  async function recarregarSubGrupos() {
    const lista = $('#lista-subgrupos');
    lista.innerHTML = '<div class="empty">Carregando...</div>';
    try {
      const subs = await api('GET', `/subgrupos/${state.grupoAtual._id}`);
      if (!subs.length) {
        lista.innerHTML = '<div class="empty">Nenhum subgrupo. Clique em ➕ Inserir.</div>';
        return;
      }
      lista.innerHTML = '';
      subs.forEach(s => {
        const item = document.createElement('div');
        item.className = 'item' + (s.ativo === false ? ' suspensa' : '');
        item.innerHTML = `${s.codigo} - ${s.nome} ${etiquetaSuspensa(s)}`;
        item.onclick = async () => {
          if (s.ativo === false) {
            if (await tentarReativar('subgrupo', s)) await recarregarSubGrupos();
            return;   // conta suspensa não pode ser selecionada para trabalhar
          }
          selecionarItem('lista-subgrupos', item, s, 'subGrupoAtual');
        };
        ligarAtalhoDescer(item, s, 'subGrupoAtual', 'lista-subgrupos', abrirTitulos);
        lista.appendChild(item);
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  $('#modal-subgrupos').addEventListener('click', async (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;

    /* Subgrupo é definido pela administração da plataforma: se cada empresa
       criasse os seus, o plano deixaria de ser comparável entre as cooperadas.
       O servidor recusa; este aviso explica em vez de mostrar um erro seco. */
    if (acao === 'inserir-subgrupo' || acao === 'alterar-subgrupo' || acao === 'deletar-subgrupo') {
      return avisar(
        'Os subgrupos são definidos pela administração da plataforma.\n\n' +
        'Crie títulos e subtítulos dentro do subgrupo, ou peça a inclusão de um ' +
        'novo subgrupo à administração.',
        'Estrutura do plano'
      );
    }
    else if (acao === 'abrir-titulos') {
      if (!state.subGrupoAtual) return avisar('Selecione um subgrupo primeiro.');
      abrirTitulos();
    }
  });

  // ============================================================
  // NÍVEL 3: CONTAS TÍTULO
  // ============================================================
  async function abrirTitulos() {
    state.tituloAtual = null;
    $('#titulo-modal-titulos').textContent =
      `${state.subGrupoAtual.codigo} - ${state.subGrupoAtual.nome} · Contas-título`;
    const caixa = $('#busca-sub-titulos');
    caixa.value = '';
    caixa.hidden = true;
    abrir('modal-titulos');
    await recarregarTitulos();
    // so em subgrupo com muitas contas
    try {
      const r = await api('GET', `/busca-subtitulos/${state.subGrupoAtual._id}`);
      if (r.total > MUITAS_CONTAS) caixa.hidden = false;
    } catch (err) { /* sem busca, a tela segue normal */ }
  }

  // ---- busca de subtitulos em todos os titulos do subgrupo ----
  let esperaBusca = null;
  $('#busca-sub-titulos').addEventListener('input', () => {
    clearTimeout(esperaBusca);
    esperaBusca = setTimeout(buscarSubtitulos, 300);
  });

  async function buscarSubtitulos() {
    const q = $('#busca-sub-titulos').value.trim();
    if (q.length < 2) { await recarregarTitulos(); return; }   // volta a lista de titulos
    const lista = $('#lista-titulos');
    lista.innerHTML = '<div class="empty">Procurando...</div>';
    try {
      const r = await api('GET', `/busca-subtitulos/${state.subGrupoAtual._id}?q=${encodeURIComponent(q)}`);
      if (!r.itens.length) { lista.innerHTML = '<div class="empty">Nenhuma conta com esse nome ou código.</div>'; return; }
      lista.innerHTML = '';
      r.itens.forEach(s => {
        const item = document.createElement('div');
        item.className = 'item achado' + (s.ativo === false ? ' suspensa' : '');
        item.innerHTML = `${s.codigo} - ${s.nome} <span class="tit">· ${s.codigoContaTitulo}</span> ${etiquetaSuspensa(s)}`;
        item.title = 'clique para abrir o título com esta conta marcada';
        item.onclick = async () => {
          const t = state.titulos.find(x => String(x._id) === String(s.contaTituloId));
          if (!t) return;
          state.tituloAtual = t;
          state.marcarCodigo = s.codigo;
          await abrirSubtitulos();
        };
        lista.appendChild(item);
      });
      if (r.itens.length >= r.limite) {
        const mais = document.createElement('div');
        mais.className = 'empty';
        mais.textContent = `Mostrando os primeiros ${r.limite}. Digite mais letras para afinar.`;
        lista.appendChild(mais);
      }
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  async function recarregarTitulos() {
    const lista = $('#lista-titulos');
    lista.innerHTML = '<div class="empty">Carregando...</div>';
    try {
      const tits = await api('GET', `/titulos/${state.subGrupoAtual._id}`);
      state.titulos = tits;
      if (!tits.length) {
        lista.innerHTML = '<div class="empty">Nenhum título. Clique em ➕ Inserir.</div>';
        return;
      }
      lista.innerHTML = '';
      tits.forEach(t => {
        const item = document.createElement('div');
        item.className = 'item' + (t.ativo === false ? ' suspensa' : '');
        // Título é sempre sintético (o lançamento vive no subtítulo): a etiqueta
        // repetida em toda linha só ocupava espaço. Fica apenas a exceção.
        const badge = t.aceitaLancamento ? '<span class="badge">analítica</span>' : '';
        item.innerHTML = `${t.codigo} - ${t.nome} ${badge} ${etiquetaSuspensa(t)}`;
        item.onclick = async () => {
          if (t.ativo === false) {
            if (await tentarReativar('titulo', t)) await recarregarTitulos();
            return;
          }
          selecionarItem('lista-titulos', item, t, 'tituloAtual');
        };
        ligarAtalhoDescer(item, t, 'tituloAtual', 'lista-titulos', abrirSubtitulos);
        lista.appendChild(item);
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  $('#modal-titulos').addEventListener('click', async (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;

    if (acao === 'inserir-titulo') abrirForm('titulo', 'inserir');
    else if (acao === 'alterar-titulo') {
      if (!state.tituloAtual) return avisar('Selecione um título primeiro.');
      abrirForm('titulo', 'alterar', state.tituloAtual);
    }
    else if (acao === 'deletar-titulo') {
      if (!state.tituloAtual) return avisar('Selecione um título primeiro.');
      const ok = await confirmarSuspensao('titulo', 'conta-título', state.tituloAtual);
      if (!ok) return;
      try {
        await api('DELETE', `/titulos/${state.tituloAtual._id}`);
        state.tituloAtual = null;
        await recarregarTitulos();
      } catch (err) { avisar(err.message, 'Não foi possível'); }
    }
    else if (acao === 'abrir-subtitulos') {
      if (!state.tituloAtual) return avisar('Selecione um título primeiro.');
      abrirSubtitulos();
    }
  });

  // ============================================================
  // NÍVEL 4: SUB-TÍTULOS
  // ============================================================
  async function abrirSubtitulos() {
    state.subtituloAtual = null;
    $('#titulo-modal-subtitulos').textContent =
      `${state.tituloAtual.codigo} - ${state.tituloAtual.nome} · Sub-títulos`;
    abrir('modal-subtitulos');
    await recarregarSubtitulos();
  }

  async function recarregarSubtitulos() {
    const lista = $('#lista-subtitulos');
    lista.innerHTML = '<div class="empty">Carregando...</div>';
    try {
      const subs = await api('GET', `/subtitulos/${state.tituloAtual._id}`);
      if (!subs.length) {
        lista.innerHTML = '<div class="empty">Nenhum subtítulo. Clique em ➕ Inserir.</div>';
        return;
      }
      lista.innerHTML = '';
      subs.forEach(s => {
        const item = document.createElement('div');
        item.className = 'item' + (s.ativo === false ? ' suspensa' : '');
        // A natureza sai do grupo da conta e é sempre a mesma dentro do título:
        // repetir "devedora" em cada linha só tirava espaço do nome.
        item.innerHTML = `${s.codigo} - ${s.nome} ${etiquetaSuspensa(s)}`;
        item.onclick = async () => {
          if (s.ativo === false) {
            if (await tentarReativar('subtitulo', s)) await recarregarSubtitulos();
            return;
          }
          selecionarItem('lista-subtitulos', item, s, 'subtituloAtual');
        };
        lista.appendChild(item);
        // veio da busca: marca a conta procurada e rola ate ela
        if (state.marcarCodigo && s.codigo === state.marcarCodigo) {
          selecionarItem('lista-subtitulos', item, s, 'subtituloAtual');
          setTimeout(() => item.scrollIntoView({ block: 'center' }), 0);
        }
      });
      state.marcarCodigo = null;
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  $('#modal-subtitulos').addEventListener('click', async (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;

    if (acao === 'inserir-subtitulo') {
      // Conta de fornecedor nasce no cadastro de fornecedor, que escolhe o
      // título e segue a sequência. O servidor também recusa; este aviso é só
      // para o usuário não preencher um formulário que vai ser rejeitado.
      if (String(state.tituloAtual?.codigo || '').startsWith('2.01.')) {
        return avisar(
          'Conta de fornecedor não se cria pelo plano.\n\n' +
          'Use Auxiliares → Fornecedores: ao cadastrar, escolha o título e a conta ' +
          'é criada automaticamente.',
          'Cadastro pelo fornecedor'
        );
      }
      abrirForm('subtitulo', 'inserir');
    }
    else if (acao === 'alterar-subtitulo') {
      if (!state.subtituloAtual) return avisar('Selecione um subtítulo primeiro.');
      abrirForm('subtitulo', 'alterar', state.subtituloAtual);
    }
    else if (acao === 'deletar-subtitulo') {
      if (!state.subtituloAtual) return avisar('Selecione um subtítulo primeiro.');
      const ok = await confirmarSuspensao('subtitulo', 'subtítulo', state.subtituloAtual);
      if (!ok) return;
      try {
        await api('DELETE', `/subtitulos/${state.subtituloAtual._id}`);
        state.subtituloAtual = null;
        await recarregarSubtitulos();
      } catch (err) { avisar(err.message, 'Não foi possível'); }
    }
  });

  // ============================================================
  // FORM (insert/update genérico)
  // ============================================================
  function abrirForm(nivel, modo, registro) {
    state.modo = modo;
    state.nivel = nivel;

    const titulos = {
      subgrupo:  'SubGrupo',
      titulo:    'Conta-título',
      subtitulo: 'Sub-título'
    };
    $('#form-titulo').textContent =
      `${modo === 'inserir' ? 'Inserir' : 'Alterar'} ${titulos[nivel]}`;

    $('#f-nome').value      = registro?.nome || '';
    $('#f-descricao').value = registro?.descricao || '';
    $('#f-aceita').checked  = !!registro?.aceitaLancamento;
    $('#f-natureza').value  = registro?.natureza || '';
    $('#f-saldo').value     = registro?.saldoInicial ?? 0;

    $('#codigo-preview').hidden = false;
    $('#codigo-valor').textContent =
      modo === 'alterar' ? registro.codigo : '(será gerado automaticamente)';

    $('#f-aceita-wrapper').hidden    = (nivel !== 'titulo');
    $('#f-subtitulo-extras').hidden  = (nivel !== 'subtitulo');
    $('#f-natureza').required        = (nivel === 'subtitulo');

    // ===== STEPPER de código (só para subtítulo) =====
    if (nivel === 'subtitulo' && window.StepperCodigo) {
      if (modo === 'inserir') {
        window.StepperCodigo.abrirInsercao(state.tituloAtual._id, state.tituloAtual.codigo);
      } else {
        const seqAtual = parseInt((registro.codigo || '').split('.')[3], 10);
        window.StepperCodigo.abrirEdicao(
          registro._id, state.tituloAtual._id, state.tituloAtual.codigo, seqAtual
        );
      }
    } else if (window.StepperCodigo) {
      window.StepperCodigo.esconder();
    }

    abrir('modal-form');
  }

  $('#form-conta').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome      = $('#f-nome').value.trim();
    const descricao = $('#f-descricao').value.trim();

    try {
      if (state.nivel === 'subgrupo') {
        if (state.modo === 'inserir') {
          await api('POST', '/subgrupos', {
            grupoId: state.grupoAtual._id, nome, descricao
          });
        } else {
          await api('PUT', `/subgrupos/${state.subGrupoAtual._id}`, { nome, descricao });
        }
        fechar('modal-form');
        await recarregarSubGrupos();
      }
      else if (state.nivel === 'titulo') {
        const aceitaLancamento = $('#f-aceita').checked;
        if (state.modo === 'inserir') {
          await api('POST', '/titulos', {
            subGrupoId: state.subGrupoAtual._id,
            nome, descricao, aceitaLancamento
          });
        } else {
          await api('PUT', `/titulos/${state.tituloAtual._id}`, {
            nome, descricao, aceitaLancamento
          });
        }
        fechar('modal-form');
        await recarregarTitulos();
      }
      else if (state.nivel === 'subtitulo') {
        const payload = {
          nome, descricao,
          natureza:     $('#f-natureza').value,
          saldoInicial: parseFloat($('#f-saldo').value || 0)
        };
        // código escolhido no stepper (setinhas)
        if (window.StepperCodigo) {
          const seq = window.StepperCodigo.seq();
          if (seq != null && !window.StepperCodigo.estaBloqueado()) payload.seqEscolhida = seq;
        }
        if (state.modo === 'inserir') {
          payload.contaTituloId = state.tituloAtual._id;
          await api('POST', '/subtitulos', payload);
        } else {
          await api('PUT', `/subtitulos/${state.subtituloAtual._id}`, payload);
        }
        fechar('modal-form');
        await recarregarSubtitulos();
      }
    } catch (err) {
      avisar(err.message, 'Não foi possível');
    }
  });

})();
