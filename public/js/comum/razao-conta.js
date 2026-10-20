// =============================================================================
// Destino: C:\plataformaRota\public\js\comum\razao-conta.js
// Criado em: 19/10/2026 (ideia do Jorge, como no sistema antigo)
//
// JANELA "RAZÃO · TÍTULOS EM ABERTO" de uma conta (cliente ou fornecedor), por cima de qualquer tela:
//   em cima  o RAZÃO da conta no ano (data, histórico, contrapartida, débito, crédito, saldo corrido)
//   embaixo  os TÍTULOS EM ABERTO dessa conta no fluxo (todos os anos)
//   rodapé   a CONFERÊNCIA: saldo do razão × soma dos títulos em aberto. Tem que bater — é a melhor
//            forma de ver se o razão (ou o fluxo) está certo. Cliente (1.x): saldo devedor = títulos a
//            receber; fornecedor (2.x): saldo credor = títulos a pagar. Pedido feito (3), compra projetada
//            (7) e orçamento (8) NÃO entram na soma (ainda não são dívida): aparecem à parte.
// 19/10/2026: titulos em aberto com SALDO corrido (mesmo sinal do razao): a ultima linha = saldo do razao.
// Uso: window.RazaoConta.abrir('2.01.001.182', 'Haenke')   (arrasta pelo título; Esc fecha)
//      opcoes: { destaque: '140845', valor: 1334.07 } — acende no razao e nos titulos as linhas com essa nota
//      ou esse valor (DDA - confere: "este boleto ja foi pago?") e conta quantas achou.
// APIs: GET /financeiro/api/razao/lancamentos?conta=&de=&ate=   ·   GET /financeiro/api/fluxo/conta/:codigo
// =============================================================================

