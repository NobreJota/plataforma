const express = require('express');
const router = express.Router();
// migrate_access_to_mongo.js
const odbc = require("odbc");
const { MongoClient } = require("mongodb");

// ====== CONFIG ======
const ACCESS_FILE = "C:\\SUA_PASTA\\seu_banco.mdb"; // ou .accdb

// String ODBC (pode variar conforme driver instalado)
const ACCESS_CONN_STR =
  `Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=${ACCESS_FILE};`;

const MONGO_URI = process.env.MONGO_URI; // ex: mongodb+srv://...
const DB_NAME = "suaBase";
const ACCESS_TABLE = "Clientes";         // tabela no Access
const MONGO_COLLECTION = "clientes";     // coleção no Mongo
const LEGACY_ID_FIELD = "Codigo";        // campo PK/ID no Access

async function main() {
  if (!MONGO_URI) {
    throw new Error("Defina MONGO_URI no ambiente.");
  }

  const access = await odbc.connect(ACCESS_CONN_STR);
  const mongoClient = new MongoClient(MONGO_URI);

  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const col = db.collection(MONGO_COLLECTION);

    // 1) Extrai
    const rows = await access.query(`SELECT * FROM ${ACCESS_TABLE}`);

    // 2) Carrega com UPSERT (por legacyId)
    const ops = rows.map((r) => {
      const legacyId = r[LEGACY_ID_FIELD];
      if (legacyId === undefined || legacyId === null) return null;

      // Transformações simples (adicione as suas)
      const doc = {
        legacyId,
        ...r,
      };

      // opcional: remove campos problemáticos/irrelevantes
      delete doc.ID; // se existir e você não quiser
      return {
        updateOne: {
          filter: { legacyId },
          update: { $set: doc },
          upsert: true,
        },
      };
    }).filter(Boolean);

    if (ops.length) {
      const result = await col.bulkWrite(ops, { ordered: false });
      console.log("OK:", result.modifiedCount, "modificados,", result.upsertedCount, "novos");
    } else {
      console.log("Nada a migrar.");
    }
  } finally {
    await access.close();
    await mongoClient.close();
  }
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});




module.exports = router;