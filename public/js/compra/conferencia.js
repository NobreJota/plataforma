// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\conferencia.js
// Criado em: 26/09/2026
//
// CONFERINDO QUANTIDADES — a contagem fisica da mercadoria.
//
// Um item por vez, na ordem da nota. O conferente ve o que precisa para achar
// a caixa: descricao do fabricante, a nossa descricao e o codigo de barras.
// A quantidade da nota nao chega aqui — o servidor nao manda.
//
// Sem leitor: um clique no codigo de barras da tela vale como leitura.
// Com leitor ligado, esse atalho se desliga sozinho.
//
// A comparacao do codigo e feita na tela; so a quantidade vai ao servidor.
//
// Dois campos na mesma faixa. Passa o leitor (ou cola o codigo) e da Enter:
// o servidor diz se e a caixa certa e o campo da quantidade abre. Conta,
// digita, Enter: o servidor compara. Acertou, o proximo item aparece.
// Errou, "contar de novo". Na terceira errada a nota trava.
// =============================================================================

'use strict';

(function () {

  const notaId = document.body.dataset.nota;

  const CHAVE_LEITOR = 'conferencia-tem-leitor';

  const estado = {
    dados: null,
    contando: false,     // o campo da quantidade esta aberto
    temLeitor: false,    // leitor de codigo de barras detectado nesta maquina
    teclas: [],          // horarios das teclas, para reconhecer o leitor
    codigoLido: '',      // o codigo que abriu o campo da quantidade
  };

  try { estado.temLeitor = localStorage.getItem(CHAVE_LEITOR) === '1'; }
  catch (e) { estado.temLeitor = false; }

  const $ = id => document.getElementById(id);

  const el = {
    voltar:      $('voltar'),
    progresso:   $('progresso'),
    documento:   $('documento'),
    travada:     $('travada'),
    alvo:        $('alvo'),
    leitor:      $('leitor'),
    codigo:      $('codigo'),
    recado:      $('recado'),
    conferidos:  $('conferidos'),
    estado:      $('estado'),
    btnEfetivar: $('btn-efetivar'),

    qtd:        $('qtd'),
  };

  // ---- formatacao -----------------------------------------------------------
  const escapar = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const dia = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return String(d.getUTCDate()).padStart(2, '0') + '/'
         + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
         + String(d.getUTCFullYear()).slice(2);
  };

  const cnpjBonito = v => {
    const s = String(v || '').replace(/\D/g, '');
    return s.length === 14
      ? s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : (v || '');
  };

  // ---- rede -----------------------------------------------------------------
  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.erro || 'falha'); e.corpo = j; throw e; }
    return j;
  }

  async function enviar(url, corpo) {
    const r = await fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo || {}),
    });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.erro || 'falha'); e.corpo = j; throw e; }
    return j;
  }

  let sumir = null;
  function recado(texto, tipo) {
    clearTimeout(sumir);
    el.recado.className = 'recado visivel ' + (tipo || 'ok');
    el.recado.textContent = texto;
    if (tipo === 'ok') {
      sumir = setTimeout(() => el.recado.classList.remove('visivel'), 4000);
    }
  }

  function focarLeitor() {
    if (estado.contando) { el.qtd.focus(); return; }
    if (estado.dados && (estado.dados.bloqueada || estado.dados.terminou)) return;
    el.codigo.focus();
    el.codigo.select();
  }

  // ---- carregar -------------------------------------------------------------
  async function carregar() {
    try {
      const d = await buscar('/compra/api/conferencia/' + notaId);
      if (!d) return;
      estado.dados = d;
      desenhar();
      focarLeitor();
    } catch (e) {
      encerrar(e.message);
    }
  }

  // A pagina nao serve para esta nota: apaga tudo e diz o porque, com para
  // onde ir. Deixar o leitor e o rodape ligados sob um aviso vermelho so
  // confunde — nao ha o que contar aqui.
  function encerrar(motivo) {
    const explica = {
      'nota efetivada': 'Esta nota já foi efetivada: o estoque subiu e os '
        + 'títulos entraram no fluxo. Não há mais o que contar.',
      'nota recusada': 'Esta nota foi recusada.',
      'nota sem pedido vinculado': 'A nota ainda não foi vinculada a um '
        + 'pedido. Isso é feito na tela da nota.',
      'ha item sem o nosso codigo': 'Ainda há item sem o nosso código. '
        + 'Isso é resolvido na tela da nota.',
    }[motivo] || motivo;

    el.documento.hidden = true;
    el.leitor.hidden = true;
    el.recado.className = 'recado';
    el.conferidos.innerHTML = '';
    document.querySelector('.conferidos h2').hidden = true;
    el.progresso.textContent = '';
    el.estado.textContent = '';
    el.btnEfetivar.hidden = true;

    el.travada.innerHTML = '<div class="encerrada">'
      + '<h2>Nada a contar</h2>'
      + '<p>' + escapar(explica) + '</p>'
      + '<div class="saidas">'
      +   '<a class="btn-mini" href="/compra/entrada/' + notaId + '">ver a nota</a>'
      +   '<a class="btn-mini" href="/compra/entrada">painel de entradas</a>'
      + '</div></div>';
    el.alvo.innerHTML = '';
  }

  function desenhar() {
    const d = estado.dados;

    // qualquer redesenho devolve a faixa ao passo do codigo
    if (!estado.contando) {
      el.leitor.classList.remove('contando');
      el.qtd.disabled = true;
      el.qtd.value = '';
    }

    // ---- cabeçalho do documento --------------------------------------------
    el.documento.innerHTML = ''
      + '<div class="linha">'
      +   '<div class="cela numero"><span class="r">Pedido</span>'
      +     '<div class="v"><b>nº ' + (d.pedido ? d.pedido.numero : '—') + '</b>'
      +       (d.pedido ? '  ·  ' + dia(d.pedido.dataEmissao) : '') + '</div></div>'
      +   '<div class="cela larga"><span class="r">Fabricante</span>'
      +     '<div class="v">' + escapar(d.nota.fornecedor) + '</div></div>'
      + '</div>'
      + '<div class="linha">'
      +   '<div class="cela numero"><span class="r">Nota fiscal</span>'
      +     '<div class="v"><b>nº ' + escapar(d.nota.numero) + '</b>'
      +       (d.nota.serie ? '  ·  série ' + escapar(d.nota.serie) : '') + '</div></div>'
      +   '<div class="cela larga"><span class="r">Fornecedor</span>'
      +     '<div class="v">' + escapar(d.nota.fornecedor)
      +       (d.nota.cnpj ? '  ·  ' + cnpjBonito(d.nota.cnpj) : '') + '</div></div>'
      + '</div>';

    el.progresso.innerHTML = '<b>' + d.feitos + '</b> de ' + d.total + ' itens';

    // ---- travada -----------------------------------------------------------
    if (d.bloqueada) {
      el.travada.innerHTML = '<div class="travada">'
        + '<h2>Nota travada</h2>'
        + '<p>' + escapar(d.bloqueadaMotivo) + '</p>'
        + '<p>A contagem não continua. Chame o gerente: o desbloqueio está em '
        + '<b>Compra → Entrada de mercadoria → Desbloqueio da nota</b>.</p>'
        + '</div>';
      el.alvo.innerHTML = '';
      el.leitor.hidden = true;
      el.estado.textContent = 'travada';
      el.btnEfetivar.hidden = true;
      desenharConferidos();
      return;
    }

    el.travada.innerHTML = '';

    // ---- terminou ----------------------------------------------------------
    if (d.terminou) {
      el.alvo.innerHTML = '<div class="alvo" style="border-color:#059669;'
        + 'background:#ecfdf5">'
        + '<div class="ordem" style="color:#065f46">Contagem encerrada</div>'
        + '<div class="fab" style="color:#065f46">Os ' + d.total
        + ' itens bateram com a nota</div>'
        + '<div class="nosso">Confirme a entrada para subir o estoque e lançar '
        + 'os títulos no fluxo.</div>'
        + '</div>';
      el.leitor.hidden = true;
      el.estado.textContent = 'tudo conferido';
      el.btnEfetivar.disabled = false;
      desenharConferidos();
      return;
    }

    // ---- o item da vez -----------------------------------------------------
    const a = d.atual;
    el.leitor.hidden = false;

    el.alvo.innerHTML = '<div class="alvo">'
      + '<div class="ordem">Item ' + (a.numeroItem || (a.indice + 1))
      +   ' da nota  ·  ' + d.feitos + ' de ' + d.total + ' já conferidos</div>'
      + '<div class="fab">' + escapar(a.descricaoXml) + '</div>'
      + (a.descricaoNossa
          ? '<div class="nosso">↳ ' + escapar(a.descricaoNossa)
            + (a.referencia ? '  ·  ' + escapar(a.referencia) : '') + '</div>'
          : '')
      + '<div class="barras">'
      +   '<span class="rot">Código de barras</span>'
      +   '<code>' + escapar(a.ean || 'sem código de barras') + '</code>'
      +   (a.codigoFornec
            ? '<span class="rot">ref</span><code>' + escapar(a.codigoFornec) + '</code>'
            : '')
      +   '<span class="rot">nosso cód.</span>'
      +   '<code class="nosso-cod">' + a.codigoProd + '</code>'
      + '</div>'
      + '</div>';

    el.estado.textContent = d.feitos + ' de ' + d.total + ' conferidos';
    el.btnEfetivar.disabled = true;

    desenharConferidos();
  }

  // A nota inteira, na ordem dela. O que ja fechou vai em verde com a
  // quantidade; o da vez fica marcado; o que falta aparece cinza, sem numero
  // nenhum — a quantidade da nota nao chega aqui antes da contagem.
  function desenharConferidos() {
    const lista = estado.dados.itens || [];

    if (!lista.length) {
      el.conferidos.innerHTML = '<div class="vazio">A nota não tem itens.</div>';
      return;
    }

    el.conferidos.innerHTML = '<table class="lista"><thead><tr>'
      + '<th style="width:54px">Item</th>'
      + '<th style="width:90px">Código</th><th>Produto</th>'
      + '<th class="n" style="width:130px">Contado</th>'
      + '</tr></thead><tbody>'
      + lista.map(c => {
          const classe = c.conferido ? 'feito' : (c.atual ? 'agora' : 'falta');
          const contado = c.conferido
            ? '<span class="qtd">' + c.quantidade + '</span>'
            : (c.atual
                ? '<span class="agora-rot">contando</span>'
                : '<span class="falta-rot">—</span>');

          return '<tr class="' + classe + '">'
            + '<td class="num">' + (c.numeroItem || (c.indice + 1)) + '</td>'
            + '<td class="cod">' + (c.codigoProd || '—') + '</td>'
            + '<td>' + escapar(c.descricao)
            +   '<div class="xml">' + escapar(c.descricaoXml) + '</div></td>'
            + '<td class="n">' + contado
            +   (c.tentativas > 1
                  ? '<div class="xml">' + c.tentativas + ' tentativas</div>' : '')
            + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';
  }

  // ---- leitura --------------------------------------------------------------
  //
  // A comparacao e feita AQUI: a tela ja sabe o codigo do item da vez. Uma
  // ida ao banco so para dizer "sim, e essa caixa" custava 300 ms por item.
  // O servidor confere de novo junto com a quantidade, entao nada se perde.
  const soDigitos = v => String(v || '').replace(/\D+/g, '');
  const chaveRef  = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  function codigoBate(item, codigo) {
    if (!item) return false;
    const d = soDigitos(codigo);
    const k = chaveRef(codigo);
    return (item.ean && soDigitos(item.ean) === d)
        || (item.codigoFornec && chaveRef(item.codigoFornec) === k)
        || (item.codigoProd && String(item.codigoProd) === d);
  }

  function ler(codigo) {
    const d = estado.dados;
    if (!d || d.bloqueada || d.terminou) return;

    if (codigoBate(d.atual, codigo)) {
      estado.codigoLido = codigo;
      abrirQuantidade();
      return;
    }

    // e de outro item da nota? Ajuda mais do que "código errado".
    const outro = (d.itens || []).find(i =>
      !i.atual && codigoBate(i, codigo));

    if (outro) {
      recado(outro.conferido
        ? 'Esta caixa é do item ' + (outro.numeroItem || outro.indice + 1)
          + ', que já foi conferido.'
        : 'Esta caixa é do item ' + (outro.numeroItem || outro.indice + 1)
          + '. Ela vem depois — agora é a que está na tela.', 'erro');
    } else {
      recado('Este código não é o do item da tela.', 'erro');
    }
  }

  // ---- a quantidade ---------------------------------------------------------
  // Dois campos na mesma faixa: o codigo abre o da quantidade. Sem janela no
  // meio da contagem — quem esta com a caixa na mao nao quer clicar em nada.
  function abrirQuantidade() {
    estado.contando = true;
    el.leitor.classList.add('contando');
    el.qtd.disabled = false;
    el.qtd.value = '';
    el.qtd.focus();

    const a = estado.dados.atual;
    recado(a.tentativas > 0
      ? 'Conte e digite a quantidade — tentativa ' + (a.tentativas + 1) + ' de 3.'
      : 'Caixa certa. Conte e digite a quantidade.', 'aviso');
  }

  function fecharQuantidade() {
    estado.contando = false;
    estado.codigoLido = '';
    el.leitor.classList.remove('contando');
    el.qtd.value = '';
    el.qtd.disabled = true;
    focarLeitor();
  }

  async function confirmarQuantidade() {
    const valor = String(el.qtd.value).replace(/\D+/g, '');
    if (valor === '') { el.qtd.focus(); return; }

    const quantidade = Number(valor);
    el.qtd.disabled = true;

    try {
      const r = await enviar('/compra/api/conferencia/' + notaId + '/contar',
        { quantidade, codigo: estado.codigoLido || '' });
      if (!r) return;

      if (r.confere) {
        // a resposta ja traz o estado inteiro: nada de segunda viagem
        estado.dados = r;
        estado.codigoLido = '';
        fecharQuantidade();
        desenhar();
        recado('✓ ' + r.confirmado.descricao + '  ·  '
          + r.confirmado.quantidade + ' unidade(s)', 'ok');
        return;
      }

      // errou, mas ainda ha tentativa: o campo continua aberto
      if (estado.dados.atual) estado.dados.atual.tentativas = r.tentativas;

      el.qtd.disabled = false;
      el.qtd.value = '';
      el.qtd.focus();

      recado(r.ultima
        ? 'Ainda não bate. ÚLTIMA tentativa — se errar de novo, a nota trava '
          + 'e só o gerente destrava.'
        : 'Não bate com a nota. Conte de novo — tentativa '
          + (r.tentativas + 1) + ' de 3.', 'erro');

    } catch (e) {
      if (e.corpo && e.corpo.bloqueada) {
        fecharQuantidade();
        await carregar();
        return;
      }
      el.qtd.disabled = false;
      el.qtd.focus();
      recado(e.message, 'erro');
    }
  }

  // ---- efetivar -------------------------------------------------------------
  async function efetivar() {
    el.btnEfetivar.disabled = true;
    el.btnEfetivar.textContent = 'Confirmando…';

    try {
      const r = await enviar('/compra/api/nota/' + notaId + '/efetivar', {
        saldo: 'saldo',
      });
      if (!r) return;

      const partes = [];
      if (r.produtos?.length) partes.push(r.produtos.length + ' produtos no estoque');
      if (r.titulos) partes.push(r.titulos + ' títulos no fluxo');
      if (r.pedido) partes.push('pedido ' + r.pedido.numero + ' → ' + r.pedido.situacao);

      recado('✓ Entrada confirmada: ' + partes.join('  ·  '), 'ok');
      el.btnEfetivar.textContent = 'Entrada confirmada';

      setTimeout(() => { window.location.href = '/compra/entrada'; }, 2500);

    } catch (e) {
      recado(e.message, 'erro');
      el.btnEfetivar.disabled = false;
      el.btnEfetivar.textContent = 'Confirmar a entrada';
    }
  }

  // ---- atalho do mouse, enquanto nao ha leitor ------------------------------
  //
  // Clicar no codigo de barras vale como passar o leitor: preenche e le.
  // Copiar e colar era um passo a mais sem nenhuma vantagem.
  //
  // Com leitor de verdade ligado, o atalho se desliga sozinho — ver
  // reconhecerLeitor(). Ler com o mouse e muleta de quem nao tem o aparelho,
  // nao um caminho para pular a conferencia.
  function podeClicarParaLer() {
    return !estado.temLeitor && !estado.contando;
  }

  function lerDoCodigo(c) {
    if (!podeClicarParaLer()) {
      recado('Leitor ligado: passe o leitor na caixa.', 'aviso');
      return;
    }
    const texto = c.textContent.replace(/[^0-9A-Za-z]/g, '');
    if (!texto) return;

    c.classList.add('copiado');
    setTimeout(() => c.classList.remove('copiado'), 900);
    ler(texto);
  }

  el.alvo.addEventListener('click', ev => {
    const c = ev.target.closest('code');
    if (c) lerDoCodigo(c);
  });

  // ---- reconhecer o leitor --------------------------------------------------
  //
  // Leitor USB e um teclado que digita sozinho: as teclas chegam a poucos
  // milissegundos uma da outra, coisa que dedo humano nao faz. Seis teclas
  // com media abaixo de 30 ms sao leitor.
  function reconhecerLeitor() {
    const agora = Date.now();
    estado.teclas.push(agora);
    if (estado.teclas.length > 12) estado.teclas.shift();
    if (estado.teclas.length < 6) return;

    const intervalos = [];
    for (let i = 1; i < estado.teclas.length; i++) {
      intervalos.push(estado.teclas[i] - estado.teclas[i - 1]);
    }
    const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;

    if (media < 30 && !estado.temLeitor) {
      estado.temLeitor = true;
      try { localStorage.setItem(CHAVE_LEITOR, '1'); } catch (e) {}
      aplicarLeitor();
      recado('Leitor reconhecido. A leitura pelo mouse foi desligada.', 'aviso');
    }
  }

  function aplicarLeitor() {
    document.body.classList.toggle('com-leitor', estado.temLeitor);
  }

  // ---- eventos --------------------------------------------------------------
  el.voltar.addEventListener('click', () => {
    window.location.href = '/compra/entrada/' + notaId;
  });

  el.codigo.addEventListener('keydown', ev => {
    if (ev.key.length === 1) reconhecerLeitor();
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const codigo = el.codigo.value.trim();
    el.codigo.value = '';
    if (codigo) ler(codigo);
  });

  // colar ja vale como leitura: o leitor manda o Enter sozinho, a colagem
  // nao — e ficar pedindo Enter depois do Ctrl+V so atrasa
  el.codigo.addEventListener('paste', () => {
    setTimeout(() => {
      const codigo = el.codigo.value.trim();
      el.codigo.value = '';
      if (codigo) ler(codigo);
    }, 0);
  });

  el.qtd.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); confirmarQuantidade(); }
    if (ev.key === 'Escape') { ev.preventDefault(); fecharQuantidade(); }
  });

  el.btnEfetivar.addEventListener('click', efetivar);

  // o leitor perde o foco com facilidade; devolve sozinho
  // Devolve o foco ao leitor — mas NUNCA por cima de uma selecao de texto.
  // Era isso que impedia copiar o codigo de barras da tela: ao soltar o
  // mouse, o focus() cancelava a selecao e o Ctrl+C copiava nada.
  document.addEventListener('click', ev => {
    if (ev.target.closest('button, input, code')) return;
    const selecao = window.getSelection();
    if (selecao && String(selecao).trim()) return;
    focarLeitor();
  });

  aplicarLeitor();
  carregar();

})();
