// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos-nova.js
// Criado em: 23/10/2026
//
// SERVICO > NOVA OS (sem venda) — por enquanto o CONSERTO (tipo C).
//   1. P. Fisica / P. Juridica + busca pelo nome: a lista muda a cada letra (nome, estado, cidade, bairro)
//   2. escolhido o cliente: o historico das OS dele (plataforma + Access), TODOS os tipos, mais novas primeiro,
//      com etiquetas para filtrar por tipo (VI, C, G, S) — 23/10/2026; edificio/apto vem do cadastro ou da ultima OS;
//      clique numa OS da plataforma abre o modal dela
//   3. a OS: endereco do servico (vem o de cobranca do cliente), telefones, aparelho, defeito, observacao
//      "Abrir OS" grava (POST /vendas/api/os/nova) e abre o modal da OS para tecnico, dia e horario.
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
  async function buscar() {
    const b = $('busca').value.trim();
    if (b.length < 2) { $('res').hidden = true; return; }
    const meu = ++seq;
    $('res').hidden = false; $('res').innerHTML = '<div class="vz">Procurando…</div>';
    try {
      const d = await api('/vendas/api/venda/clientes?busca=' + encodeURIComponent(b) + '&tipo=' + tipoPessoa());
      if (meu !== seq) return;                           // chegou uma busca mais nova
      lista = d.clientes || [];
      $('res').innerHTML = lista.length
        ? '<table><thead><tr><th>Nome</th><th>Código</th><th>Estado</th><th>Cidade</th><th>Bairro</th><th>Edifício</th><th>Apto</th></tr></thead><tbody>'
          + lista.map((c, i) => '<tr class="cli" data-i="' + i + '"><td><b>' + esc(c.nome) + '</b></td><td class="cinza">' + esc(c.codigo)
            + '</td><td>' + esc(c.uf) + '</td><td>' + esc(c.cidade) + '</td><td>' + esc(c.bairro) + '</td><td>' + esc(c.edificio || '')
            + '</td><td>' + esc(c.apto || '') + '</td></tr>').join('')
          + '</tbody></table>' + (d.total > lista.length ? '<div class="vz">' + d.total + ' clientes — continue digitando para estreitar</div>' : '')
        : '<div class="vz">Nenhum cliente ' + (tipoPessoa() === 'PF' ? 'pessoa física' : 'pessoa jurídica') + ' com “' + esc(b) + '”. '
          + '<a href="/vendas/clientes" target="_blank">+ novo cliente</a></div>';
    } catch (e) { if (meu === seq) $('res').innerHTML = '<div class="vz">' + esc(e.message) + '</div>'; }
  }
  $('busca').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(buscar, 220); });
  document.querySelectorAll('input[name=pf]').forEach(r => r.addEventListener('change', () => { buscar(); $('busca').focus(); }));
  $('res').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-i]'); if (tr) escolher(lista[Number(tr.dataset.i)]); });

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
      const oss = filtroTipo ? todasOS.filter(o => o.tipo === filtroTipo) : todasOS;
      $('hist-chips').innerHTML = chips;
      $('hist').innerHTML = oss.length
        ? '<table><thead><tr><th>Nº OS</th><th>Data</th><th>Tipo</th><th>Situação</th><th>Histórico</th></tr></thead><tbody>'
          + oss.map(o => '<tr' + (o.id ? ' class="abre" data-id="' + esc(o.id) + '" title="abrir a OS"' : '') + '><td><b>' + esc(o.numero) + '</b>'
            + (o.origem === 'Access' ? '<span class="acc">Access</span>' : '') + '</td><td>' + br(o.data) + '</td><td><span class="tp ' + esc(o.tipo) + '">' + esc(o.tipo || '?')
            + '</span></td><td><span class="sit ' + esc(o.status) + '">' + esc(o.situacao) + '</span></td><td>' + esc(o.historico || '') + (o.tecnico ? ' <span class="cinza">· ' + esc(o.tecnico) + '</span>' : '') + '</td></tr>').join('')
          + '</tbody></table>'
        : '<div class="vz">' + (filtroTipo ? 'Nenhuma OS ' + esc(NOME_TIPO[filtroTipo]) + ' para este cliente.'
          : 'Nenhuma OS para este cliente — procurei todos os tipos (VI, C, G, S), no Access e na plataforma.') + '</div>';
      const abertas = todasOS.filter(o => o.status === 'P' || o.status === 'E').length;
      $('hist-rod').innerHTML = oss.length + ' OS' + (filtroTipo ? ' de ' + todasOS.length : '')
        + (abertas ? ' · <b style="color:#dc2626">' + abertas + ' em aberto</b> — confira se não é a mesma antes de abrir outra' : '');
    }
  }
  $('hist-chips').addEventListener('click', ev => { const b = ev.target.closest('[data-ft]'); if (!b) return; filtroTipo = b.dataset.ft; desenharHist(); });
  $('hist').addEventListener('click', ev => {
    const tr = ev.target.closest('tr[data-id]');
    if (tr && window.OSModal) window.OSModal.abrir(tr.dataset.id, () => historico());
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
      if (window.OSModal) window.OSModal.abrir(r.id, () => historico());
    } catch (e) {
      rec.className = 'recado erro'; rec.textContent = e.message;
    } finally { $('abrir').disabled = false; }
  });

  $('busca').focus();
})();
