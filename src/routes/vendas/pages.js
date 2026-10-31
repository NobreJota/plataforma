// =============================================================================
// Destino: C:\plataformaRota\src\routes\vendas\pages.js
// Criado em: 02/10/2026
// Alterado em: 02/10/2026 - tela da venda (/vendas/venda e /vendas/venda/:id)
//                           e a API dela (/vendas/api/venda)
// Alterado em: 03/10/2026 - Relatorio de vendas mes a mes (/vendas/relatorio)
// Alterado em: 10/10/2026 - Servico > Agenda do dia (/vendas/servicos)
// Alterado em: 13/10/2026 - Servico > listas da OS (/vendas/servicos/lista?tipo=) e a API
//                           da OS (/vendas/api/os, os-api.js)
// Alterado em: 13/10/2026 - Servico > Tecnicos (/vendas/servicos/tecnicos) e a API
//                           (/vendas/api/tecnicos, tecnicos-api.js)
// Alterado em: 15/10/2026 - Servico > Ficha de fechamento da OS (/vendas/servicos/fechamento/:id)
// Alterado em: 16/10/2026 - Servico > Fluxo de servico (/vendas/servicos/fluxo)
// Alterado em: 23/10/2026 - Servico > Nova OS (/vendas/servicos/nova?tipo=C|G|S): por enquanto o conserto
// Alterado em: 17/10/2026 - Venda > Kits (/vendas/kits): produto principal + itens que vao junto
// Alterado em: 30/10/2026 - Admin > Lucro diario (/vendas/admin/lucro-diario; so admin "1")
// Alterado em: 30/10/2026 - Venda > Vendedores (/vendas/vendedores; ?aba=comissao abre o quadro da comissao)
//
// Telas do modulo de vendas. Montado em /vendas no server.js, protegido por
// ensureContab (que expoe req.lojistaId).
//
// Clientes: a API continua em /aux/api/clientes (clientes-api.js, sem mudanca).
// =============================================================================

const express = require('express');
const router  = express.Router();

const vendaApi = require('./venda-api');
const osApi    = require('./os-api');
const tecApi   = require('./tecnicos-api');

// cadastro de clientes
router.get('/clientes', (req, res) => {
  res.render('vendas/pages/clientes', { layout: false, activeMenu: 'vendas' });
});

// venda: nova, ou uma aberta pelo id
router.get('/venda', (req, res) => {
  res.render('vendas/pages/venda', { layout: false, activeMenu: 'vendas', vendaId: '' });
});
router.get('/venda/:id', (req, res) => {
  res.render('vendas/pages/venda', { layout: false, activeMenu: 'vendas', vendaId: req.params.id });
});

// kits de venda (17/10/2026)
router.get('/kits', (req, res) => {
  res.render('vendas/pages/kits', { layout: false, activeMenu: 'vendas' });
});

// vendedores: cadastro e comissao (30/10/2026)
router.get('/vendedores', (req, res) => {
  res.render('vendas/pages/vendedores', { layout: false, activeMenu: 'vendas' });
});

