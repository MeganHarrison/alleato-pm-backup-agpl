#!/bin/bash
# Quick script to save docs folder changes to GitHub

# Default commit message
MESSAGE="${1:-docs: Update documentation}"

# Add docs folder
git add docs/

# Check if there are changes
if git diff --cached --quiet; then
  echo "No changes in docs/ folder to commit"
  exit 0
fi

# Commit
git commit -m "$MESSAGE"

# Push
git push origin main

echo "✅ Docs changes saved and pushed to GitHub!"
