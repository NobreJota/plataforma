// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\nota.js
// Criado em:   25/09/2026
// Alterado em: 25/09/2026 — tela redesenhada no formato do DANFE.
// Alterado em: 25/09/2026 — volumes somados (a nota pode trazer varios <vol>).
// Alterado em: 25/09/2026 — efetivacao da entrada e recusa da nota.
// Alterado em: 26/09/2026 — ligar NAO conta unidade. Comparar a nota com o
//                           pedido e contar mercadoria sao coisas separadas,
//                           e agora tambem sao campos separados.
// Alterado em: 26/09/2026 — o leitor saiu daqui: aqui nao se conta nada.
// Alterado em: 26/09/2026 — a efetivacao saiu daqui: quem confirma a entrada e
//                           a conferencia fisica, no fim da contagem.
// Alterado em: 26/09/2026 — a NOSSA descricao sempre visivel na linha.
// Alterado em: 26/09/2026 — linha do pedido ja usada sai da lista de candidatas.
// Alterado em: 26/09/2026 — botao que abre a contagem fisica.
// Alterado em: 26/09/2026 — esta pagina confere NOTA x PEDIDO. A contagem
//                           fisica saiu daqui: vai para a pagina de recebimento.
// Alterado em: 26/09/2026 — a linha da grade tratada pelo modal fica acesa.
// Alterado em: 26/09/2026 — referencia divergente pergunta antes de gravar.
// Alterado em: 26/09/2026 — coluna CUSTO DO PEDIDO na grade.
// Alterado em: 26/09/2026 — janelas arrastaveis pela faixa do titulo; o custo
//                           das linhas do pedido e unitario e rotulado.
// Alterado em: 26/09/2026 — conferencia CEGA: a quantidade pedida so aparece
//                           depois de contada. O botao da linha captura o
//                           pedido e so existe enquanto falta o nosso codigo.
// Alterado em: 25/09/2026 — a descricao do fabricante e guardada no produto.
// Alterado em: 25/09/2026 — os candidatos de cada item sao as linhas do PEDIDO.
//                           Nao existe nota fiscal sem pedido; buscar no cadastro
//                           inteiro virou saida de emergencia.
// Alterado em: 25/09/2026 — o codigo do nosso produto e digitado na propria
//                           linha. A busca por texto virou saida de emergencia.
// Alterado em: 25/09/2026 — grade enxuta: so o que se decide. O fiscal foi
//                           todo para a lupa; entraram pedido, custo anterior
//                           e variacao.
//
// Uma nota fiscal de entrada: conferencia por codigo de barras, vinculo com
// o pedido e efetivacao.
//
// A leitura da tela segue o papel: quadros de rotulo miudo na ordem do DANFE
// (emitente, fatura/duplicatas, calculo do imposto, transportador/volumes) e
// a grade de produtos nas mesmas colunas. As duas colunas que o papel nao tem
// sao as do trabalho: LIDO e CUSTO REAL.
//
// QUANT (verde) e o que veio na nota. LIDO e o que passou no leitor.
// Iguais: linha verde. No meio do caminho: ambar. Passou: vermelho.
//
// Cada leitura grava no servidor na hora. O trabalho e interrompido o tempo
// todo: ao reabrir, a tela mostra exatamente onde parou.
// =============================================================================

'use strict';

