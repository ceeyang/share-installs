#!/usr/bin/env bash
# share-installs 核心链路冒烟入口 —— 浏览器指纹上报 → 后端匹配 → 原生 SDK 解析。
#
#   bash .smoke/run_core_smoke.sh --case all                      # 模拟器/默认设备
#   bash .smoke/run_core_smoke.sh --case c1 --host 192.168.88.233 # 真机（同一局域网）
#
# --host 决定「设备视角下的后端地址」：模拟器用 10.0.2.2，真机必须用本机 LAN IP。
set -euo pipefail

CASE=all
HOST=10.0.2.2          # Android 模拟器看到的宿主 loopback
BACKEND=http://localhost:6066   # 本脚本自己访问后端用的地址
DEVICE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --case)    CASE="$2"; shift 2;;
    --host)    HOST="$2"; shift 2;;
    --backend) BACKEND="$2"; shift 2;;
    --device)  DEVICE="--device $2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

: "${JAVA_HOME:=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

API_BASE="http://$HOST:6066/api"
PAGE_URL="http://$HOST:6066/examples/web/fingerprint-demo.html"
FLOWS="$(cd "$(dirname "$0")" && pwd)/flows"

echo "== 前置检查 =="
curl -sf "$BACKEND/api/health" >/dev/null || { echo "后端未运行：$BACKEND"; exit 1; }
echo "backend ok, 设备侧地址 = $API_BASE"

# 清空本设备近期未解析的 click，否则 C2 会匹配到上一轮残留，C1 也可能匹配到旧码。
reset_clicks () {
  echo "-- 重置未解析 click --"
  docker exec share-installs-db-1 psql -U postgres -d share_installs -qtAc \
    "update click_events set resolved = true, resolved_at = now() where resolved = false;" >/dev/null
  docker exec share-installs-redis-1 redis-cli --scan --pattern 'si:click*' 2>/dev/null \
    | xargs -r -n 100 docker exec share-installs-redis-1 redis-cli del >/dev/null || true
  docker exec share-installs-redis-1 redis-cli del 'si:clicks:recent:global' >/dev/null
}

run_c1 () {
  reset_clicks
  local code="SMOKE$(date +%H%M%S)"
  echo "== C1 同设备点击后可解析 (code=$code) =="
  maestro test $DEVICE "$FLOWS/c1_deferred_link_resolves.yaml" \
    --env PAGE_URL="$PAGE_URL" --env API_BASE="$API_BASE" --env CODE="$code"

  # 服务端复核：UI 绿了还要确认后端真的落了一条归因记录
  local row
  row=$(docker exec share-installs-db-1 psql -U postgres -d share_installs -qtAc \
    "select match_channel||' '||confidence||' '||platform from conversions where invite_code='$code';")
  [[ -n "$row" ]] || { echo "❌ UI 通过但后端没有 conversion 记录"; exit 1; }
  echo "✅ C1 conversion: $row"
}

run_c2 () {
  reset_clicks
  echo "== C2 无点击不得凭空匹配 =="
  maestro test $DEVICE "$FLOWS/c2_no_click_no_match.yaml"
  echo "✅ C2 通过"
}

case "$CASE" in
  c1)  run_c1;;
  c2)  run_c2;;
  all) run_c1; run_c2;;
  *) echo "--case 只能是 c1 / c2 / all"; exit 2;;
esac
echo; echo "全部通过。"
