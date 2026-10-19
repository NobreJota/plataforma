# Dia "D" — ensaio (roteiro em construção, 18–19/10/2026)

Access do ensaio: `C:\Armação\Dados\2026B\D\2026BD.mdb` (dados até 16/10/2026; 296 tabelas).
Ensaio numa **cópia** da base: `rotaes_ensaio` (a base de verdade é `admin`, não muda).
O servidor (database\index.js) e todos os scripts usam **MONGO_URI** (DB_CONNECT/MONGO_DB não são usados).

## Passo 0 — base de ensaio ✓ (18/10)
1. `ENSAIO-0-copiar-base.js --destino rotaes_ensaio` (simulação) e `--aplicar` → 99 coleções, 157.620 docs, 232 s
2. `.env`: linha 8 (# admin) guardada; linha 9 = rotaes_ensaio. Teste:
   `node -e "require('dotenv').config();require('mongoose').connect(process.env.MONGO_URI).then(c=>{console.log('OK, base:',c.connection.db.databaseName);process.exit(0)})"`
   Para voltar: tirar o # da 8, pôr # na 9.

## Passo 1 — sequência (cada script: simulação, depois --aplicar). MDB = `--mdb "C:\Armação\Dados\2026B\D\2026BD.mdb"`
1. ✓ COMPRA-5-sincronizar-produtos — 2.759 produtos; 1 novo; 6 referências da plataforma preservadas
2. ✓ COMPRA-4-sincronizar-vendas — 3.517 itens (353 novos), até 16/10
3. ✓ COMPRA-17-sincronizar-nfe — 204 notas, 727 itens; 4 sem itens (288318, 293549, 320597 Rinnai; 188087)
4. ✓ COMPRA-15-produtos-para-cadastro --limpar-plataforma **--mdb** (lê a taxa do Access) — 1 novo, 1 de teste apagado
4b. ✓ **COMPRA-22-atualizar-estoque-precos** (NOVO, achado no ensaio: o COMPRA-15 não atualiza os que já existem)
    — estoque 197, custo 113, preço 37. Preço pela regra VENDA-9 (prazo = maior do Access; vista = prazo −5%).
5. ✓ COMPRA-9-importar-pedidos **--aplicar --com-fluxo NUM COMANDO SÓ** (rodar o --com-fluxo depois não gera
    o fluxo dos que já existem) — 5 pedidos, 11 parcelas
5b. ✓ **COMPRA-23-conferir-pedidos** (só lê) + **COMPRA-24-fechar-pedidos --cancelar <teste>** (NOVOS):
    o Access apaga pedido liquidado; 7 pedidos antigos (7146…7160) ficavam pendentes aqui com a pos 7 no
    fluxo = R$ 90.400,23 em dobro. Fechados (L), 7161 de teste cancelado (C), 15 linhas do fluxo canceladas.
6. ✓ CLIENTE-2-importar — 32 novos, 16.996 atualizados, 28 contas criadas (backup)
7. ✓ PLANO-2-espelho-access e VENDA-1-espelho-access — Rotor 7.629, Ativo 11.510, Passivo 2.812,
    Despesas 2.713, Receitas 1.907; cupons 1.215, itens 3.517, títulos NF 10.577, OS 13.783/13.796
8. ✓ PLANO-8-importar-lancamentos — 6.979 boletas (47 saldo, 413 perda, 192 sobra, 6.327 comuns), 0 sem fechar.
    1ª rodada deixou 14 docs de fora (o Access não fecha: juros/centavos de recebimento, diferença de lote de
    cartão, fatura cartão-Jorge 1783, 2 OS R$ 1,00 com conta "0"; sobra R$ 1.383,36).
    **DECISÃO (19/10, Jorge): não corrigir pequenas diferenças do passado; o sistema novo é que não as permite.**
    → no dia D rodar com **`--conta-diferenca 4.04.001.002`** (o script cria "Diferenças da importação (Access)"):
    os 14 entram inteiros (banco e cliente iguais ao Access), só a sobra fica nessa conta.
    2ª simulação (19/10) com --conta-diferenca: 6.993 boletas, 14 com diferença, **0 de fora**.
    Conferidor (antes do --aplicar): D = 0, resto = 0 → "✓ a importação está fiel ao Access".
8b. **ENSAIO-2-limpar-testes** (NOVO) — ANTES do FLUXO-1. Apaga, com backup: boletas que não vieram do Access,
    vendas da plataforma, OS dessas vendas, fluxo VENDA/OS e TODO o fluxo ACCESS (o FLUXO-1 traz de novo);
    acerta a numeração da OS para a maior do Access. Para gravar exige `--base <nome da base>`.
    Venda com NF-e autorizada não é apagada (só com --com-nfe). Vizzo R$ 18.002 de 16/10 = teste (Jorge).
8b'. Rodar o ENSAIO-2 com **--orcamentos** (os ORCAMENTO da plataforma eram teste — Jorge, 19/10).
9. FLUXO-1-importar-fluxo-access **--com-orcamento** — fluxo de caixa do Access: pos 0, 2, 3 (programação de
    compras), 5 e 8 (orçamento projetado). Fora só o 7 (pedidos vêm do COMPRA-9, PEDIDO_IMPORTADO).
10. OS: numeração e OS abertas (OS-2 ...) — a definir
11. (feito no 8b) numeração real da NF-e segue a última do Access

## Passo 2 — conferência
`ENSAIO-1-conferir-balancete.js --mdb "..." --mes 10` (`--grupo 2` só Passivo; `--detalhe` tabela longa).
Lado Access confere com a tela do Access (Fornecedores out/2026 −522.579,65; Asia .056 −270.123,87; Rinnai .074 −188.397,29).
Desde 19/10 o conferidor explica cada diferença, documento por documento:
- A. contrapartida da migração (perda/sobra do ajuste de estoque; 4.04.001.002) — ESPERADO
  (1º ensaio: perda 833.821,78, sobra −130.264,91: no Access o ajuste tinha uma perna só)
- B. documento do Access que não entrou · C. boleta feita na plataforma (testes) · D. importado diferente (erro)
Meta: D = 0 e "resto" = 0 → "✓ a importação está fiel ao Access".
1º ensaio (19/10): 63 contas diferentes; as do saldo anterior batem com os 14 docs de fora (ex. 1.01.002.001
−56.211,51 = soma exata dos 7 recebimentos); as de outubro em 4.01/4.02/1.01.005/1.03.xxx = testes da plataforma.

Causa E (só data): Chaves 10 e 11 (cartão, 7.962,00 e 4.856,00) estão no Access em M=12, mas o Rotor é de janeiro;
a plataforma usa a data do Rotor. Saldo igual a partir de dezembro. Não corrigir (decisão de 19/10).

## ✓ RESULTADO DO 1º ENSAIO COMPLETO (19/10/2026, 07:46)
Sequência rodada: PLANO-8 --conta-diferenca 4.04.001.002 --aplicar (6.993 boletas) → ENSAIO-2 --aplicar --base
rotaes_ensaio --orcamentos --sem-loja (81 boletas, 43 vendas, 16 OS, 396 linhas de fluxo de teste; OS → 13853)
→ FLUXO-1 --com-orcamento --aplicar (261 linhas: pos0 59, pos2 85, pos3 20, pos5 25, pos8 72) → ENSAIO-1 --mes 10.
**Veredito: "✓ a importação está fiel ao Access"** — B 0 · C 0 · D 0 · resto 0. Bancos, clientes, fornecedores,
estoque, despesas e receitas de venda: iguais ao Access. Só as diferenças ESPERADAS:
- 3.08.001.001 Perda de estoque 833.821,78 e 4.04.001.001 Sobra −130.264,91 (ajuste de estoque de uma perna no Access)
- 4.03.002.013 −8.000,00 (receita de OS sem conta no Access, 18 docs) · 4.04.001.002 −1.383,36 (14 docs que não fechavam)
- E (só data): Chaves 10 e 11 em M=12 no Access, Rotor em janeiro.
Atenção no dia D: o PowerShell não aceita `node -e` com `$` dentro de aspas duplas.
A receber vencido desde 12/2025 (Ville 22.185,84, Luzineth, Gustavo Silva…) entra em aberto: rever depois.

## Passo 3 — testes reais na base de ensaio
Recebimentos (Vendas - receber), CSV do DDA (DDA - confere), DDA - paga, vendas e OS.

## Sistema robusto (para não repetir as diferenças do Access)
- Toda boleta fecha (débito = crédito) — já é regra da plataforma.
- Recebimento com valor ≠ título: Vendas - receber pede Juros/Desconto → configurar as contas
  `receber-juros` e `receber-desconto` ANTES do dia D (hoje estão vazias).
- Lote de cartão: a tela Cartões - recebimento (a fazer) deve fechar a diferença numa conta configurada.

## Novidades do ensaio (19/10)
- Vendas - receber: botão **Excluir do fluxo…** (título já recebido, sem lançamento, observação obrigatória,
  mostra o saldo da conta antes) e botão **Razão** (razão do cliente no ano, numa janela por cima).
- Títulos de 2025 que ficaram no fluxo na virada do ano (ex.: Alessandro 1683/1 e 1686/0, Luzineth, Ville, Gustavo):
  **excluir também no fluxo do Access** — no dia D o FLUXO-1 traz o fluxo do Access de novo e o que foi
  excluído só na base de ensaio voltaria.

## Pendências anotadas
- Komeco (NrFornec 67) "ajustar" no cadastro de fornecedores: completar (CNPJ) antes do dia D.
- Lançar no Access os itens das notas 288318, 293549, 320597, 188087 (opcional).
- Limpeza de preços no Access (VENDA-9) — confirmar se já feita.
- OS 13768 e 13769 (vendas 35/36): cortesia não aplicada.
- Contas de juros e desconto (★ Vendas - receber): escolhidas 19/10 — juros 4.03.001.002 Diversos, desconto 3.06.001.007
  Desconto sobre venda. Gravadas na base de ENSAIO: **repetir na base de verdade no dia D**.
- Trocar as senhas do usuário galinho (linhas do .env).
