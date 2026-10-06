# Varredura de `res.render` — caminhos a corrigir

Base: `views/`. Confronto entre o que as rotas pedem e o inventário real de views.

**Regra geral:** a pasta `views/pages/` não existe mais. Tudo que começa com
`pages/...` está quebrado. O padrão novo é `<área>/pages/<arquivo>`.

---

## PASSO 0 — Unificar as pastas de layout (fazer primeiro)

Existem duas: `views/_layout/` (a que o `server.js` usa) e `views/layout/`
(antiga, ainda referenciada). Mova os três arquivos, mantendo a subpasta:

```
views\layout\contab\login.handlebars         → views\_layout\contab\login.handlebars
views\layout\empresa\login.handlebars        → views\_layout\empresa\login.handlebars
views\layout\site\comercio\home.handlebars   → views\_layout\site\comercio\home.handlebars
```

Depois disso a pasta `views\layout` fica vazia e pode ser apagada.

Layouts válidos após a mudança:

```
central/pages/admin.handlebars
central/pages/login.handlebars
central/pages/segmento.handlebars
empresa/admin-empresa.handlebars
empresa/empresa-produto.handlebars
contab/login.handlebars
empresa/login.handlebars
site/comercio/home.handlebars
```

Não existe `main.handlebars`, embora o `server.js` declare
`defaultLayout: 'main'`. Todo render sem `layout:` explícito vai falhar.
Ou se cria um `_layout/main.handlebars`, ou se troca o default para `false`.

---

## CENTRAL

### usuario.js
| Linha | Está | Deve ser |
|---|---|---|
| 11 | `central/pages/loginCentral.handlebars` | ✅ já correto |
| 16 | `/central/pages/register.handlebars` | `central/pages/register.handlebars` (tirar a barra inicial) |
| 16 | layout `central/admin.handlebars` | `central/pages/admin.handlebars` |
| 98 | `pages/central/centralmenu.handlebars` | `central/pages/centralMenu.handlebars` ⚠ **M maiúsculo** |
| 99 | layout `central/admin.handlebars` | `central/pages/admin.handlebars` |

### menu-admin.js
| Linha | Está | Deve ser |
|---|---|---|
| 59-60 | — | ✅ já correto |
| 77 | `pages/central/register.handlebars` | `central/pages/register.handlebars` |
| 78 | layout `central/admin.handlebars` | `central/pages/admin.handlebars` |

### lojista.js
| Linha | Está | Deve ser |
|---|---|---|
| 46 | `central/pages/listaLojista.handlebars` | ✅ já correto |
| 55 | `pages/central/listaLojista.handlebars` | ⚠ **segundo render na mesma rota** — ver nota abaixo |
| 180 | `pages/central/cadastro-cooperado.handlebars` | `central/pages/cadastro-cooperado.handlebars` |
| 362 | `pages/central/editando-lojista` | `central/pages/editando-lojista.handlebars` |

⚠ Linhas 46 e 55: dois `res.render` seguidos. Quando o primeiro funcionar, o
segundo lança `Cannot set headers after they are sent`. Um dos dois é resto de
edição e precisa sair.

### rotacentral.js
| Linha | Está | Deve ser |
|---|---|---|
| 18 | `pages/central/listaSegmento` | `central/pages/listaSegmento.handlebars` |
| 18 | layout `central/segmento` | `central/pages/segmento.handlebars` |
| 249 | `produto-detalhe` | ⚠ **view não existe** em lugar nenhum |
| 263 | `pages/central/painel-depto_ativar.handlebars` | `central/pages/painel-depto_ativar.handlebars` |
| 264 | layout `central/segmento` | `central/pages/segmento.handlebars` |

### paineis.js / paineis-secoes.js
| Arquivo:linha | Está | Deve ser |
|---|---|---|
| paineis.js:92 | `pages/central/painel-setor` | `central/pages/painel-setor.handlebars` |
| paineis.js:93 | layout `central/segmento` | `central/pages/segmento.handlebars` |
| paineis-secoes.js:113 | `pages/central/painel-secoes` | `central/pages/painel-secoes.handlebars` |
| paineis-secoes.js:114 | layout `central/segmento` | `central/pages/segmento.handlebars` |

### home_layout_admin.js
| Linha | Está | Deve ser |
|---|---|---|
| 9 | `pages/central/admin-home-layout.handlebars` | `central/pages/admin-home-layout.handlebars` |

### atividades.js
| Linha | Está | Deve ser |
|---|---|---|
| 25 / 126 | `pages/central/atividades` | ⚠ **view não existe** — não há `atividades.handlebars` |
| 26 | layout `central/lojista` | ⚠ layout inexistente |
| 127 | layout `central/admin.handlebars` | `central/pages/admin.handlebars` |

---

## EMPRESA

### usuario.js
| Linha | Está | Deve ser |
|---|---|---|
| 27 | `empresas/pages/lojalogin.handlebars` | `empresa/pages/lojalogin.handlebars` (sem o "s") |
| 27 | layout `empresa/login` | ✅ válido **depois do passo 0** |

### rotina.js
| Linha | Está | Deve ser |
|---|---|---|
| 50 | `usuario/loginloja` | ⚠ não existe — provavelmente `empresa/pages/lojalogin.handlebars` |
| 50 | layout `admin.handlebars` | ⚠ não existe |
| 214 | `pages/contabil/cooperado_menu.handlebars` | `contab/contabil/cooperado_menu.handlebars` |
| 303 | `pages/empresa/produto_cadastro.handlebars` | `empresa/pages/produto_cadastro.handlebars` |
| 304 | layout `empresa/admin-empresa.handlebars` | ✅ correto |
| 360 | `pages/empresa/assistente_lojista` | `empresa/pages/assistente_lojista.handlebars` |
| 361 | layout `''` | `false` |

