const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Lojista = require("../../models/lojista");
const Fornecedor = require("../../models/fornecedor");
const ArquivoDoc = require('../../models/arquivoDoc');

const ImportModelo = require('../../models/ImportModelo');
const ImportLote = require('../../models/import_lote');
const ImportItem = require('../../models/import_item');


const cheerio = require("cheerio");
function parseHTMLTable(html) {
  const $ = cheerio.load(html);

  // pega apenas a PRIMEIRA tabela que tenha > 1 linha
  const table = $('table')
    .filter((i, tbl) => $(tbl).find('tr').length > 1)
    .first();

  if (!table || table.length === 0) return [];

  const data = [];

  table.find('tr').each((i, row) => {
    const cols = [];
    $(row).find('th, td').each((j, cell) => {
      const val = $(cell).text().trim();
      cols.push(val);
    });
    if (cols.length > 0) data.push(cols);
  });

  return data;
}

// ===== Helpers de parsing =====
const norm = s => (s||'')
  .toString()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();

function detectDelimiter(firstLine='') {
  const c = {
    ';': (firstLine.match(/;/g)||[]).length,
    ',': (firstLine.match(/,/g)||[]).length,
    '\t': (firstLine.match(/\t/g)||[]).length
  };
  return Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0] || ';';
}

// "1.234,56" -> 1234.56 | "1234.56" -> 1234.56 | vazio -> null
function toNumberBR(v){
  if (v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s) return null;
  // se tem vírgula como decimal
  if (/,/.test(s) && /\./.test(s)) {
    // remove separador de milhar e troca vírgula por ponto
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(s)) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// mapeia nomes de cabeçalho para campos padrão
const HEADER_ALIASES = {
  codigo:    ['codigo','código','cod','sku','ref','referencia','referência'],
  descricao: ['descricao','descrição','desc','produto','nome'],
  estoqueQte:['estoque/qte','estoque','qte','quantidade','qtde'],
  precoCusto:['preco custo','preço custo','custo','pcusto','preco_custo','p.custo'],
  taxaPercent:['taxa %','taxa','aliquota','alíquota','margem','taxa%'],
  precoVista:['preco vista','preço vista','avista','a vista','preco_vista'],
  precoMedio:['preco medio','preço médio','pmedio','pmédio','preco_medio'],
  precoPrazo:['preco prazo','preço prazo','prazo','a prazo','preco_prazo'],
  csosn:     ['csosn'],
  ncm:       ['ncm'],
  statusLinha:['status','situacao','situação']
};

function buildHeaderMap(headers = []) {
  const map = {};

  // normaliza todos os headers: minusculo, sem acento
  const H = headers.map(h => norm(h));

  for (const [campo, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = H.findIndex(h =>
      aliases.some(a => h === a || h.includes(a))   // ✅ casa "codigo" e também "codigo produto"
    );
    if (idx >= 0) {
      map[campo] = idx;
    }
  }

  return map;
}

const multer = require('multer');
// const { ConfigurationServicePlaceholders } = require('aws-sdk/lib/config_service_placeholders');
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter(req, file, cb) {
    const ok = [
      'text/plain',   
      'text/csv',
      'text/html',                              // ✅ agora aceita HTML
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ].includes(file.mimetype);

    if (!ok) {
      return cb(new Error('Tipo de arquivo não suportado (use TXT/CSV/HTML/XLSX).'));
    }
    cb(null, true);
  }
});

// PRIMEIRO A SER CHAMADO ABRE O CONFIG
router.get('/importdocumentos', async (req, res) => {
  console.log('200')
  try {
    const lojistaId = req.query.lojista || '';
    const lojista = lojistaId
      ? await Lojista.findById(lojistaId, { marca: 1, bairro: 1, cidade: 1 })
          .select('-senha')
          .lean()
      : null;

    // ⬇️ pegar os campos do schema do arquivoDoc
    const camposArquivoDoc = Object.keys(ArquivoDoc.schema.paths)
      .filter((nome) => !['_id', '__v'].includes(nome)) // ajuste essa blacklist se quiser
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    console.log('300',lojista);
    console.log('400',camposArquivoDoc);
    return res.render('pages/empresa/produto_import_config.handlebars', {
      layout: '',
      lojista,
      camposArquivoDoc   // ⬅ manda pra view
    });
  } catch (e) {
    console.error('erro ao abrir cadastro:', e);
    return res.status(500).send('Erro ao abrir cadastro de produto');
  }
});

