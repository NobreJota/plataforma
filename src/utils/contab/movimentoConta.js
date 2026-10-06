// src/utils/contab/movimentoConta.js
// Regra de movimento e de suspensão de conta, num lugar só.
//
// Antes isto morava dentro do plano-api.js. Saiu de lá porque o cadastro de
// fornecedor também precisa da mesma pergunta ("esta conta pode ser
// desvinculada?"), e duas cópias da regra acabariam divergindo.

const SubGrupo       = require('../../models/grupoSub');
const ContaTitulo    = require('../../models/contab/financeiro/contaTitulo');
const ContaSubTitulo = require('../../models/contab/financeiro/contaSubTitulo');
const Boleta         = require('../../models/contab/financeiro/boleta');

/* Detecta se um subtítulo TEM MOVIMENTO CONTÁBIL.

   Movimento = aparece em BOLETA ativa. Só isso.

   Ficam de fora, de propósito:
   - Fluxo projetado: é previsão, dinheiro que ainda não andou. Conta que só
     tem parcela planejada pode ser suspensa.
   - Saldo inicial: é o valor trazido do balancete anterior quando a empresa
     entra na plataforma. É saldo, não movimentação.
   - Boleta cancelada: foi desfeita, então não movimentou nada.

   Regra contábil: conta com movimento não pode ter o número editado nem ser
   suspensa — primeiro é preciso transferir os valores para outra conta.

   O código da conta só é único dentro da empresa, então a busca em boletas
   também é por empresa. Sem isso, a conta 2.01.001.007 de uma empresa
   apareceria como movimentada por causa da boleta de outra. */
async function temMovimento(subtitulo, lojistaId) {
  if (!subtitulo) return { tem: false };
  const codigo = subtitulo.codigo;

  const naBoleta = await Boleta.countDocuments({
    lojistaId,
    status: 'ATIVO',
    $or: [
      { bancoCodigo: codigo },                    // a perna do banco
      { 'contrapartidas.codigoConta': codigo }    // as contas de despesa/receita
    ]
  });
  if (naBoleta > 0) {
    return { tem: true, motivo: `${naBoleta} lançamento(s) em boletas` };
  }

  return { tem: false };
}

/* Mesma pergunta, mas para um SubGrupo ou Conta-título: basta que UM dos
   subtítulos abaixo dele tenha movimento para o pai não poder ser inativado. */
async function algumFilhoTemMovimento(filtroSubtitulos, lojistaId) {
  const subs = await ContaSubTitulo.find(filtroSubtitulos).lean();
  for (const s of subs) {
    const mov = await temMovimento(s, lojistaId);
    if (mov.tem) return { tem: true, conta: `${s.codigo} - ${s.nome}`, motivo: mov.motivo };
  }
  return { tem: false };
}

/* PODE SUSPENDER?

   A mesma pergunta é feita em dois momentos: quando a tela quer saber ANTES
   de mostrar a confirmação, e de novo na hora de suspender de verdade. Por
   isso a regra mora aqui, num lugar só — se ficasse duplicada, uma das duas
   cópias acabaria desatualizada.

   ⚠ Etapa 2C: título e subtítulo já filtram por empresa. SubGrupo ainda não,
   porque o model grupoSub não foi conferido. */
async function podeSuspender(nivel, id, lojistaId) {
  if (nivel === 'subgrupo') {
    const sg = await SubGrupo.findById(id);
    if (!sg) return { ok: false, status: 404, erro: 'Subgrupo não encontrado.' };

    const titulosAtivos = await ContaTitulo
      .find({ subGrupoId: sg._id, lojistaId, ativo: true }).select('_id').lean();

    if (titulosAtivos.length > 0) {
      // Se algum neto tem movimento, a mensagem diz qual conta é — assim o
      // usuário sabe onde mexer, em vez de só ouvir "não pode".
      const mov = await algumFilhoTemMovimento({
        contaTituloId: { $in: titulosAtivos.map(t => t._id) },
        lojistaId,
        ativo: true
      }, lojistaId);
      if (mov.tem) {
        return { ok: false, status: 409, erro: `Conta ${mov.conta} com movimento. Impossível suspender.` };
      }
      return {
        ok: false, status: 409,
        erro: `Este subgrupo possui ${titulosAtivos.length} título(s) ativo(s). Suspenda-os antes.`
      };
    }
    return { ok: true, doc: sg };
  }

  if (nivel === 'titulo') {
    const ct = await ContaTitulo.findOne({ _id: id, lojistaId });
    if (!ct) return { ok: false, status: 404, erro: 'Título não encontrado.' };

    const filhosAtivos = await ContaSubTitulo.countDocuments({ contaTituloId: ct._id, lojistaId, ativo: true });
    if (filhosAtivos > 0) {
      const mov = await algumFilhoTemMovimento({ contaTituloId: ct._id, lojistaId, ativo: true }, lojistaId);
      if (mov.tem) {
        return { ok: false, status: 409, erro: `Conta ${mov.conta} com movimento. Impossível suspender.` };
      }
      return {
        ok: false, status: 409,
        erro: `Este título possui ${filhosAtivos} subtítulo(s) ativo(s). Suspenda-os antes.`
      };
    }
    return { ok: true, doc: ct };
  }

  if (nivel === 'subtitulo') {
    const st = await ContaSubTitulo.findOne({ _id: id, lojistaId });
    if (!st) return { ok: false, status: 404, erro: 'Subtítulo não encontrado.' };

    const mov = await temMovimento(st, lojistaId);
    if (mov.tem) {
      return { ok: false, status: 409, erro: `Conta com movimento (${mov.motivo}). Impossível suspender.` };
    }
    return { ok: true, doc: st };
  }

  return { ok: false, status: 400, erro: 'Nível inválido.' };
}

module.exports = { temMovimento, algumFilhoTemMovimento, podeSuspender };
