// src/routes/contab/contabil/plano-api.js
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

// Models financeiros, usados para detectar movimento na conta.
// ATENÇÃO: o caminho certo passa por /contab/. Antes estava
// '../../../models/financeiro/boleta', que não existe — e como o require
// ficava dentro de um try/catch vazio, falhava calado: Boleta virava null e
// a checagem de movimento em boletas nunca chegou a acontecer.
// Agora o require é direto: se o caminho quebrar, o servidor reclama na hora
// em vez de deixar passar uma conta que tem lançamento.
const Boleta         = require('../../../models/contab/financeiro/boleta');
const FluxoProjetado = require('../../../models/contab/financeiro/fluxoProjetado');

/* Detecta se um subtítulo TEM MOVIMENTO de valores.
   Movimento = aparece em boletas (banco/contrapartida) OU no fluxo OU saldo inicial ≠ 0.
   Regra contábil: conta com movimento não pode ter o número editado nem ser deletada
   — primeiro é preciso transferir os valores para outra conta. */
async function temMovimento(subtitulo) {
  if (!subtitulo) return false;
  const codigo = subtitulo.codigo;

  // Saldo inicial diferente de zero já é "movimento"
  if (subtitulo.saldoInicial && Number(subtitulo.saldoInicial) !== 0) {
    return { tem: true, motivo: 'saldo inicial diferente de zero' };
  }

  // Aparece em alguma boleta? (como banco ou contrapartida)
  const naBoleta = await Boleta.countDocuments({
    $or: [
      { bancoCodigo: codigo },
      { 'contrapartidas.codigoConta': codigo }
    ]
  });
  if (naBoleta > 0) return { tem: true, motivo: `${naBoleta} lançamento(s) em boletas` };

  // Aparece no fluxo projetado?
  const noFluxo = await FluxoProjetado.countDocuments({ codigoConta: codigo });
  if (noFluxo > 0) return { tem: true, motivo: `${noFluxo} lançamento(s) no fluxo` };

  return { tem: false };
}

/* Mesma pergunta, mas para um SubGrupo ou Conta-título: basta que UM dos
   subtítulos abaixo dele tenha movimento para o pai não poder ser inativado. */
async function algumFilhoTemMovimento(filtroSubtitulos) {
  const subs = await ContaSubTitulo.find(filtroSubtitulos).lean();
  for (const s of subs) {
    const mov = await temMovimento(s);
    if (mov.tem) return { tem: true, conta: `${s.codigo} - ${s.nome}`, motivo: mov.motivo };
  }
  return { tem: false };
}

/* =========================================================
   HELPERS - Próximo código sequencial
   ========================================================= */

