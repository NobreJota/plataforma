// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos.js
// Criado em: 10/10/2026
//
// SERVICO > AGENDA DO DIA (views\vendas\pages\servicos.handlebars)
// Le /vendas/api/venda/servicos?dia=AAAA-MM-DD e monta a grade
// horario (07:00 a 19:00, 30 em 30 min) x tecnico. Clique no servico abre os
// detalhes. O dia fica na URL (?dia=) para poder voltar/atualizar sem perder.
// Alterado em: 13/10/2026 - uma coluna para CADA tecnico ativo (mesmo sem servico);
//              aba "A agendar": OS pendente / reserva sem dia ou sem horario.
//              Clique numa OS abre o modal da OS (os-modal.js): consignados, termino,
//              valor final, fotos, concluir. Reserva (venda aberta) so mostra os dados.
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/venda/servicos?dia=';
  const INI = 7 * 60, FIM = 19 * 60, PASSO = 30;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const min = hm => { const m = /^(\d{2}):(\d{2})$/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  let lista = [], tecnicos = [], aAgendar = [];

  function diaInicial() {
    const q = new URLSearchParams(location.search).get('dia');
    return /^\d{4}-\d{2}-\d{2}$/.test(q || '') ? q : iso(new Date());
  }

  function mudarDia(delta) {
    const d = new Date($('dia').value + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    $('dia').value = iso(d);
    carregar();
  }

  async function carregar() {
    const dia = $('dia').value;
    const d = new Date(dia + 'T12:00:00');
    $('dia-nome').textContent = SEMANA[d.getDay()] + ', ' + d.toLocaleDateString('pt-BR');
    history.replaceState(null, '', location.pathname + '?dia=' + dia);
    $('grade').innerHTML = '<div class="vazio">Carregando…</div>';
    try {
      const r = await fetch(API + dia, { headers: { Accept: 'application/json' } });
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
      if (!j.ok) throw new Error(j.erro || 'erro ao ler a agenda');
      lista = j.servicos || [];
      tecnicos = j.tecnicos || [];
      aAgendar = j.aAgendar || [];
      desenhar();
    } catch (e) {
      lista = []; aAgendar = [];
      $('grade').innerHTML = '<div class="vazio">' + esc(e.message) + '</div>';
      $('pend').innerHTML = ''; $('resumo').textContent = '';
    }
  }

  function nomeTec(s) { return s.tecnicoNome || (s.tecnicoConta ? s.tecnicoConta : 'a definir'); }

  const dataBr = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '';
  // de = 'L' (lista do dia) ou 'P' (a agendar); comDia mostra o dia previsto no canto
  function cartao(s, i, de, comDia) {
    const e = s.endereco || {};
    const onde = [s.horaIni ? s.horaIni + (s.horaFim ? '–' + s.horaFim : '') : '', e.bairro, s.edificio]
      .filter(Boolean).join(' · ');
    const dia = comDia ? '<span class="dia' + (s.diaPrevisto ? '' : ' sem') + '">'
      + (s.diaPrevisto ? dataBr(s.diaPrevisto) : 'sem dia') + '</span>' : '';
    return '<div class="sv' + (s.tipo === 'RESERVA' ? ' reserva' : '') + (s.status === 'E' || s.status === 'L' ? ' feita' : '') + '" data-de="' + (de || 'L') + '" data-i="' + i
      + '" title="clique para ver os detalhes">' + dia
      + '<b>' + esc((s.cliente && s.cliente.nome) || '(sem nome)') + '</b>'
      + '<small>' + esc(onde || (s.itens || []).map(x => x.descricao).join(', ')) + '</small></div>';
  }

  function desenhar() {
    // colunas: TODOS os tecnicos ativos, mesmo sem servico no dia; tecnico que tem
    // servico mas saiu da lista (inativo) tambem entra; "a definir" no fim, se houver
    const tecs = tecnicos.map(t => ({ k: t.conta, nome: t.nome }));
    const tecsDia = new Set(lista.map(s => s.tecnicoConta).filter(Boolean));
    lista.filter(s => min(s.horaIni) !== null).forEach(s => { const k = s.tecnicoConta || ''; if (!tecs.some(t => t.k === k)) tecs.push({ k, nome: nomeTec(s) }); });
    tecs.sort((a, b) => (a.k ? 0 : 1) - (b.k ? 0 : 1) || a.nome.localeCompare(b.nome));

    const os = lista.filter(s => s.tipo === 'OS').length;
    $('resumo').textContent = lista.length
      ? lista.length + ' serviço(s) · ' + os + ' OS · ' + (lista.length - os) + ' reserva(s) · ' + tecsDia.size + ' técnico(s)'
      : '';

    const comHora = lista.map((s, i) => ({ s, i, a: min(s.horaIni) })).filter(x => x.a !== null);

    if (!tecs.length) {
      $('grade').innerHTML = '<div class="vazio">Nenhum técnico cadastrado (contas 2.06.001).</div>';
    } else {
      // primeira e ultima linha: 07:00-19:00, abrindo se tiver servico fora da faixa
      let lo = INI, hi = FIM;
      comHora.forEach(x => { lo = Math.min(lo, x.a - x.a % PASSO); const f = min(x.s.horaFim); hi = Math.max(hi, (f || x.a + PASSO)); });
      const usados = new Set();
      let h = '<table><thead><tr><th class="h">Hora</th>'
        + tecs.map(t => '<th>' + esc(t.nome) + '</th>').join('') + '</tr></thead><tbody>';
      for (let m = lo; m < hi; m += PASSO) {
        h += '<tr class="' + (m % 60 ? 'meia' : 'cheia') + '"><td class="h">' + hm(m) + '</td>';
        tecs.forEach(t => {
          const aqui = comHora.filter(x => (x.s.tecnicoConta || '') === t.k && x.a >= m && x.a < m + PASSO);
          if (aqui.length) {
            // ocupa as linhas ate o fim do servico
            const fim = Math.max(...aqui.map(x => min(x.s.horaFim) || x.a + PASSO));
            const span = Math.max(1, Math.ceil((fim - m) / PASSO));
            for (let k = 1; k < span; k++) usados.add(t.k + '|' + (m + k * PASSO));
            h += '<td rowspan="' + span + '">' + aqui.map(x => cartao(x.s, x.i, 'L')).join('') + '</td>';
          } else if (!usados.has(t.k + '|' + m)) {
            h += '<td></td>';
          }
        });
        h += '</tr>';
      }
      $('grade').innerHTML = h + '</tbody></table>';
    }

    // aba A agendar
    $('n-pend').textContent = aAgendar.length;
    $('n-pend').classList.toggle('zero', !aAgendar.length);
    $('pend').innerHTML = aAgendar.length
      ? aAgendar.map((s, i) => cartao(s, i, 'P', true)).join('')
      : '<div class="vazio">Nenhuma OS pendente sem horário.</div>';
  }

  function aba(qual) {
    document.querySelectorAll('.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === qual));
    $('grade').hidden = qual !== 'agenda';
    $('pend').hidden = qual !== 'pend';
  }
  document.querySelectorAll('.abas button').forEach(b => b.addEventListener('click', () => aba(b.dataset.aba)));

  function detalhes(s) {
    const e = s.endereco || {};
    const linha = (rot, v) => v ? '<span>' + rot + '</span><div>' + v + '</div>' : '';
    const end = [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.bairro,
                 [e.cidade, e.uf].filter(Boolean).join('/'), e.cep ? 'CEP ' + e.cep : ''].filter(Boolean).join(' · ');
    const fones = [s.telefone, s.celular].filter(Boolean).join(' · ');
    const itens = (s.itens || []).length
      ? '<ul>' + s.itens.map(i => '<li>' + esc(i.servico || 'Instalação') + ' — ' + esc(i.codigo) + ' ' + esc(i.descricao)
          + (i.observacao ? ' <i>(' + esc(i.observacao) + ')</i>' : '') + '</li>').join('') + '</ul>'
      : '';
    const venda = s.venda ? 'Venda nº ' + esc(s.venda) : '';
    $('cx-tit').textContent = (s.tipo === 'OS' ? 'OS ' + (s.numero || '') : 'Reserva (venda aberta)') + ' · ' + ((s.cliente && s.cliente.nome) || '');
    $('cx-det').innerHTML =
        linha('Cliente', esc((s.cliente && s.cliente.nome) || ''))
      + linha('Técnico', esc(nomeTec(s)))
      + (s.diaPrevisto !== undefined ? linha('Dia', esc(s.diaPrevisto ? dataBr(s.diaPrevisto) : 'sem dia')) : '')
      + linha('Horário', esc(s.horaIni ? s.horaIni + (s.horaFim ? ' às ' + s.horaFim : '') : 'sem horário'))
      + linha('Endereço', esc(end))
      + linha('Edifício/apto', esc([s.edificio, s.apto ? 'apto ' + s.apto : ''].filter(Boolean).join(' · ')))
      + linha('Referência', esc(s.pontoReferencia))
      + linha('Telefones', esc(fones))
      + linha('Serviço', itens)
      + linha('Observação', esc(s.observacao))
      + linha('Origem', venda);
    $('fundo').hidden = false; $('caixa').hidden = false;
  }

  function fechar() { $('fundo').hidden = true; $('caixa').hidden = true; }

  document.addEventListener('click', ev => {
    const c = ev.target.closest('.sv');
    if (!c) return;
    const s = (c.dataset.de === 'P' ? aAgendar : lista)[+c.dataset.i];
    if (s && s.tipo === 'OS' && s.id && window.OSModal) window.OSModal.abrir(s.id, carregar);
    else detalhes(s);
  });
  $('fundo').addEventListener('click', fechar);
  $('cx-x').addEventListener('click', fechar);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fechar(); });
  $('ant').addEventListener('click', () => mudarDia(-1));
  $('prox').addEventListener('click', () => mudarDia(1));
  $('hoje').addEventListener('click', () => { $('dia').value = iso(new Date()); carregar(); });
  $('dia').addEventListener('change', () => { if ($('dia').value) carregar(); });
  $('imprimir').addEventListener('click', () => window.print());

  $('dia').value = diaInicial();
  carregar();
})();
