# Fluxo de Caixa — Sub-menu, DDA, Vendas a receber (18/10/2026)

> **Regra de trabalho (Jorge, 24/10/2026):** o VB + Access de 1998 é o sistema que roda a empresa. www.rotaes.com.br (`rotaes_ensaio`)
> é teste do pessoal com lançamentos já feitos no VB; localhost:5000 (`admin`) é o ensaio do Jorge. **Tudo nas duas bases é teste e
> será apagado no Dia D** (importa tudo para rotaes.com.br). Portanto: **não fazer script para corrigir dado antigo de teste** —
> só mudar o código e testar com lançamento novo.
> **29/10/2026:** o `/health/db` do localhost mostrou `dbName: rotaes_ensaio` (o .env local estava na base do site) — conferir antes de testar.

## Sub-menu (legenda "● Sub-menu", janela flutuante, embaixo à esquerda, arrasta)
- `public/js/contab/contabil/financeiro/fluxo-submenu.js` (carrega `dda-confere.js`, `vendas-receber.js`, `cartoes-receber.js` quando precisa)
- Itens: DDA - confere · DDA - paga · Vendas - receber · Cartões - recebimento
- 29/10: sub-menu e Sintetizar mais estreitos, abrem embaixo à esquerda (um acima do outro), azul #1d4ed8.
- 29/10: a **legenda filtra**: "● Orçamento (proj.)" = pos 8 · "● A receber" = 1, 5, 6 · "● A pagar" = 0, 2, 3, 7 (clicar de novo = todos).

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
  pos 6 e o 5 antigo, com a data da venda), filtro por texto, cartão e "até"; clique passa para a DIREITA ("→ todas" passa a lista).
  DIREITA = o depósito; clique devolve. Valores a receber (soma) · Recebido líquido (digita) · Despesas com taxa e juros (diferença, %).
- Data do movimento + banco (padrão CEF/Armação 1.01.002.003). ★ (pagina `cartoes`): **`cartao-taxa`** (MDR) e **`cartao-antecipacao`**
  (juros da antecipação) — sem padrão, **configurar**.
- Grava pelo `POST /quitar { valorLiquido, lote: true, taxas? }`: UMA boleta, banco (D) pelo líquido, cada parcela (C) na conta do cartão,
  taxa como contrapartida negativa. Lote aceita cartões diferentes. Estorno desfaz tudo.

### Arquivo da Rede (28–29/10/2026)
- Maquininha: **Rede** (estabelecimento 7871457), deposita na **CEF**. Hoje a Armação **antecipa tudo** ("recebimento automático",
  D+1, por falta de capital de giro); no futuro deve parar — o sistema atende os dois (sem antecipar as parcelas vêm uma por mês).
- Relatórios da Rede: **vendas** (por venda: MDR, taxa de recebimento automático, líquido, NSU); **recebimentos** (xlsx com abas;
  a aba **"pagamentos"** é uma linha por parcela paga: data do recebimento, data da venda, bruto, taxa MDR %, valor MDR descontado
  [MDR + antecipação], líquido, NSU, bandeira, nº parcelas, parcela); o CSV "recebidos" é só o total do dia por bandeira.
- **📂 Importar arquivo da Rede** (SheetJS 0.18.5 do cdnjs): lê a aba pagamentos, casa cada parcela com a pos 6 (bandeira, n/N, valor ±0,03,
  data da venda ±4 dias; mesmo NSU na mesma venda), passa as casadas para a direita, líquido e data do arquivo. Quadro por venda (NSU):
  bruto, MDR, antecipação, **juros ao mês**, líquido; "só na Rede" em vermelho.
- 29/10: os arquivos **acumulam** (Visa + Mastercard; sem repetir) e **⚖ Equiparar** liga a venda "só na Rede" ao título do fluxo pelo
  VALOR (um título ou as parcelas de uma venda que somam o valor), candidatos em amarelo; tirar da direita desliga a venda inteira.
- Só parcelas do arquivo + líquido do arquivo → taxa em duas contrapartidas (MDR / antecipação).
- Taxas da Rede (out/2026): MDR 1,81% (1x) · 2,51% (2–6x) · 2,81% (7–12x); recebimento automático 1,05% · ~2,31% (3x) · 6,72% (10x)
  ≈ **1,08% / 1,21% / 1,32% ao mês**. Conferido com 28/10: Visa líquido 915,74, Mastercard 5.125,60.
