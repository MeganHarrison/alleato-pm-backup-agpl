#!/bin/bash

# Script to run all tests in the project
# Usage: ./scripts/run-all-tests.sh

set -e  # Exit on error

echo "🧪 Running all tests for Alleato Procore project..."
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 passed${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        exit 1
    fi
}

# Frontend Unit Tests
echo -e "\n${BLUE}Running Frontend Unit Tests...${NC}"
cd frontend
npm run test:unit:ci
check_status "Frontend unit tests"
cd ..

# Backend Unit Tests
echo -e "\n${BLUE}Running Backend Unit Tests...${NC}"
cd backend

# Install test dependencies if needed
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate || source venv/Scripts/activate

# Install dependencies
pip install -r requirements.txt -r requirements-test.txt -q

# Run pytest
pytest --cov --cov-report=term-missing --cov-report=html
check_status "Backend unit tests"

deactivate
cd ..

# Summary
echo -e "\n${GREEN}=================================================="
echo "✅ All tests completed successfully!"
echo "=================================================="
echo ""
echo "📊 Coverage Reports:"
echo "   - Frontend: frontend/coverage/lcov-report/index.html"
echo "   - Backend: backend/htmlcov/index.html"
echo ""

# Optional: Open coverage reports
read -p "Open coverage reports in browser? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v open &> /dev/null; then
        open frontend/coverage/lcov-report/index.html
        open backend/htmlcov/index.html
    elif command -v xdg-open &> /dev/null; then
        xdg-open frontend/coverage/lcov-report/index.html
        xdg-open backend/htmlcov/index.html
    else
        echo "Please open the coverage reports manually"
    fi
fi