// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\venda.js
// Criado em: 02/10/2026
//
// VENDA — Parte 1: lancar e gravar a venda ABERTA.
//   - Cupom (balcao, cliente opcional) ou Nota fiscal (cliente obrigatorio)
//   - 02/10/2026: cabecalho do cliente sempre visivel, com os dados completos;
//     na lista de clientes, DUPLO CLIQUE escolhe (setas + Enter tambem)
//   - 02/10/2026: NOTA mostra a ficha do cliente (campos sempre a vista);
//     CUPOM mostra so o cabecalho da loja. Duplo clique corrigido (o 1o clique
//     nao redesenha a lista).
//   - 02/10/2026: fornecedor e um COMBO (filtro); a busca e so no produto.
//     Com fornecedor escolhido, a lista abre mesmo sem digitar.
//   - A vista ou a prazo: troca o preco de todos os itens
//   - 02/10/2026: DOCUMENTO no menu lateral (mesmo #seg-doc, botoes data-v);
//     CONDICAO e um <select id="sel-cond"> abaixo dos totais
//   - 03/10/2026: erro ao carregar o combo de fornecedor aparece no rodape
//   - 03/10/2026: combo traz { nr, marca }: valor = nrFornec, mostra a marca
//   - 03/10/2026: gravou -> modal de sucesso: Nova venda (tela limpa), Imprimir
//     (espelho da venda, sem valor fiscal), Continuar nesta venda, Voltar ao menu
//   - 03/10/2026: modal arrasta pelo titulo para qualquer lado; volta ao centro a cada abertura
//   - 03/10/2026: PARTE 2 — "Fechar venda": grava o que esta na tela e abre o modal de
//     fechamento. A vista: dinheiro, PIX (bancos que recebem), debito (cartao). A prazo:
//     credito (cartao, 1 a 10x) ou titulo (so PJ com NF). API POST /:id/fechar
//   - 03/10/2026: debito entra no dia seguinte (previa acompanha o servidor)
//   - 05/10/2026: DINHEIRO pede o "Valor recebido": Enter confirma o valor (mostra o
//     troco), libera e foca "Confirmar fechamento". Titulo em banco: aviso grande
//     quando nao vale (so PJ com NF); cobranca no Banestes/Armacao
//   - 05/10/2026: nota fiscal mostra P. fisica / P. juridica no menu lateral; a busca de
//     cliente procura so o tipo escolhido (?tipo=PF|PJ), que aparece ao lado de "Cliente"
//   - 05/10/2026: lista de clientes em colunas (codigo · nome · CPF/CNPJ · cidade) e
//     paginada: rodape com anterior/proxima (ou PageUp/PageDown), 20 por pagina
//   - 05/10/2026: conta contabil do cliente: coluna na lista ("sem contábil" em vermelho);
//     na ficha, "vincular conta" abre o modal do plano: procura (Enter/duplo clique liga)
//     ou cria a conta nova no titulo escolhido (proximo numero) e liga ao cliente
//   - 07/10/2026: trocar P. fisica <-> P. juridica com produtos lancados pergunta antes e
//     LIMPA cliente e produtos (nao fica produto com cabecalho vazio). Venda ja gravada
//     vira uma venda nova; a antiga fica aberta, como rascunho
//   - 05/10/2026: no modal do plano, "editar ficha" (ou Enter/duplo clique na conta) abre a
//     FICHA do cliente com a conta marcada, para conferir e gravar; "incluir plano" mostra
//     o "criar conta nova" (escondido ate la); os dois botoes ficam em cada linha
//   - 09/10/2026: GARANTIA (arquivo_docs.garantia = 1: garantia, servico e manutencao) no
//     lugar do "instala": produto com garantia aparece em VIOLETA na busca e na linha, e so
//     ele mostra a caixa "Instalar" (vem marcada). Produto sem garantia: clicar na descricao
//     pergunta "É garantia?" — OK grava garantia = 1. (so nota fiscal)
//   - 10/10/2026: INSTALACAO com AGENDA: sai so a caixa do PERIODO; DAS e ATE ficam. Marcada a
//     data, abre a faixa da direita 07:00-19:00 de 30 em 30 min: ocupado (vermelho, nome do
//     cliente) nao clica; livre: 1o clique marca o inicio, 2o clique (depois) marca o fim, e
//     isso preenche DAS/ATE (digitar em DAS/ATE tambem marca a agenda).
//     O servidor confere de novo ao fechar a venda (dois clientes no mesmo horario: recusa)
//   - 10/10/2026: agenda: Enter no ATE vai para "Confirmar instalação"; a lista de horarios rola
//     dentro da faixa (o botao nao some); o horario escolhido mostra o NOME do cliente
//   - 10/10/2026: BUSCA DE PRODUTO em colunas (código · descrição · referência · estoque ·
//     preço) com cabeçalho; a marca só aparece quando o combo está em "todos os fornecedores"
//   - 10/10/2026: MODAIS cabem na tela: altura maxima 94vh, rolam por dentro com o titulo
//     fixo; o de fechamento abre a 3vh do topo (sobrava em cima, faltava embaixo)
//   - 10/10/2026: CONTA NOVA sem lista de titulos: mostra so a CONTA que o cliente vai ganhar
//     (ex.: 1.03.017.772, no ultimo titulo); e so confirmar
//   - 10/10/2026: CONTA NOVA vai no ULTIMO titulo do grupo (ex.: 1.03.017), ja selecionado;
//     titulo que chegou ao 999 aparece "(cheio)" e desabilitado. Se o ultimo encheu, aparece
//     selecionada a opcao "TITULO NOVO 1.03.018 - ..." (o servidor cria o titulo e a conta .001)
//   - 09/10/2026: produto COM garantia (violeta): clicar na descricao pergunta "Tirar
//     garantia?" — OK grava garantia = 0 (desfaz clique errado; sai da instalacao)
//   - 09/10/2026: o TOTAL DA LINHA acompanha enquanto digita (unitario, qtd, desconto);
//     antes so mudava ao sair do campo. Resposta da API que nao e JSON mostra o
//     endereco e o status (em vez de "Unexpected ... JSON")
//   - 09/10/2026: UNITARIO EDITAVEL (preco negociado). Embaixo aparece o preco de tabela;
//     apagar o campo volta para a tabela. Trocar a condicao volta todos para a tabela
//   - 09/10/2026: INSTALACAO (so nota fiscal): coluna "Inst." em cada item; o produto que
//     ja foi marcado uma vez vem marcado (aprende: arquivo_docs.instala) e aparece com 🔧
//     na busca. Com item marcado aparece o botao "Instalação": modal da OS (tecnico =
//     2.06.001.NNN, dia previsto, periodo, local, servico por item). Fechar exige a
//     instalacao confirmada; a OS nasce no fechamento
//   - 09/10/2026: "+ Novo cliente" abre o cadastro (tela de clientes em modo embutido)
//     por cima da venda, ja no tipo escolhido (PF/PJ). Gravou: a venda procura pelo
//     CPF/CNPJ e escolhe o cliente sozinha. Cancelou: so fecha
//   - 07/10/2026: fechamento com MAIS DE UMA FORMA de pagamento (lista de partes, "Falta
//     receber", troco no dinheiro) e cartao de CREDITO parcelado tambem na venda a vista
//   - Produto: codigo, descricao ou referencia; Enter adiciona o primeiro achado
//   - Quantidade inteira; desconto por item e geral (moeda); totais sozinhos
// O preco que vale e o do servidor: a tela so mostra.
//
// API: /vendas/api/venda (produtos, clientes, POST, PUT, GET /:id)
// =============================================================================

'use strict';

