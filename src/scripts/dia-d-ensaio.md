# Dia "D" — ensaio (roteiro em construção, 18–22/10/2026)

## ★ DECISÃO 21/10/2026 (Jorge): a base de operação é `rotaes_ensaio`
✓ FEITO 21/10/2026 18:27: MONGO_URI do app (king-prawn-app → App-Level Environment Variables) trocada; log do
DigitalOcean: "MongoDB conectado … a980bbcd … | DB: rotaes_ensaio". A tela "Connection Details" do componente
dbaas-db (database = admin) é só o login — não mexer, não "Detach".
A antiga `admin` deixa de ser usada (fica guardada, NÃO apagar — é o backup do que havia antes).
- Na troca de senha (pendente): trocar no DigitalOcean → Databases → Users, e atualizar o .env local E a MONGO_URI do app.
- Backups automáticos do DigitalOcean são do cluster inteiro (cobrem rotaes_ensaio).
- O que estava como "repetir na base de verdade" (contas de juros/desconto etc.) JÁ ESTÁ nela.
- No dia D os passos de importação do Access (abaixo) rodam nela mesma, para trazer os últimos dias do Access.
- ATENÇÃO: o site publicado agora grava em rotaes_ensaio. Se a loja usar o site para valer antes do dia D,
  NÃO rodar o ENSAIO-2 (apaga vendas/boletas feitas na plataforma) sem rever.
- ATENÇÃO (22/10): NÃO vender no Access e no site ao mesmo tempo antes do dia D — os dois dariam o mesmo
  número de cupom (1243, 1244…) e o VENDA-11 deixaria o cupom do Access de fora (✗).

Access do ensaio: `C:\Armação\Dados\2026B\D\2026BD.mdb` (dados até 16/10/2026; 296 tabelas).
O servidor (database\index.js) e todos os scripts usam **MONGO_URI** (DB_CONNECT/MONGO_DB não são usados).

## Passo 0 — base de ensaio ✓ (18/10)
1. `ENSAIO-0-copiar-base.js --destino rotaes_ensaio` (simulação) e `--aplicar` → 99 coleções, 157.620 docs, 232 s
2. `.env`: linha com `admin` guardada com #; a ativa = rotaes_ensaio.

## Passo 1 — sequência (cada script: simulação, depois --aplicar). MDB = `--mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"`
1. ✓ COMPRA-5-sincronizar-produtos — 2.759 produtos; 1 novo; 6 referências da plataforma preservadas
2. ✓ COMPRA-4-sincronizar-vendas — 3.517 itens (353 novos), até 16/10
3. ✓ COMPRA-17-sincronizar-nfe — 204 notas, 727 itens; 4 sem itens (288318, 293549, 320597 Rinnai; 188087)
4. ✓ COMPRA-15-produtos-para-cadastro --limpar-plataforma **--mdb** (lê a taxa do Access) — 1 novo, 1 de teste apagado
4b. ✓ **COMPRA-22-atualizar-estoque-precos** — estoque 197, custo 113, preço 37 (regra VENDA-9).
5. ✓ COMPRA-9-importar-pedidos **--aplicar --com-fluxo NUM COMANDO SÓ** — 5 pedidos, 11 parcelas
5b. ✓ **COMPRA-23-conferir-pedidos** (só lê) + **COMPRA-24-fechar-pedidos --cancelar <teste>**
5d. Pos do PED_PedidoFornecedor: 0 pendente · 1 SALDO pendente · 3 cancelado (o Access apaga o liquidado).
5c. **FLUXO-3-pedidos-para-pos3** — POS COMO NO ACCESS: **3 = pedido feito**, **7 = compra projetada** (previsão).
6. ✓ CLIENTE-2-importar — 32 novos, 16.996 atualizados, 28 contas criadas (backup)
7. ✓ PLANO-2-espelho-access e VENDA-1-espelho-access
8. ✓ PLANO-8-importar-lancamentos **`--conta-diferenca 4.04.001.002`** (decisão 19/10: não corrigir pequenas
   diferenças do passado; o sistema novo é que não as permite).
