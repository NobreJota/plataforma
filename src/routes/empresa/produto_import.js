const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Lojista = require("../../models/lojista");
const Fornecedor = require("../../models/fornecedor");
const ArquivoDoc = require('../../models/arquivoDoc');

const ImportModelo = require('../../models/ImportModelo');
const ImportLote = require('../../models/import_lote');
const ImportItem = require('../../models/import_item');


const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const Papa   = require('papaparse');
const XLSX   = require('xlsx');

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

function normalizarDecimal(valor) {
  if (valor === undefined || valor === null) return null;

  const apenasDigitos = String(valor).replace(/[^\d]/g, '');
  if (!apenasDigitos) return null;

  const centavos = parseInt(apenasDigitos, 10);
  const strReais = (centavos / 100).toFixed(2); // "262.05"

  return mongoose.Types.Decimal128.fromString(strReais);
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

function limparTexto(txt = '') {
  return String(txt)
    .replace(/�/g, '')              // remove caractere corrompido
    //.normalize('NFC')               // normaliza acentos
    .replace(/\s+/g, ' ')           // espaços duplos
    .trim();
}

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

    if (!fornecedor)   return res.status(400).json({ error: 'Fornecedor não informado.' });
    if (!dataOperacao) return res.status(400).json({ error: 'Data da operação é obrigatória.' });
    if (!file)         return res.status(400).json({ error: 'Arquivo não enviado.' });

    // Agora é seguro acessar o buffer
    const buffer = file.buffer;
    const html   = buffer.toString('utf8');

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
      status: 'preparando',
      html
    });

    console.log('CRIADO importLote', lote);

    let inseridos = 0;

    // =====================================================
    // 2A. CASO 1: ARQUIVO HTML (planilha exportada em HTML)
    // =====================================================
    if (file.mimetype.startsWith('text/html')) {

      // já temos "html" acima
      const tableData = parseHTMLTable(html);
      console.log("tableData:", tableData.length);
      if (!tableData.length) {
        await ImportLote.findByIdAndUpdate(lote._id, {
          status: 'erro',
          msg: 'Não encontrei nenhuma tabela no HTML.'
        });
        return res.status(400).json({ error: 'Tabela HTML vazia ou não encontrada.' });
      }

      let headerIndex = 0;

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

      console.log("headerIndex:", headerIndex);
      const headers = tableData[headerIndex] || [];
      const hmap    = buildHeaderMap(headers);

      const headersLimpos = headers.map(h => limparTexto(h));
      console.log("headers:", headersLimpos);
      console.log('[ 267 ]')
      const headersOrdenados = [...headersLimpos].sort(
        (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      );

      if (!('codigo' in hmap)) {
        hmap.codigo = 0;
        console.warn('Aviso (HTML): não reconheci cabeçalho de código, usando coluna 0 como código.');
      }

      const rows = tableData.slice(headerIndex + 1);
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
          raw: Object.fromEntries(headers.map((h, idx) => [h, cols[idx] ?? '']))
        };

        if (!doc.codigo) continue;
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
        header: headersOrdenados
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


// SEGUNDA
// POST /importtabela/importacao/salvar-modelo
router.post('/importacao/salvar-modelo', async (req, res) => {
  console.log('');
  console.log('X10',req.body);
  console.log('');
  try {
    const { software, lojistaId, fornecedorId, campos } = req.body;

    // validação básica
    if (!software || !lojistaId || !fornecedorId || !Array.isArray(campos) || !campos.length) {
      return res.status(400).json({ ok: false, msg: 'Dados incompletos.' });
    }
    console.log('AQUI')
    // normaliza campos
    const camposNormalizados = campos
      .map(c => ({
        colunaArquivo: String(c.colunaArquivo || '').trim(),
        campoInterno : String(c.campoInterno || '').trim()
      }))
      .filter(c => c.colunaArquivo && c.campoInterno);

    if (!camposNormalizados.length) {
      return res.status(400).json({ ok: false, msg: 'Nenhum campo mapeado válido.' });
    }

    // === 1) SALVA / ATUALIZA MODELO =====================================
    let modelo = await ImportModelo.findOne({
      software: String(software),
      lojistas: lojistaId
    });

    if (modelo) {
      modelo.campos = camposNormalizados;
      if (!modelo.lojistas.some(id => String(id) === String(lojistaId))) {
        modelo.lojistas.push(lojistaId);
      }
      await modelo.save();
    } else {
      modelo = await ImportModelo.create({
        software: String(software),
        lojistas: [lojistaId],
        campos: camposNormalizados
      });
    }

    // === 2) CRIA IMPORT_LOTE ============================================
    // ⚠️ ajuste os nomes dos campos conforme seu schema ImportLote
    const lote = await ImportLote.create({
      lojista   : lojistaId,
      fornecedor: fornecedorId,
      modelo    : modelo._id,
      dataOperacao  : new Date()
    });

    // === 3) RETORNA IDs PARA O FRONT FAZER O REDIRECT ===================
    return res.json({
      ok       : true,
      modeloId : modelo._id.toString(),
      loteId   : lote._id.toString()
    });

  } catch (err) {
    console.error('Erro em /importacao/salvar-modelo:', err);
    return res.status(500).json({ ok: false, msg: 'Erro interno.' });
  }
});

// PRIMEIRA
router.get('/importacao/import-itens', async (req, res) => {
     try {
    const lojistaId = req.query.lojista || '';

    let lojista = null;
    let fornecedores = [];

    if (lojistaId) {
      lojista = await Lojista.findById(lojistaId).lean();
      fornecedores = await Fornecedor.find({ datadel: null }).sort({ razao: 1 }).lean();
    }
   // console.log('fornec ',fornecedores);
    console.log(' lojista',lojista);
    console.log('');
    //console.log('',fornecedores);
    console.log('');
    // ==== CAMPOS DO MODEL "ARQUIVO-DOCS" ====
    const camposInternos = Object.keys(ArquivoDoc.schema.paths)
      .filter(n => !['_id', '__v', 'createdAt', 'updatedAt'].includes(n));
   // console.log('campos',camposInternos)
    return res.render('pages/empresa/produto_import_itens', {
      layout: false,
      lojistaId,
      //marcaloja: lojista?.marcaloja || lojista?.razao || '',
      lojista,
      fornecedores,
      camposInternos        // <== vai para a coluna “nosso campo”
    });
  } catch (err) {
    console.error('Erro ao abrir produto_cria_modelo:', err);
    return res.status(500).send('Erro ao abrir tela de criação de modelo.');
  }
});

// GET /importtabela/importacao/itens?lojistaId=...&fornecedorId=...&modeloId=...&loteId=...
router.get('/importacao/itens', async (req, res) => {
  try {
    const { lojistaId, fornecedorId, modeloId, loteId } = req.query;

    const lojista    = lojistaId    ? await Lojista.findById(lojistaId).lean()    : null;
    const fornecedor = fornecedorId ? await Fornecedor.findById(fornecedorId).lean() : null;
    const modelo     = modeloId     ? await ImportModelo.findById(modeloId).lean()   : null;

    const camposDocs = Object.keys(ArquivoDoc.schema.paths)
     .filter(n => !['_id', '__v', 'createdAt', 'updatedAt'].includes(n));

    res.render('pages/empresa/produto_import_itens', {
      layout: false,
      lojistaId,
      loja_id    : lojista?._id,
      marcaloja  : lojista?.marcaloja || lojista?.razaoSocial || '',
      fornecedorId,
      fornecedorNome: fornecedor?.razaoSocial || fornecedor?.fantasia || '',
      modeloId,
      modeloSoftware: modelo?.software || '',
      modeloCamposJson: JSON.stringify(modelo?.campos || []),
      camposDocsJson: JSON.stringify(camposDocs),
      loteId,
    });
  } catch (err) {
    console.error('Erro ao abrir tela de itens de importação:', err);
    return res.status(500).send('Erro ao abrir itens de importação');
  }
});

//  Grava documentos em ImportItem
// ====================================================================
router.post('/importacao/itens/gravar', async (req, res) => {
  console.log('3000 - /importacao/itens/gravar');
  try {
    const {
      loja_id,
      marcaloja,
      cidade,
      bairro,
      fornecedorId,
      fornecedorNome,
      itens,
      mapeamento
    } = req.body;

    // =================== VALIDAÇÕES BÁSICAS ===================
    if (!loja_id) {
      return res.status(400).json({ error: 'loja_id é obrigatório.' });
    }
    if (!fornecedorId) {
      return res.status(400).json({ error: 'fornecedorId é obrigatório.' });
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Nenhum item enviado.' });
    }
    if (!Array.isArray(mapeamento) || mapeamento.length === 0) {
      return res.status(400).json({ error: 'Nenhum mapeamento informado.' });
    }

    // =================== HELPERS ===================

    // decimal brasileiro -> Decimal128
    const toDecimal128 = (valor) => {
      if (valor === undefined || valor === null || valor === '') return undefined;
      const s = String(valor).trim();
      if (!s) return undefined;
      const normalizado = s
        .replace(/\./g, '')   // tira milhares
        .replace(/,/g, '.');  // vírgula -> ponto
      return mongoose.Types.Decimal128.fromString(normalizado);
    };

    // quebra texto em descricao (sem número) e complete (resto)
    function separarDescricaoComplete(texto = '') {
      if (!texto) return { descricao: '', complete: '' };

      // primeira posição com número, / ou =
      const idx = texto.search(/[0-9\/=]/);

      if (idx === -1) {
        // não achou nada -> tudo em descricao
        return {
          descricao: texto.trim(),
          complete: ''
        };
      }

      const parteDescricao = texto.slice(0, idx).trim();
      const parteComplete  = texto.slice(idx).trim();

      return {
        descricao: parteDescricao,
        complete: parteComplete
      };
    }

    // =================== MONTAGEM DOS DOCUMENTOS ===================
    const docs = itens.map((linhaBruta) => {
      const colunas = String(linhaBruta).split(';');

      const doc = {
        loja_id,
        marcaloja: marcaloja || '',
        cidade:    cidade    || '',
        bairro:    bairro    || '',
        fornecedorId,
        fornecedorNome: fornecedorNome || '',
        linhaBruta,
        // status: {               // se seu schema tiver esse subdoc
        //   status: 'pendente'
        // }
      };

      // percorre o mapeamento vindo do front
      for (const map of mapeamento) {
        const { campoInterno, indiceColuna } = map;
        const idxCol = Number(indiceColuna);
        const valorBruto = (colunas[idxCol] ?? '').toString().trim();
        const valor      = String(valorBruto).trim();

        // ---------- regra especial para DESCRICAO ----------
        if (campoInterno === 'descricao') {
            const { descricao, complete } = separarDescricaoComplete(valorBruto);

            let descFinal = (descricao || '').trim();
            let compFinal = (complete  || '').trim();

            // se a descrição está vazia ou com menos de 2 caracteres,
            // colocamos a palavra "corrigir" para passar na validação
            if (!descFinal || descFinal.length < 2) {
              descFinal = 'corrigir';
            }

            doc.descricao = descFinal;
            doc.complete  = compFinal;  // aqui pode ficar vazio, não tem minLength

            continue;
        }

          // se o usuário mapeou "complete" direto
        if (campoInterno === 'complete') {
          doc.complete = valorBruto;
          continue;
        }

        if (campoInterno === 'ativo') {
            // no arquivo: 1 = ativo, 0 (ou vazio) = inativo
            if (valor === '') {
              // se vier vazio, deixa o default do schema (true) ou força false, você que decide:
              // doc.ativo = true;   // ou false
            } else {
              doc.ativo = (valor === '1');  // true se "1", false se "0" ou qualquer outra coisa
            }
            continue; // vai pro próximo campo
          }

      

        // ---------- exemplo de campos numéricos em Decimal128 ----------
        if (['precocusto', 'precoprazo', 'pmédio', 'pmédio', 'taxa'].includes(campoInterno)) {
          doc[campoInterno] = toDecimal128(valorBruto);
          continue;
        }

        // ---------- resto cai aqui como string normal ----------
        doc[campoInterno] = valorBruto;
      }

      return doc;
    });

    console.log('docs a gravar =>', docs.length);

    // =================== GRAVAÇÃO NO MONGO ===================
    const result = await ImportItem.insertMany(docs);
    console.log('ImportItem gravados =>', result.length);

    return res.json({
      ok: true,
      inseridos: result.length
    });
  } catch (err) {
    console.error('Erro ao gravar itens de importação:', err);
    return res.status(500).json({
      error: 'Erro ao gravar itens de importação.'
    });
  }
});

router.post('/importacao/upload-arquivo', upload.single('arquivo'), (req, res) => {
  const { originalname, buffer } = req.file;

  let linhas = [];

  if (originalname.endsWith('.xlsx')) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    linhas = XLSX.utils.sheet_to_json(ws, { header: 1 }); // array de arrays
  } else {
    const texto = buffer.toString('utf8');
    const parsed = Papa.parse(texto, {
      header: false,
      delimiter: ';',      // ou deixar blank que ele tenta detectar
      skipEmptyLines: true
    });
    linhas = parsed.data;
  }

  // devolve só as primeiras linhas pro front montar as colunas
  res.json({ linhasPreview: linhas.slice(0, 200) });
});

