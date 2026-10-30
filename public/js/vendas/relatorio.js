// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\relatorio.js
// Criado em: 03/10/2026
//
// RELATORIO DE VENDAS mes a mes (como o Fluxo de Caixa).
//   - abre no mes corrente; "todos" mostra o ano com separador de mes
//   - duplo clique (ou Enter na linha marcada) abre a venda
//   - rodape: cupons, notas, descontos e liquido; canceladas fora da soma
// API: GET /vendas/api/venda/relatorio?ano=&mes=   (valores em CENTAVOS)
//
// Alterado em 30/10/2026 (6): SEM CALENDARIO (decisao do Jorge). Abre em HOJE (todas as vendas do dia); as abas
//   Todas / Nota fiscal / Cupom mostram o MES marcado (ao sair do Hoje, o mes corrente); Jan..Dez / todos / ano escolhem.
// Alterado em 30/10/2026 (5): "Hoje" LIGA/DESLIGA so as vendas de hoje (todas) sem mudar o calendario; mes, ano ou
//   data no calendario desligam o Hoje.
// Alterado em 30/10/2026 (4): a aba so FILTRA o periodo que esta na tela (nao muda as datas); mudar a data no calendario
//   ja mostra (sem precisar do Mostrar); "Hoje" mostra TODAS as vendas do dia (cupom e nota).
// Alterado em 30/10/2026 (3): ABRE NO MES CORRENTE (1o ao ultimo dia, botao do mes marcado); "Hoje" mostra so o dia.
// Alterado em 30/10/2026 (2): clicar numa aba mostra o MES inteiro daquele tipo (o mes da data inicial; abre em hoje).
// Alterado em 30/10/2026: abas Todas · Nota fiscal · Cupom (filtro na tela; o rodape soma o que esta na aba);
//   PERIODO "de … até …" (GET /relatorio?de=&ate=); ABRE NAS VENDAS DE HOJE. Jan..Dez / todos preenchem o periodo
//   do mes / do ano escolhido; o botao do mes fica marcado so quando o periodo e exatamente aquele mes.
// Alterado em 07/10/2026: so as EMITIDAS (pela data do fechamento). Clique na linha abre o
//   ESPELHO da venda (GET /:id/espelho): cabecalho, itens, pagamento e as parcelas no fluxo
//   (aberta / recebida / cancelada). "Cancelar venda" pede o motivo e chama POST /:id/cancelar;
//   se alguma parcela ja foi recebida, o servidor recusa e diz qual boleta estornar.
// Alterado em 07/10/2026: venda paga em mais de uma forma — o espelho lista todas as partes.
// Alterado em 08/10/2026: espelho so como modal (sem "Abrir na tela da venda"). Secao COBRANCA:
//   para cada parte, como foi cobrada — dinheiro/PIX: "recebido, entrou em <conta>" com a
//   boleta; cartao/titulo: a conta e as parcelas no fluxo com a situacao de cada uma.
// Alterado em 22/10/2026: ORDENAR clicando no cabecalho (Venda, Data, Cliente, Líquido; 2o clique inverte).
//   O separador de mes (modo "todos") so aparece na ordem por data. Cabecalho fixo (CSS).
// Alterado em 22/10/2026: VENDAS DO ACCESS (VENDA-11): etiqueta "Access" na linha; no espelho um aviso,
//   sem "Cancelar venda" e sem "+ Incluir instalação" (o lancamento, o fluxo e o estoque vieram do Access).
// Alterado em 17/10/2026: parcelas da cobranca rolam (div.rolar); o botao Cancelar venda fica no rodape fixo.
// Alterado em 14/10/2026: secao INSTALACAO no espelho da NF. Tem OS: numero, situacao, tecnico,
//   dia e o botao "Abrir a OS" (modal da OS, /js/vendas/os-modal.js). NF fechada sem OS:
//   "+ Incluir instalação" — marca os itens, tecnico e servico (opcionais) e abre a OS
//   (POST /:id/instalacao); a OS abre em seguida para agendar. Sem mao de obra: a venda
//   ja foi cobrada.
// =============================================================================

