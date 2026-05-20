/* public/js/contabil/contabil-plano.js
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

  const abrir  = (id) => $('#' + id).hidden = false;
  const fechar = (id) => $('#' + id).hidden = true;

  document.addEventListener('click', (e) => {
    const id = e.target.dataset.close;
    if (id) fechar(id);
  });

  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
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
  $('#btn-abrir-grupos').addEventListener('click', async () => {
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
  });

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
        item.className = 'item';
        item.textContent = `${s.codigo} - ${s.nome}`;
        item.onclick = () => selecionarItem('lista-subgrupos', item, s, 'subGrupoAtual');
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
      if (!state.subGrupoAtual) return alert('Selecione um subgrupo primeiro.');
      abrirForm('subgrupo', 'alterar', state.subGrupoAtual);
    }
    else if (acao === 'deletar-subgrupo') {
      if (!state.subGrupoAtual) return alert('Selecione um subgrupo primeiro.');
      if (!confirm(`Deletar "${state.subGrupoAtual.codigo} - ${state.subGrupoAtual.nome}"?`)) return;
      try {
        await api('DELETE', `/subgrupos/${state.subGrupoAtual._id}`);
        state.subGrupoAtual = null;
        await recarregarSubGrupos();
      } catch (err) { alert(err.message); }
    }
    else if (acao === 'abrir-titulos') {
      if (!state.subGrupoAtual) return alert('Selecione um subgrupo primeiro.');
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
        item.className = 'item';
        const badge = t.aceitaLancamento
          ? '<span class="badge">analítica</span>'
          : '<span class="badge">sintética</span>';
        item.innerHTML = `${t.codigo} - ${t.nome} ${badge}`;
        item.onclick = () => selecionarItem('lista-titulos', item, t, 'tituloAtual');
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
      if (!state.tituloAtual) return alert('Selecione um título primeiro.');
      abrirForm('titulo', 'alterar', state.tituloAtual);
    }
    else if (acao === 'deletar-titulo') {
      if (!state.tituloAtual) return alert('Selecione um título primeiro.');
      if (!confirm(`Deletar "${state.tituloAtual.codigo} - ${state.tituloAtual.nome}"?`)) return;
      try {
        await api('DELETE', `/titulos/${state.tituloAtual._id}`);
        state.tituloAtual = null;
        await recarregarTitulos();
      } catch (err) { alert(err.message); }
    }
    else if (acao === 'abrir-subtitulos') {
      if (!state.tituloAtual) return alert('Selecione um título primeiro.');
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
        item.className = 'item';
        item.innerHTML = `${s.codigo} - ${s.nome} <span class="badge">${s.natureza || '?'}</span>`;
        item.onclick = () => selecionarItem('lista-subtitulos', item, s, 'subtituloAtual');
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
      if (!state.subtituloAtual) return alert('Selecione um subtítulo primeiro.');
      abrirForm('subtitulo', 'alterar', state.subtituloAtual);
    }
    else if (acao === 'deletar-subtitulo') {
      if (!state.subtituloAtual) return alert('Selecione um subtítulo primeiro.');
      if (!confirm(`Deletar "${state.subtituloAtual.codigo} - ${state.subtituloAtual.nome}"?`)) return;
      try {
        await api('DELETE', `/subtitulos/${state.subtituloAtual._id}`);
        state.subtituloAtual = null;
        await recarregarSubtitulos();
      } catch (err) { alert(err.message); }
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
    $('#f-banco').value     = registro?.banco || '';
    $('#f-agencia').value   = registro?.agencia || '';
    $('#f-conta').value     = registro?.conta || '';

    $('#codigo-preview').hidden = false;
    $('#codigo-valor').textContent =
      modo === 'alterar' ? registro.codigo : '(será gerado automaticamente)';

    $('#f-aceita-wrapper').hidden    = (nivel !== 'titulo');
    $('#f-subtitulo-extras').hidden  = (nivel !== 'subtitulo');
    $('#f-natureza').required        = (nivel === 'subtitulo');

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
          saldoInicial: parseFloat($('#f-saldo').value || 0),
          banco:        $('#f-banco').value.trim(),
          agencia:      $('#f-agencia').value.trim(),
          conta:        $('#f-conta').value.trim()
        };
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
      alert('Erro: ' + err.message);
    }
  });

})();
