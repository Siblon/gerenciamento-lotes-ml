#!/bin/bash

# ================================
# Ciclo otimizado: Pull → Build → Commit (se houver mudanças) → Push → Preview local
# ================================

PREVIEW_PORT=4173
PREVIEW_URL="http://localhost:$PREVIEW_PORT"

echo "🔄 Pull do origin/main..."
if git remote get-url origin >/dev/null 2>&1; then
    git pull origin main
else
    echo "⚠️ Remote 'origin' não configurado → pulando pull"
fi

# Verifica se package.json mudou desde o último commit
if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    if git diff --name-only HEAD~1 HEAD | grep -q "package.json"; then
        echo "📦 Dependências alteradas → Instalando..."
        npm ci
    else
        echo "📦 Nenhuma mudança nas dependências → Pulando npm ci"
    fi
else
    echo "📦 Primeiro commit detectado → Executando npm ci para garantir dependências"
    npm ci
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
    if git remote get-url origin >/dev/null 2>&1; then
        git push origin main
    else
        echo "⚠️ Remote 'origin' não configurado → pulando push"
    fi
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
elif command -v start >/dev/null; then
    start $PREVIEW_URL
else
    echo "ℹ️ Nenhum comando de abertura de navegador disponível → acesse $PREVIEW_URL manualmente"
fi

echo "✅ Fluxo concluído e preview aberto!"
