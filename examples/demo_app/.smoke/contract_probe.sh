#!/usr/bin/env bash
# 跨端指纹契约探针 —— 不经过 UI，直接用「真实设备参数」打后端两个端点，
# 验证 web 侧与 native 侧采集到的同一台设备的信号能不能被后端判为同一台。
#
#   bash .smoke/contract_probe.sh [backend_base]   # 默认 http://localhost:6066/api
#
# 为什么需要它：UI 冒烟跑在明文 http 上，非安全上下文使 navigator.userAgentData
# 不可用，web 侧 osVersion 恒为空，恰好绕过了 osVersion 硬否决。生产落地页是 https，
# UA-CH 生效，才会踩到 A 组那个坑。这个探针把两种情形都显式跑一遍。
set -uo pipefail
API="${1:-http://localhost:6066/api}"

probe () {
  local label="$1" code="$2" web_os="$3" native_os="$4"
  curl -s -X POST "$API/v1/clicks" -H 'Content-Type: application/json' -d "{
    \"inviteCode\": \"$code\",
    \"fingerprint\": {
      \"ua\": \"Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36\",
      \"osVersion\": $web_os,
      \"screen\": {\"w\": 412, \"h\": 924, \"dpr\": 2.625, \"depth\": 24},
      \"hardware\": {\"cores\": 4},
      \"languages\": [\"en-US\",\"en\"],
      \"timezone\": \"Asia/Phnom_Penh\",
      \"touchPoints\": 5
    }}" >/dev/null

  local out
  out=$(curl -s -X POST "$API/v1/resolutions" -H 'Content-Type: application/json' -d "{
    \"channel\": \"android\",
    \"fingerprint\": {
      \"androidId\": \"probe-android-id\",
      \"osVersion\": $native_os,
      \"apiLevel\": 37,
      \"screen\": {\"w\": 411, \"h\": 923, \"density\": 2.625},
      \"languages\": [\"en-US\"],
      \"timezone\": \"Asia/Phnom_Penh\",
      \"networkType\": \"wifi\",
      \"hardwareConcurrency\": 4,
      \"touchPoints\": 5
    }}")
  printf '%-46s web=%-7s native=%-5s -> %s\n' "$label" "$web_os" "$native_os" "$out"
}

echo "== Android web → native 指纹契约 =="
probe "A. https 落地页（UA-CH 生效）"  "PROBE_A_$$" '"17.0"' '"17"'
probe "B. 两侧 osVersion 一致"          "PROBE_B_$$" '"17"'   '"17"'
probe "C. http 落地页（UA-CH 不可用）"  "PROBE_C_$$" 'null'   '"17"'
echo
echo "期望：B、C 匹配；A 目前不匹配 —— 见 .smoke/report.md 缺陷 D1。"
