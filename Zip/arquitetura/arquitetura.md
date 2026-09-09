# Arquitetura do Módulo Financeiro — plataformaRota

> Documento de referência. Define a espinha dorsal do controle financeiro:
> Registros Contábeis (permanente) + Fluxo de Caixa (efêmero).
> Baseado no sistema legado de 1998, simplificado para MongoDB.

---

## 1. Filosofia central

O sistema separa **dois tipos de dados** com naturezas opostas:

### Registros Contábeis — a FONTE DA VERDADE (permanente)
Tudo o que realmente aconteceu na empresa fica registrado aqui, para sempre:
pagamentos, recebimentos, transferências bancárias, recebimento de cartões.
Esses dados nunca "morrem" — são o histórico contábil definitivo.

### Fluxo de Caixa — a FERRAMENTA DE DECISÃO (efêmero)
Um grid auxiliar que "vai morrendo junto com o mês". Não é fonte de verdade:
é uma **visão** que mistura o que já aconteceu com o que está projetado, para
o gestor decidir. Os registros nele vêm de outras operações (compras, vendas,
pessoal) e também aceitam lançamentos avulsos (lembretes).

```
PERMANENTE                          EFÊMERO
┌──────────────────────┐            ┌──────────────────────┐
│ Registros Contábeis  │            │   Fluxo de Caixa     │
│ (a verdade)          │ ──────────▶│   (a decisão)        │
│                      │  alimenta  │                      │
│ • Pagamentos         │            │ Grid mensal          │
│ • Recebimentos       │            │ Projeções + reais    │
│ • Transferências     │            │ "Morre" no fim do mês│
│ • Cartões            │            │                      │
└──────────────────────┘            └──────────────────────┘
        ▲                                     ▲
        │                                     │ lançamento avulso
   vem de Compras,                       (Pos 0 = lembrete)
   Vendas, Pessoal...
```

---

## 2. A regra de ouro do mês

O fluxo de caixa existe para garantir uma regra simples e poderosa:

```
Σ (Previsão de compras + Despesas fixas + Despesas variáveis)
                          ≤
              Média de vendas estimadas
```

Ou seja: **o que vou gastar não pode passar do que espero receber**. A projeção
de vendas é estimada com base nas vendas anteriores ou na média dos produtos.
Se a soma das saídas projetadas ultrapassa a projeção de vendas, o sistema
sinaliza que o mês fechará no vermelho — antes de acontecer. Sem surpresas.

---

## 3. O campo `pos` — orientador de operação

Cada linha do fluxo tem um número `pos` que **determina sua origem e orienta a
operação** disponível ao clicar. O significado de cada `pos` só vira código
quando criamos o menu/modal daquela operação — então o campo é flexível.

| pos | Significado | Origem | Ação ao clicar |
|-----|-------------|--------|----------------|
| 0 | Lançamento avulso | Manual | Lembrete (sem ação) |
| 1 | Cartão de crédito a receber | Transformação do 5 | Receber cartão |
| 2 | Compras realizadas (a pagar) | Módulo Compras | Fazer pagamento |
| 3 | Compras programadas futuras | Projeção (médias) | Listar projeção de compras |
| 5 | Título a receber | Módulo Vendas | Receber título |
| 8 | Orçamento a realizar | Orçamento (verde) | Listar orçamento do mês |

> Números livres (4, 6, 7, 9...) ficam reservados. Ex.: ao criar o módulo de
> Pessoal, a folha poderá entrar como `pos = 9`. Definimos na hora de criar a
> operação correspondente.

### Transformação de estado
Uma linha pode mudar de `pos` conforme a operação:
```
Título a receber (5)  ──[cliente paga no cartão]──▶  Cartão a receber (1)
```

---

## 4. Estrutura das tabelas (coleções MongoDB)

### 4.1 Registros Contábeis — `_reg_contabeis`

