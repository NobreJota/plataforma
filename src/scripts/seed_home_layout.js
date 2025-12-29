require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

// ajuste o caminho do seu módulo de DB (você já usa connectToDatabase no server.js)
const { connectToDatabase } = require('../../database');

const HomeLayout = require('../models/home_layout');

(async () => {
  try {
    await connectToDatabase();

    const doc = {
      nome: 'default',
      slots: [
        { tipo:'hero', ordem:1, titulo:'Ofertas da semana', subtitulo:'Aproveite', imgUrl:'/img/home/hero1.jpg', linkUrl:'/buscar?q=promo', ativo:true },
        { tipo:'hero', ordem:2, titulo:'Frete e novidades', subtitulo:'Veja agora', imgUrl:'/img/home/hero2.jpg', linkUrl:'/buscar?q=novidades', ativo:true },

        { tipo:'destaque', ordem:1, titulo:'Kit Ferramentas', subtitulo:'até 20% off', imgUrl:'/img/home/d1.jpg', linkUrl:'/buscar?q=ferramentas', ativo:true },
        { tipo:'destaque', ordem:2, titulo:'Hidráulica', subtitulo:'preços baixos', imgUrl:'/img/home/d2.jpg', linkUrl:'/buscar?q=hidraulica', ativo:true },
        { tipo:'destaque', ordem:3, titulo:'Elétrica', subtitulo:'mais vendidos', imgUrl:'/img/home/d3.jpg', linkUrl:'/buscar?q=eletrica', ativo:true },
        { tipo:'destaque', ordem:4, titulo:'Imóveis', subtitulo:'oportunidades', imgUrl:'/img/home/d4.jpg', linkUrl:'/?segmento=Imóveis', ativo:true },

        { tipo:'lateral', ordem:1, titulo:'Seja um cooperado', subtitulo:'vantagens', imgUrl:'/img/home/side1.jpg', linkUrl:'/sejacooperado', ativo:true },
        { tipo:'lateral', ordem:2, titulo:'Anuncie aqui', subtitulo:'parceiros', imgUrl:'/img/home/side2.jpg', linkUrl:'/sejacooperado', ativo:true },
      ]
    };

    const existing = await HomeLayout.findOne({ nome: 'default' });
    if (existing) {
      await HomeLayout.updateOne({ _id: existing._id }, doc);
      console.log('✅ HomeLayout atualizado');
    } else {
      await HomeLayout.create(doc);
      console.log('✅ HomeLayout criado');
    }

  } catch (e) {
    console.error('❌ Seed falhou:', e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
