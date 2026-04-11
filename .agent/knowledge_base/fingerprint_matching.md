# [Fingerprint] 指纹匹配关键约束

## 背景

指纹匹配是本项目的核心功能：Web SDK 采集浏览器信号 → 存入 Redis/DB → 原生 SDK 采集设备信号 → 后端匹配。匹配质量直接决定邀请归因的准确率。

## 规则

### 1. IPv6-mapped IPv4 归一化（必须）

`req.socket.remoteAddress` 在反向代理或 loopback 场景下会返回 `::ffff:1.2.3.4` 格式。
`computeFingerprint` 和 `computeSimilarityScore` 按字符串比较 IP，不做自动归一化，所以 `::ffff:127.0.0.1` ≠ `127.0.0.1`，导致 IP 信号不匹配，模糊匹配分数下降。

**必须**在 `extractClientIp` 中归一化：

```typescript
const raw = ...;
return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
```

### 2. 模糊匹配阈值

- 默认阈值：`0.75`（`FINGERPRINT_MATCH_THRESHOLD` 环境变量）
- IP 信号权重较高，IP /24 subnet 不匹配时分数会显著下降
- 跨平台（Web → Native）时 canvas/webgl/audio hash 不参与评分（Native 侧无此信号）

### 3. 三通道优先级

1. **Clipboard**（Android，置信度 1.0）：格式 `SHAREINSTALLS:{projectId}:{code}` 或 `SHAREINSTALLS:{code}`
2. **Exact hash match**（Redis fast path，置信度 1.0）
3. **Fuzzy similarity match**（DB scan，置信度 = similarity score）

### 4. 测试中的 IP 处理

集成测试（supertest）的请求 IP 是 `::ffff:127.0.0.1`，经归一化后变为 `127.0.0.1`。
Mock 的 click event `ipAddress` 字段应设为 `127.0.0.1`（同 /24 subnet），否则模糊匹配因 IP 不符而分数不足 0.75。

## 反例

```typescript
// ❌ 不归一化 → 反代后端模糊匹配失败
return req.socket.remoteAddress ?? '0.0.0.0';

// ✅ 归一化
const raw = req.socket.remoteAddress ?? '0.0.0.0';
return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
```

## 相关文件

- `backend/src/controllers/resolveController.ts` — `extractClientIp()`
- `backend/src/utils/fingerprint.ts` — `computeSimilarityScore()`
- `backend/src/services/fingerprintService.ts` — 三通道匹配逻辑

## 更新历史

- [2026-04-10] [Claude] 初始记录，在 E2E 模糊匹配测试中发现（IPv6 归一化缺失导致测试失败）
