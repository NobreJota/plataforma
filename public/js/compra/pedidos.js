// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\pedidos.js
// Alterado em: 24/09/2026  (Confirmar grava via POST /compra/api/pedido/gravar)
// Alterado em: 30/09/2026  (duplo clique no PEDIDO abre o modal do produto:
//                          pecas por mes, notas de entrada, quantidade a pedir)
// Alterado em: 01/10/2026  (modal sem os cartoes de consumo max/min: a regua
//                          dos meses ja mostra, em verde e vermelho)
// Alterado em: 01/10/2026  (modal arrasta pelo topo; aviso quando estoque +
//                          quantidade passa do consumo maximo mensal)
// Alterado em: 01/10/2026  (o aviso soma tambem o que esta a caminho)
// Alterado em: 01/10/2026  (botao Ajuda no modal: so aparece quando o fornecedor
//                          do produto tem nota do ano sem itens)
// Alterado em: 01/10/2026  (PEDIDO na grade e so leitura, sem setas: a quantidade
//                          se define no modal — duplo clique ou Enter no campo)
// Alterado em: 01/10/2026  (combo de fornecedor mostra so a marca)
// Alterado em: 01/10/2026  (depois de gravar, vai para Pedidos pendentes)
//
// Tela de emissao de pedido de compra por fornecedor.
// APIs: /compra/api/pedido/{fornecedores,grade,cabecalho,gravar}
// =============================================================================

'use strict';

