// =============================================================================
// Destino: C:\plataformaRota\src\utils\compra\lerNfe.js
// Criado em:   25/09/2026
// Alterado em: 25/09/2026 — passa a extrair TODOS os campos que o DANFE mostra.
//
// Le o XML de uma NF-e (modelo 55) e devolve um objeto pronto para virar
// documento em _compra_notas_entrada.
//
// Aceita tanto <nfeProc> (nota autorizada, com protocolo) quanto <NFe> solto.
// Usa cheerio em modo XML, que ja esta no package.json.
//
// Dinheiro sempre em CENTAVOS, inteiro.
// Aliquotas e pesos em NUMERO (7,00 vira 7; 164,920 vira 164.92).
// Nao acessa banco nem rede: recebe texto, devolve objeto. Facil de testar.
//
// O QUE ENTROU NESTA VERSAO (para a tela em formato DANFE):
//   natureza da operacao, data de saida, destinatario, protocolo de autorizacao,
//   base de calculo do ICMS / valor do ICMS / BC do ST / outras despesas,
//   CST, origem, BC, ICMS e aliquotas por item, volumes transportados,
//   endereco da transportadora, informacoes complementares.
// =============================================================================

'use strict';

const cheerio = require('cheerio');

// modFrete da NF-e -> nossa convencao
// 0 = por conta do emitente      -> CIF
// 1 = por conta do destinatario  -> FOB
// 2 = por conta de terceiros     -> FOB
// 3 = proprio, por conta do emitente     -> CIF
// 4 = proprio, por conta do destinatario -> FOB
// 9 = sem frete
const FRETE = { '0': 'CIF', '1': 'FOB', '2': 'FOB', '3': 'CIF', '4': 'FOB', '9': '' };

