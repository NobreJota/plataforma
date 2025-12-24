//const express = require('express');
//const router = express.Router();
const mongoose = require('mongoose');

// Modelo do banco (reaproveite o seu existente se já tiver)
// Campos comuns que você usa no projeto:
const BancoImagem = mongoose.models.banco_imagem || mongoose.model('banco_imagem', new mongoose.Schema({
  imagemUrl: { type: String, required: true, trim: true },
  key: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  departamento: { type: mongoose.Schema.Types.ObjectId, ref: 'departamento', default: null },
  origem: { type: String, enum: ['produto','atividade','outro'], default: 'outro' },
  atividadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'atividade', default: null },
  produtoId: { type: mongoose.Schema.Types.ObjectId, ref: 'm_construcao', default: null }
}, { timestamps: true }));

// GET /bco-imagens?departamento=...&q=...
router.get('/', async (req, res)=>{
  try{
    const { departamento, q } = req.query;
    const f = {};
    if (departamento) f.departamento = departamento;
    if (q) f.imagemUrl = { $regex: q, $options: 'i' };
    const items = await BancoImagem.find(f).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ ok:true, items });
  }catch(e){
    console.error('GET /bco-imagens', e);
    res.json({ ok:false, items: [] });
  }
});

// POST /bco-imagens  (criar registro quando upload novo)
router.post('/', async (req, res)=>{
  try{
    const payload = req.body || {};
    if (!payload.imagemUrl) return res.json({ ok:false, msg:'imagemUrl obrigatório' });
    const doc = await BancoImagem.create(payload);
    res.json({ ok:true, id: doc._id });
  }catch(e){
    console.error('POST /bco-imagens', e);
    res.json({ ok:false });
  }
});

module.exports = router;
