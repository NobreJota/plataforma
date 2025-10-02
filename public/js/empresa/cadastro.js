// BUSCA OS SEGMENTO PARA PREENCHER O COMBO SELECT/CADASTRO DE PRODUTO
document.addEventListener("DOMContentLoaded", async () => {
   
    //console.log(' [ 4 => js/empresa/cadastro.js => document.addEventListener("DOMContentLoaded');
        try {
            document.getElementById('select_departamento').addEventListener("click",async(e)=>{
               if (e.target && e.target.id === "selectSetor") {
                  const setorId = e.target.value;
            
                  const selectetdepartamento = document.getElementById("select_departamento");
                  console.log(' [7]',selectetdepartamento) 
                  const response = await fetch("/segmento/selectlista");
            
                  if (!response.ok) throw new Error("Erro na resposta");
            
                  const departamentos = await response.json();
                  console.log(' 13 ',departamentos)
                  if (!Array.isArray(departamentos)) throw new Error("Resposta não é uma lista");

                            departamentos.forEach(dep => {
                              console.log(dep.nomeDepartamento)
                              const opt = document.createElement("option");
                              opt.value = dep._id;
                              opt.textContent = dep.nomeDepartamento;
                              selectetdepartamento.appendChild(opt);
                          });
                        }          
           });    
        } catch (e) {
            //console.log(selectetdepartamento)
            console.error("Erro ao carregar segmentos:", e);
        }
  });

//{{!-- FECHANDO MODAL CADASTRO DE PRODUTO --}}
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("fecharForm").addEventListener("click",async (e) => {
      if (e.target && e.target.id === "selectSetor") {
         const setorId = e.target.value;
         document.getElementById("cadastroProdutoModal").style.display="none";
      } 
    });
})

//{{!-- CONTROLA "ENTER" DENTRO DO INPUT TROCANDO CORES QUANDO HÁ FOCO --}}
// PERTENCE AO MODAL?CADASTRO DE PRODUTO
document.addEventListener("DOMContentLoaded", function () {
        const inputs = document.querySelectorAll("form input, form select");
       // console.log(' [ 84 js/empresa/cadastro.js ]');
        if (inputs.length === 0) {
          console.warn("Nenhum input ou select encontrado.");
          return;
        }
            // Intercepta Enter nos campos
        inputs.forEach((input, index) => {
        //  console.log('99 ====>')
          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              e.preventDefault(); // evita submit do formulário

              // Destaca o campo atual como preenchido
              input.style.backgroundColor = "#cce5ff"; // azul claro

              // Se existe próximo input, foca nele e destaca
              const nextInput = inputs[index + 1];
              if (nextInput) {
                nextInput.focus();
                nextInput.style.backgroundColor = "#fff3cd"; // amarelo claro
              }
            }
          });

          // Quando o input recebe foco, pode redefinir cores se quiser
          input.addEventListener("focus", function () {
            input.style.backgroundColor = "#fff3cd"; // amarelo claro
          });

          // Quando sai do input, remove o amarelo se não estiver preenchido
          input.addEventListener("blur", function () {
            if (input.value === "") {
              input.style.backgroundColor = ""; // volta ao normal
            }
          });
    });
});

//BUSCA AS SEÇÕES QUANDO SE SELECIONA O SETOR
document.addEventListener("DOMContentLoaded", function () {
  const X=document.getElementById("selectSetor")
      X.addEventListener("change", async (e) => {
              if (e.target && e.target.id === "selectDepto") {
                    const setorId = e.target.value;
                    console.log("Setor selecionado:", setorId);
                    console.log('--------------------------------')
                    console.log(' [ 133 js/empresa/cadastro.js ]');
                  

                    if (!setorId) return;

                    try {
                      //console.log('10000')
                          const response = await fetch(`/segmento/secoes/${setorId}`);
                          const secoes = await response.json();
                      //console.log('[ 1021 ]',secoes);
                      ///////////////////////////////////////////////
                      //const node0=document.createElement("select")
                      //node0.setAttribute("id",'5890')
                      //node0.setAttribute("class","selectClass")
                      //document.getElementById('selectSecao').appendChild(node0)
                      ///////////////////////////////////////////////////////////////////////                     
                    
                              secoes.forEach(secao => {
                                ////////////////////////////////////////////////////////
                                const opt = document.createElement("option");
                                    opt.value = secao._id;
                                    opt.textContent = secao.titulo;
                                    document.getElementById("selectSecao").appendChild(opt)
                                  //  let r=document.getElementById("5890")
                                  //  r.appendChild(opt);
                              });
                    } catch (e) {
                      console.error("Erro ao carregar seções:", e);
                    }
              };
          });      
});



