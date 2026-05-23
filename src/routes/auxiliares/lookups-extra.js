// src/routes/auxiliares/lookups-extra.js
// Lookups auxiliares: SubTítulos do plano (dropdown ao vincular conta bancária)
// VERSÃO DEFENSIVA: loga erros e não quebra se populate falhar.

const express = require('express');
const router = express.Router();

// Tenta carregar o model de forma flexível
let ContaSubTitulo;
try {
  ContaSubTitulo = require('../../models/contaSubTitulo');
} catch (e1) {
  try {
    ContaSubTitulo = require('../../models/ContaSubTitulo');
  } catch (e2) {
    console.error('⚠ Não encontrou model contaSubTitulo:', e2.message);
  }
}

/* GET /aux/api/lookup/subtitulos */
router.get('/subtitulos', async (req, res) => {
  try {
    if (!ContaSubTitulo) {
      return res.status(500).json({ erro: 'Model ContaSubTitulo não carregado. Verifique o caminho.' });
    }

    // Busca SEM populate primeiro (mais seguro)
    const subs = await ContaSubTitulo.find({}).sort({ codigo: 1 }).lean();

    console.log(`📊 /subtitulos: encontrados ${subs.length} subtítulos`);
    if (subs.length > 0) {
      console.log('   Exemplo do 1º registro:', JSON.stringify(subs[0], null, 2));
    }

    // Monta resposta plana usando os campos que existirem
    const resposta = subs.map(s => ({
      _id: s._id,
      codigo: s.codigo || '',
      descricao: s.descricao || s.nome || s.titulo || '',
      caminho: `${s.codigo || ''} ${s.descricao || s.nome || s.titulo || ''}`.trim()
    }));

    res.json(resposta);
  } catch (err) {
    console.error('❌ ERRO em /subtitulos:', err.message);
    console.error(err.stack);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
