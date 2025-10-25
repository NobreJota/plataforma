// /public/js/rotinas/limpaSelect.js
(() => {
  // --------- estado ----------
  let _lastActionSelect = null;

  // --------- helpers ----------
  function resetSelect(sel) {
    if (!sel) return;
    try {
      sel.selectedIndex = 0;
      sel.value = '';
      sel.blur();
    } catch (_) {}
  }

  function limparMenuAcoes() {
    // 1) todos os selects do menu na tabela
    document
      .querySelectorAll('#produtoTable select.form-select, #produtoTable select.form-select-sm')
      .forEach(resetSelect);

    // 2) o último select lembrado
    resetSelect(_lastActionSelect);
    _lastActionSelect = null;
  }

  function setLastActionSelect(sel) {
    _lastActionSelect = sel || null;
  }

  // liga limpeza ao fechamento do modal informado
  function bindCloseReset(modalEl) {
    if (!modalEl || modalEl.__resetBound) return;
    modalEl.__resetBound = true;

    // Bootstrap: quando o modal termina de fechar
    if (typeof bootstrap !== 'undefined') {
      modalEl.addEventListener('hidden.bs.modal', limparMenuAcoes);
    }

    // clique no backdrop
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) limparMenuAcoes();
    });

    // botões de fechar
    modalEl
      .querySelectorAll('.btn-close, [data-bs-dismiss="modal"], #miClose')
      .forEach((btn) => btn.addEventListener('click', limparMenuAcoes));
  }

  function registerResetOnModal(idsOrNodes) {
    const list = Array.isArray(idsOrNodes) ? idsOrNodes : [idsOrNodes];
    list.forEach((it) => {
      const el = typeof it === 'string' ? document.getElementById(it) : it;
      if (el) bindCloseReset(el);
    });
  }

  // ESC: só limpa se houver algum .modal.show aberto
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.querySelector('.modal.show')) limparMenuAcoes();
  });

  // IDs padrão (ajuste se seus IDs forem outros)
  const DEFAULT_IDS = ['modalImagem', 'modalVinculo', 'modalProdutoVinculo', 'editModal', 'modalDelete'];

  document.addEventListener('DOMContentLoaded', () => registerResetOnModal(DEFAULT_IDS));

  // Se os modais forem inseridos depois no DOM, tentamos ligar novamente
  const mo = new MutationObserver(() => registerResetOnModal(DEFAULT_IDS));
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // --------- expõe globais ----------
  window.setLastActionSelect   = setLastActionSelect;
  window.limparMenuAcoes       = limparMenuAcoes;
  window.registerResetOnModal  = registerResetOnModal;
})();
