// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\entrada.js
// Alterado em: 25/09/2026  (importacao le o XML como texto e manda JSON)
// Alterado em: 27/09/2026  (o painel virou fila de trabalho: a pesquisa saiu
//                           daqui e virou pagina propria)
//
// PAINEL DE ENTRADA: a fila de trabalho.
//
// So o que chegou e ainda nao terminou. Historico — efetivadas, recusadas,
// busca por mes ou fornecedor — mora na Pesquisa de notas.
// APIs: /compra/api/nota/{resumo,lista,importar}
// =============================================================================

'use strict';

(function () {

  // O painel e a FILA DE TRABALHO: so as tres situacoes em que ainda ha algo
  // a fazer. Efetivada e recusada sao historico, e historico se procura na
  // Pesquisa de notas — um contador de efetivadas so cresce e nao diz nada.
  const SITUACOES = [
    { chave: 'RECEBIDA',       nome: 'Recebidas' },
    { chave: 'VINCULADA',      nome: 'Vinculadas' },
    { chave: 'EM_CONFERENCIA', nome: 'Em conferência' },
  ];

  const estado = {
    filtro: 'abertas',     // 'abertas' ou uma das tres situacoes
    arquivos: [],
    resumo: null,
  };

  const $ = id => document.getElementById(id);

  const el = {
    cartoes:    $('cartoes'),
    lista:    $('lista'),

    btnImportar: $('btn-importar'),
    fundo:       $('fundo-modal'),
    fecharModal: $('fechar-modal'),
    cancelar:    $('cancelar-modal'),
    solta:       $('solta'),
    arquivos:    $('arquivos'),
    escolhidos:  $('escolhidos'),
    enviar:      $('enviar-xml'),
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

  const rotulo = chave =>
    (SITUACOES.find(s => s.chave === chave) || {}).nome || chave;

  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  // ---- cartoes --------------------------------------------------------------
  async function carregarResumo() {
    try {
      const d = await buscar('/compra/api/nota/resumo');
      if (!d) return;
      estado.resumo = d;

      el.cartoes.innerHTML = SITUACOES.map(s => {
        const v = d.porSituacao[s.chave] || { quantidade: 0, valor: 0 };
        return ''
          + '<div class="cartao' + (estado.filtro === s.chave ? ' ativo' : '') + '"'
          +      ' data-s="' + s.chave + '">'
          +   '<div class="rotulo">' + s.nome + '</div>'
          +   '<div class="numero">' + v.quantidade + '</div>'
          +   '<div class="valor">' + moeda(v.valor) + '</div>'
          + '</div>';
      }).join('');
    } catch (e) {
      console.error('[resumo]', e);
    }
  }

  // ---- lista ----------------------------------------------------------------
  async function carregarLista() {
    el.lista.innerHTML = '<div class="aviso">Carregando...</div>';

    try {
      const url = '/compra/api/nota/lista?situacao='
        + encodeURIComponent(estado.filtro);

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

  // A lista mostrava "Nenhuma nota por aqui" com o cartao EFETIVADAS marcando
  // 1 — duas verdades opostas na mesma tela. O filtro padrao so traz as
  // abertas; quando ha notas fora dele, a mensagem diz isso e oferece a saida.
  // Fila vazia e boa noticia, nao erro. E o caminho para o historico fica
  // na propria mensagem: e para la que a pessoa vai querer ir em seguida.
  function listaVazia() {
    return '<div class="aviso"><strong>Nada em andamento</strong>'
      + 'Toda nota que chegou já foi conferida. '
      + 'Importe um XML, ou procure uma nota antiga em '
      + '<a href="/compra/notas">Pesquisa de notas</a>.</div>';
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
    await Promise.all([carregarResumo(), carregarLista()]);
  }

  // ---- eventos da lista -----------------------------------------------------
  el.cartoes.addEventListener('click', ev => {
    const c = ev.target.closest('.cartao');
    if (!c) return;
    // clicar de novo no mesmo cartao volta para as abertas
    estado.filtro = (estado.filtro === c.dataset.s) ? 'abertas' : c.dataset.s;
    recarregar();
  });

  el.lista.addEventListener('click', ev => {
    const linha = ev.target.closest('.nota');
    if (!linha) return;
    window.location.href = '/compra/entrada/' + linha.dataset.id;
  });

  // ---- modal de importacao --------------------------------------------------
  function abrirModal() {
    estado.arquivos = [];
    el.arquivos.value = '';
    el.escolhidos.innerHTML = '';
    el.enviar.disabled = true;
    el.enviar.textContent = 'Importar';
    el.fundo.classList.add('aberto');
  }

  function fecharModal() {
    el.fundo.classList.remove('aberto');
  }

  function listarEscolhidos() {
    if (!estado.arquivos.length) {
      el.escolhidos.innerHTML = '';
      el.enviar.disabled = true;
      return;
    }
    el.escolhidos.innerHTML = estado.arquivos
      .map(f => '<div>📄 ' + escapar(f.name) + '</div>').join('');
    el.enviar.disabled = false;
  }

  function receberArquivos(lista) {
    const xmls = [...lista].filter(f => /\.xml$/i.test(f.name));
    if (!xmls.length) {
      alert('Escolha arquivos .xml da nota fiscal.');
      return;
    }
    estado.arquivos = xmls;
    listarEscolhidos();
  }

  el.btnImportar.addEventListener('click', abrirModal);
  el.fecharModal.addEventListener('click', fecharModal);
  el.cancelar.addEventListener('click', fecharModal);

  el.fundo.addEventListener('click', ev => {
    if (ev.target === el.fundo) fecharModal();
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && el.fundo.classList.contains('aberto')) fecharModal();
  });

  el.solta.addEventListener('click', () => el.arquivos.click());
  el.arquivos.addEventListener('change', () => receberArquivos(el.arquivos.files));

  ['dragenter', 'dragover'].forEach(e =>
    el.solta.addEventListener(e, ev => {
      ev.preventDefault();
      el.solta.classList.add('sobre');
    }));

  ['dragleave', 'drop'].forEach(e =>
    el.solta.addEventListener(e, ev => {
      ev.preventDefault();
      el.solta.classList.remove('sobre');
    }));

  el.solta.addEventListener('drop', ev => receberArquivos(ev.dataTransfer.files));

  // le um arquivo como texto — o XML vai para o servidor dentro de um JSON,
  // sem multer e sem arquivo temporario em disco
  function lerTexto(arquivo) {
    return new Promise((ok, erro) => {
      const leitor = new FileReader();
      leitor.onload  = () => ok(String(leitor.result || ''));
      leitor.onerror = () => erro(new Error('não consegui ler ' + arquivo.name));
      leitor.readAsText(arquivo, 'UTF-8');
    });
  }

  el.enviar.addEventListener('click', async () => {
    if (!estado.arquivos.length) return;

    el.enviar.disabled = true;
    el.enviar.textContent = 'Importando...';

    try {
      const corpo = [];
      for (const f of estado.arquivos) {
        corpo.push({ nome: f.name, xml: await lerTexto(f) });
      }

      const r = await fetch('/compra/api/nota/importar', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arquivos: corpo }),
      });

      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }

      const j = await r.json();
      if (!j.ok) throw new Error(j.erro || 'falha ao importar');

      const linhas = [];
      if (j.importadas) linhas.push(j.importadas + ' nota(s) importada(s)');
      if (j.repetidas)  linhas.push(j.repetidas + ' já existia(m)');
      if (j.falharam)   linhas.push(j.falharam + ' com erro');

      for (const d of j.detalhes || []) {
        if (d.situacao === 'erro') {
          linhas.push('\n✕ ' + d.nome + ': ' + d.mensagem);
        } else if (d.situacao === 'repetida') {
          // a API já recusava a duplicata, mas o aviso ficava escondido num
          // contador — quem importa duas vezes merece ver qual nota era
          linhas.push('\n↺ ' + d.nome + ': ' + d.mensagem
            + '\n   nada foi alterado nela');
        } else if (d.situacao === 'importada') {
          linhas.push('\n✓ nota ' + d.numero + ' — ' + d.fornecedor);
          linhas.push('   ' + d.identificados + ' de ' + d.itens + ' itens identificados');
          if (d.semCadastro)    linhas.push('   ⚠ fornecedor não está no cadastro');
          if (d.vinculouPedido) linhas.push('   ✓ vinculada ao pedido pendente');
        }
      }

      alert(linhas.join('\n'));
      fecharModal();
      recarregar();

    } catch (e) {
      alert('Não foi possível importar:\n\n' + e.message);
      console.error('[importar]', e);
      el.enviar.disabled = false;
      el.enviar.textContent = 'Importar';
    }
  });

  // ---- inicio ---------------------------------------------------------------
  recarregar();

})();