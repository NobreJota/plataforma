// config/auth.js
// Estratégia de login do administrador da plataforma.
//
// Correções desta versão:
// 1) deserializeUser usava callback no findById — removido no Mongoose 7+, e
//    era o que lançava "Model.findById() no longer accepts a callback" em toda
//    requisição de admin logado. Agora é async/await.
// 2) Havia um passport.serializeUser DENTRO da estratégia: ele registrava um
//    serializador novo a cada tentativa de login, empilhando handlers na
//    memória enquanto o servidor estivesse no ar. Registro agora acontece uma
//    vez só, fora da estratégia.
// 3) `!usuario | usuario == 'null'` usava o "ou" bit a bit. Virou só !usuario.

const bcryptjs = require('bcryptjs');
const localStrategy = require('passport-local').Strategy;
const Usuario = require('../src/models/usuario'); // caminho relativo a partir de config/

module.exports = function (passport) {
  // Guarda só o id na sessão; o resto é buscado a cada requisição.
  passport.serializeUser((usuario, done) => {
    done(null, usuario.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const usuario = await Usuario.findById(id);
      done(null, usuario || false);
    } catch (erro) {
      done(erro);
    }
  });

  passport.use(new localStrategy(
    { usernameField: 'email', passwordField: 'senha' },
    async (email, senha, done) => {
      try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
          return done(null, false, { message: 'Cadastro com este e-mail não encontrado!' });
        }
        if (usuario.admin != 1) {
          return done(null, false, { message: 'Não é administrador!' });
        }

        const correta = await bcryptjs.compare(senha, usuario.senha);
        if (!correta) {
          return done(null, false, { message: 'Dados de acesso não conferem!' });
        }
        return done(null, usuario);
      } catch (erro) {
        // Antes o erro era só impresso no console e a promessa morria ali: a
        // tela ficava esperando para sempre. Agora o passport recebe o erro.
        return done(erro);
      }
    }
  ));
};
