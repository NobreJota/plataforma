// =============================================================================
// Destino: C:\plataformaRota\src\routes\contab\auxiliares\lookups-extra.js
// Alterado em: 25/09/2026 — caminho do model corrigido depois da reestruturacao.
//
// Lookups auxiliares do contab.
// Hoje serve um so dropdown: os subtitulos do plano, na hora de vincular uma
// conta bancaria a uma conta contabil.
//
// Montado em /aux/api/lookup  (ver pages.js)
// =============================================================================

'use strict';

const express = require('express');
const router = express.Router();

const ContaSubTitulo = require('../../../models/contab/financeiro/contaSubTitulo');

/* GET /aux/api/lookup/subtitulos */
router.get('/subtitulos', async (req, res) => {
  try {
    const subs = await ContaSubTitulo
      .find({})
      .sort({ codigo: 1 })
      .lean();

    res.json(subs.map(s => ({
      _id: s._id,
      codigo: s.codigo || '',
      descricao: s.descricao || s.nome || s.titulo || '',
      caminho: ((s.codigo || '') + ' ' + (s.descricao || s.nome || s.titulo || '')).trim(),
    })));

  } catch (err) {
    console.error('[lookup/subtitulos] ' + err.message);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
