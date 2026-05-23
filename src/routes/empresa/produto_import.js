const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Lojista = require("../../models/lojista");
const Fornecedor = require("../../models/fornec");
const ArquivoDoc = require('../../models/arquivoDoc');

const ImportModelo = require('../../models/ImportModelo');
const ImportItem = require('../../models/import_item');

const Departamento  = require('../../models/departamento');
const DeptoSetores  = require('../../models/deptosetores');
const DeptoSecoes   = require('../../models/deptosecao');
//////////////////////////////////////////////////////////////////
const CAMPOS_ARQUIVO = Object.keys(ArquivoDoc.schema.paths).filter(n =>
  !['_id', '__v', 'createdAt', 'updatedAt'].includes(n)
);

function montarDocArquivoAPartirDoItem(item) {
  //console.log('1000',item)
  const doc = {};

  CAMPOS_ARQUIVO.forEach(campo => {
    // --- CASOS ESPECIAIS / ALIASES ------------------------

    // se no ArquivoDoc o nome é "fornecedor", mas no item é "fornecedorId"
    if (campo === 'fornecedor' && item.fornecedorId) {
      doc.fornecedor = item.fornecedorId;
      return;
    }

    // se quiser usar "descricao" separada antes, etc, você pode tratar aqui
    // if (campo === 'descricao' && item.descricao) { ... }

    // --- REGRA GERAL: copiar se existir no item -------------
    if (item[campo] !== undefined) {
      doc[campo] = item[campo];
      return;
    }

    // --- TRATAMENTOS COM DEFAULTS PRÓPRIOS (se quiser) ------
   // if (campo === 'qte_negativa') {
   //   doc.qte_negativa = item.qte_negativa ?? 0;
  //    return;
  //  }
  ///  if (campo === 'pageposicao') {
  //    doc.pageposicao = item.pageposicao ?? 0;
  //    return;
  //  }

    // se não existir no item e o schema do ArquivoDoc tem default,
    // deixa vazio: o próprio Mongoose aplica o default
  });

  return doc;
}
/////////////////////////////////////////////////////////////////////////////////

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

// PEGAR OS FORNECEDORES PARA SELEÇÃO AFIM DE IMPORTA SEUS PRODUTOS
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

// [27/11/2025] - PRIMEIRA OPERAÇÃO : OCORRE QUANDO BUSCA CARREGAR "produto_import_itens.handlebars" 
// A PARTIR DO MENU LATERAL "cooperado-admin.handlebars"
router.get('/importacao/import-itens', async (req, res) => {
     try {
    const lojistaId = req.query.lojista || '';
    console.log('');
    console.log('lojistaId',lojistaId);
    console.log('___________________________________________');
    let lojista = null;
    let fornecedores = [];

    if (lojistaId) {
      lojista = await Lojista.findById(lojistaId).lean();
      fornecedores = await Fornecedor.find({
                      datadel: null,
                      'lojistas.loja': lojistaId
                    }).sort({ razao: 1 }).lean();
    }
    console.log('  => ',fornecedores) 
    ///////////////////////////////////////////////////////
    
    console.log('-----------------------------------------------');
    console.log('src/routes/empresa/produto_import.js')
    console.log(' [310] router.get(/importacao/import-itens")',lojista);
    console.log(' vem de "cooperado-admin.handlebars"');
    console.log(' vai fornecer dados para load "produto_import_itens" ')
    
    console.log('')
    console.log('-----------------------------------------------')
    //////////////////////////////////////////////////////
    console.log('');
    // ==== CAMPOS DO MODEL "ARQUIVO-DOCS" ====
    const camposInternos = Object.keys(ArquivoDoc.schema.paths)
      .filter(n => !['_id', '__v', 'createdAt', 'updatedAt'].includes(n));
    console.log('---------------------------------------------------')  ;
    console.log(' importacao/import-itens : 9000',camposInternos);
    console.log('')  ;

    return res.render('pages/empresa/produto_import_itens', {
      layout: false,
      lojistaId,
      lojista,
      fornecedores,
      camposInternos,        // <== vai para a coluna “nosso campo”
      camposInternosJson: JSON.stringify(camposInternos)
    });
  } catch (err) {
    console.error('Erro ao abrir produto_cria_modelo:', err);
    return res.status(500).send('Erro ao abrir tela de criação de modelo.');
  }
});

