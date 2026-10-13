// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\tecnicos.js
// Criado em: 13/10/2026
//
// SERVICO > TECNICOS (views\vendas\pages\tecnicos.handlebars)
// Lista + ficha. Novo cria as contas 2.06.001.NNN / 4.03.002.NNN (no servidor).
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
                  'logradouro', 'enum', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'percVI', 'percC', 'valorG',
                  'pixTipo', 'pixChave', 'banco', 'agencia', 'conta', 'observacao'];

  function abrir(t) {
    atual = t || null;
    const x = t || {}, e = x.endereco || {}, mei = x.mei || {}, pg = x.pagamento || {}, pix = x.pix || {}, bc = x.banco || {};
    const v = { nome: x.nome, apelido: x.apelido, nascimento: x.nascimento, cpf: fmtCpf(x.cpf), rg: x.rg,
      cnpj: fmtCnpj(mei.cnpj), razao: mei.razaoSocial, im: mei.inscricaoMunicipal,
      telefone: x.telefone, celular: x.celular, whatsapp: x.whatsapp, email: x.email,
      logradouro: e.logradouro, enum: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, cep: fmtCep(e.cep),
      percVI: pct(pg.percVI), percC: pct(pg.percC), valorG: pg.valorG ? brl(pg.valorG) : '',
      pixTipo: pix.tipo, pixChave: pix.chave, banco: bc.banco, agencia: bc.agencia, conta: bc.conta, observacao: x.observacao };
    CAMPOS.forEach(id => { $(id).value = v[id] || ''; });
    $('f-tit').textContent = t ? (t.apelido || t.nome) + (t.ativo === false ? ' (inativo)' : '') : 'Novo técnico';
    $('f-contas').textContent = t ? [t.contaTecnico, t.contaReceita].filter(Boolean).join(' · ')
                                  : 'as contas 2.06.001 e 4.03.002 são criadas ao gravar';
    $('ativar').hidden = !t;
    $('ativar').textContent = t && t.ativo === false ? 'Reativar' : 'Inativar';
    $('ativar').className = 'btn ' + (t && t.ativo === false ? 'verde' : 'vermelho');
    msg('');
    desenharLista();
    $('nome').focus();
  }

  function corpo() {
    return {
      nome: $('nome').value, apelido: $('apelido').value, nascimento: $('nascimento').value, cpf: $('cpf').value, rg: $('rg').value,
      mei: { cnpj: $('cnpj').value, razaoSocial: $('razao').value, inscricaoMunicipal: $('im').value },
      telefone: $('telefone').value, celular: $('celular').value, whatsapp: $('whatsapp').value, email: $('email').value,
      endereco: { logradouro: $('logradouro').value, numero: $('enum').value, complemento: $('complemento').value,
                  bairro: $('bairro').value, cidade: $('cidade').value, uf: $('uf').value, cep: $('cep').value },
      pagamento: { percVI: $('percVI').value, percC: $('percC').value, valorG: lerBrl($('valorG').value) },
      pix: { tipo: $('pixTipo').value, chave: $('pixChave').value },
      banco: { banco: $('banco').value, agencia: $('agencia').value, conta: $('conta').value },
      observacao: $('observacao').value,
    };
  }

  async function gravar() {
    if (!$('nome').value.trim()) { msg('Informe o nome do técnico.'); $('nome').focus(); return; }
    for (const id of ['percVI', 'percC']) {
      const n = Number($(id).value.replace(',', '.') || 0);
      if (!Number.isFinite(n) || n < 0 || n > 100) { msg('Percentual entre 0 e 100.'); $(id).focus(); return; }
    }
    if (!atual && !confirm('Cadastrar ' + $('nome').value.trim() + '?\nSerão criadas as contas do técnico (2.06.001) e da receita (4.03.002).')) return;
    $('gravar').disabled = true;
    const eraNovo = !atual;
    try {
      const r = eraNovo ? await api('POST', API, corpo()) : await api('PUT', API + atual.id, corpo());
      await carregar(r.tecnico.id);
      msg('✓ gravado' + (eraNovo ? ' · contas ' + r.tecnico.contaTecnico + ' e ' + r.tecnico.contaReceita : ''), true);
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
  $('valorG').addEventListener('blur', () => { if ($('valorG').value.trim()) $('valorG').value = brl(lerBrl($('valorG').value)); });
  // Enter anda de campo em campo; no ultimo vai ao Gravar
  $('ficha').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'BUTTON') return;
    ev.preventDefault();
    const k = CAMPOS.indexOf(ev.target.id);
    if (k >= 0 && k < CAMPOS.length - 1) $(CAMPOS[k + 1]).focus(); else $('gravar').focus();
  });

  abrir(null);
  carregar();
})();
