// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\os-modal.js
// Criado em: 13/10/2026
//
// MODAL DA ORDEM DE SERVICO, usado pela Agenda do dia (servicos.js) e pelas listas
// (servicos-lista.js). Monta o proprio HTML e CSS na primeira vez que abre.
//   OSModal.abrir(idDaOS, aoMudar)   aoMudar() e chamado quando algo foi gravado
//
// No modal:
//   - dados da OS (cliente, tecnico, dia/horario, local, telefones, o que instalar)
//   - CONSIGNADOS: buscar produto + qtd -> "levar" (baixa o estoque); "devolver" repoe
//   - TERMINO (dia e hora), VALOR FINAL do servico, observacao do servico
//   - FOTOS do servico acabado (reduzidas no navegador para 1600 px, JPEG)
//   - Gravar · Concluir servico (P -> E) · Reabrir (E -> P)
// API: /vendas/api/os   Busca de produto: /vendas/api/venda/produtos?busca=
// Dinheiro em centavos.
// Alterado em: 14/10/2026 - AGENDAMENTO na OS: tecnico (combo), dia, das/ate e a agenda do
//              tecnico ao lado (como na venda); horario passado nao vale. Botao "Agendar" ->
//              PUT /:id/agenda. Termino so depois de agendada, nunca no futuro.
//              Agenda com cabecalho (tecnico · dia) e legenda: vermelho = ocupado com OUTRO cliente.
//              Agenda na LATERAL DIREITA do modal, como na nota fiscal (padrao).
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/os/';
  const BUSCA = '/vendas/api/venda/produtos?busca=';
  const SIT = { P: 'Pendente', E: 'Concluída · a receber', L: 'Liquidada', C: 'Cancelada' };
  const TIPO = { VI: 'Venda/instalação', INSTALACAO: 'Venda/instalação', C: 'Conserto', G: 'Garantia' };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lerBrl = t => { const s = String(t || '').trim().replace(/\./g, '').replace(',', '.'); const n = Number(s); return s && Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const dataBr = d => d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '';
  const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const hora = d => { const x = new Date(d); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };

  let os = null, aoMudar = null, montado = false, buscaT = null, achados = [];
  let tecnicos = null, agOcupados = [];
  const TECNICOS = '/vendas/api/venda/tecnicos', AGENDA = '/vendas/api/venda/agenda';
  const paraMin = s => { const m = /^(\d{2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const hojeIso = () => iso(new Date());
  const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const q = id => document.getElementById('osm-' + id);

  async function api(metodo, url, corpo, tipo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) {
      op.headers['Content-Type'] = tipo || 'application/json';
      op.body = tipo ? corpo : JSON.stringify(corpo);
    }
    const r = await fetch(url, op);
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
    if (!j.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }

  function montar() {
    if (montado) return;
    montado = true;
    const css = document.createElement('style');
    css.textContent = `
      .osm-fundo { position:fixed; inset:0; background:rgba(15,23,42,.35); z-index:60; }
      .osm-caixa { position:fixed; top:3vh; left:50%; transform:translateX(-50%); z-index:61; width:min(1440px, calc(100vw - 24px));
                   max-height:94vh; display:flex; flex-direction:column; background:#fff; border-radius:12px;
                   box-shadow:0 18px 50px rgba(0,0,0,.3); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
                   font-size:14px; color:#111827; }
      .osm-fundo[hidden], .osm-caixa[hidden], .osm-caixa [hidden] { display:none !important; }
      .osm-cab { display:flex; align-items:center; gap:12px; padding:12px 20px; background:#92400e; color:#fff; border-radius:12px 12px 0 0; }
      .osm-cab h3 { margin:0; font-size:18px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .osm-sit { font-size:12px; font-weight:700; padding:3px 10px; border-radius:12px; background:#fef3c7; color:#92400e; }
      .osm-sit.E { background:#d1fae5; color:#065f46; } .osm-sit.L { background:#e0e7ff; color:#3730a3; } .osm-sit.C { background:#fee2e2; color:#991b1b; }
      .osm-x { border:0; background:none; color:#fff; font-size:24px; cursor:pointer; line-height:1; }
      .osm-corpo { overflow:auto; padding:14px 20px; display:grid; grid-template-columns:minmax(0, 5fr) minmax(0, 6fr) 260px; gap:18px; align-items:start; }
      .osm-agenda { position:sticky; top:0; }
      .osm-sec { font-size:12px; font-weight:800; text-transform:uppercase; color:#6b21a8; margin:4px 0 6px; }
      .osm-det { display:grid; grid-template-columns:100px minmax(0,1fr); gap:4px 10px; margin-bottom:10px; }
      .osm-det span { font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; padding-top:2px; }
      .osm-det ul { margin:0; padding-left:18px; }
      .osm-linha { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:10px; }
      .osm-caixa label { display:flex; flex-direction:column; gap:3px; font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; }
      .osm-caixa input, .osm-caixa textarea { font:inherit; font-size:14px; padding:7px 9px; border:1px solid #d1d5db; border-radius:8px;
                   background:#fff; text-transform:none; font-weight:400; color:#111827; }
      .osm-caixa input:placeholder-shown, .osm-caixa textarea:placeholder-shown { background:#fffbeb; }
      .osm-caixa input:disabled, .osm-caixa textarea:disabled { background:#f3f4f6; color:#374151; }
      .osm-caixa textarea { resize:vertical; min-height:52px; }
      .osm-linha input, .osm-caixa textarea, .osm-busca input { width:100%; min-width:0; }
      .osm-num { text-align:right; }
      .osm-busca { position:relative; display:grid; grid-template-columns:minmax(0,1fr) 80px auto; gap:8px; margin-bottom:8px; }
      .osm-res { position:absolute; top:40px; left:0; right:0; z-index:5; background:#fff; border:1px solid #d1d5db; border-radius:8px;
                 box-shadow:0 8px 24px rgba(0,0,0,.15); max-height:260px; overflow:auto; }
      .osm-res div { display:grid; grid-template-columns:60px minmax(0,1fr) 60px 90px; gap:8px; padding:6px 10px; cursor:pointer; }
      .osm-res div:nth-child(even) { background:#f9fafb; }
      .osm-res div.sel, .osm-res div:hover { background:#ede9fe; }
      .osm-res .n { text-align:right; font-variant-numeric:tabular-nums; }
      .osm-tab { width:100%; border-collapse:collapse; font-size:13px; }
      .osm-tab th { text-align:left; font-size:11px; text-transform:uppercase; color:#374151; background:#f3f4f6; padding:6px 8px; }
      .osm-tab td { padding:6px 8px; border-top:1px solid #f3f4f6; vertical-align:middle; }
      .osm-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .osm-tab tfoot td { font-weight:800; border-top:2px solid #e5e7eb; }
      .osm-dev { display:flex; gap:4px; justify-content:flex-end; }
      .osm-dev input { width:54px; padding:4px 6px; text-align:right; }
      .osm-btn { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:7px 12px; font-weight:700; cursor:pointer; font-size:13px; }
      .osm-btn.mini { padding:3px 8px; font-size:12px; }
      .osm-btn.roxo { background:#6b21a8; border-color:#6b21a8; color:#fff; }
      .osm-btn.verde { background:#059669; border-color:#059669; color:#fff; }
      .osm-btn:disabled { opacity:.5; cursor:not-allowed; }
      .osm-fotos { display:flex; flex-wrap:wrap; gap:8px; }
      .osm-foto { position:relative; width:110px; height:82px; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; background:#f3f4f6; }
      .osm-foto img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
      .osm-foto button { position:absolute; top:2px; right:2px; border:0; border-radius:50%; width:22px; height:22px; background:rgba(0,0,0,.6);
                         color:#fff; cursor:pointer; font-size:14px; line-height:1; }
      .osm-add { width:110px; height:82px; border:2px dashed #c4b5fd; border-radius:8px; display:flex; align-items:center; justify-content:center;
                 color:#6b21a8; font-weight:700; cursor:pointer; text-align:center; font-size:13px; }
      .osm-vazio { color:#6b7280; font-size:13px; padding:6px 0; }
      .osm-rod { display:flex; align-items:center; gap:10px; padding:12px 20px; border-top:1px solid #e5e7eb; }
      .osm-rod .msg { flex:1; font-size:13px; font-weight:600; color:#dc2626; }
      .osm-rod .msg.ok { color:#059669; }
      .osm-total { display:flex; justify-content:space-between; font-weight:800; font-size:15px; padding:8px 10px; background:#f5f3ff;
                   border-radius:8px; margin-top:8px; color:#4c1d95; }
      .osm-ag { margin-bottom:12px; }
      .osm-linha2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .osm-ag-form input { width:100%; min-width:0; }
      .osm-ag-form { display:flex; flex-direction:column; gap:8px; }
      .osm-ag-form select { font:inherit; font-size:14px; padding:7px 9px; border:1px solid #d1d5db; border-radius:8px; background:#fff; width:100%; }
      .osm-ag-lista { border:1px solid #e5e7eb; border-radius:8px; max-height:calc(94vh - 160px); overflow-y:auto; font-size:13px; }
      .osm-ag-lista .vz { padding:10px; color:#6b7280; }
      .osm-ag-cab { position:sticky; top:0; z-index:1; background:#92400e; color:#fff; font-weight:700; padding:5px 8px; font-size:12px; }
      .osm-ag-cab small { display:block; font-weight:400; font-size:11px; color:#fde68a; }
      .osm-ag-cab b.oc { color:#fca5a5; } .osm-ag-cab b.es { color:#86efac; }
      .osm-ag-lin { display:grid; grid-template-columns:52px minmax(0,1fr); border-top:1px solid #f3f4f6; }
      .osm-ag-lin span { padding:4px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .osm-ag-lin .h { font-weight:700; background:#f8fafc; overflow:visible; text-overflow:clip; }
      .osm-ag-lin.livre { cursor:pointer; } .osm-ag-lin.livre:hover { background:#fef3c7; }
      .osm-ag-lin.ocupado { background:#fef2f2; color:#dc2626; cursor:not-allowed; }
      .osm-ag-lin.passado { color:#9ca3af; cursor:not-allowed; }
      .osm-ag-lin.escolhido { background:#dcfce7; color:#065f46; font-weight:700; }
      .osm-dica { font-size:11px; color:#6b7280; }
      @media (max-width: 1100px) { .osm-corpo { grid-template-columns:minmax(0,1fr) 240px; } .osm-corpo > div:nth-child(2) { grid-column:1; } .osm-agenda { grid-row:1 / span 2; grid-column:2; } }
      @media (max-width: 760px) { .osm-corpo { grid-template-columns:1fr; } .osm-agenda { grid-row:auto; grid-column:auto; } }
    `;
    document.head.appendChild(css);

    const d = document.createElement('div');
    d.innerHTML = `
      <div class="osm-fundo" id="osm-fundo" hidden></div>
      <div class="osm-caixa" id="osm-caixa" hidden role="dialog">
        <div class="osm-cab"><h3 id="osm-tit">OS</h3><span class="osm-sit" id="osm-sit"></span>
          <button type="button" class="osm-x" id="osm-x" title="fechar (Esc)">×</button></div>
        <div class="osm-corpo">
          <div>
            <div class="osm-sec">Agendamento</div>
            <div class="osm-ag">
              <div class="osm-ag-form">
                <label>Técnico<select id="osm-tec"></select></label>
                <label>Dia<input type="date" id="osm-adia"></label>
                <div class="osm-linha2">
                  <label>Das<input type="time" id="osm-ahi"></label>
                  <label>Até<input type="time" id="osm-ahf"></label>
                </div>
                <button type="button" class="osm-btn roxo" id="osm-agendar">Agendar</button>
                <div class="osm-dica">Agenda do técnico na lateral direita · 1º clique: início · 2º clique: até o fim dessa linha.</div>
              </div>
            </div>
            <div class="osm-sec">Serviço</div>
            <div class="osm-det" id="osm-det"></div>
            <div class="osm-sec">Término e valor final</div>
            <div class="osm-linha">
              <label>Dia do término<input type="date" id="osm-tdia"></label>
              <label>Hora<input type="time" id="osm-thora"></label>
              <label>Valor do serviço<input id="osm-valor" class="osm-num" inputmode="decimal" placeholder="0,00"></label>
            </div>
            <label>Observação do serviço<textarea id="osm-obs" placeholder=" " maxlength="2000"></textarea></label>
          </div>
          <div>
            <div class="osm-sec">Consignados (o técnico leva)</div>
            <div class="osm-busca" id="osm-busca-l">
              <input id="osm-busca" placeholder="código, descrição ou referência" autocomplete="off">
              <input id="osm-qtd" class="osm-num" value="1" inputmode="numeric" title="quantidade">
              <button type="button" class="osm-btn roxo" id="osm-levar">+ levar</button>
              <div class="osm-res" id="osm-res" hidden></div>
            </div>
            <table class="osm-tab">
              <thead><tr><th>Código</th><th>Descrição</th><th class="n">Saiu</th><th class="n">Voltou</th><th class="n">Usado</th>
                <th class="n">Unit.</th><th class="n">Total</th><th class="n">Devolver</th></tr></thead>
              <tbody id="osm-cons"></tbody>
              <tfoot><tr><td colspan="6">Consignado usado</td><td class="n" id="osm-tcons">0,00</td><td></td></tr></tfoot>
            </table>
            <div class="osm-total"><span>Serviço + consignado usado</span><span id="osm-tgeral">R$ 0,00</span></div>
            <div class="osm-sec" style="margin-top:14px">Fotos do serviço acabado</div>
            <div class="osm-fotos" id="osm-fotos"></div>
            <input type="file" id="osm-arq" accept="image/*" multiple hidden>
          </div>
          <aside class="osm-agenda"><div class="osm-ag-lista" id="osm-ag"><div class="vz">Escolha o técnico e o dia.</div></div></aside>
        </div>
        <div class="osm-rod">
          <span class="msg" id="osm-msg"></span>
          <button type="button" class="osm-btn" id="osm-reabrir">Reabrir</button>
          <button type="button" class="osm-btn verde" id="osm-concluir">Concluir serviço</button>
          <button type="button" class="osm-btn roxo" id="osm-gravar">Gravar</button>
          <button type="button" class="osm-btn" id="osm-fechar">Fechar</button>
        </div>
      </div>`;
    document.body.appendChild(d);

    q('x').addEventListener('click', fechar);
    q('fechar').addEventListener('click', fechar);
    q('fundo').addEventListener('click', fechar);
    q('gravar').addEventListener('click', () => gravar(true));
    q('concluir').addEventListener('click', concluir);
    q('reabrir').addEventListener('click', reabrir);
    q('levar').addEventListener('click', levar);
    q('busca').addEventListener('input', () => { clearTimeout(buscaT); buscaT = setTimeout(buscar, 250); });
    q('busca').addEventListener('keydown', ev => {
      const linhas = [...q('res').children];
      const k = linhas.findIndex(l => l.classList.contains('sel'));
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!linhas.length) return;
        const n = ev.key === 'ArrowDown' ? Math.min(k + 1, linhas.length - 1) : Math.max(k - 1, 0);
        linhas.forEach((l, i) => l.classList.toggle('sel', i === n));
        linhas[n].scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const l = linhas[k >= 0 ? k : 0];
        if (l) escolher(+l.dataset.i);
      } else if (ev.key === 'Escape') { q('res').hidden = true; ev.stopPropagation(); }
    });
    q('res').addEventListener('click', ev => { const l = ev.target.closest('[data-i]'); if (l) escolher(+l.dataset.i); });
    q('qtd').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); levar(); } });
    q('valor').addEventListener('input', totais);
    q('valor').addEventListener('blur', () => { if (q('valor').value.trim()) q('valor').value = brl(lerBrl(q('valor').value)); });
    q('cons').addEventListener('click', ev => {
      const b = ev.target.closest('[data-dev]');
      if (b) devolver(b.dataset.dev);
    });
    q('cons').addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.dataset.devq) { ev.preventDefault(); devolver(ev.target.dataset.devq); }
    });
    q('fotos').addEventListener('click', ev => {
      if (ev.target.closest('.osm-add')) { q('arq').click(); return; }
      const rem = ev.target.closest('[data-rem]');
      if (rem) { removerFoto(rem.dataset.rem); return; }
      const img = ev.target.closest('img[data-arq]');
      if (img) window.open(img.src, '_blank');
    });
    q('arq').addEventListener('change', enviarFotos);
    q('tec').addEventListener('change', agCarregar);
    q('adia').addEventListener('change', agCarregar);
    ['ahi', 'ahf'].forEach(id => q(id).addEventListener('input', agDesenhar));
    q('ag').addEventListener('click', ev => {
      const l = ev.target.closest('.osm-ag-lin.livre'); if (!l) return;
      const m = Number(l.dataset.m), ini = paraMin(q('ahi').value), fim = paraMin(q('ahf').value);
      if (ini === null || m + 30 <= ini || (fim !== null && m < ini)) { q('ahi').value = hm(m); q('ahf').value = ''; }
      else q('ahf').value = hm(m + 30);
      agDesenhar();
    });
    q('agendar').addEventListener('click', agendar);
    ['tec', 'adia', 'ahi', 'ahf'].forEach((id, k, ordem) => q(id).addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (k < ordem.length - 1) q(ordem[k + 1]).focus(); else agendar();
    }));
    // Enter anda de campo em campo na coluna da esquerda
    ['tdia', 'thora', 'valor'].forEach((id, k, ordem) => q(id).addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (k < ordem.length - 1) q(ordem[k + 1]).focus(); else q('obs').focus();
    }));
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !q('caixa').hidden) fechar(); });
  }

  const msg = (t, ok) => { q('msg').textContent = t || ''; q('msg').classList.toggle('ok', !!ok); };
  const podeEditar = () => os && (os.status === 'P' || os.status === 'E');

  function desenhar() {
    const o = os, e = o.endereco || {}, cli = o.cliente || {};
    q('tit').textContent = 'OS nº ' + o.numero + (TIPO[o.tipo] ? ' · ' + TIPO[o.tipo] : '') + ' · ' + (cli.nome || '');
    q('sit').textContent = SIT[o.status] || o.status;
    q('sit').className = 'osm-sit ' + o.status;
    const linha = (rot, v) => v ? '<span>' + rot + '</span><div>' + v + '</div>' : '';
    const end = [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.bairro,
                 [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
    const itens = (o.itens || []).length
      ? '<ul>' + o.itens.map(i => '<li>' + esc(i.servico || 'Instalação') + ' — ' + esc(i.codigo) + ' ' + esc(i.descricao)
          + (i.observacao ? ' <i>(' + esc(i.observacao) + ')</i>' : '') + '</li>').join('') + '</ul>' : '';
    q('det').innerHTML =
        linha('Cliente', esc((cli.codigo ? cli.codigo + ' · ' : '') + (cli.nome || '')))
      + linha('Local', esc(end))
      + linha('Edifício', esc([o.edificio, o.apto ? 'apto ' + o.apto : ''].filter(Boolean).join(' · ')))
      + linha('Referência', esc(o.pontoReferencia))
      + linha('Telefones', esc([o.telefone, o.celular].filter(Boolean).join(' · ')))
      + linha('Instalar', itens)
      + linha('Observação', esc(o.observacao))
      + linha('Venda', o.venda ? 'nº ' + esc(o.venda.numero) : '');

    // agendamento
    const agEd = o.status === 'P';
    q('tec').innerHTML = '<option value="">a definir</option>' + (tecnicos || []).map(t =>
      '<option value="' + esc(t.conta) + '">' + esc(t.nome) + ' · ' + esc(t.conta) + '</option>').join('')
      + (o.tecnicoConta && !(tecnicos || []).some(t => t.conta === o.tecnicoConta)
         ? '<option value="' + esc(o.tecnicoConta) + '">' + esc(o.tecnicoNome || o.tecnicoConta) + ' (inativo)</option>' : '');
    q('tec').value = o.tecnicoConta || '';
    q('adia').value = o.diaPrevisto || '';
    q('adia').min = hojeIso();
    // sem dia reservado: horario limpo (so vale hora com dia)
    q('ahi').value = o.diaPrevisto ? o.horaIni || '' : ''; q('ahf').value = o.diaPrevisto ? o.horaFim || '' : '';
    ['tec', 'adia', 'ahi', 'ahf'].forEach(id => { q(id).disabled = !agEd; });
    q('agendar').hidden = !agEd;
    agCarregar();

    q('tdia').value = o.terminoEm ? iso(o.terminoEm) : '';
    q('tdia').max = hojeIso();
    q('thora').value = o.terminoEm ? hora(o.terminoEm) : '';
    q('valor').value = o.valorServico ? brl(o.valorServico) : '';
    q('valor').title = o.servicoContabilizado
      ? 'cobrado na venda ' + (o.venda ? o.venda.numero : '') + ' · técnico R$ ' + brl(o.parteTecnico) + ' · loja R$ ' + brl(o.parteLoja) : '';
    q('obs').value = o.observacaoServico || '';

    const ed = podeEditar();
    ['tdia', 'thora', 'valor', 'obs'].forEach(id => { q(id).disabled = !ed; });
    if (o.servicoContabilizado) q('valor').disabled = true;     // VI: ja cobrado e lancado na venda
    const agendada = !!(o.tecnicoConta && o.diaPrevisto);
    if (!agendada) { q('tdia').disabled = true; q('thora').disabled = true; }
    q('tdia').title = agendada ? '' : 'agende a OS (técnico e dia) antes de informar o término';
    q('busca-l').hidden = !ed;
    q('gravar').hidden = !ed;
    q('concluir').hidden = o.status !== 'P';
    q('reabrir').hidden = o.status !== 'E';

    q('cons').innerHTML = (o.consignados || []).length ? o.consignados.map(c => {
      const resta = c.quantidade - c.devolvido;
      return '<tr><td>' + esc(c.codigo) + '</td><td>' + esc(c.descricao) + '</td>'
        + '<td class="n">' + c.quantidade + '</td><td class="n">' + c.devolvido + '</td><td class="n"><b>' + c.usado + '</b></td>'
        + '<td class="n">' + brl(c.precoUnit) + '</td><td class="n">' + brl(c.total) + '</td>'
        + '<td class="n">' + (ed && resta > 0
            ? '<span class="osm-dev"><input data-devq="' + c.id + '" id="osm-dq-' + c.id + '" value="' + resta + '" inputmode="numeric" title="quantas voltaram">'
              + '<button type="button" class="osm-btn mini" data-dev="' + c.id + '" title="voltou para a loja: repõe o estoque">↩</button></span>'
            : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="osm-vazio">Nenhum material consignado.</td></tr>';

    q('fotos').innerHTML = (o.fotos || []).map(f =>
      '<div class="osm-foto"><img data-arq="' + esc(f.arquivo) + '" src="' + API + o.id + '/fotos/' + encodeURIComponent(f.arquivo)
      + '" alt="foto" loading="lazy" title="clique para ampliar">'
      + (ed ? '<button type="button" data-rem="' + esc(f.arquivo) + '" title="remover a foto">×</button>' : '') + '</div>').join('')
      + (ed ? '<div class="osm-add" title="tirar ou escolher foto">＋ foto</div>' : '')
      || '<div class="osm-vazio">Sem fotos.</div>';
    totais();
  }

  function totais() {
    if (!os) return;
    const cons = (os.consignados || []).reduce((t, c) => t + c.total, 0);
    const serv = q('valor').disabled ? os.valorServico : lerBrl(q('valor').value);
    q('tcons').textContent = brl(cons);
    q('tgeral').textContent = 'R$ ' + brl(serv + cons);
  }

  async function abrir(id, cb) {
    montar();
    aoMudar = cb || null;
    msg('Carregando…', true);
    q('fundo').hidden = false; q('caixa').hidden = false;
    q('busca').value = ''; q('res').hidden = true; q('qtd').value = '1';
    try {
      if (!tecnicos) tecnicos = (await api('GET', TECNICOS)).tecnicos || [];
      os = (await api('GET', API + id)).os;
      msg('');
      desenhar();
    } catch (e) { msg(e.message); }
  }
  function fechar() { q('fundo').hidden = true; q('caixa').hidden = true; q('res').hidden = true; os = null; }
  function mudou(novo, texto) { os = novo; desenhar(); msg(texto, true); if (aoMudar) aoMudar(); }

  async function gravar(avisar) {
    if (!podeEditar()) return true;
    const dia = q('tdia').value, h = q('thora').value;
    if (h && !dia) { msg('Informe o dia do término.'); q('tdia').focus(); return false; }
    try {
      const r = await api('PUT', API + os.id, { terminoDia: dia, terminoHora: h,
        valorServico: lerBrl(q('valor').value), observacaoServico: q('obs').value });
      mudou(r.os, avisar ? '✓ gravado' : '');
      return true;
    } catch (e) { msg(e.message); return false; }
  }

  async function concluir() {
    if (!q('tdia').value) { msg('Informe o dia do término para concluir.'); q('tdia').focus(); return; }
    const resta = (os.consignados || []).reduce((t, c) => t + c.quantidade - c.devolvido, 0);
    const pergunta = 'Concluir a OS nº ' + os.numero + '?'
      + (resta ? '\n\n' + resta + ' unidade(s) de consignado ficam como USADAS (não voltaram).' : '')
      + '\nValor do serviço: R$ ' + brl(lerBrl(q('valor').value));
    if (!confirm(pergunta)) return;
    if (!(await gravar(false))) return;
    try { mudou((await api('POST', API + os.id + '/concluir')).os, '✓ serviço concluído: vai para o recebimento'); }
    catch (e) { msg(e.message); }
  }
  async function reabrir() {
    if (!confirm('Reabrir a OS nº ' + os.numero + '? Ela volta para pendente.')) return;
    try { mudou((await api('POST', API + os.id + '/reabrir')).os, '✓ reaberta'); } catch (e) { msg(e.message); }
  }

  // ---- agendamento (agenda do tecnico, como na venda) ----
  async function agCarregar() {
    agOcupados = [];
    const tec = q('tec').value, dia = q('adia').value;
    if (!tec) { q('ag').innerHTML = '<div class="osm-ag-cab">Agenda do técnico</div><div class="vz">Escolha o técnico para ver a agenda dele.</div>'; return; }
    if (!dia) { q('ag').innerHTML = '<div class="osm-ag-cab">Agenda de ' + esc(((q('tec').selectedOptions[0] || {}).textContent || '').split(' · ')[0]) + '</div><div class="vz">Marque o dia para ver os horários.</div>'; return; }
    q('ag').innerHTML = '<div class="vz">Carregando…</div>';
    try {
      const r = await api('GET', AGENDA + '?tecnico=' + encodeURIComponent(tec) + '&dia=' + dia + '&os=' + os.id
        + (os.venda && os.venda.id ? '&venda=' + os.venda.id : ''));
      agOcupados = (r.ocupados || []).map(x => ({ ini: paraMin(x.horaIni), fim: x.horaFim ? paraMin(x.horaFim) : paraMin(x.horaIni) + 30,
                                                   cliente: x.cliente, texto: x.texto }));
    } catch (e) { msg(e.message); }
    agDesenhar();
  }
  function agDesenhar() {
    if (!q('tec').value || !q('adia').value) return;
    const ini = paraMin(q('ahi').value), fim = paraMin(q('ahf').value);
    const fimEf = ini === null ? null : (fim !== null && fim > ini ? fim : ini + 1);
    const ehHoje = q('adia').value === hojeIso(), agora = agoraMin(), nome = (os.cliente && os.cliente.nome) || 'esta OS';
    const tecNome = (q('tec').selectedOptions[0] || {}).textContent || '';
    let h = '<div class="osm-ag-cab">Agenda de ' + esc(tecNome.split(' · ')[0]) + ' · ' + dataBr(q('adia').value)
      + '<small><b class="oc">■</b> ocupado com outro cliente · <b class="es">■</b> ' + esc(nome) + '</small></div>';
    for (let m = 7 * 60; m < 19 * 60; m += 30) {
      const oc = agOcupados.find(o => m >= o.ini && m < o.fim);
      const es = ini !== null && m + 30 > ini && m < fimEf;
      const passou = ehHoje && m + 30 <= agora;
      const cls = oc ? 'ocupado' : es ? 'escolhido livre' : passou ? 'passado' : 'livre';
      h += '<div class="osm-ag-lin ' + cls + '" data-m="' + m + '"' + (oc ? ' title="' + esc(oc.texto) + '"' : '') + '><span class="h">' + hm(m)
        + '</span><span>' + (oc ? 'ocupado · ' + esc(oc.cliente) : es ? '✓ ' + esc(nome) : passou ? 'passou' : '') + '</span></div>';
    }
    q('ag').innerHTML = h;
  }
  async function agendar() {
    const dia = q('adia').value, hi = q('ahi').value, hf = q('ahf').value;
    if ((hi || hf) && !dia) { msg('Marque o dia antes do horário.'); q('adia').focus(); return; }
    if (hi && !hf) { msg('Informe o horário ATÉ.'); q('ahf').focus(); return; }
    if (dia && dia < hojeIso()) { msg('Esse dia já passou.'); q('adia').focus(); return; }
    if (dia === hojeIso() && hi && paraMin(hi) < agoraMin()) { msg('Esse horário de hoje já passou (agora são ' + hm(agoraMin()) + ').'); q('ahi').focus(); return; }
    const ini = paraMin(hi), fim = paraMin(hf);
    if (ini !== null && agOcupados.some(o => ini < o.fim && fim > o.ini)) { msg('Esse horário bate com outro cliente do técnico.'); return; }
    const trocou = (os.tecnicoConta || '') !== q('tec').value;
    if (trocou && os.servicoContabilizado && os.parteTecnico > 0 && !confirm('A mão de obra desta OS já foi lançada para '
        + (os.tecnicoNome || os.tecnicoConta) + ' (R$ ' + brl(os.parteTecnico) + ').\nTrocar de técnico passa esse valor para o novo técnico (lançamento automático). Continuar?')) return;
    q('agendar').disabled = true;
    try {
      const r = await api('PUT', API + os.id + '/agenda', { tecnicoConta: q('tec').value, dia, horaIni: hi, horaFim: hf });
      mudou(r.os, '✓ agendada' + (r.os.tecnicoNome ? ' · ' + r.os.tecnicoNome : '') + (dia ? ' · ' + dataBr(dia) : '') + (hi ? ' ' + hi + '–' + hf : ''));
    } catch (e) { msg(e.message); } finally { q('agendar').disabled = false; }
  }

  // ---- consignados ----
  async function buscar() {
    const t = q('busca').value.trim();
    if (t.length < 2 && !/^\d+$/.test(t)) { q('res').hidden = true; achados = []; return; }
    try {
      achados = (await api('GET', BUSCA + encodeURIComponent(t))).produtos || [];
      q('res').innerHTML = achados.length ? achados.map((p, i) =>
        '<div data-i="' + i + '"' + (i === 0 ? ' class="sel"' : '') + '><span>' + esc(p.codigo) + '</span><span>' + esc(p.descricao)
        + (p.referencia ? ' <small>· ' + esc(p.referencia) + '</small>' : '') + '</span>'
        + '<span class="n" title="estoque">' + esc(p.estoque) + '</span><span class="n">' + brl(p.precoVista) + '</span></div>').join('')
        : '<div><span></span><span>nada encontrado</span></div>';
      q('res').hidden = false;
    } catch (e) { msg(e.message); }
  }
  function escolher(i) {
    const p = achados[i]; if (!p) return;
    q('busca').value = p.codigo + ' · ' + p.descricao;
    q('busca').dataset.cod = p.codigo;
    q('res').hidden = true;
    q('qtd').focus(); q('qtd').select();
  }
  async function levar() {
    let cod = Number(q('busca').dataset.cod);
    const t = q('busca').value.trim();
    if (!cod || !t.startsWith(cod + ' · ')) cod = /^\d+$/.test(t) ? Number(t) : 0;
    const qtd = Number(q('qtd').value);
    if (!cod) { msg('Escolha o produto na lista.'); q('busca').focus(); return; }
    if (!Number.isInteger(qtd) || qtd <= 0) { msg('Quantidade inteira, maior que zero.'); q('qtd').focus(); return; }
    q('levar').disabled = true;
    try {
      const r = await api('POST', API + os.id + '/consignados', { codigo: cod, quantidade: qtd });
      q('busca').value = ''; delete q('busca').dataset.cod; q('qtd').value = '1';
      mudou(r.os, '✓ ' + qtd + ' un. do ' + cod + ' com o técnico (estoque baixado)');
      q('busca').focus();
    } catch (e) { msg(e.message); } finally { q('levar').disabled = false; }
  }
  async function devolver(cid) {
    const campo = document.getElementById('osm-dq-' + cid);
    const qtd = Number(campo && campo.value);
    if (!Number.isInteger(qtd) || qtd <= 0) { msg('Quantidade a devolver: inteira, maior que zero.'); if (campo) campo.focus(); return; }
    try { mudou((await api('POST', API + os.id + '/consignados/' + cid + '/devolver', { quantidade: qtd })).os, '✓ ' + qtd + ' un. de volta ao estoque'); }
    catch (e) { msg(e.message); }
  }

  // ---- fotos ----
  function reduzir(arquivo) {
    return new Promise((ok, falha) => {
      const img = new Image();
      const url = URL.createObjectURL(arquivo);
      img.onload = () => {
        const lado = 1600, k = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? ok(b) : falha(new Error('não consegui ler a imagem'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('arquivo não é uma imagem: ' + arquivo.name)); };
      img.src = url;
    });
  }
  async function enviarFotos() {
    const arqs = [...q('arq').files];
    q('arq').value = '';
    for (const [k, a] of arqs.entries()) {
      msg('Enviando foto ' + (k + 1) + ' de ' + arqs.length + '…', true);
      try { mudou((await api('POST', API + os.id + '/fotos', await reduzir(a), 'image/jpeg')).os, ''); }
      catch (e) { msg(e.message); return; }
    }
    msg(arqs.length ? '✓ foto(s) gravada(s)' : '', true);
  }
  async function removerFoto(arq) {
    if (!confirm('Remover esta foto da OS?')) return;
    try { mudou((await api('POST', API + os.id + '/fotos/' + encodeURIComponent(arq) + '/remover')).os, '✓ foto removida'); }
    catch (e) { msg(e.message); }
  }

  window.OSModal = { abrir };
})();
