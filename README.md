# Sistema de Conferência de Lotes

Sistema para conferência de produtos com base em planilhas do Mercado Livre.

## Funcionalidades

- Leitura de código ML
- Verificação contra planilha
- Registro de produtos conferidos
- Testes automatizados com Vitest

## Como rodar

```bash
npm install
npm run dev
```

## Como testar

```bash
npm run test
```

## Variáveis de ambiente

- `VITE_NCM_API_BASE`: URL base da API de NCM utilizada nas buscas.
- `VITE_NCM_API_TOKEN`: token opcional para autenticação Bearer nas requisições de NCM.

## Deploy no Netlify
1. Víncule o repositório na Netlify.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Certifique-se de que `public/_redirects` está no repo.
5. Abrir a URL (HTTPS habilitado) e testar a câmera.
