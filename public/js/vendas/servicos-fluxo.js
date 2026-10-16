// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos-fluxo.js
// Criado em: 16/10/2026
//
// SERVICO > FLUXO DE SERVICO (views\vendas\pages\servicos-fluxo.handlebars)
// Lista o a receber das OS (linhas fluxo:'SERVICO' de _fluxo_projetado) e recebe pelo MESMO
// codigo do fluxo de caixa: POST /financeiro/api/pagamento/quitar (tipo receber). Depois chama
// POST /vendas/api/os/fluxo/sincronizar: a OS recebida fica liquidada.
// ?os=<id> (vindo da ficha de fechamento): ja marca as linhas daquela OS. ?volta= : botao Voltar.
// Valores da API do fluxo de servico em centavos.
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/os/fluxo';
  const PAG = '/financeiro/api/pagamento';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataBr = d => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const prm = new URLSearchParams(location.search);
  const OS_ID = prm.get('os') || '';
  const VOLTA = prm.get('volta') || '';

  let sit = 'aberto', linhas = [], marcadas = new Set(), primeira = true;

  async function json(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(url, op);
    if (r.status === 401) { location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  const msg = (t, ok) => { $('msg').textContent = t || ''; $('msg').classList.toggle('ok', !!ok); };

  async function carregar() {
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('ativa', b.dataset.sit === sit));
    $('painel').hidden = sit !== 'aberto';
    try {
      const j = await json('GET', API + '?situacao=' + sit);
      linhas = j.linhas || [];
      if (primeira && OS_ID) {             // veio da ficha: marca as linhas da OS
        linhas.filter(l => l.os.id === OS_ID && l.status === 'ATIVO').forEach(l => marcadas.add(String(l._id)));
      }
      primeira = false;
      for (const id of [...marcadas]) if (!linhas.some(l => String(l._id) === id)) marcadas.delete(id);
      desenhar();
    } catch (e) { $('lista').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>'; }
  }

  function desenhar() {
    const f = $('filtro').value.trim().toLowerCase();
    const vis = linhas.filter(l => !f || [l.os.cliente, l.os.numero, l.os.tecnico, l.historico].join(' ').toLowerCase().includes(f));
    const hoje = iso(new Date());
    const aberto = sit === 'aberto';
    $('lista').innerHTML = vis.length ? '<table><thead><tr>' + (aberto ? '<th></th>' : '')
      + '<th>' + (aberto ? 'Vencimento' : 'Recebido em') + '</th><th>OS</th><th>Cliente</th><th>Técnico</th><th>Histórico</th>'
      + (aberto ? '' : '<th>Boleta</th>') + '<th class="n">Valor</th></tr></thead><tbody>'
      + vis.map(l => {
          const id = String(l._id), mk = marcadas.has(id);
          return '<tr data-id="' + id + '" class="' + (mk ? 'marcada ' : '') + (aberto && iso(l.vencimento) < hoje ? 'vencida' : '') + '">'
            + (aberto ? '<td><input type="checkbox" data-mk="' + id + '"' + (mk ? ' checked' : '') + '></td>' : '')
            + '<td>' + dataBr(aberto ? l.vencimento : l.quitadoEm) + '</td>'
            + '<td><b>' + esc(l.os.numero) + '</b> ' + esc(l.os.tipo) + '</td><td>' + esc(l.os.cliente) + '</td><td>' + esc(l.os.tecnico) + '</td>'
            + '<td>' + esc(l.historico) + '</td>' + (aberto ? '' : '<td>' + esc(l.boleta) + '</td>')
            + '<td class="n"><b>' + brl(l.valor) + '</b></td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="vazio">' + (aberto ? 'Nada a receber de serviço.' : 'Nenhum recebimento.') + '</div>';
    const tot = vis.reduce((s, l) => s + l.valor, 0);
    $('rodape').textContent = vis.length + ' OS · total R$ ' + brl(tot);
    painel();
  }

  function painel() {
    const sel = linhas.filter(l => marcadas.has(String(l._id)));
    const tot = sel.reduce((s, l) => s + l.valor, 0);
    $('p-total').textContent = 'R$ ' + brl(tot);
    $('p-sel').textContent = sel.length ? sel.length + ' OS marcada(s): ' + sel.map(l => 'nº ' + l.os.numero).join(', ') : 'Marque as OS a receber na lista.';
    $('p-hist').placeholder = sel.length === 1 ? 'Recebimento OS nº ' + sel[0].os.numero + ' · ' + sel[0].os.cliente : 'Recebimento de serviço';
    $('p-receber').disabled = !sel.length;
  }

  async function bancos() {
    try {
      const r = await fetch(PAG + '/bancos', { headers: { Accept: 'application/json' } });
      const lista = await r.json();
      if (!Array.isArray(lista)) throw new Error((lista && lista.erro) || 'erro ao ler os bancos');
      $('p-banco').innerHTML = '<option value="">— escolha —</option>'
        + lista.map(b => '<option value="' + esc(b._id) + '">' + esc(b.apelido) + (b.subCodigo ? ' · ' + esc(b.subCodigo) : '') + '</option>').join('');
    } catch (e) { $('p-banco').innerHTML = '<option value="">' + esc(e.message) + '</option>'; }
  }

  async function receber() {
    const sel = linhas.filter(l => marcadas.has(String(l._id)) && l.status === 'ATIVO');
    if (!sel.length) return;
    if (!$('p-banco').value) { msg('Escolha onde o dinheiro entrou (caixa ou banco).'); $('p-banco').focus(); return; }
    if (!$('p-data').value) { msg('Informe a data do movimento.'); $('p-data').focus(); return; }
    const tot = sel.reduce((s, l) => s + l.valor, 0);
    if (!confirm('Receber R$ ' + brl(tot) + ' de ' + sel.length + ' OS?')) return;
    $('p-receber').disabled = true; msg('Gravando…', true);
    try {
      const r = await json('POST', PAG + '/quitar', {
        tipo: 'receber', data: $('p-data').value, contaBancariaId: $('p-banco').value,
        titulosIds: sel.map(l => String(l._id)), historico: $('p-hist').value.trim() || $('p-hist').placeholder,
      });
      await json('POST', API + '/sincronizar');          // a OS recebida fica liquidada
      marcadas.clear();
      await carregar();
      msg('✓ recebido · lançamento ' + (r.codigo || '') + ' · OS liquidada', true);
    } catch (e) { msg(e.message); $('p-receber').disabled = false; }
  }

  $('abas').addEventListener('click', ev => { const b = ev.target.closest('button[data-sit]'); if (b) { sit = b.dataset.sit; msg(''); carregar(); } });
  $('filtro').addEventListener('input', desenhar);
  $('lista').addEventListener('change', ev => {
    const id = ev.target.dataset && ev.target.dataset.mk; if (!id) return;
    if (ev.target.checked) marcadas.add(id); else marcadas.delete(id);
    ev.target.closest('tr').classList.toggle('marcada', ev.target.checked);
    painel();
  });
  $('p-receber').addEventListener('click', receber);
  if (VOLTA) { $('voltar').hidden = false; $('voltar').addEventListener('click', () => { location.href = VOLTA; }); }
  $('p-data').value = iso(new Date());
  bancos();
  carregar();
})();
