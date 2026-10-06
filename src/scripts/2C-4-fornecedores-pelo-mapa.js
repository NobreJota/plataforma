// src/scripts/2C-4-fornecedores-pelo-mapa.js
// Liga o cadastro de fornecedores às contas do plano novo, usando o mapa do
// de/para. É o passo seguinte ao de/para: lá se decidem as CONTAS; aqui cada
// FORNECEDOR ganha o vínculo com a conta nova da empresa.
//
// Entrada: fornecedores-conferencia.csv (gerado do sistema antigo), com a conta
// antiga, o CNPJ do cadastro antigo e o CNPJ do cadastro atual, quando existe.
//
// Para cada linha com conta antiga já decidida no de/para:
//   fornecedor já no cadastro (pelo CNPJ) → ganha o vínculo com a conta nova
//   CNPJ só no cadastro antigo            → cadastro criado com os dados do antigo
//   sem CNPJ                              → fica de fora, listado
//   conta não decidida ou descartada      → pulada
//
// Uso (na raiz do projeto):
//   node src/scripts/2C-4-fornecedores-pelo-mapa.js --lojista=<id> --arquivo=fornecedores-conferencia.csv
//   node src/scripts/2C-4-fornecedores-pelo-mapa.js --lojista=<id> --arquivo=fornecedores-conferencia.csv --aplicar
// Pode rodar de novo quantas vezes quiser: quem já tem vínculo é pulado.

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const Fornecedor = require('../models/fornec');
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

function arg(nome) {
  const a = process.argv.find(x => x === `--${nome}` || x.startsWith(`--${nome}=`));
  if (!a) return undefined;
  return a.includes('=') ? a.split('=').slice(1).join('=') : true;
}

// O cadastro antigo guarda o estado por extenso; o novo usa a sigla (2 letras).
const UF = {
  'acre':'AC','alagoas':'AL','amapa':'AP','amazonas':'AM','bahia':'BA','ceara':'CE','distrito federal':'DF',
  'espirito santo':'ES','goias':'GO','maranhao':'MA','mato grosso':'MT','mato grosso do sul':'MS',
  'minas gerais':'MG','para':'PA','paraiba':'PB','parana':'PR','pernambuco':'PE','piaui':'PI',
  'rio de janeiro':'RJ','rio grande do norte':'RN','rio grande do sul':'RS','rondonia':'RO','roraima':'RR',
  'santa catarina':'SC','sao paulo':'SP','sergipe':'SE','tocantins':'TO'
};
const semAcento = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const sigla = s => { const v = String(s || '').trim(); return v.length === 2 ? v.toUpperCase() : (UF[semAcento(v)] || ''); };
const digitos = s => String(s || '').replace(/\D/g, '');

// CSV com ponto e vírgula e aspas, como o Excel salva
function lerCSV(texto) {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const partir = linha => {
    const campos = []; let atual = '', aspas = false;
    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') { if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
      else if (c === ';' && !aspas) { campos.push(atual); atual = ''; }
      else atual += c;
    }
    campos.push(atual);
    return campos.map(x => x.trim());
  };
  const cab = partir(linhas[0]);
  return linhas.slice(1).map(l => Object.fromEntries(partir(l).map((v, i) => [cab[i], v])));
}

