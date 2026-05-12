router.get('/assistente-lojista', async (req, res) => {
  try {
    res.render('pages/empresa/assistente_lojista', {
      layout: 'main',
      produto: {
        nome: '',
        codigo: '',
        marca: '',
        categoria: '',
        preco: '',
        descricao: ''
      }
    });
  } catch (erro) {
    console.error('Erro ao abrir assistente do lojista:', erro);
    res.status(500).send('Erro ao abrir a página do assistente.');
  }
});

router.post('/assistente-lojista/gerar', async (req, res) => {
  try {
    const { prompt, produto } = req.body;

    if (!prompt) {
      return res.status(400).json({ erro: 'Prompt não enviado.' });
    }

    const respostaFake = `
Sugestão gerada para o produto "${produto?.nome || 'Sem nome'}":

${prompt}

Texto sugerido:
Este produto se destaca pela sua qualidade, praticidade e excelente custo-benefício. Ideal para clientes que procuram eficiência, durabilidade e um ótimo resultado no uso diário.
    `.trim();

    return res.json({
      ok: true,
      resposta: respostaFake
    });

  } catch (erro) {
    console.error('Erro ao gerar resposta do assistente:', erro);
    return res.status(500).json({
      erro: 'Erro interno ao gerar resposta.'
    });
  }
});