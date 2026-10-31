# Admin (30/10/2026, Jorge)

- **Acesso:** só o administrador da empresa — usuário do cadastro `usuarios` com `admin: "1"` (hoje: Jorge Viana Lessa, 1111@gmail.com;
  Jorge Lessa 2222@gmail.com tem "0"). O login do contábil (`/usuariocontab`, `ensureContab`) **não** passa pelo passport
  (`req.user` fica vazio; o passport é o do `/admin-plata_forma`).
  - Por isso: sem admin, a página mostra **"Entrar como administrador"** (e-mail + senha). `POST /vendas/api/venda/admin/entrar`
    confere no `usuarios` com bcryptjs e grava `req.session.adminContab` — o usuário do contábil continua o mesmo; o Admin
    fica liberado até o logout/fechar o navegador ou **"Sair do admin"** (`POST /admin/sair`).
  - Regra `ehAdmin` em `venda-api.js` (sessão adminContab, ou `req.user.admin == "1"`); exportada para o `pages.js`.
- **Lucro diário** — `/vendas/admin/lucro-diario` (pages.js → `views/vendas/pages/lucro-diario.handlebars` + `public/js/vendas/lucro-diario.js`),
  API `GET /vendas/api/venda/lucro-diario?ano=&mes=`.
  - Botões Jan..Dez + ano. Linha por dia: data · vendas (líquido **sem** mão de obra) · estoque (**custo do que saiu**:
    quantidade × custoUnitario gravado na venda) · lucro bruto · margem · nº vendas. Linha cinza separando as semanas;
    seg–sex sempre aparecem, sáb/dom só com venda; feriado em amarelo.
  - Lado: lucro do mês · média diária (lucro ÷ dias úteis já passados) · **dias úteis = seg a sex sem feriado** (campo editável) ·
    previsão (média × dias úteis). Feriados: nacionais + Páscoa (carnaval seg/ter, sexta santa, corpus christi) +
    N. Sra. da Penha (ES, Páscoa+8) + N. Sra. da Vitória (08/09).
  - **Só vendas fechadas na plataforma** (as importadas do Access ficam fora; depois do Dia D é a vida normal).
- Em breve no menu Admin: relatório de resultado · curva ABC de produtos · lucro de serviços (mão de obra + peças de manutenção
  e produtos vendidos) · situação do sistema (/health/db).