- **Decisão (28/10):** o cartão **continua no fechamento da nota** (bandeira + parcelas); o arquivo da Rede confere depois.

## POS 6 = cartões a receber da operadora (23/10/2026, Jorge)
- Parcelas de cartão (conta 1.01.005.xxx) nascem com **pos 6**: fechamento da venda com débito/crédito (`venda-api`) e recebimento
  de cliente no cartão (`/receber-partes`). **Pos 5 fica só para título a receber do cliente** (conta 1.03/1.04).
- `fluxo-api`: 1, 5 e 6 são "a receber" (+). `pagamento-api` `/janela` lê 1, 5, 6; `/cartao` lê 5 e 6.
- `src/scripts/FLUXO-4-cartoes-pos6.js` (`--base <nome>`, `--aplicar`): rodado na `admin` em 23/10 (164 → pos 6).
- `os-api` (linha ~932, a receber da OS na conta do cliente) continua pos 5.
- `.env` local: a linha 8 (`/admin`) conecta; a linha 9 (`/rotaes_ensaio`) dava timeout (replicaSet antigo). Para outra base, copie a
  linha 8 trocando só `/admin` (ou `--base` nos scripts).

## Recebimento de título de cliente no Fluxo: Banco · Caixa · Cartão, em partes (23/10/2026)
Venda fechada "a receber" (cliente não decidiu como paga). Clique na linha pos 5 do cliente → modal "Recebimento em lote" com
três botões; cada um mostra o seu quadro. Só aparecem no recebimento de cliente, e aí a lista mostra **só os títulos do cliente clicado**.
- **Banco**: só os bancos com `recebeVenda` (BB, Banestes, CEF). **Caixa**: 1.01.001.001 fixo (`GET /caixa`).
- **Cartão**: bandeira, débito/crédito, 1–10x, prévia das parcelas (sobre o valor da parte).
- **Em partes**: caixa "Valor recebido" (vem com o que falta). Menor + Enter → a parte fica guardada e abre outra caixa com o saldo.
- Gravação: uma parte só, Banco ou Caixa → `POST /quitar`. Cartão ou mais de uma parte → `POST /receber-partes` (uma boleta por parte,
  `grupoRecebimento`; parte cartão gera pos 6). **Estorno** de qualquer boleta do grupo desfaz tudo.

## Buscar CEP pela rua — endereço de instalação (venda e OS) (24/10/2026)
- `public/js/comum/endereco-instalacao.js`: botão **🔍** ao lado do CEP (ViaCEP pelo browser; rua + cidade + UF → lista de CEPs).

## Erros de conexão com o MongoDB (29/10/2026)
- `database/index.js`: maxIdleTimeMS 60 s, heartbeat 10 s, socketTimeout 45 s, retryReads/Writes; avisos de queda/volta no terminal.
- `src/middleware/erro-banco.js` + 3 linhas no `server.js`: `.traduzir` (depois do `express.json()`: JSON de erro com ECONNRESET vira
  "Sem conexão com o banco de dados…", 503), `app.use(require(...))` (depois do 404: página amigável, tenta sozinho em 5 s, botão
  "Ver conexão" → `/health/db`) e `.protegerProcesso()` (antes do boot: promessa rejeitada não derruba o servidor).
- A sessão (connect-mongo) já usava a conexão do mongoose (`clientPromise`).

## Pendências / a desenvolver
- **Admin** (menu principal, "em breve"): tela de **situação do sistema** — conexão do banco (`/health/db`: state, dbName, host, ping),
  base em uso (avisar se o localhost estiver na base do site), últimas quedas/reconexões, versão dos arquivos.
- **Pessoal** (menu principal, "em breve"); saiu de Contabilidade em 29/10.

## Importação do fluxo do Access
- `src/scripts/FLUXO-1-importar-fluxo-access.js` (Contab_Caixa_Fluxo → `_fluxo_projetado`, origem ACCESS; 2.02→2.01; fora pos 8 e 7). Rodado em 18/10: 194 linhas.

## Razão mais rápido
- `razao-api /lancamentos` lê só as boletas da conta; índices em `_boletas` pelo `PLANO-11-indices-razao.js` (aplicado em 18/10).
