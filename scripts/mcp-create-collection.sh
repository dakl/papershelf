#!/usr/bin/env bash
set -euo pipefail

PORT="${MCP_PORT:-13847}"
BASE="http://127.0.0.1:${PORT}/mcp"
NAME="${1:?Usage: $0 <collection-name> [color-hex]}"
COLOR="${2:-#FFD60A}"

# Initialize session and capture the session ID header
INIT_RESPONSE=$(curl -s -D - "$BASE" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"initialize\",
    \"params\": {
      \"protocolVersion\": \"2025-03-26\",
      \"capabilities\": {},
      \"clientInfo\": { \"name\": \"curl\", \"version\": \"1.0\" }
    }
  }")

SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i 'mcp-session-id' | tr -d '\r' | awk '{print $2}')

if [ -z "$SESSION_ID" ]; then
  echo "Failed to get session ID. Is the MCP server running on port ${PORT}?" >&2
  echo "$INIT_RESPONSE" >&2
  exit 1
fi

# Call create_collection
curl -s "$BASE" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: ${SESSION_ID}" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"create_collection\",
      \"arguments\": {
        \"name\": \"${NAME}\",
        \"color\": \"${COLOR}\"
      }
    }
  }"

echo
