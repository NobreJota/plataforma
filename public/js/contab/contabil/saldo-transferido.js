/* public/js/contab/contabil/saldo-transferido.js
 *
 * SALDO TRANSFERIDO
 *
 * Grava cada saldo como uma boleta de perna única, tipo SALDO_TRANSFERIDO.
 * A gravação é por linha, ao sair do campo — não existe botão "salvar tudo",
 * porque a pessoa preenche aos poucos e fechar a aba não pode perder o que
 * já foi digitado.
 */
(() => {
  'use strict';
  console.log('%c📊 saldo-transferido.js v1', 'background:#1d4ed8;color:white;padding:4px 10px;border-radius:4px');

  const API = '/contab/api/saldo-transferido';
  const $  = (s, raiz = document) => raiz.querySelector(s);
  const $$ = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

  const st = { ano: new Date().getFullYear(), linhas: [], grupo: '1', titulo: null };

  /* ============================================================
     HELPERS
     ============================================================ */
  async function pedir(url, opcoes) {
    const r = await fetch(url, opcoes);
    if (r.status === 401) {
      alert('Sua sessão expirou. Faça login novamente.');
      window.location.href = '/usuariocontab/login';
      return new Promise(() => {});
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
    return d;
  }

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Aceita "1.234,56", "-1234.56" e "(1234,56)". O parêntese é hábito de
     balancete para negativo, e quem vem de planilha digita assim. */
  function paraNumero(texto) {
    let t = String(texto || '').trim();
    if (!t) return 0;
    let negativo = false;
    if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1); }
    if (t.startsWith('-'))  { negativo = true; t = t.slice(1); }
    const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
    if (isNaN(n)) return 0;
    return negativo ? -n : n;
  }

  /* ============================================================
     ANOS
     ============================================================ */
  function montarAnos() {
    const sel = $('#sd-ano');
    const atual = new Date().getFullYear();
    // Do ano que vem até cinco atrás: cobre o fechamento antecipado e a
    // empresa que entra na plataforma com histórico.
    for (let a = atual + 1; a >= atual - 5; a--) {
      const o = document.createElement('option');
      o.value = a;
      o.textContent = a;
      if (a === st.ano) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      st.ano = parseInt(sel.value, 10);
      carregar();
    });
  }

  /* ============================================================
     CARGA
     ============================================================ */
  async function carregar() {
    const corpo = $('#sd-corpo');
    corpo.innerHTML = '<div class="sd-vazio">Carregando...</div>';
    try {
      const d = await pedir(`${API}?ano=${st.ano}`);
      st.linhas = d.linhas || [];
      st.titulo = null;
      desenharTitulos();
      desenhar();
      atualizarTotais(d.somaPositivos, d.somaNegativos, d.diferenca);
    } catch (err) {
      corpo.innerHTML = `<div class="sd-vazio">Erro: ${err.message}</div>`;
    }
  }

  /* Contas do grupo aberto na aba. */
  const doGrupo = () => st.linhas.filter(l => (l.codigo || '').charAt(0) === st.grupo);

  /* ============================================================
     PAINEL DA ESQUERDA: CONTAS-TÍTULO
     ============================================================ */
  function desenharTitulos() {
    const caixa = $('#sd-titulos');
    const contas = doGrupo();

    // Agrupa mantendo a ordem de código, que já veio ordenada do servidor.
    const mapa = new Map();
    contas.forEach(l => {
      const chave = l.tituloCodigo || '—';
      if (!mapa.has(chave)) {
        mapa.set(chave, { codigo: chave, nome: l.tituloNome || '', qtd: 0, comSaldo: 0 });
      }
      const t = mapa.get(chave);
      t.qtd++;
      if (l.valor) t.comSaldo++;
    });

    const titulos = [...mapa.values()];
    if (!titulos.length) {
      caixa.innerHTML = '<div class="sd-vazio">Nenhuma conta neste grupo.</div>';
      return;
    }

    caixa.innerHTML = '';
    titulos.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sd-titulo-item' + (st.titulo === t.codigo ? ' ativa' : '');
      b.innerHTML = `
        <span class="sd-titulo-cod">${t.codigo}</span>
        <span class="sd-titulo-nome" title="${t.nome}">${t.nome}</span>
        <span class="sd-titulo-marca">${t.comSaldo ? '● ' + t.comSaldo : ''}</span>`;
      b.addEventListener('click', () => {
        st.titulo = t.codigo;
        desenharTitulos();
        desenhar();
      });
      caixa.appendChild(b);
    });
  }

  /* ============================================================
     PAINEL DA DIREITA: SUB-TÍTULOS
     ============================================================ */
  function desenhar() {
    const corpo = $('#sd-corpo');
    const termo = $('#sd-busca').value.trim().toLowerCase();

    // Com busca ativa, procura em todos os grupos e ignora o título aberto:
    // quem digita um nome quer achar a conta, não navegar até ela.
    let visiveis;
    if (termo) {
      visiveis = st.linhas.filter(l =>
        (l.nome || '').toLowerCase().includes(termo) ||
        (l.codigo || '').includes(termo));
    } else if (st.titulo) {
      visiveis = doGrupo().filter(l => (l.tituloCodigo || '—') === st.titulo);
    } else {
      corpo.innerHTML = '<div class="sd-vazio">Escolha uma conta-título à esquerda.</div>';
      return;
    }

    if (!visiveis.length) {
      corpo.innerHTML = `<div class="sd-vazio">${
        termo ? 'Nenhuma conta com esse nome.' : 'Nenhum sub-título aqui.'
      }</div>`;
      return;
    }

    corpo.innerHTML = '';
    visiveis.forEach(l => corpo.appendChild(montarLinha(l)));
  }

  function montarLinha(l) {
    const div = document.createElement('div');
    div.className = 'sd-linha';
    div.innerHTML = `
      <div class="sd-cod">${l.codigo}</div>
      <div class="sd-nome" title="${l.nome}">${l.nome}</div>
      <div><input type="text" inputmode="decimal" placeholder="0,00"></div>
      <div class="sd-marca"></div>`;

    const input = $('input', div);
    const marca = $('.sd-marca', div);

    if (l.valor) {
      input.value = fmt(l.valor);
      input.classList.add('tem-valor');
    }

    // Guarda o que estava gravado para só chamar o servidor se mudou.
    let gravado = l.valor || 0;

    async function salvar() {
      const valor = paraNumero(input.value);
      if (valor === gravado) return;

      marca.className = 'sd-marca indo';
      marca.textContent = '...';
      try {
        await pedir(API, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contaSubTituloId: l.contaSubTituloId,
            ano: st.ano,
            valor
          })
        });

        gravado = valor;
        l.valor = valor;
        input.value = valor ? fmt(valor) : '';
        input.classList.toggle('tem-valor', !!valor);
        marca.className = 'sd-marca ok';
        marca.textContent = '✓ gravado';
        setTimeout(() => { if (marca.textContent === '✓ gravado') marca.textContent = ''; }, 2500);

        recalcularTotais();
        desenharTitulos();   // a bolinha do título acompanha o que foi lançado
      } catch (err) {
        marca.className = 'sd-marca erro';
        marca.textContent = '✕ erro';
        marca.title = err.message;
        input.focus();
      }
    }

    input.addEventListener('blur', salvar);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') {
        input.value = gravado ? fmt(gravado) : '';
        input.blur();
      }
    });

    return div;
  }

  /* ============================================================
     TOTAIS
     Recalculados no cliente depois de cada gravação, em vez de recarregar a
     lista inteira: a pessoa perderia a posição da rolagem e o foco.
     ============================================================ */
  function recalcularTotais() {
    let pos = 0, neg = 0;
    st.linhas.forEach(l => {
      if (l.valor > 0) pos += l.valor;
      if (l.valor < 0) neg += l.valor;
    });
    atualizarTotais(pos, neg, pos + neg);
  }

  function atualizarTotais(pos, neg, dif) {
    $('#sd-pos').textContent = fmt(pos);
    $('#sd-neg').textContent = fmt(neg);

    const b = $('#sd-dif');
    b.textContent = fmt(dif);
    const fechado = Math.abs(dif) < 0.005;
    b.className = fechado ? 'fechado' : 'aberto';

    $('#sd-nota').textContent = fechado
      ? 'Abertura fechada.'
      : 'A diferença é lucro ou prejuízo acumulado ainda não lançado.';
  }

  /* ============================================================
     INIT
     ============================================================ */
  (function init() {
    montarAnos();

    $$('.sd-aba').forEach(b => b.addEventListener('click', () => {
      $$('.sd-aba').forEach(x => x.classList.remove('ativa'));
      b.classList.add('ativa');
      st.grupo = b.dataset.grupo;
      st.titulo = null;
      $('#sd-busca').value = '';
      desenharTitulos();
      desenhar();
    }));

    let atraso = null;
    $('#sd-busca').addEventListener('input', () => {
      clearTimeout(atraso);
      atraso = setTimeout(desenhar, 150);
    });

    carregar();
  })();

})();
