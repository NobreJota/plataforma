// database/index.js
const mongoose = require('mongoose');

const MONGO_URI  = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();
if (!MONGO_URI) throw new Error('MONGO_URI (ou MONGODB_URI) ausente no .env');

mongoose.set('strictQuery', true);

async function connectToDatabase() {
  const isLocal = /(^mongodb(?:\+srv)?:\/\/)?(?:localhost|127\.0\.0\.1)/i.test(MONGO_URI);
  const opts = { serverSelectionTimeoutMS: 10000 };
  if (!isLocal && !/[\?&]tls=true/i.test(MONGO_URI) && !/^mongodb\+srv:\/\//i.test(MONGO_URI)) {
    opts.ssl = true; // para DO/Atlas quando a URI não traz ?tls=true
  }
  await mongoose.connect(MONGO_URI, opts);
  const c = mongoose.connection;
  console.log(`✅ MongoDB conecXtado: ${c.host}${c.port ? ':'+c.port : ''} | DB: ${c.name}`);
  return mongoose;
}

module.exports = { mongoose, connectToDatabase };
