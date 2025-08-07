import express from 'express';
import multer from 'multer';
import { processarPlanilha } from './utils/excel.js';

// Servidor Express responsável por receber uploads de planilhas
// e devolver os dados estruturados para o frontend.
const app = express();

// Armazena o arquivo em memória apenas durante o processamento.
const upload = multer({ storage: multer.memoryStorage() });

// Endpoint de upload da planilha
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { produtos, totalItens, rzs, missingFields } = await processarPlanilha(
      req.file.buffer,
    );

    // Se não foram extraídos produtos, algo deu errado
    if (!produtos.length) {
      const msg =
        missingFields && missingFields.length
          ? `Colunas obrigatórias ausentes: ${missingFields.join(', ')}`
          : 'Planilha vazia ou inválida.';
      return res.status(400).json({ error: msg });
    }

    // Responde com o total de itens, os produtos e a lista de RZs únicos
    return res.json({ totalItens, itens: produtos, rzs });
  } catch (error) {
    console.error('Erro ao processar planilha:', error);
    return res.status(500).json({ error: 'Erro ao processar planilha.' });
  }
});

// Middleware final para capturar qualquer erro não tratado
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// Inicia o servidor apenas se não estiver em ambiente de teste
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor executando na porta ${PORT}`);
  });
}

export default app;
