#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./update-frontend-env.sh KEY VALUE [environment]"
  echo "environment: production (default), preview, development"
  exit 1
fi

ENV=${3:-production}
echo "$2" | vercel env add "$1" "$ENV" --force
echo "✅ Updated $1 on Vercel ($ENV)"
