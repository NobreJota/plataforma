require('dotenv').config();
const mongoose = require('mongoose');

const Parceiro = require('../../models/parceiro'); // ajuste se o nome do arquivo for outro

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const doc = await Parceiro.findOneAndUpdate(
    
    { slug: 'armacao' },
    {
      space:'',  
      nome: 'Armação',
      slug: 'armacao',
      url: 'https://www.exemplo.com.br',
      logo: 'https://via.placeholder.com/220x90?text=LOGO',
      descricao: 'Loja parceira dentro do Urutal.',
      plano: 'mensal',
      ativo: true
    },
    { upsert: true, new: true }
  );

  console.log('_____________________________________________');
  console.log('');
  console.log('Parceiro OK:', doc.slug, doc.url);
  console.log('_____________________________________________');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
