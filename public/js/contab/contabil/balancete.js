// =============================================================================
// Destino: C:\plataformaRota\public\js\contab\contabil\balancete.js
// Criado em: 08/10/2026
//
// BALANCETE: pede ao servidor as contas (subtitulos) com saldo anterior, debitos e
// creditos do periodo, e monta aqui a hierarquia: grupo (1) > subgrupo (1.01) >
// titulo (1.01.002) > subtitulo (1.01.002.003), somando cada nivel.
// Sinal da casa: debito +, credito −. Saldo atual = anterior + debitos − creditos.
// API: GET /financeiro/api/razao/balancete?de=&ate=
// =============================================================================

'use strict';

(function () {
  const API = '/financeiro/api/razao/balancete';
  const $ = id => document.getElementById(id);
  const GRUPOS = { '1': 'ATIVO', '2': 'PASSIVO', '3': 'DESPESAS', '4': 'RECEITAS' };
  let dados = null;

  const fmt = v => {
    const c = Math.round((v || 0) * 100) / 100;
    if (!c) return '';
    return '<span class="' + (c < 0 ? 'neg' : '') + '">' + c.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</span>';
  };
  const fmtT = v => (Math.round((v || 0) * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const br = s => s ? s.split('-').reverse().join('/') : '';

  // periodo padrao: 01/01 do ano ate hoje
  const hoje = new Date();
  $('de').value = hoje.getFullYear() + '-01-01';
  $('ate').value = iso(hoje);

  async function carregar() {
    const de = $('de').value, ate = $('ate').value;
    if (!de || !ate || de > ate) { $('aviso').textContent = 'Período inválido.'; return; }
    $('linhas').innerHTML = '<tr><td colspan="6" class="vazio">Calculando…</td></tr>';
    $('aviso').textContent = '';
    try {
      const r = await fetch(API + '?de=' + de + '&ate=' + ate, { credentials: 'same-origin' });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'falha na API');
      dados = d;
      $('titulo-periodo').textContent = br(de) + ' a ' + br(ate);
      desenhar();
    } catch (e) {
      $('linhas').innerHTML = '<tr><td colspan="6" class="vazio">Erro: ' + esc(e.message) + '</td></tr>';
    }
  }

  // soma as contas em todos os niveis
  function montar() {
    const nos = new Map();     // codigo do nivel -> { codigo, nivel, nome, anterior, debito, credito, atual, mov }
    const soma = (codigo, nivel, nome, c) => {
      if (!nos.has(codigo)) nos.set(codigo, { codigo, nivel, nome, anterior: 0, debito: 0, credito: 0, atual: 0, mov: false, fora: false });
      const n = nos.get(codigo);
      n.anterior += c.anterior; n.debito += c.debito; n.credito += c.credito; n.atual += c.atual;
      if (c.debito || c.credito) n.mov = true;
      if (nivel === 4 && c.fora) n.fora = true;
    };
    for (const c of dados.contas) {
      const p = c.codigo.split('.');
      c.fora = c.nome === '(fora do plano)';
      const g = p[0], sg = p.slice(0, 2).join('.'), t = p.slice(0, 3).join('.');
      soma(g, 1, GRUPOS[g] || 'GRUPO ' + g, c);
      soma(sg, 2, dados.subgrupos[sg] || '', c);
      soma(t, 3, dados.titulos[t] || '', c);
      soma(c.codigo, 4, c.nome, c);
    }
    return [...nos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
  }

  function desenhar() {
    if (!dados) return;
    const nivel = Number($('nivel').value);
    const soMov = $('so-mov').checked;
    const lista = montar().filter(n => n.nivel <= nivel && (!soMov || n.mov));
    $('linhas').innerHTML = lista.length ? lista.map(n => '<tr class="g' + n.nivel + '">'
      + '<td class="cod">' + esc(n.codigo) + '</td>'
      + '<td class="nome' + (n.fora ? ' fora' : '') + '">' + esc(n.nome) + '</td>'
      + '<td class="n">' + fmt(n.anterior) + '</td><td class="n">' + fmt(n.debito) + '</td>'
      + '<td class="n">' + fmt(-n.credito) + '</td><td class="n">' + fmt(n.atual) + '</td></tr>').join('')
      : '<tr><td colspan="6" class="vazio">Nenhuma conta com saldo ou movimento no período.</td></tr>';

    // conferencia: no periodo, debitos = creditos
    const deb = dados.contas.reduce((t, c) => t + c.debito, 0);
    const cred = dados.contas.reduce((t, c) => t + c.credito, 0);
    const saldo = dados.contas.reduce((t, c) => t + c.atual, 0);
    const dif = Math.round((deb - cred) * 100) / 100;
    $('t-deb').textContent = fmtT(deb);
    $('t-cred').textContent = '-' + fmtT(cred);
    $('t-dif').textContent = fmtT(dif);
    $('t-dif').className = dif === 0 ? 'ok' : 'erro';
    $('t-saldo').textContent = fmtT(saldo);
    $('aviso').textContent = dados.boletas + ' boletas lidas. '
      + (dif === 0 ? 'Débitos e créditos do período batem.' : 'Atenção: débitos e créditos do período não batem.')
      + ' A soma dos saldos inclui o saldo transferido de abertura, que no Access não fechava em zero.';
  }

  $('aplicar').addEventListener('click', carregar);
  $('nivel').addEventListener('change', desenhar);
  $('so-mov').addEventListener('change', desenhar);
  $('imprimir').addEventListener('click', () => window.print());
  carregar();
})();
