const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Mconstrucao = require('../../models/mconstrucao'); // m_construcaos
const DeptoSetor  = require('../../models/deptosetores');
const DeptoSecao  = require('../../models/deptosecao');   // deptosecoes

const PLACEHOLDER = 'https://via.placeholder.com/480x360?text=Produto';

function pickImg(p){
  const arrs = [p.pageurlS, p.pageurls, p.pageurl, p.imagens, p.images];
  for (const a of arrs){
    if (Array.isArray(a) && a.length && a[0]) return String(a[0]);
  }
  const s = p.imagemUrl || p.imageUrl || p.fotoUrl || '';
  return (s && String(s).trim()) || PLACEHOLDER;
}

function pickFirstIdSetor(p){
  const st = p?.localloja?.[0]?.setor?.[0];
  if (!st) return '';
  return (st.idSetor && String(st.idSetor))
      || (st.nameSetor && String(st.nameSetor))
      || '';
}

// --- helper: normaliza UM documento em memória e salva ---
async function normalizeOneProduct(prodId){
  const doc = await Mconstrucao.findById(prodId).lean();
  if (!doc) throw new Error('Produto não encontrado');

  const localloja = Array.isArray(doc.localloja) ? doc.localloja : [];

  for (const ll of localloja){
    ll.departamento = Array.isArray(ll.departamento) ? ll.departamento : [];
    ll.setor = Array.isArray(ll.setor) ? ll.setor : [];

    for (const st of ll.setor){
      // resolve idSetor a partir do legado (nameSetor) quando necessário
      if (!st.idSetor) {
        if (st.nameSetor && mongoose.isValidObjectId(st.nameSetor)) {
          st.idSetor = st.nameSetor;
        } else if (typeof st.nameSetor === 'string' && st.nameSetor.trim()) {
          const s = await DeptoSetor.findOne(
            { nomeDeptoSetor: st.nameSetor.trim() },
            { _id:1 }
          ).lean();
          if (s) st.idSetor = s._id;
        }
      }
      if (st.idSetor && st.nameSetor) delete st.nameSetor;

      // garantir secao como array de objetos { idSecao }
      if (!Array.isArray(st.secao)) {
        if (st.secao == null) st.secao = [];
        else if (typeof st.secao === 'string' && st.secao.trim()){
          const se = await DeptoSecao.findOne({ nameSecao: st.secao.trim() }, { _id:1 }).lean();
          st.secao = se ? [{ idSecao: se._id }] : [];
        } else if (mongoose.isValidObjectId(st.secao)) {
          st.secao = [{ idSecao: st.secao }];
        } else {
          st.secao = [];
        }
      }

      // itens antigos dentro de st.secao, ex.: { nameSecao: '...' }
      if (st.secao.length){
        const nomes = st.secao
          .filter(x => x && x.nameSecao && typeof x.nameSecao === 'string')
          .map(x => x.nameSecao.trim());

        let mapa = new Map();
        if (nomes.length){
          const rows = await DeptoSecao.find(
            { nameSecao: { $in: nomes } },
            { _id:1, nameSecao:1 }
          ).lean();
          mapa = new Map(rows.map(r => [r.nameSecao, r._id]));
        }

        st.secao = st.secao.map(x => {
          if (!x) return null;
          if (x.idSecao && mongoose.isValidObjectId(x.idSecao)) return { idSecao: x.idSecao };
          if (x.nameSecao && mapa.get(x.nameSecao)) return { idSecao: mapa.get(x.nameSecao) };
          if (mongoose.isValidObjectId(x)) return { idSecao: x };
          return null;
        }).filter(Boolean);
      }

      // fallback leve: se setor tiver apenas 1 seção cadastrada, usa-a
      if (Array.isArray(st.secao) && st.secao.length === 0 && st.idSetor) {
        const uniq = await DeptoSecao.countDocuments({ idSetor: st.idSetor });
        if (uniq === 1) {
          const unica = await DeptoSecao.findOne({ idSetor: st.idSetor }, { _id:1 }).lean();
          if (unica?._id) st.secao = [{ idSecao: unica._id }];
        }
      }
    }
  }

  await Mconstrucao.updateOne(
    { _id: prodId },
    { $set: { localloja } },
    { runValidators: false } // não valida campos como "descricao", etc.
  );

  return { ok: true, _id: prodId };
}



