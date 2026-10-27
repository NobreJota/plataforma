// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos-nova.js
// Criado em: 23/10/2026
//
// SERVICO > NOVA OS (sem venda) — por enquanto o CONSERTO (tipo C).
//   1. P. Fisica / P. Juridica + busca pelo nome: a lista muda a cada letra (nome, estado, cidade, bairro)
//   2. escolhido o cliente: o historico das OS dele (plataforma + Access), TODOS os tipos, mais novas primeiro,
//      ordena clicando no cabecalho (Nº OS, Data, Tipo, Situacao, Historico); lista de clientes com paginas < >;
//      com etiquetas para filtrar por tipo (VI, C, G, S) — 23/10/2026; edificio/apto vem do cadastro ou da ultima OS;
//      clique numa OS da plataforma abre o modal dela
//   3. a OS: endereco do servico (vem o de cobranca do cliente), telefones, aparelho, defeito, observacao
//      "Abrir OS" grava (POST /vendas/api/os/nova) e abre o modal da OS para tecnico, dia e horario.
// 26/10/2026: "OS PENDENTES" no topo (todas as pendentes sem venda deste tipo; as incompletas primeiro, com o que
//   falta; as completas com "completa · aguarda o serviço"). Antes: "OS POR COMPLETAR" no topo: as OS pendentes sem venda deste tipo faltando tecnico, dia, horario ou
//   valor combinado (GET /vendas/api/os/incompletas?tipo=). Abrir = modal da OS; Cancelar = motivo
//   (POST /vendas/api/os/:id/cancelar; consignado com o tecnico tem que voltar antes).
// APIs: GET /vendas/api/venda/clientes?busca=&tipo=PF|PJ   GET /vendas/api/os/historico-cliente?cliente=
//       POST /vendas/api/os/nova
// =============================================================================

'use strict';

