# RESUMO EXECUTIVO — Rotaes / plataformaRota · transporte nº 3

_Estado em 24/09/2026. Substitui o transporte nº 2._

---

## Ambiente

Monolito Node.js/Express/MongoDB/Handlebars em `C:\plataformaRota`, `localhost:5000`, nodemon.
Banco: MongoDB gerenciado DigitalOcean (`dbaas-db-9498210`). Conexão cai quando o IP do provedor
muda: cadastrar `45.187.251.0/24` em **Databases → cluster → Trusted Sources**.
Empresa de teste: Armação Comercial Ltda, `lojistaId = 6892706a86509313e632f717`.

**Sistema antigo (Access/VB5, 1997):** `C:\Armação\Dados\2026B\2026B.mdb` — atenção, **2026B é pasta**,
o arquivo está dentro. 106 MB, 296 tabelas, atualizado até **21/09/2026** (o transporte nº 2 dizia
que parava em maio; estava errado). Leitura por **`mdb-reader`** (npm), já instalado. Acentos vêm
corretos, sem mojibake.

Conexão nos scripts: `const { connectToDatabase, mongoose } = require(path.join(process.cwd(), 'database'))`.
Não existe `MONGODB_URI` no `.env` — a conexão vem sempre do módulo `database`.

---

## Módulo de compras — o que foi construído

Área nova `/compra`, registrada no `server.js` sob `ensureContab` (que expõe `req.lojistaId`),
ao lado de `/contab`, `/aux` e `/financeiro`. Menu do Cooperado: **Compra → Pedidos**.

```
src/models/compra/pedido.js          model do pedido (PP/P/L/S/C)
src/routes/compra/pages.js           tela + registro das APIs
src/routes/compra/pedido-api.js      fornecedores, grade, cabecalho, gravar
views/compra/pages/pedidos.handlebars
public/js/compra/pedidos.js
src/scripts/COMPRA-0-inspecionar-mdb.js       leitura do Access
src/scripts/COMPRA-1-conferir-media.js        conferencia das janelas
src/scripts/COMPRA-2-levantar-notas.js        notas, serie mensal, prazos
src/scripts/COMPRA-4-sincronizar-vendas.js    -> _venda_item_origem
src/scripts/COMPRA-5-sincronizar-produtos.js  -> _produto_origem
src/scripts/COMPRA-6-transportadoras.js       -> _transportadora_origem
```

`2C-0-sincronizar-indices.js` teve `'../models/compra/pedido'` acrescentado à lista `MODELS`
(a lista é escrita à mão; model novo não entra sozinho).

**O pedido funciona ponta a ponta:** escolhe fornecedor → janela 15/30/60/90 → grade com sugestão →
ajusta quantidade → aba Pedido Zero para encomenda especial → cabeçalho → títulos → grava.
Pedido nº 1 gravado e conferido no fluxo.

---

## Coleções novas (espelho do Access, nenhuma toca no que já existia)

| Coleção | Qtd | Origem |
|---|---|---|
| `_venda_item_origem` | 3164 | `Vendas_SaídaCupom` + `Itens`, ano 2026 |
| `_produto_origem` | 2759 | `PROD_Produto` + `PROD_Produto_Detalhes` |
| `_transportadora_origem` | 2 | `NFE_Cabeçalho` × `Compras_Transportadoras` |
| `_compra_pedidos` | — | pedidos emitidos na plataforma |

2025 ainda **não** foi sincronizado: não há cópia do `2025B.mdb` na máquina de trabalho.
O comando é `--ano 2025 --aplicar`; o índice único inclui o ano, então não colide.

---

## Descobertas que mudaram o desenho

### O `NrFornec` da venda está corrompido
Em **1872 das 3164** linhas de `Vendas_SaídaCupomItens`, a coluna `NrFornec` guarda o **código do
produto**. A relação produto→fornecedor sai **sempre** de `PROD_Produto` (espelhado em
`_produto_origem`), nunca da linha de venda. `PROD_Produto.NrFornec` está são: 90 fornecedores
distintos, números pequenos.

### A corrente que liga produto a fornecedor vigente
```
_produto_origem.nrFornec (67)
  -> _fornec_origem.chave "F67"          cadastro antigo, conta_antiga
    -> _mapa_contas.codigoAntigo         decisao do de/para
      -> codigoNovo  (acao "equivale")
        -> fornecs.vinculos[].ncontabil  <-- a conta mora NO VINCULO
```
**Armadilha:** `fornecs.ncontabil` na **raiz** é resto de migração e vem `"0.00.000.000"`.
A conta válida é a do vínculo da empresa. Vários `NrFornec` podem cair no mesmo fornecedor.