// =============== LISTA (com filtro e paginação) ===============
router.get('/ajustes/produtos', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '24', 10), 1), 60);
    const skip  = (page - 1) * limit;

    // candidatos a ajuste
    const filtro = {
      $or: [
        { localloja: { $elemMatch: { setor: { $elemMatch: { nameSetor: { $exists: true  } } } } } }, // legado
        { localloja: { $elemMatch: { setor: { $elemMatch: { idSetor : { $exists: false } } } } } },
        { localloja: { $elemMatch: { setor: { $elemMatch: { secao   : null            } } } } },
        { localloja: { $elemMatch: { setor: { $elemMatch: { secao   : { $exists: false } } } } } },
        { localloja: { $elemMatch: { setor: { $elemMatch: { secao   : { $type: "string" } } } } } },
        { localloja: { $elemMatch: { setor: { $elemMatch: { "secao.nameSecao": { $exists: true } } } } } },
        { localloja: { $elemMatch: { setor: { $elemMatch: { "secao.idSecao" : { $exists: false } } } } } },
      ]
    };

    const [ total, itens ] = await Promise.all([
      Mconstrucao.countDocuments(filtro),
      Mconstrucao.find(filtro, { descricao:1, pageurlS:1, imagemUrl:1, preco1:1, localloja:1 })
                 .sort({ updatedAt: -1 })
                 .skip(skip).limit(limit).lean()
    ]);

    const hasPrev = page > 1;
    const hasNext = skip + itens.length < total;
    const pagePrev = hasPrev ? page - 1 : 1;
    const pageNext = hasNext ? page + 1 : page;

    // prepara itens para a view
    const itensView = itens.map(x => ({
      ...x,
      _img: pickImg(x),
      firstIdSetor: pickFirstIdSetor(x)
    }));

    res.render('pages/empresa/ajuste-lista.handlebars', {
      layout: 'empresa/admin-empresa.handlebars',
      itens: itensView,
      total, page, limit,
      hasPrev, hasNext, pagePrev, pageNext
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao listar candidatos');
  }
});


// =============== AJUSTAR UM ==================// AJUSTE INDIVIDUAL
router.patch('/ajustes/produto/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ ok:false, error:'id inválido' });
    const r = await normalizeOneProduct(id);
    res.json({ ok:true, id: r._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error: e.message });
  }
});

// AJUSTE EM LOTE
router.post('/ajustes/produtos/lote', async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const valid = ids.filter(mongoose.isValidObjectId);
    const results = [];
    for (const id of valid){
      try { results.push(await normalizeOneProduct(id)); }
      catch (e) { results.push({ ok:false, id, error: e.message }); }
    }
    res.json({ ok:true, results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'falha no lote' });
  }
});

// LISTAR SEÇÕES POR SETOR
router.get('/ajustes/setor/:idSetor/secoes', async (req, res) => {
  try {
    const { idSetor } = req.params;
    if (!mongoose.isValidObjectId(idSetor))
      return res.status(400).json({ ok: false, error: 'idSetor inválido' });

    const secoes = await DeptoSecao.find({ idSetor }, { _id:1, nameSecao:1 })
      .sort({ nameSecao: 1 })
      .lean();

    return res.json({ ok: true, secoes });
  } catch (e) {
    console.error('[ajustes/setor/secoes]', e);
    return res.status(500).json({ ok: false, error: 'Falha ao buscar seções' });
  }
});

// DEFINIR SEÇÃO MANUAL DE UM PRODUTO
router.patch('/ajustes/produto/:id/definir-secao', async (req, res) => {
  try {
    const { id } = req.params;
    const { idSecao } = req.body;

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, error: 'id inválido' });
    if (!mongoose.isValidObjectId(idSecao))
      return res.status(400).json({ ok: false, error: 'idSecao inválido' });

    const prod = await Mconstrucao.findById(id);
    if (!prod) return res.status(404).json({ ok: false, error: 'Produto não encontrado' });

    const ll = prod.localloja?.[0];
    if (!ll) return res.status(400).json({ ok: false, error: 'localloja ausente' });

    const st = ll.setor?.[0];
    if (!st) return res.status(400).json({ ok: false, error: 'setor ausente' });

    st.secao = [{ idSecao: new mongoose.Types.ObjectId(idSecao) }];

    await prod.save({ validateBeforeSave: false });

    return res.json({ ok: true, id, idSecao });
  } catch (e) {
    console.error('[ajustes/produto/definir-secao]', e);
    return res.status(500).json({ ok: false, error: 'Falha ao definir seção' });
  }
});

module.exports = router;
