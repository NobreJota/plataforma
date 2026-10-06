// =============================================================================
// Destino: C:\plataformaRota\src\routes\contab\auxiliares\fornecedores-api.js
// Alterado em: 30/09/2026
//   - a lista traz tambem os fornecedores do Access ainda nao transferidos
//     (_fornec_access sem fornecId), com `pendente: true` e os motivos em `ajustar`
//   - POST com nrFornecAccess: completa um pendente do Access; a conta e a do
//     Access (contaNova) e nao se escolhe titulo; se ele nao tem conta, escolhe.
//     Conta do Access que nao esta no plano e criada com o mesmo numero.
//   - e-mail/telefone deixam de ser obrigatorios (o contato e pelo WhatsApp)
// =============================================================================
// src/routes/contab/auxiliares/fornecedores-api.js
// CRUD de Fornecedores — model 'fornec', compartilhado entre empresas (1 documento por CNPJ).
// Cada empresa enxerga só os fornecedores com vínculo seu (vinculos[].lojistaId) e,
// ao cadastrar, ganha automaticamente o subtítulo no plano (2.01.xxx.nnn).
// Etapa 2C: toda query filtra por req.lojistaId.

const express = require('express');
const mongoose = require('mongoose');
const Fornecedor = require('../../../models/fornec');
const { validarDocumento } = require('../../../utils/validadorDocumento');
const ContaSubTitulo = require('../../../models/contab/financeiro/contaSubTitulo');
const contaFornecedor = require('../../../utils/contab/contaFornecedor');
const { podeSuspender } = require('../../../utils/contab/movimentoConta');

const router = express.Router();

const apenasNumeros = (s) => String(s || '').replace(/\D/g, '');

/* ===== Helpers ===== */
function vinculoDe(f, lojistaId) {
  return (f.vinculos || []).find(v => String(v.lojistaId) === String(lojistaId)) || null;
}

