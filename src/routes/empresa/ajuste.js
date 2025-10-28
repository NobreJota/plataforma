const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Ddocumento = require('../../models/ddocumento'); // ddocumento
const Departamento  = require('../../models/departamento');
const DeptoSetor  = require('../../models/deptosetores');
const DeptoSecao  = require('../../models/deptosecao');   // deptosecoes

const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:5000';
const PLACEHOLDER = 'https:/img/placeholder-480x360.png';

// ???????????????????????????????????????
function normalizeUrl(u) {
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/uploads/')) return ORIGIN + u; // se você salva caminho relativo
  return u;
}

function pickImg(p) {
  // p.pageurls é um array? (ex.: ["/uploads/arquivo.png", ...])
  const arr = Array.isArray(p.pageurls) ? p.pageurls : [];
  const first = arr.find(v => v && String(v).trim())            // 1º da lista
             || p.imagemUrl || p.pageurls || p.fotoUrl          // fallback único
             || PLACEHOLDER;                                    // placeholder
  return normalizeUrl(String(first));
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

  //Pega o produto de acordo com ID
  const doc = await Ddocumento.findById(prodId).lean();
  if (!doc) throw new Error('Produto não encontrado');

  //interpreta o esquema do departamento
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

      await Ddocumento.updateOne(
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
      Ddocumento.countDocuments(filtro),
      Ddocumento.find(filtro, { descricao:1, pageurls:1,  localloja:1 })
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
  console.log('-------------------------------');
  console.log('ajuste/setoridSetor',req.params);
  console.log('0');
  try {
    const { idSetor } = req.params;
    if (!mongoose.isValidObjectId(idSetor))
      return res.status(400).json({ ok: false, error: 'idSetor inválido' });

    const secoes = await DeptoSecao.find({ idSetor }, { _id:1, nameSecao:1 })
      .sort({ nameSecao: 1 })
      .lean();
    console.log('');  
    console.log('secões=> ',secoes)
    console.log('-------------------------------------');
    return res.json({ ok: true, secoes });
  } catch (e) {
    console.error('[ajustes/setor/secoes]', e);
    return res.status(500).json({ ok: false, error: 'Falha ao buscar seções' });
  }
});

