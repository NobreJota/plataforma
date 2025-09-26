const express=require('express')
const router=express.Router()
const mongoose = require('mongoose')
//const multer = require('multer')
//const path =require('path')
//const fs = require('fs')

// const { eAdmin } = require("../../../../helpers/eAdmin")
// const { eAdmin } = require("../../helpers/eAdmin")
//const flash = require('connect-flash')
//const console = require('console');

const Mconstrucao  = require('../../models/mconstrucao');   // produtos
const Lojista = require('../../models/lojista');       // lojas
const Departamento = require('../../models/departamento');  // segmentos


const CIDADES_ES = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'];

// helper pra regex segura
const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (req, res) => {
  try {
    const q        = (req.query.q || '').trim();
    const cidade   = (req.query.cidade || '').trim();
    const lojaId   = (req.query.loja || '').trim();
    const segmento = (req.query.segmento || '').trim();

    const filtro = {};

   let projecao = { descricao: 1, preco: 1, pageurls: 1, loja_id: 1, localloja: 1 };
   let ordenacao = { _id: -1 };

   if (q) {
      if (q.length >= 3) {
         filtro.$text = { $search: q };
         projecao.score = { $meta: 'textScore' };
         ordenacao = { score: { $meta: 'textScore' } };
      } else {
        const safe = escapeRegExp(q);
        filtro.$or = [
         { descricao:  { $regex: safe, $options: 'i' } },
         { referencia: { $regex: safe, $options: 'i' } }
        ];
      }
}

    // segmento (departamento)
    if (segmento && mongoose.isValidObjectId(segmento)) {
      filtro['localloja.departamento'] = new mongoose.Types.ObjectId(segmento);
    }

    console.log('filtro [ 73 ]=>', JSON.stringify(filtro));

    // loja e/ou cidade
    if (lojaId && mongoose.isValidObjectId(lojaId)) {
      filtro.loja_id = new mongoose.Types.ObjectId(lojaId);
    } else if (cidade) {
      const lojasCidade = await Lojista.find({
        cidade: { $regex: `^${escapeRegExp(cidade)}$`, $options: 'i' }
      }).select('_id').lean();
      // [] => zero resultados (correto quando não há lojas no município)
      filtro.loja_id = { $in: lojasCidade.map(l => l._id) };
    }

    // listas para selects/chips
    const [segmentos, lojas] = await Promise.all([
      Departamento.find({}).select('nomeDepartamento').lean(),
      // se cidade vazia => todas as lojas; se cidade setada => só daquela cidade
      Lojista.find(
        cidade
          ? { cidade: { $regex: `^${escapeRegExp(cidade)}$`, $options: 'i' } }
          : {}
      ).select('razao').lean()
    ]);

    filtro['pageurls.0'] = { $exists: true, $regex: /\S/ };

    const docs = await Mconstrucao.find(filtro, projecao)
         .sort(ordenacao)
         .limit(48)
         .lean();

    const produtos = docs.map(d => ({
      _id: d._id,
      descricao: d.descricao,
      preco: d.preco || 0,
      imagemUrl: Array.isArray(d.pageurls) && d.pageurls[0] ? d.pageurls[0] : '/img/sem-foto.png'
    }));

    // evita 304 durante debug
    res.set('Cache-Control', 'no-store');

    
    res.render('pages/site/home', {
         layout: 'site/home', // bate com views/layout/site/home.handlebars 
         q, cidades: CIDADES_ES, cidadeSelecionada: cidade,
         lojas, lojaSelecionada: lojaId,
         segmentos, segmentoSelecionado: segmento,
         produtos
   });
  } catch (e) {
    console.error('Erro ao carregar Home:', e);
    res.status(500).send('Erro ao carregar Home');
  }
});


module.exports=router