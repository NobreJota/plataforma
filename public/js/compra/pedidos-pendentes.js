// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\pedidos-pendentes.js
// Criado em: 27/09/2026
// Alterado em: 03/10/2026 - texto do fornecedor sem cadastro: "cadastro incompleto ·
//              completar em Fornecedores" (o de/para nao existe mais)
// Alterado em: 03/10/2026 - DUPLO CLIQUE na linha abre o ESPELHO DO PEDIDO num modal
//              (arrasta pelo topo; Esc ou × fecha). Estilos do modal injetados aqui,
//              sem tocar no handlebars. API: /compra/api/pedido/detalhe/:id
// Alterado em: 03/10/2026 - botao "alterar" na entrega prevista (pedido pendente): nova
//              data, Gravar (ou Enter); as parcelas no fluxo acompanham. Cabecalho das
//              tabelas do modal legivel (fundo claro).
//
// PEDIDO PENDENTE: o que foi comprado e ainda nao chegou.
//
// Inclui os importados do Access. Quando o fornecedor esta com cadastro
// incompleto, o nome vem em VERMELHO — a tela mostra o que falta completar
// em Fornecedores, vista pelo lado de quem espera mercadoria.
//
// API: /compra/api/pedido/pendentes
// =============================================================================

'use strict';

