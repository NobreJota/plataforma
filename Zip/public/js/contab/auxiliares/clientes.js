/* public/js/auxiliares/clientes.js
 * v8 — Pelo menos um contato + CEP com fallback manual
 *  ✓ Email OU Telefone obrigatório (não ambos, mas pelo menos um)
 *  ✓ Quando preenche um deles, ambos saem da pendência
 *  ✓ CEP com fallback manual: permite digitar tudo se ViaCEP não achar
 *  ✓ Status "✗" do CEP some quando < 8 dígitos (limpa erro residual)
 */
(() => {
  'use strict';

  console.log('%c🟢 clientes.js v22 — Versão estável final', 'background:#1d4ed8;color:white;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:14px;');
  console.log('%c   Sistema robusto sem logs de debug', 'color:#1d4ed8;font-weight:bold;');

  const API     = '/aux/api/clientes';
  const LOOKUP  = '/aux/api/lookup';
  const $       = (sel) => document.querySelector(sel);
  const $$      = (sel) => Array.from(document.querySelectorAll(sel));

  const OBRIG_FIXOS = [
    'f-tipo', 'f-cpfCnpj', 'f-nome',
    'cob-cep', 'cob-logradouro', 'cob-cidade', 'cob-uf'
  ];
  const OBRIG_ENTREGA = [
    'ent-cep', 'ent-logradouro', 'ent-cidade', 'ent-uf'
  ];
  // 🔧 Pelo menos um destes deve estar preenchido
  const OBRIG_CONTATO = ['f-email', 'f-telefone'];

  const CAMPOS_LIMPAR_AO_APAGAR_CEP = [
    'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'
  ];

  const state = {
    editandoId: null,
    debounceTimer: null,
    cnpjConsultado: '',
    cepCobConsultado: '',
    cepEntConsultado: '',
    lookupCepEmAndamento: { cob: false, ent: false }
  };

  // ============== Helpers ==============
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
    return data;
  }

  const apenasNumeros = (s) => String(s || '').replace(/\D/g, '');

  // ============== Validação CPF/CNPJ no frontend ==============
  function validarCPF(cpf) {
    cpf = apenasNumeros(cpf);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;  // todos iguais

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(cpf[10]);
  }

  function validarCNPJ(cnpj) {
    cnpj = apenasNumeros(cnpj);
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;

    const calc = (base, pesos) => {
      let soma = 0;
      for (let i = 0; i < base.length; i++) soma += parseInt(base[i]) * pesos[i];
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const d1 = calc(cnpj.slice(0, 12), pesos1);
    const d2 = calc(cnpj.slice(0, 13), pesos2);
    return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
  }

  function validarDocumento(doc, tipo) {
    return tipo === 'PF' ? validarCPF(doc) : validarCNPJ(doc);
  }

  function mascaraCPF(v) {
    const n = apenasNumeros(v).slice(0, 11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  }
  function mascaraCNPJ(v) {
    const n = apenasNumeros(v).slice(0, 14);
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0,2)}.${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5)}`;
    if (n.length <= 12) return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8)}`;
    return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
  }
  function mascaraTelefone(v) {
    const n = apenasNumeros(v).slice(0, 11);
    if (n.length <= 2) return n.length ? `(${n}` : '';
    if (n.length <= 6) return `(${n.slice(0,2)}) ${n.slice(2)}`;
    if (n.length <= 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  }
  function mascaraCEP(v) {
    const n = apenasNumeros(v).slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0,5)}-${n.slice(5)}`;
  }
  function escapar(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function titleCase(s) {
    if (!s) return '';
    // Preposições e artigos que ficam minúsculos (exceto no início)
    const minusculas = new Set([
      'de', 'da', 'do', 'das', 'dos',
      'e', 'a', 'o', 'as', 'os',
      'em', 'na', 'no', 'nas', 'nos',
      'para', 'por', 'com'
    ]);
    // Siglas e termos que devem ficar maiúsculos (sempre)
    const maiusculas = new Set([
      'SA', 'S/A', 'LTDA', 'ME', 'EPP', 'EIRELI',
      'CIA', 'COOP', 'MEI', 'SP', 'RJ', 'MG', 'ES', 'BA',
      'PR', 'SC', 'RS', 'GO', 'PE', 'CE', 'PA', 'AM',
      'DF', 'MT', 'MS', 'TO', 'PB', 'PI', 'MA', 'AL',
      'RN', 'SE', 'RO', 'AC', 'AP', 'RR'
    ]);

    return String(s).toLowerCase().split(' ').map((palavra, idx) => {
      if (!palavra) return palavra;
      const upper = palavra.toUpperCase();
      if (maiusculas.has(upper)) return upper;
      // Preposições só viram minúsculas se NÃO forem a primeira palavra
      if (idx > 0 && minusculas.has(palavra)) return palavra;
      // Primeira letra maiúscula, resto minúsculo
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
  }

  // ============== Sistema de pendências ==============
  function listaObrigatoriosFixos() {
    const ids = [...OBRIG_FIXOS];
    if (!$('#entrega-igual').checked) ids.push(...OBRIG_ENTREGA);
    return ids.map(id => $('#' + id)).filter(Boolean);
  }

  // 🔧 Pelo menos um contato deve estar preenchido
  function contatoOk() {
    const email = $('#f-email').value.trim();
    const tel   = $('#f-telefone').value.trim();
    return !!(email || tel);
  }

  function atualizarPendencias() {
    const obrigatorios = listaObrigatoriosFixos();
    let pendentes = 0;

    obrigatorios.forEach(el => {
      const vazio = !el.value || !String(el.value).trim();
      const ehCep = el.id === 'cob-cep' || el.id === 'ent-cep';
      const cepIncompleto = ehCep && apenasNumeros(el.value).length !== 8;

      if (vazio || cepIncompleto) {
        el.classList.add('pendente');
        el.classList.remove('preenchido');
        pendentes++;
      } else {
        el.classList.remove('pendente');
      }
    });

    // 🔧 Lógica especial: pelo menos UM contato
    const email = $('#f-email');
    const tel   = $('#f-telefone');
    if (!contatoOk()) {
      email.classList.add('pendente');
      tel.classList.add('pendente');
      email.classList.remove('preenchido');
      tel.classList.remove('preenchido');
      pendentes++;   // conta como 1 pendência (não 2)
    } else {
      email.classList.remove('pendente');
      tel.classList.remove('pendente');
      // Aplica preenchido nos que têm valor
      if (email.value.trim()) email.classList.add('preenchido');
      if (tel.value.trim())   tel.classList.add('preenchido');
    }

    const btn = $('#btn-salvar');
    if (btn) {
      btn.textContent = pendentes > 0
        ? `Salvar (${pendentes} pendente${pendentes > 1 ? 's' : ''})`
        : 'Salvar';
      btn.style.opacity = pendentes > 0 ? '0.85' : '1';
    }

    return pendentes;
  }

  function marcarPreenchido(el) {
    if (!el) return;
    const valor = el.value && String(el.value).trim();
    if (valor) {
      el.classList.add('preenchido');
      el.classList.remove('pendente');
    } else {
      el.classList.remove('preenchido');
    }
  }

  function limparPreenchimentos() {
    $$('.cli-form .preenchido, .cli-form .pendente, .cli-form .cli-erro-flash')
      .forEach(el => el.classList.remove('preenchido', 'pendente', 'cli-erro-flash'));
  }

  function limparEnderecoCompleto(prefixo) {
    CAMPOS_LIMPAR_AO_APAGAR_CEP.forEach(c => {
      const el = $('#' + prefixo + '-' + c);
      if (el) {
        el.value = '';
        el.classList.remove('preenchido');
      }
    });
    state[prefixo === 'cob' ? 'cepCobConsultado' : 'cepEntConsultado'] = '';
    const status = $('#status-cep-' + prefixo);
    if (status) {
      status.textContent = '';
      status.className = 'status-busca';
    }
    atualizarPendencias();
  }

  // 🔧 Limpa TUDO do endereço, INCLUSIVE o CEP (usado no reset por CPF inválido)
  function limparEnderecoTotal(prefixo) {
    // Inclui o próprio CEP além dos campos dependentes
    const todos = ['cep', ...CAMPOS_LIMPAR_AO_APAGAR_CEP];
    todos.forEach(c => {
      const el = $('#' + prefixo + '-' + c);
      if (el) {
        el.value = '';
        el.classList.remove('preenchido');
      }
    });
    state[prefixo === 'cob' ? 'cepCobConsultado' : 'cepEntConsultado'] = '';
    const status = $('#status-cep-' + prefixo);
    if (status) {
      status.textContent = '';
      status.className = 'status-busca';
    }
  }

  // 🔧 Limpa TUDO depois do CPF/CNPJ (quando o doc é inválido ou duplicado)
  // Mantém: tipo, codigo. Limpa: cpf, nome, email, telefone, IE/IM, endereços.
  function resetarDadosPosCpf() {
    console.log('%c🧹 RESET acionado!', 'background:orange;color:black;padding:2px 6px;font-weight:bold;');
    $('#f-cpfCnpj').value = '';
    $('#f-nome').value = '';
    $('#f-email').value = '';
    $('#f-telefone').value = '';
    $('#f-inscricaoEstadual').value = '';
    $('#f-inscricaoMunicipal').value = '';
    if ($('#f-observacoes')) $('#f-observacoes').value = '';
    // 🔧 Limpa endereços TOTAL (inclui CEP)
    limparEnderecoTotal('cob');
    limparEnderecoTotal('ent');
    // Limpa status
    $('#status-cnpj').textContent = '';
    $('#status-cnpj').className = 'status-busca';
    // Reset do estado interno
    state.cnpjConsultado = '';
    state.cepCobConsultado = '';
    state.cepEntConsultado = '';
    // Limpa marcações de preenchido (todos)
    $$('.cli-form .preenchido').forEach(el => el.classList.remove('preenchido'));
    // Atualiza botões ISENTO e pendências
    atualizarBotoesIsento();
    atualizarPendencias();
  }

  // ============== Listagem ==============
  async function recarregar() {
    const tbody = $('#lista-clientes');
    const busca = $('#busca').value.trim();
    const inativos = $('#incluir-inativos').checked;

    tbody.innerHTML = '<tr><td colspan="8" class="cli-empty">Carregando...</td></tr>';

    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (inativos) params.set('incluirInativos', 'true');
      const url = '/' + (params.toString() ? '?' + params.toString() : '');

      const clientes = await api('GET', url);

      $('#contador').textContent =
        `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`;

      if (!clientes.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="cli-empty">
          ${busca ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado. Clique em ➕ Novo cliente.'}
        </td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      clientes.forEach(c => {
        const cob = c.enderecoCobranca || {};
        const cidadeUf = cob.cidade ? `${cob.cidade}/${cob.uf || ''}` : '—';
        const tr = document.createElement('tr');
        if (!c.ativo) tr.classList.add('inativo');
        tr.innerHTML = `
          <td class="codigo-cell">${c.codigo}</td>
          <td><span class="tipo-badge ${c.tipo}">${c.tipo}</span></td>
          <td>${escapar(c.nome)}</td>
          <td><code>${c.cpfCnpjFormatado || c.cpfCnpj}</code></td>
          <td>${escapar(cidadeUf)}</td>
          <td>${escapar(c.telefone || '—')}</td>
          <td><span class="status-badge ${c.ativo ? 'ativo' : 'inativo'}">${c.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td class="acoes-cell">
            <button class="btn-icon" data-acao="editar" data-id="${c._id}" title="Editar">✏</button>
            ${c.ativo
              ? `<button class="btn-icon danger" data-acao="desativar" data-id="${c._id}" title="Desativar">🗑</button>`
              : `<button class="btn-icon" data-acao="reativar" data-id="${c._id}" title="Reativar">↻</button>`}
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="cli-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  $('#busca').addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(recarregar, 300);
  });
  $('#incluir-inativos').addEventListener('change', recarregar);

  $('#lista-clientes').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const { acao, id } = btn.dataset;

    if (acao === 'editar') {
      try { const c = await api('GET', '/' + id); abrirModal(c); }
      catch (err) { alert(err.message); }
    }
    else if (acao === 'desativar') {
      if (!confirm('Desativar este cliente? O histórico será preservado.')) return;
      try { await api('DELETE', '/' + id); await recarregar(); }
      catch (err) { alert(err.message); }
    }
    else if (acao === 'reativar') {
      try { await api('POST', `/${id}/reativar`); await recarregar(); }
      catch (err) { alert(err.message); }
    }
  });

  $('#btn-novo-cliente').addEventListener('click', () => abrirModal(null));

  document.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined) fecharModal();
  });

  function preencherEndereco(prefixo, end = {}) {
    const campos = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
    campos.forEach(c => {
      const el = $('#' + prefixo + '-' + c);
      if (!el) return;
      el.value = (c === 'cep') ? (end.cep ? mascaraCEP(end.cep) : '') : (end[c] || '');
      marcarPreenchido(el);
    });
  }

  function lerEndereco(prefixo) {
    return {
      cep:         apenasNumeros($('#' + prefixo + '-cep').value),
      logradouro:  $('#' + prefixo + '-logradouro').value.trim(),
      numero:      $('#' + prefixo + '-numero').value.trim(),
      complemento: $('#' + prefixo + '-complemento').value.trim(),
      bairro:      $('#' + prefixo + '-bairro').value.trim(),
      cidade:      $('#' + prefixo + '-cidade').value.trim(),
      uf:          $('#' + prefixo + '-uf').value.trim().toUpperCase()
    };
  }

  function abrirModal(cliente) {
    state.editandoId = cliente?._id || null;
    state.cnpjConsultado = '';
    state.cepCobConsultado = '';
    state.cepEntConsultado = '';

    $('#modal-titulo').textContent = cliente ? `Editar ${cliente.codigo}` : 'Novo cliente';
    $('#codigo-preview').hidden = !!cliente;

    const tipoSel = $('#f-tipo');
    const docInp  = $('#f-cpfCnpj');

    tipoSel.value    = cliente?.tipo || 'PF';
    tipoSel.disabled = !!cliente;
    docInp.value     = cliente?.cpfCnpjFormatado || '';
    docInp.disabled  = !!cliente;

    $('#f-nome').value        = cliente?.nome        || '';
    $('#f-email').value       = cliente?.email       || '';
    $('#f-telefone').value    = cliente?.telefone    || '';
    $('#f-observacoes').value = cliente?.observacoes || '';
    $('#f-inscricaoEstadual').value  = cliente?.inscricaoEstadual  || '';
    $('#f-inscricaoMunicipal').value = cliente?.inscricaoMunicipal || '';
    atualizarBotoesIsento();

    // 🔧 Para novo cadastro: força limpeza TOTAL dos endereços
    if (cliente) {
      preencherEndereco('cob', cliente.enderecoCobranca);
      preencherEndereco('ent', cliente.enderecoEntrega);
    } else {
      limparEnderecoTotal('cob');
      limparEnderecoTotal('ent');
    }

    const igual = cliente ? cliente.entregaIgualCobranca !== false : true;
    $('#entrega-igual').checked = igual;
    $('#bloco-entrega').hidden  = igual;

    $('#status-cnpj').textContent    = '';
    $('#status-cep-cob').textContent = '';
    $('#status-cep-ent').textContent = '';
    $('#status-cep-cob').className = 'status-busca';
    $('#status-cep-ent').className = 'status-busca';

    limparPreenchimentos();
    if (cliente) {
      $$('.cli-form input, .cli-form select, .cli-form textarea')
        .forEach(el => marcarPreenchido(el));
    }
    atualizarPendencias();
    atualizarLabelDoc();
    atualizarVisibilidadeInscricoes();

    $('#modal-cliente').hidden = false;
    setTimeout(() => $('#f-cpfCnpj').focus(), 50);
  }

  function fecharModal() {
    $('#modal-cliente').hidden = true;
    state.editandoId = null;
  }

  function atualizarLabelDoc() {
    const tipo = $('#f-tipo').value;
    if (tipo === 'PF') {
      $('#lbl-cpfCnpj').innerHTML = 'CPF <em>*</em>';
      $('#lbl-nome').innerHTML    = 'Nome completo <em>*</em>';
      $('#f-cpfCnpj').placeholder = '000.000.000-00';
      $('#f-cpfCnpj').maxLength   = 14;
    } else {
      $('#lbl-cpfCnpj').innerHTML = 'CNPJ <em>*</em>';
      $('#lbl-nome').innerHTML    = 'Razão social <em>*</em>';
      $('#f-cpfCnpj').placeholder = '00.000.000/0000-00';
      $('#f-cpfCnpj').maxLength   = 18;
    }
  }

  $('#f-tipo').addEventListener('change', () => {
    $('#f-cpfCnpj').value = '';
    $('#status-cnpj').textContent = '';
    state.cnpjConsultado = '';
    // 🔧 Limpa IE/IM ao trocar tipo
    $('#f-inscricaoEstadual').value = '';
    $('#f-inscricaoMunicipal').value = '';
    atualizarBotoesIsento();
    atualizarLabelDoc();
    atualizarPendencias();
  });

  // ============== CPF/CNPJ ==============
  $('#f-cpfCnpj').addEventListener('input', async (e) => {
    const tipo = $('#f-tipo').value;
    e.target.value = tipo === 'PF' ? mascaraCPF(e.target.value) : mascaraCNPJ(e.target.value);
    atualizarPendencias();

    const num = apenasNumeros(e.target.value);
    const tamanhoCompleto = tipo === 'PF' ? 11 : 14;

    // 🔧 Limpa status SEMPRE que ainda não está completo (apagando ou digitando)
    if (num.length < tamanhoCompleto) {
      $('#status-cnpj').textContent = '';
      $('#status-cnpj').className = 'status-busca';
      // Reset do controle de "já consultado"
      if (tipo === 'PJ') state.cnpjConsultado = '';
    }

    // Se completou CNPJ, valida e consulta
    if (tipo === 'PJ' && num.length === 14 && num !== state.cnpjConsultado) {
      // 🔧 Valida CNPJ ANTES de consultar BrasilAPI (evita gasto inútil)
      if (!validarCNPJ(num)) {
        $('#status-cnpj').textContent = '✗ CNPJ inválido';
        $('#status-cnpj').className = 'status-busca erro';
        e.target.classList.add('cli-erro-flash');
        setTimeout(() => e.target.classList.remove('cli-erro-flash'), 600);
        return;
      }
      state.cnpjConsultado = num;
      await consultarCnpjAuto(num);
    }
  });

  // 🔧 Validação CPF no blur + verifica se já existe
  $('#f-cpfCnpj').addEventListener('blur', async (e) => {
    if (state.editandoId) return;  // ao editar, não verifica
    const tipo = $('#f-tipo').value;
    const num = apenasNumeros(e.target.value);
    if (!num) return;
    const tamanho = tipo === 'PF' ? 11 : 14;
    if (num.length !== tamanho) return;

    if (!validarDocumento(num, tipo)) {
      // 🔧 Documento inválido: reseta tudo (limpa CPF + endereço + nome etc.)
      $('#status-cnpj').textContent = tipo === 'PF' ? '✗ CPF inválido' : '✗ CNPJ inválido';
      $('#status-cnpj').className = 'status-busca erro';
      const cpfCampo = e.target;
      cpfCampo.classList.add('cli-erro-flash');
      // Alerta amigável
      const docTxt = tipo === 'PF' ? 'CPF' : 'CNPJ';
      alert(`${docTxt} inválido.\n\nVerifique os dígitos e digite novamente.`);
      // Depois do alert: reseta tudo e foca de novo
      setTimeout(() => {
        resetarDadosPosCpf();
        // Restaura a mensagem (que o resetar limpou)
        $('#status-cnpj').textContent = `✗ ${docTxt} inválido`;
        $('#status-cnpj').className = 'status-busca erro';
        cpfCampo.focus();
        setTimeout(() => {
          cpfCampo.classList.remove('cli-erro-flash');
          // Limpa a mensagem ao final do flash, deixando o campo limpo
          $('#status-cnpj').textContent = '';
          $('#status-cnpj').className = 'status-busca';
        }, 600);
      }, 0);
      return;
    }

    // 🔧 Verifica se já existe no banco
    try {
      const res = await fetch(`${API}/buscar-cpfcnpj/${num}`);
      const data = await res.json();
      if (data.existe) {
        const cpfCampo = e.target;
        $('#status-cnpj').textContent = `✗ Já cadastrado: ${data.codigo}`;
        $('#status-cnpj').className = 'status-busca erro';
        cpfCampo.classList.add('cli-erro-flash');
        const docTxt = tipo === 'PF' ? 'CPF' : 'CNPJ';
        alert(`Este ${docTxt} já está cadastrado:\n\n${data.codigo} - ${data.nome}\n\nUse a tela de listagem para editar.`);
        // 🔧 Reseta TUDO e foca no CPF
        setTimeout(() => {
          resetarDadosPosCpf();
          cpfCampo.focus();
          setTimeout(() => cpfCampo.classList.remove('cli-erro-flash'), 600);
        }, 0);
        return;
      }
      // OK
      if (tipo === 'PF') {
        $('#status-cnpj').textContent = '✓ Válido';
        $('#status-cnpj').className = 'status-busca ok';
      }
    } catch (err) {
      console.warn('Falha ao verificar duplicidade:', err);
    }
  });

  // Quando o usuário começa a editar, limpa o status
  $('#f-cpfCnpj').addEventListener('focus', () => {
    $('#status-cnpj').textContent = '';
    $('#status-cnpj').className = 'status-busca';
  });

  // 🔧 Trata colagem (Ctrl+V) no CPF/CNPJ
  $('#f-cpfCnpj').addEventListener('paste', (e) => {
    e.preventDefault();
    const tipo = $('#f-tipo').value;
    const textoColado = (e.clipboardData || window.clipboardData).getData('text');
    const tamanho = tipo === 'PF' ? 11 : 14;
    const numLimpo = apenasNumeros(textoColado).slice(0, tamanho);

    // 📋 Log detalhado do paste
    console.group('%c📋 PASTE em ' + (tipo === 'PF' ? 'CPF' : 'CNPJ'), 'background:#fbbf24;color:black;padding:2px 8px;font-weight:bold;');
    console.log('Texto original   :', JSON.stringify(textoColado));
    console.log('Tamanho original :', textoColado.length, 'caracteres');
    console.log('Apenas dígitos   :', JSON.stringify(apenasNumeros(textoColado)));
    console.log(`Aceito (${tamanho} dígit.)  :`, JSON.stringify(numLimpo));
    console.log('Resultado final  :', tipo === 'PF' ? mascaraCPF(numLimpo) : mascaraCNPJ(numLimpo));
    console.groupEnd();

    e.target.value = tipo === 'PF' ? mascaraCPF(numLimpo) : mascaraCNPJ(numLimpo);
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  $('#f-telefone').addEventListener('input', (e) => {
    e.target.value = mascaraTelefone(e.target.value);
    atualizarPendencias();
  });

  // 🔧 Trata colagem (Ctrl+V) no telefone
  $('#f-telefone').addEventListener('paste', (e) => {
    e.preventDefault();
    const textoColado = (e.clipboardData || window.clipboardData).getData('text');
    const numLimpo = apenasNumeros(textoColado).slice(0, 11);

    console.group('%c📋 PASTE em TELEFONE', 'background:#fbbf24;color:black;padding:2px 8px;font-weight:bold;');
    console.log('Texto original   :', JSON.stringify(textoColado));
    console.log('Apenas dígitos   :', JSON.stringify(apenasNumeros(textoColado)));
    console.log('Resultado final  :', mascaraTelefone(numLimpo));
    console.groupEnd();

    e.target.value = mascaraTelefone(numLimpo);
    atualizarPendencias();
    marcarPreenchido(e.target);
  });

  $('#f-email').addEventListener('input', () => atualizarPendencias());

  $('#f-nome').addEventListener('blur', (e) => {
    if (e.target.value.trim()) {
      e.target.value = titleCase(e.target.value.trim());
    }
    atualizarPendencias();
  });

  // ============== Lookup CNPJ ==============
  async function consultarCnpjAuto(cnpj) {
    const status = $('#status-cnpj');
    status.textContent = '🔍 Consultando...';
    status.className = 'status-busca';

    try {
      const res = await fetch(`${LOOKUP}/cnpj/${cnpj}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Falha na consulta');

      if (data.razaoSocial) {
        $('#f-nome').value = titleCase(data.razaoSocial);
        marcarPreenchido($('#f-nome'));
      }
      if (data.email && !$('#f-email').value) {
        $('#f-email').value = data.email;
        marcarPreenchido($('#f-email'));
      }
      if (data.telefone && !$('#f-telefone').value) {
        $('#f-telefone').value = mascaraTelefone(data.telefone);
        marcarPreenchido($('#f-telefone'));
      }
      if (data.endereco) {
        // Aplica Title Case nos campos textuais antes de preencher
        const end = {
          ...data.endereco,
          logradouro:  titleCase(data.endereco.logradouro),
          bairro:      titleCase(data.endereco.bairro),
          cidade:      titleCase(data.endereco.cidade),
          complemento: titleCase(data.endereco.complemento)
        };
        preencherEndereco('cob', end);
        state.cepCobConsultado = end.cep || '';
      }

      const aviso = data.ativa ? '✓ Encontrado' : `⚠ ${data.situacao || 'Inativo'}`;
      status.textContent = aviso;
      status.className = 'status-busca ' + (data.ativa ? 'ok' : 'erro');
      atualizarPendencias();
    } catch (err) {
      status.textContent = '✗ ' + err.message;
      status.className = 'status-busca erro';
    }
  }

  // ============== Lookup CEP (com fallback manual) ==============
  async function executarLookupCep(prefixo, statusId, slot) {
    const input  = $('#' + prefixo + '-cep');
    const status = $('#' + statusId);

    const num = apenasNumeros(input.value);
    if (num.length !== 8) return false;
    if (num === state[slot]) return true;

    state[slot] = num;
    state.lookupCepEmAndamento[prefixo] = true;
    status.textContent = '🔍 Buscando...';
    status.className = 'status-busca';

    try {
      const res = await fetch(`${LOOKUP}/cep/${num}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'CEP não encontrado');

      input.value = mascaraCEP(num);
      marcarPreenchido(input);

      if (data.logradouro) {
        $('#' + prefixo + '-logradouro').value = titleCase(data.logradouro);
        marcarPreenchido($('#' + prefixo + '-logradouro'));
      }
      if (data.bairro) {
        $('#' + prefixo + '-bairro').value = titleCase(data.bairro);
        marcarPreenchido($('#' + prefixo + '-bairro'));
      }
      if (data.cidade) {
        $('#' + prefixo + '-cidade').value = titleCase(data.cidade);
        marcarPreenchido($('#' + prefixo + '-cidade'));
      }
      if (data.complemento) {
        $('#' + prefixo + '-complemento').value = titleCase(data.complemento);
        marcarPreenchido($('#' + prefixo + '-complemento'));
      }
      if (data.uf) {
        $('#' + prefixo + '-uf').value = data.uf;
        marcarPreenchido($('#' + prefixo + '-uf'));
      }

      status.textContent = '✓ OK';
      status.className = 'status-busca ok';
      atualizarPendencias();
      return true;
    } catch (err) {
      // 🔧 CEP não encontrado → permite digitação manual
      // Mantém o CEP digitado mas avisa o usuário com mensagem amigável
      input.value = mascaraCEP(num);
      marcarPreenchido(input);
      status.textContent = '⚠ Digite manualmente';
      status.className = 'status-busca erro';
      atualizarPendencias();
      return false;
    } finally {
      state.lookupCepEmAndamento[prefixo] = false;
    }
  }

  function bindCep(prefixo, statusId, slot) {
    const input  = $('#' + prefixo + '-cep');
    const status = $('#' + statusId);

    // Flag para bloquear o input listener durante paste (evita race condition)
    let pasteEmAndamento = false;

    // 🔧 Trata colagem (Ctrl+V): limpa formatação e dispara lookup
    input.addEventListener('paste', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      pasteEmAndamento = true;

      const textoColado = (e.clipboardData || window.clipboardData).getData('text');
      const numLimpo = apenasNumeros(textoColado).slice(0, 8);
      const cepFormatado = mascaraCEP(numLimpo);

      // 📋 Log detalhado do paste
      console.group('%c📋 PASTE em CEP (' + prefixo + ')', 'background:#fbbf24;color:black;padding:2px 8px;font-weight:bold;');
      console.log('Texto original   :', JSON.stringify(textoColado));
      console.log('Tamanho original :', textoColado.length, 'caracteres');
      console.log('Apenas dígitos   :', JSON.stringify(apenasNumeros(textoColado)));
      console.log('Aceito (8 dígit.) :', JSON.stringify(numLimpo));
      console.log('Resultado final  :', cepFormatado);
      console.groupEnd();

      // 🔧 Define o valor com DELAY para sobrescrever qualquer auto-paste do browser
      input.value = cepFormatado;
      // Espera o próximo frame e força o valor de novo (segurança extra)
      requestAnimationFrame(() => {
        input.value = cepFormatado;
        // Mais um frame para garantir
        requestAnimationFrame(async () => {
          input.value = cepFormatado;
          console.log('%c✅ Valor final no campo:', 'color:#16a34a;font-weight:bold;', input.value);

          const num = apenasNumeros(input.value);

          if (num.length < 8) {
            if (state[slot]) limparEnderecoCompleto(prefixo);
            status.textContent = '';
            status.className = 'status-busca';
            input.classList.remove('preenchido');
            if (numLimpo.length > 0 && numLimpo.length < 8) {
              status.textContent = `⚠ Colou ${numLimpo.length}/8 dígitos`;
              status.className = 'status-busca erro';
            }
          }

          atualizarPendencias();

          if (num.length === 8 && num !== state[slot]) {
            const ok = await executarLookupCep(prefixo, statusId, slot);
            if (ok) {
              setTimeout(() => $('#' + prefixo + '-numero').focus(), 80);
            } else {
              setTimeout(() => $('#' + prefixo + '-logradouro').focus(), 80);
            }
          }

          // Libera o input listener depois de 200ms
          setTimeout(() => { pasteEmAndamento = false; }, 200);
        });
      });
    });

    input.addEventListener('input', async () => {
      // 🔧 Se um paste está em andamento, ignora o input (evita conflito)
      if (pasteEmAndamento) {
        console.log('🚫 Input bloqueado durante paste');
        return;
      }

      input.value = mascaraCEP(input.value);
      const num = apenasNumeros(input.value);

      // 🔧 Se diminuiu de 8 dígitos, limpa endereço E status anterior
      if (num.length < 8) {
        if (state[slot]) limparEnderecoCompleto(prefixo);
        status.textContent = '';
        status.className = 'status-busca';
        input.classList.remove('preenchido');
      }

      atualizarPendencias();

      if (num.length === 8 && num !== state[slot]) {
        const ok = await executarLookupCep(prefixo, statusId, slot);
        if (ok) {
          setTimeout(() => $('#' + prefixo + '-numero').focus(), 80);
        } else {
          setTimeout(() => $('#' + prefixo + '-logradouro').focus(), 80);
        }
      }
    });

    input.addEventListener('blur', () => {
      input.value = mascaraCEP(input.value);
      marcarPreenchido(input);
      atualizarPendencias();
    });
  }

  bindCep('cob', 'status-cep-cob', 'cepCobConsultado');
  bindCep('ent', 'status-cep-ent', 'cepEntConsultado');

  $('#entrega-igual').addEventListener('change', (e) => {
    $('#bloco-entrega').hidden = e.target.checked;
    atualizarPendencias();
  });

  // ============== Enter avança ==============
  $('#form-cliente').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.target.type === 'submit') return;

    e.preventDefault();

    // 🔧 BLOQUEIO: Enter em CPF/CNPJ inválido NÃO avança
    if (e.target.id === 'f-cpfCnpj') {
      const tipo = $('#f-tipo').value;
      const num = apenasNumeros(e.target.value);
      const tamanho = tipo === 'PF' ? 11 : 14;
      if (num.length !== tamanho || !validarDocumento(num, tipo)) {
        e.target.classList.add('cli-erro-flash');
        setTimeout(() => e.target.classList.remove('cli-erro-flash'), 600);
        $('#status-cnpj').textContent = tipo === 'PF' ? '✗ CPF inválido' : '✗ CNPJ inválido';
        $('#status-cnpj').className = 'status-busca erro';
        return;   // mantém o foco no campo
      }
    }

    if (e.target.id === 'cob-cep' || e.target.id === 'ent-cep') {
      const num = apenasNumeros(e.target.value);
      if (num.length !== 8) {
        e.target.classList.add('cli-erro-flash');
        setTimeout(() => e.target.classList.remove('cli-erro-flash'), 600);
        return;
      }
      const prefixo = e.target.id === 'cob-cep' ? 'cob' : 'ent';
      while (state.lookupCepEmAndamento[prefixo]) {
        await new Promise(r => setTimeout(r, 50));
      }
      return;
    }

    marcarPreenchido(e.target);

    // 🔧 Lista de focáveis IGNORA blocos escondidos (entrega E inscrições)
    const focaveis = $$('#form-cliente input, #form-cliente select, #form-cliente textarea, #form-cliente button')
      .filter(el => {
        if (el.disabled || el.hidden) return false;
        // Verifica se está dentro de algum bloco escondido
        const blocoEntrega = el.closest('#bloco-entrega');
        if (blocoEntrega && blocoEntrega.hidden) return false;
        const blocoInscricoes = el.closest('#bloco-inscricoes');
        if (blocoInscricoes && blocoInscricoes.hidden) return false;
        // Botões dentro de campo-isento-wrap não devem capturar Enter
        if (el.classList && el.classList.contains('btn-isento')) return false;
        return true;
      });

    const idx = focaveis.indexOf(e.target);
    if (idx >= 0 && idx < focaveis.length - 1) {
      const prox = focaveis[idx + 1];
      prox.focus();
      if (prox.select) prox.select();
    }
  });

  // ============== Eventos blur/focus ==============
  $$('#form-cliente input, #form-cliente select, #form-cliente textarea')
    .forEach(el => {
      el.addEventListener('blur',  () => { marcarPreenchido(el); atualizarPendencias(); });
      el.addEventListener('focus', () => el.classList.remove('preenchido'));
      // Já temos input listeners específicos para campos com lógica,
      // este só faz atualização genérica para os outros
      if (!['f-cpfCnpj', 'f-telefone', 'f-email', 'cob-cep', 'ent-cep'].includes(el.id)) {
        el.addEventListener('input', () => atualizarPendencias());
      }
    });

  // ============== Submit ==============
  $('#form-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();

    const pendentes = atualizarPendencias();
    if (pendentes > 0) {
      const primeiroPendente = $$('.cli-form .pendente')[0];
      if (primeiroPendente) {
        primeiroPendente.focus();
        primeiroPendente.classList.add('cli-erro-flash');
        setTimeout(() => primeiroPendente.classList.remove('cli-erro-flash'), 600);
      }
      return;
    }

    // 🔧 Valida CPF/CNPJ antes de enviar (só para novo cadastro)
    if (!state.editandoId) {
      const tipo = $('#f-tipo').value;
      const doc = apenasNumeros($('#f-cpfCnpj').value);
      if (!validarDocumento(doc, tipo)) {
        const campo = $('#f-cpfCnpj');
        campo.focus();
        campo.classList.add('cli-erro-flash');
        $('#status-cnpj').textContent = tipo === 'PF' ? '✗ CPF inválido' : '✗ CNPJ inválido';
        $('#status-cnpj').className = 'status-busca erro';
        setTimeout(() => campo.classList.remove('cli-erro-flash'), 600);
        return;
      }
    }

    // 🔧 Aviso IE/IM (só para PJ)
    if ($('#f-tipo').value === 'PJ') {
      const ie = $('#f-inscricaoEstadual').value.trim();
      const im = $('#f-inscricaoMunicipal').value.trim();
      const vazios = [];
      if (!ie) vazios.push('Inscrição Estadual');
      if (!im) vazios.push('Inscrição Municipal');
      if (vazios.length) {
        const msg = vazios.length === 2
          ? 'Inscrição Estadual e Municipal estão vazias.\n\nSe a empresa for isenta, clique em "ISENTO" antes de salvar.\n\nDeseja continuar mesmo assim?'
          : `${vazios[0]} está vazia.\n\nSe a empresa for isenta, clique em "ISENTO".\n\nDeseja continuar mesmo assim?`;
        if (!confirm(msg)) {
          const alvo = !ie ? $('#f-inscricaoEstadual') : $('#f-inscricaoMunicipal');
          alvo.focus();
          return;
        }
      }
    }

    const igual = $('#entrega-igual').checked;
    const payload = {
      nome:        $('#f-nome').value.trim(),
      email:       $('#f-email').value.trim(),
      telefone:    $('#f-telefone').value.trim(),
      observacoes: $('#f-observacoes').value.trim(),
      inscricaoEstadual:  $('#f-inscricaoEstadual').value.trim(),
      inscricaoMunicipal: $('#f-inscricaoMunicipal').value.trim(),
      enderecoCobranca:     lerEndereco('cob'),
      entregaIgualCobranca: igual,
      enderecoEntrega:      igual ? null : lerEndereco('ent')
    };

    console.log('📤 Payload sendo enviado:', payload);

    try {
      if (state.editandoId) {
        await api('PUT', '/' + state.editandoId, payload);
      } else {
        payload.tipo    = $('#f-tipo').value;
        payload.cpfCnpj = apenasNumeros($('#f-cpfCnpj').value);
        await api('POST', '/', payload);
      }
      fecharModal();
      await recarregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });

  // ============== Bloco IE/IM (Inscrições) ==============
  function atualizarVisibilidadeInscricoes() {
    const tipo = $('#f-tipo').value;
    const bloco = $('#bloco-inscricoes');
    if (!bloco) return;
    if (tipo === 'PJ') {
      bloco.hidden = false;
      bloco.style.display = '';
    } else {
      bloco.hidden = true;
      bloco.style.display = 'none';
      // Limpa valores quando esconde
      const ie = $('#f-inscricaoEstadual');
      const im = $('#f-inscricaoMunicipal');
      if (ie) ie.value = '';
      if (im) im.value = '';
      atualizarBotoesIsento();
    }
  }

  function atualizarBotoesIsento() {
    ['f-inscricaoEstadual', 'f-inscricaoMunicipal'].forEach(id => {
      const input = $('#' + id);
      const btn = document.querySelector(`.btn-isento[data-target="${id}"]`);
      if (!input || !btn) return;
      if (input.value === 'ISENTO') {
        btn.classList.add('ativo');
        btn.textContent = '✓ ISENTO';
      } else {
        btn.classList.remove('ativo');
        btn.textContent = 'ISENTO';
      }
    });
  }

  // Estende mudança de tipo
  $('#f-tipo').addEventListener('change', atualizarVisibilidadeInscricoes);

  // Botão ISENTO
  document.querySelectorAll('.btn-isento').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input || input.disabled) return;
      if (input.value === 'ISENTO') {
        input.value = '';
        btn.classList.remove('ativo');
        btn.textContent = 'ISENTO';
        input.classList.remove('preenchido');
      } else {
        input.value = 'ISENTO';
        btn.classList.add('ativo');
        btn.textContent = '✓ ISENTO';
        input.classList.add('preenchido');
      }
    });
  });

  // Máscara: aceita só números, exceto se for "ISENTO"
  ['f-inscricaoEstadual', 'f-inscricaoMunicipal'].forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('input', () => {
      if (input.value.toUpperCase() === 'ISENTO') {
        input.value = 'ISENTO';
        return;
      }
      input.value = input.value.replace(/\D/g, '');
      const btn = document.querySelector(`.btn-isento[data-target="${id}"]`);
      if (btn) {
        btn.classList.remove('ativo');
        btn.textContent = 'ISENTO';
      }
    });
  });

  recarregar();

})();