### Valores no fluxo: reais e positivos
`_fluxo_projetado.valor` guarda **reais**, **positivo**. O sinal de menos e a cor vermelha são da
tela, pela coluna. Custei um bug de fator 100 e sinal invertido para descobrir.
Já `_produto_origem` e `_compra_pedidos` usam **centavos**, como o resto da plataforma.
`PCusto` do Access vem em reais (18.78) e é multiplicado por 100 na sincronização.

### Códigos do campo `pos` / coluna T do fluxo
- **3** = compra programada (sugerida, ainda não pedida)
- **7** = pedido emitido, aguardando mercadoria
- **8** = orçamento anual, despesa administrativa
- **2** = obrigação a pagar (nasce quando a nota entra)
- **5** = título a receber (venda realizada, valor positivo)

A tela `/financeiro/fluxo` lê **`_fluxo_projetado`**, não `_fluxo_caixa` (essa está vazia e nunca
foi usada). O fluxo não é só projeção: é a ferramenta diária de pagamento, o coração da empresa.

### A fórmula do pedido
`Pedido = max(0, saída no período − estoque − a caminho)`, com corte em zero.
Confirmado contra `Compras_MédiaSintetizada` do Access.

**As tabelas `Compras_MédiaQuant` e `Compras_MédiaSintetizada` não são referência** — podem estar
erradas por digitação de código, desvio de estoque e roubo. Verdade é `Vendas_SaídaCupomItens`.
(A conferência mostrou que o sistema antigo trunca a varredura acima de 30 dias; assunto encerrado.)

### Modelo matemático: descartado
Cheguei a propor Poisson, nível de serviço por classe de giro, prazo por percentil. **Caiu tudo.**
A janela é decisão do usuário, por fornecedor, e é decisão de **caixa**, não de estoque: item de
giro alto se compra para 15 dias e se gira várias vezes dentro do prazo de pagamento do fornecedor;
item barato se compra para 90 para não ocupar a cabeça; na entrada do inverno se compra grande
porque a fábrica não entrega depois.

### Ordem de serviço não move estoque
`OrdemServiço_MaterialCupom` e afins são histórico de assistência: peça trocada, há quanto tempo,
preço cobrado. Só `Vendas_SaídaCupomItens` abate estoque.

### Frete
90% das notas de 2026 não têm transportadora: o frete é **CIF**, pago pelo fabricante. No cabeçalho
do pedido, CIF é o padrão e o select de transportadora só aparece no FOB. A escolha de verdade
acontece na **entrada da nota**, que é quando se sabe quem trouxe.

---

## Regras de negócio registradas

- **Produto com `Ativado = 0` nunca entra** em nada: obsoleto, fora de linha, não compensa
  comercialmente. Inclusão é manual, pelo Pedido Zero.
- **Pedido Zero** é a aba dos itens com sugestão zero, com busca por descrição e referência.
  Serve para encomenda especial: cliente pediu uma peça que não gira.
- **Fornecedor sem cadastro vigente não emite pedido.** A API recusa e o modal desabilita o botão
  com "Fornecedor não transferido". Evita pedido órfão e histórico partido.
- **Numeração:** pedidos da plataforma começam do 1; os importados do Access mantêm o número de lá.
- **O pedido não move estoque.** Quem move é a nota fiscal de entrada.
- **Ciclo do pedido:** `PP` pré-pedido · `P` pendente · `L` liquidado · `S` com saldo · `C` cancelado.
  Entrega parcial liquida o original com saldo e gera pedido novo herdando a condição de pagamento.
  Ou cancela o saldo e joga os itens num pré-pedido, puxado na próxima compra.
- **Entrega parcial rateia o fluxo:** 80% entregue vira obrigação a pagar, 20% segue como previsão.
- **Vencimentos contam da data de entrega prevista**, não da emissão. Marcada no calendário.
- **O custo é relido no servidor** na gravação; o navegador não decide valor.
- **Modelo 1 × Modelo 2 (decidido, não implementado):** gravar `modulos: { site, compras, contabil,
  fiscal }` no lojista, com Modelo 1 e 2 como presets na tela do Central. O ticket do site é o mesmo
  nos dois; muda só quem escuta depois. Sincronizador dividido em adaptador Access + serviço de
  ingestão, para outras cooperadas reusarem o contrato.
- **Estoque no site sempre sincronizado.** Sem saldo, o item não some: vira entrega futura, com
  previsão, em modal.
- **`arquivo_docs` é o arquivo único de produto/estoque** — site, cooperados e admin. O sincronizador
  deve fazer upsert por `(loja_id, codigo)` tocando **só** `qte`, `e_min`, `e_max`, `precocusto`;
  nunca a curadoria (`descricao`, `pageurls`, `localloja`, `similares`, preços de venda).
  **Ainda não implementado** — hoje a grade lê de `_produto_origem`.

---

## Pendências, em ordem

