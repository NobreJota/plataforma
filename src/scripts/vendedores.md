# Vendedores e comissão (30/10/2026, Jorge)

- Cadastro `_vendedores` { nome, apelido, tipo CLT | MEI | AVULSO, documento, telefone, **grupos: [id]** (os grupos com direito
  a comissão), ativo, codigoAccess }. O "quadro de empregados" é uma **tabela do Access** ainda não importada; `codigoAccess` liga depois.
- Página `/vendas/vendedores` (pages.js → `views/vendas/pages/vendedores.handlebars` + `public/js/vendas/vendedores.js`):
  botão **Cadastro** (ficha de vendedor novo ao lado, escondida até clicar) · abas **Lista** (clique = modal de edição) ·
  **Comissão** (quadro jan..dez, clique no mês → vendas, mouse na venda → conta por grupo) · **Grupos**.
- **Grupos de comissão** `_comissao_grupos` { nome, **taxa (%)**, ordem, ativo } — **a taxa é do grupo, igual para todos os
  vendedores** (decisão 30/10 tarde). Nascem: Peças para aquecedores e bombas · Vendidos no balcão · Aquecedores e outros.
  "Balcão" NÃO é cupom (venda de balcão pode ter NF) — é grupo de produto.
- **Classificação do produto na venda, à medida que vende** (não classificar os milhares de produtos; os que não vendem somem
  depois do Dia D). Combo amarelo abaixo da referência; grava em `_produto_grupo_comissao` { lojistaId, codigo, grupo }
  (fora do `arquivo_docs`, para não se perder na reimportação). PROD_Grupos / PROD_GrupoSub do Access estão vazias.
- Rotas (venda-api): `GET/POST /comissao-grupos`, `PUT /comissao-grupos/:id` { nome, taxa, ativo }, `POST /produtos/:codigo/grupo-comissao`,
  `GET/POST /vendedores`, `PUT /vendedores/:id`, `GET /vendedores/comissao?ano=`, `GET /vendedores/comissao/vendas`.
- Venda: combo **Vendedor** na linha de Produtos; **obrigatório para fechar**, e todos os itens com grupo. No fechamento grava
  `vendedor` e `comissao { itens: [{ codigo, grupo, base, taxa, valor }], base, total }` direto em `_vendas` (fora do modelo):
  taxa = a do grupo se o vendedor tem o grupo, senão 0; base do item = líquido do item com o desconto geral repartido
  (mão de obra fora). Mês = mês do fechamento; canceladas fora. Mudar a taxa vale para as vendas fechadas dali em diante.
- A fazer: tela da venda no monitor menor (aproveitar o espaço à esquerda), miniatura + Ctrl+mouse com até 7 fotos do
  produto (reaproveitar o bloco de imagens do Space DigitalOcean do admin da loja — `usuarioloja`).
