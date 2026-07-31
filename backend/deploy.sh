#!/bin/bash

# Backend Deployment Script
# Usage: ./deploy.sh [platform]

set -e

PLATFORM=${1:-docker}
IMAGE_NAME="alleato-backend"
VERSION=$(date +%Y%m%d%H%M%S)

echo "🚀 Deploying Alleato Backend..."
echo "Platform: $PLATFORM"
echo "Version: $VERSION"

case $PLATFORM in
  docker)
    echo "📦 Building Docker image..."
    docker build -t $IMAGE_NAME:$VERSION -t $IMAGE_NAME:latest .
    echo "✅ Docker image built successfully"
    echo "Run with: docker run -p 8000:8000 --env-file .env.production $IMAGE_NAME:latest"
    ;;
    
  render)
    echo "Render is the production backend host for Alleato."
    echo "Use root render.yaml and the Render dashboard/API for deploys, env vars, and logs."
    ;;
    
  compose)
    echo "🐳 Starting with Docker Compose..."
    docker-compose -f docker-compose.production.yml up --build -d
    echo "✅ Services started"
    echo "View logs: docker-compose -f docker-compose.production.yml logs -f"
    ;;
    
  test)
    echo "🧪 Testing production build locally..."
    docker build -t $IMAGE_NAME:test .
    docker run --rm -p 8000:8000 --env-file .env.production $IMAGE_NAME:test
    ;;
    
  *)
    echo "❌ Unknown platform: $PLATFORM"
    echo "Available platforms: docker, render, compose, test"
    exit 1
    ;;
esac

echo "✨ Deployment complete!"
