/* Destino: C:\plataformaRota\public\js\contab\contabil\financeiro\fluxo.js
 * (caminho corrigido em 05/10/2026; antes dizia public/js/financeiro/fluxo.js)
 * Tela do Fluxo de Caixa — lê o Fluxo Projetado, saldo acumulado, filtro mês/ano
 *
 * Alterado em 03/10/2026:
 *  - data do movimento nasce HOJE (sabado/domingo -> a sexta); nao aceita data
 *    depois de hoje, sabado/domingo, nem mais de 5 dias uteis para tras
 *  - clique numa parcela de CARTAO (1.01.005.xxx) abre todas as parcelas em
 *    aberto daquela venda; botao "Antecipacao de cartao" lista todas as parcelas
 *    em aberto de um cartao
 *  - "Valor liquido pago pelo cartao": a diferenca vai para a despesa do cartao
 *    (taxa em R$ e %); API /financeiro/api/pagamento (cartao, cartoes, quitar)
 *  - recebimento de CARTAO: banco fixo CEF/Armacao (1.01.002.003, por contrato) e
 *    travado; data vem VAZIA para escolher; o valor liquido so abre depois da data;
 *    parcela de DEBITO nao tem antecipacao (o botao some)
 *  - cartao: escolhida a data, o foco vai para o valor liquido (fundo amarelo);
 *    Enter no liquido confirma o valor, libera e foca "Receber selecionados"
 *    (antes disso o botao fica desativado)
 *
 * Alterado em 05/10/2026: parcela de TITULO de venda (historico "... · título")
 *    recebe sempre no Banestes/Armacao (1.01.002.002), banco travado
 * Alterado em 05/10/2026: clique na parcela de cartao mostra SO a parcela clicada;
 *    "Antecipacao de cartao" traz as outras a vencer daquela venda; "todos" traz e
 *    marca todas as parcelas em aberto do cartao (todas as vendas). Caixa "Valor
 *    total do cartao" ao lado do valor liquido
 * Alterado em 05/10/2026: "todos" = todas as parcelas em aberto do CLIENTE daquela
 *    venda neste cartao (todas as vendas dele), ja marcadas
 * Alterado em 05/10/2026: janela da boleta mostra a contrapartida NEGATIVA (taxa do
 *    cartao) do lado do banco, em valor positivo; cada lado com o seu total
 */
