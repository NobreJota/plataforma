# Ficha de fechamento da OS — decisões (15 e 16/10/2026)

## Os 4 tipos de serviço (16/10/2026)
| Tipo | O que é | Abertura da OS | Valor do serviço |
|---|---|---|---|
| **VI** | venda + instalação, feitas juntas | no fechamento da nota fiscal | vem na nota; no fechamento só se divide entre empresa e técnico |
| **C** | conserto de equipamento fora da garantia | página de **orçamento** (a fazer) | definido no orçamento |
| **G** | produto em garantia vendido pela loja | página de abertura própria (a fazer) | — |
| **S** | serviços: tubulação de água quente, troca de chaminé, engate de água… | mesmos moldes do C (a fazer) | definido no orçamento |

**Ordem combinada:** primeiro concluir a OS **VI**, sem se preocupar com as outras variáveis. C, G e S vêm depois.

## Duas "empresas"
1. **A que vende o aquecedor já com instalação (VI).** A mão de obra é cobrada **na venda**, junto com os produtos e no mesmo pagamento. Ela entra no **fluxo normal** e o valor **não muda** depois.
2. **A prestadora de serviço (C, S).** Conserto, chaminé, troca de peças, regulador, medidor de gás… A mão de obra e o consignado cobrado entram no **fluxo de serviço**, separado do fluxo normal.

## Mão de obra VI
- No fechamento da nota, a mão de obra inteira entra como receita da empresa, na **4.05.001.001**. Não há conta provisória: a 2.06.002 (PLANO-10) não é usada.
- Na ficha de fechamento, o valor vem da venda e não se mexe. Informa-se **a parte da empresa**; o restante sai da 4.05.001.001 para a conta do técnico (2.06.001.NNN).
- VI sem mão de obra na venda: nada a dividir.
- A ficha do técnico tem só a lista de serviços (descrição), sem percentual nem valor fixo.

## Modal da OS
- Serve para editar técnico, dia/horário, observação e ponto de referência, e para controlar a saída de consignado.
- **Clicar no produto da lista já leva** a quantidade do campo ao lado. O mesmo produto soma na linha que já está com o técnico.
- O botão **Fechar** pergunta quando há alteração não gravada. O agendamento grava no **Gravar**; "Limpar dia e horário" tira o agendamento.
- Remarcar para outro dia apaga o término. Término antes do dia previsto não vale.
- O botão **Razão** mostra a conta do cliente (já pagou ou não; o técnico pode levar a máquina de cartão).
- O **Concluir serviço** abre a ficha de fechamento. Voltar dela sem gravar reabre o modal.

## Ficha de fechamento (VI)
- **Material vendido** (+ valor).
- **Devolução de material vendido**: quantidade + valor e total devolvido, e o material volta ao estoque. Sai como **troca** se algum consignado for troca; senão, como receita extra. A coluna tratamento (estorno etc.) foi tirada por enquanto.
- **Consignado usado**, sempre a **preço de venda**, com o destino escolhido na ficha:
  - **venda adicional**: preço de venda, a receber do cliente, + CPV a custo;
  - **complementar/cortesia**: despesa **a custo** na **3.06.006.004**;
  - **troca**: ficou no lugar de material vendido que voltou. Sem lançamento.
- **Devolução de consignado**: volta ao estoque.
- **Valor adicional**:
  - do técnico: débito na conta dele, que sai no pagamento de sexta;
  - do cliente: a receber.
- **Término + mão de obra** (empresa / técnico).
- **Gravar**: se não há nada a receber, a OS fica **liquidada**; senão, fica "concluída · a receber". **Reabrir** desfaz os lançamentos e as devoluções.
- **A confirmar:** a contrapartida do consignado (complementar e CPV) usa o estoque **1.02.001.001**.

## Depois
- Página de **configuração de contas por chave** (ideia do Jorge, ex. `vendaPrazo-debito`), no lugar das contas fixas no código. Fazer no final.
- Fluxo de serviço e recebimento (C, S e o "a receber" da VI).
- Páginas de abertura de OS: C/S (orçamento) e G.
