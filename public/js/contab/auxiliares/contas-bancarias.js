/* public/js/auxiliares/contas-bancarias.js
 * Cadastro de Contas Bancárias da cooperativa
 */
(() => {
  'use strict';

  console.log('%c💳 contas-bancarias.js v1', 'background:#1d4ed8;color:white;padding:4px 10px;border-radius:4px;font-weight:bold;');

  const API     = '/aux/api/contas-bancarias';
  const LOOKUP  = '/aux/api/lookup';
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const apenasNumeros = (s) => String(s || '').replace(/\D/g, '');

  const state = {
    editandoId: null,
    bancos: [],
    subtitulos: [],
    debounceTimer: null
  };

  async function api(method, path = '', body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  function fmtTipo(t) {
    return ({
      CORRENTE: 'Corrente',
      POUPANCA: 'Poupança',
      APLICACAO: 'Aplicação',
      PAGAMENTO: 'Pagamento'
    })[t] || t;
  }

  function fmtAgencia(c) {
    return c.agencia + (c.agenciaDv ? '-' + c.agenciaDv : '');
  }
  function fmtNumero(c) {
    return c.numero + (c.numeroDv ? '-' + c.numeroDv : '');
  }

  async function carregarBancos() {
    const res = await fetch('/aux/api/bancos');
    state.bancos = await res.json();
    const select = $('#f-banco');
    select.innerHTML = '<option value="">Selecione...</option>' +
      state.bancos.map(b =>
        `<option value="${b._id}">${b.codigo} - ${b.nomeCurto || b.nome}</option>`
      ).join('');
  }

  async function carregarSubTitulos() {
    try {
      const res = await fetch(LOOKUP + '/subtitulos');
      state.subtitulos = await res.json();
      const select = $('#f-contaSubTitulo');
      select.innerHTML = '<option value="">— Vincular depois —</option>' +
        state.subtitulos.map(s =>
          `<option value="${s._id}">${s.caminho}</option>`
        ).join('');
    } catch (err) {
      console.warn('Falha ao carregar SubTítulos:', err);
    }
  }

  function abrirModal(conta) {
    state.editandoId = conta?._id || null;
    $('#modal-titulo').textContent = conta ? `Editar ${conta.codigo}` : 'Nova conta bancária';
    $('#codigo-preview').hidden = !!conta;

    $('#f-banco').value           = conta?.banco?._id || conta?.banco || '';
    $('#f-tipo').value            = conta?.tipo || 'CORRENTE';
    $('#f-agencia').value         = conta?.agencia || '';
    $('#f-agenciaDv').value       = conta?.agenciaDv || '';
    $('#f-numero').value          = conta?.numero || '';
    $('#f-numeroDv').value        = conta?.numeroDv || '';
    $('#f-apelido').value         = conta?.apelido || '';
    $('#f-titular').value         = conta?.titular || '';
    $('#f-cpfCnpjTitular').value  = conta?.cpfCnpjTitular || '';
    $('#f-contaSubTitulo').value  = conta?.contaSubTitulo?._id || conta?.contaSubTitulo || '';
    $('#f-saldoInicial').value    = conta?.saldoInicial || '';
    $('#f-dataSaldoInicial').value = conta?.dataSaldoInicial
      ? new Date(conta.dataSaldoInicial).toISOString().slice(0, 10) : '';
    $('#f-observacoes').value     = conta?.observacoes || '';

    $('#modal-conta').hidden = false;
    setTimeout(() => $('#f-banco').focus(), 50);
  }

  function fecharModal() {
    $('#modal-conta').hidden = true;
    state.editandoId = null;
  }

  async function recarregar() {
    const tbody = $('#lista-contas');
    const busca = $('#busca').value.trim();
    const inativos = $('#incluir-inativos').checked;

    tbody.innerHTML = '<tr><td colspan="9" class="cb-empty">Carregando...</td></tr>';

    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (inativos) params.set('incluirInativos', 'true');
      const url = '/' + (params.toString() ? '?' + params.toString() : '');
      const contas = await api('GET', url);

      $('#contador').textContent = `${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}`;

      if (contas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="cb-empty">Nenhuma conta cadastrada. Clique em "+ Nova conta".</td></tr>';
        return;
      }

      tbody.innerHTML = contas.map(c => {
        const banco = c.banco
          ? `${c.banco.codigo} ${c.banco.nomeCurto || c.banco.nome}`
          : '-';
        const subTit = c.contaSubTitulo
          ? `<span class="cb-codigo">${c.contaSubTitulo.codigo}</span> ${c.contaSubTitulo.descricao || ''}`
          : '<em style="color:#9ca3af">Sem vínculo</em>';
        return `
          <tr>
            <td><span class="cb-codigo">${c.codigo}</span></td>
            <td>${banco}</td>
            <td>${fmtAgencia(c)}</td>
            <td>${fmtNumero(c)}</td>
            <td><span class="cb-tag-tipo">${fmtTipo(c.tipo)}</span></td>
            <td>${c.apelido || '-'}</td>
            <td>${subTit}</td>
            <td>${c.ativo
              ? '<span class="cb-tag-ativo">Ativo</span>'
              : '<span class="cb-tag-inativo">Inativo</span>'}</td>
            <td>
              <button class="cb-btn-acao" data-action="editar" data-id="${c._id}" title="Editar">✏️</button>
              ${c.ativo
                ? `<button class="cb-btn-acao" data-action="inativar" data-id="${c._id}" title="Inativar">🗑️</button>`
                : `<button class="cb-btn-acao" data-action="reativar" data-id="${c._id}" title="Reativar">♻️</button>`}
            </td>
          </tr>
        `;
      }).join('');

      $$('.cb-btn-acao').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const action = btn.dataset.action;
          if (action === 'editar') {
            const conta = await api('GET', '/' + id);
            abrirModal(conta);
          } else if (action === 'inativar') {
            if (!confirm('Inativar esta conta bancária?')) return;
            await api('DELETE', '/' + id);
            recarregar();
          } else if (action === 'reativar') {
            await api('POST', '/' + id + '/reativar');
            recarregar();
          }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="cb-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  // Submit
  $('#form-conta').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      banco:            $('#f-banco').value || null,
      tipo:             $('#f-tipo').value,
      agencia:          $('#f-agencia').value.trim(),
      agenciaDv:        $('#f-agenciaDv').value.trim(),
      numero:           $('#f-numero').value.trim(),
      numeroDv:         $('#f-numeroDv').value.trim(),
      apelido:          $('#f-apelido').value.trim(),
      titular:          $('#f-titular').value.trim(),
      cpfCnpjTitular:   apenasNumeros($('#f-cpfCnpjTitular').value),
      contaSubTitulo:   $('#f-contaSubTitulo').value || null,
      saldoInicial:     parseFloat($('#f-saldoInicial').value) || 0,
      dataSaldoInicial: $('#f-dataSaldoInicial').value || null,
      observacoes:      $('#f-observacoes').value.trim()
    };

    if (!payload.banco)   { alert('Selecione um banco.'); return; }
    if (!payload.agencia) { alert('Informe a agência.'); return; }
    if (!payload.numero)  { alert('Informe o número da conta.'); return; }

    const btn = $('#btn-salvar');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      if (state.editandoId) {
        await api('PUT', '/' + state.editandoId, payload);
      } else {
        await api('POST', '', payload);
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

  $('#busca').addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(recarregar, 300);
  });

  // Init
  (async function init() {
    await Promise.all([carregarBancos(), carregarSubTitulos()]);
    recarregar();
  })();
})();
