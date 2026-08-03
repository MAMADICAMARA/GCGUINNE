#!/usr/bin/env bash
# ============================================================================
# run_migrations.sh
# Exécute l'ensemble des scripts SQL du dossier database/ dans l'ordre,
# contre la base définie par DATABASE_URL (backend/.env).
#
# Usage :
#   ./run_migrations.sh
#
# Prérequis : la variable DATABASE_URL doit être définie dans backend/.env
# (format : postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public)
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Fichier .env introuvable : $ENV_FILE"
  echo "Copiez backend/.env.example vers backend/.env et renseignez DATABASE_URL."
  exit 1
fi

# Charge DATABASE_URL depuis le .env sans écraser le reste de l'environnement
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d '=' -f2-)

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL n'est pas défini dans $ENV_FILE"
  exit 1
fi

echo "Exécution des migrations sur : $DATABASE_URL"
echo

for f in "$SCRIPT_DIR"/[0-9][0-9]_*.sql; do
  echo "=== $(basename "$f") ==="
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
  echo
done

echo "Toutes les migrations ont été appliquées avec succès."
