// src/routes/contab/contabil/plano-api.js
// Alterado em: 02/10/2026 - GET /busca-subtitulos/:subGrupoId?q= : procura subtitulos
//   em TODOS os titulos de um subgrupo (nome ou codigo). Sem q, devolve so o total,
//   que a tela usa para decidir se mostra a caixa de busca.
// API JSON do Plano de Contas
// Endpoints publicados: /contab/api/grupos, /subgrupos, /titulos, /subtitulos
// (o prefixo /contab/api é definido pelo pages.js e pelo server.js)

const express = require('express');
const router  = express.Router();

// AJUSTE DE CAMINHO: 3 níveis pra sair até /src/models
// (era ../../ antes; agora precisa de mais um ../ porque a pasta foi movida
//  para dentro de src/routes/contab/contabil/)
const Grupo          = require('../../../models/grupo');
const SubGrupo       = require('../../../models/grupoSub');
const ContaTitulo    = require('../../../models/contab/financeiro/contaTitulo');
const ContaSubTitulo = require('../../../models/contab/financeiro/contaSubTitulo');

// A regra de movimento e de suspensão mora em src/utils/contab/movimentoConta.js.
// Saiu daqui porque o cadastro de fornecedor faz a mesma pergunta antes de
// desvincular a conta, e duas cópias da regra acabariam divergindo.
const { temMovimento, podeSuspender } = require('../../../utils/contab/movimentoConta');

// Fornecedor não se cadastra pelo plano: o subtítulo nasce no cadastro de
// fornecedor, que escolhe o título. Por isso a inserção manual sob 2.01 é
// recusada aqui.
const { GRUPO_FORNECEDORES } = require('../../../utils/contab/contaFornecedor');

/* As telas do plano agora mostram tambem as contas suspensas, em cor
   diferente, para o usuario poder reativar no proprio lugar onde a conta
   estava. Quando ?somenteAtivas=true vier na URL, volta ao comportamento
   antigo — util para combos de lancamento, onde conta suspensa nao pode
   aparecer como opcao. */
function filtroAtivo(req) {
  return req.query.somenteAtivas === 'true' ? { ativo: true } : {};
}

/* =========================================================
   HELPERS - Próximo código sequencial
   ========================================================= */

