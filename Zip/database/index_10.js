// database/index.js
const mongoose = require("mongoose");

// Opcional: carrega .env localmente (na DigitalOcean use Environment Variables)
require("dotenv").config({ path: "./.env" });

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false); // não segura queries se não estiver conectado

// Logs úteis
mongoose.connection.on("connecting", () => console.log("Mongo: connecting..."));
mongoose.connection.on("connected",  () => console.log("Mongo: connected"));
mongoose.connection.on("error",      (e) => console.error("Mongo error:", e.message));
mongoose.connection.on("disconnected", () => console.log("Mongo: disconnected"));

async function connectToDatabase() {
  // Use um único nome para a variável de conexão
  const uri =
    process.env.MONGODB_URL ||
    process.env.DB_CONNECT ||       // compatibilidade com seu .env atual
    process.env.DATABASE_URL;

  console.log("20000",uri) 
  console.log('');
   
  if (!uri) {
    throw new Error("MONGODB_URI/DB_CONNECT não configurado.");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 20000,
    dbName: process.env.DB_NAME,    // opcional
  });

  console.log(
    "✅ MongoDB conectado:",
    mongoose.connection.host,
    "| DB:",
    mongoose.connection.name
  );
  return mongoose;
}

module.exports = { connectToDatabase, mongoose };
