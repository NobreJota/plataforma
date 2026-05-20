// src/routes/auxiliares/lookups-extra.js
// Lookups auxiliares: SubTítulos do plano (para dropdown ao vincular conta bancária)

const express = require('express');
const ContaSubTitulo = require('../../models/contaSubTitulo');

const router = express.Router();

/* GET /aux/api/lookup/subtitulos
   Retorna lista de SubTítulos com lançamento permitido.
   Opcional: ?grupo=1 (filtra por grupo Ativo/Passivo/etc) */
router.get('/subtitulos', async (req, res) => {
  try {
    const subs = await ContaSubTitulo.find({})
      .populate({
        path: 'contaTitulo',
        select: 'codigo descricao grupoSub',
        populate: {
          path: 'grupoSub',
          select: 'codigo descricao grupo',
          populate: { path: 'grupo', select: 'codigo descricao' }
        }
      })
      .sort({ codigo: 1 });

    // Monta resposta plana, fácil de usar no frontend
    const resposta = subs.map(s => ({
      _id: s._id,
      codigo: s.codigo,
      descricao: s.descricao,
      naturezaSaldo: s.naturezaSaldo,
      contaTitulo: s.contaTitulo ? {
        codigo: s.contaTitulo.codigo,
        descricao: s.contaTitulo.descricao
      } : null,
      caminho: s.contaTitulo
        ? `${s.contaTitulo.codigo} → ${s.codigo} ${s.descricao}`
        : `${s.codigo} ${s.descricao}`
    }));

    res.json(resposta);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