// DEFINIR SEÇÃO MANUAL DE UM PRODUTO
router.patch('/ajustes/produto/:id/definir-secao', async (req, res) => {
  console.log('0');
  console.log('ajuste/produto/:id/definir-secao',req.params);
  console.log('0');
  try {
    const { id } = req.params;
    const { idSecao } = req.body;

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ ok: false, error: 'id inválido' });
    if (!mongoose.isValidObjectId(idSecao))
      return res.status(400).json({ ok: false, error: 'idSecao inválido' });

    const prod = await Ddocumento.findById(id);
    if (!prod) return res.status(404).json({ ok: false, error: 'Produto não encontrado' });
    console.log('0');
    console.log(' produto => ',prod);
    console.log('0');
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


// Detalhe para o modal (mínimo necessário)
router.get('/ajustes/produto/:id/detalhe', async (req, res) => {
//   console.log('');
//   console.log(' id do produto => ',req.params);
//   console.log('');
   try {
//     const { id } = req.params;
//     if (!mongoose.isValidObjectId(id)) {
//       return res.status(400).json({ ok: false, error: 'id inválido' });
//     }

// //    const p = await Mconstrucao.findById(id).lean();
//     const p = await Mconstrucao.findById(
//                   id,
//                   { descricao: 1, pageurls: 1, imagemUrl: 1, localloja: 1 }
//                 ).lean();
//     if (!p) return res.status(404).json({ ok:false, error: 'Produto não encontrado' });

//     console.log(' Vr de p', p)
//     const ll = Array.isArray(p.localloja) ? p.localloja[0] : null;
//     const st = ll?.setor?.[0] || null;
//     const sc0 = st?.secao?.[0]  || null;

//     const idDepto = ll?.departamento?.[0] ? String(ll.departamento[0]) : '';
//     const idSetor = st?.idSetor ? String(st.idSetor) : '';   // se veio no formato novo
//     const idSecao = sc0?.idSecao ? String(sc0.idSecao) : '';

//     // nomes (opcional: só consulta se tiver id)
//     let nomeDepartamento = '';
//     let nomeDeptoSetor   = '';

//     if (idDepto) {
//       const dep = await Departamento.findById(idDepto, { nomeDepartamento: 1 }).lean();
//       nomeDepartamento = dep?.nomeDepartamento || '';
//     }

//     if (idSetor) {
//       const set = await DeptoSetor.findById(idSetor, { nomeDeptoSetor: 1, imagemUrl: 1, idDepto: 1 }).lean();
//       nomeDeptoSetor = set?.nomeDeptoSetor || '';
//     }

//     // imagens (pega a fonte que existir)
//      const pageurls = Array.isArray(p.pageurls) ? p.pageurls.filter(Boolean) : [];
//     const imagemUrl = p.imagemUrl || '';

//         const data = {
//               _id: String(p._id),
//               descricao: p.descricao || '',
//               pageurls,                // o front usa pageUrls[0] se quiser só a primeira
//               imagemUrl,               // fallback, se quiser
//               departamento: {
//                 id:   idDepto,
//                 nome: nomeDepartamento
//               },
//               setor: {
//                 id:      idSetor,
//                 nome:    nomeDeptoSetor,
//                 idDepto: idDepto
//               },
//               secao: {
//                 id:      idSecao,
//                 nome:    '',       // se quiser completar depois
//                 idDepto: idDepto,
//                 idSetor: idSetor
//               }
//     };
//     console.log(' ');
//     console.log(' O valor de data = ',data);
//     console.log(' ');
//     return res.json({ ok: true, data });
  //   router.get('/ajustes/produto/:id/detalhe', async (req, res) => {
  try {
    const { id } = req.params;
    const p = await Ddocumento.findById(id).lean();
    if (!p) return res.status(404).json({ ok: false, error: 'Produto não encontrado' });

    const ll = Array.isArray(p.localloja) ? p.localloja[0] : null;
    const st = ll?.setor?.[0] || null;
    const sc0 = st?.secao?.[0] || null;

    // IDs
    const idDepto = ll?.departamento?.[0] ? String(ll.departamento[0]) : '';
    const idSetor = st?.idSetor ? String(st.idSetor)
      : (mongoose.isValidObjectId(st?.nameSetor) ? String(st.nameSetor) : '');
    const idSecao = sc0?.idSecao ? String(sc0.idSecao) : '';

    // Lookups
    const dep = idDepto ? await Departamento.findById(idDepto, { nomeDepartamento: 1 }).lean() : null;
    const setor = idSetor ? await DeptoSetor.findById(idSetor, { nomeDeptoSetor: 1, imagemUrl: 1, idDepto: 1 }).lean() : null;
    const secao = idSecao ? await DeptoSecao.findById(idSecao, { nameSecao: 1, idDepto: 1, idSetor: 1 }).lean() : null;

    // 🟩 AQUI entra o objeto que você perguntou:
    const data = {
      _id: String(p._id),
      descricao: p.descricao || '',
      pageurls: Array.isArray(p.pageurls) ? p.pageurls.filter(Boolean) : [],
      departamento: {
        idDepto,
        nomeDepartamento: dep?.nomeDepartamento || ''
      },
      setor: {
        idSetor,
        nomeDeptoSetor: setor?.nomeDeptoSetor || '',
        idDepto: setor?.idDepto ? String(setor.idDepto) : idDepto,
        imagemUrl: setor?.imagemUrl || ''
      },
      secao: {
        idSecao,
        nameSecao: secao?.nameSecao || '',
        idDepto: secao?.idDepto ? String(secao.idDepto) : idDepto,
        idSetor: secao?.idSetor ? String(secao.idSetor) : idSetor
      }
    };

    console.log('👉 Detalhe ajustado:', data);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: 'Falha ao buscar detalhe do produto' });
  }
//});

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: 'Falha ao buscar detalhe' });
  }
});

module.exports = router;
