# Programação de Compras — notas (20/10/2026)

Tela: `/compra/programacao` (src/routes/compra/programacao.js · views/compra/pages/programacao.handlebars · public/js/compra/programacao.js).
Montada no server.js: `app.use('/compra/programacao', ensureContab, require('./src/routes/compra/programacao'))`.
Dados: PROG-2-espelho-notas (NFE_Cabeçalho desde 2025 → _access_nfe_cabecalho; Compras_Fornecedores → _access_compras_fornecedores).
Atenção: o Access grava VrNota como TEXTO ("183.0000") → converter antes de somar.

## Abas
- Grade do ano: soma VrNota por NrFornec × mês (DataEntr). Clique no valor → notas do mês; clique no nome → resumo do fornecedor
  (comprado no ano, média mensal, mesmo período do ano anterior, pedidos e previsões em aberto no ano).
- Realização do mês: notas que entraram (entrada, nota, pedido, fornecedor, valor, saldo).
- Pedidos (pos 3, data = entrega prevista do pedido) e previsões (pos 7, data = Data da linha no fluxo do Access = data da compra
  prevista; valor = soma das parcelas). Acumulado zera a cada mês, com linha de total e uma linha em branco.

## Como o Jorge faz a previsão de compras (pos 7) — TEMA A EXPLORAR, o mais importante da empresa
- Olha as compras dos **3 últimos meses** de cada fornecedor e usa a **média** ou o **valor mais alto**, conforme o fornecedor.
- Fornecedores com média **acima de R$ 6.000/mês** (Komeco, Rinnai e outros): compra **mensal**.
- Os demais: compra a cada **2 ou 3 meses**.
- Risco: comprar demais → estoque encalhado e capital de giro preso; comprar de menos → perde faturamento.
- As previsões atuais (pos 7) já vêm do Access (previsãoRinnai, 997 Komlog...). Próximo passo: sugestão calculada pela regra acima,
  lado a lado com a previsão existente, para o administrador decidir (sem gravar sozinho).
