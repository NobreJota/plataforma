# Fluxo de Caixa — Sub-menu, DDA, Vendas a receber (18/10/2026)

## Sub-menu (legenda "● Sub-menu", janela flutuante à esquerda, arrasta)
- `public/js/contab/contabil/financeiro/fluxo-submenu.js` (carrega `dda-confere.js` e `vendas-receber.js` quando precisa)
- Itens: DDA - confere · DDA - paga · Vendas - receber · Cartões - recebimento (em breve)
- "Mostrar no fluxo": Orçamento proj. (pos 8), Compras proj. (pos 3), Pedidos feitos (pos 7) — escondido sai da grade e do saldo (`fluxo-api ?ocultar=`), guardado no navegador.

## DDA - paga
- `GET /financeiro/api/pagamento/dda?ate=` — pos 2 vencendo até o dia (vencidos inclusive); "só fornecedores (2.01.001)".
- Banco: só os da Armação (`recebeVenda`: CEF, BB, Banestes). Paga pelo `POST /quitar`.
- Histórico: 1 título "DDA — <hist>"; vários "Diversos DDA — n títulos pagos pelo <banco>". Razão mostra C/PART "Diversos DDA".

## DDA - confere
- `GET /dda-confere?de=&ate=` — pos 2, 3, 7 de fornecedor (2.01.001) com CNPJ (fornecs → vínculo → conta) + CNPJs conhecidos.
- CSV do banco lido na tela (colunas achadas pelo cabeçalho; ⚙ para corrigir; escolha errada guardada é ignorada).
- Situações: confere · valor · vencimento · filial · CNPJ desconhecido (fraude) · só no banco · só no fluxo.
- "🧪 Simular arquivo do banco" (sem CSV real). "✎ ajustar o vencimento do fluxo" → `PUT /titulo/:id/vencimento` (histórico em `ajustes`).
- **Pendente:** CSV real do DDA (Jorge tem acesso na segunda).

## Vendas - receber
- `GET /receber` — pos 5 em aberto, sem cartões (1.01.005) e sem OS. Ordena por Histórico/Venc./Valor.
- Janela do cliente: títulos com caixinha, Desconto → Juros → Data → Banco (Enter anda), "Quer gravar o recebimento?".
- `POST /quitar` aceita `juros` (C na conta `receber-juros`) e `desconto` (D na conta `receber-desconto`) — **configurar as duas contas no ★** (sem padrão).

## Recebimento de título de cliente no Fluxo: Banco · Caixa · Cartão (23/10/2026)
Venda fechada "a receber" (cliente não decidiu como paga). No modal "Recebimento em lote" (clique na linha pos 5 do cliente),
três botões; cada um mostra o seu quadro. Só aparecem no recebimento de cliente (não em pagar, cartão 1.01.005 nem título PJ Banestes).
- **Banco**: só os bancos com `recebeVenda` (BB, Banestes, CEF). Boleta banco (D) × cliente (C) pelo `POST /quitar`.
- **Caixa**: 1.01.001.001 fixo. `POST /quitar { forma: 'CAIXA' }` (sem conta bancária). `GET /caixa`.
- **Cartão**: bandeira (1.01.005.xxx), débito/crédito, 1–10x, prévia das parcelas. A lista mostra só os títulos do cliente clicado.
  `POST /receber-cartao`: boleta RECEBIMENTO operadora (D) × cliente (C); títulos QUITADO; nascem pos 5 da operadora (valor inteiro,
  débito dia seguinte, crédito 30/60/90… da data do movimento), com `origemBoletaId` e `lancamentoId` da venda (se for uma só).
  Taxa só quando a operadora paga (valor líquido, como antes). **Estorno** cancela as parcelas do cartão; se alguma já foi paga, recusa.
- Em aberto: pagar parte em PIX e parte no cartão no mesmo título (não decidido).

## Importação do fluxo do Access
- `src/scripts/FLUXO-1-importar-fluxo-access.js` (Contab_Caixa_Fluxo → `_fluxo_projetado`, origem ACCESS; 2.02→2.01; fora pos 8 e 7). Rodado em 18/10: 194 linhas.

## Razão mais rápido
- `razao-api /lancamentos` lê só as boletas da conta; índices em `_boletas` pelo `PLANO-11-indices-razao.js` (aplicado em 18/10). Se ainda pesar: saldo mensal guardado (como o ROTOR do Access).