A fonte da verdade. Cada operação financeira efetiva vira um registro aqui.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| codigo | String | Sequencial (RC-0001) |
| tipo | String (enum) | PAGAMENTO, RECEBIMENTO, TRANSFERENCIA, CARTAO |
| data | Date | Data do fato |
| contaSubTitulo | ObjectId | Conta do Plano de Contas (NrCta) |
| contaBancaria | ObjectId | Conta bancária movimentada (opcional) |
| nrTitulo | String | NF/duplicata/parcela (1665/0-D) |
| historico | String | Descrição livre |
| valor | Number | Valor da operação |
| debito | Number | Valor a débito (partida dobrada) |
| credito | Number | Valor a crédito (partida dobrada) |
| cliente | ObjectId | Ref Cliente (se recebimento) |
| fornecedor | ObjectId | Ref Fornecedor (se pagamento) |
| contaContrapartida | ObjectId | Conta da outra ponta (C/Partida) |
| mes | Number | 1-12 |
| ano | Number | Ex: 2026 |
| conciliado | Boolean | Conferido com extrato |
| origem | String | COMPRAS, VENDAS, PESSOAL, MANUAL, ... |
| operador | String | Quem lançou (auditoria) |
| status | String | ATIVO, CANCELADO |

### 4.2 Fluxo de Caixa — `_fluxo_caixa`

O grid efêmero de decisão. Pode ser recalculado a partir dos registros e/ou
receber lançamentos avulsos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| data | Date | Data prevista/realizada |
| ord | Number | Ordenação na grid |
| pos | Number | Orientador de operação (ver seção 3) |
| contaSubTitulo | ObjectId | Conta do Plano de Contas (NrCta) |
| nrTitulo | String | NF/duplicata (1665/0-D) |
| historico | String | Descrição |
| vencimento | Date | Vencimento (Vect) |
| debito | Number | Saída prevista/real |
| credito | Number | Entrada prevista/real |
| titular | String | Nome do titular |
| cliente | ObjectId | Ref Cliente (opcional) |
| fornecedor | ObjectId | Ref Fornecedor (opcional) |
| registroContabil | ObjectId | Ref ao registro real (se já efetivado) |
| mes | Number | 1-12 |
| ano | Number | Ex: 2026 |
| realizado | Boolean | Já virou registro contábil? |
| projecao | Boolean | É projeção (pos 3, 8) ou real? |
| origem | String | De onde veio |
| status | String | ATIVO, CANCELADO |

---

## 5. Como os dados fluem

### Entrada automática (a maioria)
```
Lanço NF de compra (módulo Compras)
   ↓
Gera Registro Contábil (tipo PAGAMENTO, permanente)
   ↓
Espelha no Fluxo de Caixa (pos 2 = a pagar)
```

### Entrada manual (avulsa)
```
Digito direto no Fluxo (ex: "pagar contador dia 10")
   ↓
Cria linha no Fluxo com pos 0 (lembrete)
   ↓
Quando efetivar → vira Registro Contábil
```

### Projeção (orçamento e compras futuras)
```
Orçamento do mês → linhas pos 8 (verde) no Fluxo
Compras projetadas → linhas pos 3 no Fluxo
Esses NÃO são registros contábeis ainda — são projeção pura
```

---

## 6. Relação com módulos existentes e futuros

```
                    ┌─────────────────┐
                    │ Plano de Contas │ (já feito)
                    │  SubTítulos     │
                    └────────┬────────┘
                             │ NrCta
          ┌──────────────────┼──────────────────┐
          │                  │                  │
   ┌──────▼──────┐   ┌───────▼───────┐   ┌──────▼──────┐
   │  Clientes   │   │   Registros   │   │ Fornecedores│ (já feitos)
   │             │   │   Contábeis   │   │             │
   └─────────────┘   └───────┬───────┘   └─────────────┘
                             │ alimenta
                     ┌───────▼───────┐
                     │ Fluxo de Caixa│ (a fazer)
                     └───────────────┘
                             ▲
          ┌──────────────────┼──────────────────┐
   ┌──────┴──────┐   ┌───────┴───────┐   ┌──────┴──────┐
   │   Compras   │   │     Vendas    │   │   Pessoal   │ (futuro)
   │  (a fazer)  │   │   (a fazer)   │   │  (futuro)   │
   └─────────────┘   └───────────────┘   └─────────────┘
```

---

## 7. Roadmap de implementação

1. ✅ Plano de Contas, Clientes, Fornecedores, Bancos, Contas Bancárias
2. **Models: Registros Contábeis + Fluxo de Caixa** (este documento)
3. Cadastro de Produtos
4. Módulo Compras (gera registros + linhas pos 2/3 no fluxo)
5. Módulo Vendas (gera registros + linhas pos 5 no fluxo)
6. Orçamento Anual (gera linhas pos 8 no fluxo)
7. Tela do Fluxo de Caixa (grid + menu pop-up por linha)
8. Módulo Pessoal/Folha (pos 9)

---

*Documento vivo — atualizar conforme o projeto evolui.*
