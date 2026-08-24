# SaaS 定价方案（2026-08 调研）

> 结论先行：建议 Pro 提到 **$9/月、$79/年**，Unlimited 提到 **$19/月、$159/年**，Free 不变。
> 当前 $4.99/$9.99 远低于市场底价，且 Paddle 手续费在低价位吃掉 10–15% 收入。

---

## 1. 执行摘要

share-installs 的 SaaS 版卖点是"免填邀请码 + 延迟深链归因"的托管服务。调研了国内 3 家直接同类
产品与海外 5 家深链/归因产品后，结论是：**当前定价（Pro $4.99/月）不是"稍微便宜"，而是比全市场
最低的可比产品还便宜 74%**，既没有利用国内竞品收缩（ShareInstall 停运）的窗口，也在手续费上吃亏。
建议整体上调一档，仍保持全市场最低价定位。

## 2. 关键发现

### 国内直接同类（免填邀请码，按应用/年计费）

| 产品 | 价格 | 折合美元/月 | 免费版 | 来源 |
| --- | --- | --- | --- | --- |
| openinstall 高级版 | ¥8,000/年（¥5,000/半年） | ≈ $93 | 仅供测试验证 | 搜索聚合，2026-08 |
| Xinstall 专业版 | ¥900/月；¥7,888/年 | ≈ $92–103 | 限 10 个 IP 数据展示 | xinstall.com/price，2026-08 |
| ShareInstall | **已停止运营**（存量客户服务至到期） | — | — | shareinstall.com.cn 官网公告 |

### 海外深链/归因产品（订阅制，按 MAU/转化计费）

| 产品 | 免费额度 | 付费起步价 | 备注 |
| --- | --- | --- | --- |
| Branch | 10k MAU | 无公开价，约 $199–500/月起 | 企业年约普遍 $15k+ |
| Airbridge | 10k MAU | $199/月 | |
| AppsFlyer | 12k 次安装（一次性） | $0.07/转化 | 纯用量计费 |
| Adjust | — | 约 $500/月起 | |
| ChottuLink | 25k MAU | **$19/月** | 全市场可比最低价 |

（以上均为第三方比价文章 + 官网数据，2026 年口径；Branch/Adjust 无公开价目表，取多方一致区间。）

### 现状问题

1. **定价低于市场底价 74%**：可比最低价 ChottuLink $19/月，我们 Unlimited 才 $9.99。
2. **Paddle 手续费结构惩罚低价**：约 5% + $0.50/笔 → $4.99 档实际费率 ~15%，$19 档降到 ~7.5%。
3. **信任悖论**：开发者工具定价过低反而让"生产可用性"存疑（对标品都是 $199 起）。
4. 产品开源可自部署（Self-Hosted $0），SaaS 卖的是省心——免费档已经是获客漏斗，付费档无需再压价。

## 3. 建议定价（方案 A，推荐）

| 档位 | 月付 | 年付 | 年付折合 | 定位 |
| --- | --- | --- | --- | --- |
| Free | $0 | — | — | 集成验证 + 小体量个人项目（500 次解析/月） |
| Pro | **$9/月** | **$79/年** | $6.58/月（省 27%） | 成长期产品（10,000 次解析/月，5 项目） |
| Unlimited | **$19/月** | **$159/年** | $13.25/月（省 30%） | 高流量 App（无限解析，365 天留存） |

为什么是这三个数：

- **$19 = 对齐市场底价**：与 ChottuLink 持平，但我们额度是"无限解析"，对比之下仍是让利。
- **$9 = "稍微便宜"的字面落点**：比市场底价低 53%，符合"功能单一、定价略低"的策略，
  同时把 Paddle 费率从 15% 压到 10%。
- **年付折扣拉大到 27–30%**（原 17%）：单一功能工具的续费黏性弱，用年付锁现金流和留存。
- 国内客户对标 openinstall ¥8,000/年，我们 Unlimited 年付 $159 ≈ ¥1,150，**便宜 86%**，
  跨境价格优势巨大，无需再降。

