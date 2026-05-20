// src/routes/auxiliares/bancos-api.js
const express = require('express');
const Banco = require('../../models/auxiliares/banco');

const router = express.Router();

/* LISTAR */
router.get('/', async (req, res) => {
  try {
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

    // Verifica duplicidade
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

/* INATIVAR (soft delete) */
router.delete('/:id', async (req, res) => {
  try {
    const b = await Banco.findByIdAndUpdate(
      req.params.id, { ativo: false }, { new: true }
    );
    if (!b) return res.status(404).json({ erro: 'Banco não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* REATIVAR */
router.post('/:id/reativar', async (req, res) => {
  try {
    const b = await Banco.findByIdAndUpdate(
      req.params.id, { ativo: true }, { new: true }
    );
    if (!b) return res.status(404).json({ erro: 'Banco não encontrado.' });
    res.json(b);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
