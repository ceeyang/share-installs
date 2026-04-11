# [Rate Limiting] Redis 多限流器 Key 冲突

## 背景

`express-rate-limit` v7 的 `store.increment(key)` 接收的 key 是原始标识符（通常是 IP 地址），**不带任何 limiter 级别的命名空间**。如果多个 limiter 共用同一个 Redis 实例且 store 没有独立前缀，它们会操作同一个 Redis key，导致计数器互相消耗。

## 规则

1. `RedisStore` 构造函数必须接受 `keyPrefix: string` 参数。
2. 每个 limiter 实例必须使用唯一前缀：
   - 全局 API 限流：`rl:api`
   - 邀请创建限流：`rl:invite`
   - resolve 端点限流：`rl:resolve`
3. Redis key 最终格式：`` `${keyPrefix}:${ip}` ``

## 反例

```typescript
// ❌ 错误：三个 limiter 都写 rl:{ip}，计数共享
store: new RedisStore(redis, windowMs)

// ✅ 正确：各自独立前缀
store: new RedisStore(redis, windowMs, 'rl:resolve')
```

## 相关文件

- `backend/src/middleware/rateLimit.ts`

## 更新历史

- [2026-04-10] [Claude] 初始记录，在集成测试中发现（rate limit 测试第 5 个请求即触发 429）