async function proxCodigoSubGrupo(grupoId, codigoGrupo) {
  const ultimo = await SubGrupo.findOne({ grupoId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoGrupo}.01`;
  const seq = parseInt(ultimo.codigo.split('.')[1], 10) + 1;
  return `${codigoGrupo}.${String(seq).padStart(2, '0')}`;
}

async function proxCodigoContaTitulo(subGrupoId, codigoSubGrupo) {
  const ultimo = await ContaTitulo.findOne({ subGrupoId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoSubGrupo}.001`;
  const seq = parseInt(ultimo.codigo.split('.')[2], 10) + 1;
  return `${codigoSubGrupo}.${String(seq).padStart(3, '0')}`;
}

async function proxCodigoContaSubTitulo(contaTituloId, codigoContaTitulo) {
  const ultimo = await ContaSubTitulo.findOne({ contaTituloId }).sort({ codigo: -1 }).lean();
  if (!ultimo) return `${codigoContaTitulo}.001`;
  const seq = parseInt(ultimo.codigo.split('.')[3], 10) + 1;
  return `${codigoContaTitulo}.${String(seq).padStart(3, '0')}`;
}

// Retorna as sequências (números) já usadas sob um título.
// Inclui inativos também, para NÃO reaproveitar códigos que já existiram fisicamente.
async function sequenciasUsadas(contaTituloId) {
  const todos = await ContaSubTitulo.find({ contaTituloId }).select('codigo').lean();
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
   ========================================================= */
router.get('/subgrupos/:grupoId', async (req, res) => {
  try {
    const subs = await SubGrupo
      .find({ grupoId: req.params.grupoId, ativo: true })
      .sort({ codigo: 1 });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.post('/subgrupos', async (req, res) => {
  try {
    const { grupoId, nome, descricao } = req.body;
    if (!grupoId || !nome) {
      return res.status(400).json({ erro: 'grupoId e nome são obrigatórios.' });
    }
    const grupo = await Grupo.findById(grupoId);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });

    const codigo = await proxCodigoSubGrupo(grupoId, grupo.codigo);
    const novo = await SubGrupo.create({
      grupoId,
      codigoGrupo: grupo.codigo,
      codigo,
      nome,
      descricao: descricao || ''
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Subgrupo já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

router.put('/subgrupos/:id', async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    const upd = await SubGrupo.findByIdAndUpdate(
      req.params.id, { nome, descricao },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* INATIVAR subgrupo.
   Não apaga: marca ativo:false. Como todos os GETs deste arquivo já filtram
   por ativo:true, a conta some das telas mas o registro fica no banco. */
router.delete('/subgrupos/:id', async (req, res) => {
  try {
    const sg = await SubGrupo.findById(req.params.id);
    if (!sg) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });

    const titulosAtivos = await ContaTitulo
      .find({ subGrupoId: sg._id, ativo: true }).select('_id').lean();

    if (titulosAtivos.length > 0) {
      // Se algum neto tem movimento, a mensagem diz qual conta é — assim o
      // usuário sabe onde mexer, em vez de só ouvir "não pode".
      const mov = await algumFilhoTemMovimento({
        contaTituloId: { $in: titulosAtivos.map(t => t._id) },
        ativo: true
      });
      if (mov.tem) {
        return res.status(409).json({
          erro: `Conta ${mov.conta} com movimento. Impossível suspender.`
        });
      }
      return res.status(409).json({
        erro: `Este subgrupo possui ${titulosAtivos.length} título(s) ativo(s). Inative-os antes.`
      });
    }

    sg.ativo = false;
    await sg.save();
    res.json({ ok: true, inativado: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 3: CONTAS TÍTULO
   ========================================================= */
router.get('/titulos/:subGrupoId', async (req, res) => {
  try {
    const titulos = await ContaTitulo
      .find({ subGrupoId: req.params.subGrupoId, ativo: true })
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
    const sub = await SubGrupo.findById(subGrupoId);
    if (!sub) return res.status(404).json({ erro: 'Subgrupo não encontrado.' });

    const codigo = await proxCodigoContaTitulo(subGrupoId, sub.codigo);
    const novo = await ContaTitulo.create({
      subGrupoId,
      codigoSubGrupo: sub.codigo,
      codigo,
      nome,
      descricao: descricao || '',
      aceitaLancamento: aceitaLancamento ?? false
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
    const upd = await ContaTitulo.findByIdAndUpdate(
      req.params.id,
      { nome, descricao, aceitaLancamento },
      { new: true, runValidators: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Título não encontrado.' });
    res.json(upd);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* INATIVAR conta-título (mesma regra do subgrupo). */
router.delete('/titulos/:id', async (req, res) => {
  try {
    const ct = await ContaTitulo.findById(req.params.id);
    if (!ct) return res.status(404).json({ erro: 'Título não encontrado.' });

    const filhosAtivos = await ContaSubTitulo.countDocuments({ contaTituloId: ct._id, ativo: true });
    if (filhosAtivos > 0) {
      const mov = await algumFilhoTemMovimento({ contaTituloId: ct._id, ativo: true });
      if (mov.tem) {
        return res.status(409).json({
          erro: `Conta ${mov.conta} com movimento. Impossível suspender.`
        });
      }
      return res.status(409).json({
        erro: `Este título possui ${filhosAtivos} subtítulo(s) ativo(s). Inative-os antes.`
      });
    }

    ct.ativo = false;
    await ct.save();
    res.json({ ok: true, inativado: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   NÍVEL 4: SUB-TÍTULOS
   ========================================================= */
router.get('/subtitulos/:contaTituloId', async (req, res) => {
  try {
    const subs = await ContaSubTitulo
      .find({ contaTituloId: req.params.contaTituloId, ativo: true })
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
    const tit = await ContaTitulo.findById(req.params.contaTituloId).lean();
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    const usadas = await sequenciasUsadas(req.params.contaTituloId);
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
    const tit = await ContaTitulo.findById(req.params.contaTituloId).lean();
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    const usadas = await sequenciasUsadas(req.params.contaTituloId);
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
    const usadas = await sequenciasUsadas(req.params.contaTituloId);
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
    const sub = await ContaSubTitulo.findById(req.params.id).lean();
    if (!sub) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });
    const mov = await temMovimento(sub);
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
    const tit = await ContaTitulo.findById(contaTituloId);
    if (!tit) return res.status(404).json({ erro: 'Título não encontrado.' });

    // Define o código: se o stepper enviou uma sequência, valida que está livre.
    let codigo;
    if (seqEscolhida != null && !isNaN(parseInt(seqEscolhida, 10))) {
      const seq = parseInt(seqEscolhida, 10);
      const usadas = await sequenciasUsadas(contaTituloId);
      if (usadas.has(seq)) {
        // Segurança real: não grava duplicata, mesmo que o front tenha falhado.
        return res.status(409).json({
          erro: `O código ${tit.codigo}.${String(seq).padStart(3,'0')} já está em uso. Escolha outro.`
        });
      }
      codigo = `${tit.codigo}.${String(seq).padStart(3, '0')}`;
    } else {
      // Sem escolha do stepper: usa a primeira livre (reaproveita furos)
      const usadas = await sequenciasUsadas(contaTituloId);
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
      natureza
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

    const atual = await ContaSubTitulo.findById(req.params.id);
    if (!atual) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });

    const update = { nome, descricao, saldoInicial, natureza };

    // Se o usuário quer MUDAR O NÚMERO (seqEscolhida), aplica a regra de ouro:
    if (seqEscolhida != null && !isNaN(parseInt(seqEscolhida, 10))) {
      const novaSeq = parseInt(seqEscolhida, 10);
      const seqAtual = parseInt((atual.codigo || '').split('.')[3], 10);

      if (novaSeq !== seqAtual) {
        // 1) Conta com movimento NÃO pode ter o número alterado
        const mov = await temMovimento(atual);
        if (mov.tem) {
          return res.status(409).json({
            erro: `Não é possível alterar o número: esta conta tem movimento (${mov.motivo}). ` +
                  `Transfira os valores para outra conta antes de alterar o número.`
          });
        }
        // 2) Novo número não pode já estar em uso
        const usadas = await sequenciasUsadas(atual.contaTituloId);
        if (usadas.has(novaSeq)) {
          return res.status(409).json({
            erro: `O código ${atual.codigoContaTitulo}.${String(novaSeq).padStart(3,'0')} já está em uso.`
          });
        }
        update.codigo = `${atual.codigoContaTitulo}.${String(novaSeq).padStart(3, '0')}`;
      }
    }

    const upd = await ContaSubTitulo.findByIdAndUpdate(
      req.params.id, update,
      { new: true, runValidators: true }
    );
    res.json(upd);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'Código já existe.' });
    res.status(500).json({ erro: err.message });
  }
});

router.delete('/subtitulos/:id', async (req, res) => {
  try {
    const sub = await ContaSubTitulo.findById(req.params.id);
    if (!sub) return res.status(404).json({ erro: 'Subtítulo não encontrado.' });

    // Regra de ouro: conta com movimento não pode ser inativada
    const mov = await temMovimento(sub);
    if (mov.tem) {
      return res.status(409).json({
        erro: 'Conta com movimento. Impossível suspender.'
      });
    }

    sub.ativo = false;
    await sub.save();
    res.json({ ok: true, inativado: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
