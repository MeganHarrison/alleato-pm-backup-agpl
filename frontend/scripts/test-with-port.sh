#!/bin/bash

# Script to run tests with dynamic port detection or manual override
# Usage: ./scripts/test-with-port.sh [port]

if [ -z "$1" ]; then
  echo "🔍 Detecting dev server port..."

  # Check common ports
  for port in 3000 3001 3002 3003 8080; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200\|302\|301"; then
      echo "✅ Found dev server on port $port"
      export PLAYWRIGHT_BASE_URL="http://localhost:$port"
      break
    fi
  done

  if [ -z "$PLAYWRIGHT_BASE_URL" ]; then
    echo "⚠️  No dev server detected. Using default port 3000"
    echo "💡 Tip: Start dev server with 'npm run dev' or specify port: $0 3001"
    export PLAYWRIGHT_BASE_URL="http://localhost:3000"
  fi
else
  echo "📍 Using specified port: $1"
  export PLAYWRIGHT_BASE_URL="http://localhost:$1"
fi

echo "🎭 Running Playwright tests with base URL: $PLAYWRIGHT_BASE_URL"
npm run test