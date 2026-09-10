/* public/js/contab/contabil/contabil-plano.js
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
    nivel:          null
  };

  const abrir = (id) => $('#' + id).hidden = false;

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

  function selecionarItem(listaId, item, registro, slot) {
    $$(`#${listaId} .item`).forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    state[slot] = registro;
  }

  // ============================================================
  // NÍVEL 1: GRUPOS
  // ============================================================
  async function abrirGrupos() {
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
        btn.textContent = `${g.codigo} - ${g.nome}`;
        btn.onclick = () => abrirSubGrupos(g);
        lista.appendChild(btn);
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  // O botão continua reabrindo o modal se o usuário fechar no X...
  $('#btn-abrir-grupos').addEventListener('click', abrirGrupos);

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
        lista.appendChild(item);
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  $('#modal-subgrupos').addEventListener('click', async (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;

    if (acao === 'inserir-subgrupo') abrirForm('subgrupo', 'inserir');
    else if (acao === 'alterar-subgrupo') {
      if (!state.subGrupoAtual) return avisar('Selecione um subgrupo primeiro.');
      abrirForm('subgrupo', 'alterar', state.subGrupoAtual);
    }
    else if (acao === 'deletar-subgrupo') {
      if (!state.subGrupoAtual) return avisar('Selecione um subgrupo primeiro.');
      const ok = await perguntar(
        `Suspender o subgrupo ${state.subGrupoAtual.codigo} - ${state.subGrupoAtual.nome}?\n\n` +
        `A conta sai das listas mas continua guardada, e pode ser reativada depois.`,
        'Suspender'
      );
      if (!ok) return;
      try {
        await api('DELETE', `/subgrupos/${state.subGrupoAtual._id}`);
        state.subGrupoAtual = null;
        await recarregarSubGrupos();
      } catch (err) { avisar(err.message, 'Não foi possível'); }
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
    abrir('modal-titulos');
    await recarregarTitulos();
  }

  async function recarregarTitulos() {
    const lista = $('#lista-titulos');
    lista.innerHTML = '<div class="empty">Carregando...</div>';
    try {
      const tits = await api('GET', `/titulos/${state.subGrupoAtual._id}`);
      if (!tits.length) {
        lista.innerHTML = '<div class="empty">Nenhum título. Clique em ➕ Inserir.</div>';
        return;
      }
      lista.innerHTML = '';
      tits.forEach(t => {
        const item = document.createElement('div');
        item.className = 'item' + (t.ativo === false ? ' suspensa' : '');
        const badge = t.aceitaLancamento
          ? '<span class="badge">analítica</span>'
          : '<span class="badge">sintética</span>';
        item.innerHTML = `${t.codigo} - ${t.nome} ${badge} ${etiquetaSuspensa(t)}`;
        item.onclick = async () => {
          if (t.ativo === false) {
            if (await tentarReativar('titulo', t)) await recarregarTitulos();
            return;
          }
          selecionarItem('lista-titulos', item, t, 'tituloAtual');
        };
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
      const ok = await perguntar(
        `Suspender o conta-título ${state.tituloAtual.codigo} - ${state.tituloAtual.nome}?\n\n` +
        `A conta sai das listas mas continua guardada, e pode ser reativada depois.`,
        'Suspender'
      );
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
        item.innerHTML = `${s.codigo} - ${s.nome} ` +
                         `<span class="badge">${s.natureza || '?'}</span> ${etiquetaSuspensa(s)}`;
        item.onclick = async () => {
          if (s.ativo === false) {
            if (await tentarReativar('subtitulo', s)) await recarregarSubtitulos();
            return;
          }
          selecionarItem('lista-subtitulos', item, s, 'subtituloAtual');
        };
        lista.appendChild(item);
      });
    } catch (err) {
      lista.innerHTML = `<div class="empty">Erro: ${err.message}</div>`;
    }
  }

  $('#modal-subtitulos').addEventListener('click', async (e) => {
    const acao = e.target.dataset.acao;
    if (!acao) return;

    if (acao === 'inserir-subtitulo') abrirForm('subtitulo', 'inserir');
    else if (acao === 'alterar-subtitulo') {
      if (!state.subtituloAtual) return avisar('Selecione um subtítulo primeiro.');
      abrirForm('subtitulo', 'alterar', state.subtituloAtual);
    }
    else if (acao === 'deletar-subtitulo') {
      if (!state.subtituloAtual) return avisar('Selecione um subtítulo primeiro.');
      const ok = await perguntar(
        `Suspender o subtítulo ${state.subtituloAtual.codigo} - ${state.subtituloAtual.nome}?\n\n` +
        `A conta sai das listas mas continua guardada, e pode ser reativada depois.`,
        'Suspender'
      );
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