function centavos(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function numero(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function data(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// dVenc vem como "2026-11-16", sem hora. Fixo ao meio-dia UTC para a data
// nao escorregar de dia por fuso.
function dataSimples(v) {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
  return isNaN(d) ? null : d;
}

function limpo(v) {
  return String(v ?? '').trim();
}

// EAN "SEM GTIN" e o texto que a NF-e usa quando o produto nao tem codigo
function ean(v) {
  const s = limpo(v).toUpperCase();
  return (!s || s === 'SEM GTIN') ? '' : limpo(v);
}

// ---------------------------------------------------------------------------
function lerNfe(xml) {
  if (!xml || typeof xml !== 'string') {
    throw new Error('XML vazio');
  }

  const $ = cheerio.load(xml, { xml: { xmlMode: true, decodeEntities: true } });

  const infNFe = $('infNFe').first();
  if (!infNFe.length) {
    throw new Error('não parece uma NF-e: não achei o bloco infNFe');
  }

  const t = (sel, ctx) => limpo($(sel, ctx).first().text());

  // ---- identificacao ------------------------------------------------------
  const chave = (infNFe.attr('Id') || '').replace(/^NFe/i, '');
  const modelo = t('ide > mod') || '55';

  if (modelo !== '55') {
    throw new Error('modelo ' + modelo + ' não é nota de mercadoria (esperado 55)');
  }

  // tpNF: 0 entrada, 1 saida. Do ponto de vista do EMITENTE — para nos,
  // a saida dele e a nossa entrada.
  const tpNF = t('ide > tpNF');

  // ---- emitente -----------------------------------------------------------
  const emit = $('emit').first();
  const emitente = {
    cnpj:       t('CNPJ', emit) || t('CPF', emit),
    razao:      t('xNome', emit),
    fantasia:   t('xFant', emit),
    inscricao:  t('IE', emit),
    logradouro: [t('enderEmit > xLgr', emit), t('enderEmit > nro', emit)]
                  .filter(Boolean).join(', '),
    complemento:t('enderEmit > xCpl', emit),
    bairro:     t('enderEmit > xBairro', emit),
    cidade:     t('enderEmit > xMun', emit),
    uf:         t('enderEmit > UF', emit),
    cep:        t('enderEmit > CEP', emit),
    fone:       t('enderEmit > fone', emit),
  };

  // ---- destinatario -------------------------------------------------------
  // Serve para conferir que a nota e mesmo nossa antes de efetivar.
  const dest = $('dest').first();
  const destinatario = {
    cnpj:      t('CNPJ', dest) || t('CPF', dest),
    razao:     t('xNome', dest),
    inscricao: t('IE', dest),
    cidade:    t('enderDest > xMun', dest),
    uf:        t('enderDest > UF', dest),
  };

  // ---- totais -------------------------------------------------------------
  const tot = $('ICMSTot').first();
  const totais = {
    valorBcIcms:    centavos(t('vBC', tot)),
    valorIcms:      centavos(t('vICMS', tot)),
    valorBcIcmsSt:  centavos(t('vBCST', tot)),
    valorIcmsSt:    centavos(t('vST', tot)),
    valorProdutos:  centavos(t('vProd', tot)),
    valorFrete:     centavos(t('vFrete', tot)),
    valorSeguro:    centavos(t('vSeg', tot)),
    valorDesconto:  centavos(t('vDesc', tot)),
    valorOutras:    centavos(t('vOutro', tot)),
    valorIpi:       centavos(t('vIPI', tot)),
    valorTotal:     centavos(t('vNF', tot)),
  };

  // ---- transporte ---------------------------------------------------------
  const modFrete = t('transp > modFrete');
  const transp = $('transporta').first();

  const volumes = [];
  $('transp > vol').each((i, e) => {
    volumes.push({
      quantidade:  numero(t('qVol', e)),
      especie:     limpo(t('esp', e)),
      marca:       limpo(t('marca', e)),
      numeracao:   limpo(t('nVol', e)),
      pesoBruto:   numero(t('pesoB', e)),
      pesoLiquido: numero(t('pesoL', e)),
    });
  });

  // ---- duplicatas ---------------------------------------------------------
  const duplicatas = [];
  $('cobr > dup').each((i, e) => {
    duplicatas.push({
      numero:     t('nDup', e),
      vencimento: dataSimples(t('dVenc', e)),
      valor:      centavos(t('vDup', e)),
    });
  });

  // ---- itens --------------------------------------------------------------
  const itens = [];
  $('det').each((i, e) => {
    const prod = $('prod', e).first();
    const imp  = $('imposto', e).first();

    const vProd = centavos(t('vProd', prod));
    const vIpi  = centavos(t('IPI vIPI', imp));
    // o ST aparece em caminhos diferentes conforme o CST; pega qualquer um
    const vSt   = centavos(t('ICMS vICMSST', imp) || t('ICMS vICMSSTRet', imp));
    const vDesc = centavos(t('vDesc', prod));
    const vFreteItem = centavos(t('vFrete', prod));
    const vSegItem   = centavos(t('vSeg', prod));
    const vOutroItem = centavos(t('vOutro', prod));

    const qtd = numero(t('qCom', prod));

    // custo provisorio do item. O definitivo sai do metodo calcularCustoReal
    // do model, que rateia frete, seguro e outras despesas da NOTA.
    const totalItem = vProd + vIpi + vSt + vFreteItem + vSegItem + vOutroItem - vDesc;

    itens.push({
      numeroItem:    Number($(e).attr('nItem')) || (i + 1),
      codigoFornec:  limpo(t('cProd', prod)),
      ean:           ean(t('cEAN', prod)),
      eanTributavel: ean(t('cEANTrib', prod)),
      descricaoXml:  limpo(t('xProd', prod)),
      ncm:           limpo(t('NCM', prod)),
      cest:          limpo(t('CEST', prod)),
      cfop:          limpo(t('CFOP', prod)),
      unidade:       limpo(t('uCom', prod)),
      infoAdicional: limpo(t('infAdProd', e)),

      quantidade:    qtd,
      valorUnitario: centavos(t('vUnCom', prod)),
      valorTotal:    vProd,
      desconto:      vDesc,
      frete:         vFreteItem,
      seguro:        vSegItem,
      outras:        vOutroItem,
      ipi:           vIpi,
      icmsSt:        vSt,

      // tributacao, para a tela ficar igual ao DANFE
      origem:   limpo(t('ICMS orig', imp)),
      cst:      limpo(t('ICMS CST', imp) || t('ICMS CSOSN', imp)),
      bcIcms:   centavos(t('ICMS vBC', imp)),
      icms:     centavos(t('ICMS vICMS', imp)),
      aliqIcms: numero(t('ICMS pICMS', imp)),
      aliqIpi:  numero(t('IPI pIPI', imp)),

      rateio: 0,
      custoUnitarioReal: qtd ? Math.round(totalItem / qtd) : 0,

      produto: null,
      codigoProd: null,
      vinculadoPor: '',
      quantidadeConferida: 0,
    });
  });

  if (!itens.length) {
    throw new Error('a nota não tem itens');
  }

  // ---- protocolo de autorizacao ------------------------------------------
  const cStat = t('protNFe cStat');
  const autorizada = !cStat || cStat === '100' || cStat === '150';

  return {
    chaveAcesso: chave,
    numero:      t('ide > nNF'),
    serie:       t('ide > serie'),
    modelo,
    naturezaOperacao: t('ide > natOp'),
    dataEmissao: data(t('ide > dhEmi') || t('ide > dEmi')),
    dataSaida:   data(t('ide > dhSaiEnt') || t('ide > dSaiEnt')),

    emitente,
    destinatario,

    ...totais,

    frete: FRETE[modFrete] ?? '',
    modFrete,
    transportadoraXml: transp.length
      ? {
          cnpj:      t('CNPJ', transp) || t('CPF', transp),
          razao:     t('xNome', transp),
          inscricao: t('IE', transp),
          endereco:  t('xEnder', transp),
          cidade:    t('xMun', transp),
          uf:        t('UF', transp),
        }
      : { cnpj: '', razao: '', inscricao: '', endereco: '', cidade: '', uf: '' },
    volumes,

    duplicatas,
    itens,

    protocolo: {
      numero: t('protNFe nProt'),
      data:   data(t('protNFe dhRecbto')),
      status: cStat,
      motivo: t('protNFe xMotivo'),
    },

    informacoesComplementares: t('infAdic > infCpl'),

    // diagnostico, nao vai para o banco
    _aviso: {
      naoAutorizada: !autorizada ? (t('protNFe xMotivo') || 'sem protocolo') : null,
      entradaNoEmitente: tpNF === '0',
      semDuplicatas: duplicatas.length === 0,
      itensSemEan: itens.filter(i => !i.ean).length,
    },
  };
}

module.exports = { lerNfe };
