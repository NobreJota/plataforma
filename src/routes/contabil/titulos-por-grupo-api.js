// src/routes/contabil/titulos-por-grupo-api.js
// Lista todas as contas-título de um GRUPO (1=Ativo, 2=Passivo, 3=Despesa, 4=Receita).
// Usado pelo combo "CONTA-TÍTULO" da nova tela do Razão.

const express = require('express');
const ContaTitulo = require('../../models/contaTitulo');

const router = express.Router();

/* GET /contab/api/titulos-por-grupo/:codigo
   Onde :codigo = "1" (Ativo), "2" (Passivo), "3" (Despesa) ou "4" (Receita).
   Retorna [{ _id, codigo, nome }] de todos os títulos cujo código começa
   com esse dígito. */
router.get('/titulos-por-grupo/:codigo', async (req, res) => {
  try {
    const c = String(req.params.codigo || '').trim();
    if (!/^[1-4]$/.test(c)) {
      return res.status(400).json({ erro: 'Código de grupo inválido (use 1, 2, 3 ou 4).' });
    }
    // títulos começam com "X.YY.ZZZ" — filtra pelo prefixo c + "."
    const re = new RegExp('^' + c + '\\.');
    const titulos = await ContaTitulo.find({ codigo: re })
      .select('_id codigo nome aceitaLancamento')
      .sort({ codigo: 1 })
      .lean();
    res.json(titulos);
  } catch (err) {
    console.error('❌ /titulos-por-grupo:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
