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
const Lojista      = require('../../models/lojista');       // lojas
const Departamento = require('../../models/departamento');  // segmentos

const hbs = require('hbs');
hbs.registerHelper('eq', (a, b) => String(a) === String(b));
hbs.registerHelper('moeda', v => `R$ ${(Number(v||0)).toFixed(2).replace('.', ',')}`);


// 7768
//router.get('/',(req,res)=>{
//   console.log('');
//   console.log('______________________________________');
//   console.log(' ');
//   console.log(' [ 18-site/home ]');
//   console.log(' origem views :quando usuário digita a URL "rotaes.com.br" ');
//   console.log(' origem route : _admin/admin-central/home.js/get("/")');
//   console.log(' obs : página do site HOME');
//   console.log('');
//   console.log(' destino :pages/site/home.handlebars :: layout:""');
//   console.log('');
//   console.log('');
   // res.render("pages/site/home",{ layouts:'central/main.handlebars'});
//   res.render('pages/site/home',{layout:''})
//})

const CIDADES_ES = ['Vitória','Vila Velha','Guarapari','Cariacica','Serra'];

router.get('/', async (req, res) => {
  try {
    const q         = (req.query.q || '').trim();
    const cidade    = (req.query.cidade || '').trim();
    const lojaId    = (req.query.loja || '').trim();
    const segmento  = (req.query.segmento || '').trim();

    const filtro = {};

    // texto
    if (q) {
      filtro.$or = [
        { descricao:  new RegExp(q, 'i') },
        { referencia: new RegExp(q, 'i') }
      ];
    }

    // segmento (departamento) — funciona para array ou campo único
    if (segmento && mongoose.isValidObjectId(segmento)) {
      filtro['localloja.departamento'] = new mongoose.Types.ObjectId(segmento);
    }

    // loja e/ou cidade
    if (lojaId && mongoose.isValidObjectId(lojaId)) {
      filtro.loja_id = new mongoose.Types.ObjectId(lojaId);
    } else if (cidade) {
      const lojas = await Lojista.find({ cidade: new RegExp(`^${cidade}$`, 'i') })
                                 .select('_id').lean();
      const ids = lojas.map(l => l._id);
      // Se não tiver loja no município, retorna vazio
      if (ids.length === 0) filtro.loja_id = null; else filtro.loja_id = { $in: ids };
    }

    // busca segmentos e lojas para preencher selects/chips
    const [segmentos, lojas] = await Promise.all([
      Departamento.find({}).select('nomeDepartamento').lean(),
      cidade
        ? Lojista.find({ cidade: new RegExp(`^${cidade}$`, 'i') }).select('razao').lean()
        : []
    ]);

    const docs = await Mconstrucao.find(filtro)
      .select('descricao preco pageurls loja_id localloja') // ajuste campos
      .limit(48)
      .lean();

    const produtos = docs.map(d => ({
      _id: d._id,
      descricao: d.descricao,
      preco: d.preco || 0,
      imagemUrl: Array.isArray(d.pageurls) && d.pageurls[0] ? d.pageurls[0] : '/img/sem-foto.png'
    }));

    res.render('pages/site/home', {
      layout: 'main'/'site',
      q,
      cidades: CIDADES_ES,
      cidadeSelecionada: cidade,
      lojas,
      lojaSelecionada: lojaId,
      segmentos,
      segmentoSelecionado: segmento,
      produtos
    });
  } catch (e) {
    console.error('Erro ao carregar Home:', e);
    res.status(500).send('Erro ao carregar Home');
  }
});


//});

  router.get('/api/lojas', async (req, res) => {
  try {
    const cidade = (req.query.cidade || '').trim();
    if (!cidade) return res.json({ lojas: [] });

    const lojas = await Lojista.find({ cidade: new RegExp(`^${cidade}$`, 'i') })
                               .select('_id razao')
                               .sort({ razao: 1 })
                               .lean();
    res.json({ lojas });
  } catch (e) {
    res.status(500).json({ error: 'Falha ao listar lojas' });
  }
});
module.exports=router