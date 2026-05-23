// src/routes/auxiliares/fornecedores-api.js
// CRUD de Fornecedores — grava no model 'fornec' (unificado com o site).

const express = require('express');
const Fornecedor = require('../../models/fornec');   // ⚠ ajuste o caminho se necessário
const { validarDocumento } = require('../../utils/validadorDocumento');

const router = express.Router();

const apenasNumeros = (s) => String(s || '').replace(/\D/g, '');

/* ===== Helpers ===== */
function decorar(f) {
  const o = f.toObject ? f.toObject() : f;
  const doc = o.cnpj || '';
  // Formata CNPJ/CPF para exibição
  let docFmt = doc;
  if (doc.length === 14) {
    docFmt = doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  } else if (doc.length === 11) {
    docFmt = doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return { ...o, cpfCnpjFormatado: docFmt };
}

function normEndereco(e = {}) {
  e = e || {};
  return {
    cep:         apenasNumeros(e.cep),
    logradouro:  String(e.logradouro || '').trim(),
    numero:      String(e.numero || '').trim(),
    complemento: String(e.complemento || '').trim(),
    bairro:      String(e.bairro || '').trim(),
    cidade:      String(e.cidade || '').trim(),
    estado:      String(e.estado || e.uf || '').trim().toUpperCase().slice(0, 2)
  };
}

function validarContato(email, telefone) {
  if (!String(email || '').trim() && !String(telefone || '').trim()) {
    return 'Informe pelo menos um contato (e-mail ou telefone).';
  }
  return null;
}

/* ===== Rotas ===== */

/* LISTAR */
router.get('/', async (req, res) => {
  try {
    const incluirInativos = req.query.incluirInativos === 'true';
    const busca = (req.query.busca || '').trim();
    const filter = {};
    // $ne:false pega tanto ativo:true quanto registros antigos sem o campo
    if (!incluirInativos) filter.ativo = { $ne: false };
    if (busca) {
      const rx = new RegExp(busca, 'i');
      filter.$or = [
        { razao: rx },
        { cnpj: new RegExp(apenasNumeros(busca), 'i') },
        { marca: rx }
      ];
    }
    const lista = await Fornecedor.find(filter).sort({ razao: 1 }).limit(500);
    res.json(lista.map(decorar));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* OBTER POR ID */
router.get('/:id', async (req, res) => {
  try {
    const f = await Fornecedor.findById(req.params.id);
    if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json(decorar(f));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* VERIFICAR DUPLICIDADE */
router.get('/buscar-cpfcnpj/:doc', async (req, res) => {
  try {
    const doc = apenasNumeros(req.params.doc);
    const existente = await Fornecedor.findOne({ cnpj: doc });
    if (existente) {
      return res.json({
        existe: true,
        codigo: existente._id,            // fornec não tem código sequencial; usa _id
        nome: existente.razao,
        ativo: existente.ativo
      });
    }
    res.json({ existe: false });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* CRIAR */
router.post('/', async (req, res) => {
  try {
    const {
      tipo, nome, cpfCnpj, email, telefone,
      inscricaoEstadual, inscricaoMunicipal, ncontabil, marca,
      enderecoCobranca, contatos
    } = req.body;

    if (!nome || !cpfCnpj) {
      return res.status(400).json({ erro: 'Razão social e CPF/CNPJ são obrigatórios.' });
    }
    const tipoFinal = tipo || 'PJ';
    if (!validarDocumento(cpfCnpj, tipoFinal)) {
      return res.status(400).json({ erro: tipoFinal === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.' });
    }

    const docLimpo = apenasNumeros(cpfCnpj);
    const existe = await Fornecedor.findOne({ cnpj: docLimpo });
    if (existe) {
      return res.status(409).json({
        erro: `Já existe um fornecedor com este ${tipoFinal === 'PF' ? 'CPF' : 'CNPJ'} (${existe.razao}).`
      });
    }

    const erroContato = validarContato(email, telefone);
    if (erroContato) return res.status(400).json({ erro: erroContato });

    const novo = await Fornecedor.create({
      tipo: tipoFinal,
      razao: String(nome).trim(),
      cnpj: docLimpo,
      email: String(email || '').trim(),
      telefone: String(telefone || '').trim(),
      inscricao: String(inscricaoEstadual || '').trim(),
      inscricaoMunicipal: String(inscricaoMunicipal || '').trim(),
      ncontabil: String(ncontabil || '').trim(),
      marca: String(marca || '').trim(),
      address: normEndereco(enderecoCobranca),
      contato: contatos || {},
      ativo: true
    });

    res.status(201).json(decorar(novo));
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: 'Já existe um fornecedor com este CPF/CNPJ.' });
    }
    res.status(500).json({ erro: err.message });
  }
});

/* ATUALIZAR */
router.put('/:id', async (req, res) => {
  try {
    const {
      nome, email, telefone, ativo,
      inscricaoEstadual, inscricaoMunicipal, ncontabil, marca,
      enderecoCobranca, contatos
    } = req.body;

    if (nome !== undefined && !String(nome).trim()) {
      return res.status(400).json({ erro: 'Razão social não pode ficar vazia.' });
    }
    if (email !== undefined || telefone !== undefined) {
      const erroContato = validarContato(email, telefone);
      if (erroContato) return res.status(400).json({ erro: erroContato });
    }

    const patch = {};
    if (nome !== undefined)               patch.razao = String(nome).trim();
    if (email !== undefined)              patch.email = String(email).trim();
    if (telefone !== undefined)           patch.telefone = String(telefone).trim();
    if (inscricaoEstadual !== undefined)  patch.inscricao = String(inscricaoEstadual).trim();
    if (inscricaoMunicipal !== undefined) patch.inscricaoMunicipal = String(inscricaoMunicipal).trim();
    if (ncontabil !== undefined)          patch.ncontabil = String(ncontabil).trim();
    if (marca !== undefined)              patch.marca = String(marca).trim();
    if (ativo !== undefined)              patch.ativo = !!ativo;
    if (enderecoCobranca !== undefined)   patch.address = normEndereco(enderecoCobranca);
    if (contatos !== undefined)           patch.contato = contatos;

    const upd = await Fornecedor.findByIdAndUpdate(req.params.id, patch, { new: true });
    if (!upd) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json(decorar(upd));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* INATIVAR */
router.delete('/:id', async (req, res) => {
  try {
    const upd = await Fornecedor.findByIdAndUpdate(req.params.id, { ativo: false }, { new: true });
    if (!upd) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* REATIVAR */
router.post('/:id/reativar', async (req, res) => {
  try {
    const upd = await Fornecedor.findByIdAndUpdate(req.params.id, { ativo: true }, { new: true });
    if (!upd) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json(decorar(upd));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
