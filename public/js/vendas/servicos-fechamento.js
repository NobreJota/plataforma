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
// Alterado em: 29/10/2026 - destino do saldo do consignado: "troca" so aparece se a OS tem venda (material vendido).
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
// Alterado em: 16/10/2026 - instrucoes das caixas viraram um "?" no titulo (mouse em cima mostra);
//              "a receber do cliente" subiu para a caixa do termino; saiu "tecnico recebe · empresa"
//              (repetido); observacao menor.
// Alterado em: 16/10/2026 - ★ CONFIGURACAO DE CONTAS (botao na faixa): lista das operacoes da ficha
//              com a conta de cada uma (/vendas/api/os/config-contas). MAO DE OBRA ADICIONAL na caixa
//              do termino, abaixo de uma linha (acima o ja cobrado): valor + quem paga (o combo so abre
//              com valor). Observacao com 2/3 da largura.
// Alterado em: 16/10/2026 - configuracao: botao com icone do PLANO DE CONTAS em cada linha: abre a
//              consulta (codigo ou nome) e a conta escolhida vem para a linha (/config-contas/busca).
// Alterado em: 16/10/2026 - configuracao: botao do plano junto do codigo; a linha em configuracao
//              fica destacada; botoes Ativo/Passivo/Despesas/Receitas navegam no plano (grupo ->
//              subgrupo -> titulo -> conta); clicar na conta pergunta se e para configurar.
// Alterado em: 16/10/2026 - coluna "Plano de Contas" (botao) no fim da linha. Conta com MOVIMENTO
//              fica travada (cadeado): nao pode mudar conta com movimento.
// Alterado em: 16/10/2026 - saiu a caixa VALOR ADICIONAL (do cliente/do tecnico + motivo): quem paga
//              ja esta na MAO DE OBRA ADICIONAL; Enter no valor dela pula para a OBSERVACAO com
//              "mao de obra adicional R$ x: " para o usuario completar o motivo. A caixa do termino
//              ocupa a 3a coluna nas duas linhas.
// Alterado em: 16/10/2026 - termino HOJE com hora depois de agora: avisa e limpa a hora (antes so
//              o servidor recusava no Gravar).
// Alterado em: 16/10/2026 - HORA DO TERMINO: lista de 30 em 30 minutos, 07:00 a 19:00 (no lugar do
//              relogio do navegador). Hoje: so ate a meia hora seguinte a agora (18:15 -> 18:30).
// Alterado em: 16/10/2026 - "Voltar sem gravar" e "Gravar" ao lado da observacao (mesmo nivel), do
//              mesmo tamanho (.rodape-ficha / .acoes.lado).
// Alterado em: 16/10/2026 - "?" de ajuda com balao proprio (.bolha): o title do navegador nao
//              aparecia; agora mostra com o mouse em cima, no clique/toque e no Tab.
// Alterado em: 16/10/2026 - caixa do termino: blocos VENDA DE CONSIGNADO (a receber, preco de venda) e
//              DESPESA COMPLEMENTAR (a custo), com o valor do saldo a compensar pelo destino escolhido;
//              embaixo, o TOTAL a receber do cliente.
// Alterado em: 16/10/2026 - bloco VENDA DEVOLVIDA (valor do vendido que voltou; "troca pelo consignado"
//              quando o destino do saldo do consignado e troca).
// Alterado em: 16/10/2026 - saldo do consignado SEM destino: os blocos venda/complementar avisam
//              "escolha o destino do saldo a compensar (R$ x)" e o combo fica destacado.
// Alterado em: 17/10/2026 - ESPELHO (OS fechada) no mesmo formato da ficha, com os totais: valor
//              vendido/devolvido e saldos, consignado levou/devolveu e saldo com o destino, e os blocos
//              venda devolvida / venda de consignado / despesa complementar / total a receber.
//              REABRIR: a pergunta lista o que vai ser desfeito.
// Alterado em: 17/10/2026 - botao REABRIR desligado (REABRIR_ATIVO = false): OS VI so se desfaz com o
//              cancelamento da venda (a tratar la).
// Alterado em: 17/10/2026 - blocos: VENDA DEVOLVIDA com "preco venda" a esquerda e o CUSTO que volta ao
//              estoque a direita; DESPESA COMPLEMENTAR com o "saldo a compensar" a esquerda e o custo.
// Alterado em: 17/10/2026 - espelho: faixa RESULTADO DA OS (venda - custos - parte do tecnico -
//              complementar - cortesia = resultado e % da receita).
// Alterado em: 17/10/2026 - mao de obra APROPRIAR (dividida na venda): empresa e tecnico vem da venda
//              (travados); o fechamento passa a parte do tecnico da conta a apropriar para a dele.
// Alterado em: 17/10/2026 - espelho: a faixa do resultado virou APURACAO (botao, modal pequeno no canto):
//              venda (vendido + mao de obra da empresa) - custo (vendido - voltou ao estoque) = lucro
//              parcial; - material complementar = lucro final. A parte do tecnico fica fora.
// Alterado em: 26/10/2026 - OS sem venda (conserto) com VALOR COMBINADO no modal da OS: a ficha ja vem com a
//              mao de obra cobrada e a parte da empresa preenchidas (pode mudar; acrescimo na mao de obra adicional).
// Alterado em: 17/10/2026 - a janela da ★ saiu daqui para /js/comum/config-contas.js (tambem na venda).
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
  // 16/10/2026: instrucao vira um "?" no titulo; passando o mouse aparece o texto
  // 16/10/2026: o texto aparece num balao proprio (o "title" do navegador falhava e era cortado
  //             dentro das caixas com rolagem). Mouse em cima ou clique/toque no "?".
  const ajuda = t => ' <span class="ajuda" tabindex="0" data-dica="' + esc(t) + '">?</span>';
  const bolha = document.createElement('div');
  bolha.className = 'bolha'; bolha.hidden = true; document.body.appendChild(bolha);
  const mostrarDica = el => {
    bolha.textContent = el.dataset.dica; bolha.hidden = false;
    const r = el.getBoundingClientRect(), w = bolha.offsetWidth, h = bolha.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    let y = r.bottom + 8; if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    bolha.style.left = x + 'px'; bolha.style.top = y + 'px';
  };
  const esconderDica = () => { bolha.hidden = true; };
  document.addEventListener('mouseover', ev => { const a = ev.target.closest && ev.target.closest('.ajuda'); if (a) mostrarDica(a); });
  document.addEventListener('mouseout', ev => { if (ev.target.closest && ev.target.closest('.ajuda')) esconderDica(); });
  document.addEventListener('click', ev => { const a = ev.target.closest && ev.target.closest('.ajuda'); if (a) { ev.preventDefault(); bolha.hidden ? mostrarDica(a) : esconderDica(); } });
  document.addEventListener('focusin', ev => { if (ev.target.classList && ev.target.classList.contains('ajuda')) mostrarDica(ev.target); });
  document.addEventListener('focusout', ev => { if (ev.target.classList && ev.target.classList.contains('ajuda')) esconderDica(); });
  window.addEventListener('scroll', esconderDica, true);
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

    // 16/10/2026: saiu a caixa "Valor adicional" (quem paga ja esta na mao de obra adicional;
    //             o motivo vai na observacao)

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
      // 29/10/2026: troca so se houve venda (material vendido que possa voltar)
      + (d.vendidos.length ? '<option value="TROCA" title="ficou no lugar de material vendido que voltou">troca</option>' : '') + '</select>';

    const devCons = cons.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:48px"><col style="width:68px"><col style="width:66px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n" title="o que o técnico levou">Levou</th><th class="n">Devolveu</th><th class="n">Valor</th></tr></thead><tbody>'
        + cons.map(c => '<tr><td>' + esc(c.codigo) + '</td><td class="d" title="' + esc(c.descricao) + '">' + esc(c.descricao) + '</td><td class="n">' + (c.quantidade - c.devolvido)
          + '</td><td><input class="q" data-dc="' + c.id + '" data-max="' + (c.quantidade - c.devolvido) + '" inputmode="numeric" placeholder="0"></td><td class="n" id="dcv-' + c.id + '"></td></tr>').join('')
        + '</tbody></table>'
      : '<div class="vazio">Nada para devolver.</div>';

    const moTxt = { VENDA: 'cobrada na venda nº ' + (o.venda ? o.venda.numero : '') + ' (não muda)',
                    JA_PARTILHADA: 'já dividida: técnico R$ ' + brl(d.parteTecnico) + ' · empresa R$ ' + brl(d.parteLoja),
                    OS: mo.combinado ? 'combinado com o cliente na OS: R$ ' + brl(mo.valor) + ' (pode mudar; acréscimo na mão de obra adicional)'
                        : 'cobrar do cliente agora (fluxo de serviço)',
                    // 17/10/2026: dividida na venda; a parte do tecnico esta "a apropriar"
                    APROPRIAR: 'dividida na venda nº ' + (o.venda ? o.venda.numero : '') + ': a parte do técnico (R$ ' + brl(mo.tecnico)
                      + ') sai da conta a apropriar ' + (mo.conta || '') + ' para a conta do técnico desta OS' }[mo.modo];
    const fixa = mo.modo === 'JA_PARTILHADA' || mo.modo === 'APROPRIAR';     // empresa/tecnico ja definidos
    const fixaEmp = mo.modo === 'APROPRIAR' ? mo.empresa : d.parteLoja, fixaTec = mo.modo === 'APROPRIAR' ? mo.tecnico : d.parteTecnico;
    const semMo = mo.modo === 'VENDA' && !mo.valor;      // VI sem mao de obra na venda
    const termino = '<div class="campos">'
      + '<label>Dia do término<input type="date" id="tdia" min="' + esc(o.aberta ? iso(o.aberta) : '') + '" max="' + hojeIso() + '"></label>'
      + '<label>Hora<select id="thora" title="de 30 em 30 minutos"><option value=""></option>' + SLOTS.map(x => '<option>' + x + '</option>').join('') + '</select></label>'
      + '<label class="l2">Mão de obra cobrada<input id="mo" class="num" inputmode="decimal" placeholder="0,00"'
        + (mo.modo === 'OS' ? '' : ' disabled value="' + brl(mo.valor) + '"') + '></label>'
      + '<label>Empresa<input id="emp" class="num" inputmode="decimal" placeholder="0,00"' + (fixa ? ' disabled value="' + brl(fixaEmp) + '"' : semMo ? ' disabled' : '') + '></label>'
      + '<label>Técnico<input id="tec" class="num" disabled value="' + (fixa ? brl(fixaTec) : '') + '"></label>'
      + '</div>'
      // 16/10/2026: linha separando o JA COBRADO (acima) do que ainda TEM A COBRAR (abaixo)
      + '<div class="mo-ad"><div class="mo-ad-tit">Mão de obra adicional' + ajuda('Serviço a mais do técnico: o valor vai para a conta dele. Quem paga: o cliente (entra no a receber) ou a empresa (cortesia, despesa da conta configurada no ★).') + '</div>'
      + '<div class="mo-ad-lin"><input id="ma-valor" class="num" inputmode="decimal" placeholder="0,00" value="0,00" title="valor da mão de obra adicional">'
      + '<select id="ma-paga" disabled title="quem paga a mão de obra adicional"><option value=""></option>'
      + '<option value="CLIENTE">a receber do cliente</option><option value="EMPRESA">paga pela empresa (cortesia)</option></select></div></div>'
      // 16/10/2026: o que sai do SALDO A COMPENSAR do consignado, conforme o destino escolhido
      // 16/10/2026: VENDA DEVOLVIDA = saldo a compensar do material vendido que voltou
      + '<div class="res-bloco"><div class="mo-ad-tit">Venda devolvida' + ajuda('Material vendido que voltou (saldo a compensar da devolução de material vendido). Se o destino do consignado for "troca", o material foi substituído pelo consignado.') + '</div>'
      + '<div class="res-lin"><span class="esq">preço venda <b id="v-rdevp">0,00</b></span><span id="v-rdevtipo"></span> <b id="v-rdev" class="roxo">R$ 0,00</b></div></div>'
      + '<div class="res-bloco forte"><div class="mo-ad-tit">Venda de consignado</div>'
      + '<div class="res-lin"><span class="rot">a receber do cliente</span> <b id="v-rvenda" class="roxo">R$ 0,00</b></div></div>'
      + '<div class="res-bloco"><div class="mo-ad-tit">Despesa complementar' + ajuda('Consignado usado como complementar/cortesia: vai para a despesa a preço de CUSTO (conta configurada no ★).') + '</div>'
      + '<div class="res-lin"><span class="esq" id="v-rcsaldo-l">saldo a compensar <b id="v-rcsaldo">0,00</b></span><span class="rot">a custo</span> <b id="v-rcompl" class="roxo">R$ 0,00</b></div></div>'
      + '<div class="totais" id="totais"></div>';     // 16/10/2026: "a receber do cliente" aqui dentro
    const ajudaTerm = semMo ? 'Sem mão de obra cobrada na venda nº ' + (o.venda ? o.venda.numero : '') + ': nada a dividir.'
      : fixa ? moTxt + '.'
      : moTxt + '. Informe a parte da empresa; o resto vai para a conta do técnico' + (o.tecnicoNome ? ' (' + o.tecnicoNome + ')' : '') + '.';

    $('ficha').innerHTML = '<div class="grade">'
      + caixa('Material vendido', vendido, 'valor <b>' + brl(totVend) + '</b>', '', 'saldo vendido <b id="v-vliq">' + brl(totVend) + '</b>', 1)
      + caixa('Devolução de material vendido', devVend, 'valor devolvido <b id="v-dev">0,00</b>', '', 'saldo a compensar <b id="v-dsaldo" class="roxo">0,00</b>', 1)
      + caixa('Material consignado (o técnico levou)', consig, 'total consignado <b id="v-lev">0,00</b>', 'cx-cons', '', 1)
      + caixa('Devolução de material consignado', devCons, 'valor material devolvido <b id="v-dcons">0,00</b>', 'cx-dcons',
        'saldo a compensar <b id="v-tot" class="roxo">0,00</b> ' + destSaldo, 1)
      + caixa('Término do serviço e mão de obra' + ajuda(ajudaTerm), termino, '', 'cx-term')
      + '</div>'
      // 16/10/2026: botoes ao lado da observacao, no mesmo nivel, do mesmo tamanho
      + '<div class="rodape-ficha"><div class="resumo so-obs"><label>Observação do serviço<textarea id="obs" maxlength="2000" rows="1" placeholder=" "></textarea></label></div>'
      + '<div class="acoes lado"><span class="msg" id="msg"></span>'
      + '<button type="button" class="btn" id="voltar">Voltar sem gravar</button>'
      + '<button type="button" class="btn preto" id="gravar">Gravar ordem de serviço</button></div></div>';

    $('obs').value = o.observacaoServico || '';
    if (o.terminoEm) { $('tdia').value = iso(o.terminoEm); $('thora').value = meiaHora(hora(o.terminoEm)); }
    opcoesHora();
    if (mo.modo === 'VENDA') $('emp').value = '';
    // 26/10/2026: valor combinado com o cliente no modal da OS
    if (mo.modo === 'OS' && mo.combinado) { $('mo').value = brl(mo.valor); $('emp').value = brl(mo.empresa || 0); }
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
    const maoAdicional = { valor: lerBrl($('ma-valor').value), paga: $('ma-paga').value };
    return { terminoDia: $('tdia').value, terminoHora: $('thora').value, maoDeObra: mo, maoAdicional,
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
    let dev = 0, devCusto = 0;
    d.vendidos.forEach((i, k) => {
      const n = Number((document.querySelector('[data-dv="' + k + '"]') || {}).value || 0);
      const cel = $('dvv-' + k); if (cel) cel.textContent = n ? brl(n * i.precoUnit) : '';
      dev += n * i.precoUnit;
      devCusto += n * ((d.custo || {})[i.codigo] || 0);
    });
    if ($('v-dev')) { $('v-dev').textContent = brl(dev); $('v-dsaldo').textContent = brl(dev);
      $('v-vliq').textContent = brl(d.vendidos.reduce((s, i) => s + i.total, 0) - dev); }
    const mo = c.maoDeObra, modo = d.maoDeObra.modo;
    if (modo !== 'JA_PARTILHADA' && modo !== 'APROPRIAR') $('tec').value = mo ? brl(Math.max(0, mo - c.empresa)) : '';
    const adCli = c.adicionais.filter(a => a.quem === 'CLIENTE').reduce((s, a) => s + a.valor, 0);
    const adTec = c.adicionais.filter(a => a.quem === 'TECNICO').reduce((s, a) => s + a.valor, 0);
    // mao de obra adicional: o combo so abre com valor
    const ma = c.maoAdicional, sm = $('ma-paga');
    sm.disabled = !ma.valor; if (!ma.valor) sm.value = '';
    const aReceber = cob + adCli + (modo === 'OS' ? mo : 0) + (ma.paga === 'CLIENTE' ? ma.valor : 0);
    const estorno = c.vendidos.filter(v => v.tratamento === 'ESTORNO')
      .reduce((s, v) => { const i = d.vendidos.find(x => x.codigo === v.codigo); return s + (i ? i.precoUnit * v.devolver : 0); }, 0);
    // 16/10/2026: sem "tecnico recebe · empresa" (ja esta nos campos Empresa/Tecnico)
    $('totais').innerHTML =
        (adTec ? 'cobrado do técnico <b>' + brl(adTec) + '</b><br>' : '')
      + (estorno ? 'estorno a combinar com o cliente <b>' + brl(estorno) + '</b><br>' : '')
      + '<span class="areceber"' + (aReceber ? '' : ' title="nada a receber: a OS fica liquidada"') + '>total a receber do cliente <b>R$ ' + brl(aReceber) + '</b></span>';
    // blocos do saldo a compensar (venda / complementar)
    $('v-rvenda').textContent = 'R$ ' + brl(cob);
    // 16/10/2026: saldo do consignado sem destino: avisa nos blocos e destaca o combo
    const semDest = tot > 0 && !$('dest-saldo').value;
    $('dest-saldo').classList.toggle('pede', semDest);
    fundoAviso('v-rvenda', semDest ? 'escolha o destino do saldo a compensar (R$ ' + brl(tot) + ')' : '');
    fundoAviso('v-rcompl', semDest ? 'escolha o destino do saldo a compensar' : '');
    // 17/10/2026: venda devolvida: preco de venda a esquerda; a direita o CUSTO que volta ao estoque
    $('v-rdevp').textContent = brl(dev);
    $('v-rdev').textContent = 'R$ ' + brl(devCusto);
    // complementar: o saldo (preco de venda) a esquerda; a direita o custo que vai para a despesa
    const ehCompl = $('dest-saldo').value === 'COMPLEMENTAR';
    $('v-rcsaldo').textContent = brl(ehCompl ? tot : 0);
    $('v-rdevtipo').textContent = !dev ? '' : c.consignados.some(p => p.destino === 'TROCA') ? 'troca pelo consignado' : 'voltou ao estoque';
    $('v-rcompl').textContent = 'R$ ' + brl(ncob);
  }

  // 16/10/2026: HORA DO TERMINO em intervalos de 30 minutos, das 07:00 as 19:00 (o servico nao
  // passa das 19h). Hoje: so ate a meia hora seguinte a agora (18:15 -> ate 18:30).
  const HORA_INI = 7, HORA_FIM = 19;
  const SLOTS = []; for (let h = HORA_INI; h <= HORA_FIM; h++) { SLOTS.push(String(h).padStart(2, '0') + ':00'); if (h < HORA_FIM) SLOTS.push(String(h).padStart(2, '0') + ':30'); }
  const meiaHora = hm => {                 // arredonda para cima, na meia hora: 18:15 -> 18:30, 18:31 -> 19:00
    const m = /^(\d{2}):(\d{2})$/.exec(hm || ''); if (!m) return '';
    let t = Math.ceil((+m[1] * 60 + +m[2]) / 30) * 30;
    t = Math.min(Math.max(t, HORA_INI * 60), HORA_FIM * 60);
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };
  const limiteHoje = () => { const a = new Date(); return meiaHora(String(a.getHours()).padStart(2, '0') + ':' + String(a.getMinutes()).padStart(2, '0')); };
  function opcoesHora() {                  // hoje: esconde as horas depois de agora (arredondado)
    const h = $('thora'), dia = $('tdia').value, lim = dia === hojeIso() ? limiteHoje() : '99:99';
    [...h.options].forEach(op => { if (op.value) { const fora = op.value > lim; op.hidden = fora; op.disabled = fora; } });
  }
  function conferirTermino(avisar) {
    const dia = $('tdia').value, h = $('thora');
    opcoesHora();
    if (dia > hojeIso()) { if (avisar) msg('O término não pode ser no futuro.'); return false; }
    if (dia === hojeIso() && h.value && h.value > limiteHoje()) {
      if (avisar) msg('Hora do término no futuro (agora são ' + hora(new Date()) + '): informe a hora em que o serviço terminou.');
      h.value = ''; h.focus();
      return false;
    }
    // corrigiu (tem hora valida): tira o aviso
    if (avisar && h.value && /^(Hora do término no futuro|O término não pode ser no futuro)/.test(($('msg') || {}).textContent || '')) msg('');
    return true;
  }

  // aviso dentro da linha de um bloco (no lugar do rotulo)
  function fundoAviso(id, txt) {
    const lin = $(id).parentNode;
    let av = lin.querySelector('.aviso');
    if (!av) { av = document.createElement('span'); av.className = 'aviso'; lin.insertBefore(av, lin.firstChild); }
    av.textContent = txt; av.hidden = !txt;
    const rot = lin.querySelector('.rot'); if (rot) rot.hidden = !!txt;
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
    ficha.addEventListener('change', ev => {
      sujo = true;
      if (ev.target.id === 'tdia' || ev.target.id === 'thora') conferirTermino(true);
      recalcular();
    });
    ficha.addEventListener('focusout', ev => {
      const el = ev.target;
      if ((el.classList.contains('num') || el.classList.contains('a-valor')) && !el.disabled && el.value.trim()) el.value = brl(lerBrl(el.value));
    });
    ficha.addEventListener('click', ev => { const x = ev.target.closest('.x'); if (x) { x.closest('.ad').remove(); sujo = true; recalcular(); } });
    // mao de obra adicional: Enter no valor pula para a observacao, ja com o comeco do texto
    $('ma-valor').addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const v = lerBrl($('ma-valor').value);
      $('ma-valor').value = brl(v);
      recalcular();
      if (!v) return;
      const obs = $('obs'), ini = 'mão de obra adicional R$ ' + brl(v) + ': ';
      if (!/m[aã]o de obra adicional/i.test(obs.value)) obs.value = (obs.value.trim() ? obs.value.trim() + '\n' : '') + ini;
      obs.focus(); obs.setSelectionRange(obs.value.length, obs.value.length);
      sujo = true;
    });
    $('gravar').addEventListener('click', gravar);
    $('voltar').addEventListener('click', () => { if (!sujo || confirm('Sair sem gravar o fechamento?')) { sujo = false; location.href = VOLTA; } });
  }

  async function gravar() {
    const c = ler(consAtual), o = d.os, modo = d.maoDeObra.modo;
    if (!c.terminoDia) { msg('Informe o dia do término.'); $('tdia').focus(); return; }
    if (o.aberta && c.terminoDia < iso(o.aberta)) { msg('O término é antes da abertura da OS (' + dataBr(iso(o.aberta)) + ').'); $('tdia').focus(); return; }
    if (c.terminoDia > hojeIso()) { msg('O término não pode ser no futuro.'); $('tdia').focus(); return; }
    if (!conferirTermino(true)) return;
    if (modo !== 'JA_PARTILHADA' && c.maoDeObra && c.empresa > c.maoDeObra) { msg('A parte da empresa é maior que a mão de obra.'); $('emp').focus(); return; }
    for (const a of c.adicionais) if (!a.valor || !a.motivo) { msg('Valor adicional: informe valor e motivo.'); return; }
    if (c.maoAdicional.valor && !c.maoAdicional.paga) { msg('Mão de obra adicional: escolha quem paga (cliente ou empresa).'); $('ma-paga').focus(); return; }
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
    if (modo !== 'JA_PARTILHADA' && modo !== 'APROPRIAR' && c.maoDeObra && !$('emp').value.trim()
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
  // 17/10/2026: ESPELHO da OS fechada no mesmo formato da ficha de fechamento (com os totais):
  // vendido | devolucao de vendido | termino ; consignado levou | devolucao de consignado
  function desenharConsulta() {
    const o = d.os, f = d.fechamento;
    if (!f) {
      $('ficha').innerHTML = '<div class="caixa"><div class="vazio">OS ' + esc(SIT[o.status] || o.status) + ', sem ficha de fechamento (fechada antes de 15/10/2026).</div></div>'
        + '<div class="acoes"><span class="msg" id="msg"></span><button type="button" class="btn" id="voltar">Voltar</button></div>';
      $('voltar').addEventListener('click', () => { location.href = VOLTA; });
      return;
    }
    const m = f.maoDeObra || {};
    const desc = x => '<td class="d" title="' + esc(x) + '">' + esc(x) + '</td>';
    // ---- vendido e devolucao de vendido ----
    const devV = new Map((f.devolucoesVendido || []).map(x => [Number(x.codigo), x]));
    const totVend = d.vendidos.reduce((s, i) => s + i.total, 0);
    const valDevV = (f.devolucoesVendido || []).reduce((s, x) => s + (x.valor || 0), 0);
    const custoDevV = (f.devolucoesVendido || []).reduce((s, x) => s + (x.quantidade || 0) * (x.custoUnit || (d.custo || {})[x.codigo] || 0), 0);
    const vendido = d.vendidos.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:36px"><col style="width:76px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Qtd</th><th class="n">Valor</th></tr></thead><tbody>'
        + d.vendidos.map(i => '<tr><td>' + i.codigo + '</td>' + desc(i.descricao) + '<td class="n">' + i.quantidade + '</td><td class="n">' + brl(i.total) + '</td></tr>').join('')
        + '</tbody></table>' : '<div class="vazio">OS sem venda.</div>';
    const devVend = d.vendidos.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:40px"><col style="width:52px"><col style="width:80px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Vend.</th><th class="n">Devol.</th><th class="n">Valor</th></tr></thead><tbody>'
        + d.vendidos.map(i => { const x = devV.get(Number(i.codigo));
            return '<tr><td>' + i.codigo + '</td>' + desc(i.descricao) + '<td class="n">' + i.quantidade + '</td><td class="n">' + (x ? '<b>' + x.quantidade + '</b>' : '0')
              + '</td><td class="n">' + (x ? brl(x.valor) : '') + '</td></tr>'; }).join('')
        + '</tbody></table>' : '<div class="vazio">Nada vendido.</div>';
    // ---- consignado: levou (no fechamento) = usado + devolvido na ficha ----
    const usadoDe = new Map((f.consignados || []).map(c => [String(c.id), c]));
    const devC = new Map((f.devolucoesConsignado || []).map(x => [String(x.id), x.quantidade]));
    const linhasC = (o.consignados || []).map(c => {
      const u = usadoDe.get(String(c.id)), dv = devC.get(String(c.id)) || 0, usado = u ? u.usado : 0;
      return { codigo: c.codigo, descricao: c.descricao, preco: c.precoUnit || 0, levou: usado + dv, devolveu: dv, usado,
               destino: u ? (u.destino || (u.cobrar ? 'VENDA' : 'COMPLEMENTAR')) : '', custo: u ? u.custoUnit || 0 : 0 };
    }).filter(l => l.levou > 0);
    const totLev = linhasC.reduce((s, l) => s + l.levou * l.preco, 0);
    const totDevC = linhasC.reduce((s, l) => s + l.devolveu * l.preco, 0);
    const saldoC = totLev - totDevC;
    const cob = linhasC.filter(l => l.destino === 'VENDA').reduce((s, l) => s + l.usado * l.preco, 0);
    const ncob = linhasC.filter(l => l.destino === 'COMPLEMENTAR').reduce((s, l) => s + l.usado * l.custo, 0);
    const destinos = [...new Set(linhasC.filter(l => l.usado > 0).map(l => l.destino))];
    const NOME_DEST = { VENDA: 'venda adicional', COMPLEMENTAR: 'complementar', TROCA: 'troca' };
    const consig = linhasC.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:48px"><col style="width:70px"><col style="width:76px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Levou</th><th class="n">Unit.</th><th class="n">Total</th></tr></thead><tbody>'
        + linhasC.map(l => '<tr><td>' + esc(l.codigo) + '</td>' + desc(l.descricao) + '<td class="n">' + l.levou + '</td><td class="n">' + brl(l.preco)
          + '</td><td class="n">' + brl(l.levou * l.preco) + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="vazio">Nenhum consignado.</div>';
    const devCons = linhasC.length
      ? '<table><colgroup><col style="width:48px"><col><col style="width:48px"><col style="width:68px"><col style="width:66px"></colgroup>'
        + '<thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Levou</th><th class="n">Devolveu</th><th class="n">Valor</th></tr></thead><tbody>'
        + linhasC.map(l => '<tr><td>' + esc(l.codigo) + '</td>' + desc(l.descricao) + '<td class="n">' + l.levou + '</td><td class="n">' + (l.devolveu ? '<b>' + l.devolveu + '</b>' : '0')
          + '</td><td class="n">' + (l.devolveu ? brl(l.devolveu * l.preco) : '') + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="vazio">Nada devolvido.</div>';
    // ---- termino, mao de obra e os blocos (como na ficha) ----
    const tEm = f.terminoEm ? new Date(f.terminoEm) : null;
    const devTipo = !valDevV ? '' : (f.devolucoesVendido || []).some(x => x.tratamento === 'TROCA') ? 'troca pelo consignado'
      : (f.devolucoesVendido || []).some(x => x.tratamento === 'ESTORNO') ? 'estorno a combinar' : 'voltou ao estoque';
    const lin = (rot, val) => '<div class="res-lin"><span class="rot">' + rot + '</span> <b class="roxo">R$ ' + brl(val) + '</b></div>';
    const termino = '<div class="campos">'
      + '<label>Dia do término<input disabled value="' + (tEm ? tEm.toLocaleDateString('pt-BR') : '') + '"></label>'
      + '<label>Hora<input disabled value="' + (tEm ? hora(tEm) : '') + '"></label>'
      + '<label class="l2">Mão de obra cobrada<input class="num" disabled value="' + brl(m.valor) + '"></label>'
      + '<label>Empresa<input class="num" disabled value="' + brl(m.empresa) + '"></label>'
      + '<label>Técnico<input class="num" disabled value="' + brl(m.tecnico) + '"></label></div>'
      + '<div class="mo-ad"><div class="mo-ad-tit">Mão de obra adicional</div><div class="mo-ad-lin">'
      + '<input class="num" disabled value="' + brl(f.maoAdicional ? f.maoAdicional.valor : 0) + '"><input disabled value="'
      + (!f.maoAdicional ? '' : f.maoAdicional.paga === 'EMPRESA' ? 'paga pela empresa (cortesia)' : 'a receber do cliente') + '"></div></div>'
      + '<div class="res-bloco"><div class="mo-ad-tit">Venda devolvida</div>'
      + '<div class="res-lin"><span class="esq">preço venda <b>' + brl(valDevV) + '</b></span><span>' + devTipo + '</span> <b class="roxo">R$ ' + brl(custoDevV) + '</b></div></div>'
      + '<div class="res-bloco forte"><div class="mo-ad-tit">Venda de consignado</div>' + lin('a receber do cliente', cob) + '</div>'
      + '<div class="res-bloco"><div class="mo-ad-tit">Despesa complementar</div><div class="res-lin"><span class="esq">saldo a compensar <b>'
      + brl(linhasC.filter(l => l.destino === 'COMPLEMENTAR').reduce((s, l) => s + l.usado * l.preco, 0)) + '</b></span><span class="rot">a custo</span> <b class="roxo">R$ ' + brl(ncob) + '</b></div></div>'
      + ((f.adicionais || []).length ? '<div class="res-bloco"><div class="mo-ad-tit">Valor adicional</div>'
          + f.adicionais.map(a => '<div class="dica">' + (a.quem === 'TECNICO' ? 'do técnico' : 'do cliente') + ' · ' + esc(a.motivo) + ' · R$ ' + brl(a.valor) + '</div>').join('') + '</div>' : '')
      + '<div class="totais"><span class="areceber">total a receber do cliente <b>R$ ' + brl(f.aReceber) + '</b></span>'
      + (f.estornoPendente ? '<br>estorno a combinar <b>' + brl(f.estornoPendente) + '</b>' : '')
      + '<br><span class="dica">fechada em ' + new Date(f.em).toLocaleString('pt-BR').slice(0, 17) + '</span></div>';

    // 17/10/2026: RESULTADO DA OS (o que a instalacao deixou para a empresa). Custos pelo preco de custo
    // atual do produto (cadastro).
    const cst = cod => (d.custo || {})[cod] || 0;
    const custoVend = d.vendidos.reduce((s, i) => s + i.quantidade * cst(i.codigo), 0);
    const custoConsV = linhasC.filter(l => l.destino === 'VENDA').reduce((s, l) => s + l.usado * (l.custo || cst(l.codigo)), 0);
    const cortesia = f.maoAdicional && f.maoAdicional.paga === 'EMPRESA' ? f.maoAdicional.valor : 0;
    // 17/10/2026 (Jorge): APURACAO num modal pequeno (canto de baixo, a direita), em coluna:
    // venda = vendido + mao de obra da EMPRESA (a do tecnico ja saiu na venda) + consignado vendido
    // custo = custo do vendido - o que voltou ao estoque + custo do consignado vendido
    // lucro parcial = venda - custo ; lucro final = parcial - complementar - cortesia
    const moEmp = m.empresa || 0;
    const vendaTot = totVend + moEmp + cob;
    const custoTot = custoVend - custoDevV + custoConsV;
    const parcial = vendaTot - custoTot, final = parcial - ncob - cortesia;
    const lapu = (t, v, cls) => '<tr class="' + (cls || '') + '"><td>' + t + '</td><td class="n">' + brl(v) + '</td></tr>';
    const apuracao = '<div class="apu" id="apu" hidden><div class="apu-cab"><b>Apuração da OS nº ' + esc(o.numero) + '</b>'
      + '<button type="button" class="x" id="apu-x" title="fechar">×</button></div><table>'
      + lapu('Valor vendido', totVend) + lapu('Mão de obra (empresa)', moEmp) + (cob ? lapu('Venda de consignado', cob) : '')
      + lapu('Total da venda', vendaTot, 'sub')
      + '<tr class="esp"><td colspan="2"></td></tr>'
      + lapu('Custo do vendido', custoVend) + lapu('(−) Voltou ao estoque', custoDevV) + (custoConsV ? lapu('Custo do consignado vendido', custoConsV) : '')
      + lapu('Total do custo', custoTot, 'sub')
      + '<tr class="esp"><td colspan="2"></td></tr>'
      + lapu('Venda', vendaTot) + lapu('(−) Custo', custoTot) + lapu('Lucro parcial', parcial, 'sub')
      + '<tr class="esp"><td colspan="2"></td></tr>'
      + lapu('(−) Material complementar', ncob) + (cortesia ? lapu('(−) Mão de obra cortesia', cortesia) : '')
      + '<tr class="fim"><td>Lucro final</td><td class="n">R$ ' + brl(final) + '</td></tr></table>'
      + '<div class="dica">' + (vendaTot ? (final / vendaTot * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% da venda · ' : '')
      + 'custos pelo preço de custo do cadastro</div></div>';

    $('ficha').innerHTML = '<div class="grade">'
      + caixa('Material vendido', vendido, 'valor <b>' + brl(totVend) + '</b>', '', 'saldo vendido <b>' + brl(totVend - valDevV) + '</b>', 1)
      + caixa('Devolução de material vendido', devVend, 'valor devolvido <b>' + brl(valDevV) + '</b>', '', 'saldo a compensar <b class="roxo">' + brl(valDevV) + '</b>', 1)
      + caixa('Material consignado (o técnico levou)', consig, 'total consignado <b>' + brl(totLev) + '</b>', 'cx-cons', '', 1)
      + caixa('Devolução de material consignado', devCons, 'valor material devolvido <b>' + brl(totDevC) + '</b>', 'cx-dcons',
          'saldo a compensar <b class="roxo">' + brl(saldoC) + '</b>' + (destinos.length ? ' <span class="tag">' + destinos.map(x => NOME_DEST[x] || x).join(' + ') + '</span>' : ''), 1)
      + caixa('Término do serviço e mão de obra', termino, '', 'cx-term')
      + '</div>' + apuracao
      + '<div class="rodape-ficha"><div class="resumo so-obs"><label>Observação do serviço<textarea disabled rows="1">' + esc(o.observacaoServico) + '</textarea></label></div>'
      + '<div class="acoes lado tres"><span class="msg" id="msg"></span>'
      + (REABRIR_ATIVO && (o.status === 'E' || (o.status === 'L' && f.semReceber)) ? '<button type="button" class="btn" id="reabrir" title="desfaz o fechamento: a OS volta a pendente">Reabrir</button>' : '')
      + '<button type="button" class="btn" id="apu-btn" title="venda, custo e lucro desta OS">Apuração</button>'
      + (o.status === 'E' && f.aReceber ? '<button type="button" class="btn" style="background:#059669;border-color:#059669;color:#fff" id="receber">Receber agora</button>' : '')
      + '<button type="button" class="btn roxo" id="voltar">Voltar</button></div></div>';
    $('voltar').addEventListener('click', () => { location.href = VOLTA; });
    $('apu-btn').addEventListener('click', () => { $('apu').hidden = !$('apu').hidden; });
    $('apu-x').addEventListener('click', () => { $('apu').hidden = true; });
    if ($('reabrir')) $('reabrir').addEventListener('click', reabrir);
    if ($('receber')) $('receber').addEventListener('click', () => {
      location.href = '/vendas/servicos/fluxo?os=' + encodeURIComponent(d.os.id) + '&volta=' + encodeURIComponent(location.pathname + location.search);
    });
  }

  // 17/10/2026 (Jorge): REABRIR desligado por enquanto: OS VI dificilmente e desfeita, so se a venda
  // for cancelada. O codigo fica pronto; para voltar o botao no espelho: true.
  const REABRIR_ATIVO = false;
  // 17/10/2026: antes de desfazer, mostra o que vai ser desfeito
  async function reabrir() {
    const f = d.fechamento || {}, o = d.os;
    const itens = [];
    if ((f.boletas || []).length) itens.push('• ' + f.boletas.length + ' lançamento(s) contábil(eis) do fechamento serão CANCELADOS');
    if (f.fluxoId) itens.push('• a linha de R$ ' + brl(f.aReceber) + ' a receber no fluxo de serviço será cancelada');
    if ((f.devolucoesConsignado || []).length) itens.push('• a devolução do consignado volta para o técnico (sai do estoque)');
    if ((f.devolucoesVendido || []).length) itens.push('• a devolução do material vendido é desfeita (sai do estoque)');
    if (f.maoDeObra && f.maoDeObra.tecnico) itens.push('• a parte do técnico (R$ ' + brl(f.maoDeObra.tecnico) + ') volta para a receita');
    if (!confirm('REABRIR a OS nº ' + o.numero + '?\n\nIsto desfaz o fechamento:\n' + (itens.join('\n') || '• nada lançado')
        + '\n\nA OS volta para PENDENTE e a ficha pode ser preenchida de novo.')) return;
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

  // ---------------------------------------------------------------------------
  // ★ CONFIGURACAO DE CONTAS desta pagina: 17/10/2026 a janela foi para /js/comum/config-contas.js
  // (a mesma da venda)
  if ($('nav-config')) $('nav-config').addEventListener('click', () => window.ConfigContas.abrir({ pagina: 'os-fechamento', titulo: 'fechamento da OS' }));

  // 16/10/2026: Voltar / Menu na faixa (perguntam se ha algo nao gravado)
  const sair = url => { if (!sujo || confirm('Sair sem gravar o fechamento?')) { sujo = false; location.href = url; } };
  $('nav-voltar').addEventListener('click', () => sair(VOLTA));
  $('nav-menu').addEventListener('click', () => sair('/usuariocontab/menu'));
  document.addEventListener('keydown', ev => { if (ev.altKey && ev.key === 'ArrowLeft') { ev.preventDefault(); sair(VOLTA); } });

  window.addEventListener('beforeunload', ev => { if (sujo) { ev.preventDefault(); ev.returnValue = ''; } });
  carregar();
})();
