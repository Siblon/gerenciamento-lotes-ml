#!/bin/bash

# ================================
# Ciclo otimizado: Pull → Build (se necessário) → Commit → Push → Preview local
# ================================

PREVIEW_PORT=4173
PREVIEW_URL="http://localhost:$PREVIEW_PORT"

echo "🔄 Pull do origin/main..."
git pull origin main

# Verifica se package.json mudou desde o último commit
if git diff --name-only HEAD~1 HEAD | grep -q "package.json"; then
    echo "📦 Dependências alteradas → Instalando..."
    npm ci
else
    echo "📦 Nenhuma mudança nas dependências → Pulando npm ci"
fi

# Verifica se houve alterações em src/ ou public/
if git diff --name-only HEAD~1 HEAD | grep -E "^(src|public)/" > /dev/null; then
    echo "🏗 Alterações detectadas → Buildando..."
    npm run build
else
    echo "🏗 Nenhuma alteração de código → Pulando build"
fi

# Mensagem de commit automática
COMMIT_MSG="update $(date +'%Y-%m-%d %H:%M:%S')"
echo "📝 Commitando alterações com mensagem: '$COMMIT_MSG'"

git add .
git commit -m "$COMMIT_MSG"
git push origin main

# Função para verificar se preview está rodando
check_preview() {
    curl -s --head $PREVIEW_URL | head -n 1 | grep "200" > /dev/null
}

# Abrir preview local
if check_preview; then
    echo "🌍 Preview já está rodando → Abrindo no navegador..."
    start $PREVIEW_URL
else
    echo "🌍 Iniciando preview local..."
    npx vite preview --port $PREVIEW_PORT --host & sleep 2
    start $PREVIEW_URL
fi

echo "✅ Fluxo concluído e preview aberto!"