// [27/11/205] - SEGUNDA OPERAÇÃO : SALVA O CONJUNTO DE ITENS SELECIONADOS PERTENCENTES A UM FORNECEDOR PARTIR DE UM ARQUIVODE 
// NO COMPUTADOR/
router.post('/importacao/salvar-modelo', async (req, res) => {
  console.log('');
  console.log('importacao/salvar-modelo',req.body);
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

router.post('/importacao/itens/gravar', async (req, res) => {
  console.log('3000 - /importacao/itens/gravar');
  try {
    // pega tudo que veio do body:
    // meta = { loja_id, marcaloja, cidade, bairro, fornecedorId, fornecedorNome, ... }
    const { itens = [], mapeamento = [], ...meta } = req.body;
    const { loja_id, fornecedor } = meta;

    console.log( 'fornecedor => ',fornecedor)
    // =================== VALIDAÇÕES BÁSICAS ===================
    if (!loja_id) {
      return res.status(400).json({ error: 'loja_id é obrigatório.' });
    }
    if (!fornecedor) {
      return res.status(400).json({ error: 'fornecedor é obrigatório.' });
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

      // meta contém loja_id, marcaloja, cidade, bairro, fornecedorId, fornecedorNome, etc.
      const doc = {
        ...meta,
        linhaBruta,
        // se quiser já marcar como pendente aqui
        status: 'pendente'
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

        // campo "ativo": no arquivo 1 = true, 0 ou vazio = false (ou mantém default)
        if (campoInterno === 'ativo') {
          if (valor === '') {
            // se vier vazio, deixa o default do schema (true) ou force algo aqui se quiser
          } else {
            doc.ativo = (valor === '1');
          }
          continue;
        }

        // ---------- campos numéricos em Decimal128 ----------
        if (['precocusto', 'precovista', 'precoprazo', 'taxa'].includes(campoInterno)) {
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

// [27/11/2025] AQUI PEGA OS ITEM DA "import_item.js" E PASSA PARA PREENCHER A TABELA.
// VEM DA "produto_import_itens.handlebars" QUANDO BUTTON "Ajuste" É CLICADO
router.get('/importacao/ajuste', async (req, res) => {
      console.log('');
      console.log('QUANDO O BUTTON "ajuste" É CLICADO EM "produto_import_itens.handlebars"');
      console.log(' recebe req.query [622] ',req.query);
      console.log('VAI CARREGAR "produto_import_ajuste.handlebars"');
      console.log('');
      /////////////////////////////////////////////////////////////////////////////
      try {
            const lojistaId     = req.query.lojista || '';
            const fornecedorId  = req.query.fornecedor || '';
  
            if (!lojistaId || !fornecedorId) {
              return res.status(400).send('Parâmetros obrigatórios não informados.');
            }
            ////////////////////////////////////////////////////////////////////////////
            const departamentos = await Departamento
                  .find({ ativo: 1, datadel: null })
                  .sort({ nomeDepartamento: 1 })
                  .lean();
            /////////////////////////////////////////////////////////////////     
            const setores = await DeptoSetores.find().lean();     
            const SETORES_POR_DEPTO = {};

            setores.forEach(setor => {
                  // usa o campo certo do schema: idDepto
                  const depIdRaw =
                    setor.idDepto ||                         // 👈 PRINCIPAL
                    setor.departamentoId ||
                    setor.departamento ||
                    setor.deptoId ||
                    (setor.departamento && setor.departamento._id);

                  const depId = depIdRaw ? String(depIdRaw) : null;
                  if (!depId) return; // se ainda assim não achou, pula este setor

                  if (!SETORES_POR_DEPTO[depId]) {
                    SETORES_POR_DEPTO[depId] = [];
                  }

                  SETORES_POR_DEPTO[depId].push({
                    _id: setor._id,
                    nomeSetor: setor.nomeDeptoSetor || setor.nomeSetor || '(sem nome)'
                  });
            });

          const secoes = await DeptoSecoes.find().lean();
          //console.log('3000',secoes)
          const SECOES_POR_SETOR = {};
          secoes.forEach(sec => {
                const setorIdRaw =
                  sec.setorId        ||
                  sec.idSetor        ||
                  sec.nameSecao      ||
                  (sec.setor && sec.setor._id);

                const setorId = setorIdRaw ? String(setorIdRaw) : null;
                if (!setorId) return;

                if (!SECOES_POR_SETOR[setorId]) {
                  SECOES_POR_SETOR[setorId] = [];
                }

                SECOES_POR_SETOR[setorId].push({
                  _id: sec._id,
                  idSetor:sec.idSetor,
                  nameSecao: sec.nameSecao
                });
                //console.log('X10',sec.nameSecao)
              });
              console.log('');
              console.log('');
              // monta mapas para os selects em cascata
              ////////////////////////////////////////////////////////////////
              // TODOS os campos do ArquivoDoc
              const camposArquivo = Object
                .keys(ArquivoDoc.schema.paths)
                .filter(n => !['_id', '__v', 'createdAt', 'updatedAt'].includes(n));
              // esses 4 ficam na BARRA VERDE (inputs) e NÃO entram no cabeçalho da tabela
              const CAMPOS_TOPO = ['loja_id', 'marcaloja', 'cidade', 'bairro', 'fornecedor'];

              // campos que realmente vão virar COLUNAS na tabela
              const camposTabela = camposArquivo.filter(n => !CAMPOS_TOPO.includes(n));
              // console.log(' campos Tabela',camposTabela);
              const lojista     = await Lojista.findById(lojistaId).lean();
              const fornecedor  = await Fornecedor.findById(fornecedorId).lean();

              const itensPendentes = await ImportItem.find({
                  loja_id: lojistaId,
                  fornecedorId: fornecedorId,
                  status: 'pendente'
                })
                //.populate('localloja.departamento') 
                .populate({
                      path: 'localloja.departamento',
                      model: 'departamentos'
                    })
                    .populate({
                      path: 'localloja.setor.idSetor',
                      model: 'deptosetores'
                    })
                    .populate({
                      path: 'localloja.setor.secao.idSecao',
                      model: 'deptosecoes'
                    })
                .sort({ codigo: 1 })
                .lean();
              //:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::  
              console.log('----------------------------------------------------------------');  
              console.log(' [pertence ao [ 622  ] ',itensPendentes[12]);
              console.log('');
              return res.render('pages/empresa/produto_import_ajuste', {
                layout: false,
                lojistaId,
                lojista,
                fornecedor,
                camposTabela,      // <<< só os campos que vão para o cabeçalho
                itens: itensPendentes,
                departamentos,
                // para os selects em cascata via JS
                setoresPorDeptoJson: JSON.stringify(SETORES_POR_DEPTO),
                secoesPorSetorJson:  JSON.stringify(SECOES_POR_SETOR)
              });
        } catch (err) {
          console.error('Erro ao abrir tela de ajuste de importação:', err);
          return res.status(500).send('Erro ao abrir tela de ajuste de importação.');
        }
});

// [27/11/2025] PEGA O ITEM MODIFICADO  E SALVA EM "import_itens.js" E DEPOIS TAMBÉM GRAVA LOCALloja E DEPOIS
//  DEVOLVE O ITEM ATUALIZADO  PARA A TABELA
router.post('/importacao/ajuste/salvar', async (req, res) => {
  console.log('');
  console.log('----------------------------------------');
  console.log('router.post(/importacao/ajuste/salvar');
  console.log('btnSalvar.addEventListener("click") salvaredição=>req.body', req.body);
  console.log('');
  console.log('----------------------------------------');
  try {
    // Agora pegamos exatamente o que vem do front:
    //   { idItem, updates: { codigo, descricao, ... } }
    const { idItem, updates } = req.body;
    
    

    if (!idItem) {
      return res.status(400).json({ error: 'ID do item não informado.' });
    }

    if (updates && typeof updates.localloja === 'string') {
      console.log('[AJUSTE] Removendo localloja string do update:', update.localloja);
      delete updates.localloja;
    }

    //const item = await ImportItem.findById(idItem);
    const $set = {};
    $set.revisado = true;

    //////////////////////////////////////////////
    if (updates && updates.departamentoId) {
      $set.departamentoId = updates.departamentoId;
    }
    //////////////////////////////////////////////////////////
     // se vier setorId, atualiza
    if (updates && updates.setorId) {
      $set.setorId = updates.setorId;
    }
    /////////////////////////////////////////////////////////////////
    // se vier secoesIds (array), atualiza
    if (updates && Array.isArray(updates.secoesIds)) {
      $set.secoesIds = updates.secoesIds;
    }
    ///////////////////////////////////////////////////////////////
    //console.log('SET =>', $set);
    //////////////////////////////////////////////////////////////
    // garante que updates é um objeto
    const dados = updates && typeof updates === 'object' ? updates : {};

    // campos que precisam de Decimal128
    const camposDecimais = ['precocusto', 'precovista', 'precoprazo', 'taxa'];

    // helper para decimal brasileiro -> Decimal128
    
    const toDecimal128 = (valor) => {
      if (valor === undefined || valor === null || valor === '') return undefined;
      const s = String(valor).trim();
      if (!s) return undefined;
      const normalizado = s
        .replace(/\./g, '')   // tira milhares
        .replace(/,/g, '.');  // vírgula -> ponto
      return mongoose.Types.Decimal128.fromString(normalizado);
    };

    // Normaliza campo "similares"
    if ('similares' in dados) {
        const bruto = dados.similares;

        if (!bruto || bruto.trim() === '') {
            // usuário deixou vazio → vira array vazio
            dados.similares = [];
        } else {
            // divide por vírgulas/ espaços e converte para ObjectId
            dados.similares = bruto
                .split(/[,;\s]+/)
                .filter(v => v && v.length >= 12)
                .map(v => new mongoose.Types.ObjectId(v));
        }
    }

    // Percorre os campos editados e monta o $set
    for (const [campo, valorBruto] of Object.entries(dados)) {
      if (valorBruto === undefined || valorBruto === null) continue;

      
      // trata decimais
      if (camposDecimais.includes(campo)) {
        const dec = toDecimal128(valorBruto);
        if (dec !== undefined) $set[campo] = dec;
        continue;
      }

      // outros campos vão direto (string, número, etc)
      $set[campo] = valorBruto;
    }
    /////////////////////////////////////////////////////////////////////////////////////////
    //console.log('SET (final) =>', $set);
    //XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
    if (updates) {
              const locDoc = {};

              // departamento: array de ObjectId
              if (updates.departamentoId) {
                locDoc.departamento = [updates.departamentoId];
              }

              // setor: array de subdocs { idSetor, secao: [...] }
              if (updates.setorId) {
                const setorDoc = {
                  idSetor: updates.setorId,
                  secao: []
                };

                if (Array.isArray(updates.secoesIds) && updates.secoesIds.length > 0) {
                  setorDoc.secao = updates.secoesIds.map(id => ({ idSecao: id }));
                }

                locDoc.setor = [setorDoc];
              }

              // se tiver pelo menos departamento ou setor, grava localloja
              if (Object.keys(locDoc).length > 0) {
                $set.localloja = [locDoc];
              }
    }
    ///////////////////////////////////////////////////////////////////////////////////////
    // sempre que salvar pelo modal, marca como revisado
     const itemAtualizado = await ImportItem.findByIdAndUpdate(
      idItem,
      { $set },
      { new: true }          // devolve o documento já atualizado
    );
    ///////////////////////////////////////////////////////////////////////
    if (!itemAtualizado) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    console.log('');
    console.log('----------------------------------------------------------');
    console.log('router.post(/importacao/ajuste/salvar =>');
    console.log('', itemAtualizado.toObject());
    console.log('');
    console.log('-----------------------------------------------------------');
    const itemPopulado = await ImportItem.findById(itemAtualizado._id)
      .populate('localloja.departamento')
      .populate('localloja.setor.idSetor')
      .populate('localloja.setor.secao.idSecao');

    return res.json({
      ok: true,
      item: itemPopulado   // front usa isso pra atualizar a linha
    });

  } catch (err) {
    console.error('Erro ao salvar ajuste de importação:', err);
    return res.status(500).json({ error: 'Erro interno ao salvar ajuste.' });
  }
});

// [27/11/2025] EM OBSERVAÇÃOPEGA ==> ESTÁ SENDO DESCARTADO PQ "/ajuste/salvar" ESTÁ FAZENDO ISSO
router.put('/importtabela/importacao/ajuste/item/:id', async (req, res) => {
  console.log('');
  console.log('importtabela/importacao/ajuste/item/:id');
  console.log('',req.params)
  try {
    const { id } = req.params;

    // req.body vem exatamente do payload montado acima (data-campo)
    const dados = req.body;

    const doc = await ImportItem.findByIdAndUpdate(id, dados, { new: true });

    if (!doc) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar item' });
  }
});

// =====================================================
// TRANSFERIR ITENS (ImportItem -> ArquivoDoc)
// URL real: POST /importtabela/importacao/transferir
// =====================================================
router.post('/importacao/itens/transferir', async (req, res) => {
  console.log('3000 - /importacao/itens/transferir',req.body);
  try {
    const { loja_id, fornecedorId } = req.body;

    if (!loja_id) {
      return res.status(400).json({ error: 'loja_id é obrigatório.' });
    }
    if (!fornecedorId) {
      return res.status(400).json({ error: 'fornecedorId é obrigatório.' });
    }

    // 1) Buscar itens PENDENTES (não transferidos)
    const itensPendentes = await ImportItem.find({
      loja_id,
      fornecedorId,
      transferido: false
    });

    console.log('itensPendentes =>', itensPendentes.length);

    if (!itensPendentes.length) {
      return res.json({
        ok: true,
        inseridos: 0,
        msg: 'Nenhum item pendente para transferir.'
      });
    }

    // 2) Montar docs de ArquivoDoc de forma genérica
    const docsArquivo = itensPendentes.map(item =>
      montarDocArquivoAPartirDoItem(item)
    );

    // 2) Montar docs de ArquivoDoc de forma genérica
      // const docsArquivo = itensPendentes.map(item => montarDocArquivoApartirDoItem(item));

      // ✅ NOVO: limpar pageurls para não gravar [""] e nem strings com espaços
      docsArquivo.forEach(d => {
        const arr = Array.isArray(d.pageurls) ? d.pageurls : [];
        d.pageurls = arr
          .map(x => String(x || '').trim())
          .filter(Boolean); // remove "" e "   "
      });


    // 3) Inserir em ArquivoDoc
    const inseridos = await ArquivoDoc.insertMany(docsArquivo);
    console.log('Inseridos em ArquivoDoc =>', inseridos.length);

    // 4) Marcar ImportItem.transferido = true
    const ids = itensPendentes.map(i => i._id);
    const r = await ImportItem.updateMany(
      { _id: { $in: ids } },
      { $set: { transferido: true } }
    );
    console.log('ImportItem marcados como transferidos =>', r.modifiedCount);

    return res.json({
      ok: true,
      inseridos: inseridos.length
    });
  } catch (err) {
    console.error('Erro ao transferir itens para ArquivoDoc:', err);
    return res.status(500).json({
      error: 'Erro ao transferir itens para ArquivoDoc.'
    });
  }
});

router.post('/importacao/ajuste/delete', async (req, res) => {
  try {
    const { idItem } = req.body;

    if (!idItem) {
      return res.status(400).json({ ok: false, error: 'idItem é obrigatório.' });
    }

    const deleted = await ImportItem.findByIdAndDelete(idItem);

    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Item não encontrado.' });
    }

    console.log('deleted',deleted)
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao excluir item importado:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno ao excluir item.' });
  }
});

router.get('/empresa/cadfornecedores', async (req, res) => {

  const { lojistaId = '' } = req.query;
  console.log('');
  console.log('7000',req.query);
  console.log('');
  const Id=req.query.lojistaId;
  const M=req.query.lojistamarca;
  console.log('55555',M)
  // se quiser, aqui você pode carregar o lojista e mandar pra view
  // const lojista = lojistaId ? await Lojista.findById(lojistaId).lean() : null;

  // res.render('pages/empresa/cadforneXcedores', {
  //   layout: 'central/admin',   // ou o layout que você usa nessa área
  //   lojistaId,
  //   // lojista
  // });

    const menuItens = [
    { nome: "Cadastrar clientes", link: "/cliente/cadastro" },
    { nome: "Relatórios", link: "/relatorios" },
    { nome: "Fornecedores", link: "/fornecedor/cadastro" }
  ];

  res.render("pages/empresa/cadfornecedores",
     { layout: false, menuItens,
       lojaId :Id,
       lojistaMarca:M
     });
});

module.exports = router;

