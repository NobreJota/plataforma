// /public/js/rotinas/produto-VinculoModal.js
(() => {
  // cubra as duas possibilidades de id
  ['modalVinculo', 'modalProdutoVinculo'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('hidden.bs.modal', () => window.limparMenuAcoes?.());
  });
})();
