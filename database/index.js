// database/index.js
// Destino: C:\plataformaRota\database\index.js
// Alterado em: 29/10/2026 (Jorge) - conexao mais resistente as quedas (ECONNRESET):
//   - maxIdleTimeMS: conexao parada ha 1 min e fechada e renovada por nos, antes que o DigitalOcean a corte
//   - heartbeatFrequencyMS: confere o servidor a cada 10 s (acha o primario novo depois de manutencao)
//   - socketTimeoutMS: operacao travada desiste em 45 s (em vez de ficar pendurada)
//   - retryReads / retryWrites: o driver repete UMA vez leitura/gravacao que caiu no meio (padrao do Mongo)
//   - avisos no terminal quando cai e quando volta (o mongoose reconecta sozinho); erro de conexao nao derruba o servidor
const mongoose = require('mongoose');

const MONGO_URI  = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();
if (!MONGO_URI) throw new Error('MONGO_URI (ou MONGODB_URI) ausente no .env');

mongoose.set('strictQuery', true);

async function connectToDatabase() {
  const isLocal = /(^mongodb(?:\+srv)?:\/\/)?(?:localhost|127\.0\.0\.1)/i.test(MONGO_URI);
  const opts = {
    serverSelectionTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    maxIdleTimeMS: 60000,
    socketTimeoutMS: 45000,
    retryReads: true,
    retryWrites: true,
  };
  if (!isLocal && !/[\?&]tls=true/i.test(MONGO_URI) && !/^mongodb\+srv:\/\//i.test(MONGO_URI)) {
    opts.ssl = true; // para DO/Atlas quando a URI não traz ?tls=true
  }
  const c = mongoose.connection;
  // 29/10/2026: avisos de queda e volta (uma vez so, mesmo se connectToDatabase for chamada de novo)
  if (!c._avisosQueda) {
    c._avisosQueda = true;
    const hora = () => new Date().toLocaleTimeString('pt-BR');
    c.on('disconnected', () => console.warn('⚠ [' + hora() + '] MongoDB desconectou — tentando reconectar…'));
    c.on('reconnected', () => console.log('✅ [' + hora() + '] MongoDB reconectado'));
    c.on('error', err => console.error('⚠ [' + hora() + '] MongoDB: ' + (err && err.message)));
  }
  await mongoose.connect(MONGO_URI, opts);
  console.log(`✅ MongoDB conectado=1000: ${c.host}${c.port ? ':' + c.port : ''} | DB: ${c.name}`);
  return mongoose;
}

module.exports = { mongoose, connectToDatabase };
