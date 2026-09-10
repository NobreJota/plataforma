# PATCH 01 — índices dos models do contab

Objetivo: tirar os `unique` globais que impedem a segunda empresa de existir,
e de quebra matar os warnings de *Duplicate schema index*.

Ordem de execução:

1. Aplicar as edições abaixo nos 11 models
2. Rodar o diagnóstico (seção 4) — só pra confirmar que não há duplicata real
3. Copiar `2C-0-sincronizar-indices.js` para `src/scripts/` e rodar
4. Aplicar o patch do `server.js` (seção 5)
5. Substituir `rotina.js`

---

## 1. Os que trocam `unique` de campo por índice composto

Em cada um: **tire `unique: true` da linha do campo** e **acrescente o índice
composto** logo antes do `module.exports`.

### `contaTitulo.js`

Linha 14 — tirar o `unique`:

```js
codigo: { type: String, required: true, trim: true },   // "1.01.002"
```

Linha 37 — trocar:

```js
// era: ContaTituloSchema.index({ codigo: 1 }, { unique: true });
ContaTituloSchema.index({ lojistaId: 1, codigo: 1 }, { unique: true });
```

Esse arquivo era a fonte de um dos warnings: `codigo` estava declarado
`unique` no campo **e** de novo no `schema.index()`. Agora só existe um.

### `contaSubTitulo.js`

Linha 12 — tirar o `unique`:

```js
codigo: { type: String, required: true, trim: true },   // "1.01.002.001"
```

Antes do `module.exports` (o arquivo hoje não tem nenhum `.index()`):

```js
ContaSubTituloSchema.index({ lojistaId: 1, codigo: 1 }, { unique: true });
```

### `contaBancaria.js`

Linha 9 — tirar o `unique`. Acrescentar junto dos outros índices (linha 68):

```js
ContaBancariaSchema.index({ lojistaId: 1, codigo: 1 }, { unique: true });
```

### `boleta.js`

Linha 30 — tirar o `unique`. Acrescentar na linha 74:

```js
BoletaSchema.index({ lojistaId: 1, codigo: 1 }, { unique: true });
```

### `registroContabil.js`

Linha 8 — tirar o `unique`. Acrescentar na linha 90:

```js
RegistroContabilSchema.index({ lojistaId: 1, codigo: 1 }, { unique: true });
```

### `cliente.js` — este tem **dois**

Linha 16 e linha 20, tirar `unique` das duas:

```js
codigo:  { type: String, required: true, trim: true },
cpfCnpj: { type: String, required: true, set: v => apenasNumeros(v) },
```

Acrescentar na linha 52:

```js
ClienteSchema.index({ lojistaId: 1, codigo: 1 },  { unique: true });
ClienteSchema.index({ lojistaId: 1, cpfCnpj: 1 }, { unique: true });
```

O `cpfCnpj` global era o pior dos onze: hoje, se a Armação cadastra a
Papelaria como cliente, nenhuma outra empresa da plataforma consegue
cadastrar a mesma Papelaria. Duas empresas atendendo o mesmo cliente é o
caso normal, não a exceção.

### `orcamentoConta.js`

Linha 14 — tirar o `unique` do campo `contaSubTitulo`:

```js
contaSubTitulo: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'ContaSubTitulo',
  required: true
},
```

Acrescentar na linha 44:

```js
OrcamentoContaSchema.index({ lojistaId: 1, contaSubTitulo: 1 }, { unique: true });
```

### `compraFornecedor.js`

Linha 14 — tirar o `unique` do campo `fornecedor`:

```js
fornecedor: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'fornec',
  required: true
},
```

Acrescentar na linha 39:

```js
CompraFornecedorSchema.index({ lojistaId: 1, fornecedor: 1 }, { unique: true });
```

### `historicoConta.js`

Linha 39 — trocar:

```js
// era: HistoricoContaSchema.index({ codigoConta: 1, texto: 1 }, { unique: true });
HistoricoContaSchema.index({ lojistaId: 1, codigoConta: 1, texto: 1 }, { unique: true });
```

---

## 2. Os dois que também matam warning

### `orcamentoAnual.js`