//{{!-- GRAVANDO PRODUTO ==> --}}
document.getElementById("cadastroProdutoForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      try{    
          console.log("--------------------------------");
          console.log(' [ 135 js/empresa/cadastro.js =>GRAVANDO PRODUTO ]');
          console.log(' [ vem de : views/page;empresa/produtos.handlebars ]');
          console.log('');

          const select = document.getElementById("selectFornecedores");
          const loja_id = document.getElementById("IddoLojista").value;
           if ( !loja_id  ) {
               alert("Error: falta o _ID da loja.");
               return;
          }
          const codigo = document.getElementById("cadastroCodigo").value;
           if ( !codigo  ) {
               alert("Preencha o campo codigo.");
               return;
          }
          const marcaloja =document.getElementById("cadastroMarca").value;
          if (   !marcaloja  ) {
                alert("Preencha o campo marcaloja.");
                return;
          }
          const descricao = document.getElementById("cadastroDescricao").value;
           if (  !descricao  ) {
               alert("Preencha o campo descrição.");
               return;
          }
          const complete = document.getElementById("cadastroComplemento").value;
           if (  !complete   ) {
               alert("Preencha o campo complete.");
               return;
          }
          const referencia = document.getElementById("cadastroReferencia").value;
           if (  !referencia  ) {
               alert("Preencha o campo referência.");
               return;
          }
          const pageurl="http:";
          const fornecedor = select.options[select.selectedIndex].value;
           if (  !fornecedor ) {
               alert("Preencha o campo fornecedor.");
               return;
          }
          // Estamos gravando os nome da cidade e do bairro para faciliar a consulta
          const cidade = document.getElementById("cadastroCidade").innerText.trim();
          if ( !cidade  ) {
               alert("Preencha o campo  cidade.");
               return;
          }
          const bairro = document.getElementById("cadastroBairro").innerText.trim();
          if ( !bairro ) {
               alert("Preencha o campo  bairro.");
               return;
          }
          const ativo=1;
          const qte = document.getElementById("cadastroQte").value;
          if ( !qte  ) {
               alert("Preencha o campo  qte.");
               return;
          }
          const qte_negativa=0
          const qte_reservada=0
          const e_max=0
          const e_min=0
          const precocusto = document.getElementById("cadastroPrecoCusto").value;
          if (  !precocusto  ) {
               alert("Preencha o campo  precocusto.");
               return;
          }
          const precovista = document.getElementById("cadastroPrecoVista").value;
          if ( !precovista  ) {
               alert("Preencha o campo precovista.");
               return;
          }
          const precoprazo = document.getElementById("cadastroPrecoPrazo").value;
          if ( !precoprazo ) {
               alert("Preencha o campo  precoprazo.");
               return;
          }
          const segmento = document.getElementById("select_departamento").value;
          if ( !segmento ) {
               alert("Preencha o campo  segmento.");
               return;
          }
          const setor = document.getElementById("selectSetor").value;
          const secao = document.getElementById("selectSecao").value;
          const body = {
            loja_id,
            codigo,
            marcaloja,
            descricao,
            complete,
            referencia,
            pageurl,
            fornecedor,
            cidade,
            bairro,
            ativo,
            qte,
            qte_negativa,
            qte_reservada,
            e_max,
            e_min,
            precocusto,
            precovista,
            precoprazo,
            similares: [],
            localloja: [{
                    departamento: [segmento], // ← array mesmo com um único valor
                        setor: [
                          {
                            nameSetor: setor,
                            secao: secao ? { nameSecao: secao } : null
                          }
                        ]
                          }]
          };

          try {
              const response = await fetch("/produto/gravarproduto", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
              });

              if (response.ok) {
                alert("Produto cadastrado com sucesso!");
                // AQUI ABRE O MODAL PARA GRAVAR IMAGENS DO PRODUTO
                const data = await response.json();
                const { produtoId,  departamentoNome } = data;

                abrirModalImagens(descricao,fornecedor,{ produtoId,departamentoNome }); 
                e.target.reset(); // limpa o formulário
                // Não fecha o modal por que vai cadastrar mais um produto
              } else {
                const erro = await response.json();
                alert("Erro: " + (erro.error || "Erro desconhecido"));
              }
          } catch (error) {
              console.log("Erro ao cadastrar produto:", error);
               alert("Erro ao cadastrar produto.");
          }
 } catch (err) {
         console.error("Erro ao salvar produto:", err);
        // res.status(500).send("Erro ao salvar produto");
      }     
});

