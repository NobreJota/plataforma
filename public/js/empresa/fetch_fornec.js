// Exemplo de chamadas via fetch para o controller de fornecedores

// Listar todos os fornecedores
async function listarFornecedores() {
  const response = await fetch("/fornecedor");
  const data = await response.json();
  console.log("Lista de fornecedores:", data);
}

// Buscar fornecedor por ID
async function buscarFornecedorPorId(id) {
  const response = await fetch(`/fornecedor/${id}`);
  const data = await response.json();
  console.log("Fornecedor encontrado:", data);
}

// Criar novo fornecedor
async function criarFornecedor(fornecedor) {
  const response = await fetch("/fornecedor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fornecedor)
  });
  const data = await response.json();
  console.log("Fornecedor criado:", data);
}

// Atualizar fornecedor
async function atualizarFornecedor(id, atualizacao) {
  const response = await fetch(`/fornecedor/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(atualizacao)
  });
  const data = await response.json();
  console.log("Fornecedor atualizado:", data);
}

// Deletar fornecedor
async function deletarFornecedor(id) {
  const response = await fetch(`/fornecedor/${id}`, {
    method: "DELETE"
  });
  const data = await response.json();
  console.log("Fornecedor removido:", data);
}

// Exemplo de uso:
// listarFornecedores();
// buscarFornecedorPorId("ID_DO_FORNECEDOR");
// criarFornecedor({ razao: "Nome", cnpj: "12345678000100" });
// atualizarFornecedor("ID_DO_FORNECEDOR", { razao: "Nome Atualizado" });
// deletarFornecedor("ID_DO_FORNECEDOR");
