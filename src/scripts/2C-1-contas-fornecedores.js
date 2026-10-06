// src/scripts/2C-1-contas-fornecedores.js
// Cria o subtítulo no plano e o vínculo (vinculos[]) dos fornecedores já cadastrados.
//
// Uso (na raiz do projeto):
//   node src/scripts/2C-1-contas-fornecedores.js --lojista=6892706a86509313e632f717
//        → só mostra o que faria (nada é gravado)
//   node src/scripts/2C-1-contas-fornecedores.js --lojista=6892706a86509313e632f717 --aplicar
//        → grava
//
// Opções:
//   --titulo=2.01.001   título padrão (default: 2.01.001 fornecedores revenda)
//   --todos             inclui fornecedores sem nenhum sinal de ligação com a empresa
//                       (lojistaId, lojistas[].loja ou qlojistas[] antigos)
//
// Pode rodar de novo sem duplicar: quem já tem vínculo com a empresa é pulado.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Fornecedor = require('../models/fornec');
const ContaSubTitulo = require('../models/contab/financeiro/contaSubTitulo');
const contaFornecedor = require('../utils/contab/contaFornecedor');

// Exceções ao título padrão, por CNPJ/CPF só com dígitos. Preencha depois do primeiro dry-run.
const MAPA_TITULOS = {
  // '12345678000199': '2.01.002',
};

// ⚠ Use a mesma variável de conexão do 2C-0-sincronizar-indices.js
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

function arg(nome) {
  const a = process.argv.find(x => x === `--${nome}` || x.startsWith(`--${nome}=`));
  if (!a) return undefined;
  return a.includes('=') ? a.split('=').slice(1).join('=') : true;
}

// Aceita ObjectId, string ou subdocumento { loja } / { lojistaId }
function idsDe(valor) {
  if (!valor) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  return lista.flatMap(v => {
    if (!v) return [];
    if (v.loja || v.lojistaId) return [String(v.loja || v.lojistaId)];
    return [String(v)];
  });
}

async function main() {
  const lojistaStr = arg('lojista');
  const aplicar = !!arg('aplicar');
  const todos = !!arg('todos');
  const tituloPadrao = arg('titulo') || '2.01.001';

  if (!lojistaStr || !mongoose.isValidObjectId(lojistaStr)) {
    throw new Error('Informe --lojista=<ObjectId>.');
  }
  if (!MONGO_URI) throw new Error('Variável de conexão do MongoDB não encontrada no .env.');

  await mongoose.connect(MONGO_URI);
  const lojistaId = new mongoose.Types.ObjectId(lojistaStr);

  // Confere os títulos antes de começar
  const titulosUsados = new Set([tituloPadrao, ...Object.values(MAPA_TITULOS)]);
  for (const cod of titulosUsados) {
    if (!(await contaFornecedor.obterTitulo(lojistaId, cod))) {
      throw new Error(`Título ${cod} não existe, está suspenso ou não fica sob 2.01 nesta empresa.`);
    }
  }

  // Leitura crua: o model descarta lojistaId e qlojistas, que só existem nos documentos antigos
  const docs = await Fornecedor.collection.find({}).sort({ razao: 1 }).toArray();

  // Para o dry-run, simula a numeração a partir do último subtítulo de cada título
  const proximo = {};
  async function simularCodigo(titulo) {
    if (proximo[titulo] === undefined) {
      const ultimo = await ContaSubTitulo.findOne({ lojistaId, codigoContaTitulo: titulo }, { codigo: 1 })
        .sort({ codigo: -1 }).lean();
      proximo[titulo] = ultimo ? parseInt(ultimo.codigo.split('.').pop(), 10) + 1 : 1;
    }
    return `${titulo}.${String(proximo[titulo]++).padStart(3, '0')}`;
  }

  const contagem = { criados: 0, reaproveitados: 0, jaVinculados: 0, semLigacao: 0, erros: 0 };
  console.log(`\n${aplicar ? '🟢 APLICANDO' : '🔎 DRY-RUN (nada será gravado)'} — ${docs.length} fornecedores\n`);

  for (const d of docs) {
    const rotulo = `${(d.cnpj || '').padEnd(14)}  ${d.razao || '(sem razão)'}`;

    if ((d.vinculos || []).some(v => String(v.lojistaId) === lojistaStr)) {
      contagem.jaVinculados++;
      continue;
    }

    const ligado = [
      ...idsDe(d.lojistaId),
      ...idsDe(d.lojistas),
      ...idsDe(d.qlojistas)
    ].includes(lojistaStr);

    if (!ligado && !todos) {
      contagem.semLigacao++;
      console.log(`  ⏭  sem ligação   ${rotulo}`);
      continue;
    }

    const titulo = MAPA_TITULOS[d.cnpj] || tituloPadrao;

    // ncontabil antigo que já aponta para um subtítulo de fornecedor desta empresa: reaproveita
    let contaExistente = null;
    if (d.ncontabil && String(d.ncontabil).startsWith('2.01.')) {
      contaExistente = await ContaSubTitulo.findOne({ lojistaId, codigo: String(d.ncontabil).trim() }).lean();
      if (contaExistente) {
        const emUso = await Fornecedor.collection.findOne({
          _id: { $ne: d._id },
          vinculos: { $elemMatch: { lojistaId, ncontabil: contaExistente.codigo } }
        });
        if (emUso) contaExistente = null; // já é de outro fornecedor: cria uma nova
      }
    }

    if (!aplicar) {
      const cod = contaExistente ? contaExistente.codigo : await simularCodigo(titulo);
      console.log(`  ${contaExistente ? '♻️  reaproveita' : '➕ cria       '}  ${cod}  ${rotulo}`);
      contaExistente ? contagem.reaproveitados++ : contagem.criados++;
      continue;
    }

    let conta = null;
    try {
      const codigo = contaExistente
        ? contaExistente.codigo
        : (conta = await contaFornecedor.criarConta({ lojistaId, tituloCodigo: titulo, nome: d.razao })).codigo;

      const r = await Fornecedor.collection.updateOne(
        { _id: d._id, 'vinculos.lojistaId': { $ne: lojistaId } },
        { $push: { vinculos: { lojistaId, ncontabil: codigo, ativo: d.ativo !== false } } }
      );
      if (!r.modifiedCount) {
        await contaFornecedor.desfazerConta(conta);
        contagem.jaVinculados++;
        continue;
      }
      console.log(`  ${contaExistente ? '♻️  reaproveitou' : '✅ criou       '}  ${codigo}  ${rotulo}`);
      contaExistente ? contagem.reaproveitados++ : contagem.criados++;
    } catch (err) {
      await contaFornecedor.desfazerConta(conta);
      contagem.erros++;
      console.log(`  ❌ erro          ${rotulo} — ${err.message}`);
    }
  }

  console.log('\nResumo:', contagem);
  if (!aplicar) console.log('\nConfira a lista, ajuste MAPA_TITULOS se precisar e rode de novo com --aplicar.');
}

main()
  .catch(err => { console.error('\n❌', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
