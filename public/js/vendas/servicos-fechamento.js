// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\servicos-fechamento.js
// Criado em: 15/10/2026
//
// FICHA DE FECHAMENTO DA OS (views\vendas\pages\servicos-fechamento.handlebars)
//   linha 1: material vendido · devolucao de material vendido · valor adicional
//   linha 2: material consignado (usado: cobrar ou nao) · devolucao de consignado ·
//            termino e mao de obra (parte da empresa; o resto e do tecnico)
// "Gravar ordem de serviço" -> POST /vendas/api/os/:id/fechamento (lancamentos no servidor)
// OS ja fechada: so consulta; "Reabrir" desfaz o fechamento.
// Dinheiro em centavos na API.
// Alterado em: 15/10/2026 - consignado usado a PRECO DE VENDA; o destino de cada item e escolhido
//              aqui: venda adicional (preco de venda) · complementar/cortesia (despesa a custo) ·
//              troca por vendido que voltou (devolucao de vendido "troca"). VI: mao de obra so a
//              da venda (sem mao de obra adicional por enquanto).
// Alterado em: 15/10/2026 - devolucao de vendido: saiu a coluna Tratamento (por enquanto) e entrou
//              VALOR (qtd devolvida x preco da venda), com o total "valor devolvido". Se algum
//              consignado for "troca", a devolucao vai como troca; senao, como receita extra.
// Alterado em: 16/10/2026 - fechada com a receber: botao "Receber agora" abre o FLUXO DE SERVICO
//              com a OS ja marcada (/vendas/servicos/fluxo?os=); o recebimento e o do fluxo de caixa.
// Alterado em: 16/10/2026 - "Voltar" e "Menu" na faixa marrom (no lugar da etiqueta da situacao).
//              TERMINO: de quando a OS foi aberta ate hoje (o servico pode ser feito antes do dia
//              previsto); dias depois de hoje ficam bloqueados.
// Alterado em: 16/10/2026 - CONSIGNADO mais simples: a caixa da esquerda mostra o que o tecnico
//              LEVOU (nao muda); a da direita, o que DEVOLVEU, com o valor devolvido. A DIFERENCA
//              (levou - devolveu = usado) e o que vai para a contabilidade, pelo destino de cada linha.
// Alterado em: 16/10/2026 - sem a coluna "Destino do usado": a esquerda tem so o "total consignado";
//              a direita, "valor material devolvido" e o SALDO A COMPENSAR com UM destino para
//              todo o saldo (venda adicional / complementar / troca). O servidor nao muda.
// Alterado em: 16/10/2026 - "Devolveu" nao aceita mais do que levou (nem a devolucao de vendido
//              mais do que vendeu): o numero volta para o maximo, com aviso.
// Alterado em: 16/10/2026 - caixas lado a lado com o MESMO numero de linhas (rola se passar) e
//              linhas da mesma altura; o "saldo a compensar" saiu de dentro da caixa e foi para uma
//              faixa embaixo dela (vendido: saldo vendido | saldo a compensar; consignado: saldo + destino).
// =============================================================================

