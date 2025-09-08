#!/bin/bash

# ================================
# Ciclo otimizado: Pull → Build → Commit (se houver mudanças) → Push → Preview local
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

echo "🏗 Buildando projeto (src/ ou public/ podem ter mudado)..."
npm run build

# Verifica se há mudanças não commitadas
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ Nenhuma mudança para commit → Pulando commit"
else
    COMMIT_MSG="update $(date +'%Y-%m-%d %H:%M:%S')"
    echo "📝 Commitando alterações com mensagem: '$COMMIT_MSG'"
    git add .
    git commit -m "$COMMIT_MSG"
    git push origin main
fi

# Função para verificar se preview está rodando
check_preview() {
    curl -s --head $PREVIEW_URL | head -n 1 | grep "200" > /dev/null
}

# Abrir preview local
if check_preview; then
    echo "🌍 Preview já está rodando → Abrindo no navegador..."
else
    echo "🌍 Iniciando preview local..."
    npx vite preview --port $PREVIEW_PORT --host & sleep 3
fi

# Abrir no navegador padrão (compatível com Windows/Linux/macOS)
if command -v xdg-open >/dev/null; then
    xdg-open $PREVIEW_URL
elif command -v open >/dev/null; then
    open $PREVIEW_URL
else
    start $PREVIEW_URL
fi

echo "✅ Fluxo concluído e preview aberto!"