async function main() {
  const lojistaStr = arg('lojista');
  const arquivo = arg('arquivo');
  const aplicar = !!arg('aplicar');
  if (!lojistaStr || !mongoose.isValidObjectId(lojistaStr)) throw new Error('Informe --lojista=<ObjectId>.');
  if (!arquivo || !fs.existsSync(String(arquivo))) throw new Error('Informe --arquivo=<fornecedores-conferencia.csv> (na raiz do projeto).');
  if (!MONGO_URI) throw new Error('Variável de conexão do MongoDB não encontrada no .env.');

  await mongoose.connect(MONGO_URI);
  const lojistaId = new mongoose.Types.ObjectId(lojistaStr);
  const mapa = mongoose.connection.collection('_mapa_contas');
  const col = Fornecedor.collection;

  const linhas = lerCSV(fs.readFileSync(String(arquivo), 'utf8')).filter(l => l.conta_antiga);
  console.log(`\n${aplicar ? '🟢 APLICANDO' : '🔎 DRY-RUN (nada será gravado)'} — ${linhas.length} linhas com conta antiga\n`);

  const cont = { ligados: 0, criados: 0, jaLigados: 0, semCnpj: 0, naoDecididas: 0, descartadas: 0, conflitos: 0 };
  const contaUsada = new Map();   // conta nova → CNPJ que já ficou com ela nesta execução
  const cnpjUsado = new Map();    // CNPJ → conta nova que já ficou com ele nesta execução

  for (const l of linhas) {
    const decisao = await mapa.findOne({ lojistaId, codigoAntigo: l.conta_antiga });
    const rotulo = `${l.conta_antiga}  ${(l.razao_cadastro_antigo || l.nome_no_plano_antigo || '').slice(0, 45)}`;

    if (!decisao) { cont.naoDecididas++; continue; }
    if (decisao.acao === 'descartar' || !decisao.codigoNovo) { cont.descartadas++; continue; }

    const contaNova = decisao.codigoNovo;

    // Casamento marcado para conferir na planilha: só entra quando a palavra sair de lá
    if (/conferir/i.test(l.sugestao || '')) {
      cont.conferir = (cont.conferir || 0) + 1;
      console.log(`   🔍 conferir         ${rotulo}  → ${contaNova}  (apague CONFERIR na planilha para confirmar)`);
      continue;
    }
    const cnpj = digitos(l.cnpj_cadastro_atual) || digitos(l.cnpj_antigo);
    if (![11, 14].includes(cnpj.length)) {
      cont.semCnpj++;
      console.log(`   ❓ sem CNPJ          ${rotulo}  → ${contaNova}`);
      continue;
    }

    // Duas empresas diferentes na mesma conta é erro de decisão: não liga nenhuma a mais
    if (contaUsada.has(contaNova) && contaUsada.get(contaNova) !== cnpj) {
      cont.conflitos++;
      console.log(`   ❌ conta ${contaNova} já ficou com outro CNPJ nesta lista: ${rotulo}`);
      continue;
    }
    // A mesma empresa em duas contas: o cadastro aceita só um vínculo por empresa
    if (cnpjUsado.has(cnpj) && cnpjUsado.get(cnpj) !== contaNova) {
      cont.conflitos++;
      console.log(`   ❌ mesmo CNPJ já ficou com ${cnpjUsado.get(cnpj)}: ${rotulo} → ${contaNova}`);
      console.log(`      junte as duas no de/para (equivalência) ou deixe esta conta sem fornecedor`);
      continue;
    }
    contaUsada.set(contaNova, cnpj);
    cnpjUsado.set(cnpj, contaNova);

    const existente = await col.findOne({ cnpj });
    const vinculo = { lojistaId, ncontabil: contaNova, ativo: l.ativo_no_antigo !== 'não' };

    if (existente) {
      const atual = (existente.vinculos || []).find(v => String(v.lojistaId) === lojistaStr);
      if (atual) {
        cont.jaLigados++;
        if (atual.ncontabil !== contaNova) {
          console.log(`   ⚠ já ligado a ${atual.ncontabil}, o mapa diz ${contaNova}: ${rotulo} (não alterado)`);
        }
        continue;
      }
      cont.ligados++;
      console.log(`   ${aplicar ? '✅ ligou  ' : '➕ ligaria '}  ${contaNova}  ${existente.razao}`);
      if (aplicar) {
        await col.updateOne(
          { _id: existente._id, 'vinculos.lojistaId': { $ne: lojistaId } },
          { $push: { vinculos: vinculo } }
        );
      }
      continue;
    }

    // Não está no cadastro: nasce com os dados do sistema antigo
    cont.criados++;
    const razao = l.razao_cadastro_antigo || l.nome_no_plano_antigo;
    console.log(`   ${aplicar ? '🆕 criou  ' : '🆕 criaria'}  ${contaNova}  ${razao}  (${cnpj})`);
    if (aplicar) {
      await Fornecedor.create({
        tipo: cnpj.length === 11 ? 'PF' : 'PJ',
        razao,
        cnpj,
        inscricao: l.inscricao && l.inscricao !== '0' ? l.inscricao : '',
        address: { cidade: l.cidade || '', estado: sigla(l.uf) },
        vinculos: [vinculo],
        ativo: true
      });
    }
  }

  console.log('\nResumo:', cont);
  if (cont.naoDecididas) console.log(`   ${cont.naoDecididas} conta(s) ainda sem decisão no de/para: rode de novo depois de decidir.`);
  if (cont.semCnpj) console.log('   Os sem CNPJ entram pela tela de fornecedores, informando o CNPJ; ela busca o resto na Receita.');
  if (!aplicar) console.log('\nConfira acima e rode de novo com --aplicar.');
}

main()
  .catch(err => { console.error('\n❌', err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