### 备选

- **方案 B（不动价）**：维持 $4.99/$9.99。适合"先跑通支付链路、以量换口碑"阶段；
  代价是手续费高、低价心智日后难上调（涨价流失远高于定高价后打折）。
- **方案 C（激进）**：Pro $12.99 / Unlimited $24.99。单功能产品撑不起，不建议。

## 4. 定价页文案（随方案 A）

### 中文

- **Free — 免费起步**：跑通集成、验证归因链路。500 次解析/月、1 个项目、7 天数据留存。
  按钮：免费开始
- **Pro — 成长首选**（推荐标签：最受欢迎）：为增长中的 App 准备的完整归因额度。
  10,000 次解析/月、5 个项目、每项目 10 个 API Key、90 天数据留存、优先支持。
  按钮：升级 Pro ｜ 年付立省 27%
- **Unlimited — 放开跑量**：不限解析、不限项目、365 天数据留存，适合大推广节点与矩阵 App。
  按钮：升级 Unlimited ｜ 年付立省 30%
- 副标题（定价区头部）：**比同类产品便宜一半以上，还能随时自部署迁出——不锁你。**

### English

- **Free — Start free**: Everything you need to integrate and verify attribution.
  500 resolutions/mo, 1 project, 7-day retention. CTA: Get started
- **Pro — Best for growth** (badge: Most popular): Full attribution quota for growing apps.
  10,000 resolutions/mo, 5 projects, 10 API keys each, 90-day retention, priority support.
  CTA: Upgrade to Pro | Save 27% yearly
- **Unlimited — Scale without limits**: Unlimited resolutions & projects, 365-day retention.
  Built for launch spikes and app portfolios. CTA: Go Unlimited | Save 30% yearly
- Section subtitle: **Less than half the price of alternatives — and you can self-host
  anytime. No lock-in.**

## 5. 改价涉及面清单（全部改齐才算完成）

| # | 位置 | 内容 |
| --- | --- | --- |
| 1 | `backend/src/services/paddleService.ts` PRICING 常量 | 4.99/50/9.99/100 → 新值 |
| 2 | `dashboard/src/views/PricingView.vue` | monthlyPrice/yearlyPrice 展示值 |
| 3 | `docs/index.html` 定价区（4 处 + 年付折合文案） | 硬编码价格 |
| 4 | `docs/index.zh.html` 定价区（同上） | 硬编码价格 |
| 5 | Paddle Live 后台 | 按新价创建 4 个 price（月/年 × Pro/Unlimited） |
| 6 | 服务器 `.env` + 根 `.env`（dashboard 构建注入） | 4 个 live price ID |
| 7 | 落地页 JSON-LD（若已加 SoftwareApplication offers） | 价格字段同步 |

注意：Paddle 的 price 金额创建后不可改，改价 = 建新 price 归档旧 price；
存量订阅按老价格继续，PRICE_TO_PLAN 映射需同时保留新旧 price ID，直至老订阅清零。

## 6. 风险与反面证据

- 海外比价文章多出自竞品博客（ChottuLink 等），对 Branch 的贬损有立场；但价格区间与
  vendr/linkly 等第三方一致，采信区间而非单点。
- $9/$19 仍属冲动消费区间，付费意愿受支付摩擦影响大于价格本身；Paddle overlay 结账体验是关键。
- 若目标客群以国内开发者为主，美元订阅 + Paddle 可能是比价格更大的转化障碍（无支付宝）；
  这属于渠道问题，不在本次定价范围内。

## 7. 数据来源

- openinstall 价格：官网 price.html 及 PartnerShare 聚合页（2026-08 检索）
- Xinstall 价格：xinstall.com/price（2026-08 直接抓取）
- ShareInstall 停运公告：shareinstall.com.cn 首页
- Branch/Airbridge/AppsFlyer/Adjust/ChottuLink：chottulink.com 比价系列、linklyhq.com、
  vendr.com、grovs.io、outmano.com（均 2026 年口径）
