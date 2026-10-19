// =============================================================================
// Destino: C:\plataformaRota\public\js\comum\endereco-instalacao.js
// Criado em: 18/10/2026
//
// ENDERECO DE INSTALACAO (ideia do Jorge): o mesmo cliente pode ter varios lugares (ex.: aptos
// para alugar). Combo com os enderecos do cliente (cobranca, entrega e os de instalacao ja
// usados) + "＋ outro endereço": digita o CEP (busca rua, bairro, cidade, UF) ou digita tudo.
// Endereco novo pode ser GUARDADO no cadastro do cliente (aparece no combo da proxima vez).
// Usado no modal de instalacao da venda (venda.js) e no modal da OS (os-modal.js).
//
//   EnderecoInst.ligar({ combo, campo, guardar, guardarRot, aviso })
//       combo: <select>; campo(nome) -> <input> (logradouro, numero, complemento, edificio,
//       apto, bairro, cidade, uf, cep, pontoReferencia); guardar: <input type=checkbox>;
//       guardarRot: o <label> do checkbox (aparece so com endereco novo).
//       Devolve { carregar(clienteId), ler(), guardarSeNovo() }
//   EnderecoInst.form(container, prefixo)   monta os campos (para o modal da OS)
// API: GET/POST /vendas/api/venda/clientes/:id/enderecos · CEP: /aux/api/lookup/cep/:num
// =============================================================================

