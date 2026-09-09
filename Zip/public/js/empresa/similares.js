// {{!-- CARREGA MODAL FORM CADASTRO PRODUTO 23/07 18:00--}}

let produtoIdBaseSelecionado = null;

 async function abrirModalVinculoProduto(produtoId) {
  console.log(' [ 4 abrirMoadalProduto', produtoId);
  produtoIdBaseSelecionado=produtoId;
  try {
    const response = await fetch(`/simiproduto/produtos/detalhes/${produtoId}`);
    const produto = await response.json();
    console.log("--------------------------------");
    console.log(' [ 8 js/empresa/similares.js ]',produtoId);
    console.log(' [ 8 js/empresa/similares.js ]',produto);
    let html = `
  <p><strong>Código:</strong> ${produto.codigo}</p>
  <p><strong>Descrição:</strong> ${produto.descricao}</p>
  <p><strong>Referência:</strong> ${produto.referencia}</p>
  <p><strong>Fornecedor:</strong> ${produto.fornecedor?.razao || '[Sem fornecedor]'}</p>
  <p><strong>Preço Vista:</strong> R$ ${parseFloat(produto.precovista?.$numberDecimal || '0').toFixed(2)}</p>
  <p><strong>Similares:</strong> ${produto.similares?.length || 0}</p>
`;

// Lista de similares já vinculados (antes da busca)
if (produto.similares?.length > 0) {
 html += `<ul style="list-style:none;padding-left:0;">${produto.similares.map(sim => {
    const preco = parseFloat(sim.precovista?.$numberDecimal || '0').toFixed(2);
    return `
      <li class="d-flex justify-content-between align-items-center border p-2 mb-2 rounded">
        <div><strong>${sim.codigo}</strong> - ${sim.descricao} (R$ ${preco})</div>
        <button class="btn btn-danger btn-sm" onclick="desvincularSimilar('${produto._id}', '${sim._id}')">desvincular</button>
      </li>`;
  }).join("")}</ul>`;
} else {
  html += `<div class="text-muted">Nenhum similar vinculado</div>`;
}

// Insere conteúdo no modal
const container = document.getElementById("conteudoModalProduto");
if (container) {
  container.innerHTML = html;
} else {
  console.error("Elemento 'conteudoModalProduto' não encontrado.");
}

// Abre o modal
const modal = new bootstrap.Modal(document.getElementById("modalProdutoVinculo"));
modal.show();


  } catch (e) {
    alert("Erro ao carregar detalhes do produto.[ 32 ]");
    console.error(e);
  }
}

function abrirModalBuscaSimilar() {
  const modal = new bootstrap.Modal(document.getElementById("modalVinculo"));
  modal.show();
}


let baseId = null;

function buscarSimilares(baseId) {
  const termo = document.getElementById("buscaSimilarInput1").value.trim();
  if (termo.length < 2) return;
  console.log('[ 67 similares.js ',baseId)

  fetch(`/produto/buscar?termo=${encodeURIComponent(termo)}&baseId=${baseId}`)
    .then(res => res.json())
    .then(similares => {
      const container = document.getElementById("resultadosSimilar1");
      if (!similares.length) {
        container.innerHTML = `<div class="text-muted">Nenhum resultado encontrado</div>`;
        return;
      }

      container.innerHTML = similares.map(sim => {
        const preco = parseFloat(sim.precovista?.$numberDecimal || '0').toFixed(2);
        return `
          <div class="resultado-similar d-flex justify-content-between align-items-center">
            <span>${sim.codigo} - ${sim.descricao} (R$ ${preco})</span>
            <button class="btn btn-sm btn-outline-primary" onclick="vincularSimilar('${baseId}', '${sim._id}')">Vincular</button>
          </div>`;
      }).join("");
    })
    .catch(err => console.error("Erro ao buscar similares:", err));
}


// function buscarSimilar() {
//   console.log(' 89 ')
//   const termo = document.getElementById("buscaSimilarInput2").value.trim();
//   if (termo.length < 2 || !baseId) return;

