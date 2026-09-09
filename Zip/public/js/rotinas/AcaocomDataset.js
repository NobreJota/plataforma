// /public/js/rotinas/AcaoComDataset.js
(() => {
  window.executarAcaoComDataset = function(sel){
    window.setLastActionSelect?.(sel);

    const acao = (sel.value || '').trim();
    const id   = sel.dataset.id;
    const desc = sel.dataset.descricao || '';
    const forn = sel.dataset.fornecedor || '';
    const dept = sel.dataset.departamento || '';

    if (acao === 'imagens' && typeof window.abrirModalImagem === 'function') {
      window.abrirModalImagem({ produtoId: id, descricao: desc, fornecedor: forn, departamento: dept });
      return;
    }
    if (typeof window.executarAcao === 'function') {
      window.executarAcao(acao, id, desc, forn, dept);
    }
  };
})();