8b. **ENSAIO-2-limpar-testes** `--aplicar --base rotaes_ensaio --orcamentos --sem-loja` — ANTES do FLUXO-1.
9. FLUXO-1-importar-fluxo-access **--com-orcamento** (pos 7 = previsões; da pos 3 só o que não é pedido da plataforma)
9b. **PROG-2-espelho-notas** (20/10) — NFE_Cabeçalho (2025+), Compras_Fornecedores, Ped_Previsão → Programação de Compras.
9c. ✓ **VENDA-11-importar-vendas-access** (22/10) — as vendas do ano do Access (Vendas_SaídaCupom + Itens + cliente do
    NFS_RegTítulos) no Relatório de vendas: _vendas origem ACCESS, nº = nº do cupom, só histórico (sem lançamento,
    fluxo ou estoque; não cancela, não ganha instalação). Roda de novo = atualiza.
    Aplicado 22/10: **1.210 vendas, R$ 2.709.146,29** (248 cupons balcão, 962 com cliente). 917, 960, 961: prazo sem
    título no NFS_RegTítulos (entram sem nome de cliente). Próxima venda da plataforma = 1243.
    **Cupons 1 a 5 (02 e 03/01/2026) DESPREZADOS** (Jorge, 22/10: pouco valor, provável teste; os nº são das vendas
    1–5 da plataforma). O script os ignora sempre. Qualquer outro nº repetido aparece como ✗ = venda real a rever.
    (VENDA-12-renumerar foi feito e NÃO é usado.)
10. OS: numeração e OS abertas — a definir
11. (feito no 8b) numeração real da NF-e segue a última do Access

## Passo 2 — conferência
`ENSAIO-1-conferir-balancete.js --mdb "..." --mes 10`. Causas: A esperado (migração) · B não entrou · C teste
da plataforma · D erro · E só data. Meta: D = 0 e resto = 0 → "✓ a importação está fiel ao Access".

## ✓ RESULTADO DO 1º ENSAIO COMPLETO (19/10/2026)
**"✓ a importação está fiel ao Access"** — B 0 · C 0 · D 0 · resto 0. Só as diferenças esperadas
(perda/sobra de estoque, 4.03.002.013 −8.000,00 receita de OS sem conta, 4.04.001.002 −1.383,36, Chaves 10/11 só data).
Atenção: o PowerShell não aceita `node -e` com `$` dentro de aspas duplas.

## Sistema robusto
- Toda boleta fecha (débito = crédito).
- Recebimento com valor ≠ título: Juros 4.03.001.002 Diversos / Desconto 3.06.001.007 (já gravadas em rotaes_ensaio).
- Lote de cartão: tela Cartões - recebimento (a fazer).

## Pendências
- Trocar as senhas (3 e 5 do .env; a 4 está em desuso) — DigitalOcean + .env + MONGO_URI do app.
- Usuários/senhas de login criados ou trocados na plataforma depois de 18/10 (cópia) não estão na rotaes_ensaio: conferir.
- Títulos de 2025 que ficaram no fluxo na virada (Alessandro, Luzineth, Ville, Gustavo): excluir também no Access.
- Ped_Previsão nº 300 (fornecedor 17, 2009) no Access: apagar (opcional; a tela já ignora < 2025).
- Komeco (NrFornec 67): completar cadastro (CNPJ).
- Lançar no Access os itens das notas 288318, 293549, 320597, 188087 (opcional).
- OS 13768 e 13769 (vendas 35/36): cortesia não aplicada.
- Orçamentos do Access (Orcamento_Cliente 396, Orcamento_Grupos 7, Orcamento_Material 6.225): decidir se e como trazer.
- Vendas de 2025 (Vendas_SaídaCupom_2025, nº de cupom recomeça a cada ano): não importadas.