(function () {

  const estado = {
    pedidos: [],
    busca: '',
    soSemCadastro: false,
    soAtrasados: false,
  };

  const $ = id => document.getElementById(id);

  const el = {
    resumo:        $('resumo'),
    busca:         $('busca'),
    soSemCadastro: $('soSemCadastro'),
    soAtrasados:   $('soAtrasados'),
    lista:         $('lista'),
  };

  // ---- formatacao -----------------------------------------------------------
  const moeda = c => (Number(c || 0) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  const dia = iso => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return String(d.getUTCDate()).padStart(2, '0') + '/'
         + String(d.getUTCMonth() + 1).padStart(2, '0') + '/'
         + String(d.getUTCFullYear()).slice(2);
  };

  // quantos dias faltam (ou passaram) para a entrega prevista
  function prazo(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const n = Math.round((d - hoje) / 86400000);
    if (n === 0) return 'hoje';
    if (n > 0) return 'em ' + n + ' dia' + (n === 1 ? '' : 's');
    return Math.abs(n) + ' dia' + (n === -1 ? '' : 's') + ' de atraso';
  }

  const escapar = s => String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const semAcento = v => String(v || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // ---- rede -----------------------------------------------------------------
  async function carregar() {
    el.lista.innerHTML = '<div class="vazio">Carregando…</div>';

    try {
      const r = await fetch('/compra/api/pedido/pendentes',
        { credentials: 'same-origin' });

      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }

      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');

      estado.pedidos = d.pedidos || [];
      desenharResumo();
      desenharLista();

    } catch (e) {
      el.lista.innerHTML = '<div class="vazio">Erro: ' + escapar(e.message) + '</div>';
      console.error('[pendentes]', e);
    }
  }

  // ---- resumo ---------------------------------------------------------------
  function desenharResumo() {
    const p = estado.pedidos;
    const soma = a => a.reduce((s, x) => s + (x.valorTotal || 0), 0);

    const atrasados   = p.filter(x => x.atrasado);
    const semCadastro = p.filter(x => x.semCadastro);
    const comNota     = p.filter(x => x.nota);

    const caixa = (classe, rotulo, lista) =>
      '<div class="caixa ' + classe + '">'
      + '<div class="r">' + rotulo + '</div>'
      + '<div class="n">' + lista.length + '</div>'
      + '<div class="v">' + moeda(soma(lista)) + '</div>'
      + '</div>';

    el.resumo.innerHTML =
        caixa('total',    'Pendentes',        p)
      + caixa('atrasado', 'Entrega vencida',  atrasados)
      + caixa('semcad',   'Sem cadastro',     semCadastro)
      + caixa('comnota',  'Com nota chegada', comNota);
  }

  // ---- lista ----------------------------------------------------------------
  function filtrados() {
    const b = semAcento(estado.busca);
    return estado.pedidos.filter(p =>
      (!estado.soSemCadastro || p.semCadastro) &&
      (!estado.soAtrasados   || p.atrasado) &&
      (!b || semAcento(p.fornecedor).includes(b) || String(p.numero).includes(b))
    );
  }

  function desenharLista() {
    const lista = filtrados();

    if (!lista.length) {
      el.lista.innerHTML = estado.pedidos.length
        ? '<div class="vazio"><strong>Nada neste filtro</strong>'
          + 'Solte a busca ou desmarque as caixas.</div>'
        : '<div class="vazio"><strong>Nenhum pedido pendente</strong>'
          + 'Tudo que foi comprado já chegou.</div>';
      return;
    }

    el.lista.innerHTML = '<table><thead><tr>'
      + '<th style="width:110px">Pedido</th>'
      + '<th>Fornecedor</th>'
      + '<th style="width:150px">Entrega prevista</th>'
      + '<th style="width:130px">Pagamento</th>'
      + '<th class="n" style="width:90px">Itens</th>'
      + '<th class="n" style="width:130px">Valor</th>'
      + '</tr></thead><tbody>'
      + lista.map(linha).join('')
      + '</tbody></table>';
  }

  function linha(p) {
    const marcas = []
      .concat(p.importado ? ['<span class="etq antigo">antigo</span>'] : [])
      .concat(p.nota ? ['<span class="etq nota">NF ' + escapar(p.nota.numero)
                        + '</span>'] : []);

    return '<tr data-id="' + escapar(p._id) + '" title="duplo clique: espelho do pedido">'
      + '<td class="num">nº ' + p.numero
      +   '<small>' + dia(p.dataEmissao) + '</small></td>'

      + '<td><div class="fornec' + (p.semCadastro ? ' sem' : '') + '">'
      +   escapar(p.fornecedor)
      +   (p.semCadastro
            ? '<small>cadastro incompleto · completar em Fornecedores'
              + (p.nrFornecOrigem ? '  ·  NrFornec ' + p.nrFornecOrigem : '')
              + '</small>'
            : '')
      + '</div>'
      + (marcas.length ? '<div style="margin-top:4px">' + marcas.join(' ') + '</div>' : '')
      + '</td>'

      + '<td><div class="entrega' + (p.atrasado ? ' atrasada' : '') + '">'
      +   dia(p.dataEntregaPrevista)
      +   '<small>' + prazo(p.dataEntregaPrevista) + '</small>'
      + '</div></td>'

      + '<td>' + escapar(p.condicao) + '</td>'

      + '<td class="n">' + p.itens
      +   (p.atendidos ? '<small>' + p.atendidos + ' já veio</small>' : '')
      + '</td>'

      + '<td class="n">' + moeda(p.valorTotal) + '</td>'
      + '</tr>';
  }

  // ---- eventos --------------------------------------------------------------
  let espera = null;
  el.busca.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      estado.busca = el.busca.value.trim();
      desenharLista();
    }, 200);
  });

  el.soSemCadastro.addEventListener('change', () => {
    estado.soSemCadastro = el.soSemCadastro.checked;
    desenharLista();
  });

  el.soAtrasados.addEventListener('change', () => {
    estado.soAtrasados = el.soAtrasados.checked;
    desenharLista();
  });

  // ---- espelho do pedido (modal) ----------------------------------------------
  // duplo clique na linha. O modal e criado aqui, com o proprio estilo.
  (function estiloEspelho() {
    const css = `
      #lista tbody tr[data-id] { cursor: pointer; }
      #esp-fundo { position: fixed; inset: 0; background: rgba(15,23,42,.35); z-index: 50; }
      #esp-fundo[hidden] { display: none; }
      #esp-caixa { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); z-index: 51;
        width: min(980px, calc(100vw - 32px)); max-height: calc(100vh - 90px); overflow: auto;
        background: #fff; border-radius: 10px; box-shadow: 0 18px 50px rgba(0,0,0,.25);
        font-size: 14px; color: #111827; }
      #esp-caixa[hidden] { display: none; }
      #esp-topo { display: flex; justify-content: space-between; align-items: center; gap: 12px;
        padding: 12px 16px; background: #6b21a8; color: #fff; cursor: move; user-select: none;
        border-radius: 10px 10px 0 0; position: sticky; top: 0; }
      #esp-topo h3 { margin: 0; font-size: 16px; }
      #esp-fechar { border: 0; background: none; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; }
      #esp-corpo { padding: 14px 16px 18px; }
      .esp-grade { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px 16px; margin-bottom: 14px; }
      .esp-grade div span { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #374151; }
      .esp-grade .largo { grid-column: span 2; }
      .esp-sem { color: #dc2626; }
      #esp-corpo h4 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: #6b21a8; }
      #esp-corpo table { width: 100%; border-collapse: collapse; }
      #esp-corpo th { text-align: left; font-size: 11px; text-transform: uppercase; color: #374151;
        background: #f3f4f6; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; }
      .esp-btn { border: 1px solid #d1d5db; background: #fff; color: #6b21a8; border-radius: 6px;
        padding: 2px 8px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 6px; }
      .esp-btn.gravar { background: #059669; border-color: #059669; color: #fff; }
      #esp-alt-box { margin-top: 6px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      #esp-alt-box[hidden] { display: none; }
      #esp-alt-data { height: 28px; border: 1px solid #d1d5db; border-radius: 6px; padding: 0 6px; }
      #esp-alt-msg { font-size: 12px; }
      #esp-alt-msg.erro { color: #dc2626; } #esp-alt-msg.ok { color: #059669; }
      #esp-corpo td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
      #esp-corpo tbody tr:nth-child(even) td { background: #f9fafb; }
      #esp-corpo .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      #esp-corpo tfoot td { font-weight: 700; border-top: 1px solid #e5e7eb; border-bottom: 0; }
      .esp-vazio { color: #6b7280; padding: 8px 0; }
    `;
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    const fundo = document.createElement('div');
    fundo.id = 'esp-fundo'; fundo.hidden = true;
    const caixa = document.createElement('div');
    caixa.id = 'esp-caixa'; caixa.hidden = true;
    caixa.innerHTML = '<div id="esp-topo"><h3 id="esp-titulo">Pedido</h3>'
      + '<button type="button" id="esp-fechar" title="fechar (Esc)">×</button></div>'
      + '<div id="esp-corpo"></div>';
    document.body.appendChild(fundo);
    document.body.appendChild(caixa);
  })();

  const esp = {
    fundo: $('esp-fundo'), caixa: $('esp-caixa'), titulo: $('esp-titulo'),
    corpo: $('esp-corpo'), fechar: $('esp-fechar'), topo: $('esp-topo'),
  };

  const reais = v => Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

  function fecharEspelho() { esp.fundo.hidden = true; esp.caixa.hidden = true; }

  async function abrirEspelho(id) {
    esp.titulo.textContent = 'Pedido';
    esp.corpo.innerHTML = '<div class="esp-vazio">Carregando…</div>';
    esp.caixa.style.top = '60px'; esp.caixa.style.left = '50%'; esp.caixa.style.transform = 'translateX(-50%)';
    esp.fundo.hidden = false; esp.caixa.hidden = false;
    try {
      const r = await fetch('/compra/api/pedido/detalhe/' + encodeURIComponent(id), { credentials: 'same-origin' });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      desenharEspelho(d.pedido);
    } catch (e) {
      esp.corpo.innerHTML = '<div class="esp-vazio">Erro: ' + escapar(e.message) + '</div>';
    }
  }

  const isoDia = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  };

  let espAberto = null;     // _id do pedido no modal

  function desenharEspelho(p) {
    espAberto = p._id;
    esp.titulo.textContent = 'Pedido nº ' + p.numero + '  ·  ' + (p.fornecedor || '');

    const campo = (rotulo, valor, classe) =>
      '<div' + (classe ? ' class="' + classe + '"' : '') + '><span>' + rotulo + '</span>'
      + (valor || '—') + '</div>';

    const fornecedor = p.semCadastro
      ? '<b class="esp-sem">' + escapar(p.fornecedor) + '</b>'
        + (p.nrFornecOrigem ? ' <small class="esp-sem">NrFornec ' + p.nrFornecOrigem + '</small>' : '')
      : '<b>' + escapar(p.fornecedor) + '</b>' + (p.razao ? '<br><small>' + escapar(p.razao) + '</small>' : '');

    const cab = '<div class="esp-grade">'
      + campo('Fornecedor', fornecedor, 'largo')
      + campo('CNPJ', escapar(p.cnpj))
      + campo('Situação', p.situacao === 'P' ? 'pendente' : escapar(p.situacao))
      + campo('Emissão', dia(p.dataEmissao))
      + campo('Entrega prevista', dia(p.dataEntregaPrevista) + ' <small>' + prazo(p.dataEntregaPrevista) + '</small>'
          + (p.situacao === 'P'
              ? '<button type="button" class="esp-btn" id="esp-alt-btn">alterar</button>'
                + '<div id="esp-alt-box" hidden>'
                + '<input type="date" id="esp-alt-data" value="' + isoDia(p.dataEntregaPrevista) + '">'
                + '<button type="button" class="esp-btn gravar" id="esp-alt-gravar">Gravar</button>'
                + '<button type="button" class="esp-btn" id="esp-alt-cancelar">Cancelar</button>'
                + '<span id="esp-alt-msg"></span></div>'
              : ''))
      + campo('Pagamento', escapar(p.condicao))
      + campo('Nota fiscal', p.nota ? 'NF ' + escapar(p.nota.numero) : '')
      + campo('Representante', escapar(p.representante))
      + campo('Observação', escapar(p.observacao), 'largo')
      + '</div>';

    const itens = p.itens.length
      ? '<table><thead><tr><th>Código</th><th>Ref.</th><th>Descrição</th>'
        + '<th class="n">Qtd</th><th class="n">Já veio</th><th class="n">Custo</th><th class="n">Total</th></tr></thead><tbody>'
        + p.itens.map(i => '<tr><td>' + (i.codigo || '') + '</td><td>' + escapar(i.referencia) + '</td>'
          + '<td>' + escapar(i.descricao) + '</td><td class="n">' + i.quantidade + '</td>'
          + '<td class="n">' + (i.atendida || '') + '</td><td class="n">' + moeda(i.custoUnitario) + '</td>'
          + '<td class="n">' + moeda(i.total) + '</td></tr>').join('')
        + '</tbody><tfoot><tr><td colspan="6">Total do pedido</td><td class="n">' + moeda(p.valorTotal) + '</td></tr></tfoot></table>'
      : '<div class="esp-vazio">Pedido sem itens.</div>';

    const parcelas = p.parcelas.length
      ? '<table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Conta</th><th class="n">Valor</th></tr></thead><tbody>'
        + p.parcelas.map(x => '<tr><td>' + (x.parcela || '') + '/' + (x.totalParcelas || '') + '</td>'
          + '<td>' + dia(x.vencimento) + '</td><td>' + escapar(x.codigoConta) + '</td>'
          + '<td class="n">' + reais(x.valor) + '</td></tr>').join('')
        + '</tbody></table>'
      : '<div class="esp-vazio">Nenhuma parcela no fluxo' + (p.semCadastro ? ' (fornecedor sem conta).' : '.') + '</div>';

    esp.corpo.innerHTML = cab + '<h4>Itens</h4>' + itens + '<h4>Parcelas no fluxo</h4>' + parcelas;
  }

  async function gravarEntrega() {
    const data = $('esp-alt-data').value;
    const msg = $('esp-alt-msg');
    if (!data) { msg.className = 'erro'; msg.textContent = 'escolha a data'; return; }
    $('esp-alt-gravar').disabled = true;
    try {
      const r = await fetch('/compra/api/pedido/entrega/' + encodeURIComponent(espAberto), {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      if (r.status === 401) { window.location.href = '/usuariocontab/login'; return; }
      const d = await r.json();
      if (!d.ok) throw new Error(d.erro || 'falha na API');
      await abrirEspelho(espAberto);      // redesenha com as datas novas
      carregar();                          // e a lista por tras
    } catch (e) {
      msg.className = 'erro'; msg.textContent = e.message;
      $('esp-alt-gravar').disabled = false;
    }
  }

  esp.corpo.addEventListener('click', ev => {
    const id = ev.target.id;
    if (id === 'esp-alt-btn') {
      $('esp-alt-box').hidden = false;
      ev.target.hidden = true;
      $('esp-alt-data').focus();
    } else if (id === 'esp-alt-cancelar') {
      $('esp-alt-box').hidden = true;
      $('esp-alt-btn').hidden = false;
      $('esp-alt-msg').textContent = '';
    } else if (id === 'esp-alt-gravar') {
      gravarEntrega();
    }
  });
  esp.corpo.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.id === 'esp-alt-data') { ev.preventDefault(); gravarEntrega(); }
  });

  el.lista.addEventListener('dblclick', ev => {
    const tr = ev.target.closest('tr[data-id]');
    if (tr) abrirEspelho(tr.dataset.id);
  });
  esp.fechar.addEventListener('click', fecharEspelho);
  esp.fundo.addEventListener('click', fecharEspelho);
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !esp.caixa.hidden) fecharEspelho(); });

  // arrasta pelo topo
  (function arrastar() {
    let ini = null;
    esp.topo.addEventListener('mousedown', ev => {
      if (ev.target === esp.fechar) return;
      const r = esp.caixa.getBoundingClientRect();
      esp.caixa.style.transform = 'none';
      esp.caixa.style.left = r.left + 'px'; esp.caixa.style.top = r.top + 'px';
      ini = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      ev.preventDefault();
    });
    document.addEventListener('mousemove', ev => {
      if (!ini) return;
      esp.caixa.style.left = Math.max(0, ev.clientX - ini.x) + 'px';
      esp.caixa.style.top = Math.max(0, ev.clientY - ini.y) + 'px';
    });
    document.addEventListener('mouseup', () => { ini = null; });
  })();

  carregar();

})();
