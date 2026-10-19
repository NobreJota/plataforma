# Ficha de fechamento da OS — decisões (15 a 17/10/2026)

## Os 4 tipos de serviço (16/10/2026)
| Tipo | O que é | Abertura da OS | Valor do serviço |
|---|---|---|---|
| **VI** | venda + instalação, feitas juntas | no fechamento da nota fiscal | vem na nota, já dividido entre empresa e técnico |
| **C** | conserto de equipamento fora da garantia | página de **orçamento** (a fazer) | definido no orçamento |
| **G** | produto em garantia vendido pela loja | página de abertura própria (a fazer) | — |
| **S** | serviços: tubulação de água quente, troca de chaminé, engate de água… | mesmos moldes do C (a fazer) | definido no orçamento |

**Ordem combinada:** primeiro concluir a OS **VI**, sem se preocupar com as outras variáveis. C, G e S vêm depois.

## Duas "empresas"
1. **A que vende o aquecedor já com instalação (VI).** A mão de obra é cobrada **na venda**, junto com os produtos e no mesmo pagamento. Ela entra no **fluxo normal** e o valor **não muda** depois.
2. **A prestadora de serviço (C, S).** Conserto, chaminé, troca de peças, regulador, medidor de gás… A mão de obra e o consignado cobrado entram no **fluxo de serviço**, separado do fluxo normal.

## Mão de obra VI (revisto em 17/10/2026)
- **Dividida na venda.** No modal da instalação: mão de obra (cliente) + **parte do técnico (R$)**. O técnico já é definido no fechamento da nota (quem vendeu instala, ou pela divisão de quem faz o quê); pode mudar depois.
- **Na nota fiscal:** parte da **empresa** → receita **4.05.001.001** (chave `venda-mo-receita`); parte do **técnico** → **2.06.002.NNN** "a apropriar" do técnico (título `venda-mo-apropriar`, mesmo final da 2.06.001.NNN). Motivo: com OS não instaladas no fim do mês, a receita não fica inflada.
- **No fechamento da OS VI:** a parte do técnico sai da 2.06.002.NNN (D) para a **2.06.001.NNN** do técnico que fez a OS (C). Empresa/técnico vêm da venda e não se digitam na ficha.
- Parte do técnico 0 na venda (e vendas antigas): tudo na receita; divide na ficha como antes.
- Técnico novo no cadastro ganha também a 2.06.002.NNN.
- A ★ da venda fica no título do modal da instalação; a janela é a mesma da ficha (`/js/comum/config-contas.js`).
- A ficha do técnico tem só a lista de serviços (descrição), sem percentual nem valor fixo.
- **3.06.006.004 (material complementar) fica separada do CPV**: mostra o gasto adicional das instalações (que produto mais se usa, para acrescentar ao cliente na venda).

## Modal da OS
- Serve para editar técnico, dia/horário, observação e ponto de referência, e para controlar a saída de consignado.
- **Clicar no produto da lista já leva** a quantidade do campo ao lado. O mesmo produto soma na linha que já está com o técnico.
- O botão **Fechar** pergunta quando há alteração não gravada (OS concluída: só o X). O agendamento grava no **Gravar**; "Limpar dia e horário" tira o agendamento.
- Remarcar para outro dia apaga o término.
- O botão **Razão** mostra a conta do cliente. **Ver espelho** abre a ficha da OS fechada.
- O **Concluir serviço** abre a ficha de fechamento. Voltar dela sem gravar reabre o modal.
- Lista: saiu a aba "Concluídas"; a **Liquidadas** mostra as concluídas (com "a receber" quando ainda não recebida).

## Ficha de fechamento (VI)
- **Material vendido** (+ valor) e a faixa **saldo vendido** (vendido − devolvido).
- **Devolução de material vendido**: quantidade + valor; faixa **saldo a compensar [1]**. O material volta ao estoque.
- **Consignado**: esquerda = o que o técnico **levou**; direita = o que **devolveu** e o valor. A **diferença** (saldo a compensar) tem **um destino**: venda adicional (preço de venda, a receber + CPV a custo) · complementar (despesa a custo) · troca (sem lançamento; talvez saia).
- Devolução não aceita mais do que levou/vendeu. Caixas lado a lado com o mesmo número de linhas.
- **Término**: dia + hora de 30 em 30 min (07:00–19:00), nunca no futuro.
- **Caixa do término**: mão de obra (empresa/técnico), **mão de obra adicional** (valor + quem paga; Enter leva à observação), blocos **venda devolvida** (preço venda | custo que volta ao estoque), **venda de consignado**, **despesa complementar** (saldo | a custo) e **total a receber do cliente**.
- Saiu a caixa "Valor adicional" (do cliente/do técnico).
- **Gravar**: nada a receber → **liquidada**; senão "concluída · a receber" + linha no **fluxo de serviço**.
- **Espelho** (OS fechada): mesmo formato, com os totais e a faixa **Resultado da OS**. **Reabrir** desligado por enquanto (OS VI só se desfaz com o cancelamento da venda).

## Configuração de contas por chave
- Botão **★**: lista as operações da página, cada uma com a sua conta. Navegação no plano (Ativo/Passivo/Despesas/Receitas) ou busca. Trocar a conta vale só para os lançamentos **novos**; histórico gravado em `_config_contas`. Trava de "conta com movimento" suspensa.
- Ficha: `os-receita-servico` (4.05.001.001), `os-receita-material` (4.02.001.001), `os-cpv` (3.05.001.001), `os-material-complementar` (3.06.006.004), `os-estoque` (1.02.001.001), `os-devolucao-vendido` (padrão CPV), `os-mo-adicional-cortesia` (configurar).
- Venda: `venda-mo-receita` (4.05.001.001), `venda-mo-apropriar` (título 2.06.002).
- Motivo: o Jorge desenvolve em casa; na empresa precisa trocar conta sem VS Code nem deploy.

## Mão de obra adicional
- Valor + quem paga. Vai sempre para a conta do **técnico** (C). Cliente paga: entra no a receber. Empresa paga: débito na `os-mo-adicional-cortesia`.

## Depois
- Permissões (quem mexe no plano, no fluxo, na ★) — depois do dia "D".
- Levar a configuração de contas para compra e fluxo.
- Páginas de abertura de OS: C/S (orçamento) e G; fluxo de serviço para C/S.