// PEGAR OS FORNECEDORES PARA SELEÇÃO
router.get('/importacao/fornecedores', async (req, res) => {
  try {
    const lojistaId = req.query.lojista;
    if (!lojistaId) {
      return res.status(400).json({ error: 'Parâmetro ?lojista é obrigatório.' });
    }

    // ===== OPÇÃO B (mais comum no seu caso): procurar direto em Fornecedor
    // cobrimos os formatos: lojista (ObjectId), lojistas (Array<ObjectId) e embutidos com _id
    const filtroLojista = {
      $or: [
        { lojista: lojistaId },
        { lojistas: lojistaId },
        { 'lojista._id': lojistaId },
        { 'lojistas._id': lojistaId }
      ]
    };

    const fornecedoresDocs = await Fornecedor.find({
      ...filtroLojista,
      ativo: 1,
      datadel: null
    })
      .select('razao  cnpj _id')
      .sort({ nomeFantasia: 1, razaoSocial: 1, nome: 1, fantasia: 1, empresa: 1, nomeEmpresa: 1 })
      .lean();

    console.log('3-00', fornecedoresDocs)  
        
    //return{fornecedoresDocs}

    return res.json({ fornecedoresDocs });
  } catch (e) {
    console.error('Erro ao listar fornecedores do lojista:', e);
    return res.status(500).json({ error: e.message });
  }
});


