// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\vendedores.js
// Criado em: 30/10/2026 (Jorge)
//
// VENDA > VENDEDORES (views\vendas\pages\vendedores.handlebars)
//   Cadastro (botao): ficha de vendedor NOVO ao lado da lista · clique na lista: ficha num MODAL (editar)
//   API: GET/POST/PUT /vendas/api/venda/vendedores  ·  GET/POST/PUT /vendas/api/venda/comissao-grupos
//   Comissao: GET /vendas/api/venda/vendedores/comissao?ano=  (jan..dez por vendedor)
//             GET /vendas/api/venda/vendedores/comissao/vendas?vendedor=&ano=&mes=  (clique na celula)
// Alterado em: 30/10/2026 (tarde) - taxa por GRUPO de comissao (taxas: [{ grupo, taxa }]); aba Grupos;
//              ficha ao lado (novo) e em modal (editar).
// Alterado em: 30/10/2026 (tarde 2) - a TAXA e do GRUPO (aba Grupos, igual para todos); o vendedor so marca os grupos
//              com direito (grupos: [id]). Editar mostra sempre todos os grupos com a caixa.
// Dinheiro em centavos na API; taxa em % (ex.: 1,5).
// =============================================================================
(function () {
  'use strict';
  const API = '/vendas/api/venda';
  const $ = id => document.getElementById(id);
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = n => (Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' %';
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dataBr = d => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const TIPO = { CLT: 'CLT', MEI: 'MEI', AVULSO: 'avulso' };

  async function api(metodo, url, corpo) {
    const r = await fetch(API + url, { method: metodo, credentials: 'same-origin',
      headers: corpo ? { 'Content-Type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined });
    if (r.status === 401) { location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    let j; try { j = await r.json(); } catch (e) { throw new Error('resposta inválida (status ' + r.status + ')'); }
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  // ---- grupos de comissao ------------------------------------------------------------------
  let grupos = [];
  const nomeGrupo = id => (grupos.find(g => g.id === id) || {}).nome || '?';
  async function carregarGrupos() { grupos = (await api('GET', '/comissao-grupos')).grupos || []; }

  // ---- abas -------------------------------------------------------------------------
  let comCarregada = false;
  function aba(nome) {
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === nome));
    $('aba-lista').hidden = nome !== 'lista'; $('aba-com').hidden = nome !== 'com'; $('aba-grupos').hidden = nome !== 'grupos';
    if (nome === 'com' && !comCarregada) { comCarregada = true; comissao(); }
    if (nome === 'grupos') desenharGrupos();
    try { localStorage.setItem('vendedores-aba', nome); } catch (e) { /* sem storage */ }
  }
  $('abas').addEventListener('click', ev => { const b = ev.target.closest('button[data-aba]'); if (b) aba(b.dataset.aba); });

  // ---- lista -------------------------------------------------------------------------
  let lista = [], atual = null, modo = '';            // modo: 'novo' (ao lado) | 'editar' (modal) | ''
  const msg = (t, ok) => { $('f-msg').textContent = t || ''; $('f-msg').className = 'msg' + (ok ? ' ok' : ''); };

  async function carregar() {
    try {
      lista = (await api('GET', '/vendedores' + ($('ver-inativos').checked ? '?todos=1' : ''))).vendedores;
      desenhar();
    } catch (e) { $('lista').innerHTML = '<tr><td colspan="6" class="msg">' + esc(e.message) + '</td></tr>'; }
  }
  function textoTaxas(v) {
    const t = grupos.filter(g => (v.grupos || []).includes(g.id));
    return t.map(g => '<span>' + esc(g.nome) + ' <b>' + pct(g.taxa) + '</b></span>').join('')
      || '<span class="falta">nenhum grupo: sem comissão</span>';
  }
  function desenhar() {
    $('lista').innerHTML = lista.length ? lista.map(v => '<tr data-id="' + esc(v.id) + '" class="' + (v.ativo ? '' : 'inativo') + '"><td>'
      + esc(v.nome) + (v.ativo ? '' : ' <small>(inativo)</small>') + '</td><td>' + esc(v.apelido)
      + '</td><td><span class="tag ' + esc(v.tipo) + '">' + esc(TIPO[v.tipo] || v.tipo) + '</span></td><td>' + esc(v.documento) + '</td><td>' + esc(v.telefone)
      + '</td><td class="tx">' + textoTaxas(v) + '</td></tr>').join('')
      : '<tr><td colspan="6" class="dica">Nenhum vendedor. Clique em <b>Cadastro</b>.</td></tr>';
  }

  // ---- ficha (ao lado: novo · modal: editar) ----------------------------------------------
  // os grupos com a caixa (marcado = tem direito); a taxa e a do grupo
  function desenharGruposFicha(marcados) {
    const vis = grupos.filter(g => g.ativo || marcados.includes(g.id));
    $('f-grupos').innerHTML = vis.length ? vis.map(g => '<label class="gr-l' + (g.ativo ? '' : ' inativo') + '"><input type="checkbox" value="' + esc(g.id) + '"'
      + (marcados.includes(g.id) ? ' checked' : '') + '> ' + esc(g.nome) + (g.ativo ? '' : ' (inativo)') + '<b>' + pct(g.taxa) + '</b></label>').join('')
      : '<div class="dica">Nenhum grupo. Crie na aba Grupos.</div>';
  }
  function preencher(v) {
    atual = v || null;
    $('f-nome').value = v ? v.nome : ''; $('f-apelido').value = v ? v.apelido : '';
    $('f-tipo').value = v ? v.tipo : 'CLT'; $('f-doc').value = v ? v.documento : ''; $('f-fone').value = v ? v.telefone : '';
    $('f-access').value = v ? v.codigoAccess : ''; $('f-ativo').checked = v ? v.ativo : true;
    desenharGruposFicha(v ? v.grupos || [] : grupos.filter(g => g.ativo).map(g => g.id));   // novo: todos marcados
    msg('');
  }
  function abrirNovo() {
    fecharEditar(true);
    $('lado-corpo').appendChild($('ficha'));
    $('lado').hidden = false; $('cad').classList.add('com-lado'); $('btn-cad').classList.add('ativo');
    modo = 'novo'; preencher(null); aba('lista'); $('f-nome').focus();
  }
  function fecharLado() { $('lado').hidden = true; $('cad').classList.remove('com-lado'); $('btn-cad').classList.remove('ativo'); if (modo === 'novo') modo = ''; }
  function abrirEditar(v) {
    fecharLado();
    $('e-corpo').appendChild($('ficha'));
    $('e-tit').textContent = 'Editar vendedor · ' + v.nome;
    $('e-fundo').hidden = false; $('e-caixa').hidden = false;
    modo = 'editar'; preencher(v); $('f-nome').focus();
  }
  function fecharEditar(semFoco) { $('e-fundo').hidden = true; $('e-caixa').hidden = true; if (modo === 'editar') modo = ''; if (!semFoco) atual = null; }

  $('btn-cad').addEventListener('click', () => { if (modo === 'novo') fecharLado(); else abrirNovo(); });
  $('lado-fechar').addEventListener('click', fecharLado);
  $('e-fechar').addEventListener('click', () => fecharEditar()); $('e-fundo').addEventListener('click', () => fecharEditar());
  $('f-cancelar').addEventListener('click', () => { if (modo === 'editar') fecharEditar(); else fecharLado(); });
  $('lista').addEventListener('click', ev => {
    const tr = ev.target.closest('tr[data-id]'); if (!tr) return;
    const v = lista.find(x => x.id === tr.dataset.id); if (v) abrirEditar(v);
  });
  $('ver-inativos').addEventListener('change', carregar);

  $('f-gravar').addEventListener('click', async () => {
    const marcados = [...document.querySelectorAll('#f-grupos input:checked')].map(c => c.value);
    const corpo = { nome: $('f-nome').value.trim(), apelido: $('f-apelido').value.trim(), tipo: $('f-tipo').value,
      documento: $('f-doc').value.trim(), telefone: $('f-fone').value.trim(), codigoAccess: $('f-access').value.trim(),
      ativo: $('f-ativo').checked, grupos: marcados, comissao: atual ? atual.comissao : 0 };
    if (!corpo.nome) { msg('Informe o nome.'); $('f-nome').focus(); return; }
    $('f-gravar').disabled = true;
    try {
      const r = atual ? await api('PUT', '/vendedores/' + atual.id, corpo) : await api('POST', '/vendedores', corpo);
      await carregar();
      comCarregada = false;                                 // a comissao recarrega na proxima vez
      if (modo === 'editar') { fecharEditar(); } else { preencher(null); msg('✓ ' + r.vendedor.nome + ' gravado. Pode cadastrar outro.', true); $('f-nome').focus(); }
    } catch (e) { msg(e.message); }
    finally { $('f-gravar').disabled = false; }
  });
  ['f-nome', 'f-apelido', 'f-doc', 'f-fone', 'f-access'].forEach(id => $(id).addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('f-gravar').click(); }
  }));

  // ---- aba Grupos ---------------------------------------------------------------------
  const gmsg = (t, ok) => { $('g-msg').textContent = t || ''; $('g-msg').className = 'msg' + (ok ? ' ok' : ''); };
  async function desenharGrupos() {
    try { await carregarGrupos(); } catch (e) { gmsg(e.message); return; }
    $('g-lista').innerHTML = grupos.map(g => '<tr data-id="' + esc(g.id) + '" class="' + (g.ativo ? '' : 'inativo') + '"><td>' + g.ordem
      + '</td><td><input class="nm" value="' + esc(g.nome) + '" data-nome="' + esc(g.nome) + '"></td><td class="num"><input class="tx" inputmode="decimal" value="'
      + String(g.taxa).replace('.', ',') + '" data-taxa="' + g.taxa + '"> %</td><td class="num">' + g.produtos + '</td><td class="num">'
      + '<button type="button" data-ativo="' + (g.ativo ? '0' : '1') + '">' + (g.ativo ? 'desativar' : 'ativar') + '</button></td></tr>').join('');
  }
  $('g-lista').addEventListener('change', async ev => {
    const inp = ev.target; if (inp.tagName !== 'INPUT') return;
    const id = inp.closest('tr').dataset.id;
    if (inp.classList.contains('tx')) {                    // taxa do grupo (todos os vendedores)
      const taxa = inp.value.trim() || '0';
      try { await api('PUT', '/comissao-grupos/' + id, { taxa }); gmsg('✓ taxa gravada', true); await carregarGrupos(); desenhar(); comCarregada = false; }
      catch (e) { gmsg(e.message); inp.value = String(inp.dataset.taxa).replace('.', ','); }
      return;
    }
    const nome = inp.value.trim();
    if (!nome) { inp.value = inp.dataset.nome; return; }
    try { await api('PUT', '/comissao-grupos/' + id, { nome }); inp.dataset.nome = nome; gmsg('✓ grupo renomeado', true); await carregarGrupos(); desenhar(); }
    catch (e) { gmsg(e.message); inp.value = inp.dataset.nome; }
  });
  $('g-lista').addEventListener('click', async ev => {
    const b = ev.target.closest('button[data-ativo]'); if (!b) return;
    try { await api('PUT', '/comissao-grupos/' + b.closest('tr').dataset.id, { ativo: b.dataset.ativo === '1' }); await desenharGrupos(); desenhar(); gmsg(''); }
    catch (e) { gmsg(e.message); }
  });
  $('g-incluir').addEventListener('click', async () => {
    const nome = $('g-nome').value.trim(); if (!nome) { $('g-nome').focus(); return; }
    try { await api('POST', '/comissao-grupos', { nome, taxa: $('g-taxa').value.trim() || '0' }); $('g-nome').value = ''; $('g-taxa').value = ''; await desenharGrupos(); desenhar(); gmsg('✓ grupo incluído', true); }
    catch (e) { gmsg(e.message); }
  });
  ['g-nome', 'g-taxa'].forEach(id => $(id).addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('g-incluir').click(); } }));
  $('g-lista').addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') ev.target.blur(); });

  // ---- comissao (padrao fluxo de caixa) -------------------------------------------------
  let ano = new Date().getFullYear(), linhas = [];
  async function comissao() {
    $('c-msg').textContent = '';
    try {
      const r = await api('GET', '/vendedores/comissao?ano=' + ano);
      $('c-ano').innerHTML = r.anos.map(a => '<option' + (a === r.ano ? ' selected' : '') + '>' + a + '</option>').join('');
      linhas = r.linhas;
      const cel = (l, m, k) => !m.qtd ? '<td class="m vz">—</td>'
        : '<td class="m' + (k === 0 ? ' tot' : '') + '" data-v="' + esc(l.vendedor) + '" data-m="' + k + '" title="' + m.qtd + ' venda(s)">'
          + (l.vendedor ? '<b>' + brl(m.comissao) + '</b>' : '') + '<small>' + brl(m.base) + '</small></td>';
      $('c-corpo').innerHTML = linhas.length ? linhas.map(l => '<tr class="' + (l.vendedor ? '' : 'sem') + '"><td class="nome">' + esc(l.nome)
        + (l.ativo === false ? ' <small>(inativo)</small>' : '') + '</td>'
        + l.meses.map((m, i) => cel(l, m, i + 1)).join('') + cel(l, l.total, 0) + '</tr>').join('')
        : '<tr><td colspan="14" class="dica">Nenhuma venda fechada em ' + r.ano + '.</td></tr>';
      const soma = Array.from({ length: 12 }, (_, i) => linhas.reduce((t, l) => ({ base: t.base + l.meses[i].base, comissao: t.comissao + l.meses[i].comissao }), { base: 0, comissao: 0 }));
      const tot = soma.reduce((t, m) => ({ base: t.base + m.base, comissao: t.comissao + m.comissao }), { base: 0, comissao: 0 });
      $('c-pe').innerHTML = linhas.length ? '<tr><td class="nome">Total</td>' + soma.concat([tot]).map(m => !m.base ? '<td class="m vz">—</td>'
        : '<td class="m"><b>' + brl(m.comissao) + '</b><small>' + brl(m.base) + '</small></td>').join('') + '</tr>' : '';
    } catch (e) { $('c-msg').textContent = e.message; }
  }
  $('c-ano').addEventListener('change', () => { ano = Number($('c-ano').value); comissao(); });
  $('c-corpo').addEventListener('click', async ev => {
    const td = ev.target.closest('td.m[data-m]'); if (!td) return;
    const l = linhas.find(x => x.vendedor === td.dataset.v), m = Number(td.dataset.m);
    $('d-tit').textContent = (l ? l.nome : '') + ' · ' + (m ? MESES[m - 1] + ' de ' + ano : 'ano de ' + ano);
    $('d-corpo').innerHTML = '<tr><td colspan="9" class="dica">Carregando…</td></tr>'; $('d-pe').innerHTML = '';
    $('d-fundo').hidden = false; $('d-caixa').hidden = false;
    try {
      const vs = (await api('GET', '/vendedores/comissao/vendas?vendedor=' + encodeURIComponent(td.dataset.v) + '&ano=' + ano + '&mes=' + m)).vendas;
      $('d-corpo').innerHTML = vs.map(v => {
        const tip = (v.grupos || []).map(g => g.grupo + ': ' + brl(g.base) + ' × ' + pct(g.taxa) + ' = ' + brl(g.valor)).join('\n');
        return '<tr' + (tip ? ' title="' + esc(tip) + '"' : '') + '><td>' + v.numero + '</td><td>' + dataBr(v.data) + '</td><td>' + (v.documento === 'NFE' ? 'NF' : 'cupom')
          + (v.origem === 'ACCESS' ? ' <small>(Access)</small>' : '') + '</td><td>' + esc(v.cliente) + '</td><td class="num">' + brl(v.liquido)
          + '</td><td class="num">' + (v.maoDeObra ? brl(v.maoDeObra) : '') + '</td><td class="num">' + brl(v.base) + '</td><td class="num">'
          + (v.comissao ? pct(v.pct) : '') + '</td><td class="num"><b>' + (v.comissao ? brl(v.comissao) : '') + '</b></td></tr>';
      }).join('') || '<tr><td colspan="9" class="dica">Nenhuma venda.</td></tr>';
      const t = vs.reduce((s, v) => ({ l: s.l + v.liquido, mo: s.mo + v.maoDeObra, b: s.b + v.base, c: s.c + v.comissao }), { l: 0, mo: 0, b: 0, c: 0 });
      $('d-pe').innerHTML = '<tr><td colspan="4"><b>' + vs.length + ' venda(s)</b> <small class="dica">· passe o mouse na venda: a conta por grupo</small></td><td class="num"><b>' + brl(t.l)
        + '</b></td><td class="num"><b>' + brl(t.mo) + '</b></td><td class="num"><b>' + brl(t.b) + '</b></td><td></td><td class="num"><b>' + brl(t.c) + '</b></td></tr>';
    } catch (e) { $('d-corpo').innerHTML = '<tr><td colspan="9" class="msg">' + esc(e.message) + '</td></tr>'; }
  });
  const fecharD = () => { $('d-fundo').hidden = true; $('d-caixa').hidden = true; };
  $('d-fechar').addEventListener('click', fecharD); $('d-fundo').addEventListener('click', fecharD);
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (!$('d-caixa').hidden) fecharD(); else if (!$('e-caixa').hidden) fecharEditar();
  });

  // ---- inicio ---------------------------------------------------------------------------
  $('lado-corpo').appendChild($('ficha'));                  // a ficha comeca escondida, ao lado
  let inicio = 'lista'; try { inicio = localStorage.getItem('vendedores-aba') || 'lista'; } catch (e) { /* sem storage */ }
  if (new URLSearchParams(location.search).get('aba') === 'comissao') inicio = 'com';
  carregarGrupos().catch(e => { $('lista').innerHTML = '<tr><td colspan="6" class="msg">' + esc(e.message) + '</td></tr>'; })
    .then(carregar).then(() => aba(['lista', 'com', 'grupos'].includes(inicio) ? inicio : 'lista'));
})();
