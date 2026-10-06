// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\notas.js
// Alterado em: 25/09/2026  (importacao le o XML como texto e manda JSON)
// Alterado em: 27/09/2026  (barra de meses, como no fluxo de caixa)
//
// PESQUISA DE NOTAS: o historico. Por mes, por fornecedor, por numero.
//
// O painel de Entrada de Mercadoria mostra o que esta em andamento; aqui se
// procura o que ja passou. Sao duas perguntas diferentes, e misturar as
// duas na mesma tela produzia cartao que so cresce e lista que se contradiz.
// APIs: /compra/api/nota/{resumo,lista,fornecedores}
//
// Alterado em: 27/09/2026 — so as efetivadas; sem cartoes de situacao.
// =============================================================================

'use strict';

(function () {

  // A pesquisa mostra o que ESTA PRONTO: nota gravada e mercadoria conferida.
  // Nota em andamento e fila de trabalho, e fila mora no painel de Entrada.
  const SITUACAO = 'EFETIVADA';

  // os rotulos das etiquetas da lista
  const NOMES = {
    RECEBIDA: 'Recebida',
    VINCULADA: 'Vinculada',
    EM_CONFERENCIA: 'Em conferência',
    EFETIVADA: 'Efetivada',
    RECUSADA: 'Recusada',
  };

  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const hoje = new Date();

  const estado = {
    fornecedor: '',        // ObjectId do fornecedor, ou vazio para todos
    busca: '',
    mes: hoje.getMonth() + 1,   // abre no mes corrente, como o fluxo de caixa
    ano: hoje.getFullYear(),
    resumo: null,
  };

  const $ = id => document.getElementById(id);

  const el = {
    meses:      $('meses'),
    total:      $('total'),
    fornecedor: $('fornecedor'),
    busca:      $('busca'),
    lista:    $('lista'),

  };

  // ---- utilitarios ----------------------------------------------------------
  const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const dia = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    return String(d.getUTCDate()).padStart(2, '0') + '/'
         + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
         + String(d.getUTCFullYear()).slice(2);
  };

  const escapar = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rotulo = chave => NOMES[chave] || chave;

  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  // ---- meses ----------------------------------------------------------------
  // A mesma barra do fluxo de caixa: o usuario ja conhece o gesto. O periodo
  // conta pela DATA DE ENTRADA — quem procura nota procura pelo mes em que
  // ela chegou.
  const periodoNaUrl = () =>
    'ano=' + estado.ano + (estado.mes ? '&mes=' + estado.mes : '');

  function desenharMeses() {
    const d = estado.resumo || {};
    const comNota = new Set(d.mesesComNota || []);
    const anos = (d.anos && d.anos.length) ? d.anos : [estado.ano];

    el.meses.innerHTML = '<div class="botoes">'
      + MESES.map((nome, i) => {
        const m = i + 1;
        const classe = (estado.mes === m ? 'ativo' : '')
          + (comNota.has(m) ? '' : ' vazio');
        return '<button data-mes="' + m + '" class="' + classe.trim() + '">'
          + nome + '</button>';
      }).join('')
      + '<button data-mes="0" class="' + (estado.mes ? '' : 'ativo') + '">todos</button>'
      + '</div>'
      + '<span class="ano">Ano:'
      +   '<select id="ano">'
      +     anos.map(a => '<option value="' + a + '"'
            + (a === estado.ano ? ' selected' : '') + '>' + a + '</option>').join('')
      +   '</select>'
      + '</span>';
  }

  // ---- fornecedores ---------------------------------------------------------
  // Quase toda consulta comeca por "de quem?". O select sai das proprias
  // notas, nao do cadastro inteiro: so interessa quem ja mandou mercadoria.
  async function carregarFornecedores() {
    try {
      const d = await buscar('/compra/api/nota/fornecedores');
      if (!d) return;

      const escolhido = estado.fornecedor;

      el.fornecedor.innerHTML = '<option value="">todos os fornecedores</option>'
        + d.fornecedores.map(f => '<option value="' + f._id + '">'
            + escapar(f.razao) + '  (' + f.notas + ')'
            + '</option>').join('');

      if (escolhido) el.fornecedor.value = escolhido;
    } catch (e) {
      console.error('[fornecedores]', e);
    }
  }

  // ---- total e barra --------------------------------------------------------
  // O resumo nao desenha mais cartao nenhum: com uma situacao so, cinco
  // contadores viravam quatro zeros. Serve para os meses que tem nota, os
  // anos do select, e o total do periodo.
  async function carregarResumo() {
    try {
      const d = await buscar('/compra/api/nota/resumo?' + periodoNaUrl()
        + '&situacao=' + SITUACAO
        + (estado.fornecedor ? '&fornecedor=' + estado.fornecedor : ''));
      if (!d) return;

      estado.resumo = d;
      desenharMeses();
      desenharTotal();
    } catch (e) {
      console.error('[resumo]', e);
    }
  }

  function desenharTotal() {
    const v = (estado.resumo?.porSituacao || {})[SITUACAO]
           || { quantidade: 0, valor: 0 };

    if (!v.quantidade || (!estado.fornecedor && !estado.busca)) {
      el.total.hidden = true;
      return;
    }

    el.total.hidden = false;
    el.total.innerHTML = '<span>' + v.quantidade + ' nota'
      + (v.quantidade === 1 ? '' : 's') + '</span>'
      + '<span>total <b>' + moeda(v.valor) + '</b></span>';
  }

  // ---- lista ----------------------------------------------------------------
  async function carregarLista() {
    // A pesquisa comeca por "de quem". Sem fornecedor escolhido a tela abre
    // pronta mas vazia, em vez de despejar tudo que existe.
    if (!estado.fornecedor && !estado.busca) {
      el.lista.innerHTML = '<div class="aviso">'
        + '<strong>Escolha um fornecedor</strong>'
        + 'Ou busque direto pelo número da nota ou pela chave de acesso.</div>';
      el.total.hidden = true;
      return;
    }

    el.lista.innerHTML = '<div class="aviso">Carregando...</div>';

    try {
      const url = '/compra/api/nota/lista?situacao=' + SITUACAO
        + '&' + periodoNaUrl()
        + (estado.fornecedor ? '&fornecedor=' + estado.fornecedor : '')
        + (estado.busca ? '&busca=' + encodeURIComponent(estado.busca) : '');

      const d = await buscar(url);
      if (!d) return;

      if (!d.notas.length) {
        el.lista.innerHTML = listaVazia();
        return;
      }

      el.lista.innerHTML = d.notas.map(desenharNota).join('');
    } catch (e) {
      el.lista.innerHTML = '<div class="aviso">Erro: ' + escapar(e.message) + '</div>';
      console.error('[lista]', e);
    }
  }

  function listaVazia() {
    if (estado.busca) {
      return '<div class="aviso"><strong>Nenhuma nota encontrada</strong>'
        + 'Tente outro número, fornecedor ou chave.</div>';
    }

    return '<div class="aviso"><strong>Nenhuma entrada concluída em '
      + (estado.mes ? MESES[estado.mes - 1] + '/' + estado.ano : estado.ano)
      + '</strong>'
      + 'Só aparecem aqui as notas já conferidas e efetivadas. '
      + 'As que ainda estão em andamento ficam em '
      + '<a href="/compra/entrada">Entrada de mercadoria</a>.</div>';
  }

  function desenharNota(n) {
    // a barra de progresso so faz sentido enquanto ha o que conferir
    const emAndamento = n.situacao !== 'EFETIVADA' && n.situacao !== 'RECUSADA';
    const progresso = emAndamento && n.itens
      ? '<div class="progresso"><span style="width:' + n.progresso + '%"></span></div>'
        + '<div class="progresso-texto">' + n.conferidos + ' de ' + n.itens + ' conferidos</div>'
      : '<div class="progresso-texto">' + n.itens + ' '
        + (n.itens === 1 ? 'item' : 'itens') + '</div>';

    return ''
      + '<div class="nota" data-id="' + n._id + '">'

      +   '<div class="num">'
      +     (n.numero ? escapar(n.numero) : '—')
      +     '<small>entrada ' + dia(n.dataEntrada || n.dataEmissao) + '</small>'
      +   '</div>'

      +   '<div class="razao">'
      +     escapar(n.razao || '(sem emitente)')
      +     (n.pedidoNumero
              ? '<span class="pedido-chip">pedido nº ' + n.pedidoNumero + '</span>'
              : '')
      +   '</div>'

      +   '<div class="prog">' + progresso + '</div>'

      +   '<div class="situacao">'
      +     '<span class="etiqueta ' + n.situacao + '">' + rotulo(n.situacao) + '</span>'
      +   '</div>'

      +   '<div class="dinheiro">' + moeda(n.valorTotal) + '</div>'

      + '</div>';
  }

  async function recarregar() {
    await Promise.all([carregarResumo(), carregarFornecedores(), carregarLista()]);
  }

  // ---- eventos da lista -----------------------------------------------------
  el.meses.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-mes]');
    if (!b) return;
    const m = Number(b.dataset.mes);
    estado.mes = m || null;
    recarregar();
  });

  el.meses.addEventListener('change', ev => {
    if (ev.target.id !== 'ano') return;
    estado.ano = Number(ev.target.value);
    recarregar();
  });

  el.lista.addEventListener('click', ev => {
    if (ev.target.closest('#ver-todas')) {
      ev.preventDefault();
      estado.mes = null;
      estado.fornecedor = '';
      el.fornecedor.value = '';
      recarregar();
      return;
    }
    const linha = ev.target.closest('.nota');
    if (!linha) return;
    window.location.href = '/compra/entrada/' + linha.dataset.id;
  });

  el.fornecedor.addEventListener('change', () => {
    estado.fornecedor = el.fornecedor.value;
    // Escolher o fornecedor e dizer "quero ver as notas dele". Manter por
    // cima um filtro de situacao produz a tela que diz "(1)" no select e
    // "nao tem nota aqui" na lista.
    recarregar();
  });

  let esperaBusca = null;
  el.busca.addEventListener('input', () => {
    clearTimeout(esperaBusca);
    esperaBusca = setTimeout(() => {
      estado.busca = el.busca.value.trim();
      carregarLista();
    }, 300);
  });

  // ---- inicio ---------------------------------------------------------------
  recarregar();

})();