(function () {
  const API = '/vendas/api/venda';
  const $ = id => document.getElementById(id);

  const estado = {
    id: document.body.dataset.vendaId || '',
    documento: 'CUPOM', condicao: 'VISTA',
    cliente: null,
    loja: null,         // cabecalho da loja (para a impressao)
    instalacao: null,   // dados da OS (so NF com item marcado)
    itens: [],          // { codigo, descricao, descricaoTecnica, referencia, estoque, precoVista, precoPrazo, quantidade, desconto }
  };

  // ---- utilitarios ----------------------------------------------------------------
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paraCentavos = t => {
    const s = String(t ?? '').trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };
  const escapar = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  async function api(metodo, url, corpo) {
    const r = await fetch(API + url, {
      method: metodo, credentials: 'same-origin',
      headers: corpo ? { 'Content-Type': 'application/json' } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; throw new Error('sessão expirada'); }
    const texto = await r.text();
    let j;
    try { j = JSON.parse(texto); }
    catch (e) { throw new Error('resposta inválida de ' + metodo + ' ' + url + ' (status ' + r.status + '): ' + texto.slice(0, 80)); }
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  let sumir = null;
  function recado(t, tipo) {
    clearTimeout(sumir);
    $('recado').className = 'recado ' + (tipo || 'ok');
    $('recado').textContent = t;
    if (tipo !== 'erro') sumir = setTimeout(() => { $('recado').textContent = ''; }, 5000);
  }

  const precoTabela = i => estado.condicao === 'PRAZO' ? (i.precoPrazo || i.precoVista) : i.precoVista;
  const preco = i => (i.precoManual > 0 ? i.precoManual : precoTabela(i));   // negociado, ou o da tabela

  // ---- documento e condicao ----------------------------------------------------------
  function ligarSeg(id, chave, depois) {
    $(id).addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      estado[chave] = b.dataset.v;
      $(id).querySelectorAll('button').forEach(x => x.classList.toggle('ativo', x === b));
      depois();
    });
  }
  function marcarSeg(id, valor) {
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('ativo', x.dataset.v === valor));
  }
  ligarSeg('seg-doc', 'documento', () => {
    // nota fiscal: os itens com garantia vem marcados para instalar
    if (estado.documento === 'NFE') estado.itens.forEach(i => { if (i.garantia) i.precisaInstalacao = true; });
    mostrarCliente(); desenharItens();
  });

  // tipo de cliente da nota: a busca procura so ele
  estado.tipoCliente = 'PF';
  function mostrarTipo() {
    const pf = estado.tipoCliente !== 'PJ';
    $('cli-tipo').textContent = pf ? 'pessoa física' : 'pessoa jurídica';
    $('busca-cliente').placeholder = pf
      ? 'pessoa física: nome (2 letras), número (17281 / F17281) ou CPF — duplo clique escolhe'
      : 'pessoa jurídica: nome (2 letras), número (1705 / J1705) ou CNPJ — duplo clique escolhe';
  }
  let tipoAnterior = 'PF';
  ligarSeg('seg-tipo', 'tipoCliente', () => {
    if (estado.tipoCliente === tipoAnterior) return;
    if (estado.itens.length) {
      const ok = confirm('Trocar para ' + (estado.tipoCliente === 'PJ' ? 'pessoa jurídica' : 'pessoa física')
        + ' começa a venda de novo: o cliente e os ' + estado.itens.length + ' produto(s) lançados saem da tela. Continuar?');
      if (!ok) { estado.tipoCliente = tipoAnterior; marcarSeg('seg-tipo', tipoAnterior); return; }
      estado.itens = [];
      $('desc-geral').value = '';
      estado.cliente = null; $('oc-cliente').value = ''; desenharCliente();
      if (estado.id) {                               // a gravada fica como rascunho; esta e nova
        estado.id = null;
        history.replaceState(null, '', '/vendas/venda');
        $('titulo').textContent = 'Nova venda'; $('situacao').textContent = ''; document.title = 'Nova venda';
      }
      desenharItens();
    }
    tipoAnterior = estado.tipoCliente;
    mostrarTipo();
    $('busca-cliente').value = '';
    $('lista-clientes').hidden = true;
    if (estado.cliente && estado.cliente.tipo && estado.cliente.tipo !== estado.tipoCliente) {
      estado.cliente = null; $('oc-cliente').value = ''; desenharCliente();
    }
    $('busca-cliente').focus();
  });
  // condicao: select abaixo dos totais; trocar recalcula o preco de todos os itens
  $('sel-cond').addEventListener('change', ev => {
    estado.condicao = ev.target.value === 'PRAZO' ? 'PRAZO' : 'VISTA';
    // a tabela mudou: preco negociado volta para a tabela da nova condicao
    const tinha = estado.itens.some(i => i.precoManual > 0);
    estado.itens.forEach(i => { i.precoManual = null; });
    desenharItens();
    if (tinha) recado('Condição trocada: os preços negociados voltaram para a tabela. Negocie de novo, se for o caso.', 'erro');
  });

  function mostrarCliente() {
    // nota: ficha do cliente (obrigatorio); cupom: so o cabecalho da loja
    const nota = estado.documento === 'NFE';
    $('bloco-cliente').hidden = !nota;
    $('bloco-loja').hidden = nota;
    $('cli-obrig').hidden = !nota;
    $('bloco-tipo').hidden = !nota;
    mostrarTipo();
    if (nota && !estado.cliente) setTimeout(() => $('busca-cliente').focus(), 0);
  }

  // ---- busca com lista (cliente e produto) ------------------------------------------
  // url: texto ou funcao (o produto inclui o fornecedor do combo);
  // podeVazio(): a lista pode abrir sem digitar (produto com fornecedor escolhido)
  function ligarBusca(inputId, listaId, url, montar, escolher, duploClique, podeVazio) {
    const input = $(inputId), lista = $(listaId);
    let espera = null, achados = [], sel = 0;
    let pagina = 1, pag = null;          // pag = { total, pagina, paginas, porPagina } quando a API pagina
    const fechar = () => { lista.hidden = true; achados = []; };
    const desenhar = () => {
      const cab = listaId === 'lista-produtos' && achados.length
        ? '<div class="op cab"><span>Código</span><span>Descrição</span><span>Referência</span>'
          + '<span class="n">Estoque</span><span class="n">' + (estado.condicao === 'PRAZO' ? 'A prazo' : 'À vista') + '</span></div>' : '';
      let html = cab + achados.map((a, k) => '<div class="op' + (k === sel ? ' sel' : '') + '" data-k="' + k + '">' + montar(a) + '</div>').join('')
        || '<div class="op s">nada encontrado</div>';
      if (pag && pag.total > pag.porPagina) {
        const ini = (pag.pagina - 1) * pag.porPagina + 1, fim = ini + achados.length - 1;
        html += '<div class="op pagl"><button type="button" data-p="-1"' + (pag.pagina <= 1 ? ' disabled' : '') + '>◀ anterior</button>'
          + '<span>' + ini + '–' + fim + ' de ' + pag.total + ' · página ' + pag.pagina + '/' + pag.paginas + '</span>'
          + '<button type="button" data-p="1"' + (pag.pagina >= pag.paginas ? ' disabled' : '') + '>próxima ▶</button></div>';
      }
      lista.innerHTML = html;
      lista.hidden = false;
    };
    // busca (ou troca de pagina) — o texto digitado fica o mesmo
    const buscar = async () => {
      const q = input.value.trim();
      const base = typeof url === 'function' ? url() : url;
      const r = await api('GET', base + encodeURIComponent(q) + '&pagina=' + pagina);
      achados = r[listaId === 'lista-produtos' ? 'produtos' : 'clientes'];
      pag = r.total !== undefined ? { total: r.total, pagina: r.pagina, paginas: r.paginas, porPagina: r.porPagina } : null;
      sel = 0; desenhar();
      lista.scrollTop = 0;
    };
    const irPagina = async passo => {
      if (!pag) return;
      const nova = pag.pagina + passo;
      if (nova < 1 || nova > pag.paginas) return;
      pagina = nova;
      try { await buscar(); } catch (e) { recado(e.message, 'erro'); }
    };
    input.addEventListener('input', () => {
      clearTimeout(espera);
      const q = input.value.trim();
      const livre = podeVazio && podeVazio();
      if (!livre && q.length < 2 && !/^\d+$/.test(q)) { fechar(); return; }
      pagina = 1;                                   // texto novo: volta para a primeira pagina
      espera = setTimeout(async () => {
        try { await buscar(); } catch (e) { recado(e.message, 'erro'); }
      }, 250);
    });
    input.addEventListener('focus', () => { if (podeVazio && podeVazio() && !achados.length) input.dispatchEvent(new Event('input')); });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' && achados.length) { ev.preventDefault(); sel = Math.min(sel + 1, achados.length - 1); desenhar(); }
      else if (ev.key === 'ArrowUp' && achados.length) { ev.preventDefault(); sel = Math.max(sel - 1, 0); desenhar(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); if (achados[sel]) { escolher(achados[sel]); input.value = ''; fechar(); } }
      else if (ev.key === 'Escape') fechar();
      else if (ev.key === 'PageDown' && pag) { ev.preventDefault(); irPagina(1); }
      else if (ev.key === 'PageUp' && pag) { ev.preventDefault(); irPagina(-1); }
    });
    lista.addEventListener('mousedown', ev => {
      const bp = ev.target.closest('.pagl button');
      if (bp) { ev.preventDefault(); if (!bp.disabled) irPagina(Number(bp.dataset.p)); return; }
      if (ev.target.closest('.pagl')) { ev.preventDefault(); return; }
      const op = ev.target.closest('.op[data-k]');
      if (!op) return;
      ev.preventDefault();
      if (duploClique) {                       // um clique so marca, SEM redesenhar
        sel = Number(op.dataset.k);              // (redesenhar trocaria o elemento e o
        lista.querySelectorAll('.op').forEach(o => o.classList.toggle('sel', o === op));   // duplo clique se perderia)
        return;
      }
      escolher(achados[Number(op.dataset.k)]);
      input.value = '';
      fechar();
    });
    if (duploClique) lista.addEventListener('dblclick', ev => {
      const op = ev.target.closest('.op[data-k]');
      if (!op) return;
      escolher(achados[Number(op.dataset.k)]);
      input.value = '';
      fechar();
    });
    input.addEventListener('blur', () => setTimeout(fechar, 150));
  }

  // cliente
  ligarBusca('busca-cliente', 'lista-clientes', () => '/clientes?tipo=' + estado.tipoCliente + '&busca=',
    c => '<span class="c-cod">' + escapar(c.codigo) + '</span>'
      + '<span class="c-nome" title="' + escapar(c.nome) + '">' + escapar(c.nome) + '</span>'
      + '<span class="c-doc">' + (c.documento ? escapar(docFmt(c.documento)) : '—') + '</span>'
      + (c.ncontabil ? '<span class="c-cont">' + escapar(c.ncontabil) + '</span>' : '<span class="c-cont sem">sem contábil</span>')
      + '<span class="c-cid">' + escapar(c.cidade) + (c.uf ? '/' + escapar(c.uf) : '') + '</span>',
    c => { estado.cliente = c; desenharCliente(); $('busca-produto').focus(); }, true);

  const docFmt = d => {
    const s = String(d || '').replace(/\D/g, '');
    if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return s || '—';
  };
  function desenharCliente() {
    const c = estado.cliente;
    $('cli-busca-linha').hidden = !!c;
    $('cli-tirar').hidden = !c;
    $('cli-escolhido').classList.toggle('vazia', !c);
    $('bloco-oc').hidden = !(c && c.tipo === 'PJ');
    if (!c) {
      $('cli-nome').textContent = 'nenhum cliente escolhido';
      $('cli-codigo').textContent = '';
      ['cli-doc', 'cli-ie', 'cli-fone', 'cli-conta', 'cli-end', 'cli-bairro', 'cli-cidade', 'cli-cep']
        .forEach(id => { $(id).textContent = '—'; });
      $('cli-conta').style.color = '';
    } else {
      $('cli-nome').textContent = c.nome;
      $('cli-codigo').textContent = c.codigo + (c.tipo ? ' · ' + c.tipo : '');
      $('cli-doc').textContent = docFmt(c.documento);
      $('cli-ie').textContent = c.ie || '—';
      $('cli-fone').textContent = c.telefone || '—';
      $('cli-conta').textContent = c.ncontabil || 'sem contábil';
      $('cli-conta').style.color = c.ncontabil ? '' : 'var(--vermelho)';
      $('cli-end').textContent = [c.logradouro, c.numero, c.complemento].filter(Boolean).join(', ') || '—';
      $('cli-bairro').textContent = c.bairro || '—';
      $('cli-cidade').textContent = (c.cidade || '—') + (c.uf ? '/' + c.uf : '');
      $('cli-cep').textContent = c.cep ? String(c.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2') : '—';
    }
    $('cli-vincular').hidden = !(c && !c.ncontabil);
    mostrarCliente();
  }
  $('cli-tirar').addEventListener('click', () => { estado.cliente = null; $('oc-cliente').value = ''; desenharCliente(); });

  // ---- instalacao (so nota fiscal) -------------------------------------------------------
  let tecnicos = null;
  const marcadosInst = () => estado.documento === 'NFE' ? estado.itens.filter(i => i.precisaInstalacao) : [];
  const faltaInstalacao = () => marcadosInst().length > 0 && !(estado.instalacao && estado.instalacao.confirmada);

  // botao do rodape: aparece com item marcado; vermelho enquanto falta preencher
  function atualizarInst() {
    const b = $('instalacao');
    const n = marcadosInst().length;
    b.hidden = true;           // 13/10/2026: sem botao no rodape; a instalacao abre pela caixa OS
    if (!n) return;
    const ok = !faltaInstalacao();
    b.classList.toggle('ok', ok); b.classList.toggle('falta', !ok);
    b.textContent = '🔧 Instalação' + (ok ? ' ✓' : ' (preencher)');
    // a caixa OS mostra se a instalacao esta preenchida (verde) ou falta (vermelha)
    $('itens').querySelectorAll('input.inst:checked').forEach(x => {
      x.classList.toggle('ok', ok); x.classList.toggle('falta', !ok);
      x.title = ok ? 'instalação preenchida · clique: desmarca · Enter: fechar venda'
                   : 'falta preencher a instalação · Enter: fechar venda';
    });
  }

  // marcar/desmarcar "instalar" no item com garantia
  $('itens').addEventListener('change', async ev => {
    const el = ev.target;
    if (!el.classList.contains('inst')) return;
    const i = estado.itens.find(x => String(x.codigo) === el.dataset.cod);
    if (!i) return;
    i.precisaInstalacao = el.checked;
    if (estado.instalacao) estado.instalacao.confirmada = false;    // mudou a lista: conferir de novo
    atualizarInst();
    osVolta = el.dataset.cod;
    if (el.checked) abrirInstalacao();          // marcou OS: abre a instalacao direto
  });
  // Enter na caixa OS: abre o fechamento (se faltar a instalacao, ele abre a instalacao)
  $('itens').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || !ev.target.classList.contains('inst')) return;
    ev.preventDefault();
    osVolta = ev.target.dataset.cod;
    if (!$('fechar').disabled) abrirFechamento();
  });
  // ao sair da instalacao o foco volta para a caixa OS
  let osVolta = null;
  function focarOS() {
    const x = osVolta && $('itens').querySelector('input.inst[data-cod="' + osVolta + '"]');
    if (x) x.focus();
  }

  const vIns = id => $(id).value.trim();

  // ---- agenda do tecnico (07:00 a 19:00, linhas de 30 em 30 min) ----
  // DAS e ATE sao livres (qualquer minuto); a duracao NAO e automatica: o ATE e
  // sempre informado (digitado ou 2o clique na agenda).
  const AG_INI = 7 * 60, AG_FIM = 19 * 60, AG_PASSO = 30;
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const min = s => { const [h, m] = String(s || '').split(':').map(Number); return h * 60 + (m || 0); };
  // fim exclusivo (minutos); fim = null enquanto o ATE nao foi informado
  let agOcupados = [], agSemHora = [], agEscolha = { ini: null, fim: null };
  const agFimEf = () => agEscolha.fim !== null && agEscolha.fim > agEscolha.ini ? agEscolha.fim : agEscolha.ini + 1;
  function agLivre(a, b) {                      // [a, b) nao bate com nenhum ocupado?
    return agOcupados.every(o => b <= o.ini || a >= o.fim);
  }
  const agEscolhaLivre = () => agEscolha.ini === null || agLivre(agEscolha.ini, agFimEf());
  function agHorarioTexto() {             // a escolha da agenda vai para DAS / ATE
    $('ins-ini').value = agEscolha.ini === null ? '' : hm(agEscolha.ini);
    $('ins-fim').value = agEscolha.ini === null || agEscolha.fim === null ? '' : hm(agEscolha.fim);
  }
  function agDesenhar() {
    const corpo = $('ag-corpo');
    const temDia = !!$('ins-dia').value;
    $('ins-agenda').hidden = !temDia;                   // a faixa so abre com a data marcada
    $('ins-agenda').parentElement.classList.toggle('sem-agenda', !temDia);
    if (!temDia) return;
    if (!$('ins-tecnico').value) {
      corpo.innerHTML = '<div class="ag-vazio">Escolha o técnico para ver os horários dele.</div>'; return;
    }
    let h = '';
    for (let m = AG_INI; m < AG_FIM; m += AG_PASSO) {
      const oc = agOcupados.find(o => m >= o.ini && m < o.fim);
      const esc = agEscolha.ini !== null && m + AG_PASSO > agEscolha.ini && m < agFimEf();
      h += '<div class="ag-lin ' + (oc ? 'ocupado' : esc ? 'escolhido livre' : 'livre') + '" data-m="' + m + '"'
        + (oc ? ' title="' + escapar(oc.texto) + '"' : '') + '><span class="h">' + hm(m) + '</span><span class="c">'
        + (oc ? escapar(oc.cliente) : esc ? '✓ ' + escapar((estado.cliente && estado.cliente.nome) || 'esta instalação') : '') + '</span></div>';
    }
    if (agSemHora.length) h += '<div class="ag-sem">sem horário marcado: ' + agSemHora.map(escapar).join(', ') + '</div>';
    h += '<div class="ag-dica">1º clique: início · 2º clique: até o fim dessa linha. Ou digite DAS / ATÉ com qualquer minuto.</div>';
    corpo.innerHTML = h;
  }
  async function agCarregar() {
    agOcupados = []; agSemHora = [];
    const tec = $('ins-tecnico').value, dia = $('ins-dia').value;
    if (tec && dia) {
      $('ag-corpo').innerHTML = '<div class="ag-vazio">Carregando…</div>';
      try {
        const r = await api('GET', '/agenda?tecnico=' + encodeURIComponent(tec) + '&dia=' + dia
          + (estado.id ? '&venda=' + estado.id : ''));
        agOcupados = r.ocupados.map(o => ({ ini: min(o.horaIni), fim: o.horaFim ? min(o.horaFim) : min(o.horaIni) + AG_PASSO,
                                             cliente: o.cliente, texto: o.texto }));
        agSemHora = r.semHorario;
      } catch (e) { $('ins-msg').textContent = e.message; }
    }
    // a escolha que bater com um ocupado cai
    if (!agEscolhaLivre()) $('ins-msg').textContent = 'Esse horário bate com outro cliente do técnico.';
    agDesenhar();
  }
  $('ag-corpo').addEventListener('click', ev => {
    const l = ev.target.closest('.ag-lin.livre'); if (!l) return;
    const m = Number(l.dataset.m);
    const ini = agEscolha.ini;
    if (ini === null || m + AG_PASSO <= ini) agEscolha = { ini: m, fim: null };                 // inicio
    else if (agEscolha.fim !== null && m <= ini && ini < m + AG_PASSO) agEscolha = { ini: null, fim: null }; // limpa
    else if (agLivre(ini, m + AG_PASSO)) agEscolha.fim = m + AG_PASSO;                           // fim
    else { $('ins-msg').textContent = 'Há outro cliente no meio desse intervalo.'; return; }
    $('ins-msg').textContent = '';
    agHorarioTexto(); agDesenhar();
  });
  $('ins-tecnico').addEventListener('change', agCarregar);
  $('ins-dia').addEventListener('change', agCarregar);
  // digitou DAS / ATE: a agenda acompanha. Nao reescreve o campo enquanto se digita
  // (o navegador dispara change a cada pedaco da hora; reescrever travava o ATE).
  function agDosCampos() {
    const a = $('ins-ini').value, b = $('ins-fim').value;
    agEscolha = a ? { ini: min(a), fim: b ? min(b) : null } : { ini: null, fim: null };
  }
  function agConferir(final) {           // final = saiu do ATE / Enter / Confirmar
    let msg = '';
    if (agEscolha.ini !== null && !agEscolhaLivre()) msg = 'Esse horário bate com outro cliente do técnico.';
    else if (final && agEscolha.ini !== null && agEscolha.fim === null) msg = 'Informe o horário ATÉ.';
    else if (final && agEscolha.ini !== null && agEscolha.fim <= agEscolha.ini) msg = 'O ATÉ tem que ser depois do DAS.';
    else if (final && agEscolha.ini === null && $('ins-fim').value) msg = 'Informe o horário DAS.';
    $('ins-msg').textContent = msg;
    return !msg;
  }
  ['ins-ini', 'ins-fim'].forEach(id => {
    $(id).addEventListener('input', () => { agDosCampos(); agConferir(false); agDesenhar(); });
    $(id).addEventListener('change', () => { agDosCampos(); agConferir(false); agDesenhar(); });
  });
  $('ins-fim').addEventListener('blur', () => { if ($('ins-fim').value) agConferir(true); });

  async function abrirInstalacao() {
    const marcados = marcadosInst();
    if (!marcados.length) return;
    try {
      if (!tecnicos) tecnicos = (await api('GET', '/tecnicos')).tecnicos;
    } catch (e) { tecnicos = []; recado(e.message, 'erro'); }
    const ins = estado.instalacao || {};
    const c = estado.cliente || {};
    const e = ins.endereco || {};
    $('ins-titulo').innerHTML = '🔧 Instalação <small>arraste por aqui</small>';
    $('ins-det').textContent = (c.nome ? c.codigo + ' · ' + c.nome : 'sem cliente') + ' · ' + marcados.length + ' item(ns) para instalar';
    $('ins-tecnico').innerHTML = '<option value="">a definir</option>' + tecnicos.map(t =>
      '<option value="' + escapar(t.conta) + '" data-nome="' + escapar(t.nome) + '" data-receita="' + escapar(t.receita) + '">'
      + escapar(t.nome) + ' · ' + escapar(t.conta) + '</option>').join('');
    $('ins-tecnico').value = ins.tecnicoConta || '';
    $('ins-dia').value = ins.diaPrevisto ? String(ins.diaPrevisto).slice(0, 10) : '';
    agEscolha = ins.horaIni ? { ini: min(ins.horaIni), fim: ins.horaFim ? min(ins.horaFim) : null }
                            : { ini: null, fim: null };
    agHorarioTexto();
    // local: o que ja foi preenchido, senao o endereco do cliente
    const ou = (a, b) => (a !== undefined && a !== null && a !== '') ? a : (b || '');
    $('ins-logr').value = ou(e.logradouro, c.logradouro);
    $('ins-num').value = ou(e.numero, c.numero);
    $('ins-compl').value = ou(e.complemento, c.complemento);
    $('ins-bairro').value = ou(e.bairro, c.bairro);
    $('ins-cidade').value = ou(e.cidade, c.cidade);
    $('ins-uf').value = ou(e.uf, c.uf);
    $('ins-cep').value = ou(e.cep, c.cep);
    $('ins-edif').value = ins.edificio || ''; $('ins-apto').value = ins.apto || '';
    $('ins-ref').value = ins.pontoReferencia || '';
    $('ins-fone').value = ou(ins.telefone, c.telefone); $('ins-cel').value = ins.celular || '';
    $('ins-obs').value = ins.observacao || '';
    const antigos = new Map((ins.itens || []).map(x => [Number(x.codigo), x]));
    $('ins-itens').innerHTML = marcados.map(i => {
      const a = antigos.get(Number(i.codigo)) || {};
      return '<tr data-cod="' + i.codigo + '"><td>' + i.codigo + '</td><td>' + escapar(i.descricao) + '</td>'
        + '<td><input class="ins-serv" value="' + escapar(a.servico || 'Instalação') + '"></td>'
        + '<td><input class="ins-iobs" value="' + escapar(a.observacao || '') + '"></td></tr>';
    }).join('');
    $('ins-msg').textContent = '';
    agCarregar();
    const cx = $('ins-caixa');
    cx.style.left = '50%'; cx.style.top = '3vh'; cx.style.transform = 'translateX(-50%)';
    $('ins-fundo').hidden = false; cx.hidden = false;
    $('ins-tecnico').focus();
  }
  function fecharInstalacao() { $('ins-fundo').hidden = true; $('ins-caixa').hidden = true; focarOS(); }

  function confirmarInstalacao() {
    agDosCampos();
    if (!agConferir(true)) {
      $(agEscolha.ini === null ? 'ins-ini' : 'ins-fim').focus(); return;
    }
    const opt = $('ins-tecnico').selectedOptions[0];
    estado.instalacao = {
      confirmada: true,
      tecnicoConta: $('ins-tecnico').value,
      tecnicoNome: $('ins-tecnico').value && opt ? opt.dataset.nome : '',
      receitaConta: $('ins-tecnico').value && opt ? opt.dataset.receita : '',
      diaPrevisto: $('ins-dia').value || null,
      periodo: agEscolha.ini !== null ? 'FIXO' : 'NENHUM',            // com horario = FIXO (como no Access)
      horaIni: agEscolha.ini !== null ? hm(agEscolha.ini) : '',
      horaFim: agEscolha.ini !== null ? hm(agEscolha.fim) : '',
      endereco: { logradouro: vIns('ins-logr'), numero: vIns('ins-num'), complemento: vIns('ins-compl'),
                  bairro: vIns('ins-bairro'), cidade: vIns('ins-cidade'), uf: vIns('ins-uf').toUpperCase(),
                  cep: vIns('ins-cep').replace(/\D/g, '') },
      edificio: vIns('ins-edif'), apto: vIns('ins-apto'), pontoReferencia: vIns('ins-ref'),
      telefone: vIns('ins-fone'), celular: vIns('ins-cel'), observacao: vIns('ins-obs'),
      itens: [...$('ins-itens').querySelectorAll('tr[data-cod]')].map(tr => ({
        codigo: Number(tr.dataset.cod),
        servico: tr.querySelector('.ins-serv').value.trim() || 'Instalação',
        observacao: tr.querySelector('.ins-iobs').value.trim(),
      })),
    };
    fecharInstalacao();
    atualizarInst();
    recado('✓ instalação preenchida' + (estado.instalacao.tecnicoNome ? ' — técnico ' + estado.instalacao.tecnicoNome : ' — técnico a definir')
      + '. Ela é gravada com a venda; a OS nasce quando a venda for fechada.', 'ok');
  }

  $('instalacao').addEventListener('click', abrirInstalacao);
  $('ins-confirmar').addEventListener('click', confirmarInstalacao);
  $('ins-voltar').addEventListener('click', fecharInstalacao);
  $('ins-fundo').addEventListener('click', fecharInstalacao);
  // Enter anda de campo em campo dentro do modal; no ultimo, confirma
  $('ins-caixa').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.target.tagName === 'BUTTON') return;
    ev.preventDefault();
    if (ev.target.id === 'ins-fim') {
      agDosCampos(); agDesenhar();
      if (agConferir(true)) $('ins-confirmar').focus();
      return;
    }
    const campos = [...$('ins-caixa').querySelectorAll('input, select')].filter(x => !x.closest('[hidden]'));
    const k = campos.indexOf(ev.target);
    if (k >= 0 && k < campos.length - 1) campos[k + 1].focus(); else $('ins-confirmar').focus();
  });

  // ---- novo cliente sem sair da venda ----------------------------------------------------
  function fecharNovoCliente() { $('nc-fundo').hidden = true; $('nc-frame').src = 'about:blank'; }
  $('cli-novo').addEventListener('click', () => {
    $('nc-frame').src = '/vendas/clientes?embed=1&novo=' + (estado.tipoCliente === 'PJ' ? 'PJ' : 'PF');
    $('nc-fundo').hidden = false;
  });
  window.addEventListener('message', async ev => {
    if (ev.origin !== location.origin || !ev.data || typeof ev.data !== 'object') return;
    if (ev.data.tipo === 'cliente-cancelado') { fecharNovoCliente(); $('busca-cliente').focus(); return; }
    if (ev.data.tipo !== 'cliente-gravado') return;
    fecharNovoCliente();
    const tipo = ev.data.tipoCliente === 'PJ' ? 'PJ' : 'PF';
    try {
      const r = await api('GET', '/clientes?tipo=' + tipo + '&busca=' + encodeURIComponent(ev.data.cpfCnpj || ''));
      const c = (r.clientes || []).find(x => String(x.documento).replace(/\D/g, '') === ev.data.cpfCnpj) || (r.clientes || [])[0];
      if (!c) { recado('Cliente gravado. Procure-o na busca.', 'ok'); $('busca-cliente').focus(); return; }
      if (tipo !== estado.tipoCliente) { estado.tipoCliente = tipo; tipoAnterior = tipo; marcarSeg('seg-tipo', tipo); mostrarTipo(); }
      estado.cliente = c;
      desenharCliente();
      recado('✓ cliente ' + c.codigo + ' ' + c.nome + ' cadastrado e escolhido', 'ok');
      $('busca-produto').focus();
    } catch (e) { recado(e.message, 'erro'); }
  });

  // ---- conta contabil do cliente (modal) ------------------------------------------------
  let ccAchadas = [], ccSel = 0, ccEspera = null, ccNovoTitulo = null, ccProxima = '';
  const ccMsg = (t, ok) => { $('cc-msg').className = 'fe-msg' + (ok ? ' ok' : ''); $('cc-msg').textContent = t || ''; };

  async function abrirConta() {
    const c = estado.cliente;
    if (!c) return;
    $('cc-titulo').innerHTML = 'Conta contábil do cliente <small>arraste por aqui</small>';
    $('cc-det').textContent = c.codigo + ' · ' + c.nome + ' · ' + (c.tipo === 'PJ' ? 'pessoa jurídica (1.04)' : 'pessoa física (1.03)');
    $('cc-busca').value = c.nome.split(/\s+/)[0] || '';
    $('cc-nome').value = c.nome;
    ccMsg('');
    $('cc-nova').hidden = true; $('cc-criar').hidden = true;
    try {
      const t = await api('GET', '/titulos-cliente?tipo=' + (c.tipo || 'PF'));
      // a conta vai no ULTIMO titulo do grupo; se ele encheu, no titulo novo (criado ao gravar)
      ccNovoTitulo = t.novoTitulo || null;
      ccProxima = t.proximaConta || '';
      $('cc-titulos').value = t.novoTitulo ? 'NOVO' : (t.ultimoTitulo || '');
      $('cc-proxima').textContent = t.proximaConta
        ? t.proximaConta + (t.novoTitulo ? '  (título novo ' + t.novoTitulo.codigo + ' - ' + t.novoTitulo.nome + ')' : '')
        : 'nenhum título no grupo ' + t.grupo;
    } catch (e) { ccMsg(e.message); }
    const cx = $('cc-caixa');
    cx.style.left = '50%'; cx.style.top = '10vh'; cx.style.transform = 'translateX(-50%)';
    $('cc-fundo').hidden = false; cx.hidden = false;
    $('cc-busca').focus(); $('cc-busca').select();
    ccProcurar();
  }
  function fecharConta() { $('cc-fundo').hidden = true; $('cc-caixa').hidden = true; }

  async function ccProcurar() {
    const q = $('cc-busca').value.trim();
    if (q.length < 2) { ccAchadas = []; $('cc-lista').innerHTML = '<div class="vazio">Digite 2 letras ou o código.</div>'; return; }
    try {
      ccAchadas = (await api('GET', '/contas-cliente?tipo=' + (estado.cliente.tipo || 'PF') + '&busca=' + encodeURIComponent(q))).contas;
      ccSel = 0; ccDesenhar();
    } catch (e) { ccMsg(e.message); }
  }
  function ccDesenhar() {
    $('cc-lista').innerHTML = ccAchadas.map((a, k) => '<div class="op' + (k === ccSel ? ' sel' : '') + (a.ativo ? '' : ' susp')
      + '" data-k="' + k + '"><span>' + escapar(a.codigo) + '</span>'
      + '<span>' + escapar(a.nome)
      + ((a.usadoPor || !a.ativo) ? '<span class="uso">' + (a.ativo ? 'já é de ' + escapar(a.usadoPor) : 'suspensa') + '</span>' : '') + '</span>'
      + '<span class="acoes"><button type="button" class="cc-btn" data-acao="ficha"' + (a.ativo ? '' : ' disabled') + '>editar ficha</button>'
      + '<button type="button" class="cc-btn" data-acao="plano">incluir plano</button></span></div>').join('')
      || '<div class="vazio">Nada encontrado no plano.<button type="button" class="cc-btn" data-acao="plano">incluir plano</button></div>';
  }
  function mostrarIncluir() {
    $('cc-nova').hidden = false; $('cc-criar').hidden = false;
    $('cc-nome').focus();
  }

  // ---- ficha do cliente (aberta pelo modal do plano) ------------------------------------
  const CF = { nome: 'cf-nome', ie: 'cf-ie', telefone: 'cf-fone', email: 'cf-email', logradouro: 'cf-logr',
               numero: 'cf-num', complemento: 'cf-compl', bairro: 'cf-bairro', cidade: 'cf-cidade', uf: 'cf-uf',
               cep: 'cf-cep', ncontabil: 'cf-conta' };
  const cfMsg = t => { $('cf-msg').className = 'fe-msg'; $('cf-msg').textContent = t || ''; };

  // a = conta marcada na lista do plano (ou nada: abre com a conta que o cliente ja tem)
  async function abrirFicha(a) {
    if (a && !a.ativo) { ccMsg('A conta ' + a.codigo + ' está suspensa.'); return; }
    try {
      const f = (await api('GET', '/clientes/' + estado.cliente.id + '/ficha')).ficha;
      $('cf-titulo').innerHTML = 'Ficha do cliente ' + escapar(f.codigo) + ' <small>arraste por aqui</small>';
      $('cf-codigo').value = f.codigo + (f.tipo ? ' · ' + f.tipo : '');
      $('cf-doc').value = docFmt(f.documento);
      for (const [k, id] of Object.entries(CF)) $(id).value = f[k] || '';
      if (f.cep) $('cf-cep').value = String(f.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2');
      let nomeConta = f.nomeConta;
      if (a) { $('cf-conta').value = a.codigo; nomeConta = a.nome + (a.usadoPor ? '  ·  atenção: já é de ' + a.usadoPor : ''); }
      $('cf-conta-nome').textContent = nomeConta || '';
      cfMsg('');
      const cx = $('cf-caixa');
      cx.style.left = '50%'; cx.style.top = '8vh'; cx.style.transform = 'translateX(-50%)';
      $('cf-fundo').hidden = false; cx.hidden = false;
      $(a ? 'cf-conta' : 'cf-nome').focus();
    } catch (e) { ccMsg(e.message); }
  }
  function fecharFicha() { $('cf-fundo').hidden = true; $('cf-caixa').hidden = true; }

  async function gravarFicha(forcar) {
    const corpo = {};
    for (const [k, id] of Object.entries(CF)) corpo[k] = $(id).value.trim();
    if (forcar) corpo.forcar = true;
    $('cf-gravar').disabled = true;
    try {
      const r = await api('POST', '/clientes/' + estado.cliente.id + '/ficha', corpo);
      Object.assign(estado.cliente, {
        nome: corpo.nome, ie: corpo.ie, telefone: corpo.telefone, email: corpo.email,
        logradouro: corpo.logradouro, numero: corpo.numero, complemento: corpo.complemento,
        bairro: corpo.bairro, cidade: corpo.cidade, uf: corpo.uf.toUpperCase(),
        cep: corpo.cep.replace(/\D/g, ''), ncontabil: r.ncontabil,
      });
      desenharCliente();
      fecharFicha(); fecharConta();
      recado('✓ ficha do cliente ' + estado.cliente.codigo + ' gravada'
        + (r.ncontabil ? ' — conta ' + r.ncontabil + (r.nomeConta ? ' (' + r.nomeConta + ')' : '') : ''), 'ok');
    } catch (e) {
      if (/já é do cliente/.test(e.message) && !forcar
          && confirm(e.message + '.\nLigar também a este cliente?')) { $('cf-gravar').disabled = false; return gravarFicha(true); }
      cfMsg(e.message);
    } finally { $('cf-gravar').disabled = false; }
  }
  async function ccCriar() {
    const titulo = $('cc-titulos').value, nome = $('cc-nome').value.trim();
    if (!titulo) { ccMsg('Nenhum título de cliente no plano.'); return; }
    if (!nome) { ccMsg('Informe o nome da conta.'); $('cc-nome').focus(); return; }
    const pergunta = titulo === 'NOVO' && ccNovoTitulo
      ? 'O último título encheu (999).\n\nCriar o título ' + ccNovoTitulo.codigo + ' - ' + ccNovoTitulo.nome
        + '\ne nele a conta ' + ccNovoTitulo.codigo + '.001 "' + nome + '", ligada ao cliente?'
      : 'Criar a conta ' + (ccProxima || 'no título ' + titulo) + ' "' + nome + '" e ligar ao cliente?';
    if (!confirm(pergunta)) return;
    $('cc-criar').disabled = true;
    try {
      contaLigada(await api('POST', '/clientes/' + estado.cliente.id + '/conta-nova', { titulo, nome }));
    } catch (e) { ccMsg(e.message); } finally { $('cc-criar').disabled = false; }
  }
  function contaLigada(r) {
    estado.cliente.ncontabil = r.ncontabil;
    desenharCliente();
    fecharConta();
    recado((r.tituloNovo ? '✓ título novo ' + r.tituloNovo + ' · ' : '')
      + '✓ conta ' + r.ncontabil + ' (' + r.nomeConta + ') ligada ao cliente ' + estado.cliente.codigo, 'ok');
  }

  $('cli-vincular').addEventListener('click', abrirConta);
  $('cc-busca').addEventListener('input', () => { clearTimeout(ccEspera); ccEspera = setTimeout(ccProcurar, 250); });
  $('cc-busca').addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' && ccAchadas.length) { ev.preventDefault(); ccSel = Math.min(ccSel + 1, ccAchadas.length - 1); ccDesenhar(); }
    else if (ev.key === 'ArrowUp' && ccAchadas.length) { ev.preventDefault(); ccSel = Math.max(ccSel - 1, 0); ccDesenhar(); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (ccAchadas[ccSel]) abrirFicha(ccAchadas[ccSel]); }
  });
  $('cc-lista').addEventListener('click', ev => {
    const bt = ev.target.closest('button[data-acao]');
    const op = ev.target.closest('.op[data-k]');
    if (bt) {
      if (bt.dataset.acao === 'plano') mostrarIncluir();
      else if (op) abrirFicha(ccAchadas[Number(op.dataset.k)]);
      return;
    }
    if (!op) return;
    ccSel = Number(op.dataset.k); ccDesenhar();
  });
  $('cc-lista').addEventListener('dblclick', ev => {
    if (ev.target.closest('button')) return;
    const op = ev.target.closest('.op[data-k]'); if (op) abrirFicha(ccAchadas[Number(op.dataset.k)]);
  });
  $('cf-gravar').addEventListener('click', () => gravarFicha(false));
  $('cf-cancelar').addEventListener('click', fecharFicha);
  $('cf-fundo').addEventListener('click', fecharFicha);
  // Enter anda de campo em campo; no ultimo, vai para "Gravar ficha"
  (function () {
    const ordem = Object.values(CF);
    ordem.forEach((id, i) => $(id).addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (i < ordem.length - 1) $(ordem[i + 1]).focus(); else $('cf-gravar').focus();
    }));
  })();
  $('cc-criar').addEventListener('click', ccCriar);
  $('cc-cancelar').addEventListener('click', fecharConta);
  $('cc-fundo').addEventListener('click', fecharConta);

  // produto
  ligarBusca('busca-produto', 'lista-produtos',
    () => '/produtos?fornecedor=' + encodeURIComponent($('filtro-fornec').value) + '&busca=',
    // colunas: codigo | descricao (+ tecnica, garantia; marca so sem fornecedor no combo) | ref | estoque | preco
    p => '<strong>' + p.codigo + '</strong>'
      + '<span><span class="' + (p.garantia ? 'garantia' : '') + '">' + escapar(p.descricao) + '</span>'
        + (p.garantia ? '<span class="tag-inst" title="produto com garantia: pode ser instalado">🔧 garantia</span>' : '')
        + (!$('filtro-fornec').value && p.marca ? ' <span class="s">· ' + escapar(p.marca) + '</span>' : '')
        + (p.descricaoTecnica ? '<span class="s tec-l">' + escapar(p.descricaoTecnica) + '</span>' : '') + '</span>'
      + '<span class="s">' + escapar(p.referencia) + '</span>'
      + '<span class="n' + (p.estoque <= 0 ? ' zero' : '') + '">' + p.estoque + '</span>'
      + '<span class="n">' + brl(estado.condicao === 'PRAZO' ? (p.precoPrazo || p.precoVista) : p.precoVista) + '</span>',
    p => adicionar(p), false, () => !!$('filtro-fornec').value);

  // combo de fornecedor: escolheu, a lista abre com os produtos dele
  $('filtro-fornec').addEventListener('change', () => {
    const b = $('busca-produto');
    b.focus();
    b.dispatchEvent(new Event('input'));
  });
  (async function () {
    try {
      const f = (await api('GET', '/fornecedores')).fornecedores;
      $('filtro-fornec').innerHTML = '<option value="">todos os fornecedores</option>'
        + f.map(m => '<option value="' + escapar(m.nr) + '">' + escapar(m.marca) + '</option>').join('');
    } catch (e) { recado('Fornecedores do combo: ' + e.message, 'erro'); }   // a busca segue em todos
  })();

  function adicionar(p) {
    const ja = estado.itens.find(i => i.codigo === p.codigo);
    if (ja) ja.quantidade += 1;
    else estado.itens.push({ ...p, quantidade: 1, desconto: 0, precoManual: null,
                             precisaInstalacao: estado.documento === 'NFE' && !!p.garantia });
    desenharItens();
    // foco na quantidade do item
    const campo = document.querySelector('input.qtd[data-cod="' + p.codigo + '"]');
    if (campo) { campo.focus(); campo.select(); }
  }

  // ---- itens e totais -------------------------------------------------------------------
  function desenharItens() {
    const tb = $('itens');
    if (!estado.itens.length) {
      tb.innerHTML = '<tr><td colspan="10" class="vazio">Nenhum produto. Busque acima.</td></tr>';
    } else {
      tb.innerHTML = estado.itens.map(i => {
        const total = i.quantidade * preco(i) - i.desconto;
        return '<tr>'
          + '<td>' + i.codigo + '</td>'
          + '<td class="desc-item' + (i.garantia ? ' garantia' : '') + '" data-cod="' + i.codigo + '"'
            + (estado.documento === 'NFE' ? ' title="' + (i.garantia ? 'clique para TIRAR a garantia deste produto' : 'clique se o produto tem garantia (pode ser instalado)') + '"' : '') + '>'
            + escapar(i.descricao) + (i.descricaoTecnica ? '<div class="tec">' + escapar(i.descricaoTecnica) + '</div>' : '') + '</td>'
          + '<td>' + escapar(i.referencia) + '</td>'
          + '<td class="num' + (i.estoque < i.quantidade ? ' zero' : '') + '">' + i.estoque + '</td>'
          + '<td class="num"><input class="qtd" data-cod="' + i.codigo + '" value="' + i.quantidade + '" inputmode="numeric"></td>'
          + '<td class="num"><input class="unit' + (i.precoManual > 0 && i.precoManual !== precoTabela(i) ? ' negociado' : '')
            + '" data-cod="' + i.codigo + '" value="' + brl(preco(i)) + '" inputmode="decimal" title="preço negociado (apague para voltar à tabela)">'
            + (i.precoManual > 0 && i.precoManual !== precoTabela(i) ? '<span class="tabela">tabela ' + brl(precoTabela(i)) + '</span>' : '') + '</td>'
          + '<td class="num"><input class="desc" data-cod="' + i.codigo + '" value="' + (i.desconto ? brl(i.desconto) : '') + '" placeholder="0,00" inputmode="decimal"></td>'
          + '<td class="num tot-linha">' + brl(total) + '</td>'
          + '<td class="c-inst">' + (estado.documento === 'NFE' && i.garantia
              ? '<input type="checkbox" class="inst" data-cod="' + i.codigo + '"' + (i.precisaInstalacao ? ' checked' : '')
                + ' title="vai ser instalado">' : '') + '</td>'
          + '<td class="c-rem"><button type="button" class="btn-x" data-tirar="' + i.codigo + '" title="remover">×</button></td>'
          + '</tr>';
      }).join('');
    }
    totais();
    atualizarInst();
  }

  function totais() {
    let bruto = 0, desc = 0;
    for (const i of estado.itens) { bruto += i.quantidade * preco(i); desc += i.desconto; }
    const geral = paraCentavos($('desc-geral').value);
    $('t-bruto').textContent = brl(bruto);
    $('t-desc-itens').textContent = brl(desc);
    $('t-liquido').textContent = brl(Math.max(0, bruto - desc - geral));
  }

  $('itens').addEventListener('input', ev => {
    const el = ev.target;
    const i = estado.itens.find(x => String(x.codigo) === el.dataset.cod);
    if (!i) return;
    if (el.classList.contains('qtd')) {
      el.value = el.value.replace(/\D/g, '');            // so inteiro
      i.quantidade = Math.max(1, parseInt(el.value, 10) || 1);
    } else if (el.classList.contains('desc')) {
      el.value = el.value.replace(/[^\d.,]/g, '');
      i.desconto = Math.min(i.quantidade * preco(i), paraCentavos(el.value));
    } else if (el.classList.contains('unit')) {
      el.value = el.value.replace(/[^\d.,]/g, '');
      const v = paraCentavos(el.value);
      i.precoManual = v > 0 && v !== precoTabela(i) ? v : null;      // vazio ou igual: tabela
      i.desconto = Math.min(i.desconto, i.quantidade * preco(i));
    }
    const tot = el.closest('tr')?.querySelector('td.tot-linha');      // total da linha na hora
    if (tot) tot.textContent = brl(i.quantidade * preco(i) - i.desconto);
    totais();
  });
  // ao sair do campo, redesenha (total da linha e formato do desconto)
  $('itens').addEventListener('focusout', ev => { if (ev.target.matches('input.qtd, input.desc, input.unit')) desenharItens(); });
  // Enter: quantidade -> unitario -> desconto -> proximo produto
  $('itens').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.matches('input.qtd, input.unit, input.desc')) {
      ev.preventDefault();
      const tr = ev.target.closest('tr');
      if (ev.target.classList.contains('qtd')) { const u = tr.querySelector('input.unit'); u.focus(); u.select(); }
      else if (ev.target.classList.contains('unit')) { const d = tr.querySelector('input.desc'); d.focus(); d.select(); }
      else $('busca-produto').focus();                   // proximo produto
    }
  });
  // clicar na descricao (so nota fiscal):
  //   sem garantia -> "É garantia?"      OK grava garantia = 1 (violeta, vai para instalar)
  //   com garantia -> "Tirar garantia?"  OK grava garantia = 0 (sai da instalacao)
  $('itens').addEventListener('click', async ev => {
    const td = ev.target.closest('td.desc-item');
    if (!td || estado.documento !== 'NFE') return;
    const i = estado.itens.find(x => String(x.codigo) === td.dataset.cod);
    if (!i) return;
    const marcar = !i.garantia;
    const pergunta = marcar
      ? 'É garantia?\n\n' + i.codigo + ' · ' + i.descricao
        + '\n\nProduto com garantia, serviço e manutenção: passa a aparecer em violeta e pode ser instalado.'
      : 'Tirar garantia?\n\n' + i.codigo + ' · ' + i.descricao
        + '\n\nO produto deixa de ser violeta e sai da instalação desta venda.';
    if (!confirm(pergunta)) return;
    try {
      await api('POST', '/produtos/' + i.codigo + '/garantia', { garantia: marcar ? 1 : 0 });
      estado.itens.filter(x => x.codigo === i.codigo).forEach(x => { x.garantia = marcar; x.precisaInstalacao = marcar; });
      if (estado.instalacao) estado.instalacao.confirmada = false;    // mudou a lista: conferir de novo
      desenharItens();
      recado('✓ ' + i.codigo + (marcar ? ' marcado como garantia.' : ' sem garantia.'), 'ok');
    } catch (e) { recado(e.message, 'erro'); }
  });
  $('itens').addEventListener('click', ev => {
    const b = ev.target.closest('[data-tirar]');
    if (!b) return;
    estado.itens = estado.itens.filter(i => String(i.codigo) !== b.dataset.tirar);
    desenharItens();
  });
  $('desc-geral').addEventListener('input', ev => { ev.target.value = ev.target.value.replace(/[^\d.,]/g, ''); totais(); });
  $('desc-geral').addEventListener('focusout', ev => { const c = paraCentavos(ev.target.value); ev.target.value = c ? brl(c) : ''; });

  // ---- gravar ------------------------------------------------------------------------
  // grava o que esta na tela (cria ou altera a venda aberta); devolve a venda
  async function salvar() {
    if (!estado.itens.length) { recado('A venda não tem produtos.', 'erro'); return null; }
    if (estado.documento === 'NFE' && !estado.cliente) { recado('Nota fiscal precisa de cliente.', 'erro'); $('busca-cliente').focus(); return null; }

    const corpo = {
      documento: estado.documento, condicao: estado.condicao,
      clienteId: estado.documento === 'NFE' && estado.cliente ? estado.cliente.id : null,
      ocCliente: $('oc-cliente').value.trim(),
      descontoGeral: paraCentavos($('desc-geral').value),
      observacao: $('observacao').value.trim(),
      itens: estado.itens.map(i => ({ codigo: i.codigo, quantidade: i.quantidade, desconto: i.desconto,
                                      preco: i.precoManual > 0 ? i.precoManual : undefined,
                                      precisaInstalacao: estado.documento === 'NFE' && !!i.precisaInstalacao })),
      instalacao: estado.instalacao,
    };
    const r = estado.id ? await api('PUT', '/' + estado.id, corpo) : await api('POST', '/', corpo);
    const v = r.venda;
    if (!estado.id) history.replaceState(null, '', '/vendas/venda/' + v._id);
    estado.id = v._id;
    mostrarCabecalho(v);
    return v;
  }

  async function gravar() {
    $('gravar').disabled = true;
    try {
      const v = await salvar();
      if (!v) return;
      recado('✓ venda nº ' + v.numero + ' gravada (aberta) — líquido ' + brl(v.totalLiquido), 'ok');
      abrirSucesso(v);
    } catch (e) {
      recado(e.message, 'erro');
    } finally {
      $('gravar').disabled = false;
    }
  }
  $('gravar').addEventListener('click', gravar);

  // ---- fechamento (Parte 2) -------------------------------------------------------------
  // 07/10/2026: a venda pode ser paga em MAIS DE UMA FORMA. O editor monta uma parte por vez
  // (forma, banco/cartao, parcelas, valor) e Enter inclui na lista; "Falta receber" mostra o
  // que sobra. Dinheiro acima do que falta vira troco. Confirmar so com falta = 0.
  const NOMES = { DINHEIRO: 'Dinheiro', PIX: 'PIX / transferência', DEBITO: 'Cartão de débito',
                  CREDITO: 'Cartão de crédito', TITULO: 'Título em banco' };
  let formas = null;            // caixa, bancos e cartoes (GET /formas)
  let aFechar = null;           // a venda salva que vai ser fechada
  let formaEscolhida = '';
  let pagos = [];               // as partes ja incluidas

  function somenteConsulta(sit) {
    $('gravar').disabled = true; $('fechar').disabled = true;
    recado('Venda ' + sit + ': só consulta.', 'ok');
  }
  const falta = () => (aFechar ? aFechar.totalLiquido : 0) - pagos.reduce((t, p) => t + p.valor, 0);

  async function abrirFechamento() {
    if (faltaInstalacao()) {
      recado('Há produto marcado para instalar: preencha a instalação antes de fechar.', 'erro');
      abrirInstalacao();
      return;
    }
    $('fechar').disabled = true;
    try {
      const v = await salvar();
      if (!v) return;
      if (!formas) formas = await api('GET', '/formas');
      aFechar = v;
      pagos = [];
      $('fe-titulo').innerHTML = 'Fechar venda nº ' + v.numero + ' <small>arraste por aqui</small>';
      $('fe-det').textContent = (v.documento === 'NFE' ? 'Nota fiscal' : 'Cupom (balcão)')
        + (v.cliente && v.cliente.nome ? ' · ' + v.cliente.nome : '')
        + ' · ' + (v.condicao === 'PRAZO' ? 'a prazo' : 'à vista') + ' · ' + v.itens.length + ' item(ns)';
      $('fe-liq').textContent = 'R$ ' + brl(v.totalLiquido);

      const lista = v.condicao === 'PRAZO' ? ['CREDITO', 'TITULO'] : ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'];
      const podeTitulo = v.documento === 'NFE' && v.cliente && v.cliente.tipo === 'PJ';
      $('fe-aviso').hidden = !(v.condicao === 'PRAZO' && !podeTitulo);
      $('fe-formas').innerHTML = lista.map(f => {
        const off = f === 'TITULO' && !podeTitulo;
        return '<label data-f="' + f + '"' + (off ? ' class="off" title="só pessoa jurídica com nota fiscal"' : '') + '>'
          + '<input type="radio" name="fe-forma" value="' + f + '"' + (off ? ' disabled' : '') + '> ' + NOMES[f] + '</label>';
      }).join('');
      $('fe-banco').innerHTML = formas.bancos.map(b => '<option value="' + escapar(b.id) + '">' + escapar(b.apelido) + ' · ' + escapar(b.codigo) + '</option>').join('')
        || '<option value="">nenhum banco marcado para receber</option>';
      $('fe-cartao').innerHTML = formas.cartoes.map(c => '<option value="' + escapar(c.codigo) + '">' + escapar(c.nome) + ' · ' + escapar(c.codigo) + '</option>').join('')
        || '<option value="">nenhum cartão no plano (1.01.005)</option>';
      $('fe-parcelas').innerHTML = Array.from({ length: 10 }, (_, i) => '<option value="' + (i + 1) + '">' + (i + 1) + 'x</option>').join('');
      $('fe-msg').textContent = ''; $('fe-msg').className = 'fe-msg';
      desenharPagos();
      escolherForma(lista[0]);
      const cx = $('fe-caixa');
      cx.style.left = '50%'; cx.style.top = '3vh'; cx.style.transform = 'translateX(-50%)';   // 3vh em cima, 3vh embaixo (max 94vh)
      $('fe-fundo').hidden = false; cx.hidden = false;
      $('fe-recebido').focus(); $('fe-recebido').select();
    } catch (e) {
      recado(e.message, 'erro');
    } finally {
      if (!aFechar || aFechar.situacao === 'A') $('fechar').disabled = false;
    }
  }

  function escolherForma(f) {
    formaEscolhida = f;
    $('fe-formas').querySelectorAll('label').forEach(l => {
      const sel = l.dataset.f === f;
      l.classList.toggle('ativo', sel);
      l.querySelector('input').checked = sel;
    });
    $('fe-l-banco').hidden = f !== 'PIX';
    $('fe-l-cartao').hidden = !(f === 'DEBITO' || f === 'CREDITO');
    $('fe-l-parc').hidden = !(f === 'CREDITO' || f === 'TITULO');
    if (!(f === 'CREDITO' || f === 'TITULO')) $('fe-parcelas').value = '1';
    $('fe-rot-valor').textContent = f === 'DINHEIRO' ? 'Valor recebido' : 'Valor';
    $('fe-recebido').value = brl(Math.max(0, falta()));
    $('fe-msg').textContent = ''; $('fe-msg').className = 'fe-msg';
    previa();
  }

  // as parcelas da parte em edicao, como o servidor vai gravar
  function previa() {
    const f = formaEscolhida;
    const valor = Math.min(paraCentavos($('fe-recebido').value) || 0, Math.max(0, falta()));
    if (f === 'DINHEIRO') { $('fe-previa').textContent = 'entra no caixa'; return; }
    if (f === 'PIX') { $('fe-previa').textContent = 'entra no banco escolhido'; return; }
    const n = f === 'DEBITO' ? 1 : Number($('fe-parcelas').value) || 1;
    const base = Math.floor(valor / n);
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    let html = '<div>A receber no fluxo (pos 5)' + (f === 'TITULO' ? ', na conta do cliente' : ', na conta do cartão') + ':</div><table>';
    for (let i = 0; i < n; i++) {
      const venc = new Date(hoje.getTime() + (f === 'DEBITO' ? 1 : (i + 1) * 30) * 86400000);
      html += '<tr><td>' + (i + 1) + '/' + n + '</td><td>' + venc.toLocaleDateString('pt-BR') + '</td><td>R$ '
        + brl(base + (i === 0 ? valor - base * n : 0)) + '</td></tr>';
    }
    $('fe-previa').innerHTML = html + '</table>' + (f === 'TITULO' ? '<div>Cobrança no <b>Banestes/Armação</b>.</div>' : '');
  }

  // inclui a parte em edicao na lista
  function adicionarPagamento() {
    const f = formaEscolhida, resta = falta();
    const msg = $('fe-msg');
    const digitado = paraCentavos($('fe-recebido').value);
    msg.className = 'fe-msg';
    if (resta <= 0) { msg.textContent = 'Já está tudo pago.'; return false; }
    if (!digitado) { msg.textContent = 'Digite o valor.'; $('fe-recebido').focus(); return false; }
    if (digitado > resta && f !== 'DINHEIRO') {
      msg.textContent = 'O valor passa do que falta (R$ ' + brl(resta) + '). Só no dinheiro sobra troco.'; return false;
    }
    const p = { forma: f, valor: Math.min(digitado, resta) };
    if (f === 'DINHEIRO' && digitado > resta) { p.recebido = digitado; p.troco = digitado - resta; }
    if (f === 'PIX') {
      if (!$('fe-banco').value) { msg.textContent = 'Escolha o banco.'; return false; }
      p.contaBancaria = $('fe-banco').value; p.destino = $('fe-banco').selectedOptions[0].textContent;
    }
    if (f === 'DEBITO' || f === 'CREDITO') {
      if (!$('fe-cartao').value) { msg.textContent = 'Escolha o cartão.'; return false; }
      p.cartao = $('fe-cartao').value; p.destino = $('fe-cartao').selectedOptions[0].textContent;
    }
    if (f === 'CREDITO' || f === 'TITULO') p.parcelas = Number($('fe-parcelas').value) || 1;
    pagos.push(p);
    desenharPagos();
    $('fe-recebido').value = brl(Math.max(0, falta()));
    previa();
    if (falta() === 0) {
      if (p.troco) { msg.className = 'fe-msg ok'; msg.textContent = 'Troco: R$ ' + brl(p.troco); }
      $('fe-confirmar').focus();
    } else { $('fe-recebido').focus(); $('fe-recebido').select(); }
    return true;
  }

  function desenharPagos() {
    $('fe-pagos').innerHTML = pagos.map((p, k) => '<div class="pg"><span>' + NOMES[p.forma]
      + (p.parcelas > 1 ? ' · ' + p.parcelas + 'x' : '')
      + '<small>' + escapar(p.destino || (p.forma === 'DINHEIRO' ? 'caixa' : p.forma === 'TITULO' ? 'cobrança Banestes/Armação' : ''))
      + (p.troco ? ' · recebido ' + brl(p.recebido) + ', troco ' + brl(p.troco) : '') + '</small></span>'
      + '<b>R$ ' + brl(p.valor) + '</b><button type="button" data-k="' + k + '" title="tirar">×</button></div>').join('');
    const f = falta();
    $('fe-falta').classList.toggle('zero', f === 0);
    $('fe-falta').firstElementChild.textContent = f === 0 ? 'Tudo pago' : 'Falta receber';
    $('fe-falta-v').textContent = 'R$ ' + brl(Math.max(0, f));
    $('fe-editor').hidden = f === 0;
    $('fe-confirmar').disabled = f !== 0;
  }

  function fecharModalFechamento() { $('fe-fundo').hidden = true; $('fe-caixa').hidden = true; }

  async function confirmarFechamento() {
    if (falta() !== 0) { $('fe-recebido').focus(); return; }
    const corpo = { pagamentos: pagos.map(p => ({ forma: p.forma, valor: p.valor, contaBancaria: p.contaBancaria,
                                                   cartao: p.cartao, parcelas: p.parcelas })) };
    $('fe-confirmar').disabled = true;
    $('fe-msg').className = 'fe-msg'; $('fe-msg').textContent = '';
    try {
      const v = (await api('POST', '/' + aFechar._id + '/fechar', corpo)).venda;
      aFechar = v;
      fecharModalFechamento();
      mostrarCabecalho(v);
      somenteConsulta('fechada');
      const resumo = pagos.map(p => NOMES[p.forma].toLowerCase() + ' ' + brl(p.valor)).join(' + ');
      recado('✓ venda nº ' + v.numero + ' fechada — ' + resumo + (v.os && v.os.numero ? ' — OS nº ' + v.os.numero : ''), 'ok');
      abrirSucesso(v);
    } catch (e) {
      $('fe-msg').textContent = e.message;
    } finally {
      $('fe-confirmar').disabled = falta() !== 0;
    }
  }

  $('fechar').addEventListener('click', abrirFechamento);
  $('fe-formas').addEventListener('change', ev => { if (ev.target.name === 'fe-forma') escolherForma(ev.target.value); });
  $('fe-parcelas').addEventListener('change', previa);
  $('fe-recebido').addEventListener('input', previa);
  $('fe-recebido').addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); adicionarPagamento(); }
  });
  $('fe-add').addEventListener('click', adicionarPagamento);
  $('fe-pagos').addEventListener('click', ev => {
    const bt = ev.target.closest('button[data-k]'); if (!bt) return;
    pagos.splice(Number(bt.dataset.k), 1);
    desenharPagos();
    $('fe-recebido').value = brl(Math.max(0, falta())); previa();
    $('fe-msg').textContent = '';
    $('fe-recebido').focus();
  });
  $('fe-confirmar').addEventListener('click', confirmarFechamento);
  $('fe-cancelar').addEventListener('click', fecharModalFechamento);
  $('fe-fundo').addEventListener('click', fecharModalFechamento);

  function mostrarCabecalho(v) {
    $('titulo').textContent = 'Venda nº ' + v.numero;
    $('situacao').textContent = { A: 'aberta', F: 'fechada', C: 'cancelada' }[v.situacao] || '';
    document.title = 'Venda ' + v.numero;
  }

  // ---- modal de sucesso ---------------------------------------------------------------
  let gravada = null;     // a venda que acabou de gravar (para imprimir)

  function abrirSucesso(v) {
    gravada = v;
    const doc = v.documento === 'NFE' ? 'Nota fiscal' : 'Cupom (balcão)';
    const cli = v.cliente && v.cliente.nome ? ' · ' + v.cliente.nome : '';
    $('ok-titulo').innerHTML = '✓ Venda nº ' + v.numero + (v.situacao === 'F' ? ' fechada' : ' gravada') + ' <small>arraste por aqui</small>';
    $('ok-continuar').hidden = v.situacao !== 'A';
    document.querySelector('#ok-caixa .ok-obs').textContent = v.situacao === 'F'
      ? 'Estoque baixado, lançamento contábil feito' + ((v.pagamentos && v.pagamentos[0] && v.pagamentos[0].parcelas.length) ? ' e parcelas no fluxo.' : '.')
      : 'Venda aberta. Pagamento, baixa de estoque e nota fiscal vêm no fechamento.';
    const cx = $('ok-caixa');                       // volta ao lugar de partida
    cx.style.left = '50%'; cx.style.top = '22vh'; cx.style.transform = 'translateX(-50%)';
    $('ok-det').textContent = doc + cli + ' · ' + (v.condicao === 'PRAZO' ? 'a prazo' : 'à vista')
      + ' · ' + (v.itens || []).length + ' item(ns)';
    $('ok-liq').textContent = 'R$ ' + brl(v.totalLiquido);
    $('ok-fundo').hidden = false;
    $('ok-caixa').hidden = false;
    $('ok-nova').focus();
  }
  function fecharSucesso() { $('ok-fundo').hidden = true; $('ok-caixa').hidden = true; }

  $('ok-nova').addEventListener('click', () => { window.location.href = '/vendas/venda'; });
  $('ok-continuar').addEventListener('click', fecharSucesso);
  $('ok-menu').addEventListener('click', () => { window.location.href = '/usuariocontab/menu'; });
  $('ok-imprimir').addEventListener('click', () => { if (gravada) imprimir(gravada); });
  $('ok-fundo').addEventListener('click', fecharSucesso);

  // arrasta o modal pelo titulo, para qualquer lado (sucesso e fechamento)
  ['ok', 'fe', 'cc', 'cf', 'ins'].forEach(pre => {
    let ini = null;
    const cx = $(pre + '-caixa');
    $(pre + '-titulo').addEventListener('mousedown', ev => {
      const r = cx.getBoundingClientRect();
      cx.style.transform = 'none';
      cx.style.left = r.left + 'px'; cx.style.top = r.top + 'px';
      ini = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      ev.preventDefault();
    });
    document.addEventListener('mousemove', ev => {
      if (!ini) return;
      const maxX = window.innerWidth - 80, maxY = window.innerHeight - 40;
      cx.style.left = Math.min(maxX, Math.max(-cx.offsetWidth + 80, ev.clientX - ini.x)) + 'px';
      cx.style.top = Math.min(maxY, Math.max(0, ev.clientY - ini.y)) + 'px';
    });
    document.addEventListener('mouseup', () => { ini = null; });
  });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (!$('ins-caixa').hidden) fecharInstalacao();
    else if (!$('cf-caixa').hidden) fecharFicha();
    else if (!$('cc-caixa').hidden) fecharConta();
    else if (!$('fe-caixa').hidden) fecharModalFechamento();
    else if (!$('ok-caixa').hidden) fecharSucesso();
  });

  // espelho da venda para imprimir (NAO e documento fiscal)
  function imprimir(v) {
    const l = estado.loja || {};
    const c = v.cliente || {};
    const e = c.endereco || {};
    const data = v.data ? new Date(v.data).toLocaleString('pt-BR') : '';
    const descItens = (v.itens || []).reduce((s, i) => s + (i.desconto || 0), 0);
    const bruto = (v.itens || []).reduce((s, i) => s + i.quantidade * i.precoUnitario, 0);
    const linhas = (v.itens || []).map(i => '<tr><td>' + i.codigo + '</td><td>' + escapar(i.descricao)
      + (i.referencia ? ' <small>(' + escapar(i.referencia) + ')</small>' : '') + '</td>'
      + '<td class="n">' + i.quantidade + '</td><td class="n">' + brl(i.precoUnitario) + '</td>'
      + '<td class="n">' + (i.desconto ? brl(i.desconto) : '') + '</td>'
      + '<td class="n">' + brl(i.quantidade * i.precoUnitario - (i.desconto || 0)) + '</td></tr>').join('');
    const html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Venda ' + v.numero + '</title>'
      + '<style>body{font-family:system-ui,Segoe UI,Roboto,sans-serif;font-size:12px;color:#111;margin:18px}'
      + 'h1{font-size:16px;margin:0}h2{font-size:13px;margin:14px 0 4px}.s{color:#444}'
      + 'table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left}'
      + 'th{font-size:10px;text-transform:uppercase}.n{text-align:right;white-space:nowrap}'
      + '.tot{margin-top:8px;text-align:right}.tot b{font-size:15px}.aviso{margin-top:16px;font-size:10px;color:#666}'
      + '@media print{body{margin:0}}</style></head><body>'
      + '<h1>' + escapar(l.fantasia || l.razao || 'Loja') + '</h1>'
      + '<div class="s">' + escapar([l.razao, l.cnpj && 'CNPJ ' + docFmt(l.cnpj),
          [l.logradouro, l.numero].filter(Boolean).join(', '), l.bairro,
          l.cidade && l.cidade + (l.uf ? '/' + l.uf : ''), l.telefone && 'fone ' + l.telefone]
          .filter(Boolean).join(' · ')) + '</div>'
      + '<h2>Venda nº ' + v.numero + ' · ' + (v.documento === 'NFE' ? 'Nota fiscal' : 'Cupom (balcão)')
      + ' · ' + (v.condicao === 'PRAZO' ? 'a prazo' : 'à vista') + ' · ' + data + '</h2>'
      + (c.nome ? '<div><b>' + escapar(c.nome) + '</b> ' + escapar(c.codigo || '') + ' · ' + escapar(docFmt(c.documento))
          + '<br>' + escapar([[e.logradouro, e.numero, e.complemento].filter(Boolean).join(', '), e.bairro,
            e.cidade && e.cidade + (e.uf ? '/' + e.uf : '')].filter(Boolean).join(' · ')) + '</div>' : '')
      + (v.ocCliente ? '<div>OC do cliente: ' + escapar(v.ocCliente) + '</div>' : '')
      + '<table><thead><tr><th>Código</th><th>Descrição</th><th class="n">Qtd</th><th class="n">Unitário</th>'
      + '<th class="n">Desconto</th><th class="n">Total</th></tr></thead><tbody>' + linhas + '</tbody></table>'
      + '<div class="tot">Bruto ' + brl(bruto) + ' · Desc. itens ' + brl(descItens)
      + ' · Desc. geral ' + brl(v.descontoGeral || 0) + '<br><b>Líquido R$ ' + brl(v.totalLiquido) + '</b></div>'
      + (v.observacao ? '<div style="margin-top:8px">Obs.: ' + escapar(v.observacao) + '</div>' : '')
      + '<div class="aviso">Espelho da venda — documento sem valor fiscal.</div>'
      + '<script>window.onload=function(){window.print();}<\/script></body></html>';
    const w = window.open('', '_blank');
    if (!w) { recado('O navegador bloqueou a janela de impressão. Libere pop-ups para localhost.', 'erro'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  // ---- abrir uma venda gravada ---------------------------------------------------------
  async function carregar() {
    if (!estado.id) { $('busca-produto').focus(); return; }
    try {
      const v = (await api('GET', '/' + estado.id)).venda;
      estado.documento = v.documento; estado.condicao = v.condicao;
      estado.instalacao = v.instalacao && v.instalacao.confirmada ? v.instalacao : null;
      marcarSeg('seg-doc', v.documento); $('sel-cond').value = v.condicao;
      if (v.cliente && (v.cliente.tipo === 'PF' || v.cliente.tipo === 'PJ')) {
        estado.tipoCliente = v.cliente.tipo; tipoAnterior = v.cliente.tipo; marcarSeg('seg-tipo', v.cliente.tipo); mostrarTipo();
      }
      const e = (v.cliente && v.cliente.endereco) || {};
      estado.cliente = v.cliente && v.cliente.id ? {
        id: v.cliente.id, codigo: v.cliente.codigo, tipo: v.cliente.tipo, nome: v.cliente.nome,
        documento: v.cliente.documento, ie: v.cliente.ie, ncontabil: v.cliente.ncontabil, telefone: '',
        logradouro: e.logradouro || '', numero: e.numero || '', complemento: e.complemento || '',
        bairro: e.bairro || '', cidade: e.cidade || '', uf: e.uf || '', cep: e.cep || '',
      } : null;
      $('oc-cliente').value = v.ocCliente || '';
      $('observacao').value = v.observacao || '';
      $('desc-geral').value = v.descontoGeral ? brl(v.descontoGeral) : '';
      // preco a vista e a prazo atuais de cada item (a troca de condicao recalcula)
      estado.itens = [];
      for (const i of v.itens) {
        let p = null;
        try { p = (await api('GET', '/produtos?busca=' + i.codigo)).produtos.find(x => x.codigo === i.codigo); } catch (e) { /* segue */ }
        estado.itens.push({
          codigo: i.codigo, descricao: i.descricao, descricaoTecnica: i.descricaoTecnica, referencia: i.referencia,
          estoque: p ? p.estoque : 0,
          precoVista: p ? p.precoVista : i.precoUnitario, precoPrazo: p ? p.precoPrazo : i.precoUnitario,
          quantidade: i.quantidade, desconto: i.desconto,
          precisaInstalacao: !!i.precisaInstalacao, garantia: p ? !!p.garantia : false,
          // negociado: o unitario gravado diferente do de tabela gravado
          precoManual: i.precoTabela && i.precoUnitario !== i.precoTabela ? i.precoUnitario : null,
        });
      }
      desenharCliente();
      desenharItens();
      mostrarCabecalho(v);
      if (v.situacao !== 'A') somenteConsulta($('situacao').textContent);
    } catch (e) {
      recado(e.message, 'erro');
    }
  }

  // cabecalho da loja (cupom)
  (async function () {
    try {
      const l = (await api('GET', '/loja')).loja;
      estado.loja = l;
      $('loja-nome').textContent = l.fantasia ? l.fantasia + (l.razao ? ' · ' + l.razao : '') : (l.razao || 'Loja');
      $('loja-det').textContent = [
        l.cnpj && 'CNPJ ' + docFmt(l.cnpj), l.ie && 'IE ' + l.ie,
        [l.logradouro, l.numero, l.complemento].filter(Boolean).join(', '),
        l.bairro, l.cidade && (l.cidade + (l.uf ? '/' + l.uf : '')), l.telefone && 'fone ' + l.telefone,
      ].filter(Boolean).join(' · ');
    } catch (e) { $('loja-nome').textContent = 'Loja'; }
  })();

  desenharItens();
  desenharCliente();
  carregar();
})();
