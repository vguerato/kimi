#!/usr/bin/env bash
BASE="http://localhost:3001"
PASS=0; FAIL=0

echo "========================================"
echo "  TESTE GERAL DO SISTEMA — $(date)"
echo "========================================"

run() {
  local label="$1" method="$2" url="$3" data="$4" expect="$5"
  printf "\n%-50s" "[$label]"
  if [ -n "$data" ]; then
    code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" \
      -H 'Content-Type: application/json' -d "$data" "$url")
  else
    code=$(curl -s -o /tmp/resp.json -w '%{http_code}' -X "$method" "$url")
  fi
  body=$(cat /tmp/resp.json)
  if [ "$code" = "$expect" ]; then
    echo "✅  HTTP $code"
    PASS=$((PASS+1))
  else
    echo "❌  HTTP $code (esperado $expect)"
    FAIL=$((FAIL+1))
  fi
  echo "    $body" | python3 -m json.tool 2>/dev/null | head -20 || echo "    $body" | head -5
}

echo ""
echo "── Infraestrutura ──────────────────────────────────────"
run "Health Check"                          GET  "$BASE/health"                                    ""  200

echo ""
echo "── Settings ────────────────────────────────────────────"
run "GET /api/settings"                     GET  "$BASE/api/settings"                              ""  200
run "POST /api/settings (set llm=openai)"   POST "$BASE/api/settings" '{"key":"llm_provider","value":"openai"}' 200

echo ""
echo "── Tasks ───────────────────────────────────────────────"
run "GET /api/tasks"                        GET  "$BASE/api/tasks"                                 ""  200
run "DELETE /api/tasks/nonexistent"         DELETE "$BASE/api/tasks/nonexistent-id"                ""  404
run "POST /api/tasks/nonexistent/retry"     POST "$BASE/api/tasks/nonexistent-id/retry"            ""  404

echo ""
echo "── Projects ────────────────────────────────────────────"
run "GET /api/projects"                     GET  "$BASE/api/projects"                              ""  200
run "GET /api/repos/status"                 GET  "$BASE/api/repos/status"                          ""  200

echo ""
echo "── Ngrok ───────────────────────────────────────────────"
run "GET /api/ngrok-url"                    GET  "$BASE/api/ngrok-url"                             ""  200

echo ""
echo "── Project Manager — agnóstico ─────────────────────────"
run "GET /api/project-manager/providers"    GET  "$BASE/api/project-manager/providers"             ""  200
run "GET /api/project-manager/webhook"      GET  "$BASE/api/project-manager/webhook"               ""  200
run "GET /api/project-manager/config"       GET  "$BASE/api/project-manager/config"                ""  503
run "GET /api/project-manager/mapping"      GET  "$BASE/api/project-manager/mapping"               ""  200

echo ""
echo "── Project Manager — Jira ──────────────────────────────"
run "GET /api/project-manager/jira/webhook" GET  "$BASE/api/project-manager/jira/webhook"          ""  200
run "GET /api/project-manager/jira/config"  GET  "$BASE/api/project-manager/jira/config"           ""  503
run "GET /api/project-manager/jira/mapping" GET  "$BASE/api/project-manager/jira/mapping"          ""  200

echo ""
echo "── Project Manager — Azure DevOps ──────────────────────"
run "GET /api/project-manager/azure-devops/webhook" GET "$BASE/api/project-manager/azure-devops/webhook" "" 200
run "GET /api/project-manager/azure-devops/config"  GET "$BASE/api/project-manager/azure-devops/config"  "" 503
run "GET /api/project-manager/azure-devops/mapping" GET "$BASE/api/project-manager/azure-devops/mapping" "" 200

echo ""
echo "── Erros esperados ─────────────────────────────────────"
# Sem credenciais configuradas → 503 é o comportamento correto
run "POST /api/project-manager/webhook (sem body)" POST "$BASE/api/project-manager/webhook" '{}' 200
# Sem jira_webhook_secret configurado → modo dev, aceita sem assinatura (200)
run "POST /api/project-manager/jira/webhook (sem sig)" POST "$BASE/api/project-manager/jira/webhook" '{"test":true}' 200
run "GET /api/rota-inexistente"             GET  "$BASE/api/rota-inexistente"                      ""  404

echo ""
echo "========================================"
printf "  RESULTADO: %d ✅  %d ❌  (total: %d)\n" $PASS $FAIL $((PASS+FAIL))
echo "========================================"
