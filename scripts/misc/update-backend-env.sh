#!/bin/bash
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./update-backend-env.sh KEY VALUE"
  exit 1
fi

render env set "$1=$2" --service alleato-backend
echo "✅ Updated $1 on alleato-backend"
