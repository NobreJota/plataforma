// =============================================================================
// Destino: C:\plataformaRota\public\js\vendas\os-modal.js
// Criado em: 13/10/2026
//
// MODAL DA ORDEM DE SERVICO, usado pela Agenda do dia (servicos.js) e pelas listas
// (servicos-lista.js). Monta o proprio HTML e CSS na primeira vez que abre.
//   OSModal.abrir(idDaOS, aoMudar)   aoMudar() e chamado quando algo foi gravado
//
// No modal:
//   - dados da OS (cliente, tecnico, dia/horario, local, telefones, o que instalar)
//   - CONSIGNADOS: buscar produto + qtd -> "levar" (baixa o estoque); "devolver" repoe
//   - TERMINO (dia e hora), VALOR FINAL do servico, observacao do servico
//   - FOTOS do servico acabado (reduzidas no navegador para 1600 px, JPEG)
//   - Gravar · Concluir servico (P -> E) · Reabrir (E -> P)
// API: /vendas/api/os   Busca de produto: /vendas/api/venda/produtos?busca=
// Dinheiro em centavos.
// Alterado em: 14/10/2026 - AGENDAMENTO na OS: tecnico (combo), dia, das/ate e a agenda do
//              tecnico ao lado (como na venda); horario passado nao vale. Botao "Agendar" ->
//              PUT /:id/agenda. Termino so depois de agendada, nunca no futuro.
//              Agenda com cabecalho (tecnico · dia) e legenda: vermelho = ocupado com OUTRO cliente.
//              Agenda na LATERAL DIREITA do modal, como na nota fiscal (padrao).
//              Consignado: combo de fornecedor, lista de produtos no lugar (nao cobre a lista do
//              consignado) e LEITOR DE CODIGO DE BARRAS: bipou (EAN) -> leva 1 direto.
// Alterado em: 14/10/2026 - FORNECEDORES DO CONSIGNADO: o combo mostra so os fornecedores
//              marcados pela loja (os que tem produto de instalacao). "✎ escolher" abre a
//              lista com caixinhas para marcar/desmarcar. Nada marcado = mostra todos.
//              (sem a opcao "outro fornecedor": desmarcado NAO aparece; a busca por texto ou
//              codigo de barras continua achando produto de qualquer fornecedor)
// Alterado em: 14/10/2026 - Lista do consignado: colunas de numero estreitas e fixas, a
//              DESCRICAO fica com o resto; Saiu/Voltou/Usado viram "Saiu/Volt./Usado"
// Alterado em: 15/10/2026 - FECHAR com alteracao nao gravada (agendamento, termino, valor ou
//              observacao): pergunta "Gravar e fechar / Sair sem gravar / Continuar editando".
//              Sem alteracao, so fecha. Esc faz o mesmo que o Fechar.
// Alterado em: 15/10/2026 - valor cobrado na venda: a mao de obra entra na receita de servicos
//              (4.05.001.001) e a parte do tecnico sai na ficha de fechamento (a partilha antiga aparece)
// Alterado em: 15/10/2026 - termino: nao aceita antes do dia previsto; reagendar para outro dia
//              apaga o termino (o servidor tambem)
// Alterado em: 15/10/2026 - TERMINO E VALOR FINAL sairam do modal: vao para a FICHA DE FECHAMENTO
//              (/vendas/servicos/fechamento/:id). "Concluir serviço" abre a ficha; OS concluida ou
//              liquidada mostra "Ver fechamento" (la tem o Reabrir). O modal so edita OS pendente.
// Alterado em: 15/10/2026 - cabecalho mostra "programada para dd/mm/aa hh:mm–hh:mm" (o que esta
//              gravado). O botao roxo "Agendar" virou "Limpar dia e horário" (limpa a grade e os
//              campos); o agendamento grava no GRAVAR (ou ao fechar/concluir). Lista do consignado
//              so com o que ainda esta com o tecnico (devolvido todo sai da lista).
//              Volta da ficha de fechamento sem gravar: a URL traz ?os=<id> e o modal reabre.
// Alterado em: 15/10/2026 - CONSIGNADO: CLIQUE no produto da lista ja LEVA (a quantidade do campo
//              ao lado); a lista continua aberta para levar outros. Antes o clique so escolhia e
//              faltava o "+ levar" (produto escolhido e nao levado se perdia ao fechar).
// Alterado em: 15/10/2026 - nao leva duas vezes no mesmo clique (trava enquanto grava); o mesmo
//              produto de novo SOMA na linha que ja esta com o tecnico (servidor). Rodape: "Consignado
//              usado" em roxo e a caixa roxa mostra so o valor do SERVICO.
// Alterado em: 15/10/2026 - "Serviço" virou a ultima linha da tabela do consignado (valores alinhados).
//              Botao RAZAO: a conta do cliente (ultimos 12 meses) numa janela, para ver se a venda
//              ja foi recebida (o tecnico pode levar a maquina de cartao). API do razao:
//              GET /financeiro/api/razao/lancamentos?conta=&de=&ate=
// Alterado em: 16/10/2026 - DEVOLVER limitado ao que esta com o tecnico (aviso: levar mais e no "+ levar")
// Alterado em: 16/10/2026 - USADO editavel na linha (OS pendente): digita a quantidade certa e Enter
//              (ou sai do campo); o estoque acompanha. PUT /:id/consignados/:cid { usado }
// Alterado em: 26/10/2026 - VALOR COMBINADO (OS sem venda, pendente): Valor da mao de obra combinado com o cliente ·
//              Parte da empresa · Parte do tecnico (o resto). Grava no Gravar (PUT /:id { combinado }). A ficha de
//              fechamento ja vem com ele; la pode acrescentar (mao de obra adicional).
// Alterado em: 26/10/2026 - SAIR DA PAGINA (← Voltar, ☰ Menu, recarregar, fechar a aba) com o modal aberto e
//              agendamento/observacao nao gravados: o navegador pergunta antes de sair (antes saia calado).
// Alterado em: 26/10/2026 - apagou o texto da busca do consignado: a lista de produtos FECHA (mesmo com fornecedor
//              escolhido). Trocar o fornecedor no combo continua abrindo a lista dele.
// Alterado em: 26/10/2026 - LEVAR / DEVOLVER / USADO nao perdem mais o que foi digitado e ainda nao gravado
//              (tecnico, dia, das/ate, observacao do servico): o redesenho depois do consignado guarda esses
//              campos e poe de volta. Gravam no Gravar, como antes (fechar sem gravar ainda pergunta).
// Alterado em: 17/10/2026 - OS concluida/liquidada: "Ver fechamento" virou "Ver espelho" e sai o
//              botao "Fechar" (fecha pelo X).
//              PUT /vendas/api/venda/fornecedores/consignado
// Alterado em: 18/10/2026 - "✎ mudar local" (OS pendente): enderecos do cliente, ou + outro endereco (CEP
//              ou digitar); grava na hora (PUT /:id { local }) e pode guardar no cadastro do cliente.
//              (/js/comum/endereco-instalacao.js, carregado quando precisa)
// =============================================================================

