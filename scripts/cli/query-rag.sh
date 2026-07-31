#!/bin/bash
# Temporary script to query Procore RAG

QUERY=$1

curl -s -X POST http://localhost:3000/api/procore-docs/ask \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\"}" | jq -r '.answer'
