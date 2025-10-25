const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose');
////////////////////////////////////////////////
require('dotenv').config({path:'./.env'})
////////////////////////////////////////////////
const { eAdmin } = require("../../../helpers/eAdmin");
////////////////////////////////////////////////
require('../../models/lojista');
const Lojista = mongoose.model('lojista');

require('../../models/mconstrucao');
const Mconstrucao=mongoose.model('m_construcao')
require('../../models/usuario');
const Usuario=mongoose.model("usuarios")

router.post('/login',async(req,res)=>{
    console.log('[ 28-central ]',req.body)
    ////////////////////////////////////////////////////////////////////////
    // Confere o login do cooperado
    ////////////////////////////////////////////////////////////////////////
    console.log('');
    console.log('___________________________________________');
    console.log('');
    console.log(" [ 35 ]");
    console.log(' origem views : _cooperado/usuario/loginloja');
    console.log(' origem route : /lojista/empresa/rotina');
    console.log(' obs : ');
    console.log('');
    console.log(' destino : _cooperado/admin/admincooperados');
    console.log('____________________________________________');
    console.log('');
   
        try{
             const email = String(req.body.email || '').trim().toLowerCase();
             const senha = String(req.body.senha || '');
     
                 // Se não tiver error então segue em frente
                  console.log(' [ 73-central ]',senha)
                  const user = await Usuario.findOne({ email })
                                            .collation({ locale: 'pt', strength: 2 })
                                            .select('+senha nome email _id') // inclui a senha só aqui
                                            .lean();

                                            if (!user) {
                                            req.flash('error_msg', 'Usuário não encontrado.');
                                            return res.redirect('/usuarioloja/login');
                                            }

                                            const ok = await bcrypt.compare(senha, user.senha);
                                            if (!ok) {
                                            req.flash('error_msg', 'Senha inválida.');
                                            return res.redirect('/usuarioloja/login');
                                            }
                                            console.log('6000');
                                            return res.render('pages/central/centralmenu.handlebars', {
                                                   layout: 'central/admin.handlebars',
                                                   usuarioNome: user.nome
                                            });
                           
                                ///////////////////////////////////////////////////////////////
                               
            }               
            catch(err){
               console.error('Erro no login:', err);
               req.flash('error_msg', 'Falha ao processar login.');
               return res.redirect('/usuarioloja/login');
            }
//    }
})

// GET /usuarioloja/register  (opcional: renderizar o form de cadastro)
router.get('/usuarioloja/register', (req, res) => {
  return res.render('pages/central/register.handlebars', {
    layout: 'central/admin.handlebars'
  });
});

// POST /usuarioloja/register  (criar usuário com hash na senha)
router.post('/usuarioloja/register', async (req, res) => {
  try {
    const nome  = String(req.body.nome || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    const senha2 = String(req.body.senha2 || '');

    // validações simples
    const erros = [];
    if (!nome) erros.push('Informe o nome.');
    if (!email) erros.push('Informe o e-mail.');
    if (!senha) erros.push('Informe a senha.');
    if (senha && senha.length < 6) erros.push('A senha deve ter ao menos 6 caracteres.');
    if (senha !== senha2) erros.push('As senhas não conferem.');

    if (erros.length) {
      req.flash('error_msg', erros.join(' '));
      return res.redirect('/usuarioloja/register');
    }

    // Checagem de e-mail existente (case-insensitive)
    const jaExiste = await Usuario.findOne({ email })
      .collation({ locale: 'pt', strength: 2 })
      .select('_id')
      .lean();

    if (jaExiste) {
      req.flash('error_msg', 'Este e-mail já está cadastrado.');
      return res.redirect('/usuarioloja/register');
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(12);       // custo 12 é um bom equilíbrio
    const hash = await bcrypt.hash(senha, salt);

    // Criação do usuário
    await Usuario.create({
      nome,
      email,
      senha: hash,
      admin: '',               // ajuste se quiser já marcar como admin
      updateAt: new Date()
    });

    req.flash('success_msg', 'Cadastro realizado com sucesso! Faça login.');
    return res.redirect('/usuarioloja/login');
  } catch (err) {
    // Tratamento para duplicidade (se você ativar índice único depois)
    if (err && err.code === 11000) {
      req.flash('error_msg', 'E-mail já cadastrado.');
      return res.redirect('/usuarioloja/register');
    }
    console.error('Erro ao registrar usuário:', err);
    req.flash('error_msg', 'Falha ao registrar. Tente novamente.');
    return res.redirect('/usuarioloja/register');
  }
});


module.exports = router;