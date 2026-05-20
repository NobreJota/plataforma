// src/utils/consultaCnpj.js
// Consulta CNPJ na BrasilAPI com User-Agent válido (evita 403).
// Doc: https://brasilapi.com.br/docs#tag/CNPJ

const { apenasNumeros } = require('./validadorDocumento');

/**
 * Consulta um CNPJ e retorna dados normalizados.
 * @param {string} cnpj - CNPJ com ou sem máscara
 * @returns {Promise<{ok: boolean, dados?: object, erro?: string}>}
 */
async function consultarCnpj(cnpj) {
  const num = apenasNumeros(cnpj);
  if (num.length !== 14) {
    return { ok: false, erro: 'CNPJ deve ter 14 dígitos.' };
  }

  try {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${num}`;
    const res = await fetch(url, {
      headers: {
        // 🔧 User-Agent válido — sem isso a BrasilAPI retorna 403
        'User-Agent': 'plataformaRota/1.0 (sistema-contabil)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (res.status === 404) {
      return { ok: false, erro: 'CNPJ não encontrado na Receita Federal.' };
    }
    if (res.status === 429) {
      return { ok: false, erro: 'Muitas consultas — aguarde alguns segundos.' };
    }
    if (res.status === 403) {
      return { ok: false, erro: 'Acesso à Receita Federal temporariamente bloqueado.' };
    }
    if (!res.ok) {
      return { ok: false, erro: `Receita Federal indisponível (HTTP ${res.status}).` };
    }

    const data = await res.json();

    const dados = {
      razaoSocial:    data.razao_social    || '',
      nomeFantasia:   data.nome_fantasia   || '',
      email:          (data.email || '').toLowerCase(),
      telefone:       data.ddd_telefone_1  || '',
      situacao:       data.descricao_situacao_cadastral || data.situacao_cadastral || '',
      ativa:          (data.descricao_situacao_cadastral || '').toUpperCase() === 'ATIVA',
      endereco: {
        cep:         apenasNumeros(data.cep),
        logradouro:  data.logradouro  || '',
        numero:      data.numero      || '',
        complemento: data.complemento || '',
        bairro:      data.bairro      || '',
        cidade:      data.municipio   || '',
        uf:          data.uf          || ''
      }
    };

    return { ok: true, dados };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { ok: false, erro: 'Tempo esgotado ao consultar a Receita.' };
    }
    return { ok: false, erro: 'Falha ao consultar CNPJ: ' + err.message };
  }
}

module.exports = { consultarCnpj };