//   fetch(`/simiproduto/buscar?termo=${encodeURIComponent(termo)}&baseId=${baseId}`)
//     .then(res => res.json())
//     .then(similares => {
//       const container = document.getElementById("resultadosSimilar2");
//       if (!similares.length) {
//         container.innerHTML = '<div class="text-muted">Nenhum resultado encontrado</div>';
//         return;
//       }

//       container.innerHTML = similares.map(sim => {
//         const preco = parseFloat(sim.precovista?.$numberDecimal || '0').toFixed(2);
//         return `<div class="border p-2 mb-2 rounded">
//                   <strong>${sim.codigo}</strong> - ${sim.descricao} (R$ ${preco})
//                   <button class="btn btn-sm btn-primary float-end" onclick="vincularSimilar('${baseId}', '${sim._id}')">Vincular</button>
//                 </div>`;
//       }).join("");
//     })
//     .catch(err => console.error("Erro ao buscar similares:", err));
// }


async function vincularSimilar(produtoBaseId, similarId) {
  console.log(' [ 65 js/empresa/similares.js ]');  
  //let produtoBaseId = null;
  try {
    const resposta = await fetch("/simiproduto/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produtoBaseId, similarId })
    });

    const resultado = await resposta.json();

    if (!resposta.ok) {
      alert("Erro ao vincular similar: " + resultado.erro);
      return;
    }

    alert("Produto similar vinculado com sucesso!");
    //document.getElementById("buscaSimilarInput2").value = "";
    document.getElementById("listaResultadosSimilar").innerHTML = "";
    document.getElementById("cadastroModal").style.display="none;"
    abrirModalProduto(produtoBaseId); // recarrega modal

  } catch (e) {
    console.error("Erro ao tentar vincular similar:", e);
    alert("Erro ao tentar vincular similar.");
  }
}

// ESSA FUNÇÃO ABRE O MODAL PARA VINCULAR < PESQUISAR E REMOVER
// document.addEventListener("DOMContentLoaded", () => {
//   document.querySelectorAll(".abrirmodalprodutoSimilar").forEach(botao => {
//     console.log(' [ 92 js/empresa/similares.js => abrir-modal-produtoSimilar ]');  
//     botao.addEventListener("click", async () => {
//       const produtoId = botao.dataset.id;
//       try {
//             const response = await fetch(`/simiproduto/produtos/detalhes/${produtoId}`);
//             const produto = await response.json();
//             const produtoBaseId = produto._id;
//             console.log('');
//             console.log('[ 1058 document.addEventListener("DOMContentLoaded" ]')
//             console.log('');
//             console.log(' [ 971 ] ==> ',produto);
//             let html = `
//             <p><strong>Código:</strong> ${produto.codigo}</p>
//             <p><strong>Descrição:</strong> ${produto.descricao}</p>
//             <p style="color:red"><strong>Referência:</strong> ${produto.referencia}</p>
//             <p><strong>Fornecedor:</strong> ${produto.fornecedor?.razao || '[Sem fornecedor]'}</p>
//             <p><strong>Preço Vista:</strong> R$ ${parseFloat(produto.precovista?.$numberDecimal || '0').toFixed(2)}</p>
//             <p><strong>Similares:</strong> ${produto.similares?.length || 0}</p>
//           `;

//             if (produto.similares?.length > 0) {
//               html += `
//                     <ul class="list-group list-group-flush" style="overflow: scroll">
//                         ${produto.similares.map(sim => {
//                               const preco = parseFloat(sim.precovista?.$numberDecimal || '0').toFixed(2);
//                               return `
//                                     <li class="list-group-item d-flex justify-content-between align-items-center border-0 border-bottom" style="background-color:gray;">
//                                         <div>
//                                           <div>${sim.codigo} - ${sim.descricao}</div>
//                                           <small class="text-muted">(R$ ${preco})</small>
//                                         </div>
//                                         <div class="btn-group">
//                                             <a href="/ver/${sim._id}" class="btn btn-outline-secondary btn-sm" title="Ver Detalhes">
                                                                    
//                                                 🔍
//                                             </a>
                                           
//                                             <button class="btn btn-success btn-sm" onclick="DesvincularSimilar('${produtoBaseId}', '${sim._id}')">
//                                                    🔗 Desvincular
//                                             </button>
//                                         </div>
//                                     </li>
                                 