(() => {
  'use strict';
  console.log('%c🌊 fluxo.js v4.2 - dropdown banco código + nome', 'background:#6d28d9;color:white;padding:5px 11px;border-radius:4px;font-weight:bold;');

  const API = '/financeiro/api/fluxo';
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // Abre no mês corrente. Trazer o ano inteiro de saída enche a tela de
  // linhas que raramente interessam — o "todos" está a um clique.
  const state = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };

  async function api(path) {
    const res = await fetch(API + path);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
    return data;
  }

  const escAttr = v => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function fmt(v) {
    if (!v) return '';
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtData(d) {
    if (!d) return '';
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getFullYear()).slice(2)}`;
  }

  /* ===== Botões de mês ===== */
  function renderMeses() {
    const cont = $('#flx-meses');
    let html = '';
    MESES.forEach((m, i) => {
      html += `<button class="flx-mes-btn ${state.mes === i+1 ? 'ativo' : ''}" data-mes="${i+1}">${m.slice(0,3)}</button>`;
    });
    // "todos" fecha a fila, depois de Dez: é o passo seguinte a percorrer os
    // meses, não o começo.
    html += `<button class="flx-mes-btn flx-todos ${state.mes === null ? 'ativo' : ''}" data-mes="">todos</button>`;
    cont.innerHTML = html;
    $$('#flx-meses .flx-mes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.mes = btn.dataset.mes ? parseInt(btn.dataset.mes, 10) : null;
        renderMeses();
        carregar();
      });
    });
  }

  /* ===== Combo de ano ===== */
  function renderAnos() {
    const atual = new Date().getFullYear();
    const anos = [atual - 1, atual, atual + 1];
    $('#flx-ano').innerHTML = anos.map(a => `<option value="${a}" ${a===state.ano?'selected':''}>${a}</option>`).join('');
  }

  /* ===== Grid ===== */
  async function carregar() {
    const tbody = $('#flx-body');
    tbody.innerHTML = '<tr><td colspan="9" class="flx-empty">Carregando...</td></tr>';
    try {
      const q = '/' + state.ano + (state.mes ? `?mes=${state.mes}` : '');
      const data = await api(q);

      if (!data.linhas || data.linhas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="flx-empty">Nenhum lançamento no período. Lance projeções no Orçamento para vê-las aqui.</td></tr>';
        $('#flx-resumo').innerHTML = '';
        return;
      }

      // No modo "todos", uma linha em branco separa um mês do outro. Sem ela
      // os doze meses viram um bloco único e o olho se perde.
      let mesAnterior = null;

      tbody.innerHTML = data.linhas.map(l => {
        let separador = '';
        if (state.mes === null && l.vencimento) {
          const m = new Date(l.vencimento).getMonth();
          if (mesAnterior !== null && m !== mesAnterior) {
            separador = `<tr class="flx-sep"><td colspan="9">${MESES[m]}</td></tr>`;
          }
          mesAnterior = m;
        }
        // Define a ação conforme o pos:
        //  8 = despesa projetada → REALIZAR (vira pos 2)
        //  2 = despesa real → PAGAR
        //  5,1 = título a receber → RECEBER
        //  7 = compra projetada → só vira real na Entrada de NF (não clica aqui)
        let acao = '';
        if (l.pos === 8) acao = 'realizar';
        else if (l.pos === 2) acao = 'pagar';
        else if (l.pos === 5 || l.pos === 1) acao = 'receber';
        const isoData = l.vencimento ? new Date(l.vencimento).toISOString().slice(0,10) : '';
        const clicavel = acao ? 'flx-pagavel' : '';
        return separador + `
        <tr class="cor-${l.cor} ${clicavel}" data-acao="${acao}" data-data="${isoData}" data-conta="${escAttr(l.codigoConta)}" data-hist="${escAttr(l.historico)}">
          <td class="c-item">${l.item}</td>
          <td class="c-chave">${l.chave}</td>
          <td class="c-hist">${l.historico}</td>
          <td class="c-conta">${l.codigoConta}</td>
          <td class="c-pos"><span class="c-pos-badge">${l.pos}</span></td>
          <td class="c-vect">${fmtData(l.vencimento)}</td>
          <td class="c-receber">${l.aReceber ? '<span class="val-receber">'+fmt(l.aReceber)+'</span>' : ''}</td>
          <td class="c-pagar">${l.aPagar ? '<span class="val-pagar">'+fmt(l.aPagar)+'</span>' : ''}</td>
          <td class="c-saldo"><span class="${l.saldo>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(l.saldo)}</span></td>
        </tr>`;
      }).join('');

      // Clique na linha → ação conforme o pos
      $$('#flx-body tr.flx-pagavel').forEach(tr => {
        tr.addEventListener('click', () => {
          const acao = tr.dataset.acao;
          const dataLinha = tr.dataset.data;
          console.log('🖱️ clique linha → acao:', acao, '| data:', dataLinha);
          if (!dataLinha) { console.warn('sem data na linha'); return; }
          if (acao === 'realizar') abrirRealizacao(dataLinha);
          else if (acao === 'pagar') abrirPagamento(dataLinha, 'pagar');
          else if (acao === 'receber') abrirPagamento(dataLinha, 'receber', { conta: tr.dataset.conta, historico: tr.dataset.hist });
          else console.warn('acao não reconhecida:', acao);
        });
      });
      console.log('🔗 linhas clicáveis:', $$('#flx-body tr.flx-pagavel').length);

      const r = data.resumo;
      $('#flx-resumo').innerHTML = `
        <div class="flx-resumo-item"><span class="lbl">A receber</span><span class="val val-receber">${fmt(r.totalReceber)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">A pagar</span><span class="val val-pagar">${fmt(r.totalPagar)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Saldo do período</span><span class="val ${r.saldoFinal>=0?'val-saldo-pos':'val-saldo-neg'}">${fmt(r.saldoFinal)}</span></div>
        <div class="flx-resumo-item"><span class="lbl">Lançamentos</span><span class="val">${r.quantidade}</span></div>
      `;
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="flx-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  /* ===== PAGAMENTO EM LOTE ===== */
  const PAG_API = '/financeiro/api/pagamento';
  const pag = { tipo: 'pagar', data: '', titulos: [], marcados: new Set(), historicos: {}, debHist: null,
                cartao: null,        // { conta, historico } quando a lista e de cartao
                cartaoInfo: null,    // { codigo, nome, contaTaxa:{codigo,nome} } vindo da API
                cartoes: null,       // lista para a antecipacao
                liqOk: false };      // Enter no valor liquido ja confirmou o valor
  const PREFIXO_CARTAO = '1.01.005.';
  const BANCO_CARTAO = '1.01.002.003';   // CEF/Armacao: o cartao deposita sempre aqui (contrato)
  const ehDebito = h => /d[ée]bito\s*$/i.test(String(h || ''));
  const BANCO_TITULO = '1.01.002.002';   // Banestes/Armacao: cobranca dos titulos de venda
  const ehTitulo = h => /·\s*t[íi]tulo\s*$/i.test(String(h || ''));

  /* ---- data do movimento ----
     Nasce hoje; sabado/domingo vira a sexta. Nao pode passar de hoje, nem cair
     em fim de semana, nem voltar mais de 5 dias uteis. O servidor confere igual. */
  const isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fimDeSemana = d => d.getDay() === 0 || d.getDay() === 6;
  function dataMovimentoPadrao() {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    while (fimDeSemana(d)) d.setDate(d.getDate() - 1);
    return isoLocal(d);
  }
  function limiteRetroativo() {
    const d = new Date(); d.setHours(12, 0, 0, 0);
    let uteis = 0;
    while (uteis < 5) { d.setDate(d.getDate() - 1); if (!fimDeSemana(d)) uteis++; }
    return isoLocal(d);
  }
  function erroDataMovimento(txt) {
    if (!txt) return 'Informe a data do movimento.';
    const d = new Date(txt + 'T12:00:00');
    if (isNaN(d)) return 'Data do movimento inválida.';
    if (txt > isoLocal(new Date())) return 'A data do movimento não pode ser depois de hoje.';
    if (fimDeSemana(d)) return 'A data do movimento não pode ser sábado nem domingo.';
    if (txt < limiteRetroativo()) return 'A data do movimento pode voltar no máximo 5 dias úteis.';
    return '';
  }

  async function pagApi(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(PAG_API + path, opts);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `Erro ${res.status}`);
    return d;
  }

  async function carregarBancos() {
    try {
      const bancos = await pagApi('GET', '/bancos');
      pag.bancos = bancos;
      // Ordena pelo código contábil do subtítulo (1.01.002.001, 002, 003...).
      // Contas sem vínculo (subCodigo vazio) vão pro fim, claramente sinalizadas.
      bancos.sort((a, b) => {
        const ca = a.subCodigo || 'zzz';
        const cb = b.subCodigo || 'zzz';
        return ca.localeCompare(cb);
      });
      // Formato: "1.01.002.001 - Banestes/Armação"  (código primeiro, alinha em coluna)
      // Sem vínculo: "(sem vínculo) Apelido"
      $('#pag-banco').innerHTML = '<option value="">Selecione...</option>' +
        bancos.map(b => {
          const label = b.subCodigo
            ? `${b.subCodigo} - ${b.subNome || b.apelido}`
            : `(sem vínculo) ${b.apelido}`;
          return `<option value="${b._id}">${label}</option>`;
        }).join('');
    } catch (err) { console.warn('bancos:', err.message); }
  }

  async function abrirPagamento(data, tipo, cartao) {
    pag.tipo = tipo; pag.data = data; pag.marcados = new Set(); pag.historicos = {};
    const ehRec = tipo === 'receber';
    pag.cartao = ehRec && cartao && String(cartao.conta || '').startsWith(PREFIXO_CARTAO) ? cartao : null;
    pag.cartaoInfo = null;
    $('#pag-titulo').textContent = pag.cartao ? '💳 Recebimento de cartão' : (ehRec ? '💵 Recebimento em lote' : '💰 Pagamento em lote');
    $('#pag-header').className = 'pag-modal-header' + (ehRec ? ' receber' : '');
    $('#pag-confirmar').textContent = ehRec ? '💵 Receber selecionados' : '💰 Pagar selecionados';
    // data do movimento: hoje (ou a sexta); no cartao vem vazia para escolher
    $('#pag-data').value = pag.cartao ? '' : dataMovimentoPadrao();
    $('#pag-data').max = isoLocal(new Date());
    $('#pag-data').min = limiteRetroativo();
    $('#pag-data-dica').textContent = 'data: hoje ou até 5 dias úteis atrás, sem sábado/domingo';
    $('#pag-extra').hidden = !ehRec;
    $('#pag-antecipar').hidden = !!(pag.cartao && ehDebito(pag.cartao.historico));   // debito nao antecipa
    $('#pag-cartao-sel').hidden = true;
    $('#pag-liquido').value = '';
    pag.liqOk = false;
    await carregarBancos();
    if (pag.cartao) modoCartao(true);
    else if (ehRec && cartao && ehTitulo(cartao.historico)) travarBanco(BANCO_TITULO);
    else modoCartao(false);
    $('#pag-todos-cartao').hidden = true;
    if (pag.cartao) await carregarCartao(pag.cartao.conta, pag.cartao.historico, data, 'clicado');
    else await carregarJanela();
    $('#pag-modal').hidden = false;
  }

  // cartao: banco fixo (CEF/Armacao) e travado; fora do cartao o select volta livre
  function modoCartao(liga) {
    $('#pag-banco').disabled = false;
    if (liga) travarBanco(BANCO_CARTAO);
  }
  // seleciona o banco pelo codigo da conta e trava o select
  function travarBanco(codigo) {
    const sel = $('#pag-banco');
    const b = (pag.bancos || []).find(x => x.subCodigo === codigo);
    if (b) { sel.value = b._id; sel.disabled = true; } else sel.disabled = false;
  }

  // o valor liquido so abre depois de escolhida uma data valida
  function travaLiquido() {
    const ok = !!$('#pag-data').value && !erroDataMovimento($('#pag-data').value);
    const inp = $('#pag-liquido');
    inp.disabled = !ok;
    inp.placeholder = ok ? 'Enter = igual ao total' : 'escolha antes a data do recebimento';
    if (!ok) { inp.value = ''; pag.liqOk = false; }
    return ok;
  }

  // parcelas em aberto de um cartao (todas as datas); com historico, so as da venda
  // modo: 'clicado' = so a(s) parcela(s) do dia clicado; 'venda' = todas daquela venda
  //       (mantem as ja marcadas); 'cartao' = todas do cartao, todas marcadas
  async function carregarCartao(conta, historico, dataBase, modo = 'venda') {
    const tbody = $('#pag-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Carregando...</td></tr>';
    try {
      const q = new URLSearchParams({ conta });
      if (historico) q.set('historico', historico);
      if (dataBase) q.set('data', dataBase);
      if (modo === 'cliente') q.set('cliente', '1');
      let d = await pagApi('GET', '/cartao?' + q.toString());
      if (historico && modo !== 'cliente' && !(d.titulos || []).length) {   // historico nao bateu: mostra o cartao inteiro
        q.delete('historico');
        d = await pagApi('GET', '/cartao?' + q.toString());
      }
      pag.cartaoInfo = d.cartao || null;
      const todos = d.titulos || [];
      const antes = pag.marcados;
      if (modo === 'clicado') {
        const doDia = todos.filter(t => t.noDia);
        pag.titulos = doDia.length ? doDia : todos;
        pag.marcados = new Set(pag.titulos.map(t => t._id));
      } else if (modo === 'cartao' || modo === 'cliente') {
        pag.titulos = todos;
        pag.marcados = new Set(todos.map(t => t._id));
      } else {
        pag.titulos = todos;
        pag.marcados = new Set(todos.filter(t => antes.has(t._id) || t.noDia).map(t => t._id));
      }
      pag.liqOk = false;
      renderJanela();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="pag-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  // botao "Antecipacao de cartao": escolhe o cartao e lista todas as parcelas dele
  async function antecipar() {
    const sel = $('#pag-cartao-sel');
    if (pag.cartao && pag.cartao.historico) {              // veio de uma parcela: as outras da venda
      $('#pag-titulo').textContent = '💳 Antecipação de cartão';
      await carregarCartao(pag.cartao.conta, pag.cartao.historico, pag.data, 'venda');
      $('#pag-todos-cartao').hidden = false;
      return;
    }
    try {
      if (!pag.cartoes) pag.cartoes = await pagApi('GET', '/cartoes');
      sel.innerHTML = '<option value="">escolha o cartão…</option>'
        + pag.cartoes.map(c => `<option value="${escAttr(c.codigo)}">${escAttr(c.codigo)} - ${escAttr(c.nome)}</option>`).join('');
      if (pag.cartao) sel.value = pag.cartao.conta;
      sel.hidden = false;
      sel.focus();
    } catch (err) { alert('Erro: ' + err.message); }
  }
  async function escolherCartaoAntecipacao() {
    const conta = $('#pag-cartao-sel').value;
    if (!conta) return;
    pag.cartao = { conta, historico: '' };
    pag.historicos = {};
    $('#pag-liquido').value = '';
    $('#pag-data').value = '';
    pag.liqOk = false;
    modoCartao(true);
    $('#pag-titulo').textContent = '💳 Antecipação de cartão';
    await carregarCartao(conta, '', '', 'venda');
    $('#pag-todos-cartao').hidden = false;
  }

  // "todos": todas as parcelas em aberto do CLIENTE da venda clicada, neste cartao,
  // de todas as vendas dele, ja marcadas (sem venda clicada: o cartao inteiro)
  async function todasDoCartao() {
    if (!pag.cartao) return;
    if (pag.cartao.historico) {
      $('#pag-titulo').textContent = '💳 Antecipação de cartão — todas do cliente';
      await carregarCartao(pag.cartao.conta, pag.cartao.historico, '', 'cliente');
    } else {
      $('#pag-titulo').textContent = '💳 Antecipação de cartão — todas as parcelas';
      await carregarCartao(pag.cartao.conta, '', '', 'cartao');
    }
  }

  async function carregarJanela() {
    const tbody = $('#pag-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Carregando...</td></tr>';
    try {
      const d = await pagApi('GET', `/janela?data=${pag.data}&tipo=${pag.tipo}&dias=2`);
      pag.titulos = d.titulos || [];
      // marca por padrão os do dia
      pag.marcados = new Set(pag.titulos.filter(t => t.noDia).map(t => t._id));
      renderJanela();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="pag-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  function renderJanela() {
    const tbody = $('#pag-tbody');
    if (pag.titulos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Nenhum título na janela de datas.</td></tr>';
      atualizarResumoPag();
      return;
    }
    tbody.innerHTML = pag.titulos.map(t => {
      const marc = pag.marcados.has(t._id);
      const histAtual = pag.historicos[t._id] !== undefined ? pag.historicos[t._id] : t.historico;
      return `<tr class="${marc ? 'marcado' : ''} ${t.noDia ? '' : 'fora-do-dia'}" data-id="${t._id}">
        <td class="pl-check"><input type="checkbox" ${marc ? 'checked' : ''} data-id="${t._id}"></td>
        <td class="pl-data">${fmtData(t.vencimento)}${t.noDia ? '' : ' ⚠️'}</td>
        <td class="pl-hist">
          <input type="text" class="pl-hist-input" data-id="${t._id}" data-conta="${t.codigoConta || ''}"
                 value="${(histAtual || '').replace(/"/g,'&quot;')}" list="dl-${t._id}" autocomplete="off">
          <datalist id="dl-${t._id}"></datalist>
        </td>
        <td class="pl-conta">${t.codigoConta || '-'}</td>
        <td class="pl-valor">${fmt(t.valor)}</td>
      </tr>`;
    }).join('');
    // listeners checkbox
    $$('#pag-tbody input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) pag.marcados.add(cb.dataset.id);
        else pag.marcados.delete(cb.dataset.id);
        renderJanela();
      });
    });
    // listeners histórico (guarda edição + autocomplete que aprende)
    $$('#pag-tbody .pl-hist-input').forEach(inp => {
      inp.addEventListener('input', () => {
        pag.historicos[inp.dataset.id] = inp.value;
        sugerirHistoricos(inp);
      });
      inp.addEventListener('focus', () => sugerirHistoricos(inp));
    });
    atualizarResumoPag();
  }

  function atualizarResumoPag() {
    const marcados = pag.titulos.filter(t => pag.marcados.has(t._id));
    const total = marcados.reduce((s,t) => s + t.valor, 0);
    $('#pag-resumo').textContent = `${pag.marcados.size} marcado(s) · Total: ${fmt(total) || '0,00'}`;
    atualizarLiquido(marcados, total);
    // cartao: so libera depois do Enter no valor liquido
    const precisaLiq = !$('#pag-liq').hidden;
    $('#pag-confirmar').disabled = pag.marcados.size === 0 || (precisaLiq && !pag.liqOk);
  }

  // valor liquido: so quando tudo que esta marcado e de UM cartao
  function contaUnicaDeCartao(marcados) {
    const contas = [...new Set(marcados.map(t => t.codigoConta || ''))];
    return pag.tipo === 'receber' && contas.length === 1 && contas[0].startsWith(PREFIXO_CARTAO) ? contas[0] : '';
  }
  function atualizarLiquido(marcados, total) {
    const conta = contaUnicaDeCartao(marcados);
    $('#pag-liq').hidden = !conta;
    if (!conta) { $('#pag-liquido').value = ''; return; }
    const info = $('#pag-taxa-info');
    $('#pag-total-cartao').value = fmt(total) || '0,00';
    if (!travaLiquido()) { info.textContent = 'Escolha a data do recebimento para informar o valor líquido.'; return; }
    const liq = $('#pag-liquido').value.trim() ? parseMoeda($('#pag-liquido').value) : total;
    const taxaC = Math.round(total * 100) - Math.round(liq * 100);
    const despesa = pag.cartaoInfo && pag.cartaoInfo.codigo === conta && pag.cartaoInfo.contaTaxa
      ? pag.cartaoInfo.contaTaxa.codigo + ' ' + pag.cartaoInfo.contaTaxa.nome : 'a despesa ligada ao cartão';
    if (taxaC < 0) { info.innerHTML = '<b>O líquido não pode passar do total (' + fmt(total) + ').</b>'; return; }
    if (taxaC === 0) { info.innerHTML = 'Sem taxa: entra ' + (fmt(total) || '0,00') + ' no banco.'; return; }
    const pct = (taxaC / Math.round(total * 100) * 100).toFixed(2).replace('.', ',');
    info.innerHTML = 'No banco entra <strong>' + fmt(liq) + '</strong>. Taxa do cartão: <b>'
      + fmt(taxaC / 100) + ' (' + pct + '%)</b><br>lançada em ' + despesa + '.';
  }

  // Autocomplete que aprende: busca históricos da conta/termo e preenche o datalist
  function sugerirHistoricos(input) {
    clearTimeout(pag.debHist);
    pag.debHist = setTimeout(async () => {
      const conta = input.dataset.conta || '';
      const termo = input.value || '';
      try {
        const params = new URLSearchParams({ conta, termo });
        const sugestoes = await pagApi('GET', '/historicos?' + params.toString());
        const dl = document.getElementById('dl-' + input.dataset.id);
        if (dl) dl.innerHTML = sugestoes.map(s => `<option value="${s.replace(/"/g,'&quot;')}">`).join('');
      } catch (_) {}
    }, 250);
  }

  async function confirmarPagamento() {
    if (pag.marcados.size === 0) return;
    const bancoId = $('#pag-banco').value;
    if (!bancoId) { alert('Selecione o banco.'); return; }
    const erroData = erroDataMovimento($('#pag-data').value);
    if (erroData) { alert(erroData); $('#pag-data').focus(); return; }
    const marcados = pag.titulos.filter(t => pag.marcados.has(t._id));
    let valorLiquido;
    if (contaUnicaDeCartao(marcados) && $('#pag-liquido').value.trim()) {
      valorLiquido = parseMoeda($('#pag-liquido').value);
      const total = marcados.reduce((s, t) => s + t.valor, 0);
      if (valorLiquido <= 0 || Math.round(valorLiquido * 100) > Math.round(total * 100)) {
        alert('O valor líquido deve ser maior que zero e no máximo ' + fmt(total) + '.'); return;
      }
    }
    const btn = $('#pag-confirmar');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      const r = await pagApi('POST', '/quitar', {
        tipo: pag.tipo,
        data: $('#pag-data').value,
        contaBancariaId: bancoId,
        titulosIds: Array.from(pag.marcados),
        historicos: pag.historicos,
        valorLiquido
      });
      $('#pag-modal').hidden = true;
      carregar(); // recarrega o fluxo (títulos pagos somem)
      // abre a boleta gerada
      abrirBoleta(r.boletaId);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = pag.tipo === 'receber' ? '💵 Receber selecionados' : '💰 Pagar selecionados';
    }
  }

  /* ===== REALIZAÇÃO DE DESPESA (pos 8 → pos 2) ===== */
  const REAL_API = '/financeiro/api/realizacao';
  const real = { data: '', titulos: [], marcados: new Set(), edits: {} };

  async function realApi(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(REAL_API + path, opts);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.erro || `Erro ${res.status}`);
    return d;
  }

  async function abrirRealizacao(data) {
    real.data = data; real.marcados = new Set(); real.edits = {};
    const tbody = $('#real-tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Carregando...</td></tr>';
    $('#real-modal').hidden = false;
    try {
      const d = await realApi('GET', `/janela?data=${data}&dias=2`);
      real.titulos = d.titulos || [];
      real.marcados = new Set(real.titulos.filter(t => t.noDia).map(t => t._id));
      renderRealizacao();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="pag-empty">Erro: ${err.message}</td></tr>`;
    }
  }

  function renderRealizacao() {
    const tbody = $('#real-tbody');
    if (real.titulos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="pag-empty">Nenhuma despesa projetada (pos 8) na janela.</td></tr>';
      atualizarResumoReal();
      return;
    }
    tbody.innerHTML = real.titulos.map(t => {
      const marc = real.marcados.has(t._id);
      const e = real.edits[t._id] || {};
      const hist = e.historico !== undefined ? e.historico : t.historico;
      const val = e.valor !== undefined ? e.valor : fmt(t.valor);
      const doc = e.documento !== undefined ? e.documento : '';
      const venc = t.vencimento ? new Date(t.vencimento).toISOString().slice(0,10) : '';
      return `<tr class="${marc ? 'marcado' : ''} ${t.noDia ? '' : 'fora-do-dia'}">
        <td class="pl-check"><input type="checkbox" ${marc ? 'checked' : ''} data-id="${t._id}"></td>
        <td class="pl-data">${fmtData(t.vencimento)}${t.noDia ? '' : ' ⚠️'}
          <input type="hidden" data-venc="${t._id}" value="${venc}"></td>
        <td class="pl-hist"><input type="text" class="pl-edit" data-hist="${t._id}" value="${(hist||'').replace(/"/g,'&quot;')}"></td>
        <td><input type="text" class="pl-edit" data-doc="${t._id}" value="${(doc||'').replace(/"/g,'&quot;')}" placeholder="NF/doc"></td>
        <td class="pl-valor"><input type="text" class="pl-edit valor" data-valor="${t._id}" value="${val}"></td>
      </tr>`;
    }).join('');
    // checkboxes
    $$('#real-tbody input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) real.marcados.add(cb.dataset.id); else real.marcados.delete(cb.dataset.id);
        renderRealizacao();
      });
    });
    // edições (histórico, documento, valor)
    $$('#real-tbody .pl-edit').forEach(inp => {
      inp.addEventListener('input', () => {
        const id = inp.dataset.hist || inp.dataset.doc || inp.dataset.valor;
        if (!real.edits[id]) real.edits[id] = {};
        if (inp.dataset.hist !== undefined && inp.dataset.hist) real.edits[id].historico = inp.value;
        if (inp.dataset.doc !== undefined && inp.dataset.doc) real.edits[id].documento = inp.value;
        if (inp.dataset.valor !== undefined && inp.dataset.valor) {
          inp.value = mascaraMoeda(inp.value);
          real.edits[id].valor = inp.value;
        }
      });
    });
    atualizarResumoReal();
  }

  function atualizarResumoReal() {
    $('#real-resumo').textContent = `${real.marcados.size} marcada(s)`;
    $('#real-confirmar').disabled = real.marcados.size === 0;
  }

  // máscara de moeda (compartilhada)
  function mascaraMoeda(str) {
    let dig = String(str).replace(/\D/g, '');
    if (!dig) return '';
    dig = dig.replace(/^0+/, '') || '0';
    while (dig.length < 3) dig = '0' + dig;
    const c = dig.slice(-2);
    let i = dig.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return i + ',' + c;
  }
  function parseMoeda(s) {
    if (!s) return 0;
    return Number(String(s).replace(/\./g,'').replace(',','.')) || 0;
  }

  async function confirmarRealizacao() {
    if (real.marcados.size === 0) return;
    const btn = $('#real-confirmar');
    btn.disabled = true; btn.textContent = 'Processando...';
    try {
      const itens = Array.from(real.marcados).map(id => {
        const e = real.edits[id] || {};
        const venc = $(`#real-tbody input[data-venc="${id}"]`)?.value || '';
        return {
          id,
          valor: e.valor !== undefined ? parseMoeda(e.valor) : undefined,
          documento: e.documento || '',
          vencimento: venc,
          historico: e.historico
        };
      });
      const r = await realApi('POST', '/realizar', { itens });
      $('#real-modal').hidden = true;
      carregar();
      alert(`${r.realizadas} despesa(s) realizada(s)! Agora aparecem como pos 2 (a pagar).`);
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = '✅ Realizar selecionadas';
    }
  }

  /* ===== BOLETA ===== */
  let boletaAtual = null;
  async function abrirBoleta(id) {
    try {
      const b = await pagApi('GET', '/boleta/' + id);
      boletaAtual = b;
      const ehRec = b.tipo === 'RECEBIMENTO';
      $('#bol-titulo').textContent = `Boleta ${b.codigo} — ${b.tipo}`;

      // lado do banco: o banco + as contrapartidas invertidas (valor negativo, ex.: taxa do cartao)
      // outro lado: as contrapartidas normais. Os dois totais tem que bater.
      const linha = (cod, nome, hist, v) => `
        <tr>
          <td class="bol-cod">${cod || '-'}</td>
          <td>${nome || '-'}</td>
          <td>${hist || ''}</td>
          <td class="v">${fmt(v)}</td>
        </tr>`;
      const invertidas = (b.contrapartidas || []).filter(c => (c.valor || 0) < 0);
      const normais    = (b.contrapartidas || []).filter(c => (c.valor || 0) >= 0);
      const totBanco = (b.valorTotal || 0) + invertidas.reduce((t, c) => t - c.valor, 0);
      const totOutro = normais.reduce((t, c) => t + (c.valor || 0), 0);
      const cab = '<thead><tr><th>Nº Conta</th><th>Nome da Conta</th><th>Histórico</th><th class="v">Valor</th></tr></thead>';

      $('#bol-body').innerHTML = `
        <div class="bol-secao credito">
          <h3>${ehRec ? 'Débito (entrada no banco)' : 'Crédito (saída do banco)'}</h3>
          <table class="bol-tabela">${cab}<tbody>
            ${linha(b.bancoCodigo, b.bancoNome, b.historico, b.valorTotal)}
            ${invertidas.map(c => linha(c.codigoConta, c.nomeConta, c.historico, -c.valor)).join('')}
          </tbody></table>
          ${invertidas.length ? `<div class="bol-total">Total: ${fmt(totBanco)}</div>` : ''}
        </div>
        <div class="bol-secao debito">
          <h3>${ehRec ? 'Crédito (receitas)' : 'Débito (contrapartidas)'}</h3>
          <table class="bol-tabela">${cab}
            <tbody>${normais.map(c => linha(c.codigoConta, c.nomeConta, c.historico, c.valor)).join('')}</tbody>
          </table>
          <div class="bol-total">Total: ${fmt(totOutro)}</div>
        </div>`;
      $('#bol-estornar').style.display = (b.status === 'CANCELADO') ? 'none' : '';
      $('#bol-modal').hidden = false;
    } catch (err) {
      alert('Erro ao abrir boleta: ' + err.message);
    }
  }

  async function estornarBoleta() {
    if (!boletaAtual) return;
    if (!confirm('Estornar esta boleta? Os títulos voltam ao Fluxo.')) return;
    try {
      await pagApi('POST', `/boleta/${boletaAtual._id}/estornar`);
      $('#bol-modal').hidden = true;
      carregar();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  }

  /* ===== Listeners dos modais ===== */
  $('#pag-close').addEventListener('click', () => $('#pag-modal').hidden = true);
  $('#pag-cancelar').addEventListener('click', () => $('#pag-modal').hidden = true);
  $('#pag-confirmar').addEventListener('click', confirmarPagamento);
  $('#pag-antecipar').addEventListener('click', antecipar);
  $('#pag-todos-cartao').addEventListener('click', todasDoCartao);
  $('#pag-cartao-sel').addEventListener('change', escolherCartaoAntecipacao);
  function dataEscolhida() {
    pag.liqOk = false;
    atualizarResumoPag();
    const inp = $('#pag-liquido');
    if (!$('#pag-liq').hidden && !inp.disabled) inp.focus();
  }
  $('#pag-data').addEventListener('change', dataEscolhida);
  $('#pag-data').addEventListener('input', () => { if ($('#pag-data').value) dataEscolhida(); });
  $('#pag-liquido').addEventListener('input', (e) => {
    e.target.value = mascaraMoeda(e.target.value);
    pag.liqOk = false;
    atualizarResumoPag();
  });
  $('#pag-liquido').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const marcados = pag.titulos.filter(t => pag.marcados.has(t._id));
    const total = marcados.reduce((s, t) => s + t.valor, 0);
    const v = e.target.value.trim() ? parseMoeda(e.target.value) : total;   // vazio = sem taxa
    if (v <= 0 || Math.round(v * 100) > Math.round(total * 100)) {
      $('#pag-taxa-info').innerHTML = '<b>O líquido deve ser maior que zero e no máximo ' + fmt(total) + '.</b>';
      return;
    }
    if (!e.target.value.trim()) e.target.value = mascaraMoeda(Math.round(total * 100));
    pag.liqOk = true;
    atualizarResumoPag();
    $('#pag-confirmar').focus();
  });
  // marcar/desmarcar parcela muda o total: o liquido precisa ser confirmado de novo
  $('#pag-tbody').addEventListener('change', (e) => { if (e.target.type === 'checkbox') pag.liqOk = false; }, true);
  $('#pag-todos').addEventListener('change', () => { pag.liqOk = false; }, true);
  $('#pag-todos').addEventListener('change', (e) => {
    if (e.target.checked) pag.titulos.forEach(t => pag.marcados.add(t._id));
    else pag.marcados.clear();
    renderJanela();
  });
  $('#bol-close').addEventListener('click', () => $('#bol-modal').hidden = true);
  $('#bol-fechar').addEventListener('click', () => $('#bol-modal').hidden = true);
  $('#bol-estornar').addEventListener('click', estornarBoleta);

  // Realização
  $('#real-close').addEventListener('click', () => $('#real-modal').hidden = true);
  $('#real-cancelar').addEventListener('click', () => $('#real-modal').hidden = true);
  $('#real-confirmar').addEventListener('click', confirmarRealizacao);
  $('#real-todos').addEventListener('change', (e) => {
    if (e.target.checked) real.titulos.forEach(t => real.marcados.add(t._id));
    else real.marcados.clear();
    renderRealizacao();
  });

  /* ===== Listeners ===== */
  $('#flx-ano').addEventListener('change', (e) => { state.ano = parseInt(e.target.value, 10); carregar(); });

  /* ===== Init ===== */
  (function init() {
    renderAnos();
    renderMeses();
    carregar();
  })();
})();
