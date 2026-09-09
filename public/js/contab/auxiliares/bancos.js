/* public/js/auxiliares/bancos.js
 * Cadastro de Bancos (instituições)
 */
(() => {
  'use strict';

  console.log('%c🏛️ bancos.js v1', 'background:#1d4ed8;color:white;padding:4px 10px;border-radius:4px;font-weight:bold;');

  const API = '/aux/api/bancos';
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const state = { editandoId: null };

  async function api(method, path = '', body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  function abrirModal(banco) {
    state.editandoId = banco?._id || null;
    $('#modal-titulo').textContent = banco ? `Editar ${banco.codigo}` : 'Novo banco';
    $('#f-codigo').value    = banco?.codigo || '';
    $('#f-nome').value      = banco?.nome || '';
    $('#f-nomeCurto').value = banco?.nomeCurto || '';
    $('#f-codigo').disabled = !!banco;  // não permite trocar código ao editar
    $('#modal-banco').hidden = false;
    setTimeout(() => (banco ? $('#f-nome') : $('#f-codigo')).focus(), 50);
  }

  function fecharModal() {
    $('#modal-banco').hidden = true;
    state.editandoId = null;
  }

  async function recarregar() {
    const tbody = $('#lista-bancos');
    const inativos = $('#incluir-inativos').checked;
    tbody.innerHTML = '<tr><td colspan="5" class="banco-empty">Carregando...</td></tr>';

    try {
      const url = '/' + (inativos ? '?incluirInativos=true' : '');
      const bancos = await api('GET', url);
      $('#contador').textContent = `${bancos.length} ${bancos.length === 1 ? 'banco' : 'bancos'}`;

      if (bancos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="banco-empty">Nenhum banco cadastrado.</td></tr>';
        return;
      }

      tbody.innerHTML = bancos.map(b => `
        <tr>
          <td><span class="banco-codigo">${b.codigo}</span></td>
          <td>${b.nome}</td>
          <td>${b.nomeCurto || '-'}</td>
          <td>
            ${b.ativo
              ? '<span class="banco-tag-ativo">Ativo</span>'
              : '<span class="banco-tag-inativo">Inativo</span>'}
          </td>
          <td>
            <button class="banco-btn-acao" data-action="editar" data-id="${b._id}" title="Editar">✏️</button>
            ${b.ativo
              ? `<button class="banco-btn-acao" data-action="inativar" data-id="${b._id}" title="Inativar">🗑️</button>`
              : `<button class="banco-btn-acao" data-action="reativar" data-id="${b._id}" title="Reativar">♻️</button>`}
          </td>
        </tr>
      `).join('');

      // Bindings das ações
      $$('.banco-btn-acao').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          if (action === 'editar') {
            const banco = await api('GET', '/' + id);
            abrirModal(banco);
          } else if (action === 'inativar') {
            if (!confirm('Inativar este banco?')) return;
            await api('DELETE', '/' + id);
            recarregar();
          } else if (action === 'reativar') {
            await api('POST', '/' + id + '/reativar');
            recarregar();
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="banco-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  // Máscara: apenas dígitos no código
  $('#f-codigo').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
  });

  // Submit
  $('#form-banco').addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo    = $('#f-codigo').value.trim();
    const nome      = $('#f-nome').value.trim();
    const nomeCurto = $('#f-nomeCurto').value.trim();
    if (!nome) { $('#f-nome').focus(); return; }

    const btn = $('#btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      if (state.editandoId) {
        await api('PUT', '/' + state.editandoId, { nome, nomeCurto });
      } else {
        if (codigo.length !== 3) { alert('Código FEBRABAN deve ter 3 dígitos.'); return; }
        await api('POST', '', { codigo, nome, nomeCurto });
      }
      fecharModal();
      recarregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salvar';
    }
  });

  $('#btn-novo').addEventListener('click', () => abrirModal(null));
  $('#btn-fechar').addEventListener('click', fecharModal);
  $('#btn-cancelar').addEventListener('click', fecharModal);
  $('#incluir-inativos').addEventListener('change', recarregar);

  recarregar();
})();
