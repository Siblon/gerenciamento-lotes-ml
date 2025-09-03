#!/bin/bash

# Pergunta a mensagem do commit
read -p "Digite a mensagem do commit: " mensagem

# Executa o ciclo de build
./cycle.sh

# Adiciona mudanças ao Git
git add .

# Faz o commit
git commit -m "$mensagem"

# Envia para o GitHub
git push

echo "✅ Tudo pronto! Código atualizado no GitHub."
