# Fluxo de Caixa — Sub-menu, DDA, Vendas a receber (18/10/2026)

> **Regra de trabalho (Jorge, 24/10/2026):** o VB + Access de 1998 é o sistema que roda a empresa. www.rotaes.com.br (`rotaes_ensaio`)
> é teste do pessoal com lançamentos já feitos no VB; localhost:5000 (`admin`) é o ensaio do Jorge. **Tudo nas duas bases é teste e
> será apagado no Dia D** (importa tudo para rotaes.com.br). Portanto: **não fazer script para corrigir dado antigo de teste** —
> só mudar o código e testar com lançamento novo.

## Sub-menu (legenda "● Sub-menu", janela flutuante à esquerda, arrasta)
- `public/js/contab/contabil/financeiro/fluxo-submenu.js` (carrega `dda-confere.js`, `vendas-receber.js`, `cartoes-receber.js` quando precisa)
- Itens: DDA - confere · DDA - paga · Vendas - receber · Cartões - recebimento
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

## Cartões - recebimento em lote (24/10/2026, Jorge)
A operadora deposita várias parcelas juntas (vários clientes, às vezes mais de um cartão).
- Abre pelo Sub-menu "Cartões - recebimento" e pelo clique numa parcela de cartão (1.01.005) no fluxo, que pergunta
  **📦 Receber em lote** ou **💳 Recebimento único** (o modal de sempre, com antecipação).
- `public/js/contab/contabil/financeiro/cartoes-receber.js`: ESQUERDA = todas as parcelas de cartão em aberto (`GET /cartoes-receber`:
  pos 6 e o 5 antigo), filtro por texto, cartão e "até" (vencimento); clique passa para a DIREITA ("→ todas" passa a lista).
  DIREITA = o depósito; clique devolve. Valores a receber (soma) · Recebido líquido (digita) · Despesas com taxa e juros (diferença, %).
- Data do movimento + banco (padrão CEF/Armação 1.01.002.003). ★ = chave **`cartao-taxa`** (pagina `cartoes` em `config-contas.js`,
  sem padrão — **configurar**).
- Grava pelo `POST /quitar { valorLiquido, lote: true }`: UMA boleta, banco (D) pelo líquido, cada parcela (C) na conta do cartão,
  taxa como contrapartida negativa na conta `cartao-taxa`. Lote aceita cartões diferentes. Sem `cartao-taxa` e um cartão só, usa a
  `contaTaxa` do cartão. Estorno desfaz tudo.

## POS 6 = cartões a receber da operadora (23/10/2026, Jorge)
- Parcelas de cartão (conta 1.01.005.xxx) nascem com **pos 6**: fechamento da venda com débito/crédito (`venda-api`) e recebimento
  de cliente no cartão (`/receber-partes`). **Pos 5 fica só para título a receber do cliente** (conta 1.03/1.04).
- `fluxo-api`: 1, 5 e 6 são "a receber" (+). `pagamento-api` `/janela` lê 1, 5, 6; `/cartao` lê 5 e 6 (as antigas de teste com 5 continuam funcionando).
- `src/scripts/FLUXO-4-cartoes-pos6.js` (`--base <nome>`, `--aplicar`): rodado na `admin` em 23/10 (164 → pos 6). Na `rotaes_ensaio`
  ficaram 2 com pos 5 — **não precisa** (dado de teste, regra acima).
- `os-api` (linha ~932, a receber da OS na conta do cliente) continua pos 5.
- `.env` local: a linha 8 (`/admin`) conecta; a linha 9 (`/rotaes_ensaio`) dá timeout (string antiga). Para outra base, use a linha 8 + `dbName` (`--base`).

## Recebimento de título de cliente no Fluxo: Banco · Caixa · Cartão, em partes (23/10/2026)
Venda fechada "a receber" (cliente não decidiu como paga). Clique na linha pos 5 do cliente → modal "Recebimento em lote" com
três botões; cada um mostra o seu quadro. Só aparecem no recebimento de cliente (não em pagar, cartão 1.01.005 nem título PJ Banestes),
e aí a lista mostra **só os títulos do cliente clicado**. "Antecipação de cartão" não aparece aí. O modal arrasta pelo título.
- **Banco**: só os bancos com `recebeVenda` (BB, Banestes, CEF). **Caixa**: 1.01.001.001 fixo (`GET /caixa`).
- **Cartão**: bandeira, débito/crédito, 1–10x, prévia das parcelas (sobre o valor da parte).
- **Em partes**: caixa "Valor recebido" (vem com o que falta). Menor + Enter → a parte fica guardada (lista em cima, × tira) e
  abre outra caixa com o saldo, com a sua forma (ex.: PIX no BB + o resto no cartão 7x). Marcar/desmarcar título recomeça as partes.
- Gravação: uma parte só, Banco ou Caixa → `POST /quitar` (forma BANCO/CAIXA). Cartão ou mais de uma parte →
  `POST /receber-partes`: uma boleta por parte (perna = banco/caixa/operadora × cliente), ligadas por `grupoRecebimento`;
  títulos QUITADO (boletaId = 1ª boleta); parte cartão gera pos 6 com `origemBoletaId` e `lancamentoId` da venda.
- **Estorno** de qualquer boleta do grupo desfaz tudo e cancela as parcelas do cartão; se a operadora já pagou alguma, recusa.
- Taxa do cartão só quando a operadora paga (valor líquido, como antes).

## Buscar CEP pela rua — endereço de instalação (venda e OS) (24/10/2026)
- `public/js/comum/endereco-instalacao.js` (comum ao modal da venda e da OS): botão **🔍** ao lado do CEP.
- CEP vazio: busca no ViaCEP pelo browser (`viacep.com.br/ws/UF/cidade/rua/json/`), sem o tipo do logradouro (Rua/Av./Praça…) e
  sem acento. Um resultado (ou um só no bairro digitado) preenche CEP, rua, bairro, cidade, UF. Vários (rua longa, CEP por faixa de
  número): lista para escolher, os do bairro digitado primeiro. CEP digitado: busca o endereço (rota antiga `/aux/api/lookup/cep`).
- Com "guardar no cadastro do cliente" marcado, o endereço (com CEP) vai para a ficha.
- Se o site tiver CSP bloqueando `viacep.com.br`, passar a busca para o servidor (rota no `/aux/api/lookup`).

## Importação do fluxo do Access
- `src/scripts/FLUXO-1-importar-fluxo-access.js` (Contab_Caixa_Fluxo → `_fluxo_projetado`, origem ACCESS; 2.02→2.01; fora pos 8 e 7). Rodado em 18/10: 194 linhas.

## Razão mais rápido
- `razao-api /lancamentos` lê só as boletas da conta; índices em `_boletas` pelo `PLANO-11-indices-razao.js` (aplicado em 18/10). Se ainda pesar: saldo mensal guardado (como o ROTOR do Access).
