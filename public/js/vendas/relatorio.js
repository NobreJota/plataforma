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
// Alterado em 07/10/2026: so as EMITIDAS (pela data do fechamento). Clique na linha abre o
//   ESPELHO da venda (GET /:id/espelho): cabecalho, itens, pagamento e as parcelas no fluxo
//   (aberta / recebida / cancelada). "Cancelar venda" pede o motivo e chama POST /:id/cancelar;
//   se alguma parcela ja foi recebida, o servidor recusa e diz qual boleta estornar.
// =============================================================================

'use strict';

(function () {
  const API = '/vendas/api/venda/relatorio';
  const $ = id => document.getElementById(id);
  const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
                 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const hoje = new Date();
  const estado = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, vendas: [] };

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
    $('meses').querySelectorAll('button[data-m]').forEach(b =>
      b.classList.toggle('ativo', Number(b.dataset.m) === estado.mes));
  }

  async function carregar() {
    marcarBotoes();
    $('recado').textContent = '';
    $('linhas').innerHTML = '<tr><td colspan="11" class="vazio">Carregando…</td></tr>';
    try {
      const r = await fetch(API + '?ano=' + estado.ano + '&mes=' + estado.mes, { credentials: 'same-origin' });
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

  function desenhar() {
    const vs = estado.vendas;
    if (!vs.length) {
      $('linhas').innerHTML = '<tr><td colspan="11" class="vazio">Nenhuma venda fechada em '
        + (estado.mes ? MESES[estado.mes] + ' de ' : '') + estado.ano + '.</td></tr>';
    } else {
      let mesAtual = 0, n = 0, html = '';
      for (const v of vs) {
        const m = new Date(v.data).getMonth() + 1;
        if (!estado.mes && m !== mesAtual) {           // separador de mes no modo "todos"
          mesAtual = m;
          html += '<tr class="sep"><td colspan="11">' + MESES[m] + '</td></tr>';
        }
        n++;
        const canc = v.situacao === 'C';
        html += '<tr class="v' + (canc ? ' cancelada' : '') + '" data-id="' + escapar(v._id) + '" tabindex="0" title="clique: espelho da venda">'
          + '<td class="n cinza">' + n + '</td>'
          + '<td><b>nº ' + v.numero + '</b></td>'
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
    const validas = estado.vendas.filter(v => v.situacao !== 'C');
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
    estado.mes = Number(b.dataset.m);
    carregar();
  });
  $('ano').addEventListener('change', ev => { estado.ano = Number(ev.target.value); carregar(); });

  const abrir = tr => { if (tr && tr.dataset.id) abrirEspelho(tr.dataset.id); };
  $('linhas').addEventListener('click', ev => abrir(ev.target.closest('tr.v')));
  $('linhas').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') abrir(ev.target.closest('tr.v'));
  });

  // ---- espelho da venda (modal) -------------------------------------------------
  const BASE = '/vendas/api/venda/';
  const FORMA = { DINHEIRO: 'dinheiro', PIX: 'PIX / transferência', DEBITO: 'cartão de débito', CREDITO: 'cartão de crédito', TITULO: 'título em banco' };
  const ST = { ATIVO: 'a receber', QUITADO: 'recebida', CANCELADO: 'cancelada' };
  let espId = null;

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
      desenharEspelho(d.venda, d.parcelas || []);
    } catch (e) { $('esp-conteudo').textContent = 'Erro: ' + e.message; }
  }

  function desenharEspelho(v, parcelas) {
    const c = v.cliente || {};
    const p = (v.pagamentos || [])[0] || {};
    $('esp-titulo').textContent = 'Venda nº ' + v.numero + ' · ' + (v.documento === 'NFE' ? 'Nota fiscal' : 'Cupom') + ' · '
      + (SITUACAO[v.situacao] || v.situacao);
    $('esp-abrir').href = '/vendas/venda/' + v._id;
    const campo = (r, val, cl) => '<div' + (cl ? ' class="' + cl + '"' : '') + '><span>' + r + '</span>' + (val || '—') + '</div>';
    const cab = '<div class="esp-grade">'
      + campo('Cliente', c.nome ? escapar(c.nome) + ' <span class="cinza">' + escapar(c.codigo) + '</span>' : 'balcão', 'l2')
      + campo('Fechada em', v.fechadaEm ? dia(v.fechadaEm) + ' ' + hora(v.fechadaEm) : '')
      + campo('Condição', v.condicao === 'PRAZO' ? 'a prazo' : 'à vista')
      + campo('Pagamento', escapar(FORMA[p.forma] || p.forma || ''))
      + campo('Conta de destino', escapar(p.contaDestino || ''))
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
    $('esp-conteudo').innerHTML = cab + '<h4>Itens</h4>' + itens + '<h4>Parcelas no fluxo</h4>' + parc + cancelada;
    const podeCancelar = v.situacao === 'F';
    $('esp-cancelar').hidden = !podeCancelar;
    const recebida = parcelas.some(x => x.status === 'QUITADO');
    if (podeCancelar && recebida) {
      $('esp-msg').textContent = 'Há parcela já recebida: o cancelamento só será aceito depois de estornar o recebimento no fluxo.';
    }
  }

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
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('esp-caixa').hidden) fecharEspelho(); });
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
