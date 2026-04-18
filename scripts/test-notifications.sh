#!/usr/bin/env bash
# Manual curl tests for mf-go notifications API.
# Prerequisites: mf-go running (make run), migration 014 applied.
# Default URL: http://localhost:8080/graphql

GRAPHQL_URL="${EXPO_PUBLIC_GRAPHQL_URL:-http://localhost:8080/graphql}"

echo "=== Notifications API Test ==="
echo "URL: $GRAPHQL_URL"
echo ""

# 1. List notifications (no auth - returns all)
echo "1. List notifications (no language filter):"
curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { notifications(limit: 10) { id title message type category isRead createdAt } }"}' | jq .

echo ""
echo "2. List notifications (language=en, like app):"
curl -s -X POST "$GRAPHQL_URL" \
  -H "Content-Type: application/json" \
  -d '{"query":"query($lang: String) { notifications(language: $lang, limit: 10) { id title message type category isRead createdAt } }","variables":{"lang":"en"}}' | jq .

echo ""
echo "3. Admin create (requires TOKEN from login):"
echo '   TOKEN=$(curl -s -X POST "'"$GRAPHQL_URL"'" -H "Content-Type: application/json" \'
echo '     -d "{\"query\":\"mutation($e:String!,$p:String!){login(input:{email:$e,password:$p}){accessToken}}\",\"variables\":{\"e\":\"admin@test.com\",\"p\":\"password\"}}" \'
echo '     | jq -r .data.login.accessToken)'
echo '   curl -s -X POST "'"$GRAPHQL_URL"'" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \'
echo '     -d "{\"query\":\"mutation{adminCreateNotification(input:{title:\\\"Test\\\",message:\\\"Hello\\\"}){id title message}}\"}" | jq .'
echo ""
echo "Done. Restart mf-go after SQL changes."