//                                   `;
//                                 }).join("")}
//                                    <li>
//                                     <button class="btn btn-primary mt-3" style="color:"green;" onclick="abrirModalBuscarSimilar('${produto._id}')"> 
//                                           + Adicionar Similar X
//                                                 </button>
//                                     </li>
//                       </ul>
//                     `;
//                      //<button onclick="remover_Similar('${sim._id}')" class="btn btn-outline-danger btn-sm" title="Remover">
//                      //                               🗑
//                      //                       </button>
//             } else {
//                 html += `<button class="btn btn-primary mt-3" style="color:"pink;" onclick="abrirModalBuscarSimilar('${produto._id}')"> 
//                          + Adicionar Similar Z
//                         </button>`;
//             }

//             document.getElementById("conteudoModalProduto").innerHTML = html;
//             const modal = new bootstrap.Modal(document.getElementById("modalProduto"));
//             modal.show();
           
//       } catch (e) {
//           alert("Erro ao carregar detalhes do produto.[ 159 ",e);
//          console.error(e);
//       }
//     });
//   });
// });

//ESSA FUNÇÃO MOSTRA O MODAL PARA FAZER PESQUISA POR DESCRIÇÂO OU CÓDIGO PRA VINCULAÇÃO DE PRODUTO
// function abrirModalBuscarSimilar(produtoBaseId) {
//   console.log(' [ 92 js/empresa/similares.js => abrirModalBuscarSimilarr ]');   
//   produtoIdBaseSelecionado = produtoBaseId;
//   console.log('produtoBaseSelecionado',produtoIdBaseSelecionado)
//   document.getElementById("buscaSimilarInput1").value = "";
//   document.getElementById("listaResultadosSimilar").innerHTML = "";
//   new bootstrap.Modal(document.getElementById("modalBuscarSimilar")).show();
// }

async function DesvincularSimilar(produtoId, similarId) {
  console.log(' [ 174 js/empresa/similares.js => remover Similar ]');
  console.log(' produtoId ',produtoId);
  console.log(' similarId ',similarId);
  if (!confirm("Deseja remover este similar?")) return;
  try {
    const res = await fetch(`/simiproduto/produtos/${produtoId}/removersimilar/${similarId}`, { method: "PUT" });
    if (!res.ok) throw new Error("Falha no servidor");
    alert("Similar removido!");
    location.reload(); // recarrega para refletir a mudança
  } catch (err) {
    console.error("Erro ao remover similar:", err);
    alert("Erro ao remover similar.");
  }
}



//const inputBuscar = document.getElementById("buscaSimilarInput2");

//if (inputBuscar) {
//  inputBuscar.addEventListener("input", async (e) => {
//    console.log('[ 192 js/empresa/similares.js => buscaSimilarInput2 input handler ]');/

//    const termo = e.target.value.trim();
//    alert(termo)
//    console.log(termo)
//    console.log('=================================> ',produtoIdBaseSelecionado)
//    if (termo.length < 2 || !produtoIdBaseSelecionado) return;
//    console.log('260')
//    try {
//      console.log(' [ 255')

//      const resposta = await fetch(`/simiproduto/buscar?termo=${encodeURIComponent(termo)}&baseId=${produtoIdBaseSelecionado}`);
//      const similares = await resposta.json();

//      const lista = document.getElementById("listaResultadosSimilar");
//      lista.innerHTML = "";

//      similares.forEach(sim => {
//        const li = document.createElement("li");
//        li.className = "list-group-item d-flex justify-content-between align-items-center";
//        li.innerHTML = `
//          <div>
//            <strong>${sim.codigo}</strong> - ${sim.descricao}
//          </div>
//          <button class="btn btn-sm btn-success" onclick="vincularSimilar('${produtoIdBaseSelecionado}', '${sim._id}')">Vincular</button>
//        `;
//        lista.appendChild(li);
//      });
//    } catch (err) {
//      console.error("Erro ao buscar similares:", err);
//    }
//  });
//} else {
 // console.warn("Elemento buscaSimilarInput2 não encontrado no DOM.");
//}

