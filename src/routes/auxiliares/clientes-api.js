// src/routes/auxiliares/clientes-api.js
const express = require('express');
const router  = express.Router();

const Cliente = require('../../models/auxiliares/cliente');
const {
  apenasNumeros,
  validarDocumento,
  formatarDocumento
} = require('../../utils/validadorDocumento');

/* =========================================================
   HELPERS
   ========================================================= */
async function proximoCodigo() {
  const ultimo = await Cliente
    .findOne({ codigo: /^CLI-/ })
    .sort({ codigo: -1 })
    .lean();
  if (!ultimo) return 'CLI-0001';
  const seq = parseInt(ultimo.codigo.replace('CLI-', ''), 10) + 1;
  return `CLI-${String(seq).padStart(4, '0')}`;
}

function decorar(c) {
  const obj = c.toObject ? c.toObject() : c;
  obj.cpfCnpjFormatado = formatarDocumento(obj.cpfCnpj, obj.tipo);
  return obj;
}

function normEndereco(e = {}) {
  return {
    cep:         apenasNumeros(e.cep),
    logradouro:  String(e.logradouro  || '').trim(),
    numero:      String(e.numero      || '').trim(),
    complemento: String(e.complemento || '').trim(),
    bairro:      String(e.bairro      || '').trim(),
    cidade:      String(e.cidade      || '').trim(),
    uf:          String(e.uf          || '').trim().toUpperCase().slice(0, 2)
  };
}

function validarEndereco(e, prefixo = 'Endereço') {
  if (!e || !e.cep || e.cep.length !== 8) return `${prefixo}: CEP obrigatório (8 dígitos).`;
  if (!e.logradouro) return `${prefixo}: logradouro obrigatório.`;
  if (!e.cidade)     return `${prefixo}: cidade obrigatória.`;
  if (!e.uf || e.uf.length !== 2) return `${prefixo}: UF obrigatória.`;
  return null;
}

// 🔧 Pelo menos um contato (email OU telefone)
function validarContato(email, telefone) {
  const temEmail = String(email || '').trim();
  const temTel   = String(telefone || '').trim();
  if (!temEmail && !temTel) {
    return 'Informe pelo menos um contato (e-mail ou telefone).';
  }
  return null;
}

/* =========================================================
   LISTAR
   ========================================================= */
