// =============================================================================
// Destino: C:\plataformaRota\public\js\compra\ficha-produto-campos.js
// Criado em: 01/10/2026
// Alterado em: 01/10/2026 - estoque so inteiro (nao existe quantidade fracionada)
// Alterado em: 01/10/2026 - DUAS taxas: taxaprazo <-> precoprazo e taxa (vista) <->
//              precovista; completar() preenche a taxa que falta ao abrir a ficha
// Alterado em: 14/10/2026 - CODIGO DE BARRAS (ean): so digitos; o leitor bipa e manda
//              Enter (a pagina passa ao proximo campo). eanProblema() confere 8-14
//              digitos e o digito verificador (GTIN, modulo 10)
//
// Regras dos campos da ficha de produto, usadas pelas DUAS fichas:
//   Novo produto (produto-cadastro.js) e pagina do produto (produto.js).
//
//   estoque  (qte, qte_negativa, qte_reservada, e_min, e_max): so numeros INTEIROS
//   precos   (precocusto, precovista, precoprazo): so moeda, formata 2.638,19
//   taxas    % sobre o CUSTO, uma por preco:
//              taxaprazo -> precoprazo      taxa (a do Access) -> precovista
//              - digitou a taxa e o preco dela esta vazio -> calcula o preco
//                (custo x (1 + taxa/100))
//              - digitou o preco e a taxa dele esta vazia -> calcula a taxa
//   ean      codigo de barras: so digitos, 8 a 14
//
// Carregar ANTES do JS da pagina:
//   <script src="/js/compra/ficha-produto-campos.js"></script>
// =============================================================================

'use strict';

window.FichaProduto = (function () {

  const ESTOQUE = ['qte', 'qte_negativa', 'qte_reservada', 'e_min', 'e_max'];
  const MOEDA = ['precocusto', 'precovista', 'precoprazo'];
  const PARES = { taxaprazo: 'precoprazo', taxa: 'precovista' };   // taxa -> preco

  function tipo(id) {
    if (ESTOQUE.includes(id)) return 'num';
    if (MOEDA.includes(id)) return 'moeda';
    if (id in PARES) return 'taxa';
    if (id === 'ean') return 'ean';
    return null;
  }

  // "2.638,19" -> 2638.19 ; vazio -> null
  function numero(texto) {
    const s = String(texto ?? '').trim().replace(/\./g, '').replace(',', '.');
    if (s === '') return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }

  const fmt = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // valor do banco -> texto do campo
  function exibir(id, v) {
    if (v === undefined || v === null || v === '') return '';
    const t = tipo(id);
    if (t === 'moeda' || t === 'taxa') return Number.isFinite(Number(v)) ? fmt(Number(v)) : '';
    if (t === 'num') return String(Math.trunc(Number(v) || 0));
    return v;
  }

  // texto do campo -> o que vai para a API ("2638.19"; a API faz parseFloat)
  function paraApi(id, texto) {
    const t = tipo(id);
    if (!t) return texto;
    if (t === 'ean') return String(texto ?? '').replace(/\D/g, '');
    const n = numero(texto);
    if (n === null) return '';
    return String(t === 'num' ? Math.trunc(n) : n);
  }

  // codigo de barras: '' = ok (ou vazio); 'tamanho' = nao tem 8 a 14 digitos;
  // 'digito' = o ultimo digito nao confere (erro de digitacao; o leitor ja confere)
  function eanProblema(texto) {
    const s = String(texto ?? '').replace(/\D/g, '');
    if (s === '') return '';
    if (s.length < 8 || s.length > 14) return 'tamanho';
    if (![8, 12, 13, 14].includes(s.length)) return '';      // codigo interno: so o tamanho
    const d = s.split('').map(Number);
    const dv = d.pop();
    let soma = 0;
    d.reverse().forEach((n, i) => { soma += n * (i % 2 === 0 ? 3 : 1); });
    return (10 - (soma % 10)) % 10 === dv ? '' : 'digito';
  }

  // um par taxa/preco: o que estiver vazio sai do outro
  function parear(idTaxa, custo, campo, origem) {
    const idPreco = PARES[idTaxa];
    const cT = campo(idTaxa), cP = campo(idPreco);
    if (!cT || !cP) return;
    const taxa = numero(cT.value), preco = numero(cP.value);
    if (taxa !== null && preco === null && origem !== idPreco) cP.value = fmt(custo * (1 + taxa / 100));
    else if (preco !== null && taxa === null && origem !== idTaxa) cT.value = fmt((preco / custo - 1) * 100);
  }

  function calcular(id, campo) {
    const custo = numero(campo('precocusto')?.value);
    if (!custo) return;
    for (const idTaxa of Object.keys(PARES)) {
      if (id === 'precocusto' || id === idTaxa || id === PARES[idTaxa]) parear(idTaxa, custo, campo, id);
    }
  }

  // ao abrir a ficha: preenche a taxa que falta a partir do preco (e vice-versa)
  function completar(campo) {
    const custo = numero(campo('precocusto')?.value);
    if (!custo) return;
    for (const idTaxa of Object.keys(PARES)) parear(idTaxa, custo, campo, null);
  }

  // liga as regras num container de ficha; campo(id) devolve o <input>
  function ligar(raiz, campo) {
    raiz.addEventListener('input', ev => {
      const el = ev.target;
      if (el.tagName !== 'INPUT' || el.readOnly) return;
      const t = tipo(el.id.replace(/^f_/, ''));
      if (!t) return;
      // estoque e codigo de barras: so digitos; precos/taxa: digitos, ponto e virgula
      const limpo = el.value.replace(t === 'num' || t === 'ean' ? /\D/g : /[^\d.,]/g, '');
      if (limpo !== el.value) el.value = limpo;
    });

    raiz.addEventListener('focusout', ev => {
      const el = ev.target;
      if (el.tagName !== 'INPUT' || el.readOnly) return;
      const id = el.id.replace(/^f_/, '');
      const t = tipo(id);
      if (!t) return;
      if (t === 'ean') {                       // vermelho se o codigo nao fecha
        const ruim = eanProblema(el.value) !== '';
        el.style.borderColor = ruim ? '#dc2626' : '';
        el.style.background = ruim ? '#fef2f2' : '';
        el.title = ruim ? 'código de barras: confira (8 a 14 dígitos, último dígito)' : '';
        return;
      }
      if (t !== 'num' && el.value.trim() !== '') {
        const n = numero(el.value);
        el.value = n === null ? '' : fmt(n);
      }
      calcular(id, campo);
    });
  }

  return { tipo, numero, exibir, paraApi, ligar, completar, eanProblema };
})();