// ENVIANDO A IMAGE
async function enviarImagem(file, posicao) {
  try {
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;

    const res = await fetch(`/gravafoto/getpresignedurl?filename=${encodeURIComponent(filename)}&filetype=${encodeURIComponent(file.type)}`);
    const data = await res.json();

    console.log('');
    console.log('[ 241 js/empresa/cadastro/enviarImagem',data);
    console.log('');
    if (!data.uploadUrl) {
      alert("Erro ao gerar a URL de upload.");
      return;
    }

    const upload = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file
    });

    if (upload.ok) {
      const publicUrl = data.uploadUrl.split("?")[0];
      alert("Upload realizado com sucesso!");
      document.getElementById("previewImg1").src = publicUrl;
      document.getElementById("imagemPrincipal").value = publicUrl;
      alert("Imagem enviada com sucesso!");
    } else {
      alert("Erro no upload.");
    }

  } catch (e) {
    console.error("Erro:", e);
    alert("Erro geral ao tentar gerar URL ou fazer upload.");
  }
}

//MOSTRANDO A IMAGEM NO SRC+""
function mostrarImagemPreview(url) {
    console.log(' [ 343 js/empresa/cadastro.js => mostrarImagemPreview]');
    const previewArea = document.getElementById("previewArea");
    previewArea.innerHTML = `<img src="${url}" alt="Imagem enviada" style="max-width: 200px; border: 1px solid #ccc;">`;
}

 // FECHANDO CADASTRO MODAL 
function closeCadastroProdutoModal() {
    console.log(' [ 350 js/empresa/cadastro.js => closeCadastroProdutoModal]');
    document.getElementById("cadastroProdutoModal").style.display = "none";
}

//VALIDAR OS VALORES DIGITADO +> PCUSTO<>PRECOVISTA<>PRECOPRAZO
function validarFormulario() {
    console.log(' [ 381 js/empresa/cadastro.js => validarFormulario]');
    const custo = parseFloat(document.getElementById("cadastroPrecoCusto").value);
    const vista = parseFloat(document.getElementById("cadastroPrecoVista").value);
    const prazo = parseFloat(document.getElementById("cadastroPrecoPrazo").value);

    if (isNaN(custo) || custo < 0) {
      alert("Preço de custo inválido.");
      return false;
    }
    if (isNaN(vista) || vista < 0) {
      alert("Preço à vista inválido.");
      return false;
    }
    if (isNaN(prazo) || prazo < 0) {
      alert("Preço a prazo inválido.");
      return false;
    }

    return true; // formulário pode ser enviado
}

// Função para deletar o produto
function deleteProduct(id) {
        console.log(' [ 404 js/empresa/cadastro.js => f=deleteProduct]');
        if (confirm("Tem certeza que deseja deletar o produto?")) {
                fetch(`/lojista/delete/${id}`, {
                method: "DELETE",
                })
            .then((response) => {
                if (response.ok) {
                alert("Produto deletado com sucesso!");
                document.querySelector(`tr[data-id="${id}"]`).remove(); // Remove linha da tabela
                } else {
                alert("Falha ao deletar produto");
                }
            })
            .catch((err) => {
                console.log(err);
            });
        }
}



