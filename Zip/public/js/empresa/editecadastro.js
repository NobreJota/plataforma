
function openEditModal(id) {
    console.log(' [ 3 ] js/empresa/editecadastro => f=OpenEditModal',id) 
    let row = document.querySelector(`tr[data-id="${id}"]`);
   
    let codigo = row.cells[2].innerText;
   
    let descricao = row.cells[3].innerText;
    let complemento = row.cells[4].innerText;
    let refer = row.cells[5].innerText;
   
    let qte = row.cells[8].innerText;
    let precoCusto = row.cells[9].innerText;
    let precoVista = row.cells[10].innerText;
    let precoPrazo = row.cells[11].innerText;
    let ativoTexto = (row.dataset.ativo || '').trim();
    //////////////////////////////////////////////////////////////////////
      console.log("Status atual =", ativoTexto);

       // const selAtivo = document.getElementById("editAtivo");

        // pega a option ATUAL
        const optAtual = selAtivo.querySelector('option[value="ATUAL"]');

        // texto exibido no select
        optAtual.textContent = `ATUAL (${ativoTexto})`;

        // seleciona a opção atual
        selAtivo.value = "ATUAL";


    //////////////////////////////////////////////////////////////////////
    // Preenche os campos do modal com os valores
    document.getElementById("edit-Id").innerText = id;
    console.log(document.getElementById("edit-Id"))
    document.getElementById("editCodigo").value = codigo;
    document.getElementById("editDescricao").value = descricao;
    document.getElementById("editComplemento").value = complemento;
    document.getElementById("editRefer").value = refer;
    
    document.getElementById("editQte").value = qte;
    document.getElementById("editPrecoCusto").value = precoCusto;
    
    document.getElementById("editPrecoVista").value = precoVista;
    document.getElementById("editPrecoPrazo").value = precoPrazo;
   
    // Exibe o modal
    document.getElementById("editModal").style.display = "flex";
    //document.getElementById("editCodigo").style.backgroundColor="yellow";
    //document.getElementById("editCodigo").style.color="black";
    //document.getElementById("editCodigo").focus();
}
    let codig=document.getElementById("editCodigo");
    let descr=document.getElementById("editDescricao");
    let complement=document.getElementById("editComplemento");
    let refer=document.getElementById("editRefer");
    let fornec=document.getElementById("editFornec");
    
    let qte=document.getElementById("editQte");
    let pcusto=document.getElementById("editPrecoCusto");
    let pvista=document.getElementById("editPrecoVista");
    let pprazo=document.getElementById("editPrecoPrazo");
    const selAtivo = document.getElementById("editAtivo");

codig.addEventListener("keydown", function (event) {
        console.log(' [ 40 ] js/empresa/editecadastro => clicou em editCodigo') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            codig.style.backgroundColor="red";
            codig.style.color="black";
            descr.style.backgroundColor="yellow";
            descr.style.color="black";
            descr.focus();
        }
    })

descr.addEventListener("keydown", function (event) {
        console.log(' [ 52 ] js/empresa/editecadastro => clicou em editDescrição') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            descr.style.backgroundColor="red";
            complement.style.backgroundColor="blu";
            complement.style.color="black";
            complement.focus();
        }
});

complement.addEventListener("keydown", function (event) {
        console.log(' [ 79 ] js/empresa/editecadastro => clicou em editRefer') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            complement.style.backgroundColor="red";
            complement.style.color="black";
            refer.style.backgroundColor="blu";
            refer.style.color="black";
            refer.focus();
        }
})

refer.addEventListener("keydown", function (event) {
        console.log(' [ 79 ] js/empresa/editecadastro => clicou em editRefer') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            refer.style.backgroundColor="red";
            refer.style.color="black";
            fornec.style.backgroundColor="blur";
            fornec.style.color="black";
            fornec.qte();
        }
})

//fornec.addEventListener("keydown", function (event) {
//        console.log(' [ 66 ] js/empresa/editecadastro => clicou em editFornec') 
//        event.stopPropagation();
//        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
//            event.preventDefault(); // Evita ações padrão, como envio de formulário
//            fornec.style.backgroundColor="red";
//            fornec.style.color="black";
//            qte.style.backgroundColor="blu";
//            qte.style.color="black";
//            qte.focus();
//        }
//})

