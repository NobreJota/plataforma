// /public/js/rotinas/produto-ImageModal.js
(() => {
  const el = document.getElementById('modalImagem');
  if (!el) return;

  const reset = () => window.limparMenuAcoes?.();

  // clique no backdrop do seu overlay custom
  el.addEventListener('click', (e)=>{ if (e.target === el) reset(); });

  // botões de fechar do modalImagem
  el.querySelectorAll('#miClose,.btn-close,[data-mi-close]')
    .forEach(b => b.addEventListener('click', reset));

  // ESC se estiver visível
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && el.classList.contains('show')) reset();
  });

  // se já existir __fecharModal(), apenas envelopa
  if (typeof window.__fecharModal === 'function'){
    const orig = window.__fecharModal;
    window.__fecharModal = function(...args){
      try { return orig.apply(this, args); }
      finally { reset(); }
    };
  }
})();
