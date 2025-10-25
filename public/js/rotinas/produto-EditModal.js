// /public/js/rotinas/produto-editModal.js
(() => {
  const em = document.getElementById('editModal');
  if (!em) return;

  const reset = () => window.limparMenuAcoes?.();

  // clique no backdrop
  em.addEventListener('click', (e)=>{ if (e.target === em) reset(); });

  // botões de fechar (se houver)
  em.querySelectorAll('.btn-close,[data-bs-dismiss="modal"],[data-dismiss="modal"]')
    .forEach(b => b.addEventListener('click', reset));

  // ESC quando visível
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && getComputedStyle(em).display !== 'none') reset();
  });

  // se existir closeEditModal(), envelopa
  if (typeof window.closeEditModal === 'function'){
    const orig = window.closeEditModal;
    window.closeEditModal = function(...args){
      try { return orig.apply(this, args); }
      finally { reset(); }
    };
  }
})();
