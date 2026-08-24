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
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --case)    CASE="$2"; shift 2;;
    --host)    HOST="$2"; shift 2;;
    --backend) BACKEND="$2"; shift 2;;
    --device)  DEVICE="--device $2"; shift 2;;
    --skip-build) SKIP_BUILD=1; shift;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

: "${JAVA_HOME:=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

API_BASE="http://$HOST:6066/api"
PAGE_URL="http://$HOST:6066/examples/web/fingerprint-demo.html"
FLOWS="$(cd "$(dirname "$0")" && pwd)/flows"

ADB="adb"
[[ -n "$DEVICE" ]] && ADB="adb -s ${DEVICE#--device }"

echo "== 前置检查 =="
curl -sf "$BACKEND/api/health" >/dev/null || { echo "后端未运行：$BACKEND"; exit 1; }

# 真机常见情况：路由器开了 AP 客户端隔离，手机和开发机同网段也互相不可达。
# --host localhost 时用 USB 反向隧道绕开，不依赖局域网。
if [[ "$HOST" == "localhost" || "$HOST" == "127.0.0.1" ]]; then
  $ADB reverse tcp:6066 tcp:6066 >/dev/null || { echo "adb reverse 失败"; exit 1; }
  echo "已建立 USB 反向隧道 tcp:6066"
fi

# 设备必须解锁且保持唤醒，否则页面不会真正运行、Maestro 也点不到东西
$ADB shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
if $ADB shell dumpsys window 2>/dev/null | grep -q "mDreamingLockscreen=true"; then
  echo "❌ 设备处于锁屏状态，请先解锁（建议同时开启开发者选项里的「不锁定屏幕」）"; exit 1
fi

echo "backend ok, 设备侧地址 = $API_BASE"

# 后端地址在构建期烧进 App —— 用例不去点输入框（Maestro 输入 "://" 会吞字符）。
if [[ "$SKIP_BUILD" == "0" ]]; then
  echo "== 构建并安装（SI_API_BASE_URL=${API_BASE}）=="
  ( cd "$(dirname "$0")/.." && flutter build apk --debug --dart-define=SI_API_BASE_URL="$API_BASE" >/dev/null ) \
    || { echo "构建失败"; exit 1; }
  APK="$(cd "$(dirname "$0")/.." && pwd)/build/app/outputs/flutter-apk/app-debug.apk"
  $ADB install -r -d "$APK" >/dev/null 2>&1 || {
    echo "❌ 安装失败。小米/红米需在 开发者选项 里打开「USB 安装」；设备也必须处于解锁状态。"; exit 1; }
  echo "installed"
fi

# 清空本设备近期未解析的 click，否则 C2 会匹配到上一轮残留，C1 也可能匹配到旧码。
# Maestro 每次会话结束会卸载自己的驱动包，下一轮用 `adb install` 重装。
# 小米/红米（MIUI）拒绝 adb install（INSTALL_FAILED_USER_RESTRICTED），但设备 shell 里的
# `pm install` 是通的 —— 所以每轮跑之前先用后者把驱动装好，Maestro 就不必自己装了。
MAESTRO_JAR="$HOME/.maestro/lib/maestro-client.jar"
DRIVER_DIR="$HOME/.maestro/driver-apks"
ensure_maestro_driver () {
  [[ -f "$MAESTRO_JAR" ]] || return 0
  if [[ ! -f "$DRIVER_DIR/maestro-app.apk" ]]; then
    mkdir -p "$DRIVER_DIR"
    unzip -o -q "$MAESTRO_JAR" maestro-app.apk maestro-server.apk -d "$DRIVER_DIR" || return 0
  fi
  for f in maestro-app.apk maestro-server.apk; do
    ${ADB} push "$DRIVER_DIR/$f" "/data/local/tmp/$f" >/dev/null 2>&1 || return 0
    ${ADB} shell pm install -r -t "/data/local/tmp/$f" >/dev/null 2>&1 || true
  done
}

reset_clicks () {
  echo "-- 重置未解析 click --"
  docker exec share-installs-db-1 psql -U postgres -d share_installs -qtAc \
    "update click_events set resolved = true, resolved_at = now() where resolved = false;" >/dev/null
  docker exec share-installs-redis-1 redis-cli --scan --pattern 'si:click*' 2>/dev/null \
    | xargs -r -n 100 docker exec share-installs-redis-1 redis-cli del >/dev/null || true
  docker exec share-installs-redis-1 redis-cli del 'si:clicks:recent:global' >/dev/null
}

APP=com.shareinstalls.demo_app

# 冷启动走 adb：MIUI 会拦截 Maestro 驱动进程发起的应用启动（进程根本起不来）。
# 本 App 与 SDK 均无持久化，force-stop 后再启动即等价于冷启动。
cold_start_app () {
  ${ADB} shell am force-stop "$APP" >/dev/null 2>&1 || true
  ${ADB} shell am start -n "$APP/.MainActivity" >/dev/null 2>&1
  # 光看进程存在不够：共享模拟器上可能有别的 App 抢占前台。轮询到本 App 真的在前台。
  for _ in $(seq 1 25); do
    sleep 1
    ${ADB} shell dumpsys activity activities 2>/dev/null | grep -q "topResumedActivity.*$APP" && return 0
  done
  echo "❌ App 未能进入前台"
  exit 1
}

# 在设备自己的浏览器里点邀请链接：真实采集浏览器指纹并上报。
open_landing_page () {
  local code="$1"
  # URL 必须在**设备侧**加引号：& 会被设备 shell 当成后台运算符截断，
  # code/auto 参数丢失后页面会静默用默认邀请码，症状极具误导性。
  # 不要 force-stop Chrome：MIUI 之后不再允许 intent 把它拉起。
  local url="$PAGE_URL?api=$API_BASE&code=$code&auto=1"
  ${ADB} shell "am start -a android.intent.action.VIEW -n com.android.chrome/com.google.android.apps.chrome.Main --ez create_new_tab true -d '$url'" >/dev/null 2>&1
  sleep 12
}

run_c1 () {
  ensure_maestro_driver
  reset_clicks
  local code="SMOKE$(date +%H%M%S)"
  echo "== C1 同设备点击后可解析 (code=$code) =="

  open_landing_page "$code"
  # 服务端确认点击真的落库了，否则后面的失败会指向错误的方向
  local clicks
  clicks=$(curl -s "$BACKEND/api/v1/debug/clicks/$code" | python3 -c 'import sys,json;print(json.load(sys.stdin)["count"])')
  [[ "$clicks" -ge 1 ]] || { echo "❌ 落地页未能上报点击（设备访问不到 $API_BASE？）"; exit 1; }
  echo "浏览器侧已上报 $clicks 条 click"

  cold_start_app
  maestro test $DEVICE "$FLOWS/c1_deferred_link_resolves.yaml" --env CODE="$code"

  # 服务端复核：UI 绿了还要确认后端真的落了一条归因记录
  local row
  row=$(docker exec share-installs-db-1 psql -U postgres -d share_installs -qtAc \
    "select match_channel||' '||confidence||' '||platform from conversions where invite_code='$code';")
  [[ -n "$row" ]] || { echo "❌ UI 通过但后端没有 conversion 记录"; exit 1; }
  echo "✅ C1 conversion: $row"
}

run_c2 () {
  ensure_maestro_driver
  reset_clicks
  echo "== C2 无点击不得凭空匹配 =="
  cold_start_app
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
