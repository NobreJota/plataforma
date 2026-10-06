/* Destino: C:\plataformaRota\public\js\contab\auxiliares\fornecedores.js
 * Alterado em: 30/09/2026
 *   - lista mostra os fornecedores do Access ainda nao transferidos, com a
 *     etiqueta "ajustar"; o botao Completar abre a ficha preenchida com o que
 *     veio do Access e a conta dele (sem escolher titulo)
 *   - fornecedor sem telefone nem e-mail tambem mostra "ajustar"
 *   - botao "? Ajuda" abre o painel lateral de orientacao
 *   - e-mail/telefone deixam de ser obrigatorios
 *   - Enter num campo da ficha vai para o proximo campo; no ultimo, para o
 *     botao Salvar (so Enter no botao ou clique salva)
 *
 * public/js/contab/auxiliares/fornecedores.js
 * Cadastro de Fornecedores — compartilhado entre empresas (model fornec).
 * O cadastro escolhe o título contábil; a conta (subtítulo) é criada pela API.
 */
(() => {
  'use strict';

  console.log('%c🟣 fornecedores.js v7 — título contábil, vínculo e desvincular conta', 'background:#7c3aed;color:white;padding:6px 12px;border-radius:4px;font-weight:bold;');

  const API = '/aux/api/fornecedores';
  const LOOKUP = '/aux/api/lookup';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const apenasNumeros = (s) => String(s || '').replace(/\D/g, '');

  const state = {
    editandoId: null,
    cnpjConsultado: '',
    cepConsultado: '',
    debounceTimer: null,
    lookupCepEmAndamento: false,
    vinculando: false,       // CNPJ já existe no cadastro compartilhado, sem vínculo com esta empresa
    titulos: [],
    access: null,            // NrFornec do Access quando a ficha completa um pendente
    lista: []
  };

  /* ===== Títulos contábeis (2.01.xxx) ===== */
  async function carregarTitulos() {
    try {
      state.titulos = await api('GET', '/titulos');
    } catch (err) {
      state.titulos = [];
      console.error('Títulos:', err.message);
    }
    preencherTitulos();
  }
  function preencherTitulos() {
    const sel = $('#f-titulo');
    if (!state.titulos.length) {
      sel.innerHTML = '<option value="">Nenhum título sob 2.01 no plano</option>';
      return;
    }
    sel.innerHTML = '<option value="">Escolha o título...</option>' +
      state.titulos.map(t => `<option value="${t.codigo}">${t.codigo} - ${t.nome}</option>`).join('');
  }
  function modoTitulo(f) {
    // Novo/vínculo: escolhe o título. Edição: mostra a conta, que não muda mais.
    const editando = !!(f && f.ncontabil && !state.vinculando);
    $('#bloco-titulo').hidden = editando;
    $('#bloco-ncontabil').hidden = !editando;
    $('#f-titulo').value = '';
    $('#f-ncontabil').value = editando ? f.ncontabil : '';
  }
  function avisoVinculo(nome) {
    const el = $('#aviso-vinculo');
    if (!nome) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = `${nome} já está no cadastro compartilhado. Ao salvar, ele é vinculado à sua empresa com uma conta própria no plano; os dados cadastrais não são alterados.`;
    el.hidden = false;
  }

  /* ===== Helpers de API ===== */
  async function api(method, path = '', body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  /* ===== Máscaras ===== */
  function mascaraCPF(v) {
    v = apenasNumeros(v).slice(0, 11);
    return v.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  function mascaraCNPJ(v) {
    v = apenasNumeros(v).slice(0, 14);
    return v.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  function mascaraCEP(v) {
    v = apenasNumeros(v).slice(0, 8);
    return v.replace(/^(\d{5})(\d)/, '$1-$2');
  }
  function mascaraTelefone(v) {
    v = apenasNumeros(v).slice(0, 11);
    if (v.length <= 10) return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return v.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }

  /* ===== Title Case ===== */
  function titleCase(s) {
    if (!s) return '';
    const min = new Set(['de','da','do','das','dos','e','a','o','as','os','em','na','no','nas','nos','para','por','com']);
    const mai = new Set(['SA','S/A','LTDA','ME','EPP','EIRELI','CIA','COOP','MEI','SP','RJ','MG','ES','BA','PR','SC','RS','GO','PE','CE','PA','AM','DF','MT','MS','TO','PB','PI','MA','AL','RN','SE','RO','AC','AP','RR']);
    return String(s).toLowerCase().split(' ').map((p, i) => {
      if (!p) return p;
      const u = p.toUpperCase();
      if (mai.has(u)) return u;
      if (i > 0 && min.has(p)) return p;
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  /* ===== Validação CPF/CNPJ ===== */
  function validarCPF(cpf) {
    cpf = apenasNumeros(cpf);
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let s = 0; for (let i=0;i<9;i++) s += +cpf[i]*(10-i);
    let r = (s*10)%11; if (r===10) r=0; if (r!==+cpf[9]) return false;
    s=0; for (let i=0;i<10;i++) s += +cpf[i]*(11-i);
    r=(s*10)%11; if (r===10) r=0; return r===+cpf[10];
  }
  function validarCNPJ(cnpj) {
    cnpj = apenasNumeros(cnpj);
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    const calc = (b,p)=>{let s=0;for(let i=0;i<b.length;i++)s+=+b[i]*p[i];const r=s%11;return r<2?0:11-r;};
    const p1=[5,4,3,2,9,8,7,6,5,4,3,2], p2=[6,5,4,3,2,9,8,7,6,5,4,3,2];
    return calc(cnpj.slice(0,12),p1)===+cnpj[12] && calc(cnpj.slice(0,13),p2)===+cnpj[13];
  }
  function validarDocumento(doc, tipo) { return tipo === 'PF' ? validarCPF(doc) : validarCNPJ(doc); }

  /* ===== Marcações visuais ===== */
  function marcarPreenchido(el) {
    if (!el) return;
    if (el.value && el.value.trim()) { el.classList.add('preenchido'); el.classList.remove('pendente'); }
    else el.classList.remove('preenchido');
  }

  /* ===== Label do documento conforme tipo ===== */
  function atualizarLabelDoc() {
    const tipo = $('#f-tipo').value;
    $('#label-doc').innerHTML = (tipo === 'PF' ? 'CPF' : 'CNPJ') + ' <em>*</em>';
    $('#f-cpfCnpj').placeholder = tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00';
  }

  /* ===== Visibilidade IE/IM ===== */
  function atualizarVisibilidadeInscricoes() {
    const bloco = $('#bloco-inscricoes');
    if (!bloco) return;
    if ($('#f-tipo').value === 'PJ') { bloco.hidden = false; }
    else {
      bloco.hidden = true;
      $('#f-inscricaoEstadual').value = '';
      $('#f-inscricaoMunicipal').value = '';
      atualizarBotoesIsento();
    }
  }
  function atualizarBotoesIsento() {
    ['f-inscricaoEstadual','f-inscricaoMunicipal'].forEach(id => {
      const input = $('#'+id), btn = document.querySelector(`.btn-isento[data-target="${id}"]`);
      if (!input || !btn) return;
      if (input.value === 'ISENTO') { btn.classList.add('ativo'); btn.textContent='✓ ISENTO'; }
      else { btn.classList.remove('ativo'); btn.textContent='ISENTO'; }
    });
  }

  /* ===== Lookups ===== */
  async function consultarCnpj(num) {
    $('#status-cnpj').textContent = '🔍 Buscando...';
    $('#status-cnpj').className = 'status-busca';
    try {
      const res = await fetch(`${LOOKUP}/cnpj/${num}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'CNPJ não encontrado');
      if (data.razaoSocial) { $('#f-nome').value = titleCase(data.razaoSocial); marcarPreenchido($('#f-nome')); }
      if (data.email && !$('#f-email').value) { $('#f-email').value = data.email; marcarPreenchido($('#f-email')); }
      if (data.telefone && !$('#f-telefone').value) { $('#f-telefone').value = mascaraTelefone(data.telefone); marcarPreenchido($('#f-telefone')); }
      if (data.endereco) {
        const e = data.endereco;
        $('#cob-cep').value = mascaraCEP(e.cep||''); marcarPreenchido($('#cob-cep'));
        $('#cob-logradouro').value = titleCase(e.logradouro||''); marcarPreenchido($('#cob-logradouro'));
        $('#cob-bairro').value = titleCase(e.bairro||''); marcarPreenchido($('#cob-bairro'));
        $('#cob-cidade').value = titleCase(e.cidade||''); marcarPreenchido($('#cob-cidade'));
        $('#cob-uf').value = (e.uf||'').toUpperCase(); marcarPreenchido($('#cob-uf'));
        state.cepConsultado = apenasNumeros(e.cep||'');
      }
      $('#status-cnpj').textContent = '✓ Encontrado';
      $('#status-cnpj').className = 'status-busca ok';
    } catch (err) {
      $('#status-cnpj').textContent = '⚠ ' + err.message;
      $('#status-cnpj').className = 'status-busca erro';
    }
  }

  async function consultarCep(num) {
    if (state.lookupCepEmAndamento) return;
    state.lookupCepEmAndamento = true;
    const status = $('#status-cep-cob');
    status.textContent = '🔍 Buscando...'; status.className = 'status-busca';
    try {
      const res = await fetch(`${LOOKUP}/cep/${num}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'CEP não encontrado');
      if (data.logradouro) { $('#cob-logradouro').value = titleCase(data.logradouro); marcarPreenchido($('#cob-logradouro')); }
      if (data.bairro) { $('#cob-bairro').value = titleCase(data.bairro); marcarPreenchido($('#cob-bairro')); }
      if (data.cidade) { $('#cob-cidade').value = titleCase(data.cidade); marcarPreenchido($('#cob-cidade')); }
      if (data.uf) { $('#cob-uf').value = data.uf; marcarPreenchido($('#cob-uf')); }
      status.textContent = '✓ OK'; status.className = 'status-busca ok';
      setTimeout(() => $('#cob-numero').focus(), 80);
      return true;
    } catch (err) {
      status.textContent = '⚠ Digite manualmente'; status.className = 'status-busca erro';
      setTimeout(() => $('#cob-logradouro').focus(), 80);
      return false;
    } finally {
      state.lookupCepEmAndamento = false;
    }
  }

  /* ===== Modal ===== */
  function abrirModal(f) {
    state.editandoId = f?._id || null;
    state.vinculando = false;
    state.access = null;
    state.cnpjConsultado = '';
    state.cepConsultado = '';
    $('#modal-titulo').textContent = f ? `Editar fornecedor` : 'Novo fornecedor';

    $$('.for-form input, .for-form select').forEach(el => { el.disabled = false; });
    $$('.btn-isento').forEach(b => b.disabled = false);
    $('#f-tipo').value = f?.tipo || 'PJ';
    $('#f-tipo').disabled = !!f;
    $('#f-cpfCnpj').value = f?.cpfCnpjFormatado || '';
    $('#f-cpfCnpj').disabled = !!f;
    $('#f-nome').value = f?.razao || '';
    $('#f-marca').value = f?.marca || '';
    modoTitulo(f);
    avisoVinculo(null);
    $('#f-inscricaoEstadual').value = f?.inscricao || '';
    $('#f-inscricaoMunicipal').value = f?.inscricaoMunicipal || '';
    $('#f-email').value = f?.email || '';
    $('#f-telefone').value = f?.telefone || '';

    const a = f?.address || {};
    $('#cob-cep').value = a.cep ? mascaraCEP(a.cep) : '';
    $('#cob-logradouro').value = a.logradouro || '';
    $('#cob-numero').value = a.numero || '';
    $('#cob-complemento').value = a.complemento || '';
    $('#cob-bairro').value = a.bairro || '';
    $('#cob-cidade').value = a.cidade || '';
    $('#cob-uf').value = a.estado || '';

    const c = f?.contato || {};
    $('#rep-nome').value = c.representante?.nome || '';
    $('#rep-email').value = c.representante?.email || '';
    $('#rep-celular').value = c.representante?.celular || '';
    $('#com-nome').value = c.comercial?.nome || '';
    $('#com-email').value = c.comercial?.email || '';
    $('#com-celular').value = c.comercial?.celular || '';
    $('#tec-nome').value = c.tecnica?.nome || '';
    $('#tec-email').value = c.tecnica?.email || '';
    $('#tec-celular').value = c.tecnica?.celular || '';

    // Limpa marcações e status
    $$('.for-form .preenchido').forEach(el => el.classList.remove('preenchido'));
    $('#status-cnpj').textContent = ''; $('#status-cnpj').className = 'status-busca';
    $('#status-cep-cob').textContent = ''; $('#status-cep-cob').className = 'status-busca';
    if (f) $$('.for-form input, .for-form select').forEach(el => marcarPreenchido(el));

    atualizarBotoesIsento();
    atualizarLabelDoc();
    atualizarVisibilidadeInscricoes();
    $('#bloco-contatos').hidden = true;
    $('#seta-contatos').textContent = '▼';

    $('#modal-fornecedor').hidden = false;
    setTimeout(() => $('#f-cpfCnpj').focus(), 50);
  }

  function fecharModal() {
    $('#modal-fornecedor').hidden = true;
    state.editandoId = null;
    state.vinculando = false;
    state.access = null;
  }

  /* Completa um fornecedor do Access que ainda nao esta no cadastro.
     Vem preenchido com o que o Access tem; a conta e a dele. */
  function abrirCompletar(p) {
    abrirModal(null);
    state.access = p.nrFornec;
    $('#modal-titulo').textContent = 'Completar fornecedor do Access';
    $('#f-cpfCnpj').value = p.cpfCnpjFormatado || '';
    $('#f-nome').value = titleCase(p.razao || '');
    $('#f-marca').value = p.marca || '';
    $('#cob-cidade').value = titleCase(p.address?.cidade || '');
    if (p.ncontabil) {
      $('#bloco-titulo').hidden = true;
      $('#bloco-ncontabil').hidden = false;
      $('#f-ncontabil').value = p.ncontabil;
    }
    const el = $('#aviso-vinculo');
    el.textContent = 'Ajustar: ' + (p.ajustar || []).join('; ')
      + (p.ncontabil ? '. A conta ' + p.ncontabil + ' vem do Access.' : '. Sem conta no Access: escolha o título.');
    el.hidden = false;
    $$('.for-form input').forEach(el => marcarPreenchido(el));
    setTimeout(() => $('#f-cpfCnpj').focus(), 50);
  }

  /* Preenche o formulário com o cadastro compartilhado e passa para o modo vínculo */
  function prepararVinculo(f) {
    abrirModal(null);
    state.vinculando = true;
    $('#modal-titulo').textContent = 'Vincular fornecedor';
    $('#f-tipo').value = f.tipo || 'PJ';
    $('#f-cpfCnpj').value = f.cpfCnpjFormatado || '';
    state.cnpjConsultado = f.cnpj || '';
    $('#f-nome').value = f.razao || '';
    $('#f-marca').value = f.marca || '';
    $('#f-inscricaoEstadual').value = f.inscricao || '';
    $('#f-inscricaoMunicipal').value = f.inscricaoMunicipal || '';
    $('#f-email').value = f.email || '';
    $('#f-telefone').value = f.telefone || '';
    const a = f.address || {};
    $('#cob-cep').value = a.cep ? mascaraCEP(a.cep) : '';
    $('#cob-logradouro').value = a.logradouro || '';
    $('#cob-numero').value = a.numero || '';
    $('#cob-complemento').value = a.complemento || '';
    $('#cob-bairro').value = a.bairro || '';
    $('#cob-cidade').value = a.cidade || '';
    $('#cob-uf').value = a.estado || '';
    // No vínculo só se escolhe o título; o resto é do cadastro compartilhado.
    $$('.for-form input, .for-form select').forEach(el => {
      if (el.id !== 'f-titulo') el.disabled = true;
    });
    $$('.btn-isento').forEach(b => b.disabled = true);
    atualizarLabelDoc();
    atualizarVisibilidadeInscricoes();
    atualizarBotoesIsento();
    avisoVinculo(f.razao || 'Este fornecedor');
    $$('.for-form input').forEach(el => marcarPreenchido(el));
    setTimeout(() => $('#f-titulo').focus(), 50);
  }

  /* ===== Listagem ===== */
  async function recarregar() {
    const tbody = $('#lista-fornecedores');
    const busca = $('#busca').value.trim();
    const inativos = $('#incluir-inativos').checked;
    tbody.innerHTML = '<tr><td colspan="7" class="for-empty">Carregando...</td></tr>';
    try {
      const params = new URLSearchParams();
      if (busca) params.set('busca', busca);
      if (inativos) params.set('incluirInativos', 'true');
      const lista = await api('GET', '/' + (params.toString() ? '?' + params : ''));
      state.lista = lista;
      $('#contador').textContent = `${lista.length} ${lista.length === 1 ? 'fornecedor' : 'fornecedores'}`;
      if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="for-empty">Nenhum fornecedor encontrado.</td></tr>';
        return;
      }
      const etqAjustar = f => (f.ajustar && f.ajustar.length)
        ? ` <span class="for-tag-ajustar" title="${f.ajustar.join('; ')}">ajustar</span>` : '';
      tbody.innerHTML = lista.map(f => f.pendente ? `
        <tr class="for-pendente">
          <td>${titleCase(f.razao || '') || '-'}</td>
          <td class="for-doc">${f.cpfCnpjFormatado || '-'}</td>
          <td>${f.marca || '-'}</td>
          <td class="for-conta">${f.ncontabil || '-'}</td>
          <td>${titleCase(f.address?.cidade || '') || '-'}</td>
          <td>${etqAjustar(f)}</td>
          <td class="for-col-acoes">
            <button class="for-btn-acao" data-action="completar" data-nr="${f.nrFornec}" title="Completar cadastro">✏️</button>
          </td>
        </tr>
      ` : `
        <tr>
          <td>${titleCase(f.razao || '') || '-'}</td>
          <td class="for-doc">${f.cpfCnpjFormatado || f.cnpj || '-'}</td>
          <td>${f.marca || '-'}</td>
          <td class="for-conta">${f.ncontabil || '-'}</td>
          <td>${titleCase(f.address?.cidade || '') || '-'}</td>
          <td>${f.ativo === false
            ? '<span class="for-tag-inativo">Inativo</span>'
            : '<span class="for-tag-ativo">Ativo</span>'}${etqAjustar(f)}</td>
          <td class="for-col-acoes">
            <button class="for-btn-acao" data-action="editar" data-id="${f._id}" title="Editar">✏️</button>
            ${f.ativo === false
              ? `<button class="for-btn-acao" data-action="reativar" data-id="${f._id}" title="Reativar">♻️</button>`
              : `<button class="for-btn-acao" data-action="inativar" data-id="${f._id}" title="Inativar">🗑️</button>`}
            <button class="for-btn-acao" data-action="desvincular" data-id="${f._id}" title="Desvincular conta">⛓️‍💥</button>
          </td>
        </tr>
      `).join('');

      $$('.for-btn-acao').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id, action = btn.dataset.action;
          if (action === 'completar') {
            const p = state.lista.find(x => x.pendente && String(x.nrFornec) === btn.dataset.nr);
            if (p) abrirCompletar(p);
          }
          else if (action === 'editar') { abrirModal(await api('GET', '/' + id)); }
          else if (action === 'inativar') { if (confirm('Inativar este fornecedor?')) { await api('DELETE','/'+id); recarregar(); } }
          else if (action === 'reativar') { await api('POST','/'+id+'/reativar'); recarregar(); }
          else if (action === 'desvincular') { await desvincular(id); }
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="for-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  /* Desvincular: tira o fornecedor desta empresa e suspende a conta dele no
     plano. Só é permitido quando a conta não tem movimento — a mesma regra do
     plano de contas, perguntada ao servidor antes da confirmação. */
  async function desvincular(id) {
    let r;
    try {
      r = await api('GET', '/' + id + '/pode-desvincular');
    } catch (err) {
      alert('Não consegui verificar se a conta tem movimento.\n\n' + err.message);
      return;
    }
    if (!r.pode) { alert('Não foi possível desvincular.\n\n' + r.erro); return; }
    const conta = r.conta ? `\n\nA conta ${r.conta} fica suspensa no plano e pode ser reativada.` : '';
    if (!confirm('Desvincular este fornecedor da sua empresa?' + conta)) return;
    try {
      await api('DELETE', '/' + id + '/vinculo');
      recarregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  /* ===== Listeners ===== */
  $('#f-tipo').addEventListener('change', () => {
    $('#f-cpfCnpj').value = '';
    state.cnpjConsultado = '';
    $('#status-cnpj').textContent = '';
    atualizarLabelDoc();
    atualizarVisibilidadeInscricoes();
  });

  // CPF/CNPJ input
  $('#f-cpfCnpj').addEventListener('input', async (e) => {
    const tipo = $('#f-tipo').value;
    e.target.value = tipo === 'PF' ? mascaraCPF(e.target.value) : mascaraCNPJ(e.target.value);
    marcarPreenchido(e.target);
    const num = apenasNumeros(e.target.value);
    const tam = tipo === 'PF' ? 11 : 14;
    if (num.length < tam) { $('#status-cnpj').textContent=''; $('#status-cnpj').className='status-busca'; if (tipo==='PJ') state.cnpjConsultado=''; }
    if (tipo === 'PJ' && num.length === 14 && num !== state.cnpjConsultado) {
      if (!validarCNPJ(num)) {
        $('#status-cnpj').textContent='✗ CNPJ inválido'; $('#status-cnpj').className='status-busca erro';
        e.target.classList.add('for-erro-flash'); setTimeout(()=>e.target.classList.remove('for-erro-flash'),600);
        return;
      }
      // Duplicidade antes de BrasilAPI (completando do Access, quem decide e o servidor)
      if (!state.editandoId && !state.access) {
        try {
          const d = await (await fetch(`${API}/buscar-cpfcnpj/${num}`)).json();
          if (d.existe && !d.vinculado && d.fornecedor) {
            if (confirm(`Este CNPJ já está no cadastro compartilhado:\n\n${d.nome}\n\nVincular à sua empresa?`)) {
              prepararVinculo(d.fornecedor);
            } else {
              setTimeout(()=>{ resetar(); $('#f-cpfCnpj').focus(); },0);
            }
            return;
          }
          if (d.existe) {
            $('#status-cnpj').textContent=`✗ Já cadastrado`; $('#status-cnpj').className='status-busca erro';
            e.target.classList.add('for-erro-flash');
            alert(`Este CNPJ já está cadastrado:\n\n${d.nome}\n\nUse a lista para editar.`);
            setTimeout(()=>{ resetar(); $('#f-cpfCnpj').focus(); e.target.classList.remove('for-erro-flash'); },0);
            return;
          }
        } catch(_){}
      }
      state.cnpjConsultado = num;
      await consultarCnpj(num);
    }
  });

  $('#f-cpfCnpj').addEventListener('paste', (e) => {
    e.preventDefault();
    const tipo = $('#f-tipo').value;
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    const tam = tipo === 'PF' ? 11 : 14;
    const num = apenasNumeros(txt).slice(0, tam);
    e.target.value = tipo === 'PF' ? mascaraCPF(num) : mascaraCNPJ(num);
    e.target.dispatchEvent(new Event('input', { bubbles: true }));
  });

  $('#f-cpfCnpj').addEventListener('blur', async (e) => {
    if (state.editandoId || state.vinculando || state.access) return;
    const tipo = $('#f-tipo').value;
    const num = apenasNumeros(e.target.value);
    if (!num) return;
    const tam = tipo === 'PF' ? 11 : 14;
    if (num.length !== tam) return;
    if (!validarDocumento(num, tipo)) {
      $('#status-cnpj').textContent = `✗ ${tipo==='PF'?'CPF':'CNPJ'} inválido`;
      $('#status-cnpj').className = 'status-busca erro';
      e.target.classList.add('for-erro-flash');
      alert(`${tipo==='PF'?'CPF':'CNPJ'} inválido.\n\nVerifique e digite novamente.`);
      setTimeout(()=>{ resetar(); $('#f-cpfCnpj').focus(); e.target.classList.remove('for-erro-flash'); },0);
      return;
    }
    // PF: verifica duplicidade no blur (PJ já fez no input)
    if (tipo === 'PF') {
      try {
        const d = await (await fetch(`${API}/buscar-cpfcnpj/${num}`)).json();
        if (d.existe && !d.vinculado && d.fornecedor) {
          if (confirm(`Este CPF já está no cadastro compartilhado:\n\n${d.nome}\n\nVincular à sua empresa?`)) {
            prepararVinculo(d.fornecedor);
          } else {
            setTimeout(()=>{ resetar(); $('#f-cpfCnpj').focus(); },0);
          }
          return;
        }
        if (d.existe) {
          $('#status-cnpj').textContent='✗ Já cadastrado'; $('#status-cnpj').className='status-busca erro';
          alert(`Este CPF já está cadastrado:\n\n${d.nome}\n\nUse a lista para editar.`);
          setTimeout(()=>{ resetar(); $('#f-cpfCnpj').focus(); },0);
        }
      } catch(_){}
    }
  });

  function resetar() {
    $('#f-cpfCnpj').value=''; $('#f-nome').value=''; $('#f-marca').value=''; $('#f-titulo').value='';
    $('#f-inscricaoEstadual').value=''; $('#f-inscricaoMunicipal').value='';
    $('#f-email').value=''; $('#f-telefone').value='';
    ['cep','logradouro','numero','complemento','bairro','cidade','uf'].forEach(c => $('#cob-'+c) && ($('#cob-'+c).value=''));
    $('#status-cnpj').textContent=''; $('#status-cnpj').className='status-busca';
    $('#status-cep-cob').textContent=''; $('#status-cep-cob').className='status-busca';
    state.cnpjConsultado=''; state.cepConsultado='';
    $$('.for-form .preenchido').forEach(el => el.classList.remove('preenchido'));
    atualizarBotoesIsento();
  }

  // Email/Telefone
  $('#f-email').addEventListener('input', (e) => marcarPreenchido(e.target));
  $('#f-telefone').addEventListener('input', (e) => { e.target.value = mascaraTelefone(e.target.value); marcarPreenchido(e.target); });
  $('#f-telefone').addEventListener('paste', (e) => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    e.target.value = mascaraTelefone(apenasNumeros(txt).slice(0,11));
    marcarPreenchido(e.target);
  });

  // Nome/Marca title case ao sair
  $('#f-nome').addEventListener('blur', (e) => { if (e.target.value) { e.target.value = titleCase(e.target.value); marcarPreenchido(e.target); } });

  // CEP
  $('#cob-cep').addEventListener('input', async (e) => {
    e.target.value = mascaraCEP(e.target.value);
    marcarPreenchido(e.target);
    const num = apenasNumeros(e.target.value);
    if (num.length < 8) { $('#status-cep-cob').textContent=''; $('#status-cep-cob').className='status-busca'; }
    if (num.length === 8 && num !== state.cepConsultado) { state.cepConsultado = num; await consultarCep(num); }
  });
  $('#cob-cep').addEventListener('paste', async (e) => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData('text');
    const num = apenasNumeros(txt).slice(0,8);
    e.target.value = mascaraCEP(num);
    marcarPreenchido(e.target);
    if (num.length === 8 && num !== state.cepConsultado) { state.cepConsultado = num; await consultarCep(num); }
  });

  // Title case nos campos de endereço ao sair
  ['cob-logradouro','cob-bairro','cob-cidade','cob-complemento'].forEach(id => {
    $('#'+id).addEventListener('blur', (e) => { if (e.target.value) { e.target.value = titleCase(e.target.value); marcarPreenchido(e.target); } });
  });
  $('#cob-uf').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().slice(0,2); marcarPreenchido(e.target); });

  // IE/IM
  document.querySelectorAll('.btn-isento').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      if (input.value === 'ISENTO') { input.value=''; btn.classList.remove('ativo'); btn.textContent='ISENTO'; input.classList.remove('preenchido'); }
      else { input.value='ISENTO'; btn.classList.add('ativo'); btn.textContent='✓ ISENTO'; input.classList.add('preenchido'); }
    });
  });
  ['f-inscricaoEstadual','f-inscricaoMunicipal'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      if (input.value.toUpperCase() === 'ISENTO') { input.value='ISENTO'; return; }
      input.value = input.value.replace(/\D/g,'');
      const btn = document.querySelector(`.btn-isento[data-target="${id}"]`);
      if (btn) { btn.classList.remove('ativo'); btn.textContent='ISENTO'; }
      marcarPreenchido(input);
    });
  });

  // Toggle contatos especializados
  $('#toggle-contatos').addEventListener('click', () => {
    const bloco = $('#bloco-contatos');
    bloco.hidden = !bloco.hidden;
    $('#seta-contatos').textContent = bloco.hidden ? '▼' : '▲';
  });

  // Submit
  // Enter: proximo campo visivel e habilitado; depois do ultimo, o botao Salvar.
  $('#form-fornecedor').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const t = e.target;
    if (!(t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    e.preventDefault();
    const campos = $$('.for-form input, .for-form select')
      .filter(el => !el.disabled && !el.readOnly && el.type !== 'hidden' && el.offsetParent !== null);
    const i = campos.indexOf(t);
    const prox = campos[i + 1];
    if (prox) { prox.focus(); if (prox.select && prox.tagName === 'INPUT') prox.select(); }
    else $('#btn-salvar').focus();
  });

  $('#form-fornecedor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const tipo = $('#f-tipo').value;
    const nome = $('#f-nome').value.trim();
    const cpfCnpj = apenasNumeros($('#f-cpfCnpj').value);
    const email = $('#f-email').value.trim();
    const telefone = $('#f-telefone').value.trim();

    if (!nome) { $('#f-nome').focus(); alert('Informe a razão social / nome.'); return; }
    if (!state.editandoId && !validarDocumento(cpfCnpj, tipo)) {
      $('#f-cpfCnpj').focus(); $('#f-cpfCnpj').classList.add('for-erro-flash');
      $('#status-cnpj').textContent = `✗ ${tipo==='PF'?'CPF':'CNPJ'} inválido`;
      $('#status-cnpj').className = 'status-busca erro';
      setTimeout(()=>$('#f-cpfCnpj').classList.remove('for-erro-flash'),600);
      return;
    }
    const tituloCodigo = $('#f-titulo').value;
    if (!state.editandoId && !tituloCodigo && !$('#bloco-titulo').hidden) {
      $('#f-titulo').focus(); alert('Escolha o título contábil do fornecedor.'); return;
    }

    // Aviso IE/IM para PJ
    if (tipo === 'PJ' && !state.vinculando) {
      const ie = $('#f-inscricaoEstadual').value.trim();
      const im = $('#f-inscricaoMunicipal').value.trim();
      if (!ie || !im) {
        const faltam = [!ie && 'Estadual', !im && 'Municipal'].filter(Boolean).join(' e ');
        if (!confirm(`Inscrição ${faltam} vazia(s).\n\nSe for isenta, clique em "ISENTO".\n\nContinuar mesmo assim?`)) return;
      }
    }

    const payload = {
      tipo, nome, cpfCnpj, email, telefone,
      inscricaoEstadual:  $('#f-inscricaoEstadual').value.trim(),
      inscricaoMunicipal: $('#f-inscricaoMunicipal').value.trim(),
      tituloCodigo,
      nrFornecAccess: state.access || undefined,
      marca: $('#f-marca').value.trim(),
      enderecoCobranca: {
        cep: apenasNumeros($('#cob-cep').value),
        logradouro: $('#cob-logradouro').value.trim(),
        numero: $('#cob-numero').value.trim(),
        complemento: $('#cob-complemento').value.trim(),
        bairro: $('#cob-bairro').value.trim(),
        cidade: $('#cob-cidade').value.trim(),
        estado: $('#cob-uf').value.trim().toUpperCase()
      },
      contatos: {
        representante: { nome:$('#rep-nome').value.trim(), email:$('#rep-email').value.trim(), celular:$('#rep-celular').value.trim() },
        comercial:     { nome:$('#com-nome').value.trim(), email:$('#com-email').value.trim(), celular:$('#com-celular').value.trim() },
        tecnica:       { nome:$('#tec-nome').value.trim(), email:$('#tec-email').value.trim(), celular:$('#tec-celular').value.trim() }
      }
    };

    const btn = $('#btn-salvar');
    btn.disabled = true; btn.textContent = 'Salvando...';
    try {
      if (state.editandoId) await api('PUT', '/' + state.editandoId, payload);
      else await api('POST', '', payload);
      fecharModal();
      recarregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar';
    }
  });

  $('#btn-novo').addEventListener('click', () => abrirModal(null));
  $('#btn-ajuda').addEventListener('click', () => { $('#painel-ajuda').hidden = !$('#painel-ajuda').hidden; });
  $('#btn-ajuda-fechar').addEventListener('click', () => { $('#painel-ajuda').hidden = true; });
  $('#btn-fechar').addEventListener('click', fecharModal);
  $('#btn-cancelar').addEventListener('click', fecharModal);
  $('#incluir-inativos').addEventListener('change', recarregar);
  $('#busca').addEventListener('input', () => { clearTimeout(state.debounceTimer); state.debounceTimer = setTimeout(recarregar, 300); });

  carregarTitulos();
  recarregar();
})();
