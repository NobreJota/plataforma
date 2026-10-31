# Dia "D" — ensaio (roteiro, 18/10 → 31/10/2026)

## ★ SIMULAÇÃO COMPLETA DO DIA D — 31/10/2026 ✓ "a importação está fiel ao Access"
Feita na PRÓPRIA `rotaes_ensaio` (decisão do Jorge), com o Access atualizado `C:\Armação\Dados\2026B\2026B.mdb` (dados até 30/10).
Resultado do ENSAIO-1 (mês 10): B 0 · C 0 · **D 0** · resto 0. Só A (migração, esperado: estoque 3.08.001.001 867.927,69 /
4.04.001.001 −135.460,51, 4.03.002.013 −8.000,00, 4.04.001.002 −1.383,36) e E (Chaves 10 e 11, só data).
Depois dela: **próxima venda 1311** (último cupom do Access 1310) · **próxima OS 13901** (maior OS do Access 13900).

Roteiro que funcionou (cada um: simulação, depois `--aplicar`; no PowerShell: `$MDB = "C:\Armação\Dados\2026B\2026B.mdb"`):
0. `ENSAIO-0-copiar-base --destino rotaes_ensaio_backup_3110` (o destino TEM que ter "ensaio"; NÃO trocar o .env no fim) — 105 coleções, 164.135 docs
1. COMPRA-5-sincronizar-produtos `--mdb $MDB` — 2.759 produtos
2. COMPRA-4-sincronizar-vendas `--mdb $MDB` — 3.713 itens (196 novos)
3. COMPRA-17-sincronizar-nfe `--mdb $MDB` — 211 notas, 776 itens; sem itens: 293549, 188087
4. COMPRA-15-produtos-para-cadastro `--limpar-plataforma --mdb $MDB` — nada a fazer (pular o aplicar)
5. COMPRA-22-atualizar-estoque-precos `--mdb $MDB` — estoque de 127 produtos volta ao do Access
6. COMPRA-9-importar-pedidos `--com-fluxo --mdb $MDB` (+ `--aplicar` no MESMO comando) — 7183 Westaflex, 7185 Komeco
7. COMPRA-23-conferir-pedidos (só lê) → COMPRA-24-fechar-pedidos (fechou 7169, 7175, 7176, 7178) → FLUXO-3 (nada)
8. CLIENTE-2-importar `--mdb $MDB` — 14 novos, 12 contas
9. PLANO-2-espelho-access e VENDA-1-espelho-access `--mdb $MDB`
10. **PLANO-12-contas-novas-do-access** (NOVO 31/10) — cria no plano as contas novas do Access (copia a "irmã" do título).
    Achado: 2.03.001.025 "Otávio Lessa" (criada no Access 21/10) faltava → os R$ 25.000 das Chaves 8636/8638 iam p/ diferença.
    **Rodar ANTES do PLANO-8.**
11. PLANO-8-importar-lancamentos `--conta-diferenca 4.04.001.002 --mdb $MDB` — 7.310 boletas (pode repetir: apaga e refaz as ACCESS)
12. **ENSAIO-2-limpar-testes** `--orcamentos --sem-loja` → `--aplicar --base rotaes_ensaio` (versão 31/10: apaga TODAS as OS
    da plataforma, inclusive as de conserto sem venda) — apagou boletas 42 · vendas 37 · OS 14 · fluxo 361
13. FLUXO-1-importar-fluxo-access `--com-orcamento --mdb $MDB` — 313 linhas (pos 0/2/5/7/8)
14. FLUXO-4-cartoes-pos6 `--base rotaes_ensaio` — nada: o Access não põe cartão no fluxo (usa Contab_Caixa_CartãoParcela,
    que nunca marca o pagamento); o saldo do cartão vem pelo razão (1.01.005.xxx)
15. PROG-2-espelho-notas `--mdb $MDB` — 465 notas, 104 fornecedores, 51 previsões
16. VENDA-11-importar-vendas-access `--mdb $MDB` — 1.277 vendas, R$ 3.050.072,88 (out: 140, R$ 485.575,32); cupons 1–5 desprezados
17. ENSAIO-1-conferir-balancete `--mdb $MDB --mes 10` — meta "✓ fiel ao Access"
Documentos "zerados" (632) que o PLANO-8 não lança: 600 EstoqueAjuste sem diferença, 7 MasterCard valor 0, ~25 OS valor 0.

## ★ DECISÃO 21/10/2026 (Jorge): a base de operação é `rotaes_ensaio`
MONGO_URI do app (king-prawn-app → App-Level Environment Variables) = rotaes_ensaio. A antiga `admin` fica guardada (NÃO apagar).
Desde 29/10 o localhost também usa `rotaes_ensaio` (decisão do Jorge: vê o que a empresa lança). No Dia D os passos acima rodam nela.
- ATENÇÃO: NÃO vender no Access e no site ao mesmo tempo — os dois dão o mesmo nº de cupom (o VENDA-11 deixaria o do Access de fora).
- Backups automáticos do DigitalOcean são do cluster inteiro.

## Pendências
- Komeco (NrFornec 67): completar cadastro (CNPJ) — o pedido 7185 entrou "sem cadastro".
- Lançar no Access os itens das notas 293549 (Komeco) e 188087 (opcional).
- Títulos de 2025 no fluxo (Ville, Luzineth, Alessandro, Gustavo): excluir também no Access.
- Trocar as senhas (DigitalOcean + .env + MONGO_URI do app).
- Ped_Previsão nº 300 (2009) no Access: apagar (opcional).
- OS: OS abertas do Access não são trazidas para a plataforma (só a numeração continua) — decidir antes do Dia D.
- Orçamentos do Access e vendas de 2025: não importados (decidir).
- Depois do Dia D: o grupo do produto do Access (grupoNome, ex. "Acabamentos") pode classificar o "Tipo" da comissão.
