/* Destino: C:\plataformaRota\public\js\comum\navegacao.js
 * Criado em: 10/10/2026
 *
 * Dois botoes fixos no canto superior direito de qualquer tela em tela inteira:
 *   ← Voltar  volta para a pagina anterior (sem historico: vai para o menu)
 *   ☰ Menu    vai para o menu principal (/usuariocontab/menu)
 * Basta incluir no fim da pagina:
 *   <script src="/js/comum/navegacao.js"></script>
 * Atalho: Alt+← tambem volta (padrao do navegador).
 * Alterado em: 10/10/2026 - nao aparece em tela embutida (iframe ou ?embed=1)
 */
(() => {
  'use strict';
  if (document.getElementById('nav-comum')) return;          // incluido duas vezes: ignora
  // tela aberta dentro de outra (modal com iframe, ?embed=1): sem botoes
  if (window.self !== window.top || new URLSearchParams(location.search).has('embed')) return;
  const MENU = '/usuariocontab/menu';

  const css = document.createElement('style');
  css.textContent = `
    #nav-comum { position:fixed; top:8px; right:16px; z-index:60; display:flex; gap:6px; }
    #nav-comum button { font:600 13px system-ui, sans-serif; padding:5px 12px; border-radius:6px;
      border:1px solid #cbd5e1; background:#fff; color:#1e293b; cursor:pointer;
      box-shadow:0 1px 3px rgba(0,0,0,.08); }
    #nav-comum button:hover { background:#1d4ed8; border-color:#1d4ed8; color:#fff; }
    @media print { #nav-comum { display:none; } }`;
  document.head.appendChild(css);

  const caixa = document.createElement('div');
  caixa.id = 'nav-comum';
  caixa.innerHTML = '<button type="button" id="nav-voltar" title="Voltar para a página anterior">← Voltar</button>'
                  + '<button type="button" id="nav-menu" title="Menu principal">☰ Menu</button>';
  document.body.appendChild(caixa);

  document.getElementById('nav-voltar').addEventListener('click', () => {
    // veio de outra pagina do sistema: volta; abriu direto (aba nova, favorito): menu
    const mesmoSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (mesmoSite && history.length > 1) history.back();
    else location.href = MENU;
  });
  document.getElementById('nav-menu').addEventListener('click', () => { location.href = MENU; });
})();
