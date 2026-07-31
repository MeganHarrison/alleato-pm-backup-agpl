#!/bin/bash
# Query RAG without jq processing

QUERY=$1

curl -s -X POST http://localhost:3000/api/procore-docs/ask \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\"}"
