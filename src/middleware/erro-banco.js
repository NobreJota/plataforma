// =============================================================================
// Destino: C:\plataformaRota\src\middleware\erro-banco.js
// Criado em: 29/10/2026 (Jorge)
//
// TRATAMENTO DE ERRO DO SERVIDOR (o ultimo app.use do server.js, depois do 404):
//   - conexao com o MongoDB caiu (ECONNRESET, timeout, sem primario...): nao mostra a pilha tecnica.
//       pagina: "Sem conexao com o banco de dados" + "Tentar de novo" (e tenta sozinho em 5 s, so em GET)
//       API (/api/ ou pede JSON): 503 { ok:false, erro:'Sem conexão com o banco de dados…' } — as telas ja mostram o erro
//   - outro erro: 500 com a mensagem curta (a pilha fica so no terminal)
// 29/10/2026: botao "Ver conexão" na pagina de erro abre /health/db (state, dbName, host, ping).
// O Mongo reconecta sozinho; normalmente e passageiro (internet oscilou, conexao parada que o DigitalOcean fechou).
// Uso no server.js, DEPOIS da linha do 404:
//   app.use(require('./src/middleware/erro-banco'));
// 29/10/2026: mais duas pecas (no server.js, logo depois do app.use(express.json())):
//   app.use(require('./src/middleware/erro-banco').traduzir);
//       as rotas da API que ja tem try/catch e devolvem { erro: err.message } com status 500: se o erro for de
//       conexao, a tela recebe a mensagem amigavel (e status 503) em vez de "read ECONNRESET". Nao mexe nas rotas.
//   require('./src/middleware/erro-banco').protegerProcesso();
//       promessa rejeitada sem tratamento (rota async sem try/catch) NAO derruba mais o servidor: fica so o aviso no
//       terminal. Erro grave de programa (uncaughtException) continua encerrando, como deve.
// =============================================================================
'use strict';

const ehErroDeConexao = err => {
  if (!err) return false;
  const nome = String(err.name || ''), txt = String(err.message || '') + ' ' + String(err.code || '');
  return /^Mongo(ServerSelection|Network|NotConnected|Topology)/.test(nome)
    || /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|ReplicaSetNoPrimary|Server selection timed out|connection .* closed|topology was destroyed/i.test(txt);
};

const querJson = req => /\/api\//.test(req.originalUrl || '') || req.xhr
  || /application\/json/i.test(String(req.headers.accept || '')) && !/text\/html/i.test(String(req.headers.accept || ''));

const pagina = (titulo, texto, recarregar) => '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width, initial-scale=1">'
  + (recarregar ? '<meta http-equiv="refresh" content="5">' : '')
  + '<title>' + titulo + '</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f8fafc;margin:0;'
  + 'display:flex;align-items:center;justify-content:center;min-height:100vh;color:#111827}'
  + '.cx{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:28px 32px;max-width:520px;box-shadow:0 10px 30px rgba(0,0,0,.08)}'
  + 'h1{margin:0 0 10px;font-size:20px;color:#b45309}p{margin:0 0 16px;line-height:1.5;color:#374151}'
  + 'button,a{border:0;background:#1d4ed8;color:#fff;border-radius:8px;padding:10px 18px;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;margin-right:8px}'
  + 'a.s{background:#f3f4f6;color:#111827;border:1px solid #d1d5db}small{display:block;margin-top:14px;color:#9ca3af}</style></head>'
  + '<body><div class="cx"><h1>' + titulo + '</h1><p>' + texto + '</p>'
  + '<button onclick="location.reload()">Tentar de novo</button><a class="s" href="javascript:history.back()">← Voltar</a>'
  + '<a class="s" href="/health/db" target="_blank" title="situação da conexão com o banco (connected / ping ok)">Ver conexão</a>'
  + (recarregar ? '<small>Tentando de novo sozinho em 5 segundos…</small>' : '') + '</div></body></html>';

const MSG_CONEXAO = 'Sem conexão com o banco de dados. Tente de novo em alguns segundos.';
const textoDeConexao = t => /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|ReplicaSetNoPrimary|Server selection timed out|MongoServerSelection|MongoNetwork|MongoNotConnected|connection .* closed|topology was destroyed|buffering timed out/i.test(String(t || ''));

// eslint-disable-next-line no-unused-vars
module.exports = function erroBanco(err, req, res, next) {
  if (res.headersSent) return next(err);
  const quando = new Date().toLocaleString('pt-BR');
  if (ehErroDeConexao(err)) {
    console.error('⚠ [' + quando + '] sem conexão com o MongoDB (' + (err.name || 'erro') + ': ' + String(err.message || '').slice(0, 120)
      + ') em ' + req.method + ' ' + req.originalUrl);
    res.status(503);
    if (querJson(req)) return res.json({ ok: false, erro: 'Sem conexão com o banco de dados. Tente de novo em alguns segundos.' });
    return res.send(pagina('Sem conexão com o banco de dados',
      'A conexão com o servidor do banco caiu por um instante (internet ou o próprio servidor). '
      + 'Normalmente volta sozinha em poucos segundos. Nada do que estava gravado se perdeu.', req.method === 'GET'));
  }
  console.error('❌ [' + quando + '] ' + req.method + ' ' + req.originalUrl + '\n', err);
  const status = err.status || err.statusCode || 500;
  res.status(status);
  const msg = status < 500 ? String(err.message || 'erro') : 'Erro no servidor: ' + String(err.message || 'erro').slice(0, 200);
  if (querJson(req)) return res.json({ ok: false, erro: msg });
  return res.send(pagina('Algo deu errado', msg.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])), false));
};

// 29/10/2026: respostas JSON de erro com mensagem de CONEXAO viram a mensagem amigavel (503)
module.exports.traduzir = function traduzirErroBanco(req, res, next) {
  const json = res.json.bind(res);
  res.json = corpo => {
    try {
      if (res.statusCode >= 500 && corpo && typeof corpo === 'object' && (textoDeConexao(corpo.erro) || textoDeConexao(corpo.error) || textoDeConexao(corpo.message))) {
        console.error('⚠ [' + new Date().toLocaleString('pt-BR') + '] sem conexão com o MongoDB em ' + req.method + ' ' + req.originalUrl
          + ' (' + String(corpo.erro || corpo.error || corpo.message).slice(0, 120) + ')');
        res.status(503);
        return json({ ...corpo, ok: false, erro: MSG_CONEXAO, error: MSG_CONEXAO, message: MSG_CONEXAO });
      }
    } catch (e) { /* nunca atrapalha a resposta */ }
    return json(corpo);
  };
  next();
};

// 29/10/2026: promessa rejeitada sem tratamento nao derruba o servidor (so registra)
let protegido = false;
module.exports.protegerProcesso = function protegerProcesso() {
  if (protegido) return; protegido = true;
  process.on('unhandledRejection', motivo => {
    const conexao = ehErroDeConexao(motivo) || textoDeConexao(motivo && motivo.message);
    console.error('⚠ [' + new Date().toLocaleString('pt-BR') + '] ' + (conexao ? 'sem conexão com o MongoDB' : 'promessa rejeitada sem tratamento')
      + ': ' + (motivo && motivo.message ? motivo.message : String(motivo)).slice(0, 300));
    if (!conexao && motivo && motivo.stack) console.error(motivo.stack);
  });
};
