(() => {
  let __delId = null;

  // abrir
  window.openDeleteModal = (id, descricao='') => {
    __delId = id;
    document.getElementById('delId').textContent = id;
    document.getElementById('delDesc').textContent = descricao;
    const m = document.getElementById('deleteModal');
    if (m) m.style.display = 'flex';
  };

  // fechar
  window.closeDeleteModal = () => {
    const m = document.getElementById('deleteModal');
    if (m) m.style.display = 'none';
    __delId = null;
    window.limparMenuAcoes?.();
  };

  // confirmar
  document.getElementById('btnConfirmDelete')?.addEventListener('click', async () => {
    const id = __delId;
    if (!id) return closeDeleteModal();

    try {
      // AJUSTE A ROTA AQUI se precisar:
      console.log(' [ 28 ] /js/rotinas/produto-Delete-Modal')
      const r = await fetch(`/lojista/produto-delete/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Falha no DELETE');

      // some a linha da tabela
      document.querySelector(`tr[data-id='${id}']`)?.remove();
      alert('Produto deletado com X-sucesso.');
    } catch (e) {
      console.error(e);
      alert('Não foi possível deletar o produto.');
    } finally {
      closeDeleteModal();
    }
  });

  // fechar clicando fora
  document.getElementById('deleteModal')?.addEventListener('click', (ev) => {
    if (ev.target.id === 'deleteModal') closeDeleteModal();
  });

  // ESC
  window.addEventListener('keydown', (e) => {
    const m = document.getElementById('deleteModal');
    if (e.key === 'Escape' && m && m.style.display !== 'none') closeDeleteModal();
  });
})();