(function () {

  const DIA = 86400000;

  // ---- estado ---------------------------------------------------------------
  const estado = {
    nrFornec: null,
    janela: 30,
    aba: 'pedido',
    itens: [],
    pedido: new Map(),      // codigo -> quantidade
    filtro: '',
    cabecalho: null,
    titulos: [],            // [{dias, vencimento, valor}]
    gravando: false,
  };

  // ---- elementos ------------------------------------------------------------
  const $ = id => document.getElementById(id);

  const el = {
    fornecedor: $('fornecedor'),
    janelas:    $('janelas'),
    abaPedido:  $('aba-pedido'),
    abaZero:    $('aba-zero'),
    qtdPedido:  $('qtd-pedido'),
    qtdZero:    $('qtd-zero'),
    buscaZero:  $('busca-zero'),
    filtro:     $('filtro'),
    periodo:    $('periodo'),
    grade:      $('grade'),
    itensPedido:$('itens-pedido'),
    valorTotal: $('valor-total'),
    btnGravar:  $('btn-gravar'),

    fundo:       $('fundo-modal'),
    fecharModal: $('fechar-modal'),
    cancelar:    $('cancelar-modal'),
    confirmar:   $('confirmar-pedido'),
    etiqueta:    $('etiqueta-origem'),

    representante: $('cab-representante'),
    transportadora: $('cab-transportadora'),
    boxTransp:   $('box-transportadora'),
    entrega:     $('cab-entrega'),
    condicao:    $('cab-condicao'),
    listaCond:   $('lista-condicoes'),
    nTitulos:    $('cab-ntitulos'),
    tabTitulos:  $('cab-titulos'),
    soma:        $('cab-soma'),
    resumoItens: $('cab-resumo-itens'),
    resumoTotal: $('cab-resumo-total'),
  };

  // ---- utilitarios ----------------------------------------------------------
  const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const dia = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return String(d.getUTCDate()).padStart(2, '0') + '/'
         + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
         + String(d.getUTCFullYear()).slice(2);
  };

  const paraISO = d => d.toISOString().slice(0, 10);

  const semAcento = s => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const escapar = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function aviso(texto) {
    el.grade.innerHTML =
      '<tr><td colspan="9" class="aviso">' + escapar(texto) + '</td></tr>';
  }

  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  async function enviar(url, corpo) {
    const r = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha ao gravar');
    return j;
  }

  // ---- fornecedores ---------------------------------------------------------
  async function carregarFornecedores() {
    try {
      const d = await buscar('/compra/api/pedido/fornecedores');
      if (!d) return;

      if (!d.fornecedores.length) {
        el.fornecedor.innerHTML = '<option value="">Nenhum fornecedor com venda</option>';
        return;
      }

      el.fornecedor.innerHTML =
        '<option value="">— escolha —</option>' +
        d.fornecedores.map(f =>
          '<option value="' + f.nrFornec + '">'
          + escapar(f.marca || f.razao) + '</option>').join('');

    } catch (e) {
      el.fornecedor.innerHTML = '<option value="">Erro ao carregar</option>';
      console.error('[fornecedores]', e);
    }
  }

  // ---- grade ----------------------------------------------------------------
  async function carregarGrade() {
    if (!estado.nrFornec) {
      estado.itens = [];
      estado.pedido.clear();
      el.periodo.textContent = '';
      aviso('Selecione um fornecedor.');
      atualizarRodape();
      return;
    }

    aviso('Carregando...');

    try {
      const d = await buscar('/compra/api/pedido/grade?nrFornec='
        + estado.nrFornec + '&janela=' + estado.janela);
      if (!d) return;

      estado.itens = d.itens;
      estado.pedido.clear();
      for (const i of d.itens) {
        if (i.sugestao > 0) estado.pedido.set(i.codigo, i.sugestao);
      }

      el.periodo.textContent =
        'Consumo de ' + dia(d.inicio) + ' a ' + dia(d.fim)
        + '  ·  ' + d.total + ' produtos na linha';

      desenhar();
    } catch (e) {
      aviso('Erro: ' + e.message);
      console.error('[grade]', e);
    }
  }

  function desenhar() {
    const comPedido = estado.itens.filter(i => (estado.pedido.get(i.codigo) || 0) > 0);
    const semPedido = estado.itens.filter(i => (estado.pedido.get(i.codigo) || 0) === 0);

    el.qtdPedido.textContent = comPedido.length;
    el.qtdZero.textContent = semPedido.length;

    let lista = estado.aba === 'pedido' ? comPedido : semPedido;

    if (estado.aba === 'zero' && estado.filtro) {
      const f = semAcento(estado.filtro);
      lista = lista.filter(i =>
        semAcento(i.descricao).includes(f) || semAcento(i.referencia).includes(f));
    }

    if (!lista.length) {
      aviso(estado.aba === 'pedido'
        ? 'Nenhum item sugerido nesse período. Veja o Pedido Zero.'
        : 'Nada aqui.');
      atualizarRodape();
      return;
    }

    el.grade.innerHTML = lista.map(i => {
      const q = estado.pedido.get(i.codigo) || 0;
      const total = q * i.custoUnitario;
      return ''
        + '<tr class="' + (q > 0 ? 'tem-pedido' : '') + '">'
        +   '<td>' + i.codigo + '</td>'
        +   '<td class="ref">' + escapar(i.referencia) + '</td>'
        +   '<td class="desc">' + escapar(i.descricao) + '</td>'
        +   '<td class="num">' + i.saida + '</td>'
        +   '<td class="num">' + i.estoque + '</td>'
        +   '<td class="num">' + (i.aCaminho || '') + '</td>'
        +   '<td class="num">'
        +     '<input type="text" readonly class="qtd' + (q !== i.sugestao ? ' alterado' : '') + '"'
        +     ' data-codigo="' + i.codigo + '" value="' + q + '" title="duplo clique: analisar e definir a quantidade"></td>'
        +   '<td class="num">' + moeda(i.custoUnitario) + '</td>'
        +   '<td class="num">' + (total ? moeda(total) : '') + '</td>'
        + '</tr>';
    }).join('');

    atualizarRodape();
  }

  function itensDoPedido() {
    return estado.itens
      .filter(i => (estado.pedido.get(i.codigo) || 0) > 0)
      .map(i => ({
        codigo: i.codigo,
        quantidade: estado.pedido.get(i.codigo),
        sugestao: i.sugestao,
        saida: i.saida,
        aCaminho: i.aCaminho,
      }));
  }

  function totalDoPedido() {
    let t = 0;
    for (const i of estado.itens) {
      const q = estado.pedido.get(i.codigo) || 0;
      if (q > 0) t += q * i.custoUnitario;
    }
    return t;
  }

  function atualizarRodape() {
    const n = itensDoPedido().length;
    el.itensPedido.textContent = n;
    el.valorTotal.textContent = moeda(totalDoPedido());
    el.btnGravar.disabled = n === 0;
  }

  // =========================================================================
  // MODAL DO CABECALHO
  // =========================================================================

  function preencherLeitura(id, valor, faltando) {
    const div = $(id);
    div.textContent = valor || '';
    div.classList.toggle('faltando', !!faltando);
  }

  async function abrirModal() {
    try {
      const d = await buscar('/compra/api/pedido/cabecalho?nrFornec=' + estado.nrFornec);
      if (!d) return;

      estado.cabecalho = d;
      const f = d.ficha;
      const falta = new Set(f.camposFaltando || []);

      el.etiqueta.className = 'etiqueta-origem ' + (d.temCadastroVigente ? 'vigente' : 'antigo');
      el.etiqueta.textContent = d.temCadastroVigente
        ? 'cadastro vigente'
        : 'cadastro antigo — fornecedor ainda não transferido';

      preencherLeitura('cab-razao',      f.razao,      falta.has('razao'));
      preencherLeitura('cab-cnpj',       f.cnpj,       falta.has('cnpj'));
      preencherLeitura('cab-logradouro', f.logradouro, falta.has('logradouro'));
      preencherLeitura('cab-bairro',     f.bairro,     false);
      preencherLeitura('cab-cidade',     f.cidade,     falta.has('cidade'));
      preencherLeitura('cab-uf',         f.uf,         falta.has('uf'));
      preencherLeitura('cab-contato',    f.contatoVendas, false);
      preencherLeitura('cab-fone',       f.foneVendas, falta.has('foneVendas'));

      el.transportadora.innerHTML =
        '<option value="">— nenhuma —</option>' +
        (d.transportadoras || []).map(t =>
          '<option value="' + t._id + '">' + escapar(t.razao)
          + (t.cidade ? '  (' + escapar(t.cidade) + ')' : '') + '</option>').join('');

      const cond = [...new Set([...(d.condicoesUsadas || []), ...(d.sugestoesPagamento || [])])];
      el.listaCond.innerHTML = cond.map(c => '<option value="' + escapar(c) + '">').join('');

      el.entrega.value = paraISO(new Date(Date.now() + 30 * DIA));
      el.condicao.value = d.condicoesUsadas?.[0] || '';
      el.representante.value = '';

      aplicarFrete();
      recalcularTitulos();

      el.resumoItens.textContent = itensDoPedido().length + ' itens';
      el.resumoTotal.textContent = moeda(totalDoPedido());

            // fornecedor sem cadastro vigente nao pode gerar pedido:
      // o pedido ficaria orfao e o historico de compras sairia partido
      el.confirmar.disabled = !d.temCadastroVigente;
      el.confirmar.textContent = d.temCadastroVigente
        ? 'Confirmar pedido'
        : 'Fornecedor não transferido';
      el.confirmar.title = d.temCadastroVigente
        ? ''
        : 'Conclua o de/para deste fornecedor antes de emitir pedido.';

      el.fundo.classList.add('aberto');
      el.entrega.focus();

    } catch (e) {
      alert('Erro ao montar o cabeçalho: ' + e.message);
      console.error('[cabecalho]', e);
    }
  }

  function fecharModal() {
    if (estado.gravando) return;
    el.fundo.classList.remove('aberto');
  }

  function freteEscolhido() {
    const r = document.querySelector('input[name="frete"]:checked');
    return r ? r.value : 'CIF';
  }

  // CIF: o fabricante contrata o frete, transportadora nao e escolha nossa
  function aplicarFrete() {
    const fob = freteEscolhido() === 'FOB';
    el.boxTransp.style.display = fob ? '' : 'none';
    if (!fob) el.transportadora.value = '';
  }

  function diasDaCondicao(texto) {
    const nums = String(texto || '').match(/\d+/g);
    return nums ? nums.map(Number).filter(n => n > 0) : [];
  }

  function recalcularTitulos(manterDias) {
    const total = totalDoPedido();
    const base = el.entrega.value ? new Date(el.entrega.value + 'T00:00:00Z') : null;

    let dias;
    if (manterDias) {
      dias = estado.titulos.map(t => t.dias);
    } else {
      dias = diasDaCondicao(el.condicao.value);
      if (dias.length) {
        el.nTitulos.value = dias.length;
      } else {
        const n = Math.max(1, Math.min(12, Number(el.nTitulos.value) || 1));
        dias = Array.from({ length: n }, (_, i) => (i + 1) * 30);
      }
    }

    const n = dias.length;
    const porTitulo = Math.floor(total / n);
    const resto = total - porTitulo * n;

    estado.titulos = dias.map((d, i) => ({
      dias: d,
      vencimento: base ? new Date(base.getTime() + d * DIA) : null,
      valor: porTitulo + (i === n - 1 ? resto : 0),
    }));

    desenharTitulos();
  }

  function atualizarSoma() {
    const soma = estado.titulos.reduce((s, t) => s + t.valor, 0);
    const total = totalDoPedido();
    const ok = soma === total;
    el.soma.className = 'soma-titulos ' + (ok ? 'confere' : 'difere');
    el.soma.textContent = ok
      ? 'Soma dos títulos: ' + moeda(soma) + '  ✓'
      : 'Soma dos títulos: ' + moeda(soma) + '   ·   pedido: ' + moeda(total)
        + '   ·   diferença: ' + moeda(total - soma);
  }

  function desenharTitulos() {
    el.tabTitulos.innerHTML = estado.titulos.map((t, i) => ''
      + '<tr>'
      +   '<td>' + (i + 1) + '</td>'
      +   '<td><input type="number" min="0" class="dias" data-i="' + i + '" value="' + t.dias + '"></td>'
      +   '<td>' + (t.vencimento ? dia(t.vencimento) : '—') + '</td>'
      +   '<td class="num"><input type="text" class="valor-titulo" data-i="' + i
      +     '" value="' + moeda(t.valor) + '"></td>'
      + '</tr>').join('');

    atualizarSoma();
  }

  function lerCentavos(txt) {
    const limpo = String(txt || '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  }

  // ---- eventos da tela ------------------------------------------------------
  el.fornecedor.addEventListener('change', () => {
    estado.nrFornec = el.fornecedor.value || null;
    estado.aba = 'pedido';
    estado.filtro = '';
    el.filtro.value = '';
    trocarAba();
    carregarGrade();
  });

  el.janelas.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-janela]');
    if (!b) return;
    estado.janela = Number(b.dataset.janela);
    el.janelas.querySelectorAll('button').forEach(x => x.classList.remove('ativo'));
    b.classList.add('ativo');
    carregarGrade();
  });

  function trocarAba() {
    el.abaPedido.classList.toggle('ativo', estado.aba === 'pedido');
    el.abaZero.classList.toggle('ativo', estado.aba === 'zero');
    el.buscaZero.classList.toggle('visivel', estado.aba === 'zero');
  }

  el.abaPedido.addEventListener('click', () => { estado.aba = 'pedido'; trocarAba(); desenhar(); });
  el.abaZero.addEventListener('click', () => {
    estado.aba = 'zero'; trocarAba(); desenhar(); el.filtro.focus();
  });

  el.filtro.addEventListener('input', () => {
    estado.filtro = el.filtro.value.trim();
    desenhar();
  });

  el.grade.addEventListener('input', ev => {
    const campo = ev.target.closest('input.qtd');
    if (!campo) return;

    const codigo = Number(campo.dataset.codigo);
    const item = estado.itens.find(i => i.codigo === codigo);
    if (!item) return;

    const q = Math.max(0, Math.floor(Number(campo.value) || 0));
    estado.pedido.set(codigo, q);

    const tr = campo.closest('tr');
    tr.classList.toggle('tem-pedido', q > 0);
    tr.lastElementChild.textContent = q ? moeda(q * item.custoUnitario) : '';
    campo.classList.toggle('alterado', q !== item.sugestao);

    const comPedido = estado.itens.filter(i => (estado.pedido.get(i.codigo) || 0) > 0).length;
    el.qtdPedido.textContent = comPedido;
    el.qtdZero.textContent = estado.itens.length - comPedido;

    atualizarRodape();
  });

  // ---- modal do produto (duplo clique no PEDIDO) ------------------------------
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mp = {
    fundo: $('fundo-produto'), titulo: $('mp-titulo'), sub: $('mp-sub'),
    estoque: $('mp-estoque'), caminho: $('mp-caminho'), caminhoDet: $('mp-caminho-det'),
    meses: $('mp-meses'), notas: $('mp-notas'), qtd: $('mp-qtd'), aviso: $('mp-aviso'),
    caixa: $('fundo-produto').querySelector('.modal'),
    topo: $('fundo-produto').querySelector('.modal-topo'),
    estoque0: 0, caminho0: 0, consumoMax: null,
    btnAjuda: $('mp-btn-ajuda'), ajuda: $('mp-ajuda'), duvidas: $('mp-duvidas'),
    fechar: $('mp-fechar'), cancelar: $('mp-cancelar'), aplicar: $('mp-aplicar'),
    codigo: null,
  };
  const reais = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pecas = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const nomeMes = m => MESES[m.mes - 1] + '/' + String(m.ano).slice(2);

  async function abrirProduto(codigo) {
    const item = estado.itens.find(i => i.codigo === codigo);
    if (!item) return;
    mp.codigo = codigo;
    mp.titulo.textContent = item.descricao || ('Produto ' + codigo);
    mp.sub.textContent = 'cód ' + codigo + (item.referencia ? ' · ' + item.referencia : '');
    mp.estoque.textContent = pecas(item.estoque);
    mp.caminho.textContent = item.aCaminho ? pecas(item.aCaminho) : '0';
    mp.caminhoDet.textContent = '';
    mp.meses.innerHTML = '';
    mp.notas.innerHTML = '<tr><td colspan="7">Carregando…</td></tr>';
    mp.qtd.value = estado.pedido.get(codigo) || 0;
    mp.estoque0 = Number(item.estoque) || 0;
    mp.caminho0 = Number(item.aCaminho) || 0;
    mp.consumoMax = null;
    conferirMaximo();
    mp.caixa.style.transform = '';              // abre sempre no centro
    mp.ajuda.hidden = true;
    mp.btnAjuda.hidden = true;
    mp.duvidas.innerHTML = '';
    mp.fundo.classList.add('aberto');
    setTimeout(() => { mp.qtd.focus(); mp.qtd.select(); }, 30);

    try {
      const d = await buscar('/compra/api/produto/resumo/' + codigo);
      if (!d || mp.codigo !== codigo) return;

      mp.caminhoDet.textContent = d.aCaminho.map(p => 'ped. ' + p.numero).join(', ');
      if (d.aCaminho.length) {                 // o resumo e mais fresco que a grade
        mp.caminho0 = d.aCaminho.reduce((s, p) => s + p.saldo, 0);
        mp.caminho.textContent = pecas(mp.caminho0);
      }

      const fechados = d.consumo.filter(m => m.qte !== null && !m.parcial);
      let max = null, min = null;
      for (const m of fechados) {
        if (!max || m.qte > max.qte) max = m;
        if (!min || m.qte < min.qte) min = m;
      }
      mp.consumoMax = max ? max.qte : null;
      conferirMaximo();

      const destaca = max && min && max.qte !== min.qte;
      mp.meses.innerHTML = d.consumo.map(m => {
        const cls = ['mp-mes'];
        if (m.qte === null) cls.push('desconhecido');
        if (m.parcial) cls.push('parcial');
        if (destaca && m === max) cls.push('max');
        if (destaca && m === min) cls.push('min');
        return '<div class="' + cls.join(' ') + '"><div class="m">' + nomeMes(m) + (m.parcial ? ' *' : '')
          + '</div><div class="q">' + (m.qte === null ? '–' : pecas(m.qte)) + '</div></div>';
      }).join('');

      // ajuda: so existe quando o fornecedor do produto tem nota do ano sem itens
      const dv = d.duvidas || [];
      if (dv.length) {
        mp.btnAjuda.textContent = '? Ajuda · ' + dv.length + (dv.length === 1 ? ' nota' : ' notas') + ' sem itens';
        mp.btnAjuda.hidden = false;
        mp.duvidas.innerHTML = '<table><thead><tr><th>Nota</th><th>Emissão</th><th>Valor da nota</th>'
          + '</tr></thead><tbody>'
          + dv.map(x => '<tr><td>' + escapar(x.nota) + '</td><td>' + (x.emissao ? dia(x.emissao) : '—')
            + '</td><td>' + reais(x.valor) + '</td></tr>').join('')
          + '</tbody></table>';
      }

      mp.notas.innerHTML = d.notas.length
        ? d.notas.map(n => '<tr>'
            + '<td>' + escapar(n.nota) + '</td>'
            + '<td>' + (n.emissao ? dia(n.emissao) : '—') + '</td>'
            + '<td>' + (n.entrada ? dia(n.entrada) : '—') + '</td>'
            + '<td class="num">' + pecas(n.qte) + '</td>'
            + '<td class="num">' + reais(n.unitario) + '</td>'
            + '<td class="num">' + pecas(n.ipiPerc) + '</td>'
            + '<td class="num">' + reais(n.unitarioComIpi) + '</td>'
            + '</tr>').join('')
        : '<tr><td colspan="7">Nenhuma nota de entrada deste produto.</td></tr>';
    } catch (e) {
      mp.notas.innerHTML = '<tr><td colspan="7">Erro: ' + escapar(e.message) + '</td></tr>';
    }
  }

  // Advertencia (nao bloqueia): estoque + a caminho + quantidade acima do
  // maior mes vendido.
  function conferirMaximo() {
    const q = Math.max(0, Math.floor(Number(mp.qtd.value) || 0));
    const total = mp.estoque0 + mp.caminho0 + q;
    if (mp.consumoMax !== null && q > 0 && total > mp.consumoMax) {
      mp.aviso.textContent = '⚠ estoque + a caminho + pedido = ' + pecas(total)
        + ', acima do consumo máximo de um mês (' + pecas(mp.consumoMax) + ')';
      mp.aviso.hidden = false;
    } else {
      mp.aviso.hidden = true;
    }
  }
  mp.qtd.addEventListener('input', conferirMaximo);

  // Arrastar pelo topo (o X continua fechando).
  let arrasto = null, acabouDeArrastar = false;
  mp.topo.addEventListener('mousedown', ev => {
    if (ev.target.closest('button')) return;
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(mp.caixa.style.transform || '');
    arrasto = { x: ev.clientX, y: ev.clientY, dx: m ? Number(m[1]) : 0, dy: m ? Number(m[2]) : 0 };
    ev.preventDefault();
  });
  document.addEventListener('mousemove', ev => {
    if (!arrasto) return;
    const dx = arrasto.dx + ev.clientX - arrasto.x;
    const dy = arrasto.dy + ev.clientY - arrasto.y;
    mp.caixa.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
  });
  document.addEventListener('mouseup', () => {
    // soltar o mouse fora da caixa gera um clique no fundo: nao pode fechar
    if (arrasto) { acabouDeArrastar = true; setTimeout(() => { acabouDeArrastar = false; }, 0); }
    arrasto = null;
  });

  function fecharProduto() {
    mp.fundo.classList.remove('aberto');
    mp.codigo = null;
  }

  // Aplicar: o valor vai para o campo PEDIDO da linha e segue o caminho normal
  // (o mesmo evento 'input' que a digitacao direta dispara).
  function aplicarProduto() {
    const codigo = mp.codigo;
    const q = Math.max(0, Math.floor(Number(mp.qtd.value) || 0));
    fecharProduto();
    const campo = el.grade.querySelector('input.qtd[data-codigo="' + codigo + '"]');
    if (campo) {
      campo.value = q;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      if (estado.aba === 'zero' && q > 0) desenhar();
    } else {
      estado.pedido.set(codigo, q);
      desenhar();
    }
  }

  el.grade.addEventListener('dblclick', ev => {
    const campo = ev.target.closest('input.qtd');
    if (campo) abrirProduto(Number(campo.dataset.codigo));
  });
  mp.fechar.addEventListener('click', fecharProduto);
  mp.btnAjuda.addEventListener('click', () => { mp.ajuda.hidden = !mp.ajuda.hidden; });
  mp.cancelar.addEventListener('click', fecharProduto);
  mp.aplicar.addEventListener('click', aplicarProduto);
  mp.fundo.addEventListener('click', ev => {
    if (ev.target === mp.fundo && !acabouDeArrastar) fecharProduto();
  });
  mp.qtd.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); aplicarProduto(); }
    if (ev.key === 'Escape') fecharProduto();
  });

  // Enter no campo PEDIDO tambem abre o modal (o campo e so leitura)
  el.grade.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    const campo = ev.target.closest('input.qtd');
    if (!campo) return;
    ev.preventDefault();
    abrirProduto(Number(campo.dataset.codigo));
  });

  // ---- eventos do modal -----------------------------------------------------
  el.btnGravar.addEventListener('click', abrirModal);
  el.fecharModal.addEventListener('click', fecharModal);
  el.cancelar.addEventListener('click', fecharModal);

  el.fundo.addEventListener('click', ev => {
    if (ev.target === el.fundo) fecharModal();
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && el.fundo.classList.contains('aberto')) fecharModal();
  });

  document.querySelectorAll('input[name="frete"]').forEach(r =>
    r.addEventListener('change', aplicarFrete));

  el.entrega.addEventListener('change', () => recalcularTitulos(true));
  el.condicao.addEventListener('input', () => recalcularTitulos(false));
  el.nTitulos.addEventListener('input', () => {
    el.condicao.value = '';
    recalcularTitulos(false);
  });

  el.tabTitulos.addEventListener('input', ev => {
    const campoDias = ev.target.closest('input.dias');
    if (campoDias) {
      const i = Number(campoDias.dataset.i);
      estado.titulos[i].dias = Math.max(0, Number(campoDias.value) || 0);
      const base = el.entrega.value ? new Date(el.entrega.value + 'T00:00:00Z') : null;
      estado.titulos[i].vencimento = base
        ? new Date(base.getTime() + estado.titulos[i].dias * DIA) : null;
      const tr = campoDias.closest('tr');
      tr.children[2].textContent = estado.titulos[i].vencimento
        ? dia(estado.titulos[i].vencimento) : '—';
      return;
    }

    const campoValor = ev.target.closest('input.valor-titulo');
    if (campoValor) {
      const i = Number(campoValor.dataset.i);
      estado.titulos[i].valor = lerCentavos(campoValor.value);
      atualizarSoma();
    }
  });

  // ---- gravar ---------------------------------------------------------------
  el.confirmar.addEventListener('click', async () => {
    if (estado.gravando) return;

    if (!el.entrega.value) {
      alert('Informe a data de entrega prevista.\n'
        + 'Os vencimentos são contados a partir dela.');
      el.entrega.focus();
      return;
    }

    const soma = estado.titulos.reduce((s, t) => s + t.valor, 0);
    if (soma !== totalDoPedido()) {
      alert('A soma dos títulos não fecha com o total do pedido.\n'
        + 'Ajuste os valores antes de confirmar.');
      return;
    }

    const corpo = {
      nrFornec: Number(estado.nrFornec),
      janela: estado.janela,
      representante: el.representante.value.trim(),
      frete: freteEscolhido(),
      transportadoraId: el.transportadora.value || null,
      dataEntregaPrevista: el.entrega.value,
      condicaoPagamento: { texto: el.condicao.value.trim() },
      titulos: estado.titulos.map(t => ({
        dias: t.dias,
        vencimento: t.vencimento ? paraISO(t.vencimento) : null,
        valor: t.valor,
      })),
      itens: itensDoPedido(),
    };

    estado.gravando = true;
    el.confirmar.disabled = true;
    el.confirmar.textContent = 'Gravando...';

    try {
      const r = await enviar('/compra/api/pedido/gravar', corpo);
      if (!r) return;

      alert('Pedido nº ' + r.numero + ' gravado.\n\n'
        + r.fornecedor + '\n'
        + r.itens + ' itens · ' + moeda(r.valorTotal) + '\n'
        + r.lancamentosFluxo + ' lançamento(s) no fluxo projetado\n'
        + 'primeiro vencimento ' + dia(r.primeiroVencimento));

      // confere na lista: o pedido novo tem de estar la
      window.location.href = '/compra/pedidos-pendentes';

    } catch (e) {
      alert('Não foi possível gravar:\n\n' + e.message);
      console.error('[gravar]', e);
      estado.gravando = false;
      el.confirmar.disabled = false;
      el.confirmar.textContent = 'Confirmar pedido';
    }
  });

  // ---- inicio ---------------------------------------------------------------
  carregarFornecedores();

})();