async function proxCodigoContaTitulo(subGrupoId, codigoSubGrupo, lojistaId) {
  const ultimo = await ContaTitulo.findOne({ subGrupoId, lojistaId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoSubGrupo}.001`;
  const seq = parseInt(ultimo.codigo.split('.')[2], 10) + 1;
  return `${codigoSubGrupo}.${String(seq).padStart(3, '0')}`;
}

async function proxCodigoContaSubTitulo(contaTituloId, codigoContaTitulo, lojistaId) {
  const ultimo = await ContaSubTitulo.findOne({ contaTituloId, lojistaId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoContaTitulo}.001`;
  const seq = parseInt(ultimo.codigo.split('.')[3], 10) + 1;
  return `${codigoContaTitulo}.${String(seq).padStart(3, '0')}`;
}

// Retorna as sequências (números) já usadas sob um título.
// Inclui inativos também, para NÃO reaproveitar códigos que já existiram fisicamente.
async function sequenciasUsadas(contaTituloId, lojistaId) {
  const todos = await ContaSubTitulo.find({ contaTituloId, lojistaId }).select('codigo').lean();
  const usadas = new Set();
  todos.forEach(s => {
    const partes = (s.codigo || '').split('.');
    const seq = parseInt(partes[3], 10);
    if (!isNaN(seq)) usadas.add(seq);
  });
  return usadas;
}

// Primeira sequência livre (reaproveita furos: 004, 005...).
function primeiraLivre(usadas) {
  let n = 1;
  while (usadas.has(n)) n++;
  return n;
}

// Próxima sequência livre acima de um valor (pula as ocupadas).
function proximaLivreAcima(usadas, atual) {
  let n = atual + 1;
  while (usadas.has(n)) n++;
  return n;
}

// Sequência livre anterior a um valor (pula as ocupadas). Não desce abaixo de 1.
function anteriorLivre(usadas, atual) {
  let n = atual - 1;
  while (n >= 1 && usadas.has(n)) n--;
  return n >= 1 ? n : atual; // se não houver livre abaixo, mantém
}

/* =========================================================
   NÍVEL 1: GRUPOS (somente leitura)
   ========================================================= */
router.get('/grupos', async (req, res) => {
  try {
    const grupos = await Grupo.find({ ativo: true }).sort({ codigo: 1 });
    res.json(grupos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 2: SUBGRUPOS

   SubGrupo é POR EMPRESA (Etapa 2C): cada empresa tem os seus, e o código só
   é único dentro dela. Os Grupos (1 a 4) continuam comuns, porque são
   fundamento contábil e não variam por cliente.

   Mas aqui o subgrupo é SOMENTE LEITURA: quem cria, renomeia e suspende é a
   administração da plataforma, em /central/plano/estrutura. Se cada cooperada
   criasse os seus livremente, uma chamaria 2.02 de "fornecedores diversos" e
   outra de "despesas gerais", e os relatórios deixariam de ser comparáveis.
   A empresa cria títulos e subtítulos dentro da estrutura recebida.
   ========================================================= */

const ESTRUTURA_ADMIN =
  'Os subgrupos são definidos pela administração da plataforma. Crie títulos e ' +
  'subtítulos dentro do subgrupo, ou peça a inclusão de um novo subgrupo.';

router.get('/subgrupos/:grupoId', async (req, res) => {
  try {
    const subs = await SubGrupo
      .find({ grupoId: req.params.grupoId, lojistaId: req.lojistaId, ...filtroAtivo(req) })
      .sort({ codigo: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Somente leitura no contab: ver ESTRUTURA_ADMIN acima.
router.post('/subgrupos', (req, res) => res.status(403).json({ erro: ESTRUTURA_ADMIN }));

router.put('/subgrupos/:id', (req, res) => res.status(403).json({ erro: ESTRUTURA_ADMIN }));

/* GET /contab/api/pode-suspender/:nivel/:id
   Consultado pela tela antes de abrir a caixa de confirmação, para o usuário
   não confirmar uma ação que já se sabe que vai ser recusada. */
router.get('/pode-suspender/:nivel/:id', async (req, res) => {
  try {
    if (req.params.nivel === 'subgrupo') return res.json({ pode: false, erro: ESTRUTURA_ADMIN });
    const r = await podeSuspender(req.params.nivel, req.params.id, req.lojistaId);
    res.json({ pode: r.ok, erro: r.erro || null });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/subgrupos/:id', (req, res) => res.status(403).json({ erro: ESTRUTURA_ADMIN }));

/* =========================================================
   NÍVEL 3: CONTAS TÍTULO
   ========================================================= */
router.get('/titulos/:subGrupoId', async (req, res) => {
  try {
    const titulos = await ContaTitulo
      .find({ subGrupoId: req.params.subGrupoId, lojistaId: req.lojistaId, ...filtroAtivo(req) })
      .sort({ codigo: 1 });
    res.json(titulos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/titulos', async (req, res) => {
  try {
    const { subGrupoId, nome, descricao, aceitaLancamento } = req.body;
    if (!subGrupoId || !nome) {
      return res.status(400).json({ erro: 'subGrupoId e nome são obrigatórios.' });
    }
    const sub = await SubGrupo.findOne({ _id: subGrupoId, lojistaId: req.lojistaId });
    if (!sub) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });

    const codigo = await proxCodigoContaTitulo(subGrupoId, sub.codigo, req.lojistaId);
    const novo = await ContaTitulo.create({
      subGrupoId,
      codigoSubGrupo: sub.codigo,
      codigo,
      nome,
      descricao: descricao || '',
      aceitaLancamento: aceitaLancamento ?? false,
      lojistaId: req.lojistaId      // 2C: sem isto o título nasce sem dono
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Título já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

router.put('/titulos/:id', async (req, res) => {
  try {
    const { nome, descricao, aceitaLancamento } = req.body;
    const upd = await ContaTitulo.findOneAndUpdate(
      { _id: req.params.id, lojistaId: req.lojistaId },
      { nome, descricao, aceitaLancamento },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Título não encontrado.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* SUSPENDER conta-título (mesma regra do subgrupo). */
router.delete('/titulos/:id', async (req, res) => {
  try {
    const r = await podeSuspender('titulo', req.params.id, req.lojistaId);
    if (!r.ok) return res.status(r.status).json({ erro: r.erro });

    r.doc.ativo = false;
    await r.doc.save();
    res.json({ ok: true, inativado: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 4: SUB-TÍTULOS
   ========================================================= */
router.get('/busca-subtitulos/:subGrupoId', async (req, res) => {
  try {
    const titulos = await ContaTitulo
      .find({ subGrupoId: req.params.subGrupoId, lojistaId: req.lojistaId })
      .select('_id codigo nome');
    const ids = titulos.map(t => t._id);
    const q = String(req.query.q || '').trim();

    if (q.length < 2) {
      const total = await ContaSubTitulo.countDocuments({ contaTituloId: { $in: ids }, lojistaId: req.lojistaId });
      return res.json({ total });
    }

    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const achados = await ContaSubTitulo
      .find({ contaTituloId: { $in: ids }, lojistaId: req.lojistaId, $or: [{ nome: rx }, { codigo: rx }] })
      .sort({ nome: 1 }).limit(60)
      .select('_id codigo nome ativo contaTituloId codigoContaTitulo');
    res.json({ itens: achados, limite: 60 });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/subtitulos/:contaTituloId', async (req, res) => {
  try {
    const subs = await ContaSubTitulo
      .find({ contaTituloId: req.params.contaTituloId, lojistaId: req.lojistaId, ...filtroAtivo(req) })
      .sort({ codigo: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* STEPPER: estado dos códigos de um título.
   GET /contab/api/subtitulos-codigos/:contaTituloId
   Retorna: codigoBase, usadas[], sugestao (1ª livre), proximoCodigo formatado. */
router.get('/subtitulos-codigos/:contaTituloId', async (req, res) => {
  try {
    const tit = await ContaTitulo.findOne({ _id: req.params.contaTituloId, lojistaId: req.lojistaId }).lean();
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    const usadas = await sequenciasUsadas(req.params.contaTituloId, req.lojistaId);
    const usadasArr = Array.from(usadas).sort((a, b) => a - b);
    const sugestao = primeiraLivre(usadas);

    res.json({
      codigoBase: tit.codigo,                       // ex: 1.01.002
      usadas: usadasArr,                            // ex: [1,2,3,6]
      sugestao,                                     // ex: 4
      codigoSugerido: `${tit.codigo}.${String(sugestao).padStart(3, '0')}`
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* STEPPER: navega para a próxima sequência livre (▲) ou anterior (▼).
   GET /contab/api/subtitulos-codigos/:contaTituloId/navegar?atual=4&dir=up|down
   Retorna a próxima sequência LIVRE (pulando ocupadas). */
router.get('/subtitulos-codigos/:contaTituloId/navegar', async (req, res) => {
  try {
    const tit = await ContaTitulo.findOne({ _id: req.params.contaTituloId, lojistaId: req.lojistaId }).lean();
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    const usadas = await sequenciasUsadas(req.params.contaTituloId, req.lojistaId);
    const atual = parseInt(req.query.atual, 10) || primeiraLivre(usadas);
    const dir = req.query.dir === 'down' ? 'down' : 'up';

    const nova = dir === 'up' ? proximaLivreAcima(usadas, atual) : anteriorLivre(usadas, atual);
    res.json({
      seq: nova,
      codigo: `${tit.codigo}.${String(nova).padStart(3, '0')}`,
      ocupada: usadas.has(nova)   // sempre false (já pulamos), mas devolve por garantia
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* STEPPER: valida se uma sequência está livre (segurança ao salvar).
   GET /contab/api/subtitulos-codigos/:contaTituloId/checar?seq=4 */
router.get('/subtitulos-codigos/:contaTituloId/checar', async (req, res) => {
  try {
    const usadas = await sequenciasUsadas(req.params.contaTituloId, req.lojistaId);
    const seq = parseInt(req.query.seq, 10);
    res.json({ seq, livre: !usadas.has(seq) });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* Consulta se um SUBTÍTULO já existente tem movimento (para a tela decidir
   se libera ou bloqueia a edição do número).
   GET /contab/api/subtitulo/:id/movimento */
router.get('/subtitulo/:id/movimento', async (req, res) => {
  try {
    const sub = await ContaSubTitulo.findOne({ _id: req.params.id, lojistaId: req.lojistaId }).lean();
    if (!sub) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });
    const mov = await temMovimento(sub, req.lojistaId);
    res.json({ codigo: sub.codigo, temMovimento: mov.tem, motivo: mov.motivo || '' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/subtitulos', async (req, res) => {
  try {
    const {
      contaTituloId, nome, descricao,
      saldoInicial, natureza,
      seqEscolhida           // (opcional) sequência escolhida no stepper
    } = req.body;
    // Nota: campos banco/agencia/conta foram removidos na Fase A da nossa
    // conversa (viraram responsabilidade de _aux_contas_bancarias).

    if (!contaTituloId || !nome || !natureza) {
      return res.status(400).json({
        erro: 'contaTituloId, nome e natureza são obrigatórios.'
      });
    }
    const tit = await ContaTitulo.findOne({ _id: contaTituloId, lojistaId: req.lojistaId });
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    // Fornecedor não se cadastra pelo plano. A conta dele nasce no cadastro de
    // fornecedor, que escolhe o título e segue a sequência — se pudesse nascer
    // aqui também, existiria conta de fornecedor sem fornecedor.
    if (String(tit.codigo).startsWith(GRUPO_FORNECEDORES + '.')) {
      return res.status(409).json({
        erro: 'Conta de fornecedor não se cria pelo plano. Use Auxiliares → Fornecedores: ' +
              'ao cadastrar, escolha o título e a conta é criada automaticamente.'
      });
    }

    // Define o código: se o stepper enviou uma sequência, valida que está livre.
    let codigo;
    if (seqEscolhida != null && !isNaN(parseInt(seqEscolhida, 10))) {
      const seq = parseInt(seqEscolhida, 10);
      const usadas = await sequenciasUsadas(contaTituloId, req.lojistaId);
      if (usadas.has(seq)) {
        // Segurança real: não grava duplicata, mesmo que o front tenha falhado.
        return res.status(409).json({
          erro: `O código ${tit.codigo}.${String(seq).padStart(3,'0')} já está em uso. Escolha outro.`
        });
      }
      codigo = `${tit.codigo}.${String(seq).padStart(3, '0')}`;
    } else {
      // Sem escolha do stepper: usa a primeira livre (reaproveita furos)
      const usadas = await sequenciasUsadas(contaTituloId, req.lojistaId);
      const livre = primeiraLivre(usadas);
      codigo = `${tit.codigo}.${String(livre).padStart(3, '0')}`;
    }

    const novo = await ContaSubTitulo.create({
      contaTituloId,
      codigoContaTitulo: tit.codigo,
      codigo,
      nome,
      descricao:    descricao || '',
      saldoInicial: saldoInicial || 0,
      natureza,
      lojistaId: req.lojistaId      // 2C
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Subtítulo já existe (código duplicado).' });
    res.status(500).json({ erro: err.message });
  }
});

router.put('/subtitulos/:id', async (req, res) => {
  try {
    const {
      nome, descricao, saldoInicial, natureza,
      seqEscolhida    // (opcional) nova sequência do código, vinda do stepper
    } = req.body;

    const atual = await ContaSubTitulo.findOne({ _id: req.params.id, lojistaId: req.lojistaId });
    if (!atual) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });

    const update = { nome, descricao, saldoInicial, natureza };

    // Se o usuário quer MUDAR O NÚMERO (seqEscolhida), aplica a regra de ouro:
    if (seqEscolhida != null && !isNaN(parseInt(seqEscolhida, 10))) {
      const novaSeq = parseInt(seqEscolhida, 10);
      const seqAtual = parseInt((atual.codigo || '').split('.')[3], 10);

      if (novaSeq !== seqAtual) {
        // 1) Conta com movimento NÃO pode ter o número alterado
        const mov = await temMovimento(atual, req.lojistaId);
        if (mov.tem) {
          return res.status(409).json({
            erro: `Não é possível alterar o número: esta conta tem movimento (${mov.motivo}). ` +
                  `Transfira os valores para outra conta antes de alterar o número.`
          });
        }
        // 2) Novo número não pode já estar em uso
        const usadas = await sequenciasUsadas(atual.contaTituloId, req.lojistaId);
        if (usadas.has(novaSeq)) {
          return res.status(409).json({
            erro: `O código ${atual.codigoContaTitulo}.${String(novaSeq).padStart(3,'0')} já está em uso.`
          });
        }
        update.codigo = `${atual.codigoContaTitulo}.${String(novaSeq).padStart(3, '0')}`;
      }
    }

    const upd = await ContaSubTitulo.findOneAndUpdate(
      { _id: req.params.id, lojistaId: req.lojistaId }, update,
      { new: true, runValidators: true }
    );
    res.json(upd);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Código já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

/* SUSPENDER sub-título. */
router.delete('/subtitulos/:id', async (req, res) => {
  try {
    const r = await podeSuspender('subtitulo', req.params.id, req.lojistaId);
    if (!r.ok) return res.status(r.status).json({ erro: r.erro });

    r.doc.ativo = false;
    await r.doc.save();
    res.json({ ok: true, inativado: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   CONTAS SUSPENSAS  (listar e reativar)

   Como nada mais é apagado de verdade, precisa existir um caminho de volta
   pela tela — senão a única saída seria abrir o Compass, o que não serve
   para o usuário final.
   ========================================================= */

// O termo digitado vira uma expressão regular. Sem escapar, um ponto (que o
// usuário digita naturalmente ao buscar "3.01") casaria com qualquer caractere,
// e um parêntese quebraria a regex e derrubaria a rota com erro 500.
function regexBusca(termo) {
  const limpo = String(termo || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(limpo, 'i');
}

/* GET /contab/api/suspensas?busca=pap
   Devolve os três níveis do plano numa lista só, já achatada, para a tela
   não precisar saber de hierarquia. */
router.get('/suspensas', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim();

    // Busca vazia devolve tudo; com texto, filtra por código ou nome.
    // Busca pelo NOME da conta. O código também é aceito porque não atrapalha
    // e às vezes o usuário lembra dele.
    const filtro = { ativo: false };
    if (busca) {
      const rx = regexBusca(busca);
      filtro.$or = [{ nome: rx }, { codigo: rx }];
    }

    const daEmpresa = { ...filtro, lojistaId: req.lojistaId };
    const [subgrupos, titulos, subtitulos] = await Promise.all([
      SubGrupo.find(daEmpresa).sort({ codigo: 1 }).limit(200).lean(),
      ContaTitulo.find(daEmpresa).sort({ codigo: 1 }).limit(200).lean(),
      ContaSubTitulo.find(daEmpresa).sort({ codigo: 1 }).limit(200).lean()
    ]);

    const lista = [
      ...subgrupos.map(x  => ({ nivel: 'subgrupo',  rotulo: 'SubGrupo',     _id: x._id, codigo: x.codigo, nome: x.nome })),
      ...titulos.map(x    => ({ nivel: 'titulo',    rotulo: 'Conta-título', _id: x._id, codigo: x.codigo, nome: x.nome })),
      ...subtitulos.map(x => ({ nivel: 'subtitulo', rotulo: 'Sub-título',   _id: x._id, codigo: x.codigo, nome: x.nome }))
    ].sort((a, b) => a.codigo.localeCompare(b.codigo));

    res.json(lista);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* POST /contab/api/suspensas/:nivel/:id/reativar */
router.post('/suspensas/:nivel/:id/reativar', async (req, res) => {
  try {
    const { nivel, id } = req.params;

    if (nivel === 'subgrupo') return res.status(403).json({ erro: ESTRUTURA_ADMIN });

    if (nivel === 'titulo') {
      const ct = await ContaTitulo.findOne({ _id: id, lojistaId: req.lojistaId });
      if (!ct) return res.status(404).json({ erro: 'Título não encontrado.' });

      // Reativar um filho sem reativar o pai deixaria a conta "viva" mas
      // invisível: as telas navegam de cima para baixo e nunca chegariam nela.
      const pai = await SubGrupo.findOne({ _id: ct.subGrupoId, lojistaId: req.lojistaId }).lean();
      if (pai && !pai.ativo) {
        return res.status(409).json({
          erro: `Reative antes o subgrupo ${pai.codigo} - ${pai.nome}.`
        });
      }

      ct.ativo = true;
      await ct.save();
      return res.json({ ok: true, conta: `${ct.codigo} - ${ct.nome}` });
    }

    if (nivel === 'subtitulo') {
      const st = await ContaSubTitulo.findOne({ _id: id, lojistaId: req.lojistaId });
      if (!st) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });

      const pai = await ContaTitulo.findOne({ _id: st.contaTituloId, lojistaId: req.lojistaId }).lean();
      if (pai && !pai.ativo) {
        return res.status(409).json({
          erro: `Reative antes a conta-título ${pai.codigo} - ${pai.nome}.`
        });
      }
      if (pai) {
        const avo = await SubGrupo.findOne({ _id: pai.subGrupoId, lojistaId: req.lojistaId }).lean();
        if (avo && !avo.ativo) {
          return res.status(409).json({
            erro: `Reative antes o subgrupo ${avo.codigo} - ${avo.nome}.`
          });
        }
      }

      st.ativo = true;
      await st.save();
      return res.json({ ok: true, conta: `${st.codigo} - ${st.nome}` });
    }

    return res.status(400).json({ erro: 'Nível inválido.' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
