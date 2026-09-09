function openCadastroLojistaModal(i){
    carregarDepartamentos();
    document.getElementById("cadastroLojistaModal").style.display="block";
}        

async function carregarDepartamentos() {
            try {
              const resposta = await fetch("/fornec/departamentos");
              const departamentos = await resposta.json();
              alert(' [ 9 ] ',departamentos)
              console.log('');
              console.log("[ 11 ] ",departamentos);
              console.log('');
              const select = document.getElementById("selectDepartamento");
              select.innerHTML = '<option value="">Selecione um departamento</option>';

              

              departamentos.forEach(dep => {
                const option = document.createElement("option");
                option.value = dep._id;
                option.textContent = dep.nomeDepartamento;
                select.appendChild(option);
                   // Exibe o modal
               document.getElementById("cadastroModal").style.display = "flex";
               document.getElementById("razao").style.backgroundColor="yellow"
               document.getElementById("razao").focus();
              });
            } catch (err) {
              console.error("Erro ao carregar departamentos:", err);
              alert("Erro ao buscar departamentos");
            }
}



