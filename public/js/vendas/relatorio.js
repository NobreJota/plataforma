// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\relatorio.js
// Criado em: 03/10/2026
//
// RELATORIO DE VENDAS mes a mes (como o Fluxo de Caixa).
//   - abre no mes corrente; "todos" mostra o ano com separador de mes
//   - duplo clique (ou Enter na linha marcada) abre a venda
//   - rodape: cupons, notas, descontos e liquido; canceladas fora da soma
// API: GET /vendas/api/venda/relatorio?ano=&mes=   (valores em CENTAVOS)
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
      $('linhas').innerHTML = '<tr><td colspan="11" class="vazio">Nenhuma venda em '
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
        html += '<tr class="v' + (canc ? ' cancelada' : '') + '" data-id="' + escapar(v._id) + '" tabindex="0" title="duplo clique abre a venda">'
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

  const abrir = tr => { if (tr && tr.dataset.id) window.location.href = '/vendas/venda/' + tr.dataset.id; };
  $('linhas').addEventListener('dblclick', ev => abrir(ev.target.closest('tr.v')));
  $('linhas').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') abrir(ev.target.closest('tr.v'));
  });

  carregar();
})();
