// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\tecnicos.js
// Criado em: 13/10/2026
// Alterado em: 13/10/2026 - tabela de SERVICOS do tecnico (descricao + % do tecnico ou valor fixo)
//
// SERVICO > TECNICOS (views\vendas\pages\tecnicos.handlebars)
// Lista + ficha. Novo cria a conta 2.06.001.NNN (no servidor). Receita da loja: 4.05.001.001.
// Enter anda de campo em campo; no ultimo, vai ao Gravar.
// Dinheiro em centavos na API; % com ate 2 casas.
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/tecnicos/';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lerBrl = v => { const s = String(v || '').trim().replace(/\./g, '').replace(',', '.'); const n = Number(s); return s && Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const pct = n => n ? String(n).replace('.', ',') : '';
  const so = v => String(v || '').replace(/\D/g, '');
  const fmtCpf = v => { const d = so(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d; };
  const fmtCnpj = v => { const d = so(v); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : d; };
  const fmtCep = v => { const d = so(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : d; };

  let lista = [], atual = null;   // atual = tecnico aberto (null = novo)

  async function api(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(url, op);
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
    if (!j.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  const msg = (t, ok) => { $('msg').textContent = t || ''; $('msg').classList.toggle('ok', !!ok); };

  async function carregar(abrirId) {
    try {
      lista = (await api('GET', API)).tecnicos || [];
      desenharLista();
      const x = abrirId && lista.find(t => t.id === abrirId);
      if (x) abrir(x);
    } catch (e) { $('tecs').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; }
  }

  function desenharLista() {
    const f = $('filtro').value.trim().toLowerCase();
    const vis = lista.filter(t => !f || [t.nome, t.apelido, t.contaTecnico, t.cpf, t.mei && t.mei.cnpj].join(' ').toLowerCase().includes(f));
    $('tecs').innerHTML = vis.length ? vis.map(t =>
      '<div class="tec' + (t.ativo === false ? ' inativo' : '') + (atual && atual.id === t.id ? ' sel' : '') + '" data-id="' + t.id + '">'
      + (t.ativo === false ? '<span class="tag">inativo</span>' : '')
      + '<b>' + esc(t.apelido || t.nome) + '</b>'
      + '<small>' + esc(t.contaTecnico || 'sem conta') + (t.apelido && t.apelido !== t.nome ? ' · ' + esc(t.nome) : '') + '</small></div>').join('')
      : '<div class="vazio">' + (lista.length ? 'Nada com esse filtro.' : 'Nenhum técnico cadastrado.') + '</div>';
  }

  const CAMPOS = ['nome', 'apelido', 'nascimento', 'cpf', 'rg', 'cnpj', 'razao', 'im', 'telefone', 'celular', 'whatsapp', 'email',
                  'logradouro', 'enum', 'complemento', 'bairro', 'cidade', 'uf', 'cep',
                  'pixTipo', 'pixChave', 'banco', 'agencia', 'conta', 'observacao'];

  function abrir(t) {
    atual = t || null;
    const x = t || {}, e = x.endereco || {}, mei = x.mei || {}, pix = x.pix || {}, bc = x.banco || {};
    const v = { nome: x.nome, apelido: x.apelido, nascimento: x.nascimento, cpf: fmtCpf(x.cpf), rg: x.rg,
      cnpj: fmtCnpj(mei.cnpj), razao: mei.razaoSocial, im: mei.inscricaoMunicipal,
      telefone: x.telefone, celular: x.celular, whatsapp: x.whatsapp, email: x.email,
      logradouro: e.logradouro, enum: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: fmtCep(e.cep),
      pixTipo: pix.tipo, pixChave: pix.chave, banco: bc.banco, agencia: bc.agencia, conta: bc.conta, observacao: x.observacao };
    CAMPOS.forEach(id => { $(id).value = v[id] || ''; });
    $('servs').innerHTML = '';
    const lista = x.servicos && x.servicos.length ? x.servicos
      : (t ? [] : [{ descricao: 'Instalação (VI)', modo: 'PERC' }, { descricao: 'Conserto (C)', modo: 'PERC' }, { descricao: 'Garantia (G)', modo: 'FIXO' }]);
    lista.forEach(linhaServico);
    $('f-tit').textContent = t ? (t.apelido || t.nome) + (t.ativo === false ? ' (inativo)' : '') : 'Novo técnico';
    $('f-contas').textContent = t ? (t.contaTecnico || 'sem conta') : 'a conta 2.06.001 é criada ao gravar';
    $('ativar').hidden = !t;
    $('ativar').textContent = t && t.ativo === false ? 'Reativar' : 'Inativar';
    $('ativar').className = 'btn ' + (t && t.ativo === false ? 'verde' : 'vermelho');
    msg('');
    desenharLista();
    $('nome').focus();
  }

  // ---- servicos do tecnico (descricao + repasse) ----
  function linhaServico(sv) {
    const tr = document.createElement('tr');
    const modo = sv.modo === 'FIXO' ? 'FIXO' : 'PERC';
    const val = sv.valor ? (modo === 'PERC' ? pct(sv.valor) : brl(sv.valor)) : '';
    tr.dataset.id = sv.id || '';
    tr.innerHTML = '<td><input class="s-desc" placeholder="ex.: Instalação aquecedor" maxlength="80" value="' + esc(sv.descricao || '') + '"></td>'
      + '<td><select class="s-modo"><option value="PERC"' + (modo === 'PERC' ? ' selected' : '') + '>% do técnico</option>'
      + '<option value="FIXO"' + (modo === 'FIXO' ? ' selected' : '') + '>valor fixo</option></select></td>'
      + '<td><input class="s-valor num" inputmode="decimal" placeholder="' + (modo === 'PERC' ? '% do técnico' : 'R$ ao técnico') + '" value="' + esc(val) + '"></td>'
      + '<td><button type="button" class="x" title="tirar este serviço">×</button></td>';
    $('servs').appendChild(tr);
  }
  function lerServicos() {
    return [...$('servs').querySelectorAll('tr')].map(tr => {
      const modo = tr.querySelector('.s-modo').value, v = tr.querySelector('.s-valor').value;
      return { id: tr.dataset.id || undefined, descricao: tr.querySelector('.s-desc').value.trim(), modo,
               valor: modo === 'PERC' ? v : lerBrl(v) };
    }).filter(x => x.descricao);
  }

  function corpo() {
    return {
      nome: $('nome').value, apelido: $('apelido').value, nascimento: $('nascimento').value, cpf: $('cpf').value, rg: $('rg').value,
      mei: { cnpj: $('cnpj').value, razaoSocial: $('razao').value, inscricaoMunicipal: $('im').value },
      telefone: $('telefone').value, celular: $('celular').value, whatsapp: $('whatsapp').value, email: $('email').value,
      endereco: { logradouro: $('logradouro').value, numero: $('enum').value, complemento: $('complemento').value,
                  bairro: $('bairro').value, cidade: $('cidade').value, uf: $('uf').value, cep: $('cep').value },
      servicos: lerServicos(),
      pix: { tipo: $('pixTipo').value, chave: $('pixChave').value },
      banco: { banco: $('banco').value, agencia: $('agencia').value, conta: $('conta').value },
      observacao: $('observacao').value,
    };
  }

  async function gravar() {
    if (!$('nome').value.trim()) { msg('Informe o nome do técnico.'); $('nome').focus(); return; }
    for (const tr of $('servs').querySelectorAll('tr')) {
      const desc = tr.querySelector('.s-desc').value.trim();
      if (!desc) continue;
      if (tr.querySelector('.s-modo').value === 'PERC') {
        const n = Number(tr.querySelector('.s-valor').value.replace(',', '.') || 0);
        if (!Number.isFinite(n) || n < 0 || n > 100) { msg('Percentual entre 0 e 100 (' + desc + ').'); tr.querySelector('.s-valor').focus(); return; }
      }
    }
    if (!atual && !confirm('Cadastrar ' + $('nome').value.trim() + '?\nSerá criada a conta do técnico (2.06.001).')) return;
    $('gravar').disabled = true;
    const eraNovo = !atual;
    try {
      const r = eraNovo ? await api('POST', API, corpo()) : await api('PUT', API + atual.id, corpo());
      await carregar(r.tecnico.id);
      msg('✓ gravado' + (eraNovo ? ' · conta ' + r.tecnico.contaTecnico : ''), true);
    } catch (e) { msg(e.message); } finally { $('gravar').disabled = false; }
  }

  async function ativar() {
    if (!atual) return;
    const ativo = atual.ativo === false;
    if (!ativo && !confirm('Inativar ' + (atual.apelido || atual.nome) + '?\nEle some da agenda e da escolha de técnico. As contas continuam.')) return;
    try { const r = await api('POST', API + atual.id + '/ativo', { ativo }); await carregar(r.tecnico.id); msg(ativo ? '✓ reativado' : '✓ inativado', true); }
    catch (e) { msg(e.message); }
  }

  $('tecs').addEventListener('click', ev => {
    const d = ev.target.closest('.tec'); if (!d) return;
    abrir(lista.find(t => t.id === d.dataset.id));
  });
  $('filtro').addEventListener('input', desenharLista);
  $('novo').addEventListener('click', () => abrir(null));
  $('gravar').addEventListener('click', gravar);
  $('ativar').addEventListener('click', ativar);
  $('cpf').addEventListener('blur', () => { $('cpf').value = fmtCpf($('cpf').value); });
  $('cnpj').addEventListener('blur', () => { $('cnpj').value = fmtCnpj($('cnpj').value); });
  $('cep').addEventListener('blur', () => { $('cep').value = fmtCep($('cep').value); });
  $('uf').addEventListener('input', () => { $('uf').value = $('uf').value.toUpperCase(); });
  $('serv-mais').addEventListener('click', () => { linhaServico({}); $('servs').lastElementChild.querySelector('.s-desc').focus(); });
  $('servs').addEventListener('click', ev => { const x = ev.target.closest('.x'); if (x) x.closest('tr').remove(); });
  $('servs').addEventListener('change', ev => {
    if (!ev.target.classList.contains('s-modo')) return;
    const v = ev.target.closest('tr').querySelector('.s-valor');
    v.value = ''; v.placeholder = ev.target.value === 'PERC' ? '% do técnico' : 'R$ ao técnico';
  });
  $('servs').addEventListener('focusout', ev => {
    if (!ev.target.classList.contains('s-valor')) return;
    const tr = ev.target.closest('tr');
    if (tr.querySelector('.s-modo').value === 'FIXO' && ev.target.value.trim()) ev.target.value = brl(lerBrl(ev.target.value));
  });
  // Enter anda de campo em campo; no ultimo vai ao Gravar
  $('ficha').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'BUTTON') return;
    ev.preventDefault();
    if (ev.target.closest('#servs')) {           // na tabela de servicos: proximo campo dela
      const cs = [...$('servs').querySelectorAll('input, select')];
      const j = cs.indexOf(ev.target);
      if (j >= 0 && j < cs.length - 1) cs[j + 1].focus(); else $('pixTipo').focus();
      return;
    }
    const k = CAMPOS.indexOf(ev.target.id);
    if (k >= 0 && k < CAMPOS.length - 1) $(CAMPOS[k + 1]).focus(); else $('gravar').focus();
  });

  abrir(null);
  carregar();
})();
