// =============================================================================
// Destino: C:\plataformaRota\public\js\contab\contabil\financeiro\dda-confere.js
// Criado em: 18/10/2026
//
// FLUXO DE CAIXA > SUB-MENU > DDA - CONFERE (ideia do Jorge). Janela em DUAS PARTES:
//   ESQUERDA: os titulos de fornecedor do NOSSO FLUXO (a pagar e compras projetadas), 90 dias
//   DIREITA:  os titulos do ARQUIVO CSV do DDA exportado do banco
// Importado o arquivo, compara na hora:
//   ✓ confere          mesmo CNPJ, mesmo valor, mesmo vencimento
//   ⚠ valor / venc.    mesmo CNPJ, valor ou vencimento diferente (vencimento ate 5 dias)
//   ⚠ filial           CNPJ com a mesma raiz (8 primeiros numeros) de um fornecedor nosso
//   ✗ CNPJ desconhecido o beneficiario NAO e fornecedor cadastrado: principal sinal de FRAUDE
//   ? so no banco      fornecedor nosso, mas sem titulo no fluxo
//   · so no fluxo      titulo nosso que nao veio no DDA
// As colunas do CSV sao achadas pelo cabecalho (CNPJ, beneficiario, vencimento, valor); se nao
// achar, a tela pede para escolher. A escolha fica guardada neste computador (por banco/arquivo).
// 18/10/2026: "🧪 Simular arquivo do banco": sem o CSV real, monta um a partir do nosso fluxo com
//   erros de proposito (valor, vencimento, titulo que nao veio, CNPJ desconhecido) para testar.
// 18/10/2026: coluna Venc. entre o historico e o valor; # (ordem); ORDENAR clicando no titulo
//   (Fornecedor, Venc., Valor) — os dois lados juntos. A faixa "colunas do arquivo" so aparece
//   quando o sistema nao acerta sozinho (ou no botao ⚙); escolha guardada errada e ignorada.
// 18/10/2026: "✎ ajustar o vencimento do fluxo" no titulo com vencimento diferente do banco: janela
//   (arrasta pelo titulo) com o vencimento do banco ja preenchido; grava no fluxo e compara de novo
//   (PUT /financeiro/api/pagamento/titulo/:id/vencimento).
// 19/10/2026 - O ARQUIVO DE VERDADE (BB "Agenda de boletos DDA") NAO E UMA TABELA: e um relatorio em
//   texto (cada boleto em 3 linhas: sacado / "cedente  documento  vencimento  valor" / estado) e NAO TEM
//   CNPJ. Por isso a tela "nao funcionava" (procurava colunas CNPJ/valor e nao achava nenhuma). Agora:
//   - o formato "Agenda de boletos" e reconhecido sozinho: le cedente, documento, vencimento e valor de
//     cada boleto, e o periodo do arquivo ("a partir de ... ate ...") vira o periodo da tela;
//   - sem CNPJ, o par e achado pelo NUMERO DA NOTA (o documento do boleto "0617763 01" = NF 617763 no
//     historico do fluxo "Rinnai/NF Nº 617763...") e, na falta, pelo NOME do cedente (Rinnai, Tigre...);
//   - "⚠ outro beneficiario": a nota e nossa mas quem cobra e outro (ex.: KOMLOG cobrando nota da Komeco,
//     SB CREDITO SECURITIZADORA = boleto cedido a um banco/factoring). Confira antes de pagar;
//   - "✗ desconhecido": nem a nota nem o nome batem com o fluxo ou o cadastro: confira antes de pagar;
//   - o lado do fluxo traz TODO o a pagar (seguro, contador, DNIT tambem vem no DDA); a caixinha
//     "só fornecedores" esconde os "só no fluxo" que nao sao fornecedor (salario, imposto...);
//   - SAIU o "🧪 Simular arquivo do banco".
//   O formato em colunas (CSV com CNPJ, de outros bancos) continua funcionando como antes.
//   pos como no Access: 3 = pedido feito, 7 = compra projetada.
// 19/10/2026 (2): par do MAIS CERTO para o menos certo (todos os boletos juntos); "✎ ajustar" so com VALOR IGUAL
//   (com valor diferente o par pode estar errado: mostra o aviso, sem ajuste); "↶ desfazer o ajuste" volta o
//   vencimento de antes (vem de `ajustes` do titulo); "Procurar" nos dois lados. O ajuste NUNCA muda o valor.
// 19/10/2026 (3): a NOTA e procurada DENTRO do documento do boleto (Tigre 0208804501 = NF 2088045, Rinnai 0620819 01 =
//   NF 620819); achou a nota, o par so pode ser titulo DESSA nota (antes caia no nome e pegava outra nota da Rinnai).
// 19/10/2026 (4): "📒 razão" em cada titulo do fluxo: razao da conta + titulos em aberto e a conferencia do saldo
//   (public/js/comum/razao-conta.js).
// 19/10/2026 (5): "📒 razão" tambem no BOLETO (lado do banco), pela conta do fornecedor (do par, do fluxo pelo nome ou do
//   cadastro): a janela acende a nota e o valor do boleto no razao ("ja foi pago e estao cobrando de novo?").
//   Trocar de grupo (chip) limpa a busca; com tudo vazio aparece "mostrar todos". O arquivo nunca se perde.
// Carregado pelo sub-menu (fluxo-submenu.js): window.DdaConfere.abrir()
// API: GET /financeiro/api/pagamento/dda-confere?de=&ate=
// =============================================================================

