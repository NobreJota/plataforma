// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\lucro-diario.js
// Criado em: 30/10/2026 (Jorge)
//
// ADMIN > LUCRO DIARIO (views\vendas\pages\lucro-diario.handlebars)
//   API: GET /vendas/api/venda/lucro-diario?ano=&mes=
//        -> { dias: [{ dia, qtd, vendas, custo }], os: [{ dia, qtd, maoDeObra, tecnico, empresa, adicionais, material,
//             materialCusto, despesas, lucro, ordens: [...] }], feriados: [{ dia, nome }] }
//   Abas: "Lucro bruto · vendas" e "Ordem de serviço" (o mesmo calendario do mes). Linhas: seg a sex sempre (sab/dom so
//   com movimento); linha cinza entre as semanas. Na aba OS, clique no dia abre as OS (tecnico, cliente, servico...).
//   Painel: lucro do mes da aba, media diaria (lucro / dias uteis ja passados), dias uteis (seg a sex sem feriado;
//   pode mudar) e previsao (media x dias uteis). Embaixo: resumo das OS do mes (e por tecnico).
// Alterado em: 30/10/2026 (noite 2) - mostra o administrador e o botao "Sair do admin".
// Alterado em: 30/10/2026 (noite 3) - abas Vendas / Ordem de servico; OS do dia ao clicar; resumo das OS.
// Dinheiro em centavos na API.
// =============================================================================
(function () {
  'use strict';
  const API = '/vendas/api/venda/lucro-diario';
  const $ = id => document.getElementById(id);
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const pctTxt = (a, b) => b ? (a / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' %' : '';
  const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const TIPO_OS = { VI: 'instalação', INSTALACAO: 'instalação', C: 'conserto', G: 'garantia', S: 'serviço' };
  const hoje = new Date();
  let aba = 'vendas';
  try { aba = localStorage.getItem('lucro-aba') === 'os' ? 'os' : 'vendas'; } catch (e) { /* sem storage */ }
  const estado = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, dados: null, lucro: 0, uteis: 0, passados: 0, abertos: new Set() };

  // colunas de cada aba
  const COLS = {
    vendas: [['Data', ''], ['Vendas', 'n'], ['Estoque (custo)', 'n', 'custo do que saiu do estoque'], ['Lucro bruto', 'n'], ['Margem', 'n'], ['Nº vendas', 'n']],
    os: [['Data', ''], ['Nº OS', 'n'], ['Mão de obra', 'n', 'técnico + empresa'], ['Técnicos', 'n', 'parte dos técnicos'], ['Empresa', 'n', 'parte da empresa (+ adicionais)'],
         ['Material', 'n', 'consignado cobrado: venda − custo'], ['Despesas', 'n', 'material complementar (custo) + mão de obra adicional paga pela empresa'], ['Lucro', 'n']],
  };

  async function carregar() {
    $('meses').querySelectorAll('button[data-m]').forEach(b => b.classList.toggle('ativo', Number(b.dataset.m) === estado.mes));
    $('msg').textContent = '';
    $('linhas').innerHTML = '<tr><td colspan="8" class="dica">Carregando…</td></tr>';
    try {
      const r = await fetch(API + '?ano=' + estado.ano + '&mes=' + estado.mes, { credentials: 'same-origin' });
      if (r.status === 401) { location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      $('adm-nome').textContent = d.admin ? 'administrador: ' + d.admin : '';
      $('ano').innerHTML = d.anos.map(a => '<option' + (a === estado.ano ? ' selected' : '') + '>' + a + '</option>').join('');
      estado.dados = d; estado.abertos = new Set();
      desenhar(); resumoOS();
    } catch (e) { $('linhas').innerHTML = ''; $('msg').textContent = e.message; }
  }

  function desenhar() {
    const d = estado.dados; if (!d) return;
    document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('ativo', b.dataset.aba === aba));
    const cols = COLS[aba], nc = cols.length;
    $('cab').innerHTML = '<tr>' + cols.map(c => '<th class="' + c[1] + '"' + (c[2] ? ' title="' + esc(c[2]) + '"' : '') + '>' + c[0] + '</th>').join('') + '</tr>';
    const porDia = new Map((aba === 'os' ? d.os || [] : d.dias).map(x => [x.dia, x]));
    const fer = new Map(d.feriados.map(f => [f.dia, f.nome]));
    const ultimo = new Date(estado.ano, estado.mes, 0).getDate(), hj = iso(new Date());
    let html = '', semana = null, uteis = 0, passados = 0;
    const t = { qtd: 0, vendas: 0, custo: 0, maoDeObra: 0, tecnico: 0, empresa: 0, material: 0, despesas: 0, lucro: 0 };
    for (let n = 1; n <= ultimo; n++) {
      const dt = new Date(estado.ano, estado.mes - 1, n), k = iso(dt), ds = dt.getDay(), x = porDia.get(k);
      const util = ds >= 1 && ds <= 5 && !fer.has(k);
      if (util) { uteis++; if (k <= hj) passados++; }
      if (!x && (ds === 0 || ds === 6)) continue;                       // fim de semana sem movimento: nao aparece
      const seg = new Date(dt); seg.setDate(dt.getDate() - ((ds + 6) % 7));
      if (semana !== null && iso(seg) !== semana) html += '<tr class="semana"><td colspan="' + nc + '"></td></tr>';
      semana = iso(seg);
      const aberto = aba === 'os' && x && estado.abertos.has(k);
      const cls = [k === hj ? 'hoje' : '', fer.has(k) ? 'feriado' : '', (ds === 0 || ds === 6) ? 'fds' : '', k > hj ? 'futuro' : '',
                   aba === 'os' && x ? 'tem-os' : '', aberto ? 'aberto' : ''].filter(Boolean).join(' ');
      // 30/10/2026: feriado = data em vermelho; o nome so passando o mouse (a coluna fica estreita)
      const dataTd = '<td><span' + (fer.has(k) ? ' class="fer" title="' + esc(fer.get(k)) + '"' : '') + '>' + String(n).padStart(2, '0') + '/'
        + String(estado.mes).padStart(2, '0') + '</span><small>' + SEM[ds] + '</small></td>';
      const v = c => x ? brl(c) : '';
      if (aba === 'vendas') {
        const lucro = x ? x.vendas - x.custo : 0;
        if (x) { t.qtd += x.qtd; t.vendas += x.vendas; t.custo += x.custo; }
        html += '<tr class="' + cls + '">' + dataTd + '<td class="n">' + v(x && x.vendas) + '</td><td class="n">' + v(x && x.custo) + '</td>'
          + '<td class="n' + (lucro < 0 ? ' neg' : '') + '"><b>' + (x ? brl(lucro) : '') + '</b></td><td class="n">' + (x ? pctTxt(lucro, x.vendas) : '')
          + '</td><td class="n">' + (x ? x.qtd : '') + '</td></tr>';
      } else {
        if (x) ['qtd', 'maoDeObra', 'tecnico', 'empresa', 'material', 'despesas', 'lucro'].forEach(c => { t[c] += c === 'empresa' ? x.empresa + x.adicionais : c === 'material' ? x.material - x.materialCusto : x[c]; });
        html += '<tr class="' + cls + '" data-dia="' + k + '"' + (x ? ' title="clique: as OS do dia"' : '') + '>' + dataTd
          + '<td class="n">' + (x ? x.qtd : '') + '</td><td class="n">' + v(x && x.maoDeObra) + '</td><td class="n">' + v(x && x.tecnico) + '</td>'
          + '<td class="n">' + v(x && x.empresa + x.adicionais) + '</td><td class="n">' + v(x && x.material - x.materialCusto) + '</td>'
          + '<td class="n">' + v(x && x.despesas) + '</td><td class="n' + (x && x.lucro < 0 ? ' neg' : '') + '"><b>' + v(x && x.lucro) + '</b></td></tr>';
        if (aberto) {
          html += x.ordens.map(o => '<tr class="os-det"><td colspan="2"><b>OS ' + o.numero + '</b> · ' + esc(TIPO_OS[o.tipo] || o.tipo) + '</td>'
            + '<td colspan="2">🔧 <b>' + esc(o.tecnico || 'sem técnico') + '</b></td><td colspan="2">' + esc(o.cliente) + (o.servico ? ' · ' + esc(o.servico) : '') + '</td>'
            + '<td class="n" colspan="2">m.o. ' + brl(o.maoDeObra) + ' (téc. ' + brl(o.parteTecnico) + ') · lucro <b>' + brl(o.lucro) + '</b></td></tr>').join('');
        }
      }
    }
    $('linhas').innerHTML = html || '<tr><td colspan="' + nc + '" class="dica">Nenhum dia.</td></tr>';
    const lucro = aba === 'vendas' ? t.vendas - t.custo : t.lucro;
    $('pe').innerHTML = aba === 'vendas'
      ? '<tr><td>Total</td><td class="n">' + brl(t.vendas) + '</td><td class="n">' + brl(t.custo) + '</td><td class="n' + (lucro < 0 ? ' neg' : '') + '">'
        + brl(lucro) + '</td><td class="n">' + pctTxt(lucro, t.vendas) + '</td><td class="n">' + t.qtd + '</td></tr>'
      : '<tr><td>Total</td><td class="n">' + t.qtd + '</td><td class="n">' + brl(t.maoDeObra) + '</td><td class="n">' + brl(t.tecnico) + '</td><td class="n">'
        + brl(t.empresa) + '</td><td class="n">' + brl(t.material) + '</td><td class="n">' + brl(t.despesas) + '</td><td class="n' + (lucro < 0 ? ' neg' : '') + '">' + brl(lucro) + '</td></tr>';
    estado.lucro = lucro; estado.uteis = uteis; estado.passados = passados;
    $('lado-tit').textContent = (aba === 'os' ? 'Ordens de serviço · ' : 'Vendas · ') + MESES[estado.mes - 1] + ' de ' + estado.ano;
    if (!$('r-dias').dataset.mexido) $('r-dias').value = uteis;
    resumo();
  }
  function resumo() {
    const uteis = Math.max(0, parseInt($('r-dias').value, 10) || 0);
    const passados = Math.min(estado.passados, uteis || estado.passados);
    const media = passados ? Math.round(estado.lucro / passados) : 0;
    $('r-lucro').textContent = brl(estado.lucro);
    $('r-media').textContent = brl(media);
    $('r-prev').textContent = brl(media * uteis);
    $('r-dica').innerHTML = 'Média = lucro ÷ ' + passados + ' dia(s) útil(eis) já passado(s). Dias úteis: seg a sex sem feriado ('
      + estado.uteis + ' no mês) — pode mudar. ' + (aba === 'os'
        ? 'Lucro da OS = parte da empresa + adicionais + material (venda − custo) − despesas.'
        : 'Vendas sem a mão de obra; estoque = custo dos produtos que saíram.');
  }

  // quadro "Resumo das OS do mes" (sempre, nas duas abas) e por tecnico
  function resumoOS() {
    const os = (estado.dados && estado.dados.os) || [];
    if (!os.length) { $('os-resumo').innerHTML = 'Nenhuma OS fechada em ' + MESES[estado.mes - 1] + '.'; return; }
    const s = os.reduce((t, x) => ({ qtd: t.qtd + x.qtd, mo: t.mo + x.maoDeObra, tec: t.tec + x.tecnico, emp: t.emp + x.empresa, ad: t.ad + x.adicionais,
      mat: t.mat + x.material, matC: t.matC + x.materialCusto, desp: t.desp + x.despesas, lucro: t.lucro + x.lucro }),
      { qtd: 0, mo: 0, tec: 0, emp: 0, ad: 0, mat: 0, matC: 0, desp: 0, lucro: 0 });
    const porTec = new Map();
    os.forEach(x => x.ordens.forEach(o => { const k = o.tecnico || 'sem técnico', p = porTec.get(k) || { qtd: 0, tec: 0, lucro: 0 };
      p.qtd++; p.tec += o.parteTecnico; p.lucro += o.lucro; porTec.set(k, p); }));
    const lin = (r, v, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + r + '</td><td class="n">' + v + '</td></tr>';
    $('os-resumo').innerHTML = '<table class="res">'
      + lin('OS fechadas', s.qtd) + lin('Mão de obra', brl(s.mo)) + lin('· técnicos', brl(s.tec)) + lin('· empresa', brl(s.emp))
      + (s.ad ? lin('Adicionais', brl(s.ad)) : '') + lin('Material vendido', brl(s.mat)) + lin('· custo do material', brl(s.matC))
      + (s.desp ? lin('Despesas', brl(s.desp)) : '') + lin('Lucro da empresa', brl(s.lucro), 'tot')
      + '<tr class="sep"><td colspan="2"><b>Por técnico</b> <span style="color:var(--cinza)">(OS · parte do técnico)</span></td></tr>'
      + [...porTec.entries()].sort((a, b) => b[1].qtd - a[1].qtd).map(([n, p]) => lin(esc(n) + ' <span style="color:var(--cinza)">· ' + p.qtd + ' OS</span>', brl(p.tec))).join('')
      + '</table>';
  }

  $('abas').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-aba]'); if (!b) return;
    aba = b.dataset.aba; try { localStorage.setItem('lucro-aba', aba); } catch (e) { /* sem storage */ }
    desenhar();
  });
  $('linhas').addEventListener('click', ev => {
    const tr = ev.target.closest('tr.tem-os'); if (!tr) return;
    const k = tr.dataset.dia;
    if (estado.abertos.has(k)) estado.abertos.delete(k); else estado.abertos.add(k);
    desenhar();
  });
  $('meses').addEventListener('click', ev => { const b = ev.target.closest('button[data-m]'); if (!b) return; estado.mes = Number(b.dataset.m); delete $('r-dias').dataset.mexido; carregar(); });
  $('ano').addEventListener('change', ev => { estado.ano = Number(ev.target.value); delete $('r-dias').dataset.mexido; carregar(); });
  $('r-dias').addEventListener('input', ev => { ev.target.value = ev.target.value.replace(/\D/g, ''); ev.target.dataset.mexido = '1'; resumo(); });
  // 30/10/2026 (noite 2): fecha o Admin nesta sessao
  $('adm-sair').addEventListener('click', async () => {
    try { await fetch('/vendas/api/venda/admin/sair', { method: 'POST', credentials: 'same-origin' }); } catch (e) { /* segue */ }
    location.href = '/usuariocontab/menu';
  });
  carregar();
})();
