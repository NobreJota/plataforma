// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos-lista.js
// Criado em: 13/10/2026
//
// SERVICO > listas da OS (views\vendas\pages\servicos-lista.handlebars)
// Abas: programadas · nprogramadas · pendentes · concluidas · liquidadas
// O tipo fica na URL (?tipo=). Clique na linha abre o modal da OS (os-modal.js).
// Pendente com dia previsto ja passado fica marcada em vermelho (atrasada).
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/os/lista?tipo=';
  const TIPOS = ['programadas', 'nprogramadas', 'pendentes', 'concluidas', 'liquidadas'];
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataBr = d => d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '';
  const dataDe = d => d ? new Date(d).toLocaleDateString('pt-BR') : '';
  const sem = (t) => '<span class="falta">' + t + '</span>';
  const hojeIso = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();

  let tipo = new URLSearchParams(location.search).get('tipo');
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
    const vis = f ? lista.filter(o => texto(o).includes(f)) : lista;
    const feita = tipo === 'concluidas' || tipo === 'liquidadas';
    if (!vis.length) {
      $('lista').innerHTML = '<div class="vazio">' + (lista.length ? 'Nada com esse filtro.' : 'Nenhuma OS nesta aba.') + '</div>';
      $('rodape').textContent = '';
      return;
    }
    let h = '<table><thead><tr><th>OS</th><th>Cliente</th><th>Técnico</th><th>Dia previsto</th><th>Horário</th><th>Bairro</th><th>Venda</th>'
      + (feita ? '<th>Término</th><th class="n">Serviço</th><th class="n">Consignado</th><th class="n">Total</th>'
               : '<th class="n">Consignado</th>')
      + '</tr></thead><tbody>';
    let soma = 0;
    vis.forEach(o => {
      const i = lista.indexOf(o);
      const atrasada = o.status === 'P' && o.diaPrevisto && o.diaPrevisto < hojeIso;
      const total = (o.valorServico || 0) + (o.totalConsignado || 0);
      soma += total;
      h += '<tr data-i="' + i + '"' + (atrasada ? ' class="atrasada" title="dia previsto já passou"' : '') + '>'
        + '<td><b>' + esc(o.numero) + '</b></td>'
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

  $('abas').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-tipo]');
    if (!b || b.dataset.tipo === tipo) return;
    tipo = b.dataset.tipo;
    carregar();
  });
  $('lista').addEventListener('click', ev => {
    const tr = ev.target.closest('tr[data-i]');
    if (tr && window.OSModal) window.OSModal.abrir(lista[+tr.dataset.i].id, carregar);
  });
  $('filtro').addEventListener('input', desenhar);

  carregar();
})();
