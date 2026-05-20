// src/utils/consultaCep.js
// Consulta CEP no ViaCEP (gratuito, oficial dos Correios).

const { apenasNumeros } = require('./validadorDocumento');

async function consultarCep(cep) {
  const num = apenasNumeros(cep);
  if (num.length !== 8) {
    return { ok: false, erro: 'CEP deve ter 8 dígitos.' };
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${num}/json/`, {
      headers: {
        'User-Agent': 'plataformaRota/1.0 (sistema-contabil)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      return { ok: false, erro: `Erro na consulta: HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.erro) {
      // ViaCEP não tem esse CEP em sua base — pode estar correto
      // (CEP novo, raro, ou erro de digitação na fonte)
      return { ok: false, erro: 'CEP não encontrado na base do ViaCEP.' };
    }

    return {
      ok: true,
      dados: {
        cep:         apenasNumeros(data.cep),
        logradouro:  data.logradouro || '',
        complemento: data.complemento || '',
        bairro:      data.bairro || '',
        cidade:      data.localidade || '',
        uf:          data.uf || ''
      }
    };
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { ok: false, erro: 'Tempo esgotado ao consultar o CEP.' };
    }
    return { ok: false, erro: 'Falha ao consultar CEP: ' + err.message };
  }
}

module.exports = { consultarCep };
