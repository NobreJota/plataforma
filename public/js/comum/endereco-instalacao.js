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
// Alterado em: 24/10/2026 - botao 🔍 ao lado do CEP (Jorge: muito cadastro sem CEP): com o CEP vazio, busca pelo
//              LOGRADOURO + CIDADE + UF no ViaCEP (viacep.com.br/ws/UF/cidade/rua/json): um so -> preenche CEP, rua,
//              bairro, cidade, UF; varios (rua longa tem CEP por faixa de numero) -> lista para escolher (os do
//              bairro digitado primeiro). Com CEP digitado, busca o endereco do CEP. Vale na venda e na OS.
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
    async function buscarCep(forcar) {
      const d = cep.value.replace(/\D/g, '');
      if (d.length !== 8 || (d === ultimoCep && !forcar)) return;
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
    }
    if (cep) cep.addEventListener('input', () => buscarCep(false));

    // 24/10/2026: 🔍 ao lado do CEP — CEP vazio: procura pela rua + cidade + UF; CEP digitado: busca o CEP
    let lupa = null, listaCep = null;
    const semAcento = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // tira o tipo do logradouro (o ViaCEP procura pelo nome): "Rua João de Oliveira Barros" -> "Joao de Oliveira Barros"
    const nomeRua = v => semAcento(v).replace(/^\s*(rua|r\.|avenida|av\.?|travessa|tv\.?|alameda|al\.?|pra[cç]a|pc\.?|rodovia|rod\.?|estrada|est\.?|ladeira|beco|largo|via|vila|servid[aã]o)\s+/i, '')
      .replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
    function fecharLista() { if (listaCep) { listaCep.remove(); listaCep = null; document.removeEventListener('mousedown', foraLista, true); } }
    function foraLista(ev) { if (listaCep && !listaCep.contains(ev.target) && ev.target !== lupa) fecharLista(); }
    function usar(x) {
      fecharLista();
      ultimoCep = String(x.cep || '').replace(/\D/g, '');
      cep.value = cepFmt(ultimoCep);
      if (x.logradouro) f('logradouro').value = x.logradouro;
      if (x.bairro) f('bairro').value = x.bairro;
      if (x.localidade) f('cidade').value = x.localidade;
      if (x.uf) f('uf').value = String(x.uf).toUpperCase();
      aviso('✓ CEP ' + cep.value + (f('numero').value ? '' : ' — falta o número.'));
      conferir();
      if (!f('numero').value) f('numero').focus();
    }
    async function procurarPelaRua() {
      const e = ler();
      if (cep.value.replace(/\D/g, '').length === 8) { buscarCep(true); return; }
      const rua = nomeRua(e.logradouro), cid = semAcento(e.cidade).trim(), uf = e.uf;
      if (rua.length < 3 || cid.length < 3 || !/^[A-Z]{2}$/.test(uf)) {
        aviso('Para achar o CEP: preencha o logradouro, a cidade e a UF.'); return;
      }
      aviso('🔍 procurando o CEP de ' + e.logradouro + '…');
      let r;
      try {
        const res = await fetch('https://viacep.com.br/ws/' + uf + '/' + encodeURIComponent(cid) + '/' + encodeURIComponent(rua) + '/json/');
        r = await res.json();
        if (!res.ok || !Array.isArray(r)) throw new Error('resposta inválida');
      } catch (er) { aviso('Não consegui consultar o ViaCEP (' + er.message + ').'); return; }
      if (!r.length) { aviso('Nenhum CEP para "' + e.logradouro + '" em ' + e.cidade + '/' + uf + '. Confira o nome da rua.'); return; }
      // os do bairro digitado primeiro
      const b = norm(semAcento(e.bairro));
      const doBairro = x => b && norm(semAcento(x.bairro)).includes(b) ? 0 : 1;
      r.sort((x, y) => doBairro(x) - doBairro(y) || String(x.cep).localeCompare(String(y.cep)));
      if (r.length === 1 || (b && r.filter(x => doBairro(x) === 0).length === 1)) { usar(r[0]); return; }
      aviso(r.length + ' CEPs para esta rua: escolha pela faixa de número e bairro.');
      fecharLista();
      listaCep = document.createElement('div');
      const box = (lupa.parentNode).getBoundingClientRect();
      listaCep.style.cssText = 'position:fixed;z-index:3000;background:#fff;border:1px solid #7c3aed;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.25);'
        + 'max-height:300px;overflow:auto;min-width:420px;font-family:system-ui,sans-serif;font-size:13px';
      listaCep.style.left = Math.max(8, Math.min(box.left, innerWidth - 440)) + 'px';
      listaCep.style.top = Math.min(box.bottom + 4, innerHeight - 310) + 'px';
      listaCep.innerHTML = r.map((x, k) => '<div data-k="' + k + '" style="padding:7px 10px;border-top:1px solid #f3f4f6;cursor:pointer' + (doBairro(x) === 0 ? ';background:#f5f3ff' : '') + '">'
        + '<b>' + esc(cepFmt(x.cep)) + '</b> · ' + esc(x.logradouro) + (x.complemento ? ' <span style="color:#7c3aed">(' + esc(x.complemento) + ')</span>' : '')
        + '<br><span style="color:#6b7280">' + esc(x.bairro) + ' · ' + esc(x.localidade) + '/' + esc(x.uf) + '</span></div>').join('');
      listaCep.addEventListener('mouseover', ev => { const d = ev.target.closest('[data-k]'); listaCep.querySelectorAll('[data-k]').forEach(z => { z.style.outline = z === d ? '2px solid #c4b5fd' : ''; }); });
      listaCep.addEventListener('click', ev => { const d = ev.target.closest('[data-k]'); if (d) usar(r[Number(d.dataset.k)]); });
      document.body.appendChild(listaCep);
      setTimeout(() => document.addEventListener('mousedown', foraLista, true), 0);
    }
    if (cep && cep.parentNode) {
      // o CEP e o 🔍 lado a lado
      const caixa = document.createElement('div');
      caixa.style.cssText = 'display:flex;gap:4px;align-items:stretch;width:100%';
      cep.parentNode.insertBefore(caixa, cep);
      caixa.appendChild(cep);
      cep.style.flex = '1 1 auto'; cep.style.minWidth = '0'; cep.style.width = 'auto';
      lupa = document.createElement('button');
      lupa.type = 'button'; lupa.textContent = '🔍'; lupa.tabIndex = -1;
      lupa.title = 'CEP vazio: procura o CEP pela rua, cidade e UF · CEP digitado: busca o endereço';
      lupa.style.cssText = 'flex:0 0 auto;border:1px solid #c4b5fd;background:#faf5ff;border-radius:6px;padding:0 9px;cursor:pointer;font-size:15px';
      caixa.appendChild(lupa);
      lupa.addEventListener('click', procurarPelaRua);
    }
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