router.get('/importacao/ajuste', async (req, res) => {
      console.log('req.body',req.query);
      try {
              const lojistaId     = req.query.lojista || '';
              const fornecedorId  = req.query.fornecedor || '';

              if (!lojistaId || !fornecedorId) {
                return res.status(400).send('Parâmetros obrigatórios não informados.');
              }
         
              // TODOS os campos do ArquivoDoc
              const camposArquivo = Object
                .keys(ArquivoDoc.schema.paths)
                .filter(n => !['_id', '__v', 'createdAt', 'updatedAt'].includes(n));

              // esses 4 ficam na BARRA VERDE (inputs) e NÃO entram no cabeçalho da tabela
              const CAMPOS_TOPO = ['loja_id', 'marcaloja', 'cidade', 'bairro', 'fornecedor'];

              // campos que realmente vão virar COLUNAS na tabela
              const camposTabela = camposArquivo.filter(n => !CAMPOS_TOPO.includes(n));

              const lojista     = await Lojista.findById(lojistaId).lean();
              const fornecedor  = await Fornecedor.findById(fornecedorId).lean();

              const itensPendentes = await ImportItem.find({
                  loja_id: lojistaId,
                  fornecedorId: fornecedorId,
                  status: 'pendente'
                })
                .sort({ codigo: 1 })
                .lean();

              return res.render('pages/empresa/produto_import_ajuste', {
                layout: false,
                lojistaId,
                lojista,
                fornecedor,
                camposTabela,      // <<< só os campos que vão para o cabeçalho
                itens: itensPendentes
              });
        } catch (err) {
          console.error('Erro ao abrir tela de ajuste de importação:', err);
          return res.status(500).send('Erro ao abrir tela de ajuste de importação.');
        }
});

