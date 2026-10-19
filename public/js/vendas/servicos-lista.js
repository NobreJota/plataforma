// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos-lista.js
// Criado em: 13/10/2026
//
// SERVICO > listas da OS (views\vendas\pages\servicos-lista.handlebars)
// Abas: programadas · nprogramadas · pendentes · liquidadas
// Alterado em: 17/10/2026 - saiu a aba CONCLUIDAS: a OS concluida ja e "liquidada" (o a receber fica
//              no fluxo de servico). Na aba Liquidadas, a que ainda nao foi recebida leva "a receber".
// O tipo fica na URL (?tipo=). Clique na linha abre o modal da OS (os-modal.js).
// Pendente com dia previsto ja passado fica marcada em vermelho (atrasada).
// Alterado em: 15/10/2026 - volta da ficha de fechamento sem gravar: o modal reabre (?os=) e a
//              lista recarrega quando ele grava algo (evento os-mudou)
// Alterado em: 16/10/2026 - HORA VENCIDA: pendente cujo dia ja passou, ou de hoje com o horario
//              (ate) ja passado, fica com o cliente em amarelo e a situacao "hora vencida".
// Alterado em: 16/10/2026 - ORDENAR: clique no titulo Cliente, Dia ou Tecnico ordena (de novo: inverte).
//              Sem dia / sem tecnico vao para o fim.
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/os/lista?tipo=';
  const TIPOS = ['geral', 'programadas', 'nprogramadas', 'pendentes', 'liquidadas'];
  // situacao na lista geral
  const situacao = o => o.status === 'E' ? '<span class="sit e">concluída · a receber</span>'
    : o.programada ? '<span class="sit p">programada</span>' : '<span class="sit n">não programada</span>';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataBr = d => d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '';
  const dataDe = d => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  const sem = (t) => '<span class="falta">' + t + '</span>';
  const hojeIso = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();

  // pendente com o dia (ou, hoje, o horario ATE) ja passado
  const agoraHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const vencida = o => o.status === 'P' && !!o.diaPrevisto
    && (o.diaPrevisto < hojeIso || (o.diaPrevisto === hojeIso && !!(o.horaFim || o.horaIni) && (o.horaFim || o.horaIni) < agoraHM()));
  const tagVencida = '<span class="sit v" title="o horário marcado já passou e a OS não foi fechada">hora vencida</span>';

  // ordenacao pelo clique no titulo da coluna
  let ord = { campo: '', dir: 1 };
  const CHAVE = {
    cliente: o => (o.cliente && o.cliente.nome || '').toLowerCase(),
    dia: o => o.diaPrevisto ? o.diaPrevisto + ' ' + (o.horaIni || '99:99') : '',
    tecnico: o => (o.tecnicoNome || '').toLowerCase(),
  };
  function ordenar(v) {
    if (!ord.campo) return v;
    const k = CHAVE[ord.campo];
    return v.slice().sort((a, b) => {
      const x = k(a), y = k(b);
      if (!x && y) return 1; if (x && !y) return -1;               // vazio sempre no fim
      return x.localeCompare(y, 'pt-BR') * ord.dir
        || CHAVE.dia(a).localeCompare(CHAVE.dia(b));                // empate: pelo dia
    });
  }
  const th = (campo, rot) => '<th class="ord' + (ord.campo === campo ? ' ativa' : '') + '" data-ord="' + campo + '" title="clique para ordenar">'
    + rot + (ord.campo === campo ? (ord.dir > 0 ? ' ▲' : ' ▼') : ' ↕') + '</th>';

  let tipo = new URLSearchParams(location.search).get('tipo');
  if (tipo === 'concluidas') tipo = 'liquidadas';     // 17/10/2026: aba Concluidas saiu (link antigo)
  if (!TIPOS.includes(tipo)) tipo = 'pendentes';
  let lista = [];

  async function carregar() {
    history.replaceState(null, '', location.pathname + '?tipo=' + tipo);
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('ativa', b.dataset.tipo === tipo));
    try {
      const r = await fetch(API + tipo, { headers: { Accept: 'application/json' } });
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
      if (!j.ok) throw new Error(j.erro || 'erro ao ler as OS');
      lista = j.os || [];
      TIPOS.forEach(t => { $('n-' + t).textContent = (j.contagem || {})[t] || 0; });
      desenhar();
    } catch (e) {
      lista = [];
      $('lista').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>';
    }
  }

  function texto(o) {
    const e = o.endereco || {};
    return [o.numero, o.venda && o.venda.numero, o.cliente && o.cliente.nome, o.cliente && o.cliente.codigo,
            o.tecnicoNome, e.bairro, e.cidade, o.edificio].join(' ').toLowerCase();
  }

  function desenhar() {
    const f = $('filtro').value.trim().toLowerCase();
    const vis = ordenar(f ? lista.filter(o => texto(o).includes(f)) : lista);
    const feita = tipo === 'concluidas' || tipo === 'liquidadas';
    if (!vis.length) {
      $('lista').innerHTML = '<div class="vazio">' + (lista.length ? 'Nada com esse filtro.' : 'Nenhuma OS nesta aba.') + '</div>';
      $('rodape').textContent = '';
      return;
    }
    if (tipo === 'geral') { desenharGeral(vis); return; }
    let h = '<table><thead><tr><th>OS</th>' + th('cliente', 'Cliente') + th('tecnico', 'Técnico') + th('dia', 'Dia previsto') + '<th>Horário</th><th>Bairro</th><th>Venda</th>'
      + (feita ? '<th>Término</th><th class="n">Serviço</th><th class="n">Consignado</th><th class="n">Total</th>'
               : '<th class="n">Consignado</th>')
      + '</tr></thead><tbody>';
    let soma = 0;
    vis.forEach(o => {
      const i = lista.indexOf(o);
      const atrasada = vencida(o);
      const total = (o.valorServico || 0) + (o.totalConsignado || 0);
      soma += total;
      h += '<tr data-i="' + i + '"' + (atrasada ? ' class="atrasada vencida" title="hora vencida: o horário marcado já passou"' : '') + '>'
        + '<td><b>' + esc(o.numero) + '</b>' + (atrasada ? ' ' + tagVencida : '') + (o.status === 'E' ? ' <span class="sit e">a receber</span>' : '') + '</td>'
        + '<td class="quebra">' + esc(o.cliente && o.cliente.nome) + '</td>'
        + '<td>' + (o.tecnicoNome ? esc(o.tecnicoNome) : sem('a definir')) + '</td>'
        + '<td>' + (o.diaPrevisto ? dataBr(o.diaPrevisto) : sem('sem dia')) + '</td>'
        + '<td>' + (o.horaIni ? esc(o.horaIni + (o.horaFim ? '–' + o.horaFim : '')) : sem('sem hora')) + '</td>'
        + '<td>' + esc((o.endereco || {}).bairro) + '</td>'
        + '<td>' + esc(o.venda ? o.venda.numero : '') + '</td>'
        + (feita ? '<td>' + dataDe(o.terminoEm) + '</td><td class="n">' + brl(o.valorServico) + '</td>'
                   + '<td class="n">' + brl(o.totalConsignado) + '</td><td class="n"><b>' + brl(total) + '</b></td>'
                 : '<td class="n">' + (o.totalConsignado ? brl(o.totalConsignado) : '') + '</td>')
        + '</tr>';
    });
    $('lista').innerHTML = h + '</tbody></table>';
    $('rodape').textContent = vis.length + ' OS' + (feita ? ' · total R$ ' + brl(soma) : '');
  }

  // LISTA GERAL (14/10/2026): todas as OS em aberto, A-Z pelo cliente, com dia e hora marcados
  function desenharGeral(vis) {
    let h = '<table><thead><tr>' + th('cliente', 'Cliente') + th('dia', 'Dia') + '<th>Horário</th>' + th('tecnico', 'Técnico') + '<th>Situação</th>'
      + '<th>Serviço</th><th>Bairro</th><th>OS</th><th>Venda</th></tr></thead><tbody>';
    const n = { p: 0, n: 0, e: 0 };
    vis.forEach(o => {
      const i = lista.indexOf(o);
      const atrasada = vencida(o);
      n[o.status === 'E' ? 'e' : o.programada ? 'p' : 'n']++;
      h += '<tr data-i="' + i + '"' + (atrasada ? ' class="atrasada vencida" title="hora vencida: o horário marcado já passou"' : '') + '>'
        + '<td class="quebra"><b>' + esc(o.cliente && o.cliente.nome) + '</b></td>'
        + '<td>' + (o.diaPrevisto ? dataBr(o.diaPrevisto) : sem('sem dia')) + '</td>'
        + '<td>' + (o.horaIni ? esc(o.horaIni + (o.horaFim ? '–' + o.horaFim : '')) : sem('sem hora')) + '</td>'
        + '<td>' + (o.tecnicoNome ? esc(o.tecnicoNome) : sem('a definir')) + '</td>'
        + '<td>' + (atrasada ? tagVencida : situacao(o)) + '</td>'
        + '<td class="quebra">' + esc((o.itens || []).map(x => x.descricao).join(', ')) + '</td>'
        + '<td>' + esc((o.endereco || {}).bairro) + '</td>'
        + '<td>' + esc(o.numero) + '</td>'
        + '<td>' + esc(o.venda ? o.venda.numero : '') + '</td></tr>';
    });
    $('lista').innerHTML = h + '</tbody></table>';
    $('rodape').textContent = vis.length + ' OS em aberto · ' + n.p + ' programada(s) · ' + n.n + ' não programada(s) · ' + n.e + ' concluída(s) a receber';
  }

  $('abas').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-tipo]');
    if (!b || b.dataset.tipo === tipo) return;
    tipo = b.dataset.tipo;
    carregar();
  });
  $('lista').addEventListener('click', ev => {
    const t = ev.target.closest('th[data-ord]');
    if (t) {                                                        // titulo: ordena / inverte
      ord = ord.campo === t.dataset.ord ? { campo: ord.campo, dir: -ord.dir } : { campo: t.dataset.ord, dir: 1 };
      desenhar(); return;
    }
    const tr = ev.target.closest('tr[data-i]');
    if (tr && window.OSModal) window.OSModal.abrir(lista[+tr.dataset.i].id, carregar);
  });
  $('filtro').addEventListener('input', desenhar);
  window.addEventListener('os-mudou', carregar);     // modal reaberto na volta da ficha de fechamento

  carregar();
})();
