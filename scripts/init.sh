#!/bin/bash
# Initialize the Change Orders development environment
# Usage: ./scripts/init.sh (run from project root)

set -e

echo "Setting up Change Orders development environment..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Check for .env.local symlink in frontend (points to root .env)
if [ ! -f "frontend/.env.local" ]; then
    if [ -f ".env" ]; then
        echo "Creating frontend/.env.local symlink to root .env..."
        ln -s "$(pwd)/.env" frontend/.env.local
        echo "frontend/.env.local -> $(pwd)/.env"
    else
        echo "Error: No .env file found at project root"
        echo "  Please create .env with your Supabase configuration"
        exit 1
    fi
fi

# Install dependencies
echo "Installing dependencies..."
npm run install:all

# Generate Supabase types (critical for database work)
echo "Generating Supabase types..."
(cd frontend && npm run db:types) || echo "Warning: Could not generate types - run 'npm run db:types' in frontend/ after configuring Supabase"

# Check route conflicts (prevents common errors)
echo "Checking for route conflicts..."
npm run check:routes || echo "Warning: Route conflict check failed - review output above"

# Run quality checks
echo "Running quality checks..."
(cd frontend && npm run quality) || echo "Warning: Quality check had issues - review output above before starting development"

echo ""
echo "================================================================"
echo "  Change Orders Development Environment Ready!"
echo "================================================================"
echo ""
echo "  Start development servers:"
echo "    npm run dev                  # Both frontend + backend"
echo "    npm run dev:frontend         # Frontend only (port 3000)"
echo "    npm run dev:backend          # Backend only"
echo ""
echo "  Run tests:"
echo "    cd frontend && npm run test     # Playwright E2E tests"
echo "    cd frontend && npm run test:ui  # Playwright UI mode"
echo ""
echo "  Key files for Change Orders:"
echo "    frontend/src/app/(main)/[projectId]/change-orders/  # Pages"
echo "    frontend/src/app/api/projects/[projectId]/change-orders/  # API"
echo "    frontend/src/components/domain/change-orders/  # Components"
echo "    frontend/src/hooks/use-change-orders.ts  # Data hooks"
echo "    supabase/migrations/  # Database migrations"
echo ""
echo "  Documentation:"
echo "    .yokeflow/app_spec.md  # Full specification"
echo "    CLAUDE.md              # Development conventions"
echo ""
echo "================================================================"
