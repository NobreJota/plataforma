// public/js/home.js
document.addEventListener('DOMContentLoaded', () => {
  const form  = document.getElementById('homeSearchForm');
  const input = document.getElementById('homeSearchInput');

  if (form && input) {
    form.addEventListener('submit', (e) => {
      const q = (input.value || '').trim();
      if (!q) {
        e.preventDefault();
        alert('Digite um termo para buscar.');
        input.focus();
      } else {
        input.classList.add('bg-success-subtle');
        setTimeout(() => input.classList.remove('bg-success-subtle'), 1200);
      }
    });
  }

  // chips de segmento
  document.querySelectorAll('.chip[data-id]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const hidden = document.getElementById('segmentoHidden');
      if (hidden) hidden.value = chip.dataset.id || '';
      const filtroForm = document.getElementById('filtroForm');
      if (filtroForm) filtroForm.submit();
    });
  });
});

function adicionarCarrinho(id) {
  fetch(`/carrinho/add/${id}`, { method: 'POST' })
    .then(r => r.ok ? r.json() : Promise.reject(r))
    .then(() => alert('Produto adicionado ao carrinho!'))
    .catch(() => alert('Não foi possível adicionar ao carrinho agora.'));
}

// auto-submit ao mudar cidade/loja
const filtroForm = document.getElementById('filtroForm');
['selectCidade','selectLoja'].forEach(id => {
  const el = document.getElementById(id);
  if (el && filtroForm) el.addEventListener('change', () => filtroForm.submit());
});
