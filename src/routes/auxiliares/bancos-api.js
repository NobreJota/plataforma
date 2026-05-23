// src/routes/auxiliares/bancos-api.js
const express = require('express');
const Banco = require('../../models/auxiliares/banco');

const router = express.Router();

/* ===== Seed automático dos 10 bancos principais ===== */
const BANCOS_PADRAO = [
  { codigo: '001', nome: 'Banco do Brasil S.A.',   nomeCurto: 'BB' },
  { codigo: '104', nome: 'Caixa Econômica Federal', nomeCurto: 'CEF' },
  { codigo: '237', nome: 'Banco Bradesco S.A.',     nomeCurto: 'Bradesco' },
  { codigo: '341', nome: 'Banco Itaú Unibanco S.A.', nomeCurto: 'Itaú' },
  { codigo: '033', nome: 'Banco Santander Brasil S.A.', nomeCurto: 'Santander' },
  { codigo: '260', nome: 'Nu Pagamentos S.A.',      nomeCurto: 'Nubank' },
  { codigo: '077', nome: 'Banco Inter S.A.',        nomeCurto: 'Inter' },
  { codigo: '756', nome: 'Banco Cooperativo do Brasil S.A. – Bancoob', nomeCurto: 'Sicoob' },
  { codigo: '021', nome: 'Banestes S.A. Banco do Estado do Espírito Santo', nomeCurto: 'Banestes' },
  { codigo: '336', nome: 'Banco C6 S.A.',           nomeCurto: 'C6' }
];

let seedExecutado = false;
async function garantirSeed() {
  if (seedExecutado) return;
  seedExecutado = true;
  try {
    try {
      await Banco.collection.createIndex({ codigo: 1 }, { unique: true, name: 'codigo_unique' });
    } catch (_) { /* já existe */ }

    let inseridos = 0;
    for (const b of BANCOS_PADRAO) {
      const existe = await Banco.findOne({ codigo: b.codigo });
      if (!existe) {
        await Banco.create(b);
        inseridos++;
      }
    }
    if (inseridos > 0) {
      console.log(`🌱 Seed de bancos: ${inseridos} banco(s) cadastrado(s) automaticamente.`);
    }
  } catch (err) {
    console.error('⚠ Erro no seed de bancos:', err.message);
    seedExecutado = false; // permite tentar de novo na próxima
  }
}

/* LISTAR */
router.get('/', async (req, res) => {
  try {
    await garantirSeed();  // 🌱 garante os 10 bancos antes de listar
    const incluirInativos = req.query.incluirInativos === 'true';
    const filter = incluirInativos ? {} : { ativo: true };
    const bancos = await Banco.find(filter).sort({ nome: 1 });
    res.json(bancos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* OBTER POR ID */
router.get('/:id', async (req, res) => {
  try {
    const b = await Banco.findById(req.params.id);
    if (!b) return res.status(404).json({ erro: 'Banco não encontrado.' });
    res.json(b);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* CRIAR */
router.post('/', async (req, res) => {
  try {
    const { codigo, nome, nomeCurto } = req.body;
    if (!codigo || !nome) {
      return res.status(400).json({ erro: 'Código e nome são obrigatórios.' });
    }
    const codigoLimpo = String(codigo).replace(/\D/g, '').padStart(3, '0').slice(0, 3);
    if (codigoLimpo.length !== 3) {
      return res.status(400).json({ erro: 'Código FEBRABAN deve ter 3 dígitos.' });
    }

    const existe = await Banco.findOne({ codigo: codigoLimpo });
    if (existe) {
      return res.status(409).json({
        erro: `Banco com código ${codigoLimpo} já cadastrado (${existe.nome}).`
      });
    }

    const novo = await Banco.create({
      codigo: codigoLimpo,
      nome: String(nome).trim(),
      nomeCurto: String(nomeCurto || '').trim()
    });
    res.status(201).json(novo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: 'Já existe banco com esse código.' });
    }
    res.status(500).json({ erro: err.message });
  }
});

/* ATUALIZAR */
router.put('/:id', async (req, res) => {
  try {
    const { nome, nomeCurto, ativo } = req.body;
    const patch = {};
    if (nome !== undefined) {
      if (!String(nome).trim()) return res.status(400).json({ erro: 'Nome não pode ficar vazio.' });
      patch.nome = String(nome).trim();
    }
    if (nomeCurto !== undefined) patch.nomeCurto = String(nomeCurto).trim();
    if (ativo !== undefined) patch.ativo = !!ativo;

    const b = await Banco.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!b) return res.status(404).json({ erro: 'Banco não encontrado.' });
    res.json(b);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* INATIVAR */
router.delete('/:id', async (req, res) => {
  try {
    const b = await Banco.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
    if (!b) return res.status(404).json({ erro: 'Banco não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* REATIVAR */
router.post('/:id/reativar', async (req, res) => {
  try {
    const b = await Banco.findByIdAndUpdate(req.params.id, { ativo: true }, { new: true });
    if (!b) return res.status(404).json({ erro: 'Banco não encontrado.' });
    res.json(b);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
