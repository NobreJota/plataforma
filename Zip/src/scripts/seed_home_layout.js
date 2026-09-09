require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectToDatabase } = require('../../database');

const HomeLayout = require('../models/home_layout');
const Campanha = require('../models/campanha');
const enumTipoDono = Campanha.schema.path("tipoDono")?.enumValues || [];
console.log("ENUM tipoDono permitido:", enumTipoDono);

(async () => {
  try {
    await connectToDatabase();

    // 1) recria campanha
    const campanha = await Campanha.create({
      titulo: 'Campanha Inicial',
      status: 'ativa',
      tipoDono: 'empresa',
      empresaNome: 'Rotaes'
    });

    // 2) recria o homelayout inteiro (sem Compass)
    await HomeLayout.deleteMany({ nome: 'default' });

    await HomeLayout.create({
      nome: 'default',
      campanhaId: campanha._id,
      empresaNome: 'Rotaes',
      slots: [
        // HERO (2)
        { tipo: 'hero', ordem: 1, titulo: 'Ofertas da semana', subtitulo: 'Aproveite', imgUrl: '/img/home/hero1.jpg', linkUrl: '/buscar?q=promo' },
        { tipo: 'hero', ordem: 2, titulo: 'Frete e novidades', subtitulo: 'Veja agora', imgUrl: '/img/home/hero2.jpg', linkUrl: '/buscar?q=novidades' },

        // DESTAQUES (4)  <-- os AMARELOS
        { tipo: 'destaque', ordem: 1, titulo: 'Kit Ferramentas', subtitulo: 'até 20% off', imgUrl: '/img/home/d1.jpg', linkUrl: '/buscar?q=ferramentas' },
        { tipo: 'destaque', ordem: 2, titulo: 'Hidráulica', subtitulo: 'preços baixos', imgUrl: '/img/home/d2.jpg', linkUrl: '/buscar?q=hidraulica' },
        { tipo: 'destaque', ordem: 3, titulo: 'Elétrica', subtitulo: 'mais vendidos', imgUrl: '/img/home/d3.jpg', linkUrl: '/buscar?q=eletrica' },
        { tipo: 'destaque', ordem: 4, titulo: 'Imóveis', subtitulo: 'oportunidades', imgUrl: '/img/home/d4.jpg', linkUrl: '/segmento=Imoveis' },

        // LATERAL (2)
        { tipo: 'lateral', ordem: 1, titulo: 'Seja um cooperado', subtitulo: 'vantagens', imgUrl: '/img/home/side1.jpg', linkUrl: '/sejacooperado' },
        { tipo: 'lateral', ordem: 2, titulo: 'Anuncie aqui', subtitulo: 'parceiros', imgUrl: '/img/home/side2.jpg', linkUrl: '/parceiros' },
      ]
    });

    console.log('✅ Seed: campanha + homelayout recriados com HERO/DESTAQUE/LATERAL');
  } catch (e) {
    console.error('❌ Seed falhou:', e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
