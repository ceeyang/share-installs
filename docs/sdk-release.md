# SDK 发版校验

三个可发布包，各自独立版本与 tag：

| 包 | 通道 | 坐标 | tag 前缀 |
|---|---|---|---|
| `sdk/ios` | CocoaPods + SPM | `ShareInstalls`（模块名 `InviteSDK`） | `sdk-ios-v*` |
| `sdk/android` | Maven Central + GitHub Packages | `io.github.share-installs:sdk-android` | `sdk-android-v*` |
| `sdk/js` | npm + CDN | `@ceeyang/share-installs` | `sdk-js-v*` |

> **没有 Flutter SDK 包。** `examples/demo_app` 是 Flutter 宿主应用，通过 MethodChannel
> 调用原生 SDK，且标了 `publish_to: 'none'`。要发 pub.dev 需要新建一个 plugin 包。

**版本号来自 tag**，不是文件：JS 走 `npm version <tag版本>`、iOS 用 `sed` 改写 podspec、
Android 读 `SDK_VERSION` 环境变量。所以发版=打 tag，仓库里的版本字面量只是本地默认值。
三端版本可以不同步（当前 iOS/JS `0.0.3`、Android `0.0.4`）。

## 发版前的本地校验

「能打包」不等于「能装能用」。三端都要走到**真实消费**这一步。

### JS

```bash
cd sdk/js
npm ci && npm test && npx tsc --noEmit && npm run build:all
npm pack --pack-destination /tmp

# 真实消费：装 tarball 并跑通三条入口
mkdir -p /tmp/consumer && cd /tmp/consumer && npm init -y
npm install /tmp/ceeyang-share-installs-*.tgz
node -e "console.log(Object.keys(require('@ceeyang/share-installs')))"                # CJS
node --input-type=module -e "import * as s from '@ceeyang/share-installs'; console.log(Object.keys(s))"  # ESM
```

产物路径必须是 `dist/{cjs,esm}/index.js` 与 `dist/types/index.d.ts`，与 `package.json`
的 `main`/`module`/`types`/`exports` 一一对应。**多一层 `dist/cjs/src/` 就是坏的**
（`require()` 直接 `MODULE_NOT_FOUND`），根因是构建用的 tsconfig 继承了基础配置的
`rootDir: "."`；三个 `tsconfig.{esm,cjs,types}.json` 必须各自覆盖 `rootDir: "src"`。

UMD 全局名必须是 `ShareInstalls`（落地页 `examples/web/*.html` 依赖它）。

### Android

```bash
cd sdk/android
./gradlew :invitesdk:test :invitesdk:lint
SDK_VERSION=<版本>-test ./gradlew :invitesdk:publishToMavenLocal   # 无 GPG 密钥时自动跳过签名

# 真实消费：让示例应用去解析发布产物，而不是替换成本地源码
cd ../../examples/demo_app/android
./gradlew :app:dependencies --configuration debugRuntimeClasspath \
  -PusePublishedSdk -PsdkVersion=<版本>-test | grep sdk-android
#   期望： io.github.share-installs:sdk-android:<版本>-test
#   不带 -PusePublishedSdk 时应显示 "-> project :invitesdk"（本地源码模式）
./gradlew :app:assembleDebug -PusePublishedSdk -PsdkVersion=<版本>-test
```

示例默认从源码构建（改 SDK 立刻生效），`-PusePublishedSdk` 才解析真实坐标 ——
**只有后者能证明发布产物可用**，替换成本地工程的构建永远是绿的。

### iOS

```bash
cd sdk/ios
xcodebuild build -scheme InviteSDK -destination 'platform=iOS Simulator,name=<机型>,OS=latest' -configuration Release
xcodebuild test  -scheme InviteSDK -destination 'platform=iOS Simulator,name=<机型>,OS=latest'
pod lib lint ShareInstalls.podspec --allow-warnings     # 必须 "passed validation"
```

**`swift build` 会失败**（`no such module 'UIKit'`）—— 它默认编译到 macOS，而本 SDK 是
iOS-only。必须用 `xcodebuild` 指定 iOS 目标，CI 也是这么做的。

podspec 的 `source_files` / `license` 路径基准**取决于消费方式**：从 trunk 安装时
CocoaPods 检出整个 monorepo，根是仓库根；本地 `:path => '.../sdk/ios'` 时根是该目录。
所以 glob 同时列了两种前缀，`sdk/ios/LICENSE` 也保留了一份副本。改这些路径后
务必重跑 `pod lib lint`。

### 端到端

发布物只是能装，还要能跑通业务链路：

```bash
cd examples/demo_app
bash .smoke/contract_probe.sh                                            # 跨端指纹契约
bash .smoke/run_core_smoke.sh --case all --device <emulator>             # Android
bash .smoke/run_core_smoke.sh --case all --platform ios --device <UDID>  # iOS
bash .smoke/run_device_adb.sh <serial>                                   # Android 真机
```

## CI 里已知的脆弱点

- `sdk-ios.yml` 固定 `xcode-select -s /Applications/Xcode_15.4.app`，且模拟器机型写死
  `name=iPhone 15`。runner 镜像更新后这两项都会失效，届时报错与代码无关。
- Maven 发布需要 `GPG_SIGNING_KEY` / `MAVEN_CENTRAL_*`；本地没有密钥时签名自动跳过，
  未签名的包 Maven Central 会拒收，所以不会静默发出不合规产物。