### fornecedores.js
| Linha | Está | Deve ser |
|---|---|---|
| 44 | `pages/empresa/cadfornecedores` | `empresa/pages/cadfornecedores.handlebars` |
| 245 | `pages/empresa/fornecedor_lista` | `empresa/pages/fornecedor_lista.handlebars` |
| 246 | layout `central/admin` | `empresa/admin-empresa.handlebars` (é tela de empresa) |
| 287 | `pages/empresa/cadfornecedores` | `empresa/pages/cadfornecedores.handlebars` |
| 288 | layout `central/admin` | `empresa/admin-empresa.handlebars` |

### produto_import.js
| Linha | Está | Deve ser |
|---|---|---|
| 390 / 484 | `pages/empresa/produto_import_itens` | `empresa/pages/produto_import_itens.handlebars` |
| 783 | `pages/empresa/produto_import_ajuste` | `empresa/pages/produto_import_ajuste.handlebars` |
| 1103 | `pages/empresa/cadfornecedores` | `empresa/pages/cadfornecedores.handlebars` |

### produto_cadastro.js / produtoeditimagem.js / lojistaAi.js / ajuste.js
| Arquivo:linha | Está | Deve ser |
|---|---|---|
| produto_cadastro.js:22 | `pages/empresa/produto_cadastro.handlebars` | `empresa/pages/produto_cadastro.handlebars` |
| produto_cadastro.js:23 | layout `''` | `false` |
| produtoeditimagem.js:99 | `pages/empresa/produtoedit_image.handlebars` | `empresa/pages/produtoedit_image.handlebars` |
| lojistaAi.js:3 | `pages/empresa/assistente_lojista` | `empresa/pages/assistente_lojista.handlebars` |
| lojistaAi.js:4 | layout `main` | ⚠ não existe — usar `false` |
| ajuste.js:164 | `pages/empresa/ajuste-lista.handlebars` | ⚠ **view não existe** |
| ajuste.js:165 | layout `empresa/admin-empresa.handlebars` | ✅ correto |

### upload_foto.js
| Linha | Está | Deve ser |
|---|---|---|
| 163 | `grafafoto/index` | ⚠ **view não existe** |

---

## SITE

Todas as views do site estão em `site/comercio/pages/`, `site/servico/pages/`
e `site/turismo/page/` — repare que **turismo é `page`, no singular**.

### auth.js
| Linha | Está | Deve ser |
|---|---|---|
| 43 | `pages/site/home` | `site/comercio/pages/home.handlebars` |
| 44 | `layout:flase` | `layout:false` ⚠ **erro de digitação** |
| 56 | `pages/site/login.handlebars` | `site/comercio/pages/login.handlebars` |
| 88, 103, 106, 121 | `pages/site/registrar-site.handlebars` | `site/comercio/pages/registrar-site.handlebars` |
| 148, 190 | `pages/site/home-logado` | `site/comercio/pages/home-logado.handlebars` |

### home.js
| Linha | Está | Deve ser |
|---|---|---|
| 254 | `pages/site/home.handlebars` | `site/comercio/pages/home.handlebars` |
| 291-292 | — | ✅ correto **depois do passo 0** |
| 362, 487, 1081, 1216 | `pages/site/home` | `site/comercio/pages/home.handlebars` |
| 363, 488, 502, 1082, 1096, 1217, 1233, 1306 | layout `site/home` | `site/comercio/home.handlebars` |
| 691 | `pages/site/seja-cooperado` | `site/comercio/pages/seja-cooperado.handlebars` |
| 724, 1383 | `pages/site/home-detalhe` | `site/comercio/pages/home-detalhe.handlebars` |
| 935, 1531 | `pages/site/home-page-exclusiva` | `site/comercio/pages/home-page-exclusiva.handlebars` |
| 1305 | `pages/site/parceiro` | `site/comercio/pages/parceiro.handlebars` |
| 1328 | `pages/site/catalogo` | `site/comercio/pages/catalogo.handlebars` |
| 1334 | `pages/site/admin-home-layout.handlebars` | ⚠ só existe em `central/pages/` — conferir se é a mesma tela |
| 1551 | `pages/site/servico/home-servico.handlebars` | `site/servico/pages/home-servico.handlebars` |
| 1564 | `pages/site/turismo/turismo-home.handlebars` | `site/turismo/page/turismo-home.handlebars` ⚠ **page singular** |

---

## CONTAB

Todos os renders do contab estão corretos. Foi a única área que terminou a
reestruturação. Única pendência:

| Arquivo:linha | Está | Observação |
|---|---|---|
| auxiliares/usuario.js:27 | layout `contab/login` | ✅ válido **depois do passo 0** |

---

## Resumo do que não é só caminho

1. **`views/layout` vs `views/_layout`** — passo 0, antes de tudo.
2. **`defaultLayout: 'main'` aponta para arquivo inexistente.**
3. **`lojista.js` tem dois `res.render` na mesma rota** (linhas 46 e 55).
4. **`layout:flase`** em `auth.js:44`.
5. **Views que não existem:** `pages/central/atividades`, `produto-detalhe`,
   `pages/empresa/ajuste-lista`, `grafafoto/index`, `usuario/loginloja`.
   Essas precisam de decisão: criar a view, apontar para outra ou remover a rota.
6. **`site/turismo/page`** está no singular, diferente de todo o resto.
7. **`centralMenu`** tem M maiúsculo. No Windows passa; em produção Linux, não.
