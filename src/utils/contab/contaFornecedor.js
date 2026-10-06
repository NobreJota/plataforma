// src/utils/contab/contaFornecedor.js
// Cria o subtítulo do fornecedor no plano de contas, seguindo a sequência do último.
// Usado pela fornecedores-api.js (cadastro) e pelo script de criação das contas existentes.

const ContaTitulo    = require('../../models/contab/financeiro/contaTitulo');
const ContaSubTitulo = require('../../models/contab/financeiro/contaSubTitulo');

// Padrão da plataforma: 2.01 é Fornecedores, a conta de maior movimento do
// passivo. O plano antigo usava 2.02; ele é traduzido pelo mapa de/para, não
// copiado.
const GRUPO_FORNECEDORES = '2.01';
const MAX_TENTATIVAS = 5;

/** Títulos de fornecedor disponíveis para a empresa (2.01.xxx ativos). */
async function listarTitulos(lojistaId) {
  return ContaTitulo.find(
    { lojistaId, codigoSubGrupo: GRUPO_FORNECEDORES, ativo: { $ne: false } },
    { codigo: 1, nome: 1 }
  ).sort({ codigo: 1 }).lean();
}

/** Garante que o título existe, é da empresa, está ativo e fica sob 2.01. */
async function obterTitulo(lojistaId, tituloCodigo) {
  const codigo = String(tituloCodigo || '').trim();
  if (!codigo.startsWith(GRUPO_FORNECEDORES + '.')) return null;
  return ContaTitulo.findOne({ lojistaId, codigo, ativo: { $ne: false } }).lean();
}

/**
 * Cria o subtítulo com o próximo número livre do título.
 * Suspensos entram na conta: número usado não volta a ser usado.
 * Se dois cadastros disputarem o mesmo número, o índice {lojistaId, codigo}
 * rejeita um deles (11000) e ele tenta o seguinte.
 */
async function criarConta({ lojistaId, tituloCodigo, nome }) {
  const titulo = await obterTitulo(lojistaId, tituloCodigo);
  if (!titulo) {
    const e = new Error('Título contábil inválido para fornecedor.');
    e.status = 400;
    throw e;
  }

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const ultimo = await ContaSubTitulo.findOne(
      { lojistaId, codigoContaTitulo: titulo.codigo },
      { codigo: 1 }
    ).sort({ codigo: -1 }).lean();

    const seq = ultimo ? parseInt(String(ultimo.codigo).split('.').pop(), 10) + 1 : 1;
    if (!Number.isFinite(seq) || seq > 999) {
      const e = new Error(`O título ${titulo.codigo} não tem mais numeração livre.`);
      e.status = 409;
      throw e;
    }
    const codigo = `${titulo.codigo}.${String(seq).padStart(3, '0')}`;

    try {
      return await ContaSubTitulo.create({
        contaTituloId: titulo._id,
        codigoContaTitulo: titulo.codigo,
        codigo,
        nome: String(nome || '').trim(),
        natureza: 'credora',            // fornecedor é Passivo
        lojistaId
      });
    } catch (err) {
      if (err.code === 11000 && tentativa < MAX_TENTATIVAS) continue;
      throw err;
    }
  }
}

/** Desfaz uma conta recém-criada quando o cadastro do fornecedor falha logo em seguida. */
async function desfazerConta(conta) {
  if (!conta) return;
  await ContaSubTitulo.deleteOne({ _id: conta._id, lojistaId: conta.lojistaId }).catch(() => {});
}

module.exports = { GRUPO_FORNECEDORES, listarTitulos, obterTitulo, criarConta, desfazerConta };
