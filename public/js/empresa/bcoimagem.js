let produtoCodigo = "";
let produtoNome = "";
let produtoSetor = "";

function gerarInputsImagens() {
  const qtd = parseInt(document.getElementById("quantidadeImagens").value);
  const container = document.getElementById("containerInputsImagens");
  container.innerHTML = "";

  for (let i = 0; i < qtd; i++) {
    const input = document.createElement("input");
    input.type = "file";
    input.name = "imagem" + i;
    input.accept = "image/*";
    container.appendChild(document.createElement("br"));
    container.appendChild(input);
  }
}

/* <><><><><></></></></></><><><><><></></></></></><><><><><></></></></></><><><><><></></></></></> */
// Enviar tudo
function mostrarPreview(input, imgElement) {
  const file = input.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      imgElement.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function gravarImagem(index, inputFile) {
  const file = inputFile.files[0];
  if (!file) {
    alert("Selecione uma imagem antes de gravar.");
    return;
  }

  // aqui vai o fetch para enviar a imagem
  console.log(`Gravando imagem ${index + 1}:`, file.name);
  alert(`Imagem ${index + 1} pronta para upload (implementar backend).`);
}

function fecharModalUpload() {
  document.getElementById("modalUploadImagens").style.display = "none";
}

function fecharModal() {
 // const modal = document.getElementById("modalUploadImagens"); // ou o id do seu modal
  //modal.classList.remove("show")
 // modal.style.display = "none"; // ou modal.classList.remove("show")

   document.getElementById("modalUploadImagens").style.display = "none";

  // Resetar todos os selects para voltar a funcionar
  document.querySelectorAll('select').forEach(select => {
    if (select.value === 'imagens') {
      select.value = ''; // limpa a seleção
    }
  });
}