function abrirmodalprodutoSimilar(){
  console.log("alô!")
}

function abrirModalProduto(produto) {
  const preco = parseFloat(produto.precovista?.$numberDecimal || '0').toFixed(2);
  const similares = produto.similares || [];

  let html = `
    <div><strong>Código:</strong> ${produto.codigo}</div>
    <div><strong>Descrição:</strong> ${produto.descricao}</div>
    <div><strong>Referência:</strong> ${produto.referencia}</div>
    <div><strong>Fornecedor:</strong> ${produto.fornecedor?.marca || ''}</div>
    <div><strong>Preço Vista:</strong> R$ ${preco}</div>
    <div><strong>Similares:</strong> ${similares.length}</div>
    <div id="listaSimilares" class="mt-3">`;

  if (similares.length === 0) {
    html += `<div class="text-muted">Nenhum similar vinculado</div>`;
  } else {
    similares.forEach(sim => {
      html += `
        <div class="d-flex justify-content-between align-items-center border p-2 mb-2 rounded">
          <em>${sim.codigo} - ${sim.descricao}</em>
          <button class="btn btn-success btn-sm" onclick="desvincularSimilar('${produto._id}', '${sim._id}')">desvincular</button>
        </div>`;
    });
  }

  html += `</div>
    <div class="d-grid mt-3">
      <button class="btn btn-primary btn-sm" onclick="abrirModalVinculo('${produto._id}')">+ vincular</button>
    </div>`;

  document.getElementById("conteudoModalProduto").innerHTML = html;

  // Abre o modal RENOMEADO
  const modal = new bootstrap.Modal(document.getElementById("modalProdutoVinculo"));
  modal.show();

  baseId = produto._id;
}

function abrirModalProdutoVincular(produto) {
  const preco = parseFloat(produto.precovista?.$numberDecimal || '0').toFixed(2);
  const similares = produto.similares || [];

  let html = `
    <div><strong>Código:</strong> ${produto.codigo}</div>
    <div><strong>Descrição:</strong> ${produto.descricao}</div>
    <div><strong>Referência:</strong> ${produto.referencia}</div>
    <div><strong>Fornecedor:</strong> ${produto.fornecedor?.marca || ''}</div>
    <div><strong>Preço Vista:</strong> R$ ${preco}</div>
    <div><strong>Similares:</strong> ${similares.length}</div>
    <div id="listaSimilares" class="mt-3">
  `;

  if (similares.length === 0) {
    html += `<div class="text-muted">Nenhum similar vinculado</div>`;
  } else {
    similares.forEach(sim => {
      html += `
        <div class="d-flex justify-content-between align-items-center border p-2 mb-2 rounded">
          <em>${sim.codigo} - ${sim.descricao}</em>
          <button class="btn btn-success btn-sm" onclick="desvincularSimilar('${produto._id}', '${sim._id}')">desvincular</button>
        </div>`;
    });
  }

  html += `</div>`;

  // Botão para abrir o modal de vínculo
  html += `
    <div class="d-grid mt-3">
      <button class="btn btn-primary btn-sm" onclick="abrirModalVinculo('${produto._id}')">+ vincular</button>
    </div>
  `;

  document.getElementById("conteudoModalProduto").innerHTML = html;

  // abre modal principal
  const modal = new bootstrap.Modal(document.getElementById("modalProduto"));
  modal.show();
}

//{{!-- SE MUDAR O TEXTO DE SEGMENTO ENTÃO: --}}
//document.getElementById("selectSegmento").addEventListener("click", async function () {
function executarAcaoComDataset(selectEl) {
  console.log('');
  const acao = selectEl.value;
  const id = selectEl.dataset.id;
  const descricao = selectEl.dataset.descricao;
  const fornecedor = selectEl.dataset.fornecedor;
  const departamento = selectEl.dataset.departamento;
  executarAcao(acao, id, descricao,fornecedor,departamento);
}