// ADMIN > lucro diario (30/10/2026) — so o administrador da empresa (login com admin "1")
router.get('/admin/lucro-diario', (req, res) => {
  if (!vendaApi.ehAdmin(req)) return res.status(403).send(paginaEntrarAdmin());
  res.render('vendas/pages/lucro-diario', { layout: false, activeMenu: 'admin' });
});
// 30/10/2026 (noite 2): sem admin na sessao -> "Entrar como administrador" (e-mail e senha de um usuario admin "1");
// o usuario do contabil continua o mesmo, so o Admin fica liberado nesta sessao
function paginaEntrarAdmin() {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Admin</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f8fafc;margin:0;'
    + 'display:flex;align-items:center;justify-content:center;min-height:100vh;color:#111827}'
    + '.cx{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:26px 30px;width:min(420px,calc(100vw - 32px));box-shadow:0 10px 30px rgba(0,0,0,.08)}'
    + 'h1{margin:0 0 6px;font-size:20px;color:#6b21a8}p{margin:0 0 16px;color:#374151;font-size:14px}'
    + 'label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700;text-transform:uppercase;color:#374151;margin-bottom:10px}'
    + 'input{height:38px;border:1px solid #d1d5db;border-radius:8px;padding:0 10px;font-size:15px}'
    + 'button{width:100%;height:40px;border:0;border-radius:8px;background:#6b21a8;color:#fff;font-weight:700;font-size:15px;cursor:pointer;margin-top:4px}'
    + '.msg{min-height:18px;color:#dc2626;font-size:13px;margin-top:10px}a{color:#6b21a8;font-size:13px}</style></head><body>'
    + '<form class="cx" id="f"><h1>Admin</h1><p>Só o administrador da empresa entra aqui. Entre com o e-mail e a senha do administrador '
    + '(você continua no seu usuário; o Admin fica liberado até sair).</p>'
    + '<label>E-mail<input id="e" type="email" autocomplete="username" autofocus></label>'
    + '<label>Senha<input id="s" type="password" autocomplete="current-password"></label>'
    + '<button type="submit" id="b">Entrar como administrador</button><div class="msg" id="m"></div>'
    + '<p style="margin:14px 0 0"><a href="/usuariocontab/menu">← voltar ao menu</a></p></form>'
    + '<script>document.getElementById("f").addEventListener("submit",async function(ev){ev.preventDefault();'
    + 'var b=document.getElementById("b"),m=document.getElementById("m");b.disabled=true;m.textContent="";'
    + 'try{var r=await fetch("/vendas/api/venda/admin/entrar",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},'
    + 'body:JSON.stringify({email:document.getElementById("e").value,senha:document.getElementById("s").value})});'
    + 'var d=await r.json();if(!d.ok)throw new Error(d.erro||"não entrou");location.reload();}'
    + 'catch(x){m.textContent=x.message;b.disabled=false;}});</script></body></html>';
}

// relatorio de vendas, mes a mes (como o fluxo)
router.get('/relatorio', (req, res) => {
  res.render('vendas/pages/relatorio', { layout: false, activeMenu: 'vendas' });
});

// servico: agenda do dia dos tecnicos (instalacoes)
router.get('/servicos', (req, res) => {
  res.render('vendas/pages/servicos', { layout: false, activeMenu: 'servico' });
});

// servico: listas da OS (programadas, n/programadas, pendentes, concluidas, liquidadas)
router.get('/servicos/lista', (req, res) => {
  res.render('vendas/pages/servicos-lista', { layout: false, activeMenu: 'servico' });
});

// servico: cadastro de tecnicos (MEI)
router.get('/servicos/tecnicos', (req, res) => {
  res.render('vendas/pages/tecnicos', { layout: false, activeMenu: 'servico' });
});

// servico: ficha de fechamento da OS (abre pelo "Concluir serviço" do modal da OS)
router.get('/servicos/fechamento/:id', (req, res) => {
  res.render('vendas/pages/servicos-fechamento', { layout: false, activeMenu: 'servico', osId: req.params.id });
});

// servico: NOVA OS sem venda (23/10/2026) — tipo C conserto (G garantia e S servicos: em seguida)
router.get('/servicos/nova', (req, res) => {
  const tipo = String(req.query.tipo || 'C').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'C';
  res.render('vendas/pages/servicos-nova', { layout: false, activeMenu: 'servico', tipo });
});

// servico: fluxo de servico (o a receber das OS; recebe com o codigo do fluxo de caixa)
router.get('/servicos/fluxo', (req, res) => {
  res.render('vendas/pages/servicos-fluxo', { layout: false, activeMenu: 'servico' });
});

/* ===== APIs ===== */
router.use('/api/venda', vendaApi);
router.use('/api/os', osApi);
router.use('/api/tecnicos', tecApi);

module.exports = router;
