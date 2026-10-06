// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\produtos-relacao.js
// Criado em: 30/09/2026
//
// RELAÇÃO DE PRODUTOS: escolhe o fornecedor (ou busca), lista o que está
// cadastrado em arquivo_docs. Só consulta.
// Alterado em: 30/09/2026 — duplo clique na linha abre a página do produto.
//
// API: /compra/api/produto/relacao-fornecedores  e  /compra/api/produto/relacao
// =============================================================================

'use strict';

(function () {

  const $ = id => document.getElementById(id);

  const el = {
    fornecedor: $('fornecedor'),
    busca:      $('busca'),
    comEstoque: $('comEstoque'),
    conta:      $('conta'),
    linhas:     $('linhas'),
    rodape:     $('rodape'),
    rodapeTexto:$('rodapeTexto'),
    rodapeQte:  $('rodapeQte'),
    rodapeValor:$('rodapeValor'),
  };

  const COLUNAS = 10;   // o mesmo numero do <thead>

  const escapar = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const moeda = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function buscar(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (r.status === 401) { window.location.href = '/usuariocontab/login'; return null; }
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'falha na API');
    return j;
  }

  function mensagem(titulo, texto) {
    el.linhas.innerHTML = '<tr><td colspan="' + COLUNAS + '"><div class="vazio"><strong>'
      + escapar(titulo) + '</strong>' + escapar(texto) + '</div></td></tr>';
    el.rodape.hidden = true;
    el.conta.textContent = '';
  }

  // ---- lista ----------------------------------------------------------------
  async function carregar() {
    const nr = el.fornecedor.value;
    const busca = el.busca.value.trim();

    if (!nr && !busca) {
      mensagem('Escolha um fornecedor', 'Ou busque por descrição, referência, marca ou código.');
      return;
    }

    mensagem('Carregando…', '');
    try {
      const q = new URLSearchParams();
      if (nr) q.set('nrFornec', nr);
      if (busca) q.set('busca', busca);
      if (el.comEstoque.checked) q.set('comEstoque', '1');

      const d = await buscar('/compra/api/produto/relacao?' + q);
      if (!d) return;

      if (!d.produtos.length) {
        mensagem('Nada aqui', 'Nenhum produto com esse filtro.');
        return;
      }

      const mostrarForn = !nr;   // na busca sem fornecedor, diz de quem e
      let qte = 0, valor = 0;

      el.linhas.innerHTML = d.produtos.map(p => {
        qte += p.qte;
        const vCusto = p.qte > 0 ? p.qte * p.custo : 0;
        valor += vCusto;
        return '<tr data-cod="' + p.codigo + '" title="duplo clique abre o produto"'
          + (p.ativo ? '' : ' class="inativo"') + '>'
          + '<td><code>' + p.codigo + '</code></td>'
          + '<td>' + escapar(p.descricao)
          +   (mostrarForn && p.fornecedor ? '<div class="forn">' + escapar(p.fornecedor) + '</div>' : '')
          + '</td>'
          + '<td>' + escapar(p.referencia) + '</td>'
          + '<td>' + escapar(p.marca) + '</td>'
          + '<td class="num' + (p.qte <= 0 ? ' zero' : '') + '">' + p.qte + '</td>'
          + '<td class="num">' + moeda(p.custo) + '</td>'
          + '<td class="num">' + moeda(p.vista) + '</td>'
          + '<td class="num">' + moeda(p.prazo) + '</td>'
          + '<td class="num">' + moeda(p.taxa) + '</td>'
          + '<td class="num">' + (vCusto ? moeda(vCusto) : '') + '</td>'
          + '</tr>';
      }).join('');

      el.conta.textContent = d.total + ' produto' + (d.total === 1 ? '' : 's');
      el.rodapeTexto.textContent = d.total + ' produto' + (d.total === 1 ? '' : 's');
      el.rodapeQte.textContent = qte;
      el.rodapeValor.textContent = 'R$ ' + moeda(valor);
      el.rodape.hidden = false;

    } catch (e) {
      mensagem('Erro', e.message);
    }
  }

  // ---- eventos --------------------------------------------------------------
  el.fornecedor.addEventListener('change', carregar);

  el.linhas.addEventListener('dblclick', ev => {
    const tr = ev.target.closest('tr[data-cod]');
    if (tr) window.location.href = '/compra/produto/' + tr.dataset.cod;
  });
  el.comEstoque.addEventListener('change', carregar);

  let espera = null;
  el.busca.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(carregar, 250);
  });

  // ---- inicio ---------------------------------------------------------------
  (async function () {
    try {
      const d = await buscar('/compra/api/produto/relacao-fornecedores');
      if (!d) return;
      const lista = d.fornecedores.filter(f => f.nrFornec);   // sem numero nao tem como filtrar
      const ativos = lista.filter(f => !f.inativo);
      const inativos = lista.filter(f => f.inativo);
      const opcao = f => '<option value="' + (f.nrFornec || '') + '">'
        + escapar(f.nome) + '</option>';
      el.fornecedor.innerHTML = '<option value="">— selecione —</option>'
        + ativos.map(opcao).join('')
        + (inativos.length
            ? '<optgroup label="Inativos no Access">' + inativos.map(opcao).join('') + '</optgroup>'
            : '');
    } catch (e) {
      el.fornecedor.innerHTML = '<option value="">erro ao carregar</option>';
      console.error('[relacao-fornecedores]', e);
    }
  })();

})();