router.post('/importacao/ajuste/salvar', async (req, res) => {
    console.log('salvaredição',req.body)
    try {
    const { idItem, ...dados } = req.body;

    if (!idItem) {
      return res.status(400).json({ error: 'ID do item não informado.' });
    }

    // Campos que precisam de tratamento de decimal
    const camposDecimais = ['precocusto', 'precovista', 'precoprazo', 'taxa'];

    const $set = {};

    for (const [campo, valorBruto] of Object.entries(dados)) {
      if (camposDecimais.includes(campo)) {
        const decimal = normalizarDecimal(valorBruto);

        // se vier vazio, não mexe no valor atual do banco
        if (decimal !== null) {
          $set[campo] = decimal;
        }
      } else {
        $set[campo] = valorBruto;
      }
    }

    // ✅ sempre que salvar pelo modal, marca como revisado
    $set.revisado = true;
    console.log('ID-ITEM',idItem)
    const R=await ImportItem.updateOne(
      { _id: idItem },
      { $set }
    );
    console.log('VR DE R =',R)
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao salvar ajuste de importação:', err);
    return res.status(500).json({ error: 'Erro interno ao salvar ajuste.' });
  }
});
module.exports = router;

// PRIMEIRO A SER CHAMADO ABRE O CONFIG
// router.get('/importdocumentos', async (req, res) => {
//   console.log('200')
//   try {
//     const lojistaId = req.query.lojista || '';
//     const lojista = lojistaId
//       ? await Lojista.findById(lojistaId, { marca: 1, bairro: 1, cidade: 1 })
//           .select('-senha')
//           .lean()
//       : null;

//     // ⬇️ pegar os campos do schema do arquivoDoc
//     const camposArquivoDoc = Object.keys(ArquivoDoc.schema.paths)
//       .filter((nome) => !['_id', '__v'].includes(nome)) // ajuste essa blacklist se quiser
//       .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

//     console.log('300',lojista);
//     console.log('400',camposArquivoDoc);
//     return res.render('pages/empresa/produto_import_config.handlebars', {
//       layout: '',
//       lojista,
//       camposArquivoDoc   // ⬅ manda pra view
//     });
//   } catch (e) {
//     console.error('erro ao abrir cadastro:', e);
//     return res.status(500).send('Erro ao abrir cadastro de produto');
//   }
// });