router.get('/', async (req, res) => {
  try {
    const { busca = '', incluirInativos = 'false' } = req.query;
    const filtro = {};
    if (incluirInativos !== 'true') filtro.ativo = true;

    if (busca.trim()) {
      const termo = busca.trim();
      const numerico = apenasNumeros(termo);
      filtro.$or = [{ nome: { $regex: termo, $options: 'i' } }];
      if (numerico) filtro.$or.push({ cpfCnpj: { $regex: numerico } });
    }

    const clientes = await Cliente.find(filtro).sort({ codigo: 1 }).limit(500);
    res.json(clientes.map(decorar));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const c = await Cliente.findById(req.params.id);
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(decorar(c));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* 🔧 GET /buscar-cpfcnpj/:doc — Verifica se CPF/CNPJ já existe */
router.get('/buscar-cpfcnpj/:doc', async (req, res) => {
  try {
    const doc = apenasNumeros(req.params.doc);
    const existente = await Cliente.findOne({ cpfCnpj: doc });
    if (existente) {
      return res.json({
        existe: true,
        codigo: existente.codigo,
        nome: existente.nome,
        ativo: existente.ativo
      });
    }
    res.json({ existe: false });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   CRIAR
   ========================================================= */
router.post('/', async (req, res) => {
  try {
    const {
      tipo, nome, cpfCnpj, email, telefone, observacoes,
      inscricaoEstadual, inscricaoMunicipal,
      enderecoCobranca, enderecoEntrega, entregaIgualCobranca
    } = req.body;

    if (!tipo || !nome || !cpfCnpj) {
      return res.status(400).json({ erro: 'Tipo, nome e CPF/CNPJ são obrigatórios.' });
    }
    if (!['PF', 'PJ'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo deve ser PF ou PJ.' });
    }
    if (!validarDocumento(cpfCnpj, tipo)) {
      return res.status(400).json({ erro: tipo === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.' });
    }

    // 🔧 Verifica duplicidade ANTES de tentar inserir
    const docLimpo = apenasNumeros(cpfCnpj);
    const existente = await Cliente.findOne({ cpfCnpj: docLimpo });
    if (existente) {
      return res.status(409).json({
        erro: `Já existe um cliente com este ${tipo === 'PF' ? 'CPF' : 'CNPJ'} (código ${existente.codigo}: ${existente.nome}).`
      });
    }

    // 🔧 Validação de contato
    const erroContato = validarContato(email, telefone);
    if (erroContato) return res.status(400).json({ erro: erroContato });

    const cobranca = normEndereco(enderecoCobranca);
    const erroCob = validarEndereco(cobranca, 'Endereço de cobrança');
    if (erroCob) return res.status(400).json({ erro: erroCob });

    const usarMesmo = entregaIgualCobranca !== false;
    let entrega;
    if (usarMesmo) {
      entrega = { ...cobranca };
    } else {
      entrega = normEndereco(enderecoEntrega);
      const erroEnt = validarEndereco(entrega, 'Endereço de entrega');
      if (erroEnt) return res.status(400).json({ erro: erroEnt });
    }

    const codigo = await proximoCodigo();
    const novo = await Cliente.create({
      codigo, tipo, nome, cpfCnpj,
      email:       email       || '',
      telefone:    telefone    || '',
      observacoes: observacoes || '',
      // 🆕 IE/IM (só relevantes para PJ, mas salva sempre)
      inscricaoEstadual:  tipo === 'PJ' ? (inscricaoEstadual  || '') : '',
      inscricaoMunicipal: tipo === 'PJ' ? (inscricaoMunicipal || '') : '',
      enderecoCobranca: cobranca,
      enderecoEntrega:  entrega,
      entregaIgualCobranca: usarMesmo
    });

    res.status(201).json(decorar(novo));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: 'Já existe um cliente com este CPF/CNPJ.' });
    }
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   ATUALIZAR
   ========================================================= */
router.put('/:id', async (req, res) => {
  try {
    const {
      nome, email, telefone, observacoes, ativo,
      inscricaoEstadual, inscricaoMunicipal,
      enderecoCobranca, enderecoEntrega, entregaIgualCobranca
    } = req.body;

    if (nome !== undefined && !String(nome).trim()) {
      return res.status(400).json({ erro: 'Nome não pode ficar vazio.' });
    }

    // 🔧 Se enviou contato, valida que pelo menos um existe
    if (email !== undefined || telefone !== undefined) {
      const erroContato = validarContato(email, telefone);
      if (erroContato) return res.status(400).json({ erro: erroContato });
    }

    const patch = {
      nome, email, telefone, observacoes, ativo,
      inscricaoEstadual, inscricaoMunicipal
    };

    if (enderecoCobranca) {
      const cobranca = normEndereco(enderecoCobranca);
      const erro = validarEndereco(cobranca, 'Endereço de cobrança');
      if (erro) return res.status(400).json({ erro });
      patch.enderecoCobranca = cobranca;

      const usarMesmo = entregaIgualCobranca !== false;
      patch.entregaIgualCobranca = usarMesmo;
      if (usarMesmo) {
        patch.enderecoEntrega = { ...cobranca };
      } else if (enderecoEntrega) {
        const entrega = normEndereco(enderecoEntrega);
        const erroE = validarEndereco(entrega, 'Endereço de entrega');
        if (erroE) return res.status(400).json({ erro: erroE });
        patch.enderecoEntrega = entrega;
      }
    }

    const upd = await Cliente.findByIdAndUpdate(
      req.params.id, patch,
      { new: true, runValidators: true, omitUndefined: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(decorar(upd));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* =========================================================
   DESATIVAR / REATIVAR
   ========================================================= */
router.delete('/:id', async (req, res) => {
  try {
    const upd = await Cliente.findByIdAndUpdate(
      req.params.id, { ativo: false }, { new: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

router.post('/:id/reativar', async (req, res) => {
  try {
    const upd = await Cliente.findByIdAndUpdate(
      req.params.id, { ativo: true }, { new: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Cliente não encontrado.' });
    res.json(decorar(upd));
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = router;