qte.addEventListener("keydown", function (event) {
        console.log(' [ 88 ] js/empresa/editecadastro => clicou em editQte') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            qte.style.backgroundColor="red";
            qte.style.color="black";
            pcusto.style.backgroundColor="blu";
            pcusto.style.color="black";
            pcusto.focus();
        }
})

pcusto.addEventListener("keydown", function (event) {
        console.log(' [ 100 ] js/empresa/editecadastro => clicou em editPrecoCusto') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            pcusto.style.backgroundColor="red";
            pcusto.style.color="black";
            pvista.style.backgroundColor="blu";
            pvista.style.color="black";
            pvista.focus();
        }
})

pvista.addEventListener("keydown", function (event) {
        console.log(' [ 112 ] js/empresa/editecadastro => clicou em editPrecoVista') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            pvista.style.backgroundColor="red";
            pvista.style.color="white";
            pprazo.style.backgroundColor="yellow";
            pprazo.focus();
        }
})

pprazo.addEventListener("keydown", function (event) {
        console.log(' [ 124 ] js/empresa/editecadastro => clicou em editPrecoPrazo') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
                event.preventDefault(); // Evita ações padrão, como envio de formulário
                pprazo.style.backgroundColor="red";
                pprazo.style.color="black";
                const confirmar = confirm("Deseja alterar os campos?");
                if (confirmar) {
                    const form = document.getElementById("editForm");
                    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
                } else {
                    closeEditModal(); // fecha o modal se clicar em "Não"
                }
        }
})

//////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
// ============================
// LOCALIZAÇÃO (localloja)
// ============================
const selDep   = document.getElementById('editDepartamento');
const selSet   = document.getElementById('editSetor');
const selSecao = document.getElementById('editSecao');

const SETORES_POR_DEPTO = window.SETORES_POR_DEPTO || {};
const SECOES_POR_SETOR  = window.SECOES_POR_SETOR  || {};

//console.log('XZY',window.SECOES_POR_SETOR)

function preencherSetores(depId) {
  if (!selSet) return;

  selSet.innerHTML = '<option value="">-- selecione --</option>';
  selSet.disabled = !depId;
  if (!depId) return;
  console.log('');
  console.log('[]', depId);
  console.log('');
  const lista = SETORES_POR_DEPTO[depId] || [];
  console.log('[191]',lista)
  lista.forEach(setor => {
    const opt = document.createElement('option');
    opt.value = setor._id;
    opt.textContent = setor.nomeSetor || '(sem nome)';
    selSet.appendChild(opt);
  });
}

function preencherSecoes(setorId) {
  if (!selSecao) return;

  selSecao.innerHTML = '';
  selSecao.disabled = !setorId;
  if (!setorId) return;

  const lista = SECOES_POR_SETOR[setorId] || [];
  lista.forEach(sec => {
    const opt = document.createElement('option');
    opt.value = sec._id;
    opt.textContent = sec.nomeSecao || '(sem nome)';
    selSecao.appendChild(opt);
  });
}

// eventos de mudança
if (selDep) {
  selDep.addEventListener('change', () => {
    
    const depId = selDep.value || '';
    console.log('565656',depId)
    preencherSetores(depId);
    // limpamos seções
    selSecao.innerHTML = '';
    selSecao.disabled = true;
  });
}

if (selSet) {
  selSet.addEventListener('change', () => {
    const setorId = selSet.value || '';
    preencherSecoes(setorId);
  });
}

/**
 * Preenche os selects a partir do produto recebido do backend
 * produto.localloja = [ { departamento:[id], setor:[{idSetor, secao:[{idSecao}]}] } ]
 */
function preencherLocalizacaoDoProduto(produto) {
    console.log('produto :',produto);
    console.log('produto.localloja :',produto.localloja);
    console.log('produto.lenght :',produto.localloja.length);
    if (!produto || !produto.localloja || !produto.localloja.length) {
        // não tem localloja ainda
        return;
    }

    const loc = produto.localloja[0];

    // 1) departamento
    const depId = Array.isArray(loc.departamento) && loc.departamento[0]
        ? String(loc.departamento[0])
        : '';

     console.log('passando AQUI')

    if (depId && selDep) {
        selDep.value = depId;
        preencherSetores(depId);
    }

    // 2) setor
    let setorId = '';
    if (Array.isArray(loc.setor) && loc.setor.length > 0) {
        const s = loc.setor[0];
        setorId = s.idSetor ? String(s.idSetor) : (s._id ? String(s._id) : '');
    }

    if (setorId && selSet) {
        selSet.value = setorId;
        preencherSecoes(setorId);
    }

    // 3) seções
    if (setorId && Array.isArray(loc.setor) && loc.setor[0] && Array.isArray(loc.setor[0].secao)) {
        const idsSecoes = loc.setor[0].secao
        .map(sc => sc.idSecao ? String(sc.idSecao) : (sc._id ? String(sc._id) : ''))
        .filter(Boolean);

        Array.from(selSecao.options).forEach(opt => {
        if (idsSecoes.includes(opt.value)) {
            opt.selected = true;
        }
        });
    }
}
///////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
let precocustoRaw = document.getElementById("editPrecoCusto").value;
let precovistaRaw = document.getElementById("editPrecoVista").value;
let precoprazoRaw = document.getElementById("editPrecoPrazo").value;