// PREPARA O MAPEAMENTO DA TABELA
router.post('/importacao/upload', upload.single('arquivo'), async (req, res) => {
  try {
        const { lojista, fornecedor, dataOperacao } = req.body;
        const file = req.file;

        if (!fornecedor)  return res.status(400).json({ error: 'Fornecedor não informado.' });
        if (!dataOperacao) return res.status(400).json({ error: 'Data da operação é obrigatória.' });
        if (!file)        return res.status(400).json({ error: 'Arquivo não enviado.' });

        // 1) cria o LOTE
        const lote = await ImportLote.create({
          lojista,
          fornecedor,
          dataOperacao: new Date(dataOperacao),   // yyyy-mm-dd
          filename: file.filename || '',
          originalName: file.originalname || '',
          mimetype: file.mimetype || '',
          size: file.size || 0,
          headerMap: {},
          status: 'preparando'
        });

        console.log('CRIADO importLote',lote)
        // 2) leitura do arquivo em memória
        const buffer    = file.buffer;
        let inseridos   = 0;

        // =====================================================
        // 2A. CASO 1: ARQUIVO HTML (planilha exportada em HTML)
        // =====================================================
        if (file.mimetype === 'text/html') {

          const html      = buffer.toString('utf8');
          const tableData = parseHTMLTable(html);   // <-- usa sua função com cheerio

          if (!tableData.length) {
            await ImportLote.findByIdAndUpdate(lote._id, {
              status: 'erro',
              msg: 'Não encontrei nenhuma tabela no HTML.'
            });
            return res.status(400).json({ error: 'Tabela HTML vazia ou não encontrada.' });
          }

          // detectar qual linha é o cabeçalho
          let headerIndex = 0; // assume 1ª linha, mas tenta achar algo melhor

          for (let i = 0; i < tableData.length; i++) {
            const row       = tableData[i];
            const linhaNorm = row.map(x => norm(x)).join(' ');

            const temAlias = ['codigo', 'descricao', 'estoqueQte'].some(campo =>
              HEADER_ALIASES[campo].some(a => linhaNorm.includes(norm(a)))
            );

            if (temAlias) {
              headerIndex = i;
              break;
            }
          }

          const headers = tableData[headerIndex] || [];
          const hmap    = buildHeaderMap(headers);

          const headersOrdenados = [...headers].sort(
            (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
          );

          //console.log('HEADER (HTML) =>', headers);
          //console.log('hmap (HTML)   =>', hmap);

          // se mesmo assim não achar "codigo", força coluna 0
          if (!('codigo' in hmap)) {
            hmap.codigo = 0;
            console.warn('Aviso (HTML): não reconheci cabeçalho de código, usando coluna 0 como código.');
          }

         // console.log('-----------------------------------------------------------------------');
         // console.log('',tableData[0]);
          console.log('-----------------------------------------------------------------------');
          const rows = tableData.slice(headerIndex + 1); // linhas de dados
          const docs = [];

          for (const cols of rows) {
            const get = (k) => {
              const i = hmap[k];
              return (i !== undefined && i < cols.length)
                ? String(cols[i]).trim()
                : '';
            };

            const doc = {
              lote:         lote._id,
              lojista:      lote.lojista,
              fornecedor:   lote.fornecedor,
              dataOperacao: lote.dataOperacao,

              statusLinha:  get('statusLinha') || 'ok',

              // guarda todas as colunas originais da linha
              raw: Object.fromEntries(headers.map((h, idx) => [h, cols[idx] ?? '']))
            };

            if (!doc.codigo) continue;   // ignora linhas sem código
            docs.push(doc);
          }

          if (docs.length) {
            const result = await ImportItem.insertMany(docs, { ordered: false });
            inseridos = result.length;
          }

          await ImportLote.findByIdAndUpdate(lote._id, {
            status: 'pronto',
            msg: `Itens inseridos (HTML): ${inseridos}`
          });

          return res.json({
            ok: true,
            loteId: lote._id,
            inseridos,
            header: headersOrdenados           // ⬅️ manda as colunas para o frontend
          });
        }
        // =====================================================
        // 2C. OUTROS FORMATOS (ainda não tratados)
        // =====================================================
        await ImportLote.findByIdAndUpdate(lote._id, {
          status: 'erro',
          msg: 'Formato ainda não suportado.'
        });
        return res.status(400).json({ error: 'Formato ainda não suportado (use TXT/CSV/HTML por enquanto).' });

  } catch (err) {
    console.error('Erro no upload/importação:', err);
    return res.status(500).json({ error: err.message });
  }
});

// SALVA O LOTE PARA EVITAR IMPORTAR O FORNECEDOR DUAS VEZES
router.post('/importacao/salvar-lote', async (req, res) => {
  console.log('');
  console.log('[ 339 ] /importacao/-salvar-mapeamento',req.body);
  console.log('');
  try {
  //  const { loteId, mapeamento } = req.body;

    // if (!loteId || !mapeamento) {
    //   return res.status(400).json({
    //     ok: false,
    //     msg: 'loteId e mapeamento são obrigatórios.'
    //   });
    // }
    // console.log('400',loteId);
    // console.log('[ 351 ] /importacao/-salvar-mapeamento',mapeamento);
    // await ImportLote.updateOne(
    //   { _id: loteId },
    //   {
    //     $set: {
    //       mapeamento,
    //       dataMapeamento: new Date()
    //     }
    //   }
    // );

    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar mapeamento:', err);
    return res.status(500).json({
      ok: false,
      msg: 'Erro interno ao salvar mapeamento.'
    });
  }
});

// SALVA O MODELO EM IMPORT_MODELO => ESTÁ OK
router.post('/importcadastro/salvar-modelo', async (req, res) => {
  console.log('');
  console.log('req.body=> /_importcadastro/salvar-modelo')
  console.log('');
  try {
    const { software, mapeamento, lojistaId } = req.body;

    if (!software || !mapeamento) {
      return res.status(400).json({ ok: false, error: 'Dados incompletos' });
    }

     
    // mapeamento vem como: { "Pre�o": "precovista", "C�digo": "codigo", ... }
    const campos = Object.entries(mapeamento)
      .filter(([coluna, campo]) => coluna && campo && campo !== '(ignorar)')
      .map(([colunaArquivo, campoInterno]) => ({ colunaArquivo, campoInterno }));

    const filtro = { software }; 

    const update = {
      $set: { software, campos }
    };

    if (lojistaId) {
      update.$addToSet = { lojistas: lojistaId };
    }

    await ImportModelo.findOneAndUpdate(
      filtro,
      update,
      { upsert: true, new: true }
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error('Erro ao salvar modelo de importação:', e);
    return res.status(500).json({ ok: false, error: 'Erro ao salvar modelo' });
  }
});


module.exports = router;

