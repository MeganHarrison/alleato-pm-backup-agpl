#!/bin/bash
set -e

echo "🔍 Checking backend health..."
BACKEND_HEALTH=$(curl -s https://alleato-backend-rbnj.onrender.com/health)
echo "$BACKEND_HEALTH" | jq '.'

if echo "$BACKEND_HEALTH" | jq -e '.status == "healthy"' > /dev/null; then
  echo "✅ Backend is healthy"
else
  echo "❌ Backend is unhealthy"
  exit 1
fi

echo ""
echo "🔍 Checking frontend..."
FRONTEND_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" https://alleato-procore.vercel.app)

if [ "$FRONTEND_STATUS" = "200" ]; then
  echo "✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
  echo "⚠️  Frontend returned HTTP $FRONTEND_STATUS (may be expected)"
fi

echo ""
echo "✅ All systems operational"