'use strict';

(function () {
  const API = '/vendas/api/venda/relatorio';
  const $ = id => document.getElementById(id);
  const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
                 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const hoje = new Date();
  // 30/10/2026: periodo (de/ate, YYYY-MM-DD) e aba do documento; abre em HOJE
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  // 30/10/2026 (3): abre no MES corrente (dia 1 ao ultimo dia), com o botao do mes marcado
  const estado = { ano: hoje.getFullYear(), mes: -1, de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
                   ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)), doc: 'TODAS', vendas: [], ord: 'data', desc: false,
                   soHoje: true };     // 30/10/2026 (6): ABRE EM HOJE (todas as vendas do dia)    // 30/10/2026 (5): botao Hoje ligado = so as vendas de hoje, SEM mexer no calendario
  const brData = t => t ? t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4) : '';
  // o mes (1..12) que o periodo cobre exatamente; 0 = o ano inteiro; -1 = outro periodo
  function mesDoPeriodo() {
    const a = estado.ano;
    if (estado.de === a + '-01-01' && estado.ate === a + '-12-31') return 0;
    for (let m = 1; m <= 12; m++) if (estado.de === iso(new Date(a, m - 1, 1)) && estado.ate === iso(new Date(a, m, 0))) return m;
    return -1;
  }
  function periodoDoMes(m) {
    const a = estado.ano;
    if (m === 0) { estado.de = a + '-01-01'; estado.ate = a + '-12-31'; }
    else { estado.de = iso(new Date(a, m - 1, 1)); estado.ate = iso(new Date(a, m, 0)); }
  }

  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const escapar = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dia = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };
  const hora = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  const SITUACAO = { A: 'aberta', F: 'fechada', C: 'cancelada' };

  function marcarBotoes() {
    estado.mes = mesDoPeriodo();
    $('meses').querySelectorAll('button[data-m]').forEach(b =>
      b.classList.toggle('ativo', !estado.soHoje && Number(b.dataset.m) === estado.mes));
  }

  async function carregar() {
    marcarBotoes();
    $('recado').textContent = '';
    $('linhas').innerHTML = '<tr><td colspan="11" class="vazio">Carregando…</td></tr>';
    try {
      const h = iso(new Date()), de = estado.soHoje ? h : estado.de, ate = estado.soHoje ? h : estado.ate;
      $('hoje').classList.toggle('prim', estado.soHoje);
      const r = await fetch(API + '?ano=' + estado.ano + '&de=' + de + '&ate=' + ate, { credentials: 'same-origin' });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      estado.vendas = d.vendas || [];
      montarAnos(d.anos || [estado.ano]);
      desenhar();
    } catch (e) {
      $('linhas').innerHTML = '<tr><td colspan="11" class="vazio">Erro ao carregar.</td></tr>';
      $('recado').textContent = e.message;
    }
  }

  function montarAnos(anos) {
    const sel = $('ano');
    if (!anos.includes(estado.ano)) anos = anos.concat(estado.ano).sort((a, b) => b - a);
    sel.innerHTML = anos.map(a => '<option value="' + a + '"' + (a === estado.ano ? ' selected' : '') + '>' + a + '</option>').join('');
  }

  // 22/10/2026: ordem escolhida no cabecalho (desempate pelo numero)
  function ordenadas() {
    const k = estado.ord, s = estado.desc ? -1 : 1;
    const lista = estado.doc === 'TODAS' ? estado.vendas : estado.vendas.filter(v => (v.documento === 'NFE' ? 'NFE' : 'CUPOM') === estado.doc);
    const val = v => k === 'numero' ? v.numero : k === 'liquido' ? (v.liquido || 0) : k === 'cliente' ? (v.cliente || '~balcão').toLowerCase()
      : new Date(v.data).getTime();
    return lista.slice().sort((a, b) => { const x = val(a), y = val(b);
      return (x < y ? -s : x > y ? s : 0) || (a.numero - b.numero); });
  }
  function marcarOrdem() {
    document.querySelectorAll('th.ord').forEach(th => { const on = th.dataset.ord === estado.ord;
      th.classList.toggle('on', on); th.querySelector('.seta').textContent = on ? (estado.desc ? '▼' : '▲') : '↕'; });
  }
  document.querySelectorAll('th.ord').forEach(th => th.addEventListener('click', () => {
    if (estado.ord === th.dataset.ord) estado.desc = !estado.desc;
    else { estado.ord = th.dataset.ord; estado.desc = th.dataset.ord === 'liquido'; }   // valor: maior primeiro
    desenhar();
  }));

  function desenhar() {
    marcarOrdem();
    const vs = ordenadas();
    // 30/10/2026: quantas em cada aba
    const nNfe = estado.vendas.filter(v => v.documento === 'NFE').length;
    $('n-todas').textContent = '(' + estado.vendas.length + ')'; $('n-nfe').textContent = '(' + nNfe + ')';
    $('n-cupom').textContent = '(' + (estado.vendas.length - nNfe) + ')';
    document.querySelectorAll('#abas-doc button').forEach(b => b.classList.toggle('ativo', b.dataset.doc === estado.doc));
    if (!vs.length) {
      const oque = estado.doc === 'NFE' ? 'nota fiscal' : estado.doc === 'CUPOM' ? 'cupom' : 'venda fechada';
      $('linhas').innerHTML = '<tr><td colspan="11" class="vazio">Nenhum(a) ' + oque + ' '
        + (estado.soHoje ? 'hoje (' + brData(iso(new Date())) + ')' : estado.mes > 0 ? 'em ' + MESES[estado.mes] + ' de ' + estado.ano
          : estado.de === estado.ate ? 'em ' + brData(estado.de) + (estado.de === iso(new Date()) ? ' (hoje)' : '')
          : 'de ' + brData(estado.de) + ' a ' + brData(estado.ate)) + '.</td></tr>';
    } else {
      let mesAtual = 0, n = 0, html = '';
      const variosMeses = estado.de.slice(0, 7) !== estado.ate.slice(0, 7);
      for (const v of vs) {
        const dv = new Date(v.data), m = dv.getMonth() + 1, chave = dv.getFullYear() * 100 + m;
        if (variosMeses && estado.ord === 'data' && chave !== mesAtual) {      // separador de mes (periodo com mais de um mes)
          mesAtual = chave;
          html += '<tr class="sep"><td colspan="11">' + MESES[m] + '</td></tr>';
        }
        n++;
        const canc = v.situacao === 'C';
        html += '<tr class="v' + (canc ? ' cancelada' : '') + '" data-id="' + escapar(v._id) + '" tabindex="0" title="clique: espelho da venda">'
          + '<td class="n cinza">' + n + '</td>'
          + '<td><b>nº ' + v.numero + '</b>' + (v.origem === 'ACCESS' ? ' <span class="etq access" title="importada do Access">Access</span>' : '') + '</td>'
          + '<td>' + dia(v.data) + ' <span class="cinza">' + hora(v.data) + '</span></td>'
          + '<td>' + (v.documento === 'NFE' ? '<span class="etq nfe">NF</span>' : '<span class="etq cupom">Cupom</span>') + '</td>'
          + '<td>' + (v.cliente ? escapar(v.cliente) + ' <span class="cinza">' + escapar(v.codigoCliente) + '</span>' : '<span class="cinza">balcão</span>') + '</td>'
          + '<td>' + (v.condicao === 'PRAZO' ? 'a prazo' : 'à vista') + '</td>'
          + '<td class="sit-' + escapar(v.situacao) + '">' + (SITUACAO[v.situacao] || escapar(v.situacao)) + '</td>'
          + '<td class="n">' + v.itens + '</td>'
          + '<td class="n">' + brl(v.bruto) + '</td>'
          + '<td class="n">' + (v.desconto ? brl(v.desconto) : '') + '</td>'
          + '<td class="n"><b>' + brl(v.liquido) + '</b></td>'
          + '</tr>';
      }
      $('linhas').innerHTML = html;
    }
    totais();
  }

  function totais() {
    const validas = ordenadas().filter(v => v.situacao !== 'C');          // 30/10/2026: so a aba escolhida
    const soma = (lista, campo) => lista.reduce((s, v) => s + (v[campo] || 0), 0);
    const cupons = validas.filter(v => v.documento !== 'NFE');
    const notas = validas.filter(v => v.documento === 'NFE');
    const qtd = n => n + (n === 1 ? ' venda' : ' vendas');
    $('t-cupom').textContent = brl(soma(cupons, 'liquido'));
    $('q-cupom').textContent = qtd(cupons.length);
    $('t-nfe').textContent = brl(soma(notas, 'liquido'));
    $('q-nfe').textContent = qtd(notas.length);
    $('t-desc').textContent = brl(soma(validas, 'desconto'));
    $('t-liq').textContent = brl(soma(validas, 'liquido'));
    $('q-total').textContent = qtd(validas.length);
  }

  // ---- eventos ----------------------------------------------------------------
  $('meses').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-m]');
    if (!b) return;
    periodoDoMes(Number(b.dataset.m));                 // 30/10/2026: o mes (ou o ano) vira o periodo
    estado.soHoje = false;
    carregar();
  });
  $('ano').addEventListener('change', ev => {
    const m = mesDoPeriodo();
    estado.ano = Number(ev.target.value);
    periodoDoMes(m >= 0 ? m : 0);                      // mesmo mes no outro ano (periodo livre: o ano todo)
    estado.soHoje = false;
    carregar();
  });
  // 30/10/2026: abas e periodo
  $('abas-doc').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-doc]'); if (!b) return;
    estado.doc = b.dataset.doc;
    // 30/10/2026 (6): saindo do Hoje, a aba mostra o MES (o que esta marcado; ao abrir, o mes corrente)
    if (estado.soHoje) { estado.soHoje = false; carregar(); } else desenhar();
  });
  // 30/10/2026 (6): Hoje = todas as vendas de hoje (cupom e nota)
  $('hoje').addEventListener('click', () => { estado.soHoje = true; estado.doc = 'TODAS'; carregar(); });

  const abrir = tr => { if (tr && tr.dataset.id) abrirEspelho(tr.dataset.id); };
  $('linhas').addEventListener('click', ev => abrir(ev.target.closest('tr.v')));
  $('linhas').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') abrir(ev.target.closest('tr.v'));
  });

  // ---- espelho da venda (modal) -------------------------------------------------
  const BASE = '/vendas/api/venda/';
  const FORMA = { DINHEIRO: 'dinheiro', PIX: 'PIX / transferência', DEBITO: 'cartão de débito', CREDITO: 'cartão de crédito', TITULO: 'título em banco',
                  RECEBER: 'a receber (paga depois)' };     // 16/10/2026
  const ST = { ATIVO: 'a receber', QUITADO: 'recebida', CANCELADO: 'cancelada' };
  let espId = null, espVenda = null, tecnicos = null;
  const SIT_OS = { P: 'pendente', E: 'concluída · a receber', L: 'liquidada', C: 'cancelada' };

  async function abrirEspelho(id) {
    espId = id;
    $('esp-conteudo').innerHTML = 'Carregando…';
    $('esp-msg').textContent = ''; $('esp-motivo').value = '';
    $('esp-cancel').hidden = true; $('esp-cancelar').hidden = true;
    const cx = $('esp-caixa'); cx.style.left = '50%'; cx.style.top = '6vh'; cx.style.transform = 'translateX(-50%)';
    $('esp-fundo').hidden = false; cx.hidden = false;
    try {
      const r = await fetch(BASE + id + '/espelho', { credentials: 'same-origin' });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      espVenda = d.venda;
      desenharEspelho(d.venda, d.parcelas || [], d.boletas || {}, d.contas || {}, d.os || null);
    } catch (e) { $('esp-conteudo').textContent = 'Erro: ' + e.message; }
  }

  function desenharEspelho(v, parcelas, boletas, contas, os) {
    const c = v.cliente || {};
    const pags = v.pagamentos || [];
    const p = pags[0] || {};
    const resumo = pags.map(x => escapar(FORMA[x.forma] || x.forma) + ' <b>' + brl(x.valor) + '</b>').join(' + ');
    $('esp-titulo').textContent = 'Venda nº ' + v.numero + ' · ' + (v.documento === 'NFE' ? 'Nota fiscal' : 'Cupom') + ' · '
      + (SITUACAO[v.situacao] || v.situacao);
    const campo = (r, val, cl) => '<div' + (cl ? ' class="' + cl + '"' : '') + '><span>' + r + '</span>' + (val || '—') + '</div>';
    const cab = '<div class="esp-grade">'
      + campo('Cliente', c.nome ? escapar(c.nome) + ' <span class="cinza">' + escapar(c.codigo) + '</span>' : 'balcão', 'l2')
      + campo('Fechada em', v.fechadaEm ? dia(v.fechadaEm) + ' ' + hora(v.fechadaEm) : '')
      + campo('Condição', v.condicao === 'PRAZO' ? 'a prazo' : 'à vista')
      + campo('Pagamento' + (pags.length > 1 ? ' (' + pags.length + ' partes)' : ''), resumo, 'l2')
      + campo('Conta do cliente', escapar(v.contabil?.contaCliente || ''))
      + campo('Receita', escapar(v.contabil?.contaReceita || ''))
      + '</div>';
    const itens = '<table><thead><tr><th>Código</th><th>Descrição</th><th class="n">Qtd</th><th class="n">Unitário</th>'
      + '<th class="n">Desconto</th><th class="n">Total</th></tr></thead><tbody>'
      + (v.itens || []).map(i => '<tr><td>' + i.codigo + '</td><td>' + escapar(i.descricao) + '</td><td class="n">' + i.quantidade
        + '</td><td class="n">' + brl(i.precoUnitario) + '</td><td class="n">' + (i.desconto ? brl(i.desconto) : '')
        + '</td><td class="n">' + brl(i.quantidade * i.precoUnitario - (i.desconto || 0)) + '</td></tr>').join('')
      + '</tbody><tfoot><tr><td colspan="5"><b>Líquido</b>' + (v.descontoGeral ? ' (desc. geral ' + brl(v.descontoGeral) + ')' : '')
      + '</td><td class="n"><b>' + brl(v.totalLiquido) + '</b></td></tr></tfoot></table>';
    // COBRANCA: como cada parte foi cobrada
    const porId = new Map(parcelas.map(x => [String(x._id), x]));
    const vreais = x => Number(x || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const cobranca = pags.map(x => {
      const conta = escapar(x.contaDestino || '') + (contas[x.contaDestino] ? ' ' + escapar(contas[x.contaDestino]) : '');
      const bol = x.boletaId && boletas[String(x.boletaId)];
      let corpo;
      if (x.parcelas && x.parcelas.length) {
        const onde = x.forma === 'TITULO' ? 'título em cobrança no ' + conta + ' — a receber do cliente'
          : x.forma === 'RECEBER' ? 'a receber do cliente (conta ' + conta + ') — paga na loja, pelo fluxo de caixa'
          : 'a receber do cartão ' + conta;
        corpo = '<div class="cob-txt">' + onde + ':</div><div class="rolar"><table><thead><tr><th>Parcela</th><th>Vencimento</th>'
          + '<th class="n">Valor</th><th>Situação</th></tr></thead><tbody>'
          + x.parcelas.map(pp => {
              const f = porId.get(String(pp.fluxoId)) || {};
              const st = f.status || 'ATIVO';
              return '<tr><td>' + pp.numero + '/' + x.parcelas.length + '</td><td>' + dia(pp.vencimento) + '</td><td class="n">'
                + brl(pp.valor) + '</td><td><span class="st ' + escapar(st) + '">' + (ST[st] || escapar(st)) + '</span>'
                + (f.boleta ? ' <span class="cinza">' + escapar(f.boleta) + '</span>' : '') + '</td></tr>';
            }).join('')
          + '</tbody></table></div>';
      } else {
        corpo = '<div class="cob-txt">Recebido no ato — entrou em <b>' + conta + '</b>'
          + (bol ? ' · lançamento ' + escapar(bol.codigo) + (v.documento === 'NFE' ? '' : ' (Vendas balcão do dia)') : '')
          + '.</div>';
      }
      return '<div class="cob"><div class="cob-cab"><span>' + escapar(FORMA[x.forma] || x.forma)
        + (x.parcelas && x.parcelas.length > 1 ? ' · ' + x.parcelas.length + 'x' : '') + '</span><b>R$ ' + brl(x.valor) + '</b></div>'
        + corpo + '</div>';
    }).join('') || (v.origem === 'ACCESS'
      ? '<div class="cinza">Venda feita no Access: a forma de pagamento, o lançamento e as parcelas estão no Access (já importados no razão e no fluxo).</div>'
      : '<div class="cinza">Sem pagamento registrado.</div>');
    const parc = parcelas.length
      ? '<table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Conta</th><th class="n">Valor</th><th>Situação</th></tr></thead><tbody>'
        + parcelas.map(x => '<tr><td>' + x.parcela + '/' + x.totalParcelas + '</td><td>' + dia(x.vencimento) + '</td><td>'
          + escapar(x.codigoConta) + ' ' + escapar(x.nomeConta || '') + '</td><td class="n">'
          + Number(x.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          + '</td><td><span class="st ' + escapar(x.status) + '">' + (ST[x.status] || escapar(x.status)) + '</span>'
          + (x.boleta ? ' <span class="cinza">' + escapar(x.boleta) + '</span>' : '') + '</td></tr>').join('')
        + '</tbody></table>'
      : '<div class="cinza">Sem parcelas no fluxo (' + escapar(FORMA[p.forma] || 'à vista') + ').</div>';
    const cancelada = v.situacao === 'C'
      ? '<div class="esp-cancelada">Cancelada em ' + dia(v.canceladaEm) + ' ' + hora(v.canceladaEm)
        + ' — motivo: ' + escapar(v.motivoCancelamento || '') + '</div>' : '';
    const doAccess = v.origem === 'ACCESS'
      ? '<div class="esp-access">Importada do Access — cupom nº ' + escapar(v.nrCupomAccess || v.numero) + '. ' + escapar((v.observacao || '').replace(/^Importada do Access \(cupom nº \d+\)\.\s*/, '')) + '</div>' : '';
    $('esp-conteudo').innerHTML = doAccess + cab + '<h4>Itens</h4>' + itens + (v.origem === 'ACCESS' ? '' : secaoInstalacao(v, os))
      + '<h4>Cobrança</h4>' + cobranca + cancelada;
    const podeCancelar = v.situacao === 'F' && v.origem !== 'ACCESS';
    $('esp-cancelar').hidden = !podeCancelar;
    const recebida = parcelas.some(x => x.status === 'QUITADO');
    if (podeCancelar && recebida) {
      $('esp-msg').textContent = 'Há parcela já recebida: o cancelamento só será aceito depois de estornar o recebimento no fluxo.';
    }
  }

  // ---- instalacao (OS) ------------------------------------------------------------
  function secaoInstalacao(v, os) {
    if (v.documento !== 'NFE') return '';
    if (os && os.status !== 'C') {
      const quando = os.diaPrevisto ? dia(os.diaPrevisto) + (os.horaIni ? ' ' + escapar(os.horaIni) + (os.horaFim ? '–' + escapar(os.horaFim) : '') : '')
        : '<span class="sem">a agendar</span>';
      return '<h4>Instalação</h4><div class="ins-os"><div><b>OS nº ' + os.numero + '</b> · ' + escapar(SIT_OS[os.status] || os.status)
        + ' · ' + (os.tecnicoNome ? escapar(os.tecnicoNome) : '<span class="sem">sem técnico</span>') + ' · ' + quando
        + (os.servicoDescricao ? ' · ' + escapar(os.servicoDescricao) : '') + '</div>'
        + '<button type="button" class="ins-btn" data-abrir-os="' + escapar(os._id) + '">Abrir a OS</button></div>';
    }
    if (v.situacao !== 'F') return '';
    return '<h4>Instalação</h4><div class="ins-os"><div class="cinza">Sem instalação nesta venda.</div>'
      + '<button type="button" class="ins-btn roxo" id="ins-incluir">+ Incluir instalação</button></div>'
      + '<div class="ins-form" id="ins-form" hidden></div>';
  }

  async function abrirIncluir() {
    const f = $('ins-form');
    if (!f.hidden) { f.hidden = true; return; }
    f.hidden = false;
    f.innerHTML = 'Carregando técnicos…';
    try {
      if (!tecnicos) {
        const r = await fetch(BASE + 'tecnicos', { credentials: 'same-origin' });
        const d = await r.json();
        if (!d.ok) throw new Error(d.erro || 'falha na API');
        tecnicos = d.tecnicos || [];
      }
    } catch (e) { f.textContent = 'Erro: ' + e.message; return; }
    const v = espVenda;
    f.innerHTML = '<div class="ins-tit">Itens a instalar</div>'
      + (v.itens || []).map(i => '<label class="ins-item"><input type="checkbox" value="' + i.codigo + '"> '
        + i.codigo + ' — ' + escapar(i.descricao) + '</label>').join('')
      + '<div class="ins-linha"><label>Técnico<select id="ins-tec"><option value="">— escolher depois —</option>'
      + tecnicos.map(t => '<option value="' + escapar(t.conta) + '">' + escapar(t.nome) + '</option>').join('') + '</select></label>'
      + '<label>Serviço<select id="ins-serv"><option value="">—</option></select></label></div>'
      + '<label class="ins-obs">Observação<textarea id="ins-obs" placeholder="ex.: cliente pediu instalação depois da compra"></textarea></label>'
      + '<div class="ins-aviso">A venda já foi cobrada: a OS nasce <b>sem mão de obra</b> (o total e as parcelas não mudam). '
      + 'Depois de gravar, a OS abre para marcar o dia e o horário.</div>'
      + '<div class="ins-botoes"><button type="button" class="ins-btn" id="ins-cancela">Cancelar</button>'
      + '<button type="button" class="ins-btn roxo" id="ins-grava">Abrir a OS</button></div>';
    // um item so: ja vem marcado
    const caixas = f.querySelectorAll('.ins-item input');
    if (caixas.length === 1) caixas[0].checked = true;
  }

  function servicosDoTecnico() {
    const t = (tecnicos || []).find(x => x.conta === $('ins-tec').value);
    $('ins-serv').innerHTML = '<option value="">—</option>'
      + ((t && t.servicos) || []).map(s => '<option value="' + escapar(s.id) + '">' + escapar(s.descricao) + '</option>').join('');
  }

  async function gravarInstalacao() {
    const itens = [...$('ins-form').querySelectorAll('.ins-item input:checked')].map(c => Number(c.value));
    if (!itens.length) { $('esp-msg').textContent = 'Marque o item a instalar.'; return; }
    $('esp-msg').textContent = '';
    $('ins-grava').disabled = true;
    try {
      const r = await fetch(BASE + espId + '/instalacao', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens, tecnicoConta: $('ins-tec').value, servicoId: $('ins-serv').value, observacao: $('ins-obs').value }),
      });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      const id = espId;
      await abrirEspelho(id);                       // mostra a OS na secao
      abrirOS(String(d.os.id));                     // e abre a OS para agendar
    } catch (e) {
      $('esp-msg').textContent = e.message;
      if ($('ins-grava')) $('ins-grava').disabled = false;
    }
  }

  function abrirOS(id) {
    if (!window.OSModal) { $('esp-msg').textContent = 'modal da OS não carregou (os-modal.js)'; return; }
    const venda = espId;
    window.OSModal.abrir(id, () => { if (venda && espId === venda) abrirEspelho(venda); });
  }

  $('esp-conteudo').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'ins-incluir') abrirIncluir();
    else if (b.id === 'ins-cancela') $('ins-form').hidden = true;
    else if (b.id === 'ins-grava') gravarInstalacao();
    else if (b.dataset.abrirOs) abrirOS(b.dataset.abrirOs);
  });
  $('esp-conteudo').addEventListener('change', ev => { if (ev.target.id === 'ins-tec') servicosDoTecnico(); });

  function fecharEspelho() { $('esp-fundo').hidden = true; $('esp-caixa').hidden = true; espId = null; }

  async function cancelarVenda() {
    if ($('esp-cancel').hidden) {               // 1o clique: pede o motivo
      $('esp-cancel').hidden = false; $('esp-motivo').focus(); return;
    }
    const motivo = $('esp-motivo').value.trim();
    if (motivo.length < 3) { $('esp-msg').textContent = 'Informe o motivo do cancelamento.'; $('esp-motivo').focus(); return; }
    if (!confirm('Cancelar esta venda? O estoque volta, as parcelas saem do fluxo e os lançamentos são desfeitos.')) return;
    $('esp-cancelar').disabled = true;
    try {
      const r = await fetch(BASE + espId + '/cancelar', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      await abrirEspelho(espId);    // mostra cancelada
      carregar();                   // e a lista atras
    } catch (e) {
      $('esp-msg').textContent = e.message;
    } finally { $('esp-cancelar').disabled = false; }
  }

  $('esp-cancelar').addEventListener('click', cancelarVenda);
  $('esp-fechar').addEventListener('click', fecharEspelho);
  $('esp-x').addEventListener('click', fecharEspelho);
  $('esp-fundo').addEventListener('click', fecharEspelho);
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || $('esp-caixa').hidden) return;
    const osm = document.getElementById('osm-caixa');     // o modal da OS por cima: o Esc e dele
    if (osm && !osm.hidden) return;
    fecharEspelho();
  });
  (function arrastar() {
    let ini = null; const cx = $('esp-caixa');
    $('esp-topo').addEventListener('mousedown', ev => {
      if (ev.target.id === 'esp-x') return;
      const r = cx.getBoundingClientRect();
      cx.style.transform = 'none'; cx.style.left = r.left + 'px'; cx.style.top = r.top + 'px';
      ini = { x: ev.clientX - r.left, y: ev.clientY - r.top }; ev.preventDefault();
    });
    document.addEventListener('mousemove', ev => {
      if (!ini) return;
      cx.style.left = Math.max(-cx.offsetWidth + 80, ev.clientX - ini.x) + 'px';
      cx.style.top = Math.max(0, ev.clientY - ini.y) + 'px';
    });
    document.addEventListener('mouseup', () => { ini = null; });
  })();

  carregar();
})();
