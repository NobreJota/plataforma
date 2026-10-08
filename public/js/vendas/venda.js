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
    const j = await r.json();
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

  const preco = i => estado.condicao === 'PRAZO' ? (i.precoPrazo || i.precoVista) : i.precoVista;

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
  ligarSeg('seg-doc', 'documento', () => { mostrarCliente(); });

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
    desenharItens();
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
      let html = achados.map((a, k) => '<div class="op' + (k === sel ? ' sel' : '') + '" data-k="' + k + '">' + montar(a) + '</div>').join('')
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

  // ---- conta contabil do cliente (modal) ------------------------------------------------
  let ccAchadas = [], ccSel = 0, ccEspera = null;
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
      $('cc-titulos').innerHTML = t.titulos.map(x => '<option value="' + escapar(x.codigo) + '">' + escapar(x.codigo) + ' - ' + escapar(x.nome) + '</option>').join('')
        || '<option value="">nenhum título no grupo ' + escapar(t.grupo) + '</option>';
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
    $('cc-titulos').focus();
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
    if (!titulo) { ccMsg('Escolha o título.'); return; }
    if (!nome) { ccMsg('Informe o nome da conta.'); $('cc-nome').focus(); return; }
    if (!confirm('Criar no título ' + titulo + ' a conta "' + nome + '" e ligar ao cliente?')) return;
    $('cc-criar').disabled = true;
    try {
      contaLigada(await api('POST', '/clientes/' + estado.cliente.id + '/conta-nova', { titulo, nome }));
    } catch (e) { ccMsg(e.message); } finally { $('cc-criar').disabled = false; }
  }
  function contaLigada(r) {
    estado.cliente.ncontabil = r.ncontabil;
    desenharCliente();
    fecharConta();
    recado('✓ conta ' + r.ncontabil + ' (' + r.nomeConta + ') ligada ao cliente ' + estado.cliente.codigo, 'ok');
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
    p => '<strong>' + p.codigo + '</strong> ' + escapar(p.descricao)
      + ' <span class="s">' + escapar(p.marca) + ' · ' + escapar(p.referencia) + ' · estoque <span class="' + (p.estoque <= 0 ? 'zero' : '') + '">' + p.estoque + '</span>'
      + ' · ' + brl(estado.condicao === 'PRAZO' ? (p.precoPrazo || p.precoVista) : p.precoVista) + '</span>'
      + (p.descricaoTecnica ? '<div class="s">' + escapar(p.descricaoTecnica) + '</div>' : ''),
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
    else estado.itens.push({ ...p, quantidade: 1, desconto: 0 });
    desenharItens();
    // foco na quantidade do item
    const campo = document.querySelector('input.qtd[data-cod="' + p.codigo + '"]');
    if (campo) { campo.focus(); campo.select(); }
  }

  // ---- itens e totais -------------------------------------------------------------------
  function desenharItens() {
    const tb = $('itens');
    if (!estado.itens.length) {
      tb.innerHTML = '<tr><td colspan="9" class="vazio">Nenhum produto. Busque acima.</td></tr>';
    } else {
      tb.innerHTML = estado.itens.map(i => {
        const total = i.quantidade * preco(i) - i.desconto;
        return '<tr>'
          + '<td>' + i.codigo + '</td>'
          + '<td>' + escapar(i.descricao) + (i.descricaoTecnica ? '<div class="tec">' + escapar(i.descricaoTecnica) + '</div>' : '') + '</td>'
          + '<td>' + escapar(i.referencia) + '</td>'
          + '<td class="num' + (i.estoque < i.quantidade ? ' zero' : '') + '">' + i.estoque + '</td>'
          + '<td class="num"><input class="qtd" data-cod="' + i.codigo + '" value="' + i.quantidade + '" inputmode="numeric"></td>'
          + '<td class="num">' + brl(preco(i)) + '</td>'
          + '<td class="num"><input class="desc" data-cod="' + i.codigo + '" value="' + (i.desconto ? brl(i.desconto) : '') + '" placeholder="0,00" inputmode="decimal"></td>'
          + '<td class="num">' + brl(total) + '</td>'
          + '<td><button type="button" class="btn-x" data-tirar="' + i.codigo + '" title="tirar">×</button></td>'
          + '</tr>';
      }).join('');
    }
    totais();
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
    }
    totais();
  });
  // ao sair do campo, redesenha (total da linha e formato do desconto)
  $('itens').addEventListener('focusout', ev => { if (ev.target.matches('input.qtd, input.desc')) desenharItens(); });
  $('itens').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.matches('input.qtd, input.desc')) {
      ev.preventDefault();
      if (ev.target.classList.contains('qtd')) ev.target.closest('tr').querySelector('input.desc').focus();
      else $('busca-produto').focus();                   // proximo produto
    }
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
      itens: estado.itens.map(i => ({ codigo: i.codigo, quantidade: i.quantidade, desconto: i.desconto })),
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
      cx.style.left = '50%'; cx.style.top = '10vh'; cx.style.transform = 'translateX(-50%)';
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
      recado('✓ venda nº ' + v.numero + ' fechada — ' + resumo, 'ok');
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
  ['ok', 'fe', 'cc', 'cf'].forEach(pre => {
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
    if (!$('cf-caixa').hidden) fecharFicha();
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