(function () {
  'use strict';
  if (window.RazaoConta) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cent = v => Math.round(Number(v || 0) * 100);
  const br = s => { const d = new Date(s); return isNaN(d) ? '' : String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2); };
  const POS = { 0: 'avulso', 1: 'cartão', 2: 'a pagar', 3: 'pedido feito', 5: 'a receber', 7: 'compra projetada', 8: 'orçamento' };
  const REAL = new Set([0, 1, 2, 5]);                         // o que ja e divida / credito de verdade

  const st = document.createElement('style');
  st.textContent = `
  .rc-jan { position:fixed; left:50%; top:4vh; transform:translateX(-50%); z-index:95; width:min(980px, calc(100vw - 24px)); max-height:92vh;
            display:flex; flex-direction:column; background:#fff; border-radius:12px; box-shadow:0 18px 50px rgba(0,0,0,.35);
            font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:13px; color:#111827; }
  .rc-cab { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#374151; color:#fff; border-radius:12px 12px 0 0;
            font-weight:800; font-size:15px; cursor:move; user-select:none; }
  .rc-cab span { flex:1; } .rc-cab button { border:0; background:none; color:#fff; font-size:20px; cursor:pointer; }
  .rc-sec { padding:6px 14px; font-size:11px; font-weight:800; text-transform:uppercase; color:#374151; background:#f3f4f6; border-top:1px solid #e5e7eb; }
  .rc-rola { overflow:auto; min-height:60px; }
  .rc-rola.r1 { max-height:38vh; } .rc-rola.r2 { max-height:26vh; }
  .rc-tab { width:100%; border-collapse:collapse; }
  .rc-tab th { position:sticky; top:0; background:#fafafa; font-size:10px; text-transform:uppercase; color:#6b7280; text-align:left; padding:5px 8px; }
  .rc-tab td { padding:4px 8px; border-top:1px solid #f3f4f6; vertical-align:top; }
  .rc-tab .n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .rc-tab .cn { color:#6b7280; font-size:12px; } .rc-tab .deb { color:#1d4ed8; } .rc-tab .cre { color:#b91c1c; }
  .rc-tab tr.ant td { background:#f9fafb; font-style:italic; } .rc-tab tr.fora td { color:#9ca3af; }
  .rc-tab tr.luz td { background:#fef9c3 !important; font-weight:700; }
  .rc-achou { padding:6px 14px; background:#fef9c3; color:#854d0e; font-weight:700; font-size:12px; border-top:1px solid #fde68a; }
  .rc-pe { padding:10px 14px; border-top:2px solid #d1d5db; display:flex; gap:14px; flex-wrap:wrap; align-items:center; font-weight:700; }
  .rc-pe .ok { color:#166534; } .rc-pe .er { color:#b91c1c; }
  .rc-pe button { margin-left:auto; border:1px solid #d1d5db; background:#fff; border-radius:8px; padding:7px 14px; font-weight:700; cursor:pointer; }
  .rc-vz { padding:14px; color:#6b7280; text-align:center; }`;
  document.head.appendChild(st);

  let jan = null;
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && jan) { ev.stopPropagation(); jan.remove(); jan = null; } }, true);

  async function abrir(conta, nome, opc) {
    opc = opc || {};
    const nf = String(opc.destaque || '').replace(/^0+/, ''), vc = opc.valor ? cent(opc.valor) : 0;
    const acende = (txt, ...vals) => (nf && nf.length >= 3 && String(txt || '').includes(nf)) || (vc && vals.some(v => cent(v) === vc));
    if (jan) jan.remove();
    const ano = new Date().getFullYear();
    jan = document.createElement('div'); jan.className = 'rc-jan';
    jan.innerHTML = '<div class="rc-cab"><span>Razão · títulos em aberto — ' + esc(nome || '') + ' <small style="opacity:.8">' + esc(conta) + '</small></span><button type="button" data-x title="fechar (Esc)">×</button></div>'
      + '<div class="rc-sec">Razão ' + ano + '</div><div class="rc-rola r1" data-raz><div class="rc-vz">Carregando…</div></div>'
      + '<div class="rc-sec">Títulos em aberto no fluxo</div><div class="rc-rola r2" data-tit><div class="rc-vz">Carregando…</div></div>'
      + '<div class="rc-pe" data-pe>…<button type="button" data-x>Fechar</button></div>';
    document.body.appendChild(jan);
    const meu = jan;
    meu.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => { meu.remove(); if (jan === meu) jan = null; }));
    meu.querySelector('.rc-cab').addEventListener('mousedown', ev => {
      if (ev.button !== 0 || ev.target.closest('button')) return;
      ev.preventDefault();
      const r = meu.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
      meu.style.transform = 'none'; meu.style.left = r.left + 'px'; meu.style.top = r.top + 'px';
      const m = e => { meu.style.left = Math.min(Math.max(0, e.clientX - dx), innerWidth - 80) + 'px'; meu.style.top = Math.min(Math.max(0, e.clientY - dy), innerHeight - 40) + 'px'; };
      const u = () => { document.removeEventListener('mousemove', m); document.removeEventListener('mouseup', u); };
      document.addEventListener('mousemove', m); document.addEventListener('mouseup', u);
    });

    const pega = async url => { const r = await fetch(url, { cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || j.erro) throw new Error(j.erro || 'erro ' + r.status); return j; };
    let raz = null, tit = null;
    try { raz = await pega('/financeiro/api/razao/lancamentos?conta=' + encodeURIComponent(conta) + '&de=' + ano + '-01-01&ate=' + ano + '-12-31'); }
    catch (e) { meu.querySelector('[data-raz]').innerHTML = '<div class="rc-vz">' + esc(e.message) + '</div>'; }
    try { tit = await pega('/financeiro/api/fluxo/conta/' + encodeURIComponent(conta)); }
    catch (e) { meu.querySelector('[data-tit]').innerHTML = '<div class="rc-vz">' + esc(e.message) + '</div>'; }

    if (raz) {
      const ls = raz.lancamentos || [], v = x => x ? brl(x) : '';
      meu.querySelector('[data-raz]').innerHTML = ls.length ? '<table class="rc-tab"><thead><tr><th>Data</th><th>Histórico</th><th>C/Part.</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr></thead><tbody>'
        + ls.map(l => '<tr' + (l.saldoAnterior ? ' class="ant"' : acende(l.historico, l.debito, l.credito) ? ' class="luz"' : '') + '><td>' + br(l.data) + '</td><td>' + esc(l.historico) + '</td><td class="cn">' + esc(l.cPartida || '') + (l.cPartidaNome ? ' ' + esc(l.cPartidaNome) : '') + '</td>'
          + '<td class="n deb">' + v(l.debito) + '</td><td class="n cre">' + v(l.credito) + '</td><td class="n"><b>' + brl(l.saldo) + '</b></td></tr>').join('') + '</tbody></table>'
        : '<div class="rc-vz">Nenhum lançamento em ' + ano + '.</div>';
      const r1 = meu.querySelector('[data-raz]');
      const luz = r1.querySelector('tr.luz');
      if (luz) luz.scrollIntoView({ block: 'center' }); else r1.scrollTop = r1.scrollHeight;   // abre no achado ou no ultimo
      if (nf || vc) {
        const nR = ls.filter(l => !l.saldoAnterior && acende(l.historico, l.debito, l.credito)).length;
        r1.insertAdjacentHTML('beforebegin', '<div class="rc-achou">Procurando' + (nf ? ' a nota ' + esc(nf) : '') + (nf && vc ? ' ou' : '') + (vc ? ' o valor R$ ' + brl(vc / 100) : '')
          + ': ' + (nR ? nR + ' lançamento(s) no razão (em amarelo) — veja se já foi pago' : 'nenhum lançamento no razão') + '</div>');
      }
    }
    let somaReal = 0, somaFora = 0;
    if (tit) {
      const ls = tit.linhas || [];
      ls.forEach(l => { if (REAL.has(Number(l.pos))) somaReal += cent(l.valor); else somaFora += cent(l.valor); });
      // 19/10/2026 (Jorge): coluna SALDO corrido, no mesmo sinal do razao (fornecedor negativo, cliente positivo):
      // a ultima linha tem que dar o saldo do razao. Pedido/projecao/orcamento nao somam (linha cinza, sem saldo).
      const sinal = String(conta).startsWith('2') ? -1 : 1;
      let corre = 0;
      meu.querySelector('[data-tit]').innerHTML = ls.length ? '<table class="rc-tab"><thead><tr><th>Venc.</th><th>Histórico</th><th>Tipo</th><th class="n">Valor</th><th class="n">Saldo</th></tr></thead><tbody>'
        + ls.map(l => { const real = REAL.has(Number(l.pos)); if (real) corre += cent(l.valor);
          return '<tr' + (acende(l.historico, l.valor) ? ' class="luz"' : real ? '' : ' class="fora" title="não é dívida ainda: fica fora da conferência"') + '><td>' + br(l.vencimento) + '</td><td>' + esc(l.historico)
          + (l.parcela ? ' · ' + l.parcela + '/' + (l.totalParcelas || '') : '') + '</td><td class="cn">' + (POS[l.pos] || 'pos ' + l.pos) + '</td><td class="n">' + brl(l.valor) + '</td>'
          + '<td class="n"><b>' + (real ? brl(sinal * corre / 100) : '') + '</b></td></tr>'; }).join('')
        + '</tbody></table>' : '<div class="rc-vz">Nenhum título em aberto no fluxo.</div>';
    }
    // conferencia: cliente (1.x) saldo devedor = a receber; fornecedor (2.x) saldo credor = a pagar
    const pe = meu.querySelector('[data-pe]'), fechar = '<button type="button" data-x>Fechar</button>';
    if (raz && tit) {
      const saldo = cent(raz.saldo), esperado = String(conta).startsWith('2') ? -saldo : saldo, dif = somaReal - esperado;
      pe.innerHTML = '<span>Saldo do razão: R$ ' + brl(saldo / 100) + (saldo < 0 ? ' (credor)' : saldo > 0 ? ' (devedor)' : '') + '</span>'
        + '<span>Títulos em aberto: R$ ' + brl(somaReal / 100) + '</span>'
        + (Math.abs(dif) < 1 ? '<span class="ok">✓ bate</span>' : '<span class="er">✗ diferença R$ ' + brl(dif / 100) + '</span>')
        + (somaFora ? '<span class="cn" style="font-weight:600;color:#6b7280">(fora da conta: pedidos/projeções R$ ' + brl(somaFora / 100) + ')</span>' : '') + fechar;
    } else pe.innerHTML = '<span class="er">Não deu para conferir.</span>' + fechar;
    pe.querySelector('[data-x]').addEventListener('click', () => { meu.remove(); if (jan === meu) jan = null; });
  }

  window.RazaoConta = { abrir };
})();