(function () {
  'use strict';

  const API = '/vendas/api/os/';
  const BUSCA = '/vendas/api/venda/produtos?busca=';
  const SIT = { P: 'Pendente', E: 'Concluída · a receber', L: 'Liquidada', C: 'Cancelada' };
  const TIPO = { VI: 'Venda/instalação', INSTALACAO: 'Venda/instalação', C: 'Conserto', G: 'Garantia' };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lerBrl = t => { const s = String(t || '').trim().replace(/\./g, '').replace(',', '.'); const n = Number(s); return s && Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const dataBr = d => d ? String(d).slice(8, 10) + '/' + String(d).slice(5, 7) + '/' + String(d).slice(0, 4) : '';
  const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const hora = d => { const x = new Date(d); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };

  let os = null, aoMudar = null, montado = false, buscaT = null, achados = [];
  let tecnicos = null, agOcupados = [], fornecedores = null;
  const FORN = '/vendas/api/venda/fornecedores';
  const TECNICOS = '/vendas/api/venda/tecnicos', AGENDA = '/vendas/api/venda/agenda';
  const paraMin = s => { const m = /^(\d{2}):(\d{2})$/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; };
  const hm = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  const hojeIso = () => iso(new Date());
  const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const q = id => document.getElementById('osm-' + id);

  async function api(metodo, url, corpo, tipo) {
    const op = { method: metodo, headers: { Accept: 'application/json' } };
    if (corpo !== undefined) {
      op.headers['Content-Type'] = tipo || 'application/json';
      op.body = tipo ? corpo : JSON.stringify(corpo);
    }
    const r = await fetch(url, op);
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('resposta inválida do servidor (' + r.status + ')'); }
    if (!j.ok) throw new Error(j.erro || 'erro ' + r.status);
    return j;
  }

  function montar() {
    if (montado) return;
    montado = true;
    const css = document.createElement('style');
    css.textContent = `
      .osm-fundo { position:fixed; inset:0; background:rgba(15,23,42,.35); z-index:60; }
      .osm-caixa { position:fixed; top:3vh; left:50%; transform:translateX(-50%); z-index:61; width:min(1440px, calc(100vw - 24px));
                   max-height:94vh; display:flex; flex-direction:column; background:#fff; border-radius:12px;
                   box-shadow:0 18px 50px rgba(0,0,0,.3); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
                   font-size:14px; color:#111827; }
      .osm-fundo[hidden], .osm-caixa[hidden], .osm-caixa [hidden] { display:none !important; }
      .osm-cab { display:flex; align-items:center; gap:12px; padding:12px 20px; background:#92400e; color:#fff; border-radius:12px 12px 0 0; }
      .osm-cab h3 { margin:0; font-size:18px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .osm-prog { font-size:13px; font-weight:800; padding:4px 12px; border-radius:12px; background:#fde68a; color:#78350f; white-space:nowrap; }
      .osm-prog.nao { background:#fee2e2; color:#991b1b; }
      .osm-sit { font-size:12px; font-weight:700; padding:3px 10px; border-radius:12px; background:#fef3c7; color:#92400e; }
      .osm-sit.E { background:#d1fae5; color:#065f46; } .osm-sit.L { background:#e0e7ff; color:#3730a3; } .osm-sit.C { background:#fee2e2; color:#991b1b; }
      .osm-x { border:0; background:none; color:#fff; font-size:24px; cursor:pointer; line-height:1; }
      .osm-corpo { overflow:auto; padding:14px 20px; display:grid; grid-template-columns:minmax(0, 5fr) minmax(0, 6fr) 260px; gap:18px; align-items:start; }
      .osm-agenda { position:sticky; top:0; }
      .osm-sec { font-size:12px; font-weight:800; text-transform:uppercase; color:#6b21a8; margin:4px 0 6px; }
      .osm-comb { margin:0 0 10px; }
      .osm-comb-g { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
      .osm-comb-g label { display:flex; flex-direction:column; gap:3px; font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; }
      .osm-comb-g input { height:34px; border:1px solid #d1d5db; border-radius:7px; padding:0 9px; font-size:15px; text-align:right; font-weight:700; background:#fffbeb; }
      .osm-comb-g input[readonly] { background:#f3f4f6; color:#065f46; }
      .osm-det { display:grid; grid-template-columns:100px minmax(0,1fr); gap:4px 10px; margin-bottom:10px; }
      .osm-det span { font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; padding-top:2px; }
      .osm-det ul { margin:0; padding-left:18px; }
      .osm-linha { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:10px; }
      .osm-caixa label { display:flex; flex-direction:column; gap:3px; font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; }
      .osm-caixa input, .osm-caixa textarea { font:inherit; font-size:14px; padding:7px 9px; border:1px solid #d1d5db; border-radius:8px;
                   background:#fff; text-transform:none; font-weight:400; color:#111827; }
      .osm-caixa input:placeholder-shown, .osm-caixa textarea:placeholder-shown { background:#fffbeb; }
      .osm-caixa input:disabled, .osm-caixa textarea:disabled { background:#f3f4f6; color:#374151; }
      .osm-caixa textarea { resize:vertical; min-height:52px; }
      .osm-linha input, .osm-caixa textarea, .osm-busca input { width:100%; min-width:0; }
      .osm-num { text-align:right; }
      .osm-busca { display:grid; grid-template-columns:minmax(0,1fr) 80px auto; gap:8px; margin-bottom:8px; }
      .osm-forn { margin-bottom:8px; display:flex; flex-direction:column; gap:3px; }
      .osm-forn-cab { display:flex; align-items:center; justify-content:space-between; font-size:11px; font-weight:700;
                      text-transform:uppercase; color:#374151; }
      .osm-forn-cab button { border:0; background:none; color:#6b21a8; font-weight:700; font-size:12px; cursor:pointer;
                             text-transform:none; padding:0; }
      .osm-forn-cab button:hover { text-decoration:underline; }
      .osm-fsel { border:1px solid #c4b5fd; background:#faf5ff; border-radius:8px; padding:10px; margin-bottom:10px; }
      .osm-fsel .tit { font-size:13px; font-weight:700; color:#4c1d95; margin-bottom:6px; }
      .osm-fsel .grade { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:2px 10px;
                         max-height:260px; overflow:auto; background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:6px; }
      .osm-caixa .osm-fsel .grade label { flex-direction:row; align-items:center; gap:6px; font-size:13px; font-weight:400;
                         text-transform:none; color:#111827; cursor:pointer; padding:3px 4px; border-radius:4px; }
      .osm-fsel .grade label:hover { background:#ede9fe; }
      .osm-fsel .grade label.on { font-weight:700; }
      .osm-fsel .botoes { display:flex; gap:8px; align-items:center; margin-top:8px; }
      .osm-fsel .botoes .cont { margin-right:auto; font-size:12px; color:#6b7280; }
      .osm-forn select { font:inherit; font-size:14px; padding:7px 9px; border:1px solid #d1d5db; border-radius:8px; background:#fff;
                         text-transform:none; font-weight:400; color:#111827; }
      /* 14/10/2026: a lista de produtos abre NO LUGAR (nao cobre a lista do consignado) */
      .osm-res { background:#fff; border:1px solid #d1d5db; border-radius:8px; max-height:240px; overflow:auto; margin-bottom:10px; }
      .osm-res div.cab { background:#f3f4f6; font-size:11px; font-weight:700; text-transform:uppercase; color:#374151; cursor:default;
                         position:sticky; top:0; }
      .osm-sub { font-size:12px; font-weight:800; color:#374151; margin:4px 0; }
      .osm-res div { display:grid; grid-template-columns:60px minmax(0,1fr) 60px 90px; gap:8px; padding:6px 10px; cursor:pointer; }
      .osm-res div:nth-child(even) { background:#f9fafb; }
      .osm-res div.sel, .osm-res div:hover { background:#ede9fe; }
      .osm-res .n { text-align:right; font-variant-numeric:tabular-nums; }
      .osm-tab { width:100%; border-collapse:collapse; font-size:13px; table-layout:fixed; }
      .osm-tab th { text-align:left; font-size:11px; text-transform:uppercase; color:#374151; background:#f3f4f6; padding:6px 5px;
                    white-space:nowrap; overflow:hidden; }
      .osm-tab td { padding:6px 5px; border-top:1px solid #f3f4f6; vertical-align:middle; overflow:hidden; }
      .osm-tab td.d { overflow-wrap:anywhere; }
      .osm-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .osm-tab tfoot td { font-weight:800; border-top:2px solid #e5e7eb; background:#f5f3ff; color:#4c1d95; }
      .osm-tab tfoot tr.serv td { font-size:15px; border-top:6px solid #fff; }
      .osm-raz { position:absolute; inset:0; background:rgba(15,23,42,.35); display:flex; align-items:center; justify-content:center; z-index:5; border-radius:inherit; }
      .osm-raz[hidden] { display:none; }
      .osm-raz > div { background:#fff; border-radius:12px; padding:16px 18px; width:min(900px, 94%); max-height:80%; display:flex; flex-direction:column;
                       box-shadow:0 20px 50px rgba(0,0,0,.3); }
      .osm-raz h4 { margin:0 0 4px; font-size:17px; color:#1d4ed8; }
      .osm-raz .sub { font-size:13px; color:#6b7280; margin-bottom:8px; }
      .osm-raz .lista { overflow:auto; flex:1; border:1px solid #e5e7eb; border-radius:8px; }
      .osm-raz table { width:100%; border-collapse:collapse; font-size:13px; }
      .osm-raz th { position:sticky; top:0; background:#f3f4f6; text-align:left; font-size:11px; text-transform:uppercase; padding:6px 8px; }
      .osm-raz td { padding:5px 8px; border-top:1px solid #f3f4f6; }
      .osm-raz .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .osm-raz .deb { color:#1d4ed8; } .osm-raz .cre { color:#b91c1c; }
      .osm-raz .saldo { margin-top:10px; font-size:16px; font-weight:800; display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .osm-raz .ok { color:#059669; } .osm-raz .deve { color:#b91c1c; }
      .osm-dev { display:flex; gap:4px; justify-content:flex-end; }
      .osm-dev input { width:40px; padding:3px 4px; text-align:right; }
      .osm-usado { width:46px; padding:3px 4px; text-align:right; font-weight:800; border:1px solid #c4b5fd; border-radius:6px; background:#faf5ff; }
      .osm-endx { border:1px solid #c4b5fd; background:#fdfcff; border-radius:10px; padding:10px 12px; margin:0 0 10px; }
      .osm-endx[hidden] { display:none; }
      .osm-endx-cab { font-weight:800; color:#6b21a8; font-size:13px; margin-bottom:6px; }
      .osm-endx-bt { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }
      .osm-mudar { border:1px solid #c4b5fd; background:#faf5ff; color:#6b21a8; border-radius:6px; padding:0 8px; font-size:12px; font-weight:700; cursor:pointer; margin-left:6px; }
      .osm-btn { border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:7px 12px; font-weight:700; cursor:pointer; font-size:13px; }
      .osm-btn.mini { padding:3px 8px; font-size:12px; }
      .osm-btn.roxo { background:#6b21a8; border-color:#6b21a8; color:#fff; }
      .osm-btn.verde { background:#059669; border-color:#059669; color:#fff; }
      .osm-btn:disabled { opacity:.5; cursor:not-allowed; }
      .osm-fotos { display:flex; flex-wrap:wrap; gap:8px; }
      .osm-foto { position:relative; width:110px; height:82px; border-radius:8px; overflow:hidden; border:1px solid #e5e7eb; background:#f3f4f6; }
      .osm-foto img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
      .osm-foto button { position:absolute; top:2px; right:2px; border:0; border-radius:50%; width:22px; height:22px; background:rgba(0,0,0,.6);
                         color:#fff; cursor:pointer; font-size:14px; line-height:1; }
      .osm-add { width:110px; height:82px; border:2px dashed #c4b5fd; border-radius:8px; display:flex; align-items:center; justify-content:center;
                 color:#6b21a8; font-weight:700; cursor:pointer; text-align:center; font-size:13px; }
      .osm-vazio { color:#6b7280; font-size:13px; padding:6px 0; }
      .osm-sair { position:absolute; inset:0; background:rgba(15,23,42,.35); display:flex; align-items:center;
                  justify-content:center; z-index:5; border-radius:inherit; }
      .osm-sair[hidden] { display:none; }
      .osm-sair > div { background:#fff; border-radius:12px; padding:20px 22px; width:min(440px, 92%);
                        box-shadow:0 20px 50px rgba(0,0,0,.3); }
      .osm-sair h4 { margin:0 0 6px; font-size:17px; color:#92400e; }
      .osm-sair p { margin:0 0 16px; font-size:14px; color:#374151; }
      .osm-sair .bts { display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap; }
      .osm-rod { display:flex; align-items:center; gap:10px; padding:12px 20px; border-top:1px solid #e5e7eb; }
      .osm-rod .msg { flex:1; font-size:13px; font-weight:600; color:#dc2626; }
      .osm-rod .msg.ok { color:#059669; }
      .osm-total { display:flex; justify-content:space-between; font-weight:800; font-size:15px; padding:8px 10px; background:#f5f3ff;
                   border-radius:8px; margin-top:8px; color:#4c1d95; }
      .osm-ag { margin-bottom:12px; }
      .osm-linha2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .osm-ag-form input { width:100%; min-width:0; }
      .osm-ag-form { display:flex; flex-direction:column; gap:8px; }
      .osm-ag-form select { font:inherit; font-size:14px; padding:7px 9px; border:1px solid #d1d5db; border-radius:8px; background:#fff; width:100%; }
      .osm-ag-lista { border:1px solid #e5e7eb; border-radius:8px; max-height:calc(94vh - 160px); overflow-y:auto; font-size:13px; }
      .osm-ag-lista .vz { padding:10px; color:#6b7280; }
      .osm-ag-cab { position:sticky; top:0; z-index:1; background:#92400e; color:#fff; font-weight:700; padding:5px 8px; font-size:12px; }
      .osm-ag-cab small { display:block; font-weight:400; font-size:11px; color:#fde68a; }
      .osm-ag-cab b.oc { color:#fca5a5; } .osm-ag-cab b.es { color:#86efac; }
      .osm-ag-lin { display:grid; grid-template-columns:52px minmax(0,1fr); border-top:1px solid #f3f4f6; }
      .osm-ag-lin span { padding:4px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .osm-ag-lin .h { font-weight:700; background:#f8fafc; overflow:visible; text-overflow:clip; }
      .osm-ag-lin.livre { cursor:pointer; } .osm-ag-lin.livre:hover { background:#fef3c7; }
      .osm-ag-lin.ocupado { background:#fef2f2; color:#dc2626; cursor:not-allowed; }
      .osm-ag-lin.passado { color:#9ca3af; cursor:not-allowed; }
      .osm-ag-lin.escolhido { background:#dcfce7; color:#065f46; font-weight:700; }
      .osm-dica { font-size:11px; color:#6b7280; }
      @media (max-width: 1100px) { .osm-corpo { grid-template-columns:minmax(0,1fr) 240px; } .osm-corpo > div:nth-child(2) { grid-column:1; } .osm-agenda { grid-row:1 / span 2; grid-column:2; } }
      @media (max-width: 760px) { .osm-corpo { grid-template-columns:1fr; } .osm-agenda { grid-row:auto; grid-column:auto; } }
    `;
    document.head.appendChild(css);

    const d = document.createElement('div');
    d.innerHTML = `
      <div class="osm-fundo" id="osm-fundo" hidden></div>
      <div class="osm-caixa" id="osm-caixa" hidden role="dialog">
        <div class="osm-cab"><h3 id="osm-tit">OS</h3><span class="osm-prog" id="osm-prog"></span><span class="osm-sit" id="osm-sit"></span>
          <button type="button" class="osm-x" id="osm-x" title="fechar (Esc)">×</button></div>
        <div class="osm-corpo">
          <div>
            <div class="osm-sec">Agendamento</div>
            <div class="osm-ag">
              <div class="osm-ag-form">
                <label>Técnico<select id="osm-tec"></select></label>
                <label>Dia<input type="date" id="osm-adia"></label>
                <div class="osm-linha2">
                  <label>Das<input type="time" id="osm-ahi"></label>
                  <label>Até<input type="time" id="osm-ahf"></label>
                </div>
                <button type="button" class="osm-btn" id="osm-agendar" title="tira o dia e o horário (grava no Gravar)">Limpar dia e horário</button>
                <div class="osm-dica">Marque na agenda do técnico, à direita · 1º clique: início · 2º clique: até o fim dessa linha. Grava no <b>Gravar</b>.</div>
              </div>
            </div>
            <div class="osm-sec">Serviço</div>
            <div class="osm-det" id="osm-det"></div>
            <div class="osm-endx" id="osm-endx" hidden>
              <div class="osm-endx-cab">Mudar o local da instalação</div>
              <div id="osm-endf"></div>
              <div class="osm-endx-bt"><button type="button" class="osm-btn" id="osm-end-canc">Cancelar</button>
                <button type="button" class="osm-btn roxo" id="osm-end-ok">Usar este endereço</button></div>
            </div>
            <div class="osm-comb" id="osm-comb" hidden>
              <div class="osm-sec">Valor combinado com o cliente</div>
              <div class="osm-comb-g">
                <label>Mão de obra (R$)<input id="osm-cval" inputmode="decimal" autocomplete="off" placeholder="0,00"></label>
                <label>Parte da empresa (R$)<input id="osm-cemp" inputmode="decimal" autocomplete="off" placeholder="0,00"></label>
                <label>Parte do técnico<input id="osm-ctec" readonly tabindex="-1"></label>
              </div>
              <div class="osm-dica" id="osm-cdica">O que foi combinado antes do técnico ir. Na ficha de fechamento pode acrescentar. Grava no <b>Gravar</b>.</div>
            </div>
            <label>Observação do serviço<textarea id="osm-obs" placeholder=" " maxlength="2000"></textarea></label>
          </div>
          <div>
            <div class="osm-sec">Consignados (o técnico leva)</div>
            <div id="osm-busca-l">
              <div class="osm-forn">
                <div class="osm-forn-cab"><span>Fornecedor</span>
                  <button type="button" id="osm-fedit" title="escolher os fornecedores que aparecem aqui (os que têm produto de instalação)">✎ escolher fornecedores</button></div>
                <select id="osm-forn"><option value="">todos os fornecedores</option></select>
              </div>
              <div class="osm-fsel" id="osm-fsel" hidden>
                <div class="tit">Marque os fornecedores que têm produto de instalação — só eles aparecem no combo</div>
                <div class="grade" id="osm-fgrade"></div>
                <div class="botoes">
                  <span class="cont" id="osm-fcont"></span>
                  <button type="button" class="osm-btn mini" id="osm-fnenhum">desmarcar todos</button>
                  <button type="button" class="osm-btn" id="osm-fcancela">Cancelar</button>
                  <button type="button" class="osm-btn roxo" id="osm-fgrava">Gravar</button>
                </div>
              </div>
              <div class="osm-busca">
                <input id="osm-busca" placeholder="código de barras, código, descrição ou referência" autocomplete="off">
                <input id="osm-qtd" class="osm-num" value="1" inputmode="numeric" title="quantidade">
                <button type="button" class="osm-btn roxo" id="osm-levar">+ levar</button>
              </div>
              <div class="osm-res" id="osm-res" hidden></div>
            </div>
            <div class="osm-sub">Lista do consignado</div>
            <table class="osm-tab">
              <colgroup><col style="width:52px"><col><col style="width:40px"><col style="width:44px"><col style="width:48px">
                <col style="width:64px"><col style="width:70px"><col style="width:84px"></colgroup>
              <thead><tr><th>Cód.</th><th>Descrição</th><th class="n">Saiu</th><th class="n" title="voltou">Volt.</th><th class="n">Usado</th>
                <th class="n">Unit.</th><th class="n">Total</th><th class="n" title="devolver">Devolver</th></tr></thead>
              <tbody id="osm-cons"></tbody>
              <tfoot><tr><td colspan="6">Consignado usado</td><td class="n" id="osm-tcons">0,00</td><td></td></tr>
                <tr class="serv"><td colspan="6">Serviço</td><td class="n" id="osm-tgeral">0,00</td><td></td></tr></tfoot>
            </table>
            <div class="osm-sec" style="margin-top:14px">Fotos do serviço acabado</div>
            <div class="osm-fotos" id="osm-fotos"></div>
            <input type="file" id="osm-arq" accept="image/*" multiple hidden>
          </div>
          <aside class="osm-agenda"><div class="osm-ag-lista" id="osm-ag"><div class="vz">Escolha o técnico e o dia.</div></div></aside>
        </div>
        <div class="osm-rod">
          <button type="button" class="osm-btn" id="osm-razao" title="conta do cliente: ver se a venda já foi recebida">Razão</button>
          <span class="msg" id="osm-msg"></span>
          <button type="button" class="osm-btn" id="osm-reabrir">Ver espelho</button>
          <button type="button" class="osm-btn verde" id="osm-concluir">Concluir serviço</button>
          <button type="button" class="osm-btn roxo" id="osm-gravar">Gravar</button>
          <button type="button" class="osm-btn" id="osm-fechar">Fechar</button>
        </div>
        <div class="osm-raz" id="osm-raz" hidden><div>
          <h4 id="osm-raz-tit">Razão do cliente</h4>
          <div class="sub" id="osm-raz-sub"></div>
          <div class="lista" id="osm-raz-lista"></div>
          <div class="saldo"><span id="osm-raz-saldo"></span><button type="button" class="osm-btn" id="osm-raz-fechar">Fechar</button></div>
        </div></div>
        <div class="osm-sair" id="osm-sair" hidden><div>
          <h4>Alterações não gravadas</h4>
          <p id="osm-sair-txt"></p>
          <div class="bts">
            <button type="button" class="osm-btn" id="osm-sair-cont">Continuar editando</button>
            <button type="button" class="osm-btn" id="osm-sair-nao">Sair sem gravar</button>
            <button type="button" class="osm-btn roxo" id="osm-sair-sim">Gravar e fechar</button>
          </div>
        </div></div>
      </div>`;
    document.body.appendChild(d);

    q('x').addEventListener('click', () => fechar());
    // 18/10/2026: mudar o local (enderecos do cliente, + outro: CEP ou digitar)
    q('det').addEventListener('click', ev => { if (ev.target.id === 'osm-mudar') abrirLocal(); });
    q('end-canc').addEventListener('click', () => { q('endx').hidden = true; });
    q('end-ok').addEventListener('click', gravarLocal);
    q('fechar').addEventListener('click', () => fechar());
    q('sair-cont').addEventListener('click', () => { q('sair').hidden = true; });
    q('razao').addEventListener('click', abrirRazao);
    q('raz-fechar').addEventListener('click', () => { q('raz').hidden = true; });
    q('sair-nao').addEventListener('click', () => fechar(true));
    q('sair-sim').addEventListener('click', gravarEFechar);
    q('fundo').addEventListener('click', fechar);
    q('gravar').addEventListener('click', async () => { if (!alteracoes().length) { msg('Nada a gravar.', true); return; }
                                                        if (await gravarTudo()) msg('✓ gravado', true); });
    q('concluir').addEventListener('click', concluir);
    q('reabrir').addEventListener('click', reabrir);
    q('levar').addEventListener('click', levar);
    // 26/10/2026: valor combinado — conta a parte do tecnico; sair do campo formata; Enter anda
    ['cval', 'cemp'].forEach(id => {
      q(id).addEventListener('input', contaComb);
      q(id).addEventListener('blur', () => { const c = paraCent(q(id).value); if (Number.isFinite(c)) q(id).value = c ? brl(c) : ''; contaComb(); });
      q(id).addEventListener('keydown', ev => { if (ev.key !== 'Enter') return; ev.preventDefault(); if (id === 'cval') { q('cemp').focus(); q('cemp').select(); } else q('gravar').focus(); });
    });
    q('busca').addEventListener('input', () => {
      clearTimeout(buscaT);
      if (!q('busca').value.trim()) { q('res').hidden = true; achados = []; ultimaBusca = ''; return; }   // 26/10/2026: vazio fecha
      buscaT = setTimeout(buscar, 250);
    });
    q('busca').addEventListener('keydown', ev => {
      const linhas = [...q('res').querySelectorAll('[data-i]')];
      const k = linhas.findIndex(l => l.classList.contains('sel'));
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!linhas.length) return;
        const n = ev.key === 'ArrowDown' ? Math.min(k + 1, linhas.length - 1) : Math.max(k - 1, 0);
        linhas.forEach((l, i) => l.classList.toggle('sel', i === n));
        linhas[n].scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const t = q('busca').value.trim();
        if (t && t !== ultimaBusca) {          // leitor: digitou e deu Enter antes da busca terminar
          clearTimeout(buscaT);
          buscar().then(() => {
            if (achados.length === 1 && achados[0].porEan) { q('qtd').value = '1'; levarCod(0); }   // bipou: leva 1 direto
          });
          return;
        }
        const l = linhas[k >= 0 ? k : 0];
        if (l) levarCod(+l.dataset.i);
      } else if (ev.key === 'Escape') { q('res').hidden = true; ev.stopPropagation(); }
    });
    q('res').addEventListener('click', ev => { const l = ev.target.closest('[data-i]'); if (l) levarCod(+l.dataset.i); });
    q('qtd').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); levar(); } });
    q('forn').addEventListener('change', () => {
      buscar(); q('busca').focus();
    });
    q('fedit').addEventListener('click', abrirEscolha);
    q('fcancela').addEventListener('click', () => { q('fsel').hidden = true; });
    q('fnenhum').addEventListener('click', () => {
      q('fgrade').querySelectorAll('input').forEach(c => { c.checked = false; c.parentNode.classList.remove('on'); });
      contarEscolha();
    });
    q('fgrade').addEventListener('change', ev => {
      if (ev.target.type === 'checkbox') ev.target.parentNode.classList.toggle('on', ev.target.checked);
      contarEscolha();
    });
    q('fgrava').addEventListener('click', gravarEscolha);
    q('cons').addEventListener('click', ev => {
      const b = ev.target.closest('[data-dev]');
      if (b) devolver(b.dataset.dev);
    });
    q('cons').addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.dataset.devq) { ev.preventDefault(); devolver(ev.target.dataset.devq); }
    });
    // 16/10/2026: USADO corrigido na linha: Enter ou sair do campo grava
    const acertarUsado = async el => {
      if (el.disabled) return;                       // Enter e change juntos: grava uma vez so
      const c = (os.consignados || []).find(x => String(x.id) === el.dataset.usado); if (!c) return;
      const n = Number(el.value);
      if (String(el.value).trim() === '' || !Number.isInteger(n) || n < 0) { el.value = c.usado; msg('Usado: quantidade inteira (0 ou mais).'); return; }
      if (n === c.usado) return;
      el.disabled = true;
      try {
        mudou((await api('PUT', API + os.id + '/consignados/' + c.id, { usado: n })).os,
          '✓ ' + c.codigo + ': usado ' + c.usado + ' → ' + n + (n > c.usado ? ' (estoque baixou ' + (n - c.usado) + ')' : ' (voltou ' + (c.usado - n) + ' ao estoque)'));
      } catch (e) { msg(e.message); el.disabled = false; el.value = c.usado; }
    };
    q('cons').addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.usado) { ev.preventDefault(); acertarUsado(ev.target); }
    });
    q('cons').addEventListener('change', ev => { if (ev.target.dataset && ev.target.dataset.usado) acertarUsado(ev.target); });
    q('cons').addEventListener('focusin', ev => { if (ev.target.dataset && ev.target.dataset.usado) ev.target.select(); });
    // 16/10/2026: DEVOLVER nao passa do que esta com o tecnico (para levar mais: "+ levar", soma na linha)
    q('cons').addEventListener('input', ev => {
      if (ev.target.dataset && ev.target.dataset.usado) { ev.target.value = ev.target.value.replace(/\D/g, ''); return; }
      const id = ev.target.dataset && ev.target.dataset.devq; if (!id) return;
      const c = (os.consignados || []).find(x => String(x.id) === id); if (!c) return;
      const resta = c.quantidade - c.devolvido;
      ev.target.value = ev.target.value.replace(/\D/g, '');
      if (Number(ev.target.value) > resta) {
        ev.target.value = String(resta);
        msg('Devolver: só ' + resta + ' com o técnico. Para LEVAR mais, use "+ levar" (soma na mesma linha).');
      }
    });
    q('fotos').addEventListener('click', ev => {
      if (ev.target.closest('.osm-add')) { q('arq').click(); return; }
      const rem = ev.target.closest('[data-rem]');
      if (rem) { removerFoto(rem.dataset.rem); return; }
      const img = ev.target.closest('img[data-arq]');
      if (img) window.open(img.src, '_blank');
    });
    q('arq').addEventListener('change', enviarFotos);
    // 14/10/2026: trocou tecnico ou dia -> o horario NAO vai junto (so volta o gravado, se for o mesmo)
    const reporHorario = () => {
      const gravado = os && q('tec').value === (os.tecnicoConta || '') && q('adia').value === (os.diaPrevisto || '');
      q('ahi').value = gravado ? os.horaIni || '' : '';
      q('ahf').value = gravado ? os.horaFim || '' : '';
    };
    q('tec').addEventListener('change', () => { reporHorario(); agCarregar(); });
    q('adia').addEventListener('change', () => { reporHorario(); agCarregar(); });
    ['ahi', 'ahf'].forEach(id => q(id).addEventListener('input', agDesenhar));
    q('ag').addEventListener('click', ev => {
      const l = ev.target.closest('.osm-ag-lin.livre'); if (!l) return;
      const m = Number(l.dataset.m), ini = paraMin(q('ahi').value), fim = paraMin(q('ahf').value);
      if (ini === null || m + 30 <= ini || (fim !== null && m < ini)) { q('ahi').value = hm(m); q('ahf').value = ''; }
      else q('ahf').value = hm(m + 30);
      agDesenhar();
    });
    // 15/10/2026: limpa dia e horario (o tecnico fica); grava no Gravar
    q('agendar').addEventListener('click', () => {
      q('adia').value = ''; q('ahi').value = ''; q('ahf').value = '';
      agCarregar(); msg('dia e horário limpos: clique em Gravar para confirmar');
    });
    ['tec', 'adia', 'ahi', 'ahf'].forEach((id, k, ordem) => q(id).addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (k < ordem.length - 1) q(ordem[k + 1]).focus(); else q('gravar').focus();
    }));
    // Enter anda de campo em campo na coluna da esquerda
    [].forEach((id, k, ordem) => q(id).addEventListener('keydown', ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (k < ordem.length - 1) q(ordem[k + 1]).focus(); else q('obs').focus();
    }));
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape' || q('caixa').hidden) return;
      if (!q('sair').hidden) { q('sair').hidden = true; return; }   // Esc na pergunta: continua editando
      if (!q('raz').hidden) { q('raz').hidden = true; return; }     // Esc no razao: so fecha o razao
      fechar();
    });
  }

  const msg = (t, ok) => { q('msg').textContent = t || ''; q('msg').classList.toggle('ok', !!ok); };
  const podeEditar = () => os && os.status === 'P';     // 15/10/2026: fechada, so pela ficha
  // 26/10/2026: valor combinado (centavos) — so OS sem venda (mao de obra cobrada na OS)
  const temCombinado = () => os && os.modoMaoDeObra === 'OS';
  const paraCent = s => { let x = String(s || '').replace(/[R$\s]/g, ''); if (!x) return 0; if (x.includes(',')) x = x.replace(/\./g, '').replace(',', '.'); const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
  const lerComb = () => ({ valor: paraCent(q('cval').value), empresa: paraCent(q('cemp').value) });
  function contaComb() {
    const c = lerComb();
    q('ctec').value = c.valor > 0 && Number.isFinite(c.empresa) && c.empresa <= c.valor ? brl(c.valor - c.empresa) : '';
    q('cdica').innerHTML = c.valor > 0 && c.empresa > c.valor ? '<b style="color:#b91c1c">a parte da empresa passa do valor</b>'
      : 'O que foi combinado antes do técnico ir. Na ficha de fechamento pode acrescentar. Grava no <b>Gravar</b>.';
  }

  function desenhar() {
    const o = os, e = o.endereco || {}, cli = o.cliente || {};
    q('tit').textContent = 'OS nº ' + o.numero + (TIPO[o.tipo] ? ' · ' + TIPO[o.tipo] : '') + ' · ' + (cli.nome || '');
    q('sit').textContent = SIT[o.status] || o.status;
    q('sit').className = 'osm-sit ' + o.status;
    // o que esta GRAVADO: programada para ...
    q('prog').textContent = o.diaPrevisto
      ? 'programada para ' + dataBr(o.diaPrevisto).slice(0, 6) + dataBr(o.diaPrevisto).slice(8) + (o.horaIni ? ' · ' + o.horaIni + '–' + o.horaFim : ' · sem horário')
      : 'não programada';
    q('prog').className = 'osm-prog' + (o.diaPrevisto ? '' : ' nao');
    q('prog').hidden = o.status !== 'P';
    const linha = (rot, v) => v ? '<span>' + rot + '</span><div>' + v + '</div>' : '';
    const end = [[e.logradouro, e.numero].filter(Boolean).join(', '), e.complemento, e.bairro,
                 [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
    const itens = (o.itens || []).length
      ? '<ul>' + o.itens.map(i => '<li>' + esc(i.servico || 'Instalação') + ' — ' + esc(i.codigo) + ' ' + esc(i.descricao)
          + (i.observacao ? ' <i>(' + esc(i.observacao) + ')</i>' : '') + '</li>').join('') + '</ul>' : '';
    q('det').innerHTML =
        linha('Cliente', esc((cli.codigo ? cli.codigo + ' · ' : '') + (cli.nome || '')))
      + linha('Local', esc(end) + (podeEditar() ? ' <button type="button" class="osm-mudar" id="osm-mudar" title="outro endereço do cliente, ou CEP / digitar">✎ mudar local</button>' : ''))
      + linha('Edifício', esc([o.edificio, o.apto ? 'apto ' + o.apto : ''].filter(Boolean).join(' · ')))
      + linha('Referência', esc(o.pontoReferencia))
      + linha('Telefones', esc([o.telefone, o.celular].filter(Boolean).join(' · ')))
      + linha('Instalar', itens)
      + (o.cortesia ? linha('Cortesia', '<b style="color:#b45309">sem mão de obra · ' + esc(o.cortesia) + '</b>') : '')
      + linha('Observação', esc(o.observacao))
      + linha('Venda', o.venda ? 'nº ' + esc(o.venda.numero) : '');

    // agendamento
    const agEd = o.status === 'P';
    q('tec').innerHTML = '<option value="">a definir</option>' + (tecnicos || []).map(t =>
      '<option value="' + esc(t.conta) + '">' + esc(t.nome) + ' · ' + esc(t.conta) + '</option>').join('')
      + (o.tecnicoConta && !(tecnicos || []).some(t => t.conta === o.tecnicoConta)
         ? '<option value="' + esc(o.tecnicoConta) + '">' + esc(o.tecnicoNome || o.tecnicoConta) + ' (inativo)</option>' : '');
    q('tec').value = o.tecnicoConta || '';
    q('adia').value = o.diaPrevisto || '';
    q('adia').min = hojeIso();
    // sem dia reservado: horario limpo (so vale hora com dia)
    q('ahi').value = o.diaPrevisto ? o.horaIni || '' : ''; q('ahf').value = o.diaPrevisto ? o.horaFim || '' : '';
    if (manter && agEd) {                                 // 26/10/2026: o digitado e nao gravado volta
      q('tec').value = manter.tec; q('adia').value = manter.adia; q('ahi').value = manter.ahi; q('ahf').value = manter.ahf;
    }
    ['tec', 'adia', 'ahi', 'ahf'].forEach(id => { q(id).disabled = !agEd; });
    q('agendar').hidden = !agEd;
    agCarregar();

    q('tgeral').title = !o.servicoContabilizado ? ''
      : 'cobrado na venda ' + (o.venda ? o.venda.numero : '') + (o.parteTecnico || o.parteLoja
        ? ' · técnico R$ ' + brl(o.parteTecnico) + ' · loja R$ ' + brl(o.parteLoja)
        : ' · na receita de serviços: a parte do técnico é definida na ficha de fechamento');
    q('obs').value = o.observacaoServico || '';
    if (manter) q('obs').value = manter.obs;              // 26/10/2026
    // 26/10/2026: valor combinado
    q('comb').hidden = !temCombinado();
    if (temCombinado()) {
      const c = o.combinado || { valor: 0, empresa: 0 };
      q('cval').value = c.valor ? brl(c.valor) : ''; q('cemp').value = c.valor ? brl(c.empresa) : '';
      if (manter) { q('cval').value = manter.cval; q('cemp').value = manter.cemp; }
      q('cval').disabled = q('cemp').disabled = o.status !== 'P';
      contaComb();
    }

    const ed = podeEditar();
    q('obs').disabled = !ed;
    q('busca-l').hidden = !ed;
    q('gravar').hidden = !ed;
    q('concluir').hidden = o.status !== 'P';
    q('reabrir').hidden = !(o.status === 'E' || o.status === 'L');
    q('fechar').hidden = o.status !== 'P';                 // 17/10/2026: concluida fecha pelo X

    // 15/10/2026: so o que ainda esta com o tecnico (devolvido todo sai da lista)
    const comTec = (o.consignados || []).filter(c => c.quantidade - c.devolvido > 0);
    q('cons').innerHTML = comTec.length ? comTec.map(c => {
      const resta = c.quantidade - c.devolvido;
      return '<tr><td>' + esc(c.codigo) + '</td><td class="d">' + esc(c.descricao) + '</td>'
        + '<td class="n">' + c.quantidade + '</td><td class="n">' + c.devolvido + '</td><td class="n">'
        + (ed ? '<input class="osm-usado" data-usado="' + c.id + '" value="' + c.usado + '" inputmode="numeric" title="quantidade usada: corrija e dê Enter">'
              : '<b>' + c.usado + '</b>') + '</td>'
        + '<td class="n">' + brl(c.precoUnit) + '</td><td class="n">' + brl(c.total) + '</td>'
        + '<td class="n">' + (ed && resta > 0
            ? '<span class="osm-dev"><input data-devq="' + c.id + '" id="osm-dq-' + c.id + '" value="' + resta + '" inputmode="numeric" title="quantas voltaram">'
              + '<button type="button" class="osm-btn mini" data-dev="' + c.id + '" title="voltou para a loja: repõe o estoque">↩</button></span>'
            : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="osm-vazio">Nenhum material com o técnico.</td></tr>';

    q('fotos').innerHTML = (o.fotos || []).map(f =>
      '<div class="osm-foto"><img data-arq="' + esc(f.arquivo) + '" src="' + API + o.id + '/fotos/' + encodeURIComponent(f.arquivo)
      + '" alt="foto" loading="lazy" title="clique para ampliar">'
      + (ed ? '<button type="button" data-rem="' + esc(f.arquivo) + '" title="remover a foto">×</button>' : '') + '</div>').join('')
      + (ed ? '<div class="osm-add" title="tirar ou escolher foto">＋ foto</div>' : '')
      || '<div class="osm-vazio">Sem fotos.</div>';
    totais();
  }

  function totais() {
    if (!os) return;
    const cons = (os.consignados || []).reduce((t, c) => t + c.total, 0);
    const serv = os.valorServico || 0;
    q('tcons').textContent = brl(cons);
    q('tgeral').textContent = brl(serv);                  // so o servico (o consignado esta na linha de cima)
  }

  async function abrir(id, cb) {
    montar();
    aoMudar = cb || null;
    msg('Carregando…', true);
    q('fundo').hidden = false; q('caixa').hidden = false;
    q('busca').value = ''; q('res').hidden = true; q('qtd').value = '1';
    try {
      if (!tecnicos) tecnicos = (await api('GET', TECNICOS)).tecnicos || [];
      if (!fornecedores) fornecedores = (await api('GET', FORN)).fornecedores || [];
      q('fsel').hidden = true;
      encherForn();
      os = (await api('GET', API + id)).os;
      msg('');
      desenhar();
    } catch (e) { msg(e.message); }
  }
  // ---- fornecedores do consignado ----------------------------------------------
  // combo: so os marcados (nada marcado = todos)
  function encherForn() {
    const atual = q('forn').value;
    const marcados = fornecedores.filter(f => f.consignado);
    const lista = marcados.length ? marcados : fornecedores;
    q('forn').innerHTML = '<option value="">todos os fornecedores</option>'
      + lista.map(f => '<option value="' + esc(f.nr) + '">' + esc(f.marca) + '</option>').join('');
    if (lista.some(f => String(f.nr) === atual)) q('forn').value = atual;
  }
  function contarEscolha() {
    const n = q('fgrade').querySelectorAll('input:checked').length;
    q('fcont').textContent = n ? n + ' marcado' + (n > 1 ? 's' : '') : 'nenhum marcado: o combo mostra todos';
  }
  function abrirEscolha() {
    if (!q('fsel').hidden) { q('fsel').hidden = true; return; }
    q('res').hidden = true;
    q('fgrade').innerHTML = fornecedores.map(f =>
      '<label' + (f.consignado ? ' class="on"' : '') + '><input type="checkbox" value="' + esc(f.nr) + '"'
      + (f.consignado ? ' checked' : '') + '>' + esc(f.marca) + '</label>').join('');
    contarEscolha();
    q('fsel').hidden = false;
  }
  async function gravarEscolha() {
    const nrs = [...q('fgrade').querySelectorAll('input:checked')].map(c => Number(c.value));
    q('fgrava').disabled = true;
    try {
      await api('PUT', FORN + '/consignado', { nrs });
      const set = new Set(nrs);
      fornecedores.forEach(f => { f.consignado = set.has(f.nr); });
      encherForn();
      q('fsel').hidden = true;
      msg('✓ fornecedores do consignado gravados', true);
    } catch (e) { msg(e.message); }
    finally { q('fgrava').disabled = false; }
  }

  // ---- razao do cliente (15/10/2026) --------------------------------------------
  async function abrirRazao() {
    const cli = (os && os.cliente) || {}, conta = cli.ncontabil;
    if (!conta) { msg('O cliente não tem conta contábil.'); return; }
    const hoje = new Date(), ini = new Date(hoje.getFullYear() - 1, hoje.getMonth(), 1);
    const de = iso(ini), ate = hojeIso();
    q('raz-tit').textContent = 'Razão · ' + conta + ' · ' + (cli.nome || '');
    q('raz-sub').textContent = 'de ' + dataBr(de) + ' até ' + dataBr(ate) + (os.venda ? ' · venda nº ' + os.venda.numero : '');
    q('raz-lista').innerHTML = '<div style="padding:16px;color:#6b7280">Carregando…</div>';
    q('raz-saldo').textContent = '';
    q('raz').hidden = false;
    try {
      const r = await fetch('/financeiro/api/razao/lancamentos?' + new URLSearchParams({ conta, de, ate }), { headers: { Accept: 'application/json' } });
      if (r.status === 401) { location.href = '/usuariocontab/login'; return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) throw new Error(d.erro || 'erro ' + r.status);
      const v = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const dt = x => x ? new Date(x).toLocaleDateString('pt-BR') : '';
      const sal = x => (x < 0 ? '−' : '') + v(Math.abs(x || 0));
      const ls = d.lancamentos || [];
      q('raz-lista').innerHTML = ls.length ? '<table><thead><tr><th>Data</th><th>Histórico</th><th>C/part.</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr></thead><tbody>'
        + ls.map(l => l.saldoAnterior
          ? '<tr style="font-weight:700;background:#f8fafc"><td>' + dt(l.data) + '</td><td>Saldo anterior</td><td></td><td></td><td></td><td class="n">' + sal(l.saldo) + '</td></tr>'
          : '<tr><td>' + dt(l.data) + '</td><td>' + esc(l.historico || '') + '</td><td title="' + esc(l.cPartidaNome || '') + '">' + esc(l.cPartida || '') + '</td>'
            + '<td class="n deb">' + (l.debito ? v(l.debito) : '') + '</td><td class="n cre">' + (l.credito ? v(l.credito) : '') + '</td><td class="n">' + sal(l.saldo) + '</td></tr>').join('')
        + '</tbody></table>' : '<div style="padding:16px;color:#6b7280">Nenhum lançamento no período.</div>';
      const saldo = Number(d.saldo || 0);
      q('raz-saldo').innerHTML = Math.abs(saldo) < 0.005
        ? '<span class="ok">✓ conta do cliente zerada: nada a receber dele</span>'
        : saldo > 0 ? '<span class="deve">cliente deve R$ ' + v(saldo) + '</span>'
        : '<span class="ok">crédito do cliente R$ ' + v(-saldo) + '</span>';
      const lst = q('raz-lista'); lst.scrollTop = lst.scrollHeight;          // o mais recente embaixo
    } catch (e) { q('raz-lista').innerHTML = '<div style="padding:16px;color:#b91c1c">' + esc(e.message) + '</div>'; }
  }

  // ---- alteracoes nao gravadas ---------------------------------------------------
  // o que esta na tela e diferente do que esta gravado na OS
  function alteracoes() {
    if (!os) return [];
    const o = os, lista = [];
    if (o.status === 'P' && (q('tec').value !== (o.tecnicoConta || '') || q('adia').value !== (o.diaPrevisto || '')
        || q('ahi').value !== (o.diaPrevisto ? o.horaIni || '' : '') || q('ahf').value !== (o.diaPrevisto ? o.horaFim || '' : ''))) {
      lista.push('agendamento (técnico, dia ou horário)');
    }
    if (podeEditar()) {
      if (q('obs').value !== (o.observacaoServico || '')) lista.push('observação do serviço');
      if (temCombinado()) {                                          // 26/10/2026
        const c = lerComb(), g = o.combinado || { valor: 0, empresa: 0 };
        if (c.valor !== (g.valor || 0) || (c.valor > 0 && c.empresa !== (g.empresa || 0))) lista.push('valor combinado');
      }
    }
    return lista;
  }

  function fechar(semPerguntar) {
    if (!semPerguntar) {
      const alt = alteracoes();
      if (alt.length) {
        q('sair-txt').textContent = 'Você mudou ' + alt.join(', ') + ' e não gravou. O que fazer?';
        q('sair').hidden = false;
        q('sair-sim').focus();
        return;
      }
    }
    q('sair').hidden = true;
    q('fundo').hidden = true; q('caixa').hidden = true; q('res').hidden = true; os = null;
    window.dispatchEvent(new Event('os-modal-fechou'));   // 26/10/2026: a pagina atualiza as listas
  }

  async function gravarEFechar() {
    q('sair').hidden = true;
    const alt = alteracoes();
    if (alt.some(a => a.startsWith('agendamento')) && !(await agendar())) return;   // msg ja diz o que faltou
    if (alteracoes().length && !(await gravar(false))) return;
    fechar(true);
  }
  // 26/10/2026: o redesenho repoe o que esta gravado; o digitado e nao gravado (agendamento e observacao)
  // fica guardado em `manter` e volta para a tela
  let manter = null;
  function mudou(novo, texto) {
    const pend = os && os.status === 'P' && novo && novo.status === 'P';
    manter = pend ? { tec: q('tec').value, adia: q('adia').value, ahi: q('ahi').value, ahf: q('ahf').value, obs: q('obs').value,
                      cval: q('cval').value, cemp: q('cemp').value } : null;
    os = novo;
    try { desenhar(); } finally { manter = null; }
    msg(texto, true); if (aoMudar) aoMudar();
  }

  // ---- 18/10/2026: LOCAL da instalacao ----
  let endOS = null;
  function carregarEI() {
    if (window.EnderecoInst) return Promise.resolve();
    return new Promise((ok, falha) => { const sc = document.createElement('script'); sc.src = '/js/comum/endereco-instalacao.js';
      sc.onload = ok; sc.onerror = () => falha(new Error('não carregou o endereco-instalacao.js')); document.head.appendChild(sc); });
  }
  async function abrirLocal() {
    try { await carregarEI(); } catch (e) { msg(e.message); return; }
    if (!endOS) endOS = window.EnderecoInst.form(q('endf'), 'osm-ei-');
    const e = os.endereco || {};
    endOS.preencher({ ...e, edificio: os.edificio, apto: os.apto, pontoReferencia: os.pontoReferencia });
    await endOS.carregar(os.cliente && os.cliente.id);
    q('endx').hidden = false;
    document.getElementById('osm-ei-combo').focus();
  }
  async function gravarLocal() {
    const e = endOS.ler();
    if (!e.logradouro) { msg('Informe o logradouro (ou o CEP).'); return; }
    try {
      const r = await api('PUT', API + os.id, { local: e });
      let guardou = false;
      try { guardou = await endOS.guardarSeNovo(); } catch (x) { /* o local da OS ja mudou */ }
      q('endx').hidden = true;
      mudou(r.os, '✓ local mudado' + (guardou ? ' e guardado no cadastro do cliente' : ''));
    } catch (x) { msg(x.message); }
  }

  async function gravar(avisar) {
    if (!podeEditar()) return true;
    try {
      const corpo = { observacaoServico: q('obs').value };
      if (temCombinado()) {                                          // 26/10/2026: valor combinado
        const c = lerComb();
        if (!Number.isFinite(c.valor) || !Number.isFinite(c.empresa)) { msg('Valor combinado: confira os números.'); q('cval').focus(); return false; }
        if (c.valor > 0 && c.empresa > c.valor) { msg('A parte da empresa passa do valor combinado.'); q('cemp').focus(); return false; }
        corpo.combinado = { valor: c.valor, empresa: c.valor > 0 ? c.empresa : 0 };
      }
      const r = await api('PUT', API + os.id, corpo);
      mudou(r.os, avisar ? '✓ gravado' : '');
      return true;
    } catch (e) { msg(e.message); return false; }
  }

  // 15/10/2026: concluir = FICHA DE FECHAMENTO (pagina propria); volta para esta tela depois
  const urlFicha = () => {
    const u = new URL(location.href); u.searchParams.set('os', os.id);        // volta: reabre este modal
    return '/vendas/servicos/fechamento/' + os.id + '?volta=' + encodeURIComponent(u.pathname + u.search);
  };
  async function concluir() {
    if (alteracoes().length && !(await gravarTudo())) return;      // o que mudou aqui nao se perde
    if (!os.tecnicoConta || !os.diaPrevisto) { msg('Agende a OS (técnico e dia) antes de concluir.'); q('tec').focus(); return; }
    location.href = urlFicha();
  }
  async function gravarTudo() {
    if (alteracoes().some(a => a.startsWith('agendamento')) && !(await agendar())) return false;
    return alteracoes().length ? gravar(false) : true;
  }
  function reabrir() { location.href = urlFicha(); }      // botao "Ver fechamento"


  // ---- agendamento (agenda do tecnico, como na venda) ----
  async function agCarregar() {
    agOcupados = [];
    const tec = q('tec').value, dia = q('adia').value;
    if (!tec) { q('ag').innerHTML = '<div class="osm-ag-cab">Agenda do técnico</div><div class="vz">Escolha o técnico para ver a agenda dele.</div>'; return; }
    if (!dia) { q('ag').innerHTML = '<div class="osm-ag-cab">Agenda de ' + esc(((q('tec').selectedOptions[0] || {}).textContent || '').split(' · ')[0]) + '</div><div class="vz">Marque o dia para ver os horários.</div>'; return; }
    q('ag').innerHTML = '<div class="vz">Carregando…</div>';
    try {
      const r = await api('GET', AGENDA + '?tecnico=' + encodeURIComponent(tec) + '&dia=' + dia + '&os=' + os.id
        + (os.venda && os.venda.id ? '&venda=' + os.venda.id : ''));
      agOcupados = (r.ocupados || []).map(x => ({ ini: paraMin(x.horaIni), fim: x.horaFim ? paraMin(x.horaFim) : paraMin(x.horaIni) + 30,
                                                   cliente: x.cliente, texto: x.texto }));
    } catch (e) { msg(e.message); }
    agDesenhar();
  }
  function agDesenhar() {
    if (!os || !q('tec').value || !q('adia').value) return;      // fechou enquanto carregava
    const ini = paraMin(q('ahi').value), fim = paraMin(q('ahf').value);
    const fimEf = ini === null ? null : (fim !== null && fim > ini ? fim : ini + 1);
    const ehHoje = q('adia').value === hojeIso(), agora = agoraMin(), nome = (os.cliente && os.cliente.nome) || 'esta OS';
    const tecNome = (q('tec').selectedOptions[0] || {}).textContent || '';
    let h = '<div class="osm-ag-cab">Agenda de ' + esc(tecNome.split(' · ')[0]) + ' · ' + dataBr(q('adia').value)
      + '<small><b class="oc">■</b> ocupado com outro cliente · <b class="es">■</b> ' + esc(nome) + '</small></div>';
    for (let m = 7 * 60; m < 19 * 60; m += 30) {
      const oc = agOcupados.find(o => m >= o.ini && m < o.fim);
      const es = ini !== null && m + 30 > ini && m < fimEf;
      const gravado = q('tec').value === (os.tecnicoConta || '') && q('adia').value === (os.diaPrevisto || '')
        && q('ahi').value === (os.horaIni || '') && q('ahf').value === (os.horaFim || '');
      const passou = ehHoje && m + 30 <= agora;
      const cls = oc ? 'ocupado' : es ? 'escolhido livre' : passou ? 'passado' : 'livre';
      h += '<div class="osm-ag-lin ' + cls + '" data-m="' + m + '"' + (oc ? ' title="' + esc(oc.texto) + '"' : '') + '><span class="h">' + hm(m)
        + '</span><span>' + (oc ? 'ocupado · ' + esc(oc.cliente) : es ? (gravado ? '✓ ' + esc(nome) : '● ' + esc(nome) + ' · a gravar') : passou ? 'passou' : '') + '</span></div>';
    }
    q('ag').innerHTML = h;
  }
  async function agendar() {
    const dia = q('adia').value, hi = q('ahi').value, hf = q('ahf').value;
    if ((hi || hf) && !dia) { msg('Marque o dia antes do horário.'); q('adia').focus(); return false; }
    if (hi && !hf) { msg('Informe o horário ATÉ.'); q('ahf').focus(); return false; }
    if (dia && dia < hojeIso()) { msg('Esse dia já passou.'); q('adia').focus(); return false; }
    if (dia === hojeIso() && hi && paraMin(hi) < agoraMin()) { msg('Esse horário de hoje já passou (agora são ' + hm(agoraMin()) + ').'); q('ahi').focus(); return false; }
    const ini = paraMin(hi), fim = paraMin(hf);
    if (ini !== null && agOcupados.some(o => ini < o.fim && fim > o.ini)) { msg('Esse horário bate com outro cliente do técnico.'); return false; }
    const trocou = (os.tecnicoConta || '') !== q('tec').value;
    if (trocou && os.servicoContabilizado && os.parteTecnico > 0 && !confirm('A mão de obra desta OS já foi lançada para '
        + (os.tecnicoNome || os.tecnicoConta) + ' (R$ ' + brl(os.parteTecnico) + ').\nTrocar de técnico passa esse valor para o novo técnico (lançamento automático). Continuar?')) return false;
    // o que esta digitado no termino/valor/obs nao se perde com o redesenho da agenda
    const guarda = { obs: q('obs').value };
    q('agendar').disabled = true;
    try {
      const r = await api('PUT', API + os.id + '/agenda', { tecnicoConta: q('tec').value, dia, horaIni: hi, horaFim: hf });
      mudou(r.os, '✓ agendada' + (r.os.tecnicoNome ? ' · ' + r.os.tecnicoNome : '') + (dia ? ' · ' + dataBr(dia) : '') + (hi ? ' ' + hi + '–' + hf : ''));
      for (const [k, v] of Object.entries(guarda)) if (!q(k).disabled) q(k).value = v;
      return true;
    } catch (e) { msg(e.message); return false; } finally { q('agendar').disabled = false; }
  }

  // ---- consignados ----
  let ultimaBusca = null;
  async function buscar() {
    const t = q('busca').value.trim(), forn = q('forn').value;
    ultimaBusca = t;
    if (!forn && t.length < 2 && !/^\d+$/.test(t)) { q('res').hidden = true; achados = []; return; }
    try {
      const vindos = (await api('GET', BUSCA + encodeURIComponent(t) + (forn ? '&fornecedor=' + encodeURIComponent(forn) : ''))).produtos || [];
      // 26/10/2026: a caixa mudou (ou foi limpa) enquanto buscava: resposta velha nao abre a lista
      if (q('busca').value.trim() !== t || q('forn').value !== forn) return;
      achados = vindos;
      q('res').innerHTML = (achados.length ? '<div class="cab"><span style="grid-column:1/-1;text-transform:none;color:#6b21a8">'
          + 'clique no produto para levar · quantidade: ' + esc(q('qtd').value || '1') + ' (campo ao lado)</span></div>' : '')
        + (achados.length ? '<div class="cab"><span>Código</span><span>Descrição</span><span class="n">Estoque</span><span class="n">À vista</span></div>' : '')
        + (achados.length ? achados.map((p, i) =>
        '<div data-i="' + i + '"' + (i === 0 ? ' class="sel"' : '') + '><span>' + esc(p.codigo) + '</span><span>' + esc(p.descricao)
        + (p.referencia ? ' <small>· ' + esc(p.referencia) + '</small>' : '') + '</span>'
        + '<span class="n" title="estoque">' + esc(p.estoque) + '</span><span class="n">' + brl(p.precoVista) + '</span></div>').join('')
        : '<div><span></span><span>nada encontrado</span></div>');
      q('res').hidden = false;
    } catch (e) { msg(e.message); }
  }
  function escolher(i) {
    const p = achados[i]; if (!p) return;
    q('busca').value = p.codigo + ' · ' + p.descricao;
    q('busca').dataset.cod = p.codigo;
    q('res').hidden = true; ultimaBusca = null;
    q('qtd').focus(); q('qtd').select();
  }
  // 15/10/2026: clique (ou Enter) no produto da lista: leva na hora; a lista fica aberta
  let levando = false;          // um de cada vez: clique duplo nao leva duas vezes
  async function levarCod(i) {
    const p = achados[i]; if (!p || levando) return;
    const qtd = Number(q('qtd').value);
    if (!Number.isInteger(qtd) || qtd <= 0) { msg('Quantidade inteira, maior que zero.'); q('qtd').focus(); return; }
    levando = true;
    try {
      const r = await api('POST', API + os.id + '/consignados', { codigo: p.codigo, quantidade: qtd });
      q('qtd').value = '1';
      mudou(r.os, '✓ ' + qtd + ' un. do ' + p.codigo + ' com o técnico (estoque baixado)');
      if (q('busca').value.trim()) await buscar(); else q('res').hidden = true;   // estoque atualizado na lista
      q('busca').focus();
    } catch (e) { msg(e.message); } finally { levando = false; }
  }
  async function levar() {
    // lista aberta: o "+ levar" leva o produto marcado nela
    const sel = q('res').hidden ? null : q('res').querySelector('[data-i].sel');
    if (sel) return levarCod(+sel.dataset.i);
    let cod = Number(q('busca').dataset.cod);
    const t = q('busca').value.trim();
    if (!cod || !t.startsWith(cod + ' · ')) cod = /^\d+$/.test(t) ? Number(t) : 0;
    const qtd = Number(q('qtd').value);
    if (!cod) { msg('Escolha o produto na lista.'); q('busca').focus(); return; }
    if (!Number.isInteger(qtd) || qtd <= 0) { msg('Quantidade inteira, maior que zero.'); q('qtd').focus(); return; }
    q('levar').disabled = true;
    try {
      const r = await api('POST', API + os.id + '/consignados', { codigo: cod, quantidade: qtd });
      q('busca').value = ''; delete q('busca').dataset.cod; q('qtd').value = '1';
      mudou(r.os, '✓ ' + qtd + ' un. do ' + cod + ' com o técnico (estoque baixado)');
      q('busca').focus();
    } catch (e) { msg(e.message); } finally { q('levar').disabled = false; }
  }
  async function devolver(cid) {
    const campo = document.getElementById('osm-dq-' + cid);
    const qtd = Number(campo && campo.value);
    if (!Number.isInteger(qtd) || qtd <= 0) { msg('Quantidade a devolver: inteira, maior que zero.'); if (campo) campo.focus(); return; }
    try { mudou((await api('POST', API + os.id + '/consignados/' + cid + '/devolver', { quantidade: qtd })).os, '✓ ' + qtd + ' un. de volta ao estoque'); }
    catch (e) { msg(e.message); }
  }

  // ---- fotos ----
  function reduzir(arquivo) {
    return new Promise((ok, falha) => {
      const img = new Image();
      const url = URL.createObjectURL(arquivo);
      img.onload = () => {
        const lado = 1600, k = Math.min(1, lado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? ok(b) : falha(new Error('não consegui ler a imagem'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('arquivo não é uma imagem: ' + arquivo.name)); };
      img.src = url;
    });
  }
  async function enviarFotos() {
    const arqs = [...q('arq').files];
    q('arq').value = '';
    for (const [k, a] of arqs.entries()) {
      msg('Enviando foto ' + (k + 1) + ' de ' + arqs.length + '…', true);
      try { mudou((await api('POST', API + os.id + '/fotos', await reduzir(a), 'image/jpeg')).os, ''); }
      catch (e) { msg(e.message); return; }
    }
    msg(arqs.length ? '✓ foto(s) gravada(s)' : '', true);
  }
  async function removerFoto(arq) {
    if (!confirm('Remover esta foto da OS?')) return;
    try { mudou((await api('POST', API + os.id + '/fotos/' + encodeURIComponent(arq) + '/remover')).os, '✓ foto removida'); }
    catch (e) { msg(e.message); }
  }

  // 26/10/2026: saindo da pagina com o modal aberto e alteracao nao gravada, o navegador pergunta
  // (o texto da pergunta e do navegador: "Sair do site? As alterações podem não ser salvas")
  window.addEventListener('beforeunload', ev => {
    if (!os || q('caixa').hidden || !alteracoes().length) return;
    ev.preventDefault(); ev.returnValue = '';
  });

  window.OSModal = { abrir, versao: '26/10/2026-f' };   // versao: F12 > Console > OSModal.versao

  // voltou da ficha de fechamento sem gravar (?os=<id>): reabre o modal desta OS
  const reabrirId = new URLSearchParams(location.search).get('os');
  if (reabrirId) {
    const tira = () => { const u = new URL(location.href); u.searchParams.delete('os'); history.replaceState(null, '', u.pathname + u.search); };
    const vai = () => { tira(); abrir(reabrirId, () => window.dispatchEvent(new Event('os-mudou'))); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', vai); else vai();
  }
})();