// Devolve o fornecedor do ponto de vista da empresa: ncontabil e ativo vêm do vínculo dela,
// e os vínculos/lojas das outras empresas não saem da API.
function decorar(f, lojistaId) {
  const o = f.toObject ? f.toObject() : { ...f };
  const v = vinculoDe(o, lojistaId);
  const doc = o.cnpj || '';
  let docFmt = doc;
  if (doc.length === 14) {
    docFmt = doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  } else if (doc.length === 11) {
    docFmt = doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  delete o.vinculos; delete o.lojistas; delete o.qlojistas; delete o.lojistaId;
  const ajustar = [];
  return {
    ...o,
    ajustar,
    ncontabil: v ? v.ncontabil : '',
    ativo: v ? v.ativo !== false : false,
    cpfCnpjFormatado: docFmt
  };
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

// A conta do vínculo, pelo código. Usada pelo desvincular.
async function contaDoVinculo(ncontabil, lojistaId) {
  if (!ncontabil) return null;
  return ContaSubTitulo.findOne({ lojistaId, codigo: ncontabil });
}

function escaparRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ===== Rotas ===== */

/* TÍTULOS DISPONÍVEIS (antes de /:id, senão "titulos" vira id) */
router.get('/titulos', async (req, res) => {
  try {
    res.json(await contaFornecedor.listarTitulos(req.lojistaId));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* LISTAR */
router.get('/', async (req, res) => {
  try {
    const incluirInativos = req.query.incluirInativos === 'true';
    const busca = (req.query.busca || '').trim();

    const vinc = { lojistaId: req.lojistaId };
    if (!incluirInativos) vinc.ativo = { $ne: false };
    const filter = { vinculos: { $elemMatch: vinc } };

    if (busca) {
      const rx = new RegExp(escaparRegex(busca), 'i');
      const or = [{ razao: rx }, { marca: rx }];
      const num = apenasNumeros(busca);
      if (num) or.push({ cnpj: new RegExp(num) });
      filter.$or = or;
    }
    const lista = await Fornecedor.find(filter).sort({ razao: 1 }).limit(500);
    const saida = lista.map(f => decorar(f, req.lojistaId));

    // Fornecedores do Access que ainda nao entraram no cadastro: vao para a
    // lista com a etiqueta "ajustar", para serem completados na tela.
    const fAcc = { lojistaId: req.lojistaId, ativo: { $ne: false }, fornecId: null };
    if (busca) {
      const rx = new RegExp(escaparRegex(busca), 'i');
      const or = [{ razao: rx }, { marca: rx }];
      const num = apenasNumeros(busca);
      if (num) or.push({ cnpj: new RegExp(num) });
      fAcc.$or = or;
    }
    const pendentes = await mongoose.connection.collection('_fornec_access')
      .find(fAcc).sort({ razao: 1 }).toArray();
    for (const p of pendentes) {
      saida.push({
        pendente: true,
        nrFornec: p.nrFornec,
        razao: p.razao || '',
        marca: p.marca || '',
        cnpj: apenasNumeros(p.cnpj),
        cpfCnpjFormatado: p.cnpj || '',
        ncontabil: p.contaNova || '',
        address: { cidade: p.cidade || '', estado: p.estado || '' },
        ajustar: p.ajustar && p.ajustar.length ? p.ajustar : ['completar cadastro'],
        ativo: true,
      });
    }
    res.json(saida);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* VERIFICAR DUPLICIDADE
 * existe=false             → cadastro novo
 * existe=true, vinculado   → já é fornecedor desta empresa
 * existe=true, !vinculado  → está no cadastro compartilhado; dá para vincular */
router.get('/buscar-cpfcnpj/:doc', async (req, res) => {
  try {
    const doc = apenasNumeros(req.params.doc);
    const existente = await Fornecedor.findOne({ cnpj: doc });
    if (!existente) return res.json({ existe: false });

    const vinculado = !!vinculoDe(existente, req.lojistaId);
    res.json({
      existe: true,
      vinculado,
      codigo: existente._id,
      nome: existente.razao,
      // dados do cadastro compartilhado, para pré-preencher o vínculo
      fornecedor: vinculado ? undefined : decorar(existente, req.lojistaId)
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* OBTER POR ID */
router.get('/:id', async (req, res) => {
  try {
    const f = await Fornecedor.findOne({ _id: req.params.id, 'vinculos.lojistaId': req.lojistaId });
    if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json(decorar(f, req.lojistaId));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* CRIAR — cadastro novo ou vínculo a um fornecedor que outra empresa já cadastrou */
router.post('/', async (req, res) => {
  let conta = null;
  try {
    const {
      tipo, nome, cpfCnpj, email, telefone, tituloCodigo,
      inscricaoEstadual, inscricaoMunicipal, marca,
      enderecoCobranca, contatos, nrFornecAccess
    } = req.body;

    if (!nome || !cpfCnpj) {
      return res.status(400).json({ erro: 'Razão social e CPF/CNPJ são obrigatórios.' });
    }

    // Completar um pendente do Access: a conta ja existe no plano.
    let access = null;
    if (nrFornecAccess) {
      access = await mongoose.connection.collection('_fornec_access')
        .findOne({ lojistaId: req.lojistaId, nrFornec: Number(nrFornecAccess) });
      if (!access) return res.status(400).json({ erro: 'Fornecedor do Access não encontrado.' });
      if (access.fornecId) return res.status(409).json({ erro: 'Este fornecedor do Access já foi transferido.' });
    }
    const contaAccess = access && access.contaNova ? access.contaNova : '';

    if (!tituloCodigo && !contaAccess) {
      return res.status(400).json({ erro: 'Escolha o título contábil do fornecedor.' });
    }
    const tipoFinal = tipo || 'PJ';
    if (!validarDocumento(cpfCnpj, tipoFinal)) {
      return res.status(400).json({ erro: tipoFinal === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.' });
    }
    const docLimpo = apenasNumeros(cpfCnpj);
    const existe = await Fornecedor.findOne({ cnpj: docLimpo });

    if (existe && vinculoDe(existe, req.lojistaId)) {
      return res.status(409).json({
        erro: `Já existe um fornecedor com este ${tipoFinal === 'PF' ? 'CPF' : 'CNPJ'} (${existe.razao}).`
      });
    }

    // Se esta empresa já teve conta para este fornecedor e depois desvinculou,
    // o recadastro reativa a mesma conta: o histórico continua num código só.
    const anterior = existe && (existe.vinculosAnteriores || [])
      .find(v => String(v.lojistaId) === String(req.lojistaId));

    let codigoConta;
    if (contaAccess) {
      let c = await ContaSubTitulo.findOne({ lojistaId: req.lojistaId, codigo: contaAccess });
      if (!c) {
        // O Access tem a conta no fornecedor mas nao no plano: nasce com o mesmo numero,
        // copiando titulo e natureza de uma irma do mesmo titulo.
        const titulo = contaAccess.split('.').slice(0, 3).join('.');
        const irma = await ContaSubTitulo.findOne({ lojistaId: req.lojistaId, codigoContaTitulo: titulo });
        if (!irma) return res.status(400).json({ erro: `Não há título ${titulo} no plano para a conta ${contaAccess}.` });
        c = await ContaSubTitulo.create({
          contaTituloId: irma.contaTituloId, codigoContaTitulo: titulo, codigo: contaAccess,
          nome: String(nome).trim(), natureza: irma.natureza, lojistaId: req.lojistaId, ativo: true,
        });
        conta = c;   // se o fornecedor nao gravar, o catch desfaz
      } else if (c.ativo === false) { c.ativo = true; await c.save(); }
      codigoConta = c.codigo;
    }
    if (!codigoConta && anterior) {
      const antiga = await contaDoVinculo(anterior.ncontabil, req.lojistaId);
      if (antiga) {
        antiga.ativo = true;
        antiga.nome = existe.razao;
        await antiga.save();
        codigoConta = antiga.codigo;
      }
    }
    if (!codigoConta) {
      // A conta nasce primeiro; se o fornecedor não gravar, ela é desfeita.
      const nomeConta = existe ? existe.razao : String(nome).trim();
      conta = await contaFornecedor.criarConta({ lojistaId: req.lojistaId, tituloCodigo, nome: nomeConta });
      codigoConta = conta.codigo;
    }
    const vinculo = { lojistaId: req.lojistaId, ncontabil: codigoConta, ativo: true };

    let salvo;
    if (existe) {
      // Vínculo: o cadastro compartilhado não é sobrescrito pelo formulário desta empresa.
      salvo = await Fornecedor.findOneAndUpdate(
        { _id: existe._id, 'vinculos.lojistaId': { $ne: req.lojistaId } },
        {
          $push: { vinculos: vinculo },
          $pull: { vinculosAnteriores: { lojistaId: req.lojistaId } }
        },
        { new: true }
      );
      if (!salvo) {
        await contaFornecedor.desfazerConta(conta);
        return res.status(409).json({ erro: 'Este fornecedor acabou de ser vinculado à sua empresa.' });
      }
    } else {
      salvo = await Fornecedor.create({
        tipo: tipoFinal,
        razao: String(nome).trim(),
        cnpj: docLimpo,
        email: String(email || '').trim(),
        telefone: String(telefone || '').trim(),
        inscricao: String(inscricaoEstadual || '').trim(),
        inscricaoMunicipal: String(inscricaoMunicipal || '').trim(),
        marca: String(marca || '').trim(),
        address: normEndereco(enderecoCobranca),
        contato: contatos || {},
        vinculos: [vinculo],
        ativo: true
      });
    }

    if (access) {
      await mongoose.connection.collection('_fornec_access').updateOne(
        { _id: access._id }, { $set: { fornecId: salvo._id, ajustar: [] } });
    }

    res.status(201).json(decorar(salvo, req.lojistaId));
  } catch (err) {
    await contaFornecedor.desfazerConta(conta);
    if (err.code === 11000) {
      return res.status(409).json({ erro: 'Já existe um fornecedor com este CPF/CNPJ.' });
    }
    res.status(err.status || 500).json({ erro: err.message });
  }
});

/* ATUALIZAR — dados cadastrais são compartilhados; o título contábil não muda depois de criado */
router.put('/:id', async (req, res) => {
  try {
    const {
      nome, email, telefone, ativo,
      inscricaoEstadual, inscricaoMunicipal, marca,
      enderecoCobranca, contatos
    } = req.body;

    if (nome !== undefined && !String(nome).trim()) {
      return res.status(400).json({ erro: 'Razão social não pode ficar vazia.' });
    }
    const set = {};
    if (nome !== undefined)               set.razao = String(nome).trim();
    if (email !== undefined)              set.email = String(email).trim();
    if (telefone !== undefined)           set.telefone = String(telefone).trim();
    if (inscricaoEstadual !== undefined)  set.inscricao = String(inscricaoEstadual).trim();
    if (inscricaoMunicipal !== undefined) set.inscricaoMunicipal = String(inscricaoMunicipal).trim();
    if (marca !== undefined)              set.marca = String(marca).trim();
    if (ativo !== undefined)              set['vinculos.$.ativo'] = !!ativo;
    if (enderecoCobranca !== undefined)   set.address = normEndereco(enderecoCobranca);
    if (contatos !== undefined)           set.contato = contatos;

    const upd = await Fornecedor.findOneAndUpdate(
      { _id: req.params.id, 'vinculos.lojistaId': req.lojistaId },
      { $set: set },
      { new: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });

    // Razão mudou: o nome do subtítulo acompanha em todas as empresas vinculadas.
    if (set.razao !== undefined && upd.vinculos.length) {
      await ContaSubTitulo.updateMany(
        { $or: upd.vinculos.map(v => ({ lojistaId: v.lojistaId, codigo: v.ncontabil })) },
        { $set: { nome: set.razao } }
      );
    }

    res.json(decorar(upd, req.lojistaId));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* INATIVAR — só para esta empresa; o cadastro e a conta continuam */
router.delete('/:id', async (req, res) => {
  try {
    const upd = await Fornecedor.findOneAndUpdate(
      { _id: req.params.id, 'vinculos.lojistaId': req.lojistaId },
      { $set: { 'vinculos.$.ativo': false } },
      { new: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* REATIVAR */
router.post('/:id/reativar', async (req, res) => {
  try {
    const upd = await Fornecedor.findOneAndUpdate(
      { _id: req.params.id, 'vinculos.lojistaId': req.lojistaId },
      { $set: { 'vinculos.$.ativo': true } },
      { new: true }
    );
    if (!upd) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });
    res.json(decorar(upd, req.lojistaId));
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* PODE DESVINCULAR?
   Mesma regra do plano: só boleta ATIVA bloqueia. Consultado pela tela antes
   de mostrar a confirmação; a checagem de verdade é a do DELETE abaixo. */
router.get('/:id/pode-desvincular', async (req, res) => {
  try {
    const f = await Fornecedor.findOne({ _id: req.params.id, 'vinculos.lojistaId': req.lojistaId });
    if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });

    const v = vinculoDe(f, req.lojistaId);
    const conta = await contaDoVinculo(v && v.ncontabil, req.lojistaId);
    if (!conta) return res.json({ pode: true, conta: null, erro: null });

    const r = await podeSuspender('subtitulo', conta._id, req.lojistaId);
    res.json({ pode: r.ok, conta: `${conta.codigo} - ${conta.nome}`, erro: r.erro || null });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

/* DESVINCULAR
   Tira o fornecedor desta empresa e suspende a conta dele no plano. Nada é
   apagado: a conta fica em Contas suspensas e o código vai para o histórico,
   então um recadastro volta a usar a mesma conta. */
router.delete('/:id/vinculo', async (req, res) => {
  try {
    const f = await Fornecedor.findOne({ _id: req.params.id, 'vinculos.lojistaId': req.lojistaId });
    if (!f) return res.status(404).json({ erro: 'Fornecedor não encontrado.' });

    const v = vinculoDe(f, req.lojistaId);
    const conta = await contaDoVinculo(v && v.ncontabil, req.lojistaId);

    if (conta) {
      const r = await podeSuspender('subtitulo', conta._id, req.lojistaId);
      if (!r.ok) return res.status(r.status).json({ erro: r.erro });
      conta.ativo = false;
      await conta.save();
    }

    await Fornecedor.updateOne(
      { _id: f._id },
      {
        $pull: { vinculos: { lojistaId: req.lojistaId } },
        $push: { vinculosAnteriores: { lojistaId: req.lojistaId, ncontabil: v.ncontabil } }
      }
    );
    res.json({ ok: true, conta: conta ? conta.codigo : null });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
