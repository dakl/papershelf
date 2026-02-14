#!/usr/bin/env bash
#
# Test all MCP tools and capture notification screenshots.
# Usage: ./scripts/test-mcp-notifications.sh [port] [screenshot_dir]
#
set -euo pipefail

PORT="${1:-13847}"
SCREENSHOT_DIR="${2:-/tmp/papershelf-notification-screenshots}"
BASE_URL="http://127.0.0.1:${PORT}/mcp"
DELAY=3  # seconds between calls for notifications to appear

mkdir -p "$SCREENSHOT_DIR"

# --- helpers ---

init_session() {
  SESSION_ID=$(curl -s -D - -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"notification-test","version":"1.0"}}}' \
    2>&1 | grep -i "mcp-session-id" | cut -d' ' -f2 | tr -d '\r')

  curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' > /dev/null 2>&1

  echo "Session: $SESSION_ID"
}

CALL_ID=2
call_tool() {
  local tool_name="$1"
  local args="$2"
  local screenshot_name="$3"

  echo -n "  $tool_name ... "

  RESULT=$(curl -s -X POST "$BASE_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$CALL_ID,\"method\":\"tools/call\",\"params\":{\"name\":\"$tool_name\",\"arguments\":$args}}")

  CALL_ID=$((CALL_ID + 1))

  # Check for error
  if echo "$RESULT" | grep -q '"isError":true'; then
    echo "ERROR"
  else
    echo "OK"
  fi

  # Wait for notification to appear, then screenshot
  sleep "$DELAY"
  screencapture -x "$SCREENSHOT_DIR/${screenshot_name}.png"
  echo "    -> $SCREENSHOT_DIR/${screenshot_name}.png"
}

# --- main ---

echo "=== MCP Notification Test ==="
echo "Server: $BASE_URL"
echo "Screenshots: $SCREENSHOT_DIR"
echo ""

init_session
echo ""

# No-arg tools
echo "--- No-argument tools ---"
call_tool "list_collections" '{}' "01-list-collections"
call_tool "list_tags" '{}' "02-list-tags"
call_tool "list_categories" '{}' "03-list-categories"
call_tool "list_papers" '{}' "04-list-papers"

# Search tools
echo ""
echo "--- Search tools ---"
call_tool "search_arxiv" '{"query":"transformers","max_results":3}' "05-search-arxiv"
call_tool "search_library" '{"query":"attention"}' "06-search-library"

# Paper operations (save first, then use the paper)
echo ""
echo "--- Paper tools ---"
call_tool "save_paper" '{"arxiv_id":"2401.02385"}' "07-save-paper"

# Get the paper ID from library
PAPER_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":$CALL_ID,\"method\":\"tools/call\",\"params\":{\"name\":\"list_papers\",\"arguments\":{}}}")
CALL_ID=$((CALL_ID + 1))

call_tool "get_paper" '{"id":"2401.02385"}' "08-get-paper"
call_tool "get_bibtex" '{"id":"2401.02385"}' "09-get-bibtex"
call_tool "toggle_favorite" '{"id":"2401.02385"}' "10-toggle-favorite"

# Organization tools
echo ""
echo "--- Organization tools ---"
call_tool "create_collection" '{"name":"Test Collection","color":"#FF6B6B"}' "11-create-collection"
call_tool "create_tag" '{"name":"test-tag","color":"#4ECDC4"}' "12-create-tag"
call_tool "add_paper_to_collection" '{"paper_id":"2401.02385","collection":"Test Collection"}' "13-add-paper-to-collection"
call_tool "add_tag_to_paper" '{"paper_id":"2401.02385","tag":"test-tag"}' "14-add-tag-to-paper"
call_tool "remove_tag_from_paper" '{"paper_id":"2401.02385","tag":"test-tag"}' "15-remove-tag-from-paper"
call_tool "remove_paper_from_collection" '{"paper_id":"2401.02385","collection":"Test Collection"}' "16-remove-paper-from-collection"

# fetch_paper_html is slow (fetches from ar5iv), do it last
echo ""
echo "--- HTML fetch (slow) ---"
call_tool "fetch_paper_html" '{"arxiv_id":"2401.02385"}' "17-fetch-paper-html"

echo ""
echo "=== Done! $((CALL_ID - 2)) tools called ==="
echo "Screenshots in: $SCREENSHOT_DIR"
echo "Open with: open $SCREENSHOT_DIR"