(function () {
  'use strict';
  const API = '/financeiro/api/pagamento';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cent = v => Math.round(Number(v || 0) * 100);
  const soDig = v => String(v || '').replace(/\D/g, '');
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const br = s => { if (!s) return ''; const [a, m, d] = String(s).slice(0, 10).split('-'); return d + '/' + m + '/' + a.slice(2); };
  const cnpjFmt = c => { c = soDig(c); return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : c.length === 11 ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : c; };
  const diasEntre = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000);

  // ---- CSV ----
  function lerCsv(txt) {
    txt = txt.replace(/^\uFEFF/, '');
    const linhas1 = txt.split(/\r?\n/).filter(l => l.trim());
    const amostra = linhas1.slice(0, 20).join('\n');
    const sep = [';', ',', '\t'].sort((a, b) => amostra.split(b).length - amostra.split(a).length)[0];
    const linhas = [];
    for (const l of linhas1) {
      const cel = []; let atual = '', aspas = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (c === '"') { if (aspas && l[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
        else if (c === sep && !aspas) { cel.push(atual.trim()); atual = ''; }
        else atual += c;
      }
      cel.push(atual.trim()); linhas.push(cel);
    }
    return linhas;
  }
  const valorNum = s => {
    let t = String(s || '').replace(/[R$\s]/g, '');
    if (!t) return NaN;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    return Number(t);
  };
  const dataIso = s => {
    const t = String(s || '').trim();
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) { const a = m[3].length === 2 ? '20' + m[3] : m[3]; return a + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return '';
  };
  const PAPEIS = [
    { k: 'cnpj', rot: 'CNPJ do beneficiário', re: /cnpj|cpf|inscri|documento do (benef|ced)/i },
    { k: 'nome', rot: 'Beneficiário', re: /benefici|cedente|raz[aã]o|sacador|fornecedor|nome|favorecido/i },
    { k: 'venc', rot: 'Vencimento', re: /venc/i },
    { k: 'valor', rot: 'Valor', re: /valor/i, nao: /juro|multa|desc|abat|mora|pago|cobrado|encargo/i },
    { k: 'doc', rot: 'Nº / nosso número (opcional)', re: /nosso|n[uú]mero do doc|documento|c[oó]d.*barra|linha dig/i, opc: true },
  ];
  // acha a linha do cabecalho (a primeira com "venc") e as colunas pelo nome
  function cabecalho(linhas) {
    const i = linhas.slice(0, 25).findIndex(l => l.length >= 3 && l.some(c => /venc/i.test(c)));
    return i < 0 ? 0 : i;
  }
  function adivinhar(cab) {
    const m = {}, usadas = new Set();
    for (const p of PAPEIS) {
      let j = cab.findIndex((c, x) => !usadas.has(x) && p.re.test(c) && !(p.nao && p.nao.test(c)));
      if (j < 0 && p.k === 'valor') j = cab.findIndex((c, x) => !usadas.has(x) && p.re.test(c));
      if (j >= 0) { m[p.k] = j; usadas.add(j); }
    }
    return m;
  }

  // ---- 19/10/2026: o relatorio "Agenda de boletos DDA" (BB): texto, sem CNPJ ----
  const limpo = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const numeros = s => (String(s || '').match(/\d{4,}/g) || []).map(n => n.replace(/^0+/, '')).filter(Boolean);
  const nfDe = doc => numeros(doc).sort((a, b) => b.length - a.length)[0] || '';
  // 19/10/2026: a NOTA dentro do documento do boleto: "0617763 01" -> 61776301 contem 617763; Tigre "0208804501" -> NF
  // 2088045 + parcela 01; Sfera "0003127931" -> NF 312793 + 1; Formetal "102175431" -> NF 217543. Nota com 5+ digitos:
  // "contem"; com 4 (Orbis "1086 3/3", RR "NFe7991B"): o documento comeca com ela.
  const digitosDoc = s => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
  const casaNf = (doc, nf) => { const d = digitosDoc(doc); return !!nf && (nf.length >= 5 ? d.includes(nf) : d.startsWith(nf) && d.length - nf.length <= 3); };
  const GENERICAS = new Set(('LTDA SA ME EPP EIRELI IND INDUS INDUSTRIA COM COMERCIAL COMERCIO IMP IMPORT IMPORTACAO DOS DAS CIA '
    + 'BRASIL FORNECEDORA METALURGICA TRANSPORTADORA TUBOS FLEXIVEIS TECNOLOGIA AQUECIMENTO CONST MATE SOL CREDITO '
    + 'SEG GER DEPARTAMENTO NACIONAL ORGANIZACOES CONTABEIS FERRAMENTAS SEGURANA SEGURANCA METAIS').split(' '));
  const palavrasDe = s => limpo(s).split(/[^A-Z0-9]+/).filter(Boolean);
  // a palavra que identifica o cedente: a 1a nao generica (RINNAI, TIGRE...); se nao houver, a 1a (RR BRASIL -> RR)
  const chaveNome = s => { const w = palavrasDe(s); return w.find(x => x.length >= 3 && !GENERICAS.has(x)) || w.find(x => x.length >= 2 && !GENERICAS.has(x)) || ''; };
  const temPalavra = (txt, chave) => !!chave && palavrasDe(txt).includes(chave);   // palavra inteira (Tigre_Aquath -> TIGRE)
  const ehAgenda = txt => /agenda de boletos/i.test(txt) || (!/;/.test(txt) && (txt.match(/\d{2}\/\d{2}\/\d{4}\s+\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).length >= 3);
  function lerAgenda(txt) {
    const ls = txt.replace(/^\uFEFF/, '').split(/\r?\n/);
    const per = txt.match(/a partir de\s+(\d{2}\/\d{2}\/\d{4})\D+(\d{2}\/\d{2}\/\d{4})/i);
    const pedacos = l => String(l || '').replace(/"/g, '').split(/\s{2,}/).map(x => x.trim()).filter(Boolean);
    // o sacado (nos) e o estado ficam nas colunas de fora: "ARMACAO COMERCIAL", "LTDA EPP", "A", "PAGAR"
    const sacado = x => /arma\S*o\s+comercial/i.test(x) || /^(ltda\b.*|me|epp|a|pagar)$/i.test(x);
    const itens = [];
    ls.forEach((l, i) => {
      const m = l.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/);
      if (!m) return;
      const p = pedacos(l.slice(0, m.index)).filter(x => !sacado(x));
      const doc = p.length ? p.pop() : '';
      let nome = p.join(' ');
      if (!nome) nome = [...pedacos(ls[i - 1]), ...pedacos(ls[i + 1])].filter(x => !sacado(x)).join(' ');   // nome na linha de cima/baixo
      itens.push({ i: itens.length, cnpj: '', nome, doc, venc: dataIso(m[1]), valor: valorNum(m[2]) });
    });
    return { itens, de: per ? dataIso(per[1]) : '', ate: per ? dataIso(per[2]) : '' };
  }

  // ---- janela ----
  const st = document.createElement('style');
  st.textContent = `
  .dc-fundo { position:fixed; inset:0; background:rgba(15,23,42,.25); z-index:80; }
  .dc-jan { position:fixed; inset:2vh 1vw; z-index:81; display:flex; flex-direction:column; background:#fff; border-radius:12px;
            box-shadow:0 18px 50px rgba(0,0,0,.3); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#111827; }
  .dc-fundo[hidden], .dc-jan[hidden], .dc-map[hidden] { display:none; }
  .dc-cab { display:flex; align-items:center; gap:10px; padding:9px 14px; background:#6d28d9; color:#fff; border-radius:12px 12px 0 0; font-weight:800; font-size:15px; }
  .dc-cab span { flex:1; } .dc-cab button { border:0; background:none; color:#fff; font-size:20px; cursor:pointer; }
  .dc-ctl { display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap; padding:8px 14px; border-bottom:1px solid #e5e7eb; }
  .dc-ctl label { display:flex; flex-direction:column; gap:2px; font-size:10px; font-weight:700; text-transform:uppercase; color:#374151; }
  .dc-ctl input[type=date] { height:30px; border:1px solid #d1d5db; border-radius:6px; padding:0 6px; }
  .dc-arq { border:1px dashed #6d28d9; background:#faf5ff; color:#6d28d9; border-radius:8px; padding:6px 12px; font-weight:800; cursor:pointer; font-size:13px; }
  .dc-nome { font-size:12px; color:#6b7280; align-self:center; }
  .dc-map { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; padding:8px 14px; background:#fffbeb; border-bottom:1px solid #fde68a; }
  .dc-map label { display:flex; flex-direction:column; gap:2px; font-size:10px; font-weight:700; text-transform:uppercase; color:#92400e; }
  .dc-map select { height:28px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; max-width:200px; }
  .dc-res { display:flex; gap:8px; flex-wrap:wrap; padding:8px 14px; border-bottom:1px solid #e5e7eb; }
  .dc-chip { border:1px solid #e5e7eb; border-radius:14px; padding:3px 10px; font-weight:700; cursor:pointer; background:#fff; font-size:12px; }
  .dc-chip.on { outline:2px solid #6d28d9; }
  .dc-duas { flex:1; min-height:0; display:grid; grid-template-columns:1fr 1fr; gap:0; }
  .dc-lado { display:flex; flex-direction:column; min-height:0; border-right:1px solid #e5e7eb; }
  .dc-lado h3 { margin:0; padding:7px 12px; font-size:12px; text-transform:uppercase; color:#6d28d9; background:#faf5ff; border-bottom:1px solid #ede9fe; }
  .dc-lado h3 small { color:#6b7280; text-transform:none; font-weight:600; }
  .dc-rola { flex:1; min-height:0; overflow:auto; }
  .dc-tab { width:100%; border-collapse:collapse; }
  .dc-tab th { position:sticky; top:0; background:#f3f4f6; font-size:10px; text-transform:uppercase; color:#374151; text-align:left; padding:5px 6px; z-index:1; }
  .dc-tab td { padding:5px 6px; border-top:1px solid #f3f4f6; vertical-align:top; }
  .dc-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .dc-tab .cn { font-size:11px; color:#6b7280; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .dc-tab tr { cursor:pointer; } .dc-tab tr:hover td { background:#faf5ff; }
  .dc-tab tr.par td { background:#ede9fe !important; }
  .dc-st { font-size:11px; font-weight:800; white-space:nowrap; border-radius:8px; padding:1px 6px; }
  .s-ok { background:#dcfce7; color:#166534; } .s-valor, .s-venc, .s-ambos, .s-filial { background:#fef3c7; color:#92400e; }
  .s-outroBenef { background:#ffedd5; color:#9a3412; }
  .s-desconhecido { background:#fee2e2; color:#991b1b; } .s-soBanco { background:#e0f2fe; color:#075985; } .s-soFluxo { background:#f3f4f6; color:#374151; }
  tr.l-desconhecido td { background:#fff1f2; }
  .dc-vz { padding:24px; color:#6b7280; text-align:center; }
  .dc-tab th.ord { cursor:pointer; user-select:none; } .dc-tab th.ord:hover { color:#6d28d9; }
  .dc-aj { margin-top:4px; border:1px solid #c4b5fd; background:#faf5ff; color:#6d28d9; border-radius:6px; padding:2px 8px; font-size:12px; font-weight:700; cursor:pointer; }
  .dc-aj:hover { background:#ede9fe; }
  .dc-mfundo { position:fixed; inset:0; background:rgba(15,23,42,.25); z-index:90; display:flex; align-items:center; justify-content:center; }
  .dc-mcx { font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:#111827; background:#fff; border-radius:12px; width:min(460px,92vw); box-shadow:0 18px 50px rgba(0,0,0,.3); font-size:14px; }
  .dc-mcx h4 { margin:0; padding:10px 14px; background:#6d28d9; color:#fff; border-radius:12px 12px 0 0; font-size:15px; cursor:move; user-select:none; }
  .dc-mcx .co { padding:12px 14px; line-height:1.5; }
  .dc-mcx label { display:flex; flex-direction:column; gap:3px; font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; margin-top:10px; }
  .dc-mcx input { height:32px; border:1px solid #d1d5db; border-radius:6px; padding:0 8px; font-size:14px; }
  .dc-mcx .bt { display:flex; gap:8px; justify-content:flex-end; padding:10px 14px; border-top:1px solid #e5e7eb; }
  .dc-mcx .bt button { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:7px 14px; font-weight:700; cursor:pointer; }
  .dc-mcx .bt .ok { background:#6d28d9; border-color:#6d28d9; color:#fff; }
  .dc-mcx .er { color:#dc2626; font-weight:600; font-size:13px; min-height:18px; margin-top:6px; }
  .dc-dif { color:#b45309; font-weight:700; font-size:12px; }`;
  document.head.appendChild(st);

  const ST = { ok: '✓ confere', valor: '⚠ valor', venc: '⚠ vencimento', ambos: '⚠ valor e venc.', filial: '⚠ CNPJ filial',
               outroBenef: '⚠ outro beneficiário', desconhecido: '✗ desconhecido', soBanco: '? só no banco', soFluxo: '· só no fluxo' };
  let ordem = { k: 'venc', asc: true };
  let jan, fundo, fluxo = [], forn = [], banco = [], linhasCsv = [], iCab = 0, mapa = {}, filtro = '', chaveMapa = '';
  let temArq = false, formato = '';                           // 19/10/2026: 'agenda' (BB) ou 'colunas'
  const q = id => jan.querySelector('#' + id);

  function montar() {
    fundo = document.createElement('div'); fundo.className = 'dc-fundo'; fundo.hidden = true;
    jan = document.createElement('div'); jan.className = 'dc-jan'; jan.hidden = true;
    jan.innerHTML = '<div class="dc-cab"><span>DDA - confere · nosso fluxo × arquivo do banco</span><button type="button" id="dc-x" title="fechar (Esc)">×</button></div>'
      + '<div class="dc-ctl"><label>Vencimento de<input type="date" id="dc-de"></label><label>até<input type="date" id="dc-ate"></label>'
      + '<button type="button" class="dc-arq" id="dc-bt">📂 Importar o arquivo do DDA (CSV)</button><input type="file" id="dc-file" accept=".csv,.txt,text/csv" hidden>'
      + '<label>Procurar<input id="dc-busca" placeholder="fornecedor, beneficiário, nota ou nº" autocomplete="off" style="height:30px;width:230px;border:1px solid #d1d5db;border-radius:6px;padding:0 8px"></label>'
      + '<label style="flex-direction:row;align-items:center;gap:5px;font-size:12px;text-transform:none;align-self:center"><input type="checkbox" id="dc-forn" checked> só fornecedores no "só no fluxo"</label>'
      + '<button type="button" class="dc-chip" id="dc-cols" hidden title="qual coluna do arquivo é o CNPJ, o vencimento, o valor">⚙ colunas do arquivo</button>'
      + '<span class="dc-nome" id="dc-nome">exporte o DDA no site do banco (CSV) e escolha o arquivo</span></div>'
      + '<div class="dc-map" id="dc-map" hidden></div>'
      + '<div class="dc-res" id="dc-res"></div>'
      + '<div class="dc-duas"><div class="dc-lado"><h3>Nosso fluxo <small id="dc-t1"></small></h3><div class="dc-rola" id="dc-esq"></div></div>'
      + '<div class="dc-lado"><h3>Arquivo do banco <small id="dc-t2"></small></h3><div class="dc-rola" id="dc-dir"></div></div></div>';
    document.body.appendChild(fundo); document.body.appendChild(jan);
    const fechar = () => { jan.hidden = true; fundo.hidden = true; };
    q('dc-x').addEventListener('click', fechar); fundo.addEventListener('click', fechar);
    document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !jan.hidden) fechar(); });
    q('dc-bt').addEventListener('click', () => q('dc-file').click());
    q('dc-file').addEventListener('change', importar);
    q('dc-forn').addEventListener('change', desenhar);
    q('dc-busca').addEventListener('input', desenhar);           // 19/10/2026: procurar nos dois lados
    q('dc-cols').addEventListener('click', () => desenharMapa(true));
    // 18/10/2026: ordenar clicando no titulo da coluna (Fornecedor, Venc., Valor): os dois lados juntos
    jan.addEventListener('click', ev => {
      const th = ev.target.closest('th[data-ord]'); if (!th) return;
      ordem = ordem.k === th.dataset.ord ? { k: ordem.k, asc: !ordem.asc } : { k: th.dataset.ord, asc: true };
      desenhar();
    });
    q('dc-de').addEventListener('change', carregarFluxo); q('dc-ate').addEventListener('change', carregarFluxo);
    // 19/10/2026: trocar de grupo (chip) limpa a busca — com a busca de antes o grupo novo vinha vazio e parecia que
    // a tela tinha perdido tudo. O arquivo importado continua (nada se perde ao trocar de grupo).
    q('dc-res').addEventListener('click', ev => { const c = ev.target.closest('[data-f]'); if (!c) return; filtro = filtro === c.dataset.f ? '' : c.dataset.f; q('dc-busca').value = ''; desenhar(); });
    jan.addEventListener('click', ev => { if (ev.target.closest('[data-limpa]')) { q('dc-busca').value = ''; filtro = ''; desenhar(); } });
    // 18/10/2026: "✎ ajustar o vencimento do fluxo" (o do banco estava certo)
    jan.addEventListener('click', ev => {
      const b = ev.target.closest('[data-aj]'); if (!b) return;
      ev.stopPropagation();
      ajustarVenc(fluxo.find(t => t._id === b.dataset.aj), b.dataset.venc, !!b.dataset.desfaz);
    }, true);
    // 19/10/2026: "📒 razão" — razao da conta + titulos em aberto, conferindo o saldo (comum/razao-conta.js)
    jan.addEventListener('click', ev => {
      const b = ev.target.closest('[data-raz]'); if (!b) return;
      ev.stopPropagation();
      const ir = () => window.RazaoConta.abrir(b.dataset.raz, b.dataset.nome, { destaque: b.dataset.nf || '', valor: Number(b.dataset.valor) || 0 });
      if (window.RazaoConta) { ir(); return; }
      const sc = document.createElement('script'); sc.src = '/js/comum/razao-conta.js'; sc.onload = ir;
      sc.onerror = () => alert('Não carregou o razao-conta.js'); document.head.appendChild(sc);
    }, true);
    // clicar numa linha: acende o par do outro lado
    jan.addEventListener('click', ev => {
      const tr = ev.target.closest('tr[data-par]'); if (!tr) return;
      jan.querySelectorAll('tr.par').forEach(x => x.classList.remove('par'));
      const p = tr.dataset.par; if (!p) return;
      jan.querySelectorAll('tr[data-par="' + p + '"]').forEach(x => { x.classList.add('par'); if (x !== tr) x.scrollIntoView({ block: 'nearest' }); });
    });
  }

  async function abrir() {
    if (!jan) montar();
    const h = new Date(), a = new Date(); h.setDate(h.getDate() - 7); a.setDate(a.getDate() + 90);
    if (!q('dc-de').value) { q('dc-de').value = ymd(h); q('dc-ate').value = ymd(a); }
    jan.hidden = false; fundo.hidden = false;
    await carregarFluxo();
  }
  async function carregarFluxo() {
    q('dc-esq').innerHTML = '<div class="dc-vz">Carregando…</div>';
    try {
      const r = await fetch(API + '/dda-confere?de=' + q('dc-de').value + '&ate=' + q('dc-ate').value, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
      fluxo = (j.titulos || []).map(t => ({ ...t, _id: String(t._id), venc: String(t.vencimento).slice(0, 10), cnpj: soDig(t.cnpj),
        nfs: numeros(t.historico + ' ' + (t.nrTitulo || '')), texto: [t.marca, t.razao, t.historico, t.nomeConta].join(' ') }));
      forn = j.fornecedores || [];
    } catch (e) { fluxo = []; q('dc-esq').innerHTML = '<div class="dc-vz">' + esc(e.message) + '</div>'; return; }
    comparar();
  }

  // ---- 18/10/2026: ajustar o vencimento no nosso fluxo ----
  function ajustarVenc(t, vencBanco, desfaz) {
    if (!t) return;
    const bp = t.par && banco.find(x => x.par === t.par);
    const f = document.createElement('div'); f.className = 'dc-mfundo';
    f.innerHTML = '<div class="dc-mcx"><h4>' + (desfaz ? 'Desfazer o ajuste do vencimento' : 'Ajustar o vencimento no nosso fluxo') + '</h4><div class="co">'
      + '<b>' + esc(t.marca || t.razao) + '</b><br>' + esc(t.historico) + ' · R$ ' + brl(t.valor)
      + (desfaz ? '<br>Hoje no fluxo: <b>' + br(t.venc) + '</b> · volta para: <b>' + br(vencBanco) + '</b> (o vencimento de antes do ajuste)'
        : '<br>No fluxo: <b>' + br(t.venc) + '</b> · no banco: <b>' + br(vencBanco) + '</b>'
          + (bp ? '<br>Boleto: ' + esc(bp.nome) + (bp.doc ? ' nº ' + esc(bp.doc) : '') + ' · R$ ' + brl(bp.valor) : '')
          + '<br><small>Só o VENCIMENTO muda; o valor do título não é alterado.</small>')
      + '<label>Novo vencimento<input type="date" id="dc-nv" value="' + vencBanco + '"></label>'
      + '<div class="er" id="dc-er"></div></div>'
      + '<div class="bt"><button type="button" data-c>Cancelar</button><button type="button" class="ok" data-g>Gravar no fluxo</button></div></div>';
    document.body.appendChild(f);
    const cx = f.querySelector('.dc-mcx'), h = f.querySelector('h4');
    h.addEventListener('mousedown', ev => {                                     // arrasta pelo titulo
      ev.preventDefault();
      const r0 = cx.getBoundingClientRect(), dx = ev.clientX - r0.left, dy = ev.clientY - r0.top;
      cx.style.position = 'fixed'; cx.style.left = r0.left + 'px'; cx.style.top = r0.top + 'px';
      const m = e => { cx.style.left = (e.clientX - dx) + 'px'; cx.style.top = Math.max(0, e.clientY - dy) + 'px'; };
      const u = () => { document.removeEventListener('mousemove', m); document.removeEventListener('mouseup', u); };
      document.addEventListener('mousemove', m); document.addEventListener('mouseup', u);
    });
    const fechar = () => f.remove();
    f.querySelector('[data-c]').addEventListener('click', fechar);
    f.addEventListener('click', ev => { if (ev.target === f) fechar(); });
    f.querySelector('[data-g]').addEventListener('click', async () => {
      const v = f.querySelector('#dc-nv').value;
      if (!v) { f.querySelector('#dc-er').textContent = 'Informe a data.'; return; }
      try {
        const r = await fetch(API + '/titulo/' + encodeURIComponent(t._id) + '/vencimento', { method: 'PUT',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ vencimento: v, motivo: desfaz ? 'DDA - confere: ajuste desfeito' : 'DDA - confere: vencimento do banco ' + br(vencBanco) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.erro || 'erro ' + r.status);
        fechar();
        // 18/10/2026: o titulo ja fica com a data nova aqui (volta a "confere") e a lista volta inteira
        t.venc = v; t.vencimento = v + 'T12:00:00';
        filtro = '';
        comparar();
        await carregarFluxo();                       // e confere com o servidor; o arquivo do banco continua
        if (window.FluxoCaixa && window.FluxoCaixa.recarregar) window.FluxoCaixa.recarregar();
      } catch (e) { f.querySelector('#dc-er').textContent = e.message; }
    });
    setTimeout(() => f.querySelector('#dc-nv').focus(), 0);
  }

  // ---- importar o CSV ----
  function importar() {
    const f = q('dc-file').files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let txt = String(rd.result || '');
      if (/\uFFFD/.test(txt)) { const r2 = new FileReader(); r2.onload = () => processar(String(r2.result || ''), f.name); r2.readAsText(f, 'ISO-8859-1'); return; }
      processar(txt, f.name);
    };
    rd.readAsText(f, 'UTF-8');
    q('dc-file').value = '';
  }
  function processar(txt, nome) {
    temArq = true;
    if (ehAgenda(txt)) {                                       // 19/10/2026: relatorio do BB, sem colunas
      formato = 'agenda'; linhasCsv = []; q('dc-map').hidden = true; q('dc-cols').hidden = true;
      const ag = lerAgenda(txt);
      banco = ag.itens.filter(b => b.venc && Number.isFinite(b.valor) && b.valor > 0);
      q('dc-nome').textContent = nome + ' · ' + banco.length + ' boleto(s)' + (ag.de ? ' · de ' + br(ag.de) + ' a ' + br(ag.ate) : '') + ' · sem CNPJ: compara pela nota e pelo nome';
      if (ag.de && ag.ate && (q('dc-de').value !== ag.de || q('dc-ate').value !== ag.ate)) { q('dc-de').value = ag.de; q('dc-ate').value = ag.ate; carregarFluxo(); }
      else comparar();
      return;
    }
    formato = 'colunas';
    linhasCsv = lerCsv(txt); iCab = cabecalho(linhasCsv);
    const cab = linhasCsv[iCab] || [];
    chaveMapa = 'dda-colunas:' + cab.join('|').toLowerCase();
    let salvo = null; try { salvo = JSON.parse(localStorage.getItem(chaveMapa) || 'null'); } catch (e) { /* sem storage */ }
    // 18/10/2026: a escolha guardada so vale se as colunas tem cara de CNPJ, data e valor
    mapa = salvo && mapaBom(salvo) ? salvo : adivinhar(cab);
    q('dc-nome').textContent = nome + ' · ' + Math.max(0, linhasCsv.length - iCab - 1) + ' linha(s)';
    desenharMapa(!mapaBom(mapa));
    lerBanco();
  }
  // as colunas escolhidas tem cara de CNPJ / data / valor nas primeiras linhas?
  function mapaBom(m) {
    if (PAPEIS.some(p => !p.opc && m[p.k] === undefined)) return false;
    const am = linhasCsv.slice(iCab + 1, iCab + 21).filter(l => l.length > 2);
    if (!am.length) return true;
    const ok = f => am.filter(f).length >= am.length * 0.6;
    return ok(l => [11, 14].includes(soDig(l[m.cnpj]).length)) && ok(l => !!dataIso(l[m.venc])) && ok(l => Number.isFinite(valorNum(l[m.valor])));
  }
  // 18/10/2026: a faixa das colunas so aparece quando o sistema NAO acertou sozinho (ou no "⚙ colunas")
  function desenharMapa(abrir) {
    const cab = linhasCsv[iCab] || [];
    const falta = !mapaBom(mapa);
    const op = sel => '<option value="">—</option>' + cab.map((c, i) => '<option value="' + i + '"' + (sel === i ? ' selected' : '') + '>' + esc(c || 'coluna ' + (i + 1)) + '</option>').join('');
    q('dc-map').innerHTML = '<div style="flex-basis:100%;color:#92400e;font-size:12px">' + (falta
        ? '<b>Não consegui saber sozinho quais colunas do arquivo são o CNPJ, o beneficiário, o vencimento e o valor.</b> Escolha abaixo (cada banco monta o arquivo de um jeito); a escolha fica guardada para os próximos arquivos desse banco.'
        : 'Cada banco monta o arquivo numa ordem. Aqui está <b>qual coluna do arquivo</b> é cada coisa. Só mexa se a comparação sair estranha (ex.: CNPJ mostrando valor).') + '</div>'
      + PAPEIS.map(p => '<label>' + p.rot + '<select data-k="' + p.k + '">' + op(mapa[p.k]) + '</select></label>').join('')
      + (falta ? '' : '<button type="button" class="dc-chip" id="dc-map-x" style="align-self:center">ok, fechar</button>');
    q('dc-map').hidden = !(abrir || falta);
    q('dc-cols').hidden = !linhasCsv.length;
    const fx = q('dc-map-x'); if (fx) fx.addEventListener('click', () => { q('dc-map').hidden = true; });
    q('dc-map').querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
      if (s.value === '') delete mapa[s.dataset.k]; else mapa[s.dataset.k] = Number(s.value);
      try { localStorage.setItem(chaveMapa, JSON.stringify(mapa)); } catch (e) { /* sem storage */ }
      lerBanco();
    }));
  }
  function lerBanco() {
    if (PAPEIS.some(p => !p.opc && mapa[p.k] === undefined)) { banco = []; comparar(); return; }
    banco = linhasCsv.slice(iCab + 1).map((l, i) => ({
      i, cnpj: soDig(l[mapa.cnpj]), nome: l[mapa.nome] || '', venc: dataIso(l[mapa.venc]), valor: valorNum(l[mapa.valor]),
      doc: mapa.doc !== undefined ? l[mapa.doc] || '' : '',
    })).filter(b => b.venc && Number.isFinite(b.valor) && b.valor > 0);
    comparar();
  }

  // 19/10/2026: a conta do fornecedor de um boleto (para o razao): a do par; senao a de um titulo do fluxo com o nome;
  // senao a do cadastro com o nome. E a nota do documento (para destacar no razao).
  function contaDoBoleto(b) {
    const t = b.par && fluxo.find(x => x.par === b.par);
    let conta = t ? t.codigoConta : (b.forn && b.forn.conta) || '';
    let nome = t ? (t.marca || t.razao || '') : (b.forn ? b.forn.marca || b.forn.razao : '');
    if (!conta && b.chave) { const x = fluxo.find(y => y.codigoConta && temPalavra(y.texto, b.chave)); if (x) { conta = x.codigoConta; nome = x.marca || x.razao || x.nomeConta || ''; } }
    if (!conta && b.chave) { const f = forn.find(y => y.conta && temPalavra(y.razao + ' ' + y.marca, b.chave)); if (f) { conta = f.conta; nome = f.marca || f.razao; } }
    const nf = (numeros(b.doc).sort((x, y) => y.length - x.length)[0] || '');
    return conta ? { conta, nome: nome || b.nome, nf } : null;
  }

  // ---- comparar ----
  // 19/10/2026: o par e escolhido do MAIS CERTO para o menos certo, olhando TODOS os boletos de uma vez:
  //   1o mesmo valor e mesmo dia · 2o mesmo valor ate 5 dias · 3o mesmo dia (valor diferente) · 4o o mais perto.
  //   Antes ia boleto por boleto na ordem do arquivo e o primeiro pegava o titulo de outro (Formetal: o boleto de
  //   442,00 levou o titulo de 440,00, que era do boleto seguinte).
  function comparar() {
    fluxo.forEach(t => { t.st = 'soFluxo'; t.par = ''; t.dif = ''; });
    const cnpjs = new Map(forn.map(f => [f.cnpj, f]));
    const raizes = new Map(forn.filter(f => f.cnpj.length === 14).map(f => [f.cnpj.slice(0, 8), f]));
    const conhecido = chave => !!chave && (fluxo.some(t => temPalavra(t.texto, chave)) || forn.some(f => temPalavra(f.razao + ' ' + f.marca, chave)));
    // titulo cuja nota esta em algum boleto do arquivo: e daquele boleto (nao entra na busca pelo nome)
    fluxo.forEach(t => { t.reservado = banco.some(b => !b.cnpj && t.nfs.some(nf => casaNf(b.doc, nf))); });
    // quem pode ser par de cada boleto
    for (const b of banco) {
      b.par = ''; b.dif = ''; b.st = ''; b.porNf = false; b.chave = ''; b.raiz = null; b.forn = null; b.cand = () => false;
      if (b.cnpj) {
        const f = cnpjs.get(b.cnpj) || null, raiz = !f && b.cnpj.length === 14 ? raizes.get(b.cnpj.slice(0, 8)) : null;
        b.forn = f || raiz; b.raiz = raiz;
        if (!b.forn) { b.st = 'desconhecido'; continue; }
        const alvo = b.forn.cnpj.slice(0, f ? 14 : 8);
        b.cand = t => !!t.cnpj && t.cnpj.slice(0, alvo.length) === alvo;
      } else {                                                 // sem CNPJ (Agenda do BB): pela NOTA, depois pelo NOME
        b.chave = chaveNome(b.nome);
        b.porNf = fluxo.some(t => t.nfs.some(nf => casaNf(b.doc, nf)));
        // 19/10/2026: achou a nota -> SO titulo dessa nota (nunca outra nota do mesmo fornecedor); pelo nome so
        // titulo que nao e de nota de outro boleto do arquivo
        b.cand = b.porNf ? (t => t.nfs.some(nf => casaNf(b.doc, nf)))
          : b.chave ? (t => !t.reservado && temPalavra(t.texto, b.chave)) : (() => false);
      }
    }
    const mesmoV = (t, b) => cent(t.valor) === cent(b.valor), dd = (t, b) => Math.abs(diasEntre(t.venc, b.venc));
    const PASSOS = [['ok', (t, b) => mesmoV(t, b) && dd(t, b) === 0], ['venc', (t, b) => mesmoV(t, b) && dd(t, b) <= 5],
                    ['valor', (t, b) => dd(t, b) === 0], ['ambos', (t, b) => dd(t, b) <= (b.porNf ? 40 : 5)]];
    let n = 0;
    for (const [st0, serve] of PASSOS) for (const b of banco) {
      if (b.st) continue;
      const t = fluxo.filter(x => x.st === 'soFluxo' && b.cand(x) && serve(x, b)).sort((x, y) => dd(x, b) - dd(y, b))[0];
      if (!t) continue;
      let st = st0;
      const outro = !b.cnpj && b.porNf && b.chave && !temPalavra(t.texto, b.chave);
      if (outro && st === 'ok') st = 'outroBenef';
      if (b.raiz && st === 'ok') st = 'filial';
      n++; b.par = t.par = String(n); b.st = t.st = st;
      const d = [];
      if (cent(t.valor) !== cent(b.valor)) d.push('fluxo R$ ' + brl(t.valor) + ' × banco R$ ' + brl(b.valor));
      if (t.venc !== b.venc) d.push('venc. fluxo ' + br(t.venc) + ' × banco ' + br(b.venc));
      if (outro) d.push('quem cobra no banco: ' + b.nome);
      if (b.raiz) d.push('CNPJ do banco ' + cnpjFmt(b.cnpj) + ' (cadastro ' + cnpjFmt(b.raiz.cnpj) + ')');
      b.dif = t.dif = d.join(' · ');
    }
    for (const b of banco) if (!b.st) b.st = b.cnpj ? 'soBanco' : (conhecido(b.chave) ? 'soBanco' : 'desconhecido');
    desenhar();
  }
  function desenhar() {
    const cont = k => k === 'soFluxo' ? fluxo.filter(t => t.st === 'soFluxo').length : banco.filter(b => b.st === k).length;
    q('dc-res').innerHTML = !temArq ? '<span style="color:#6b7280">Importe o arquivo do banco para comparar.</span>'
      : Object.keys(ST).filter(k => cont(k)).map(k => '<span class="dc-chip dc-st s-' + k + (filtro === k ? ' on' : '') + '" data-f="' + k + '">' + ST[k] + ': ' + cont(k) + '</span>').join('')
        + (filtro ? ' <span class="dc-chip" data-f="' + filtro + '">mostrar todos</span>' : '');
    const passa = x => !filtro || x.st === filtro || (filtro !== 'soFluxo' && x.par && banco.some(b => b.par === x.par && b.st === filtro));
    const soForn = q('dc-forn').checked;                        // 19/10/2026: esconde "so no fluxo" que nao e fornecedor
    const bus = limpo(q('dc-busca').value.trim());               // 19/10/2026: procura nos dois lados (e mostra o par)
    const achaT = t => !bus || limpo([t.marca, t.razao, t.historico, t.codigoConta].join(' ')).includes(bus);
    const achaB = b => !bus || limpo([b.nome, b.doc, b.forn ? b.forn.marca + ' ' + b.forn.razao : ''].join(' ')).includes(bus);
    const parT = t => !bus || achaT(t) || (t.par && banco.some(b => b.par === t.par && achaB(b)));
    const parB = b => !bus || achaB(b) || (b.par && fluxo.some(t => t.par === b.par && achaT(t)));
    const fv = fluxo.filter(t => passa(t) && parT(t) && !(soForn && !bus && t.st === 'soFluxo' && !/^2\.01\.001\./.test(t.codigoConta || ''))),
          bv = banco.filter(b => (!filtro || b.st === filtro) && parB(b));
    const tot = l => 'R$ ' + brl(l.reduce((s, x) => s + cent(x.valor), 0) / 100);
    q('dc-t1').textContent = '· ' + fluxo.length + ' título(s) · ' + tot(fluxo);
    q('dc-t2').textContent = banco.length ? '· ' + banco.length + ' título(s) · ' + tot(banco) : '';
    const stt = x => temArq || x.st !== 'soFluxo' ? '<span class="dc-st s-' + x.st + '">' + ST[x.st] + '</span>' : '';
    // ordem (clique no titulo): Fornecedor, Venc., Valor — vale para os dois lados
    const nomeF = t => (t.marca || t.razao || '').toLowerCase(), nomeB = b => (b.forn ? b.forn.marca || b.forn.razao : b.nome || '').toLowerCase();
    const cmp = (a, b, f) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * (ordem.asc ? 1 : -1); };
    const chave = lado => ordem.k === 'forn' ? (lado === 'f' ? nomeF : nomeB) : ordem.k === 'valor' ? (x => cent(x.valor)) : (x => x.venc);
    fv.sort((a, b) => cmp(a, b, chave('f')) || cmp(a, b, x => x.venc)); bv.sort((a, b) => cmp(a, b, chave('b')) || cmp(a, b, x => x.venc));
    const seta = k => ordem.k === k ? (ordem.asc ? ' ▲' : ' ▼') : ' ⇅';
    const cab = nome => '<thead><tr><th style="width:34px">#</th><th data-ord="forn" class="ord">' + nome + seta('forn') + '</th><th data-ord="venc" class="ord">Venc.' + seta('venc')
      + '</th><th data-ord="valor" class="ord n">Valor' + seta('valor') + '</th><th></th></tr></thead>';
    q('dc-esq').innerHTML = fv.length ? '<table class="dc-tab">' + cab('Fornecedor · histórico') + '<tbody>'
      + fv.map((t, k) => '<tr data-par="' + t.par + '"><td class="cn">' + (k + 1) + '</td><td>' + esc(t.marca || t.razao) + ' <span class="cn">' + esc(cnpjFmt(t.cnpj) || 'sem CNPJ no cadastro') + '</span><br><span class="cn">'
        + esc(t.historico) + (t.parcela ? ' · ' + t.parcela + '/' + t.totalParcelas : '') + ' · ' + ({ 0: 'avulso', 3: 'pedido feito', 7: 'compra projetada', 8: 'orçamento' }[t.pos] || 'a pagar') + '</span>'
        + (t.dif ? '<br><span class="dc-dif">' + esc(t.dif) + '</span>' : '')
        + (() => { const b = t.par && banco.find(x => x.par === t.par);
            // 19/10/2026: so oferece ajustar quando o VALOR E IGUAL (par seguro); com valor diferente pode nao ser este titulo
            if (b && b.venc !== t.venc && cent(b.valor) === cent(t.valor)) return '<br><button type="button" class="dc-aj" data-aj="' + esc(t._id) + '" data-venc="' + b.venc + '">✎ ajustar o vencimento do fluxo</button>';
            if (b && cent(b.valor) !== cent(t.valor)) return '<br><span class="dc-dif" style="color:#991b1b">valor diferente: pode não ser este título — confira (sem ajuste automático)</span>';
            return ''; })()
        + (() => { const a = (t.ajustes || []).filter(x => x.campo === 'vencimento').slice(-1)[0];       // 19/10/2026: desfazer
            return a && a.de && !/desfeito/i.test(a.motivo || '') ? '<br><button type="button" class="dc-aj" data-aj="' + esc(t._id) + '" data-venc="' + String(a.de).slice(0, 10) + '" data-desfaz="1">↶ desfazer o ajuste: voltar para ' + br(String(a.de).slice(0, 10)) + '</button>' : ''; })()
        + (t.codigoConta ? ' <button type="button" class="dc-aj" data-raz="' + esc(t.codigoConta) + '" data-nome="' + esc(t.marca || t.razao || t.nomeConta || '') + '" title="razão da conta e títulos em aberto">📒 razão</button>' : '')
        + '</td><td>' + br(t.venc) + '</td><td class="n">' + brl(t.valor) + '</td><td>' + stt(t) + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="dc-vz">' + (fluxo.length ? 'Nada com esse filtro' + (q('dc-busca').value ? ' e a busca "' + esc(q('dc-busca').value) + '"' : '') + '. <button type="button" class="dc-chip" data-limpa>mostrar todos</button>' : 'Nenhum título de fornecedor no fluxo nesse período.') + '</div>';
    q('dc-dir').innerHTML = bv.length ? '<table class="dc-tab">' + cab('Beneficiário') + '<tbody>'
      + bv.map((b, k) => '<tr data-par="' + b.par + '" class="l-' + b.st + '"><td class="cn">' + (k + 1) + '</td><td>' + esc(b.nome) + ' <span class="cn">' + esc(cnpjFmt(b.cnpj)) + '</span>'
        + (b.forn ? '<br><span class="cn">cadastro: ' + esc(b.forn.marca || b.forn.razao) + '</span>' : '')
        + (b.doc ? '<br><span class="cn">nº ' + esc(b.doc) + '</span>' : '')
        + (b.st === 'desconhecido' ? '<br><b style="color:#991b1b;font-size:12px">' + (b.cnpj ? 'NÃO é fornecedor cadastrado' : 'nem a nota nem o nome batem com o fluxo ou o cadastro') + ': confira antes de pagar</b>' : '')
        + (b.dif ? '<br><span class="dc-dif">' + esc(b.dif) + '</span>' : '')
        + (() => { const c = contaDoBoleto(b);                 // 19/10/2026: razao do fornecedor do boleto (ja foi pago?)
            return c ? '<br><button type="button" class="dc-aj" data-raz="' + esc(c.conta) + '" data-nome="' + esc(c.nome) + '" data-nf="' + esc(c.nf) + '" data-valor="' + b.valor + '" title="razão e títulos em aberto: veja se esta nota já foi paga">📒 razão ' + esc(c.conta) + (c.nf ? ' · procura NF ' + esc(c.nf) : '') + '</button>' : ''; })()
        + '</td><td>' + br(b.venc) + '</td><td class="n">' + brl(b.valor) + '</td><td>' + stt(b) + '</td></tr>').join('') + '</tbody></table>'
      : '<div class="dc-vz">' + (temArq ? (formato === 'colunas' && !mapaBom(mapa) ? 'Escolha acima as colunas do arquivo.' : 'Nada com esse filtro' + (q('dc-busca').value ? ' e a busca "' + esc(q('dc-busca').value) + '"' : '') + '. <button type="button" class="dc-chip" data-limpa>mostrar todos</button>') : 'Importe o arquivo do DDA (no BB: Agenda de boletos DDA → salvar CSV).') + '</div>';
  }

  window.DdaConfere = { abrir };
})();