(function () {

  const notaId = document.body.dataset.nota;
  const CHAVE_QUADROS = 'nota-quadros-tamanho';

  const estado = {
    nota: null,
    produtos: {},
    pedidoItens: {},
    comparacao: null,
    pedidos: [],
    aba: 'itens',
    ligando: null,        // { indice, item } enquanto escolhe o produto
    quadros: 'compacto',  // 'compacto' | 'completo'
    abertas: new Set(),   // indices das linhas com o detalhe aberto
    editandoCodigo: null, // indice da linha com o campo de codigo aberto
    linhasPedido: [],     // as linhas do pedido mostradas no modal
    escolhida: null,      // { codigoProd, linha } aguardando a decisao da referencia
  };

  const $ = id => document.getElementById(id);

  const el = {
    voltar:     $('voltar'),
    documento:  $('documento'),
    valorTotal: $('valor-total'),
    quadros:    $('quadros'),
    btnQuadros: $('btn-quadros'),

    abaItens:   $('aba-itens'),
    abaPedido:  $('aba-pedido'),
    qtdItens:   $('qtd-itens'),

    painelItens:  $('painel-itens'),
    painelPedido: $('painel-pedido'),

    recado:  $('recado'),
    itens:   $('itens'),
    vinculo: $('vinculo'),
    comparacao: $('comparacao'),

    estado:      $('estado'),
    btnContar:   $('btn-contar'),
    btnRecusar:  $('btn-recusar'),

    modalRef:     $('modal-ref'),
    refNossa:     $('ref-nossa'),
    refFab:       $('ref-fab'),
    refAviso:     $('ref-aviso'),
    refCancelar:  $('ref-cancelar'),
    refManter:    $('ref-manter'),
    refAtualizar: $('ref-atualizar'),

    btnAjuda:   $('btn-ajuda'),
    modalAjuda: $('modal-ajuda'),
    ajFechar:   $('aj-fechar'),


    modalRec:     $('modal-recusar'),
    recTitulo:    $('rec-titulo'),
    recMotivo:    $('rec-motivo'),
    recCancelar:  $('rec-cancelar'),
    recConfirmar: $('rec-confirmar'),

    modal:      $('modal-ligar'),
    ligarDesc:  $('ligar-desc'),
    ligarMeta:  $('ligar-meta'),
    buscaProd:  $('busca-prod'),
    achados:    $('achados'),
    cancelarLigar: $('cancelar-ligar'),
  };

  // ---- formatacao -----------------------------------------------------------
  const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  // quantidade pode vir 2,0000 do XML; mostra 2, e 2,5 quando for fracionada
  const quant = q => Number(q || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0, maximumFractionDigits: 3,
  });

  const pct = p => p
    ? Number(p).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

  const peso = p => Number(p || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 3, maximumFractionDigits: 3,
  });

  const dia = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return String(d.getUTCDate()).padStart(2, '0') + '/'
         + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
         + String(d.getUTCFullYear()).slice(2);
  };

  // mesma normalizacao do servidor: sem hifen, sem espaco, em maiusculas
  const chaveRef = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const escapar = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const cnpjBonito = v => {
    const s = String(v || '').replace(/\D/g, '');
    if (s.length === 14) {
      return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (s.length === 11) {
      return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return v || '';
  };

  // chave de acesso em grupos de 4, como o DANFE imprime
  const chaveBonita = v => String(v || '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();

  const ROTULO = {
    RECEBIDA: 'Recebida', VINCULADA: 'Vinculada',
    EM_CONFERENCIA: 'Em conferência', EFETIVADA: 'Efetivada', RECUSADA: 'Recusada',
  };

  const FRETE_POR_CONTA = {
    '0': '0 — Emitente',
    '1': '1 — Destinatário',
    '2': '2 — Terceiros',
    '3': '3 — Próprio, por conta do emitente',
    '4': '4 — Próprio, por conta do destinatário',
    '9': '9 — Sem frete',
  };

  // um par rótulo/valor da linha de detalhe
  function par(rotulo, valor) {
    return '<div class="par"><span class="r">' + rotulo + '</span>'
         + '<div class="v">' + (valor === '' || valor == null ? '—' : valor) + '</div></div>';
  }

  // uma cela do quadro. `classe` aceita: num, vazio, alerta, ok
  function cela(rotulo, valor, classe, tamanho) {
    const vazio = (valor === '' || valor === null || valor === undefined);
    const c = [classe || '', vazio ? 'vazio' : ''].filter(Boolean).join(' ');
    return '<div class="cela ' + (tamanho || '') + '">'
         +   '<span class="r">' + rotulo + '</span>'
         +   '<div class="v ' + c + '">' + (vazio ? '—' : valor) + '</div>'
         + '</div>';
  }

  function quadro(rotulo, linhas, rodape) {
    return '<div class="quadro">'
      + (rotulo ? '<div class="rotulo">' + rotulo + '</div>' : '')
      + linhas.map(l => '<div class="celas">' + l + '</div>').join('')
      + (rodape ? '<div class="nota-rodape-quadro">' + rodape + '</div>' : '')
      + '</div>';
  }

  // ---- rede -----------------------------------------------------------------
  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
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
    if (!j.ok) throw new Error(j.erro || 'falha na operação');
    return j;
  }

  let sumirRecado = null;
  function recado(texto, tipo) {
    clearTimeout(sumirRecado);
    el.recado.className = 'recado visivel ' + (tipo || 'ok');
    el.recado.textContent = texto;
    if (tipo !== 'erro') {
      sumirRecado = setTimeout(() => el.recado.classList.remove('visivel'), 4000);
    }
  }


  // ---- carregar -------------------------------------------------------------
  async function carregar() {
    try {
      const d = await buscar('/compra/api/nota/' + notaId);
      if (!d) return;

      estado.nota = d.nota;
      estado.produtos = d.produtos || {};
      estado.pedidoItens = d.pedidoItens || {};
      estado.comparacao = d.comparacao;
      estado.pedidos = d.pedidosPendentes || [];

      desenharBarra();
      desenharQuadros();
      desenharItens();
      desenharPedido();
      atualizarRodape();
    } catch (e) {
      el.documento.innerHTML = '<span class="numero">Erro</span>'
        + '<span class="serie">' + escapar(e.message) + '</span>';
      console.error('[nota]', e);
    }
  }

  // ---- barra de topo --------------------------------------------------------
  function desenharBarra() {
    const n = estado.nota;

    el.documento.innerHTML = ''
      + '<span class="tipo">Nota fiscal eletrônica</span>'
      + '<span class="numero">nº ' + escapar(n.numero || '—') + '</span>'
      + (n.serie ? '<span class="serie">série ' + escapar(n.serie) + '</span>' : '')
      + '<span class="etiqueta ' + n.situacao + '">' + ROTULO[n.situacao] + '</span>';

    el.valorTotal.textContent = moeda(n.valorTotal);
  }

  // ---- quadros do DANFE -----------------------------------------------------
  function desenharQuadros() {
    const n = estado.nota;
    const em = n.emitente || {};
    const de = n.destinatario || {};
    const tr = n.transportadoraXml || {};
    const prot = n.protocolo || {};

    // A NF-e pode partir a carga em varios registros <vol>. A nota 620819 da
    // Rinnai traz 5 registros que somam os 11 volumes impressos no DANFE.
    // Mostrar so o primeiro daria um numero menor que o do papel.
    const vols = n.volumes || [];
    const juntar = campo => [...new Set(
      vols.map(v => v[campo]).filter(Boolean)
    )].join(' · ');

    const vol = {
      quantidade:  vols.reduce((s, v) => s + (v.quantidade || 0), 0),
      especie:     juntar('especie'),
      marca:       juntar('marca'),
      numeracao:   juntar('numeracao'),
      pesoBruto:   vols.reduce((s, v) => s + (v.pesoBruto || 0), 0),
      pesoLiquido: vols.reduce((s, v) => s + (v.pesoLiquido || 0), 0),
    };

    const endereco = [em.logradouro, em.complemento, em.bairro]
      .filter(Boolean).join(' · ');

    const semFornec = !n.fornecedor;
    const autorizada = !prot.status || prot.status === '100' || prot.status === '150';

    const dups = n.duplicatas || [];
    const soma = dups.reduce((s, d) => s + (d.valor || 0), 0);
    const fecha = soma === n.valorTotal;

    // ---- encolhido: uma faixa com o que se olha o tempo todo --------------
    if (estado.quadros === 'compacto') {
      el.quadros.innerHTML = '<div class="quadro compacto">'
        + '<div class="celas">'
        +   cela('Emitente',
              escapar(em.razao) + '  ·  ' + cnpjBonito(em.cnpj),
              semFornec ? 'alerta' : '', 'larga')
        +   cela('Emissão / entrada',
              (dia(n.dataEmissao) || '—') + '  →  ' + (dia(n.dataEntrada) || '—'))
        +   cela('Frete',
              escapar([n.frete, tr.razao].filter(Boolean).join('  ·  ')), '', 'media')
        +   cela('Produtos + IPI',
              moeda(n.valorProdutos) + '  +  ' + moeda(n.valorIpi), 'num', 'media')
        +   cela('Títulos',
              dups.length
                ? dups.length + '  ·  ' + dups.map(d => dia(d.vencimento)).join('  ')
                  + (fecha ? '  ✓' : '  ✕')
                : 'nenhum',
              dups.length && !fecha ? 'alerta' : '', 'media')
        + '</div></div>';
      return;
    }

    // ---- emitente ----------------------------------------------------------
    const qEmitente = quadro('Emitente', [
      cela('Razão social', escapar(em.razao), '', 'larga')
      + cela('CNPJ', cnpjBonito(em.cnpj))
      + cela('Inscrição estadual', escapar(em.inscricao))
      + cela('Fone', escapar(em.fone)),

      cela('Endereço', escapar(endereco), '', 'larga')
      + cela('Município / UF',
          escapar([em.cidade, em.uf].filter(Boolean).join('/')))
      + cela('CEP', escapar(em.cep)),

      cela('Natureza da operação', escapar(n.naturezaOperacao), '', 'media')
      + cela('Emissão', dia(n.dataEmissao))
      + cela('Saída', dia(n.dataSaida))
      + cela('Entrada', dia(n.dataEntrada))
      + cela('Fornecedor na plataforma',
          semFornec ? 'não está no cadastro' : escapar(em.razao),
          semFornec ? 'alerta' : 'ok', 'media'),

      cela('Chave de acesso',
          '<span class="chave">' + escapar(chaveBonita(n.chaveAcesso)) + '</span>',
          '', 'larga')
      + cela('Protocolo de autorização',
          escapar(prot.numero) + (prot.data ? ' · ' + dia(prot.data) : ''),
          autorizada ? '' : 'alerta', 'media')
      + cela('Destinatário',
          escapar(de.razao) + (de.cnpj ? ' · ' + cnpjBonito(de.cnpj) : ''), '', 'media'),
    ], autorizada ? '' : '⚠ nota sem autorização da SEFAZ: '
        + escapar(prot.motivo || 'protocolo ausente'));

    // ---- fatura / duplicatas ----------------------------------------------
    const qDuplicatas = dups.length
      ? quadro('Fatura / duplicatas', [
          dups.map(d => cela(
            'Nº ' + escapar(d.numero),
            dia(d.vencimento) + '<br>' + moeda(d.valor)
          )).join('')
          + cela('Soma', moeda(soma) + (fecha ? ' ✓' : ' ✕'),
              fecha ? 'ok num' : 'alerta num'),
        ], fecha
            ? 'Ao efetivar, estes ' + dups.length
              + ' títulos entram no fluxo como obrigação a pagar.'
            : '⚠ a soma das duplicatas não bate com o total da nota ('
              + moeda(n.valorTotal) + ').')
      : quadro('Fatura / duplicatas', [
          cela('Duplicatas', 'a nota não traz duplicatas', 'alerta', 'larga'),
        ], 'Nenhum título será lançado no fluxo.');

    // ---- calculo do imposto -------------------------------------------------
    const qImposto = quadro('Cálculo do imposto', [
      cela('Base de cálculo do ICMS', moeda(n.valorBcIcms), 'num')
      + cela('Valor do ICMS', moeda(n.valorIcms), 'num')
      + cela('Base de cálculo ICMS ST', moeda(n.valorBcIcmsSt), 'num')
      + cela('Valor do ICMS substituição', moeda(n.valorIcmsSt), 'num')
      + cela('Valor total dos produtos', moeda(n.valorProdutos), 'num'),

      cela('Valor do frete', moeda(n.valorFrete), 'num')
      + cela('Valor do seguro', moeda(n.valorSeguro), 'num')
      + cela('Desconto', moeda(n.valorDesconto), 'num')
      + cela('Outras despesas acessórias', moeda(n.valorOutras), 'num')
      + cela('Valor total do IPI', moeda(n.valorIpi), 'num')
      + cela('Valor total da nota', moeda(n.valorTotal), 'num'),
    ], n.valorIpi
        ? 'O IPI entra no custo do estoque: ' + moeda(n.valorProdutos)
          + ' em produto viram ' + moeda(n.valorProdutos + n.valorIpi + n.valorIcmsSt)
          + ' de mercadoria.'
        : '');

    // ---- transportador / volumes -------------------------------------------
    const qTransporte = quadro('Transportador / volumes transportados', [
      cela('Nome / razão social', escapar(tr.razao), '', 'larga')
      + cela('Frete por conta',
          escapar(FRETE_POR_CONTA[n.modFrete] || '')
          + (n.frete ? ' (' + n.frete + ')' : ''), '', 'media')
      + cela('CNPJ', cnpjBonito(tr.cnpj))
      + cela('Inscrição estadual', escapar(tr.inscricao)),

      cela('Endereço', escapar(tr.endereco), '', 'larga')
      + cela('Município / UF',
          escapar([tr.cidade, tr.uf].filter(Boolean).join('/'))),

      cela('Quantidade', quant(vol.quantidade), 'num')
      + cela('Espécie', escapar(vol.especie))
      + cela('Marca', escapar(vol.marca))
      + cela('Numeração', escapar(vol.numeracao))
      + cela('Peso bruto', vol.pesoBruto ? peso(vol.pesoBruto) : '', 'num')
      + cela('Peso líquido', vol.pesoLiquido ? peso(vol.pesoLiquido) : '', 'num'),
    ], [
      tr.razao
        ? 'É com esta transportadora que se reclama a entrega, mesmo no frete CIF.'
        : '',
      vols.length > 1
        ? 'Quantidade e pesos somados de ' + vols.length + ' registros de volume da nota.'
        : '',
    ].filter(Boolean).join('  ·  '));

    el.quadros.innerHTML = qEmitente + qDuplicatas + qImposto + qTransporte;
  }

  // ---- grade de produtos ----------------------------------------------------
  // A coluna NOSSO CÓD. So o numero. Clicar nele reabre a edicao, que e como
  // se corrige uma ligacao errada. Sem codigo a celula fica vazia: quem
  // resolve isso e o botao "capturar pedido", na ponta direita da linha.
  function celaCodigo(idx, identificado, encerrada) {
    const item = estado.nota.itens[idx];

    if (estado.editandoCodigo === idx && !encerrada) {
      return '<input class="in-codigo" type="text" inputmode="numeric" '
        +   'data-i="' + idx + '" placeholder="código" '
        +   'value="' + (item.codigoProd || '') + '">';
    }

    if (!identificado) return '<span class="neutro">—</span>';

    return encerrada
      ? '<span class="cod-nosso">' + item.codigoProd + '</span>'
      : '<button class="cod-nosso" data-acao="codigo" data-i="' + idx + '" '
        + 'title="Trocar o código do produto">' + item.codigoProd + '</button>';
  }

  // A coluna de acao. Nesta pagina so existe uma acao: capturar o pedido
  // enquanto falta o nosso codigo. A contagem fisica acontece na pagina do
  // recebimento, com outro operador e outras regras.
  function celaAcao(idx, identificado, lido, encerrada) {
    if (encerrada || identificado) return '';
    return '<div class="acoes-linha">'
      + '<button class="btn-mini destaque" data-acao="buscar" data-i="' + idx + '">'
      + 'capturar pedido</button></div>';
  }

  // Legenda embaixo da grade. Cada verbete usa a MESMA cor da linha que
  // descreve — legenda desbotada ninguem le.
  function legenda() {
    const cor = (classe, texto) =>
      '<span class="verbete ' + classe + '">'
      + '<i class="amostra"></i>' + texto + '</span>';

    return '<div class="legenda">'
      + cor('v-verde',    'a nota traz o que foi pedido')
      + cor('v-ambar',    'a nota traz menos do que foi pedido')
      + cor('v-vermelho', 'a nota traz mais do que foi pedido')
      + '</div>';
  }

  function desenharItens(recemIdx) {
    const itens = estado.nota.itens || [];
    const encerrada = estado.nota.situacao === 'EFETIVADA'
                   || estado.nota.situacao === 'RECUSADA';
    const temPedido = !!estado.nota.pedido;

    el.qtdItens.textContent = itens.filter(i =>
      (i.quantidadeConferida || 0) >= i.quantidade).length + '/' + itens.length;

    const soma = { quantidade: 0, lido: 0, pedido: 0, pedidoValor: 0,
                   custo: 0, valorTotal: 0 };

    const linhas = itens.map((i, idx) => {
      const lido = i.quantidadeConferida || 0;
      const nosso = i.codigoProd ? estado.produtos[i.codigoProd] : null;
      const doPedido = i.codigoProd ? estado.pedidoItens[i.codigoProd] : null;
      const identificado = !!i.codigoProd;

      soma.quantidade += i.quantidade || 0;
      soma.lido       += lido;
      soma.pedido      += doPedido ? (doPedido.quantidade || 0) : 0;
      soma.pedidoValor += (doPedido && doPedido.custoUnitario)
                          ? doPedido.custoUnitario * (i.quantidade || 0) : 0;
      soma.valorTotal += i.valorTotal || 0;
      soma.custo      += (i.valorTotal || 0) + (i.ipi || 0) + (i.icmsSt || 0)
                       + (i.rateio || 0) - (i.desconto || 0);

      // A cor da linha compara a NOTA com o PEDIDO, que e o que esta pagina
      // confere. A contagem fisica e assunto da pagina de recebimento.
      let classeLinha = 'item';
      let classeLido = lido > 0 ? (lido >= i.quantidade ? 'fecha' : 'parcial') : 'zero';

      if (doPedido) {
        const pedida = doPedido.quantidade || 0;
        if (i.quantidade > pedida)      classeLinha += ' excesso';
        else if (i.quantidade < pedida) classeLinha += ' parcial';
        else                            classeLinha += ' conferido';
      }
      if (idx === recemIdx) classeLinha += ' recem';

      const aberta = estado.abertas.has(idx);
      if (aberta) classeLinha += ' aberta';

      // ---- a quantidade bate com o pedido? --------------------------------
      let celaPedido = '<span class="neutro">—</span>';
      if (doPedido) {
        const pedida = doPedido.quantidade || 0;
        const marca = i.quantidade === pedida ? 'fecha'
                    : (i.quantidade < pedida ? 'parcial' : 'excesso');
        celaPedido = '<span class="qtd-ped ' + marca + '">' + quant(pedida) + '</span>';
      } else if (temPedido && identificado) {
        celaPedido = '<span class="fora">fora</span>';
      }

      // ---- o custo mudou? --------------------------------------------------
      const antes = nosso ? (nosso.custoAnterior || 0) : 0;
      const agora = i.custoUnitarioReal || 0;
      const varia = antes ? Math.round(((agora - antes) / antes) * 1000) / 10 : null;

      let classeVar = 'neutro';
      if (varia != null) {
        if (varia >= 10) classeVar = 'sobe-forte';
        else if (varia > 0.5) classeVar = 'sobe';
        else if (varia <= -10) classeVar = 'desce-forte';
        else if (varia < -0.5) classeVar = 'desce';
        else classeVar = 'igual';
      }

      // quanto o IPI e o resto acrescentam sobre o valor unitario da nota
      const sobreNota = i.valorUnitario
        ? Math.round(((agora - i.valorUnitario) / i.valorUnitario) * 1000) / 10
        : 0;

      return '<tr class="' + classeLinha + '" data-i="' + idx + '">'
        + '<td class="ref">' + escapar(i.codigoFornec) + '</td>'
        + '<td class="c">' + celaCodigo(idx, identificado, encerrada) + '</td>'

        + '<td>'
        +   '<div class="prod-desc">'
        +     '<span class="ponto ' + (identificado ? 'sim' : 'nao') + '"></span>'
        +     escapar(i.descricaoXml)
        +     '<button class="lupa-linha" data-acao="detalhe" data-i="' + idx + '" '
        +       'title="' + (aberta ? 'Fechar' : 'Abrir') + ' o detalhe">'
        +       (aberta ? '🔍−' : '🔍+') + '</button>'
        +   '</div>'
        // A NOSSA descricao fica SEMPRE visivel, fora do bloco que o modo
        // compacto esconde. E nela que estao a litragem e o tipo de gas —
        // a do fabricante diz so "AQUECEDOR DE AGUA A GAS BI-VOLT", e foi
        // por nao ver isso lado a lado que o M 200 GN entrou como GLP.
        +   '<div class="prod-nosso">'
        +     (identificado
                ? '<span class="ligado">↳ ' + escapar(nosso ? nosso.descricao : 'produto ligado')
                  + '</span>'
                  + (nosso && nosso.referencia ? '  ·  ' + escapar(nosso.referencia) : '')
                  + (nosso ? '  ·  estoque ' + (nosso.estoque || 0) : '')
                : '<span class="pendente">⚠ produto não identificado</span>')
        +   '</div>'
        + '</td>'

        + '<td class="n">' + celaPedido + '</td>'
        + '<td class="n"><span class="qtd-nota">' + quant(i.quantidade) + '</span></td>'
        + '<td class="n"><span class="qtd-lida ' + classeLido + '">' + quant(lido)
        +   '<small> / ' + quant(i.quantidade) + '</small></span></td>'

        + '<td class="n">' + moeda(i.valorUnitario) + '</td>'

        + '<td class="n">' + (doPedido && doPedido.custoUnitario
              ? moeda(doPedido.custoUnitario)
              : '<span class="neutro">—</span>') + '</td>'

        + '<td class="n"><span class="custo-real">' + moeda(agora) + '</span>'
        +   (sobreNota > 0 ? '<span class="custo-sobe">+' + pct(sobreNota) + '% c/ IPI</span>' : '')
        + '</td>'

        + '<td class="n">' + (antes ? moeda(antes) : '<span class="neutro">—</span>') + '</td>'

        + '<td class="n"><span class="var ' + classeVar + '">'
        +   (varia == null ? '—'
              : (varia > 0 ? '+' : '') + pct(varia) + '%')
        + '</span></td>'

        + '<td>' + celaAcao(idx, identificado, lido, encerrada) + '</td>'
        + '</tr>'

        // ---- detalhe: tudo que saiu da grade mora aqui -------------------
        + '<tr class="detalhe' + (aberta ? ' aberta' : '') + '" data-d="' + idx + '">'
        +   '<td colspan="12">'
        +     '<div class="detalhe-grade">'
        +       par('Item da nota', i.numeroItem)
        +       par('EAN', escapar(i.ean) || 'sem GTIN')
        +       par('NCM / CEST', escapar(i.ncm) + (i.cest ? ' / ' + escapar(i.cest) : ''))
        +       par('Origem / CST', escapar((i.origem || '') + (i.cst || '')))
        +       par('CFOP', escapar(i.cfop))
        +       par('Unidade', escapar(i.unidade))
        +       (nosso && nosso.descricaoFab
                  ? par('Descrição do fabricante no produto',
                        escapar(nosso.descricaoFab)
                        + (nosso.refFab ? '  ·  ' + escapar(nosso.refFab) : ''))
                  : '')
        +       par('V. total', moeda(i.valorTotal))
        +       par('BC ICMS', moeda(i.bcIcms))
        +       par('V. ICMS', moeda(i.icms) + (i.aliqIcms ? '  (' + pct(i.aliqIcms) + '%)' : ''))
        +       par('V. IPI', moeda(i.ipi) + (i.aliqIpi ? '  (' + pct(i.aliqIpi) + '%)' : ''))
        +       (doPedido
                  ? par('Custo no pedido', moeda(doPedido.custoUnitario))
                  : '')
        +     '</div>'
        +     '<div class="conta-custo">'
        +       'produto ' + moeda(i.valorTotal)
        +       (i.ipi ? '  +  IPI ' + moeda(i.ipi) : '')
        +       (i.icmsSt ? '  +  ST ' + moeda(i.icmsSt) : '')
        +       (i.rateio ? '  +  rateio ' + moeda(i.rateio) : '')
        +       (i.desconto ? '  −  desconto ' + moeda(i.desconto) : '')
        +       '  =  ' + moeda((i.valorTotal || 0) + (i.ipi || 0) + (i.icmsSt || 0)
                                + (i.rateio || 0) - (i.desconto || 0))
        +       '   ÷ ' + quant(i.quantidade) + '  =  <b>' + moeda(agora) + '</b> por unidade'
        +     '</div>'
        +     (i.infoAdicional
                ? '<div class="info-xml">' + escapar(i.infoAdicional) + '</div>'
                : '')
        +   '</td>'
        + '</tr>';
    }).join('');

    const todasAbertas = estado.abertas.size === itens.length && itens.length > 0;

    el.itens.innerHTML = ''
      + '<table class="danfe compacta"><thead><tr>'
      +   '<th>Ref.</th>'
      +   '<th class="c trabalho">Nosso cód.</th>'
      +   '<th>Produto'
      +     '<button class="lupa-th" id="lupa-todas" '
      +       'title="' + (todasAbertas ? 'Fechar' : 'Abrir') + ' o detalhe de todos">'
      +       (todasAbertas ? '🔍−' : '🔍+') + '</button>'
      +   '</th>'
      +   '<th class="n">Pedido</th>'
      +   '<th class="n">Nota</th>'
      +   '<th class="n trabalho">Lido</th>'
      +   '<th class="n">Unit. da nota</th>'
      +   '<th class="n">Custo do pedido</th>'
      +   '<th class="n trabalho">Custo real</th>'
      +   '<th class="n">Custo anterior</th>'
      +   '<th class="n trabalho">Variação</th>'
      +   '<th></th>'
      + '</tr></thead><tbody>' + linhas + '</tbody>'
      + '<tfoot><tr>'
      +   '<td colspan="3">' + itens.length + ' itens</td>'
      +   '<td class="n">' + (soma.pedido ? quant(soma.pedido) : '') + '</td>'
      +   '<td class="n">' + quant(soma.quantidade) + '</td>'
      +   '<td class="n">' + quant(soma.lido) + '</td>'
      +   '<td class="n">' + moeda(soma.valorTotal) + '</td>'
      +   '<td class="n">' + (soma.pedidoValor ? moeda(soma.pedidoValor) : '') + '</td>'
      +   '<td class="n">' + moeda(soma.custo) + '</td>'
      +   '<td colspan="3"></td>'
      + '</tr></tfoot></table>'
      + legenda();

    if (estado.editandoCodigo != null) {
      const campo = el.itens.querySelector('.in-codigo');
      if (campo) { campo.focus(); campo.select(); }
    }

    if (estado.ligando) focoNaLinha(estado.ligando.indice);
  }

  // ---- pedido ---------------------------------------------------------------
  function desenharPedido() {
    const n = estado.nota;

    if (!n.fornecedor) {
      el.vinculo.innerHTML = '<div class="aviso">'
        + 'O fornecedor desta nota não está no cadastro, '
        + 'então não há pedidos para vincular.</div>';
      el.comparacao.innerHTML = '';
      return;
    }

    if (!estado.pedidos.length && !n.pedido) {
      el.vinculo.innerHTML = '<div class="aviso">'
        + 'Nenhum pedido pendente deste fornecedor. '
        + 'A entrada será registrada sem pedido.</div>';
      el.comparacao.innerHTML = '';
      return;
    }

    el.vinculo.innerHTML = ''
      + '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">'
      +   '<label style="font-size:11px;letter-spacing:.07em;text-transform:uppercase;'
      +     'color:#6b7280;font-weight:700" for="sel-pedido">Pedido</label>'
      +   '<select id="sel-pedido">'
      +     '<option value="">— sem pedido —</option>'
      +     estado.pedidos.map(p =>
            '<option value="' + p._id + '"'
            + (String(n.pedido) === String(p._id) ? ' selected' : '') + '>'
            + 'nº ' + p.numero + '  ·  ' + dia(p.dataEmissao)
            + '  ·  ' + p.itens + ' itens  ·  ' + moeda(p.valorTotal)
            + '</option>').join('')
      +   '</select>'
      + '</div>';

    const c = estado.comparacao;
    if (!c) { el.comparacao.innerHTML = ''; return; }

    el.comparacao.innerHTML = ''
      + '<table class="simples"><thead><tr>'
      +   '<th style="width:80px">Código</th><th>Descrição</th>'
      +   '<th class="n" style="width:90px">Pedido</th>'
      +   '<th class="n" style="width:90px">Chegou</th>'
      +   '<th class="n" style="width:90px">Falta</th>'
      +   '<th class="n" style="width:120px">Custo pedido</th>'
      +   '<th class="n" style="width:120px">Custo nota</th>'
      + '</tr></thead><tbody>'
      + c.linhas.map(l => {
          const cls = l.falta > 0 ? 'falta' : (l.noPedido ? '' : 'extra');
          const dif = (l.custoPedido && l.custoNota)
            ? (l.custoNota > l.custoPedido ? ' ▲' : (l.custoNota < l.custoPedido ? ' ▼' : ''))
            : '';
          return '<tr class="' + cls + '">'
            + '<td>' + (l.codigo || '—') + '</td>'
            + '<td>' + escapar(l.descricao) + '</td>'
            + '<td class="n">' + (l.pedido || '') + '</td>'
            + '<td class="n">' + (l.chegou || '') + '</td>'
            + '<td class="n">' + (l.falta || '') + '</td>'
            + '<td class="n">' + (l.custoPedido ? moeda(l.custoPedido) : '') + '</td>'
            + '<td class="n">' + (l.custoNota ? moeda(l.custoNota) + dif : '') + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>'
      + '<div style="margin-top:12px;font-size:14px">'
      +   (c.temSaldo
            ? '<strong style="color:#d97706">Entrega parcial.</strong> '
              + 'Ao efetivar, o que faltou vira um pedido de saldo.'
            : '<strong style="color:#059669">Entrega total.</strong> '
              + 'Ao efetivar, o pedido é liquidado.')
      + '</div>';
  }

  // ---- rodape ---------------------------------------------------------------
  function atualizarRodape() {
    const itens = estado.nota.itens || [];
    const identificados = itens.filter(i => i.codigoProd).length;
    const conferidos = itens.filter(i =>
      (i.quantidadeConferida || 0) >= i.quantidade).length;
    // divergencia entre o que a nota traz e o que foi pedido
    const divergentes = itens.filter(i => {
      const p = i.codigoProd ? estado.pedidoItens[i.codigoProd] : null;
      return !p || (p.quantidade || 0) !== i.quantidade;
    }).length;

    const encerrada = estado.nota.situacao === 'EFETIVADA'
                   || estado.nota.situacao === 'RECUSADA';

    // A contagem fisica so abre quando a nota bate com o pedido: nao adianta
    // mandar o conferente contar mercadoria que ja se sabe divergente.
    const podeContar = !encerrada
                    && itens.length > 0
                    && identificados === itens.length
                    && divergentes === 0;

    el.estado.textContent = encerrada
      ? ROTULO[estado.nota.situacao]
      : identificados + ' de ' + itens.length + ' identificados'
        + (divergentes
            ? '  ·  ' + divergentes + ' divergente(s) do pedido'
            : '  ·  bate com o pedido')
        + (conferidos ? '  ·  ' + conferidos + ' contados' : '');

    el.btnContar.hidden = encerrada;
    el.btnContar.disabled = !podeContar;
    el.btnContar.title = podeContar
      ? 'Abrir a contagem física desta nota'
      : (identificados < itens.length
          ? 'Faltam itens sem o nosso código'
          : 'A nota diverge do pedido: resolva antes de mandar contar');

    el.btnRecusar.disabled = encerrada;
  }

  // ---- ligar item a produto -------------------------------------------------
  function abrirLigar(indice, item) {
    estado.ligando = { indice, item };

    el.ligarDesc.textContent = item.descricaoXml || '';
    // a quantidade da nota nao entra aqui de proposito: e a conferencia cega
    el.ligarMeta.textContent = 'ref ' + (item.codigoFornec || '—')
      + (item.ean ? '  ·  EAN ' + item.ean : '  ·  sem EAN')
      + '  ·  unit. na nota ' + moeda(item.valorUnitario)
      + '  ·  custo real ' + moeda(item.custoUnitarioReal);

    el.buscaProd.value = '';
    el.modal.hidden = false;
    focoNaLinha(indice);

    if (!estado.nota.pedido) {
      desenharEscolhaPedido();
    } else {
      el.achados.innerHTML = '<div style="padding:14px;color:#6b7280">'
        + 'abrindo o pedido…</div>';
      el.buscaProd.focus();
      carregarSugestoes(indice);
    }
  }

  // ---- passo 1: capturar o pedido -----------------------------------------
  function desenharEscolhaPedido() {
    el.buscaProd.style.display = 'none';

    if (!estado.pedidos.length) {
      el.achados.innerHTML = '<div class="alerta-caixa grave">'
        + '<b>Nenhum pedido pendente deste fornecedor</b>'
        + 'Não existe nota fiscal sem pedido. Emita o pedido em '
        + '<b>Compra → Pedidos</b> e volte aqui.</div>';
      return;
    }

    el.achados.innerHTML =
      '<div class="separador-busca">pedidos pendentes deste fornecedor</div>'
      + estado.pedidos.map(p => ''
        + '<div class="achado sugestao" data-pedido="' + p._id + '">'
        +   '<div class="corpo">'
        +     '<div class="t">Pedido nº ' + p.numero + '</div>'
        +     '<div class="s">emitido ' + dia(p.dataEmissao)
        +       (p.dataEntregaPrevista
                  ? '  ·  entrega prevista ' + dia(p.dataEntregaPrevista) : '')
        +       '  ·  ' + p.itens + ' itens  ·  ' + moeda(p.valorTotal)
        +     '</div>'
        +   '</div>'
        +   '<span class="motivo">capturar</span>'
        + '</div>').join('');
  }

  async function capturarPedido(pedidoId) {
    try {
      const r = await enviar('/compra/api/nota/' + notaId + '/vincular-pedido',
        { pedidoId });
      if (!r) return;

      await carregar();
      recado('Pedido nº ' + r.pedido.numero + ' capturado.', 'ok');

      if (estado.ligando) {
        el.modal.hidden = false;
        el.buscaProd.style.display = '';
        carregarSugestoes(estado.ligando.indice);
      }
    } catch (e) {
      recado(e.message, 'erro');
    }
  }

  async function carregarSugestoes(indice) {
    try {
      const d = await buscar('/compra/api/nota/' + notaId + '/sugestoes/' + indice);
      if (!d || !estado.ligando || estado.ligando.indice !== indice) return;

      if (d.semPedido) {
        el.achados.innerHTML = '<div class="alerta-caixa grave">'
          + '<b>Esta nota não está vinculada a um pedido</b>'
          + 'Não existe nota fiscal sem pedido. Abra a aba <b>Pedido</b>, '
          + 'escolha o pedido desta entrega, e as linhas aparecem aqui.</div>';
        return;
      }

      estado.linhasPedido = d.linhas || [];

      if (!d.linhas.length) {
        el.achados.innerHTML = '<div class="alerta-caixa">'
          + '<b>Nenhuma linha do pedido sobrou</b>'
          + 'As ' + d.ocultadas + ' linhas do pedido nº ' + d.pedido.numero
          + ' já foram usadas por outros itens desta nota. '
          + 'Se alguma ligação está errada, corrija pelo lápis na coluna '
          + 'NOSSO CÓD. da outra linha.</div>'
          + '<div class="alargar">'
          +   '<button class="btn-mini" id="fora-do-pedido">'
          +   'este item não está no pedido — buscar no cadastro</button>'
          + '</div>';
        return;
      }

      el.achados.innerHTML =
        '<div class="separador-busca">'
        + d.linhas.length + ' de ' + d.pedido.itens + ' linhas do pedido nº '
        + d.pedido.numero + ' ainda livres</div>'
        + d.linhas.map(l => linhaPedido(l, d.unitDaNota)).join('')
        + '<div class="dica-dblclick">clique para marcar, duplo clique confirma</div>'
        + (d.ocultadas
            ? '<div class="ocultadas">' + d.ocultadas
              + ' linha(s) já usada(s) por outros itens estão fora desta lista</div>'
            : '')
        + '<div class="alargar">'
        +   '<button class="btn-mini" id="fora-do-pedido">'
        +   'não está no pedido — buscar no cadastro</button>'
        + '</div>';

    } catch (e) {
      el.achados.innerHTML = '<div style="padding:14px;color:#dc2626">'
        + escapar(e.message) + '</div>';
    }
  }

  // Uma linha do pedido como candidata. Mostra o custo UNITARIO do pedido e,
  // ao lado, quanto o custo da nota difere dele: e o sinal mais forte para
  // escolher a linha certa quando a referencia vem truncada.
  //
  // A quantidade pedida nao aparece aqui — conferencia cega.
  function linhaPedido(l, unitDaNota) {
    const forca = l.pontos >= 85 ? 'forte' : (l.pontos >= 40 ? 'media' : '');
    const usada = !!l.tomadaPor;

    // A comparacao e contra o UNITARIO DA NOTA, sem IPI — o par certo do
    // custo do pedido, que tambem vem sem IPI.
    let diferenca = '';
    if (unitDaNota && l.custoUnitario) {
      const d = Math.round(((unitDaNota - l.custoUnitario) / l.custoUnitario) * 1000) / 10;
      const perto = Math.abs(d);
      const classe = perto < 0.5 ? 'igual'
                   : (perto < 6 ? 'sobe' : (perto < 15 ? 'sobe' : 'sobe-forte'));
      diferenca = '  ·  <span class="var ' + classe + '" style="font-size:12px">'
        + (perto < 0.5 ? 'mesmo preço'
            : (d > 0 ? '+' : '−') + pct(perto) + ' na nota')
        + '</span>';
    }

    return '<div class="achado sugestao' + (usada ? ' usada' : '') + '" '
      +   'data-cod="' + l.codigoProd + '">'
      + '<div class="corpo">'
      +   '<div class="t">' + escapar(l.descricao) + '</div>'
      +   '<div class="s">cód <code>' + l.codigoProd + '</code>'
      +     (l.referencia ? '  ·  ref <code>' + escapar(l.referencia) + '</code>' : '')
      +     '  ·  unit. do pedido ' + moeda(l.custoUnitario)
      +     diferenca
      +   '</div>'
      + '</div>'
      + (usada
          ? '<span class="tomada">já usada · item ' + l.tomadaPor + '</span>'
          : '<span class="motivo ' + forca + '">' + escapar(l.motivo) + '</span>')
      + '</div>';
  }

  function fecharLigar() {
    estado.ligando = null;
    el.modal.hidden = true;
    el.buscaProd.style.display = '';
    focoNaLinha(null);
  }

  // Acende na grade a linha que o modal esta tratando. Com a janela aberta
  // por cima da tabela, sem isto nao da para saber de qual item se trata.
  function focoNaLinha(indice) {
    el.itens.querySelectorAll('tr.linha-foco')
      .forEach(tr => tr.classList.remove('linha-foco'));
    if (indice == null) return;
    const tr = el.itens.querySelector('tr.item[data-i="' + indice + '"]');
    if (tr) tr.classList.add('linha-foco');
  }

  // SAIDA DE EMERGENCIA: o fornecedor mandou item que nao estava no pedido.
  // O caminho normal e escolher uma linha do pedido, sem digitar nada.
  async function procurarProduto(q) {
    if (q.length < 2) {
      if (estado.ligando) carregarSugestoes(estado.ligando.indice);
      return;
    }

    try {
      const d = await buscar('/compra/api/nota/produtos?q=' + encodeURIComponent(q));
      if (!d) return;

      const cabeca = '<div class="separador-busca">'
        + 'cadastro inteiro — item fora do pedido</div>';

      if (!d.produtos.length) {
        el.achados.innerHTML = cabeca
          + '<div style="padding:14px;color:#6b7280">nada com esse texto.</div>';
        return;
      }

      el.achados.innerHTML = cabeca
        + d.produtos.map(p => ''
        + '<div class="achado" data-cod="' + p.codigoProd + '">'
        +   '<div class="t">' + escapar(p.descricao) + '</div>'
        +   '<div class="s">cód <code>' + p.codigoProd + '</code>'
        +     (p.referencia ? '  ·  ref <code>' + escapar(p.referencia) + '</code>' : '')
        +     (p.marca ? '  ·  ' + escapar(p.marca) : '')
        +     '  ·  estoque ' + (p.estoque || 0)
        +     (p.custo ? '  ·  custo ' + moeda(p.custo) : '')
        +   '</div>'
        + '</div>').join('');

    } catch (e) {
      el.achados.innerHTML = '<div style="padding:14px;color:#dc2626">'
        + escapar(e.message) + '</div>';
    }
  }

  // Antes de gravar: se a referencia do fabricante nao e a nossa, pergunta.
  // E a unica hora em que se sabe as duas, com o produto na mao.
  function escolherLinha(codigoProd) {
    if (!estado.ligando) return;

    const linha = estado.linhasPedido.find(l => l.codigoProd === codigoProd);
    const item = estado.ligando.item;

    const nossa = chaveRef(linha ? linha.referencia : '');
    const fab = chaveRef(item.codigoFornec);

    if (!linha || !fab || nossa === fab) { ligar(codigoProd); return; }

    estado.escolhida = { codigoProd, linha };

    el.refNossa.textContent = linha.referencia || '(sem referência)';
    el.refFab.textContent = item.codigoFornec;
    el.refAviso.textContent = nossa && fab.includes(nossa)
      ? 'A nossa está dentro da do fabricante — provavelmente foi truncada '
        + 'quando o cadastro veio do sistema antigo.'
      : 'As duas são diferentes. Adotar a do fabricante facilita a próxima '
        + 'nota, mas a referência antiga é a que está impressa nas etiquetas '
        + 'e listagens antigas.';

    el.modalRef.hidden = false;
    el.refAtualizar.focus();
  }

  async function ligar(codigoProd, atualizarReferencia) {
    if (!estado.ligando) return;
    const indice = estado.ligando.indice;

    try {
      const r = await enviar('/compra/api/nota/' + notaId + '/ligar',
        { item: indice, codigoProd, atualizarReferencia: !!atualizarReferencia });
      if (!r) return;

      fecharLigar();
      await carregar();

      recado('✓ ' + r.descricaoProduto
        + (r.eanGravado ? '  ·  código de barras gravado no produto' : ''), 'ok');

    } catch (e) {
      recado(e.message, 'erro');
    }
  }

  // ---- janelas arrastáveis --------------------------------------------------
  // A caixa cobre justamente a linha que se quer olhar. Arrastar pela faixa
  // do título resolve, como já acontece na janela de lançamento do razão.
  // A posição de cada caixa é lembrada enquanto a página estiver aberta.
  const posicao = new WeakMap();

  function tornarArrastavel(caixa) {
    const alca = caixa.querySelector('.cab');
    if (!alca) return;

    alca.classList.add('arrastavel');

    alca.addEventListener('pointerdown', ev => {
      // botões e campos dentro do cabeçalho continuam funcionando
      if (ev.target.closest('button, input, select, textarea, a')) return;
      if (ev.button !== 0) return;

      const atual = posicao.get(caixa) || { x: 0, y: 0 };
      const inicio = { x: ev.clientX, y: ev.clientY };

      caixa.classList.add('arrastando');
      alca.setPointerCapture(ev.pointerId);

      const mover = e => {
        const x = atual.x + (e.clientX - inicio.x);
        const y = atual.y + (e.clientY - inicio.y);

        // não deixa a caixa sair de vista: sempre sobra um pedaço na tela
        const r = caixa.getBoundingClientRect();
        const folga = 80;
        const limX = Math.max(0, (window.innerWidth  - r.width)  / 2 + r.width  - folga);
        const limY = Math.max(0, (window.innerHeight - r.height) / 2 + r.height - folga);

        const px = Math.max(-limX, Math.min(limX, x));
        const py = Math.max(-limY, Math.min(limY, y));

        posicao.set(caixa, { x: px, y: py });
        caixa.style.transform = 'translate(' + px + 'px,' + py + 'px)';
      };

      const soltar = e => {
        alca.releasePointerCapture(ev.pointerId);
        caixa.classList.remove('arrastando');
        alca.removeEventListener('pointermove', mover);
        alca.removeEventListener('pointerup', soltar);
        alca.removeEventListener('pointercancel', soltar);
      };

      alca.addEventListener('pointermove', mover);
      alca.addEventListener('pointerup', soltar);
      alca.addEventListener('pointercancel', soltar);
      ev.preventDefault();
    });

    // duplo clique na faixa devolve a caixa ao centro
    alca.addEventListener('dblclick', ev => {
      if (ev.target.closest('button, input, select, textarea, a')) return;
      posicao.delete(caixa);
      caixa.style.transform = '';
    });
  }

  document.querySelectorAll('.cobertura .caixa').forEach(tornarArrastavel);

  // ---- eventos --------------------------------------------------------------
  el.voltar.addEventListener('click', () => {
    window.location.href = '/compra/entrada';
  });

  el.btnAjuda.addEventListener('click', () => { el.modalAjuda.hidden = false; });
  el.ajFechar.addEventListener('click', () => {
    el.modalAjuda.hidden = true;
  });
  el.modalAjuda.addEventListener('click', ev => {
    if (ev.target === el.modalAjuda) { el.modalAjuda.hidden = true; }
  });

  el.btnQuadros.addEventListener('click', () => {
    estado.quadros = estado.quadros === 'compacto' ? 'completo' : 'compacto';
    aplicarQuadros();
    if (estado.nota) desenharQuadros();
    try { localStorage.setItem(CHAVE_QUADROS, estado.quadros); } catch (e) {}
  });

  function aplicarQuadros() {
    const grande = estado.quadros === 'completo';
    el.btnQuadros.innerHTML = '🔍<span>' + (grande ? '−' : '+') + '</span>';
    el.btnQuadros.title = grande ? 'Encolher o cabeçalho' : 'Ampliar o cabeçalho';
  }

  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    if (!el.modalRef.hidden) fecharRef();
    else if (!el.modal.hidden) fecharLigar();
    else if (!el.modalRec.hidden) { el.modalRec.hidden = true; }
    else if (!el.modalAjuda.hidden) { el.modalAjuda.hidden = true; }
  });

  el.itens.addEventListener('click', async ev => {
    // lupa do cabeçalho: abre ou fecha o detalhe de todos
    if (ev.target.closest('#lupa-todas')) {
      const itens = estado.nota.itens || [];
      if (estado.abertas.size === itens.length) estado.abertas.clear();
      else itens.forEach((_, i) => estado.abertas.add(i));
      desenharItens();
      return;
    }

    const b = ev.target.closest('button[data-acao]');
    if (!b) return;

    const idx = Number(b.dataset.i);
    const item = estado.nota.itens[idx];

    if (b.dataset.acao === 'detalhe') {
      if (estado.abertas.has(idx)) estado.abertas.delete(idx);
      else estado.abertas.add(idx);
      desenharItens();
      return;
    }

    if (b.dataset.acao === 'codigo') {
      estado.editandoCodigo = idx;
      desenharItens();
      return;
    }

    if (b.dataset.acao === 'buscar') {
      estado.editandoCodigo = null;
      abrirLigar(idx, item);
      return;
    }

    try {
      if (b.dataset.acao === 'desfazer') {
        const r = await enviar('/compra/api/nota/' + notaId + '/desfazer', { item: idx });
        if (!r) return;
        item.quantidadeConferida = 0;
        desenharItens();
        atualizarRodape();

      } else if (b.dataset.acao === 'ligar') {
        abrirLigar(idx, item);
      }
    } catch (e) {
      recado(e.message, 'erro');
    }
  });

  // Enter grava o codigo digitado, Esc desiste.
  el.itens.addEventListener('keydown', async ev => {
    const campo = ev.target.closest('.in-codigo');
    if (!campo) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      estado.editandoCodigo = null;
      desenharItens();
      return;
    }

    if (ev.key !== 'Enter') return;
    ev.preventDefault();

    const idx = Number(campo.dataset.i);
    const codigo = Number(String(campo.value).replace(/\D+/g, ''));

    if (!Number.isInteger(codigo) || codigo <= 0) {
      recado('digite o código do nosso produto', 'erro');
      return;
    }

    try {
      const r = await enviar('/compra/api/nota/' + notaId + '/ligar', {
        item: idx,
        codigoProd: codigo,
      });
      if (!r) return;

      estado.editandoCodigo = null;
      await carregar();

      const guardou = [];
      if (r.eanGravado) guardou.push('código de barras');
      if (r.descricaoFabGravada) guardou.push('descrição do fabricante');
      if (r.referenciaAtualizada) guardou.push('referência ' + r.referenciaAtualizada);

      recado('✓ ' + r.descricaoProduto
        + (guardou.length ? '  ·  gravado no produto: ' + guardou.join(' e ') : ''), 'ok');

    } catch (e) {
      recado(e.message, 'erro');
      const c = el.itens.querySelector('.in-codigo');
      if (c) c.select();
    }
  });

  let espera = null;
  el.buscaProd.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => procurarProduto(el.buscaProd.value.trim()), 250);
  });

  el.achados.addEventListener('click', ev => {
    if (ev.target.closest('#fora-do-pedido')) {
      el.buscaProd.style.display = '';
      el.buscaProd.focus();
      el.achados.innerHTML = '<div class="separador-busca">item fora do pedido</div>'
        + '<div style="padding:14px;color:#6b7280">'
        + 'Digite acima o nome ou o código do produto no cadastro.</div>';
      return;
    }

    // passo 1: escolher o pedido
    const ped = ev.target.closest('[data-pedido]');
    if (ped) { capturarPedido(ped.dataset.pedido); return; }

    // passo 2: um clique marca, o duplo confirma. Evita ligar o produto
    // errado por um clique solto.
    const d = ev.target.closest('.achado');
    if (!d) return;

    // segundo clique na linha ja marcada confirma, igual ao duplo clique:
    // o duplo clique exige pontaria e nem todo mundo acerta
    if (d.classList.contains('marcada')) {
      escolherLinha(Number(d.dataset.cod));
      return;
    }

    el.achados.querySelectorAll('.achado.marcada')
      .forEach(x => x.classList.remove('marcada'));
    d.classList.add('marcada');

    const dica = el.achados.querySelector('.dica-dblclick');
    if (dica) dica.textContent = 'clique de novo na linha marcada para confirmar';
  });

  el.achados.addEventListener('dblclick', ev => {
    const d = ev.target.closest('.achado[data-cod]');
    if (d) escolherLinha(Number(d.dataset.cod));
  });

  // ---- decisão sobre a referência -----------------------------------------
  function fecharRef() {
    estado.escolhida = null;
    el.modalRef.hidden = true;
  }

  el.refCancelar.addEventListener('click', fecharRef);

  el.refManter.addEventListener('click', () => {
    const e = estado.escolhida;
    fecharRef();
    if (e) ligar(e.codigoProd, false);
  });

  el.refAtualizar.addEventListener('click', () => {
    const e = estado.escolhida;
    fecharRef();
    if (e) ligar(e.codigoProd, true);
  });

  el.modalRef.addEventListener('click', ev => {
    if (ev.target === el.modalRef) fecharRef();
  });

  el.cancelarLigar.addEventListener('click', fecharLigar);

  el.modal.addEventListener('click', ev => {
    if (ev.target === el.modal) fecharLigar();
  });

  function trocarAba(qual) {
    estado.aba = qual;
    el.abaItens.classList.toggle('ativo', qual === 'itens');
    el.abaPedido.classList.toggle('ativo', qual === 'pedido');
    el.painelItens.hidden  = qual !== 'itens';
    el.painelPedido.hidden = qual !== 'pedido';
  }

  el.abaItens.addEventListener('click',  () => trocarAba('itens'));
  el.abaPedido.addEventListener('click', () => trocarAba('pedido'));

  // ---- conferência física ---------------------------------------------------
  el.btnContar.addEventListener('click', () => {
    window.location.href = '/compra/conferencia/' + notaId;
  });

  // ---- recusar --------------------------------------------------------------
  el.btnRecusar.addEventListener('click', () => {
    el.recTitulo.textContent = 'Nota ' + (estado.nota.numero || '')
      + ' · ' + (estado.nota.emitente?.razao || '');
    el.recMotivo.value = '';
    el.modalRec.hidden = false;
    el.recMotivo.focus();
  });

  el.recCancelar.addEventListener('click', () => {
    el.modalRec.hidden = true;
  });

  el.recConfirmar.addEventListener('click', async () => {
    const motivo = el.recMotivo.value.trim();
    if (motivo.length < 3) { el.recMotivo.focus(); return; }

    try {
      const r = await enviar('/compra/api/nota/' + notaId + '/recusar', { motivo });
      if (!r) return;
      el.modalRec.hidden = true;
      await carregar();
      recado('Nota recusada.', 'aviso');
    } catch (e) {
      recado(e.message, 'erro');
    }
  });

  el.modalRec.addEventListener('click', ev => {
    if (ev.target === el.modalRec) { el.modalRec.hidden = true; }
  });

  // ---- inicio ---------------------------------------------------------------
  try {
    const guardado = localStorage.getItem(CHAVE_QUADROS);
    estado.quadros = guardado === 'completo' ? 'completo' : 'compacto';
  } catch (e) { estado.quadros = 'compacto'; }
  aplicarQuadros();

  carregar();

})();