(function () {
  'use strict';
  const API = '/vendas/api/venda/clientes/';
  const CAMPOS = ['cep', 'logradouro', 'numero', 'complemento', 'edificio', 'apto', 'bairro', 'cidade', 'uf', 'pontoReferencia'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const chave = e => [e.logradouro, e.numero, e.complemento, e.apto].map(norm).join('|');
  const cepFmt = s => { const d = String(s || '').replace(/\D/g, ''); return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : String(s || ''); };
  const titulo = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, x => x.toUpperCase())
    .replace(/ (De|Da|Do|Das|Dos|E) /g, x => x.toLowerCase());
  function resumo(e) {
    return [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.apto ? 'apto ' + e.apto : '', e.bairro]
      .filter(Boolean).join(' · ');
  }
  async function pedir(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(url, op);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }

  function ligar(op) {
    let clienteId = null, lista = [], ultimoCep = '';
    const f = n => op.campo(n);
    const ler = () => { const e = {}; CAMPOS.forEach(n => { const el = f(n); e[n] = el ? el.value.trim() : ''; }); e.cep = e.cep.replace(/\D/g, ''); e.uf = e.uf.toUpperCase(); return e; };
    const preencher = e => { CAMPOS.forEach(n => { const el = f(n); if (el) el.value = n === 'cep' ? cepFmt(e[n]) : (e[n] || ''); }); ultimoCep = String(e.cep || '').replace(/\D/g, ''); };
    const aviso = t => { if (op.aviso) op.aviso.textContent = t || ''; };
    // endereco na tela e novo (nao esta no cadastro): mostra "guardar no cadastro"
    function conferir() {
      const e = ler(), novo = !!e.logradouro && !lista.some(x => chave(x) === chave(e));
      if (op.guardarRot) op.guardarRot.hidden = !novo || !clienteId;
      const k = lista.findIndex(x => chave(x) === chave(e));
      if (k >= 0) op.combo.value = lista[k].id;
      else if (op.combo.value !== 'novo') op.combo.value = e.logradouro ? 'atual' : 'novo';
      return novo;
    }
    function desenharCombo() {
      const e = ler(), k = lista.findIndex(x => chave(x) === chave(e));
      op.combo.innerHTML = lista.map(x => '<option value="' + esc(x.id) + '">' + esc(x.rotulo) + ' · ' + esc(resumo(x)) + '</option>').join('')
        + (k < 0 && e.logradouro ? '<option value="atual">este endereço · ' + esc(resumo(e)) + '</option>' : '')
        + '<option value="novo">＋ outro endereço (CEP ou digitar)</option>';
      conferir();
    }
    async function carregar(id) {
      clienteId = id || null; lista = [];
      if (op.guardar) op.guardar.checked = true;
      if (clienteId) { try { lista = (await pedir('GET', API + encodeURIComponent(clienteId) + '/enderecos')).enderecos || []; } catch (e) { lista = []; } }
      desenharCombo();
    }
    op.combo.addEventListener('change', () => {
      const v = op.combo.value;
      if (v === 'atual') return;
      if (v === 'novo') {
        preencher({}); aviso('Digite o CEP (busca a rua) ou preencha o endereço.');
        if (op.guardarRot) op.guardarRot.hidden = !clienteId;
        const c = f('cep'); if (c) c.focus();
        return;
      }
      const x = lista.find(y => y.id === v); if (!x) return;
      preencher(x); aviso(''); conferir();
      const n = f('numero'); if (n) n.focus();
    });
    // CEP: com 8 numeros busca rua, bairro, cidade e UF
    const cep = f('cep');
    if (cep) cep.addEventListener('input', async () => {
      const d = cep.value.replace(/\D/g, '');
      if (d.length !== 8 || d === ultimoCep) return;
      ultimoCep = d; aviso('🔍 buscando o CEP…');
      try {
        const r = await fetch('/aux/api/lookup/cep/' + d), j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || 'CEP não encontrado');
        cep.value = cepFmt(d);
        if (j.logradouro) f('logradouro').value = titulo(j.logradouro);
        if (j.bairro) f('bairro').value = titulo(j.bairro);
        if (j.cidade) f('cidade').value = titulo(j.cidade);
        if (j.uf) f('uf').value = String(j.uf).toUpperCase();
        if (j.complemento && !f('complemento').value) f('complemento').value = titulo(j.complemento);
        f('numero').value = ''; aviso('✓ CEP encontrado: falta o número.');
        conferir(); f('numero').focus();
      } catch (e) { aviso('CEP: ' + e.message + ' — preencha o endereço.'); f('logradouro').focus(); }
    });
    CAMPOS.forEach(n => { const el = f(n); if (el && n !== 'cep') el.addEventListener('input', () => { if (n === 'numero') aviso(''); conferir(); }); });
    async function guardarSeNovo() {
      if (!clienteId || !op.guardar || !op.guardar.checked) return false;
      const e = ler();
      if (!e.logradouro || lista.some(x => chave(x) === chave(e))) return false;
      await pedir('POST', API + encodeURIComponent(clienteId) + '/enderecos', { endereco: e });
      return true;
    }
    return { carregar, ler, preencher, guardarSeNovo, redesenhar: desenharCombo };
  }

  // campos prontos (modal da OS)
  function form(container, p) {
    const c = (n, rot, cls, extra) => '<label' + (cls ? ' class="' + cls + '"' : '') + '><span>' + rot + '</span><input id="' + p + n + '" autocomplete="off"' + (extra || '') + '></label>';
    container.innerHTML = '<div class="ei-topo"><select id="' + p + 'combo"></select></div>'
      + '<div class="ei-grade">' + c('cep', 'CEP', '', ' inputmode="numeric"') + c('logradouro', 'Logradouro', 'l2') + c('numero', 'Número')
      + c('complemento', 'Complemento') + c('edificio', 'Edifício') + c('apto', 'Apto') + c('bairro', 'Bairro')
      + c('cidade', 'Cidade', 'l2') + c('uf', 'UF', '', ' maxlength="2"') + '<span></span>' + c('pontoReferencia', 'Ponto de referência', 'l4') + '</div>'
      + '<div class="ei-pe"><label id="' + p + 'guardar-l" hidden><input type="checkbox" id="' + p + 'guardar" checked> guardar este endereço no cadastro do cliente</label>'
      + '<span class="ei-aviso" id="' + p + 'aviso"></span></div>';
    if (!document.getElementById('ei-css')) {
      const st = document.createElement('style'); st.id = 'ei-css';
      st.textContent = '.ei-topo select{width:100%;height:32px;border:1px solid #c4b5fd;border-radius:6px;padding:0 8px;font-size:14px;font-weight:600;background:#faf5ff}'
        + '.ei-grade{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px 10px;margin:8px 0}'
        + '.ei-grade label{display:flex;flex-direction:column;gap:2px}.ei-grade .l2{grid-column:span 2}.ei-grade .l4{grid-column:span 4}'
        + '.ei-grade span{font-size:10px;font-weight:700;text-transform:uppercase;color:#374151}'
        + '.ei-grade input{height:30px;border:1px solid #d1d5db;border-radius:6px;padding:0 8px;font-size:14px}'
        + '.ei-pe{display:flex;gap:12px;align-items:center;font-size:13px;flex-wrap:wrap}.ei-aviso{color:#6b21a8;font-weight:600}';
      document.head.appendChild(st);
    }
    const g = id => document.getElementById(p + id);
    return ligar({ combo: g('combo'), campo: n => g(n), guardar: g('guardar'), guardarRot: g('guardar-l'), aviso: g('aviso') });
  }

  window.EnderecoInst = { ligar, form, resumo };
})();
