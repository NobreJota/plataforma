/* public/js/auxiliares/fornecedores.js
 * Cadastro de Fornecedores — UX otimizada para PJ:
 *  ✓ Campos bloqueados até CNPJ válido
 *  ✓ Foco automático no CNPJ ao abrir
 *  ✓ Selo "⚠ Receita Federal" nos campos preenchidos pelo lookup
 *  ✓ Selo some quando o usuário edita o campo
 *  ✓ Para PF: campos abertos desde o início
 */
(() => {
  'use strict';

  console.log('%c🟣 fornecedores.js v3 — Duplicidade verificada ANTES da BrasilAPI', 'background:#7c3aed;color:white;padding:6px 12px;border-radius:4px;font-weight:bold;font-size:14px;');
  console.log('%c   CNPJ duplicado agora bloqueia o lookup automático', 'color:#7c3aed;font-weight:bold;');

  const API     = '/aux/api/fornecedores';
  const LOOKUP  = '/aux/api/lookup';
  const $       = (sel) => document.querySelector(sel);
  const $$      = (sel) => Array.from(document.querySelectorAll(sel));

  // Campos que ficam bloqueados até CNPJ validar (apenas para PJ)
  const CAMPOS_BLOQUEAVEIS = [
    'f-nome', 'f-email', 'f-telefone',
    'f-inscricaoEstadual', 'f-inscricaoMunicipal',
    'cob-cep', 'cob-logradouro', 'cob-numero', 'cob-complemento',
    'cob-bairro', 'cob-cidade', 'cob-uf',
    'entrega-igual', 'f-observacoes'
  ];

  // Campos que vêm da Receita Federal (recebem selo ⚠)
  const CAMPOS_RF = [
    'f-nome', 'f-email', 'f-telefone',
    'cob-logradouro', 'cob-bairro', 'cob-cidade', 'cob-uf'
  ];

  const OBRIG_FIXOS = [
    'f-tipo', 'f-cpfCnpj', 'f-nome',
    'cob-cep', 'cob-logradouro', 'cob-cidade', 'cob-uf'
  ];
  const OBRIG_ENTREGA = [
    'ent-cep', 'ent-logradouro', 'ent-cidade', 'ent-uf'
  ];

  const CAMPOS_LIMPAR_AO_APAGAR_CEP = [
    'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'
  ];

  const state = {
    editandoId: null,
    debounceTimer: null,
    cnpjConsultado: '',
    cnpjValidado: false,    // 🔧 NOVO: indica se já validou um CNPJ
    cepCobConsultado: '',
    cepEntConsultado: '',
    lookupCepEmAndamento: { cob: false, ent: false }
  };

  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
    return data;
  }

  const apenasNumeros = (s) => String(s || '').replace(/\D/g, '');

  // ============== Validação CPF/CNPJ ==============
  function validarCPF(cpf) {
    cpf = apenasNumeros(cpf);
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;
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
    const minusculas = new Set([
      'de', 'da', 'do', 'das', 'dos',
      'e', 'a', 'o', 'as', 'os',
      'em', 'na', 'no', 'nas', 'nos',
      'para', 'por', 'com'
    ]);
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
      if (idx > 0 && minusculas.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
  }

  // ============== Lock/Unlock ==============
  function bloquearCampos() {
    CAMPOS_BLOQUEAVEIS.forEach(id => {
      const el = $('#' + id);
      if (el) {
        el.disabled = true;
        if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
          el.placeholder = 'Aguardando CNPJ...';
        }
      }
    });
    $('#aviso-cnpj').hidden = false;
  }

  function desbloquearCampos() {
    CAMPOS_BLOQUEAVEIS.forEach(id => {
      const el = $('#' + id);
      if (el) el.disabled = false;
    });
    $('#aviso-cnpj').hidden = true;
    // Restaura placeholders originais
    $('#f-nome').placeholder        = 'ex: Empresa XYZ Ltda';
    $('#f-email').placeholder       = 'contato@empresa.com';
    $('#f-telefone').placeholder    = '(00) 00000-0000';
    $('#cob-cep').placeholder       = '00000-000';
    $('#cob-logradouro').placeholder = 'Rua, Avenida...';
    $('#cob-numero').placeholder    = '100';
    $('#cob-complemento').placeholder = 'Sala, Apto...';
    $('#f-observacoes').placeholder = 'Anotações internas...';
  }

  // ============== Selos Receita Federal ==============
  function marcarComoRF(idCampo) {
    const selo = document.querySelector(`.selo-rf[data-campo="${idCampo}"]`);
    if (selo) selo.hidden = false;
  }

  function removerSeloRF(idCampo) {
    const selo = document.querySelector(`.selo-rf[data-campo="${idCampo}"]`);
    if (selo) selo.hidden = true;
  }

  function limparTodosSelos() {
    $$('.selo-rf').forEach(s => s.hidden = true);
  }

  // ============== Pendências ==============
  function listaObrigatoriosFixos() {
    const ids = [...OBRIG_FIXOS];
    if (!$('#entrega-igual').checked) ids.push(...OBRIG_ENTREGA);
    return ids.map(id => $('#' + id)).filter(Boolean);
  }

  function contatoOk() {
    const email = $('#f-email').value.trim();
    const tel   = $('#f-telefone').value.trim();
    return !!(email || tel);
  }

  function atualizarPendencias() {
    const obrigatorios = listaObrigatoriosFixos();
    let pendentes = 0;

    obrigatorios.forEach(el => {
      if (el.disabled) return;   // 🔧 Ignora campos bloqueados
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

    const email = $('#f-email');
    const tel   = $('#f-telefone');
    if (!email.disabled && !tel.disabled) {
      if (!contatoOk()) {
        email.classList.add('pendente');
        tel.classList.add('pendente');
        email.classList.remove('preenchido');
        tel.classList.remove('preenchido');
        pendentes++;
      } else {
        email.classList.remove('pendente');
        tel.classList.remove('pendente');
        if (email.value.trim()) email.classList.add('preenchido');
        if (tel.value.trim())   tel.classList.add('preenchido');
      }
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
    if (!el || el.disabled) return;
    const valor = el.value && String(el.value).trim();
    if (valor) {
      el.classList.add('preenchido');
      el.classList.remove('pendente');
    } else {
      el.classList.remove('preenchido');
    }
  }

  function limparEstadosVisuais() {
    $$('.for-form .preenchido, .for-form .pendente, .for-form .for-erro-flash')
      .forEach(el => el.classList.remove('preenchido', 'pendente', 'for-erro-flash'));
    limparTodosSelos();
  }

  function limparEnderecoCompleto(prefixo) {
    CAMPOS_LIMPAR_AO_APAGAR_CEP.forEach(c => {
      const el = $('#' + prefixo + '-' + c);
      if (el) {
        el.value = '';
        el.classList.remove('preenchido');
      }
      removerSeloRF(prefixo + '-' + c);
    });
    state[prefixo === 'cob' ? 'cepCobConsultado' : 'cepEntConsultado'] = '';
    const status = $('#status-cep-' + prefixo);
    if (status) {
      status.textContent = '';
      status.className = 'status-busca';
    }
    atualizarPendencias();
  }

  // 🔧 Limpa TUDO do endereço, INCLUSIVE o CEP
  function limparEnderecoTotal(prefixo) {
    const todos = ['cep', ...CAMPOS_LIMPAR_AO_APAGAR_CEP];
    todos.forEach(c => {
      const el = $('#' + prefixo + '-' + c);
      if (el) {
        el.value = '';
        el.classList.remove('preenchido');
      }
      removerSeloRF(prefixo + '-' + c);
    });
    state[prefixo === 'cob' ? 'cepCobConsultado' : 'cepEntConsultado'] = '';
    const status = $('#status-cep-' + prefixo);
    if (status) {
      status.textContent = '';
      status.className = 'status-busca';
    }
  }

  // 🔧 Reset completo após CPF/CNPJ inválido ou duplicado
  function resetarDadosPosCpf() {
    $('#f-cpfCnpj').value = '';
    $('#f-nome').value = '';
    $('#f-email').value = '';
    $('#f-telefone').value = '';
    $('#f-inscricaoEstadual').value = '';
    $('#f-inscricaoMunicipal').value = '';
    if ($('#f-observacoes')) $('#f-observacoes').value = '';
    limparEnderecoTotal('cob');
    limparEnderecoTotal('ent');
    $('#status-cnpj').textContent = '';
    $('#status-cnpj').className = 'status-busca';
    state.cnpjConsultado = '';
    state.cnpjValidado = false;
    state.cepCobConsultado = '';
    state.cepEntConsultado = '';
    $$('.for-form .preenchido').forEach(el => el.classList.remove('preenchido'));
    limparTodosSelos();
    atualizarBotoesIsento();
    bloquearCampos();
    atualizarPendencias();
  }

  // ============== Listagem ==============
  async function recarregar() {
    const tbody = $('#lista-fornecedores');
    const busca = $('#busca').value.trim();
    const inativos = $('#incluir-inativos').checked;

    tbody.innerHTML = '<tr><td colspan="8" class="for-empty">Carregando...</td></tr>';

    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (inativos) params.set('incluirInativos', 'true');
      const url = '/' + (params.toString() ? '?' + params.toString() : '');

      const fornecedores = await api('GET', url);

      $('#contador').textContent =
        `${fornecedores.length} ${fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}`;

      if (!fornecedores.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="for-empty">
          ${busca ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor cadastrado. Clique em ➕ Novo fornecedor.'}
        </td></tr>`;
        return;
      }

      tbody.innerHTML = '';
      fornecedores.forEach(f => {
        const cob = f.enderecoCobranca || {};
        const cidadeUf = cob.cidade ? `${cob.cidade}/${cob.uf || ''}` : '—';
        const tr = document.createElement('tr');
        if (!f.ativo) tr.classList.add('inativo');
        tr.innerHTML = `
          <td class="codigo-cell">${f.codigo}</td>
          <td><span class="tipo-badge ${f.tipo}">${f.tipo}</span></td>
          <td>${escapar(f.nome)}</td>
          <td><code>${f.cpfCnpjFormatado || f.cpfCnpj}</code></td>
          <td>${escapar(cidadeUf)}</td>
          <td>${escapar(f.telefone || '—')}</td>
          <td><span class="status-badge ${f.ativo ? 'ativo' : 'inativo'}">${f.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td class="acoes-cell">
            <button class="btn-icon" data-acao="editar" data-id="${f._id}" title="Editar">✏</button>
            ${f.ativo
              ? `<button class="btn-icon danger" data-acao="desativar" data-id="${f._id}" title="Desativar">🗑</button>`
              : `<button class="btn-icon" data-acao="reativar" data-id="${f._id}" title="Reativar">↻</button>`}
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="for-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  $('#busca').addEventListener('input', () => {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(recarregar, 300);
  });
  $('#incluir-inativos').addEventListener('change', recarregar);

  $('#lista-fornecedores').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-acao]');
    if (!btn) return;
    const { acao, id } = btn.dataset;

    if (acao === 'editar') {
      try { const f = await api('GET', '/' + id); abrirModal(f); }
      catch (err) { alert(err.message); }
    }
    else if (acao === 'desativar') {
      if (!confirm('Desativar este fornecedor? O histórico será preservado.')) return;
      try { await api('DELETE', '/' + id); await recarregar(); }
      catch (err) { alert(err.message); }
    }
    else if (acao === 'reativar') {
      try { await api('POST', `/${id}/reativar`); await recarregar(); }
      catch (err) { alert(err.message); }
    }
  });

  $('#btn-novo-fornecedor').addEventListener('click', () => abrirModal(null));

  document.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined) fecharModal();
  });

  function preencherEndereco(prefixo, end = {}, daRF = false) {
    const campos = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
    campos.forEach(c => {
      const el = $('#' + prefixo + '-' + c);
      if (!el) return;
      el.value = (c === 'cep') ? (end.cep ? mascaraCEP(end.cep) : '') : (end[c] || '');
      marcarPreenchido(el);
      // Se vem da RF e tem valor, marca selo
      if (daRF && el.value && CAMPOS_RF.includes(prefixo + '-' + c)) {
        marcarComoRF(prefixo + '-' + c);
      }
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

  function abrirModal(fornecedor) {
    state.editandoId = fornecedor?._id || null;
    state.cnpjConsultado = '';
    state.cnpjValidado = false;
    state.cepCobConsultado = '';
    state.cepEntConsultado = '';

    $('#modal-titulo').textContent = fornecedor ? `Editar ${fornecedor.codigo}` : 'Novo fornecedor';
    $('#codigo-preview').hidden = !!fornecedor;

    const tipoSel = $('#f-tipo');
    const docInp  = $('#f-cpfCnpj');

    tipoSel.value    = fornecedor?.tipo || 'PJ';
    tipoSel.disabled = !!fornecedor;
    docInp.value     = fornecedor?.cpfCnpjFormatado || '';
    docInp.disabled  = !!fornecedor;

    $('#f-nome').value        = fornecedor?.nome        || '';
    $('#f-email').value       = fornecedor?.email       || '';
    $('#f-telefone').value    = fornecedor?.telefone    || '';
    $('#f-observacoes').value = fornecedor?.observacoes || '';
    $('#f-inscricaoEstadual').value  = fornecedor?.inscricaoEstadual  || '';
    $('#f-inscricaoMunicipal').value = fornecedor?.inscricaoMunicipal || '';
    atualizarBotoesIsento();

    // 🔧 Para novo cadastro: limpeza TOTAL dos endereços
    if (fornecedor) {
      preencherEndereco('cob', fornecedor.enderecoCobranca);
      preencherEndereco('ent', fornecedor.enderecoEntrega);
    } else {
      limparEnderecoTotal('cob');
      limparEnderecoTotal('ent');
    }

    const igual = fornecedor ? fornecedor.entregaIgualCobranca !== false : true;
    $('#entrega-igual').checked = igual;
    $('#bloco-entrega').hidden  = igual;

    $('#status-cnpj').textContent    = '';
    $('#status-cep-cob').textContent = '';
    $('#status-cep-ent').textContent = '';
    $('#status-cep-cob').className = 'status-busca';
    $('#status-cep-ent').className = 'status-busca';

    limparEstadosVisuais();

    // 🔧 LÓGICA DE LOCK/UNLOCK
    if (fornecedor) {
      // Editando: sempre desbloqueia (já tem dados)
      desbloquearCampos();
      state.cnpjValidado = true;
      $$('.for-form input, .for-form select, .for-form textarea')
        .forEach(el => marcarPreenchido(el));
    } else if (tipoSel.value === 'PF') {
      // Novo PF: desbloqueia (não tem lookup automático)
      desbloquearCampos();
      state.cnpjValidado = true;  // tratamos como "liberado"
    } else {
      // Novo PJ: bloqueia até CNPJ ser consultado
      bloquearCampos();
    }

    atualizarPendencias();
    atualizarLabelDoc();
    atualizarVisibilidadeInscricoes();

    $('#modal-fornecedor').hidden = false;
    setTimeout(() => $('#f-cpfCnpj').focus(), 50);
  }

  function fecharModal() {
    $('#modal-fornecedor').hidden = true;
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
    state.cnpjValidado = false;
    // 🔧 Limpa IE/IM ao trocar tipo
    $('#f-inscricaoEstadual').value = '';
    $('#f-inscricaoMunicipal').value = '';
    atualizarBotoesIsento();
    limparTodosSelos();
    atualizarLabelDoc();

    if ($('#f-tipo').value === 'PF') {
      desbloquearCampos();
      state.cnpjValidado = true;
    } else {
      ['f-nome', 'f-email', 'f-telefone', 'f-observacoes',
       'cob-cep', 'cob-logradouro', 'cob-numero', 'cob-complemento',
       'cob-bairro', 'cob-cidade', 'cob-uf'].forEach(id => {
        const el = $('#' + id);
        if (el) el.value = '';
      });
      bloquearCampos();
    }
    atualizarPendencias();
  });

  $('#f-cpfCnpj').addEventListener('input', async (e) => {
    const tipo = $('#f-tipo').value;
    e.target.value = tipo === 'PF' ? mascaraCPF(e.target.value) : mascaraCNPJ(e.target.value);
    atualizarPendencias();

    const num = apenasNumeros(e.target.value);
    const tamanhoCompleto = tipo === 'PF' ? 11 : 14;

    if (num.length < tamanhoCompleto) {
      $('#status-cnpj').textContent = '';
      $('#status-cnpj').className = 'status-busca';
      if (tipo === 'PJ') state.cnpjConsultado = '';
    }

    if (tipo === 'PJ' && num.length === 14 && num !== state.cnpjConsultado) {
      // 🔧 Valida CNPJ antes de consultar (economiza chamada)
      if (!validarCNPJ(num)) {
        $('#status-cnpj').textContent = '✗ CNPJ inválido';
        $('#status-cnpj').className = 'status-busca erro';
        e.target.classList.add('for-erro-flash');
        setTimeout(() => e.target.classList.remove('for-erro-flash'), 600);
        return;
      }

      // 🔧 Verifica duplicidade ANTES de consultar BrasilAPI
      // (evita preencher dados de um CNPJ que já está cadastrado)
      if (!state.editandoId) {
        try {
          const resDup = await fetch(`${API}/buscar-cpfcnpj/${num}`);
          const dataDup = await resDup.json();
          if (dataDup.existe) {
            $('#status-cnpj').textContent = `✗ Já cadastrado: ${dataDup.codigo}`;
            $('#status-cnpj').className = 'status-busca erro';
            const campo = e.target;
            campo.classList.add('for-erro-flash');
            alert(`Este CNPJ já está cadastrado:\n\n${dataDup.codigo} - ${dataDup.nome}\n\nUse a tela de listagem para editar.`);
            setTimeout(() => {
              resetarDadosPosCpf();
              campo.focus();
              setTimeout(() => campo.classList.remove('for-erro-flash'), 600);
            }, 0);
            return;  // Não consulta BrasilAPI
          }
        } catch (err) {
          console.warn('Falha ao verificar duplicidade:', err);
        }
      }

      state.cnpjConsultado = num;
      await consultarCnpjAuto(num);
    }
  });

  // 🔧 Paste handler CPF/CNPJ
  $('#f-cpfCnpj').addEventListener('paste', (e) => {
    e.preventDefault();
    const tipo = $('#f-tipo').value;
    const textoColado = (e.clipboardData || window.clipboardData).getData('text');
    const tamanho = tipo === 'PF' ? 11 : 14;
    const numLimpo = apenasNumeros(textoColado).slice(0, tamanho);
    e.target.value = tipo === 'PF' ? mascaraCPF(numLimpo) : mascaraCNPJ(numLimpo);
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // 🔧 Validação no blur + checa duplicidade
  $('#f-cpfCnpj').addEventListener('blur', async (e) => {
    if (state.editandoId) return;
    const tipo = $('#f-tipo').value;
    const num = apenasNumeros(e.target.value);
    if (!num) return;
    const tamanho = tipo === 'PF' ? 11 : 14;
    if (num.length !== tamanho) return;

    if (!validarDocumento(num, tipo)) {
      const docTxt = tipo === 'PF' ? 'CPF' : 'CNPJ';
      $('#status-cnpj').textContent = `✗ ${docTxt} inválido`;
      $('#status-cnpj').className = 'status-busca erro';
      const cpfCampo = e.target;
      cpfCampo.classList.add('for-erro-flash');
      alert(`${docTxt} inválido.\n\nVerifique os dígitos e digite novamente.`);
      setTimeout(() => {
        resetarDadosPosCpf();
        cpfCampo.focus();
        setTimeout(() => cpfCampo.classList.remove('for-erro-flash'), 600);
      }, 0);
      return;
    }

    // Verifica duplicidade no banco (só para PF — PJ já verifica no input)
    if (tipo === 'PF') {
      try {
        const res = await fetch(`${API}/buscar-cpfcnpj/${num}`);
        const data = await res.json();
        if (data.existe) {
          const cpfCampo = e.target;
          $('#status-cnpj').textContent = `✗ Já cadastrado: ${data.codigo}`;
          $('#status-cnpj').className = 'status-busca erro';
          cpfCampo.classList.add('for-erro-flash');
          alert(`Este CPF já está cadastrado:\n\n${data.codigo} - ${data.nome}\n\nUse a tela de listagem para editar.`);
          setTimeout(() => {
            resetarDadosPosCpf();
            cpfCampo.focus();
            setTimeout(() => cpfCampo.classList.remove('for-erro-flash'), 600);
          }, 0);
          return;
        }
      } catch (err) {
        console.warn('Falha ao verificar duplicidade:', err);
      }
    }
  });

  $('#f-cpfCnpj').addEventListener('focus', () => {
    $('#status-cnpj').textContent = '';
    $('#status-cnpj').className = 'status-busca';
  });

  $('#f-telefone').addEventListener('input', (e) => {
    e.target.value = mascaraTelefone(e.target.value);
    removerSeloRF('f-telefone');
    atualizarPendencias();
  });

  // 🔧 Paste handler telefone
  $('#f-telefone').addEventListener('paste', (e) => {
    e.preventDefault();
    const textoColado = (e.clipboardData || window.clipboardData).getData('text');
    const numLimpo = apenasNumeros(textoColado).slice(0, 11);
    e.target.value = mascaraTelefone(numLimpo);
    removerSeloRF('f-telefone');
    atualizarPendencias();
    marcarPreenchido(e.target);
  });

  $('#f-email').addEventListener('input', () => {
    removerSeloRF('f-email');
    atualizarPendencias();
  });

  $('#f-nome').addEventListener('input', () => {
    removerSeloRF('f-nome');
  });

  $('#f-nome').addEventListener('blur', (e) => {
    if (e.target.value.trim()) {
      e.target.value = titleCase(e.target.value.trim());
    }
    atualizarPendencias();
  });

  // Selos some quando usuário edita os campos de endereço da cobrança
  ['cob-logradouro', 'cob-bairro', 'cob-cidade', 'cob-uf'].forEach(id => {
    const el = $('#' + id);
    if (el) {
      el.addEventListener('input', () => removerSeloRF(id));
    }
  });

  async function consultarCnpjAuto(cnpj) {
    const status = $('#status-cnpj');
    status.textContent = '🔍 Consultando...';
    status.className = 'status-busca';

    try {
      const res = await fetch(`${LOOKUP}/cnpj/${cnpj}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Falha na consulta');

      // 🔧 DESBLOQUEIA tudo
      desbloquearCampos();
      state.cnpjValidado = true;

      // Preenche e marca como dados da RF
      if (data.razaoSocial) {
        $('#f-nome').value = titleCase(data.razaoSocial);
        marcarPreenchido($('#f-nome'));
        marcarComoRF('f-nome');
      }
      if (data.email) {
        $('#f-email').value = data.email;
        marcarPreenchido($('#f-email'));
        marcarComoRF('f-email');
      }
      if (data.telefone) {
        $('#f-telefone').value = mascaraTelefone(data.telefone);
        marcarPreenchido($('#f-telefone'));
        marcarComoRF('f-telefone');
      }
      if (data.endereco) {
        // Aplica Title Case nos campos textuais
        const end = {
          ...data.endereco,
          logradouro: titleCase(data.endereco.logradouro),
          bairro:     titleCase(data.endereco.bairro),
          cidade:     titleCase(data.endereco.cidade)
        };
        preencherEndereco('cob', end, true);
        state.cepCobConsultado = end.cep || '';
      }

      const aviso = data.ativa ? '✓ Encontrado' : `⚠ ${data.situacao || 'Inativo'}`;
      status.textContent = aviso;
      status.className = 'status-busca ' + (data.ativa ? 'ok' : 'erro');
      atualizarPendencias();

      // Foco no número (que a RF não traz)
      setTimeout(() => $('#cob-numero').focus(), 100);
    } catch (err) {
      status.textContent = '✗ ' + err.message;
      status.className = 'status-busca erro';
      // CNPJ inválido na RF: desbloqueia para o usuário digitar manualmente
      desbloquearCampos();
      state.cnpjValidado = true;
    }
  }

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

      // CEP manual (não vem da RF, vem do ViaCEP) — não marca selo RF
      if (data.logradouro) {
        $('#' + prefixo + '-logradouro').value = titleCase(data.logradouro);
        marcarPreenchido($('#' + prefixo + '-logradouro'));
        removerSeloRF(prefixo + '-logradouro');
      }
      if (data.bairro) {
        $('#' + prefixo + '-bairro').value = titleCase(data.bairro);
        marcarPreenchido($('#' + prefixo + '-bairro'));
        removerSeloRF(prefixo + '-bairro');
      }
      if (data.cidade) {
        $('#' + prefixo + '-cidade').value = titleCase(data.cidade);
        marcarPreenchido($('#' + prefixo + '-cidade'));
        removerSeloRF(prefixo + '-cidade');
      }
      if (data.uf) {
        $('#' + prefixo + '-uf').value = data.uf;
        marcarPreenchido($('#' + prefixo + '-uf'));
        removerSeloRF(prefixo + '-uf');
      }

      status.textContent = '✓ OK';
      status.className = 'status-busca ok';
      atualizarPendencias();
      return true;
    } catch (err) {
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

    let pasteEmAndamento = false;

    // 🔧 Paste handler
    input.addEventListener('paste', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      pasteEmAndamento = true;

      const textoColado = (e.clipboardData || window.clipboardData).getData('text');
      const numLimpo = apenasNumeros(textoColado).slice(0, 8);
      const cepFormatado = mascaraCEP(numLimpo);

      input.value = cepFormatado;
      requestAnimationFrame(() => {
        input.value = cepFormatado;
        requestAnimationFrame(async () => {
          input.value = cepFormatado;
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

          setTimeout(() => { pasteEmAndamento = false; }, 200);
        });
      });
    });

    input.addEventListener('input', async () => {
      if (pasteEmAndamento) return;

      input.value = mascaraCEP(input.value);
      const num = apenasNumeros(input.value);

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

  $('#form-fornecedor').addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.target.type === 'submit') return;

    e.preventDefault();

    if (e.target.id === 'cob-cep' || e.target.id === 'ent-cep') {
      const num = apenasNumeros(e.target.value);
      if (num.length !== 8) {
        e.target.classList.add('for-erro-flash');
        setTimeout(() => e.target.classList.remove('for-erro-flash'), 600);
        return;
      }
      const prefixo = e.target.id === 'cob-cep' ? 'cob' : 'ent';
      while (state.lookupCepEmAndamento[prefixo]) {
        await new Promise(r => setTimeout(r, 50));
      }
      return;
    }

    marcarPreenchido(e.target);

    const focaveis = $$('#form-fornecedor input, #form-fornecedor select, #form-fornecedor textarea, #form-fornecedor button')
      .filter(el => {
        if (el.disabled || el.hidden) return false;
        const bloco = el.closest('#bloco-entrega');
        if (bloco && bloco.hidden) return false;
        return true;
      });

    const idx = focaveis.indexOf(e.target);
    if (idx >= 0 && idx < focaveis.length - 1) {
      const prox = focaveis[idx + 1];
      prox.focus();
      if (prox.select) prox.select();
    }
  });

  $$('#form-fornecedor input, #form-fornecedor select, #form-fornecedor textarea')
    .forEach(el => {
      el.addEventListener('blur',  () => { marcarPreenchido(el); atualizarPendencias(); });
      el.addEventListener('focus', () => el.classList.remove('preenchido'));
      if (!['f-cpfCnpj', 'f-telefone', 'f-email', 'cob-cep', 'ent-cep'].includes(el.id)) {
        el.addEventListener('input', () => atualizarPendencias());
      }
    });

  $('#form-fornecedor').addEventListener('submit', async (e) => {
    e.preventDefault();

    const pendentes = atualizarPendencias();
    if (pendentes > 0) {
      const primeiroPendente = $$('.for-form .pendente')[0];
      if (primeiroPendente) {
        primeiroPendente.focus();
        primeiroPendente.classList.add('for-erro-flash');
        setTimeout(() => primeiroPendente.classList.remove('for-erro-flash'), 600);
      }
      return;
    }

    // 🔧 Valida CPF/CNPJ antes de enviar
    if (!state.editandoId) {
      const tipo = $('#f-tipo').value;
      const doc = apenasNumeros($('#f-cpfCnpj').value);
      if (!validarDocumento(doc, tipo)) {
        const campo = $('#f-cpfCnpj');
        campo.focus();
        campo.classList.add('for-erro-flash');
        $('#status-cnpj').textContent = tipo === 'PF' ? '✗ CPF inválido' : '✗ CNPJ inválido';
        $('#status-cnpj').className = 'status-busca erro';
        setTimeout(() => campo.classList.remove('for-erro-flash'), 600);
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
    if (bloco) bloco.hidden = (tipo !== 'PJ');
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

  $('#f-tipo').addEventListener('change', atualizarVisibilidadeInscricoes);

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
