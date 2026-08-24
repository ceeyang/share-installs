#!/usr/bin/env bash
# 真机核心链路验证 —— 纯 adb 驱动，不依赖 Maestro 驱动包。
#
#   bash .smoke/run_device_adb.sh <device-serial>
#
# 为什么单独有这一份：MIUI 这类深度定制系统会反复拒绝 Maestro 安装自己的驱动包
# （Maestro 每次会话结束卸载，下次重装即"新装应用"，被 INSTALL_FAILED_USER_RESTRICTED 拦下）。
# 本脚本只用 am start / input tap / uiautomator dump，装好被测 App 就能跑。
#
# 前置：开发者选项里 USB 调试、Install via USB、**USB 调试（安全设置）** 三项全开，
#      最后一项决定 adb 能否模拟输入（否则 input tap 报 INJECT_EVENTS SecurityException）。
set -uo pipefail
D="${1:-}"; [[ -n "$D" ]] || { echo "用法: $0 <device-serial> [host]"; exit 2; }
# host = 设备视角下的后端地址。默认 localhost（配合 adb reverse 走 USB 隧道）。
# 传本机 LAN IP 则走真实局域网 —— 两者覆盖不同场景：
#   localhost → 浏览器视为安全上下文，UA-CH 可用，web 侧带 osVersion（生产 https 的等价场景）
#   LAN IP    → 非安全上下文，UA-CH 不可用，web 侧无 osVersion；但真实 IP 段参与匹配
HOST="${2:-localhost}"
APP=com.shareinstalls.demo_app
A="adb -s $D"
API=http://$HOST:6066/api
PAGE=http://$HOST:6066/examples/web/fingerprint-demo.html

dump () { $A shell uiautomator dump /sdcard/v.xml >/dev/null 2>&1; $A shell cat /sdcard/v.xml 2>/dev/null; }

# uiautomator 只 dump **可见** 节点，所以找元素/断言前都要先滚到位。
scroll_down () { $A shell input swipe 360 1200 360 500 400 >/dev/null 2>&1; sleep 1; }

# Flutter 的语义标签在 Android 上落到 content-desc，不一定在 text —— 两个都要看
find_center () {
  dump | python3 -c "
import sys,re
want=sys.argv[1]; x=sys.stdin.read()
for m in re.finditer(r'<node[^>]*?>',x):
    n=m.group(0)
    t=re.search(r'text=\"([^\"]*)\"',n); d=re.search(r'content-desc=\"([^\"]*)\"',n)
    b=re.search(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"',n)
    vals={v.group(1) for v in (t,d) if v}
    if b and want in vals:
        x1,y1,x2,y2=map(int,b.groups()); print((x1+x2)//2,(y1+y2)//2); break
" "$1"
}
tap_text () {
  local c
  for _ in 1 2 3 4 5; do
    c=$(find_center "$1"); [[ -n "$c" ]] && { $A shell input tap $c; return 0; }
    scroll_down
  done
  echo "❌ 找不到元素：$1"; return 1
}
# 滚动搜索屏幕文本（内容可能在折叠下方）
screen_has () {
  for _ in 1 2 3 4 5; do
    dump | grep -q "$1" && return 0
    scroll_down
  done
  return 1
}

echo "== 1. 重置未解析 click =="
docker exec share-installs-db-1 psql -U postgres -d share_installs -qtAc \
  "update click_events set resolved=true, resolved_at=now() where resolved=false;" >/dev/null
docker exec share-installs-redis-1 redis-cli del 'si:clicks:recent:global' >/dev/null

CODE="REAL$(date +%H%M%S)"
echo "== 2. 设备浏览器点邀请链接 (code=$CODE) =="
[[ "$HOST" == "localhost" || "$HOST" == "127.0.0.1" ]] && $A reverse tcp:6066 tcp:6066 >/dev/null
# URL 必须在设备侧加引号：& 会被设备 shell 当成后台运算符截断，code/auto 静默丢失。
# 也不要 force-stop Chrome，MIUI 之后不再允许 intent 把它拉起。
# 不指定组件：Chrome 的入口类名随版本变化（.Main / .IntentDispatcher），写死会在
# 别的机型上静默失败。交给系统默认 VIEW 处理者，换任何浏览器都能跑。
# create_new_tab 避免浏览器只把旧标签页拉到前台而不重新导航。
$A shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
$A shell "am start -a android.intent.action.VIEW --ez create_new_tab true -d '$PAGE?api=$API&code=$CODE&auto=1'" >/dev/null 2>&1
sleep 12
N=$(curl -s "$API/v1/debug/clicks/$CODE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["count"])')
[[ "$N" -ge 1 ]] || { echo "❌ 浏览器侧未上报（设备访问不到 ${API}？）"; exit 1; }
curl -s "$API/v1/debug/clicks/$CODE" | python3 -c "
import sys,json; e=json.load(sys.stdin)['events'][0]
print('   真机浏览器信号:', {k:e[k] for k in ['ipAddress','osVersion','timezone','screenWidth','screenHeight','pixelRatio']})"

echo "== 3. 冷启动 App =="
# 屏幕熄了就什么都点不动，冷启前先唤醒并保持常亮
$A shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1
$A shell wm dismiss-keyguard >/dev/null 2>&1
$A shell svc power stayon usb >/dev/null 2>&1
sleep 1
$A shell am force-stop $APP >/dev/null 2>&1
$A shell am start -n "$APP/.MainActivity" >/dev/null 2>&1
fg=0
for _ in $(seq 1 25); do
  sleep 1
  $A shell dumpsys activity activities 2>/dev/null | grep -qE "(top)?ResumedActivity.*$APP" && { fg=1; break; }
done
# 轮询超时不能默默往下走：那样会去点浏览器的界面，报出来的是"找不到按钮"，
# 指向完全错误的方向。
[[ "$fg" == 1 ]] || { echo "❌ App 未进入前台（前台是：$($A shell dumpsys activity activities 2>/dev/null | grep -m1 -oE '(top)?ResumedActivity[^}]*'))"; exit 1; }
# 冷启后大标题栏还在收缩动画中，此刻 dump 到的坐标会漂 —— 等布局稳定再操作
sleep 4

echo "== 4. Configure SDK =="
ok=0
for attempt in 1 2 3; do
  tap_text "Configure SDK" || exit 1
  sleep 4
  screen_has "SDK configured successfully" && { ok=1; break; }
  echo "   第 $attempt 次点击未生效（坐标漂移），重试"
done
[[ "$ok" == 1 ]] && echo "   ✅ 配置成功" || { echo "❌ 配置失败"; exit 1; }

echo "== 5. Resolve =="
tap_text "Resolve" || exit 1
sleep 10

echo "== 6. 断言 =="
screen_has "$CODE" && echo "   ✅ 界面返回了本轮邀请码 $CODE" || echo "   ❌ 界面未返回 $CODE"
echo "   服务端 conversion（注意 match_channel：落到 clipboard 说明两条指纹通道都失败了）:"
docker exec share-installs-db-1 psql -U postgres -d share_installs -c \
  "select invite_code, match_channel, confidence, platform from conversions where invite_code='$CODE';" 2>&1 | head -5
