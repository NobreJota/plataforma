document.addEventListener('DOMContentLoaded', () => {
  const promptAssistente = document.getElementById('promptAssistente');
  const boxRespostaIA = document.getElementById('boxRespostaIA');
  const historicoAssistente = document.getElementById('historicoAssistente');

  const aiNomeProduto = document.getElementById('aiNomeProduto');
  const aiCodigoProduto = document.getElementById('aiCodigoProduto');
  const aiMarcaProduto = document.getElementById('aiMarcaProduto');
  const aiCategoriaProduto = document.getElementById('aiCategoriaProduto');
  const aiPrecoProduto = document.getElementById('aiPrecoProduto');
  const aiDescricaoAtual = document.getElementById('aiDescricaoAtual');

  const btnGerarResposta = document.getElementById('btnGerarResposta');
  const btnLimparPrompt = document.getElementById('btnLimparPrompt');
  const btnCopiarResposta = document.getElementById('btnCopiarResposta');
  const btnUsarNaDescricao = document.getElementById('btnUsarNaDescricao');
  const btnUsarNoTitulo = document.getElementById('btnUsarNoTitulo');

  const botoesAcao = document.querySelectorAll('.btn-assistente-acao');

  function montarContextoProduto() {
    return {
      nome: aiNomeProduto?.value?.trim() || '',
      codigo: aiCodigoProduto?.value?.trim() || '',
      marca: aiMarcaProduto?.value?.trim() || '',
      categoria: aiCategoriaProduto?.value?.trim() || '',
      preco: aiPrecoProduto?.value?.trim() || '',
      descricaoAtual: aiDescricaoAtual?.value?.trim() || ''
    };
  }

  function adicionarHistorico(pergunta, resposta) {
    const vazio = historicoAssistente.querySelector('.historico-vazio');
    if (vazio) vazio.remove();

    const item = document.createElement('div');
    item.className = 'historico-item';
    item.innerHTML = `
      <strong>Pergunta:</strong>
      <div>${pergunta}</div>
      <hr>
      <strong>Resposta:</strong>
      <div>${resposta}</div>
    `;
    historicoAssistente.prepend(item);
  }

  function getPromptSugestao(acao) {
    const contexto = montarContextoProduto();

    const baseProduto = `
Nome: ${contexto.nome}
Código: ${contexto.codigo}
Marca: ${contexto.marca}
Categoria: ${contexto.categoria}
Preço: ${contexto.preco}
Descrição atual: ${contexto.descricaoAtual}
    `.trim();

    switch (acao) {
      case 'descricao':
        return `Crie uma descrição comercial clara e atrativa para o produto abaixo:\n\n${baseProduto}`;
      case 'titulo':
        return `Crie 5 opções de título mais profissional para este produto:\n\n${baseProduto}`;
      case 'anuncio':
        return `Crie um texto de anúncio com linguagem persuasiva para este produto:\n\n${baseProduto}`;
      case 'beneficios':
        return `Liste os principais benefícios e diferenciais deste produto em formato fácil para venda:\n\n${baseProduto}`;
      case 'palavras':
        return `Sugira palavras-chave para melhorar a divulgação deste produto:\n\n${baseProduto}`;
      case 'correcao':
        return `Corrija, organize e melhore a ortografia do texto abaixo, mantendo o sentido comercial:\n\n${baseProduto}`;
      default:
        return '';
    }
  }

  botoesAcao.forEach(btn => {
    btn.addEventListener('click', () => {
      const acao = btn.dataset.acao;
      promptAssistente.value = getPromptSugestao(acao);
      promptAssistente.focus();
    });
  });

  btnLimparPrompt?.addEventListener('click', () => {
    promptAssistente.value = '';
  });

  btnCopiarResposta?.addEventListener('click', async () => {
    const texto = boxRespostaIA.innerText.trim();
    if (!texto || texto === 'Sua resposta aparecerá aqui...') return;

    try {
      await navigator.clipboard.writeText(texto);
      alert('Resposta copiada com sucesso.');
    } catch (erro) {
      console.error('Erro ao copiar:', erro);
    }
  });

  btnUsarNaDescricao?.addEventListener('click', () => {
    const texto = boxRespostaIA.innerText.trim();
    if (!texto || texto === 'Sua resposta aparecerá aqui...') return;
    aiDescricaoAtual.value = texto;
  });

  btnUsarNoTitulo?.addEventListener('click', () => {
    const texto = boxRespostaIA.innerText.trim();
    if (!texto || texto === 'Sua resposta aparecerá aqui...') return;
    aiNomeProduto.value = texto.split('\n')[0];
  });

  btnGerarResposta?.addEventListener('click', async () => {
    const prompt = promptAssistente.value.trim();
    const produto = montarContextoProduto();

    if (!prompt) {
      alert('Digite ou gere um prompt antes de continuar.');
      return;
    }

    boxRespostaIA.innerText = 'Gerando resposta...';

    try {
      const response = await fetch('/empresa/assistente-lojista/gerar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          produto
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.erro || 'Erro ao gerar resposta');
      }

      const resposta = data.resposta || 'Nenhuma resposta recebida.';
      boxRespostaIA.innerText = resposta;
      adicionarHistorico(prompt, resposta);

    } catch (erro) {
      console.error(erro);
      boxRespostaIA.innerText = `Erro ao gerar resposta: ${erro.message}`;
    }
  });
});