(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = d => { const x = d ? new Date(d) : null; return x && !isNaN(x) ? x.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'; };
  const TIPO = (new URLSearchParams(location.search).get('tipo') || 'C').toUpperCase();
  const PRONTOS = new Set(['C']);                       // tipos que ja abrem OS
  let cliente = null, lista = [], espera = null, seq = 0;

  async function api(url, opc) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opc || {}));
    if (r.status === 401) { location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }

  // ---- tipo (abas) ------------------------------------------------------------
  document.querySelectorAll('#tipos a').forEach(a => a.classList.toggle('ativa', a.dataset.t === TIPO));
  if (!PRONTOS.has(TIPO)) { $('breve').hidden = false; $('tela').hidden = true; return; }

  // ---- 1. busca do cliente ------------------------------------------------------
  const tipoPessoa = () => (document.querySelector('input[name=pf]:checked') || {}).value || 'PF';
  let pag = 1;                                          // 23/10/2026: pagina da lista de clientes (20 por pagina)
  async function buscar() {
    const b = $('busca').value.trim();
    if (b.length < 2) { $('res').hidden = true; return; }
    const meu = ++seq;
    $('res').hidden = false; $('res').innerHTML = '<div class="vz">Procurando…</div>';
    try {
      const d = await api('/vendas/api/venda/clientes?busca=' + encodeURIComponent(b) + '&tipo=' + tipoPessoa() + '&pagina=' + pag);
      pag = d.pagina || 1;
      if (meu !== seq) return;                           // chegou uma busca mais nova
      lista = d.clientes || [];
      $('res').innerHTML = lista.length
        ? '<table><thead><tr><th>Nome</th><th>Código</th><th>Estado</th><th>Cidade</th><th>Bairro</th><th>Edifício</th><th>Apto</th></tr></thead><tbody>'
          + lista.map((c, i) => '<tr class="cli" data-i="' + i + '"><td><b>' + esc(c.nome) + '</b></td><td class="cinza">' + esc(c.codigo)
            + '</td><td>' + esc(c.uf) + '</td><td>' + esc(c.cidade) + '</td><td>' + esc(c.bairro) + '</td><td>' + esc(c.edificio || '')
            + '</td><td>' + esc(c.apto || '') + '</td></tr>').join('')
          + '</tbody></table>' + ((d.paginas || 1) > 1
            ? '<div class="pags"><button type="button" data-pg="-1"' + (pag <= 1 ? ' disabled' : '') + '>&lt;</button> página ' + pag + ' de ' + d.paginas
              + ' · ' + d.total + ' clientes <button type="button" data-pg="1"' + (pag >= d.paginas ? ' disabled' : '') + '>&gt;</button>'
              + ' <span class="cinza">(ou continue digitando para estreitar)</span></div>' : '')
        : '<div class="vz">Nenhum cliente ' + (tipoPessoa() === 'PF' ? 'pessoa física' : 'pessoa jurídica') + ' com “' + esc(b) + '”. '
          + '<a href="/vendas/clientes" target="_blank">+ novo cliente</a></div>';
    } catch (e) { if (meu === seq) $('res').innerHTML = '<div class="vz">' + esc(e.message) + '</div>'; }
  }
  $('busca').addEventListener('input', () => { pag = 1; clearTimeout(espera); espera = setTimeout(buscar, 220); });
  document.querySelectorAll('input[name=pf]').forEach(r => r.addEventListener('change', () => { pag = 1; buscar(); $('busca').focus(); }));
  $('res').addEventListener('click', ev => {
    const pg = ev.target.closest('[data-pg]'); if (pg) { pag += Number(pg.dataset.pg); buscar(); return; }   // 23/10: troca de pagina
    const tr = ev.target.closest('tr[data-i]'); if (tr) escolher(lista[Number(tr.dataset.i)]);
  });

  // ---- 2. cliente escolhido: historico -------------------------------------------
  async function escolher(c) {
    cliente = c;
    $('cx-busca').hidden = true; $('cx-cliente').hidden = false; $('cx-hist').hidden = false; $('cx-os').hidden = false;
    $('cli-nome').textContent = c.nome;
    $('cli-info').textContent = [c.codigo, c.documento, [c.cidade, c.uf].filter(Boolean).join('/'), c.bairro, c.telefone].filter(Boolean).join(' · ');
    // endereco do servico: o de cobranca do cliente (pode mudar)
    const v = { 'e-logradouro': c.logradouro, 'e-numero': c.numero, 'e-complemento': c.complemento, 'e-bairro': c.bairro,
                'e-cidade': c.cidade, 'e-uf': c.uf, 'e-cep': c.cep, telefone: c.telefone };
    for (const [id, x] of Object.entries(v)) $(id).value = x || '';
    ['referencia', 'celular', 'codigoProduto', 'aparelho', 'defeito', 'observacao'].forEach(id => { $(id).value = ''; });
    $('edificio').value = c.edificio || ''; $('apto').value = c.apto || '';
    $('recado').textContent = '';
    filtroTipo = '';
    await historico();
    $('aparelho').focus();
  }
  // 23/10/2026: o historico traz TODOS os tipos (VI, C, G, S); as etiquetas filtram por tipo
  let todasOS = [], filtroTipo = '';
  let histOrd = { k: 'data', asc: false };              // 23/10/2026: ordenar o historico pelo cabecalho
  const valHist = (o, k) => k === 'numero' ? Number(o.numero) || 0 : k === 'data' ? new Date(o.data || 0).getTime()
    : String(o[k] || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const NOME_TIPO = { VI: 'VI · venda/instalação', C: 'C · conserto', G: 'G · garantia', S: 'S · serviços' };
  async function historico() {
    $('hist').innerHTML = '<div class="vz">Carregando…</div>'; $('hist-rod').textContent = '';
    try {
      const d = await api('/vendas/api/os/historico-cliente?cliente=' + encodeURIComponent(cliente.id));
      todasOS = d.oss || [];
      // sem edificio/apto no cadastro: vem da OS mais recente que tiver
      if (!$('edificio').value && !$('apto').value) {
        const u = todasOS.find(o => o.edificio || o.apto);
        if (u) { $('edificio').value = u.edificio || ''; $('apto').value = u.apto || ''; }
      }
      desenharHist();
    } catch (e) { $('hist').innerHTML = '<div class="vz">' + esc(e.message) + '</div>'; }
  }
  function desenharHist() {
    {
      const cont = {}; todasOS.forEach(o => { cont[o.tipo || '?'] = (cont[o.tipo || '?'] || 0) + 1; });
      const chips = '<div class="chips">' + ['', 'VI', 'C', 'G', 'S'].map(t => '<button type="button" data-ft="' + t + '" class="' + (filtroTipo === t ? 'on' : '') + '">'
        + (t ? NOME_TIPO[t] : 'Todos os tipos') + ' <b>' + (t ? (cont[t] || 0) : todasOS.length) + '</b></button>').join('') + '</div>';
      const oss = (filtroTipo ? todasOS.filter(o => o.tipo === filtroTipo) : todasOS.slice()).sort((a, b) => {
        const x = valHist(a, histOrd.k), y = valHist(b, histOrd.k), s1 = histOrd.asc ? 1 : -1;
        return (x < y ? -s1 : x > y ? s1 : 0) || (new Date(b.data || 0) - new Date(a.data || 0)); });
      const th = (k, rot) => '<th class="ord" data-ho="' + k + '">' + rot + (histOrd.k === k ? (histOrd.asc ? ' ▲' : ' ▼') : ' <span class="cinza">↕</span>') + '</th>';
      $('hist-chips').innerHTML = chips;
      $('hist').innerHTML = oss.length
        ? '<table><thead><tr>' + th('numero', 'Nº OS') + th('data', 'Data') + th('tipo', 'Tipo') + th('situacao', 'Situação') + th('historico', 'Histórico') + '</tr></thead><tbody>'
          + oss.map(o => '<tr' + (o.id ? ' class="abre" data-id="' + esc(o.id) + '" title="abrir a OS"' : '') + '><td><b>' + esc(o.numero) + '</b>'
            + (o.origem && o.origem !== 'plataforma' ? '<span class="acc">' + esc(o.origem) + '</span>' : '') + '</td><td>' + br(o.data) + '</td><td><span class="tp ' + esc(o.tipo) + '">' + esc(o.tipo || '?')
            + '</span></td><td><span class="sit ' + esc(o.status) + '">' + esc(o.situacao) + '</span></td><td>' + esc(o.historico || '') + (o.tecnico ? ' <span class="cinza">· ' + esc(o.tecnico) + '</span>' : '') + '</td></tr>').join('')
          + '</tbody></table>'
        : '<div class="vz">' + (filtroTipo ? 'Nenhuma OS ' + esc(NOME_TIPO[filtroTipo]) + ' para este cliente.'
          : 'Nenhuma OS para este cliente — procurei todos os tipos (VI, C, G, S), no Access e na plataforma.') + '</div>';
      const abertas = todasOS.filter(o => o.status === 'P' || o.status === 'E').length;
      $('hist-rod').innerHTML = oss.length + ' OS' + (filtroTipo ? ' de ' + todasOS.length : '')
        + (abertas ? ' · <b style="color:#dc2626">' + abertas + ' em aberto</b> — confira se não é a mesma antes de abrir outra' : '');
    }
  }
  $('hist').addEventListener('click', ev => {
    const h = ev.target.closest('th[data-ho]'); if (!h) return;
    const k = h.dataset.ho; histOrd = histOrd.k === k ? { k, asc: !histOrd.asc } : { k, asc: k !== 'data' && k !== 'numero' };
    desenharHist();
  });
  $('hist-chips').addEventListener('click', ev => { const b = ev.target.closest('[data-ft]'); if (!b) return; filtroTipo = b.dataset.ft; desenharHist(); });
  $('hist').addEventListener('click', ev => {
    const tr = ev.target.closest('tr[data-id]');
    if (tr && window.OSModal) window.OSModal.abrir(tr.dataset.id, () => { historico(); carregarIncompletas(); });
  });
  $('trocar').addEventListener('click', () => {
    cliente = null;
    $('cx-busca').hidden = false; $('cx-cliente').hidden = true; $('cx-hist').hidden = true; $('cx-os').hidden = true;
    $('busca').focus(); $('busca').select();
  });

  // ---- 3. abrir a OS ------------------------------------------------------------
  $('codigoProduto').addEventListener('input', ev => { ev.target.value = ev.target.value.replace(/\D/g, ''); });
  $('form').addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!cliente) return;
    const rec = $('recado');
    const faltou = [['e-logradouro', 'a rua'], ['e-cidade', 'a cidade'], ['aparelho', 'o aparelho'], ['defeito', 'o defeito']]
      .find(([id]) => !$(id).value.trim());
    if (faltou) { rec.className = 'recado erro'; rec.textContent = 'Informe ' + faltou[1] + '.'; $(faltou[0]).focus(); return; }
    const corpo = {
      tipo: TIPO, clienteId: cliente.id,
      endereco: { logradouro: $('e-logradouro').value, numero: $('e-numero').value, complemento: $('e-complemento').value,
                  bairro: $('e-bairro').value, cidade: $('e-cidade').value, uf: $('e-uf').value, cep: $('e-cep').value },
      edificio: $('edificio').value, apto: $('apto').value, pontoReferencia: $('referencia').value,
      telefone: $('telefone').value, celular: $('celular').value,
      codigoProduto: $('codigoProduto').value, aparelho: $('aparelho').value, defeito: $('defeito').value, observacao: $('observacao').value,
    };
    $('abrir').disabled = true; rec.className = 'recado'; rec.textContent = 'Gravando…';
    try {
      const r = await api('/vendas/api/os/nova', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      rec.className = 'recado ok'; rec.textContent = '✓ OS nº ' + r.numero + ' aberta. Escolha técnico, dia e horário.';
      ['aparelho', 'defeito', 'observacao', 'codigoProduto'].forEach(id => { $(id).value = ''; });
      await historico();
      carregarIncompletas();                                // 26/10/2026
      if (window.OSModal) window.OSModal.abrir(r.id, () => { historico(); carregarIncompletas(); });
    } catch (e) {
      rec.className = 'recado erro'; rec.textContent = e.message;
    } finally { $('abrir').disabled = false; }
  });

  // ---- 26/10/2026: OS por completar ----------------------------------------------
  let incompletas = [];
  async function carregarIncompletas() {
    try { incompletas = (await api('/vendas/api/os/incompletas?tipo=' + encodeURIComponent(TIPO))).oss || []; }
    catch (e) { incompletas = []; }
    $('cx-incomp').hidden = !incompletas.length;
    const nInc = incompletas.filter(o => o.falta.length).length;
    $('incomp-n').textContent = incompletas.length ? '(' + incompletas.length + (nInc ? ' · ' + nInc + ' por completar' : '') + ')' : '';
    $('cx-incomp').classList.toggle('tudo-ok', !nInc);
    $('incomp').innerHTML = '<table><thead><tr><th>Nº OS</th><th>Aberta</th><th>Cliente</th><th>Aparelho / defeito</th><th>Situação</th><th></th></tr></thead><tbody>'
      + incompletas.map((o, i) => '<tr><td><b>' + esc(o.numero) + '</b></td><td>' + br(o.aberta) + '</td><td>' + esc(o.cliente) + '</td>'
        + '<td>' + esc(o.aparelho) + (o.defeito ? '<br><span class="cinza">' + esc(o.defeito) + '</span>' : '')
        + (o.tecnicoNome ? '<br><span class="cinza">técnico: ' + esc(o.tecnicoNome) + (o.diaPrevisto ? ' · ' + br(o.diaPrevisto + 'T12:00:00Z') : '')
          + (o.horaIni ? ' ' + esc(o.horaIni) + '–' + esc(o.horaFim) : '') + '</span>' : '')
        + (o.valor ? '<br><span class="cinza">valor combinado: R$ ' + (o.valor / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '</span>' : '') + '</td>'
        + '<td>' + (o.falta.length ? o.falta.map(f => '<span class="falta">' + esc(f) + '</span>').join('') : '<span class="falta ok">completa · aguarda o serviço</span>') + (o.consignados ? '<br><span class="cinza">' + o.consignados + ' consignado(s) com o técnico</span>' : '') + '</td>'
        + '<td style="text-align:right"><button type="button" class="mini abrir" data-ab="' + i + '">Abrir</button> '
        + '<button type="button" class="mini canc" data-ca="' + i + '">Cancelar</button></td></tr>').join('')
      + '</tbody></table>';
  }
  $('incomp').addEventListener('click', async ev => {
    const ab = ev.target.closest('[data-ab]'), ca = ev.target.closest('[data-ca]');
    if (ab) { const o = incompletas[Number(ab.dataset.ab)]; if (o && window.OSModal) window.OSModal.abrir(o.id, () => { carregarIncompletas(); if (cliente) historico(); }); return; }
    if (!ca) return;
    const o = incompletas[Number(ca.dataset.ca)]; if (!o) return;
    if (o.consignados) { alert('A OS nº ' + o.numero + ' tem ' + o.consignados + ' consignado(s) com o técnico.\nAbra a OS e devolva ao estoque antes de cancelar.'); return; }
    const motivo = prompt('CANCELAR a OS nº ' + o.numero + ' · ' + o.cliente + '\n' + o.aparelho + '\n\nMotivo (obrigatório):', 'cliente desistiu');
    if (motivo === null) return;
    if (motivo.trim().length < 3) { alert('Escreva o motivo.'); return; }
    try {
      await api('/vendas/api/os/' + encodeURIComponent(o.id) + '/cancelar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo: motivo.trim() }) });
      await carregarIncompletas();
      if (cliente) historico();
    } catch (e) { alert(e.message); }
  });
  // a lista se atualiza quando o modal da OS grava (o mesmo aviso que o historico usa)
  window.addEventListener('os-mudou', carregarIncompletas);
  window.addEventListener('os-modal-fechou', carregarIncompletas);          // fechou o modal: confere de novo
  window.addEventListener('focus', carregarIncompletas);                    // voltou de outra aba/janela
  carregarIncompletas();

  $('busca').focus();
})();