### 1. Tela de pedidos pendentes
Lista dos `P`, com **alterar data de entrega** (recalcula vencimentos e reescreve o fluxo) e
**cancelar** (situação `C`, linhas do fluxo saem, "a caminho" zera). Alterar quantidade e condição
de pagamento ficaram para depois, por decisão do usuário.

### 2. Entrada de nota fiscal
É onde o estoque sobe, a transportadora é escolhida, e o `pos 7` vira `pos 2`.
**Partir do modal "Realizar despesa administrativa"** já existente em `/financeiro/fluxo`
(código em `realizacao-api.js`): ele já faz projeção 8 → confirma → vira 2, com ajuste de valor e
documento. A compra acrescenta estoque e entrega parcial.

### 3. Vendas e ordem de serviço
Prioridade declarada pelo usuário depois da nota de entrada.

### 4. Limpezas e ajustes pequenos
- `fornecs.ncontabil` na raiz: trocar `"0.00.000.000"` por `""` (string vazia, **não** null —
  o schema é String e `.trim()` quebraria).
- Suspender a conta `2.01.001.007 Asia Impor. & Com. Ext. Ltda` (`ativo: false` em `_contasubtitulos`).
  Ela sobrou: a decisão virou equivalência para `2.01.001.010 Komlog`.
- Mesmo caso da `2.01.001.020 Eplax Soluções`, já registrada no transporte nº 2.
- Reapontar os 45 produtos da Asia Import (`nrFornec 67`) para o Komlog em `_produto_origem`,
  senão o rótulo continua vindo pelo caminho longo.
- `_fluxo_caixa`: coleção vazia e model `fluxoCaixa.js` sem uso aparente. Antes de remover,
  levantar quem lê o `POS` que ele exporta — e tirar a linha do `2C-0`.
- Renomear `_fluxo_projetado` foi cogitado: exige trocar o `collection:` no model e conferir todo
  o financeiro. Não fazer no meio de outra coisa.
- 404 de `/vendor/bootstrap/css/bootstrap.min.css` na tela de pedidos (o estilo é todo embutido;
  basta remover a linha).

### 5. Melhorias de tela levantadas
- Clicar no **T** do fluxo abre modal com o detalhe daquele tipo. Existe para o 8; falta para
  7, 3, 2 e 5.
- Janela **por item**, não só por fornecedor. O `baseCalculo` gravado em cada item do pedido já
  guarda a janela usada, então o modelo aguenta sem mudança.
- Campos vazios da ficha do fornecedor aparecem em cor forte (já feito no cabeçalho do pedido);
  estender para as outras fichas.

### 6. Etapa 2C e resto do transporte nº 2
Continuam de pé: filtro `lojistaId` nas rotas restantes, `correcoes-render.md` das áreas empresa
e site, importação dos lançamentos antigos, decisão 3 × 4 dígitos no subtítulo, itens de menu
sem rota, sessão em MemoryStore.

---

## Convenções do domínio (mantidas)

- **Sinais:** `+`/`−` = efeito no saldo. Ativo(+), Passivo(−), Despesa(+), Receita(−).
- **Boleta:** perna única (`banco*`) + N contrapartidas. `PAGAMENTO`, `RECEBIMENTO`, `SALDO_TRANSFERIDO`.
- **Não existe tabela de movimentação:** o movimento mora em `_boletas`.
- **Nada é apagado pelo usuário:** suspender (`ativo:false`). Migração controlada pode apagar, com backup.
- Backup em disco usa **EJSON** (JSON comum perde ObjectId e datas).
- No mongosh, coleções com underscore: `db.getCollection("_boletas")`.
- Dinheiro em **centavos**, inteiro — exceto `_fluxo_projetado`, que é reais.
- `1933-01-01` é o nulo de data do sistema antigo. `"0"` e `"0000"` são o vazio de texto.

## Como trabalhar comigo

- **Arquivo completo, nunca trecho para editar.** Editar pedaço gera conflito e custa tempo.
  Se o arquivo for grande demais e a mudança pequena, perguntar antes.
- Peça o arquivo atual antes de editar qualquer coisa já mexida à mão.
- Scripts sempre com simulação antes de `--aplicar`. Um comando por vez no PowerShell.
- No PowerShell, `dir /s` não funciona: use `Get-ChildItem -Recurse`.
- Não abrir CSV com CNPJ no Excel e salvar (vira notação científica).
- Arquivos entregues vão com o caminho de destino no cabeçalho.
- **Conferir `Length` do arquivo depois de salvar** — arquivo vazio de 0 byte já custou três rodadas.
  Ativar Auto Save no VS Code.
- Todo `<script src>` usa caminho completo (`/js/compra/pedidos.js`). Tela que "abre mas não faz
  nada" é 404 no log do nodemon.
- Não acumular duas frentes ao mesmo tempo, principalmente no fluxo.
