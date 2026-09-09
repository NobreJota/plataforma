// ajuste o caminho se for diferente
const mongoose = require('mongoose');
//const Produto = require('./../models/arquivoDoc'); 
const Produto=mongoose.model("arquivo_doc")

exports.softDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Produto.findByIdAndUpdate(
      id,
      { $set: { ativo: 9, datadel: new Date() } },
      { new: true }
    );
    if (!doc) return res.sendStatus(404);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.sendStatus(500);
  }
};

