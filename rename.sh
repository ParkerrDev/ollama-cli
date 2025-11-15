#!/bin/bash
set -euo pipefail

# Exclude directories that should not be touched
EXCLUDES="-path ./node_modules -prune -o -path ./.git -prune -o -path ./dist -prune -o -path ./build -prune -o"

echo "=== Updating file contents (case-sensitive replacements) ==="

# Replace text in file contents
find . $EXCLUDES -type f -print0 |
  xargs -0 sed -i \
    -e 's/OLLAMA/OLLAMA/g' \
    -e 's/Ollama/Ollama/g' \
    -e 's/ollama/ollama/g'

echo "=== Renaming directories (bottom-up) ==="

# Rename directories first to avoid path problems
find . $EXCLUDES -type d -iname "*ollama*" -depth -print0 |
  while IFS= read -r -d '' d; do
    new=$(echo "$d" | sed \
      -e 's/OLLAMA/OLLAMA/g' \
      -e 's/Ollama/Ollama/g' \
      -e 's/ollama/ollama/g')
    [[ "$d" != "$new" ]] && mv "$d" "$new"
  done

echo "=== Renaming files ==="

find . $EXCLUDES -type f -iname "*ollama*" -print0 |
  while IFS= read -r -d '' f; do
    new=$(echo "$f" | sed \
      -e 's/OLLAMA/OLLAMA/g' \
      -e 's/Ollama/Ollama/g' \
      -e 's/ollama/ollama/g')
    [[ "$f" != "$new" ]] && mv "$f" "$new"
  done

echo "=== Updating JS/TS import identifiers ==="

find . $EXCLUDES -type f \( -iname "*.ts" -o -iname "*.tsx" -o -iname "*.js" \) -print0 |
  xargs -0 sed -i \
    -e 's/useollamaStream/useOllamaStream/g' \
    -e 's/ollamaMessage/OllamaMessage/g' \
    -e 's/ollamaPrivacyNotice/OllamaPrivacyNotice/g' \
    -e 's/ollamaRespondingSpinner/OllamaRespondingSpinner/g'

echo "=== Done! ==="

