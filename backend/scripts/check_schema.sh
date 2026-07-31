#!/bin/bash
# Schema validation convenience script
# Run this from anywhere in the project to check for schema mismatches

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR"

# Activate venv if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the validation script
python scripts/validate_schema.py
