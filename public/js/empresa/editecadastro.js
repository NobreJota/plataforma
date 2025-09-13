
function openEditModal(id) {
            
            console.log(' [ 3 ] js/empresa/editecadastro => f=OpenEditModal') 
            let row = document.querySelector(`tr[data-id="${id}"]`);
            // console.log(" [ 5 ] ",row.cells[0].innerText);
            //let id=row.cells[1].innerText;
            let codigo = row.cells[2].innerText;
            // console.log('[ 6 editecadastro.js OpenEditModal',codigo)
            let descricao = row.cells[3].innerText;
            let complemento = row.cells[4].innerText;
            let refer = row.cells[5].innerText;
            let fornecedor = row.cells[6].innerText;
            let qte = row.cells[7].innerText;
            let precoCusto = row.cells[8].innerText;
            let precoVista = row.cells[9].innerText;
            let precoPrazo = row.cells[10].innerText;

            // Preenche os campos do modal com os valores
            console.log(id)
            document.getElementById("editId").innerText = id;
            console.log(document.getElementById("editId"))
            document.getElementById("editCodigo").value = codigo;
            document.getElementById("editDescricao").value = descricao;
            document.getElementById("editComplemento").value = complemento;
            document.getElementById("editRefer").value = refer;
            document.getElementById("editFornec").value = fornecedor;
            document.getElementById("editQte").value = qte;
            document.getElementById("editPrecoCusto").value = precoCusto;
            document.getElementById("editPrecoVista").value = precoVista;
            document.getElementById("editPrecoPrazo").value = precoPrazo;

            // Exibe o modal
            document.getElementById("editModal").style.display = "flex";
            document.getElementById("editCodigo").style.backgroundColor="yellow";
            document.getElementById("editCodigo").style.color="black";
            document.getElementById("editCodigo").focus();
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
            fornec.focus();
        }
})

fornec.addEventListener("keydown", function (event) {
        console.log(' [ 66 ] js/empresa/editecadastro => clicou em editFornec') 
        event.stopPropagation();
        if (event.key === "Enter") { // Verifica se a tecla pressionada foi "Enter"
            event.preventDefault(); // Evita ações padrão, como envio de formulário
            fornec.style.backgroundColor="red";
            fornec.style.color="black";
            qte.style.backgroundColor="blu";
            qte.style.color="black";
            qte.focus();
        }
})

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

// Função para salvar edição via Fetch API
document.getElementById("editForm").addEventListener("submit", function (e) {
        e.preventDefault();
                console.log(' [ 143 ] js/empresa/editecadastro => clicou submit EditMoadal');

                let id = document.getElementById("editId").innerText;
                let codigo=document.getElementById("editCodigo").value;
                let descricao = document.getElementById("editDescricao").value;
                let complete=document.getElementById("editComplemento").value;
                let referencia=document.getElementById("editRefer").value;
                let fornecedor=document.getElementById("editFornec").value;
                let qte = document.getElementById("editQte").value;
                let precocusto = document.getElementById("editPrecoCusto").value;
                let precovista=document.getElementById("editPrecoVista").value;
                let precoprazo=document.getElementById("editPrecoPrazo").value;
                   

                let body = {
                    codigo,
                    descricao,
                    complete,
                    referencia,
                    fornecedor,
                    qte,
                    precocusto,
                    precovista,
                    precoprazo
                };
                 console.log(' body para edição = >',body)
                
                console.log('===>',id)

                fetch(`/produto/alterar/${id}`, {
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