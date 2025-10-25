// scripts/fixarSecoes.js
require('dotenv').config();                // lê .env (MONGO_URI)
const mongoose = require('mongoose');

// 👇 caminhos partindo de scripts/ para sua pasta models/
const Mconstrucao = require('../models/mconstrucao');
const DeptoSecoes = require('../models/deptosecao'); // nome do seu model de seções

const DRY_RUN = process.env.DRY_RUN === '1'; // se quiser testar sem salvar

(async () => {
  try {
    // Se você já tem um módulo de conexão (ex: ./database/index.js), pode usar:
    // await require('../database')();
    // Senão, use a MONGO_URI do .env:
    await mongoose.connect(process.env.MONGO_URI);

    console.log('Conectado. Procurando produtos com nameSecao como STRING…');

    const cursor = Mconstrucao.find({
      "localloja.setor.secao.nameSecao": { $type: "string" }
    }).cursor();

    let ok = 0, skip = 0, err = 0, seen = 0;

    for await (const doc of cursor) {
      seen++;
      let changed = false;

      for (const dep of (doc.localloja?.departamento || [])) {
        for (const st of (doc.localloja?.setor || [])) {
          for (const sc of (st.secao || [])) {
            if (typeof sc.nameSecao === 'string' && sc.nameSecao.trim()) {
              const nome = sc.nameSecao.trim();

              // opcional: restringir pelo setor correto (descomente se quiser)
              // const sec = await DeptoSecoes.findOne({ nameSecao: nome, idSetor: st.nameSetor }, '_id').lean();

              const sec = await DeptoSecoes.findOne({ nameSecao: nome }, '_id').lean();

              if (sec?._id) {
                console.log(`[FIX] ${doc._id} :: "${nome}" -> ${sec._id}`);
                sc.nameSecao = sec._id;   // troca string por ObjectId
                changed = true;
              } else {
                console.log(`[SKIP] ${doc._id} :: seção não encontrada p/ "${nome}"`);
                skip++;
              }
            }
          }
        }
      }

      if (changed) {
        if (DRY_RUN) { ok++; continue; }
        try {
          await doc.save();
          ok++;
        } catch (e) {
          console.log('[ERRO SAVE]', doc._id, e.message);
          err++;
        }
      }
    }

    console.log({ analisados: seen, ok, skip, err, dryRun: DRY_RUN });
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