///////////////////////////////////////////////////////////////////////////////

//let ativoTexto = (row.dataset.ativo || '').trim(); // "ATIVO" ou "INATIVO"
      
///////////////////////////////////////////////////////////////////////////////////        
// Função para salvar edição via Fetch API
document.getElementById("editForm").addEventListener("submit", function (e) {
    e.preventDefault();
    console.log(' [ 143 ] js/empresa/editecadastro => clicou submit EditMoadal');
    ////////////////////////////////////////////////////////////////////////
    
    ///////////////////////////////////////////////////////////////////////
    let id = document.getElementById("edit-Id").innerText;
    let codigo=document.getElementById("editCodigo").value;
    let descricao = document.getElementById("editDescricao").value;
    let complete=document.getElementById("editComplemento").value;
    let referencia=document.getElementById("editRefer").value;
    let qte = document.getElementById("editQte").value;
    let precocusto = document.getElementById("editPrecoCusto").value;
    let precovista=document.getElementById("editPrecoVista").value;
    let precoprazo=document.getElementById("editPrecoPrazo").value;
    precocusto =normalizaPrecoInput(precocusto);
    precovista = normalizaPrecoInput(precovista);
    precoprazo = normalizaPrecoInput(precoprazo);

    //preencherLocalizacaoDoProduto(produto);
    const depId  = selDep ? selDep.value : '';
    const setorId = selSet ? selSet.value : '';
    const secoesIds = selSecao
       ? Array.from(selSecao.selectedOptions).map(o => o.value)
       : [];

    let localloja = [];

    if (depId || setorId || secoesIds.length) {
        const loc = {
        departamento: depId ? [depId] : [],
        setor: []
        };

        if (setorId) {
        loc.setor.push({
            idSetor: setorId,
            secao: secoesIds.map(idSecao => ({ idSecao }))
        });
        }

        localloja.push(loc);
    }

    function normalizaPrecoInput(valor) {
        if (valor === undefined || valor === null) return null;

        const txt = String(valor).trim();

        // se o usuário deixou vazio, consideramos 0
        if (!txt) return 0;              // 👉 se preferir "não alterar", podemos usar null

        // troca vírgula por ponto
        return txt.replace(',', '.');
    }

    // monta o body base
    let body = {
        codigo,
        descricao,
        complete,
        referencia,
        qte,
        precocusto,
        precovista,
        precoprazo,
        localloja        // <<=== aqui vai para o backend
    };

    // trata o campo ATIVO
    

    const escolha = selAtivo.value;

if (escolha === "true") {
    body.ativo = true;
}
else if (escolha === "false") {
    body.ativo = false;
}


    // só adiciona preço se tiver valor (aqui 0 já entra)
    if (precocusto !== null) body.precocusto = precocusto;
    if (precovista !== null) body.precovista = precovista;
    if (precoprazo !== null) body.precoprazo = precoprazo;


    console.log(' body para edição = >',body)
    console.log('[ 362 ]===>',id)

    fetch(`/produto/produto/alterar/${id}`, {
        method: "PUT",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    })
    .then((response) => {
        if (response.ok) {
            alert("Produto atualizado com sucesso!");
            location.reload();
        } else {
            alert("Falha na atualização");
        }
    })
    .catch((err) => {
            console.log(err);
        });
});

function closeEditModal() {
        document.getElementById("editModal").style.display = "none";
        console.log(' [ 137 ] js/empresa/editecadastro => deu enter em editPrecoPrazo para fechar o modalEdit')
        document.getElementById("editForm").style.display="block"
}