(function () {
  'use strict';

  const ID = document.body.dataset.os;
  const API = '/vendas/api/os/' + ID;
  const VOLTA = new URLSearchParams(location.search).get('volta') || '/vendas/servicos/lista?tipo=geral';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lerBrl = t => { const s = String(t || '').trim().replace(/\./g, '').replace(',', '.'); const n = Number(s); return s && Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const dataBr = d => d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '';
  const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const hora = d => { const x = new Date(d); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
  const hojeIso = () => iso(new Date());
  const SIT = { P: 'Pendente', E: 'Concluída · a receber', L: 'Liquidada', C: 'Cancelada' };
  const TIPO = { VI: 'Venda/instalação', INSTALACAO: 'Venda/instalação', C: 'Conserto', G: 'Garantia' };

  let d = null;          // resposta da API
  let sujo = false;

  async function api(metodo, url, corpo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const r = await fetch(url, op);
    if (r.status === 401) { location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
    if (!j.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }
  const msg = (t, ok) => { const m = $('msg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('ok', !!ok); };

  // ---------------------------------------------------------------------------
  function cabecalho() {
    const o = d.os, cli = o.cliente || {};
    $('tit').textContent = 'Fechamento da OS nº ' + o.numero + (TIPO[o.tipo] ? ' · ' + TIPO[o.tipo] : '') + ' · ' + (cli.nome || '');
    $('sub').textContent = [o.tecnicoNome ? 'técnico ' + o.tecnicoNome : 'sem técnico',
      o.diaPrevisto ? 'previsto ' + dataBr(o.diaPrevisto) + (o.horaIni ? ' ' + o.horaIni + '–' + o.horaFim : '') : 'sem dia',
      o.venda ? 'venda nº ' + o.venda.numero : 'sem venda'].join(' · ');
    // 16/10/2026: a situacao vai no subtitulo; a faixa tem Voltar e Menu
    $('sub').textContent += ' · ' + (SIT[o.status] || o.status).toLowerCase();
    document.title = 'Fechamento OS ' + o.numero;
  }

  // 16/10/2026: cada caixa fica numa celula; "faixa" = barra de saldo embaixo da caixa (fora dela).
  //   par = caixas lado a lado (vendido/devolucao, consignado/devolucao): corpo de altura fixa,
  //   linhas do mesmo tamanho; se tiver mais linhas, rola.
  const caixa = (titulo, corpo, pe, cls, faixa, par) => '<div class="cel' + (cls ? ' ' + cls : '') + '"><section class="caixa' + (par ? ' par' : '') + '"><h2>' + titulo + '</h2><div class="corpo">' + corpo + '</div>'
    + (pe ? '<div class="pe">' + pe + '</div>' : '') + '</section>'
    + (faixa === undefined ? '' : '<div class="faixa' + (faixa ? '' : ' vazia') + '">' + faixa + '</div>') + '</div>';

  // ---- ficha para preencher (OS pendente) -----------------------------------
  function desenharEdicao() {
    const o = d.os, mo = d.maoDeObra;
    const cons = (o.consignados || []).filter(c => c.quantidade - c.devolvido > 0);

    const vendido = d.vendidos.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:36px"><col style="width:76px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Qtd</th><th class="n">Valor</th></tr></thead><tbody>'
        + d.vendidos.map(i => '<tr><td>' + i.codigo + '</td><td class="d" title="' + esc(i.descricao) + '">' + esc(i.descricao) + '</td><td class="n">' + i.quantidade
          + '</td><td class="n">' + brl(i.total) + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="vazio">OS sem venda: nenhum material vendido.</div>';
    const totVend = d.vendidos.reduce((s, i) => s + i.total, 0);

    const devVend = d.vendidos.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:40px"><col style="width:52px"><col style="width:80px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Vend.</th><th class="n">Devol.</th><th class="n">Valor</th></tr></thead><tbody>'
        + d.vendidos.map((i, k) => '<tr><td>' + i.codigo + '</td><td class="d" title="' + esc(i.descricao) + '">' + esc(i.descricao) + '</td><td class="n">' + i.quantidade
          + '</td><td><input class="q" data-dv="' + k + '" data-max="' + i.quantidade + '" inputmode="numeric" placeholder="0"></td>'
          + '<td class="n" id="dvv-' + k + '"></td></tr>').join('')
        + '</tbody></table>'
      : '<div class="vazio">Nada vendido para devolver.</div>';

    const adicional = '<div id="ads"></div><button type="button" class="btn mini" id="ad-mais">+ valor adicional</button>'
      + '<div class="dica">Do <b>técnico</b>: debitado na conta dele (sai do pagamento de sexta). Do <b>cliente</b>: entra no que ele tem a pagar (fluxo de serviço).</div>';

    const consig = cons.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:48px"><col style="width:70px"><col style="width:76px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n" title="o que o técnico levou">Levou</th><th class="n">Unit.</th><th class="n">Total</th></tr></thead><tbody>'
        + cons.map(c => '<tr><td>' + esc(c.codigo) + '</td><td class="d" title="' + esc(c.descricao) + '">' + esc(c.descricao) + '</td><td class="n">' + (c.quantidade - c.devolvido) + '</td>'
          + '<td class="n">' + brl(c.precoUnit) + '</td><td class="n">' + brl((c.quantidade - c.devolvido) * c.precoUnit) + '</td></tr>').join('')
        + '</tbody></table>'
      : '<div class="vazio">Nenhum consignado com o técnico.</div>';
    // 16/10/2026: um destino so, para o SALDO (levou - devolveu), no pe da devolucao
    const destSaldo = '<select id="dest-saldo" title="o que fazer com o saldo (o que o técnico usou)" style="width:auto">'
      + '<option value="">— escolha —</option><option value="VENDA" title="venda adicional, preço de venda">venda adicional</option>'
      + '<option value="COMPLEMENTAR" title="material complementar / cortesia: despesa a custo">complementar</option>'
      + '<option value="TROCA" title="ficou no lugar de material vendido que voltou">troca</option></select>';

    const devCons = cons.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:48px"><col style="width:68px"><col style="width:66px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n" title="o que o técnico levou">Levou</th><th class="n">Devolveu</th><th class="n">Valor</th></tr></thead><tbody>'
        + cons.map(c => '<tr><td>' + esc(c.codigo) + '</td><td class="d" title="' + esc(c.descricao) + '">' + esc(c.descricao) + '</td><td class="n">' + (c.quantidade - c.devolvido)
          + '</td><td><input class="q" data-dc="' + c.id + '" data-max="' + (c.quantidade - c.devolvido) + '" inputmode="numeric" placeholder="0"></td><td class="n" id="dcv-' + c.id + '"></td></tr>').join('')
        + '</tbody></table>'
      : '<div class="vazio">Nada para devolver.</div>';

    const moTxt = { VENDA: 'cobrada na venda nº ' + (o.venda ? o.venda.numero : '') + ' (não muda)',
                    JA_PARTILHADA: 'já dividida: técnico R$ ' + brl(d.parteTecnico) + ' · empresa R$ ' + brl(d.parteLoja),
                    OS: 'cobrar do cliente agora (fluxo de serviço)' }[mo.modo];
    const semMo = mo.modo === 'VENDA' && !mo.valor;      // VI sem mao de obra na venda
    const termino = '<div class="campos">'
      + '<label>Dia do término<input type="date" id="tdia" min="' + esc(o.aberta ? iso(o.aberta) : '') + '" max="' + hojeIso() + '"></label>'
      + '<label>Hora<input type="time" id="thora"></label>'
      + '<label class="l2">Mão de obra cobrada<input id="mo" class="num" inputmode="decimal" placeholder="0,00"'
        + (mo.modo === 'OS' ? '' : ' disabled value="' + brl(mo.valor) + '"') + '></label>'
      + '<label>Empresa<input id="emp" class="num" inputmode="decimal" placeholder="0,00"' + (mo.modo === 'JA_PARTILHADA' ? ' disabled value="' + brl(d.parteLoja) + '"' : semMo ? ' disabled' : '') + '></label>'
      + '<label>Técnico<input id="tec" class="num" disabled value="' + (mo.modo === 'JA_PARTILHADA' ? brl(d.parteTecnico) : '') + '"></label>'
      + '</div><div class="dica">' + (semMo ? 'Sem mão de obra cobrada na venda nº ' + esc(o.venda ? o.venda.numero : '') + ': nada a dividir.'
        : esc(moTxt) + '. Informe a parte da empresa; o resto vai para a conta do técnico' + (o.tecnicoNome ? ' (' + esc(o.tecnicoNome) + ')' : '') + '.') + '</div>';

    $('ficha').innerHTML = '<div class="grade">'
      + caixa('Material vendido', vendido, 'valor <b>' + brl(totVend) + '</b>', '', 'saldo vendido <b id="v-vliq">' + brl(totVend) + '</b>', 1)
      + caixa('Devolução de material vendido', devVend, 'valor devolvido <b id="v-dev">0,00</b>', '', 'saldo a compensar <b id="v-dsaldo" class="roxo">0,00</b>', 1)
      + caixa('Valor adicional (técnico ou cliente)', adicional, '', 'cx-ad')
      + caixa('Material consignado (o técnico levou)', consig, 'total consignado <b id="v-lev">0,00</b>', 'cx-cons', '', 1)
      + caixa('Devolução de material consignado', devCons, 'valor material devolvido <b id="v-dcons">0,00</b>', 'cx-dcons',
        'saldo a compensar <b id="v-tot" class="roxo">0,00</b> ' + destSaldo, 1)
      + caixa('Término do serviço e mão de obra', termino, '', 'cx-term')
      + '</div>'
      + '<div class="resumo"><label>Observação do serviço<textarea id="obs" maxlength="2000" placeholder=" "></textarea></label>'
      + '<div class="totais" id="totais"></div></div>'
      + '<div class="acoes"><span class="msg" id="msg"></span>'
      + '<button type="button" class="btn" id="voltar">Voltar sem gravar</button>'
      + '<button type="button" class="btn preto" id="gravar">Gravar ordem de serviço</button></div>';

    $('obs').value = o.observacaoServico || '';
    if (o.terminoEm) { $('tdia').value = iso(o.terminoEm); $('thora').value = hora(o.terminoEm); }
    if (mo.modo === 'VENDA') $('emp').value = '';
    ligarEdicao(cons);
    recalcular();
  }

  function linhaAdicional(a) {
    const div = document.createElement('div');
    div.className = 'ad';
    div.innerHTML = '<select class="a-quem"><option value="CLIENTE">do cliente</option><option value="TECNICO">do técnico</option></select>'
      + '<input class="a-valor num" inputmode="decimal" placeholder="0,00">'
      + '<input class="a-motivo" placeholder="motivo" maxlength="120">'
      + '<button type="button" class="x" title="tirar">×</button>';
    if (a) { div.querySelector('.a-quem').value = a.quem; div.querySelector('.a-valor').value = brl(a.valor); div.querySelector('.a-motivo').value = a.motivo; }
    $('ads').appendChild(div);
    return div;
  }

  function ler(cons) {
    const destino = $('dest-saldo') ? $('dest-saldo').value : '';   // o mesmo destino para todo o saldo
    const consignados = cons.map(c => ({
      id: c.id,
      devolver: Number(document.querySelector('[data-dc="' + c.id + '"]').value || 0),
      destino,
    }));
    const vendidos = d.vendidos.map((i, k) => ({
      codigo: i.codigo,
      devolver: Number(document.querySelector('[data-dv="' + k + '"]').value || 0),
      tratamento: 'RECEITA_EXTRA',
    })).filter(x => x.devolver > 0);
    // 15/10/2026: sem a coluna tratamento: com consignado em troca, a devolucao e a troca
    if (consignados.some(p => p.destino === 'TROCA')) vendidos.forEach(v => { v.tratamento = 'TROCA'; });
    const adicionais = [...document.querySelectorAll('#ads .ad')].map(r => ({
      quem: r.querySelector('.a-quem').value, valor: lerBrl(r.querySelector('.a-valor').value), motivo: r.querySelector('.a-motivo').value.trim(),
    })).filter(a => a.valor || a.motivo);
    const mo = d.maoDeObra.modo === 'OS' ? lerBrl($('mo').value) : d.maoDeObra.valor;
    return { terminoDia: $('tdia').value, terminoHora: $('thora').value, maoDeObra: mo,
             empresa: lerBrl($('emp').value), consignados, vendidos, adicionais, observacaoServico: $('obs').value };
  }

  let consAtual = [];
  function recalcular() {
    const c = ler(consAtual);
    let cob = 0, ncob = 0, tot = 0, lev = 0, dcons = 0;
    for (const x of consAtual) {
      const p = c.consignados.find(y => y.id === x.id);
      const levou = x.quantidade - x.devolvido, volta = Math.min(levou, p.devolver || 0);
      const usado = Math.max(0, levou - volta);
      lev += levou * x.precoUnit; dcons += volta * x.precoUnit;
      const cel = $('dcv-' + x.id); if (cel) cel.textContent = volta ? brl(volta * x.precoUnit) : '';
      tot += usado * x.precoUnit;
      if (p.destino === 'VENDA') cob += usado * x.precoUnit;
      else if (p.destino === 'COMPLEMENTAR') ncob += usado * (d.custo[x.codigo] || 0);
    }
    const sel = $('dest-saldo');            // voltou tudo: nada a compensar
    if (sel) { sel.disabled = !tot; if (!tot) sel.value = ''; sel.title = tot ? 'o que fazer com o saldo (o que o técnico usou)' : 'voltou tudo: nada a lançar'; }
    if ($('v-tot')) $('v-tot').textContent = brl(tot);
    if ($('v-lev')) { $('v-lev').textContent = brl(lev); $('v-dcons').textContent = brl(dcons); }
    // devolucao de vendido: valor por linha e total
    let dev = 0;
    d.vendidos.forEach((i, k) => {
      const n = Number((document.querySelector('[data-dv="' + k + '"]') || {}).value || 0);
      const cel = $('dvv-' + k); if (cel) cel.textContent = n ? brl(n * i.precoUnit) : '';
      dev += n * i.precoUnit;
    });
    if ($('v-dev')) { $('v-dev').textContent = brl(dev); $('v-dsaldo').textContent = brl(dev);
      $('v-vliq').textContent = brl(d.vendidos.reduce((s, i) => s + i.total, 0) - dev); }
    const mo = c.maoDeObra, modo = d.maoDeObra.modo;
    if (modo !== 'JA_PARTILHADA') $('tec').value = mo ? brl(Math.max(0, mo - c.empresa)) : '';
    const adCli = c.adicionais.filter(a => a.quem === 'CLIENTE').reduce((s, a) => s + a.valor, 0);
    const adTec = c.adicionais.filter(a => a.quem === 'TECNICO').reduce((s, a) => s + a.valor, 0);
    const aReceber = cob + adCli + (modo === 'OS' ? mo : 0);
    const estorno = c.vendidos.filter(v => v.tratamento === 'ESTORNO')
      .reduce((s, v) => { const i = d.vendidos.find(x => x.codigo === v.codigo); return s + (i ? i.precoUnit * v.devolver : 0); }, 0);
    $('totais').innerHTML =
        (modo !== 'JA_PARTILHADA' && mo ? 'técnico recebe <b>' + brl(Math.max(0, mo - c.empresa)) + '</b> · empresa <b>' + brl(Math.min(mo, c.empresa)) + '</b><br>' : '')
      + (adTec ? 'cobrado do técnico <b>' + brl(adTec) + '</b><br>' : '')
      + (estorno ? 'estorno a combinar com o cliente <b>' + brl(estorno) + '</b><br>' : '')
      + '<span class="areceber">a receber do cliente <b>R$ ' + brl(aReceber) + '</b></span>'
      + (aReceber ? '' : '<br><span class="dica">nada a receber: a OS fica liquidada</span>');
  }

  function ligarEdicao(cons) {
    consAtual = cons;
    const ficha = $('ficha');
    ficha.addEventListener('input', ev => {
      sujo = true;
      if (ev.target.classList.contains('q')) {
        const el = ev.target, max = Number(el.dataset.max);
        el.value = el.value.replace(/\D/g, '');
        // 16/10/2026: nao deixa devolver mais do que levou / vendeu
        if (el.value !== '' && Number.isFinite(max) && Number(el.value) > max) {
          el.value = String(max);
          msg('Devolução maior que o que ' + (el.dataset.dc ? 'o técnico levou' : 'foi vendido') + ' (' + max + '): ficou ' + max + '.');
        } else msg('');
      }
      recalcular();
    });
    ficha.addEventListener('change', () => { sujo = true; recalcular(); });
    ficha.addEventListener('focusout', ev => {
      const el = ev.target;
      if ((el.classList.contains('num') || el.classList.contains('a-valor')) && !el.disabled && el.value.trim()) el.value = brl(lerBrl(el.value));
    });
    ficha.addEventListener('click', ev => { const x = ev.target.closest('.x'); if (x) { x.closest('.ad').remove(); sujo = true; recalcular(); } });
    $('ad-mais').addEventListener('click', () => linhaAdicional().querySelector('.a-valor').focus());
    $('gravar').addEventListener('click', gravar);
    $('voltar').addEventListener('click', () => { if (!sujo || confirm('Sair sem gravar o fechamento?')) { sujo = false; location.href = VOLTA; } });
  }

  async function gravar() {
    const c = ler(consAtual), o = d.os, modo = d.maoDeObra.modo;
    if (!c.terminoDia) { msg('Informe o dia do término.'); $('tdia').focus(); return; }
    if (o.aberta && c.terminoDia < iso(o.aberta)) { msg('O término é antes da abertura da OS (' + dataBr(iso(o.aberta)) + ').'); $('tdia').focus(); return; }
    if (c.terminoDia > hojeIso()) { msg('O término não pode ser no futuro.'); $('tdia').focus(); return; }
    if (modo !== 'JA_PARTILHADA' && c.maoDeObra && c.empresa > c.maoDeObra) { msg('A parte da empresa é maior que a mão de obra.'); $('emp').focus(); return; }
    for (const a of c.adicionais) if (!a.valor || !a.motivo) { msg('Valor adicional: informe valor e motivo.'); return; }
    for (const x of consAtual) {
      const p = c.consignados.find(y => y.id === x.id);
      if (p.devolver > x.quantidade - x.devolvido) { msg(x.codigo + ': devolução maior que o que está com o técnico.'); return; }
      if (x.quantidade - x.devolvido - p.devolver > 0 && !p.destino) {
        msg('Saldo a compensar: escolha o destino (venda adicional, complementar ou troca).');
        $('dest-saldo').focus(); return;
      }
    }
    const trocaC = c.consignados.some(p => p.destino === 'TROCA'), trocaV = c.vendidos.some(v => v.tratamento === 'TROCA');
    if (trocaC && !trocaV) { msg('Troca: informe na devolução de material vendido o que voltou (a quantidade devolvida).'); return; }
    if (modo !== 'JA_PARTILHADA' && c.maoDeObra && !$('emp').value.trim()
        && !confirm('Parte da empresa em branco: a mão de obra inteira (R$ ' + brl(c.maoDeObra) + ') vai para o técnico. Continuar?')) { $('emp').focus(); return; }
    if (!confirm('Gravar o fechamento da OS nº ' + o.numero + '?\nOs lançamentos são feitos agora.')) return;
    $('gravar').disabled = true; msg('Gravando…', true);
    try {
      d = await api('POST', API + '/fechamento', c);
      sujo = false;
      desenhar();
      msg('✓ OS fechada' + (d.aReceber ? ' · a receber R$ ' + brl(d.aReceber) : ' · liquidada'), true);
    } catch (e) { msg(e.message); $('gravar').disabled = false; }
  }

  // ---- consulta (OS ja fechada) ----------------------------------------------
  function desenharConsulta() {
    const o = d.os, f = d.fechamento;
    if (!f) {
      $('ficha').innerHTML = '<div class="caixa"><div class="vazio">OS ' + esc(SIT[o.status] || o.status) + ', sem ficha de fechamento (fechada antes de 15/10/2026).</div></div>'
        + '<div class="acoes"><span class="msg" id="msg"></span><button type="button" class="btn" id="voltar">Voltar</button></div>';
      $('voltar').addEventListener('click', () => { location.href = VOLTA; });
      return;
    }
    const tab = (cab, linhas) => linhas.length ? '<table><thead><tr>' + cab.map(h => '<th' + (h.n ? ' class="n"' : '') + '>' + h.t + '</th>').join('')
      + '</tr></thead><tbody>' + linhas.join('') + '</tbody></table>' : '<div class="vazio">—</div>';
    const m = f.maoDeObra || {};
    $('ficha').innerHTML = '<div class="grade">'
      + caixa('Material vendido', tab([{ t: 'Cód.' }, { t: 'Descrição' }, { t: 'Qtd', n: 1 }, { t: 'Valor', n: 1 }],
          d.vendidos.map(i => '<tr><td>' + i.codigo + '</td><td class="d" title="' + esc(i.descricao) + '">' + esc(i.descricao) + '</td><td class="n">' + i.quantidade + '</td><td class="n">' + brl(i.total) + '</td></tr>')))
      + caixa('Devolução de material vendido', tab([{ t: 'Cód.' }, { t: 'Descrição' }, { t: 'Qtd', n: 1 }, { t: 'Tratamento' }],
          (f.devolucoesVendido || []).map(x => '<tr><td>' + x.codigo + '</td><td class="d" title="' + esc(x.descricao) + '">' + esc(x.descricao) + '</td><td class="n">' + x.quantidade
            + '</td><td>' + (x.tratamento === 'ESTORNO' ? 'estorno R$ ' + brl(x.valor) : x.tratamento === 'TROCA' ? 'troca p/ consignado' : 'receita extra') + '</td></tr>')))
      + caixa('Valor adicional', tab([{ t: 'De' }, { t: 'Motivo' }, { t: 'Valor', n: 1 }],
          (f.adicionais || []).map(a => '<tr><td>' + (a.quem === 'TECNICO' ? 'técnico' : 'cliente') + '</td><td class="d" title="' + esc(a.motivo) + '">' + esc(a.motivo) + '</td><td class="n">' + brl(a.valor) + '</td></tr>')))
      + caixa('Material consignado (usado)', tab([{ t: 'Cód.' }, { t: 'Descrição' }, { t: 'Usado', n: 1 }, { t: 'Valor', n: 1 }, { t: '' }],
          (f.consignados || []).map(c => '<tr><td>' + esc(c.codigo) + '</td><td class="d" title="' + esc(c.descricao) + '">' + esc(c.descricao) + '</td><td class="n">' + c.usado + '</td><td class="n">'
            + brl(c.usado * c.precoUnit) + '</td><td>' + ({ VENDA: '<span class="tag c">venda adicional</span>',
              COMPLEMENTAR: '<span class="tag n">complementar (custo ' + brl(c.usado * c.custoUnit) + ')</span>', TROCA: '<span class="tag">troca</span>' }[c.destino || (c.cobrar ? 'VENDA' : 'COMPLEMENTAR')]) + '</td></tr>')))
      + caixa('Devolução de material consignado', tab([{ t: 'Cód.' }, { t: 'Qtd', n: 1 }],
          (f.devolucoesConsignado || []).map(x => '<tr><td>' + esc(x.codigo) + '</td><td class="n">' + x.quantidade + '</td></tr>')))
      + caixa('Término e mão de obra', '<div class="campos">'
          + '<label>Término<input disabled value="' + (f.terminoEm ? new Date(f.terminoEm).toLocaleString('pt-BR').slice(0, 17) : '') + '"></label>'
          + '<label>Mão de obra<input class="num" disabled value="' + brl(m.valor) + '"></label>'
          + '<label>Empresa<input class="num" disabled value="' + brl(m.empresa) + '"></label>'
          + '<label>Técnico<input class="num" disabled value="' + brl(m.tecnico) + '"></label></div>')
      + '</div>'
      + '<div class="resumo"><label>Observação do serviço<textarea disabled>' + esc(o.observacaoServico) + '</textarea></label>'
      + '<div class="totais"><span class="areceber">a receber do cliente <b>R$ ' + brl(f.aReceber) + '</b></span>'
      + (f.estornoPendente ? '<br>estorno a combinar <b>' + brl(f.estornoPendente) + '</b>' : '')
      + '<br><span class="dica">fechada em ' + new Date(f.em).toLocaleString('pt-BR').slice(0, 17) + '</span></div></div>'
      + '<div class="acoes"><span class="msg" id="msg"></span>'
      + (o.status === 'E' || (o.status === 'L' && f.semReceber) ? '<button type="button" class="btn" id="reabrir">Reabrir (desfaz o fechamento)</button>' : '')
      + (o.status === 'E' && f.aReceber ? '<button type="button" class="btn" style="background:#059669;border-color:#059669;color:#fff" id="receber">Receber agora (fluxo de serviço)</button>' : '')
      + '<button type="button" class="btn roxo" id="voltar">Voltar</button></div>';
    $('voltar').addEventListener('click', () => { location.href = VOLTA; });
    if ($('reabrir')) $('reabrir').addEventListener('click', reabrir);
    if ($('receber')) $('receber').addEventListener('click', () => {
      location.href = '/vendas/servicos/fluxo?os=' + encodeURIComponent(d.os.id) + '&volta=' + encodeURIComponent(location.pathname + location.search);
    });
  }

  async function reabrir() {
    if (!confirm('Reabrir a OS nº ' + d.os.numero + '?\nOs lançamentos do fechamento são cancelados e as devoluções desfeitas.')) return;
    try {
      await api('POST', API + '/reabrir');
      await carregar();
      msg('✓ OS reaberta: pendente', true);
    } catch (e) { msg(e.message); }
  }

  function desenhar() {
    cabecalho();
    if (d.os.status === 'P') desenharEdicao(); else desenharConsulta();
  }

  async function carregar() {
    try { d = await api('GET', API + '/fechamento'); desenhar(); }
    catch (e) { $('ficha').innerHTML = '<div class="caixa"><div class="vazio">' + esc(e.message) + '</div></div>'; }
  }

  // 16/10/2026: Voltar / Menu na faixa (perguntam se ha algo nao gravado)
  const sair = url => { if (!sujo || confirm('Sair sem gravar o fechamento?')) { sujo = false; location.href = url; } };
  $('nav-voltar').addEventListener('click', () => sair(VOLTA));
  $('nav-menu').addEventListener('click', () => sair('/usuariocontab/menu'));
  document.addEventListener('keydown', ev => { if (ev.altKey && ev.key === 'ArrowLeft') { ev.preventDefault(); sair(VOLTA); } });

  window.addEventListener('beforeunload', ev => { if (sujo) { ev.preventDefault(); ev.returnValue = ''; } });
  carregar();
})();