Linha 37 — tirar `unique` **e** `index`:

```js
ano: { type: Number, required: true },
```

Linha 57 — trocar:

```js
// era: OrcamentoAnualSchema.index({ ano: 1 });
OrcamentoAnualSchema.index({ lojistaId: 1, ano: 1 }, { unique: true });
```

O `index: true` no campo mais o `.index({ ano: 1 })` embaixo eram índice
duplicado — segundo warning do nodemon.

### `compraAnual.js`

Idêntico. Linha 29:

```js
ano: { type: Number, required: true },
```

Linha 47:

```js
CompraAnualSchema.index({ lojistaId: 1, ano: 1 }, { unique: true });
```

Terceiro warning resolvido.

---

## 3. Os que não mudam

- **`banco.js`** — FEBRABAN, global de propósito. O `unique` no código do
  banco está certo: 341 é o Itaú para todo mundo.
- **`fluxoCaixa.js`** e **`fluxoProjetado.js`** — não têm `unique` nenhum.
  Os índices que existem são de performance, e ficam melhores com
  `lojistaId` na frente, mas isso é otimização, não correção. Deixa pra
  depois.

---

## 4. Diagnóstico antes de sincronizar

Antes de rodar o script, confirme que não existe duplicata real no que já
está no banco. Se existir, a criação do índice único falha e o script
aborta. No Compass (aba Shell) ou no mongosh:

```js
// deve devolver lista vazia em cada um
db._contatitulos.aggregate([
  { $group: { _id: { l: "$lojistaId", c: "$codigo" }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } }
]).toArray()

db._contasubtitulos.aggregate([
  { $group: { _id: { l: "$lojistaId", c: "$codigo" }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } }
]).toArray()

db._aux_clientes.aggregate([
  { $group: { _id: { l: "$lojistaId", c: "$cpfCnpj" }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } }
]).toArray()
```

Você já tem um `fix-duplicatas-clientes.js` em `src/scripts/` — se o de
clientes acusar algo, é ele que resolve.

Com uma empresa só no banco, a chance de duplicata é a mesma de antes, já
que o `unique` global era mais restritivo que o composto. Isso aqui é
conferência, não deve dar trabalho.

---

## 5. Patch do `server.js`

Duas mudanças. Primeira, importar o middleware junto das rotas — a linha
do `usuariocontab` já existe, o `opencontab` na linha seguinte monta o
mesmo router de novo em outra URL e pode sair:

```js
const usuariocontab = require('./src/routes/contab/auxiliares/rotina');
const { ensureContab } = require('./src/routes/contab/auxiliares/rotina');   // ← nova
// const opencontab = require('./src/routes/contab/auxiliares/rotina')       // ← apagar
```

Segunda, o portão nos três mounts:

```js
app.use('/usuariocontab', usuariocontab);
// app.use('/opencontab', opencontab);            ← apagar
app.use('/contab',     ensureContab, contabil);
app.use('/aux',        ensureContab, auxiliares);
app.use('/financeiro', ensureContab, financeiro);
```

São três linhas e elas fecham a área inteira: 153 queries em 19 arquivos
passam a ter `req.lojistaId` disponível, e ninguém entra sem sessão. As
rotas ainda vão ignorar o `req.lojistaId` até o 2C ser aplicado arquivo por
arquivo — mas a partir daqui o dado está lá, e nenhuma rota nova nasce
desprotegida.

Teste depois de aplicar: abrir `/contab/plano` numa aba anônima tem que
cair no login. Logado, tem que abrir normal.

---

## 6. O que este patch **não** resolve

O `unique` composto protege contra gravar código repetido. Ele não impede
a empresa B de **ler** o registro da empresa A — isso são as 25
ocorrências de `findById(req.params.id)`, que viram
`findOne({ _id: req.params.id, lojistaId: req.lojistaId })` no 2C.

E os três `proximoCodigo()` (clientes, contas-bancarias, plano-api) ainda
varrem a coleção inteira pra achar o último código. Com o índice composto
no lugar, a empresa B não vai mais dar erro de duplicata — mas vai começar
a numerar de onde a empresa A parou. Também é 2C.
