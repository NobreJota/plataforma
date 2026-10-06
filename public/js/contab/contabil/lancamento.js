/* public/js/contab/contabil/lancamento.js
 *
 * LANÇAMENTO DE BOLETA — janela arrastável
 *
 * Nasce sempre de dentro do razão, com uma conta já selecionada. Por isso a
 * perna única (o bloco de cima) vem preenchida e não tem seletor de grupo:
 * a conta é a do razão que está aberto atrás.
 *
 * A janela é arrastável pelo cabeçalho de propósito — dá para empurrá-la para
 * o lado e conferir os lançamentos da conta enquanto digita. Também por isso
 * não existe véu escuro cobrindo a página.
 *
 * Uso:  Lancamento.abrir({ modo: 'credito', conta: { codigo, nome, _id } })
 *
 * A tela e o cálculo estão prontos; a gravação ainda não está ligada.
 */
window.Lancamento = (() => {
  'use strict';

  const API = '/contab/api';
  const $  = (s, raiz = document) => raiz.querySelector(s);
  const $$ = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

  const st = { modo: 'credito', conta: null, contador: 0 };

  /* ============================================================
     HELPERS
     ============================================================ */
  async function getJson(url) {
    const r = await fetch(url);
    if (r.status === 401) {
      alert('Sua sessão expirou. Faça login novamente.');
      window.location.href = '/usuariocontab/login';
      return new Promise(() => {});
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
    return d;
  }

  async function postJson(url, corpo) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    if (r.status === 401) {
      alert('Sua sessão expirou. Faça login novamente.');
      window.location.href = '/usuariocontab/login';
      return new Promise(() => {});
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.erro || `Erro ${r.status}`);
    return d;
  }

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Aviso na mesma casca da confirmação, só que com texto e um botão. Evita a
     caixa do navegador, que mostra "localhost:5000 diz" e não aceita estilo. */
  function avisar(texto, titulo = 'Aviso') {
    return new Promise((resolve) => {
      const cx = document.getElementById('lc-aviso');
      if (!cx) { alert(texto); resolve(); return; }   // janela ainda não montada
      $('#lc-aviso-titulo').textContent = titulo;
      $('#lc-aviso-texto').textContent  = texto;
      cx.hidden = false;
      const ok = $('#lc-aviso-ok');
      const fechaAviso = () => { cx.hidden = true; ok.removeEventListener('click', fechaAviso); resolve(); };
      ok.addEventListener('click', fechaAviso);
      ok.focus();
    });
  }

  /* Aceita "1.234,56" e "1234.56". Sem isso, digitar no formato brasileiro
     produziria NaN e o total nunca fecharia. */
  function paraNumero(texto) {
    const limpo = String(texto || '').trim().replace(/\./g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
  }

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  /* ============================================================
     ESTILO
     ============================================================ */
  function injetarEstilo() {
    if (document.getElementById('lc-estilo')) return;
    const el = document.createElement('style');
    el.id = 'lc-estilo';
    el.textContent = `
      .lc-fundo { position: fixed; inset: 0; z-index: 300; pointer-events: none; }
      .lc-fundo[hidden] { display: none !important; }

      .lc-janela {
        position: absolute; width: min(880px, 94vw); pointer-events: auto;
        background: #fff; border: 1px solid #cbd5e1; border-radius: 10px;
        box-shadow: 0 22px 60px rgba(0,0,0,.28);
        font-family: system-ui, -apple-system, sans-serif;
        display: flex; flex-direction: column; max-height: 88vh;
      }
      .lc-cabeca {
        background: #1d4ed8; color: #fff; padding: 10px 14px;
        border-radius: 9px 9px 0 0; cursor: move; user-select: none;
        display: flex; align-items: center; gap: 12px;
      }
      .lc-cabeca h3 { margin: 0; font-size: 15px; font-weight: 600; }
      .lc-arrasta-dica { font-size: 11px; opacity: .75; }
      .lc-fechar { margin-left: auto; background: transparent; border: 0;
        color: #fff; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }
      .lc-corpo { padding: 14px 16px; overflow: auto; }

      .lc-bloco { border: 1px solid #e5e7eb; border-radius: 8px;
        padding: 12px 14px; margin-bottom: 14px; }
      .lc-bloco-head { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
      .lc-bloco-head h4 { margin: 0; font-size: 15px; color: #111; font-weight: 600; }
      .lc-data { margin-left: auto; display: flex; align-items: center; gap: 6px;
        font-size: 13px; color: #374151; }
      .lc-data input { border: 1px solid #d1d5db; border-radius: 6px;
        padding: 4px 8px; font-size: 13px; font-family: inherit; color: #111; }
      .lc-saldo-info { margin-left: auto; font-size: 13px; color: #374151; }
      .lc-saldo-info b { color: #111; }
      .lc-saldo-info b.ok    { color: #15803d; }
      .lc-saldo-info b.falta { color: #b91c1c; }

      .lc-grupos { display: flex; gap: 22px; margin-bottom: 8px; }
      .lc-grupos label { display: inline-flex; align-items: center; gap: 6px;
        font-size: 13px; color: #374151; cursor: pointer; }

      .lc-cab, .lc-linha { display: grid;
        grid-template-columns: 175px 200px 1fr 120px; gap: 9px; align-items: center; }
      .lc-cab { font-size: 12px; color: #374151; font-weight: 600; padding: 0 2px 4px; }
      /* Alinhamento por coluna: número da conta ao centro, texto à esquerda,
         valor à direita. O cabeçalho segue a coluna, senão o título fica
         apontando para o lado errado do dado. */
      .lc-right  { text-align: right; }
      .lc-center { text-align: center; }

      .lc-linha input, .lc-conta {
        width: 100%; box-sizing: border-box; height: 32px;
        border: 1px solid #9ca3af; border-radius: 6px; padding: 4px 9px;
        font-size: 13px; font-family: inherit; color: #111; background: #fff;
      }
      .lc-linha input:focus, .lc-conta:focus { outline: 2px solid #bfdbfe; border-color: #1d4ed8; }
      .lc-linha input.lc-nome { background: #f9fafb; color: #374151; }
      .lc-linha input.lc-hist { text-align: left; }
      .lc-linha input.lc-valor { text-align: right; font-family: ui-monospace, monospace; }

      /* A conta da perna única não se escolhe aqui: veio do razão. */
      .lc-conta-fixa { height: 32px; display: flex; align-items: center;
        justify-content: center; padding: 4px 9px;
        border: 1px solid #d1d5db; border-radius: 6px; background: #eef2ff;
        font-family: ui-monospace, monospace; font-size: 13px; color: #1d4ed8; font-weight: 600; }

      .lc-cel-conta { position: relative; }
      .lc-conta { display: flex; align-items: center; cursor: pointer;
        font-family: ui-monospace, monospace; }
      /* O código ocupa o meio e a setinha fica encostada na borda: assim os
         códigos das várias linhas ficam alinhados entre si. */
      .lc-conta .lc-conta-cod { flex: 1; text-align: center; }
      .lc-conta.vazio .lc-conta-cod { color: #9ca3af; font-family: inherit; }
      .lc-chev { color: #6b7280; font-style: normal; }

      .lc-cascata { position: absolute; top: 100%; left: 0; margin-top: 3px; z-index: 20;
        width: 300px; max-height: 300px; overflow: auto; background: #fff;
        border: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.16); }
      .lc-cascata[hidden] { display: none !important; }
      .lc-casc-topo { display: flex; align-items: center; gap: 8px; padding: 7px 10px;
        border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;
        background: #f9fafb; position: sticky; top: 0; }
      .lc-casc-voltar { border: 0; background: transparent; color: #1d4ed8;
        font-size: 12px; font-family: inherit; cursor: pointer; padding: 0; }
      .lc-casc-opt { display: block; width: 100%; text-align: left; border: 0;
        background: transparent; padding: 7px 11px; cursor: pointer;
        font-size: 13px; font-family: ui-monospace, monospace; color: #111; }
      .lc-casc-opt:hover { background: #eef2ff; }
      .lc-casc-vazio { padding: 14px; text-align: center; color: #9ca3af; font-size: 12px; }

      /* Combo de histórico: sugere os mais usados da conta. */
      .lc-cel-hist { position: relative; }
      .lc-hist-lista {
        position: absolute; top: 100%; left: 0; right: 0; margin-top: 3px; z-index: 25;
        background: #fff; border: 1px solid #d1d5db; border-radius: 8px;
        box-shadow: 0 10px 26px rgba(0,0,0,.15); overflow: hidden;
      }
      .lc-hist-lista[hidden] { display: none !important; }
      .lc-hist-opt {
        display: block; width: 100%; text-align: left; border: 0; background: transparent;
        padding: 7px 11px; cursor: pointer; font-size: 13px; font-family: inherit; color: #111;
      }
      .lc-hist-opt:hover, .lc-hist-opt.marcado { background: #eef2ff; }
      .lc-hist-vazio { padding: 9px 11px; color: #9ca3af; font-size: 12px; }

      .lc-contra { border-top: 1px dashed #e5e7eb; padding-top: 9px; margin-top: 9px; }
      .lc-contra:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
      .lc-contra-topo { display: flex; align-items: center; gap: 22px; margin-bottom: 6px; }
      .lc-remover { margin-left: auto; border: 0; background: transparent; cursor: pointer;
        color: #b91c1c; font-size: 12px; font-family: inherit; }
      .lc-remover:hover { text-decoration: underline; }

      .lc-btn { padding: 7px 18px; border: 0; border-radius: 6px; background: #1d4ed8;
        color: #fff; font-size: 13px; font-family: inherit; cursor: pointer; }
      .lc-btn:hover { background: #1e40af; }
      .lc-btn:disabled { background: #cbd5e1; cursor: not-allowed; }
      .lc-btn-claro { padding: 6px 14px; border: 1px solid #d1d5db; border-radius: 6px;
        background: #fff; color: #374151; font-size: 13px; font-family: inherit; cursor: pointer; }
      .lc-btn-claro:hover { background: #f3f4f6; }

      .lc-pe { display: flex; align-items: center; gap: 14px;
        padding: 10px 16px 14px; border-top: 1px solid #e5e7eb; }
      .lc-dica { font-size: 12px; color: #6b7280; margin-left: auto; }

      .lc-conf { position: fixed; inset: 0; background: rgba(15,23,42,.5); pointer-events: auto;
        display: flex; align-items: center; justify-content: center; z-index: 400; }
      .lc-conf[hidden] { display: none !important; }
      .lc-conf-card { background: #fff; border-radius: 8px; width: min(430px, 92vw);
        box-shadow: 0 18px 45px rgba(0,0,0,.3); overflow: hidden; }
      .lc-conf-card header { background: #1d4ed8; color: #fff; padding: 11px 16px; }
      .lc-conf-card header h4 { margin: 0; font-size: 15px; }
      .lc-conf-body { padding: 16px; font-size: 14px; color: #1e293b; }
      .lc-conf-body pre { font-family: ui-monospace, monospace; font-size: 12px;
        color: #374151; white-space: pre-wrap; margin: 8px 0 0; }
      .lc-conf-card footer { padding: 10px 16px 14px; display: flex; gap: 10px; justify-content: flex-end; }
    `;
    document.head.appendChild(el);
  }

  /* ============================================================
     MONTAGEM
     ============================================================ */
  function montarJanela() {
    if (document.getElementById('lc-fundo')) return;

    const fundo = document.createElement('div');
    fundo.id = 'lc-fundo';
    fundo.className = 'lc-fundo';
    fundo.hidden = true;
    fundo.innerHTML = `
      <div class="lc-janela" id="lc-janela">
        <div class="lc-cabeca" id="lc-cabeca">
          <h3 id="lc-titulo">Lançamento</h3>
          <span class="lc-arrasta-dica">arraste para o lado para ver o razão</span>
          <button class="lc-fechar" id="lc-x" title="Fechar">×</button>
        </div>

        <div class="lc-corpo">
          <div class="lc-bloco">
            <div class="lc-bloco-head">
              <h4 id="lc-rot-principal">Crédito:</h4>
              <label class="lc-data">Data <input type="date" id="lc-data"></label>
            </div>
            <div class="lc-cab">
              <div class="lc-center">Conta</div><div>Nome da conta</div>
              <div>Histórico</div><div class="lc-right">Valor</div>
            </div>
            <div class="lc-linha">
              <div class="lc-conta-fixa" id="lc-conta-cod">—</div>
              <div><input type="text" class="lc-nome" id="lc-conta-nome" readonly></div>
              <div class="lc-cel-hist">
                <input type="text" class="lc-hist" id="lc-hist-principal" placeholder="histórico" autocomplete="off">
                <div class="lc-hist-lista" hidden></div>
              </div>
              <div class="lc-right"><input type="text" class="lc-valor" id="lc-valor-principal" inputmode="decimal" placeholder="0,00"></div>
            </div>
          </div>

          <div class="lc-bloco">
            <div class="lc-bloco-head">
              <h4 id="lc-rot-contra">Débito:</h4>
              <span class="lc-saldo-info">
                Lançado: <b id="lc-lancado">0,00</b> &nbsp;·&nbsp; Falta: <b id="lc-falta">0,00</b>
              </span>
            </div>
            <div id="lc-contrapartidas"></div>
          </div>
        </div>

        <div class="lc-pe">
          <button type="button" class="lc-btn" id="lc-gravar" disabled>Gravar</button>
          <span class="lc-dica">Com os dois lados iguais, tecle <b>Enter</b>.</span>
        </div>
      </div>

      <div class="lc-conf" id="lc-aviso" hidden>
        <div class="lc-conf-card">
          <header><h4 id="lc-aviso-titulo">Aviso</h4></header>
          <div class="lc-conf-body" id="lc-aviso-texto"></div>
          <footer><button class="lc-btn" id="lc-aviso-ok">OK</button></footer>
        </div>
      </div>

      <div class="lc-conf" id="lc-conf" hidden>
        <div class="lc-conf-card">
          <header><h4>Confirmação</h4></header>
          <div class="lc-conf-body">
            Quer gravar este lançamento?
            <pre id="lc-conf-resumo"></pre>
          </div>
          <footer>
            <button class="lc-btn-claro" id="lc-conf-cancelar">Cancelar</button>
            <button class="lc-btn" id="lc-conf-salvar">Salvar</button>
          </footer>
        </div>
      </div>`;

    document.body.appendChild(fundo);
    ligarEventos();
    tornarArrastavel();
  }

  /* ============================================================
     ARRASTAR
     ============================================================ */
  function tornarArrastavel() {
    const janela = $('#lc-janela');
    const cabeca = $('#lc-cabeca');
    let arrastando = false, dx = 0, dy = 0;

    cabeca.addEventListener('mousedown', (e) => {
      if (e.target.id === 'lc-x') return;
      const r = janela.getBoundingClientRect();
      arrastando = true;
      dx = e.clientX - r.left;
      dy = e.clientY - r.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!arrastando) return;
      // Prende dentro da janela do navegador: arrastado para fora, o cabeçalho
      // ficaria inalcançável e não haveria como trazer a janela de volta.
      const x = Math.min(Math.max(0, e.clientX - dx), window.innerWidth - janela.offsetWidth);
      const y = Math.min(Math.max(0, e.clientY - dy), window.innerHeight - 40);
      janela.style.left = x + 'px';
      janela.style.top  = y + 'px';
    });

    document.addEventListener('mouseup', () => { arrastando = false; });
  }

  /* ============================================================
     CASCATA (só nas contrapartidas)
     ============================================================ */
  function cabecalho(texto, aoVoltar) {
    const topo = document.createElement('div');
    topo.className = 'lc-casc-topo';
    if (aoVoltar) {
      const b = document.createElement('button');
      b.className = 'lc-casc-voltar';
      b.textContent = '‹ voltar';
      b.addEventListener('click', (e) => { e.stopPropagation(); aoVoltar(); });
      topo.appendChild(b);
    }
    const s = document.createElement('span');
    s.textContent = texto;
    topo.appendChild(s);
    return topo;
  }

  function listar(painel, topo, itens, rotulo, aoClicar) {
    painel.innerHTML = '';
    painel.appendChild(topo);
    if (!itens.length) {
      const v = document.createElement('div');
      v.className = 'lc-casc-vazio';
      v.textContent = 'Nada aqui.';
      painel.appendChild(v);
      return;
    }
    itens.forEach(it => {
      const b = document.createElement('button');
      b.className = 'lc-casc-opt';
      b.textContent = rotulo(it);
      b.addEventListener('click', (e) => { e.stopPropagation(); aoClicar(it); });
      painel.appendChild(b);
    });
  }

  async function abrirCascata(painel, grupoCodigo, aoEscolher) {
    painel.hidden = false;
    painel.innerHTML = '<div class="lc-casc-vazio">Carregando...</div>';
    try {
      const grupos = await getJson(`${API}/grupos`);
      const grupo = grupos.find(g => String(g.codigo) === String(grupoCodigo));
      if (!grupo) { painel.innerHTML = '<div class="lc-casc-vazio">Grupo não encontrado.</div>'; return; }
      nivelSubGrupos(painel, grupo, aoEscolher);
    } catch (err) {
      painel.innerHTML = `<div class="lc-casc-vazio">Erro: ${err.message}</div>`;
    }
  }

  async function nivelSubGrupos(painel, grupo, aoEscolher) {
    const subs = await getJson(`${API}/subgrupos/${grupo._id}?somenteAtivas=true`);
    listar(painel, cabecalho(`${grupo.codigo} - ${grupo.nome}`, null),
      subs, s => `${s.codigo} - ${s.nome}`,
      (s) => nivelTitulos(painel, grupo, s, aoEscolher));
  }

  async function nivelTitulos(painel, grupo, sg, aoEscolher) {
    const tits = await getJson(`${API}/titulos/${sg._id}?somenteAtivas=true`);
    listar(painel, cabecalho(`${sg.codigo} - ${sg.nome}`, () => nivelSubGrupos(painel, grupo, aoEscolher)),
      tits, t => `${t.codigo} - ${t.nome}`,
      (t) => nivelSubtitulos(painel, grupo, sg, t, aoEscolher));
  }

  async function nivelSubtitulos(painel, grupo, sg, tit, aoEscolher) {
    const subs = await getJson(`${API}/subtitulos/${tit._id}?somenteAtivas=true`);
    listar(painel, cabecalho(`${tit.codigo} - ${tit.nome}`, () => nivelTitulos(painel, grupo, sg, aoEscolher)),
      subs, s => `${s.codigo} - ${s.nome}`,
      (s) => { painel.hidden = true; aoEscolher(s); });
  }

  const fecharCascatas = () => $$('.lc-cascata').forEach(p => p.hidden = true);

  /* ============================================================
     HISTÓRICO COM SUGESTÃO
     Reaproveita /financeiro/api/pagamento/historicos, que já ordena por
     número de usos. Mostra os 5 primeiros — a lista existe para poupar
     digitação, não para virar um catálogo.

     Enter aqui é o combinado: com texto escrito ou opção marcada, pula para
     o Valor; em branco, não faz nada e continua esperando.
     ============================================================ */
  const MAX_SUGESTOES = 5;

  function ligarHistorico(celula, pegarConta, campoSeguinte) {
    const input = $('.lc-hist', celula);
    const lista = $('.lc-hist-lista', celula);
    let marcado = -1;

    const fechar = () => { lista.hidden = true; marcado = -1; };

    async function sugerir() {
      const conta = pegarConta();
      const termo = input.value.trim();
      try {
        const params = new URLSearchParams();
        if (conta) params.set('conta', conta);
        if (termo) params.set('termo', termo);
        // O tipo separa as sugestões por natureza: numa boleta de crédito
        // (saída) não faz sentido oferecer "recebido".
        params.set('tipo', st.modo === 'debito' ? 'RECEBIMENTO' : 'PAGAMENTO');
        const todos = await getJson(`${API}/historicos?${params}`);
        const cinco = (todos || []).slice(0, MAX_SUGESTOES);

        if (!cinco.length) { fechar(); return; }

        lista.innerHTML = '';
        cinco.forEach(txt => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'lc-hist-opt';
          b.textContent = txt;
          b.addEventListener('mousedown', (e) => {
            // mousedown, e não click: o blur do input chegaria antes do click
            // e fecharia a lista sem nunca selecionar nada.
            e.preventDefault();
            input.value = txt;
            fechar();
            if (campoSeguinte()) campoSeguinte().focus();
          });
          lista.appendChild(b);
        });
        lista.hidden = false;
        marcado = -1;
      } catch (_) {
        fechar();   // sugestão é conveniência: falhou, segue digitando
      }
    }

    function destacar(passo) {
      const opts = $$('.lc-hist-opt', lista);
      if (!opts.length) return;
      opts.forEach(o => o.classList.remove('marcado'));
      marcado = (marcado + passo + opts.length) % opts.length;
      opts[marcado].classList.add('marcado');
    }

    input.addEventListener('focus', sugerir);
    input.addEventListener('input', sugerir);
    input.addEventListener('blur', () => setTimeout(fechar, 120));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); destacar(1);  return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); destacar(-1); return; }
      if (e.key === 'Escape')    { fechar(); e.stopPropagation();    return; }

      if (e.key !== 'Enter') return;

      // Este Enter é do histórico. Sem parar aqui, o atalho global da janela
      // entenderia como pedido de gravar.
      e.preventDefault();
      e.stopPropagation();

      const opts = $$('.lc-hist-opt', lista);
      if (!lista.hidden && marcado >= 0 && opts[marcado]) {
        input.value = opts[marcado].textContent;
        fechar();
      } else if (!input.value.trim()) {
        return;                      // em branco: fica aguardando
      }
      fechar();
      const seguinte = campoSeguinte();
      if (seguinte) seguinte.focus();
    });
  }

  /* ============================================================
     CONTRAPARTIDAS
     ============================================================ */
  function novaLinha(valorSugerido) {
    const id = ++st.contador;
    const div = document.createElement('div');
    div.className = 'lc-contra';
    div.innerHTML = `
      <div class="lc-contra-topo">
        <div class="lc-grupos">
          <label><input type="radio" name="g${id}" value="1" checked> Ativo</label>
          <label><input type="radio" name="g${id}" value="2"> Passivo</label>
          <label><input type="radio" name="g${id}" value="3"> Despesas</label>
          <label><input type="radio" name="g${id}" value="4"> Receitas</label>
        </div>
        <button type="button" class="lc-remover">remover</button>
      </div>
      <div class="lc-cab">
        <div class="lc-center">Conta</div><div>Nome da conta</div>
        <div>Histórico</div><div class="lc-right">Valor</div>
      </div>
      <div class="lc-linha">
        <div class="lc-cel-conta">
          <button type="button" class="lc-conta vazio">
            <span class="lc-conta-cod">Selecione</span><i class="lc-chev">▾</i>
          </button>
          <div class="lc-cascata" hidden></div>
        </div>
        <div><input type="text" class="lc-nome" readonly placeholder="—"></div>
        <div class="lc-cel-hist">
          <input type="text" class="lc-hist" placeholder="histórico" autocomplete="off">
          <div class="lc-hist-lista" hidden></div>
        </div>
        <div class="lc-right"><input type="text" class="lc-valor" inputmode="decimal" placeholder="0,00"></div>
      </div>`;

    const linha  = $('.lc-linha', div);
    const botao  = $('.lc-conta', div);
    const painel = $('.lc-cascata', div);

    botao.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!painel.hidden) { painel.hidden = true; return; }
      fecharCascatas();
      const grupo = $(`input[name="g${id}"]:checked`, div).value;
      abrirCascata(painel, grupo, (conta) => {
        botao.classList.remove('vazio');
        $('.lc-conta-cod', botao).textContent = conta.codigo;
        $('.lc-nome', div).value = conta.nome;
        linha.dataset.conta   = conta.codigo;
        linha.dataset.contaId = conta._id;
        linha.dataset.nome    = conta.nome;
        recalcular();
        // Conta escolhida, o próximo passo é sempre o histórico.
        $('.lc-hist', div).focus();
      });
    });

    // Trocar o grupo invalida a conta escolhida: ela era de outro quadrante.
    // E já reabre a cascata no grupo novo, para o usuário não ter de clicar
    // de novo só para ver o que existe ali dentro.
    $$(`input[name="g${id}"]`, div).forEach(r => r.addEventListener('change', () => {
      linha.dataset.conta = '';
      botao.classList.add('vazio');
      $('.lc-conta-cod', botao).textContent = 'Selecione';
      $('.lc-nome', div).value = '';
      recalcular();
      abrirCascataDaLinha(div);
    }));

    ligarHistorico(
      $('.lc-cel-hist', div),
      () => linha.dataset.conta || '',
      () => $('.lc-valor', div)
    );

    $('.lc-valor', div).addEventListener('input', recalcular);

    // Enter no valor da contrapartida: fechou, confirma; faltou, abre a
    // próxima linha já com a diferença. É o que substitui o botão de
    // acrescentar linha, que saiu daqui.
    $('.lc-valor', div).addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      if (recalcular()) abrirConfirmacao();
      else talvezAbrirProxima();
    });

    $('.lc-remover', div).addEventListener('click', () => { div.remove(); recalcular(); });

    if (valorSugerido > 0) $('.lc-valor', div).value = fmt(valorSugerido);

    $('#lc-contrapartidas').appendChild(div);
    return div;
  }

  /* Abre a cascata daquela linha no grupo que estiver marcado. */
  function abrirCascataDaLinha(div) {
    const botao = $('.lc-conta', div);
    if (botao) botao.click();
  }

  /* Leva o foco para o começo de uma linha de contrapartida: marca Ativo,
     põe o foco no radio e já mostra as contas daquele grupo. */
  function focarLinha(div) {
    if (!div) return;
    const ativo = $('input[type="radio"][value="1"]', div);
    if (ativo) { ativo.checked = true; ativo.focus(); }
    abrirCascataDaLinha(div);
  }

  /* ============================================================
     CÁLCULO
     ============================================================ */
  function recalcular() {
    const total = paraNumero($('#lc-valor-principal').value);
    let lancado = 0;
    $$('#lc-contrapartidas .lc-valor').forEach(i => { lancado += paraNumero(i.value); });
    const falta = total - lancado;

    $('#lc-lancado').textContent = fmt(lancado);
    const el = $('#lc-falta');
    el.textContent = fmt(falta);
    el.className = Math.abs(falta) < 0.005 ? 'ok' : 'falta';

    const linhas = $$('#lc-contrapartidas .lc-linha');
    const todasComConta = linhas.length > 0 && linhas.every(l => {
      const v = paraNumero($('.lc-valor', l).value);
      return v === 0 || !!l.dataset.conta;      // linha em branco não atrapalha
    });

    const fechado = total > 0 && Math.abs(falta) < 0.005 && st.conta && todasComConta;
    $('#lc-gravar').disabled = !fechado;
    return fechado;
  }

  /* Quando ainda falta valor, abre a próxima linha já com a diferença. */
  function talvezAbrirProxima() {
    const total = paraNumero($('#lc-valor-principal').value);
    if (total <= 0) return;
    let lancado = 0;
    $$('#lc-contrapartidas .lc-valor').forEach(i => { lancado += paraNumero(i.value); });
    const falta = total - lancado;
    if (falta < 0.005) return;

    // Só abre se a última já estiver preenchida, senão empilha linha vazia.
    const linhas = $$('#lc-contrapartidas .lc-linha');
    const ultima = linhas[linhas.length - 1];
    if (ultima && (!ultima.dataset.conta || paraNumero($('.lc-valor', ultima).value) === 0)) return;

    focarLinha(novaLinha(falta));
  }

  /* ============================================================
     CONFIRMAÇÃO
     ============================================================ */
  function resumo() {
    const total = paraNumero($('#lc-valor-principal').value);
    const linhas = $$('#lc-contrapartidas .lc-linha')
      .filter(l => paraNumero($('.lc-valor', l).value) > 0)
      .map(l => `   ${l.dataset.conta}  ${l.dataset.nome || ''}  ${$('.lc-valor', l).value}`);
    const rot = st.modo === 'credito' ? ['Crédito', 'Débito'] : ['Débito', 'Crédito'];
    return `${rot[0]}: ${st.conta.codigo} ${st.conta.nome}  ${fmt(total)}\n${rot[1]}:\n${linhas.join('\n')}`;
  }

  function abrirConfirmacao() {
    if (!recalcular()) return;
    $('#lc-conf-resumo').textContent = resumo();
    $('#lc-conf').hidden = false;
  }

  /* ============================================================
     GRAVAÇÃO
     ============================================================ */
  let gravando = false;

  async function gravar() {
    if (gravando) return;              // dois cliques não viram duas boletas
    if (!recalcular()) return;

    const botao = $('#lc-conf-salvar');
    gravando = true;
    botao.disabled = true;
    botao.textContent = 'Gravando...';

    try {
      const corpo = {
        modo:      st.modo,
        data:      $('#lc-data').value,
        contaId:   st.conta._id,
        historico: $('#lc-hist-principal').value,
        valor:     paraNumero($('#lc-valor-principal').value),
        contrapartidas: $$('#lc-contrapartidas .lc-linha')
          .filter(l => paraNumero($('.lc-valor', l).value) > 0)
          .map(l => ({
            contaId:   l.dataset.contaId,
            historico: $('.lc-hist', l.closest('.lc-contra')).value,
            valor:     paraNumero($('.lc-valor', l).value)
          }))
      };

      const r = await postJson(`${API}/lancamento`, corpo);

      $('#lc-conf').hidden = true;

      // Recarrega o razão para a boleta nova aparecer atrás do aviso.
      if (typeof window.recarregarRazao === 'function') {
        window.recarregarRazao();
      }

      // O aviso vive dentro da janela, então ele tem de aparecer ANTES do
      // fechar() — que esconde a janela inteira, aviso junto.
      await avisar(`Boleta ${r.codigo} gravada.`, 'Lançamento gravado');
      fechar();
    } catch (err) {
      await avisar(err.message, 'Não foi possível gravar');
    } finally {
      gravando = false;
      botao.disabled = false;
      botao.textContent = 'Salvar';
    }
  }

  /* ============================================================
     EVENTOS
     ============================================================ */
  function ligarEventos() {
    ligarHistorico(
      $('#lc-hist-principal').closest('.lc-cel-hist'),
      () => (st.conta ? st.conta.codigo : ''),
      () => $('#lc-valor-principal')
    );

    $('#lc-x').addEventListener('click', fechar);
    $('#lc-gravar').addEventListener('click', abrirConfirmacao);
    $('#lc-valor-principal').addEventListener('input', recalcular);

    // Enter no valor de cima leva direto para a primeira contrapartida, com
    // Ativo marcado e a lista de contas já aberta.
    $('#lc-valor-principal').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      const primeira = $('#lc-contrapartidas .lc-contra');
      focarLinha(primeira);
    });

    $('#lc-conf-cancelar').addEventListener('click', () => { $('#lc-conf').hidden = true; });
    $('#lc-conf-salvar').addEventListener('click', gravar);

    $('#lc-janela').addEventListener('click', (e) => {
      if (!e.target.closest('.lc-cel-conta')) fecharCascatas();
    });

    document.addEventListener('keydown', (e) => {
      const fundo = document.getElementById('lc-fundo');
      if (!fundo || fundo.hidden) return;         // janela fechada: não interfere
      const aviso = document.getElementById('lc-aviso');
      if (aviso && !aviso.hidden) {
        // Com o aviso aberto, Enter e Esc pertencem a ele.
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          $('#lc-aviso-ok').click();
        }
        return;
      }
      if (e.key === 'Escape') { fechar(); return; }
      if (e.key !== 'Enter') return;
      if (!$('#lc-conf').hidden) return;          // a confirmação já está na tela
      e.preventDefault();
      if (recalcular()) abrirConfirmacao();
      else talvezAbrirProxima();
    });
  }

  /* ============================================================
     API PÚBLICA
     ============================================================ */
  function abrir({ modo = 'credito', conta = null } = {}) {
    if (!conta) {
      alert('Selecione uma conta no razão antes de lançar.');
      return;
    }

    injetarEstilo();
    montarJanela();

    st.modo = modo === 'debito' ? 'debito' : 'credito';
    st.conta = conta;
    st.contador = 0;

    const ehCred = st.modo === 'credito';
    $('#lc-titulo').textContent        = ehCred ? 'Lançamento a crédito' : 'Lançamento a débito';
    $('#lc-rot-principal').textContent = ehCred ? 'Crédito:' : 'Débito:';
    $('#lc-rot-contra').textContent    = ehCred ? 'Débito:'  : 'Crédito:';

    $('#lc-conta-cod').textContent   = conta.codigo;
    $('#lc-conta-nome').value        = conta.nome || '';
    $('#lc-hist-principal').value    = '';
    $('#lc-valor-principal').value   = '';
    $('#lc-data').value              = hojeISO();
    $('#lc-contrapartidas').innerHTML = '';
    novaLinha(0);

    $('#lc-fundo').hidden = false;

    const janela = $('#lc-janela');
    janela.style.left = Math.max(20, (window.innerWidth - janela.offsetWidth) / 2) + 'px';
    janela.style.top  = '70px';

    recalcular();
    $('#lc-hist-principal').focus();   // o valor vem depois do histórico
  }

  function fechar() {
    const fundo = document.getElementById('lc-fundo');
    if (fundo) fundo.hidden = true;
    const conf = document.getElementById('lc-conf');
    if (conf) conf.hidden = true;
  }

  return { abrir, fechar };
})();
