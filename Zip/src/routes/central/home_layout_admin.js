const express = require("express");
const router = express.Router();
const HomeLayout = require("../../models/home_layout"); // ajuste o caminho/nome do model

router.get("/home-layout", async (req, res) => {
  try {
    const doc = await HomeLayout.findOne({ nome: "default" }).lean();
    console.log(' [ 8 ] valor de doc =',doc)
    return res.render("pages/central/admin-home-layout.handlebars", {
      layout: false, // você está usando HTML completo
      home: doc || { nome: "default", slots: [] },
    });
  } catch (err) {
    console.error("[GET /admin/home-layout]", err);
    return res.status(500).send("Erro ao carregar admin da HOME");
  }
});

router.post("/home-layout/slot/foto", async (req, res) => {
  try {
            const { tipo, ordem, imagemUrl } = req.body || {};
            if (!tipo || !ordem || !imagemUrl) {
            return res.status(400).json({ error: "Faltou tipo, ordem ou imagemUrl." });
            }

            const doc = await HomeLayout.findOne({ nome: "default" });
            if (!doc) return res.status(404).json({ error: "HomeLayout default não encontrado." });

            // acha slot por tipo+ordem (ou adapte se você usa _id do slot)
            const slot = (doc.slots || []).find(s =>
            String(s.tipo) === String(tipo) && String(s.ordem) === String(ordem)
            );
            if (!slot) return res.status(404).json({ error: "Slot não encontrado." });

            slot.imagemUrl = imagemUrl;
            await doc.save();

            return res.json({ ok: true });

  } catch (err) {
            console.error("[POST /homeadmin/home-layout/slot/foto]", err);
            return res.status(500).json({ error: "Erro ao salvar foto no slot." });
  }
});

module.exports = router;
